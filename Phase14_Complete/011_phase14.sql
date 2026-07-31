-- ═══════════════════════════════════════════════════════════════════
-- Elite Store Phase 14 — Appointments, Year Close, Auto Reports
-- Run in Supabase SQL Editor AFTER 010_phase13.sql
-- ═══════════════════════════════════════════════════════════════════

-- ── 1. APPOINTMENTS ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS appointments (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  branch_id     UUID REFERENCES branches(id),
  customer      TEXT NOT NULL,
  customer_id   UUID,
  customer_phone TEXT,
  service       TEXT,
  date          DATE NOT NULL,
  time_slot     TIME NOT NULL,
  duration_mins INTEGER DEFAULT 30,
  staff         TEXT,
  status        TEXT DEFAULT 'confirmed' CHECK (status IN ('pending','confirmed','completed','cancelled','no_show')),
  notes         TEXT,
  reminder_sent BOOLEAN DEFAULT FALSE,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_appts_tenant ON appointments(tenant_id, date DESC);
CREATE INDEX idx_appts_date   ON appointments(tenant_id, date);
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "appts_all" ON appointments FOR ALL
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());
CREATE TRIGGER trg_appts_ts BEFORE UPDATE ON appointments
  FOR EACH ROW EXECUTE FUNCTION _set_updated_at();

-- ── 2. FINANCIAL YEAR CLOSE LOG ───────────────────────────────
CREATE TABLE IF NOT EXISTS year_close_log (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  financial_year TEXT NOT NULL,    -- e.g. '2024-25'
  closed_at     TIMESTAMPTZ DEFAULT NOW(),
  closed_by     UUID,
  revenue       NUMERIC(14,2) DEFAULT 0,
  expenses      NUMERIC(14,2) DEFAULT 0,
  profit        NUMERIC(14,2) DEFAULT 0,
  gst_collected NUMERIC(14,2) DEFAULT 0,
  total_orders  INTEGER DEFAULT 0,
  notes         TEXT,
  report_url    TEXT
);
CREATE UNIQUE INDEX idx_ycl_year ON year_close_log(tenant_id, financial_year);
ALTER TABLE year_close_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ycl_all" ON year_close_log FOR ALL
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- ── 3. AUTOMATED REPORT CONFIG ────────────────────────────────
CREATE TABLE IF NOT EXISTS auto_report_config (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id   UUID UNIQUE NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  enabled     BOOLEAN DEFAULT FALSE,
  frequency   TEXT DEFAULT 'daily' CHECK (frequency IN ('daily','weekly','monthly')),
  send_time   TIME DEFAULT '08:00:00',
  send_day    INTEGER DEFAULT 1,  -- day of week for weekly (1=Mon), day of month for monthly
  email       TEXT,
  include_revenue   BOOLEAN DEFAULT TRUE,
  include_inventory BOOLEAN DEFAULT TRUE,
  include_expenses  BOOLEAN DEFAULT TRUE,
  include_customers BOOLEAN DEFAULT FALSE,
  last_sent   TIMESTAMPTZ,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE auto_report_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "arc_all" ON auto_report_config FOR ALL
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- ── 4. SERVICE TYPES for Appointments ─────────────────────────
CREATE TABLE IF NOT EXISTS service_types (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  duration    INTEGER DEFAULT 30,
  price       NUMERIC(10,2) DEFAULT 0,
  color       TEXT DEFAULT '#4f7cff',
  active      BOOLEAN DEFAULT TRUE
);
ALTER TABLE service_types ENABLE ROW LEVEL SECURITY;
CREATE POLICY "st_all" ON service_types FOR ALL
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- Seed default services
INSERT INTO service_types (tenant_id, name, duration, price, color)
SELECT id, 'Shoe Repair Consultation', 15, 0, '#4f7cff' FROM tenants WHERE EXISTS (SELECT 1 FROM tenants)
ON CONFLICT DO NOTHING;
