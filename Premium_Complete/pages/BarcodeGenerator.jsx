import { useState, useEffect, useRef } from 'react';
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

async function loadJsBarcode() {
  if (window.JsBarcode) return window.JsBarcode;
  return new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/JsBarcode/3.11.6/JsBarcode.all.min.js';
    s.onload = () => res(window.JsBarcode);
    s.onerror = rej;
    document.head.appendChild(s);
  });
}

function BarcodePreview({ value, format, showText, height }) {
  const svgRef = useRef();
  useEffect(() => {
    if (!value || !svgRef.current) return;
    loadJsBarcode().then(JsBarcode => {
      try {
        JsBarcode(svgRef.current, value, { format, displayValue:showText, height:height||60, width:2, fontSize:12, margin:8, background:'#ffffff', lineColor:'#000000' });
      } catch(e) { /* invalid format for value */ }
    }).catch(() => {});
  }, [value, format, showText, height]);
  return <svg ref={svgRef} style={{ background:'#fff', borderRadius:4 }}/>;
}

export default function BarcodeGenerator({ tenant }) {
  const [inventory, setInventory] = useState([]);
  const [selected,  setSelected]  = useState(new Set());
  const [loading,   setLoading]   = useState(true);
  const [search,    setSearch]    = useState('');
  const [format,    setFormat]    = useState('CODE128');
  const [showText,  setShowText]  = useState(true);
  const [showPrice, setShowPrice] = useState(true);
  const [showName,  setShowName]  = useState(true);
  const [copies,    setCopies]    = useState(1);
  const [custom,    setCustom]    = useState('');

  useEffect(() => {
    if (!tenant?.id) return;
    supabase.from('inventory').select('*').eq('tenant_id', tenant.id).eq('active', true).order('name')
      .then(({ data }) => setInventory(data||[]))
      .finally(() => setLoading(false));
  }, [tenant?.id]);

  const filtered = inventory.filter(i => !search || i.name.toLowerCase().includes(search.toLowerCase()) || (i.code||'').toLowerCase().includes(search.toLowerCase()));
  const FORMATS  = ['CODE128','EAN13','EAN8','CODE39','UPC'];

  function getBarcodeValue(item) {
    if (format === 'EAN13') {
      const code = (item.code||item.id.replace(/-/g,'')).replace(/\D/g,'').slice(0,12).padStart(12,'0');
      return code + checkDigitEAN(code);
    }
    if (format === 'EAN8') {
      const code = (item.code||item.id.replace(/-/g,'')).replace(/\D/g,'').slice(0,7).padStart(7,'0');
      return code + checkDigitEAN(code);
    }
    return item.code || item.name.toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,10);
  }

  function checkDigitEAN(code) {
    const digits = code.split('').map(Number);
    let sum = 0;
    digits.forEach((d,i) => { sum += d * (i%2===0?1:3); });
    return String((10 - (sum%10))%10);
  }

  function printBarcodes() {
    const items = inventory.filter(i => selected.has(i.id));
    if (!items.length) return alert('Select at least one product');
    const w = window.open('', '_blank');
    const labelH = 100, labelW = 200;
    const labelsHTML = items.flatMap(item => Array(copies).fill(item)).map(item => {
      const val = getBarcodeValue(item);
      return `<div class="label">
        <svg id="bc_${item.id}_${Math.random().toString(36).slice(2)}"></svg>
        ${showName?`<div class="name">${item.name.length>22?item.name.slice(0,20)+'…':item.name}</div>`:''}
        ${showPrice?`<div class="price">Rs.${(item.sp||0).toLocaleString('en-IN')}</div>`:''}
        <div class="bcval" style="display:none">${val}</div>
        <div class="bcfmt" style="display:none">${format}</div>
      </div>`;
    }).join('');

    w.document.write(`<!DOCTYPE html><html><head><style>
      @media print { @page { margin:5mm; } }
      body { font-family:Arial,sans-serif; margin:0; padding:4px; background:#fff; }
      .labels { display:flex; flex-wrap:wrap; gap:4px; }
      .label { width:${labelW}px; border:1px solid #ddd; border-radius:4px; padding:6px; display:flex; flex-direction:column; align-items:center; break-inside:avoid; }
      .name { font-size:10px; font-weight:bold; text-align:center; color:#000; margin-top:3px; }
      .price { font-size:12px; font-weight:900; color:#000; }
    </style></head><body>
    <div class="labels">${labelsHTML}</div>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/JsBarcode/3.11.6/JsBarcode.all.min.js"><\/script>
    <script>
      window.onload = function() {
        document.querySelectorAll('.label').forEach(function(label) {
          var svg = label.querySelector('svg');
          var val = label.querySelector('.bcval').textContent;
          var fmt = label.querySelector('.bcfmt').textContent;
          if (!svg || !val) return;
          try { JsBarcode(svg, val, { format:fmt, displayValue:${showText}, height:55, width:2, fontSize:11, margin:5, background:'#fff', lineColor:'#000' }); } catch(e) {}
        });
        setTimeout(function() { window.print(); setTimeout(function() { window.close(); }, 500); }, 1500);
      };
    <\/script></body></html>`);
    w.document.close();
  }

  return (
    <div style={{ padding:20 }}>
      <div style={{ fontSize:22, fontWeight:800, color:T.ink, marginBottom:6 }}>🔢 Barcode Generator</div>
      <div style={{ fontSize:13, color:T.sub, marginBottom:20 }}>Generate EAN-13, Code128 and other barcodes for your products</div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
        {/* Left: item selector */}
        <div>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="🔍 Search products…"
            style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:9, padding:'10px 14px', color:T.ink, fontSize:13, fontFamily:'inherit', outline:'none', width:'100%', marginBottom:10 }}/>
          <div style={{ display:'flex', gap:8, marginBottom:10 }}>
            <button onClick={()=>setSelected(new Set(filtered.map(i=>i.id)))} style={{ background:T.green+'22', color:T.green, border:'none', borderRadius:7, padding:'6px 12px', fontSize:11, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>Select All</button>
            <button onClick={()=>setSelected(new Set())} style={{ background:T.card, color:T.sub, border:`1px solid ${T.bdr}`, borderRadius:7, padding:'6px 12px', fontSize:11, cursor:'pointer', fontFamily:'inherit' }}>Clear</button>
            <span style={{ fontSize:12, color:T.muted, lineHeight:'28px' }}>{selected.size} selected</span>
          </div>
          <div style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:12, maxHeight:420, overflowY:'auto' }}>
            {loading?<div style={{ padding:40, textAlign:'center', color:T.sub }}>Loading…</div>
            :filtered.map(item=>(
              <div key={item.id} onClick={()=>setSelected(s=>{const n=new Set(s);n.has(item.id)?n.delete(item.id):n.add(item.id);return n;})}
                style={{ display:'flex', alignItems:'center', gap:10, padding:'9px 14px', borderBottom:`1px solid ${T.bdr}22`, cursor:'pointer', background:selected.has(item.id)?T.blue+'18':'transparent' }}>
                <div style={{ width:16, height:16, border:`2px solid ${selected.has(item.id)?T.blue:T.bdr}`, borderRadius:3, background:selected.has(item.id)?T.blue:'transparent', display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, color:'#fff', flexShrink:0 }}>{selected.has(item.id)?'✓':''}</div>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:13, color:T.ink, fontWeight:600 }}>{item.name}</div>
                  <div style={{ fontSize:10, color:T.muted }}>{item.code?`Code: ${item.code}`:getBarcodeValue(item)}</div>
                </div>
                <span style={{ fontSize:13, fontWeight:700, color:T.green }}>{fmt(item.sp)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Right: options + preview */}
        <div>
          <div style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:12, padding:18, marginBottom:14 }}>
            <div style={{ fontWeight:700, color:T.ink, marginBottom:14 }}>Barcode Options</div>
            <div style={{ marginBottom:12 }}>
              <label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:6 }}>Format</label>
              <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                {FORMATS.map(f=><button key={f} onClick={()=>setFormat(f)} style={{ background:format===f?T.blue:T.card, color:format===f?'#fff':T.sub, border:`1px solid ${format===f?T.blue:T.bdr}`, borderRadius:6, padding:'5px 10px', fontSize:11, cursor:'pointer', fontFamily:'inherit' }}>{f}</button>)}
              </div>
            </div>
            {[['Show Barcode Number',showText,setShowText],['Show Product Name',showName,setShowName],['Show Price',showPrice,setShowPrice]].map(([label,val,setter])=>(
              <div key={label} onClick={()=>setter(v=>!v)} style={{ display:'flex', alignItems:'center', gap:8, padding:'5px 0', cursor:'pointer' }}>
                <div style={{ width:16, height:16, border:`2px solid ${val?T.blue:T.bdr}`, borderRadius:3, background:val?T.blue:'transparent', display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, color:'#fff' }}>{val?'✓':''}</div>
                <span style={{ fontSize:12, color:T.ink }}>{label}</span>
              </div>
            ))}
            <div style={{ marginTop:10 }}>
              <label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:5 }}>Copies per item</label>
              <input type="number" min={1} max={20} value={copies} onChange={e=>setCopies(parseInt(e.target.value)||1)} style={{ width:70, background:T.card, border:`1px solid ${T.bdr}`, borderRadius:7, padding:'7px 10px', color:T.ink, fontSize:13, fontFamily:'inherit', outline:'none' }}/>
            </div>
          </div>

          {/* Custom barcode test */}
          <div style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:12, padding:18, marginBottom:14 }}>
            <div style={{ fontWeight:700, color:T.ink, marginBottom:10 }}>Test Custom Value</div>
            <input value={custom} onChange={e=>setCustom(e.target.value)} placeholder="Enter custom barcode value…" style={{ background:T.card, border:`1px solid ${T.bdr}`, borderRadius:7, padding:'8px 12px', color:T.ink, fontSize:13, fontFamily:'inherit', outline:'none', width:'100%', marginBottom:10 }}/>
            {custom&&<div style={{ background:'#fff', borderRadius:8, padding:10, display:'inline-block' }}><BarcodePreview value={custom} format={format} showText={showText} height={60}/></div>}
          </div>

          {/* Preview first selected */}
          {selected.size>0&&(()=>{
            const item = inventory.find(i=>selected.has(i.id));
            const val  = getBarcodeValue(item);
            return (
              <div style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:12, padding:18, marginBottom:14 }}>
                <div style={{ fontWeight:700, color:T.ink, marginBottom:10 }}>Preview — {item.name}</div>
                <div style={{ background:'#fff', borderRadius:8, padding:10, display:'inline-block' }}>
                  <BarcodePreview value={val} format={format} showText={showText} height={60}/>
                  {showName&&<div style={{ fontSize:10, fontWeight:700, textAlign:'center', color:'#000', marginTop:3 }}>{item.name.length>22?item.name.slice(0,20)+'…':item.name}</div>}
                  {showPrice&&<div style={{ fontSize:12, fontWeight:900, textAlign:'center', color:'#000' }}>Rs.{(item.sp||0).toLocaleString('en-IN')}</div>}
                </div>
              </div>
            );
          })()}

          <button onClick={printBarcodes} disabled={!selected.size} style={{ background:selected.size?T.blue:T.bdr, color:selected.size?'#fff':T.muted, border:'none', borderRadius:9, padding:'12px', fontSize:14, fontWeight:700, cursor:'pointer', fontFamily:'inherit', width:'100%' }}>
            🖨️ Print {selected.size>0?`${selected.size*copies} Barcodes`:'Barcodes'}
          </button>
        </div>
      </div>
    </div>
  );
}
