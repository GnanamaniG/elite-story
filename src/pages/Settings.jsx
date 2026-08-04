import { useState } from 'react';
import { updateTenantSettings } from '../lib/supabase';
import { RETAIL_TYPES, OTHER_TYPES, ALL_TYPES } from '../lib/businessTypes';

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

      <BusinessTypeSection tenant={tenant} onTenantUpdate={onTenantUpdate} T={T} inp={inp} lbl={lbl}/>

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

function BusinessTypeSection({ tenant, onTenantUpdate, T, inp, lbl }) {
  const existingIds = (tenant.business_types||[])
    .map(label => ALL_TYPES.find(t=>t.label===label)?.id)
    .filter(Boolean);
  const existingOther = (tenant.business_types||[])
    .filter(label => !ALL_TYPES.find(t=>t.label===label));

  const [selected,   setSelected]   = useState(existingIds);
  const [otherTypes, setOtherTypes] = useState(existingOther);
  const [showOther,  setShowOther]  = useState(false);
  const [otherText,  setOtherText]  = useState('');
  const [saving,     setSaving]     = useState(false);
  const [saved,      setSaved]      = useState(false);

  function toggle(id) { setSelected(s => s.includes(id) ? s.filter(x=>x!==id) : [...s, id]); }
  function addOther() {
    const v = otherText.trim(); if (!v) return;
    setOtherTypes(p => [...new Set([...p, v])]); setOtherText(''); setShowOther(false);
  }
  function removeOther(v) { setOtherTypes(p => p.filter(x=>x!==v)); }

  async function save() {
    setSaving(true);
    const labels = [...selected.map(id=>ALL_TYPES.find(t=>t.id===id)?.label).filter(Boolean), ...otherTypes];
    // Merge suggested categories from every selected type into whatever
    // categories already exist — union, never overwrite what's there.
    // This is what makes the selection actually visible: these show up
    // as quick-pick suggestions when adding a product in Inventory.
    const suggested = [...new Set(selected.flatMap(id => RETAIL_TYPES.concat(OTHER_TYPES).find(t=>t.id===id)?.cats || []))];
    const mergedCategories = [...new Set([...(tenant.categories||[]), ...suggested])];
    try {
      const updated = await updateTenantSettings(tenant.id, {
        business_types: labels,
        business_type: labels[0] || tenant.business_type || 'retail',
        categories: mergedCategories,
      });
      onTenantUpdate?.(updated);
      setSaved(true); setTimeout(()=>setSaved(false), 3000);
    } catch (e) { alert('Could not save: '+e.message); }
    finally { setSaving(false); }
  }

  const total = selected.length + otherTypes.length;

  return (
    <div style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:12, padding:20, marginBottom:16 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline', marginBottom:16 }}>
        <div style={{ fontWeight:700, color:T.ink }}>🏷️ Business Type</div>
        {total>0 && <span style={{ fontSize:11, color:T.red, fontWeight:700 }}>{total} selected</span>}
      </div>
      <div style={{ fontSize:12, color:T.sub, marginBottom:14 }}>What you sell or offer — used to suggest relevant categories and features. Pick as many as apply.</div>

      <div style={{ fontSize:10, color:T.muted, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:7 }}>🛍️ Retail & Commerce</div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(110px,1fr))', gap:7, maxHeight:200, overflowY:'auto', marginBottom:14, paddingRight:4 }}>
        {RETAIL_TYPES.map(t=>{
          const on = selected.includes(t.id);
          return (
            <button key={t.id} type="button" onClick={()=>toggle(t.id)}
              style={{ background:on?'#FDECEA':T.card, border:`1.5px solid ${on?T.red:T.bdr}`, borderRadius:9, padding:'8px 5px', cursor:'pointer', fontFamily:'inherit', textAlign:'center', position:'relative' }}>
              {on && <span style={{ position:'absolute', top:3, right:4, color:T.red, fontSize:11, fontWeight:900 }}>✓</span>}
              <div style={{ fontSize:16, marginBottom:2 }}>{t.icon}</div>
              <div style={{ fontSize:9, fontWeight:on?700:500, color:on?T.red:T.sub, lineHeight:1.2 }}>{t.label}</div>
            </button>
          );
        })}
      </div>

      <div style={{ fontSize:10, color:T.muted, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:7 }}>💼 Services & Other Businesses</div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(110px,1fr))', gap:7, maxHeight:160, overflowY:'auto', marginBottom:14, paddingRight:4 }}>
        {OTHER_TYPES.map(t=>{
          const on = selected.includes(t.id);
          return (
            <button key={t.id} type="button" onClick={()=>toggle(t.id)}
              style={{ background:on?'#FDECEA':T.card, border:`1.5px solid ${on?T.red:T.bdr}`, borderRadius:9, padding:'8px 5px', cursor:'pointer', fontFamily:'inherit', textAlign:'center', position:'relative' }}>
              {on && <span style={{ position:'absolute', top:3, right:4, color:T.red, fontSize:11, fontWeight:900 }}>✓</span>}
              <div style={{ fontSize:16, marginBottom:2 }}>{t.icon}</div>
              <div style={{ fontSize:9, fontWeight:on?700:500, color:on?T.red:T.sub, lineHeight:1.2 }}>{t.label}</div>
            </button>
          );
        })}
      </div>

      <div style={{ marginBottom:16 }}>
        {otherTypes.map(v=>(
          <span key={v} style={{ display:'inline-flex', alignItems:'center', gap:6, background:'#FDECEA', border:`1px solid ${T.bdr}`, borderRadius:20, padding:'5px 8px 5px 12px', fontSize:11.5, color:T.darkRed, fontWeight:600, marginRight:7, marginBottom:7 }}>
            {v}
            <button type="button" onClick={()=>removeOther(v)} style={{ background:'rgba(192,57,43,.15)', color:T.red, border:'none', borderRadius:'50%', width:16, height:16, cursor:'pointer', fontSize:11, lineHeight:1, fontFamily:'inherit' }}>×</button>
          </span>
        ))}
        {!showOther ? (
          <button type="button" onClick={()=>setShowOther(true)}
            style={{ background:T.bg, border:`1.5px dashed ${T.bdr}`, borderRadius:20, padding:'6px 14px', fontSize:11.5, color:T.sub, cursor:'pointer', fontFamily:'inherit', fontWeight:600 }}>
            + Other — type your own
          </button>
        ) : (
          <div style={{ display:'flex', gap:7 }}>
            <input value={otherText} onChange={e=>setOtherText(e.target.value)}
              onKeyDown={e=>{ if(e.key==='Enter'){ e.preventDefault(); addOther(); } }}
              placeholder="e.g. Aquarium Supplies" autoFocus style={{ ...inp, flex:1 }}/>
            <button type="button" onClick={addOther} style={{ background:T.red, color:'#fff', border:'none', borderRadius:8, padding:'9px 16px', fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>Add</button>
            <button type="button" onClick={()=>{ setShowOther(false); setOtherText(''); }} style={{ background:T.bg, color:T.sub, border:`1px solid ${T.bdr}`, borderRadius:8, padding:'9px 12px', fontSize:12, cursor:'pointer', fontFamily:'inherit' }}>Cancel</button>
          </div>
        )}
      </div>

      {selected.length>0 && (() => {
        const preview = [...new Set(selected.flatMap(id => RETAIL_TYPES.concat(OTHER_TYPES).find(t=>t.id===id)?.cats || []))]
          .filter(cc => !(tenant.categories||[]).includes(cc));
        return preview.length>0 ? (
          <div style={{ background:T.card2||'#FFF5F5', border:`1px solid ${T.bdr}`, borderRadius:9, padding:'10px 14px', marginBottom:14, fontSize:11.5, color:T.sub }}>
            <strong style={{ color:T.darkRed }}>Saving will add these product categories:</strong> {preview.join(', ')}
            <div style={{ fontSize:10, color:T.muted, marginTop:3 }}>They'll show up as quick-pick suggestions when adding a product under Inventory → Products.</div>
          </div>
        ) : null;
      })()}

      <button type="button" onClick={save} disabled={saving}
        style={{ background:saved?T.green:T.red, color:'#fff', border:'none', borderRadius:8, padding:'10px 20px', fontSize:12.5, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>
        {saving?'Saving…':saved?'✓ Saved':'Save Business Type'}
      </button>
    </div>
  );
}
