import { useState, useEffect } from 'react';
import { canSee } from '../lib/roleAccess';
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

export default function BatchExpiryTracker({ tenant, role='owner' }) {
  const showCost = canSee(role, 'costPrice');
  const [batches,   setBatches]   = useState([]);
  const [inventory, setInventory] = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [showForm,  setShowForm]  = useState(false);
  const [saving,    setSaving]    = useState(false);
  const [filter,    setFilter]    = useState('active');
  const [search,    setSearch]    = useState('');
  const [form, setForm] = useState({ item_id:'', item_name:'', batch_no:'', supplier:'', mfg_date:'', expiry_date:'', qty_received:'', cost_price:'', location:'', notes:'' });

  useEffect(() => { if (tenant?.id) load(); }, [tenant?.id]);

  async function load() {
    setLoading(true);
    const [bRes, invRes] = await Promise.all([
      supabase.from('product_batches').select('*').eq('tenant_id', tenant.id).order('expiry_date', { nullsFirst:false }),
      supabase.from('inventory').select('id,name,code,cp').eq('tenant_id', tenant.id).eq('active', true).order('name'),
    ]);
    setBatches(bRes.data||[]);
    setInventory(invRes.data||[]);
    setLoading(false);
  }

  async function saveBatch(e) {
    e.preventDefault(); setSaving(true);
    const qty = parseInt(form.qty_received)||0;
    await supabase.from('product_batches').insert({
      ...form, tenant_id:tenant.id,
      qty_received:qty, qty_remaining:qty,
      cost_price:parseFloat(form.cost_price)||0,
      mfg_date:form.mfg_date||null, expiry_date:form.expiry_date||null,
      status:'active',
    });
    setShowForm(false);
    setForm({ item_id:'', item_name:'', batch_no:'', supplier:'', mfg_date:'', expiry_date:'', qty_received:'', cost_price:'', location:'', notes:'' });
    setSaving(false); await load();
  }

  async function markStatus(id, status) {
    await supabase.from('product_batches').update({ status }).eq('id', id);
    setBatches(prev=>prev.map(b=>b.id===id?{...b,status}:b));
  }

  async function consumeQty(b) {
    const qty = prompt(`Consume how many units from batch ${b.batch_no}? (${b.qty_remaining} remaining)`);
    const n = parseInt(qty);
    if (!n || n<=0 || n>b.qty_remaining) return;
    const rem = b.qty_remaining - n;
    await supabase.from('product_batches').update({ qty_remaining:rem, status: rem<=0?'sold_out':b.status }).eq('id', b.id);
    await load();
  }

  const today = new Date();
  const daysTo = d => d ? Math.ceil((new Date(d)-today)/86400000) : null;

  const enriched = batches.map(b=>({ ...b, days: daysTo(b.expiry_date) }));
  const expired  = enriched.filter(b=>b.days!==null&&b.days<0&&b.qty_remaining>0);
  const expiring = enriched.filter(b=>b.days!==null&&b.days>=0&&b.days<=30&&b.qty_remaining>0);
  const active   = enriched.filter(b=>b.qty_remaining>0&&(b.days===null||b.days>30));

  const displayed = (filter==='expired'?expired:filter==='expiring'?expiring:filter==='active'?active:filter==='soldout'?enriched.filter(b=>b.qty_remaining<=0):enriched)
    .filter(b=>!search||b.item_name.toLowerCase().includes(search.toLowerCase())||b.batch_no.toLowerCase().includes(search.toLowerCase()));

  const valueAtRisk = [...expired,...expiring].reduce((s,b)=>s+(b.qty_remaining*(b.cost_price||0)),0);

  function ExpiryBadge({ days, qty }) {
    if (qty<=0)     return <span style={{ background:'#F9FAFB', color:T.muted, border:`1px solid ${T.bdr}`, borderRadius:5, padding:'2px 8px', fontSize:10, fontWeight:700 }}>Sold Out</span>;
    if (days===null)return <span style={{ background:'#F9FAFB', color:T.muted, border:`1px solid ${T.bdr}`, borderRadius:5, padding:'2px 8px', fontSize:10 }}>No expiry</span>;
    if (days<0)     return <span style={{ background:'#FEF2F2', color:T.red, border:'1px solid #FECACA', borderRadius:5, padding:'2px 8px', fontSize:10, fontWeight:700 }}>Expired {Math.abs(days)}d ago</span>;
    if (days<=7)    return <span style={{ background:'#FEF2F2', color:T.red, border:'1px solid #FECACA', borderRadius:5, padding:'2px 8px', fontSize:10, fontWeight:700 }}>⚠️ {days}d left</span>;
    if (days<=30)   return <span style={{ background:'#FFFBEB', color:T.amber, border:'1px solid #FDE68A', borderRadius:5, padding:'2px 8px', fontSize:10, fontWeight:700 }}>{days}d left</span>;
    if (days<=90)   return <span style={{ background:'#EFF6FF', color:T.blue, border:'1px solid #BFDBFE', borderRadius:5, padding:'2px 8px', fontSize:10, fontWeight:600 }}>{days}d left</span>;
    return <span style={{ background:'#F0FDF4', color:T.green, border:'1px solid #BBF7D0', borderRadius:5, padding:'2px 8px', fontSize:10, fontWeight:600 }}>{days}d left</span>;
  }

  return (
    <div style={{ padding:24, background:T.bg, minHeight:'100%' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
        <div>
          <div style={{ fontSize:18, fontWeight:800, color:T.darkRed }}>🏷️ Batch & Expiry Tracker</div>
          <div style={{ fontSize:12, color:T.sub, marginTop:2 }}>Track batches, lot numbers and expiry dates · FEFO ordering</div>
        </div>
        <button onClick={()=>setShowForm(true)} style={btn(T.red, T.white)}>+ Add Batch</button>
      </div>

      {(expired.length>0||expiring.length>0)&&<div style={{ background:expired.length>0?'#FEF2F2':'#FFFBEB', border:`1px solid ${expired.length>0?'#FECACA':'#FDE68A'}`, borderRadius:10, padding:'11px 16px', marginBottom:16, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <span style={{ fontSize:13, fontWeight:600, color:expired.length>0?T.red:T.amber }}>
          {expired.length>0&&`🚨 ${expired.length} expired batches · `}
          {expiring.length>0&&`⏰ ${expiring.length} expiring within 30 days`}
          {showCost&&<>{' · '}<strong>{fmt(valueAtRisk)}</strong> value at risk</>}
        </span>
        <button onClick={()=>setFilter(expired.length>0?'expired':'expiring')} style={{ background:expired.length>0?'#FECACA':'#FDE68A', color:expired.length>0?'#991B1B':'#92400E', border:'none', borderRadius:7, padding:'4px 12px', fontSize:11, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>Review</button>
      </div>}

      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:14, marginBottom:18 }}>
        {[['Active Batches',active.length,T.green,'✅'],['Expiring ≤30d',expiring.length,T.amber,'⏰'],['Expired',expired.length,T.red,'🚨'],['Value at Risk',showCost?fmt(valueAtRisk):'🔒 Hidden',showCost?T.darkRed:T.muted,'💸']].map(([label,val,color,icon])=>(
          <div key={label} style={{ background:T.white, border:`1px solid ${T.bdr}`, borderRadius:12, padding:'16px 18px', boxShadow:'0 1px 4px rgba(0,0,0,.05)' }}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:6 }}>
              <div style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.05em' }}>{label}</div>
              <span style={{ fontSize:18 }}>{icon}</span>
            </div>
            <div style={{ fontSize:20, fontWeight:900, color, letterSpacing:'-0.02em' }}>{val}</div>
          </div>
        ))}
      </div>

      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14, gap:10 }}>
        <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
          {[['active','Active'],['expiring','Expiring Soon'],['expired','Expired'],['soldout','Sold Out'],['all','All']].map(([f,label])=>(
            <button key={f} onClick={()=>setFilter(f)} style={{ padding:'6px 14px', background:filter===f?T.red:T.white, color:filter===f?T.white:T.sub, border:`1px solid ${filter===f?T.red:T.bdr}`, borderRadius:20, fontSize:11, fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}>{label}</button>
          ))}
        </div>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search product or batch…" style={{ ...inp, width:220, padding:'7px 12px', fontSize:12 }}/>
      </div>

      <div style={{ background:T.white, border:`1px solid ${T.bdr}`, borderRadius:14, overflow:'hidden', boxShadow:'0 1px 4px rgba(0,0,0,.05)' }}>
        <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
          <thead><tr style={{ background:T.lightRed }}>
            {['Product','Batch No','Supplier','Mfg','Expiry','Status','Received','Remaining','Value','Action'].map(h=>(
              <th key={h} style={{ padding:'11px 12px', textAlign:['Received','Remaining','Value'].includes(h)?'right':'left', fontSize:9, color:T.darkRed, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.04em', borderBottom:`1px solid ${T.bdr}`, whiteSpace:'nowrap' }}>{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {loading?<tr><td colSpan={10} style={{ textAlign:'center', padding:50, color:T.muted }}>Loading…</td></tr>
            :displayed.length===0?<tr><td colSpan={10} style={{ textAlign:'center', padding:50 }}>
              <div style={{ fontSize:36, marginBottom:8 }}>🏷️</div>
              <div style={{ color:T.muted, fontWeight:600 }}>No batches found</div>
              <div style={{ color:T.muted, fontSize:11, marginTop:4 }}>Batches are created automatically from GRN, or add manually</div>
            </td></tr>
            :displayed.map(b=>(
              <tr key={b.id} style={{ borderBottom:`1px solid ${T.bdr}22`, background:b.days!==null&&b.days<0&&b.qty_remaining>0?'#FFFAFA':'transparent' }}>
                <td style={{ padding:'10px 12px', color:T.ink, fontWeight:600 }}>{b.item_name}</td>
                <td style={{ padding:'10px 12px', fontFamily:'monospace', fontSize:11, color:T.purple, fontWeight:700 }}>{b.batch_no}</td>
                <td style={{ padding:'10px 12px', color:T.sub, fontSize:11 }}>{b.supplier||'—'}</td>
                <td style={{ padding:'10px 12px', color:T.muted, fontSize:11 }}>{b.mfg_date||'—'}</td>
                <td style={{ padding:'10px 12px', color:T.ink, fontSize:11, fontWeight:600 }}>{b.expiry_date||'—'}</td>
                <td style={{ padding:'10px 12px' }}><ExpiryBadge days={b.days} qty={b.qty_remaining}/></td>
                <td style={{ padding:'10px 12px', textAlign:'right', color:T.sub }}>{b.qty_received}</td>
                <td style={{ padding:'10px 12px', textAlign:'right', fontWeight:700, color:b.qty_remaining>0?T.green:T.muted }}>{b.qty_remaining}</td>
                <td style={{ padding:'10px 12px', textAlign:'right', color:T.red, fontWeight:700 }}>{showCost?fmt(b.qty_remaining*(b.cost_price||0)):<span style={{ color:T.muted, fontWeight:400 }}>🔒</span>}</td>
                <td style={{ padding:'10px 12px' }}>
                  <div style={{ display:'flex', gap:5 }}>
                    {b.qty_remaining>0&&<button onClick={()=>consumeQty(b)} style={{ background:'#EFF6FF', color:T.blue, border:'none', borderRadius:6, padding:'4px 9px', fontSize:10, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>Use</button>}
                    {b.days!==null&&b.days<0&&b.status!=='expired'&&<button onClick={()=>markStatus(b.id,'expired')} style={{ background:'#FEF2F2', color:T.red, border:'none', borderRadius:6, padding:'4px 9px', fontSize:10, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>Write Off</button>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showForm&&(
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.5)', zIndex:200, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
          <div style={{ background:T.white, borderRadius:16, padding:28, width:'100%', maxWidth:500, boxShadow:'0 20px 60px rgba(0,0,0,.2)' }}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:20 }}>
              <div style={{ fontSize:17, fontWeight:800, color:T.darkRed }}>Add Batch / Lot</div>
              <button onClick={()=>setShowForm(false)} style={{ background:'none', border:'none', fontSize:22, cursor:'pointer', color:T.muted }}>×</button>
            </div>
            <form onSubmit={saveBatch}>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                <div style={{ gridColumn:'1/-1' }}>
                  <label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:5 }}>Product *</label>
                  <select value={form.item_id} onChange={e=>{const i=inventory.find(x=>x.id===e.target.value);setForm(f=>({...f,item_id:e.target.value,item_name:i?.name||'',cost_price:String(i?.cp||'')}));}} required style={{ ...inp, cursor:'pointer' }}>
                    <option value="">Select product…</option>
                    {inventory.map(i=><option key={i.id} value={i.id}>{i.name}</option>)}
                  </select>
                </div>
                {[['Batch / Lot No *','text','batch_no'],['Supplier','text','supplier'],['Mfg Date','date','mfg_date'],['Expiry Date','date','expiry_date'],['Quantity *','number','qty_received'],['Cost Price','number','cost_price'],['Storage Location','text','location']].filter(([label])=>label!=='Cost Price'||showCost).map(([label,type,key])=>(
                  <div key={key}><label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:4 }}>{label}</label><input type={type} value={form[key]} onChange={e=>setForm(f=>({...f,[key]:e.target.value}))} required={label.includes('*')} style={inp}/></div>
                ))}
              </div>
              {form.expiry_date&&<div style={{ background:T.lightRed, borderRadius:9, padding:'10px 14px', marginTop:12, fontSize:12, color:T.darkRed, fontWeight:600 }}>
                🏷️ Expires in {Math.ceil((new Date(form.expiry_date)-new Date())/86400000)} days
              </div>}
              <div style={{ display:'flex', gap:10, marginTop:20 }}>
                <button type="button" onClick={()=>setShowForm(false)} style={{ flex:1, background:T.bg, color:T.sub, border:`1px solid ${T.bdr}`, borderRadius:9, padding:'12px', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>Cancel</button>
                <button type="submit" disabled={saving} style={{ flex:2, ...btn(T.red, T.white), padding:'12px', fontSize:13 }}>{saving?'Saving…':'🏷️ Add Batch'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
