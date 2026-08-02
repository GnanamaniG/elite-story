import { useState, useEffect } from 'react';
import { supabase, getTenant, provisionOrLinkTenant } from '../lib/supabase';

export function useAuth() {
  const [user,    setUser]    = useState(null);
  const [tenant,  setTenant]  = useState(null);
  const [loading, setLoading] = useState(true);

  async function loadTenant(authUser) {
    if (!authUser) { setUser(null); setTenant(null); setLoading(false); return; }
    setUser(authUser);
    try {
      let profile = await getTenant(authUser.id);
      if (!profile?.tenant) {
        // First time this signed-up user has reached the app with no
        // business attached — create it now (or link a pending staff invite).
        profile = await provisionOrLinkTenant(authUser);
      }
      setTenant(profile?.tenant || null);
    } catch (e) {
      console.warn('Could not load or create tenant:', e.message);
      setTenant(null);
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
