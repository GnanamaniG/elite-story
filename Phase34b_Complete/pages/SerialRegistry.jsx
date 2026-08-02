import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';

const T = {
  bg:'#F7F3F3', srf:'#FFFFFF', card:'#FFFFFF', bdr:'#E8DEDE',
  red:'#C0392B', darkRed:'#8B0000', lightRed:'#FEF2F2',
  green:'#16A34A', amber:'#D97706', blue:'#2563EB', purple:'#7C3AED',
  ink:'#111827', sub:'#6B7280', muted:'#9CA3AF', white:'#FFFFFF'
};
const fmt = n => 'Rs.' + (n||0).toLocaleString('en-IN', { maximumFractionDigits:0 });
const btn = (bg,color,extra={}) => ({ background:bg, color, border:'none', borderRadius:9, padding:'9px 16px', fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:'inherit', ...extra });
const inp = { background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:8, padding:'9px 12px', color:T.ink, fontSize:13, fontFamily:'inherit', outline:'none' };

const STATUS = {
  in_stock: { l:'In Stock', icon:'📦', color:T.green,  bg:'#F0FDF4', bdr:'#BBF7D0' },
  sold:     { l:'Sold',     icon:'✅', color:T.blue,   bg:'#EFF6FF', bdr:'#BFDBFE' },
  reserved: { l:'Reserved', icon:'🔒', color:T.purple, bg:'#F5F3FF', bdr:'#DDD6FE' },
  returned: { l:'Returned', icon:'↩️', color:T.amber,  bg:'#FFFBEB', bdr:'#FDE68A' },
  rma:      { l:'RMA',      icon:'🔧', color:T.amber,  bg:'#FFFBEB', bdr:'#FDE68A' },
  damaged:  { l:'Damaged',  icon:'💥', color:T.red,    bg:'#FEF2F2', bdr:'#FECACA' },
};

// IMEI checksum (Luhn) — catches typos on the 15-digit standard
function validImei(s) {
  const d = String(s||'').replace(/\D/g,'');
  if (d.length !== 15) return null;               // null = not an IMEI, skip check
  let sum = 0;
  for (let i=0; i<15; i++) {
    let v = parseInt(d[i]);
    if (i % 2 === 1) { v *= 2; if (v > 9) v -= 9; }
    sum += v;
  }
  return sum % 10 === 0;
}

