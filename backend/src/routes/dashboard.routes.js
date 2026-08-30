import { Router } from "express";
import { pool } from "../db/pool.js";
import { cached } from "../db/redis.js";
import { requireAuth } from "../middleware/auth.middleware.js";
import { asyncHandler } from "../utils/async-handler.js";
import { ok } from "../utils/api-response.js";

const router = Router();

router.get(
  "/",
  requireAuth,
  asyncHandler(async (req, res) => {
    const userId = req.user.id;

    const dashboard = await cached(`dashboard:${userId}`, 60, async () => {
      const [funnel, recent, interviews] = await Promise.all([
        pool.query(
          `SELECT status, COUNT(*)::int AS count 
           FROM applications 
           WHERE user_id = $1 
           GROUP BY status`,
          [userId]
        ),
        pool.query(
          `SELECT a.id, a.status, a.updated_at, j.title, c.name AS company_name
           FROM applications a
           JOIN jobs j ON j.id=a.job_id
           LEFT JOIN companies c ON c.id=j.company_id
           WHERE a.user_id=$1
           ORDER BY a.updated_at DESC
           LIMIT 5`,
          [userId]
        ),
        pool.query(
          `SELECT i.id, i.round_name, i.scheduled_at, j.title, c.name AS company_name
           FROM interviews i
           JOIN applications a ON a.id=i.application_id
           JOIN jobs j ON j.id=a.job_id
           LEFT JOIN companies c ON c.id=j.company_id
           WHERE a.user_id=$1 AND i.scheduled_at > now()
           ORDER BY i.scheduled_at ASC
           LIMIT 5`,
          [userId]
        ),
      ]);

      const counts = Object.fromEntries(funnel.rows.map((row) => [row.status, row.count]));

      return {
        counts,
        total: Object.values(counts).reduce((n, count) => n + Number(count), 0),
        recent: recent.rows,
        upcoming_interviews: interviews.rows,
      };
    });

    return ok(res, { dashboard });
  })
);

export default router;
