-- ═══════════════════════════════════════════════════════════════════
-- Elite Store Phase 20 — Quotations, EMI, Commissions, QC, e-Way Bill
-- Run in Supabase SQL Editor AFTER 016_phase19.sql
-- ═══════════════════════════════════════════════════════════════════

-- ── 1. QUOTATIONS / ESTIMATES ────────────────────────────────
CREATE TABLE IF NOT EXISTS quotations (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  quot_number   TEXT NOT NULL,
  customer_id   UUID REFERENCES customers(id),
  customer      TEXT NOT NULL,
  customer_phone TEXT,
  customer_email TEXT,
  items         JSONB DEFAULT '[]',
  subtotal      NUMERIC(12,2) DEFAULT 0,
  gst_amount    NUMERIC(12,2) DEFAULT 0,
  discount      NUMERIC(10,2) DEFAULT 0,
  total         NUMERIC(12,2) DEFAULT 0,
  validity_days INTEGER DEFAULT 30,
  valid_until   DATE,
  notes         TEXT,
  terms         TEXT,
  status        TEXT DEFAULT 'draft'
                CHECK (status IN ('draft','sent','accepted','rejected','expired','converted')),
  converted_to  UUID REFERENCES sales(id),
  quot_date     DATE DEFAULT CURRENT_DATE,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);
CREATE UNIQUE INDEX idx_quot_number ON quotations(tenant_id, quot_number);
CREATE INDEX idx_quot_tenant ON quotations(tenant_id, quot_date DESC);
ALTER TABLE quotations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "quot_all" ON quotations FOR ALL
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- ── 2. EMI / BNPL PLANS ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS emi_plans (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  sale_id         UUID REFERENCES sales(id),
  customer_id     UUID REFERENCES customers(id),
  customer        TEXT NOT NULL,
  customer_phone  TEXT,
  total_amount    NUMERIC(12,2) NOT NULL,
  down_payment    NUMERIC(12,2) DEFAULT 0,
  loan_amount     NUMERIC(12,2) NOT NULL,
  interest_rate   NUMERIC(5,2) DEFAULT 0,
  tenure_months   INTEGER NOT NULL,
  emi_amount      NUMERIC(10,2) NOT NULL,
  start_date      DATE DEFAULT CURRENT_DATE,
  status          TEXT DEFAULT 'active'
                  CHECK (status IN ('active','completed','defaulted','cancelled')),
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_emi_tenant ON emi_plans(tenant_id, start_date DESC);
ALTER TABLE emi_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "emi_all" ON emi_plans FOR ALL
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

CREATE TABLE IF NOT EXISTS emi_payments (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  emi_plan_id     UUID NOT NULL REFERENCES emi_plans(id) ON DELETE CASCADE,
  installment_no  INTEGER NOT NULL,
  due_date        DATE NOT NULL,
  paid_date       DATE,
  amount          NUMERIC(10,2) NOT NULL,
  paid_amount     NUMERIC(10,2) DEFAULT 0,
  status          TEXT DEFAULT 'pending'
                  CHECK (status IN ('pending','paid','overdue','partial')),
  payment_mode    TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_emipay_plan ON emi_payments(emi_plan_id, installment_no);
ALTER TABLE emi_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "emipay_all" ON emi_payments FOR ALL
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- ── 3. COMMISSIONS ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS commissions (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  staff_name      TEXT NOT NULL,
  period          TEXT NOT NULL,  -- YYYY-MM
  total_sales     NUMERIC(12,2) DEFAULT 0,
  commission_rate NUMERIC(5,2) DEFAULT 0,
  commission_amt  NUMERIC(10,2) DEFAULT 0,
  bonus           NUMERIC(10,2) DEFAULT 0,
  deductions      NUMERIC(10,2) DEFAULT 0,
  net_commission  NUMERIC(10,2) DEFAULT 0,
  status          TEXT DEFAULT 'pending' CHECK (status IN ('pending','approved','paid')),
  paid_date       DATE,
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_comm_tenant ON commissions(tenant_id, period DESC);
ALTER TABLE commissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "comm_all" ON commissions FOR ALL
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- ── 4. QUALITY CONTROL ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS qc_inspections (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  ref_number      TEXT NOT NULL,
  type            TEXT DEFAULT 'inbound' CHECK (type IN ('inbound','outbound','process','random')),
  item_id         UUID REFERENCES inventory(id),
  item_name       TEXT NOT NULL,
  batch_qty       INTEGER DEFAULT 0,
  passed_qty      INTEGER DEFAULT 0,
  failed_qty      INTEGER DEFAULT 0,
  inspector       TEXT,
  checklist       JSONB DEFAULT '[]',
  result          TEXT DEFAULT 'pending' CHECK (result IN ('pending','pass','fail','conditional')),
  notes           TEXT,
  inspected_at    DATE DEFAULT CURRENT_DATE,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_qc_tenant ON qc_inspections(tenant_id, inspected_at DESC);
ALTER TABLE qc_inspections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "qc_all" ON qc_inspections FOR ALL
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- ── 5. E-WAY BILL ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS eway_bills (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  ewb_number      TEXT,
  sale_id         UUID REFERENCES sales(id),
  purchase_id     UUID REFERENCES purchases(id),
  bill_type       TEXT DEFAULT 'outward' CHECK (bill_type IN ('outward','inward','other')),
  doc_number      TEXT NOT NULL,
  doc_date        DATE DEFAULT CURRENT_DATE,
  from_gstin      TEXT,
  to_gstin        TEXT,
  to_name         TEXT NOT NULL,
  to_address      TEXT,
  to_pincode      TEXT,
  to_state        TEXT,
  items           JSONB DEFAULT '[]',
  total_value     NUMERIC(12,2) DEFAULT 0,
  cgst            NUMERIC(10,2) DEFAULT 0,
  sgst            NUMERIC(10,2) DEFAULT 0,
  igst            NUMERIC(10,2) DEFAULT 0,
  transport_mode  TEXT DEFAULT 'road',
  vehicle_no      TEXT,
  transporter     TEXT,
  distance_km     INTEGER DEFAULT 0,
  valid_until     DATE,
  status          TEXT DEFAULT 'draft' CHECK (status IN ('draft','generated','cancelled')),
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_ewb_tenant ON eway_bills(tenant_id, doc_date DESC);
ALTER TABLE eway_bills ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ewb_all" ON eway_bills FOR ALL
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());
