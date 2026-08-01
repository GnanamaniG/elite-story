-- ═══════════════════════════════════════════════════════════════
-- 7SQ — Fix cash_sessions.opened_by foreign key
--
-- The column pointed at a users table that Supabase auth IDs
-- don't live in, so opening a session always failed.
-- We drop the constraint and record who opened it by email,
-- which is stable and human-readable in reports.
-- Additive + safe to re-run.
-- ═══════════════════════════════════════════════════════════════

-- 1. See what it currently points at (informational)
SELECT conname AS constraint_name,
       pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conrelid = 'cash_sessions'::regclass AND contype = 'f';

-- 2. Drop every foreign key on cash_sessions.opened_by / closed_by
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'cash_sessions'::regclass
      AND contype = 'f'
      AND pg_get_constraintdef(oid) ILIKE '%opened_by%'
         OR (conrelid = 'cash_sessions'::regclass AND contype='f'
             AND pg_get_constraintdef(oid) ILIKE '%closed_by%')
  LOOP
    EXECUTE format('ALTER TABLE cash_sessions DROP CONSTRAINT %I', r.conname);
  END LOOP;
END $$;

-- 3. Human-readable operator columns
ALTER TABLE cash_sessions ADD COLUMN IF NOT EXISTS opened_by_email TEXT;
ALTER TABLE cash_sessions ADD COLUMN IF NOT EXISTS closed_by_email TEXT;
ALTER TABLE cash_sessions ADD COLUMN IF NOT EXISTS denominations   JSONB;
ALTER TABLE cash_sessions ADD COLUMN IF NOT EXISTS branch_id       UUID;
ALTER TABLE cash_sessions ADD COLUMN IF NOT EXISTS terminal        TEXT DEFAULT 'Terminal 1';

-- 4. opened_by must accept a raw auth UUID with no FK behind it
ALTER TABLE cash_sessions ALTER COLUMN opened_by DROP NOT NULL;

-- 5. Link sales to their session
ALTER TABLE sales ADD COLUMN IF NOT EXISTS session_id UUID;
CREATE INDEX IF NOT EXISTS idx_sales_session ON sales(tenant_id, session_id);
CREATE INDEX IF NOT EXISTS idx_session_open  ON cash_sessions(tenant_id, status, opened_at DESC);

-- 6. Confirm no foreign keys remain on cash_sessions
SELECT COALESCE(
         (SELECT string_agg(conname, ', ')
          FROM pg_constraint
          WHERE conrelid = 'cash_sessions'::regclass AND contype = 'f'),
         'none — ready'
       ) AS remaining_foreign_keys;
