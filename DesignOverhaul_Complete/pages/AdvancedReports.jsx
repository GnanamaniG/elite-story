import { useState } from 'react';
import { supabase } from '../lib/supabase';

const T = {
  bg:'#060710', srf:'#0b0d1a', card:'#0f1220', card2:'#141828',
  bdr:'#1a1e32', bdr2:'#222740',
  blue:'#4f7cff', green:'#00d68f', red:'#ff4d6a', amber:'#ffb547',
  purple:'#9b72ff', teal:'#00c9b1', orange:'#ff7043', gold:'#ffc107',
  cyan:'#00d4ff', pink:'#f06292',
  muted:'#4a5175', dim:'#2a3050', card3:'#181d2e',
  ink:'#eef0f8', sub:'#8892b0'
};
const fmt  = n => 'Rs.' + (n||0).toLocaleString('en-IN', { maximumFractionDigits:0 });
const fmtD = n => (n||0).toFixed(2);

const REPORT_TYPES = [
  { id:'sales_summary',  label:'📊 Sales Summary',     desc:'Revenue, orders, avg order by day' },
  { id:'item_wise',      label:'📦 Item-wise Sales',    desc:'Top selling products by revenue & qty' },
  { id:'category_wise',  label:'🗂️ Category Report',    desc:'Sales breakdown by product category' },
  { id:'customer_wise',  label:'👥 Customer Report',    desc:'Top customers by spend' },
  { id:'payment_wise',   label:'💳 Payment Mode',       desc:'Revenue split by payment method' },
  { id:'gst_summary',    label:'📋 GST Summary',        desc:'CGST, SGST collected by rate' },
  { id:'expense_report', label:'💸 Expense Report',     desc:'Expenses by category and date' },
  { id:'profit_loss',    label:'💰 Profit & Loss',      desc:'Revenue, COGS, expenses, net profit' },
];

async function loadXLSX() {
  if (window.XLSX) return window.XLSX;
  return new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
    s.onload = () => res(window.XLSX); s.onerror = rej;
    document.head.appendChild(s);
  });
}

