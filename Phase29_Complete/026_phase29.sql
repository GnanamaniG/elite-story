-- ═══════════════════════════════════════════════════════════════
-- 7SQ Phase 29 — GRN, Batch/Expiry, Shift Handover,
--                 Visit Log, GST Reconciliation
-- Run AFTER 025_phase28.sql
-- Safe re-run: drops partial objects first
-- ═══════════════════════════════════════════════════════════════

DROP TABLE IF EXISTS goods_receipts    CASCADE;
DROP TABLE IF EXISTS product_batches   CASCADE;
DROP TABLE IF EXISTS shift_handovers   CASCADE;
DROP TABLE IF EXISTS customer_visits   CASCADE;
DROP TABLE IF EXISTS gst_reconciliation CASCADE;

-- ── 1. Goods Receipt Notes ────────────────────────────────────
CREATE TABLE goods_receipts (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id      UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  grn_no         TEXT NOT NULL,
  purchase_id    UUID REFERENCES purchases(id),
  po_number      TEXT,
  supplier       TEXT NOT NULL,
  supplier_id    UUID REFERENCES suppliers(id),
  invoice_no     TEXT,
  invoice_date   DATE,
  items          JSONB DEFAULT '[]',
  total_ordered  INTEGER DEFAULT 0,
  total_received INTEGER DEFAULT 0,
  total_rejected INTEGER DEFAULT 0,
  grn_value      NUMERIC(14,2) DEFAULT 0,
  receipt_date   DATE DEFAULT CURRENT_DATE,
  received_by    TEXT,
  qc_status      TEXT DEFAULT 'pending'
                 CHECK (qc_status IN ('pending','passed','partial','failed')),
  qc_notes       TEXT,
  status         TEXT DEFAULT 'draft'
                 CHECK (status IN ('draft','received','partial','completed','cancelled')),
  notes          TEXT,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);
CREATE UNIQUE INDEX idx_grn_no ON goods_receipts(tenant_id, grn_no);
CREATE INDEX idx_grn_po ON goods_receipts(tenant_id, purchase_id);
ALTER TABLE goods_receipts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "grn_all" ON goods_receipts FOR ALL
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- ── 2. Product Batches / Lots ─────────────────────────────────
CREATE TABLE product_batches (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  item_id       UUID REFERENCES inventory(id) ON DELETE CASCADE,
  item_name     TEXT NOT NULL,
  batch_no      TEXT NOT NULL,
  supplier      TEXT,
  mfg_date      DATE,
  expiry_date   DATE,
  qty_received  INTEGER DEFAULT 0,
  qty_remaining INTEGER DEFAULT 0,
  cost_price    NUMERIC(10,2) DEFAULT 0,
  grn_id        UUID REFERENCES goods_receipts(id),
  location      TEXT,
  status        TEXT DEFAULT 'active'
                CHECK (status IN ('active','expiring','expired','sold_out','recalled')),
  notes         TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);
CREATE UNIQUE INDEX idx_batch_no ON product_batches(tenant_id, item_id, batch_no);
CREATE INDEX idx_batch_exp ON product_batches(tenant_id, expiry_date, status);
ALTER TABLE product_batches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "batch_all" ON product_batches FOR ALL
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- ── 3. Shift Handovers ────────────────────────────────────────
CREATE TABLE shift_handovers (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  shift_date      DATE DEFAULT CURRENT_DATE,
  shift_type      TEXT DEFAULT 'full'
                  CHECK (shift_type IN ('morning','evening','night','full')),
  staff_out       TEXT NOT NULL,
  staff_in        TEXT,
  opening_cash    NUMERIC(12,2) DEFAULT 0,
  cash_sales      NUMERIC(12,2) DEFAULT 0,
  card_sales      NUMERIC(12,2) DEFAULT 0,
  upi_sales       NUMERIC(12,2) DEFAULT 0,
  cash_expenses   NUMERIC(12,2) DEFAULT 0,
  expected_cash   NUMERIC(12,2) DEFAULT 0,
  counted_cash    NUMERIC(12,2) DEFAULT 0,
  variance        NUMERIC(12,2) DEFAULT 0,
  denominations   JSONB DEFAULT '{}',
  pending_tasks   TEXT,
  handover_notes  TEXT,
  issues_reported TEXT,
  status          TEXT DEFAULT 'open'
                  CHECK (status IN ('open','closed','verified')),
  closed_at       TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_shift_date ON shift_handovers(tenant_id, shift_date DESC);
ALTER TABLE shift_handovers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "shift_all" ON shift_handovers FOR ALL
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- ── 4. Customer Visit Log ─────────────────────────────────────
CREATE TABLE customer_visits (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  visit_date    DATE DEFAULT CURRENT_DATE,
  visit_time    TIMESTAMPTZ DEFAULT NOW(),
  customer_id   UUID REFERENCES customers(id),
  customer_name TEXT,
  phone         TEXT,
  visit_type    TEXT DEFAULT 'walk_in'
                CHECK (visit_type IN ('walk_in','appointment','enquiry','repeat','return')),
  interest      TEXT,
  attended_by   TEXT,
  converted     BOOLEAN DEFAULT FALSE,
  sale_id       UUID REFERENCES sales(id),
  sale_value    NUMERIC(12,2) DEFAULT 0,
  lost_reason   TEXT,
  follow_up     DATE,
  notes         TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_visit_date ON customer_visits(tenant_id, visit_date DESC);
ALTER TABLE customer_visits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "visit_all" ON customer_visits FOR ALL
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- ── 5. GST Reconciliation ─────────────────────────────────────
CREATE TABLE gst_reconciliation (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id      UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  period         TEXT NOT NULL,
  supplier_gstin TEXT,
  supplier_name  TEXT NOT NULL,
  invoice_no     TEXT NOT NULL,
  invoice_date   DATE,
  books_taxable  NUMERIC(12,2) DEFAULT 0,
  books_igst     NUMERIC(10,2) DEFAULT 0,
  books_cgst     NUMERIC(10,2) DEFAULT 0,
  books_sgst     NUMERIC(10,2) DEFAULT 0,
  portal_taxable NUMERIC(12,2) DEFAULT 0,
  portal_igst    NUMERIC(10,2) DEFAULT 0,
  portal_cgst    NUMERIC(10,2) DEFAULT 0,
  portal_sgst    NUMERIC(10,2) DEFAULT 0,
  difference     NUMERIC(12,2) DEFAULT 0,
  match_status   TEXT DEFAULT 'unmatched'
                 CHECK (match_status IN ('matched','mismatched','books_only','portal_only','unmatched')),
  action_taken   TEXT,
  resolved       BOOLEAN DEFAULT FALSE,
  notes          TEXT,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_gstrec_period ON gst_reconciliation(tenant_id, period, match_status);
ALTER TABLE gst_reconciliation ENABLE ROW LEVEL SECURITY;
CREATE POLICY "gstrec_all" ON gst_reconciliation FOR ALL
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- ── Verify ────────────────────────────────────────────────────
SELECT table_name, COUNT(*) AS columns
FROM information_schema.columns
WHERE table_name IN ('goods_receipts','product_batches','shift_handovers','customer_visits','gst_reconciliation')
GROUP BY table_name ORDER BY table_name;
