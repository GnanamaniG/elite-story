-- ═══════════════════════════════════════════════════════════════
-- 7SQ — Bank / cash account balances
-- Powers the "Total Available Funds" panel: cash in hand,
-- UPI/wallet float, and each bank account, reconciled manually.
-- Additive only. Safe to re-run.
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS bank_accounts (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,              -- 'HDFC Current', 'Counter Cash'
  kind          TEXT NOT NULL DEFAULT 'bank'
                CHECK (kind IN ('cash','upi','bank')),
  bank_name     TEXT,
  account_no    TEXT,                       -- store last 4 only
  ifsc          TEXT,
  upi_id        TEXT,
  balance       NUMERIC(14,2) DEFAULT 0,
  opening_balance NUMERIC(14,2) DEFAULT 0,
  is_overdraft  BOOLEAN DEFAULT FALSE,      -- OD accounts show as a liability
  od_limit      NUMERIC(14,2) DEFAULT 0,
  active        BOOLEAN DEFAULT TRUE,
  last_reconciled TIMESTAMPTZ,
  notes         TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bank_tenant ON bank_accounts(tenant_id, active, kind);

ALTER TABLE bank_accounts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "bank_all" ON bank_accounts;
CREATE POLICY "bank_all" ON bank_accounts FOR ALL
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- Give every existing tenant a Cash-in-Hand row so the panel isn't empty
INSERT INTO bank_accounts (tenant_id, name, kind, balance)
SELECT id, 'Cash in Hand', 'cash', 0 FROM tenants
WHERE NOT EXISTS (
  SELECT 1 FROM bank_accounts b WHERE b.tenant_id = tenants.id AND b.kind = 'cash'
);

SELECT 'bank_accounts' AS tbl,
       (SELECT COUNT(*) FROM information_schema.columns WHERE table_name='bank_accounts') AS columns,
       (SELECT COUNT(*) FROM bank_accounts) AS seeded_rows;
