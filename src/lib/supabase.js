import { createClient } from '@supabase/supabase-js';

const URL = import.meta.env.VITE_SUPABASE_URL;
const KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(URL, KEY, {
  auth: { autoRefreshToken: true, persistSession: true },
  realtime: { params: { eventsPerSecond: 10 } },
});

// ── Auth ───────────────────────────────────────────────────────
export const signIn  = (email, pass) => supabase.auth.signInWithPassword({ email, password: pass });
export const signUp  = (email, pass, meta) => supabase.auth.signUp({ email, password: pass, options: { data: meta } });

// ── Phone / OTP auth ──────────────────────────────────────────
// Normalises an Indian mobile to E.164 (+91XXXXXXXXXX)
export function normalisePhone(raw) {
  const d = String(raw||'').replace(/\D/g, '');
  if (d.length === 10) return '+91' + d;
  if (d.length === 11 && d.startsWith('0')) return '+91' + d.slice(1);
  if (d.length === 12 && d.startsWith('91')) return '+' + d;
  if (String(raw).trim().startsWith('+')) return '+' + d;
  return '+91' + d.slice(-10);
}

export function isValidPhone(raw) {
  const d = String(raw||'').replace(/\D/g, '');
  return d.length >= 10 && d.length <= 13;
}

/** Send a login OTP. shouldCreateUser=false blocks sign-up on the sign-in tab. */
export const sendOtp = (phone, shouldCreateUser = false, meta = null) =>
  supabase.auth.signInWithOtp({
    phone: normalisePhone(phone),
    options: { shouldCreateUser, ...(meta ? { data: meta } : {}) },
  });

/** Verify the 6-digit code the user received. */
export const verifyOtp = (phone, token) =>
  supabase.auth.verifyOtp({ phone: normalisePhone(phone), token, type: 'sms' });
export const signOut = () => supabase.auth.signOut();
export const getSession = () => supabase.auth.getSession();

// ── Tenant helpers ─────────────────────────────────────────────
export async function getTenant(userId) {
  const { data } = await supabase.from('users').select('*, tenant:tenants(*)').eq('auth_id', userId).maybeSingle();
  return data;
}

/**
 * Runs once, the first time a signed-up user reaches the app with no
 * business attached yet. Handles two cases:
 *  1. An invited staff member — a `users` row was already created (by
 *     Team → Invite) with their email but auth_id still NULL. Link it.
 *  2. A brand-new business owner — nobody has a users row for this
 *     email. Create the tenant and the owner's users row together.
 * Without this, signUp() alone never creates a business at all — it
 * only creates the auth account.
 */
export async function provisionOrLinkTenant(authUser) {
  const { data: pending } = await supabase.from('users')
    .select('*, tenant:tenants(*)')
    .eq('email', authUser.email)
    .is('auth_id', null)
    .maybeSingle();

  if (pending) {
    const { error } = await supabase.from('users').update({ auth_id: authUser.id }).eq('id', pending.id);
    if (error) throw error;
    return { ...pending, auth_id: authUser.id };
  }

  const meta = authUser.user_metadata || {};
  const { data: newTenant, error: tErr } = await supabase.from('tenants').insert({
    name: meta.biz_name || 'My Business',
    owner_email: authUser.email,
    business_type: meta.biz_type || 'retail',
    onboarded: false,
  }).select().single();
  if (tErr) throw tErr;

  const { data: newUserRow, error: uErr } = await supabase.from('users').insert({
    tenant_id: newTenant.id, auth_id: authUser.id,
    name: meta.biz_name || authUser.email, email: authUser.email,
    role: 'owner', active: true,
  }).select().single();
  if (uErr) throw uErr;

  return { ...newUserRow, tenant: newTenant };
}

export async function updateTenantSettings(tenantId, updates) {
  const { data, error } = await supabase.from('tenants').update(updates).eq('id', tenantId).select().single();
  if (error) throw error;
  return data;
}

// ── Sales ──────────────────────────────────────────────────────
export async function saveSale(sale) {
  const { data, error } = await supabase.from('sales').insert(sale).select().single();
  if (error) throw error;
  return data;
}

export async function getSales(tenantId, limit = 100) {
  const { data, error } = await supabase.from('sales').select('*')
    .eq('tenant_id', tenantId).order('created_at', { ascending: false }).limit(limit);
  if (error) throw error;
  return data || [];
}

// ── Inventory ──────────────────────────────────────────────────
export async function getInventory(tenantId) {
  const { data, error } = await supabase.from('inventory').select('*')
    .eq('tenant_id', tenantId).eq('active', true).order('name');
  if (error) throw error;
  return data || [];
}

export async function saveItem(item) {
  const { data, error } = item.id
    ? await supabase.from('inventory').update(item).eq('id', item.id).select().single()
    : await supabase.from('inventory').insert(item).select().single();
  if (error) throw error;
  return data;
}

export async function updateStock(itemId, newStock) {
  const { error } = await supabase.from('inventory').update({ stock: newStock }).eq('id', itemId);
  if (error) throw error;
}

export async function deleteItem(itemId) {
  const { error } = await supabase.from('inventory').update({ active: false }).eq('id', itemId);
  if (error) throw error;
}

// ── Customers ──────────────────────────────────────────────────
export async function getCustomers(tenantId) {
  const { data, error } = await supabase.from('customers').select('*')
    .eq('tenant_id', tenantId).order('name');
  if (error) throw error;
  return data || [];
}

export async function saveCustomer(customer) {
  const { data, error } = customer.id
    ? await supabase.from('customers').update(customer).eq('id', customer.id).select().single()
    : await supabase.from('customers').insert(customer).select().single();
  if (error) throw error;
  return data;
}

export async function updateOutstanding(customerId, amount) {
  const { data: cust } = await supabase.from('customers').select('outstanding').eq('id', customerId).single();
  const newOutstanding = (cust?.outstanding || 0) + amount;
  await supabase.from('customers').update({ outstanding: newOutstanding }).eq('id', customerId);
}

// ── Expenses ───────────────────────────────────────────────────
export async function getExpenses(tenantId) {
  const { data, error } = await supabase.from('expenses').select('*')
    .eq('tenant_id', tenantId).order('date', { ascending: false }).limit(200);
  if (error) throw error;
  return data || [];
}

export async function saveExpense(expense) {
  const { data, error } = await supabase.from('expenses').insert(expense).select().single();
  if (error) throw error;
  return data;
}

// ── Purchases ──────────────────────────────────────────────────
export async function getPurchases(tenantId) {
  const { data, error } = await supabase.from('purchases').select('*')
    .eq('tenant_id', tenantId).order('date', { ascending: false }).limit(100);
  if (error) throw error;
  return data || [];
}

export async function savePurchase(purchase) {
  const { data, error } = await supabase.from('purchases').insert(purchase).select().single();
  if (error) throw error;
  return data;
}

// ── Real-time subscription ─────────────────────────────────────
export function subscribeToTable(tenantId, table, callback) {
  return supabase.channel(`${table}:${tenantId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table, filter: `tenant_id=eq.${tenantId}` }, callback)
    .subscribe();
}
