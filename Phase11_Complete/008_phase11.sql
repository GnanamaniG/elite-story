-- ═══════════════════════════════════════════════════════════════════
-- Elite Store Phase 11 — Documents, Segments, Goals
-- Run in Supabase SQL Editor AFTER 007_phase10.sql
-- ═══════════════════════════════════════════════════════════════════

-- ── 1. DOCUMENTS / ATTACHMENTS ────────────────────────────────
CREATE TABLE IF NOT EXISTS documents (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  file_path     TEXT NOT NULL,   -- Supabase Storage path
  file_type     TEXT,            -- 'image/jpeg', 'application/pdf', etc.
  file_size     INTEGER,
  related_type  TEXT,            -- 'purchase', 'expense', 'sale', 'supplier'
  related_id    UUID,
  note          TEXT,
  uploaded_by   UUID,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_docs_tenant  ON documents(tenant_id);
CREATE INDEX idx_docs_related ON documents(related_type, related_id);

ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "documents_all" ON documents FOR ALL
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- ── 2. BUSINESS GOALS ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS goals (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  metric      TEXT NOT NULL,   -- 'revenue', 'orders', 'customers', 'profit'
  period      TEXT NOT NULL,   -- '2025-07', '2025-Q3', '2025'
  target      NUMERIC(14,2) NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE UNIQUE INDEX idx_goals_unique ON goals(tenant_id, metric, period);
ALTER TABLE goals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "goals_all" ON goals FOR ALL
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- ── 3. CUSTOMER SEGMENT TAGS ──────────────────────────────────
ALTER TABLE customers ADD COLUMN IF NOT EXISTS segment     TEXT DEFAULT 'regular';
ALTER TABLE customers ADD COLUMN IF NOT EXISTS last_purchase DATE;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS total_spent NUMERIC(14,2) DEFAULT 0;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS purchase_count INTEGER DEFAULT 0;

-- ── 4. BULK IMPORT LOG ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS import_log (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  type        TEXT NOT NULL,    -- 'inventory', 'customers'
  total       INTEGER DEFAULT 0,
  imported    INTEGER DEFAULT 0,
  failed      INTEGER DEFAULT 0,
  errors      JSONB DEFAULT '[]',
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE import_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "import_log_all" ON import_log FOR ALL
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());
