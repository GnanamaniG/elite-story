-- ═══════════════════════════════════════════════════════════════════
-- Elite Store Phase 21 — Users, Marketing, Referrals, CRM, GSTR-3B
-- Run in Supabase SQL Editor AFTER 017_phase20.sql
-- ═══════════════════════════════════════════════════════════════════

-- ── 1. APP USERS & ROLES ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS app_users (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  email         TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'staff'
                CHECK (role IN ('owner','manager','staff','cashier','accountant','viewer')),
  permissions   JSONB DEFAULT '{}',
  active        BOOLEAN DEFAULT TRUE,
  last_login    TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);
CREATE UNIQUE INDEX idx_app_users_email ON app_users(tenant_id, email);
ALTER TABLE app_users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "appusers_all" ON app_users FOR ALL
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- ── 2. MARKETING CAMPAIGNS ───────────────────────────────────
CREATE TABLE IF NOT EXISTS campaigns (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  channel       TEXT NOT NULL CHECK (channel IN ('whatsapp','sms','email','social','offline')),
  type          TEXT DEFAULT 'promotion',
  target        TEXT,
  message       TEXT,
  budget        NUMERIC(10,2) DEFAULT 0,
  spent         NUMERIC(10,2) DEFAULT 0,
  reach         INTEGER DEFAULT 0,
  leads         INTEGER DEFAULT 0,
  conversions   INTEGER DEFAULT 0,
  revenue       NUMERIC(12,2) DEFAULT 0,
  start_date    DATE,
  end_date      DATE,
  status        TEXT DEFAULT 'draft' CHECK (status IN ('draft','active','paused','completed')),
  notes         TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_camp_tenant ON campaigns(tenant_id, start_date DESC);
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "camp_all" ON campaigns FOR ALL
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- ── 3. CUSTOMER REFERRALS ────────────────────────────────────
CREATE TABLE IF NOT EXISTS referrals (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  referrer_id     UUID REFERENCES customers(id),
  referrer        TEXT NOT NULL,
  referee_name    TEXT NOT NULL,
  referee_phone   TEXT,
  referee_id      UUID REFERENCES customers(id),
  ref_code        TEXT NOT NULL,
  status          TEXT DEFAULT 'pending'
                  CHECK (status IN ('pending','converted','rewarded','expired')),
  reward_type     TEXT DEFAULT 'points' CHECK (reward_type IN ('points','discount','cash')),
  reward_value    NUMERIC(10,2) DEFAULT 0,
  converted_at    TIMESTAMPTZ,
  sale_id         UUID REFERENCES sales(id),
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE UNIQUE INDEX idx_ref_code ON referrals(tenant_id, ref_code);
CREATE INDEX idx_ref_tenant ON referrals(tenant_id, created_at DESC);
ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ref_all" ON referrals FOR ALL
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- ── 4. CRM / SALES PIPELINE ──────────────────────────────────
CREATE TABLE IF NOT EXISTS crm_leads (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  phone         TEXT,
  email         TEXT,
  company       TEXT,
  source        TEXT DEFAULT 'walk-in',
  stage         TEXT DEFAULT 'new'
                CHECK (stage IN ('new','contacted','interested','proposal','negotiation','won','lost')),
  value         NUMERIC(12,2) DEFAULT 0,
  probability   INTEGER DEFAULT 50,
  assigned_to   TEXT,
  notes         TEXT,
  next_followup DATE,
  lost_reason   TEXT,
  customer_id   UUID REFERENCES customers(id),
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_leads_tenant ON crm_leads(tenant_id, stage, created_at DESC);
ALTER TABLE crm_leads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "leads_all" ON crm_leads FOR ALL
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- ── 5. GSTR-3B RECORDS ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS gstr3b_records (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  period          TEXT NOT NULL,  -- YYYY-MM
  taxable_b2b     NUMERIC(12,2) DEFAULT 0,
  cgst_b2b        NUMERIC(10,2) DEFAULT 0,
  sgst_b2b        NUMERIC(10,2) DEFAULT 0,
  igst_b2b        NUMERIC(10,2) DEFAULT 0,
  taxable_b2c     NUMERIC(12,2) DEFAULT 0,
  cgst_b2c        NUMERIC(10,2) DEFAULT 0,
  sgst_b2c        NUMERIC(10,2) DEFAULT 0,
  igst_b2c        NUMERIC(10,2) DEFAULT 0,
  itc_cgst        NUMERIC(10,2) DEFAULT 0,
  itc_sgst        NUMERIC(10,2) DEFAULT 0,
  itc_igst        NUMERIC(10,2) DEFAULT 0,
  net_cgst        NUMERIC(10,2) DEFAULT 0,
  net_sgst        NUMERIC(10,2) DEFAULT 0,
  net_igst        NUMERIC(10,2) DEFAULT 0,
  total_liability NUMERIC(10,2) DEFAULT 0,
  status          TEXT DEFAULT 'draft' CHECK (status IN ('draft','filed','revised')),
  filed_at        TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE UNIQUE INDEX idx_gstr3b_period ON gstr3b_records(tenant_id, period);
ALTER TABLE gstr3b_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "gstr3b_all" ON gstr3b_records FOR ALL
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());
