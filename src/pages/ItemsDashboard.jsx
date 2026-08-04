import { useState, useEffect, useMemo } from 'react';
import { canSee } from '../lib/roleAccess';
import { supabase } from '../lib/supabase';

const T = {
  bg:'#F7F3F3', srf:'#FFFFFF', card:'#FFFFFF', bdr:'#E8DEDE',
  red:'#C0392B', darkRed:'#8B0000', lightRed:'#FEF2F2',
  green:'#16A34A', amber:'#D97706', blue:'#2563EB', purple:'#7C3AED', gold:'#B45309',
  ink:'#111827', sub:'#6B7280', muted:'#9CA3AF', white:'#FFFFFF'
};
const fmt  = n => 'Rs.' + (n||0).toLocaleString('en-IN', { maximumFractionDigits:0 });
const fmtL = n => n>=100000 ? '₹'+(n/100000).toFixed(1)+'L' : fmt(n);
const btn  = (bg,color,extra={}) => ({ background:bg, color, border:'none', borderRadius:9, padding:'9px 16px', fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:'inherit', ...extra });
const inp  = { background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:8, padding:'9px 12px', color:T.ink, fontSize:13, fontFamily:'inherit', outline:'none' };

// ── AI tag thresholds — same intent as the prototype ───────────
const TAGS = {
  FAST: { l:'Fast',      icon:'🚀', color:T.green,  bg:'#F0FDF4', bdr:'#BBF7D0' },
  HMG:  { l:'High Margin',icon:'💰', color:T.gold,   bg:'#FFFBEB', bdr:'#FDE68A' },
  SLOW: { l:'Slow',      icon:'🐌', color:'#EA580C', bg:'#FFF7ED', bdr:'#FED7AA' },
  DEAD: { l:'Dead Stock', icon:'💀', color:T.red,    bg:'#FEF2F2', bdr:'#FECACA' },
  LOW:  { l:'Low Stock', icon:'⚠️', color:T.amber,  bg:'#FFFBEB', bdr:'#FDE68A' },
  NEW:  { l:'New',       icon:'✨', color:T.purple, bg:'#F5F3FF', bdr:'#DDD6FE' },
};

function tagsFor(item) {
  const tags = [];
  const margin = item.sp>0 ? (item.sp-item.cp)/item.sp*100 : 0;
  const daysSinceSale = item.lastSold ? Math.floor((Date.now()-new Date(item.lastSold))/86400000) : 999;
  const daysOld = item.created_at ? Math.floor((Date.now()-new Date(item.created_at))/86400000) : 999;

  if ((item.stock||0) <= 0)                          tags.push('DEAD');
  else if ((item.stock||0) <= (item.alert||10))       tags.push('LOW');
  if (item.sold>=30 || item.velocity>=1)              tags.push('FAST');
  else if (item.sold>0 && item.sold<10 && daysSinceSale>45) tags.push('SLOW');
  if (margin>=45)                                     tags.push('HMG');
  if (daysOld<=30)                                     tags.push('NEW');
  return [...new Set(tags)];
}

