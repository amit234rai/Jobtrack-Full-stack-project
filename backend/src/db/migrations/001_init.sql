-- ============================================================
-- JobTrack initial schema
-- Runs automatically when the postgres container first starts
-- (mounted into /docker-entrypoint-initdb.d)
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto"; -- for gen_random_uuid()

-- ---------- USERS & ROLES ----------
CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email           VARCHAR(255) UNIQUE NOT NULL,
    password_hash   TEXT NOT NULL,
    full_name       VARCHAR(255) NOT NULL,
    role            VARCHAR(20) NOT NULL DEFAULT 'applicant'
                        CHECK (role IN ('applicant', 'admin')),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------- COMPANIES ----------
-- Recruiter/company info is normalized out so notes and jobs
-- can reference one company record instead of duplicating text.
CREATE TABLE companies (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            VARCHAR(255) NOT NULL,
    website         VARCHAR(500),
    industry        VARCHAR(100),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------- JOBS ----------
-- A "job" is the posting itself (title, description, source link).
-- Multiple users could in theory save the same job, so job data
-- is separate from a user's application to it.
CREATE TABLE jobs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id      UUID REFERENCES companies(id) ON DELETE SET NULL,
    title           VARCHAR(255) NOT NULL,
    description     TEXT,
    location        VARCHAR(255),
    source_url      VARCHAR(1000),
    salary_min      INTEGER,
    salary_max      INTEGER,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------- RESUME VERSIONS ----------
-- Each user can upload multiple resume versions over time.
-- Applications point to WHICH version was used — critical for
-- knowing "which resume got me this interview."
CREATE TABLE resume_versions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    label           VARCHAR(255) NOT NULL,       -- e.g. "Backend-focused v3"
    file_url        VARCHAR(1000) NOT NULL,      -- path/URL to stored file
    is_active       BOOLEAN NOT NULL DEFAULT false,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------- APPLICATIONS ----------
-- The central entity: one user applying to one job, tracked
-- through the pipeline. active_resume_id is a pointer that
-- gets updated transactionally when a version changes.
CREATE TABLE applications (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    job_id              UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    active_resume_id    UUID REFERENCES resume_versions(id) ON DELETE SET NULL,
    status              VARCHAR(20) NOT NULL DEFAULT 'saved'
                            CHECK (status IN ('saved', 'applied', 'oa', 'interview', 'offer', 'rejected')),
    applied_at          TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id, job_id) -- can't apply to the same job twice
);

-- ---------- APPLICATION STATUS HISTORY ----------
-- Every stage transition is logged here. This is what powers
-- the dashboard funnel stats ("avg days Applied -> Interview")
-- and is why status changes MUST be transactional: the
-- applications.status update and this insert are one unit.
CREATE TABLE application_status_history (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    application_id  UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
    from_status     VARCHAR(20),
    to_status       VARCHAR(20) NOT NULL,
    changed_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------- INTERVIEWS ----------
-- One application can have multiple interview rounds.
CREATE TABLE interviews (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    application_id  UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
    round_name      VARCHAR(255) NOT NULL,        -- e.g. "Phone screen", "Onsite"
    scheduled_at    TIMESTAMPTZ NOT NULL,
    location        VARCHAR(255),                 -- "Zoom link" or address
    reminder_sent   BOOLEAN NOT NULL DEFAULT false,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------- NOTES ----------
-- Free-form notes tied to an application (recruiter contact info,
-- interview impressions, etc.)
CREATE TABLE notes (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    application_id  UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
    content         TEXT NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------- OUTBOX (for background jobs) ----------
-- Written in the SAME transaction as the business event (e.g.
-- interview scheduled). A separate worker process polls this
-- table and enqueues jobs into BullMQ/Redis. This guarantees
-- we never "lose" a reminder because the DB write succeeded
-- but the Redis enqueue call failed independently.
CREATE TABLE outbox_events (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type      VARCHAR(100) NOT NULL,   -- e.g. 'interview.reminder'
    payload         JSONB NOT NULL,
    processed       BOOLEAN NOT NULL DEFAULT false,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------- INDEXES ----------
-- Support the search/filter/pagination feature and common lookups.
CREATE INDEX idx_applications_user_id ON applications(user_id);
CREATE INDEX idx_applications_status ON applications(status);
CREATE INDEX idx_jobs_title ON jobs USING GIN (to_tsvector('english', title));
CREATE INDEX idx_interviews_scheduled_at ON interviews(scheduled_at);
CREATE INDEX idx_outbox_unprocessed ON outbox_events(processed) WHERE processed = false;
