import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

const T = {
  bg:'#F7F3F3', srf:'#FFFFFF', card:'#FFFFFF', bdr:'#E8DEDE',
  red:'#C0392B', darkRed:'#8B0000', lightRed:'#FEF2F2',
  green:'#16A34A', amber:'#D97706', blue:'#2563EB', purple:'#7C3AED',
  ink:'#111827', sub:'#6B7280', muted:'#9CA3AF', white:'#FFFFFF'
};
const fmt = n => 'Rs.' + (n||0).toLocaleString('en-IN', { maximumFractionDigits:0 });
const pct = n => (n||0).toFixed(1) + '%';

export default function StockValuation({ tenant }) {
  const [products, setProducts] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [sortBy,   setSortBy]   = useState('value_cost');
  const [category, setCategory] = useState('all');
  const [search,   setSearch]   = useState('');

  useEffect(() => { if (tenant?.id) load(); }, [tenant?.id]);

  async function load() {
    setLoading(true);
    const { data } = await supabase.from('inventory').select('*').eq('tenant_id', tenant.id).eq('active', true).order('name');
    const enriched = (data||[]).map(p => ({
      ...p,
      value_cost:   (p.cp||0) * (p.stock||0),
      value_selling:(p.sp||0) * (p.stock||0),
      potential_profit: ((p.sp||0)-(p.cp||0)) * (p.stock||0),
      margin_pct: p.sp>0 ? ((p.sp-(p.cp||0))/p.sp*100) : 0,
    }));
    setProducts(enriched);
    setLoading(false);
  }

  const categories = ['all', ...new Set(products.map(p=>p.category).filter(Boolean))];

  const filtered = products
    .filter(p=>category==='all'||p.category===category)
    .filter(p=>!search||p.name.toLowerCase().includes(search.toLowerCase())||p.code?.toLowerCase().includes(search.toLowerCase()))
    .sort((a,b)=>b[sortBy]-a[sortBy]);

  const totalCost    = filtered.reduce((s,p)=>s+p.value_cost,   0);
  const totalSelling = filtered.reduce((s,p)=>s+p.value_selling,0);
  const totalProfit  = filtered.reduce((s,p)=>s+p.potential_profit,0);
  const totalItems   = filtered.reduce((s,p)=>s+(p.stock||0),   0);
  const overallMargin= totalSelling>0 ? (totalProfit/totalSelling*100) : 0;

  function printValuation() {
    const w = window.open('','_blank');
    w.document.write(`<!DOCTYPE html><html><head><style>
      body{font-family:Arial,sans-serif;font-size:11px;padding:20px}
      h2{color:#8B0000;margin-bottom:4px}
      table{width:100%;border-collapse:collapse;margin-top:16px}
      th,td{padding:6px 10px;border:1px solid #ddd;text-align:left}
      th{background:#f5f0f0;font-weight:700;font-size:10px;text-transform:uppercase}
      .right{text-align:right}.red{color:#C0392B}.green{color:#16A34A}
      .summary{display:flex;gap:20px;margin:12px 0;padding:12px;background:#f5f0f0;border-radius:6px}
      .sum-item{flex:1;text-align:center}
      .sum-value{font-size:16px;font-weight:900;color:#C0392B}
      .sum-label{font-size:9px;color:#666;text-transform:uppercase;margin-top:2px}
    </style></head><body>
    <div style="display:flex;justify-content:space-between">
      <div><h2>${tenant?.name||'7SQ'} — Stock Valuation Report</h2><div>Generated: ${new Date().toLocaleString('en-IN')}</div></div>
      <div style="text-align:right"><div>${category!=='all'?'Category: '+category:'All Categories'}</div></div>
    </div>
    <div class="summary">
      <div class="sum-item"><div class="sum-value">${fmt(totalCost)}</div><div class="sum-label">Cost Value</div></div>
      <div class="sum-item"><div class="sum-value">${fmt(totalSelling)}</div><div class="sum-label">Selling Value</div></div>
      <div class="sum-item"><div class="sum-value" style="color:#16A34A">${fmt(totalProfit)}</div><div class="sum-label">Potential Profit</div></div>
      <div class="sum-item"><div class="sum-value">${totalItems}</div><div class="sum-label">Total Units</div></div>
    </div>
    <table>
      <tr><th>#</th><th>Product</th><th>Code</th><th>Category</th><th class="right">Stock</th><th class="right">Cost Price</th><th class="right">Selling Price</th><th class="right">Cost Value</th><th class="right">Selling Value</th><th class="right">Pot. Profit</th><th class="right">Margin</th></tr>
      ${filtered.map((p,i)=>`<tr>
        <td>${i+1}</td><td>${p.name}</td><td>${p.code||'—'}</td><td>${p.category||'—'}</td>
        <td class="right">${p.stock||0}</td>
        <td class="right">${fmt(p.cp||0)}</td>
        <td class="right">${fmt(p.sp||0)}</td>
        <td class="right">${fmt(p.value_cost)}</td>
        <td class="right">${fmt(p.value_selling)}</td>
        <td class="right green">${fmt(p.potential_profit)}</td>
        <td class="right">${pct(p.margin_pct)}</td>
      </tr>`).join('')}
      <tr style="background:#f5f0f0;font-weight:700">
        <td colspan="4"><strong>TOTAL (${filtered.length} products)</strong></td>
        <td class="right">${totalItems}</td>
        <td colspan="2"></td>
        <td class="right red">${fmt(totalCost)}</td>
        <td class="right red">${fmt(totalSelling)}</td>
        <td class="right green">${fmt(totalProfit)}</td>
        <td class="right">${pct(overallMargin)}</td>
      </tr>
    </table>
    <script>window.onload=()=>{window.print();setTimeout(()=>window.close(),500)}<\/script>
    </body></html>`);
    w.document.close();
  }

  return (
    <div style={{ padding:24, background:T.bg, minHeight:'100%' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:24 }}>
        <div>
          <div style={{ fontSize:22, fontWeight:800, color:T.darkRed, letterSpacing:'-0.02em' }}>🏦 Stock Valuation</div>
          <div style={{ fontSize:13, color:T.sub, marginTop:2 }}>Inventory value at cost and selling price with potential profit</div>
        </div>
        <button onClick={printValuation} style={{ background:T.lightRed, color:T.red, border:`1px solid ${T.bdr}`, borderRadius:8, padding:'9px 16px', fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>🖨️ Print Report</button>
      </div>

      {/* Summary KPIs */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:14, marginBottom:20 }}>
        {[
          ['Products',     filtered.length,    T.blue,                         '📦'],
          ['Total Units',  totalItems,          T.purple,                       '🔢'],
          ['Cost Value',   fmt(totalCost),      T.red,                          '💴'],
          ['Selling Value',fmt(totalSelling),   T.blue,                         '💰'],
          ['Potential Profit',fmt(totalProfit), totalProfit>=0?T.green:T.red,   '📊'],
        ].map(([label,val,color,icon])=>(
          <div key={label} style={{ background:T.white, border:`1px solid ${T.bdr}`, borderRadius:12, padding:'14px 16px', boxShadow:'0 1px 4px rgba(0,0,0,.05)' }}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:5 }}>
              <div style={{ fontSize:9, color:T.sub, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.05em' }}>{label}</div>
              <span style={{ fontSize:16 }}>{icon}</span>
            </div>
            <div style={{ fontSize:18, fontWeight:900, color, letterSpacing:'-0.02em' }}>{val}</div>
          </div>
        ))}
      </div>

      {/* Overall margin bar */}
      <div style={{ background:T.white, border:`1px solid ${T.bdr}`, borderRadius:12, padding:'16px 20px', marginBottom:20, display:'flex', alignItems:'center', gap:20 }}>
        <div style={{ flex:1 }}>
          <div style={{ display:'flex', justifyContent:'space-between', marginBottom:8 }}>
            <span style={{ fontSize:13, fontWeight:700, color:T.darkRed }}>Overall Margin</span>
            <span style={{ fontSize:16, fontWeight:900, color:T.green }}>{pct(overallMargin)}</span>
          </div>
          <div style={{ height:10, background:'#F3F4F6', borderRadius:5, overflow:'hidden' }}>
            <div style={{ height:'100%', width:`${Math.min(100, overallMargin)}%`, background:`linear-gradient(90deg,${T.red},${T.green})`, borderRadius:5, transition:'width .6s' }}/>
          </div>
        </div>
        <div style={{ display:'flex', gap:16, flexShrink:0 }}>
          <div style={{ textAlign:'center' }}><div style={{ fontSize:10, color:T.muted, marginBottom:3 }}>Markup</div><div style={{ fontWeight:700, color:T.blue }}>{pct(totalCost>0?(totalSelling-totalCost)/totalCost*100:0)}</div></div>
          <div style={{ textAlign:'center' }}><div style={{ fontSize:10, color:T.muted, marginBottom:3 }}>Zero Stock</div><div style={{ fontWeight:700, color:T.red }}>{products.filter(p=>!p.stock||p.stock<=0).length}</div></div>
          <div style={{ textAlign:'center' }}><div style={{ fontSize:10, color:T.muted, marginBottom:3 }}>Low Stock</div><div style={{ fontWeight:700, color:T.amber }}>{products.filter(p=>p.stock>0&&p.stock<=(p.alert||5)).length}</div></div>
        </div>
      </div>

      {/* Filters */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14, gap:10, flexWrap:'wrap' }}>
        <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
          {categories.map(c=>(
            <button key={c} onClick={()=>setCategory(c)} style={{ padding:'5px 12px', background:category===c?T.red:T.white, color:category===c?T.white:T.sub, border:`1px solid ${category===c?T.red:T.bdr}`, borderRadius:20, fontSize:11, fontWeight:600, cursor:'pointer', fontFamily:'inherit', textTransform:'capitalize' }}>
              {c==='all'?'All Categories':c}
            </button>
          ))}
        </div>
        <div style={{ display:'flex', gap:8, alignItems:'center' }}>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search product…" style={{ background:T.white, border:`1px solid ${T.bdr}`, borderRadius:8, padding:'7px 12px', color:T.ink, fontSize:12, fontFamily:'inherit', outline:'none', width:180 }}/>
          <select value={sortBy} onChange={e=>setSortBy(e.target.value)} style={{ background:T.white, border:`1px solid ${T.bdr}`, borderRadius:8, padding:'7px 10px', color:T.ink, fontSize:11, fontFamily:'inherit', outline:'none' }}>
            {[['value_cost','Sort: Cost Value'],['value_selling','Sort: Selling Value'],['potential_profit','Sort: Profit'],['margin_pct','Sort: Margin'],['stock','Sort: Stock Qty']].map(([v,l])=><option key={v} value={v}>{l}</option>)}
          </select>
        </div>
      </div>

      {/* Table */}
      <div style={{ background:T.white, border:`1px solid ${T.bdr}`, borderRadius:14, overflow:'hidden', boxShadow:'0 1px 4px rgba(0,0,0,.05)' }}>
        <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
          <thead><tr style={{ background:T.lightRed }}>
            {['#','Product','Cat.','Stock','Cost ₹','SP ₹','Cost Value','Selling Value','Pot. Profit','Margin'].map(h=>(
              <th key={h} style={{ padding:'11px 12px', textAlign:h==='#'||h==='Product'||h==='Cat.'?'left':'right', fontSize:9, color:T.darkRed, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.04em', borderBottom:`1px solid ${T.bdr}`, whiteSpace:'nowrap' }}>{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {loading?<tr><td colSpan={10} style={{ textAlign:'center', padding:60, color:T.muted }}>Loading inventory…</td></tr>
            :filtered.map((p,i)=>{
              const mColor = p.margin_pct>=30?T.green:p.margin_pct>=15?T.blue:p.margin_pct>=0?T.amber:T.red;
              const sColor = p.stock<=0?T.red:p.stock<=(p.alert||5)?T.amber:T.ink;
              return (
                <tr key={p.id} style={{ borderBottom:`1px solid ${T.bdr}22`, background:i%2===0?'transparent':'#FAFAFA' }}>
                  <td style={{ padding:'10px 12px', color:T.muted, fontSize:10 }}>{i+1}</td>
                  <td style={{ padding:'10px 12px' }}>
                    <div style={{ fontWeight:600, color:T.ink, fontSize:12 }}>{p.name}</div>
                    {p.code&&<div style={{ fontSize:9, color:T.muted }}>{p.code}</div>}
                  </td>
                  <td style={{ padding:'10px 12px', color:T.sub, fontSize:10 }}>{p.category||'—'}</td>
                  <td style={{ padding:'10px 12px', textAlign:'right', fontWeight:700, color:sColor }}>{p.stock||0}</td>
                  <td style={{ padding:'10px 12px', textAlign:'right', color:T.sub }}>{fmt(p.cp||0)}</td>
                  <td style={{ padding:'10px 12px', textAlign:'right', color:T.sub }}>{fmt(p.sp||0)}</td>
                  <td style={{ padding:'10px 12px', textAlign:'right', color:T.ink, fontWeight:600 }}>{fmt(p.value_cost)}</td>
                  <td style={{ padding:'10px 12px', textAlign:'right', color:T.blue, fontWeight:600 }}>{fmt(p.value_selling)}</td>
                  <td style={{ padding:'10px 12px', textAlign:'right', color:p.potential_profit>=0?T.green:T.red, fontWeight:700 }}>{fmt(p.potential_profit)}</td>
                  <td style={{ padding:'10px 12px', textAlign:'right' }}>
                    <span style={{ background:p.margin_pct>=30?'#F0FDF4':p.margin_pct>=15?'#EFF6FF':p.margin_pct>=0?'#FFFBEB':'#FEF2F2', color:mColor, border:`1px solid ${p.margin_pct>=30?'#BBF7D0':p.margin_pct>=15?'#BFDBFE':p.margin_pct>=0?'#FDE68A':'#FECACA'}`, borderRadius:5, padding:'2px 7px', fontSize:10, fontWeight:700 }}>
                      {pct(p.margin_pct)}
                    </span>
                  </td>
                </tr>
              );
            })}
            {filtered.length>0&&<tr style={{ background:T.lightRed }}>
              <td colSpan={3} style={{ padding:'11px 12px', fontWeight:800, color:T.darkRed, fontSize:11 }}>TOTAL ({filtered.length} products)</td>
              <td style={{ padding:'11px 12px', textAlign:'right', fontWeight:800, color:T.ink }}>{totalItems}</td>
              <td colSpan={2}/>
              <td style={{ padding:'11px 12px', textAlign:'right', fontWeight:800, color:T.red }}>{fmt(totalCost)}</td>
              <td style={{ padding:'11px 12px', textAlign:'right', fontWeight:800, color:T.blue }}>{fmt(totalSelling)}</td>
              <td style={{ padding:'11px 12px', textAlign:'right', fontWeight:800, color:T.green }}>{fmt(totalProfit)}</td>
              <td style={{ padding:'11px 12px', textAlign:'right', fontWeight:800, color:T.green }}>{pct(overallMargin)}</td>
            </tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
