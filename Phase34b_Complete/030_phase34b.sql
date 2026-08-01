-- ═══════════════════════════════════════════════════════════════
-- 7SQ — POS Session gate support
-- Adds columns to existing tables. Additive only, safe to re-run.
-- ═══════════════════════════════════════════════════════════════

-- Denomination breakdown captured when a session is opened
ALTER TABLE cash_sessions ADD COLUMN IF NOT EXISTS denominations JSONB;
ALTER TABLE cash_sessions ADD COLUMN IF NOT EXISTS branch_id     UUID;
ALTER TABLE cash_sessions ADD COLUMN IF NOT EXISTS terminal      TEXT DEFAULT 'Terminal 1';

-- Link every sale to the session it was rung up in,
-- so drawer reconciliation is exact rather than date-based
ALTER TABLE sales ADD COLUMN IF NOT EXISTS session_id UUID;

CREATE INDEX IF NOT EXISTS idx_sales_session  ON sales(tenant_id, session_id);
CREATE INDEX IF NOT EXISTS idx_session_open   ON cash_sessions(tenant_id, status, opened_at DESC);

-- Verify
SELECT 'cash_sessions.denominations' AS col,
       EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_name='cash_sessions' AND column_name='denominations') AS present
UNION ALL
SELECT 'sales.session_id',
       EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_name='sales' AND column_name='session_id');
