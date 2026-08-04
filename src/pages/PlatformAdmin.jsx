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
  const [tab,      setTab]      = useState('integrations'); // integrations | licenses

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

        <div style={{ display:'flex', gap:2, background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:9, padding:3, marginBottom:18, width:'fit-content' }}>
          {[['integrations','🔧 Integrations'],['licenses','📋 Clients & Licenses']].map(([id,label])=>(
            <button key={id} onClick={()=>setTab(id)}
              style={{ padding:'8px 16px', background: tab===id?T.red:'transparent', color: tab===id?'#fff':T.sub, border:'none', borderRadius:7, fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>
              {label}
            </button>
          ))}
        </div>

        {tab==='licenses' && <LicensesTab T={T}/>}

        {tab==='integrations' && (loading ? <div style={{ color:T.muted, fontSize:12 }}>Loading…</div> : (
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
        ))}
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

const LICENSE_STATUS = ['trial','active','expired','suspended','cancelled'];
const STATUS_COLOR = { trial:'#2563EB', active:'#16A34A', expired:'#C0392B', suspended:'#D97706', cancelled:'#5F6673' };

function genLicenseKey() {
  const seg = () => Math.random().toString(36).slice(2,6).toUpperCase();
  return `7SQ-${seg()}-${seg()}-${seg()}`;
}

function LicensesTab({ T }) {
  const [tenants, setTenants] = useState([]);
  const [packages, setPackages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null); // tenant id being edited
  const [draft, setDraft] = useState({});
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    // is_platform_admin() RLS lets this see EVERY tenant, not just one —
    // this is the one place in the whole app that legitimately does that.
    const [tRes, pRes] = await Promise.all([
      supabase.from('tenants').select('id,name,owner_email,license_package_id,license_key,license_status,license_start,license_expiry,license_billing,license_amount,license_notes,created_at').order('created_at',{ ascending:false }),
      supabase.from('license_packages').select('*').order('sort_order'),
    ]);
    setTenants(tRes.data||[]);
    setPackages(pRes.data||[]);
    setLoading(false);
  }

  function openEdit(t) {
    setEditing(t.id);
    setDraft({
      license_package_id: t.license_package_id||'',
      license_key: t.license_key || genLicenseKey(),
      license_status: t.license_status||'trial',
      license_start: t.license_start||new Date().toISOString().slice(0,10),
      license_expiry: t.license_expiry||'',
      license_billing: t.license_billing||'monthly',
      license_amount: t.license_amount||'',
      license_notes: t.license_notes||'',
    });
  }

  async function saveEdit(id) {
    setSaving(true);
    const { error } = await supabase.from('tenants').update({
      license_package_id: draft.license_package_id||null,
      license_key: draft.license_key||null,
      license_status: draft.license_status,
      license_start: draft.license_start||null,
      license_expiry: draft.license_expiry||null,
      license_billing: draft.license_billing,
      license_amount: parseFloat(draft.license_amount)||null,
      license_notes: draft.license_notes||null,
    }).eq('id', id);
    setSaving(false);
    if (error) { alert('Save failed: '+error.message); return; }
    setEditing(null);
    await load();
  }

  const filtered = tenants.filter(t =>
    !search || t.name?.toLowerCase().includes(search.toLowerCase()) || t.owner_email?.toLowerCase().includes(search.toLowerCase())
  );

  const counts = LICENSE_STATUS.reduce((a,s)=>({ ...a, [s]: tenants.filter(t=>t.license_status===s).length }), {});

  return (
    <div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(110px,1fr))', gap:10, marginBottom:16 }}>
        {LICENSE_STATUS.map(s=>(
          <div key={s} style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:9, padding:'11px 13px' }}>
            <div style={{ fontSize:9, color:T.muted, fontWeight:700, textTransform:'uppercase' }}>{s}</div>
            <div style={{ fontSize:19, fontWeight:900, color:STATUS_COLOR[s] }}>{counts[s]||0}</div>
          </div>
        ))}
      </div>

      <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search business name or email…"
        style={{ ...inp, marginBottom:14 }}/>

      {loading ? <div style={{ color:T.muted, fontSize:12 }}>Loading every tenant…</div> : (
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          {filtered.length===0 && <div style={{ color:T.muted, fontSize:12 }}>No businesses match.</div>}
          {filtered.map(t=>{
            const pkg = packages.find(p=>p.id===t.license_package_id);
            const isEditing = editing===t.id;
            const daysLeft = t.license_expiry ? Math.ceil((new Date(t.license_expiry)-new Date())/86400000) : null;
            return (
              <div key={t.id} style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:9, padding:'13px 16px' }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:8 }}>
                  <div>
                    <div style={{ fontSize:13.5, fontWeight:700, color:T.ink }}>{t.name||'Unnamed'}</div>
                    <div style={{ fontSize:11, color:T.muted }}>{t.owner_email||'—'}</div>
                  </div>
                  <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                    <span style={{ fontSize:11, color:T.sub }}>{pkg?.name||'No plan'}</span>
                    <span style={{ background:(STATUS_COLOR[t.license_status]||T.muted)+'22', color:STATUS_COLOR[t.license_status]||T.muted, borderRadius:20, padding:'3px 12px', fontSize:10.5, fontWeight:700 }}>
                      {t.license_status||'trial'}
                    </span>
                    {daysLeft!=null && <span style={{ fontSize:10.5, color: daysLeft<0?'#C0392B':daysLeft<=7?'#D97706':T.muted }}>{daysLeft<0?`${Math.abs(daysLeft)}d overdue`:`${daysLeft}d left`}</span>}
                    <button onClick={()=>isEditing?setEditing(null):openEdit(t)}
                      style={{ background:'transparent', border:`1px solid ${T.bdr}`, borderRadius:7, padding:'5px 12px', fontSize:11, color:T.sub, cursor:'pointer', fontFamily:'inherit' }}>
                      {isEditing?'Cancel':'Manage'}
                    </button>
                  </div>
                </div>

                {isEditing && (
                  <div style={{ marginTop:13, paddingTop:13, borderTop:`1px solid ${T.bdr}`, display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                    <div>
                      <label style={{ fontSize:9.5, color:T.muted, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:4 }}>Package</label>
                      <select value={draft.license_package_id} onChange={e=>setDraft(d=>({...d,license_package_id:e.target.value}))}
                        style={{ ...inp, fontFamily:'inherit', cursor:'pointer' }}>
                        <option value="">— none —</option>
                        {packages.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={{ fontSize:9.5, color:T.muted, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:4 }}>Status</label>
                      <select value={draft.license_status} onChange={e=>setDraft(d=>({...d,license_status:e.target.value}))}
                        style={{ ...inp, fontFamily:'inherit', cursor:'pointer' }}>
                        {LICENSE_STATUS.map(s=><option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={{ fontSize:9.5, color:T.muted, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:4 }}>Start Date</label>
                      <input type="date" value={draft.license_start} onChange={e=>setDraft(d=>({...d,license_start:e.target.value}))} style={{ ...inp, fontFamily:'inherit' }}/>
                    </div>
                    <div>
                      <label style={{ fontSize:9.5, color:T.muted, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:4 }}>Expiry Date</label>
                      <input type="date" value={draft.license_expiry} onChange={e=>setDraft(d=>({...d,license_expiry:e.target.value}))} style={{ ...inp, fontFamily:'inherit' }}/>
                    </div>
                    <div>
                      <label style={{ fontSize:9.5, color:T.muted, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:4 }}>Billing</label>
                      <select value={draft.license_billing} onChange={e=>setDraft(d=>({...d,license_billing:e.target.value}))}
                        style={{ ...inp, fontFamily:'inherit', cursor:'pointer' }}>
                        <option value="monthly">Monthly</option>
                        <option value="yearly">Yearly</option>
                      </select>
                    </div>
                    <div>
                      <label style={{ fontSize:9.5, color:T.muted, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:4 }}>Amount Charged</label>
                      <input type="number" value={draft.license_amount} onChange={e=>setDraft(d=>({...d,license_amount:e.target.value}))} style={{ ...inp, fontFamily:'inherit' }}/>
                    </div>
                    <div style={{ gridColumn:'1/-1' }}>
                      <label style={{ fontSize:9.5, color:T.muted, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:4 }}>License Key</label>
                      <div style={{ display:'flex', gap:6 }}>
                        <input value={draft.license_key} onChange={e=>setDraft(d=>({...d,license_key:e.target.value}))} style={inp}/>
                        <button type="button" onClick={()=>setDraft(d=>({...d,license_key:genLicenseKey()}))}
                          style={{ background:'#0F1115', border:`1px solid ${T.bdr}`, borderRadius:8, padding:'0 12px', fontSize:10.5, color:T.sub, cursor:'pointer', fontFamily:'inherit', whiteSpace:'nowrap' }}>Regenerate</button>
                      </div>
                    </div>
                    <div style={{ gridColumn:'1/-1' }}>
                      <label style={{ fontSize:9.5, color:T.muted, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:4 }}>Notes (internal only)</label>
                      <textarea value={draft.license_notes} onChange={e=>setDraft(d=>({...d,license_notes:e.target.value}))} rows={2} style={{ ...inp, fontFamily:'inherit', resize:'vertical' }}/>
                    </div>
                    <div style={{ gridColumn:'1/-1' }}>
                      <button onClick={()=>saveEdit(t.id)} disabled={saving} style={btn(T.red, T.white, { padding:'9px 20px', fontSize:12 })}>
                        {saving?'Saving…':'💾 Save License'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
