-- ═══════════════════════════════════════════════════════════════
-- 7SQ Phase 26 — B2B Orders, Requisitions, WA Report
-- Run AFTER 022_phase25.sql
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS b2b_orders (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id      UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  order_no       TEXT NOT NULL,
  customer       TEXT NOT NULL,
  customer_id    UUID REFERENCES customers(id),
  customer_phone TEXT,
  customer_gstin TEXT,
  items          JSONB DEFAULT '[]',
  subtotal       NUMERIC(14,2) DEFAULT 0,
  discount_pct   NUMERIC(5,2)  DEFAULT 0,
  discount_amt   NUMERIC(12,2) DEFAULT 0,
  gst_amount     NUMERIC(12,2) DEFAULT 0,
  total          NUMERIC(14,2) DEFAULT 0,
  advance_paid   NUMERIC(12,2) DEFAULT 0,
  balance_due    NUMERIC(12,2) DEFAULT 0,
  delivery_date  DATE,
  status         TEXT DEFAULT 'draft'
                 CHECK (status IN ('draft','confirmed','processing','dispatched','delivered','cancelled')),
  payment_status TEXT DEFAULT 'pending'
                 CHECK (payment_status IN ('pending','partial','paid')),
  notes          TEXT,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_b2b_no ON b2b_orders(tenant_id, order_no);
ALTER TABLE b2b_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "b2b_all" ON b2b_orders FOR ALL
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

CREATE TABLE IF NOT EXISTS purchase_requisitions (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id      UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  req_no         TEXT NOT NULL,
  requested_by   TEXT NOT NULL,
  department     TEXT,
  items          JSONB DEFAULT '[]',
  total_est      NUMERIC(12,2) DEFAULT 0,
  priority       TEXT DEFAULT 'normal'
                 CHECK (priority IN ('low','normal','high','urgent')),
  required_by    DATE,
  status         TEXT DEFAULT 'pending'
                 CHECK (status IN ('pending','approved','rejected','ordered')),
  approved_by    TEXT,
  approved_at    TIMESTAMPTZ,
  reject_reason  TEXT,
  po_id          UUID REFERENCES purchases(id),
  notes          TEXT,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_req_no ON purchase_requisitions(tenant_id, req_no);
ALTER TABLE purchase_requisitions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "req_all" ON purchase_requisitions FOR ALL
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

CREATE TABLE IF NOT EXISTS wa_daily_reports (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id    UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  report_date  DATE NOT NULL DEFAULT CURRENT_DATE,
  revenue      NUMERIC(12,2) DEFAULT 0,
  orders       INTEGER DEFAULT 0,
  expenses     NUMERIC(12,2) DEFAULT 0,
  profit       NUMERIC(12,2) DEFAULT 0,
  sent_to      TEXT,
  sent_at      TIMESTAMPTZ,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_wa_report ON wa_daily_reports(tenant_id, report_date DESC);
ALTER TABLE wa_daily_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "war_all" ON wa_daily_reports FOR ALL
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());
