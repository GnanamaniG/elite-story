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

const LEVELS = {
  1: { label:'Gentle',  color:'#2563EB', bg:'#EFF6FF', tone:'friendly'  },
  2: { label:'Firm',    color:'#D97706', bg:'#FFFBEB', tone:'firm'      },
  3: { label:'Final',   color:'#C0392B', bg:'#FEF2F2', tone:'final'     },
};

export default function PaymentReminders({ tenant }) {
  const [reminders, setReminders] = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [scanning,  setScanning]  = useState(false);
  const [filter,    setFilter]    = useState('pending');
  const [promiseId, setPromiseId] = useState(null);
  const [promiseDate, setPromiseDate] = useState('');

  useEffect(() => { if (tenant?.id) load(); }, [tenant?.id]);

  async function load() {
    setLoading(true);
    const { data } = await supabase.from('payment_reminders').select('*').eq('tenant_id', tenant.id).order('days_overdue', { ascending:false });
    setReminders(data||[]);
    setLoading(false);
  }

  async function scanOverdue() {
    setScanning(true);
    const [credRes, custRes] = await Promise.all([
      supabase.from('credit_ledger').select('customer_id,customer,amount,type,date').eq('tenant_id', tenant.id),
      supabase.from('customers').select('id,name,phone').eq('tenant_id', tenant.id),
    ]);
    const ledger    = credRes.data || [];
    const customers = custRes.data || [];

    // Compute balance per customer
    const balances = {};
    ledger.forEach(l=>{
      const k = l.customer_id || l.customer;
      if (!k) return;
      if (!balances[k]) balances[k] = { amount:0, oldest:l.date, customer:l.customer };
      balances[k].amount += l.type==='credit' ? (l.amount||0) : -(l.amount||0);
      if (l.type==='credit' && l.date < balances[k].oldest) balances[k].oldest = l.date;
    });

    const today = new Date();
    const overdue = Object.entries(balances).filter(([k,v])=>v.amount>0).map(([k,v])=>{
      const cust = customers.find(c=>c.id===k) || customers.find(c=>c.name===v.customer);
      const days = Math.floor((today - new Date(v.oldest))/86400000);
      return {
        tenant_id: tenant.id, customer_id: cust?.id||null, customer: v.customer||cust?.name||'Unknown',
        phone: cust?.phone||'', amount_due: v.amount, due_since: v.oldest, days_overdue: days,
        reminder_level: days>60?3:days>30?2:1, status:'pending',
      };
    });

    // Clear pending, insert fresh
    await supabase.from('payment_reminders').delete().eq('tenant_id', tenant.id).eq('status','pending');
    if (overdue.length>0) await supabase.from('payment_reminders').insert(overdue);
    setScanning(false); await load();
    alert(`✅ Found ${overdue.length} customers with outstanding balance`);
  }

  function buildMessage(r) {
    const lvl = LEVELS[r.reminder_level] || LEVELS[1];
    if (lvl.tone==='friendly') {
      return `Hi ${r.customer}! 😊\n\nHope you're doing well!\n\nThis is a friendly reminder about your pending balance with *${tenant?.name||'7SQ'}*:\n\n💰 Amount Due: *${fmt(r.amount_due)}*\n📅 Outstanding since: ${r.due_since}\n\nWhenever convenient, please settle at your earliest. Let us know if you need any clarification.\n\nThank you! 🙏`;
    }
    if (lvl.tone==='firm') {
      return `Dear ${r.customer},\n\n*Payment Reminder — ${tenant?.name||'7SQ'}*\n\nYour account has an outstanding balance:\n\n💰 Amount Due: *${fmt(r.amount_due)}*\n📅 Overdue by: *${r.days_overdue} days*\n\nWe request you to clear this amount at the earliest to keep your credit account active.\n\nIf you have already paid, please share the payment details.\n\nThank you for your cooperation.\n\n— ${tenant?.name||'7SQ'}`;
    }
    return `Dear ${r.customer},\n\n*FINAL PAYMENT NOTICE*\n${tenant?.name||'7SQ'}\n\nDespite previous reminders, the following amount remains unpaid:\n\n💰 Amount Due: *${fmt(r.amount_due)}*\n📅 Overdue by: *${r.days_overdue} days*\n\nPlease settle this within 7 days to avoid suspension of your credit facility.\n\nIf you are facing difficulty, please contact us to discuss a payment plan.\n\n— ${tenant?.name||'7SQ'}`;
  }

  async function sendReminder(r) {
    const msg = buildMessage(r);
    const ph  = (r.phone||'').replace(/\D/g,'').replace(/^0/,'91');
    window.open(`https://wa.me/${ph}?text=${encodeURIComponent(msg)}`, '_blank');
    await supabase.from('payment_reminders').update({ last_sent:new Date().toISOString(), sent_count:(r.sent_count||0)+1 }).eq('id', r.id);
    setReminders(prev=>prev.map(x=>x.id===r.id?{...x,sent_count:(x.sent_count||0)+1,last_sent:new Date().toISOString()}:x));
  }

  async function markStatus(id, status, extra={}) {
    await supabase.from('payment_reminders').update({ status, ...extra }).eq('id', id);
    setReminders(prev=>prev.map(x=>x.id===id?{...x,status,...extra}:x));
    setPromiseId(null); setPromiseDate('');
  }

  async function escalate(r) {
    const newLevel = Math.min(3, (r.reminder_level||1)+1);
    await supabase.from('payment_reminders').update({ reminder_level:newLevel }).eq('id', r.id);
    setReminders(prev=>prev.map(x=>x.id===r.id?{...x,reminder_level:newLevel}:x));
  }

  const displayed  = filter==='all'?reminders:reminders.filter(r=>r.status===filter);
  const totalDue   = reminders.filter(r=>r.status==='pending').reduce((s,r)=>s+(r.amount_due||0),0);
  const critical   = reminders.filter(r=>r.status==='pending'&&r.days_overdue>60);
  const collected  = reminders.filter(r=>r.status==='paid').reduce((s,r)=>s+(r.amount_due||0),0);

  // Ageing buckets
  const buckets = [
    { label:'0-30 days',  min:0,   max:30,  color:T.blue  },
    { label:'31-60 days', min:31,  max:60,  color:T.amber },
    { label:'61-90 days', min:61,  max:90,  color:T.red   },
    { label:'90+ days',   min:91,  max:9999,color:T.darkRed },
  ].map(b=>({ ...b, amount: reminders.filter(r=>r.status==='pending'&&r.days_overdue>=b.min&&r.days_overdue<=b.max).reduce((s,r)=>s+(r.amount_due||0),0), count: reminders.filter(r=>r.status==='pending'&&r.days_overdue>=b.min&&r.days_overdue<=b.max).length }));

  return (
    <div style={{ padding:24, background:T.bg, minHeight:'100%' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
        <div>
          <div style={{ fontSize:18, fontWeight:800, color:T.darkRed }}>💰 Payment Reminders</div>
          <div style={{ fontSize:12, color:T.sub, marginTop:2 }}>Chase overdue credit with escalating WhatsApp reminders</div>
        </div>
        <button onClick={scanOverdue} disabled={scanning} style={btn(T.red, T.white)}>{scanning?'Scanning…':'🔍 Scan Outstanding'}</button>
      </div>

      {critical.length>0&&<div style={{ background:'#FEF2F2', border:'1px solid #FECACA', borderRadius:10, padding:'11px 16px', marginBottom:16 }}>
        <span style={{ fontSize:13, fontWeight:600, color:T.red }}>🚨 {critical.length} customers overdue by 60+ days — {fmt(critical.reduce((s,r)=>s+r.amount_due,0))} at risk</span>
      </div>}

      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:14, marginBottom:18 }}>
        {[['Total Outstanding',fmt(totalDue),T.red,'💰'],['Customers',reminders.filter(r=>r.status==='pending').length,T.blue,'👥'],['Promised',reminders.filter(r=>r.status==='promised').length,T.amber,'🤝'],['Collected',fmt(collected),T.green,'✅']].map(([label,val,color,icon])=>(
          <div key={label} style={{ background:T.white, border:`1px solid ${T.bdr}`, borderRadius:12, padding:'16px 18px', boxShadow:'0 1px 4px rgba(0,0,0,.05)' }}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:6 }}>
              <div style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.05em' }}>{label}</div>
              <span style={{ fontSize:18 }}>{icon}</span>
            </div>
            <div style={{ fontSize:20, fontWeight:900, color, letterSpacing:'-0.02em' }}>{val}</div>
          </div>
        ))}
      </div>

      {/* Ageing */}
      <div style={{ background:T.white, border:`1px solid ${T.bdr}`, borderRadius:12, padding:'14px 18px', marginBottom:16 }}>
        <div style={{ fontSize:11, fontWeight:700, color:T.darkRed, textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:10 }}>Receivables Ageing</div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12 }}>
          {buckets.map(b=>(
            <div key={b.label}>
              <div style={{ display:'flex', justifyContent:'space-between', fontSize:11, marginBottom:4 }}>
                <span style={{ color:T.sub }}>{b.label}</span>
                <span style={{ color:b.color, fontWeight:700 }}>{b.count}</span>
              </div>
              <div style={{ height:6, background:'#F3F4F6', borderRadius:3, overflow:'hidden', marginBottom:4 }}>
                <div style={{ height:'100%', width:totalDue>0?`${b.amount/totalDue*100}%`:'0%', background:b.color, borderRadius:3 }}/>
              </div>
              <div style={{ fontSize:13, fontWeight:800, color:b.color }}>{fmt(b.amount)}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display:'flex', gap:6, marginBottom:14 }}>
        {[['pending','Pending'],['promised','Promised'],['paid','Paid'],['disputed','Disputed'],['all','All']].map(([f,label])=>(
          <button key={f} onClick={()=>setFilter(f)} style={{ padding:'6px 14px', background:filter===f?T.red:T.white, color:filter===f?T.white:T.sub, border:`1px solid ${filter===f?T.red:T.bdr}`, borderRadius:20, fontSize:11, fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}>
            {label} ({f==='all'?reminders.length:reminders.filter(r=>r.status===f).length})
          </button>
        ))}
      </div>

      <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
        {loading?<div style={{ textAlign:'center', padding:60, color:T.muted }}>Loading…</div>
        :displayed.length===0?<div style={{ background:T.white, border:`1px solid ${T.bdr}`, borderRadius:12, padding:60, textAlign:'center' }}>
          <div style={{ fontSize:40, marginBottom:10 }}>💰</div>
          <div style={{ color:T.muted, fontWeight:600 }}>No outstanding payments</div>
          <div style={{ color:T.muted, fontSize:12, marginTop:4 }}>Click "Scan Outstanding" to check credit ledger</div>
        </div>
        :displayed.map(r=>{
          const lvl = LEVELS[r.reminder_level]||LEVELS[1];
          return (
            <div key={r.id} style={{ background:T.white, border:`1px solid ${r.days_overdue>60?'#FECACA':T.bdr}`, borderRadius:12, padding:'14px 18px', display:'flex', gap:16, alignItems:'center', boxShadow:'0 1px 3px rgba(0,0,0,.04)' }}>
              <div style={{ flex:1 }}>
                <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:4 }}>
                  <span style={{ fontSize:14, fontWeight:700, color:T.ink }}>{r.customer}</span>
                  <span style={{ background:lvl.bg, color:lvl.color, border:`1px solid ${lvl.color}33`, borderRadius:5, padding:'1px 8px', fontSize:9, fontWeight:700 }}>Level {r.reminder_level} · {lvl.label}</span>
                  {r.status==='promised'&&<span style={{ background:'#FFFBEB', color:T.amber, border:'1px solid #FDE68A', borderRadius:5, padding:'1px 8px', fontSize:9, fontWeight:700 }}>🤝 Promised {r.promised_date}</span>}
                  {r.status==='paid'&&<span style={{ background:'#F0FDF4', color:T.green, border:'1px solid #BBF7D0', borderRadius:5, padding:'1px 8px', fontSize:9, fontWeight:700 }}>✅ Paid</span>}
                </div>
                <div style={{ fontSize:11, color:T.sub }}>{r.phone||'No phone'} · Outstanding since {r.due_since} · {r.sent_count||0} reminder{r.sent_count!==1?'s':''} sent</div>
              </div>
              <div style={{ textAlign:'right', minWidth:120 }}>
                <div style={{ fontSize:20, fontWeight:900, color:T.red }}>{fmt(r.amount_due)}</div>
                <span style={{ background:r.days_overdue>60?'#FEF2F2':r.days_overdue>30?'#FFFBEB':'#EFF6FF', color:r.days_overdue>60?T.red:r.days_overdue>30?T.amber:T.blue, border:`1px solid ${r.days_overdue>60?'#FECACA':r.days_overdue>30?'#FDE68A':'#BFDBFE'}`, borderRadius:5, padding:'2px 8px', fontSize:10, fontWeight:700 }}>{r.days_overdue}d overdue</span>
              </div>
              <div style={{ display:'flex', gap:6, flexShrink:0 }}>
                {r.status==='pending'&&<>
                  {r.phone&&<button onClick={()=>sendReminder(r)} style={{ background:'#DCFCE7', color:T.green, border:'none', borderRadius:7, padding:'6px 12px', fontSize:11, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>💬 Remind</button>}
                  {r.reminder_level<3&&<button onClick={()=>escalate(r)} style={{ background:'#FFFBEB', color:T.amber, border:'none', borderRadius:7, padding:'6px 12px', fontSize:11, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>⬆️ Escalate</button>}
                  <button onClick={()=>setPromiseId(r.id)} style={{ background:'#EFF6FF', color:T.blue, border:'none', borderRadius:7, padding:'6px 12px', fontSize:11, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>🤝 Promise</button>
                  <button onClick={()=>markStatus(r.id,'paid')} style={{ background:T.lightRed, color:T.red, border:`1px solid ${T.bdr}`, borderRadius:7, padding:'6px 12px', fontSize:11, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>✅ Paid</button>
                </>}
                {r.status==='promised'&&<button onClick={()=>markStatus(r.id,'paid')} style={{ background:'#F0FDF4', color:T.green, border:'none', borderRadius:7, padding:'6px 12px', fontSize:11, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>✅ Mark Paid</button>}
              </div>
            </div>
          );
        })}
      </div>

      {promiseId&&(
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.5)', zIndex:200, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
          <div style={{ background:T.white, borderRadius:16, padding:28, width:'100%', maxWidth:380, boxShadow:'0 20px 60px rgba(0,0,0,.2)' }}>
            <div style={{ fontSize:16, fontWeight:800, color:T.darkRed, marginBottom:16 }}>Payment Promised</div>
            <label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:5 }}>Promised Date</label>
            <input type="date" value={promiseDate} onChange={e=>setPromiseDate(e.target.value)} style={{ ...inp, marginBottom:16 }}/>
            <div style={{ display:'flex', gap:10 }}>
              <button onClick={()=>setPromiseId(null)} style={{ flex:1, background:T.bg, color:T.sub, border:`1px solid ${T.bdr}`, borderRadius:9, padding:'11px', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>Cancel</button>
              <button onClick={()=>markStatus(promiseId,'promised',{ promised_date:promiseDate })} style={{ flex:2, ...btn(T.red, T.white), padding:'11px' }}>🤝 Save Promise</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
