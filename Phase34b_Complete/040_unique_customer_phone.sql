-- ═══════════════════════════════════════════════════════════════
-- 7SQ — Prevent the same phone number being registered twice
--
-- A plain UNIQUE constraint on the raw phone column wouldn't
-- actually catch duplicates, because the same number gets typed
-- differently every time — "9843012345", "+91 98430 12345",
-- "098430 12345" are all the same customer but different text.
--
-- This uses a Postgres EXPRESSION index instead: it strips every
-- non-digit character before comparing, so any two phone numbers
-- that resolve to the same digits are caught as duplicates,
-- regardless of formatting. No existing data is rewritten.
-- ═══════════════════════════════════════════════════════════════

-- First, see if any duplicates already exist (informational —
-- run this and review before the index below, since the index
-- creation will fail if real duplicates are already present)
SELECT tenant_id, regexp_replace(phone, '\D', '', 'g') AS digits, COUNT(*), array_agg(name) AS names
FROM customers
WHERE phone IS NOT NULL AND phone <> ''
GROUP BY tenant_id, regexp_replace(phone, '\D', '', 'g')
HAVING COUNT(*) > 1;

-- If the query above returned rows, merge or remove the duplicates
-- manually before continuing — the index below cannot be created
-- while duplicates exist. If it returned nothing, proceed directly.

CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_phone_unique
  ON customers (tenant_id, (regexp_replace(phone, '\D', '', 'g')))
  WHERE phone IS NOT NULL AND phone <> '';

-- Verify
SELECT indexname FROM pg_indexes WHERE tablename = 'customers' AND indexname = 'idx_customers_phone_unique';
