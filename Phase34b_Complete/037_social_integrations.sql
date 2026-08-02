-- ═══════════════════════════════════════════════════════════════
-- 7SQ — Real image generation + Instagram/WhatsApp auto-posting
-- Stores per-tenant credentials for OpenAI, Meta Graph API, and
-- WhatsApp Cloud API. Creates a public storage bucket for the
-- generated images (Instagram's API requires a public image URL,
-- it cannot accept an uploaded file directly).
-- Additive only. Safe to re-run.
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS marketing_integrations (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id         UUID NOT NULL UNIQUE REFERENCES tenants(id) ON DELETE CASCADE,

  -- OpenAI (image generation)
  openai_api_key    TEXT,

  -- Meta Graph API (shared by Instagram + WhatsApp — one access token)
  meta_access_token TEXT,
  meta_app_id       TEXT,

  -- Instagram
  ig_business_id    TEXT,             -- Instagram Business Account ID

  -- WhatsApp Cloud API
  wa_phone_number_id     TEXT,
  wa_business_account_id TEXT,
  wa_template_name       TEXT,        -- must already be APPROVED in Meta Business Manager
  wa_template_lang       TEXT DEFAULT 'en',

  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE marketing_integrations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "mi_all" ON marketing_integrations;
CREATE POLICY "mi_all" ON marketing_integrations FOR ALL
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- Public bucket for AI-generated campaign images.
-- Instagram's Graph API requires a public image_url — it cannot
-- accept a raw file upload — so this must be publicly readable.
INSERT INTO storage.buckets (id, name, public)
VALUES ('campaign-images', 'campaign-images', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "campaign_images_read" ON storage.objects;
CREATE POLICY "campaign_images_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'campaign-images');

DROP POLICY IF EXISTS "campaign_images_write" ON storage.objects;
CREATE POLICY "campaign_images_write" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'campaign-images' AND auth.role() = 'authenticated');

-- Track what was actually posted where, and the result
CREATE TABLE IF NOT EXISTS campaign_posts (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id    UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  campaign_id  UUID REFERENCES campaigns(id),
  channel      TEXT NOT NULL CHECK (channel IN ('instagram','whatsapp')),
  image_url    TEXT,
  caption      TEXT,
  status       TEXT DEFAULT 'pending' CHECK (status IN ('pending','sent','failed')),
  recipients_total   INTEGER DEFAULT 0,
  recipients_sent    INTEGER DEFAULT 0,
  recipients_failed  INTEGER DEFAULT 0,
  external_id  TEXT,          -- Instagram media ID / WhatsApp message ID
  error        TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE campaign_posts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "cp_all" ON campaign_posts;
CREATE POLICY "cp_all" ON campaign_posts FOR ALL
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

SELECT 'marketing_integrations' AS tbl, COUNT(*) AS cols
FROM information_schema.columns WHERE table_name='marketing_integrations'
UNION ALL
SELECT 'campaign_posts', COUNT(*) FROM information_schema.columns WHERE table_name='campaign_posts'
UNION ALL
SELECT 'storage bucket exists', (SELECT COUNT(*) FROM storage.buckets WHERE id='campaign-images');