export default function AdvancedReports({ tenant }) {
  const now   = new Date();
  const [reportType, setReportType] = useState('sales_summary');
  const [dateFrom,   setDateFrom]   = useState(now.toISOString().slice(0,7)+'-01');
  const [dateTo,     setDateTo]     = useState(now.toISOString().slice(0,10));
  const [data,       setData]       = useState(null);
  const [loading,    setLoading]    = useState(false);

  async function runReport() {
    setLoading(true); setData(null);
    const [salesRes, expRes, purchRes] = await Promise.all([
      supabase.from('sales').select('*').eq('tenant_id',tenant.id).gte('date',dateFrom).lte('date',dateTo).order('date'),
      supabase.from('expenses').select('*').eq('tenant_id',tenant.id).gte('date',dateFrom).lte('date',dateTo),
      supabase.from('purchases').select('*').eq('tenant_id',tenant.id).gte('date',dateFrom).lte('date',dateTo),
    ]);
    const sales    = salesRes.data||[];
    const expenses = expRes.data||[];
    const purchases= purchRes.data||[];

    let result = {};
    if (reportType === 'sales_summary') {
      const byDay = {};
      sales.forEach(s => { const d=s.date; if(!byDay[d])byDay[d]={date:d,revenue:0,orders:0,gst:0}; byDay[d].revenue+=s.total||0; byDay[d].orders++; byDay[d].gst+=s.gst_amount||0; });
      result = { rows: Object.values(byDay).sort((a,b)=>a.date.localeCompare(b.date)), cols:['Date','Orders','Revenue','GST'], total:{ revenue:sales.reduce((s,x)=>s+(x.total||0),0), orders:sales.length, gst:sales.reduce((s,x)=>s+(x.gst_amount||0),0) }};
    } else if (reportType === 'item_wise') {
      const items = {};
      sales.forEach(s => (s.items||[]).forEach(i => { const k=i.name; if(!items[k])items[k]={name:k,qty:0,revenue:0}; items[k].qty+=i.qty||0; items[k].revenue+=i.amount||0; }));
      result = { rows: Object.values(items).sort((a,b)=>b.revenue-a.revenue), cols:['Item','Qty Sold','Revenue'] };
    } else if (reportType === 'category_wise') {
      const cats = {};
      sales.forEach(s => (s.items||[]).forEach(i => { const k=i.cat||'Uncategorised'; if(!cats[k])cats[k]={cat:k,qty:0,revenue:0}; cats[k].qty+=i.qty||0; cats[k].revenue+=i.amount||0; }));
      result = { rows: Object.values(cats).sort((a,b)=>b.revenue-a.revenue), cols:['Category','Qty','Revenue'] };
    } else if (reportType === 'customer_wise') {
      const custs = {};
      sales.forEach(s => { const k=s.customer||'Walk-in'; if(!custs[k])custs[k]={customer:k,orders:0,revenue:0}; custs[k].orders++; custs[k].revenue+=s.total||0; });
      result = { rows: Object.values(custs).sort((a,b)=>b.revenue-a.revenue).slice(0,50), cols:['Customer','Orders','Revenue'] };
    } else if (reportType === 'payment_wise') {
      const modes = {};
      sales.forEach(s => { const k=s.payment_mode||'cash'; if(!modes[k])modes[k]={mode:k,orders:0,revenue:0}; modes[k].orders++; modes[k].revenue+=s.total||0; });
      result = { rows: Object.values(modes).sort((a,b)=>b.revenue-a.revenue), cols:['Payment Mode','Orders','Revenue'] };
    } else if (reportType === 'gst_summary') {
      const rates = {};
      sales.forEach(s => (s.items||[]).forEach(i => { const k=i.gst||0; if(!rates[k])rates[k]={rate:k,taxable:0,cgst:0,sgst:0,total:0}; const taxable=(i.amount||0)*100/(100+k); rates[k].taxable+=taxable; rates[k].cgst+=(i.amount||0-taxable)/2; rates[k].sgst+=(i.amount||0-taxable)/2; rates[k].total+=i.amount||0; }));
      result = { rows: Object.values(rates).sort((a,b)=>a.rate-b.rate), cols:['GST Rate','Taxable','CGST','SGST','Total'] };
    } else if (reportType === 'expense_report') {
      const cats = {};
      expenses.forEach(e => { const k=e.category||'Other'; if(!cats[k])cats[k]={category:k,count:0,amount:0}; cats[k].count++; cats[k].amount+=e.amount||0; });
      result = { rows: Object.values(cats).sort((a,b)=>b.amount-a.amount), cols:['Category','Count','Amount'], total:{ amount:expenses.reduce((s,e)=>s+(e.amount||0),0) }};
    } else if (reportType === 'profit_loss') {
      const revenue  = sales.reduce((s,x)=>s+(x.total||0),0);
      const cogs     = purchases.reduce((s,x)=>s+(x.total||0),0);
      const expTotal = expenses.reduce((s,x)=>s+(x.amount||0),0);
      const grossProfit = revenue - cogs;
      const netProfit   = grossProfit - expTotal;
      result = { rows:[
        {label:'Revenue',    value:revenue,     type:'income'},
        {label:'Cost of Goods (Purchases)', value:cogs, type:'expense'},
        {label:'Gross Profit', value:grossProfit, type:grossProfit>=0?'profit':'loss'},
        {label:'Operating Expenses', value:expTotal, type:'expense'},
        {label:'Net Profit', value:netProfit, type:netProfit>=0?'profit':'loss'},
      ], cols:['Metric','Amount'], isPL:true };
    }
    setData(result);
    setLoading(false);
  }

  async function exportExcel() {
    if (!data) return;
    const XLSX = await loadXLSX();
    const rType = REPORT_TYPES.find(r=>r.id===reportType);
    let wsData = [['Elite Store — ' + rType.label, '', '', ''], ['Period:', `${dateFrom} to ${dateTo}`, '', ''], []];
    if (data.isPL) {
      wsData.push(['Metric','Amount (Rs.)']);
      data.rows.forEach(r => wsData.push([r.label, fmtD(r.value)]));
    } else {
      wsData.push(data.cols);
      data.rows.forEach(row => wsData.push(Object.values(row)));
      if (data.total) wsData.push(['TOTAL', ...Object.values(data.total).map(v=>fmtD(v))]);
    }
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, rType.label.replace(/[^a-zA-Z0-9]/g,''));
    XLSX.writeFile(wb, `EliteStore_${reportType}_${dateFrom}_${dateTo}.xlsx`);
  }

  function printReport() {
    window.print();
  }

  const TYPE_COLORS = { income:T.green, expense:T.red, profit:T.green, loss:T.red };

  return (
    <div style={{ padding:20 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
        <div>
          <div style={{ fontSize:22, fontWeight:800, color:T.ink }}>📊 Advanced Reports</div>
          <div style={{ fontSize:13, color:T.sub }}>Custom date range · Excel export · Print</div>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <button onClick={exportExcel} disabled={!data} style={{ background:T.green+'22', color:T.green, border:`1px solid ${T.green}44`, borderRadius:8, padding:'9px 14px', fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>⬇️ Excel</button>
          <button onClick={printReport} disabled={!data} style={{ background:T.blue+'22', color:T.blue, border:`1px solid ${T.blue}44`, borderRadius:8, padding:'9px 14px', fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>🖨️ Print</button>
        </div>
      </div>

      {/* Report type selector */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:8, marginBottom:16 }}>
        {REPORT_TYPES.map(r=>(
          <div key={r.id} onClick={()=>setReportType(r.id)} style={{ background:reportType===r.id?T.blue+'22':T.srf, border:`1px solid ${reportType===r.id?T.blue:T.bdr}`, borderRadius:9, padding:'10px 12px', cursor:'pointer' }}>
            <div style={{ fontSize:12, fontWeight:700, color:reportType===r.id?T.blue:T.ink }}>{r.label}</div>
            <div style={{ fontSize:10, color:T.muted, marginTop:3 }}>{r.desc}</div>
          </div>
        ))}
      </div>

      {/* Date range + run */}
      <div style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:12, padding:16, marginBottom:16, display:'flex', gap:12, alignItems:'flex-end', flexWrap:'wrap' }}>
        {[['From','date',dateFrom,setDateFrom],['To','date',dateTo,setDateTo]].map(([label,type,val,setter])=>(
          <div key={label}>
            <label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:5 }}>{label}</label>
            <input type={type} value={val} onChange={e=>setter(e.target.value)} style={{ background:T.card, border:`1px solid ${T.bdr}`, borderRadius:7, padding:'8px 12px', color:T.ink, fontSize:13, fontFamily:'inherit', outline:'none' }}/>
          </div>
        ))}
        {/* Quick ranges */}
        <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
          {[['Today', ()=>{const t=new Date().toISOString().slice(0,10);setDateFrom(t);setDateTo(t);}],
            ['This Month', ()=>{setDateFrom(new Date().toISOString().slice(0,7)+'-01');setDateTo(new Date().toISOString().slice(0,10));}],
            ['Last Month', ()=>{const d=new Date();d.setMonth(d.getMonth()-1);const y=d.getFullYear(),m=String(d.getMonth()+1).padStart(2,'0');setDateFrom(`${y}-${m}-01`);setDateTo(`${y}-${m}-${new Date(y,d.getMonth()+1,0).getDate()}`);}],
            ['This Year',  ()=>{setDateFrom(`${new Date().getFullYear()}-01-01`);setDateTo(new Date().toISOString().slice(0,10));}],
          ].map(([label,fn])=>(
            <button key={label} onClick={fn} style={{ background:T.card, color:T.sub, border:`1px solid ${T.bdr}`, borderRadius:6, padding:'5px 10px', fontSize:11, cursor:'pointer', fontFamily:'inherit' }}>{label}</button>
          ))}
        </div>
        <button onClick={runReport} disabled={loading} style={{ background:T.blue, color:'#fff', border:'none', borderRadius:8, padding:'10px 20px', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>
          {loading?'Running…':'▶ Run Report'}
        </button>
      </div>

      {/* Results */}
      {data && (
        <div style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:12, overflow:'hidden' }}>
          <div style={{ padding:'12px 18px', borderBottom:`1px solid ${T.bdr}`, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <div style={{ fontWeight:700, color:T.ink }}>{REPORT_TYPES.find(r=>r.id===reportType)?.label} · {dateFrom} to {dateTo}</div>
            {data.rows?.length>0&&<div style={{ fontSize:12, color:T.muted }}>{data.rows.length} rows</div>}
          </div>

          {data.isPL ? (
            <div style={{ padding:20 }}>
              {data.rows.map((row,i)=>(
                <div key={i} style={{ display:'flex', justifyContent:'space-between', padding:'12px 16px', background:['Gross Profit','Net Profit'].includes(row.label)?T.card:'transparent', borderRadius:8, marginBottom:4, borderLeft:['Gross Profit','Net Profit'].includes(row.label)?`3px solid ${TYPE_COLORS[row.type]||T.sub}`:'none' }}>
                  <span style={{ fontSize:14, color:T.ink, fontWeight:['Gross Profit','Net Profit'].includes(row.label)?700:500 }}>{row.label}</span>
                  <span style={{ fontSize:16, fontWeight:800, color:TYPE_COLORS[row.type]||T.ink }}>{fmt(Math.abs(row.value))}{row.value<0?' (Loss)':''}</span>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ overflowX:'auto' }}>
              <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
                <thead><tr style={{ background:T.card }}>
                  {data.cols.map(col=><th key={col} style={{ padding:'9px 14px', textAlign:'left', fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', borderBottom:`1px solid ${T.bdr}` }}>{col}</th>)}
                </tr></thead>
                <tbody>
                  {data.rows.map((row,i)=>(
                    <tr key={i} style={{ borderBottom:`1px solid ${T.bdr}22` }}>
                      {Object.values(row).map((val,j)=>(
                        <td key={j} style={{ padding:'9px 14px', color:j===0?T.ink:typeof val==='number'?T.green:T.sub, fontWeight:j===0?600:400 }}>
                          {typeof val==='number'?fmt(val):val}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {!data&&!loading&&<div style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:12, padding:60, textAlign:'center', color:T.muted }}><div style={{ fontSize:32, marginBottom:12 }}>📊</div><div>Select a report type, set date range, then click Run Report</div></div>}
    </div>
  );
}
