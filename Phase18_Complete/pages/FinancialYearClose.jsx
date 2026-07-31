import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';


const T = { bg:'#060710', srf:'#0f1220', card:'#141828', bdr:'#1e2540', blue:'#4f7cff', ink:'#eef0f8', sub:'#6b7598', muted:'#4a5175', green:'#00d68f', amber:'#ffb547', red:'#ff4d6a', purple:'#9b72ff', teal:'#00c9b1' };
const fmt = n => 'Rs.' + (n||0).toLocaleString('en-IN', { maximumFractionDigits:0 });
const fmtD = n => 'Rs.' + (n||0).toLocaleString('en-IN', { minimumFractionDigits:2, maximumFractionDigits:2 });

const FY_MONTHS = ['April','May','June','July','August','September','October','November','December','January','February','March'];

export default function FinancialYearClose({ tenant, user }) {
  const [data,      setData]      = useState(null);
  const [closeLog,  setCloseLog]  = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [closing,   setClosing]   = useState(false);
  const [fyYear,    setFyYear]    = useState('2024-25');
  const [tab,       setTab]       = useState('summary'); // summary | monthly | history

  useEffect(() => { if (tenant?.id) load(); }, [tenant?.id, fyYear]);

  async function load() {
    setLoading(true);
    const [yr1, yr2] = fyYear.split('-');
    const startDate  = `20${yr1.length===2?yr1:yr1.slice(2)}-04-01`;
    const endDate    = `20${yr2}-03-31`;

    const [sales, expenses, purchases, inventory, customers, logs] = await Promise.all([
      (await supabase.from('sales').select('total,gst_amount,items,customer,date,status,payment_mode').eq('tenant_id',tenant.id).order('date').limit(5000).then(r=>r.data||[])),
      (await supabase.from('expenses').select('amount,category,date').eq('tenant_id',tenant.id).then(r=>r.data||[])),
      (await supabase.from('purchases').select('total,date').eq('tenant_id',tenant.id).then(r=>r.data||[])),
      (await supabase.from('inventory').select('stock,sp,cp').eq('tenant_id',tenant.id).eq('active',true).then(r=>r.data||[])),
      (await supabase.from('customers').select('id,outstanding').eq('tenant_id',tenant.id).then(r=>r.data||[])),
      supabase.from('year_close_log').select('*').eq('tenant_id', tenant.id).order('closed_at', { ascending:false }),
    ]);

    const fySales    = sales.filter(s => s.date >= startDate && s.date <= endDate);
    const fyExpenses = expenses.filter(e => e.date >= startDate && e.date <= endDate);
    const fyPurchases= purchases.filter(p => p.date >= startDate && p.date <= endDate);

    const revenue   = fySales.reduce((s,x)=>s+(x.total||0),0);
    const gstColl   = fySales.reduce((s,x)=>s+(x.gst_amount||0),0);
    const cogs      = fyPurchases.reduce((s,x)=>s+(x.total||0),0);
    const expTotal  = fyExpenses.reduce((s,x)=>s+(x.amount||0),0);
    const grossProfit = revenue - cogs;
    const netProfit   = grossProfit - expTotal;
    const stockValue  = inventory.reduce((s,i)=>s+(i.stock||0)*(i.cp||0),0);
    const outstanding = customers.reduce((s,c)=>s+(c.outstanding||0),0);

    // Monthly breakdown
    const monthly = FY_MONTHS.map((month, i) => {
      const yr    = i < 9 ? `20${yr1.length===2?yr1:yr1.slice(2)}` : `20${yr2}`;
      const mo    = String(i < 9 ? i+4 : i-8).padStart(2,'0');
      const key   = `${yr}-${mo}`;
      const mSales= fySales.filter(s=>(s.date||'').startsWith(key));
      const mExp  = fyExpenses.filter(e=>(e.date||'').startsWith(key));
      const mPurch= fyPurchases.filter(p=>(p.date||'').startsWith(key));
      return {
        month, key,
        revenue:  mSales.reduce((s,x)=>s+(x.total||0),0),
        expenses: mExp.reduce((s,x)=>s+(x.amount||0),0),
        cogs:     mPurch.reduce((s,x)=>s+(x.total||0),0),
        orders:   mSales.length,
      };
    });

    // Expense breakdown
    const expByCategory = fyExpenses.reduce((acc,e)=>{ acc[e.category]=(acc[e.category]||0)+(e.amount||0); return acc; },{});

    setData({ revenue, gstColl, cogs, expTotal, grossProfit, netProfit, stockValue, outstanding, orders:fySales.length, monthly, expByCategory, startDate, endDate, customers:customers.length });
    setCloseLog(logs.data||[]);
    setLoading(false);
  }

  async function closeFinancialYear() {
    if (!confirm(`Close Financial Year ${fyYear}?\n\nThis will record the final P&L. This action is permanent.`)) return;
    setClosing(true);
    try {
      await supabase.from('year_close_log').upsert({
        tenant_id: tenant.id, financial_year: fyYear,
        revenue: data.revenue, expenses: data.expTotal, profit: data.netProfit,
        gst_collected: data.gstColl, total_orders: data.orders,
        closed_by: user?.id,
        notes: `Closed on ${new Date().toLocaleDateString('en-IN')}`,
      }, { onConflict:'tenant_id,financial_year' });
      alert(`✅ Financial Year ${fyYear} closed successfully!`);
      await load();
    } catch(e) { alert('Error: '+e.message); }
    finally { setClosing(false); }
  }

  function exportAnnualReport() {
    if (!data) return;
    const content = `ANNUAL FINANCIAL REPORT — ${fyYear}
${tenant?.name || 'Elite Store'}
Period: ${data.startDate} to ${data.endDate}
Generated: ${new Date().toLocaleDateString('en-IN')}

═══════════════════════════════════
PROFIT & LOSS STATEMENT
═══════════════════════════════════
Total Revenue:        ${fmtD(data.revenue)}
Cost of Goods Sold:   ${fmtD(data.cogs)}
─────────────────────────────────── 
GROSS PROFIT:         ${fmtD(data.grossProfit)}
Total Expenses:       ${fmtD(data.expTotal)}
─────────────────────────────────── 
NET PROFIT:           ${fmtD(data.netProfit)}

═══════════════════════════════════
OTHER METRICS
═══════════════════════════════════
GST Collected:        ${fmtD(data.gstColl)}
Total Orders:         ${data.orders}
Avg Order Value:      ${data.orders>0?fmtD(data.revenue/data.orders):'Rs.0.00'}
Stock Value (at cost):${fmtD(data.stockValue)}
Customer Outstanding: ${fmtD(data.outstanding)}
Total Customers:      ${data.customers}

═══════════════════════════════════
MONTHLY REVENUE SUMMARY
═══════════════════════════════════
${data.monthly.map(m=>`${m.month.padEnd(12)} ${fmtD(m.revenue).padStart(16)} (${m.orders} orders)`).join('\n')}

═══════════════════════════════════
EXPENSE BREAKDOWN
═══════════════════════════════════
${Object.entries(data.expByCategory).sort((a,b)=>b[1]-a[1]).map(([cat,amt])=>`${cat.padEnd(20)} ${fmtD(amt)}`).join('\n')}
`;
    const blob = new Blob([content], { type:'text/plain' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = `Annual_Report_${fyYear}.txt`; a.click();
    URL.revokeObjectURL(url);
  }

  const isClosed = closeLog.some(l=>l.financial_year===fyYear);
  const FY_OPTIONS = ['2022-23','2023-24','2024-25','2025-26'];

  return (
    <div style={{ padding:20 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
        <div>
          <div style={{ fontSize:22, fontWeight:800, color:T.ink }}>📅 Financial Year Close</div>
          <div style={{ fontSize:13, color:T.sub }}>Annual P&L, closure, and carry-forward</div>
        </div>
        <div style={{ display:'flex', gap:8, alignItems:'center' }}>
          <select value={fyYear} onChange={e=>setFyYear(e.target.value)} style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:8, padding:'8px 12px', color:T.ink, fontSize:13, fontFamily:'inherit', outline:'none' }}>
            {FY_OPTIONS.map(y=><option key={y} value={y}>FY {y}</option>)}
          </select>
          {isClosed
            ? <span style={{ background:T.green+'22', color:T.green, borderRadius:7, padding:'7px 14px', fontSize:12, fontWeight:700 }}>✅ Closed</span>
            : <button onClick={closeFinancialYear} disabled={closing||loading} style={{ background:T.red, color:'#fff', border:'none', borderRadius:8, padding:'9px 16px', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>{closing?'Closing…':'🔒 Close FY'}</button>}
          <button onClick={exportAnnualReport} disabled={!data} style={{ background:T.blue+'22', color:T.blue, border:`1px solid ${T.blue}44`, borderRadius:8, padding:'9px 14px', fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>⬇️ Export</button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display:'flex', gap:6, marginBottom:20 }}>
        {[['summary','P&L Summary'],['monthly','Monthly Breakdown'],['history','Close History']].map(([id,label])=>(
          <button key={id} onClick={()=>setTab(id)} style={{ background:tab===id?T.blue:T.srf, color:tab===id?'#fff':T.sub, border:`1px solid ${tab===id?T.blue:T.bdr}`, borderRadius:7, padding:'7px 14px', fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}>{label}</button>
        ))}
      </div>

      {loading ? <div style={{ textAlign:'center', color:T.sub, padding:80 }}>Computing annual figures…</div> : data && (
        <>
          {tab === 'summary' && (
            <>
              {/* P&L cards */}
              <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12, marginBottom:20 }}>
                {[
                  ['Revenue', fmt(data.revenue), T.blue, `${data.orders} invoices`],
                  ['Gross Profit', fmt(data.grossProfit), data.grossProfit>=0?T.green:T.red, `Margin ${data.revenue>0?Math.round(data.grossProfit/data.revenue*100):0}%`],
                  ['Net Profit', fmt(data.netProfit), data.netProfit>=0?T.green:T.red, data.netProfit>=0?'Profitable year':'Loss-making year'],
                  ['Cost of Goods', fmt(data.cogs), T.amber, 'Purchases'],
                  ['Total Expenses', fmt(data.expTotal), T.red, 'Operating costs'],
                  ['GST Collected', fmt(data.gstColl), T.purple, 'Tax liability'],
                ].map(([label,val,color,sub])=>(
                  <div key={label} style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:12, padding:'16px 18px' }}>
                    <div style={{ fontSize:11, color:T.sub, fontWeight:700, textTransform:'uppercase', marginBottom:8 }}>{label}</div>
                    <div style={{ fontSize:22, fontWeight:800, color }}>{val}</div>
                    {sub&&<div style={{ fontSize:11, color:T.muted, marginTop:3 }}>{sub}</div>}
                  </div>
                ))}
              </div>

              {/* Balance items */}
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
                <div style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:12, padding:18 }}>
                  <div style={{ fontWeight:700, color:T.ink, marginBottom:12 }}>Balance Sheet Items</div>
                  {[['Stock Value (at cost)',fmt(data.stockValue),T.blue],['Customer Outstanding',fmt(data.outstanding),T.amber],['Total Customers',data.customers,T.sub],['Avg Order Value',data.orders>0?fmt(data.revenue/data.orders):'—',T.teal]].map(([label,val,color])=>(
                    <div key={label} style={{ display:'flex', justifyContent:'space-between', padding:'7px 0', borderBottom:`1px solid ${T.bdr}22`, fontSize:13 }}>
                      <span style={{ color:T.sub }}>{label}</span><span style={{ color, fontWeight:700 }}>{val}</span>
                    </div>
                  ))}
                </div>
                <div style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:12, padding:18 }}>
                  <div style={{ fontWeight:700, color:T.ink, marginBottom:12 }}>Top Expenses</div>
                  {Object.entries(data.expByCategory).sort((a,b)=>b[1]-a[1]).slice(0,6).map(([cat,amt])=>(
                    <div key={cat} style={{ display:'flex', justifyContent:'space-between', padding:'7px 0', borderBottom:`1px solid ${T.bdr}22`, fontSize:13 }}>
                      <span style={{ color:T.sub }}>{cat}</span><span style={{ color:T.red, fontWeight:700 }}>{fmt(amt)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {tab === 'monthly' && (
            <div style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:12, overflow:'hidden' }}>
              <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
                <thead><tr style={{ background:T.card }}>
                  {['Month','Orders','Revenue','COGS','Gross Profit','Expenses','Net'].map(h=>(
                    <th key={h} style={{ padding:'10px 14px', textAlign:'left', fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', borderBottom:`1px solid ${T.bdr}` }}>{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {data.monthly.map(m=>{
                    const gp  = m.revenue - m.cogs;
                    const net = gp - m.expenses;
                    return (
                      <tr key={m.month} style={{ borderBottom:`1px solid ${T.bdr}22` }}>
                        <td style={{ padding:'10px 14px', color:T.ink, fontWeight:600 }}>{m.month}</td>
                        <td style={{ padding:'10px 14px', color:T.sub }}>{m.orders}</td>
                        <td style={{ padding:'10px 14px', color:T.blue, fontWeight:700 }}>{fmt(m.revenue)}</td>
                        <td style={{ padding:'10px 14px', color:T.amber }}>{fmt(m.cogs)}</td>
                        <td style={{ padding:'10px 14px', color:gp>=0?T.green:T.red, fontWeight:700 }}>{fmt(gp)}</td>
                        <td style={{ padding:'10px 14px', color:T.red }}>{fmt(m.expenses)}</td>
                        <td style={{ padding:'10px 14px', color:net>=0?T.green:T.red, fontWeight:700 }}>{fmt(net)}</td>
                      </tr>
                    );
                  })}
                  <tr style={{ background:T.card, fontWeight:800 }}>
                    <td style={{ padding:'12px 14px', color:T.ink }}>TOTAL</td>
                    <td style={{ padding:'12px 14px', color:T.sub }}>{data.orders}</td>
                    <td style={{ padding:'12px 14px', color:T.blue }}>{fmt(data.revenue)}</td>
                    <td style={{ padding:'12px 14px', color:T.amber }}>{fmt(data.cogs)}</td>
                    <td style={{ padding:'12px 14px', color:data.grossProfit>=0?T.green:T.red }}>{fmt(data.grossProfit)}</td>
                    <td style={{ padding:'12px 14px', color:T.red }}>{fmt(data.expTotal)}</td>
                    <td style={{ padding:'12px 14px', color:data.netProfit>=0?T.green:T.red }}>{fmt(data.netProfit)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}

          {tab === 'history' && (
            <div style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:12, overflow:'hidden' }}>
              <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
                <thead><tr style={{ background:T.card }}>
                  {['FY Year','Closed On','Revenue','Expenses','Net Profit','Orders'].map(h=>(
                    <th key={h} style={{ padding:'10px 14px', textAlign:'left', fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', borderBottom:`1px solid ${T.bdr}` }}>{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {closeLog.length===0?<tr><td colSpan={6} style={{ textAlign:'center', padding:40, color:T.muted }}>No years closed yet</td></tr>
                  :closeLog.map(log=>(
                    <tr key={log.id} style={{ borderBottom:`1px solid ${T.bdr}22` }}>
                      <td style={{ padding:'10px 14px', color:T.blue, fontWeight:700 }}>FY {log.financial_year}</td>
                      <td style={{ padding:'10px 14px', color:T.sub }}>{new Date(log.closed_at).toLocaleDateString('en-IN')}</td>
                      <td style={{ padding:'10px 14px', color:T.green, fontWeight:700 }}>{fmt(log.revenue)}</td>
                      <td style={{ padding:'10px 14px', color:T.red }}>{fmt(log.expenses)}</td>
                      <td style={{ padding:'10px 14px', color:log.profit>=0?T.green:T.red, fontWeight:700 }}>{fmt(log.profit)}</td>
                      <td style={{ padding:'10px 14px', color:T.sub }}>{log.total_orders}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
