import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { cacheSet, cacheGet, cacheAge, queueCount, flushQueue, OFFLINE_KEYS } from '../lib/offlineStore';

/**
 * Tracks connectivity, caches billing data for offline use,
 * and flushes queued writes when the connection returns.
 */
export function useOffline(tenant) {
  const [online,   setOnline]   = useState(typeof navigator!=='undefined' ? navigator.onLine : true);
  const [pending,  setPending]  = useState(0);
  const [syncing,  setSyncing]  = useState(false);
  const [lastSync, setLastSync] = useState(null);
  const [cachedAt, setCachedAt] = useState(null);
  const syncingRef = useRef(false);

  const refreshCount = useCallback(async () => {
    setPending(await queueCount('pending'));
  }, []);

  // Pull fresh data into cache while we still have a connection
  const primeCache = useCallback(async () => {
    if (!tenant?.id || !navigator.onLine) return;
    try {
      const [inv, cust] = await Promise.all([
        supabase.from('inventory').select('id,name,code,sp,cp,gst,stock,category,barcode').eq('tenant_id',tenant.id).eq('active',true),
        supabase.from('customers').select('id,name,phone,total_spent').eq('tenant_id',tenant.id),
      ]);
      if (inv.data)  await cacheSet(OFFLINE_KEYS.inventory, inv.data);
      if (cust.data) await cacheSet(OFFLINE_KEYS.customers, cust.data);
      await cacheSet(OFFLINE_KEYS.tenant, tenant);
      setCachedAt(Date.now());
    } catch { /* cache is best-effort */ }
  }, [tenant?.id]);

  const sync = useCallback(async () => {
    if (syncingRef.current || !navigator.onLine) return null;
    syncingRef.current = true; setSyncing(true);
    const result = await flushQueue(supabase);
    setSyncing(false); syncingRef.current = false;
    setLastSync(Date.now());
    await refreshCount();
    return result;
  }, [refreshCount]);

  useEffect(() => {
    function goOnline()  { setOnline(true);  sync(); primeCache(); }
    function goOffline() { setOnline(false); }
    window.addEventListener('online',  goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online',  goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, [sync, primeCache]);

  useEffect(() => { refreshCount(); }, [refreshCount]);

  useEffect(() => {
    if (!tenant?.id) return;
    primeCache();
    cacheAge(OFFLINE_KEYS.inventory).then(setCachedAt);
    const iv = setInterval(primeCache, 10*60*1000); // refresh cache every 10 min
    return () => clearInterval(iv);
  }, [tenant?.id, primeCache]);

  // Retry pending writes periodically while online
  useEffect(() => {
    if (!online || pending===0) return;
    const iv = setInterval(sync, 30*1000);
    return () => clearInterval(iv);
  }, [online, pending, sync]);

  return { online, pending, syncing, lastSync, cachedAt, sync, primeCache, refreshCount };
}

export default useOffline;
