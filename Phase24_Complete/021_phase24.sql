-- ═══════════════════════════════════════════════════════════════
-- Elite Store Phase 24 — Delivery, Payment Links, Warranty, Tasks, Alerts
-- Run AFTER 020_phase23.sql
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS deliveries (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id      UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  delivery_no    TEXT NOT NULL,
  sale_id        UUID REFERENCES sales(id),
  customer       TEXT NOT NULL,
  customer_phone TEXT,
  address        TEXT,
  pincode        TEXT,
  items          JSONB DEFAULT '[]',
  assigned_to    TEXT,
  status         TEXT DEFAULT 'pending'
                 CHECK (status IN ('pending','picked','in_transit','delivered','failed','returned')),
  scheduled_date DATE DEFAULT CURRENT_DATE,
  delivered_at   TIMESTAMPTZ,
  distance_km    NUMERIC(6,1),
  delivery_fee   NUMERIC(8,2) DEFAULT 0,
  notes          TEXT,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_del_no ON deliveries(tenant_id, delivery_no);
ALTER TABLE deliveries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "del_all" ON deliveries FOR ALL
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

CREATE TABLE IF NOT EXISTS payment_links (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id    UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  link_ref     TEXT NOT NULL,
  customer     TEXT NOT NULL,
  phone        TEXT,
  amount       NUMERIC(12,2) NOT NULL,
  purpose      TEXT,
  sale_id      UUID REFERENCES sales(id),
  upi_id       TEXT,
  status       TEXT DEFAULT 'pending' CHECK (status IN ('pending','paid','expired','cancelled')),
  expires_at   TIMESTAMPTZ,
  paid_at      TIMESTAMPTZ,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_plink_ref ON payment_links(tenant_id, link_ref);
ALTER TABLE payment_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "plink_all" ON payment_links FOR ALL
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

CREATE TABLE IF NOT EXISTS warranties (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id      UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  warranty_no    TEXT NOT NULL,
  sale_id        UUID REFERENCES sales(id),
  customer       TEXT NOT NULL,
  customer_phone TEXT,
  item_name      TEXT NOT NULL,
  item_code      TEXT,
  purchase_date  DATE DEFAULT CURRENT_DATE,
  expiry_date    DATE,
  duration_months INTEGER DEFAULT 12,
  status         TEXT DEFAULT 'active' CHECK (status IN ('active','expired','claimed','void')),
  claim_notes    TEXT,
  claimed_at     DATE,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_warranty_no ON warranties(tenant_id, warranty_no);
ALTER TABLE warranties ENABLE ROW LEVEL SECURITY;
CREATE POLICY "warranty_all" ON warranties FOR ALL
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

CREATE TABLE IF NOT EXISTS staff_tasks (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id    UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  title        TEXT NOT NULL,
  description  TEXT,
  assigned_to  TEXT,
  created_by   TEXT,
  priority     TEXT DEFAULT 'normal' CHECK (priority IN ('low','normal','high','urgent')),
  status       TEXT DEFAULT 'todo' CHECK (status IN ('todo','inprogress','review','done')),
  due_date     DATE,
  tags         TEXT[],
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_tasks_tenant ON staff_tasks(tenant_id, status, due_date);
ALTER TABLE staff_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tasks_all" ON staff_tasks FOR ALL
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

CREATE TABLE IF NOT EXISTS smart_alerts (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id    UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  type         TEXT NOT NULL CHECK (type IN ('birthday','payment_due','low_stock','anniversary','custom','emi_due','warranty_expiry')),
  title        TEXT NOT NULL,
  message      TEXT,
  ref_id       UUID,
  ref_type     TEXT,
  due_date     DATE,
  sent         BOOLEAN DEFAULT FALSE,
  sent_at      TIMESTAMPTZ,
  dismissed    BOOLEAN DEFAULT FALSE,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_alerts_tenant ON smart_alerts(tenant_id, due_date, dismissed);
ALTER TABLE smart_alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "alerts_all" ON smart_alerts FOR ALL
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());
