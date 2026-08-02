-- ═══════════════════════════════════════════════════════════════
-- 7SQ — POS manual discount tracking
-- Lets a cashier apply a flat/% discount without a promo code,
-- tracked separately from promo discounts for accurate reporting.
-- Additive only. Safe to re-run.
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE sales ADD COLUMN IF NOT EXISTS manual_discount NUMERIC(12,2) DEFAULT 0;

SELECT column_name FROM information_schema.columns
WHERE table_name='sales' AND column_name='manual_discount';
