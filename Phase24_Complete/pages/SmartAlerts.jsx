import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

const T = {
  bg:'#F7F3F3', srf:'#FFFFFF', card:'#FFFFFF', bdr:'#E8DEDE',
  red:'#C0392B', darkRed:'#8B0000', lightRed:'#FEF2F2',
  green:'#16A34A', amber:'#D97706', blue:'#2563EB', purple:'#7C3AED',
  ink:'#111827', sub:'#6B7280', muted:'#9CA3AF', white:'#FFFFFF'
};

const ALERT_CONFIG = {
  birthday:        { icon:'🎂', color:'#C0392B', bg:'#FEF2F2', border:'#FECACA', label:'Birthday'       },
  payment_due:     { icon:'💰', color:'#D97706', bg:'#FFFBEB', border:'#FDE68A', label:'Payment Due'    },
  low_stock:       { icon:'📦', color:'#7C3AED', bg:'#F5F3FF', border:'#DDD6FE', label:'Low Stock'      },
  anniversary:     { icon:'🎉', color:'#16A34A', bg:'#F0FDF4', border:'#BBF7D0', label:'Anniversary'    },
  emi_due:         { icon:'💳', color:'#2563EB', bg:'#EFF6FF', border:'#BFDBFE', label:'EMI Due'        },
  warranty_expiry: { icon:'🛡️', color:'#D97706', bg:'#FFFBEB', border:'#FDE68A', label:'Warranty Expiry'},
  custom:          { icon:'🔔', color:'#6B7280', bg:'#F9FAFB', border:'#E5E7EB', label:'Custom'         },
};

const btn = (bg,color,extra={}) => ({ background:bg, color, border:'none', borderRadius:8, padding:'9px 16px', fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:'inherit', ...extra });
const inp = { background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:8, padding:'9px 12px', color:T.ink, fontSize:13, fontFamily:'inherit', outline:'none', width:'100%' };

