import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

const T = {
  bg:'#F7F3F3', srf:'#FFFFFF', card:'#FFFFFF', bdr:'#E8DEDE',
  red:'#C0392B', darkRed:'#8B0000', lightRed:'#FEF2F2',
  green:'#16A34A', amber:'#D97706', blue:'#2563EB', purple:'#7C3AED',
  ink:'#111827', sub:'#6B7280', muted:'#9CA3AF', white:'#FFFFFF'
};
const btn = (bg,color,extra={}) => ({ background:bg, color, border:'none', borderRadius:9, padding:'10px 18px', fontSize:12.5, fontWeight:700, cursor:'pointer', fontFamily:'inherit', ...extra });
const inp = { background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:8, padding:'9px 12px', color:T.ink, fontSize:13, fontFamily:'inherit', outline:'none', width:'100%' };
const lbl = { fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.05em', display:'block', marginBottom:5 };

export default function MarketingIntegrations({ tenant, role='owner' }) {
  const [form, setForm] = useState({
    openai_api_key:'', meta_access_token:'', meta_app_id:'', ig_business_id:'',
    wa_phone_number_id:'', wa_business_account_id:'', wa_template_name:'', wa_template_lang:'en',
    wa_receipt_template_name:'', wa_receipt_template_lang:'en',
  });
  const [id, setId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [reveal, setReveal] = useState({});

  useEffect(() => { if (tenant?.id) load(); }, [tenant?.id]);

  async function load() {
    setLoading(true);
    const { data } = await supabase.from('marketing_integrations').select('*').eq('tenant_id', tenant.id).maybeSingle();
    if (data) { setId(data.id); setForm(f=>({ ...f, ...data })); }
    setLoading(false);
  }

  async function save() {
    setSaving(true);
    const payload = { tenant_id: tenant.id, ...form, updated_at: new Date().toISOString() };
    if (id) await supabase.from('marketing_integrations').update(payload).eq('id', id);
    else {
      const { data } = await supabase.from('marketing_integrations').insert(payload).select().single();
      if (data) setId(data.id);
    }
    setSaving(false); setSaved(true); setTimeout(()=>setSaved(false), 2500);
  }

  if (role!=='owner') return (
    <div style={{ padding:40, textAlign:'center', color:T.muted }}>Only the Owner can view or edit integration credentials.</div>
  );

  return (
    <div style={{ padding:22, background:T.bg, minHeight:'100%' }}>
      <div style={{ marginBottom:18 }}>
        <div style={{ fontSize:20, fontWeight:900, color:T.darkRed, letterSpacing:'-0.02em' }}>🔌 Integrations</div>
        <div style={{ fontSize:12, color:T.sub, marginTop:3 }}>
          Connect the paid services that power AI image generation and auto-posting
          {saved && <span style={{ color:T.green, fontWeight:700, marginLeft:8 }}>✓ Saved</span>}
        </div>
      </div>

      {/* Security warning — this is genuinely important */}
      <div style={{ background:'#FEF2F2', border:'1px solid #FECACA', borderRadius:11, padding:'13px 17px', marginBottom:18, fontSize:12, color:T.red, lineHeight:1.6 }}>
        <strong>⚠️ Security note:</strong> these keys are used directly from the browser, the same way your existing AI Assistant key works.
        Anyone who opens this site's dev tools while signed in could read them from network requests.
        That's an acceptable risk for a single-operator shop, but if this ever becomes multi-user or public-facing,
        these calls need to move behind a server function first. Don't share your login with anyone you wouldn't trust with these keys.
      </div>

      {/* OpenAI — image generation */}
      <Section title="🎨 OpenAI — Image Generation" desc="Turns your product photos + a prompt into a new campaign image">
        <Field label="OpenAI API Key" value={form.openai_api_key} onChange={v=>setForm(f=>({...f,openai_api_key:v}))}
          onReveal={()=>setReveal(r=>({...r,openai_api_key:!r.openai_api_key}))} revealed={reveal.openai_api_key}
          placeholder="sk-proj-…" secret/>
        <Guide steps={[
          'Go to platform.openai.com and sign in (or create an account)',
          'Add a payment method under Settings → Billing — image generation is pay-per-use, roughly ₹3-4 per image',
          'Go to API Keys → Create new secret key',
          'Copy it and paste above — it starts with "sk-proj-" or "sk-"',
        ]} link="https://platform.openai.com/api-keys"/>
      </Section>

      {/* Meta — shared by Instagram + WhatsApp */}
      <Section title="📘 Meta Graph API — Access Token" desc="One token powers both Instagram posting and WhatsApp sending below">
        <Field label="Meta Access Token" value={form.meta_access_token} onChange={v=>setForm(f=>({...f,meta_access_token:v}))}
          onReveal={()=>setReveal(r=>({...r,meta_access_token:!r.meta_access_token}))} revealed={reveal.meta_access_token}
          placeholder="EAAxxxxxxxxxxxx…" secret/>
        <Field label="Meta App ID" value={form.meta_app_id} onChange={v=>setForm(f=>({...f,meta_app_id:v}))} placeholder="123456789012345"/>
        <Guide steps={[
          'Go to developers.facebook.com and log in with the Facebook account tied to your business',
          'My Apps → Create App → choose "Business" as the type',
          'Add the "Instagram Graph API" and "WhatsApp" products to the app from the dashboard',
          'Under App Settings → Basic, copy the App ID',
          'Generate a long-lived access token via Graph API Explorer or System User (Business Settings → System Users)',
          'This is the step that needs Meta App Review before it works for anyone other than test accounts you have added — expect a few days to a couple of weeks for approval',
        ]} link="https://developers.facebook.com/apps"/>
      </Section>

      {/* Instagram */}
      <Section title="📷 Instagram" desc="Auto-publishes the generated image + caption to your feed">
        <Field label="Instagram Business Account ID" value={form.ig_business_id} onChange={v=>setForm(f=>({...f,ig_business_id:v}))} placeholder="17841400000000000"/>
        <Guide steps={[
          'Your Instagram must be a Business or Creator account, linked to a Facebook Page',
          'In Graph API Explorer, query GET /me/accounts to find your Page, then GET /{page-id}?fields=instagram_business_account to get this ID',
          'The access token above needs the instagram_content_publish permission — this is part of what Meta reviews',
        ]}/>
      </Section>

      {/* WhatsApp */}
      <Section title="💬 WhatsApp Business API" desc="Sends your campaign as an approved template message to your customer list">
        <Field label="Phone Number ID" value={form.wa_phone_number_id} onChange={v=>setForm(f=>({...f,wa_phone_number_id:v}))} placeholder="123456789012345"/>
        <Field label="WhatsApp Business Account ID" value={form.wa_business_account_id} onChange={v=>setForm(f=>({...f,wa_business_account_id:v}))} placeholder="123456789012345"/>
        <Field label="Approved Template Name" value={form.wa_template_name} onChange={v=>setForm(f=>({...f,wa_template_name:v}))} placeholder="e.g. promo_offer"/>
        <Field label="Template Language Code" value={form.wa_template_lang} onChange={v=>setForm(f=>({...f,wa_template_lang:v}))} placeholder="en"/>
        <Guide steps={[
          'In WhatsApp Manager (business.facebook.com/wa/manage), add and verify a phone number dedicated to this API — it cannot also be used in the regular WhatsApp app',
          'Create a Message Template under Message Templates — WhatsApp requires business-initiated messages to use a pre-approved template, you cannot send free-form text to someone who has not messaged you first',
          'Submit the template for approval — usually reviewed within 24 hours, sometimes longer',
          'Once APPROVED (not just submitted), copy its exact name and language code above',
        ]} link="https://business.facebook.com/wa/manage"/>
      </Section>

      {/* Bill/receipt template — a SEPARATE template from marketing above */}
      <Section title="🧾 Bill / Receipt Template" desc="A different template category from marketing — needed to send the itemised bill image after a sale">
        <div style={{ background:'#FFFBEB', border:'1px solid #FDE68A', borderRadius:9, padding:'11px 14px', marginBottom:14, fontSize:11.5, color:T.amber, lineHeight:1.6 }}>
          ⚠️ This must be created as a <strong>Utility</strong> template in Meta, not Marketing — a receipt is transactional,
          and using a Marketing-category template for it risks your WhatsApp number being flagged. It needs an <strong>Image header</strong>
          and a body with exactly 3 text variables, in this order: customer name, invoice number, total amount.
        </div>
        <Field label="Approved Receipt Template Name" value={form.wa_receipt_template_name} onChange={v=>setForm(f=>({...f,wa_receipt_template_name:v}))} placeholder="e.g. order_receipt"/>
        <Field label="Template Language Code" value={form.wa_receipt_template_lang} onChange={v=>setForm(f=>({...f,wa_receipt_template_lang:v}))} placeholder="en"/>
        <Guide steps={[
          'In WhatsApp Manager, create a new template and set its category to Utility (not Marketing)',
          'Add a Header component of type Image',
          'Add a Body with exactly 3 variables, e.g. "Hi {{1}}, thanks for your purchase! Invoice {{2}} — Total {{3}}. See your bill above."',
          'Submit for approval — Utility templates are usually approved faster than Marketing ones',
          'Once APPROVED, copy the exact template name and language code above',
          'Until this is set up, the Send on WhatsApp button in POS falls back to opening a manual text-only chat instead',
        ]} link="https://business.facebook.com/wa/manage"/>
      </Section>

      <button onClick={save} disabled={saving} style={{ ...btn(T.red, T.white, { padding:'13px 26px', fontSize:14 }), marginTop:6 }}>
        {saving ? 'Saving…' : '💾 Save Integration Settings'}
      </button>
    </div>
  );
}

function Section({ title, desc, children }) {
  return (
    <div style={{ background:T.white, border:`1px solid ${T.bdr}`, borderRadius:13, padding:'18px 20px', marginBottom:16, boxShadow:'0 1px 4px rgba(0,0,0,.05)' }}>
      <div style={{ fontSize:14, fontWeight:800, color:T.darkRed, marginBottom:3 }}>{title}</div>
      <div style={{ fontSize:11.5, color:T.sub, marginBottom:14 }}>{desc}</div>
      {children}
    </div>
  );
}

function Field({ label, value, onChange, placeholder, secret, onReveal, revealed }) {
  return (
    <div style={{ marginBottom:12 }}>
      <label style={lbl}>{label}</label>
      <div style={{ display:'flex', gap:7 }}>
        <input type={secret && !revealed ? 'password' : 'text'} value={value||''} onChange={e=>onChange(e.target.value)} placeholder={placeholder}
          style={{ ...inp, fontFamily: secret?'monospace':'inherit', fontSize: secret?12:13 }}/>
        {secret && (
          <button type="button" onClick={onReveal}
            style={{ background:T.bg, border:`1px solid ${T.bdr}`, borderRadius:8, padding:'0 14px', fontSize:11, color:T.sub, cursor:'pointer', fontFamily:'inherit', whiteSpace:'nowrap' }}>
            {revealed?'Hide':'Reveal'}
          </button>
        )}
      </div>
    </div>
  );
}

function Guide({ steps, link }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ marginTop:4 }}>
      <button onClick={()=>setOpen(o=>!o)} style={{ background:'none', border:'none', color:T.blue, fontSize:11.5, fontWeight:700, cursor:'pointer', fontFamily:'inherit', padding:0 }}>
        {open?'▾':'▸'} How to get this
      </button>
      {open && (
        <div style={{ background:T.bg, borderRadius:9, padding:'12px 15px', marginTop:8 }}>
          <ol style={{ margin:0, paddingLeft:18, fontSize:11.5, color:T.sub, lineHeight:1.9 }}>
            {steps.map((s,i)=><li key={i}>{s}</li>)}
          </ol>
          {link && <a href={link} target="_blank" rel="noopener noreferrer" style={{ fontSize:11, color:T.blue, fontWeight:700, textDecoration:'none' }}>Open {link.replace('https://','')} →</a>}
        </div>
      )}
    </div>
  );
}
