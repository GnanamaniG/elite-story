-- ═══════════════════════════════════════════════════════════════════
-- Elite Store Phase 15 — Promo Codes, Bundles, Performance, Audits
-- Run in Supabase SQL Editor AFTER 011_phase14.sql
-- ═══════════════════════════════════════════════════════════════════

-- ── 1. PROMO CODES ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS promo_codes (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  code            TEXT NOT NULL,
  description     TEXT,
  type            TEXT NOT NULL CHECK (type IN ('percent','fixed','free_shipping')),
  value           NUMERIC(10,2) NOT NULL,
  min_order       NUMERIC(10,2) DEFAULT 0,
  max_discount    NUMERIC(10,2),
  uses_limit      INTEGER,
  uses_count      INTEGER DEFAULT 0,
  valid_from      DATE DEFAULT CURRENT_DATE,
  valid_until     DATE,
  active          BOOLEAN DEFAULT TRUE,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE UNIQUE INDEX idx_promo_code ON promo_codes(tenant_id, code);
CREATE INDEX idx_promo_tenant ON promo_codes(tenant_id);
ALTER TABLE promo_codes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "promo_all" ON promo_codes FOR ALL
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

ALTER TABLE sales ADD COLUMN IF NOT EXISTS promo_code TEXT;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS promo_discount NUMERIC(10,2) DEFAULT 0;

-- ── 2. PRODUCT BUNDLES ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS bundles (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  description   TEXT,
  bundle_price  NUMERIC(10,2) NOT NULL,
  active        BOOLEAN DEFAULT TRUE,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_bundles_tenant ON bundles(tenant_id);
ALTER TABLE bundles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bundles_all" ON bundles FOR ALL
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

CREATE TABLE IF NOT EXISTS bundle_items (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  bundle_id   UUID NOT NULL REFERENCES bundles(id) ON DELETE CASCADE,
  item_id     UUID REFERENCES inventory(id),
  item_name   TEXT NOT NULL,
  qty         INTEGER DEFAULT 1,
  orig_price  NUMERIC(10,2) DEFAULT 0
);
ALTER TABLE bundle_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bundle_items_all" ON bundle_items FOR ALL
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- ── 3. STAFF PERFORMANCE / TARGETS ───────────────────────────
CREATE TABLE IF NOT EXISTS staff_targets (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id     UUID REFERENCES users(id),
  staff_name  TEXT NOT NULL,
  period      TEXT NOT NULL,       -- '2025-07'
  target_rev  NUMERIC(12,2) DEFAULT 0,
  target_orders INTEGER DEFAULT 0,
  commission_rate NUMERIC(5,2) DEFAULT 0,  -- % of sales
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE UNIQUE INDEX idx_targets_unique ON staff_targets(tenant_id, user_id, period);
ALTER TABLE staff_targets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "targets_all" ON staff_targets FOR ALL
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

ALTER TABLE sales ADD COLUMN IF NOT EXISTS staff_id UUID REFERENCES users(id);
ALTER TABLE sales ADD COLUMN IF NOT EXISTS staff_name TEXT;

-- ── 4. STOCK AUDITS ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS stock_audits (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  branch_id   UUID REFERENCES branches(id),
  name        TEXT NOT NULL,
  status      TEXT DEFAULT 'in_progress' CHECK (status IN ('in_progress','completed','cancelled')),
  started_by  UUID,
  started_at  TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  total_items INTEGER DEFAULT 0,
  matched     INTEGER DEFAULT 0,
  discrepancies INTEGER DEFAULT 0,
  notes       TEXT
);
ALTER TABLE stock_audits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "audits_all" ON stock_audits FOR ALL
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

CREATE TABLE IF NOT EXISTS audit_items (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  audit_id      UUID NOT NULL REFERENCES stock_audits(id) ON DELETE CASCADE,
  item_id       UUID REFERENCES inventory(id),
  item_name     TEXT NOT NULL,
  system_qty    NUMERIC(10,2) DEFAULT 0,
  counted_qty   NUMERIC(10,2),
  difference    NUMERIC(10,2),
  status        TEXT DEFAULT 'pending' CHECK (status IN ('pending','matched','short','excess')),
  notes         TEXT
);
ALTER TABLE audit_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "audit_items_all" ON audit_items FOR ALL
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());
