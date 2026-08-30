-- Resume activation must leave at most one active version per user.
-- Keep the newest currently-active row if older data contains duplicates.
WITH ranked_active_resumes AS (
    SELECT id,
           row_number() OVER (
               PARTITION BY user_id
               ORDER BY created_at DESC, id DESC
           ) AS rank
    FROM resume_versions
    WHERE is_active = true
)
UPDATE resume_versions AS resume
SET is_active = false
FROM ranked_active_resumes AS ranked
WHERE resume.id = ranked.id
  AND ranked.rank > 1;

CREATE UNIQUE INDEX IF NOT EXISTS resume_versions_one_active_per_user
    ON resume_versions (user_id)
    WHERE is_active = true;

-- A worker claims an outbox event before enqueueing it. A stale claim can be
-- retried after a worker crash; dispatch_attempts makes that recovery visible.
ALTER TABLE outbox_events
    ADD COLUMN IF NOT EXISTS processing_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS dispatch_attempts INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_outbox_claimable
    ON outbox_events (created_at)
    WHERE processed = false;
