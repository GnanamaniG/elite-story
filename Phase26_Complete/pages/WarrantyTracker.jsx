import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

const T = {
  bg:'#F7F3F3', srf:'#FFFFFF', card:'#FFFFFF', bdr:'#E8DEDE',
  red:'#C0392B', darkRed:'#8B0000', lightRed:'#FEF2F2',
  green:'#16A34A', amber:'#D97706', blue:'#2563EB', purple:'#7C3AED',
  ink:'#111827', sub:'#6B7280', muted:'#9CA3AF', white:'#FFFFFF'
};
const inp = { background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:8, padding:'9px 12px', color:T.ink, fontSize:13, fontFamily:'inherit', outline:'none', width:'100%' };
const btn = (bg,color,extra={}) => ({ background:bg, color, border:'none', borderRadius:8, padding:'9px 16px', fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:'inherit', ...extra });

export default function WarrantyTracker({ tenant }) {
  const [warranties, setWarranties] = useState([]);
  const [inventory,  setInventory]  = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [showForm,   setShowForm]   = useState(false);
  const [filter,     setFilter]     = useState('all');
  const [saving,     setSaving]     = useState(false);
  const [form, setForm] = useState({ customer:'', customer_phone:'', item_name:'', item_code:'', purchase_date:new Date().toISOString().slice(0,10), duration_months:'12' });

  useEffect(() => { if (tenant?.id) load(); }, [tenant?.id]);

  async function load() {
    setLoading(true);
    const [wRes, invRes] = await Promise.all([
      supabase.from('warranties').select('*').eq('tenant_id', tenant.id).order('expiry_date'),
      supabase.from('inventory').select('id,name,code').eq('tenant_id', tenant.id).eq('active', true),
    ]);
    setWarranties(wRes.data||[]);
    setInventory(invRes.data||[]);
    setLoading(false);
  }

  function genNo() { return `WRT/${new Date().getFullYear()}/${String(Date.now()).slice(-5)}`; }

  async function save(e) {
    e.preventDefault(); setSaving(true);
    const months = parseInt(form.duration_months)||12;
    const expiry = new Date(form.purchase_date);
    expiry.setMonth(expiry.getMonth() + months);
    await supabase.from('warranties').insert({
      ...form, tenant_id:tenant.id, warranty_no:genNo(),
      duration_months:months, expiry_date:expiry.toISOString().slice(0,10),
    });
    setShowForm(false);
    setForm({ customer:'', customer_phone:'', item_name:'', item_code:'', purchase_date:new Date().toISOString().slice(0,10), duration_months:'12' });
    setSaving(false); await load();
  }

  async function claimWarranty(id) {
    const notes = prompt('Claim notes (what is the issue?):');
    if (notes===null) return;
    await supabase.from('warranties').update({ status:'claimed', claim_notes:notes, claimed_at:new Date().toISOString().slice(0,10) }).eq('id', id);
    setWarranties(prev=>prev.map(w=>w.id===id?{...w,status:'claimed',claim_notes:notes}:w));
  }

  function sendWarrantyCard(w) {
    const msg = `🛡️ *Warranty Card — ${tenant?.name||'7SQ'}*\n\n*Product:* ${w.item_name}${w.item_code?' ('+w.item_code+')':''}\n*Customer:* ${w.customer}\n*Warranty No:* ${w.warranty_no}\n\n📅 Purchase Date: ${w.purchase_date}\n✅ Valid Until: *${w.expiry_date}*\n⏱️ Duration: ${w.duration_months} months\n\nFor any warranty claims, please contact us with this warranty number.\n\nThank you for shopping with *${tenant?.name||'7SQ'}*! 🙏`;
    const ph  = (w.customer_phone||'').replace(/\D/g,'').replace(/^0/,'91');
    window.open(`https://wa.me/${ph}?text=${encodeURIComponent(msg)}`, '_blank');
  }

  const today  = new Date().toISOString().slice(0,10);
  const in30   = new Date(); in30.setDate(in30.getDate()+30);
  const in30str= in30.toISOString().slice(0,10);

  const expiringSoon = warranties.filter(w=>w.status==='active'&&w.expiry_date>=today&&w.expiry_date<=in30str);
  const expired      = warranties.filter(w=>w.expiry_date<today&&w.status==='active');
  const displayed    = filter==='all'?warranties:filter==='expiring'?expiringSoon:filter==='expired'?expired:warranties.filter(w=>w.status===filter);

  const StatusBadge = ({ w }) => {
    const daysLeft = Math.ceil((new Date(w.expiry_date)-new Date())/86400000);
    if (w.status==='claimed') return <span style={{ background:'#EFF6FF', color:T.blue, border:'1px solid #BFDBFE', borderRadius:6, padding:'3px 10px', fontSize:10, fontWeight:700 }}>Claimed</span>;
    if (w.status==='void')    return <span style={{ background:'#F9FAFB', color:T.muted, border:`1px solid ${T.bdr}`, borderRadius:6, padding:'3px 10px', fontSize:10, fontWeight:700 }}>Void</span>;
    if (daysLeft<0)           return <span style={{ background:'#FEF2F2', color:T.red, border:'1px solid #FECACA', borderRadius:6, padding:'3px 10px', fontSize:10, fontWeight:700 }}>Expired</span>;
    if (daysLeft<=30)         return <span style={{ background:'#FFFBEB', color:T.amber, border:'1px solid #FDE68A', borderRadius:6, padding:'3px 10px', fontSize:10, fontWeight:700 }}>Expires in {daysLeft}d</span>;
    return <span style={{ background:'#F0FDF4', color:T.green, border:'1px solid #BBF7D0', borderRadius:6, padding:'3px 10px', fontSize:10, fontWeight:700 }}>Active · {daysLeft}d left</span>;
  };

  return (
    <div style={{ padding:24, background:T.bg, minHeight:'100%' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:24 }}>
        <div>
          <div style={{ fontSize:22, fontWeight:800, color:T.darkRed, letterSpacing:'-0.02em' }}>🛡️ Warranty Tracker</div>
          <div style={{ fontSize:13, color:T.sub, marginTop:2 }}>Manage product warranties, send digital warranty cards</div>
        </div>
        <button onClick={()=>setShowForm(true)} style={btn(T.red, T.white)}>+ Add Warranty</button>
      </div>

      {expiringSoon.length>0&&<div style={{ background:'#FFFBEB', border:'1px solid #FDE68A', borderRadius:12, padding:'12px 16px', marginBottom:16, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <span style={{ fontSize:13, fontWeight:600, color:T.amber }}>⚠️ {expiringSoon.length} warranties expiring within 30 days</span>
        <button onClick={()=>setFilter('expiring')} style={{ background:'#FDE68A', color:'#92400E', border:'none', borderRadius:7, padding:'5px 12px', fontSize:11, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>View All</button>
      </div>}

      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:14, marginBottom:20 }}>
        {[['Total',warranties.length,T.blue],['Active',warranties.filter(w=>w.status==='active').length,T.green],['Expiring Soon',expiringSoon.length,T.amber],['Claimed',warranties.filter(w=>w.status==='claimed').length,T.purple]].map(([label,val,color])=>(
          <div key={label} style={{ background:T.white, border:`1px solid ${T.bdr}`, borderRadius:12, padding:'16px 18px', boxShadow:'0 1px 4px rgba(0,0,0,.05)' }}>
            <div style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:6 }}>{label}</div>
            <div style={{ fontSize:26, fontWeight:900, color }}>{val}</div>
          </div>
        ))}
      </div>

      <div style={{ display:'flex', gap:6, marginBottom:16, flexWrap:'wrap' }}>
        {[['all','All'],['active','Active'],['expiring','Expiring Soon'],['expired','Expired'],['claimed','Claimed']].map(([f,label])=>(
          <button key={f} onClick={()=>setFilter(f)} style={{ padding:'6px 14px', background:filter===f?T.red:T.white, color:filter===f?T.white:T.sub, border:`1px solid ${filter===f?T.red:T.bdr}`, borderRadius:20, fontSize:11, fontWeight:600, cursor:'pointer', fontFamily:'inherit', transition:'all .15s' }}>
            {label}
          </button>
        ))}
      </div>

      <div style={{ background:T.white, border:`1px solid ${T.bdr}`, borderRadius:14, overflow:'hidden', boxShadow:'0 1px 4px rgba(0,0,0,.05)' }}>
        <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
          <thead><tr style={{ background:T.lightRed }}>
            {['Warranty No','Customer','Product','Purchase Date','Expiry','Status','Actions'].map(h=>(
              <th key={h} style={{ padding:'11px 16px', textAlign:'left', fontSize:10, color:T.darkRed, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.05em', borderBottom:`1px solid ${T.bdr}` }}>{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {loading?<tr><td colSpan={7} style={{ textAlign:'center', padding:50, color:T.muted }}>Loading…</td></tr>
            :displayed.length===0?<tr><td colSpan={7} style={{ textAlign:'center', padding:50 }}><div style={{ fontSize:36, marginBottom:8 }}>🛡️</div><div style={{ color:T.muted, fontWeight:600 }}>No warranties found</div></td></tr>
            :displayed.map(w=>(
              <tr key={w.id} style={{ borderBottom:`1px solid ${T.bdr}44` }}>
                <td style={{ padding:'12px 16px', fontFamily:'monospace', fontWeight:700, color:T.blue, fontSize:12 }}>{w.warranty_no}</td>
                <td style={{ padding:'12px 16px', color:T.ink, fontWeight:600 }}>{w.customer}<br/><span style={{ fontSize:10, color:T.sub }}>{w.customer_phone}</span></td>
                <td style={{ padding:'12px 16px', color:T.ink }}>{w.item_name}{w.item_code&&<span style={{ fontSize:10, color:T.muted }}> · {w.item_code}</span>}</td>
                <td style={{ padding:'12px 16px', color:T.muted }}>{w.purchase_date}</td>
                <td style={{ padding:'12px 16px', color:T.ink, fontWeight:600 }}>{w.expiry_date}</td>
                <td style={{ padding:'12px 16px' }}><StatusBadge w={w}/></td>
                <td style={{ padding:'12px 16px' }}>
                  <div style={{ display:'flex', gap:6 }}>
                    {w.customer_phone&&<button onClick={()=>sendWarrantyCard(w)} style={{ background:'#DCFCE7', color:'#16A34A', border:'none', borderRadius:7, padding:'5px 10px', fontSize:10, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>💬 Card</button>}
                    {w.status==='active'&&<button onClick={()=>claimWarranty(w.id)} style={{ background:T.lightRed, color:T.red, border:`1px solid ${T.bdr}`, borderRadius:7, padding:'5px 10px', fontSize:10, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>Claim</button>}
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
              <div style={{ fontSize:17, fontWeight:800, color:T.darkRed }}>Add Warranty</div>
              <button onClick={()=>setShowForm(false)} style={{ background:'none', border:'none', fontSize:22, cursor:'pointer', color:T.muted }}>×</button>
            </div>
            <form onSubmit={save}>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                {[['Customer Name *','text','customer'],['Phone','tel','customer_phone'],['Purchase Date','date','purchase_date'],['Duration (months) *','number','duration_months']].map(([label,type,key])=>(
                  <div key={key}><label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:4 }}>{label}</label><input type={type} value={form[key]} onChange={e=>setForm(f=>({...f,[key]:e.target.value}))} required={label.includes('*')} style={inp}/></div>
                ))}
                <div style={{ gridColumn:'1/-1' }}>
                  <label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:5 }}>Product *</label>
                  <select onChange={e=>{const i=inventory.find(x=>x.id===e.target.value);if(i)setForm(f=>({...f,item_name:i.name,item_code:i.code||''}));}} style={{ ...inp, cursor:'pointer', marginBottom:6 }}>
                    <option value="">Select from inventory…</option>
                    {inventory.map(i=><option key={i.id} value={i.id}>{i.name}</option>)}
                  </select>
                  <input value={form.item_name} onChange={e=>setForm(f=>({...f,item_name:e.target.value}))} placeholder="Or type product name" required style={inp}/>
                </div>
              </div>
              {form.purchase_date&&form.duration_months&&<div style={{ background:T.lightRed, borderRadius:9, padding:'10px 14px', marginTop:12, fontSize:12, color:T.darkRed, fontWeight:600 }}>
                🛡️ Warranty valid until: {(() => { const d=new Date(form.purchase_date); d.setMonth(d.getMonth()+parseInt(form.duration_months)); return d.toLocaleDateString('en-IN'); })()}
              </div>}
              <div style={{ display:'flex', gap:10, marginTop:20 }}>
                <button type="button" onClick={()=>setShowForm(false)} style={{ flex:1, background:T.bg, color:T.sub, border:`1px solid ${T.bdr}`, borderRadius:9, padding:'12px', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>Cancel</button>
                <button type="submit" disabled={saving} style={{ flex:2, ...btn(T.red, T.white), padding:'12px', fontSize:13 }}>{saving?'Saving…':'🛡️ Add Warranty'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
