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

const MODES = ['cash','upi','bank_transfer','cheque','card'];

export default function SupplierPayments({ tenant }) {
  const [payments,  setPayments]  = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [showForm,  setShowForm]  = useState(false);
  const [saving,    setSaving]    = useState(false);
  const [view,      setView]      = useState('payable');
  const [form, setForm] = useState({ supplier:'', supplier_id:'', purchase_id:'', invoice_ref:'', invoice_amt:'', paid_amount:'', payment_mode:'cash', payment_date:new Date().toISOString().slice(0,10), ref_no:'', notes:'' });

  useEffect(() => { if (tenant?.id) load(); }, [tenant?.id]);

  async function load() {
    setLoading(true);
    const [payRes, purRes, supRes] = await Promise.all([
      supabase.from('supplier_payments').select('*').eq('tenant_id', tenant.id).order('payment_date', { ascending:false }),
      supabase.from('purchases').select('id,po_number,supplier,total,date,status').eq('tenant_id', tenant.id).order('date', { ascending:false }),
      supabase.from('suppliers').select('id,name,phone').eq('tenant_id', tenant.id).order('name'),
    ]);
    setPayments(payRes.data||[]);
    setPurchases(purRes.data||[]);
    setSuppliers(supRes.data||[]);
    setLoading(false);
  }

  function genNo() { return `SPY/${new Date().getFullYear()}/${String(Date.now()).slice(-5)}`; }

  async function savePayment(e) {
    e.preventDefault(); setSaving(true);
    const invAmt = parseFloat(form.invoice_amt)||0;
    const paid   = parseFloat(form.paid_amount)||0;
    await supabase.from('supplier_payments').insert({
      ...form, tenant_id:tenant.id, payment_no:genNo(),
      invoice_amt:invAmt, paid_amount:paid, balance:invAmt-paid,
      purchase_id:form.purchase_id||null, supplier_id:form.supplier_id||null,
    });
    setShowForm(false);
    setForm({ supplier:'', supplier_id:'', purchase_id:'', invoice_ref:'', invoice_amt:'', paid_amount:'', payment_mode:'cash', payment_date:new Date().toISOString().slice(0,10), ref_no:'', notes:'' });
    setSaving(false); await load();
  }

  // Compute payables per purchase
  const payables = purchases.map(p=>{
    const paid = payments.filter(x=>x.purchase_id===p.id).reduce((s,x)=>s+(x.paid_amount||0),0);
    const bal  = (p.total||0) - paid;
    const days = Math.floor((new Date() - new Date(p.date))/86400000);
    return { ...p, paid, balance:bal, days };
  }).filter(p=>p.balance>0.5).sort((a,b)=>b.days-a.days);

  const totalPayable = payables.reduce((s,p)=>s+p.balance,0);
  const totalPaid    = payments.reduce((s,p)=>s+(p.paid_amount||0),0);
  const overdue      = payables.filter(p=>p.days>30);

  // Ageing buckets
  const buckets = [
    { label:'0-30 days',  min:0,  max:30,  color:T.blue    },
    { label:'31-60 days', min:31, max:60,  color:T.amber   },
    { label:'61-90 days', min:61, max:90,  color:T.red     },
    { label:'90+ days',   min:91, max:9999,color:T.darkRed },
  ].map(b=>({ ...b, amount: payables.filter(p=>p.days>=b.min&&p.days<=b.max).reduce((s,p)=>s+p.balance,0), count: payables.filter(p=>p.days>=b.min&&p.days<=b.max).length }));

  return (
    <div style={{ padding:24, background:T.bg, minHeight:'100%' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
        <div>
          <div style={{ fontSize:18, fontWeight:800, color:T.darkRed }}>🏦 Supplier Payments</div>
          <div style={{ fontSize:12, color:T.sub, marginTop:2 }}>Accounts payable, ageing and part-payment tracking</div>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <div style={{ display:'flex', background:T.white, border:`1px solid ${T.bdr}`, borderRadius:8, overflow:'hidden' }}>
            {[['payable','Payables'],['history','Payment History']].map(([v,l])=>(
              <button key={v} onClick={()=>setView(v)} style={{ padding:'8px 14px', background:view===v?T.red:'transparent', color:view===v?T.white:T.sub, border:'none', cursor:'pointer', fontFamily:'inherit', fontSize:12, fontWeight:600 }}>{l}</button>
            ))}
          </div>
          <button onClick={()=>setShowForm(true)} style={btn(T.red, T.white)}>+ Record Payment</button>
        </div>
      </div>

      {overdue.length>0&&<div style={{ background:'#FEF2F2', border:'1px solid #FECACA', borderRadius:10, padding:'11px 16px', marginBottom:16 }}>
        <span style={{ fontSize:13, fontWeight:600, color:T.red }}>⚠️ {overdue.length} supplier invoices overdue 30+ days — {fmt(overdue.reduce((s,p)=>s+p.balance,0))} outstanding</span>
      </div>}

      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:14, marginBottom:18 }}>
        {[['Total Payable',fmt(totalPayable),T.red,'💸'],['Open Invoices',payables.length,T.amber,'📄'],['Total Paid',fmt(totalPaid),T.green,'✅'],['Overdue 30+',fmt(overdue.reduce((s,p)=>s+p.balance,0)),T.darkRed,'⚠️']].map(([label,val,color,icon])=>(
          <div key={label} style={{ background:T.white, border:`1px solid ${T.bdr}`, borderRadius:12, padding:'16px 18px', boxShadow:'0 1px 4px rgba(0,0,0,.05)' }}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:6 }}>
              <div style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.05em' }}>{label}</div>
              <span style={{ fontSize:18 }}>{icon}</span>
            </div>
            <div style={{ fontSize:20, fontWeight:900, color, letterSpacing:'-0.02em' }}>{val}</div>
          </div>
        ))}
      </div>

      {view==='payable'&&<>
        <div style={{ background:T.white, border:`1px solid ${T.bdr}`, borderRadius:12, padding:'14px 18px', marginBottom:16 }}>
          <div style={{ fontSize:11, fontWeight:700, color:T.darkRed, textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:10 }}>Payables Ageing</div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12 }}>
            {buckets.map(b=>(
              <div key={b.label}>
                <div style={{ display:'flex', justifyContent:'space-between', fontSize:11, marginBottom:4 }}>
                  <span style={{ color:T.sub }}>{b.label}</span><span style={{ color:b.color, fontWeight:700 }}>{b.count}</span>
                </div>
                <div style={{ height:6, background:'#F3F4F6', borderRadius:3, overflow:'hidden', marginBottom:4 }}>
                  <div style={{ height:'100%', width:totalPayable>0?`${b.amount/totalPayable*100}%`:'0%', background:b.color, borderRadius:3 }}/>
                </div>
                <div style={{ fontSize:13, fontWeight:800, color:b.color }}>{fmt(b.amount)}</div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ background:T.white, border:`1px solid ${T.bdr}`, borderRadius:14, overflow:'hidden', boxShadow:'0 1px 4px rgba(0,0,0,.05)' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
            <thead><tr style={{ background:T.lightRed }}>
              {['PO Number','Supplier','Date','Age','Invoice','Paid','Balance','Action'].map(h=>(
                <th key={h} style={{ padding:'11px 14px', textAlign:['Invoice','Paid','Balance'].includes(h)?'right':'left', fontSize:9, color:T.darkRed, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.05em', borderBottom:`1px solid ${T.bdr}` }}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {loading?<tr><td colSpan={8} style={{ textAlign:'center', padding:50, color:T.muted }}>Loading…</td></tr>
              :payables.length===0?<tr><td colSpan={8} style={{ textAlign:'center', padding:50 }}>
                <div style={{ fontSize:36, marginBottom:8 }}>✅</div>
                <div style={{ color:T.green, fontWeight:700 }}>All supplier invoices paid</div>
              </td></tr>
              :payables.map(p=>(
                <tr key={p.id} style={{ borderBottom:`1px solid ${T.bdr}22`, background:p.days>60?'#FFFAFA':'transparent' }}>
                  <td style={{ padding:'11px 14px', fontFamily:'monospace', fontSize:11, color:T.blue, fontWeight:600 }}>{p.po_number}</td>
                  <td style={{ padding:'11px 14px', color:T.ink, fontWeight:600 }}>{p.supplier}</td>
                  <td style={{ padding:'11px 14px', color:T.muted, fontSize:11 }}>{p.date}</td>
                  <td style={{ padding:'11px 14px' }}>
                    <span style={{ background:p.days>60?'#FEF2F2':p.days>30?'#FFFBEB':'#EFF6FF', color:p.days>60?T.red:p.days>30?T.amber:T.blue, border:`1px solid ${p.days>60?'#FECACA':p.days>30?'#FDE68A':'#BFDBFE'}`, borderRadius:5, padding:'2px 8px', fontSize:10, fontWeight:700 }}>{p.days}d</span>
                  </td>
                  <td style={{ padding:'11px 14px', textAlign:'right', color:T.sub }}>{fmt(p.total)}</td>
                  <td style={{ padding:'11px 14px', textAlign:'right', color:T.green, fontWeight:600 }}>{fmt(p.paid)}</td>
                  <td style={{ padding:'11px 14px', textAlign:'right', color:T.red, fontWeight:800, fontSize:13 }}>{fmt(p.balance)}</td>
                  <td style={{ padding:'11px 14px' }}>
                    <button onClick={()=>{ setForm(f=>({...f, supplier:p.supplier, purchase_id:p.id, invoice_ref:p.po_number, invoice_amt:String(p.total), paid_amount:String(p.balance) })); setShowForm(true); }}
                      style={{ background:T.lightRed, color:T.red, border:`1px solid ${T.bdr}`, borderRadius:7, padding:'5px 12px', fontSize:10, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>💸 Pay</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </>}

      {view==='history'&&<div style={{ background:T.white, border:`1px solid ${T.bdr}`, borderRadius:14, overflow:'hidden', boxShadow:'0 1px 4px rgba(0,0,0,.05)' }}>
        <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
          <thead><tr style={{ background:T.lightRed }}>
            {['Payment No','Date','Supplier','Invoice Ref','Amount Paid','Balance','Mode','Ref'].map(h=>(
              <th key={h} style={{ padding:'11px 14px', textAlign:['Amount Paid','Balance'].includes(h)?'right':'left', fontSize:9, color:T.darkRed, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.05em', borderBottom:`1px solid ${T.bdr}` }}>{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {payments.length===0?<tr><td colSpan={8} style={{ textAlign:'center', padding:50, color:T.muted }}>No payments recorded</td></tr>
            :payments.map(p=>(
              <tr key={p.id} style={{ borderBottom:`1px solid ${T.bdr}22` }}>
                <td style={{ padding:'11px 14px', fontFamily:'monospace', fontSize:10, color:T.blue, fontWeight:600 }}>{p.payment_no}</td>
                <td style={{ padding:'11px 14px', color:T.muted, fontSize:11 }}>{p.payment_date}</td>
                <td style={{ padding:'11px 14px', color:T.ink, fontWeight:600 }}>{p.supplier}</td>
                <td style={{ padding:'11px 14px', color:T.sub, fontSize:11 }}>{p.invoice_ref||'—'}</td>
                <td style={{ padding:'11px 14px', textAlign:'right', color:T.green, fontWeight:700 }}>{fmt(p.paid_amount)}</td>
                <td style={{ padding:'11px 14px', textAlign:'right', color:p.balance>0?T.amber:T.green, fontWeight:600 }}>{fmt(p.balance)}</td>
                <td style={{ padding:'11px 14px' }}><span style={{ background:T.bg, color:T.sub, borderRadius:5, padding:'2px 8px', fontSize:10, textTransform:'uppercase' }}>{(p.payment_mode||'cash').replace('_',' ')}</span></td>
                <td style={{ padding:'11px 14px', color:T.muted, fontSize:10 }}>{p.ref_no||'—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>}

      {showForm&&(
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.5)', zIndex:200, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
          <div style={{ background:T.white, borderRadius:16, padding:28, width:'100%', maxWidth:480, boxShadow:'0 20px 60px rgba(0,0,0,.2)' }}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:20 }}>
              <div style={{ fontSize:17, fontWeight:800, color:T.darkRed }}>Record Supplier Payment</div>
              <button onClick={()=>setShowForm(false)} style={{ background:'none', border:'none', fontSize:22, cursor:'pointer', color:T.muted }}>×</button>
            </div>
            <form onSubmit={savePayment}>
              <div style={{ marginBottom:14 }}>
                <label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:5 }}>Link to Purchase Order</label>
                <select value={form.purchase_id} onChange={e=>{const p=purchases.find(x=>x.id===e.target.value);if(p)setForm(f=>({...f,purchase_id:p.id,supplier:p.supplier,invoice_ref:p.po_number,invoice_amt:String(p.total)}));}} style={{ ...inp, cursor:'pointer' }}>
                  <option value="">— Manual entry —</option>
                  {payables.map(p=><option key={p.id} value={p.id}>{p.po_number} · {p.supplier} · Balance {fmt(p.balance)}</option>)}
                </select>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:14 }}>
                <div style={{ gridColumn:'1/-1' }}><label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:4 }}>Supplier *</label><input value={form.supplier} onChange={e=>setForm(f=>({...f,supplier:e.target.value}))} required style={inp}/></div>
                <div><label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:4 }}>Invoice Ref</label><input value={form.invoice_ref} onChange={e=>setForm(f=>({...f,invoice_ref:e.target.value}))} style={inp}/></div>
                <div><label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:4 }}>Invoice Amount</label><input type="number" value={form.invoice_amt} onChange={e=>setForm(f=>({...f,invoice_amt:e.target.value}))} style={inp}/></div>
                <div><label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:4 }}>Amount Paid *</label><input type="number" value={form.paid_amount} onChange={e=>setForm(f=>({...f,paid_amount:e.target.value}))} required style={{ ...inp, fontWeight:700, color:T.green, fontSize:15 }}/></div>
                <div><label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:4 }}>Payment Mode</label>
                  <select value={form.payment_mode} onChange={e=>setForm(f=>({...f,payment_mode:e.target.value}))} style={{ ...inp, cursor:'pointer', textTransform:'capitalize' }}>
                    {MODES.map(m=><option key={m} value={m}>{m.replace('_',' ')}</option>)}
                  </select>
                </div>
                <div><label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:4 }}>Payment Date</label><input type="date" value={form.payment_date} onChange={e=>setForm(f=>({...f,payment_date:e.target.value}))} style={inp}/></div>
                <div><label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:4 }}>Ref / Cheque No</label><input value={form.ref_no} onChange={e=>setForm(f=>({...f,ref_no:e.target.value}))} style={inp}/></div>
              </div>
              {form.invoice_amt&&form.paid_amount&&<div style={{ background:T.lightRed, borderRadius:9, padding:'10px 14px', marginBottom:14, fontSize:12, display:'flex', justifyContent:'space-between' }}>
                <span style={{ color:T.sub }}>Remaining balance after payment</span>
                <strong style={{ color:(parseFloat(form.invoice_amt)-parseFloat(form.paid_amount))>0?T.amber:T.green }}>{fmt(parseFloat(form.invoice_amt)-parseFloat(form.paid_amount))}</strong>
              </div>}
              <div style={{ display:'flex', gap:10 }}>
                <button type="button" onClick={()=>setShowForm(false)} style={{ flex:1, background:T.bg, color:T.sub, border:`1px solid ${T.bdr}`, borderRadius:9, padding:'12px', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>Cancel</button>
                <button type="submit" disabled={saving} style={{ flex:2, ...btn(T.red, T.white), padding:'12px', fontSize:13 }}>{saving?'Saving…':'💸 Record Payment'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
