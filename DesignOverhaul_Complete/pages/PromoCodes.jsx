import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

const T = {
  bg:'#060710', srf:'#0b0d1a', card:'#0f1220', card2:'#141828',
  bdr:'#1a1e32', bdr2:'#222740',
  blue:'#4f7cff', green:'#00d68f', red:'#ff4d6a', amber:'#ffb547',
  purple:'#9b72ff', teal:'#00c9b1', orange:'#ff7043', gold:'#ffc107',
  cyan:'#00d4ff', pink:'#f06292',
  muted:'#4a5175', dim:'#2a3050', card3:'#181d2e',
  ink:'#eef0f8', sub:'#8892b0'
};
const fmt = n => 'Rs.' + (n||0).toLocaleString('en-IN', { maximumFractionDigits:0 });

function genCode() { return ['SAVE','DEAL','OFF','VIP','ELITE'][Math.floor(Math.random()*5)] + Math.floor(10+Math.random()*90); }

export function validatePromoCode(code, total, codes) {
  if (!code) return null;
  const promo = codes.find(p => p.code.toUpperCase() === code.toUpperCase() && p.active);
  if (!promo) return { valid:false, error:'Invalid promo code' };
  if (promo.valid_until && new Date(promo.valid_until) < new Date()) return { valid:false, error:'Promo code expired' };
  if (promo.valid_from && new Date(promo.valid_from) > new Date()) return { valid:false, error:'Promo code not yet active' };
  if (promo.min_order && total < promo.min_order) return { valid:false, error:`Min order ${fmt(promo.min_order)} required` };
  if (promo.uses_limit && promo.uses_count >= promo.uses_limit) return { valid:false, error:'Promo code usage limit reached' };
  let discount = promo.type==='percent' ? total * promo.value/100 : promo.value;
  if (promo.max_discount) discount = Math.min(discount, promo.max_discount);
  return { valid:true, promo, discount: Math.round(discount*100)/100 };
}

