-- ═══════════════════════════════════════════════════════════════
-- Why isn't the POS Session screen appearing?
-- Run this in Supabase SQL Editor and read the RESULT column.
-- ═══════════════════════════════════════════════════════════════

SELECT
  CASE
    WHEN NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='cash_sessions')
      THEN '❌ cash_sessions table missing — run 031_fix_session_fk.sql'
    WHEN NOT EXISTS (SELECT 1 FROM information_schema.columns
                     WHERE table_name='cash_sessions' AND column_name='denominations')
      THEN '❌ denominations column missing — run 031_fix_session_fk.sql'
    WHEN EXISTS (SELECT 1 FROM cash_sessions WHERE status='open')
      THEN '⚠️ A SESSION IS ALREADY OPEN — that is why the screen is skipped. Close it below.'
    ELSE '✅ No open session. Screen SHOULD appear. If it does not, the code is not deployed.'
  END AS result;

-- Show any open sessions
SELECT id, opened_at, opening_float, opened_by_email, status
FROM cash_sessions
WHERE status = 'open'
ORDER BY opened_at DESC;

-- ─────────────────────────────────────────────────────────────
-- IF a session is open and you want the screen back, uncomment
-- the line below and run it again:
-- ─────────────────────────────────────────────────────────────
-- UPDATE cash_sessions SET status='closed', closed_at=NOW() WHERE status='open';
