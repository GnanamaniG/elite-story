-- ═══════════════════════════════════════════════════════════════
-- 7SQ Phase 28 — Stock Adjustments, Payment Reminders,
--                 Supplier Payments, QR Attendance
-- Run AFTER 024_phase27.sql
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS stock_adjustments (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id    UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  adj_no       TEXT NOT NULL,
  item_id      UUID REFERENCES inventory(id) ON DELETE CASCADE,
  item_name    TEXT NOT NULL,
  adj_type     TEXT NOT NULL
               CHECK (adj_type IN ('damage','theft','expiry','sample','correction','found','return_to_supplier')),
  qty_before   INTEGER DEFAULT 0,
  qty_change   INTEGER NOT NULL,
  qty_after    INTEGER DEFAULT 0,
  cost_impact  NUMERIC(12,2) DEFAULT 0,
  reason       TEXT,
  approved_by  TEXT,
  adjusted_by  TEXT,
  adj_date     DATE DEFAULT CURRENT_DATE,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_adj_no ON stock_adjustments(tenant_id, adj_no);
CREATE INDEX IF NOT EXISTS idx_adj_item ON stock_adjustments(tenant_id, item_id, adj_date DESC);
ALTER TABLE stock_adjustments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "adj_all" ON stock_adjustments FOR ALL
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

CREATE TABLE IF NOT EXISTS payment_reminders (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  customer_id   UUID REFERENCES customers(id),
  customer      TEXT NOT NULL,
  phone         TEXT,
  amount_due    NUMERIC(12,2) NOT NULL,
  due_since     DATE,
  days_overdue  INTEGER DEFAULT 0,
  reminder_level INTEGER DEFAULT 1,
  last_sent     TIMESTAMPTZ,
  sent_count    INTEGER DEFAULT 0,
  promised_date DATE,
  status        TEXT DEFAULT 'pending'
                CHECK (status IN ('pending','promised','paid','disputed','written_off')),
  notes         TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_pr_cust ON payment_reminders(tenant_id, status, days_overdue DESC);
ALTER TABLE payment_reminders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pr_all" ON payment_reminders FOR ALL
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

CREATE TABLE IF NOT EXISTS supplier_payments (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  payment_no    TEXT NOT NULL,
  supplier_id   UUID REFERENCES suppliers(id),
  supplier      TEXT NOT NULL,
  purchase_id   UUID REFERENCES purchases(id),
  invoice_ref   TEXT,
  invoice_amt   NUMERIC(12,2) DEFAULT 0,
  paid_amount   NUMERIC(12,2) NOT NULL,
  balance       NUMERIC(12,2) DEFAULT 0,
  payment_mode  TEXT DEFAULT 'cash',
  payment_date  DATE DEFAULT CURRENT_DATE,
  due_date      DATE,
  ref_no        TEXT,
  notes         TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_sp_no ON supplier_payments(tenant_id, payment_no);
ALTER TABLE supplier_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sp_all" ON supplier_payments FOR ALL
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

CREATE TABLE IF NOT EXISTS attendance_qr (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id    UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  staff_name   TEXT NOT NULL,
  qr_token     TEXT NOT NULL,
  check_date   DATE DEFAULT CURRENT_DATE,
  check_in     TIMESTAMPTZ,
  check_out    TIMESTAMPTZ,
  hours_worked NUMERIC(5,2) DEFAULT 0,
  status       TEXT DEFAULT 'present'
               CHECK (status IN ('present','late','half_day','absent')),
  location     TEXT,
  notes        TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_aqr_day ON attendance_qr(tenant_id, staff_name, check_date);
ALTER TABLE attendance_qr ENABLE ROW LEVEL SECURITY;
CREATE POLICY "aqr_all" ON attendance_qr FOR ALL
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());
