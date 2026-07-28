-- ═══════════════════════════════════════════════════════════════════
-- Elite Store Phase 10 — Returns, Stock Transfers, Price Lists
-- Run in Supabase SQL Editor AFTER 006_phase8.sql
-- ═══════════════════════════════════════════════════════════════════

-- ── 1. SALES RETURNS / CREDIT NOTES ──────────────────────────
CREATE TABLE IF NOT EXISTS returns (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  original_sale_id UUID REFERENCES sales(id),
  return_num    TEXT NOT NULL,
  date          DATE DEFAULT CURRENT_DATE,
  customer      TEXT,
  customer_id   UUID,
  reason        TEXT,
  items         JSONB DEFAULT '[]',
  subtotal      NUMERIC(12,2) DEFAULT 0,
  gst_amount    NUMERIC(12,2) DEFAULT 0,
  total         NUMERIC(12,2) DEFAULT 0,
  refund_mode   TEXT DEFAULT 'cash' CHECK (refund_mode IN ('cash','upi','credit_note','exchange')),
  status        TEXT DEFAULT 'completed' CHECK (status IN ('completed','pending','cancelled')),
  notes         TEXT,
  created_by    UUID,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_returns_tenant ON returns(tenant_id, date DESC);
CREATE INDEX idx_returns_sale   ON returns(original_sale_id);

ALTER TABLE returns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "returns_all" ON returns FOR ALL
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

CREATE TRIGGER trg_returns_ts BEFORE UPDATE ON returns
  FOR EACH ROW EXECUTE FUNCTION _set_updated_at();

-- ── 2. STOCK TRANSFERS BETWEEN BRANCHES ───────────────────────
-- (stock_transfers table already exists from 004_branches.sql)
-- Add extra columns if not present
ALTER TABLE stock_transfers ADD COLUMN IF NOT EXISTS reference TEXT;
ALTER TABLE stock_transfers ADD COLUMN IF NOT EXISTS approved_by UUID;
ALTER TABLE stock_transfers ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;

-- ── 3. PRICE LISTS (wholesale, retail, VIP, etc.) ─────────────
CREATE TABLE IF NOT EXISTS price_lists (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,    -- e.g. "Wholesale", "VIP", "Staff"
  description TEXT,
  discount    NUMERIC(5,2) DEFAULT 0,   -- blanket % discount
  active      BOOLEAN DEFAULT TRUE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_pricelists_tenant ON price_lists(tenant_id);

ALTER TABLE price_lists ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pricelists_all" ON price_lists FOR ALL
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- Price list items (override price for specific items)
CREATE TABLE IF NOT EXISTS price_list_items (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  price_list_id UUID NOT NULL REFERENCES price_lists(id) ON DELETE CASCADE,
  item_id       UUID NOT NULL REFERENCES inventory(id) ON DELETE CASCADE,
  price         NUMERIC(10,2),       -- override price (null = use list discount)
  discount      NUMERIC(5,2),        -- item-specific discount %
  created_at    TIMESTAMPTZ DEFAULT NOW()
);
CREATE UNIQUE INDEX idx_pl_items_unique ON price_list_items(price_list_id, item_id);

ALTER TABLE price_list_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pl_items_all" ON price_list_items FOR ALL
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- Link customers to price lists
ALTER TABLE customers ADD COLUMN IF NOT EXISTS price_list_id UUID REFERENCES price_lists(id);

-- ── 4. PURCHASE ORDERS (formal PO workflow) ───────────────────
CREATE TABLE IF NOT EXISTS purchase_orders (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  po_number     TEXT NOT NULL,
  supplier_id   UUID REFERENCES suppliers(id),
  supplier_name TEXT,
  date          DATE DEFAULT CURRENT_DATE,
  expected_date DATE,
  items         JSONB DEFAULT '[]',
  subtotal      NUMERIC(12,2) DEFAULT 0,
  gst_amount    NUMERIC(12,2) DEFAULT 0,
  total         NUMERIC(12,2) DEFAULT 0,
  status        TEXT DEFAULT 'draft' CHECK (status IN ('draft','sent','confirmed','received','cancelled')),
  notes         TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_po_tenant ON purchase_orders(tenant_id, date DESC);

ALTER TABLE purchase_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "po_all" ON purchase_orders FOR ALL
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

CREATE TRIGGER trg_po_ts BEFORE UPDATE ON purchase_orders
  FOR EACH ROW EXECUTE FUNCTION _set_updated_at();
