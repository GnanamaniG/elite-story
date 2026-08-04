-- ═══════════════════════════════════════════════════════════════
-- 7SQ — Multi-select business types at signup
-- Adds an array column alongside the existing single business_type
-- text field (kept for backward compatibility — nothing else reads
-- it for logic, but leaving it populated avoids surprises).
-- Additive only. Safe to re-run.
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE tenants ADD COLUMN IF NOT EXISTS business_types JSONB DEFAULT '[]';

SELECT column_name FROM information_schema.columns
WHERE table_name='tenants' AND column_name IN ('business_type','business_types');
