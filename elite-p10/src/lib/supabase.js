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
export const signOut = () => supabase.auth.signOut();
export const getSession = () => supabase.auth.getSession();

// ── Tenant helpers ─────────────────────────────────────────────
export async function getTenant(userId) {
  const { data } = await supabase.from('users').select('*, tenant:tenants(*)').eq('auth_id', userId).single();
  return data;
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
