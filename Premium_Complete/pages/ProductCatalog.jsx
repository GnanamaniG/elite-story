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
const fmt = n => 'Rs.' + (n||0).toLocaleString('en-IN', { maximumFractionDigits:0 });

export default function ProductCatalog({ tenant }) {
  const [inventory, setInventory] = useState([]);
  const [selected,  setSelected]  = useState(new Set());
  const [loading,   setLoading]   = useState(true);
  const [catFilter, setCatFilter] = useState('All');
  const [layout,    setLayout]    = useState('grid'); // grid | list | price-list
  const [showPrice, setShowPrice] = useState(true);
  const [showCode,  setShowCode]  = useState(true);
  const [showStock, setShowStock] = useState(false);
  const [colorScheme, setColorScheme] = useState('blue');
  const [title,     setTitle]     = useState(tenant?.name ? `${tenant.name} — Product Catalog` : 'Product Catalog');
  const [subtitle,  setSubtitle]  = useState('');

  useEffect(() => {
    if (!tenant?.id) return;
    supabase.from('inventory').select('*').eq('tenant_id', tenant.id).eq('active', true).order('cat').order('name')
      .then(({ data }) => { setInventory(data||[]); setSelected(new Set((data||[]).map(i=>i.id))); })
      .finally(() => setLoading(false));
    if (tenant?.name) setTitle(`${tenant.name} — Product Catalog`);
  }, [tenant?.id]);

  const categories = ['All', ...new Set(inventory.map(i=>i.cat).filter(Boolean))];
  const filtered   = inventory.filter(i => selected.has(i.id) && (catFilter==='All'||i.cat===catFilter));

  const COLORS = { blue:'#4f7cff', green:'#00d68f', amber:'#ffb547', red:'#ff4d6a', purple:'#9b72ff' };

  function generateCatalog() {
    const w     = window.open('', '_blank');
    const color = COLORS[colorScheme];
    const byCat = filtered.reduce((acc,i)=>{ const c=i.cat||'Products'; (acc[c]=acc[c]||[]).push(i); return acc; },{});

    const gridItems = items => items.map(i=>`
      <div style="border:1px solid #e0e0e0;border-radius:8px;padding:14px;break-inside:avoid">
        <div style="height:80px;background:linear-gradient(135deg,${color}22,${color}44);border-radius:6px;margin-bottom:10px;display:flex;align-items:center;justify-content:center;font-size:32px">📦</div>
        <div style="font-size:13px;font-weight:700;color:#111;margin-bottom:4px">${i.name}</div>
        ${showCode&&i.code?`<div style="font-size:10px;color:#888;font-family:monospace;margin-bottom:4px">Code: ${i.code}</div>`:''}
        ${showStock?`<div style="font-size:10px;color:#666;margin-bottom:4px">Stock: ${i.stock||0} units</div>`:''}
        ${showPrice?`<div style="font-size:16px;font-weight:900;color:${color}">Rs.${(i.sp||0).toLocaleString('en-IN')}</div>`:''}
      </div>`).join('');

    const listItems = items => items.map((i,idx)=>`
      <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 14px;background:${idx%2===0?'#f9f9f9':'#fff'};border-radius:4px">
        <div>
          <div style="font-size:13px;font-weight:600;color:#111">${i.name}</div>
          ${showCode&&i.code?`<div style="font-size:10px;color:#888">${i.code}</div>`:''}
        </div>
        ${showPrice?`<div style="font-size:15px;font-weight:800;color:${color}">Rs.${(i.sp||0).toLocaleString('en-IN')}</div>`:''}
      </div>`).join('');

    const priceListItems = items => `<table style="width:100%;border-collapse:collapse">
      <tr style="background:${color};color:#fff"><th style="padding:8px 12px;text-align:left">Product</th>${showCode?'<th style="padding:8px 12px">Code</th>':''}<th style="padding:8px 12px;text-align:right">Price</th>${showStock?'<th style="padding:8px 12px;text-align:right">Stock</th>':''}</tr>
      ${items.map((i,idx)=>`<tr style="background:${idx%2===0?'#f9f9f9':'#fff'}"><td style="padding:8px 12px">${i.name}</td>${showCode?`<td style="padding:8px 12px;text-align:center;font-family:monospace;font-size:11px">${i.code||'—'}</td>`:''}<td style="padding:8px 12px;text-align:right;font-weight:700;color:${color}">Rs.${(i.sp||0).toLocaleString('en-IN')}</td>${showStock?`<td style="padding:8px 12px;text-align:right">${i.stock||0}</td>`:''}</tr>`).join('')}
    </table>`;

    let body = '';
    Object.entries(byCat).forEach(([cat, items]) => {
      body += `<div style="margin-bottom:24px"><div style="background:${color};color:#fff;padding:10px 16px;border-radius:6px;font-size:15px;font-weight:700;margin-bottom:12px">${cat}</div>`;
      if (layout==='grid') body += `<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px">${gridItems(items)}</div>`;
      else if (layout==='list') body += listItems(items);
      else body += priceListItems(items);
      body += '</div>';
    });

    const html = `<!DOCTYPE html><html><head><style>
      @media print { @page { margin:15mm; size:A4; } }
      body { font-family:Arial,sans-serif; margin:0; padding:20px; background:#fff; }
    </style></head><body>
    <div style="text-align:center;margin-bottom:24px;padding-bottom:16px;border-bottom:3px solid ${color}">
      <div style="font-size:28px;font-weight:900;color:${color}">${title}</div>
      ${subtitle?`<div style="font-size:14px;color:#666;margin-top:4px">${subtitle}</div>`:''}
      <div style="font-size:12px;color:#999;margin-top:6px">${tenant?.address||''} ${tenant?.phone?'· '+tenant.phone:''} · Generated ${new Date().toLocaleDateString('en-IN')}</div>
    </div>
    ${body}
    <div style="text-align:center;margin-top:24px;padding-top:16px;border-top:1px solid #eee;color:#999;font-size:11px">All prices in Indian Rupees (Rs.) · Prices subject to change · ${tenant?.name||'Elite Store'}</div>
    <script>window.onload=()=>{window.print();setTimeout(()=>window.close(),800)}<\/script>
    </body></html>`;
    w.document.write(html); w.document.close();
  }

  return (
    <div style={{ padding:20 }}>
      <div style={{ fontSize:22, fontWeight:800, color:T.ink, marginBottom:6 }}>📒 Product Catalog</div>
      <div style={{ fontSize:13, color:T.sub, marginBottom:20 }}>Generate a professional printable product catalog</div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
        {/* Left: items */}
        <div>
          <div style={{ display:'flex', gap:6, marginBottom:10, flexWrap:'wrap' }}>
            {categories.map(c=><button key={c} onClick={()=>setCatFilter(c)} style={{ background:catFilter===c?T.blue:T.srf, color:catFilter===c?'#fff':T.sub, border:`1px solid ${catFilter===c?T.blue:T.bdr}`, borderRadius:20, padding:'4px 12px', fontSize:11, cursor:'pointer', fontFamily:'inherit' }}>{c}</button>)}
          </div>
          <div style={{ display:'flex', gap:8, marginBottom:10 }}>
            <button onClick={()=>setSelected(new Set(inventory.map(i=>i.id)))} style={{ background:T.green+'22', color:T.green, border:'none', borderRadius:7, padding:'5px 12px', fontSize:11, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>Select All</button>
            <button onClick={()=>setSelected(new Set())} style={{ background:T.card, color:T.sub, border:`1px solid ${T.bdr}`, borderRadius:7, padding:'5px 12px', fontSize:11, cursor:'pointer', fontFamily:'inherit' }}>Clear</button>
            <span style={{ fontSize:12, color:T.muted, lineHeight:'26px' }}>{selected.size} selected</span>
          </div>
          <div style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:12, maxHeight:420, overflowY:'auto' }}>
            {loading?<div style={{ padding:40, textAlign:'center', color:T.sub }}>Loading…</div>
            :inventory.map(item=>(
              <div key={item.id} onClick={()=>setSelected(s=>{const n=new Set(s);n.has(item.id)?n.delete(item.id):n.add(item.id);return n;})}
                style={{ display:'flex', alignItems:'center', gap:10, padding:'9px 14px', borderBottom:`1px solid ${T.bdr}22`, cursor:'pointer', background:selected.has(item.id)?T.blue+'18':'transparent' }}>
                <div style={{ width:16, height:16, border:`2px solid ${selected.has(item.id)?T.blue:T.bdr}`, borderRadius:3, background:selected.has(item.id)?T.blue:'transparent', display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, color:'#fff', flexShrink:0 }}>{selected.has(item.id)?'✓':''}</div>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:13, color:T.ink, fontWeight:600 }}>{item.name}</div>
                  <div style={{ fontSize:10, color:T.muted }}>{item.cat||'—'}{item.code?` · ${item.code}`:''}</div>
                </div>
                <span style={{ fontSize:13, fontWeight:700, color:T.green }}>{fmt(item.sp)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Right: options */}
        <div>
          <div style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:12, padding:18, marginBottom:14 }}>
            <div style={{ fontWeight:700, color:T.ink, marginBottom:14 }}>Catalog Options</div>
            <div style={{ marginBottom:12 }}>
              <label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:5 }}>Title</label>
              <input value={title} onChange={e=>setTitle(e.target.value)} style={{ background:T.card, border:`1px solid ${T.bdr}`, borderRadius:7, padding:'8px 12px', color:T.ink, fontSize:13, fontFamily:'inherit', outline:'none', width:'100%' }}/>
            </div>
            <div style={{ marginBottom:12 }}>
              <label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:5 }}>Subtitle (optional)</label>
              <input value={subtitle} onChange={e=>setSubtitle(e.target.value)} placeholder="e.g. Season 2025 Collection" style={{ background:T.card, border:`1px solid ${T.bdr}`, borderRadius:7, padding:'8px 12px', color:T.ink, fontSize:13, fontFamily:'inherit', outline:'none', width:'100%' }}/>
            </div>
            <div style={{ marginBottom:12 }}>
              <label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:6 }}>Layout</label>
              <div style={{ display:'flex', gap:6 }}>
                {[['grid','📷 Grid'],['list','📋 List'],['price-list','💰 Price List']].map(([id,label])=>(
                  <button key={id} onClick={()=>setLayout(id)} style={{ flex:1, background:layout===id?T.blue:T.card, color:layout===id?'#fff':T.sub, border:`1px solid ${layout===id?T.blue:T.bdr}`, borderRadius:7, padding:'7px 6px', fontSize:11, cursor:'pointer', fontFamily:'inherit' }}>{label}</button>
                ))}
              </div>
            </div>
            <div style={{ marginBottom:12 }}>
              <label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:6 }}>Color Scheme</label>
              <div style={{ display:'flex', gap:8 }}>
                {Object.entries(COLORS).map(([name,color])=>(
                  <div key={name} onClick={()=>setColorScheme(name)} style={{ width:28, height:28, borderRadius:'50%', background:color, cursor:'pointer', border:`3px solid ${colorScheme===name?T.ink:color}`, boxSizing:'border-box' }}/>
                ))}
              </div>
            </div>
            {[['showPrice','Show Price',showPrice,setShowPrice],['showCode','Show Item Code',showCode,setShowCode],['showStock','Show Stock',showStock,setShowStock]].map(([key,label,val,setter])=>(
              <div key={key} onClick={()=>setter(v=>!v)} style={{ display:'flex', alignItems:'center', gap:8, padding:'5px 0', cursor:'pointer' }}>
                <div style={{ width:16, height:16, border:`2px solid ${val?T.blue:T.bdr}`, borderRadius:3, background:val?T.blue:'transparent', display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, color:'#fff' }}>{val?'✓':''}</div>
                <span style={{ fontSize:12, color:T.ink }}>{label}</span>
              </div>
            ))}
          </div>

          <div style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:10, padding:'12px 16px', marginBottom:14, fontSize:12, color:T.sub }}>
            📄 <strong style={{ color:T.ink }}>{filtered.length} products</strong> across {Object.keys(filtered.reduce((acc,i)=>({...acc,[i.cat||'Products']:1}),{})).length} categories will appear in catalog
          </div>

          <button onClick={generateCatalog} disabled={!filtered.length} style={{ width:'100%', background:filtered.length?T.blue:T.bdr, color:filtered.length?'#fff':T.muted, border:'none', borderRadius:9, padding:'13px', fontSize:14, fontWeight:700, cursor:filtered.length?'pointer':'default', fontFamily:'inherit' }}>
            🖨️ Generate & Print Catalog
          </button>
        </div>
      </div>
    </div>
  );
}
