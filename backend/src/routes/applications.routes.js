import { Router } from "express";
import { pool } from "../db/pool.js";
import { withTransaction, PG_ERRORS } from "../db/transaction.js";
import { requireAuth } from "../middleware/auth.middleware.js";
import { validateBody, validateParams, validateQuery } from "../middleware/validate.middleware.js";
import { invalidateDashboard } from "../db/redis.js";
import { asyncHandler } from "../utils/async-handler.js";
import { ok, created } from "../utils/api-response.js";
import { badRequest, conflict, notFoundError } from "../utils/api-error.js";
import { createApplication, createApplicationWithJob } from "../services/resume.service.js";
import {
  createApplicationSchema,
  createApplicationWithJobSchema,
  listApplicationsQuerySchema,
  updateStatusSchema,
  idParamSchema,
} from "../validation/jobs.schema.js";
import { interviewSchema, noteSchema, applicationUpdateSchema } from "../validation/platform.schema.js";

const router = Router();

router.post(
  "/",
  requireAuth,
  validateBody(createApplicationSchema),
  asyncHandler(async (req, res) => {
    const { job_id, active_resume_id } = req.body;
    const userId = req.user.id;

    try {
      const result = await createApplication({
        withTransaction,
        userId,
        jobId: job_id,
        activeResumeId: active_resume_id,
      });

      await invalidateDashboard(userId);
      return created(res, { application: result.rows[0] }, "Job saved to your board");
    } catch (error) {
      if (error.code === PG_ERRORS.UNIQUE_VIOLATION) {
        throw conflict("This job is already on your board");
      }
      if (error.code === PG_ERRORS.FOREIGN_KEY_VIOLATION) {
        throw badRequest("That job or resume does not exist");
      }
      throw error;
    }
  })
);

router.post(
  "/with-job",
  requireAuth,
  validateBody(createApplicationWithJobSchema),
  asyncHandler(async (req, res) => {
    const { title, company_name: companyName, active_resume_id: activeResumeId } = req.body;
    const result = await createApplicationWithJob({
      withTransaction,
      userId: req.user.id,
      title,
      companyName,
      activeResumeId,
    });

    await invalidateDashboard(req.user.id);
    return created(res, result, "Job saved to your board");
  })
);

