-- ═══════════════════════════════════════════════════════════════════
-- Elite Store Phase 22 — Partnership, TDS, Reorder
-- Run in Supabase SQL Editor AFTER 018_phase21.sql
-- ═══════════════════════════════════════════════════════════════════

-- ── 1. PARTNERSHIP ACCOUNTS ──────────────────────────────────
CREATE TABLE IF NOT EXISTS partners (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id      UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name           TEXT NOT NULL,
  phone          TEXT,
  email          TEXT,
  capital        NUMERIC(14,2) DEFAULT 0,
  profit_share   NUMERIC(5,2) DEFAULT 0,   -- percentage
  drawings_limit NUMERIC(12,2) DEFAULT 0,
  join_date      DATE DEFAULT CURRENT_DATE,
  active         BOOLEAN DEFAULT TRUE,
  notes          TEXT,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_partners_tenant ON partners(tenant_id);
ALTER TABLE partners ENABLE ROW LEVEL SECURITY;
CREATE POLICY "partners_all" ON partners FOR ALL
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

CREATE TABLE IF NOT EXISTS partner_txns (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id    UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  partner_id   UUID NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  type         TEXT NOT NULL CHECK (type IN ('capital_add','capital_withdraw','drawing','profit_share','interest')),
  amount       NUMERIC(12,2) NOT NULL,
  description  TEXT,
  txn_date     DATE DEFAULT CURRENT_DATE,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ptxn_partner ON partner_txns(partner_id, txn_date DESC);
ALTER TABLE partner_txns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ptxn_all" ON partner_txns FOR ALL
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- ── 2. TDS MANAGEMENT ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tds_entries (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  party_name    TEXT NOT NULL,
  party_pan     TEXT,
  section       TEXT NOT NULL,   -- 194C, 194J, 194I etc.
  txn_type      TEXT NOT NULL,   -- Contractor, Professional, Rent etc.
  gross_amount  NUMERIC(12,2) NOT NULL,
  tds_rate      NUMERIC(5,2) NOT NULL,
  tds_amount    NUMERIC(10,2) NOT NULL,
  net_amount    NUMERIC(12,2) NOT NULL,
  txn_date      DATE DEFAULT CURRENT_DATE,
  quarter       TEXT,            -- Q1, Q2, Q3, Q4
  challan_no    TEXT,
  status        TEXT DEFAULT 'deducted' CHECK (status IN ('deducted','deposited','filed')),
  deposit_date  DATE,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_tds_tenant ON tds_entries(tenant_id, txn_date DESC);
ALTER TABLE tds_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tds_all" ON tds_entries FOR ALL
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- ── 3. REORDER RULES ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS reorder_rules (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id      UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  inventory_id   UUID NOT NULL REFERENCES inventory(id) ON DELETE CASCADE,
  reorder_point  INTEGER NOT NULL DEFAULT 10,
  reorder_qty    INTEGER NOT NULL DEFAULT 50,
  preferred_supplier UUID REFERENCES suppliers(id),
  auto_po        BOOLEAN DEFAULT FALSE,
  active         BOOLEAN DEFAULT TRUE,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_reorder_inv ON reorder_rules(tenant_id, inventory_id);
ALTER TABLE reorder_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reorder_all" ON reorder_rules FOR ALL
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());
