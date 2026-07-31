import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

const T = { bg:'#060710', srf:'#0f1220', card:'#141828', bdr:'#1e2540', blue:'#4f7cff', ink:'#eef0f8', sub:'#6b7598', muted:'#4a5175', green:'#00d68f', amber:'#ffb547', red:'#ff4d6a', purple:'#9b72ff', teal:'#00c9b1' };
const fmt = n => 'Rs.' + (n||0).toLocaleString('en-IN', { maximumFractionDigits:0 });

const FREQ_LABELS = { weekly:'Weekly', monthly:'Monthly', quarterly:'Quarterly', yearly:'Yearly' };
const FREQ_DAYS   = { weekly:7, monthly:30, quarterly:90, yearly:365 };

function nextDueDate(start, freq) {
  const d = new Date(start);
  d.setDate(d.getDate() + FREQ_DAYS[freq]);
  return d.toISOString().slice(0,10);
}

export default function Subscriptions({ tenant }) {
  const [subs,     setSubs]     = useState([]);
  const [payments, setPayments] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [filter,   setFilter]   = useState('active');
  const [form,     setForm]     = useState({ customer:'', customer_phone:'', plan_name:'', description:'', amount:'', frequency:'monthly', start_date:new Date().toISOString().slice(0,10), notes:'' });
  const [saving,   setSaving]   = useState(false);

  useEffect(() => { if (tenant?.id) load(); }, [tenant?.id]);

  async function load() {
    setLoading(true);
    const [subsRes, payRes] = await Promise.all([
      supabase.from('subscriptions').select('*').eq('tenant_id', tenant.id).order('next_due'),
      supabase.from('sub_payments').select('*').eq('tenant_id', tenant.id).order('paid_date', { ascending:false }).limit(50),
    ]);
    setSubs(subsRes.data||[]);
    setPayments(payRes.data||[]);
    setLoading(false);
  }

  async function createSub(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const next = nextDueDate(form.start_date, form.frequency);
      await supabase.from('subscriptions').insert({ ...form, tenant_id:tenant.id, amount:parseFloat(form.amount)||0, next_due:next });
      setShowForm(false);
      setForm({ customer:'', customer_phone:'', plan_name:'', description:'', amount:'', frequency:'monthly', start_date:new Date().toISOString().slice(0,10), notes:'' });
      await load();
    } catch(e) { alert('Error: '+e.message); }
    finally { setSaving(false); }
  }

  async function recordPayment(sub) {
    const mode = prompt('Payment mode? (cash/upi/card)', 'cash');
    if (!mode) return;
    await supabase.from('sub_payments').insert({ tenant_id:tenant.id, subscription_id:sub.id, amount:sub.amount, payment_mode:mode });
    const nextDue = nextDueDate(new Date().toISOString().slice(0,10), sub.frequency);
    await supabase.from('subscriptions').update({ last_paid:new Date().toISOString().slice(0,10), next_due:nextDue, total_collected:(sub.total_collected||0)+sub.amount }).eq('id', sub.id);
    await load();
  }

  async function toggleStatus(sub) {
    const newStatus = sub.status==='active'?'paused':'active';
    await supabase.from('subscriptions').update({ status:newStatus }).eq('id', sub.id);
    setSubs(prev=>prev.map(s=>s.id===sub.id?{...s,status:newStatus}:s));
  }

  function sendReminder(sub) {
    const msg = `Hi ${sub.customer}! 👋\n\nYour *${sub.plan_name}* subscription payment of *${fmt(sub.amount)}* is due.\n\nDue Date: ${sub.next_due}\n\nPlease make your ${FREQ_LABELS[sub.frequency].toLowerCase()} payment at ${tenant?.name||'our store'}.\n\nThank you! 🙏`;
    const ph  = (sub.customer_phone||'').replace(/\D/g,'').replace(/^0/,'91');
    window.open(`https://wa.me/${ph||''}?text=${encodeURIComponent(msg)}`, '_blank');
  }

  const today    = new Date().toISOString().slice(0,10);
  const overdue  = subs.filter(s=>s.status==='active'&&s.next_due<today);
  const dueToday = subs.filter(s=>s.status==='active'&&s.next_due===today);
  const upcoming = subs.filter(s=>s.status==='active'&&s.next_due>today);
  const monthly  = subs.filter(s=>s.status==='active').reduce((t,s)=>{
    const mult = s.frequency==='weekly'?4.33:s.frequency==='quarterly'?0.33:s.frequency==='yearly'?0.083:1;
    return t + s.amount * mult;
  }, 0);

  const displayed = filter==='all'?subs:subs.filter(s=>s.status===filter);
  const inp = { background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:8, padding:'9px 12px', color:T.ink, fontSize:13, fontFamily:'inherit', outline:'none', width:'100%' };

  return (
    <div style={{ padding:20 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
        <div>
          <div style={{ fontSize:22, fontWeight:800, color:T.ink }}>🔁 Subscription Manager</div>
          <div style={{ fontSize:13, color:T.sub }}>{subs.filter(s=>s.status==='active').length} active · Est. {fmt(monthly)}/month MRR</div>
        </div>
        <button onClick={()=>setShowForm(true)} style={{ background:T.blue, color:'#fff', border:'none', borderRadius:9, padding:'10px 18px', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>+ New Subscription</button>
      </div>

      {/* Stats */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12, marginBottom:16 }}>
        {[['Overdue',overdue.length,T.red],['Due Today',dueToday.length,T.amber],['Upcoming',upcoming.length,T.blue],['Monthly MRR',fmt(monthly),T.green]].map(([label,val,color])=>(
          <div key={label} style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:10, padding:'12px 16px' }}>
            <div style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', marginBottom:5 }}>{label}</div>
            <div style={{ fontSize:20, fontWeight:800, color }}>{val}</div>
          </div>
        ))}
      </div>

      {/* Overdue alert */}
      {overdue.length>0&&<div style={{ background:T.red+'12', border:`1px solid ${T.red}44`, borderRadius:10, padding:'12px 16px', marginBottom:14 }}>
        <div style={{ fontWeight:700, color:T.red, marginBottom:8 }}>⚠️ {overdue.length} Overdue Subscriptions</div>
        <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
          {overdue.map(s=><button key={s.id} onClick={()=>sendReminder(s)} style={{ background:T.red+'22', color:T.red, border:'none', borderRadius:6, padding:'4px 10px', fontSize:11, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>💬 Remind {s.customer}</button>)}
        </div>
      </div>}

      {/* Filter */}
      <div style={{ display:'flex', gap:8, marginBottom:14 }}>
        {[['active','Active'],['paused','Paused'],['cancelled','Cancelled'],['all','All']].map(([id,label])=>(
          <button key={id} onClick={()=>setFilter(id)} style={{ background:filter===id?T.blue:T.srf, color:filter===id?'#fff':T.sub, border:`1px solid ${filter===id?T.blue:T.bdr}`, borderRadius:7, padding:'6px 14px', fontSize:12, cursor:'pointer', fontFamily:'inherit', textTransform:'capitalize' }}>{label} ({id==='all'?subs.length:subs.filter(s=>s.status===id).length})</button>
        ))}
      </div>

      {/* Subscriptions table */}
      <div style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:12, overflow:'hidden' }}>
        <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
          <thead><tr style={{ background:T.card }}>
            {['Customer','Plan','Amount','Frequency','Next Due','Total Collected','Status','Actions'].map(h=>(
              <th key={h} style={{ padding:'9px 14px', textAlign:'left', fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', borderBottom:`1px solid ${T.bdr}` }}>{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {loading?<tr><td colSpan={8} style={{ textAlign:'center', padding:40, color:T.sub }}>Loading…</td></tr>
            :displayed.length===0?<tr><td colSpan={8} style={{ textAlign:'center', padding:40, color:T.muted }}>No subscriptions found</td></tr>
            :displayed.map(s=>{
              const isOverdue = s.status==='active'&&s.next_due<today;
              return (
                <tr key={s.id} style={{ borderBottom:`1px solid ${T.bdr}22`, background:isOverdue?T.red+'08':'transparent' }}>
                  <td style={{ padding:'10px 14px', color:T.ink, fontWeight:600 }}>{s.customer}<br/><span style={{ fontSize:10, color:T.muted }}>{s.customer_phone}</span></td>
                  <td style={{ padding:'10px 14px', color:T.ink }}>{s.plan_name}<br/><span style={{ fontSize:10, color:T.muted }}>{s.description}</span></td>
                  <td style={{ padding:'10px 14px', color:T.green, fontWeight:700 }}>{fmt(s.amount)}</td>
                  <td style={{ padding:'10px 14px', color:T.sub }}>{FREQ_LABELS[s.frequency]}</td>
                  <td style={{ padding:'10px 14px', color:isOverdue?T.red:s.next_due===today?T.amber:T.ink, fontWeight:isOverdue?700:400 }}>{s.next_due}{isOverdue?' ⚠️':s.next_due===today?' 📅':''}</td>
                  <td style={{ padding:'10px 14px', color:T.blue }}>{fmt(s.total_collected)}</td>
                  <td style={{ padding:'10px 14px' }}><span style={{ background:s.status==='active'?T.green+'22':T.muted+'22', color:s.status==='active'?T.green:T.muted, borderRadius:5, padding:'2px 8px', fontSize:10, fontWeight:700, textTransform:'capitalize' }}>{s.status}</span></td>
                  <td style={{ padding:'10px 14px' }}>
                    <div style={{ display:'flex', gap:5 }}>
                      {s.status==='active'&&<button onClick={()=>recordPayment(s)} style={{ background:T.green+'22', color:T.green, border:'none', borderRadius:5, padding:'4px 8px', fontSize:10, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>💰 Pay</button>}
                      {s.customer_phone&&<button onClick={()=>sendReminder(s)} style={{ background:'#25d36622', color:'#25d366', border:'none', borderRadius:5, padding:'4px 8px', fontSize:10, cursor:'pointer', fontFamily:'inherit' }}>💬</button>}
                      <button onClick={()=>toggleStatus(s)} style={{ background:T.amber+'22', color:T.amber, border:'none', borderRadius:5, padding:'4px 8px', fontSize:10, cursor:'pointer', fontFamily:'inherit' }}>{s.status==='active'?'⏸':'▶'}</button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {showForm && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.8)', zIndex:200, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
          <div style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:14, padding:24, width:'100%', maxWidth:480 }}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:18 }}>
              <div style={{ fontSize:17, fontWeight:700, color:T.ink }}>New Subscription</div>
              <button onClick={()=>setShowForm(false)} style={{ background:'none', border:'none', color:T.muted, cursor:'pointer', fontSize:22 }}>×</button>
            </div>
            <form onSubmit={createSub}>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                {[['Customer Name *','text','customer'],['Phone','tel','customer_phone'],['Plan Name *','text','plan_name'],['Amount (Rs.) *','number','amount'],['Start Date *','date','start_date'],['Notes','text','notes']].map(([label,type,key])=>(
                  <div key={key} style={{ gridColumn:key==='plan_name'||key==='notes'?'1/-1':'auto' }}>
                    <label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:5 }}>{label}</label>
                    <input type={type} value={form[key]} onChange={e=>setForm(f=>({...f,[key]:e.target.value}))} required={label.includes('*')} style={inp}/>
                  </div>
                ))}
                <div>
                  <label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:5 }}>Frequency *</label>
                  <select value={form.frequency} onChange={e=>setForm(f=>({...f,frequency:e.target.value}))} style={{ ...inp, cursor:'pointer' }}>
                    {Object.entries(FREQ_LABELS).map(([k,v])=><option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:5 }}>Description</label>
                  <input value={form.description} onChange={e=>setForm(f=>({...f,description:e.target.value}))} style={inp}/>
                </div>
              </div>
              <div style={{ display:'flex', gap:10, marginTop:16 }}>
                <button type="button" onClick={()=>setShowForm(false)} style={{ flex:1, background:T.card, color:T.sub, border:`1px solid ${T.bdr}`, borderRadius:8, padding:'11px', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>Cancel</button>
                <button type="submit" disabled={saving} style={{ flex:2, background:T.blue, color:'#fff', border:'none', borderRadius:8, padding:'11px', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>{saving?'Creating…':'Create Subscription'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
