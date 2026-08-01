import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

const T = {
  bg:'#F7F3F3', srf:'#FFFFFF', card:'#FFFFFF', bdr:'#E8DEDE',
  red:'#C0392B', darkRed:'#8B0000', lightRed:'#FEF2F2',
  green:'#16A34A', amber:'#D97706', blue:'#2563EB', purple:'#7C3AED',
  ink:'#111827', sub:'#6B7280', muted:'#9CA3AF', white:'#FFFFFF'
};
const fmt = n => 'Rs.' + (n||0).toLocaleString('en-IN', { maximumFractionDigits:0 });
const btn = (bg,color,extra={}) => ({ background:bg, color, border:'none', borderRadius:8, padding:'9px 16px', fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:'inherit', ...extra });
const inp = { background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:8, padding:'9px 12px', color:T.ink, fontSize:13, fontFamily:'inherit', outline:'none', width:'100%' };

function genCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({length:8},()=>chars[Math.floor(Math.random()*chars.length)]).join('');
}

export default function CouponManager({ tenant }) {
  const [coupons,   setCoupons]   = useState([]);
  const [customers, setCustomers] = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [showForm,  setShowForm]  = useState(false);
  const [filter,    setFilter]    = useState('all');
  const [saving,    setSaving]    = useState(false);
  const [verifyCode,setVerifyCode]= useState('');
  const [verifyResult,setVerifyResult]= useState(null);
  const [form, setForm] = useState({ code:genCode(), description:'', type:'percent', value:'', min_purchase:'', max_discount:'', usage_limit:'1', valid_from:new Date().toISOString().slice(0,10), valid_until:'', customer_id:'' });

  useEffect(() => { if (tenant?.id) load(); }, [tenant?.id]);

  async function load() {
    setLoading(true);
    const [cRes, custRes] = await Promise.all([
      supabase.from('coupons').select('*').eq('tenant_id', tenant.id).order('created_at', { ascending:false }),
      supabase.from('customers').select('id,name').eq('tenant_id', tenant.id).order('name'),
    ]);
    setCoupons(cRes.data||[]);
    setCustomers(custRes.data||[]);
    setLoading(false);
  }

  async function saveCoupon(e) {
    e.preventDefault(); setSaving(true);
    await supabase.from('coupons').insert({
      ...form, tenant_id:tenant.id,
      value:parseFloat(form.value)||0,
      min_purchase:parseFloat(form.min_purchase)||0,
      max_discount:form.max_discount?parseFloat(form.max_discount):null,
      usage_limit:parseInt(form.usage_limit)||1,
      customer_id:form.customer_id||null,
    });
    setShowForm(false);
    setForm({ code:genCode(), description:'', type:'percent', value:'', min_purchase:'', max_discount:'', usage_limit:'1', valid_from:new Date().toISOString().slice(0,10), valid_until:'', customer_id:'' });
    setSaving(false); await load();
  }

  async function toggleActive(id, current) {
    await supabase.from('coupons').update({ active:!current }).eq('id', id);
    setCoupons(prev=>prev.map(c=>c.id===id?{...c,active:!current}:c));
  }

  async function verifyCoupon() {
    if (!verifyCode) return;
    const { data } = await supabase.from('coupons').select('*').eq('tenant_id', tenant.id).eq('code', verifyCode.toUpperCase()).single();
    if (!data) { setVerifyResult({ valid:false, message:'Coupon not found' }); return; }
    const today = new Date().toISOString().slice(0,10);
    if (!data.active)                    { setVerifyResult({ valid:false, message:'Coupon is inactive' }); return; }
    if (data.valid_until && data.valid_until < today) { setVerifyResult({ valid:false, message:'Coupon has expired' }); return; }
    if (data.used_count >= data.usage_limit)          { setVerifyResult({ valid:false, message:'Usage limit reached' }); return; }
    setVerifyResult({ valid:true, coupon:data, message:`✅ Valid! ${data.type==='percent'?data.value+'% off':data.type==='fixed'?fmt(data.value)+' off':'Free delivery'}${data.min_purchase?` on orders above ${fmt(data.min_purchase)}`:''}` });
  }

  function shareCoupon(c) {
    const disc = c.type==='percent'?`${c.value}% OFF`:c.type==='fixed'?`${fmt(c.value)} OFF`:'FREE DELIVERY';
    const msg  = `🎁 *Exclusive Offer from ${tenant?.name||'7SQ'}!*\n\nYou've received a special discount coupon:\n\n╔══════════════╗\n║  *${c.code}*  ║\n╚══════════════╝\n\n💰 Discount: *${disc}*${c.min_purchase?`\n🛍️ Min purchase: ${fmt(c.min_purchase)}`:''}${c.valid_until?`\n📅 Valid until: ${c.valid_until}`:''}\n\nUse this code at checkout to redeem!\n\nShop now at *${tenant?.name||'7SQ'}* 🛒`;
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
  }

  const today     = new Date().toISOString().slice(0,10);
  const displayed = filter==='all'?coupons:filter==='active'?coupons.filter(c=>c.active&&(!c.valid_until||c.valid_until>=today)):coupons.filter(c=>!c.active||c.valid_until<today);

  return (
    <div style={{ padding:24, background:T.bg, minHeight:'100%' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:24 }}>
        <div>
          <div style={{ fontSize:22, fontWeight:800, color:T.darkRed, letterSpacing:'-0.02em' }}>🏷️ Coupon Manager</div>
          <div style={{ fontSize:13, color:T.sub, marginTop:2 }}>Create discount coupons and track usage</div>
        </div>
        <button onClick={()=>setShowForm(true)} style={btn(T.red, T.white)}>+ Create Coupon</button>
      </div>

      {/* Verify coupon */}
      <div style={{ background:T.white, border:`1px solid ${T.bdr}`, borderRadius:12, padding:'16px 20px', marginBottom:20, boxShadow:'0 1px 4px rgba(0,0,0,.05)' }}>
        <div style={{ fontSize:13, fontWeight:700, color:T.darkRed, marginBottom:10 }}>🔍 Verify Coupon at POS</div>
        <div style={{ display:'flex', gap:10 }}>
          <input value={verifyCode} onChange={e=>{setVerifyCode(e.target.value.toUpperCase());setVerifyResult(null);}} placeholder="Enter coupon code…" style={{ ...inp, fontFamily:'monospace', fontWeight:700, fontSize:14, letterSpacing:'0.1em', flex:1 }}/>
          <button onClick={verifyCoupon} style={btn(T.blue, T.white)}>Verify</button>
        </div>
        {verifyResult&&<div style={{ marginTop:10, background:verifyResult.valid?'#F0FDF4':'#FEF2F2', border:`1px solid ${verifyResult.valid?'#BBF7D0':'#FECACA'}`, borderRadius:8, padding:'10px 14px', fontSize:13, fontWeight:600, color:verifyResult.valid?T.green:T.red }}>
          {verifyResult.message}
          {verifyResult.valid&&verifyResult.coupon&&<div style={{ marginTop:6, fontSize:11, color:T.sub, fontWeight:400 }}>Used: {verifyResult.coupon.used_count}/{verifyResult.coupon.usage_limit} · {verifyResult.coupon.description}</div>}
        </div>}
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12, marginBottom:18 }}>
        {[['Total Coupons',coupons.length,T.blue],['Active',coupons.filter(c=>c.active).length,T.green],['Used',coupons.reduce((s,c)=>s+(c.used_count||0),0),T.amber],['Expired',coupons.filter(c=>c.valid_until&&c.valid_until<today).length,T.muted]].map(([label,val,color])=>(
          <div key={label} style={{ background:T.white, border:`1px solid ${T.bdr}`, borderRadius:12, padding:'14px 16px', boxShadow:'0 1px 4px rgba(0,0,0,.05)' }}>
            <div style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:5 }}>{label}</div>
            <div style={{ fontSize:22, fontWeight:900, color }}>{val}</div>
          </div>
        ))}
      </div>

      <div style={{ display:'flex', gap:6, marginBottom:14 }}>
        {[['all','All'],['active','Active'],['inactive','Inactive/Expired']].map(([f,label])=>(
          <button key={f} onClick={()=>setFilter(f)} style={{ padding:'6px 14px', background:filter===f?T.red:T.white, color:filter===f?T.white:T.sub, border:`1px solid ${filter===f?T.red:T.bdr}`, borderRadius:20, fontSize:11, fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}>{label}</button>
        ))}
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))', gap:12 }}>
        {loading?<div style={{ textAlign:'center', padding:50, color:T.muted, gridColumn:'1/-1' }}>Loading…</div>
        :displayed.map(c=>{
          const expired = c.valid_until && c.valid_until < today;
          const usedUp  = c.used_count >= c.usage_limit;
          const isValid = c.active && !expired && !usedUp;
          return (
            <div key={c.id} style={{ background:T.white, border:`2px dashed ${isValid?T.red:T.bdr}`, borderRadius:14, overflow:'hidden', opacity:isValid?1:.7 }}>
              <div style={{ background:isValid?T.darkRed:'#6B7280', padding:'14px 18px' }}>
                <div style={{ fontFamily:'monospace', fontSize:22, fontWeight:900, color:T.white, letterSpacing:'0.12em' }}>{c.code}</div>
                <div style={{ fontSize:11, color:'rgba(255,255,255,.7)', marginTop:3 }}>{c.description||'Discount Coupon'}</div>
              </div>
              <div style={{ padding:'14px 18px' }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
                  <div style={{ fontSize:20, fontWeight:900, color:isValid?T.red:T.muted }}>
                    {c.type==='percent'?`${c.value}%`:c.type==='fixed'?fmt(c.value):'🚚'} OFF
                  </div>
                  <span style={{ background:isValid?'#F0FDF4':'#F9FAFB', color:isValid?T.green:T.muted, border:`1px solid ${isValid?'#BBF7D0':'#E5E7EB'}`, borderRadius:20, padding:'2px 10px', fontSize:9, fontWeight:700 }}>{isValid?'ACTIVE':expired?'EXPIRED':usedUp?'USED UP':'INACTIVE'}</span>
                </div>
                <div style={{ display:'flex', flexDirection:'column', gap:4, fontSize:11, color:T.sub, marginBottom:12 }}>
                  {c.min_purchase>0&&<span>Min purchase: {fmt(c.min_purchase)}</span>}
                  {c.valid_until&&<span style={{ color:expired?T.red:T.muted }}>Valid until: {c.valid_until}</span>}
                  <span>Used: {c.used_count}/{c.usage_limit}</span>
                  {/* Usage bar */}
                  <div style={{ height:4, background:'#F3F4F6', borderRadius:2, overflow:'hidden' }}>
                    <div style={{ height:'100%', width:`${Math.min(100,c.used_count/c.usage_limit*100)}%`, background:T.amber, borderRadius:2 }}/>
                  </div>
                </div>
                <div style={{ display:'flex', gap:6 }}>
                  <button onClick={()=>shareCoupon(c)} style={{ flex:1, background:'#DCFCE7', color:T.green, border:'none', borderRadius:7, padding:'6px', fontSize:10, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>💬 Share</button>
                  <button onClick={()=>toggleActive(c.id, c.active)} style={{ flex:1, background:T.bg, color:T.sub, border:`1px solid ${T.bdr}`, borderRadius:7, padding:'6px', fontSize:10, cursor:'pointer', fontFamily:'inherit' }}>{c.active?'Disable':'Enable'}</button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {showForm&&(
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.5)', zIndex:200, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
          <div style={{ background:T.white, borderRadius:16, padding:28, width:'100%', maxWidth:480, boxShadow:'0 20px 60px rgba(0,0,0,.2)' }}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:20 }}>
              <div style={{ fontSize:17, fontWeight:800, color:T.darkRed }}>Create Coupon</div>
              <button onClick={()=>setShowForm(false)} style={{ background:'none', border:'none', fontSize:22, cursor:'pointer', color:T.muted }}>×</button>
            </div>
            <form onSubmit={saveCoupon}>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                <div style={{ gridColumn:'1/-1' }}>
                  <label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:4 }}>Coupon Code *</label>
                  <div style={{ display:'flex', gap:8 }}>
                    <input value={form.code} onChange={e=>setForm(f=>({...f,code:e.target.value.toUpperCase()}))} required style={{ ...inp, fontFamily:'monospace', fontWeight:800, fontSize:15, letterSpacing:'0.1em', flex:1 }}/>
                    <button type="button" onClick={()=>setForm(f=>({...f,code:genCode()}))} style={btn(T.bg, T.sub, { border:`1px solid ${T.bdr}`, padding:'9px 12px' })}>🎲</button>
                  </div>
                </div>
                <div><label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:4 }}>Discount Type</label>
                  <select value={form.type} onChange={e=>setForm(f=>({...f,type:e.target.value}))} style={{ ...inp, cursor:'pointer' }}>
                    <option value="percent">Percentage (%)</option>
                    <option value="fixed">Fixed Amount (Rs.)</option>
                    <option value="free_delivery">Free Delivery</option>
                  </select>
                </div>
                <div><label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:4 }}>Value *</label><input type="number" value={form.value} onChange={e=>setForm(f=>({...f,value:e.target.value}))} required style={inp} placeholder={form.type==='percent'?'e.g. 10':'e.g. 100'}/></div>
                <div><label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:4 }}>Min Purchase (Rs.)</label><input type="number" value={form.min_purchase} onChange={e=>setForm(f=>({...f,min_purchase:e.target.value}))} style={inp}/></div>
                <div><label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:4 }}>Usage Limit</label><input type="number" value={form.usage_limit} onChange={e=>setForm(f=>({...f,usage_limit:e.target.value}))} style={inp}/></div>
                <div><label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:4 }}>Valid Until</label><input type="date" value={form.valid_until} onChange={e=>setForm(f=>({...f,valid_until:e.target.value}))} style={inp}/></div>
                <div style={{ gridColumn:'1/-1' }}><label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:4 }}>Description</label><input value={form.description} onChange={e=>setForm(f=>({...f,description:e.target.value}))} placeholder="e.g. Diwali offer" style={inp}/></div>
                <div style={{ gridColumn:'1/-1' }}><label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:4 }}>Restrict to Customer (optional)</label>
                  <select value={form.customer_id} onChange={e=>setForm(f=>({...f,customer_id:e.target.value}))} style={{ ...inp, cursor:'pointer' }}>
                    <option value="">All Customers</option>
                    {customers.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              </div>
              <div style={{ display:'flex', gap:10, marginTop:20 }}>
                <button type="button" onClick={()=>setShowForm(false)} style={{ flex:1, background:T.bg, color:T.sub, border:`1px solid ${T.bdr}`, borderRadius:9, padding:'12px', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>Cancel</button>
                <button type="submit" disabled={saving} style={{ flex:2, ...btn(T.red, T.white), padding:'12px', fontSize:13 }}>{saving?'Creating…':'🏷️ Create Coupon'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
