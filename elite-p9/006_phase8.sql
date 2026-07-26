-- ═══════════════════════════════════════════════════════════════════
-- Elite Store Phase 8 — Variants, Suppliers, Credit Ledger
-- Run in Supabase SQL Editor AFTER 005_hr_loyalty.sql
-- ═══════════════════════════════════════════════════════════════════

-- ── 1. PRODUCT VARIANTS ───────────────────────────────────────
-- Each inventory item can have variant groups (Size, Colour)
CREATE TABLE IF NOT EXISTS variant_groups (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  item_id     UUID NOT NULL REFERENCES inventory(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,   -- e.g. "Size", "Colour"
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_vgroups_item ON variant_groups(item_id);

ALTER TABLE variant_groups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "vgroups_all" ON variant_groups FOR ALL
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- Each variant group has options
CREATE TABLE IF NOT EXISTS variants (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  item_id     UUID NOT NULL REFERENCES inventory(id) ON DELETE CASCADE,
  group_id    UUID NOT NULL REFERENCES variant_groups(id) ON DELETE CASCADE,
  value       TEXT NOT NULL,   -- e.g. "Size 8", "Red"
  stock       NUMERIC(10,2) DEFAULT 0,
  sp_adj      NUMERIC(10,2) DEFAULT 0,   -- price adjustment (+/-)
  sku         TEXT,
  active      BOOLEAN DEFAULT TRUE,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_variants_item ON variants(item_id);
CREATE INDEX idx_variants_group ON variants(group_id);

ALTER TABLE variants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "variants_all" ON variants FOR ALL
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

CREATE TRIGGER trg_variants_ts BEFORE UPDATE ON variants
  FOR EACH ROW EXECUTE FUNCTION _set_updated_at();

-- ── 2. SUPPLIERS ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS suppliers (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  phone           TEXT,
  email           TEXT,
  gstin           TEXT,
  address         TEXT,
  payment_terms   INTEGER DEFAULT 30,  -- days
  credit_limit    NUMERIC(12,2) DEFAULT 0,
  outstanding     NUMERIC(12,2) DEFAULT 0,  -- amount we owe them
  bank_name       TEXT,
  account_no      TEXT,
  ifsc            TEXT,
  upi_id          TEXT,
  notes           TEXT,
  active          BOOLEAN DEFAULT TRUE,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_suppliers_tenant ON suppliers(tenant_id);

ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "suppliers_all" ON suppliers FOR ALL
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

CREATE TRIGGER trg_suppliers_ts BEFORE UPDATE ON suppliers
  FOR EACH ROW EXECUTE FUNCTION _set_updated_at();

-- Link purchases to supplier profile
ALTER TABLE purchases ADD COLUMN IF NOT EXISTS supplier_id UUID REFERENCES suppliers(id);

-- ── 3. CUSTOMER CREDIT LEDGER ─────────────────────────────────
CREATE TABLE IF NOT EXISTS credit_ledger (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  customer_id   UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  sale_id       UUID REFERENCES sales(id),
  txn_type      TEXT NOT NULL CHECK (txn_type IN ('sale','payment','adjustment','refund')),
  amount        NUMERIC(12,2) NOT NULL,  -- positive = debit (they owe us), negative = credit
  balance       NUMERIC(12,2) DEFAULT 0, -- running balance after this txn
  note          TEXT,
  due_date      DATE,
  paid_on       DATE,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_ledger_tenant   ON credit_ledger(tenant_id);
CREATE INDEX idx_ledger_customer ON credit_ledger(customer_id);

ALTER TABLE credit_ledger ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ledger_all" ON credit_ledger FOR ALL
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- ── 4. PAYMENT REMINDERS ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS payment_reminders (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  customer_id   UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  amount        NUMERIC(12,2) NOT NULL,
  due_date      DATE NOT NULL,
  status        TEXT DEFAULT 'pending' CHECK (status IN ('pending','sent','paid','ignored')),
  sent_via      TEXT,  -- 'whatsapp', 'sms'
  sent_at       TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_reminders_tenant ON payment_reminders(tenant_id);

ALTER TABLE payment_reminders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reminders_all" ON payment_reminders FOR ALL
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- ── 5. PHONE AUTH — add phone to users ────────────────────────
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone_verified BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS otp_login     BOOLEAN DEFAULT FALSE;