export default function SmartAlerts({ tenant }) {
  const [alerts,    setAlerts]    = useState([]);
  const [customers, setCustomers] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [emiPlans,  setEmiPlans]  = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [generating,setGenerating]= useState(false);
  const [showForm,  setShowForm]  = useState(false);
  const [saving,    setSaving]    = useState(false);
  const [filter,    setFilter]    = useState('all');
  const [form, setForm] = useState({ type:'custom', title:'', message:'', due_date:'' });

  useEffect(() => { if (tenant?.id) load(); }, [tenant?.id]);

  async function load() {
    setLoading(true);
    const today = new Date().toISOString().slice(0,10);
    const [aRes, cRes, invRes, emiRes] = await Promise.all([
      supabase.from('smart_alerts').select('*').eq('tenant_id', tenant.id).eq('dismissed', false).order('due_date'),
      supabase.from('customers').select('id,name,phone,birthday,anniversary,total_spent').eq('tenant_id', tenant.id),
      supabase.from('inventory').select('id,name,stock,alert').eq('tenant_id', tenant.id).eq('active', true),
      supabase.from('emi_plans').select('id,customer,customer_phone,emi_amount').eq('tenant_id', tenant.id).eq('status','active').limit(20),
    ]);
    setAlerts(aRes.data||[]);
    setCustomers(cRes.data||[]);
    setInventory(invRes.data||[]);
    setEmiPlans(emiRes.data||[]);
    setLoading(false);
  }

  async function generateAlerts() {
    setGenerating(true);
    const today   = new Date();
    const todayStr= today.toISOString().slice(0,10);
    const moDay   = `${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
    const newAlerts= [];

    // Birthday alerts (next 7 days)
    customers.forEach(c=>{
      if (!c.birthday) return;
      const bday = c.birthday.slice(5); // MM-DD
      const upcoming = new Date(today.getFullYear(), parseInt(bday.split('-')[0])-1, parseInt(bday.split('-')[1]));
      const diff = Math.ceil((upcoming-today)/86400000);
      if (diff>=0 && diff<=7) {
        newAlerts.push({ tenant_id:tenant.id, type:'birthday', title:`🎂 ${c.name}'s Birthday`, message:`${c.name}'s birthday is on ${c.birthday.slice(5)} (in ${diff} days). Consider sending a greeting and special offer!`, due_date:upcoming.toISOString().slice(0,10), ref_id:c.id, ref_type:'customer' });
      }
    });

    // Low stock alerts
    inventory.filter(i=>(i.stock||0)<=(i.alert||10)).forEach(i=>{
      newAlerts.push({ tenant_id:tenant.id, type:'low_stock', title:`📦 Low Stock: ${i.name}`, message:`${i.name} has only ${i.stock} units left (alert level: ${i.alert||10}). Time to reorder!`, due_date:todayStr, ref_id:i.id, ref_type:'inventory' });
    });

    // Payment due (credit customers)
    customers.filter(c=>(c.total_spent||0)>0).slice(0,5).forEach(c=>{
      // Add dummy payment reminder
    });

    if (newAlerts.length > 0) {
      await supabase.from('smart_alerts').insert(newAlerts);
    }

    setGenerating(false); await load();
    alert(`✅ Generated ${newAlerts.length} new alerts`);
  }

  async function dismiss(id) {
    await supabase.from('smart_alerts').update({ dismissed:true }).eq('id', id);
    setAlerts(prev=>prev.filter(a=>a.id!==id));
  }

  async function sendWhatsApp(alert) {
    const customer = customers.find(c=>c.id===alert.ref_id);
    if (!customer?.phone) { alert('No phone number found'); return; }
    const ph  = customer.phone.replace(/\D/g,'').replace(/^0/,'91');
    const msg = alert.message || alert.title;
    window.open(`https://wa.me/${ph}?text=${encodeURIComponent(msg+'\n\n— '+tenant?.name||'7SQ')}`, '_blank');
    await supabase.from('smart_alerts').update({ sent:true, sent_at:new Date().toISOString() }).eq('id', alert.id);
    setAlerts(prev=>prev.map(a=>a.id===alert.id?{...a,sent:true}:a));
  }

  async function saveCustom(e) {
    e.preventDefault(); setSaving(true);
    await supabase.from('smart_alerts').insert({ ...form, tenant_id:tenant.id });
    setShowForm(false); setForm({ type:'custom', title:'', message:'', due_date:'' });
    setSaving(false); await load();
  }

  const today     = new Date().toISOString().slice(0,10);
  const todayAlerts  = alerts.filter(a=>a.due_date<=today);
  const upcomingAlerts = alerts.filter(a=>a.due_date>today);
  const displayed = filter==='today' ? todayAlerts : filter==='upcoming' ? upcomingAlerts : filter!=='all' ? alerts.filter(a=>a.type===filter) : alerts;

  const AlertCard = ({ alert }) => {
    const cfg = ALERT_CONFIG[alert.type]||ALERT_CONFIG.custom;
    const isToday = alert.due_date<=today;
    return (
      <div style={{ background:T.white, border:`1px solid ${isToday?cfg.border:T.bdr}`, borderRadius:12, padding:'14px 18px', display:'flex', gap:14, alignItems:'flex-start', boxShadow: isToday?`0 2px 8px ${cfg.color}22`:'0 1px 3px rgba(0,0,0,.05)' }}>
        <div style={{ width:40, height:40, borderRadius:10, background:cfg.bg, border:`1px solid ${cfg.border}`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:20, flexShrink:0 }}>{cfg.icon}</div>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:4 }}>
            <div style={{ fontSize:13, fontWeight:700, color:T.ink }}>{alert.title}</div>
            <div style={{ display:'flex', gap:6, alignItems:'center', flexShrink:0, marginLeft:8 }}>
              <span style={{ background:cfg.bg, color:cfg.color, border:`1px solid ${cfg.border}`, borderRadius:5, padding:'1px 8px', fontSize:9, fontWeight:700 }}>{cfg.label}</span>
              {alert.sent&&<span style={{ fontSize:9, color:T.green, fontWeight:700 }}>✅ Sent</span>}
            </div>
          </div>
          {alert.message&&<div style={{ fontSize:12, color:T.sub, marginBottom:8, lineHeight:1.5 }}>{alert.message}</div>}
          <div style={{ display:'flex', gap:8, alignItems:'center' }}>
            <span style={{ fontSize:10, color:isToday?cfg.color:T.muted, fontWeight:isToday?700:400 }}>📅 {alert.due_date}</span>
            <div style={{ display:'flex', gap:6, marginLeft:'auto' }}>
              {alert.ref_type==='customer'&&!alert.sent&&<button onClick={()=>sendWhatsApp(alert)} style={{ background:'#DCFCE7', color:'#16A34A', border:'none', borderRadius:6, padding:'4px 10px', fontSize:10, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>💬 Notify</button>}
              <button onClick={()=>dismiss(alert.id)} style={{ background:'#F9FAFB', color:T.muted, border:`1px solid ${T.bdr}`, borderRadius:6, padding:'4px 10px', fontSize:10, cursor:'pointer', fontFamily:'inherit' }}>Dismiss</button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div style={{ padding:24, background:T.bg, minHeight:'100%' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:24 }}>
        <div>
          <div style={{ fontSize:22, fontWeight:800, color:T.darkRed, letterSpacing:'-0.02em' }}>🔔 Smart Alerts</div>
          <div style={{ fontSize:13, color:T.sub, marginTop:2 }}>Birthdays, payments, low stock and custom reminders</div>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <button onClick={generateAlerts} disabled={generating} style={btn(T.lightRed, T.red, { border:`1px solid ${T.bdr}` })}>{generating?'Generating…':'⚡ Auto-Generate'}</button>
          <button onClick={()=>setShowForm(true)} style={btn(T.red, T.white)}>+ Custom Alert</button>
        </div>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:14, marginBottom:20 }}>
        {[['Total Active',alerts.length,T.blue],['Due Today',todayAlerts.length,T.red],['Upcoming',upcomingAlerts.length,T.amber],['Sent',alerts.filter(a=>a.sent).length,T.green]].map(([label,val,color])=>(
          <div key={label} style={{ background:T.white, border:`1px solid ${T.bdr}`, borderRadius:12, padding:'16px 18px', boxShadow:'0 1px 4px rgba(0,0,0,.05)' }}>
            <div style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:6 }}>{label}</div>
            <div style={{ fontSize:26, fontWeight:900, color }}>{val}</div>
          </div>
        ))}
      </div>

      <div style={{ display:'flex', gap:6, marginBottom:16, flexWrap:'wrap' }}>
        {[['all','All'],['today','Due Today'],['upcoming','Upcoming'],...Object.entries(ALERT_CONFIG).map(([k,v])=>[k,v.label])].map(([f,label])=>(
          <button key={f} onClick={()=>setFilter(f)} style={{ padding:'5px 12px', background:filter===f?T.red:T.white, color:filter===f?T.white:T.sub, border:`1px solid ${filter===f?T.red:T.bdr}`, borderRadius:20, fontSize:11, fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}>
            {label}
          </button>
        ))}
      </div>

      {loading?<div style={{ textAlign:'center', padding:60, color:T.muted }}>Loading alerts…</div>
      :displayed.length===0?<div style={{ background:T.white, border:`1px solid ${T.bdr}`, borderRadius:12, padding:60, textAlign:'center' }}>
        <div style={{ fontSize:40, marginBottom:10 }}>🔔</div>
        <div style={{ fontSize:15, fontWeight:700, color:T.sub }}>No alerts</div>
        <div style={{ fontSize:12, color:T.muted, marginTop:4 }}>Click "Auto-Generate" to scan for birthdays and low stock</div>
      </div>
      :<div style={{ display:'flex', flexDirection:'column', gap:10 }}>{displayed.map(a=><AlertCard key={a.id} alert={a}/>)}</div>}

      {showForm&&(
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.5)', zIndex:200, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
          <div style={{ background:T.white, borderRadius:16, padding:28, width:'100%', maxWidth:440, boxShadow:'0 20px 60px rgba(0,0,0,.2)' }}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:20 }}>
              <div style={{ fontSize:17, fontWeight:800, color:T.darkRed }}>Custom Alert</div>
              <button onClick={()=>setShowForm(false)} style={{ background:'none', border:'none', fontSize:22, cursor:'pointer', color:T.muted }}>×</button>
            </div>
            <form onSubmit={saveCustom}>
              <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                <div><label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:4 }}>Type</label>
                  <select value={form.type} onChange={e=>setForm(f=>({...f,type:e.target.value}))} style={{ ...inp, cursor:'pointer' }}>
                    {Object.entries(ALERT_CONFIG).map(([k,v])=><option key={k} value={k}>{v.icon} {v.label}</option>)}
                  </select>
                </div>
                <div><label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:4 }}>Title *</label><input value={form.title} onChange={e=>setForm(f=>({...f,title:e.target.value}))} required style={inp}/></div>
                <div><label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:4 }}>Message</label><textarea value={form.message} onChange={e=>setForm(f=>({...f,message:e.target.value}))} rows={3} style={{ ...inp, resize:'vertical' }}/></div>
                <div><label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:4 }}>Due Date</label><input type="date" value={form.due_date} onChange={e=>setForm(f=>({...f,due_date:e.target.value}))} style={inp}/></div>
              </div>
              <div style={{ display:'flex', gap:10, marginTop:20 }}>
                <button type="button" onClick={()=>setShowForm(false)} style={{ flex:1, background:T.bg, color:T.sub, border:`1px solid ${T.bdr}`, borderRadius:9, padding:'12px', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>Cancel</button>
                <button type="submit" disabled={saving} style={{ flex:2, ...btn(T.red, T.white), padding:'12px', fontSize:13 }}>{saving?'Saving…':'🔔 Add Alert'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
