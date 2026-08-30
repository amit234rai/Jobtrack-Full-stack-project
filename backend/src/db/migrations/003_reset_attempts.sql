-- ============================================================
-- Brute-force protection for password reset codes.
--
-- A 6-digit OTP has only 1,000,000 possible values, which is well
-- within reach of an automated attacker inside the 15-minute
-- validity window. Counting failed attempts lets us retire a code
-- after 5 wrong guesses, so the practical search space is 5 --
-- not a million.
-- ============================================================

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS password_reset_attempts SMALLINT NOT NULL DEFAULT 0;

-- Reset flows look users up by email; that column is already UNIQUE
-- (and therefore indexed), so no extra index is needed here.
