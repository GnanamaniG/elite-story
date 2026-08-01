import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

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
const fmt = n => 'Rs.' + (n||0).toLocaleString('en-IN', { maximumFractionDigits:0 });

function calcEMI(principal, rate, months) {
  if (rate === 0) return principal / months;
  const r = rate / 100 / 12;
  return principal * r * Math.pow(1+r,months) / (Math.pow(1+r,months)-1);
}

export default function EMIManager({ tenant }) {
  const [plans,    setPlans]    = useState([]);
  const [payments, setPayments] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [selPlan,  setSelPlan]  = useState(null);
  const [filter,   setFilter]   = useState('active');
  const [saving,   setSaving]   = useState(false);

  const [form, setForm] = useState({ customer:'', customer_phone:'', total_amount:'', down_payment:'0', interest_rate:'0', tenure_months:'6', notes:'' });
  const loanAmt  = (parseFloat(form.total_amount)||0) - (parseFloat(form.down_payment)||0);
  const emiAmt   = loanAmt > 0 ? calcEMI(loanAmt, parseFloat(form.interest_rate)||0, parseInt(form.tenure_months)||1) : 0;

  useEffect(() => { if (tenant?.id) load(); }, [tenant?.id]);

  async function load() {
    setLoading(true);
    const [pRes, payRes] = await Promise.all([
      supabase.from('emi_plans').select('*').eq('tenant_id', tenant.id).order('created_at', { ascending:false }),
      supabase.from('emi_payments').select('*').eq('tenant_id', tenant.id).order('due_date'),
    ]);
    setPlans(pRes.data||[]);
    setPayments(payRes.data||[]);
    setLoading(false);
  }

  async function createPlan(e) {
    e.preventDefault();
    const loan   = (parseFloat(form.total_amount)||0) - (parseFloat(form.down_payment)||0);
    const emi    = calcEMI(loan, parseFloat(form.interest_rate)||0, parseInt(form.tenure_months)||1);
    const months = parseInt(form.tenure_months)||1;
    setSaving(true);
    try {
      const { data:plan } = await supabase.from('emi_plans').insert({
        tenant_id:tenant.id, customer:form.customer, customer_phone:form.customer_phone,
        total_amount:parseFloat(form.total_amount)||0, down_payment:parseFloat(form.down_payment)||0,
        loan_amount:loan, interest_rate:parseFloat(form.interest_rate)||0,
        tenure_months:months, emi_amount:Math.round(emi*100)/100, notes:form.notes
      }).select().single();

      // Generate installments
      const installments = Array.from({length:months},(_,i)=>{
        const due = new Date(); due.setMonth(due.getMonth()+i+1);
        return { tenant_id:tenant.id, emi_plan_id:plan.id, installment_no:i+1, due_date:due.toISOString().slice(0,10), amount:Math.round(emi*100)/100, status:'pending' };
      });
      await supabase.from('emi_payments').insert(installments);
      setShowForm(false);
      setForm({ customer:'', customer_phone:'', total_amount:'', down_payment:'0', interest_rate:'0', tenure_months:'6', notes:'' });
      await load();
    } catch(e) { alert('Error: '+e.message); }
    finally { setSaving(false); }
  }

  async function markPaid(payment) {
    const mode = prompt('Payment mode? (cash/upi/card)', 'cash');
    if (!mode) return;
    await supabase.from('emi_payments').update({ status:'paid', paid_date:new Date().toISOString().slice(0,10), paid_amount:payment.amount, payment_mode:mode }).eq('id', payment.id);
    // Check if all paid → complete plan
    const planPayments = payments.filter(p=>p.emi_plan_id===payment.emi_plan_id);
    const allPaid = planPayments.filter(p=>p.id!==payment.id&&p.status==='paid').length === planPayments.length-1;
    if (allPaid) await supabase.from('emi_plans').update({ status:'completed' }).eq('id', payment.emi_plan_id);
    await load();
  }

  function sendReminder(plan, payment) {
    const msg = `Hi ${plan.customer}! 📅\n\nEMI Reminder from *${tenant?.name||'Elite Store'}*\n\nInstalment #${payment.installment_no} of ${plan.tenure_months}\n💰 Amount Due: *${fmt(payment.amount)}*\n📅 Due Date: *${payment.due_date}*\n\nTotal Purchase: ${fmt(plan.total_amount)}\nBalance: ${fmt((plan.tenure_months - (payments.filter(p=>p.emi_plan_id===plan.id&&p.status==='paid').length)) * plan.emi_amount)}\n\nPlease make your payment on time. Thank you! 🙏`;
    const ph  = (plan.customer_phone||'').replace(/\D/g,'').replace(/^0/,'91');
    window.open(`https://wa.me/${ph||''}?text=${encodeURIComponent(msg)}`, '_blank');
  }

  const today = new Date().toISOString().slice(0,10);
  const overduePays = payments.filter(p=>p.status==='pending'&&p.due_date<today);
  const dueTodayPays= payments.filter(p=>p.status==='pending'&&p.due_date===today);
  const displayed   = filter==='all'?plans:plans.filter(p=>p.status===filter);
  const totalPortfolio = plans.filter(p=>p.status==='active').reduce((s,p)=>s+p.loan_amount,0);
  const inp = { background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:8, padding:'9px 12px', color:T.ink, fontSize:13, fontFamily:'inherit', outline:'none', width:'100%' };

  return (
    <div style={{ padding:20 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
        <div>
          <div style={{ fontSize:22, fontWeight:800, color:T.ink }}>💳 EMI / BNPL Manager</div>
          <div style={{ fontSize:13, color:T.sub }}>{plans.filter(p=>p.status==='active').length} active plans · {fmt(totalPortfolio)} portfolio</div>
        </div>
        <button onClick={()=>setShowForm(true)} style={{ background:T.blue, color:'#fff', border:'none', borderRadius:9, padding:'10px 18px', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>+ New EMI Plan</button>
      </div>

      {/* Alerts */}
      {overduePays.length>0&&<div style={{ background:T.red+'12', border:`1px solid ${T.red}33`, borderRadius:10, padding:'10px 14px', marginBottom:14 }}>
        <div style={{ fontSize:13, fontWeight:700, color:T.red, marginBottom:6 }}>⚠️ {overduePays.length} Overdue Payments — {fmt(overduePays.reduce((s,p)=>s+(p.amount||0),0))} pending</div>
        <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
          {overduePays.slice(0,4).map(p=>{const plan=plans.find(x=>x.id===p.emi_plan_id);return plan?<button key={p.id} onClick={()=>sendReminder(plan,p)} style={{ background:T.red+'22', color:T.red, border:'none', borderRadius:6, padding:'4px 10px', fontSize:11, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>💬 Remind {plan.customer}</button>:null;})}
        </div>
      </div>}

      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12, marginBottom:18 }}>
        {[['Active Plans',plans.filter(p=>p.status==='active').length,T.blue],['Overdue',overduePays.length,T.red],['Due Today',dueTodayPays.length,T.amber],['Completed',plans.filter(p=>p.status==='completed').length,T.green]].map(([label,val,color])=>(
          <div key={label} style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:10, padding:'12px 16px' }}>
            <div style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', marginBottom:5 }}>{label}</div>
            <div style={{ fontSize:20, fontWeight:800, color }}>{val}</div>
          </div>
        ))}
      </div>

      <div style={{ display:'flex', gap:8, marginBottom:14 }}>
        {['active','completed','defaulted','all'].map(f=>(
          <button key={f} onClick={()=>{setFilter(f);setSelPlan(null);}} style={{ background:filter===f?T.blue:T.srf, color:filter===f?'#fff':T.sub, border:`1px solid ${filter===f?T.blue:T.bdr}`, borderRadius:7, padding:'6px 12px', fontSize:12, cursor:'pointer', fontFamily:'inherit', textTransform:'capitalize' }}>
            {f} ({f==='all'?plans.length:plans.filter(p=>p.status===f).length})
          </button>
        ))}
      </div>

      <div style={{ display:'grid', gridTemplateColumns:selPlan?'1fr 1fr':'1fr', gap:16 }}>
        {/* Plans list */}
        <div style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:12, overflow:'hidden' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
            <thead><tr style={{ background:T.card }}>
              {['Customer','Total','Down Pmt','EMI','Tenure','Paid','Status'].map(h=><th key={h} style={{ padding:'9px 12px', textAlign:'left', fontSize:9, color:T.sub, fontWeight:700, textTransform:'uppercase', borderBottom:`1px solid ${T.bdr}` }}>{h}</th>)}
            </tr></thead>
            <tbody>
              {loading?<tr><td colSpan={7} style={{ textAlign:'center', padding:40, color:T.sub }}>Loading…</td></tr>
              :displayed.map(p=>{
                const planPays = payments.filter(x=>x.emi_plan_id===p.id);
                const paidCount= planPays.filter(x=>x.status==='paid').length;
                const pct = p.tenure_months>0?Math.round(paidCount/p.tenure_months*100):0;
                return (
                  <tr key={p.id} onClick={()=>setSelPlan(selPlan?.id===p.id?null:p)} style={{ borderBottom:`1px solid ${T.bdr}22`, cursor:'pointer', background:selPlan?.id===p.id?T.blue+'18':'transparent' }}>
                    <td style={{ padding:'10px 12px', color:T.ink, fontWeight:600 }}>{p.customer}<br/><span style={{ fontSize:10, color:T.muted }}>{p.customer_phone}</span></td>
                    <td style={{ padding:'10px 12px', color:T.blue }}>{fmt(p.total_amount)}</td>
                    <td style={{ padding:'10px 12px', color:T.sub }}>{fmt(p.down_payment)}</td>
                    <td style={{ padding:'10px 12px', color:T.green, fontWeight:700 }}>{fmt(p.emi_amount)}/mo</td>
                    <td style={{ padding:'10px 12px', color:T.sub }}>{p.tenure_months}m</td>
                    <td style={{ padding:'10px 12px' }}>
                      <div style={{ fontSize:11, color:T.ink }}>{paidCount}/{p.tenure_months}</div>
                      <div style={{ height:4, background:T.bdr, borderRadius:2, width:60, marginTop:3 }}><div style={{ height:'100%', width:`${pct}%`, background:T.green, borderRadius:2 }}/></div>
                    </td>
                    <td style={{ padding:'10px 12px' }}><span style={{ background:p.status==='active'?T.green+'22':p.status==='completed'?T.blue+'22':T.red+'22', color:p.status==='active'?T.green:p.status==='completed'?T.blue:T.red, borderRadius:5, padding:'2px 8px', fontSize:10, fontWeight:700, textTransform:'capitalize' }}>{p.status}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Installment schedule */}
        {selPlan&&<div style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:12, overflow:'hidden' }}>
          <div style={{ padding:'12px 16px', borderBottom:`1px solid ${T.bdr}`, display:'flex', justifyContent:'space-between' }}>
            <div style={{ fontWeight:700, color:T.ink }}>{selPlan.customer} — Schedule</div>
            {selPlan.customer_phone&&<button onClick={()=>{const ov=payments.find(p=>p.emi_plan_id===selPlan.id&&p.status==='pending');if(ov)sendReminder(selPlan,ov);}} style={{ background:'#25d36622', color:'#25d366', border:'none', borderRadius:6, padding:'4px 10px', fontSize:11, cursor:'pointer', fontFamily:'inherit' }}>💬 Remind</button>}
          </div>
          <div style={{ maxHeight:400, overflowY:'auto' }}>
            {payments.filter(p=>p.emi_plan_id===selPlan.id).map(p=>{
              const overdue = p.status==='pending'&&p.due_date<today;
              return (
                <div key={p.id} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'10px 16px', borderBottom:`1px solid ${T.bdr}22`, background:overdue?T.red+'08':'transparent' }}>
                  <div>
                    <div style={{ fontSize:12, fontWeight:700, color:T.ink }}>Instalment #{p.installment_no}</div>
                    <div style={{ fontSize:11, color:overdue?T.red:T.muted }}>Due: {p.due_date}{overdue?' ⚠️ OVERDUE':''}</div>
                  </div>
                  <div style={{ textAlign:'right' }}>
                    <div style={{ fontSize:14, fontWeight:700, color:T.green }}>{fmt(p.amount)}</div>
                    {p.status==='paid'?<span style={{ fontSize:10, color:T.green }}>✅ Paid {p.paid_date}</span>
                    :<button onClick={()=>markPaid(p)} style={{ background:T.green+'22', color:T.green, border:'none', borderRadius:5, padding:'4px 10px', fontSize:10, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>Mark Paid</button>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>}
      </div>

      {showForm&&(
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.8)', zIndex:200, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
          <div style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:14, padding:24, width:'100%', maxWidth:460 }}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:18 }}>
              <div style={{ fontSize:17, fontWeight:700, color:T.ink }}>New EMI Plan</div>
              <button onClick={()=>setShowForm(false)} style={{ background:'none', border:'none', color:T.muted, cursor:'pointer', fontSize:22 }}>×</button>
            </div>
            <form onSubmit={createPlan}>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                {[['Customer Name *','text','customer'],['Phone','tel','customer_phone'],['Total Amount (Rs.) *','number','total_amount'],['Down Payment','number','down_payment'],['Interest Rate (% p.a.)','number','interest_rate'],['Tenure (months) *','number','tenure_months']].map(([label,type,key])=>(
                  <div key={key}><label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:4 }}>{label}</label><input type={type} value={form[key]} onChange={e=>setForm(f=>({...f,[key]:e.target.value}))} required={label.includes('*')} style={inp}/></div>
                ))}
              </div>
              {/* EMI Preview */}
              {loanAmt>0&&<div style={{ background:T.card, borderRadius:9, padding:'12px 16px', margin:'14px 0', display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:10 }}>
                {[['Loan Amount',fmt(loanAmt),T.blue],['Monthly EMI',fmt(Math.round(emiAmt)),T.green],['Total Payable',fmt(Math.round(emiAmt)*parseInt(form.tenure_months||0)+(parseFloat(form.down_payment)||0)),T.purple]].map(([label,val,color])=>(
                  <div key={label} style={{ textAlign:'center' }}><div style={{ fontSize:9, color:T.sub, marginBottom:3, fontWeight:700 }}>{label}</div><div style={{ fontSize:15, fontWeight:800, color }}>{val}</div></div>
                ))}
              </div>}
              <div style={{ marginBottom:14 }}><label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:4 }}>Notes</label><input value={form.notes} onChange={e=>setForm(f=>({...f,notes:e.target.value}))} style={inp}/></div>
              <div style={{ display:'flex', gap:10 }}>
                <button type="button" onClick={()=>setShowForm(false)} style={{ flex:1, background:T.card, color:T.sub, border:`1px solid ${T.bdr}`, borderRadius:8, padding:'11px', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>Cancel</button>
                <button type="submit" disabled={saving} style={{ flex:2, background:T.blue, color:'#fff', border:'none', borderRadius:8, padding:'11px', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>{saving?'Creating…':'Create EMI Plan'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
