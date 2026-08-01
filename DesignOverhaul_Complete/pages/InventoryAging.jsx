import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { getInventory } from '../lib/supabase';

const T = {
  bg:'#060710', srf:'#0b0d1a', card:'#0f1220', card2:'#141828',
  bdr:'#1a1e32', bdr2:'#222740',
  blue:'#4f7cff', green:'#00d68f', red:'#ff4d6a', amber:'#ffb547',
  purple:'#9b72ff', teal:'#00c9b1', orange:'#ff7043', gold:'#ffc107',
  cyan:'#00d4ff', pink:'#f06292',
  muted:'#4a5175', dim:'#2a3050', card3:'#181d2e',
  ink:'#eef0f8', sub:'#8892b0'
};
const fmt = n => 'Rs.' + (n||0).toLocaleString('en-IN', { maximumFractionDigits:0 });

const AGING_BUCKETS = [
  { id:'fast',    label:'🚀 Fast Moving',  days:30,  color:T.green,  desc:'Sold in last 30 days' },
  { id:'normal',  label:'📦 Normal',       days:60,  color:T.blue,   desc:'Sold 30-60 days ago' },
  { id:'slow',    label:'🐌 Slow Moving',  days:90,  color:T.amber,  desc:'Sold 60-90 days ago' },
  { id:'dead',    label:'💀 Dead Stock',   days:9999,color:T.red,    desc:'No sale in 90+ days' },
];

