-- ═══════════════════════════════════════════════════════════════════
-- Elite Store Phase 23 — EOD, Scheduler, RFQ, Loyalty Tiers
-- Run in Supabase SQL Editor AFTER 019_phase22.sql
-- ═══════════════════════════════════════════════════════════════════

-- ── 1. EOD REPORTS ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS eod_reports (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  report_date     DATE NOT NULL DEFAULT CURRENT_DATE,
  opening_cash    NUMERIC(12,2) DEFAULT 0,
  cash_sales      NUMERIC(12,2) DEFAULT 0,
  upi_sales       NUMERIC(12,2) DEFAULT 0,
  card_sales      NUMERIC(12,2) DEFAULT 0,
  credit_sales    NUMERIC(12,2) DEFAULT 0,
  total_revenue   NUMERIC(12,2) DEFAULT 0,
  total_orders    INTEGER DEFAULT 0,
  cash_in_hand    NUMERIC(12,2) DEFAULT 0,
  cash_expected   NUMERIC(12,2) DEFAULT 0,
  difference      NUMERIC(10,2) DEFAULT 0,
  expenses        NUMERIC(12,2) DEFAULT 0,
  refunds         NUMERIC(10,2) DEFAULT 0,
  notes           TEXT,
  closed_by       TEXT,
  status          TEXT DEFAULT 'open' CHECK (status IN ('open','closed')),
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_eod_date ON eod_reports(tenant_id, report_date);
ALTER TABLE eod_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "eod_all" ON eod_reports FOR ALL
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- ── 2. STAFF SCHEDULES ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS staff_schedules (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  staff_name  TEXT NOT NULL,
  week_start  DATE NOT NULL,
  shifts      JSONB DEFAULT '{}',   -- {"Mon":"09:00-18:00","Tue":"off",...}
  notes       TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_sched_week ON staff_schedules(tenant_id, staff_name, week_start);
ALTER TABLE staff_schedules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sched_all" ON staff_schedules FOR ALL
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- ── 3. SUPPLIER RFQ ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS rfq_requests (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  rfq_number    TEXT NOT NULL,
  supplier_id   UUID REFERENCES suppliers(id),
  supplier      TEXT NOT NULL,
  supplier_phone TEXT,
  items         JSONB DEFAULT '[]',
  deadline      DATE,
  status        TEXT DEFAULT 'sent' CHECK (status IN ('draft','sent','responded','accepted','rejected')),
  quoted_total  NUMERIC(12,2),
  notes         TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_rfq_number ON rfq_requests(tenant_id, rfq_number);
ALTER TABLE rfq_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rfq_all" ON rfq_requests FOR ALL
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- ── 4. LOYALTY TIERS ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS loyalty_tiers (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  min_spend     NUMERIC(12,2) DEFAULT 0,
  max_spend     NUMERIC(12,2),
  color         TEXT DEFAULT '#4f7cff',
  icon          TEXT DEFAULT '⭐',
  earn_rate     NUMERIC(5,2) DEFAULT 1,   -- pts per Rs.100 spent
  redeem_value  NUMERIC(5,2) DEFAULT 0.5, -- Rs. value per point
  benefits      JSONB DEFAULT '[]',
  created_at    TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_tiers_tenant ON loyalty_tiers(tenant_id, min_spend);
ALTER TABLE loyalty_tiers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tiers_all" ON loyalty_tiers FOR ALL
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());
