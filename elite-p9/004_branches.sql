-- ═══════════════════════════════════════════════════════════════════
-- Elite Store Phase 6 — Multi-Branch Support
-- Run in Supabase SQL Editor AFTER existing migrations
-- ═══════════════════════════════════════════════════════════════════

-- ── 1. BRANCHES TABLE ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS branches (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  address     TEXT,
  phone       TEXT,
  gstin       TEXT,
  manager     TEXT,
  active      BOOLEAN DEFAULT TRUE,
  is_main     BOOLEAN DEFAULT FALSE,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_branches_tenant ON branches(tenant_id);

-- Auto-update trigger
CREATE TRIGGER trg_branches_ts BEFORE UPDATE ON branches
  FOR EACH ROW EXECUTE FUNCTION _set_updated_at();

-- RLS for branches
ALTER TABLE branches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "branches_all" ON branches FOR ALL
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- ── 2. ADD branch_id TO EXISTING TABLES ───────────────────────
ALTER TABLE sales      ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES branches(id);
ALTER TABLE inventory  ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES branches(id);
ALTER TABLE purchases  ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES branches(id);
ALTER TABLE expenses   ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES branches(id);
ALTER TABLE users      ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES branches(id);

-- ── 3. CREATE MAIN BRANCH FOR EXISTING TENANTS ────────────────
-- This creates a "Main Branch" for every existing tenant automatically
INSERT INTO branches (tenant_id, name, is_main, active)
SELECT id, name || ' - Main', TRUE, TRUE
FROM tenants
WHERE id NOT IN (SELECT DISTINCT tenant_id FROM branches)
ON CONFLICT DO NOTHING;

-- ── 4. ASSIGN EXISTING RECORDS TO MAIN BRANCH ─────────────────
-- Link all existing sales/inventory/etc to the main branch
UPDATE sales SET branch_id = (
  SELECT id FROM branches WHERE tenant_id = sales.tenant_id AND is_main = TRUE LIMIT 1
) WHERE branch_id IS NULL;

UPDATE inventory SET branch_id = (
  SELECT id FROM branches WHERE tenant_id = inventory.tenant_id AND is_main = TRUE LIMIT 1
) WHERE branch_id IS NULL;

UPDATE purchases SET branch_id = (
  SELECT id FROM branches WHERE tenant_id = purchases.tenant_id AND is_main = TRUE LIMIT 1
) WHERE branch_id IS NULL;

UPDATE expenses SET branch_id = (
  SELECT id FROM branches WHERE tenant_id = expenses.tenant_id AND is_main = TRUE LIMIT 1
) WHERE branch_id IS NULL;

-- ── 5. STOCK TRANSFER LOG ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS stock_transfers (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  from_branch   UUID NOT NULL REFERENCES branches(id),
  to_branch     UUID NOT NULL REFERENCES branches(id),
  item_id       UUID NOT NULL REFERENCES inventory(id),
  item_name     TEXT,
  qty           NUMERIC(10,2) NOT NULL,
  note          TEXT,
  status        TEXT DEFAULT 'completed' CHECK (status IN ('pending','completed','cancelled')),
  created_by    UUID,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_transfers_tenant ON stock_transfers(tenant_id);

ALTER TABLE stock_transfers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "transfers_all" ON stock_transfers FOR ALL
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());
