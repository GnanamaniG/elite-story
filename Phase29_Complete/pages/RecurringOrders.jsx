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

const FREQ = {
  weekly:    { label:'Weekly',     days:7,  color:'#2563EB', bg:'#EFF6FF' },
  biweekly:  { label:'Bi-weekly',  days:14, color:'#7C3AED', bg:'#F5F3FF' },
  monthly:   { label:'Monthly',    days:30, color:'#16A34A', bg:'#F0FDF4' },
  quarterly: { label:'Quarterly',  days:90, color:'#D97706', bg:'#FFFBEB' },
};

export default function RecurringOrders({ tenant }) {
  const [orders,    setOrders]    = useState([]);
  const [inventory, setInventory] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [showForm,  setShowForm]  = useState(false);
  const [saving,    setSaving]    = useState(false);
  const [filter,    setFilter]    = useState('all');
  const [invSearch, setInvSearch] = useState('');
  const [items,     setItems]     = useState([]);
  const [form, setForm] = useState({ customer:'', customer_id:'', phone:'', frequency:'monthly', next_date:new Date(Date.now()+7*86400000).toISOString().slice(0,10), notes:'' });

  useEffect(() => { if (tenant?.id) load(); }, [tenant?.id]);

  async function load() {
    setLoading(true);
    const [oRes, invRes, custRes] = await Promise.all([
      supabase.from('recurring_orders').select('*').eq('tenant_id', tenant.id).order('next_date'),
      supabase.from('inventory').select('id,name,sp,code').eq('tenant_id', tenant.id).eq('active', true).order('name'),
      supabase.from('customers').select('id,name,phone').eq('tenant_id', tenant.id).order('name'),
    ]);
    setOrders(oRes.data||[]);
    setInventory(invRes.data||[]);
    setCustomers(custRes.data||[]);
    setLoading(false);
  }

  function genRef() { return `SUB${Date.now().toString(36).toUpperCase().slice(-6)}`; }
  const amount = items.reduce((s,i)=>s+(i.rate||0)*(i.qty||1), 0);

  async function saveOrder(e) {
    e.preventDefault(); setSaving(true);
    await supabase.from('recurring_orders').insert({
      ...form, tenant_id:tenant.id, order_ref:genRef(), items, amount, status:'active',
    });
    setShowForm(false); setItems([]);
    setForm({ customer:'', customer_id:'', phone:'', frequency:'monthly', next_date:new Date(Date.now()+7*86400000).toISOString().slice(0,10), notes:'' });
    setSaving(false); await load();
  }

  async function markFulfilled(o) {
    const freq = FREQ[o.frequency] || FREQ.monthly;
    const next = new Date(o.next_date);
    next.setDate(next.getDate() + freq.days);
    await supabase.from('recurring_orders').update({
      last_fulfilled: new Date().toISOString().slice(0,10),
      next_date: next.toISOString().slice(0,10),
      fulfilled_count: (o.fulfilled_count||0)+1,
    }).eq('id', o.id);
    await load();
  }

  async function toggleStatus(o) {
    const newStatus = o.status==='active' ? 'paused' : 'active';
    await supabase.from('recurring_orders').update({ status:newStatus }).eq('id', o.id);
    setOrders(prev=>prev.map(x=>x.id===o.id?{...x,status:newStatus}:x));
  }

  function sendReminder(o) {
    const msg = `Hi ${o.customer}! 🔔\n\n*Your regular order is due!*\n\n📦 Order: ${o.order_ref}\n📅 Due: ${o.next_date}\n\n*Your usual items:*\n${(o.items||[]).map(i=>`• ${i.name} × ${i.qty}`).join('\n')}\n\n💰 Total: *${fmt(o.amount)}*\n\nShall we prepare your order? Reply YES to confirm.\n\n— ${tenant?.name||'7SQ'}`;
    const ph = (o.phone||'').replace(/\D/g,'').replace(/^0/,'91');
    window.open(`https://wa.me/${ph}?text=${encodeURIComponent(msg)}`, '_blank');
  }

  const today     = new Date().toISOString().slice(0,10);
  const in7days   = new Date(Date.now()+7*86400000).toISOString().slice(0,10);
  const dueToday  = orders.filter(o=>o.status==='active'&&o.next_date<=today);
  const dueSoon   = orders.filter(o=>o.status==='active'&&o.next_date>today&&o.next_date<=in7days);
  const displayed = filter==='all'?orders:filter==='due'?dueToday:filter==='soon'?dueSoon:orders.filter(o=>o.status===filter);
  const mrr       = orders.filter(o=>o.status==='active').reduce((s,o)=>{ const f=FREQ[o.frequency]||FREQ.monthly; return s + (o.amount||0)*(30/f.days); }, 0);

  return (
    <div style={{ padding:24, background:T.bg, minHeight:'100%' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:24 }}>
        <div>
          <div style={{ fontSize:22, fontWeight:800, color:T.darkRed, letterSpacing:'-0.02em' }}>🔁 Recurring Orders</div>
          <div style={{ fontSize:13, color:T.sub, marginTop:2 }}>Standing orders and subscriptions with auto-reminders</div>
        </div>
        <button onClick={()=>setShowForm(true)} style={btn(T.red, T.white)}>+ New Recurring Order</button>
      </div>

      {dueToday.length>0&&<div style={{ background:'#FEF2F2', border:'1px solid #FECACA', borderRadius:10, padding:'11px 16px', marginBottom:16, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <span style={{ fontSize:13, fontWeight:600, color:T.red }}>🔔 {dueToday.length} recurring order{dueToday.length>1?'s':''} due today or overdue</span>
        <button onClick={()=>setFilter('due')} style={{ background:'#FECACA', color:'#991B1B', border:'none', borderRadius:7, padding:'4px 12px', fontSize:11, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>View Due</button>
      </div>}

      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:14, marginBottom:20 }}>
        {[['Active Subscriptions',orders.filter(o=>o.status==='active').length,T.green,'🔁'],['Due Today',dueToday.length,T.red,'🔔'],['Due This Week',dueSoon.length,T.amber,'📅'],['Est. Monthly Revenue',fmt(mrr),T.blue,'💰']].map(([label,val,color,icon])=>(
          <div key={label} style={{ background:T.white, border:`1px solid ${T.bdr}`, borderRadius:12, padding:'16px 18px', boxShadow:'0 1px 4px rgba(0,0,0,.05)' }}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:6 }}>
              <div style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.05em' }}>{label}</div>
              <span style={{ fontSize:18 }}>{icon}</span>
            </div>
            <div style={{ fontSize:22, fontWeight:900, color, letterSpacing:'-0.02em' }}>{val}</div>
          </div>
        ))}
      </div>

      <div style={{ display:'flex', gap:6, marginBottom:16, flexWrap:'wrap' }}>
        {[['all','All'],['due','Due Now'],['soon','Due This Week'],['active','Active'],['paused','Paused']].map(([f,label])=>(
          <button key={f} onClick={()=>setFilter(f)} style={{ padding:'6px 14px', background:filter===f?T.red:T.white, color:filter===f?T.white:T.sub, border:`1px solid ${filter===f?T.red:T.bdr}`, borderRadius:20, fontSize:11, fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}>{label}</button>
        ))}
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(340px,1fr))', gap:14 }}>
        {loading?<div style={{ textAlign:'center', padding:60, color:T.muted, gridColumn:'1/-1' }}>Loading…</div>
        :displayed.length===0?<div style={{ background:T.white, border:`1px solid ${T.bdr}`, borderRadius:12, padding:60, textAlign:'center', gridColumn:'1/-1' }}>
          <div style={{ fontSize:40, marginBottom:10 }}>🔁</div>
          <div style={{ color:T.muted, fontWeight:600 }}>No recurring orders</div>
        </div>
        :displayed.map(o=>{
          const f       = FREQ[o.frequency]||FREQ.monthly;
          const isDue   = o.next_date<=today;
          const isSoon  = o.next_date>today&&o.next_date<=in7days;
          const daysLeft= Math.ceil((new Date(o.next_date)-new Date())/86400000);
          return (
            <div key={o.id} style={{ background:T.white, border:`1px solid ${isDue&&o.status==='active'?'#FECACA':T.bdr}`, borderRadius:14, overflow:'hidden', boxShadow:'0 1px 4px rgba(0,0,0,.05)', opacity:o.status==='paused'?.65:1 }}>
              <div style={{ padding:'14px 18px', background:isDue&&o.status==='active'?'#FEF2F2':T.lightRed, borderBottom:`1px solid ${T.bdr}` }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
                  <div>
                    <div style={{ fontSize:14, fontWeight:800, color:T.ink }}>{o.customer}</div>
                    <div style={{ fontSize:10, fontFamily:'monospace', color:T.blue, marginTop:2 }}>{o.order_ref}</div>
                  </div>
                  <span style={{ background:f.bg, color:f.color, borderRadius:20, padding:'3px 10px', fontSize:10, fontWeight:700 }}>{f.label}</span>
                </div>
              </div>
              <div style={{ padding:'14px 18px' }}>
                <div style={{ marginBottom:12 }}>
                  {(o.items||[]).slice(0,3).map((i,idx)=>(
                    <div key={idx} style={{ display:'flex', justifyContent:'space-between', fontSize:12, padding:'3px 0', color:T.sub }}>
                      <span>{i.name} × {i.qty}</span>
                      <span style={{ color:T.ink }}>{fmt((i.rate||0)*(i.qty||1))}</span>
                    </div>
                  ))}
                  {(o.items||[]).length>3&&<div style={{ fontSize:10, color:T.muted, marginTop:3 }}>+{o.items.length-3} more</div>}
                </div>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', paddingTop:10, borderTop:`1px solid ${T.bdr}33`, marginBottom:12 }}>
                  <div>
                    <div style={{ fontSize:10, color:T.muted, textTransform:'uppercase', fontWeight:700 }}>Next Due</div>
                    <div style={{ fontSize:13, fontWeight:700, color:isDue?T.red:isSoon?T.amber:T.ink }}>
                      {o.next_date} {isDue?'⚠️':daysLeft<=7?`(${daysLeft}d)`:''}
                    </div>
                  </div>
                  <div style={{ textAlign:'right' }}>
                    <div style={{ fontSize:10, color:T.muted, textTransform:'uppercase', fontWeight:700 }}>Amount</div>
                    <div style={{ fontSize:17, fontWeight:900, color:T.red }}>{fmt(o.amount)}</div>
                  </div>
                </div>
                <div style={{ fontSize:10, color:T.muted, marginBottom:10 }}>
                  Fulfilled {o.fulfilled_count||0} times {o.last_fulfilled?`· Last: ${o.last_fulfilled}`:''}
                </div>
                <div style={{ display:'flex', gap:6 }}>
                  {o.phone&&<button onClick={()=>sendReminder(o)} style={{ flex:1, background:'#DCFCE7', color:T.green, border:'none', borderRadius:7, padding:'7px', fontSize:11, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>💬 Remind</button>}
                  {o.status==='active'&&<button onClick={()=>markFulfilled(o)} style={{ flex:1, background:T.lightRed, color:T.red, border:`1px solid ${T.bdr}`, borderRadius:7, padding:'7px', fontSize:11, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>✅ Fulfilled</button>}
                  <button onClick={()=>toggleStatus(o)} style={{ background:T.bg, color:T.sub, border:`1px solid ${T.bdr}`, borderRadius:7, padding:'7px 12px', fontSize:11, cursor:'pointer', fontFamily:'inherit' }}>{o.status==='active'?'⏸️':'▶️'}</button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {showForm&&(
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.5)', zIndex:200, display:'flex', alignItems:'flex-start', justifyContent:'center', padding:20, overflowY:'auto' }}>
          <div style={{ background:T.white, borderRadius:16, padding:28, width:'100%', maxWidth:540, margin:'20px 0', boxShadow:'0 20px 60px rgba(0,0,0,.2)' }}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:20 }}>
              <div style={{ fontSize:17, fontWeight:800, color:T.darkRed }}>New Recurring Order</div>
              <button onClick={()=>setShowForm(false)} style={{ background:'none', border:'none', fontSize:22, cursor:'pointer', color:T.muted }}>×</button>
            </div>
            <form onSubmit={saveOrder}>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:14 }}>
                <div style={{ gridColumn:'1/-1' }}>
                  <label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:5 }}>Customer *</label>
                  <select onChange={e=>{const c=customers.find(x=>x.id===e.target.value);if(c)setForm(f=>({...f,customer_id:c.id,customer:c.name,phone:c.phone||''}));}} style={{ ...inp, cursor:'pointer', marginBottom:6 }}>
                    <option value="">Select customer…</option>
                    {customers.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                  <input value={form.customer} onChange={e=>setForm(f=>({...f,customer:e.target.value}))} placeholder="Or type name" required style={inp}/>
                </div>
                <div><label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:4 }}>Phone</label><input value={form.phone} onChange={e=>setForm(f=>({...f,phone:e.target.value}))} style={inp}/></div>
                <div><label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:4 }}>Frequency</label>
                  <select value={form.frequency} onChange={e=>setForm(f=>({...f,frequency:e.target.value}))} style={{ ...inp, cursor:'pointer' }}>
                    {Object.entries(FREQ).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}
                  </select>
                </div>
                <div style={{ gridColumn:'1/-1' }}><label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:4 }}>First Delivery Date *</label><input type="date" value={form.next_date} onChange={e=>setForm(f=>({...f,next_date:e.target.value}))} required style={inp}/></div>
              </div>

              <div style={{ marginBottom:12, position:'relative' }}>
                <label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:5 }}>Items *</label>
                <input value={invSearch} onChange={e=>setInvSearch(e.target.value)} placeholder="Search products to add…" style={inp}/>
                {invSearch&&<div style={{ position:'absolute', top:'100%', left:0, right:0, background:T.white, border:`1px solid ${T.bdr}`, borderRadius:8, zIndex:10, maxHeight:150, overflowY:'auto', marginTop:4, boxShadow:'0 4px 16px rgba(0,0,0,.1)' }}>
                  {inventory.filter(i=>i.name.toLowerCase().includes(invSearch.toLowerCase())&&!items.find(x=>x.id===i.id)).slice(0,5).map(i=>(
                    <div key={i.id} onClick={()=>{setItems(prev=>[...prev,{id:i.id,name:i.name,qty:1,rate:i.sp||0}]);setInvSearch('');}} style={{ padding:'9px 14px', cursor:'pointer', borderBottom:`1px solid ${T.bdr}22`, display:'flex', justifyContent:'space-between', fontSize:13 }}>
                      <span style={{ color:T.ink }}>{i.name}</span><span style={{ color:T.red, fontWeight:600 }}>{fmt(i.sp)}</span>
                    </div>
                  ))}
                </div>}
              </div>

              {items.length>0&&<div style={{ background:T.bg, borderRadius:10, padding:12, marginBottom:14 }}>
                {items.map((it,i)=>(
                  <div key={i} style={{ display:'grid', gridTemplateColumns:'1fr 70px 90px auto', gap:8, alignItems:'center', marginBottom:6 }}>
                    <span style={{ fontSize:12, color:T.ink }}>{it.name}</span>
                    <input type="number" value={it.qty} onChange={e=>setItems(prev=>prev.map((x,j)=>j===i?{...x,qty:parseInt(e.target.value)||1}:x))} style={{ ...inp, padding:'5px 8px', fontSize:12, textAlign:'center' }}/>
                    <span style={{ fontSize:12, color:T.red, fontWeight:700, textAlign:'right' }}>{fmt((it.rate||0)*(it.qty||1))}</span>
                    <button type="button" onClick={()=>setItems(prev=>prev.filter((_,j)=>j!==i))} style={{ background:'#FEF2F2', color:T.red, border:'none', borderRadius:5, padding:'4px 9px', cursor:'pointer', fontFamily:'inherit' }}>×</button>
                  </div>
                ))}
                <div style={{ textAlign:'right', paddingTop:8, borderTop:`1px solid ${T.bdr}`, fontSize:14, fontWeight:800, color:T.red }}>Total: {fmt(amount)}</div>
              </div>}

              <div style={{ marginBottom:14 }}><label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:4 }}>Notes</label><input value={form.notes} onChange={e=>setForm(f=>({...f,notes:e.target.value}))} style={inp}/></div>
              <div style={{ display:'flex', gap:10 }}>
                <button type="button" onClick={()=>setShowForm(false)} style={{ flex:1, background:T.bg, color:T.sub, border:`1px solid ${T.bdr}`, borderRadius:9, padding:'12px', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>Cancel</button>
                <button type="submit" disabled={saving||!items.length} style={{ flex:2, ...btn(T.red, T.white), padding:'12px', fontSize:13 }}>{saving?'Creating…':'🔁 Create Subscription'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
