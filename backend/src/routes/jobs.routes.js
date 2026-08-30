import { Router } from "express";
import { pool } from "../db/pool.js";
import { withTransaction } from "../db/transaction.js";
import { requireAuth } from "../middleware/auth.middleware.js";
import { validateBody } from "../middleware/validate.middleware.js";
import { asyncHandler } from "../utils/async-handler.js";
import { ok, created } from "../utils/api-response.js";
import { createJobSchema, importJobsSchema } from "../validation/jobs.schema.js";

const router = Router();

async function upsertCompany(client, name) {
  if (!name) return null;

  const result = await client.query(
    `INSERT INTO companies (name) VALUES ($1)
     ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
     RETURNING id`,
    [name]
  );

  return result.rows[0].id;
}

router.post(
  "/",
  requireAuth,
  validateBody(createJobSchema),
  asyncHandler(async (req, res) => {
    const { title, description, location, source_url, salary_min, salary_max, company_name } = req.body;

    const job = await withTransaction(async (client) => {
      const companyId = await upsertCompany(client, company_name);

      const result = await client.query(
        `INSERT INTO jobs (company_id, title, description, location, source_url, salary_min, salary_max)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [
          companyId,
          title,
          description ?? null,
          location ?? null,
          source_url ?? null,
          salary_min ?? null,
          salary_max ?? null,
        ]
      );

      return { ...result.rows[0], company_name: company_name ?? null };
    });

    return created(res, { job }, "Job created");
  })
);

router.post(
  "/import",
  requireAuth,
  validateBody(importJobsSchema),
  asyncHandler(async (req, res) => {
    const jobs = await withTransaction(async (client) => {
      const imported = [];

      for (const row of req.body.jobs) {
        const companyId = await upsertCompany(client, row.company_name);

        const result = await client.query(
          `INSERT INTO jobs (company_id, title, description, location, source_url)
           VALUES ($1, $2, $3, $4, $5)
           RETURNING *`,
          [companyId, row.title, row.description ?? null, row.location ?? null, row.source_url ?? null]
        );

        imported.push({ ...result.rows[0], company_name: row.company_name ?? null });
      }

      return imported;
    });

    return created(res, { jobs, imported: jobs.length }, `Imported ${jobs.length} job(s)`);
  })
);

router.get(
  "/",
  requireAuth,
  asyncHandler(async (req, res) => {
    const result = await pool.query(
      `SELECT j.*, c.name AS company_name
       FROM jobs j
       LEFT JOIN companies c ON c.id = j.company_id
       ORDER BY j.created_at DESC
       LIMIT 100`
    );

    return ok(res, { jobs: result.rows });
  })
);

export default router;