export default function ItemsDashboard({ tenant, role='owner', onSwitchTab }) {
  const showCost = canSee(role, 'costPrice');
  const showMargin = canSee(role, 'margin');
  const [inventory, setInventory] = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [view,      setView]      = useState('products'); // products | services | all
  const [search,    setSearch]    = useState('');
  const [catFilter, setCatFilter] = useState('all');
  const [tagFilter, setTagFilter] = useState('all');
  const [stockFilter,setStockFilter]= useState('all');
  const [sortBy,    setSortBy]    = useState('revenue');
  const [density,   setDensity]   = useState('list'); // list | grid
  const [showForm,  setShowForm]  = useState(false);
  const [editItem,  setEditItem]  = useState(null);
  const [saving,    setSaving]    = useState(false);
  const [saved,     setSaved]     = useState(false);
  const [form, setForm] = useState({ name:'', code:'', cat:'', hsn:'', sp:'', cp:'', mrp:'', gst:'18', stock:'', alert:'10', type:'product', unit:'Pcs', is_serialised:false, serial_label:'Serial No' });

  useEffect(() => { if (tenant?.id) load(); }, [tenant?.id]);

  const REVENUE_WINDOW_DAYS = 180;

  async function load() {
    setLoading(true);
    const since = new Date(); since.setDate(since.getDate() - REVENUE_WINDOW_DAYS);
    const [invRes, salesRes] = await Promise.all([
      supabase.from('inventory').select('*').eq('tenant_id', tenant.id).eq('active', true).order('name'),
      supabase.from('sales').select('items,date').eq('tenant_id', tenant.id)
        .gte('date', since.toISOString().slice(0,10)).order('date',{ ascending:false }),
    ]);
    const inv   = invRes.data || [];
    const sales = salesRes.data || [];

    // Revenue, units sold and last-sold date per item, computed from sale line items
    const agg = {};
    sales.forEach(s => (s.items||[]).forEach(li => {
      const key = li.id || li.name;
      if (!key) return;
      if (!agg[key]) agg[key] = { sold:0, revenue:0, lastSold:s.date };
      agg[key].sold    += li.qty || 1;
      agg[key].revenue += (li.rate||0) * (li.qty||1);
      if (s.date > agg[key].lastSold) agg[key].lastSold = s.date;
    }));

    const enriched = inv.map(it => {
      const a = agg[it.id] || agg[it.name] || { sold:0, revenue:0, lastSold:null };
      return { ...it, sold:a.sold, revenue:a.revenue, lastSold:a.lastSold, velocity:a.sold/30 };
    }).map(it => ({ ...it, aiTags: tagsFor(it) }));

    setInventory(enriched);
    setLoading(false);
  }

  function resetForm() {
    setForm({ name:'', code:'', cat:'', hsn:'', sp:'', cp:'', mrp:'', gst:'18', stock:'', alert:'10', type:'product', unit:'Pcs', is_serialised:false, serial_label:'Serial No' });
    setEditItem(null);
  }

  function openEdit(it) {
    setEditItem(it);
    setForm({ name:it.name, code:it.code||'', cat:it.cat||'', hsn:it.hsn||'', sp:String(it.sp||''), cp:String(it.cp||''), mrp:String(it.mrp||''), gst:String(it.gst||18), stock:String(it.stock||''), alert:String(it.alert||10), type:it.type||'product', unit:it.unit||'Pcs', is_serialised:!!it.is_serialised, serial_label:it.serial_label||'Serial No' });
    setShowForm(true);
  }

  function openNew(type) {
    resetForm();
    setForm(f => ({ ...f, type }));
    setShowForm(true);
  }

  async function saveItem(e) {
    e.preventDefault(); setSaving(true);
    const payload = {
      tenant_id: tenant.id, name:form.name, code:form.code||null, cat:form.cat||null, hsn:form.hsn||null,
      sp:parseFloat(form.sp)||0, cp:parseFloat(form.cp)||0, mrp:parseFloat(form.mrp)||0,
      gst:parseFloat(form.gst)||0, stock:parseInt(form.stock)||0, alert:parseInt(form.alert)||10,
      type:form.type, unit:form.unit, active:true,
      is_serialised:!!form.is_serialised, serial_label:form.serial_label||'Serial No',
    };
    if (editItem) await supabase.from('inventory').update(payload).eq('id', editItem.id);
    else          await supabase.from('inventory').insert(payload);
    setShowForm(false); resetForm();
    setSaved(true); setTimeout(()=>setSaved(false), 2500);
    await load();
    setSaving(false);
  }

  async function runAiTag() {
    // Re-derive tags from current data (client-side heuristic, no external call needed)
    await load();
  }

  // ── Derived data — memoized so a keystroke in Search doesn't
  //    re-walk the whole catalog to recompute KPIs and tag counts ──
  const products = useMemo(() => inventory.filter(i => (i.type||'product')==='product'), [inventory]);
  const services  = useMemo(() => inventory.filter(i => i.type==='service'), [inventory]);
  const base = view==='products' ? products : view==='services' ? services : inventory;

  const categories = useMemo(
    () => ['all', ...new Set(inventory.map(i=>i.cat).filter(Boolean))],
    [inventory]
  );

  // Debounce search so fast typing doesn't filter on every keystroke
  const [debouncedSearch, setDebouncedSearch] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 200);
    return () => clearTimeout(t);
  }, [search]);

  const displayed = useMemo(() => base
    .filter(i => catFilter==='all' || i.cat===catFilter)
    .filter(i => tagFilter==='all' || (i.aiTags||[]).includes(tagFilter))
    .filter(i => stockFilter==='all'
      || (stockFilter==='in'  && (i.stock||0) > (i.alert||10))
      || (stockFilter==='low' && (i.stock||0) > 0 && (i.stock||0) <= (i.alert||10))
      || (stockFilter==='out' && (i.stock||0) <= 0))
    .filter(i => !debouncedSearch
      || i.name.toLowerCase().includes(debouncedSearch.toLowerCase())
      || (i.code||'').toLowerCase().includes(debouncedSearch.toLowerCase())
      || (i.cat||'').toLowerCase().includes(debouncedSearch.toLowerCase()))
    .sort((a,b)=> sortBy==='revenue' ? (b.revenue||0)-(a.revenue||0)
               : sortBy==='margin'  ? (b.sp>0?(b.sp-b.cp)/b.sp:0)-(a.sp>0?(a.sp-a.cp)/a.sp:0)
               : sortBy==='stock'   ? (b.stock||0)-(a.stock||0)
               : sortBy==='sold'    ? (b.sold||0)-(a.sold||0)
               : a.name.localeCompare(b.name)),
    [base, catFilter, tagFilter, stockFilter, debouncedSearch, sortBy]
  );

  // Cap DOM rows for very large catalogues; "Show all" lifts the cap on demand
  const PAGE_SIZE = 150;
  const [showAll, setShowAll] = useState(false);
  const visibleRows = showAll ? displayed : displayed.slice(0, PAGE_SIZE);

  // KPIs — recomputed only when the catalogue itself changes, not on filter/search
  const kpis = useMemo(() => {
    const totalUnits  = inventory.reduce((s,i)=>s+(i.stock||0),0);
    const invValue     = inventory.reduce((s,i)=>s+(i.stock||0)*(i.cp||0),0);
    const catalogueRev = inventory.reduce((s,i)=>s+(i.revenue||0),0);
    const avgMargin    = inventory.length
      ? inventory.reduce((s,i)=> s + (i.sp>0?(i.sp-i.cp)/i.sp*100:0), 0)/inventory.length : 0;
    const inStock  = inventory.filter(i=>(i.stock||0) > (i.alert||10)).length;
    const lowStock = inventory.filter(i=>(i.stock||0) > 0 && (i.stock||0) <= (i.alert||10)).length;
    const outStock = inventory.filter(i=>(i.stock||0) <= 0).length;
    const topByRev = [...inventory].sort((a,b)=>(b.revenue||0)-(a.revenue||0))[0];
    return { totalUnits, invValue, catalogueRev, avgMargin, inStock, lowStock, outStock,
             topByRev, avgUnitValue: totalUnits>0 ? invValue/totalUnits : 0 };
  }, [inventory]);
  const { totalUnits, invValue, catalogueRev, avgMargin, inStock, lowStock, outStock, topByRev, avgUnitValue } = kpis;

  const tagCounts = useMemo(
    () => Object.keys(TAGS).reduce((a,k)=>({ ...a, [k]: inventory.filter(i=>(i.aiTags||[]).includes(k)).length }), {}),
    [inventory]
  );

  const KPI = ({ label, value, sub, icon, color }) => (
    <div style={{ background:T.white, border:`1px solid ${T.bdr}`, borderRadius:12, padding:'14px 16px', boxShadow:'0 1px 4px rgba(0,0,0,.05)' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:6 }}>
        <div style={{ fontSize:9, color:T.sub, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.05em' }}>{label}</div>
        <span style={{ fontSize:15 }}>{icon}</span>
      </div>
      <div style={{ fontSize:20, fontWeight:900, color: color||T.ink, letterSpacing:'-0.02em' }}>{value}</div>
      {sub && <div style={{ fontSize:10, color:T.muted, marginTop:2 }}>{sub}</div>}
    </div>
  );

  return (
    <div style={{ padding:22, background:T.bg, minHeight:'100%' }}>

      {/* Header */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:18, flexWrap:'wrap', gap:12 }}>
        <div>
          <div style={{ fontSize:20, fontWeight:900, color:T.darkRed, letterSpacing:'-0.02em' }}>Items &amp; Products</div>
          <div style={{ fontSize:12, color:T.sub, marginTop:3 }}>
            {products.length} products · {services.length} services · {totalUnits.toLocaleString('en-IN')} units · {fmtL(invValue)} inventory value
            <span style={{ color:T.muted }}> · revenue based on last {REVENUE_WINDOW_DAYS} days</span>
            {saved && <span style={{ color:T.green, fontWeight:700, marginLeft:8 }}>✓ Saved</span>}
          </div>
        </div>
        <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
          <button onClick={runAiTag} disabled={loading} style={btn(T.darkRed, T.white)}>✨ AI Tag</button>
          <button onClick={()=>onSwitchTab?.('barcode')} style={btn('#7C2D2D', T.white)}>▦ Barcodes</button>
          <button onClick={()=>onSwitchTab?.('import')} style={btn(T.bg, T.sub, { border:`1px solid ${T.bdr}` })}>↑ Bulk</button>
          <button onClick={()=>openNew('product')} style={btn(T.red, T.white)}>+ Product</button>
          <button onClick={()=>openNew('service')} style={btn(T.purple, T.white)}>+ Service</button>
          <button onClick={()=>onSwitchTab?.('repairs')} style={btn(T.amber, T.white)}>🔨 Repairs</button>
        </div>
      </div>

      {/* KPI strip */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(150px,1fr))', gap:11, marginBottom:16 }}>
        <KPI label="Catalogue Revenue" value={fmtL(catalogueRev)} sub={topByRev?`Top: ${topByRev.name.slice(0,18)}`:''} icon="📈" color={T.green}/>
        <KPI label="Inventory Value"   value={fmtL(invValue)} sub={`${totalUnits.toLocaleString('en-IN')} units · avg ${fmt(avgUnitValue)}`} icon="🏦"/>
        <KPI label="Avg Margin"        value={showMargin?`${avgMargin.toFixed(0)}%`:"🔒 Hidden"} sub={showMargin?"across all items":"restricted"} icon="📊" color={showMargin?(avgMargin>=40?T.green:T.amber):T.muted}/>
        <KPI label="In Stock"          value={inStock} sub="items healthy" icon="✅" color={T.green}/>
        <KPI label="Low Stock"         value={lowStock} sub="need reorder" icon="⚠️" color={T.amber}/>
        <KPI label="Out of Stock"      value={outStock} sub="urgent restock" icon="🔴" color={T.red}/>
      </div>

      {/* Toggle + filters */}
      <div style={{ display:'flex', gap:9, marginBottom:12, flexWrap:'wrap', alignItems:'center' }}>
        <div style={{ display:'flex', background:T.white, border:`1px solid ${T.bdr}`, borderRadius:9, padding:3, gap:2 }}>
          {[['products',`Products ${products.length}`],['services',`Services ${services.length}`],['all',`All ${inventory.length}`]].map(([v,l])=>(
            <button key={v} onClick={()=>setView(v)}
              style={{ padding:'8px 14px', background:view===v?T.red:'transparent', color:view===v?T.white:T.sub, border:'none', borderRadius:7, fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>{l}</button>
          ))}
        </div>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="🔍 Search name, SKU, brand…" style={{ ...inp, flex:1, minWidth:200 }}/>
        <select value={catFilter} onChange={e=>setCatFilter(e.target.value)} style={{ ...inp, cursor:'pointer' }}>
          <option value="all">All Categories</option>
          {categories.filter(c=>c!=='all').map(c=><option key={c} value={c}>{c}</option>)}
        </select>
        <select value={tagFilter} onChange={e=>setTagFilter(e.target.value)} style={{ ...inp, cursor:'pointer' }}>
          <option value="all">All AI Tags</option>
          {Object.entries(TAGS).map(([k,v])=><option key={k} value={k}>{v.icon} {v.l}</option>)}
        </select>
        <select value={stockFilter} onChange={e=>setStockFilter(e.target.value)} style={{ ...inp, cursor:'pointer' }}>
          <option value="all">All Stock</option>
          <option value="in">In Stock</option>
          <option value="low">Low Stock</option>
          <option value="out">Out of Stock</option>
        </select>
        <select value={sortBy} onChange={e=>setSortBy(e.target.value)} style={{ ...inp, cursor:'pointer' }}>
          <option value="revenue">↓ Revenue</option>
          {showMargin && <option value="margin">↓ Margin</option>}
          <option value="stock">↓ Stock</option>
          <option value="sold">↓ Units Sold</option>
          <option value="name">A–Z Name</option>
        </select>
        <div style={{ display:'flex', background:T.white, border:`1px solid ${T.bdr}`, borderRadius:8, overflow:'hidden' }}>
          {[['list','☰'],['grid','▦']].map(([v,ic])=>(
            <button key={v} onClick={()=>setDensity(v)} style={{ padding:'9px 11px', background:density===v?T.red:'transparent', color:density===v?T.white:T.sub, border:'none', cursor:'pointer', fontFamily:'inherit' }}>{ic}</button>
          ))}
        </div>
        <div style={{ fontSize:11, color:T.muted, whiteSpace:'nowrap' }}>{displayed.length} items</div>
      </div>

      {/* Table (list view) */}
      {density==='list' ? (
        <div style={{ background:T.white, border:`1px solid ${T.bdr}`, borderRadius:13, overflow:'hidden', boxShadow:'0 1px 4px rgba(0,0,0,.05)' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12.5 }}>
            <thead><tr style={{ background:T.lightRed }}>
              {['Item','SKU','Cat','Sale ₹','Margin','Stock','Var','Sold','Revenue','AI Tags','Actions'].map(h=>(
                <th key={h} style={{ padding:'10px 12px', textAlign:['Sale ₹','Margin','Stock','Var','Sold','Revenue'].includes(h)?'right':'left', fontSize:9, color:T.darkRed, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.04em', borderBottom:`1px solid ${T.bdr}`, whiteSpace:'nowrap' }}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {loading?Array.from({length:6}).map((_,i)=>(
                <tr key={'sk'+i}>
                  {Array.from({length:11}).map((_,j)=>(
                    <td key={j} style={{ padding:'12px' }}>
                      <div style={{ height:14, background:'linear-gradient(90deg,#F0E8E8 25%,#F8F0F0 50%,#F0E8E8 75%)', backgroundSize:'200% 100%', animation:'skelShine 1.4s ease-in-out infinite', borderRadius:5, width: j===0?'70%':'50%' }}/>
                    </td>
                  ))}
                </tr>
              ))
              :visibleRows.length===0?<tr><td colSpan={11} style={{ textAlign:'center', padding:50 }}>
                <div style={{ fontSize:34, marginBottom:8 }}>📦</div>
                <div style={{ color:T.muted, fontWeight:600 }}>No items match these filters</div>
              </td></tr>
              :visibleRows.map(it=>{
                const margin = it.sp>0 ? Math.round((it.sp-it.cp)/it.sp*100) : 0;
                const stockPct = it.alert ? Math.min(100, (it.stock||0)/(it.alert*4)*100) : 60;
                const stockColor = (it.stock||0)<=0 ? T.red : (it.stock||0)<=(it.alert||10) ? T.amber : T.green;
                return (
                  <tr key={it.id} style={{ borderBottom:`1px solid ${T.bdr}22` }}>
                    <td style={{ padding:'10px 12px' }}>
                      <div style={{ fontWeight:700, color:T.ink }}>{it.name}</div>
                      <span style={{ background:it.type==='service'?'#F5F3FF':'#EFF6FF', color:it.type==='service'?T.purple:T.blue, borderRadius:4, padding:'1px 6px', fontSize:9, fontWeight:700, marginRight:5 }}>{(it.type||'product').toUpperCase()}</span>
                      <span style={{ fontSize:10, color:T.muted }}>{it.unit||''}</span>
                    </td>
                    <td style={{ padding:'10px 12px', color:T.blue, fontFamily:'monospace', fontSize:11 }}>{it.code||'—'}</td>
                    <td style={{ padding:'10px 12px' }}>{it.cat?<span style={{ background:T.bg, color:T.sub, borderRadius:5, padding:'2px 8px', fontSize:10, fontWeight:600 }}>{it.cat}</span>:'—'}</td>
                    <td style={{ padding:'10px 12px', textAlign:'right' }}>
                      <div style={{ fontWeight:800, color:T.ink }}>{fmt(it.sp)}</div>
                      {it.mrp>it.sp && <div style={{ fontSize:10, color:T.muted, textDecoration:'line-through' }}>{fmt(it.mrp)}</div>}
                    </td>
                    <td style={{ padding:'10px 12px', textAlign:'right' }}>
                      {showMargin ? <>
                        <div style={{ fontWeight:700, color: margin>=45?T.green:margin>=25?T.blue:T.amber }}>{margin}%</div>
                        <div style={{ height:3, width:60, background:'#F3F4F6', borderRadius:2, marginTop:3, marginLeft:'auto' }}>
                          <div style={{ height:'100%', width:`${Math.min(100,margin)}%`, background: margin>=45?T.green:margin>=25?T.blue:T.amber, borderRadius:2 }}/>
                        </div>
                      </> : <span style={{ color:T.muted, fontSize:11 }}>🔒</span>}
                    </td>
                    <td style={{ padding:'10px 12px', textAlign:'right' }}>
                      <div style={{ fontWeight:800, color:stockColor }}>{it.stock||0}</div>
                      <div style={{ fontSize:9, color:T.muted }}>alert: {it.alert||10}</div>
                      <div style={{ height:3, width:60, background:'#F3F4F6', borderRadius:2, marginTop:3, marginLeft:'auto' }}>
                        <div style={{ height:'100%', width:`${stockPct}%`, background:stockColor, borderRadius:2 }}/>
                      </div>
                    </td>
                    <td style={{ padding:'10px 12px', textAlign:'right', color:T.sub }}>{it.variantCount||'—'}</td>
                    <td style={{ padding:'10px 12px', textAlign:'right', color:T.ink, fontWeight:600 }}>{it.sold||0}</td>
                    <td style={{ padding:'10px 12px', textAlign:'right', color:T.green, fontWeight:800 }}>{it.revenue?fmtL(it.revenue):'—'}</td>
                    <td style={{ padding:'10px 12px' }}>
                      <div style={{ display:'flex', gap:4, flexWrap:'wrap', maxWidth:150 }}>
                        {(it.aiTags||[]).filter(tk=>tk!=='HMG'||showMargin).map(tk=>{ const t=TAGS[tk]; return (
                          <span key={tk} style={{ background:t.bg, color:t.color, border:`1px solid ${t.bdr}`, borderRadius:5, padding:'2px 7px', fontSize:9, fontWeight:700, whiteSpace:'nowrap' }}>{t.icon} {t.l}</span>
                        );})}
                      </div>
                    </td>
                    <td style={{ padding:'10px 12px' }}>
                      <div style={{ display:'flex', gap:5 }}>
                        <button onClick={()=>openEdit(it)} style={{ background:'#EFF6FF', color:T.blue, border:'none', borderRadius:6, padding:'4px 10px', fontSize:10, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>View</button>
                        <button onClick={()=>openEdit(it)} style={{ background:T.lightRed, color:T.red, border:'none', borderRadius:6, padding:'4px 10px', fontSize:10, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>Edit</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(210px,1fr))', gap:12 }}>
          {visibleRows.map(it=>{
            const margin = it.sp>0 ? Math.round((it.sp-it.cp)/it.sp*100) : 0;
            return (
              <div key={it.id} style={{ background:T.white, border:`1px solid ${T.bdr}`, borderRadius:12, padding:14, boxShadow:'0 1px 4px rgba(0,0,0,.05)' }}>
                <div style={{ fontWeight:700, color:T.ink, fontSize:13, marginBottom:6, minHeight:34 }}>{it.name}</div>
                <div style={{ display:'flex', justifyContent:'space-between', marginBottom:8 }}>
                  <span style={{ fontSize:16, fontWeight:900, color:T.green }}>{fmt(it.sp)}</span>
                  {showMargin && <span style={{ fontSize:11, color: margin>=45?T.green:T.amber, fontWeight:700 }}>{margin}%</span>}
                </div>
                <div style={{ display:'flex', flexWrap:'wrap', gap:4, marginBottom:8 }}>
                  {(it.aiTags||[]).map(tk=>{ const t=TAGS[tk]; return <span key={tk} style={{ background:t.bg, color:t.color, borderRadius:5, padding:'1px 6px', fontSize:9, fontWeight:700 }}>{t.icon}</span>; })}
                </div>
                <div style={{ fontSize:10, color:T.muted, marginBottom:10 }}>Stock: {it.stock||0} · Sold: {it.sold||0}</div>
                <button onClick={()=>openEdit(it)} style={{ width:'100%', ...btn(T.lightRed, T.red, { fontSize:11, padding:'7px' }) }}>Edit</button>
              </div>
            );
          })}
        </div>
      )}

      {displayed.length > PAGE_SIZE && (
        <div style={{ textAlign:'center', margin:'12px 0' }}>
          <button onClick={()=>setShowAll(s=>!s)}
            style={{ ...btn(T.white, T.red, { border:`1px solid ${T.bdr}`, padding:'9px 20px' }) }}>
            {showAll ? `Show fewer` : `Show all ${displayed.length} items (${displayed.length-PAGE_SIZE} more)`}
          </button>
        </div>
      )}

      {/* Legend footer */}
      <div style={{ display:'flex', gap:16, marginTop:14, padding:'11px 16px', background:T.white, border:`1px solid ${T.bdr}`, borderRadius:10, flexWrap:'wrap' }}>
        {Object.entries(TAGS).map(([k,t])=>(
          <div key={k} style={{ display:'flex', alignItems:'center', gap:5, fontSize:11 }}>
            <span style={{ width:7, height:7, borderRadius:'50%', background:t.color }}/>
            <span style={{ color:T.sub }}>{t.icon} {t.l}</span>
            <span style={{ color:T.ink, fontWeight:700 }}>{tagCounts[k]||0}</span>
          </div>
        ))}
      </div>

      {/* Add/Edit modal */}
      {showForm&&(
        <div onClick={()=>setShowForm(false)} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.5)', zIndex:300, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
          <div onClick={e=>e.stopPropagation()} style={{ background:T.white, borderRadius:16, padding:26, width:'100%', maxWidth:560, maxHeight:'88vh', overflowY:'auto', boxShadow:'0 20px 60px rgba(0,0,0,.25)' }}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:18 }}>
              <div style={{ fontSize:16, fontWeight:800, color:T.darkRed }}>{editItem?'Edit':'New'} {form.type==='service'?'Service':'Product'}</div>
              <button onClick={()=>setShowForm(false)} style={{ background:'none', border:'none', fontSize:22, cursor:'pointer', color:T.muted }}>×</button>
            </div>
            <form onSubmit={saveItem}>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                <div style={{ gridColumn:'1/-1' }}><label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:4 }}>Name *</label><input value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} required style={inp}/></div>
                {[['SKU / Code','code'],['HSN Code','hsn'],['Unit','unit']].map(([lb,key])=>(
                  <div key={key}><label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:4 }}>{lb}</label><input value={form[key]} onChange={e=>setForm(f=>({...f,[key]:e.target.value}))} style={inp}/></div>
                ))}
                <div style={{ gridColumn:'1/-1' }}>
                  <label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:4 }}>Category</label>
                  <input value={form.cat} onChange={e=>setForm(f=>({...f,cat:e.target.value}))} placeholder="e.g. Footwear" style={inp}/>
                  {(tenant?.categories||[]).length>0 && (
                    <div style={{ display:'flex', flexWrap:'wrap', gap:5, marginTop:6 }}>
                      <span style={{ fontSize:9.5, color:T.muted, marginRight:2, alignSelf:'center' }}>Suggested from your business type:</span>
                      {tenant.categories.filter(cc=>cc!==form.cat).slice(0,8).map(cc=>(
                        <button key={cc} type="button" onClick={()=>setForm(f=>({...f,cat:cc}))}
                          style={{ background:T.bg, border:`1px solid ${T.bdr}`, borderRadius:14, padding:'3px 10px', fontSize:10.5, color:T.sub, cursor:'pointer', fontFamily:'inherit' }}>
                          {cc}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {[['Sale Price *','sp'],['Cost Price *','cp'],['MRP','mrp'],['GST %','gst']]
                  .filter(([,key])=>key!=='cp'||showCost)
                  .map(([lb,key])=>(
                  <div key={key}><label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:4 }}>{lb}</label><input type="number" value={form[key]} onChange={e=>setForm(f=>({...f,[key]:e.target.value}))} required={lb.includes('*')} style={inp}/></div>
                ))}
                {!showCost && <div style={{ fontSize:10.5, color:T.muted, gridColumn:'1/-1' }}>Cost price is set by an owner or accountant — new items you add will show ₹0 cost until updated.</div>}
                {form.type==='product'&&<>
                  <div><label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:4 }}>Stock Qty</label><input type="number" value={form.stock} onChange={e=>setForm(f=>({...f,stock:e.target.value}))} style={inp}/></div>
                  <div><label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:4 }}>Alert Level</label><input type="number" value={form.alert} onChange={e=>setForm(f=>({...f,alert:e.target.value}))} style={inp}/></div>
                  <div style={{ gridColumn:'1/-1', background:T.bg, borderRadius:9, padding:'11px 14px' }}>
                    <label style={{ display:'flex', alignItems:'center', gap:10, cursor:'pointer' }}>
                      <input type="checkbox" checked={form.is_serialised} onChange={e=>setForm(f=>({...f,is_serialised:e.target.checked}))} style={{ width:17, height:17, accentColor:T.red, cursor:'pointer' }}/>
                      <div>
                        <div style={{ fontSize:12.5, fontWeight:700, color:T.ink }}>Track each unit individually</div>
                        <div style={{ fontSize:10.5, color:T.sub, marginTop:1 }}>For phones, appliances, anything with a serial. POS will ask which unit is being sold.</div>
                      </div>
                    </label>
                    {form.is_serialised && (
                      <div style={{ marginTop:10 }}>
                        <label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:4 }}>What is it called?</label>
                        <select value={form.serial_label} onChange={e=>setForm(f=>({...f,serial_label:e.target.value}))} style={{ ...inp, cursor:'pointer' }}>
                          {['Serial No','IMEI','Engine No','Chassis No','Batch Code'].map(l=><option key={l} value={l}>{l}</option>)}
                        </select>
                      </div>
                    )}
                  </div>
                </>}
              </div>
              {showMargin && form.sp&&form.cp&&<div style={{ background:T.lightRed, borderRadius:9, padding:'9px 13px', marginTop:12, fontSize:12, color:T.darkRed }}>
                Margin: <strong>{form.sp>0?Math.round((parseFloat(form.sp)-parseFloat(form.cp))/parseFloat(form.sp)*100):0}%</strong>
              </div>}
              <div style={{ display:'flex', gap:10, marginTop:20 }}>
                <button type="button" onClick={()=>setShowForm(false)} style={{ flex:1, background:T.bg, color:T.sub, border:`1px solid ${T.bdr}`, borderRadius:9, padding:'12px', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>Cancel</button>
                <button type="submit" disabled={saving} style={{ flex:2, ...btn(T.red,T.white,{ padding:'12px', fontSize:13 }) }}>{saving?'Saving…':editItem?'Update Item':'Add Item'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
