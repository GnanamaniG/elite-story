-- ═══════════════════════════════════════════════════════════════════
-- Elite Store Phase 16 — Leave, SMS, Vendor Portal, Service Bays
-- Run in Supabase SQL Editor AFTER 012_phase15.sql
-- ═══════════════════════════════════════════════════════════════════

-- ── 1. LEAVE REQUESTS ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS leave_requests (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  staff_name    TEXT NOT NULL,
  staff_id      UUID REFERENCES users(id),
  leave_type    TEXT NOT NULL CHECK (leave_type IN ('sick','casual','earned','holiday','unpaid')),
  from_date     DATE NOT NULL,
  to_date       DATE NOT NULL,
  days          NUMERIC(4,1) DEFAULT 1,
  reason        TEXT,
  status        TEXT DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  approved_by   TEXT,
  approved_at   TIMESTAMPTZ,
  notes         TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_leaves_tenant ON leave_requests(tenant_id, from_date DESC);
ALTER TABLE leave_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "leaves_all" ON leave_requests FOR ALL
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- Leave balances per staff per year
CREATE TABLE IF NOT EXISTS leave_balances (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  staff_name  TEXT NOT NULL,
  year        INTEGER NOT NULL,
  casual_total    INTEGER DEFAULT 12,
  casual_used     INTEGER DEFAULT 0,
  sick_total      INTEGER DEFAULT 12,
  sick_used       INTEGER DEFAULT 0,
  earned_total    INTEGER DEFAULT 15,
  earned_used     INTEGER DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE UNIQUE INDEX idx_lb_unique ON leave_balances(tenant_id, staff_name, year);
ALTER TABLE leave_balances ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lb_all" ON leave_balances FOR ALL
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- ── 2. SMS LOG ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sms_log (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  phone       TEXT NOT NULL,
  message     TEXT NOT NULL,
  type        TEXT,               -- 'order','appointment','payment','promo'
  status      TEXT DEFAULT 'sent',
  provider    TEXT DEFAULT 'whatsapp',
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_sms_tenant ON sms_log(tenant_id, created_at DESC);
ALTER TABLE sms_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sms_all" ON sms_log FOR ALL
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- ── 3. VENDOR PORTAL TOKENS ───────────────────────────────────
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS portal_token TEXT;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS portal_enabled BOOLEAN DEFAULT FALSE;
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS vendor_status TEXT DEFAULT 'pending'
  CHECK (vendor_status IN ('pending','acknowledged','dispatched','delivered'));
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS vendor_note TEXT;
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS dispatched_at TIMESTAMPTZ;

-- ── 4. SERVICE BAYS / ORDER QUEUE ────────────────────────────
CREATE TABLE IF NOT EXISTS service_bays (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  type        TEXT DEFAULT 'bay',   -- 'bay','table','counter','fitting_room'
  capacity    INTEGER DEFAULT 1,
  status      TEXT DEFAULT 'empty', -- 'empty','occupied','reserved'
  current_order UUID,
  active      BOOLEAN DEFAULT TRUE
);
CREATE INDEX idx_bays_tenant ON service_bays(tenant_id);
ALTER TABLE service_bays ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bays_all" ON service_bays FOR ALL
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

CREATE TABLE IF NOT EXISTS service_orders (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  bay_id      UUID REFERENCES service_bays(id),
  bay_name    TEXT,
  customer    TEXT,
  items       JSONB DEFAULT '[]',
  total       NUMERIC(12,2) DEFAULT 0,
  status      TEXT DEFAULT 'new' CHECK (status IN ('new','in_progress','ready','completed','cancelled')),
  notes       TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_so_tenant ON service_orders(tenant_id, created_at DESC);
ALTER TABLE service_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "so_all" ON service_orders FOR ALL
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());
