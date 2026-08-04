/**
 * Supabase never throws on a failed query — it resolves normally
 * with { data: null, error }. Reading only .data (as most pages in
 * this app did) means any failure — a wrong column name, an RLS
 * denial, a network hiccup — silently looks identical to "there is
 * just no data". This is what broke customer search in POS, and an
 * audit found the same pattern repeated in 83 other files.
 *
 * checkErrors() gives every page a one-line way to surface a
 * failure instead of hiding it. Usage:
 *
 *   const [invRes, custRes] = await Promise.all([...]);
 *   const err = checkErrors({ inventory: invRes, customers: custRes });
 *   if (err) setLoadError(err);   // show it on screen, don't swallow it
 *   setInventory(invRes.data || []);
 *   setCustomers(custRes.data || []);
 */
export function checkErrors(labelled) {
  const failures = Object.entries(labelled)
    .filter(([, res]) => res?.error)
    .map(([label, res]) => `${label}: ${res.error.message}`);
  if (failures.length === 0) return null;
  console.error('Query errors:', labelled);
  return failures.join(' · ');
}
