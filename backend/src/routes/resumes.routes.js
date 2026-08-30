import { Router } from "express";
import { pool } from "../db/pool.js";
import { withTransaction } from "../db/transaction.js";
import { requireAuth } from "../middleware/auth.middleware.js";
import { validateBody, validateParams } from "../middleware/validate.middleware.js";
import { asyncHandler } from "../utils/async-handler.js";
import { ok, created } from "../utils/api-response.js";
import { resumeSchema } from "../validation/platform.schema.js";
import { idParamSchema } from "../validation/jobs.schema.js";
import { activateResume } from "../services/resume.service.js";

const router = Router();

router.get(
  "/",
  requireAuth,
  asyncHandler(async (req, res) => {
    const result = await pool.query(
      "SELECT * FROM resume_versions WHERE user_id=$1 ORDER BY created_at DESC",
      [req.user.id]
    );
    return ok(res, { resumes: result.rows });
  })
);

router.post(
  "/",
  requireAuth,
  validateBody(resumeSchema),
  asyncHandler(async (req, res) => {
    const { label, file_url } = req.body;

    const result = await pool.query(
      "INSERT INTO resume_versions (user_id, label, file_url, is_active) VALUES ($1, $2, $3, false) RETURNING *",
      [req.user.id, label, file_url]
    );

    return created(res, { resume: result.rows[0] }, "Resume uploaded");
  })
);

router.patch(
  "/:id/activate",
  requireAuth,
  validateParams(idParamSchema),
  asyncHandler(async (req, res) => {
    const resume = await activateResume({
      withTransaction,
      userId: req.user.id,
      resumeId: req.params.id,
    });

    return ok(res, { resume }, "Resume activated");
  })
);

export default router;