export default function PromoCodes({ tenant }) {
  const [codes,    setCodes]    = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form,     setForm]     = useState({ code:genCode(), type:'percent', value:10, description:'', min_order:0, max_discount:'', uses_limit:'', valid_from:new Date().toISOString().slice(0,10), valid_until:'' });
  const [saving,   setSaving]   = useState(false);
  const [filter,   setFilter]   = useState('active');

  useEffect(() => { if (tenant?.id) load(); }, [tenant?.id]);

  async function load() {
    setLoading(true);
    const { data } = await supabase.from('promo_codes').select('*').eq('tenant_id', tenant.id).order('created_at', { ascending:false });
    setCodes(data||[]);
    setLoading(false);
  }

  async function saveCode(e) {
    e.preventDefault();
    if (!form.code.trim()) return;
    setSaving(true);
    try {
      await supabase.from('promo_codes').insert({ ...form, tenant_id:tenant.id, code:form.code.toUpperCase(), max_discount:form.max_discount||null, uses_limit:form.uses_limit||null, valid_until:form.valid_until||null });
      setShowForm(false); setForm({ code:genCode(), type:'percent', value:10, description:'', min_order:0, max_discount:'', uses_limit:'', valid_from:new Date().toISOString().slice(0,10), valid_until:'' });
      await load();
    } catch(e) { alert('Error: '+e.message); }
    finally { setSaving(false); }
  }

  async function toggleActive(id, active) {
    await supabase.from('promo_codes').update({ active }).eq('id', id);
    setCodes(prev=>prev.map(c=>c.id===id?{...c,active}:c));
  }

  async function deleteCode(id) {
    if (!confirm('Delete this promo code?')) return;
    await supabase.from('promo_codes').delete().eq('id', id);
    setCodes(prev=>prev.filter(c=>c.id!==id));
  }

  function shareViaWhatsApp(code) {
    const msg = `🎉 Special Offer from ${tenant?.name||'Elite Store'}!\n\nUse code *${code.code}* to get *${code.type==='percent'?code.value+'% OFF':'Rs.'+code.value+' OFF'}* on your purchase!\n${code.min_order>0?`Min order: ${fmt(code.min_order)}`:''}\n${code.valid_until?`Valid until: ${code.valid_until}`:''}\n\nShop now and save! 🛍️`;
    window.open('https://wa.me/?text='+encodeURIComponent(msg), '_blank');
  }

  const displayed = codes.filter(c => filter==='all'?true:filter==='active'?c.active:!c.active);
  const totalSaved = codes.reduce((s,c)=>s+(c.uses_count||0)*(c.type==='percent'?0:c.value),0);
  const inp = { background:T.card, border:`1px solid ${T.bdr}`, borderRadius:8, padding:'9px 12px', color:T.ink, fontSize:13, fontFamily:'inherit', outline:'none', width:'100%' };

  return (
    <div style={{ padding:20 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
        <div>
          <div style={{ fontSize:22, fontWeight:800, color:T.ink }}>🏷️ Promo Codes</div>
          <div style={{ fontSize:13, color:T.sub }}>{codes.filter(c=>c.active).length} active codes</div>
        </div>
        <button onClick={()=>setShowForm(true)} style={{ background:T.blue, color:'#fff', border:'none', borderRadius:9, padding:'10px 18px', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>
          + Create Code
        </button>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12, marginBottom:20 }}>
        {[['Active Codes',codes.filter(c=>c.active).length,T.green],['Total Uses',codes.reduce((s,c)=>s+(c.uses_count||0),0),T.blue],['Codes Created',codes.length,T.sub]].map(([label,val,color])=>(
          <div key={label} style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:10, padding:'14px 18px' }}>
            <div style={{ fontSize:11, color:T.sub, fontWeight:700, textTransform:'uppercase', marginBottom:6 }}>{label}</div>
            <div style={{ fontSize:22, fontWeight:800, color }}>{val}</div>
          </div>
        ))}
      </div>

      <div style={{ display:'flex', gap:8, marginBottom:14 }}>
        {[['active','Active'],['inactive','Inactive'],['all','All']].map(([id,label])=>(
          <button key={id} onClick={()=>setFilter(id)} style={{ background:filter===id?T.blue:T.srf, color:filter===id?'#fff':T.sub, border:`1px solid ${filter===id?T.blue:T.bdr}`, borderRadius:7, padding:'6px 14px', fontSize:12, cursor:'pointer', fontFamily:'inherit' }}>{label}</button>
        ))}
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(300px,1fr))', gap:12 }}>
        {loading?<div style={{ color:T.sub, padding:40 }}>Loading…</div>
        :displayed.length===0?<div style={{ color:T.muted, padding:40 }}>No promo codes</div>
        :displayed.map(code=>(
          <div key={code.id} style={{ background:T.srf, border:`2px dashed ${code.active?T.blue+'44':T.bdr}`, borderRadius:12, padding:18 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:12 }}>
              <div>
                <div style={{ fontSize:20, fontWeight:900, color:T.blue, fontFamily:'monospace', letterSpacing:1 }}>{code.code}</div>
                <div style={{ fontSize:12, color:T.sub, marginTop:2 }}>{code.description||'No description'}</div>
              </div>
              <div style={{ display:'flex', gap:6, alignItems:'center' }}>
                <button onClick={()=>toggleActive(code.id,!code.active)} style={{ background:code.active?T.green+'22':T.red+'22', color:code.active?T.green:T.red, border:'none', borderRadius:6, padding:'3px 8px', fontSize:10, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>
                  {code.active?'Active':'Inactive'}
                </button>
              </div>
            </div>
            <div style={{ background:T.card, borderRadius:8, padding:'10px 12px', marginBottom:12 }}>
              <div style={{ fontSize:18, fontWeight:800, color:T.amber }}>
                {code.type==='percent'?`${code.value}% OFF`:`Rs.${code.value} OFF`}
              </div>
              <div style={{ fontSize:11, color:T.muted, marginTop:3 }}>
                {code.min_order>0&&`Min: ${fmt(code.min_order)}`}
                {code.max_discount&&` · Max: ${fmt(code.max_discount)}`}
                {code.uses_limit&&` · Limit: ${code.uses_count}/${code.uses_limit} used`}
                {!code.uses_limit&&code.uses_count>0&&` · Used ${code.uses_count} times`}
              </div>
            </div>
            {(code.valid_from||code.valid_until)&&(
              <div style={{ fontSize:11, color:T.muted, marginBottom:10 }}>
                {code.valid_from&&`From ${code.valid_from}`} {code.valid_until&&`→ Until ${code.valid_until}`}
              </div>
            )}
            <div style={{ display:'flex', gap:6 }}>
              <button onClick={()=>shareViaWhatsApp(code)} style={{ flex:1, background:'#25d36622', color:'#25d366', border:'none', borderRadius:7, padding:'7px', fontSize:11, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>💬 Share</button>
              <button onClick={()=>{navigator.clipboard.writeText(code.code);alert('Code copied!');}} style={{ flex:1, background:T.blue+'22', color:T.blue, border:'none', borderRadius:7, padding:'7px', fontSize:11, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>📋 Copy</button>
              <button onClick={()=>deleteCode(code.id)} style={{ background:T.red+'22', color:T.red, border:'none', borderRadius:7, padding:'7px 10px', fontSize:11, cursor:'pointer', fontFamily:'inherit' }}>🗑️</button>
            </div>
          </div>
        ))}
      </div>

      {showForm && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.8)', zIndex:200, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
          <div style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:14, padding:24, width:'100%', maxWidth:460 }}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:18 }}>
              <div style={{ fontSize:17, fontWeight:700, color:T.ink }}>Create Promo Code</div>
              <button onClick={()=>setShowForm(false)} style={{ background:'none', border:'none', color:T.muted, cursor:'pointer', fontSize:22 }}>×</button>
            </div>
            <form onSubmit={saveCode}>
              <div style={{ display:'grid', gridTemplateColumns:'1fr auto', gap:8, marginBottom:12 }}>
                <div>
                  <label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:5 }}>Code *</label>
                  <input value={form.code} onChange={e=>setForm(f=>({...f,code:e.target.value.toUpperCase()}))} style={{ ...inp, fontFamily:'monospace', fontSize:15, fontWeight:700 }} required maxLength={20}/>
                </div>
                <button type="button" onClick={()=>setForm(f=>({...f,code:genCode()}))} style={{ background:T.card, border:`1px solid ${T.bdr}`, borderRadius:8, padding:'0 12px', color:T.sub, cursor:'pointer', fontFamily:'inherit', marginTop:20, fontSize:12 }}>🔄</button>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                <div>
                  <label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:5 }}>Type</label>
                  <select value={form.type} onChange={e=>setForm(f=>({...f,type:e.target.value}))} style={{ ...inp, cursor:'pointer' }}>
                    <option value="percent">% Percentage</option>
                    <option value="fixed">Rs. Fixed Amount</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:5 }}>Value *</label>
                  <input type="number" value={form.value} onChange={e=>setForm(f=>({...f,value:parseFloat(e.target.value)||0}))} style={inp} required min={0}/>
                </div>
                <div>
                  <label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:5 }}>Min Order (Rs.)</label>
                  <input type="number" value={form.min_order||''} onChange={e=>setForm(f=>({...f,min_order:e.target.value}))} placeholder="0" style={inp} min={0}/>
                </div>
                <div>
                  <label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:5 }}>Max Discount</label>
                  <input type="number" value={form.max_discount||''} onChange={e=>setForm(f=>({...f,max_discount:e.target.value}))} placeholder="No limit" style={inp} min={0}/>
                </div>
                <div>
                  <label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:5 }}>Uses Limit</label>
                  <input type="number" value={form.uses_limit||''} onChange={e=>setForm(f=>({...f,uses_limit:e.target.value}))} placeholder="Unlimited" style={inp} min={1}/>
                </div>
                <div>
                  <label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:5 }}>Valid Until</label>
                  <input type="date" value={form.valid_until||''} onChange={e=>setForm(f=>({...f,valid_until:e.target.value}))} style={inp} min={form.valid_from}/>
                </div>
                <div style={{ gridColumn:'1/-1' }}>
                  <label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:5 }}>Description</label>
                  <input value={form.description} onChange={e=>setForm(f=>({...f,description:e.target.value}))} placeholder="e.g. Summer Sale - 10% off all footwear" style={inp}/>
                </div>
              </div>
              <div style={{ display:'flex', gap:10, marginTop:16 }}>
                <button type="button" onClick={()=>setShowForm(false)} style={{ flex:1, background:T.card, color:T.sub, border:`1px solid ${T.bdr}`, borderRadius:8, padding:'11px', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>Cancel</button>
                <button type="submit" disabled={saving} style={{ flex:2, background:T.blue, color:'#fff', border:'none', borderRadius:8, padding:'11px', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>{saving?'Creating…':'Create Code'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
