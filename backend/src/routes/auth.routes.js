import { Router } from "express";
import bcrypt from "bcrypt";
import crypto from "node:crypto";
import { pool } from "../db/pool.js";
import { requireAuth, signToken } from "../middleware/auth.middleware.js";
import { validateBody } from "../middleware/validate.middleware.js";
import { asyncHandler } from "../utils/async-handler.js";
import { ok, created } from "../utils/api-response.js";
import { badRequest, conflict, unauthorized } from "../utils/api-error.js";
import {
  signupSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from "../validation/auth.schema.js";
import {
  sendWelcomeEmail,
  sendPasswordResetOtp,
  sendPasswordChangedEmail,
} from "../utils/mail.js";

const router = Router();

const SALT_ROUNDS = 12;
const OTP_TTL_MINUTES = 15;
const DUMMY_HASH = "$2b$12$C6UzMDM.H6dfI/f/IKcEe.ORqvHtLzWiZLBTfR9OZ9wOJZ8vXO9nO";

const publicUser = ({ id, email, full_name, role, created_at }) => ({
  id,
  email,
  full_name,
  role,
  created_at,
});

router.post(
  "/signup",
  validateBody(signupSchema),
  asyncHandler(async (req, res) => {
    const { email, password, full_name } = req.body;
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    let result;
    try {
      result = await pool.query(
        `INSERT INTO users (email, password_hash, full_name)
         VALUES ($1, $2, $3)
         RETURNING id, email, full_name, role, created_at`,
        [email, passwordHash, full_name]
      );
    } catch (error) {
      if (error.code === "23505") throw conflict("That email is already registered");
      throw error;
    }

    const user = publicUser(result.rows[0]);

    sendWelcomeEmail(user.email, user.full_name).catch((error) =>
      console.error("Welcome email failed:", error.message)
    );

    return created(res, { user, token: signToken(user) }, "Account created");
  })
);

router.post(
  "/login",
  validateBody(loginSchema),
  asyncHandler(async (req, res) => {
    const { email, password } = req.body;

    const result = await pool.query(
      "SELECT id, email, password_hash, full_name, role, created_at FROM users WHERE email = $1",
      [email]
    );

    const user = result.rows[0];
    const hashToCheck = user?.password_hash ?? DUMMY_HASH;
    const passwordMatches = await bcrypt.compare(password, hashToCheck);

    if (!user || !passwordMatches) throw unauthorized("Invalid email or password");

    return ok(res, { user: publicUser(user), token: signToken(user) }, "Signed in");
  })
);

router.post(
  "/forgot-password",
  validateBody(forgotPasswordSchema),
  asyncHandler(async (req, res) => {
    const { email } = req.body;

    const result = await pool.query(
      "SELECT id, email, full_name FROM users WHERE email = $1",
      [email]
    );
    const user = result.rows[0];

    if (user) {
      const otp = crypto.randomInt(100_000, 1_000_000).toString();
      const otpHash = crypto.createHash("sha256").update(otp).digest("hex");

      await pool.query(
        `UPDATE users
         SET password_reset_otp_hash = $1,
             password_reset_expires_at = now() + ($2 || ' minutes')::interval,
             password_reset_attempts = 0
         WHERE id = $3`,
        [otpHash, String(OTP_TTL_MINUTES), user.id]
      );

      sendPasswordResetOtp(user.email, user.full_name, otp).catch((error) =>
        console.error("Password reset email failed:", error.message)
      );
    }

    return ok(
      res,
      null,
      "If an account exists for this email, a 6-digit reset code is on its way."
    );
  })
);

router.post(
  "/reset-password",
  validateBody(resetPasswordSchema),
  asyncHandler(async (req, res) => {
    const { email, otp, password } = req.body;

    const otpHash = crypto.createHash("sha256").update(otp).digest("hex");
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    const result = await pool.query(
      `UPDATE users
       SET password_hash = $1,
           password_reset_otp_hash = NULL,
           password_reset_expires_at = NULL,
           password_reset_attempts = 0,
           updated_at = now()
       WHERE email = $2
         AND password_reset_otp_hash = $3
         AND password_reset_expires_at > now()
         AND password_reset_attempts < 5
       RETURNING id, email, full_name`,
      [passwordHash, email, otpHash]
    );

    if (!result.rows[0]) {
      await pool.query(
        `UPDATE users
         SET password_reset_attempts = password_reset_attempts + 1
         WHERE email = $1 AND password_reset_otp_hash IS NOT NULL`,
        [email]
      );
      throw badRequest("That code is invalid or has expired");
    }

    const user = result.rows[0];

    sendPasswordChangedEmail(user.email, user.full_name).catch((error) =>
      console.error("Password change alert failed:", error.message)
    );

    return ok(res, null, "Password reset successfully. You can now sign in.");
  })
);

router.get(
  "/me",
  requireAuth,
  asyncHandler(async (req, res) => {
    const result = await pool.query(
      "SELECT id, email, full_name, role, created_at FROM users WHERE id = $1",
      [req.user.id]
    );

    if (!result.rows[0]) throw unauthorized("Account no longer exists");

    return ok(res, { user: publicUser(result.rows[0]) });
  })
);

export default router;
