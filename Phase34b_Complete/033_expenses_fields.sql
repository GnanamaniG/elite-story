-- ═══════════════════════════════════════════════════════════════
-- 7SQ — Expense vendor + payment mode + recurring
-- The expenses table only had date/category/amount/note.
-- Adds the columns the redesigned Expenses page uses.
-- Additive only. Safe to re-run.
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE expenses ADD COLUMN IF NOT EXISTS vendor        TEXT;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS payment_mode  TEXT DEFAULT 'cash';
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS status        TEXT DEFAULT 'paid'
                                              CHECK (status IN ('paid','pending','cancelled'));
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS ref_no        TEXT;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS is_recurring  BOOLEAN DEFAULT FALSE;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS recur_every   TEXT
                                              CHECK (recur_every IN ('weekly','monthly','quarterly','yearly'));
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS next_due      DATE;

CREATE INDEX IF NOT EXISTS idx_exp_vendor  ON expenses(tenant_id, vendor);
CREATE INDEX IF NOT EXISTS idx_exp_recur   ON expenses(tenant_id, is_recurring, next_due);
CREATE INDEX IF NOT EXISTS idx_exp_date    ON expenses(tenant_id, date DESC);

SELECT column_name FROM information_schema.columns
WHERE table_name='expenses' AND column_name IN ('vendor','payment_mode','status','is_recurring','recur_every','next_due')
ORDER BY column_name;
