import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

const T = {
  bg:'#F7F3F3', srf:'#FFFFFF', card:'#FFFFFF', bdr:'#E8DEDE',
  red:'#C0392B', darkRed:'#8B0000', lightRed:'#FEF2F2',
  green:'#16A34A', amber:'#D97706', blue:'#2563EB', purple:'#7C3AED',
  ink:'#111827', sub:'#6B7280', muted:'#9CA3AF', white:'#FFFFFF'
};
const fmt  = n => 'Rs.' + (n||0).toLocaleString('en-IN', { maximumFractionDigits:0 });
const pct  = n => (n||0).toFixed(1) + '%';

function MiniBar({ value, max, color }) {
  const w = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div style={{ height:6, background:'#F3F4F6', borderRadius:3, overflow:'hidden', minWidth:80 }}>
      <div style={{ height:'100%', width:`${w}%`, background:color, borderRadius:3, transition:'width .5s' }}/>
    </div>
  );
}

export default function ProductPerformance({ tenant }) {
  const [products, setProducts] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [period,   setPeriod]   = useState('30');
  const [sortBy,   setSortBy]   = useState('revenue');
  const [view,     setView]     = useState('all');

  useEffect(() => { if (tenant?.id) load(); }, [tenant?.id, period]);

  async function load() {
    setLoading(true);
    const since = new Date();
    since.setDate(since.getDate() - parseInt(period));
    const sinceStr = since.toISOString().slice(0,10);

    const [invRes, salesRes] = await Promise.all([
      supabase.from('inventory').select('id,name,code,cp,sp,stock,category,gst').eq('tenant_id', tenant.id).eq('active', true),
      supabase.from('sales').select('items,date').eq('tenant_id', tenant.id).gte('date', sinceStr),
    ]);

    const inv = invRes.data || [];
    const sales = salesRes.data || [];

    // Aggregate sales per product
    const aggr = {};
    sales.forEach(sale => {
      (sale.items || []).forEach(item => {
        if (!item.id && !item.name) return;
        const key = item.id || item.name;
        if (!aggr[key]) aggr[key] = { qty:0, revenue:0, cost:0 };
        aggr[key].qty     += item.qty || 1;
        aggr[key].revenue += (item.rate || item.sp || 0) * (item.qty || 1);
        aggr[key].cost    += (item.cp || 0) * (item.qty || 1);
      });
    });

    const merged = inv.map(p => {
      const a     = aggr[p.id] || aggr[p.name] || { qty:0, revenue:0, cost:0 };
      const cost  = a.cost || (p.cp * a.qty);
      const profit= a.revenue - cost;
      const margin= a.revenue > 0 ? (profit / a.revenue * 100) : 0;
      const roi   = cost > 0 ? (profit / cost * 100) : 0;
      return { ...p, sold_qty:a.qty, revenue:a.revenue, cost_total:cost, profit, margin, roi };
    });

    setProducts(merged);
    setLoading(false);
  }

  const sorted = [...products].sort((a,b) => {
    if (sortBy==='revenue') return b.revenue - a.revenue;
    if (sortBy==='qty')     return b.sold_qty - a.sold_qty;
    if (sortBy==='margin')  return b.margin   - a.margin;
    if (sortBy==='profit')  return b.profit   - a.profit;
    if (sortBy==='stock')   return b.stock    - a.stock;
    return 0;
  });

  const displayed = view==='all'    ? sorted
                  : view==='top'    ? sorted.filter(p=>p.sold_qty>0).slice(0,10)
                  : view==='dead'   ? sorted.filter(p=>p.sold_qty===0)
                  : view==='low'    ? sorted.filter(p=>p.stock<=5)
                  : sorted.filter(p=>p.margin<0);

  const maxRevenue = Math.max(...displayed.map(p=>p.revenue), 1);
  const maxQty     = Math.max(...displayed.map(p=>p.sold_qty), 1);
  const totalRev   = products.reduce((s,p)=>s+p.revenue,0);
  const totalProfit= products.reduce((s,p)=>s+p.profit,0);
  const avgMargin  = products.filter(p=>p.revenue>0).reduce((s,p)=>s+p.margin,0) / (products.filter(p=>p.revenue>0).length||1);

  return (
    <div style={{ padding:24, background:T.bg, minHeight:'100%' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:24 }}>
        <div>
          <div style={{ fontSize:22, fontWeight:800, color:T.darkRed, letterSpacing:'-0.02em' }}>📈 Product Performance</div>
          <div style={{ fontSize:13, color:T.sub, marginTop:2 }}>Per-product revenue, margin, velocity and profitability</div>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <select value={period} onChange={e=>setPeriod(e.target.value)} style={{ background:T.white, border:`1px solid ${T.bdr}`, borderRadius:8, padding:'8px 12px', color:T.ink, fontSize:12, fontFamily:'inherit', outline:'none' }}>
            {[['7','Last 7 days'],['30','Last 30 days'],['90','Last 90 days'],['365','Last 1 year']].map(([v,l])=><option key={v} value={v}>{l}</option>)}
          </select>
        </div>
      </div>

      {/* Summary KPIs */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:14, marginBottom:20 }}>
        {[
          ['Total Revenue',   fmt(totalRev),                    T.blue,   '💰'],
          ['Total Profit',    fmt(totalProfit),                 totalProfit>=0?T.green:T.red, '📊'],
          ['Avg Margin',      pct(avgMargin),                   T.purple, '📉'],
          ['Dead Stock Items',products.filter(p=>p.sold_qty===0).length, T.amber, '📦'],
        ].map(([label,val,color,icon])=>(
          <div key={label} style={{ background:T.white, border:`1px solid ${T.bdr}`, borderRadius:12, padding:'16px 18px', boxShadow:'0 1px 4px rgba(0,0,0,.05)' }}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:6 }}>
              <div style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.05em' }}>{label}</div>
              <span style={{ fontSize:18 }}>{icon}</span>
            </div>
            <div style={{ fontSize:22, fontWeight:900, color, letterSpacing:'-0.02em' }}>{val}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14, flexWrap:'wrap', gap:10 }}>
        <div style={{ display:'flex', gap:6 }}>
          {[['all','All Products'],['top','Top 10'],['dead','No Sales'],['low','Low Stock'],['neg','Low Margin']].map(([v,label])=>(
            <button key={v} onClick={()=>setView(v)} style={{ padding:'6px 12px', background:view===v?T.red:T.white, color:view===v?T.white:T.sub, border:`1px solid ${view===v?T.red:T.bdr}`, borderRadius:20, fontSize:11, fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}>{label}</button>
          ))}
        </div>
        <div style={{ display:'flex', gap:8, alignItems:'center' }}>
          <span style={{ fontSize:11, color:T.sub }}>Sort by:</span>
          {[['revenue','Revenue'],['qty','Units Sold'],['profit','Profit'],['margin','Margin'],['stock','Stock']].map(([v,label])=>(
            <button key={v} onClick={()=>setSortBy(v)} style={{ padding:'5px 10px', background:sortBy===v?T.darkRed:T.white, color:sortBy===v?T.white:T.sub, border:`1px solid ${sortBy===v?T.darkRed:T.bdr}`, borderRadius:6, fontSize:10, fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}>{label}</button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div style={{ background:T.white, border:`1px solid ${T.bdr}`, borderRadius:14, overflow:'hidden', boxShadow:'0 1px 4px rgba(0,0,0,.05)' }}>
        <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
          <thead><tr style={{ background:T.lightRed }}>
            {['#','Product','Stock','Sold','Revenue','Cost','Profit','Margin','Velocity'].map(h=>(
              <th key={h} style={{ padding:'11px 14px', textAlign:h==='#'||h==='Product'?'left':'right', fontSize:9, color:T.darkRed, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.05em', borderBottom:`1px solid ${T.bdr}`, whiteSpace:'nowrap' }}>{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {loading?<tr><td colSpan={9} style={{ textAlign:'center', padding:60, color:T.muted }}>Analysing product data…</td></tr>
            :displayed.length===0?<tr><td colSpan={9} style={{ textAlign:'center', padding:60 }}><div style={{ fontSize:36, marginBottom:8 }}>📊</div><div style={{ color:T.muted, fontWeight:600 }}>No products found</div></td></tr>
            :displayed.map((p,i)=>{
              const marginColor = p.margin>=30?T.green:p.margin>=15?T.blue:p.margin>=0?T.amber:T.red;
              return (
                <tr key={p.id} style={{ borderBottom:`1px solid ${T.bdr}22`, background:i%2===0?'transparent':'#FAFAFA' }}>
                  <td style={{ padding:'11px 14px', color:T.muted, fontSize:11 }}>{i+1}</td>
                  <td style={{ padding:'11px 14px' }}>
                    <div style={{ fontWeight:600, color:T.ink }}>{p.name}</div>
                    {p.code&&<div style={{ fontSize:10, color:T.muted }}>{p.code}</div>}
                    {p.category&&<div style={{ fontSize:9, background:T.lightRed, color:T.red, borderRadius:4, padding:'1px 6px', display:'inline-block', marginTop:2 }}>{p.category}</div>}
                  </td>
                  <td style={{ padding:'11px 14px', textAlign:'right', color:p.stock<=5?T.red:p.stock<=10?T.amber:T.ink, fontWeight:p.stock<=5?700:400 }}>{p.stock||0}</td>
                  <td style={{ padding:'11px 14px', textAlign:'right' }}>
                    <div style={{ fontWeight:p.sold_qty>0?700:400, color:p.sold_qty>0?T.ink:T.muted }}>{p.sold_qty}</div>
                    <MiniBar value={p.sold_qty} max={maxQty} color={T.blue}/>
                  </td>
                  <td style={{ padding:'11px 14px', textAlign:'right' }}>
                    <div style={{ fontWeight:700, color:T.blue }}>{fmt(p.revenue)}</div>
                    <MiniBar value={p.revenue} max={maxRevenue} color={T.blue}/>
                  </td>
                  <td style={{ padding:'11px 14px', textAlign:'right', color:T.sub }}>{fmt(p.cost_total)}</td>
                  <td style={{ padding:'11px 14px', textAlign:'right', color:p.profit>=0?T.green:T.red, fontWeight:700 }}>{fmt(p.profit)}</td>
                  <td style={{ padding:'11px 14px', textAlign:'right' }}>
                    <span style={{ background:p.margin>=30?'#F0FDF4':p.margin>=15?'#EFF6FF':p.margin>=0?'#FFFBEB':'#FEF2F2', color:marginColor, border:`1px solid ${p.margin>=30?'#BBF7D0':p.margin>=15?'#BFDBFE':p.margin>=0?'#FDE68A':'#FECACA'}`, borderRadius:5, padding:'2px 8px', fontSize:10, fontWeight:700 }}>
                      {pct(p.margin)}
                    </span>
                  </td>
                  <td style={{ padding:'11px 14px', textAlign:'right', fontSize:11, color:T.sub }}>
                    {p.sold_qty>0 ? `${(p.sold_qty/parseInt(period)*30).toFixed(1)}/mo` : <span style={{ color:T.muted }}>—</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
