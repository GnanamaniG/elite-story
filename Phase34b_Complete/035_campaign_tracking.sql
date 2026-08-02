-- ═══════════════════════════════════════════════════════════════
-- 7SQ — Campaign spend & attribution
-- Lets ROI be computed from real numbers instead of guessed.
-- Additive only. Safe to re-run.
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS spend          NUMERIC(12,2) DEFAULT 0;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS sent_count     INTEGER DEFAULT 0;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS promo_code     TEXT;   -- links redemptions back to this campaign
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS started_at     DATE;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS ended_at       DATE;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS notes          TEXT;

CREATE INDEX IF NOT EXISTS idx_camp_promo ON campaigns(tenant_id, promo_code);
CREATE INDEX IF NOT EXISTS idx_camp_status ON campaigns(tenant_id, status);

SELECT column_name FROM information_schema.columns
WHERE table_name='campaigns' AND column_name IN ('spend','sent_count','promo_code','started_at')
ORDER BY column_name;
