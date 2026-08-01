import { useState, useEffect, useRef } from 'react';
import { getInventory } from '../lib/supabase';

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

async function loadQRLib() {
  if (window.QRCode) return window.QRCode;
  return new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js';
    s.onload = () => res(window.QRCode); s.onerror = rej;
    document.head.appendChild(s);
  });
}

function LabelPreview({ item, labelSize, showPrice, showName, showCode, showQR }) {
  const qrRef = useRef(null);
  const qrObj = useRef(null);

  useEffect(() => {
    if (!showQR || !qrRef.current) return;
    if (qrObj.current) { qrRef.current.innerHTML = ''; }
    const code = item.code || item.name.slice(0,10).replace(/\s/g,'').toUpperCase();
    loadQRLib().then(QRCode => {
      qrObj.current = new QRCode(qrRef.current, {
        text: code, width: labelSize==='small'?50:70, height: labelSize==='small'?50:70,
        colorDark:'#000000', colorLight:'#ffffff',
      });
    }).catch(() => {});
    return () => { if (qrRef.current) qrRef.current.innerHTML = ''; };
  }, [item.id, showQR, labelSize]);

  const w = labelSize==='small'?80 : labelSize==='medium'?120 : 160;
  const h = labelSize==='small'?60 : labelSize==='medium'?80  : 100;
  const fs = labelSize==='small'?8  : labelSize==='medium'?10  : 12;

  return (
    <div style={{ width:w, height:h, border:'1px solid #ccc', borderRadius:4, padding:4, background:'#fff', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:2 }}>
      {showQR && <div ref={qrRef} />}
      {showName && <div style={{ fontSize:fs, fontWeight:700, color:'#000', textAlign:'center', wordBreak:'break-word', lineHeight:1.2 }}>{item.name.length>20?item.name.slice(0,18)+'…':item.name}</div>}
      {showCode && item.code && <div style={{ fontSize:fs-1, color:'#666', fontFamily:'monospace' }}>{item.code}</div>}
      {showPrice && <div style={{ fontSize:fs+1, fontWeight:900, color:'#000' }}>Rs.{(item.sp||0).toLocaleString('en-IN')}</div>}
    </div>
  );
}

