-- ═══════════════════════════════════════════════════════════════
-- 7SQ Phase 25 — Cash Book, Targets, Reviews, Coupons, Vouchers
-- Run AFTER 021_phase24.sql
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS cashbook_entries (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id    UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  entry_date   DATE NOT NULL DEFAULT CURRENT_DATE,
  type         TEXT NOT NULL CHECK (type IN ('opening','receipt','payment','closing')),
  description  TEXT NOT NULL,
  category     TEXT,
  ref_no       TEXT,
  debit        NUMERIC(12,2) DEFAULT 0,
  credit       NUMERIC(12,2) DEFAULT 0,
  balance      NUMERIC(12,2) DEFAULT 0,
  entered_by   TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_cashbook_date ON cashbook_entries(tenant_id, entry_date DESC);
ALTER TABLE cashbook_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cb_all" ON cashbook_entries FOR ALL
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

CREATE TABLE IF NOT EXISTS sales_targets (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id    UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  staff_name   TEXT NOT NULL,
  period       TEXT NOT NULL,   -- YYYY-MM
  target_sales NUMERIC(12,2) DEFAULT 0,
  target_orders INTEGER DEFAULT 0,
  actual_sales NUMERIC(12,2) DEFAULT 0,
  actual_orders INTEGER DEFAULT 0,
  incentive_rate NUMERIC(5,2) DEFAULT 0,
  incentive_paid NUMERIC(10,2) DEFAULT 0,
  notes        TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_target_period ON sales_targets(tenant_id, staff_name, period);
ALTER TABLE sales_targets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tgt_all" ON sales_targets FOR ALL
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

CREATE TABLE IF NOT EXISTS product_reviews (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id    UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  customer_id  UUID REFERENCES customers(id),
  customer     TEXT NOT NULL,
  phone        TEXT,
  item_id      UUID REFERENCES inventory(id),
  item_name    TEXT NOT NULL,
  rating       INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  review       TEXT,
  reply        TEXT,
  source       TEXT DEFAULT 'whatsapp' CHECK (source IN ('whatsapp','in-store','online','manual')),
  verified     BOOLEAN DEFAULT FALSE,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_review_item ON product_reviews(tenant_id, item_id, rating DESC);
ALTER TABLE product_reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rev_all" ON product_reviews FOR ALL
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

CREATE TABLE IF NOT EXISTS coupons (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id    UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  code         TEXT NOT NULL,
  description  TEXT,
  type         TEXT NOT NULL CHECK (type IN ('percent','fixed','free_delivery')),
  value        NUMERIC(10,2) NOT NULL,
  min_purchase NUMERIC(10,2) DEFAULT 0,
  max_discount NUMERIC(10,2),
  usage_limit  INTEGER DEFAULT 1,
  used_count   INTEGER DEFAULT 0,
  valid_from   DATE DEFAULT CURRENT_DATE,
  valid_until  DATE,
  customer_id  UUID REFERENCES customers(id),
  active       BOOLEAN DEFAULT TRUE,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_coupon_code ON coupons(tenant_id, code);
ALTER TABLE coupons ENABLE ROW LEVEL SECURITY;
CREATE POLICY "coupon_all" ON coupons FOR ALL
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

CREATE TABLE IF NOT EXISTS expense_vouchers (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id    UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  voucher_no   TEXT NOT NULL,
  voucher_date DATE DEFAULT CURRENT_DATE,
  paid_to      TEXT NOT NULL,
  purpose      TEXT NOT NULL,
  amount       NUMERIC(10,2) NOT NULL,
  category     TEXT,
  payment_mode TEXT DEFAULT 'cash',
  approved_by  TEXT,
  status       TEXT DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','paid')),
  notes        TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_voucher_no ON expense_vouchers(tenant_id, voucher_no);
ALTER TABLE expense_vouchers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "vch_all" ON expense_vouchers FOR ALL
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());
