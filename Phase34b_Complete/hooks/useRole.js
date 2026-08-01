import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

/**
 * Resolves the signed-in user's role for the active tenant.
 * Falls back to 'owner' when the user is the tenant creator or
 * has no staff_users row (single-user shops keep working).
 */
export function useRole(user, tenant) {
  const [role,    setRole]    = useState(null);
  const [staffRow,setStaffRow]= useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function resolve() {
      if (!user?.email || !tenant?.id) { setLoading(false); return; }
      setLoading(true);

      // Tenant owner short-circuit
      if (tenant.owner_email && tenant.owner_email === user.email) {
        if (!cancelled) { setRole('owner'); setLoading(false); }
        return;
      }

      const { data, error } = await supabase
        .from('staff_users')
        .select('*')
        .eq('tenant_id', tenant.id)
        .eq('email', user.email)
        .eq('active', true)
        .maybeSingle();

      if (cancelled) return;
      if (error || !data) {
        // No staff record — treat as owner so existing single-user setups don't lock out
        setRole('owner'); setStaffRow(null);
      } else {
        setRole(data.role || 'staff'); setStaffRow(data);
      }
      setLoading(false);
    }
    resolve();
    return () => { cancelled = true; };
  }, [user?.email, tenant?.id, tenant?.owner_email]);

  return { role, staffRow, loading };
}

export default useRole;
