import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

const T = {
  bg:'#F7F3F3', srf:'#FFFFFF', card:'#FFFFFF', bdr:'#E8DEDE',
  red:'#C0392B', darkRed:'#8B0000', lightRed:'#FEF2F2',
  green:'#16A34A', amber:'#D97706', blue:'#2563EB', purple:'#7C3AED',
  ink:'#111827', sub:'#6B7280', muted:'#9CA3AF', white:'#FFFFFF'
};
const fmt = n => 'Rs.' + Math.abs(n||0).toLocaleString('en-IN', { minimumFractionDigits:2, maximumFractionDigits:2 });
const pct = n => (n||0).toFixed(1) + '%';

export default function ProfitAndLoss({ tenant }) {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [from,    setFrom]    = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0,10));
  const [to,      setTo]      = useState(new Date().toISOString().slice(0,10));

  useEffect(() => { if (tenant?.id) load(); }, [tenant?.id, from, to]);

  async function load() {
    setLoading(true);
    const [salesRes, purRes, expRes, retRes] = await Promise.all([
      supabase.from('sales').select('total,items,date,gst_amount').eq('tenant_id', tenant.id).gte('date', from).lte('date', to),
      supabase.from('purchases').select('total,date').eq('tenant_id', tenant.id).gte('date', from).lte('date', to),
      supabase.from('expenses').select('amount,category,date').eq('tenant_id', tenant.id).gte('date', from).lte('date', to),
      supabase.from('returns').select('amount,date').eq('tenant_id', tenant.id).gte('date', from).lte('date', to),
    ]);

    const sales     = salesRes.data || [];
    const purchases = purRes.data   || [];
    const expenses  = expRes.data   || [];
    const returns   = retRes.data   || [];

    const grossSales = sales.reduce((s,x)=>s+(x.total||0),0);
    const salesReturns = returns.reduce((s,x)=>s+(x.amount||0),0);
    const netSales   = grossSales - salesReturns;
    const gstOut     = sales.reduce((s,x)=>s+(x.gst_amount||0),0);

    // COGS from sale items
    let cogs = 0;
    sales.forEach(s=>(s.items||[]).forEach(i=>{ cogs += (i.cp||0)*(i.qty||1); }));
    if (cogs === 0) cogs = purchases.reduce((s,p)=>s+(p.total||0),0); // fallback

    const grossProfit = netSales - cogs;
    const grossMargin = netSales>0 ? (grossProfit/netSales*100) : 0;

    // Group expenses by category
    const expByCat = {};
    expenses.forEach(e=>{ const c=e.category||'Other'; expByCat[c]=(expByCat[c]||0)+(e.amount||0); });
    const totalExp = expenses.reduce((s,e)=>s+(e.amount||0),0);

    const netProfit  = grossProfit - totalExp;
    const netMargin  = netSales>0 ? (netProfit/netSales*100) : 0;

    setData({ grossSales, salesReturns, netSales, cogs, grossProfit, grossMargin, expByCat, totalExp, netProfit, netMargin, gstOut, orderCount:sales.length });
    setLoading(false);
  }

  function printPL() {
    if (!data) return;
    const w = window.open('','_blank');
    w.document.write(`<!DOCTYPE html><html><head><style>
      body{font-family:Arial,sans-serif;font-size:12px;padding:30px;max-width:700px;margin:0 auto}
      h2{color:#8B0000;margin-bottom:2px;font-size:20px}
      .sub{color:#666;font-size:12px;margin-bottom:20px}
      table{width:100%;border-collapse:collapse;margin-top:10px}
      td{padding:7px 12px;border-bottom:1px solid #eee}
      .right{text-align:right}
      .section{background:#f5f0f0;font-weight:700;color:#8B0000;text-transform:uppercase;font-size:11px;letter-spacing:0.05em}
      .total{font-weight:800;border-top:2px solid #8B0000;border-bottom:2px double #8B0000}
      .indent{padding-left:28px;color:#555}
      .green{color:#16A34A}.red{color:#C0392B}
    </style></head><body>
    <h2>${tenant?.name||'7SQ'}</h2>
    <div class="sub">Profit &amp; Loss Statement<br/>Period: ${from} to ${to}</div>
    <table>
      <tr class="section"><td colspan="2">Revenue</td></tr>
      <tr><td class="indent">Gross Sales</td><td class="right">${fmt(data.grossSales)}</td></tr>
      <tr><td class="indent">Less: Sales Returns</td><td class="right red">(${fmt(data.salesReturns)})</td></tr>
      <tr style="font-weight:700"><td>Net Sales</td><td class="right">${fmt(data.netSales)}</td></tr>

      <tr class="section"><td colspan="2">Cost of Goods Sold</td></tr>
      <tr><td class="indent">Cost of Goods Sold</td><td class="right red">(${fmt(data.cogs)})</td></tr>
      <tr style="font-weight:700;background:#fafafa"><td>Gross Profit</td><td class="right ${data.grossProfit>=0?'green':'red'}">${fmt(data.grossProfit)} (${pct(data.grossMargin)})</td></tr>

      <tr class="section"><td colspan="2">Operating Expenses</td></tr>
      ${Object.entries(data.expByCat).sort((a,b)=>b[1]-a[1]).map(([cat,amt])=>`<tr><td class="indent">${cat}</td><td class="right red">(${fmt(amt)})</td></tr>`).join('')}
      <tr style="font-weight:700"><td>Total Expenses</td><td class="right red">(${fmt(data.totalExp)})</td></tr>

      <tr class="total"><td>NET PROFIT</td><td class="right ${data.netProfit>=0?'green':'red'}">${data.netProfit<0?'(':''}${fmt(data.netProfit)}${data.netProfit<0?')':''} — ${pct(data.netMargin)} margin</td></tr>
    </table>
    <div style="margin-top:20px;font-size:11px;color:#888">Generated ${new Date().toLocaleString('en-IN')} · ${data.orderCount} transactions</div>
    <script>window.onload=()=>{window.print();setTimeout(()=>window.close(),500)}<\/script>
    </body></html>`);
    w.document.close();
  }

  const Row = ({ label, value, indent, bold, color, border, note }) => (
    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding: bold?'11px 18px':'8px 18px', paddingLeft: indent?38:18, borderTop: border?`2px solid ${T.darkRed}`:'none', borderBottom:`1px solid ${T.bdr}22`, background: bold?'#FAFAFA':'transparent' }}>
      <span style={{ fontSize: bold?13:12, fontWeight: bold?800:500, color: bold?T.ink:T.sub }}>{label}</span>
      <span style={{ fontSize: bold?15:13, fontWeight: bold?800:600, color: color||T.ink }}>
        {value}{note&&<span style={{ fontSize:11, color:T.muted, marginLeft:8, fontWeight:400 }}>{note}</span>}
      </span>
    </div>
  );

  return (
    <div style={{ padding:24, background:T.bg, minHeight:'100%' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
        <div>
          <div style={{ fontSize:18, fontWeight:800, color:T.darkRed }}>📊 Profit &amp; Loss Statement</div>
          <div style={{ fontSize:12, color:T.sub, marginTop:2 }}>Complete P&amp;L with revenue, COGS and expense breakdown</div>
        </div>
        <div style={{ display:'flex', gap:8, alignItems:'center' }}>
          <input type="date" value={from} onChange={e=>setFrom(e.target.value)} style={{ background:T.white, border:`1px solid ${T.bdr}`, borderRadius:8, padding:'8px 10px', color:T.ink, fontSize:12, fontFamily:'inherit', outline:'none' }}/>
          <span style={{ color:T.muted, fontSize:12 }}>to</span>
          <input type="date" value={to} onChange={e=>setTo(e.target.value)} style={{ background:T.white, border:`1px solid ${T.bdr}`, borderRadius:8, padding:'8px 10px', color:T.ink, fontSize:12, fontFamily:'inherit', outline:'none' }}/>
          <button onClick={printPL} style={{ background:T.lightRed, color:T.red, border:`1px solid ${T.bdr}`, borderRadius:8, padding:'8px 14px', fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>🖨️ Print</button>
        </div>
      </div>

      {loading?<div style={{ textAlign:'center', padding:80, color:T.muted }}>Calculating P&amp;L…</div>
      :data&&<>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:14, marginBottom:20 }}>
          {[
            ['Net Sales',    fmt(data.netSales),    T.blue],
            ['Gross Profit', fmt(data.grossProfit), data.grossProfit>=0?T.green:T.red, pct(data.grossMargin)],
            ['Total Expenses',fmt(data.totalExp),   T.amber],
            ['Net Profit',   fmt(data.netProfit),   data.netProfit>=0?T.green:T.red, pct(data.netMargin)],
          ].map(([label,val,color,sub])=>(
            <div key={label} style={{ background:T.white, border:`1px solid ${T.bdr}`, borderRadius:12, padding:'16px 18px', boxShadow:'0 1px 4px rgba(0,0,0,.05)' }}>
              <div style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:6 }}>{label}</div>
              <div style={{ fontSize:19, fontWeight:900, color, letterSpacing:'-0.02em' }}>{val}</div>
              {sub&&<div style={{ fontSize:11, color:T.muted, marginTop:2 }}>{sub} margin</div>}
            </div>
          ))}
        </div>

        <div style={{ background:T.white, border:`1px solid ${T.bdr}`, borderRadius:14, overflow:'hidden', boxShadow:'0 1px 4px rgba(0,0,0,.05)' }}>
          <div style={{ padding:'14px 18px', background:T.lightRed, borderBottom:`1px solid ${T.bdr}` }}>
            <div style={{ fontSize:14, fontWeight:800, color:T.darkRed }}>Profit &amp; Loss — {from} to {to}</div>
            <div style={{ fontSize:11, color:T.sub, marginTop:2 }}>{data.orderCount} transactions</div>
          </div>

          <div style={{ padding:'10px 0 4px 18px', fontSize:10, fontWeight:800, color:T.darkRed, textTransform:'uppercase', letterSpacing:'0.08em', background:'#FDF8F8' }}>Revenue</div>
          <Row label="Gross Sales"        value={fmt(data.grossSales)}   indent/>
          <Row label="Less: Sales Returns" value={`(${fmt(data.salesReturns)})`} indent color={T.red}/>
          <Row label="Net Sales"          value={fmt(data.netSales)}     bold/>

          <div style={{ padding:'10px 0 4px 18px', fontSize:10, fontWeight:800, color:T.darkRed, textTransform:'uppercase', letterSpacing:'0.08em', background:'#FDF8F8' }}>Cost of Goods Sold</div>
          <Row label="Cost of Goods Sold" value={`(${fmt(data.cogs)})`}  indent color={T.red}/>
          <Row label="Gross Profit"       value={fmt(data.grossProfit)}  bold color={data.grossProfit>=0?T.green:T.red} note={pct(data.grossMargin)}/>

          <div style={{ padding:'10px 0 4px 18px', fontSize:10, fontWeight:800, color:T.darkRed, textTransform:'uppercase', letterSpacing:'0.08em', background:'#FDF8F8' }}>Operating Expenses</div>
          {Object.entries(data.expByCat).sort((a,b)=>b[1]-a[1]).map(([cat,amt])=>(
            <Row key={cat} label={cat} value={`(${fmt(amt)})`} indent color={T.red}/>
          ))}
          {Object.keys(data.expByCat).length===0&&<Row label="No expenses recorded" value="—" indent color={T.muted}/>}
          <Row label="Total Operating Expenses" value={`(${fmt(data.totalExp)})`} bold color={T.red}/>

          <div style={{ background:data.netProfit>=0?'#F0FDF4':'#FEF2F2', borderTop:`2px solid ${T.darkRed}` }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'16px 18px' }}>
              <span style={{ fontSize:15, fontWeight:900, color:T.darkRed, textTransform:'uppercase', letterSpacing:'0.03em' }}>Net Profit</span>
              <div style={{ textAlign:'right' }}>
                <div style={{ fontSize:24, fontWeight:900, color:data.netProfit>=0?T.green:T.red, letterSpacing:'-0.02em' }}>
                  {data.netProfit<0?'(':''}{fmt(data.netProfit)}{data.netProfit<0?')':''}
                </div>
                <div style={{ fontSize:12, color:T.sub, marginTop:2 }}>{pct(data.netMargin)} net margin</div>
              </div>
            </div>
          </div>
        </div>
      </>}
    </div>
  );
}
