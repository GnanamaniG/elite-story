import { useState, useEffect } from 'react';
import { supabase, getTenant } from '../lib/supabase';

export function useAuth() {
  const [user,    setUser]    = useState(null);
  const [tenant,  setTenant]  = useState(null);
  const [loading, setLoading] = useState(true);

  async function loadTenant(authUser) {
    if (!authUser) { setUser(null); setTenant(null); setLoading(false); return; }
    setUser(authUser);
    try {
      const profile = await getTenant(authUser.id);
      setTenant(profile?.tenant || null);
    } catch (e) {
      console.warn('No tenant profile yet:', e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => loadTenant(session?.user));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      loadTenant(session?.user);
    });
    return () => subscription.unsubscribe();
  }, []);

  return { user, tenant, loading, isLoggedIn: !!user };
}
