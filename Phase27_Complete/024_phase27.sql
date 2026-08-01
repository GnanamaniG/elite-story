-- ═══════════════════════════════════════════════════════════════
-- 7SQ Phase 27 — Win-Back, Recurring Orders, Price History,
--                 Supplier Scorecard, Health Score
-- Run AFTER 023_phase26.sql
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS winback_campaigns (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id      UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name           TEXT NOT NULL,
  lapse_days     INTEGER DEFAULT 60,
  offer_type     TEXT DEFAULT 'percent' CHECK (offer_type IN ('percent','fixed','free_item','none')),
  offer_value    NUMERIC(10,2) DEFAULT 0,
  message_template TEXT,
  targeted_count INTEGER DEFAULT 0,
  sent_count     INTEGER DEFAULT 0,
  returned_count INTEGER DEFAULT 0,
  status         TEXT DEFAULT 'draft' CHECK (status IN ('draft','active','completed','paused')),
  created_at     TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE winback_campaigns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "wb_all" ON winback_campaigns FOR ALL
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

CREATE TABLE IF NOT EXISTS winback_targets (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id    UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  campaign_id  UUID REFERENCES winback_campaigns(id) ON DELETE CASCADE,
  customer_id  UUID REFERENCES customers(id),
  customer     TEXT NOT NULL,
  phone        TEXT,
  last_order   DATE,
  days_lapsed  INTEGER,
  lifetime_val NUMERIC(12,2) DEFAULT 0,
  sent         BOOLEAN DEFAULT FALSE,
  sent_at      TIMESTAMPTZ,
  returned     BOOLEAN DEFAULT FALSE,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_wbt_camp ON winback_targets(tenant_id, campaign_id);
ALTER TABLE winback_targets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "wbt_all" ON winback_targets FOR ALL
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

CREATE TABLE IF NOT EXISTS recurring_orders (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id      UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  order_ref      TEXT NOT NULL,
  customer       TEXT NOT NULL,
  customer_id    UUID REFERENCES customers(id),
  phone          TEXT,
  items          JSONB DEFAULT '[]',
  amount         NUMERIC(12,2) DEFAULT 0,
  frequency      TEXT DEFAULT 'monthly'
                 CHECK (frequency IN ('weekly','biweekly','monthly','quarterly')),
  next_date      DATE NOT NULL,
  last_fulfilled DATE,
  fulfilled_count INTEGER DEFAULT 0,
  status         TEXT DEFAULT 'active' CHECK (status IN ('active','paused','cancelled')),
  notes          TEXT,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_recur_ref ON recurring_orders(tenant_id, order_ref);
CREATE INDEX IF NOT EXISTS idx_recur_next ON recurring_orders(tenant_id, next_date, status);
ALTER TABLE recurring_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "recur_all" ON recurring_orders FOR ALL
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

CREATE TABLE IF NOT EXISTS price_history (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id    UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  item_id      UUID REFERENCES inventory(id) ON DELETE CASCADE,
  item_name    TEXT NOT NULL,
  old_cp       NUMERIC(10,2),
  new_cp       NUMERIC(10,2),
  old_sp       NUMERIC(10,2),
  new_sp       NUMERIC(10,2),
  change_pct   NUMERIC(6,2),
  reason       TEXT,
  changed_by   TEXT,
  changed_at   TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ph_item ON price_history(tenant_id, item_id, changed_at DESC);
ALTER TABLE price_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ph_all" ON price_history FOR ALL
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

CREATE TABLE IF NOT EXISTS supplier_scores (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  supplier_id     UUID REFERENCES suppliers(id) ON DELETE CASCADE,
  supplier_name   TEXT NOT NULL,
  period          TEXT NOT NULL,
  delivery_score  INTEGER CHECK (delivery_score BETWEEN 1 AND 5),
  quality_score   INTEGER CHECK (quality_score  BETWEEN 1 AND 5),
  pricing_score   INTEGER CHECK (pricing_score  BETWEEN 1 AND 5),
  service_score   INTEGER CHECK (service_score  BETWEEN 1 AND 5),
  overall_score   NUMERIC(3,2),
  orders_count    INTEGER DEFAULT 0,
  total_value     NUMERIC(14,2) DEFAULT 0,
  late_deliveries INTEGER DEFAULT 0,
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_ss_period ON supplier_scores(tenant_id, supplier_name, period);
ALTER TABLE supplier_scores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ss_all" ON supplier_scores FOR ALL
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());
