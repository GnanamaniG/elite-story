-- ═══════════════════════════════════════════════════════════════
-- 7SQ Phase 30 — Transfer Orders, Compliance Calendar,
--                 Commission Runs, Document Expiry
-- Run AFTER 026_phase29.sql · Fully idempotent
-- ═══════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "sto_all"  ON stock_transfer_orders;
DROP POLICY IF EXISTS "comp_all" ON compliance_calendar;
DROP POLICY IF EXISTS "crun_all" ON commission_runs;
DROP POLICY IF EXISTS "docx_all" ON document_expiry;

DROP TABLE IF EXISTS stock_transfer_orders CASCADE;
DROP TABLE IF EXISTS compliance_calendar   CASCADE;
DROP TABLE IF EXISTS commission_runs       CASCADE;
DROP TABLE IF EXISTS document_expiry       CASCADE;

-- ── 1. Stock Transfer Orders (inter-branch) ───────────────────
CREATE TABLE stock_transfer_orders (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  sto_no          TEXT NOT NULL,
  from_branch     TEXT NOT NULL,
  from_branch_id  UUID,
  to_branch       TEXT NOT NULL,
  to_branch_id    UUID,
  items           JSONB DEFAULT '[]',
  total_qty       INTEGER DEFAULT 0,
  received_qty    INTEGER DEFAULT 0,
  transfer_value  NUMERIC(14,2) DEFAULT 0,
  dispatch_date   DATE,
  expected_date   DATE,
  received_date   DATE,
  transporter     TEXT,
  lr_number       TEXT,
  dispatched_by   TEXT,
  received_by     TEXT,
  status          TEXT DEFAULT 'draft'
                  CHECK (status IN ('draft','dispatched','in_transit','received','partial','cancelled')),
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE UNIQUE INDEX idx_sto_no ON stock_transfer_orders(tenant_id, sto_no);
CREATE INDEX idx_sto_status ON stock_transfer_orders(tenant_id, status, dispatch_date DESC);
ALTER TABLE stock_transfer_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sto_all" ON stock_transfer_orders FOR ALL
  USING (tenant_id = current_tenant_id()) WITH CHECK (tenant_id = current_tenant_id());

-- ── 2. Compliance Calendar ────────────────────────────────────
CREATE TABLE compliance_calendar (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id      UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  compliance_type TEXT NOT NULL,
  title          TEXT NOT NULL,
  description    TEXT,
  period         TEXT,
  due_date       DATE NOT NULL,
  frequency      TEXT DEFAULT 'monthly'
                 CHECK (frequency IN ('monthly','quarterly','half_yearly','annual','one_time')),
  authority      TEXT,
  penalty_note   TEXT,
  assigned_to    TEXT,
  status         TEXT DEFAULT 'pending'
                 CHECK (status IN ('pending','in_progress','filed','late_filed','not_applicable')),
  filed_date     DATE,
  ack_number     TEXT,
  amount_paid    NUMERIC(12,2) DEFAULT 0,
  notes          TEXT,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_comp_due ON compliance_calendar(tenant_id, due_date, status);
ALTER TABLE compliance_calendar ENABLE ROW LEVEL SECURITY;
CREATE POLICY "comp_all" ON compliance_calendar FOR ALL
  USING (tenant_id = current_tenant_id()) WITH CHECK (tenant_id = current_tenant_id());

-- ── 3. Commission Runs ────────────────────────────────────────
CREATE TABLE commission_runs (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id      UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  run_no         TEXT NOT NULL,
  period         TEXT NOT NULL,
  staff_name     TEXT NOT NULL,
  sales_total    NUMERIC(14,2) DEFAULT 0,
  orders_count   INTEGER DEFAULT 0,
  base_rate      NUMERIC(5,2) DEFAULT 0,
  bonus_rate     NUMERIC(5,2) DEFAULT 0,
  target_amount  NUMERIC(14,2) DEFAULT 0,
  target_met     BOOLEAN DEFAULT FALSE,
  base_commission  NUMERIC(12,2) DEFAULT 0,
  bonus_commission NUMERIC(12,2) DEFAULT 0,
  deductions     NUMERIC(12,2) DEFAULT 0,
  net_payable    NUMERIC(12,2) DEFAULT 0,
  status         TEXT DEFAULT 'draft'
                 CHECK (status IN ('draft','approved','paid','cancelled')),
  approved_by    TEXT,
  paid_date      DATE,
  notes          TEXT,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);
CREATE UNIQUE INDEX idx_crun ON commission_runs(tenant_id, staff_name, period);
ALTER TABLE commission_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "crun_all" ON commission_runs FOR ALL
  USING (tenant_id = current_tenant_id()) WITH CHECK (tenant_id = current_tenant_id());

-- ── 4. Document Expiry Tracker ────────────────────────────────
CREATE TABLE document_expiry (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  doc_type      TEXT NOT NULL,
  doc_name      TEXT NOT NULL,
  doc_number    TEXT,
  issuing_body  TEXT,
  issue_date    DATE,
  expiry_date   DATE NOT NULL,
  renewal_cost  NUMERIC(12,2) DEFAULT 0,
  reminder_days INTEGER DEFAULT 30,
  responsible   TEXT,
  file_url      TEXT,
  status        TEXT DEFAULT 'active'
                CHECK (status IN ('active','expiring','expired','renewed','cancelled')),
  renewed_to    DATE,
  notes         TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_docx_exp ON document_expiry(tenant_id, expiry_date, status);
ALTER TABLE document_expiry ENABLE ROW LEVEL SECURITY;
CREATE POLICY "docx_all" ON document_expiry FOR ALL
  USING (tenant_id = current_tenant_id()) WITH CHECK (tenant_id = current_tenant_id());

SELECT table_name, COUNT(*) AS columns FROM information_schema.columns
WHERE table_name IN ('stock_transfer_orders','compliance_calendar','commission_runs','document_expiry')
GROUP BY table_name ORDER BY table_name;
