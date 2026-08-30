import { signupSchema, loginSchema, forgotPasswordSchema, resetPasswordSchema } from "./auth.schema.js";

describe("authentication input validation", () => {
  it("accepts a valid signup payload", () => {
    expect(
      signupSchema.safeParse({
        email: "person@example.com",
        password: "safe-password",
        full_name: "Person",
      }).success
    ).toBe(true);
  });

  it("rejects an invalid email and short password", () => {
    expect(
      signupSchema.safeParse({
        email: "not-an-email",
        password: "short",
        full_name: "Person",
      }).success
    ).toBe(false);
  });

  it("does not allow a blank login password", () => {
    expect(loginSchema.safeParse({ email: "person@example.com", password: "" }).success).toBe(false);
  });

  it("requires a valid email and six-digit reset code", () => {
    expect(forgotPasswordSchema.safeParse({ email: "person@example.com" }).success).toBe(true);
    expect(
      resetPasswordSchema.safeParse({
        email: "person@example.com",
        otp: "123456",
        password: "safe-password",
      }).success
    ).toBe(true);
    expect(
      resetPasswordSchema.safeParse({
        email: "person@example.com",
        otp: "nope",
        password: "safe-password",
      }).success
    ).toBe(false);
  });
});