export default function SerialRegistry({ tenant, role='owner' }) {
  const [serials,   setSerials]   = useState([]);
  const [inventory, setInventory] = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [search,    setSearch]    = useState('');
  const [statusF,   setStatusF]   = useState('all');
  const [itemF,     setItemF]     = useState('all');
  const [showAdd,   setShowAdd]   = useState(false);
  const [saving,    setSaving]    = useState(false);
  const [bulkText,  setBulkText]  = useState('');
  const [addItem,   setAddItem]   = useState('');
  const [addSupplier,setAddSupplier]= useState('');
  const [addCost,   setAddCost]   = useState('');
  const [result,    setResult]    = useState(null);
  const [lookup,    setLookup]    = useState(null);

  useEffect(() => { if (tenant?.id) load(); }, [tenant?.id]);

  async function load() {
    setLoading(true);
    const [sRes, iRes] = await Promise.all([
      supabase.from('item_serials').select('*').eq('tenant_id', tenant.id).order('created_at', { ascending:false }).limit(3000),
      supabase.from('inventory').select('id,name,code,sp,cp,is_serialised,serial_label').eq('tenant_id', tenant.id).eq('active', true).order('name'),
    ]);
    setSerials(sRes.data||[]); setInventory(iRes.data||[]);
    setLoading(false);
  }

  // ── Bulk intake: paste one serial per line ──────────────────
  async function saveBulk(e) {
    e.preventDefault();
    const item = inventory.find(i=>i.id===addItem);
    if (!item) return;
    const lines = bulkText.split('\n').map(l=>l.trim()).filter(Boolean);
    if (!lines.length) return;
    setSaving(true); setResult(null);

    const existing = new Set(serials.map(s=>s.serial_no));
    const seen = new Set();
    const rows = [], dupes = [], badImei = [];

    lines.forEach(raw => {
      const [sn, alt] = raw.split(/[,\t|]/).map(x=>(x||'').trim());
      if (!sn) return;
      if (existing.has(sn) || seen.has(sn)) { dupes.push(sn); return; }
      const imeiOk = validImei(sn);
      if (imeiOk === false) badImei.push(sn);
      seen.add(sn);
      rows.push({
        tenant_id: tenant.id, item_id: item.id, item_name: item.name,
        serial_no: sn, serial_alt: alt || null,
        supplier: addSupplier || null,
        cost_price: parseFloat(addCost) || item.cp || 0,
        status: 'in_stock',
      });
    });

    let inserted = 0, err = null;
    if (rows.length) {
      const { error } = await supabase.from('item_serials').insert(rows);
      if (error) err = error.message; else inserted = rows.length;
    }

    // Keep the product's stock count in step with its serial count
    if (inserted > 0) {
      const { data: inv } = await supabase.from('inventory').select('stock').eq('id', item.id).maybeSingle();
      await supabase.from('inventory').update({ stock: (inv?.stock||0) + inserted, is_serialised: true }).eq('id', item.id);
    }

    setResult({ inserted, dupes, badImei, err });
    setBulkText('');
    setSaving(false);
    await load();
  }

  async function markStatus(id, status) {
    await supabase.from('item_serials').update({ status }).eq('id', id);
    setSerials(prev=>prev.map(s=>s.id===id?{...s,status}:s));
  }

  // ── Serial lookup: the "who bought this unit?" question ─────
  async function doLookup(sn) {
    const hit = serials.find(s => s.serial_no === sn.trim() || s.serial_alt === sn.trim());
    setLookup(hit || { notFound:true, query:sn });
  }

  const [debounced, setDebounced] = useState('');
  useEffect(()=>{ const t=setTimeout(()=>setDebounced(search),200); return ()=>clearTimeout(t); },[search]);

  const displayed = useMemo(() => serials
    .filter(s => statusF==='all' || s.status===statusF)
    .filter(s => itemF==='all'   || s.item_id===itemF)
    .filter(s => !debounced
      || s.serial_no.toLowerCase().includes(debounced.toLowerCase())
      || (s.serial_alt||'').toLowerCase().includes(debounced.toLowerCase())
      || s.item_name.toLowerCase().includes(debounced.toLowerCase())
      || (s.customer||'').toLowerCase().includes(debounced.toLowerCase())
      || (s.invoice_no||'').toLowerCase().includes(debounced.toLowerCase())),
    [serials, statusF, itemF, debounced]);

  const PAGE = 200;
  const [showAll, setShowAll] = useState(false);
  const rows = showAll ? displayed : displayed.slice(0, PAGE);

  const kpis = useMemo(() => ({
    total:    serials.length,
    inStock:  serials.filter(s=>s.status==='in_stock').length,
    sold:     serials.filter(s=>s.status==='sold').length,
    issues:   serials.filter(s=>['damaged','rma','returned'].includes(s.status)).length,
    stockValue: serials.filter(s=>s.status==='in_stock').reduce((a,s)=>a+(s.cost_price||0),0),
  }), [serials]);

  const serialisedItems = inventory.filter(i=>i.is_serialised);

  const KPI = ({ label, value, icon, color, sub }) => (
    <div style={{ background:T.white, border:`1px solid ${T.bdr}`, borderRadius:12, padding:'14px 16px', boxShadow:'0 1px 4px rgba(0,0,0,.05)' }}>
      <div style={{ display:'flex', justifyContent:'space-between', marginBottom:6 }}>
        <div style={{ fontSize:9, color:T.sub, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.05em' }}>{label}</div>
        <span style={{ fontSize:15 }}>{icon}</span>
      </div>
      <div style={{ fontSize:20, fontWeight:900, color:color||T.ink }}>{value}</div>
      {sub && <div style={{ fontSize:10, color:T.muted, marginTop:2 }}>{sub}</div>}
    </div>
  );

  return (
    <div style={{ padding:22, background:T.bg, minHeight:'100%' }}>

      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:18, flexWrap:'wrap', gap:12 }}>
        <div>
          <div style={{ fontSize:20, fontWeight:900, color:T.darkRed, letterSpacing:'-0.02em' }}>Serial / IMEI Registry</div>
          <div style={{ fontSize:12, color:T.sub, marginTop:3 }}>
            Track every individual unit — which physical device went to which customer
          </div>
        </div>
        <button onClick={()=>{ setShowAdd(true); setResult(null); }} style={btn(T.red, T.white)}>+ Add Serials</button>
      </div>

      {/* Quick lookup — the question this page exists to answer */}
      <div style={{ background:T.white, border:`1px solid ${T.bdr}`, borderRadius:12, padding:'14px 18px', marginBottom:16, boxShadow:'0 1px 4px rgba(0,0,0,.05)' }}>
        <div style={{ fontSize:11, fontWeight:700, color:T.darkRed, textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:9 }}>
          🔍 Trace a Unit
        </div>
        <div style={{ display:'flex', gap:9 }}>
          <input placeholder="Scan or type a serial / IMEI…" style={{ ...inp, flex:1, fontFamily:'monospace', fontSize:14 }}
            onKeyDown={e=>{ if(e.key==='Enter'){ doLookup(e.target.value); } }}/>
          <button onClick={e=>doLookup(e.target.parentNode.querySelector('input').value)} style={btn(T.blue, T.white)}>Trace</button>
        </div>
        {lookup && (
          lookup.notFound
            ? <div style={{ marginTop:11, background:'#FEF2F2', border:'1px solid #FECACA', borderRadius:9, padding:'11px 14px', fontSize:12.5, color:T.red }}>
                No unit found with serial <strong>{lookup.query}</strong> — it was never received into stock here.
              </div>
            : <div style={{ marginTop:11, background:STATUS[lookup.status].bg, border:`1px solid ${STATUS[lookup.status].bdr}`, borderRadius:9, padding:'13px 16px' }}>
                <div style={{ display:'flex', justifyContent:'space-between', marginBottom:7 }}>
                  <span style={{ fontSize:14, fontWeight:800, color:T.ink }}>{lookup.item_name}</span>
                  <span style={{ background:T.white, color:STATUS[lookup.status].color, border:`1px solid ${STATUS[lookup.status].bdr}`, borderRadius:6, padding:'2px 10px', fontSize:10, fontWeight:700 }}>
                    {STATUS[lookup.status].icon} {STATUS[lookup.status].l}
                  </span>
                </div>
                <div style={{ fontFamily:'monospace', fontSize:12, color:T.purple, fontWeight:700, marginBottom:8 }}>{lookup.serial_no}{lookup.serial_alt?` · ${lookup.serial_alt}`:''}</div>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(130px,1fr))', gap:10, fontSize:11.5 }}>
                  {[
                    ['Received', lookup.received_date],
                    ['Supplier', lookup.supplier],
                    ['Sold to',  lookup.customer],
                    ['Invoice',  lookup.invoice_no],
                    ['Sold on',  lookup.sold_date],
                    ['Warranty till', lookup.warranty_till],
                  ].filter(([,v])=>v).map(([k,v])=>(
                    <div key={k}><div style={{ color:T.muted, fontSize:9, textTransform:'uppercase', fontWeight:700 }}>{k}</div><div style={{ color:T.ink, fontWeight:600 }}>{v}</div></div>
                  ))}
                </div>
              </div>
        )}
      </div>

      {/* KPIs */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(150px,1fr))', gap:11, marginBottom:16 }}>
        <KPI label="Total Units"     value={kpis.total}   icon="🔢" />
        <KPI label="In Stock"        value={kpis.inStock} icon="📦" color={T.green} sub={fmt(kpis.stockValue)+' at cost'}/>
        <KPI label="Sold"            value={kpis.sold}    icon="✅" color={T.blue}/>
        <KPI label="Issues"          value={kpis.issues}  icon="⚠️" color={kpis.issues?T.amber:T.muted} sub="damaged / RMA / returned"/>
        <KPI label="Serialised SKUs" value={serialisedItems.length} icon="🏷️" color={T.purple} sub={`of ${inventory.length} products`}/>
      </div>

      {/* Filters */}
      <div style={{ display:'flex', gap:9, marginBottom:12, flexWrap:'wrap', alignItems:'center' }}>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="🔍 Serial, product, customer, invoice…" style={{ ...inp, flex:1, minWidth:220 }}/>
        <select value={statusF} onChange={e=>setStatusF(e.target.value)} style={{ ...inp, cursor:'pointer' }}>
          <option value="all">All Status</option>
          {Object.entries(STATUS).map(([k,v])=><option key={k} value={k}>{v.icon} {v.l}</option>)}
        </select>
        <select value={itemF} onChange={e=>setItemF(e.target.value)} style={{ ...inp, cursor:'pointer' }}>
          <option value="all">All Products</option>
          {serialisedItems.map(i=><option key={i.id} value={i.id}>{i.name}</option>)}
        </select>
        <div style={{ fontSize:11, color:T.muted, whiteSpace:'nowrap' }}>{displayed.length} units</div>
      </div>

      {/* Table */}
      <div style={{ background:T.white, border:`1px solid ${T.bdr}`, borderRadius:13, overflow:'hidden', boxShadow:'0 1px 4px rgba(0,0,0,.05)' }}>
        <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12.5 }}>
          <thead><tr style={{ background:T.lightRed }}>
            {['Serial / IMEI','Product','Status','Received','Sold To','Invoice','Actions'].map(h=>(
              <th key={h} style={{ padding:'10px 12px', textAlign:'left', fontSize:9, color:T.darkRed, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.04em', borderBottom:`1px solid ${T.bdr}`, whiteSpace:'nowrap' }}>{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {loading ? Array.from({length:6}).map((_,i)=>(
              <tr key={'sk'+i}>{Array.from({length:7}).map((_,j)=>(
                <td key={j} style={{ padding:12 }}><div style={{ height:14, background:'linear-gradient(90deg,#F0E8E8 25%,#F8F0F0 50%,#F0E8E8 75%)', backgroundSize:'200% 100%', animation:'skelShine 1.4s ease-in-out infinite', borderRadius:5, width:j===0?'70%':'50%' }}/></td>
              ))}</tr>
            ))
            : rows.length===0 ? (
              <tr><td colSpan={7} style={{ textAlign:'center', padding:50 }}>
                <div style={{ fontSize:34, marginBottom:8 }}>🔢</div>
                <div style={{ color:T.muted, fontWeight:600 }}>No serials recorded yet</div>
                <div style={{ color:T.muted, fontSize:11, marginTop:4 }}>Add serials when you receive stock — paste them in bulk, one per line</div>
              </td></tr>
            )
            : rows.map(s=>{
              const st = STATUS[s.status]||STATUS.in_stock;
              return (
                <tr key={s.id} style={{ borderBottom:`1px solid ${T.bdr}22` }}>
                  <td style={{ padding:'10px 12px', fontFamily:'monospace', fontWeight:700, color:T.purple, fontSize:11.5 }}>
                    {s.serial_no}
                    {s.serial_alt && <div style={{ fontSize:9.5, color:T.muted }}>{s.serial_alt}</div>}
                  </td>
                  <td style={{ padding:'10px 12px', color:T.ink, fontWeight:600 }}>{s.item_name}</td>
                  <td style={{ padding:'10px 12px' }}>
                    <span style={{ background:st.bg, color:st.color, border:`1px solid ${st.bdr}`, borderRadius:5, padding:'2px 8px', fontSize:9.5, fontWeight:700, whiteSpace:'nowrap' }}>{st.icon} {st.l}</span>
                  </td>
                  <td style={{ padding:'10px 12px', color:T.muted, fontSize:11 }}>{s.received_date||'—'}</td>
                  <td style={{ padding:'10px 12px', color:T.sub }}>{s.customer||'—'}</td>
                  <td style={{ padding:'10px 12px', color:T.blue, fontFamily:'monospace', fontSize:10.5 }}>{s.invoice_no||'—'}</td>
                  <td style={{ padding:'10px 12px' }}>
                    <div style={{ display:'flex', gap:5 }}>
                      {s.status==='in_stock' && <button onClick={()=>markStatus(s.id,'damaged')} style={{ background:'#FEF2F2', color:T.red, border:'none', borderRadius:6, padding:'4px 9px', fontSize:9.5, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>Damaged</button>}
                      {s.status==='sold'     && <button onClick={()=>markStatus(s.id,'rma')}     style={{ background:'#FFFBEB', color:T.amber, border:'none', borderRadius:6, padding:'4px 9px', fontSize:9.5, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>RMA</button>}
                      {['damaged','rma'].includes(s.status) && <button onClick={()=>markStatus(s.id,'in_stock')} style={{ background:'#F0FDF4', color:T.green, border:'none', borderRadius:6, padding:'4px 9px', fontSize:9.5, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>Restock</button>}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {displayed.length > PAGE && (
        <div style={{ textAlign:'center', margin:'12px 0' }}>
          <button onClick={()=>setShowAll(s=>!s)} style={btn(T.white, T.red, { border:`1px solid ${T.bdr}`, padding:'9px 20px' })}>
            {showAll ? 'Show fewer' : `Show all ${displayed.length} (${displayed.length-PAGE} more)`}
          </button>
        </div>
      )}

      {/* Bulk add modal */}
      {showAdd && (
        <div onClick={()=>setShowAdd(false)} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.5)', zIndex:300, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
          <div onClick={e=>e.stopPropagation()} style={{ background:T.white, borderRadius:16, padding:26, width:'100%', maxWidth:540, maxHeight:'88vh', overflowY:'auto', boxShadow:'0 20px 60px rgba(0,0,0,.25)' }}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:6 }}>
              <div style={{ fontSize:16, fontWeight:800, color:T.darkRed }}>Add Serials / IMEIs</div>
              <button onClick={()=>setShowAdd(false)} style={{ background:'none', border:'none', fontSize:22, cursor:'pointer', color:T.muted }}>×</button>
            </div>
            <div style={{ fontSize:11.5, color:T.sub, marginBottom:18 }}>
              Paste one serial per line. Stock count updates automatically. Duplicates are skipped, not overwritten.
            </div>

            <form onSubmit={saveBulk}>
              <div style={{ marginBottom:13 }}>
                <label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:5 }}>Product *</label>
                <select value={addItem} onChange={e=>setAddItem(e.target.value)} required style={{ ...inp, width:'100%', cursor:'pointer' }}>
                  <option value="">Select product…</option>
                  {inventory.map(i=><option key={i.id} value={i.id}>{i.name}{i.code?` · ${i.code}`:''}</option>)}
                </select>
              </div>

              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:13 }}>
                <div><label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:5 }}>Supplier</label><input value={addSupplier} onChange={e=>setAddSupplier(e.target.value)} style={{ ...inp, width:'100%' }}/></div>
                <div><label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:5 }}>Cost per unit</label><input type="number" value={addCost} onChange={e=>setAddCost(e.target.value)} placeholder="uses product cost if blank" style={{ ...inp, width:'100%' }}/></div>
              </div>

              <div style={{ marginBottom:13 }}>
                <label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:5 }}>
                  Serials — one per line ({bulkText.split('\n').filter(l=>l.trim()).length} entered)
                </label>
                <textarea value={bulkText} onChange={e=>setBulkText(e.target.value)} rows={8}
                  placeholder={"356938035643809\n356938035643810\n356938035643811\n\nFor dual-SIM, separate the second IMEI with a comma:\n356938035643812, 356938035643813"}
                  style={{ ...inp, width:'100%', fontFamily:'monospace', fontSize:12.5, resize:'vertical' }}/>
              </div>

              {result && (
                <div style={{ marginBottom:13, display:'flex', flexDirection:'column', gap:7 }}>
                  {result.err && <div style={{ background:'#FEF2F2', border:'1px solid #FECACA', borderRadius:8, padding:'10px 13px', fontSize:12, color:T.red }}>⚠️ {result.err}</div>}
                  {result.inserted>0 && <div style={{ background:'#F0FDF4', border:'1px solid #BBF7D0', borderRadius:8, padding:'10px 13px', fontSize:12, color:T.green, fontWeight:600 }}>✅ {result.inserted} unit{result.inserted>1?'s':''} added and stock updated</div>}
                  {result.dupes.length>0 && <div style={{ background:'#FFFBEB', border:'1px solid #FDE68A', borderRadius:8, padding:'10px 13px', fontSize:11.5, color:T.amber }}>⚠️ {result.dupes.length} already in the register, skipped: {result.dupes.slice(0,4).join(', ')}{result.dupes.length>4?'…':''}</div>}
                  {result.badImei.length>0 && <div style={{ background:'#FFFBEB', border:'1px solid #FDE68A', borderRadius:8, padding:'10px 13px', fontSize:11.5, color:T.amber }}>⚠️ Added, but these 15-digit numbers failed the IMEI checksum — worth re-checking: {result.badImei.slice(0,3).join(', ')}</div>}
                </div>
              )}

              <div style={{ display:'flex', gap:10 }}>
                <button type="button" onClick={()=>setShowAdd(false)} style={{ flex:1, background:T.bg, color:T.sub, border:`1px solid ${T.bdr}`, borderRadius:9, padding:'12px', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>Close</button>
                <button type="submit" disabled={saving||!addItem||!bulkText.trim()} style={{ flex:2, ...btn(T.red,T.white,{ padding:'12px', fontSize:13 }) }}>{saving?'Adding…':'Add Serials'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
