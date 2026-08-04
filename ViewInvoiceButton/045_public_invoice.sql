-- ═══════════════════════════════════════════════════════════════
-- 7SQ — Public invoice link (for the WhatsApp "View Invoice" button)
--
-- IMPORTANT: this does NOT add a permissive RLS policy letting the
-- public read the sales table. A blanket "anon can SELECT sales"
-- policy would let anyone query every sale across every business
-- directly through the API, not just the one invoice a link points
-- to — RLS has no concept of "only when filtered to one id".
--
-- Instead, this uses a SECURITY DEFINER function: it can only ever
-- return exactly one sale, by its exact UUID, with only the fields
-- a customer should see. No listing, no other tenant's data, ever.
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION get_public_invoice(p_sale_id UUID)
RETURNS TABLE (
  inv_num TEXT, date DATE, items JSONB, subtotal NUMERIC,
  gst_amount NUMERIC, discount NUMERIC, total NUMERIC, amount_paid NUMERIC,
  tenant_name TEXT, tenant_phone TEXT
)
SECURITY DEFINER
SET search_path = public
LANGUAGE sql
AS $$
  SELECT s.inv_num, s.date, s.items, s.subtotal, s.gst_amount, s.discount,
         s.total, s.amount_paid, t.name, t.phone
  FROM sales s
  JOIN tenants t ON t.id = s.tenant_id
  WHERE s.id = p_sale_id
  LIMIT 1;
$$;

-- Only the anon (public, unauthenticated) role may call this —
-- and only through this function, never the raw table.
GRANT EXECUTE ON FUNCTION get_public_invoice(UUID) TO anon;

-- Verify
SELECT proname FROM pg_proc WHERE proname = 'get_public_invoice';
