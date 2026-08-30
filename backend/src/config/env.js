import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  JWT_SECRET: z
    .string()
    .min(32, "JWT_SECRET must be at least 32 characters"),
  JWT_EXPIRES_IN: z.string().default("7d"),
  REDIS_URL: z.string().default("redis://localhost:6379"),
  PORT: z.coerce.number().int().positive().default(4000),
  CLIENT_ORIGIN: z.string().url().default("http://localhost:5173"),
  REMINDER_LEAD_MINUTES: z.coerce.number().int().nonnegative().default(30),
  MAIL_HOST: z.string().optional(),
  MAIL_PORT: z.coerce.number().int().positive().default(587),
  MAIL_SECURE: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
  MAIL_USER: z.string().optional(),
  MAIL_PASSWORD: z.string().optional(),
  MAIL_FROM: z.string().default("JobTrack <no-reply@jobtrack.local>"),
});

const source =
  process.env.NODE_ENV === "test"
    ? {
        ...process.env,
        DATABASE_URL: process.env.DATABASE_URL ?? "postgresql://test/test",
        JWT_SECRET: process.env.JWT_SECRET ?? "test-secret-that-is-long-enough-to-pass-validation",
      }
    : process.env;

const parsed = envSchema.safeParse(source);

if (!parsed.success) {
  const problems = Object.entries(parsed.error.flatten().fieldErrors)
    .map(([key, messages]) => `  - ${key}: ${messages.join("; ")}`)
    .join("\n");

  console.error(
    `\nInvalid environment configuration:\n${problems}\n\n` +
      "Copy backend/.env.example to backend/.env and fill in the values.\n"
  );
  process.exit(1);
}

export const env = parsed.data;
export const isEmailConfigured = Boolean(env.MAIL_HOST && env.MAIL_USER && env.MAIL_PASSWORD);
