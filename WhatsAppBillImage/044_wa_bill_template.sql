-- ═══════════════════════════════════════════════════════════════
-- 7SQ — WhatsApp bill/receipt image sending
-- Separate from the marketing template already set up — WhatsApp
-- categorises templates (MARKETING vs UTILITY) and a receipt is a
-- UTILITY message, not a promotional one. Reusing the marketing
-- template for this would misuse its approved category with Meta.
-- Additive only. Safe to re-run.
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE marketing_integrations ADD COLUMN IF NOT EXISTS wa_receipt_template_name TEXT;
ALTER TABLE marketing_integrations ADD COLUMN IF NOT EXISTS wa_receipt_template_lang TEXT DEFAULT 'en';

SELECT column_name FROM information_schema.columns
WHERE table_name='marketing_integrations' AND column_name LIKE 'wa_receipt%';