export default function InventoryAging({ tenant }) {
  const [data,      setData]      = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [filter,    setFilter]    = useState('all');
  const [search,    setSearch]    = useState('');
  const [suggested, setSuggested] = useState({});
  const [saving,    setSaving]    = useState('');

  useEffect(() => { if (tenant?.id) load(); }, [tenant?.id]);

  async function load() {
    setLoading(true);
    const [inventory, salesRes] = await Promise.all([
      getInventory(tenant.id),
      supabase.from('sales').select('items,date').eq('tenant_id', tenant.id).gte('date', new Date(Date.now()-180*86400000).toISOString().slice(0,10)),
    ]);

    // Map last sale date per item name
    const lastSold = {};
    const soldQty  = {};
    (salesRes.data||[]).forEach(s => {
      (s.items||[]).forEach(item => {
        if (!lastSold[item.name] || s.date > lastSold[item.name]) lastSold[item.name] = s.date;
        soldQty[item.name] = (soldQty[item.name]||0) + (item.qty||0);
      });
    });

    const now = Date.now();
    const enriched = inventory.filter(i=>(i.stock||0)>0).map(i => {
      const ls  = lastSold[i.name];
      const daysSince = ls ? Math.floor((now - new Date(ls)) / 86400000) : 9999;
      const bucket = AGING_BUCKETS.find(b => daysSince <= b.days) || AGING_BUCKETS[3];
      const suggestedDiscount = bucket.id==='slow'?10:bucket.id==='dead'?25:0;
      const suggestedPrice    = Math.round(i.sp * (1 - suggestedDiscount/100));
      return { ...i, daysSince, lastSold:ls, bucket:bucket.id, soldQty30:soldQty[i.name]||0, suggestedDiscount, suggestedPrice, stockValue:(i.stock||0)*(i.cp||0) };
    }).sort((a,b)=>b.daysSince-a.daysSince);

    setData(enriched);
    setLoading(false);
  }

  async function applyPrice(item, price) {
    setSaving(item.id);
    await supabase.from('inventory').update({ sp:price }).eq('id', item.id);
    setData(prev=>prev.map(i=>i.id===item.id?{...i,sp:price}:i));
    setSaving('');
  }

  const filtered = data.filter(i => {
    const matchFilter = filter==='all' || i.bucket===filter;
    const matchSearch = !search || i.name.toLowerCase().includes(search.toLowerCase());
    return matchFilter && matchSearch;
  });

  const bucketCounts = AGING_BUCKETS.reduce((acc,b)=>({...acc,[b.id]:data.filter(i=>i.bucket===b.id).length}),{});
  const deadStockValue = data.filter(i=>i.bucket==='dead').reduce((s,i)=>s+i.stockValue,0);
  const slowStockValue = data.filter(i=>i.bucket==='slow').reduce((s,i)=>s+i.stockValue,0);

  return (
    <div style={{ padding:20 }}>
      <div style={{ fontSize:22, fontWeight:800, color:T.ink, marginBottom:6 }}>📈 Inventory Aging</div>
      <div style={{ fontSize:13, color:T.sub, marginBottom:20 }}>Identify slow-moving stock and optimize pricing</div>

      {/* Bucket cards */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12, marginBottom:20 }}>
        {AGING_BUCKETS.map(b=>(
          <div key={b.id} onClick={()=>setFilter(filter===b.id?'all':b.id)}
            style={{ background:filter===b.id?b.color+'22':T.srf, border:`1px solid ${filter===b.id?b.color:T.bdr}`, borderRadius:12, padding:'14px 16px', cursor:'pointer', textAlign:'center' }}>
            <div style={{ fontSize:22, marginBottom:6 }}>{b.label.split(' ')[0]}</div>
            <div style={{ fontSize:24, fontWeight:800, color:b.color }}>{bucketCounts[b.id]||0}</div>
            <div style={{ fontSize:12, fontWeight:700, color:T.ink }}>{b.label.split(' ').slice(1).join(' ')}</div>
            <div style={{ fontSize:10, color:T.muted, marginTop:3 }}>{b.desc}</div>
          </div>
        ))}
      </div>

      {/* Alert summary */}
      {(deadStockValue > 0 || slowStockValue > 0) && (
        <div style={{ background:T.red+'12', border:`1px solid ${T.red}44`, borderRadius:12, padding:'14px 18px', marginBottom:16 }}>
          <div style={{ fontWeight:700, color:T.red, marginBottom:6 }}>⚠️ Action Required</div>
          <div style={{ fontSize:13, color:T.ink }}>
            {deadStockValue > 0 && <span>Dead stock value: <strong>{fmt(deadStockValue)}</strong> — Apply clearance pricing to recover capital. </span>}
            {slowStockValue > 0 && <span>Slow-moving stock: <strong>{fmt(slowStockValue)}</strong> — Consider 10% discount to accelerate sales.</span>}
          </div>
        </div>
      )}

      <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="🔍 Search items…"
        style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:9, padding:'10px 14px', color:T.ink, fontSize:13, fontFamily:'inherit', outline:'none', width:'100%', marginBottom:14 }} />

      <div style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:12, overflow:'hidden' }}>
        <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
          <thead><tr style={{ background:T.card }}>
            {['Item','Category','Stock','Stock Value','Last Sold','Days Since','Status','Current Price','Suggested','Action'].map(h=>(
              <th key={h} style={{ padding:'9px 12px', textAlign:'left', fontSize:9, color:T.sub, fontWeight:700, textTransform:'uppercase', borderBottom:`1px solid ${T.bdr}` }}>{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {loading?<tr><td colSpan={10} style={{ textAlign:'center', padding:40, color:T.sub }}>Analyzing inventory…</td></tr>
            :filtered.length===0?<tr><td colSpan={10} style={{ textAlign:'center', padding:40, color:T.muted }}>No items found</td></tr>
            :filtered.map(item=>{
              const bucket = AGING_BUCKETS.find(b=>b.id===item.bucket);
              const custSuggest = suggested[item.id] ?? item.suggestedPrice;
              return (
                <tr key={item.id} style={{ borderBottom:`1px solid ${T.bdr}22` }}>
                  <td style={{ padding:'9px 12px', color:T.ink, fontWeight:600 }}>{item.name}</td>
                  <td style={{ padding:'9px 12px', color:T.muted }}>{item.cat||'—'}</td>
                  <td style={{ padding:'9px 12px', color:T.ink }}>{item.stock}</td>
                  <td style={{ padding:'9px 12px', color:T.amber }}>{fmt(item.stockValue)}</td>
                  <td style={{ padding:'9px 12px', color:T.muted }}>{item.lastSold||'Never'}</td>
                  <td style={{ padding:'9px 12px', color:item.daysSince>90?T.red:item.daysSince>60?T.amber:T.green, fontWeight:700 }}>{item.daysSince===9999?'Never sold':item.daysSince+'d'}</td>
                  <td style={{ padding:'9px 12px' }}>
                    <span style={{ background:bucket?.color+'22', color:bucket?.color, borderRadius:5, padding:'2px 7px', fontSize:10, fontWeight:700 }}>{bucket?.label}</span>
                  </td>
                  <td style={{ padding:'9px 12px', color:T.ink }}>{fmt(item.sp)}</td>
                  <td style={{ padding:'9px 12px' }}>
                    {item.suggestedDiscount > 0 ? (
                      <input type="number" value={custSuggest} onChange={e=>setSuggested(s=>({...s,[item.id]:parseInt(e.target.value)||0}))}
                        style={{ width:80, background:T.card, border:`1px solid ${T.amber}`, borderRadius:6, padding:'4px 8px', color:T.amber, fontSize:12, fontFamily:'inherit', outline:'none' }} />
                    ) : <span style={{ color:T.muted }}>—</span>}
                  </td>
                  <td style={{ padding:'9px 12px' }}>
                    {item.suggestedDiscount > 0 && (
                      <button onClick={()=>applyPrice(item, custSuggest)} disabled={saving===item.id}
                        style={{ background:T.amber+'22', color:T.amber, border:`1px solid ${T.amber}44`, borderRadius:6, padding:'4px 10px', fontSize:10, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>
                        {saving===item.id?'…':'Apply -{item.suggestedDiscount}%'}
                      </button>
                    )}
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
