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
const fmt = n => 'Rs.' + (n||0).toLocaleString('en-IN', { minimumFractionDigits:2, maximumFractionDigits:2 });

export default function EODReport({ tenant }) {
  const [today,     setToday]     = useState(new Date().toISOString().slice(0,10));
  const [report,    setReport]    = useState(null);
  const [todaySales,setTodaySales]= useState([]);
  const [expenses,  setExpenses]  = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [cashInHand,setCashInHand]= useState('');
  const [openingCash,setOpeningCash]=useState('');
  const [notes,     setNotes]     = useState('');
  const [saving,    setSaving]    = useState(false);
  const [history,   setHistory]   = useState([]);

  useEffect(() => { if (tenant?.id) load(); }, [tenant?.id, today]);

  async function load() {
    setLoading(true);
    const [salesRes, expRes, eodRes, histRes] = await Promise.all([
      supabase.from('sales').select('*').eq('tenant_id', tenant.id).eq('date', today),
      supabase.from('expenses').select('amount,category').eq('tenant_id', tenant.id).eq('date', today),
      supabase.from('eod_reports').select('*').eq('tenant_id', tenant.id).eq('report_date', today).single(),
      supabase.from('eod_reports').select('*').eq('tenant_id', tenant.id).order('report_date', { ascending:false }).limit(7),
    ]);
    setTodaySales(salesRes.data||[]);
    setExpenses(expRes.data||[]);
    if (eodRes.data) {
      setReport(eodRes.data);
      setCashInHand(eodRes.data.cash_in_hand?.toString()||'');
      setOpeningCash(eodRes.data.opening_cash?.toString()||'');
      setNotes(eodRes.data.notes||'');
    } else {
      setReport(null);
      setCashInHand('');
    }
    setHistory(histRes.data||[]);
    setLoading(false);
  }

  const cashSales   = todaySales.filter(s=>s.payment_mode==='cash').reduce((t,s)=>t+(s.total||0),0);
  const upiSales    = todaySales.filter(s=>s.payment_mode==='upi').reduce((t,s)=>t+(s.total||0),0);
  const cardSales   = todaySales.filter(s=>s.payment_mode==='card').reduce((t,s)=>t+(s.total||0),0);
  const creditSales = todaySales.filter(s=>s.payment_mode==='credit').reduce((t,s)=>t+(s.total||0),0);
  const totalRevenue= todaySales.reduce((t,s)=>t+(s.total||0),0);
  const totalExp    = expenses.reduce((t,e)=>t+(e.amount||0),0);
  const cashExp     = totalExp;
  const opening     = parseFloat(openingCash)||0;
  const cashExpected= opening + cashSales - cashExp;
  const actual      = parseFloat(cashInHand)||0;
  const difference  = actual - cashExpected;

  async function saveEOD(status='open') {
    setSaving(true);
    const payload = {
      tenant_id:tenant.id, report_date:today, opening_cash:opening,
      cash_sales:cashSales, upi_sales:upiSales, card_sales:cardSales, credit_sales:creditSales,
      total_revenue:totalRevenue, total_orders:todaySales.length,
      cash_in_hand:actual, cash_expected:cashExpected, difference,
      expenses:totalExp, notes, status, closed_by:'Admin'
    };
    if (report) await supabase.from('eod_reports').update(payload).eq('id', report.id);
    else await supabase.from('eod_reports').insert(payload);
    await load();
    if (status==='closed') printEOD();
    setSaving(false);
  }

  function printEOD() {
    const w = window.open('', '_blank');
    w.document.write(`<!DOCTYPE html><html><head><style>
      body{font-family:'Courier New',monospace;font-size:12px;padding:10px;max-width:320px}
      .c{text-align:center}.b{font-weight:bold}.l{font-size:14px}
      .row{display:flex;justify-content:space-between;padding:2px 0}
      .line{border-top:1px dashed #000;margin:6px 0}
    </style></head><body>
    <div class="c b l">${tenant?.name||'Elite Store'}</div>
    <div class="c">END OF DAY REPORT</div>
    <div class="c">${today}</div>
    <div class="line"></div>
    <div class="b">SALES SUMMARY</div>
    <div class="row"><span>Total Orders</span><span>${todaySales.length}</span></div>
    <div class="row"><span>Cash Sales</span><span>Rs.${cashSales.toFixed(2)}</span></div>
    <div class="row"><span>UPI Sales</span><span>Rs.${upiSales.toFixed(2)}</span></div>
    <div class="row"><span>Card Sales</span><span>Rs.${cardSales.toFixed(2)}</span></div>
    <div class="row"><span>Credit Sales</span><span>Rs.${creditSales.toFixed(2)}</span></div>
    <div class="row b"><span>TOTAL REVENUE</span><span>Rs.${totalRevenue.toFixed(2)}</span></div>
    <div class="line"></div>
    <div class="b">CASH RECONCILIATION</div>
    <div class="row"><span>Opening Cash</span><span>Rs.${opening.toFixed(2)}</span></div>
    <div class="row"><span>Cash Sales (+)</span><span>Rs.${cashSales.toFixed(2)}</span></div>
    <div class="row"><span>Cash Expenses (-)</span><span>Rs.${cashExp.toFixed(2)}</span></div>
    <div class="row b"><span>Expected Cash</span><span>Rs.${cashExpected.toFixed(2)}</span></div>
    <div class="row b"><span>Actual Cash</span><span>Rs.${actual.toFixed(2)}</span></div>
    <div class="row b" style="color:${difference>=0?'green':'red'}"><span>Difference</span><span>${difference>=0?'+':''}Rs.${difference.toFixed(2)}</span></div>
    <div class="line"></div>
    ${notes?`<div>Notes: ${notes}</div><div class="line"></div>`:''}
    <div class="c">Closed by: Admin</div>
    <script>window.onload=()=>{window.print();setTimeout(()=>window.close(),500)}<\/script>
    </body></html>`);
    w.document.close();
  }

  return (
    <div style={{ padding:20 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
        <div>
          <div style={{ fontSize:22, fontWeight:800, color:T.ink }}>🌙 End of Day Report</div>
          <div style={{ fontSize:13, color:T.sub }}>Daily cash reconciliation and sales summary</div>
        </div>
        <div style={{ display:'flex', gap:8, alignItems:'center' }}>
          <input type="date" value={today} onChange={e=>setToday(e.target.value)} style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:8, padding:'8px 12px', color:T.ink, fontSize:13, fontFamily:'inherit', outline:'none' }}/>
          {report?.status==='closed'&&<span style={{ background:T.green+'22', color:T.green, borderRadius:8, padding:'9px 14px', fontSize:12, fontWeight:700 }}>✅ Closed</span>}
        </div>
      </div>

      {loading?<div style={{ textAlign:'center', color:T.sub, padding:60 }}>Loading…</div>:(
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
          {/* Left: Sales */}
          <div>
            <div style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:12, overflow:'hidden', marginBottom:14 }}>
              <div style={{ padding:'12px 16px', background:T.card, fontWeight:700, color:T.ink, borderBottom:`1px solid ${T.bdr}` }}>📊 Sales Summary — {today}</div>
              {[[`Cash Sales (${todaySales.filter(s=>s.payment_mode==='cash').length} orders)`,cashSales,T.green],[`UPI (${todaySales.filter(s=>s.payment_mode==='upi').length} orders)`,upiSales,T.blue],[`Card (${todaySales.filter(s=>s.payment_mode==='card').length} orders)`,cardSales,T.purple],[`Credit (${todaySales.filter(s=>s.payment_mode==='credit').length} orders)`,creditSales,T.amber]].map(([label,val,color])=>(
                <div key={label} style={{ display:'flex', justifyContent:'space-between', padding:'10px 16px', borderBottom:`1px solid ${T.bdr}22` }}>
                  <span style={{ fontSize:13, color:T.sub }}>{label}</span>
                  <span style={{ fontSize:13, fontWeight:600, color }}>{fmt(val)}</span>
                </div>
              ))}
              <div style={{ display:'flex', justifyContent:'space-between', padding:'12px 16px', background:T.card }}>
                <span style={{ fontWeight:800, color:T.ink }}>Total Revenue</span>
                <span style={{ fontWeight:800, fontSize:16, color:T.green }}>{fmt(totalRevenue)}</span>
              </div>
            </div>

            {/* Expense summary */}
            <div style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:12, overflow:'hidden', marginBottom:14 }}>
              <div style={{ padding:'12px 16px', background:T.card, fontWeight:700, color:T.ink, borderBottom:`1px solid ${T.bdr}` }}>💸 Today's Expenses</div>
              {expenses.length===0?<div style={{ padding:20, textAlign:'center', color:T.muted, fontSize:12 }}>No expenses today</div>
              :expenses.map((e,i)=>(
                <div key={i} style={{ display:'flex', justifyContent:'space-between', padding:'8px 16px', borderBottom:`1px solid ${T.bdr}22`, fontSize:13 }}>
                  <span style={{ color:T.sub }}>{e.category}</span>
                  <span style={{ color:T.red }}>{fmt(e.amount)}</span>
                </div>
              ))}
              {expenses.length>0&&<div style={{ display:'flex', justifyContent:'space-between', padding:'10px 16px', background:T.card }}>
                <span style={{ fontWeight:700, color:T.ink }}>Total Expenses</span>
                <span style={{ fontWeight:700, color:T.red }}>{fmt(totalExp)}</span>
              </div>}
            </div>

            {/* 7-day history */}
            <div style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:12, overflow:'hidden' }}>
              <div style={{ padding:'12px 16px', background:T.card, fontWeight:700, color:T.ink, borderBottom:`1px solid ${T.bdr}` }}>📅 Last 7 Days</div>
              {history.map(h=>(
                <div key={h.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'8px 14px', borderBottom:`1px solid ${T.bdr}22`, fontSize:12 }}>
                  <span style={{ color:T.sub }}>{h.report_date}</span>
                  <span style={{ color:T.blue }}>{h.total_orders} orders</span>
                  <span style={{ color:T.green, fontWeight:600 }}>{fmt(h.total_revenue)}</span>
                  <span style={{ color:Math.abs(h.difference||0)<1?T.green:T.red, fontSize:10, fontWeight:700 }}>{h.difference>=0?'+':''}{(h.difference||0).toFixed(0)}</span>
                  <span style={{ background:h.status==='closed'?T.green+'22':T.amber+'22', color:h.status==='closed'?T.green:T.amber, borderRadius:4, padding:'1px 7px', fontSize:9, fontWeight:700 }}>{h.status}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Right: Cash Reconciliation */}
          <div>
            <div style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:12, padding:20, marginBottom:14 }}>
              <div style={{ fontWeight:700, color:T.ink, marginBottom:16 }}>💵 Cash Reconciliation</div>
              <div style={{ marginBottom:12 }}>
                <label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:5 }}>Opening Cash (Rs.)</label>
                <input type="number" value={openingCash} onChange={e=>setOpeningCash(e.target.value)} placeholder="0.00" style={{ background:T.card, border:`1px solid ${T.bdr}`, borderRadius:8, padding:'10px 12px', color:T.ink, fontSize:14, fontFamily:'inherit', outline:'none', width:'100%' }}/>
              </div>

              {/* Auto-computed */}
              <div style={{ background:T.card, borderRadius:9, padding:14, marginBottom:14 }}>
                {[['Opening Cash',fmt(opening),T.sub],['+ Cash Sales',fmt(cashSales),T.green],['- Cash Expenses',fmt(cashExp),T.red]].map(([label,val,color])=>(
                  <div key={label} style={{ display:'flex', justifyContent:'space-between', padding:'4px 0', fontSize:12 }}>
                    <span style={{ color:T.muted }}>{label}</span><span style={{ color }}>{val}</span>
                  </div>
                ))}
                <div style={{ display:'flex', justifyContent:'space-between', padding:'8px 0', borderTop:`1px solid ${T.bdr}`, marginTop:6, fontWeight:700, fontSize:14 }}>
                  <span style={{ color:T.ink }}>Expected Cash</span>
                  <span style={{ color:T.blue }}>{fmt(cashExpected)}</span>
                </div>
              </div>

              <div style={{ marginBottom:14 }}>
                <label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:5 }}>Actual Cash in Hand (Rs.) *</label>
                <input type="number" value={cashInHand} onChange={e=>setCashInHand(e.target.value)} placeholder="Count and enter cash" style={{ background:T.card, border:`2px solid ${T.amber}`, borderRadius:8, padding:'10px 12px', color:T.ink, fontSize:14, fontFamily:'inherit', outline:'none', width:'100%' }}/>
              </div>

              {/* Difference indicator */}
              {cashInHand&&<div style={{ background:Math.abs(difference)<1?T.green+'12':T.red+'12', border:`1px solid ${Math.abs(difference)<1?T.green:T.red}44`, borderRadius:9, padding:'12px 16px', marginBottom:14 }}>
                <div style={{ display:'flex', justifyContent:'space-between' }}>
                  <span style={{ color:T.ink, fontWeight:700 }}>Difference</span>
                  <span style={{ fontSize:20, fontWeight:900, color:Math.abs(difference)<1?T.green:T.red }}>{difference>=0?'+':''}{fmt(difference)}</span>
                </div>
                <div style={{ fontSize:11, color:T.muted, marginTop:4 }}>{Math.abs(difference)<1?'✅ Cash matches perfectly!':difference>0?'⬆️ Cash surplus — double check receipts':' ⚠️ Cash short — check for missing entries'}</div>
              </div>}

              <div style={{ marginBottom:14 }}>
                <label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:5 }}>Notes</label>
                <textarea value={notes} onChange={e=>setNotes(e.target.value)} rows={2} placeholder="Any remarks for today…" style={{ background:T.card, border:`1px solid ${T.bdr}`, borderRadius:8, padding:'8px 12px', color:T.ink, fontSize:13, fontFamily:'inherit', outline:'none', width:'100%', resize:'vertical' }}/>
              </div>

              <div style={{ display:'flex', gap:8 }}>
                <button onClick={()=>saveEOD('open')} disabled={saving} style={{ flex:1, background:T.blue+'22', color:T.blue, border:`1px solid ${T.blue}44`, borderRadius:8, padding:'11px', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>💾 Save Draft</button>
                <button onClick={()=>saveEOD('closed')} disabled={saving||report?.status==='closed'} style={{ flex:2, background:report?.status==='closed'?T.muted:T.green, color:'#fff', border:'none', borderRadius:8, padding:'11px', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>
                  {saving?'Saving…':report?.status==='closed'?'✅ Already Closed':'🔒 Close Day + Print'}
                </button>
              </div>
            </div>

            {/* Net position */}
            <div style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:12, padding:18 }}>
              <div style={{ fontWeight:700, color:T.ink, marginBottom:12 }}>📈 Today's Net Position</div>
              {[['Total Revenue',totalRevenue,T.blue],['Total Expenses',totalExp,T.red],['Net Profit',totalRevenue-totalExp,totalRevenue>totalExp?T.green:T.red],['Cash in Hand',actual||cashExpected,T.amber]].map(([label,val,color])=>(
                <div key={label} style={{ display:'flex', justifyContent:'space-between', padding:'8px 0', borderBottom:`1px solid ${T.bdr}22`, fontSize:13 }}>
                  <span style={{ color:T.sub }}>{label}</span>
                  <span style={{ fontWeight:700, color }}>{fmt(val)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