export default function QRLabels({ tenant }) {
  const [inventory, setInventory] = useState([]);
  const [selected,  setSelected]  = useState(new Set());
  const [loading,   setLoading]   = useState(true);
  const [search,    setSearch]    = useState('');
  const [labelSize, setLabelSize] = useState('medium');
  const [showPrice, setShowPrice] = useState(true);
  const [showName,  setShowName]  = useState(true);
  const [showCode,  setShowCode]  = useState(true);
  const [showQR,    setShowQR]    = useState(true);
  const [copies,    setCopies]    = useState(1);

  useEffect(() => { if (tenant?.id) getInventory(tenant.id).then(setInventory).finally(()=>setLoading(false)); }, [tenant?.id]);

  const filtered = inventory.filter(i => !search || i.name.toLowerCase().includes(search.toLowerCase()) || (i.code||'').toLowerCase().includes(search.toLowerCase()));

  function printLabels() {
    const items = inventory.filter(i => selected.has(i.id));
    const w = window.open('', '_blank');
    const qrSize = labelSize==='small'?50:labelSize==='medium'?70:90;
    const labelW = labelSize==='small'?90:labelSize==='medium'?130:170;
    const labelH = labelSize==='small'?70:labelSize==='medium'?90:110;
    const fs     = labelSize==='small'?8:labelSize==='medium'?10:12;

    const labelsHTML = items.flatMap(item => Array(copies).fill(item)).map(item => {
      const code = item.code || item.name.slice(0,10).replace(/\s/g,'').toUpperCase();
      return `<div class="label">
        ${showQR ? `<div id="qr_${item.id}_${Math.random().toString(36).slice(2)}"></div>` : ''}
        ${showName ? `<div class="name">${item.name.length>22?item.name.slice(0,20)+'…':item.name}</div>` : ''}
        ${showCode && item.code ? `<div class="code">${item.code}</div>` : ''}
        ${showPrice ? `<div class="price">Rs.${(item.sp||0).toLocaleString('en-IN')}</div>` : ''}
        <div class="qr-data" style="display:none">${code}</div>
      </div>`;
    }).join('');

    const html = `<!DOCTYPE html><html><head><style>
      @media print { * { margin:0; padding:0; } @page { margin:5mm; } }
      body { font-family:Arial,sans-serif; background:#fff; }
      .labels { display:flex; flex-wrap:wrap; gap:4px; padding:4px; }
      .label { width:${labelW}px; height:${labelH}px; border:1px solid #ccc; border-radius:3px; padding:4px; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:2px; break-inside:avoid; }
      .name  { font-size:${fs}px; font-weight:bold; text-align:center; color:#000; line-height:1.2; word-break:break-word; }
      .code  { font-size:${fs-1}px; color:#666; font-family:monospace; }
      .price { font-size:${fs+2}px; font-weight:900; color:#000; }
    </style></head><body>
    <div class="labels">${labelsHTML}</div>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"><\/script>
    <script>
      window.onload = function() {
        document.querySelectorAll('.label').forEach(function(label) {
          var qrData = label.querySelector('.qr-data');
          if (!qrData) return;
          var qrDiv = label.querySelector('[id^="qr_"]');
          if (!qrDiv) return;
          try {
            new QRCode(qrDiv, { text: qrData.textContent, width:${qrSize}, height:${qrSize}, colorDark:'#000', colorLight:'#fff' });
          } catch(e) {}
        });
        setTimeout(function() { window.print(); setTimeout(function() { window.close(); }, 500); }, 1500);
      };
    <\/script></body></html>`;
    w.document.write(html); w.document.close();
  }

  return (
    <div style={{ padding:20 }}>
      <div style={{ fontSize:22, fontWeight:800, color:T.ink, marginBottom:6 }}>🏷️ QR Code Labels</div>
      <div style={{ fontSize:13, color:T.sub, marginBottom:20 }}>Generate printable product labels with QR codes</div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
        {/* Left: item selector */}
        <div>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="🔍 Search items…"
            style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:9, padding:'10px 14px', color:T.ink, fontSize:13, fontFamily:'inherit', outline:'none', width:'100%', marginBottom:10 }} />
          <div style={{ display:'flex', gap:8, marginBottom:10 }}>
            <button onClick={()=>setSelected(new Set(filtered.map(i=>i.id)))} style={{ background:T.green+'22', color:T.green, border:'none', borderRadius:7, padding:'6px 12px', fontSize:11, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>Select All</button>
            <button onClick={()=>setSelected(new Set())} style={{ background:T.card, color:T.sub, border:`1px solid ${T.bdr}`, borderRadius:7, padding:'6px 12px', fontSize:11, cursor:'pointer', fontFamily:'inherit' }}>Clear</button>
            <span style={{ fontSize:12, color:T.muted, lineHeight:'28px' }}>{selected.size} selected</span>
          </div>
          <div style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:12, maxHeight:440, overflowY:'auto' }}>
            {loading ? <div style={{ padding:40, textAlign:'center', color:T.sub }}>Loading…</div>
            : filtered.map(item => (
              <div key={item.id} onClick={()=>setSelected(s=>{const n=new Set(s);n.has(item.id)?n.delete(item.id):n.add(item.id);return n;})}
                style={{ display:'flex', alignItems:'center', gap:10, padding:'9px 14px', borderBottom:`1px solid ${T.bdr}22`, cursor:'pointer', background:selected.has(item.id)?T.blue+'18':'transparent' }}>
                <div style={{ width:16, height:16, border:`2px solid ${selected.has(item.id)?T.blue:T.bdr}`, borderRadius:3, background:selected.has(item.id)?T.blue:'transparent', display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, color:'#fff', flexShrink:0 }}>
                  {selected.has(item.id)?'✓':''}
                </div>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:13, color:T.ink }}>{item.name}</div>
                  {item.code && <div style={{ fontSize:10, color:T.muted, fontFamily:'monospace' }}>{item.code}</div>}
                </div>
                <span style={{ fontSize:13, fontWeight:700, color:T.green }}>Rs.{(item.sp||0).toLocaleString('en-IN')}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Right: label options + preview */}
        <div>
          <div style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:12, padding:18, marginBottom:14 }}>
            <div style={{ fontWeight:700, color:T.ink, marginBottom:14 }}>Label Options</div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
              <div>
                <label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:6 }}>Label Size</label>
                <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
                  {[['small','Small (90×70mm)'],['medium','Medium (130×90mm)'],['large','Large (170×110mm)']].map(([id,label])=>(
                    <button key={id} onClick={()=>setLabelSize(id)} style={{ background:labelSize===id?T.blue:T.card, color:labelSize===id?'#fff':T.sub, border:`1px solid ${labelSize===id?T.blue:T.bdr}`, borderRadius:7, padding:'6px 10px', fontSize:11, cursor:'pointer', fontFamily:'inherit', textAlign:'left' }}>{label}</button>
                  ))}
                </div>
              </div>
              <div>
                <label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:6 }}>Show on Label</label>
                {[['showQR','QR Code',showQR,setShowQR],['showName','Product Name',showName,setShowName],['showCode','Item Code',showCode,setShowCode],['showPrice','Price',showPrice,setShowPrice]].map(([key,label,val,setter])=>(
                  <div key={key} onClick={()=>setter(v=>!v)} style={{ display:'flex', alignItems:'center', gap:8, padding:'4px 0', cursor:'pointer' }}>
                    <div style={{ width:16, height:16, border:`2px solid ${val?T.blue:T.bdr}`, borderRadius:4, background:val?T.blue:'transparent', display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, color:'#fff' }}>{val?'✓':''}</div>
                    <span style={{ fontSize:12, color:T.ink }}>{label}</span>
                  </div>
                ))}
                <div style={{ marginTop:10 }}>
                  <label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:5 }}>Copies per item</label>
                  <input type="number" min={1} max={20} value={copies} onChange={e=>setCopies(parseInt(e.target.value)||1)}
                    style={{ background:T.card, border:`1px solid ${T.bdr}`, borderRadius:7, padding:'7px 10px', color:T.ink, fontSize:13, fontFamily:'inherit', outline:'none', width:70 }} />
                </div>
              </div>
            </div>
          </div>

          {/* Preview */}
          {selected.size > 0 && (
            <div style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:12, padding:18, marginBottom:14 }}>
              <div style={{ fontWeight:700, color:T.ink, marginBottom:12 }}>Preview (first item)</div>
              <div style={{ background:'#f5f5f5', padding:16, borderRadius:8, display:'inline-flex' }}>
                <LabelPreview item={inventory.find(i=>selected.has(i.id))} labelSize={labelSize} showPrice={showPrice} showName={showName} showCode={showCode} showQR={showQR} />
              </div>
            </div>
          )}

          <button onClick={printLabels} disabled={!selected.size} style={{ background:selected.size?T.blue:T.bdr, color:selected.size?'#fff':T.muted, border:'none', borderRadius:9, padding:'12px', fontSize:14, fontWeight:700, cursor:'pointer', fontFamily:'inherit', width:'100%' }}>
            🖨️ Print {selected.size > 0 ? `${selected.size * copies} Labels` : 'Labels'}
          </button>
        </div>
      </div>
    </div>
  );
}
