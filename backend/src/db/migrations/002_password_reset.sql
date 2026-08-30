-- Applied automatically on a fresh database. Apply this once to an existing
-- local volume (command documented in PROJECT_GUIDE.md).
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_reset_otp_hash TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_reset_expires_at TIMESTAMPTZ;
