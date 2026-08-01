import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

const T = {
  bg:'#F7F3F3', srf:'#FFFFFF', card:'#FFFFFF', card2:'#FFF5F5',
  bdr:'#E8DEDE', bdr2:'#F0E8E8',
  red:'#C0392B', darkRed:'#8B0000', lightRed:'#FEF2F2',
  green:'#16A34A', amber:'#D97706', blue:'#2563EB',
  purple:'#7C3AED', teal:'#0D9488',
  ink:'#111827', sub:'#6B7280', muted:'#9CA3AF', white:'#FFFFFF'
};

const STATUS = {
  pending:    { label:'Pending',     color:'#D97706', bg:'#FFFBEB', border:'#FDE68A' },
  picked:     { label:'Picked Up',   color:'#2563EB', bg:'#EFF6FF', border:'#BFDBFE' },
  in_transit: { label:'In Transit',  color:'#7C3AED', bg:'#F5F3FF', border:'#DDD6FE' },
  delivered:  { label:'Delivered',   color:'#16A34A', bg:'#F0FDF4', border:'#BBF7D0' },
  failed:     { label:'Failed',      color:'#C0392B', bg:'#FEF2F2', border:'#FECACA' },
  returned:   { label:'Returned',    color:'#6B7280', bg:'#F9FAFB', border:'#E5E7EB' },
};

const STAFF = ['Gnanamani','Delivery Boy 1','Delivery Boy 2'];
const fmt   = n => 'Rs.' + (n||0).toLocaleString('en-IN', { maximumFractionDigits:0 });
const btn   = (bg,color,extra={}) => ({ background:bg, color, border:'none', borderRadius:8, padding:'9px 16px', fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:'inherit', ...extra });
const inp   = { background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:8, padding:'9px 12px', color:T.ink, fontSize:13, fontFamily:'inherit', outline:'none', width:'100%' };

