-- ═══════════════════════════════════════════════════════════════════
-- Elite Store Phase 13 — Gift Cards, Feedback, Budgets
-- Run in Supabase SQL Editor AFTER 009_phase12.sql
-- ═══════════════════════════════════════════════════════════════════

-- ── 1. GIFT CARDS / VOUCHERS ──────────────────────────────────
CREATE TABLE IF NOT EXISTS gift_cards (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  code          TEXT NOT NULL,
  initial_value NUMERIC(10,2) NOT NULL,
  balance       NUMERIC(10,2) NOT NULL,
  issued_to     TEXT,          -- customer name
  issued_to_id  UUID,          -- customer_id
  issued_date   DATE DEFAULT CURRENT_DATE,
  expiry_date   DATE,
  status        TEXT DEFAULT 'active' CHECK (status IN ('active','redeemed','expired','cancelled')),
  notes         TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);
CREATE UNIQUE INDEX idx_giftcards_code ON gift_cards(tenant_id, code);
CREATE INDEX idx_giftcards_tenant ON gift_cards(tenant_id);
ALTER TABLE gift_cards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "giftcards_all" ON gift_cards FOR ALL
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- Gift card transactions (each redemption)
CREATE TABLE IF NOT EXISTS gift_card_txns (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  card_id     UUID NOT NULL REFERENCES gift_cards(id) ON DELETE CASCADE,
  sale_id     UUID REFERENCES sales(id),
  amount      NUMERIC(10,2) NOT NULL,
  balance_after NUMERIC(10,2) NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE gift_card_txns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "gctxns_all" ON gift_card_txns FOR ALL
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- ── 2. CUSTOMER FEEDBACK / RATINGS ───────────────────────────
CREATE TABLE IF NOT EXISTS feedback (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  sale_id     UUID REFERENCES sales(id),
  customer_id UUID,
  customer    TEXT,
  rating      INTEGER CHECK (rating BETWEEN 1 AND 5),
  comment     TEXT,
  channel     TEXT DEFAULT 'whatsapp',
  token       TEXT UNIQUE,     -- unique link token
  responded   BOOLEAN DEFAULT FALSE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_feedback_tenant ON feedback(tenant_id);
ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;
CREATE POLICY "feedback_all" ON feedback FOR ALL
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- ── 3. EXPENSE BUDGETS ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS budgets (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  category    TEXT NOT NULL,
  period      TEXT NOT NULL,   -- e.g. '2025-07'
  amount      NUMERIC(12,2) NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE UNIQUE INDEX idx_budgets_unique ON budgets(tenant_id, category, period);
ALTER TABLE budgets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "budgets_all" ON budgets FOR ALL
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- ── 4. WHATSAPP ORDER BOT CONFIG ──────────────────────────────
CREATE TABLE IF NOT EXISTS wa_bot_config (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id   UUID UNIQUE NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  enabled     BOOLEAN DEFAULT FALSE,
  greeting    TEXT DEFAULT 'Hi! Welcome to our store. How can I help you?',
  catalog_msg TEXT DEFAULT 'Here is our catalog:',
  order_msg   TEXT DEFAULT 'Thank you for your order! We will contact you shortly.',
  webhook_verify_token TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE wa_bot_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "wa_bot_all" ON wa_bot_config FOR ALL
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- WhatsApp orders received via bot
CREATE TABLE IF NOT EXISTS wa_orders (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  customer    TEXT,
  phone       TEXT,
  message     TEXT,
  items       JSONB DEFAULT '[]',
  total       NUMERIC(12,2) DEFAULT 0,
  status      TEXT DEFAULT 'pending' CHECK (status IN ('pending','confirmed','processing','delivered','cancelled')),
  sale_id     UUID REFERENCES sales(id),
  received_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_wa_orders_tenant ON wa_orders(tenant_id);
ALTER TABLE wa_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "wa_orders_all" ON wa_orders FOR ALL
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());
