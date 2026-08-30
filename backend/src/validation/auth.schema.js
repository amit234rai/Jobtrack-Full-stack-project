import { z } from "zod";

const email = z.string().trim().toLowerCase().email("Enter a valid email address");

const password = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(72, "Password must be 72 characters or fewer");

export const signupSchema = z.object({
  email,
  password,
  full_name: z.string().trim().min(1, "Full name is required").max(255),
});

export const loginSchema = z.object({
  email,
  password: z.string().min(1, "Password is required"),
});

export const forgotPasswordSchema = z.object({ email });

export const resetPasswordSchema = z.object({
  email,
  otp: z.string().regex(/^\d{6}$/, "Enter the 6-digit code from your email"),
  password,
});
