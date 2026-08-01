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
const fmt  = n => 'Rs.' + Math.abs(n||0).toLocaleString('en-IN', { minimumFractionDigits:2, maximumFractionDigits:2 });
const fmtK = n => n>=100000?'Rs.'+(Math.abs(n)/100000).toFixed(1)+'L':n>=1000?'Rs.'+(Math.abs(n)/1000).toFixed(1)+'K':fmt(n);

export default function Accounting({ tenant }) {
  const [view,     setView]    = useState('pl');   // pl | bs | trial
  const [period,   setPeriod]  = useState(new Date().getFullYear().toString());
  const [data,     setData]    = useState(null);
  const [loading,  setLoading] = useState(true);

  useEffect(() => { if (tenant?.id) load(); }, [tenant?.id, period]);

  async function load() {
    setLoading(true);
    const yr        = parseInt(period);
    const yearStart = `${yr}-04-01`; // FY starts April
    const yearEnd   = `${yr+1}-03-31`;

    const [salesRes, expRes, purRes, invRes, custRes, payRes] = await Promise.all([
      supabase.from('sales').select('total,gst_amount,date,payment_mode').eq('tenant_id', tenant.id).gte('date', yearStart).lte('date', yearEnd),
      supabase.from('expenses').select('amount,category,date').eq('tenant_id', tenant.id).gte('date', yearStart).lte('date', yearEnd),
      supabase.from('purchases').select('total,gst_amount,date').eq('tenant_id', tenant.id).gte('date', yearStart).lte('date', yearEnd),
      supabase.from('inventory').select('stock,cp,sp').eq('tenant_id', tenant.id).eq('active', true),
      supabase.from('customers').select('outstanding').eq('tenant_id', tenant.id),
      supabase.from('payroll').select('net_pay').eq('tenant_id', tenant.id).gte('period', `${yr}-04`).lte('period', `${yr+1}-03`),
    ]);

    const sales    = salesRes.data||[];
    const expenses = expRes.data||[];
    const purchases= purRes.data||[];
    const inventory= invRes.data||[];
    const customers= custRes.data||[];
    const payroll  = payRes.data||[];

    // ── P&L ──────────────────────────────────────────────────
    const revenue    = sales.reduce((s,x)=>s+(x.total||0),0);
    const gstOut     = sales.reduce((s,x)=>s+(x.gst_amount||0),0);
    const netRevenue = revenue - gstOut;
    const cogs       = purchases.reduce((s,x)=>s+(x.total||0),0);
    const grossProfit= netRevenue - cogs;

    // Expenses by category
    const expByCat = expenses.reduce((acc,e)=>{ acc[e.category]=(acc[e.category]||0)+(e.amount||0); return acc; },{});
    const salaryExp= payroll.reduce((s,p)=>s+(p.net_pay||0),0);
    const totalOtherExp = expenses.reduce((s,e)=>s+(e.amount||0),0) + salaryExp;
    const ebit     = grossProfit - totalOtherExp;
    const netProfit= ebit;

    // Monthly revenue for trend
    const monthlyData = Array.from({length:12},(_,i)=>{
      const moIdx   = (3+i)%12+1;
      const mo      = String(moIdx).padStart(2,'0');
      const moYr    = i<9?yr:yr+1;
      const key     = `${moYr}-${mo}`;
      const moSales = sales.filter(s=>s.date.startsWith(key)).reduce((t,s)=>t+(s.total||0),0);
      const moExp   = expenses.filter(e=>e.date.startsWith(key)).reduce((t,e)=>t+(e.amount||0),0);
      return { label:`${mo}/${moYr.toString().slice(2)}`, revenue:moSales, expenses:moExp, profit:moSales-moExp };
    });

    // ── Balance Sheet ─────────────────────────────────────────
    const stockValue    = inventory.reduce((s,i)=>s+(i.stock||0)*(i.cp||0),0);
    const receivables   = customers.reduce((s,c)=>s+(c.outstanding||0),0);
    const cashAndBank   = sales.filter(s=>['cash','upi','card'].includes(s.payment_mode)).reduce((t,s)=>t+(s.total||0),0) - cogs - expenses.reduce((s,e)=>s+(e.amount||0),0);
    const totalAssets   = stockValue + receivables + Math.max(0,cashAndBank);
    const payables      = purchases.reduce((s,p)=>s+(p.total||0),0) * 0.2; // assume 20% outstanding
    const totalLiab     = payables;
    const ownerEquity   = totalAssets - totalLiab;

    // ── Trial Balance ─────────────────────────────────────────
    const trialEntries = [
      { account:'Sales Revenue',     type:'Credit', amount:revenue },
      { account:'Cost of Goods Sold',type:'Debit',  amount:cogs },
      { account:'Operating Expenses',type:'Debit',  amount:totalOtherExp },
      { account:'Stock in Hand',     type:'Debit',  amount:stockValue },
      { account:'Accounts Receivable',type:'Debit', amount:receivables },
      { account:'Accounts Payable',  type:'Credit', amount:payables },
      { account:'GST Liability',     type:'Credit', amount:gstOut },
    ];

    setData({ revenue, netRevenue, gstOut, cogs, grossProfit, expByCat, salaryExp, totalOtherExp, ebit, netProfit, monthlyData, stockValue, receivables, cashAndBank:Math.max(0,cashAndBank), totalAssets, payables, totalLiab, ownerEquity, trialEntries, grossMargin:netRevenue>0?Math.round(grossProfit/netRevenue*100):0, netMargin:revenue>0?Math.round(netProfit/revenue*100):0 });
    setLoading(false);
  }

  const Row = ({ label, value, color, indent, bold, separator }) => (
    <div style={{ display:'flex', justifyContent:'space-between', padding:separator?'10px 16px':'7px 16px', paddingLeft:indent?32:16, background:bold?T.card:'transparent', borderTop:separator?`2px solid ${T.bdr}`:'none', borderBottom:`1px solid ${T.bdr}${bold?'':11}` }}>
      <span style={{ fontSize:13, color:indent?T.sub:T.ink, fontWeight:bold?800:500 }}>{label}</span>
      <span style={{ fontSize:bold?15:13, fontWeight:bold?800:500, color:color||T.ink }}>{fmt(Math.abs(value))}</span>
    </div>
  );

  const maxMonth = data ? Math.max(...data.monthlyData.map(m=>Math.max(m.revenue,m.expenses)),1) : 1;

  return (
    <div style={{ padding:20 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
        <div>
          <div style={{ fontSize:22, fontWeight:800, color:T.ink }}>📒 Accounting</div>
          <div style={{ fontSize:13, color:T.sub }}>P&L Statement · Balance Sheet · Trial Balance · FY {period}-{parseInt(period)+1}</div>
        </div>
        <div style={{ display:'flex', gap:8, alignItems:'center' }}>
          <select value={period} onChange={e=>setPeriod(e.target.value)} style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:8, padding:'8px 12px', color:T.ink, fontSize:13, fontFamily:'inherit', outline:'none', cursor:'pointer' }}>
            {[2023,2024,2025,2026].map(y=><option key={y} value={y}>FY {y}-{y+1}</option>)}
          </select>
          {[['pl','P&L'],['bs','Balance Sheet'],['trial','Trial Balance']].map(([id,label])=>(
            <button key={id} onClick={()=>setView(id)} style={{ background:view===id?T.blue:T.srf, color:view===id?'#fff':T.sub, border:`1px solid ${view===id?T.blue:T.bdr}`, borderRadius:7, padding:'8px 14px', fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}>{label}</button>
          ))}
        </div>
      </div>

      {loading?<div style={{ textAlign:'center', color:T.sub, padding:80 }}>Computing…</div>:data&&(
        <>
          {/* KPI row */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:10, marginBottom:20 }}>
            {[['Revenue',fmtK(data.revenue),T.blue],['Gross Profit',fmtK(data.grossProfit),T.teal],['Net Profit',fmtK(data.netProfit),data.netProfit>=0?T.green:T.red],['Gross Margin',data.grossMargin+'%',T.amber],['Net Margin',data.netMargin+'%',data.netMargin>=0?T.purple:T.red]].map(([label,val,color])=>(
              <div key={label} style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:10, padding:'12px 14px' }}>
                <div style={{ fontSize:9, color:T.sub, fontWeight:700, textTransform:'uppercase', marginBottom:5 }}>{label}</div>
                <div style={{ fontSize:17, fontWeight:800, color }}>{val}</div>
              </div>
            ))}
          </div>

          {/* Monthly chart */}
          <div style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:12, padding:20, marginBottom:16 }}>
            <div style={{ fontWeight:700, color:T.ink, marginBottom:16 }}>📊 Monthly Performance — FY {period}</div>
            <div style={{ display:'flex', gap:6, alignItems:'flex-end', height:100 }}>
              {data.monthlyData.map((m,i)=>(
                <div key={i} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:3 }}>
                  <div style={{ width:'100%', display:'flex', gap:2, alignItems:'flex-end', justifyContent:'center' }}>
                    <div style={{ width:'45%', background:T.blue, borderRadius:'3px 3px 0 0', height:`${Math.max(2,m.revenue/maxMonth*90)}px` }} title={`Revenue: ${fmt(m.revenue)}`}/>
                    <div style={{ width:'45%', background:T.red+'88', borderRadius:'3px 3px 0 0', height:`${Math.max(2,m.expenses/maxMonth*90)}px` }} title={`Expenses: ${fmt(m.expenses)}`}/>
                  </div>
                  <div style={{ fontSize:8, color:T.muted }}>{m.label}</div>
                </div>
              ))}
            </div>
            <div style={{ display:'flex', gap:14, marginTop:8, justifyContent:'center' }}>
              {[[T.blue,'Revenue'],[T.red+'88','Expenses']].map(([c,l])=><div key={l} style={{ display:'flex', alignItems:'center', gap:5 }}><div style={{ width:10, height:10, borderRadius:2, background:c }}/><span style={{ fontSize:10, color:T.muted }}>{l}</span></div>)}
            </div>
          </div>

          {/* P&L Statement */}
          {view==='pl'&&(
            <div style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:12, overflow:'hidden' }}>
              <div style={{ padding:'12px 16px', background:T.card, fontWeight:700, color:T.ink, borderBottom:`1px solid ${T.bdr}` }}>Profit & Loss Statement — FY {period}-{parseInt(period)+1}</div>
              <Row label="Gross Revenue (incl. GST)" value={data.revenue} color={T.blue} bold/>
              <Row label="Less: GST Collected" value={data.gstOut} color={T.red} indent/>
              <Row label="Net Revenue" value={data.netRevenue} bold separator/>
              <Row label="Less: Cost of Goods Sold" value={data.cogs} color={T.red} indent/>
              <Row label="Gross Profit" value={data.grossProfit} color={data.grossProfit>=0?T.green:T.red} bold separator/>
              <div style={{ padding:'8px 16px', fontSize:11, color:T.sub, fontWeight:700, textTransform:'uppercase', background:T.card }}>Operating Expenses</div>
              {Object.entries(data.expByCat).map(([cat,amt])=><Row key={cat} label={cat} value={amt} color={T.red} indent/>)}
              {data.salaryExp>0&&<Row label="Salaries & Payroll" value={data.salaryExp} color={T.red} indent/>}
              <Row label="Total Operating Expenses" value={data.totalOtherExp} color={T.red} bold/>
              <Row label="EBIT (Operating Profit)" value={data.ebit} color={data.ebit>=0?T.green:T.red} bold separator/>
              <Row label="NET PROFIT / (LOSS)" value={data.netProfit} color={data.netProfit>=0?T.green:T.red} bold separator/>
            </div>
          )}

          {/* Balance Sheet */}
          {view==='bs'&&(
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
              <div style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:12, overflow:'hidden' }}>
                <div style={{ padding:'12px 16px', background:T.card, fontWeight:700, color:T.green, borderBottom:`1px solid ${T.bdr}` }}>ASSETS</div>
                <Row label="Current Assets" value={''} bold/>
                <Row label="Stock in Hand" value={data.stockValue} color={T.blue} indent/>
                <Row label="Accounts Receivable" value={data.receivables} color={T.blue} indent/>
                <Row label="Cash and Bank" value={data.cashAndBank} color={T.blue} indent/>
                <Row label="Total Assets" value={data.totalAssets} color={T.green} bold separator/>
              </div>
              <div style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:12, overflow:'hidden' }}>
                <div style={{ padding:'12px 16px', background:T.card, fontWeight:700, color:T.red, borderBottom:`1px solid ${T.bdr}` }}>LIABILITIES + EQUITY</div>
                <Row label="Current Liabilities" value={''} bold/>
                <Row label="Accounts Payable" value={data.payables} color={T.red} indent/>
                <Row label="Total Liabilities" value={data.totalLiab} color={T.red} bold/>
                <Row label="Owner's Equity" value={''} bold/>
                <Row label="Net Worth" value={data.ownerEquity} color={T.purple} indent/>
                <Row label="Total Liabilities + Equity" value={data.totalAssets} color={T.green} bold separator/>
              </div>
            </div>
          )}

          {/* Trial Balance */}
          {view==='trial'&&(
            <div style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:12, overflow:'hidden' }}>
              <div style={{ padding:'12px 16px', background:T.card, fontWeight:700, color:T.ink, borderBottom:`1px solid ${T.bdr}` }}>Trial Balance — FY {period}-{parseInt(period)+1}</div>
              <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
                <thead><tr style={{ background:T.card+'88' }}>
                  {['Account','Type','Debit','Credit'].map(h=><th key={h} style={{ padding:'9px 14px', textAlign:'left', fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', borderBottom:`1px solid ${T.bdr}` }}>{h}</th>)}
                </tr></thead>
                <tbody>
                  {data.trialEntries.map(row=>(
                    <tr key={row.account} style={{ borderBottom:`1px solid ${T.bdr}22` }}>
                      <td style={{ padding:'10px 14px', color:T.ink, fontWeight:500 }}>{row.account}</td>
                      <td style={{ padding:'10px 14px' }}><span style={{ background:row.type==='Debit'?T.blue+'22':T.green+'22', color:row.type==='Debit'?T.blue:T.green, borderRadius:5, padding:'2px 8px', fontSize:10, fontWeight:700 }}>{row.type}</span></td>
                      <td style={{ padding:'10px 14px', color:T.blue, fontWeight:600 }}>{row.type==='Debit'?fmt(row.amount):'—'}</td>
                      <td style={{ padding:'10px 14px', color:T.green, fontWeight:600 }}>{row.type==='Credit'?fmt(row.amount):'—'}</td>
                    </tr>
                  ))}
                  <tr style={{ background:T.card, borderTop:`2px solid ${T.bdr}` }}>
                    <td colSpan={2} style={{ padding:'10px 14px', fontWeight:800, color:T.ink }}>TOTAL</td>
                    <td style={{ padding:'10px 14px', color:T.blue, fontWeight:800, fontSize:14 }}>{fmt(data.trialEntries.filter(r=>r.type==='Debit').reduce((s,r)=>s+r.amount,0))}</td>
                    <td style={{ padding:'10px 14px', color:T.green, fontWeight:800, fontSize:14 }}>{fmt(data.trialEntries.filter(r=>r.type==='Credit').reduce((s,r)=>s+r.amount,0))}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
