import { Router } from "express";
import { requireAuth } from "../middleware/auth.middleware.js";
import { requireRole } from "../middleware/rbac.middleware.js";
import { asyncHandler } from "../utils/async-handler.js";
import { ok } from "../utils/api-response.js";

const router = Router();

router.get(
  "/admin-only",
  requireAuth,
  requireRole("admin"),
  asyncHandler(async (req, res) => {
    return ok(res, { email: req.user.email }, "Admin access granted");
  })
);

export default router;
