import { useState } from 'react';
import { updateTenantSettings } from '../lib/supabase';

const T = {
  bg:'#F7F3F3', srf:'#FFFFFF', card:'#FFFFFF', card2:'#FFF5F5',
  bdr:'#E8DEDE', bdr2:'#F0E8E8',
  red:'#C0392B', darkRed:'#8B0000', lightRed:'#FDECEA',
  green:'#16A34A', amber:'#D97706', blue:'#2563EB',
  purple:'#7C3AED', teal:'#0D9488', orange:'#EA580C',
  ink:'#111827', sub:'#6B7280', muted:'#9CA3AF',
  white:'#FFFFFF',
  sidebar:'#7B1E1E', sideHov:'#9B2C2C', sideTxt:'#FFCDD2', sideActTxt:'#7B1E1E'
};

export default function Settings({ tenant, user, onTenantUpdate }) {
  const [form,   setForm]   = useState({ ...tenant });
  const [saving, setSaving] = useState(false);
  const [saved,  setSaved]  = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const inp = { background:T.card, border:`1px solid ${T.bdr}`, borderRadius:8, padding:'9px 12px', color:T.ink, fontSize:13, fontFamily:'inherit', outline:'none', width:'100%' };
  const lbl = { fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:5, letterSpacing:'.05em' };

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true); setSaved(false);
    try {
      const updated = await updateTenantSettings(tenant.id, {
        name: form.name, phone: form.phone, email: form.email,
        gstin: form.gstin, address: form.address, state: form.state, pincode: form.pincode,
        invoice_prefix: form.invoice_prefix, financial_year: form.financial_year,
        upi_id: form.upi_id, terms: form.terms,
      });
      onTenantUpdate?.(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e) { alert('Error: ' + e.message); }
    finally { setSaving(false); }
  }

  return (
    <div style={{ padding:20, maxWidth:700 }}>
      <div style={{ fontSize:22, fontWeight:800, color:T.ink, marginBottom:20 }}>Settings</div>

      <form onSubmit={handleSave}>

        {/* Business Details */}
        <div style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:12, padding:20, marginBottom:16 }}>
          <div style={{ fontWeight:700, color:T.ink, marginBottom:16 }}>🏪 Business Details</div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
            <div style={{ gridColumn:'1/-1' }}>
              <label style={lbl}>Business Name</label>
              <input value={form.name||''} onChange={e => set('name', e.target.value)} style={inp} />
            </div>
            <div>
              <label style={lbl}>GSTIN</label>
              <input value={form.gstin||''} onChange={e => set('gstin', e.target.value.toUpperCase())} placeholder="22AAAAA0000A1Z5" maxLength={15} style={inp} />
            </div>
            <div>
              <label style={lbl}>Phone</label>
              <input value={form.phone||''} onChange={e => set('phone', e.target.value)} placeholder="+91 XXXXX XXXXX" style={inp} />
            </div>
            <div>
              <label style={lbl}>Email</label>
              <input type="email" value={form.email||''} onChange={e => set('email', e.target.value)} style={inp} />
            </div>
            <div style={{ gridColumn:'1/-1' }}>
              <label style={lbl}>Address</label>
              <input value={form.address||''} onChange={e => set('address', e.target.value)} placeholder="Full business address" style={inp} />
            </div>
            <div>
              <label style={lbl}>State</label>
              <input value={form.state||''} onChange={e => set('state', e.target.value)} placeholder="Tamil Nadu" style={inp} />
            </div>
            <div>
              <label style={lbl}>Pincode</label>
              <input value={form.pincode||''} onChange={e => set('pincode', e.target.value)} placeholder="641001" style={inp} />
            </div>
          </div>
        </div>

        {/* Invoice Settings */}
        <div style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:12, padding:20, marginBottom:16 }}>
          <div style={{ fontWeight:700, color:T.ink, marginBottom:16 }}>📄 Invoice Settings</div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:14 }}>
            <div>
              <label style={lbl}>Invoice Prefix</label>
              <input value={form.invoice_prefix||'INV'} onChange={e => set('invoice_prefix', e.target.value)} placeholder="INV" style={inp} />
            </div>
            <div>
              <label style={lbl}>Financial Year</label>
              <select value={form.financial_year||'2024-25'} onChange={e => set('financial_year', e.target.value)} style={inp}>
                {['2022-23','2023-24','2024-25','2025-26'].map(fy => <option key={fy} value={fy}>{fy} (Apr-Mar)</option>)}
              </select>
            </div>
            <div>
              <label style={lbl}>UPI ID</label>
              <input value={form.upi_id||''} onChange={e => set('upi_id', e.target.value)} placeholder="yourname@upi" style={inp} />
            </div>
          </div>
          <div style={{ marginTop:14 }}>
            <div style={{ fontSize:12, color:T.muted, background:T.card, borderRadius:8, padding:'8px 12px' }}>
              Invoice numbers will be: <strong style={{ color:T.blue }}>{form.invoice_prefix||'INV'}/{form.financial_year||'2024-25'}/0001</strong>
            </div>
          </div>
        </div>

        {/* Terms & Conditions */}
        <div style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:12, padding:20, marginBottom:16 }}>
          <div style={{ fontWeight:700, color:T.ink, marginBottom:14 }}>📋 Terms & Conditions</div>
          <textarea
            value={form.terms||''}
            onChange={e => set('terms', e.target.value)}
            rows={4}
            placeholder="Terms printed on every invoice…"
            style={{ ...inp, resize:'vertical', lineHeight:1.6 }}
          />
          <div style={{ fontSize:11, color:T.muted, marginTop:6 }}>These terms appear at the bottom of every invoice PDF</div>
        </div>

        {/* Account Info */}
        <div style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:12, padding:20, marginBottom:20 }}>
          <div style={{ fontWeight:700, color:T.ink, marginBottom:14 }}>👤 Account</div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
            {[
              ['Email', user?.email || '—'],
              ['Plan',  tenant?.plan || 'starter'],
              ['Status', tenant?.plan_status || 'active'],
              ['Subdomain', tenant?.subdomain || '—'],
            ].map(([label, val]) => (
              <div key={label} style={{ background:T.card, borderRadius:8, padding:'10px 14px' }}>
                <div style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', marginBottom:4 }}>{label}</div>
                <div style={{ fontSize:13, color:T.ink, fontWeight:600 }}>{val}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Save button */}
        <button type="submit" disabled={saving} style={{ background:saved?T.green:T.blue, color:'#fff', border:'none', borderRadius:9, padding:'13px 28px', fontSize:15, fontWeight:700, cursor:'pointer', fontFamily:'inherit', transition:'background .3s' }}>
          {saving ? 'Saving…' : saved ? '✓ Saved!' : 'Save Settings'}
        </button>
      </form>
    </div>
  );
}
