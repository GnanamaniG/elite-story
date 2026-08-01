-- ═══════════════════════════════════════════════════════════════════
-- Elite Store Phase 19 — Purchase Returns, Audit Log
-- Run in Supabase SQL Editor AFTER 015_phase18.sql
-- ═══════════════════════════════════════════════════════════════════

-- ── 1. PURCHASE RETURNS / DEBIT NOTES ────────────────────────
CREATE TABLE IF NOT EXISTS purchase_returns (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  dn_number     TEXT NOT NULL,
  purchase_id   UUID REFERENCES purchases(id),
  supplier_id   UUID REFERENCES suppliers(id),
  supplier      TEXT NOT NULL,
  supplier_phone TEXT,
  return_date   DATE DEFAULT CURRENT_DATE,
  items         JSONB DEFAULT '[]',
  total         NUMERIC(12,2) DEFAULT 0,
  reason        TEXT NOT NULL,
  status        TEXT DEFAULT 'pending'
                CHECK (status IN ('pending','acknowledged','adjusted','cancelled')),
  notes         TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);
CREATE UNIQUE INDEX idx_dn_number ON purchase_returns(tenant_id, dn_number);
CREATE INDEX idx_pr_tenant ON purchase_returns(tenant_id, return_date DESC);
ALTER TABLE purchase_returns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pr_all" ON purchase_returns FOR ALL
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- ── 2. AUDIT LOG ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS audit_log (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id     UUID REFERENCES users(id),
  user_email  TEXT,
  action      TEXT NOT NULL,     -- 'create', 'update', 'delete', 'login', 'export'
  module      TEXT NOT NULL,     -- 'sales', 'inventory', 'customers', etc.
  record_id   UUID,
  description TEXT NOT NULL,
  old_values  JSONB,
  new_values  JSONB,
  ip_address  TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_audit_tenant ON audit_log(tenant_id, created_at DESC);
CREATE INDEX idx_audit_module ON audit_log(tenant_id, module);
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "audit_all" ON audit_log FOR ALL
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- ── Helper function to log audit events ──────────────────────
-- Call from app: supabase.from('audit_log').insert({...})
-- No trigger needed — app logs manually for key actions