export default function DeliveryManagement({ tenant }) {
  const [deliveries, setDeliveries] = useState([]);
  const [sales,      setSales]      = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [showForm,   setShowForm]   = useState(false);
  const [filter,     setFilter]     = useState('all');
  const [saving,     setSaving]     = useState(false);
  const [form, setForm] = useState({ customer:'', customer_phone:'', address:'', pincode:'', assigned_to:'', scheduled_date:new Date().toISOString().slice(0,10), delivery_fee:'', notes:'' });
  const [selSale, setSelSale] = useState('');

  useEffect(() => { if (tenant?.id) load(); }, [tenant?.id]);

  async function load() {
    setLoading(true);
    const [delRes, sRes] = await Promise.all([
      supabase.from('deliveries').select('*').eq('tenant_id', tenant.id).order('created_at', { ascending:false }),
      supabase.from('sales').select('id,inv_num,customer,total,items').eq('tenant_id', tenant.id).order('created_at', { ascending:false }).limit(50),
    ]);
    setDeliveries(delRes.data||[]);
    setSales(sRes.data||[]);
    setLoading(false);
  }

  function genNo() { return `DLV/${new Date().getFullYear()}/${String(Date.now()).slice(-5)}`; }

  function prefillFromSale(saleId) {
    const s = sales.find(x=>x.id===saleId);
    if (!s) return;
    setForm(f=>({ ...f, customer:s.customer, items:s.items }));
  }

  async function save(e) {
    e.preventDefault(); setSaving(true);
    const sale = sales.find(x=>x.id===selSale);
    await supabase.from('deliveries').insert({
      ...form, tenant_id:tenant.id, delivery_no:genNo(),
      sale_id:selSale||null,
      items:sale?.items||[],
      delivery_fee:parseFloat(form.delivery_fee)||0,
    });
    setShowForm(false);
    setForm({ customer:'', customer_phone:'', address:'', pincode:'', assigned_to:'', scheduled_date:new Date().toISOString().slice(0,10), delivery_fee:'', notes:'' });
    setSelSale('');
    setSaving(false); await load();
  }

  async function updateStatus(id, status) {
    const upd = { status };
    if (status==='delivered') upd.delivered_at = new Date().toISOString();
    await supabase.from('deliveries').update(upd).eq('id', id);
    setDeliveries(prev=>prev.map(d=>d.id===id?{...d,...upd}:d));
  }

  function sendWhatsApp(d, msg) {
    const ph = (d.customer_phone||'').replace(/\D/g,'').replace(/^0/,'91');
    window.open(`https://wa.me/${ph}?text=${encodeURIComponent(msg)}`, '_blank');
  }

  function notifyCustomer(d, status) {
    const msgs = {
      picked:     `Hi ${d.customer}! 🛍️\n\nYour order from *${tenant?.name||'7SQ'}* has been picked up and is on its way!\n\nDelivery Boy: ${d.assigned_to||'Our team'}\n📦 Order: ${d.delivery_no}\n\nWe'll deliver soon. Thank you! 🙏`,
      in_transit: `Hi ${d.customer}! 🚚\n\nYour order is *out for delivery* now!\n\nExpected arrival: Today\n📦 ${d.delivery_no}\n\nPlease keep your phone handy. Thank you! 😊`,
      delivered:  `Hi ${d.customer}! ✅\n\nYour order from *${tenant?.name||'7SQ'}* has been delivered successfully!\n\n📦 ${d.delivery_no}\n\nWe hope you love your purchase! Please rate us ⭐⭐⭐⭐⭐\n\nThank you for shopping with us! 🙏`,
    };
    if (msgs[status]) sendWhatsApp(d, msgs[status]);
  }

  const today    = new Date().toISOString().slice(0,10);
  const displayed = filter==='all' ? deliveries : deliveries.filter(d=>d.status===filter);
  const todayDel  = deliveries.filter(d=>d.scheduled_date===today).length;
  const pending   = deliveries.filter(d=>d.status==='pending').length;
  const intransit = deliveries.filter(d=>d.status==='in_transit').length;

  return (
    <div style={{ padding:24, background:T.bg, minHeight:'100%' }}>
      {/* Header */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:24 }}>
        <div>
          <div style={{ fontSize:22, fontWeight:800, color:T.darkRed, letterSpacing:'-0.02em' }}>🚚 Delivery Management</div>
          <div style={{ fontSize:13, color:T.sub, marginTop:2 }}>Track deliveries, assign staff and notify customers</div>
        </div>
        <button onClick={()=>setShowForm(true)} style={btn(T.red, T.white)}>+ New Delivery</button>
      </div>

      {/* KPIs */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:14, marginBottom:20 }}>
        {[["Today's Deliveries",todayDel,T.blue,'📅'],['Pending',pending,T.amber,'⏳'],['In Transit',intransit,T.purple,'🚚'],['Delivered',deliveries.filter(d=>d.status==='delivered').length,T.green,'✅']].map(([label,val,color,icon])=>(
          <div key={label} style={{ background:T.white, border:`1px solid ${T.bdr}`, borderRadius:12, padding:'16px 18px', boxShadow:'0 1px 4px rgba(0,0,0,.05)' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:6 }}>
              <div style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.05em' }}>{label}</div>
              <span style={{ fontSize:18 }}>{icon}</span>
            </div>
            <div style={{ fontSize:26, fontWeight:900, color, letterSpacing:'-0.03em' }}>{val}</div>
          </div>
        ))}
      </div>

      {/* Filter tabs */}
      <div style={{ display:'flex', gap:6, marginBottom:16, flexWrap:'wrap' }}>
        {['all','pending','picked','in_transit','delivered','failed'].map(f=>(
          <button key={f} onClick={()=>setFilter(f)}
            style={{ padding:'6px 14px', background:filter===f?T.red:T.white, color:filter===f?T.white:T.sub, border:`1px solid ${filter===f?T.red:T.bdr}`, borderRadius:20, fontSize:11, fontWeight:600, cursor:'pointer', fontFamily:'inherit', textTransform:'capitalize', transition:'all .15s' }}>
            {f==='all'?'All':STATUS[f]?.label||f} <span style={{ opacity:.7 }}>({f==='all'?deliveries.length:deliveries.filter(d=>d.status===f).length})</span>
          </button>
        ))}
      </div>

      {/* Deliveries list */}
      <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
        {loading?<div style={{ textAlign:'center', padding:60, color:T.muted }}>Loading deliveries…</div>
        :displayed.length===0?<div style={{ background:T.white, border:`1px solid ${T.bdr}`, borderRadius:12, padding:60, textAlign:'center', color:T.muted }}>
          <div style={{ fontSize:40, marginBottom:10 }}>🚚</div>
          <div style={{ fontWeight:700, color:T.sub }}>No deliveries found</div>
        </div>
        :displayed.map(d=>{
          const s = STATUS[d.status]||STATUS.pending;
          return (
            <div key={d.id} style={{ background:T.white, border:`1px solid ${T.bdr}`, borderRadius:12, padding:'16px 20px', boxShadow:'0 1px 4px rgba(0,0,0,.04)' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:12 }}>
                <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                  <span style={{ background:s.bg, color:s.color, border:`1px solid ${s.border}`, borderRadius:6, padding:'3px 10px', fontSize:11, fontWeight:700 }}>{s.label}</span>
                  <span style={{ fontFamily:'monospace', fontSize:12, color:T.blue, fontWeight:700 }}>{d.delivery_no}</span>
                  {d.assigned_to&&<span style={{ fontSize:11, color:T.sub, background:T.bg, borderRadius:5, padding:'2px 8px' }}>👤 {d.assigned_to}</span>}
                </div>
                <div style={{ fontSize:11, color:T.muted }}>📅 {d.scheduled_date}</div>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:12, marginBottom:14 }}>
                <div><div style={{ fontSize:10, color:T.muted, fontWeight:700, textTransform:'uppercase', marginBottom:2 }}>Customer</div><div style={{ fontSize:13, fontWeight:600, color:T.ink }}>{d.customer}</div><div style={{ fontSize:11, color:T.sub }}>{d.customer_phone}</div></div>
                <div><div style={{ fontSize:10, color:T.muted, fontWeight:700, textTransform:'uppercase', marginBottom:2 }}>Address</div><div style={{ fontSize:12, color:T.ink }}>{d.address||'—'}{d.pincode?', '+d.pincode:''}</div></div>
                <div><div style={{ fontSize:10, color:T.muted, fontWeight:700, textTransform:'uppercase', marginBottom:2 }}>Delivery Fee</div><div style={{ fontSize:14, fontWeight:700, color:T.red }}>{fmt(d.delivery_fee)}</div></div>
              </div>
              <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                {d.status==='pending'&&<button onClick={()=>{updateStatus(d.id,'picked');notifyCustomer(d,'picked');}} style={btn('#EFF6FF','#2563EB',{fontSize:11,padding:'6px 12px'})}>📦 Mark Picked</button>}
                {d.status==='picked'&&<button onClick={()=>{updateStatus(d.id,'in_transit');notifyCustomer(d,'in_transit');}} style={btn('#F5F3FF','#7C3AED',{fontSize:11,padding:'6px 12px'})}>🚚 Out for Delivery</button>}
                {d.status==='in_transit'&&<>
                  <button onClick={()=>{updateStatus(d.id,'delivered');notifyCustomer(d,'delivered');}} style={btn('#F0FDF4','#16A34A',{fontSize:11,padding:'6px 12px'})}>✅ Mark Delivered</button>
                  <button onClick={()=>updateStatus(d.id,'failed')} style={btn('#FEF2F2',T.red,{fontSize:11,padding:'6px 12px'})}>❌ Failed</button>
                </>}
                {d.customer_phone&&<button onClick={()=>sendWhatsApp(d,`Hi ${d.customer}! Your order ${d.delivery_no} update from ${tenant?.name||'7SQ'}.`)} style={{ background:'#DCFCE7', color:'#16A34A', border:'none', borderRadius:8, padding:'6px 12px', fontSize:11, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>💬 WhatsApp</button>}
                {d.customer_phone&&<a href={`https://maps.google.com/maps?q=${encodeURIComponent(d.address||'')}`} target="_blank" rel="noopener noreferrer" style={{ background:'#EFF6FF', color:'#2563EB', border:'none', borderRadius:8, padding:'6px 12px', fontSize:11, fontWeight:700, cursor:'pointer', textDecoration:'none', display:'inline-block' }}>📍 Map</a>}
              </div>
            </div>
          );
        })}
      </div>

      {/* Form Modal */}
      {showForm&&(
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.5)', zIndex:200, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
          <div style={{ background:T.white, borderRadius:16, padding:28, width:'100%', maxWidth:520, boxShadow:'0 20px 60px rgba(0,0,0,.2)' }}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:20 }}>
              <div style={{ fontSize:17, fontWeight:800, color:T.darkRed }}>New Delivery</div>
              <button onClick={()=>setShowForm(false)} style={{ background:'none', border:'none', fontSize:22, cursor:'pointer', color:T.muted }}>×</button>
            </div>
            <form onSubmit={save}>
              <div style={{ marginBottom:14 }}>
                <label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:5 }}>Link to Invoice (optional)</label>
                <select value={selSale} onChange={e=>{setSelSale(e.target.value);prefillFromSale(e.target.value);}} style={{ ...inp, cursor:'pointer' }}>
                  <option value="">— Select invoice —</option>
                  {sales.map(s=><option key={s.id} value={s.id}>{s.inv_num} · {s.customer} · {fmt(s.total)}</option>)}
                </select>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                {[['Customer Name *','text','customer'],['Phone','tel','customer_phone'],['Address','text','address'],['Pincode','text','pincode'],['Delivery Fee (Rs.)','number','delivery_fee'],['Scheduled Date','date','scheduled_date']].map(([label,type,key])=>(
                  <div key={key}><label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:4 }}>{label}</label><input type={type} value={form[key]} onChange={e=>setForm(f=>({...f,[key]:e.target.value}))} required={label.includes('*')} style={inp}/></div>
                ))}
                <div><label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:4 }}>Assign To</label>
                  <select value={form.assigned_to} onChange={e=>setForm(f=>({...f,assigned_to:e.target.value}))} style={{ ...inp, cursor:'pointer' }}>
                    <option value="">Unassigned</option>
                    {STAFF.map(s=><option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div><label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:4 }}>Notes</label><input value={form.notes} onChange={e=>setForm(f=>({...f,notes:e.target.value}))} style={inp}/></div>
              </div>
              <div style={{ display:'flex', gap:10, marginTop:20 }}>
                <button type="button" onClick={()=>setShowForm(false)} style={{ flex:1, background:T.bg, color:T.sub, border:`1px solid ${T.bdr}`, borderRadius:9, padding:'12px', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>Cancel</button>
                <button type="submit" disabled={saving} style={{ flex:2, ...btn(T.red, T.white), padding:'12px', fontSize:13 }}>{saving?'Creating…':'🚚 Create Delivery'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
