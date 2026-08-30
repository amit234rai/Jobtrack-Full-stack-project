import "dotenv/config";
import { fileURLToPath } from "node:url";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { pool } from "./db/pool.js";
import { env } from "./config/env.js";
import authRoutes from "./routes/auth.routes.js";
import adminRoutes from "./routes/admin.routes.js";
import jobsRoutes from "./routes/jobs.routes.js";
import applicationsRoutes from "./routes/applications.routes.js";
import dashboardRoutes from "./routes/dashboard.routes.js";
import resumesRoutes from "./routes/resumes.routes.js";
import { notFound, errorHandler } from "./middleware/error.middleware.js";
import { asyncHandler } from "./utils/async-handler.js";
import { ok } from "./utils/api-response.js";

const app = express();

app.use(helmet());
app.use(cors({ origin: env.CLIENT_ORIGIN }));
app.use(express.json());

app.use("/auth", rateLimit({ 
  windowMs: 15 * 60000, 
  max: 30,
  standardHeaders: true,
  legacyHeaders: false
}));

app.use("/auth", authRoutes);
app.use("/admin", adminRoutes);
app.use("/jobs", jobsRoutes);
app.use("/applications", applicationsRoutes);
app.use("/dashboard", dashboardRoutes);
app.use("/resumes", resumesRoutes);

app.get("/", (_req, res) => {
  return ok(
    res,
    {
      service: "JobTrack API",
      health: "/health",
      app: env.CLIENT_ORIGIN,
    },
    "JobTrack API is running. Open the web app, not this API root."
  );
});

app.get("/health", asyncHandler(async (_req, res) => {
  const result = await pool.query("SELECT NOW()");
  return ok(res, {
    status: "ok",
    db_time: result.rows[0].now,
  }, "Database reachable");
}));

app.use(notFound);
app.use(errorHandler);

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  app.listen(env.PORT, () => {
    console.log(`JobTrack API listening on port ${env.PORT}`);
  });
}

export default app;