router.get(
  "/",
  requireAuth,
  validateQuery(listApplicationsQuerySchema),
  asyncHandler(async (req, res) => {
    const { status, search, page, limit } = req.query;
    const userId = req.user.id;
    const offset = (page - 1) * limit;

    const conditions = ["a.user_id = $1"];
    const values = [userId];

    if (status) {
      values.push(status);
      conditions.push(`a.status = $${values.length}`);
    }

    if (search) {
      values.push(`%${search}%`);
      conditions.push(`(j.title ILIKE $${values.length} OR c.name ILIKE $${values.length})`);
    }

    const whereClause = conditions.join(" AND ");

    const [dataResult, countResult] = await Promise.all([
      pool.query(
        `SELECT a.*,
                j.title AS job_title, j.location, j.source_url,
                c.name AS company_name,
                r.label AS resume_label
         FROM applications a
         JOIN jobs j ON j.id = a.job_id
         LEFT JOIN companies c ON c.id = j.company_id
         LEFT JOIN resume_versions r ON r.id = a.active_resume_id
         WHERE ${whereClause}
         ORDER BY a.updated_at DESC
         LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
        [...values, limit, offset]
      ),
      pool.query(
        `SELECT COUNT(*)::int AS count
         FROM applications a
         JOIN jobs j ON j.id = a.job_id
         LEFT JOIN companies c ON c.id = j.company_id
         WHERE ${whereClause}`,
        values
      ),
    ]);

    const total = countResult.rows[0].count;

    return ok(res, {
      applications: dataResult.rows,
      pagination: { page, limit, total, total_pages: Math.ceil(total / limit) || 1 },
    });
  })
);

router.get(
  "/:id",
  requireAuth,
  validateParams(idParamSchema),
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    const applicationResult = await pool.query(
      `SELECT a.*,
              j.title AS job_title, j.description, j.location, j.source_url,
              j.salary_min, j.salary_max,
              c.name AS company_name,
              r.label AS resume_label
       FROM applications a
       JOIN jobs j ON j.id = a.job_id
       LEFT JOIN companies c ON c.id = j.company_id
       LEFT JOIN resume_versions r ON r.id = a.active_resume_id
       WHERE a.id = $1 AND a.user_id = $2`,
      [id, req.user.id]
    );

    const application = applicationResult.rows[0];
    if (!application) throw notFoundError("Application not found");

    const [notes, interviews, history] = await Promise.all([
      pool.query("SELECT * FROM notes WHERE application_id = $1 ORDER BY created_at DESC", [id]),
      pool.query("SELECT * FROM interviews WHERE application_id = $1 ORDER BY scheduled_at ASC", [id]),
      pool.query(
        "SELECT * FROM application_status_history WHERE application_id = $1 ORDER BY changed_at DESC",
        [id]
      ),
    ]);

    return ok(res, {
      application,
      notes: notes.rows,
      interviews: interviews.rows,
      history: history.rows,
    });
  })
);

router.patch(
  "/:id/status",
  requireAuth,
  validateParams(idParamSchema),
  validateBody(updateStatusSchema),
  asyncHandler(async (req, res) => {
    const { status: newStatus } = req.body;
    const { id } = req.params;
    const userId = req.user.id;

    const application = await withTransaction(async (client) => {
      const current = await client.query(
        "SELECT id, status FROM applications WHERE id = $1 AND user_id = $2 FOR UPDATE",
        [id, userId]
      );

      if (!current.rows[0]) throw notFoundError("Application not found");

      const previousStatus = current.rows[0].status;

      if (previousStatus === newStatus) return null;

      const updated = await client.query(
        `UPDATE applications
         SET status = $1::varchar(20),
             updated_at = now(),
             applied_at = CASE
               WHEN $1::varchar(20) = 'applied' AND applied_at IS NULL THEN now()
               ELSE applied_at
             END
         WHERE id = $2
         RETURNING *`,
        [newStatus, id]
      );

      await client.query(
        `INSERT INTO application_status_history (application_id, from_status, to_status)
         VALUES ($1, $2, $3)`,
        [id, previousStatus, newStatus]
      );

      return updated.rows[0];
    });

    if (!application) {
      return ok(res, { application: null }, "Status unchanged");
    }

    await invalidateDashboard(userId);
    return ok(res, { application }, "Status updated");
  })
);

router.patch(
  "/:id/resume",
  requireAuth,
  validateParams(idParamSchema),
  validateBody(applicationUpdateSchema),
  asyncHandler(async (req, res) => {
    const { active_resume_id } = req.body;

    const result = await pool.query(
      `UPDATE applications a
       SET active_resume_id = (
             SELECT r.id FROM resume_versions r
             WHERE r.id = $1 AND r.user_id = $2
           ),
           updated_at = now()
       WHERE a.id = $3 AND a.user_id = $2
       RETURNING *`,
      [active_resume_id ?? null, req.user.id, req.params.id]
    );

    if (!result.rows[0]) throw notFoundError("Application not found");

    return ok(res, { application: result.rows[0] }, "Resume version updated");
  })
);

router.post(
  "/:id/notes",
  requireAuth,
  validateParams(idParamSchema),
  validateBody(noteSchema),
  asyncHandler(async (req, res) => {
    const result = await pool.query(
      `INSERT INTO notes (application_id, content)
       SELECT id, $3 FROM applications WHERE id = $1 AND user_id = $2
       RETURNING *`,
      [req.params.id, req.user.id, req.body.content]
    );

    if (!result.rows[0]) throw notFoundError("Application not found");

    return created(res, { note: result.rows[0] }, "Note saved");
  })
);

router.post(
  "/:id/interviews",
  requireAuth,
  validateParams(idParamSchema),
  validateBody(interviewSchema),
  asyncHandler(async (req, res) => {
    const { round_name, scheduled_at, location } = req.body;
    const { id } = req.params;
    const userId = req.user.id;

    const interview = await withTransaction(async (client) => {
      const owned = await client.query(
        "SELECT id FROM applications WHERE id = $1 AND user_id = $2 FOR UPDATE",
        [id, userId]
      );

      if (!owned.rows[0]) throw notFoundError("Application not found");

      const createdInterview = await client.query(
        `INSERT INTO interviews (application_id, round_name, scheduled_at, location)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [id, round_name, scheduled_at, location ?? null]
      );

      await client.query(
        `INSERT INTO outbox_events (event_type, payload)
         VALUES ('interview.reminder', $1)`,
        [
          JSON.stringify({
            interview_id: createdInterview.rows[0].id,
            user_id: userId,
            scheduled_at,
          }),
        ]
      );

      return createdInterview.rows[0];
    });

    await invalidateDashboard(userId);
    return created(res, { interview }, "Interview scheduled — a reminder is queued");
  })
);

export default router;
