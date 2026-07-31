-- ═══════════════════════════════════════════════════════════════════
-- Elite Store Phase 17 — Subscriptions, Customer App
-- Run in Supabase SQL Editor AFTER 013_phase16.sql
-- ═══════════════════════════════════════════════════════════════════

-- ── 1. SUBSCRIPTIONS / RECURRING BILLING ─────────────────────
CREATE TABLE IF NOT EXISTS subscriptions (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  customer_id     UUID REFERENCES customers(id),
  customer        TEXT NOT NULL,
  customer_phone  TEXT,
  plan_name       TEXT NOT NULL,
  description     TEXT,
  amount          NUMERIC(10,2) NOT NULL,
  frequency       TEXT NOT NULL CHECK (frequency IN ('weekly','monthly','quarterly','yearly')),
  start_date      DATE NOT NULL,
  next_due        DATE NOT NULL,
  last_paid       DATE,
  total_collected NUMERIC(12,2) DEFAULT 0,
  status          TEXT DEFAULT 'active' CHECK (status IN ('active','paused','cancelled')),
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_subs_tenant  ON subscriptions(tenant_id, next_due);
CREATE INDEX idx_subs_status  ON subscriptions(tenant_id, status);
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "subs_all" ON subscriptions FOR ALL
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- ── 2. SUBSCRIPTION PAYMENTS LOG ─────────────────────────────
CREATE TABLE IF NOT EXISTS sub_payments (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  subscription_id UUID NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
  amount          NUMERIC(10,2) NOT NULL,
  paid_date       DATE DEFAULT CURRENT_DATE,
  payment_mode    TEXT DEFAULT 'cash',
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE sub_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sub_pay_all" ON sub_payments FOR ALL
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());
