-- ═══════════════════════════════════════════════════════════════
-- 7SQ — Serial / IMEI tracking
-- Lets a business track WHICH physical unit was sold, not just
-- "1 × Product X". Needed for mobiles, electronics, appliances.
-- Additive only. Safe to re-run.
-- ═══════════════════════════════════════════════════════════════

-- 1. Flag which products are serialised (most shops: only a few are)
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS is_serialised BOOLEAN DEFAULT FALSE;
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS serial_label  TEXT DEFAULT 'Serial No';
   -- serial_label lets a mobile shop show "IMEI" while an appliance
   -- shop shows "Serial No" — same mechanism, correct wording.

-- 2. The serial register: one row per physical unit
CREATE TABLE IF NOT EXISTS item_serials (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  item_id       UUID REFERENCES inventory(id) ON DELETE CASCADE,
  item_name     TEXT NOT NULL,
  serial_no     TEXT NOT NULL,          -- IMEI / serial / engine no
  serial_alt    TEXT,                   -- dual-SIM second IMEI, or box no
  batch_no      TEXT,
  status        TEXT DEFAULT 'in_stock'
                CHECK (status IN ('in_stock','sold','returned','damaged','rma','reserved')),
  -- inward
  grn_id        UUID REFERENCES goods_receipts(id),
  purchase_id   UUID REFERENCES purchases(id),
  supplier      TEXT,
  cost_price    NUMERIC(12,2) DEFAULT 0,
  received_date DATE DEFAULT CURRENT_DATE,
  -- outward
  sale_id       UUID REFERENCES sales(id),
  invoice_no    TEXT,
  customer      TEXT,
  customer_id   UUID REFERENCES customers(id),
  sold_price    NUMERIC(12,2),
  sold_date     DATE,
  -- after-sale
  warranty_id   UUID REFERENCES warranties(id),
  warranty_till DATE,
  notes         TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- A serial must be unique within a tenant — this is the whole point
CREATE UNIQUE INDEX IF NOT EXISTS idx_serial_unique
  ON item_serials(tenant_id, serial_no);
CREATE INDEX IF NOT EXISTS idx_serial_item
  ON item_serials(tenant_id, item_id, status);
CREATE INDEX IF NOT EXISTS idx_serial_status
  ON item_serials(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_serial_sale
  ON item_serials(tenant_id, sale_id);

ALTER TABLE item_serials ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "serial_all" ON item_serials;
CREATE POLICY "serial_all" ON item_serials FOR ALL
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- 3. Verify
SELECT 'item_serials' AS tbl,
       (SELECT COUNT(*) FROM information_schema.columns WHERE table_name='item_serials') AS columns
UNION ALL
SELECT 'inventory.is_serialised',
       (SELECT COUNT(*) FROM information_schema.columns
        WHERE table_name='inventory' AND column_name='is_serialised');
