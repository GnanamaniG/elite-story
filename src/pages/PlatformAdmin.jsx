import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

const T = {
  bg:'#0F1115', srf:'#181B22', bdr:'#2A2E38',
  red:'#C0392B', darkRed:'#8B0000', green:'#16A34A', amber:'#D97706',
  ink:'#E8EAED', sub:'#9AA0AC', muted:'#5F6673', white:'#FFFFFF'
};
const inp = { background:'#0F1115', border:`1px solid ${T.bdr}`, borderRadius:8, padding:'9px 12px', color:T.ink, fontSize:13, fontFamily:'monospace', outline:'none', width:'100%' };
const btn = (bg,color,extra={}) => ({ background:bg, color, border:'none', borderRadius:8, padding:'10px 18px', fontSize:12.5, fontWeight:700, cursor:'pointer', fontFamily:'inherit', ...extra });

/**
 * Platform-operator console. Deliberately unreachable from any
 * sidebar, hub, or Ctrl+K search — no tenant, including a tenant's
 * Owner role, is meant to ever see this exists. The real boundary
 * is enforced in the database: platform_integrations' RLS policy
 * only permits rows in platform_admins to read or write it, checked
 * here again on the client purely so the page shows a clear message
 * instead of silently failing every query.
 */
export default function PlatformAdmin({ user }) {
  const [checking, setChecking] = useState(true);
  const [isAdmin,  setIsAdmin]  = useState(false);
  const [form,     setForm]     = useState({});
  const [id,       setId]       = useState(null);
  const [loading,  setLoading]  = useState(true);
  const [saving,   setSaving]   = useState(false);
  const [saved,    setSaved]    = useState(false);
  const [reveal,   setReveal]   = useState({});

  useEffect(() => { checkAdmin(); }, [user?.email]);

  async function checkAdmin() {
    if (!user?.email) { setChecking(false); return; }
    const { data } = await supabase.from('platform_admins').select('email').eq('email', user.email).maybeSingle();
    setIsAdmin(!!data);
    setChecking(false);
    if (data) load();
  }

  async function load() {
    setLoading(true);
    const { data } = await supabase.from('platform_integrations').select('*').maybeSingle();
    if (data) { setId(data.id); setForm(data); }
    setLoading(false);
  }

  async function save() {
    setSaving(true);
    const payload = { ...form, updated_at: new Date().toISOString() };
    delete payload.id;
    try {
      if (id) {
        const { error } = await supabase.from('platform_integrations').update(payload).eq('id', id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from('platform_integrations').insert(payload).select().single();
        if (error) throw error;
        setId(data.id);
      }
      setSaved(true); setTimeout(()=>setSaved(false), 2500);
    } catch (e) { alert('Save failed: '+e.message); }
    setSaving(false);
  }

  if (checking) return (
    <div style={{ minHeight:'100vh', background:T.bg, display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div style={{ width:32, height:32, border:`3px solid ${T.red}`, borderTopColor:'transparent', borderRadius:'50%', animation:'spin .7s linear infinite' }}/>
      <style>{'@keyframes spin{to{transform:rotate(360deg)}}'}</style>
    </div>
  );

  if (!isAdmin) return (
    <div style={{ minHeight:'100vh', background:T.bg, display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:10, padding:20, textAlign:'center' }}>
      <div style={{ fontSize:36 }}>🔒</div>
      <div style={{ fontSize:15, fontWeight:700, color:T.ink }}>Not found</div>
      <div style={{ fontSize:12, color:T.muted, maxWidth:340 }}>This page doesn't exist for your account.</div>
    </div>
  );

  return (
    <div style={{ minHeight:'100vh', background:T.bg, padding:'30px 20px', fontFamily:'monospace' }}>
      <div style={{ maxWidth:640, margin:'0 auto' }}>
        <div style={{ marginBottom:22 }}>
          <div style={{ fontSize:11, color:T.amber, fontWeight:700, letterSpacing:'0.1em', marginBottom:4 }}>⚠ PLATFORM OPERATOR CONSOLE — NOT PART OF THE LICENSED PRODUCT</div>
          <div style={{ fontSize:20, fontWeight:900, color:T.ink }}>🔧 Platform Integrations</div>
          <div style={{ fontSize:12, color:T.sub, marginTop:4 }}>
            Your own operating keys — shared across every business using 7SQ, never visible to them.
            {saved && <span style={{ color:T.green, fontWeight:700, marginLeft:8 }}>✓ Saved</span>}
          </div>
        </div>

        {loading ? <div style={{ color:T.muted, fontSize:12 }}>Loading…</div> : (
          <>
            <Section title="💬 WhatsApp / Meta" T={T}>
              <Field T={T} label="Meta Access Token" secret value={form.meta_access_token} onChange={v=>setForm(f=>({...f,meta_access_token:v}))} reveal={reveal} setReveal={setReveal} k="meta_access_token"/>
              <Field T={T} label="Meta App ID" value={form.meta_app_id} onChange={v=>setForm(f=>({...f,meta_app_id:v}))}/>
              <Field T={T} label="WA Phone Number ID" value={form.wa_phone_number_id} onChange={v=>setForm(f=>({...f,wa_phone_number_id:v}))}/>
              <Field T={T} label="WA Business Account ID" value={form.wa_business_account_id} onChange={v=>setForm(f=>({...f,wa_business_account_id:v}))}/>
            </Section>

            <Section title="💳 Payments (Razorpay — collecting license fees)" T={T}>
              <Field T={T} label="Key ID" value={form.razorpay_key_id} onChange={v=>setForm(f=>({...f,razorpay_key_id:v}))}/>
              <Field T={T} label="Key Secret" secret value={form.razorpay_key_secret} onChange={v=>setForm(f=>({...f,razorpay_key_secret:v}))} reveal={reveal} setReveal={setReveal} k="razorpay_key_secret"/>
              <Field T={T} label="Webhook Secret" secret value={form.razorpay_webhook_secret} onChange={v=>setForm(f=>({...f,razorpay_webhook_secret:v}))} reveal={reveal} setReveal={setReveal} k="razorpay_webhook_secret"/>
            </Section>

            <Section title="📱 SMS (Twilio)" T={T}>
              <Field T={T} label="Account SID" value={form.twilio_account_sid} onChange={v=>setForm(f=>({...f,twilio_account_sid:v}))}/>
              <Field T={T} label="Auth Token" secret value={form.twilio_auth_token} onChange={v=>setForm(f=>({...f,twilio_auth_token:v}))} reveal={reveal} setReveal={setReveal} k="twilio_auth_token"/>
              <Field T={T} label="Phone Number" value={form.twilio_phone_number} onChange={v=>setForm(f=>({...f,twilio_phone_number:v}))}/>
            </Section>

            <Section title="✨ AI (platform-wide, separate from any client's own keys)" T={T}>
              <Field T={T} label="Anthropic API Key" secret value={form.anthropic_api_key} onChange={v=>setForm(f=>({...f,anthropic_api_key:v}))} reveal={reveal} setReveal={setReveal} k="anthropic_api_key"/>
              <Field T={T} label="OpenAI API Key" secret value={form.openai_api_key} onChange={v=>setForm(f=>({...f,openai_api_key:v}))} reveal={reveal} setReveal={setReveal} k="openai_api_key"/>
            </Section>

            <Section title="📝 Notes" T={T}>
              <textarea value={form.notes||''} onChange={e=>setForm(f=>({...f,notes:e.target.value}))} rows={3}
                style={{ ...inp, fontFamily:'inherit', resize:'vertical' }} placeholder="Anything worth remembering about these credentials — rotation dates, which client this WA number is fronting for, etc."/>
            </Section>

            <button onClick={save} disabled={saving} style={{ ...btn(T.red, T.white, { padding:'12px 26px', fontSize:13 }) }}>
              {saving?'Saving…':'💾 Save Platform Integrations'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function Section({ title, children, T }) {
  return (
    <div style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:10, padding:'16px 18px', marginBottom:14 }}>
      <div style={{ fontSize:12.5, fontWeight:700, color:T.ink, marginBottom:12 }}>{title}</div>
      {children}
    </div>
  );
}

function Field({ T, label, value, onChange, secret, reveal, setReveal, k }) {
  const shown = !secret || reveal?.[k];
  return (
    <div style={{ marginBottom:10 }}>
      <label style={{ fontSize:9.5, color:T.muted, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.05em', display:'block', marginBottom:4 }}>{label}</label>
      <div style={{ display:'flex', gap:6 }}>
        <input type={secret&&!shown?'password':'text'} value={value||''} onChange={e=>onChange(e.target.value)} style={inp}/>
        {secret && (
          <button type="button" onClick={()=>setReveal(r=>({...r,[k]:!r[k]}))}
            style={{ background:'#0F1115', border:`1px solid ${T.bdr}`, borderRadius:8, padding:'0 12px', fontSize:10.5, color:T.sub, cursor:'pointer', fontFamily:'inherit', whiteSpace:'nowrap' }}>
            {shown?'Hide':'Show'}
          </button>
        )}
      </div>
    </div>
  );
}
