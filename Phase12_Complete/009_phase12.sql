-- ═══════════════════════════════════════════════════════════════════
-- Elite Store Phase 12 — Cash Register, Repairs, Roles
-- Run in Supabase SQL Editor AFTER 008_phase11.sql
-- ═══════════════════════════════════════════════════════════════════

-- ── 1. CASH REGISTER SESSIONS ────────────────────────────────
CREATE TABLE IF NOT EXISTS cash_sessions (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  branch_id     UUID REFERENCES branches(id),
  opened_by     UUID REFERENCES users(id),
  opened_at     TIMESTAMPTZ DEFAULT NOW(),
  closed_at     TIMESTAMPTZ,
  opening_float NUMERIC(12,2) DEFAULT 0,
  closing_cash  NUMERIC(12,2),
  expected_cash NUMERIC(12,2),
  difference    NUMERIC(12,2),
  status        TEXT DEFAULT 'open' CHECK (status IN ('open','closed')),
  notes         TEXT
);
CREATE INDEX idx_sessions_tenant ON cash_sessions(tenant_id, opened_at DESC);
ALTER TABLE cash_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sessions_all" ON cash_sessions FOR ALL
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- ── 2. CASH TRANSACTIONS (petty cash) ─────────────────────────
CREATE TABLE IF NOT EXISTS cash_transactions (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  session_id  UUID REFERENCES cash_sessions(id),
  type        TEXT NOT NULL CHECK (type IN ('in','out')),
  amount      NUMERIC(12,2) NOT NULL,
  reason      TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_cash_txns_session ON cash_transactions(session_id);
ALTER TABLE cash_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cash_txns_all" ON cash_transactions FOR ALL
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- ── 3. REPAIRS / SERVICE JOBS ─────────────────────────────────
CREATE TABLE IF NOT EXISTS repairs (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  job_num         TEXT NOT NULL,
  customer        TEXT NOT NULL,
  customer_phone  TEXT,
  customer_id     UUID,
  item_type       TEXT,          -- 'Shoe', 'Bag', 'Watch', etc.
  item_brand      TEXT,
  item_desc       TEXT,
  problem         TEXT NOT NULL,
  diagnosis       TEXT,
  parts_used      JSONB DEFAULT '[]',
  labour_charge   NUMERIC(10,2) DEFAULT 0,
  parts_charge    NUMERIC(10,2) DEFAULT 0,
  total_charge    NUMERIC(10,2) DEFAULT 0,
  advance_paid    NUMERIC(10,2) DEFAULT 0,
  status          TEXT DEFAULT 'received' CHECK (status IN ('received','diagnosed','in_repair','ready','delivered','cancelled')),
  priority        TEXT DEFAULT 'normal' CHECK (priority IN ('low','normal','high','urgent')),
  received_date   DATE DEFAULT CURRENT_DATE,
  est_completion  DATE,
  delivered_date  DATE,
  technician      TEXT,
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_repairs_tenant ON repairs(tenant_id, received_date DESC);
ALTER TABLE repairs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "repairs_all" ON repairs FOR ALL
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());
CREATE TRIGGER trg_repairs_ts BEFORE UPDATE ON repairs
  FOR EACH ROW EXECUTE FUNCTION _set_updated_at();

-- ── 4. ROLE PERMISSIONS CONFIG ────────────────────────────────
ALTER TABLE users ADD COLUMN IF NOT EXISTS permissions JSONB DEFAULT '{}';
-- Roles: 'owner', 'manager', 'cashier', 'staff'
-- permissions JSON example: {"pos":true,"reports":false,"settings":false}
