-- ============================================================
-- Make company names unique so they can be upserted safely.
--
-- The job-create and CSV-import paths both need "find this company
-- or create it". Doing that as SELECT-then-INSERT is a race: two
-- concurrent imports of the same company both miss the SELECT, both
-- INSERT, and one fails. `INSERT ... ON CONFLICT (name)` fixes it,
-- but requires a unique index on the conflict target.
--
-- Names are collapsed case-insensitively first, otherwise "Acme",
-- "acme" and "ACME" would survive as three separate companies and
-- split one employer's jobs across all of them.
-- ============================================================

-- Fold any existing duplicates into the oldest row, repointing jobs first.
WITH canonical AS (
    SELECT DISTINCT ON (lower(name))
           id, lower(name) AS key
    FROM companies
    ORDER BY lower(name), created_at
)
UPDATE jobs j
SET company_id = canonical.id
FROM companies c
JOIN canonical ON canonical.key = lower(c.name)
WHERE j.company_id = c.id
  AND j.company_id <> canonical.id;

DELETE FROM companies c
WHERE EXISTS (
    SELECT 1 FROM companies keep
    WHERE lower(keep.name) = lower(c.name)
      AND (keep.created_at < c.created_at
           OR (keep.created_at = c.created_at AND keep.id < c.id))
);

-- Normalize what remains, then enforce uniqueness going forward.
UPDATE companies SET name = btrim(name) WHERE name <> btrim(name);

CREATE UNIQUE INDEX IF NOT EXISTS companies_name_unique ON companies (name);
