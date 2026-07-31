-- ═══════════════════════════════════════════════════════════════════
-- Elite Store Phase 18 — Expense Claims, Credit Notes, WA Templates
-- Run in Supabase SQL Editor AFTER 014_phase17_FIXED.sql
-- ═══════════════════════════════════════════════════════════════════

-- ── 1. EXPENSE CLAIMS ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS expense_claims (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  staff_name    TEXT NOT NULL,
  title         TEXT NOT NULL,
  category      TEXT NOT NULL,
  amount        NUMERIC(10,2) NOT NULL,
  claim_date    DATE DEFAULT CURRENT_DATE,
  description   TEXT,
  receipt_url   TEXT,
  status        TEXT DEFAULT 'pending'
                CHECK (status IN ('pending','approved','rejected','paid')),
  approved_by   TEXT,
  approved_at   TIMESTAMPTZ,
  paid_at       TIMESTAMPTZ,
  notes         TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_claims_tenant ON expense_claims(tenant_id, claim_date DESC);
ALTER TABLE expense_claims ENABLE ROW LEVEL SECURITY;
CREATE POLICY "claims_all" ON expense_claims FOR ALL
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- ── 2. CREDIT NOTES ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS credit_notes (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  cn_number     TEXT NOT NULL,
  sale_id       UUID REFERENCES sales(id),
  customer_id   UUID REFERENCES customers(id),
  customer      TEXT NOT NULL,
  amount        NUMERIC(10,2) NOT NULL,
  reason        TEXT NOT NULL,
  status        TEXT DEFAULT 'open'
                CHECK (status IN ('open','applied','void')),
  applied_to    UUID REFERENCES sales(id),
  issued_date   DATE DEFAULT CURRENT_DATE,
  notes         TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);
CREATE UNIQUE INDEX idx_cn_number ON credit_notes(tenant_id, cn_number);
CREATE INDEX idx_cn_tenant ON credit_notes(tenant_id);
ALTER TABLE credit_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cn_all" ON credit_notes FOR ALL
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- ── 3. WHATSAPP TEMPLATES ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS wa_templates (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  category    TEXT NOT NULL,
  message     TEXT NOT NULL,
  variables   JSONB DEFAULT '[]',
  active      BOOLEAN DEFAULT TRUE,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_tmpl_tenant ON wa_templates(tenant_id, category);
ALTER TABLE wa_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tmpl_all" ON wa_templates FOR ALL
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());
