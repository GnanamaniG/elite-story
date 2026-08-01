import { useState, useEffect } from 'react';

const T = {
  bg:'#F7F3F3', srf:'#FFFFFF', bdr:'#E8DEDE',
  red:'#C0392B', darkRed:'#8B0000', lightRed:'#FEF2F2',
  green:'#16A34A', blue:'#2563EB',
  ink:'#111827', sub:'#6B7280', muted:'#9CA3AF', white:'#FFFFFF'
};

const SIZES = {
  a4:      { label:'A4',        w:'794px',  css:'@page{size:A4;margin:12mm}' },
  a5:      { label:'A5',        w:'559px',  css:'@page{size:A5;margin:10mm}' },
  thermal: { label:'Thermal 3"',w:'302px',  css:'@page{size:80mm auto;margin:3mm}' },
  thermal2:{ label:'Thermal 2"',w:'219px',  css:'@page{size:58mm auto;margin:2mm}' },
};

/**
 * Usage:
 *   const [preview, setPreview] = useState(null);
 *   setPreview({ title:'Invoice INV-001', html:'<h1>…</h1>' });
 *   <PrintPreview data={preview} onClose={()=>setPreview(null)} />
 */
export default function PrintPreview({ data, onClose, defaultSize='a4' }) {
  const [size,  setSize]  = useState(defaultSize);
  const [copies,setCopies]= useState(1);
  const [zoom,  setZoom]  = useState(80);

  useEffect(() => {
    function esc(e){ if(e.key==='Escape') onClose?.(); }
    if (data) window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [data, onClose]);

  if (!data) return null;

  function doPrint() {
    const cfg = SIZES[size];
    const w = window.open('', '_blank', 'width=900,height=700');
    const body = Array.from({length:copies}, (_,i)=>
      `<div class="page"${i>0?' style="page-break-before:always"':''}>${data.html}</div>`
    ).join('');
    w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8">
      <title>${data.title||'Print'}</title>
      <style>
        ${cfg.css}
        *{box-sizing:border-box}
        body{font-family:${size.startsWith('thermal')?'"Courier New",monospace':'Arial,sans-serif'};
             font-size:${size.startsWith('thermal')?'11px':'12px'};margin:0;padding:0;color:#000}
        .page{width:100%}
        table{width:100%;border-collapse:collapse}
        h1,h2,h3{margin:0 0 4px}
        @media print{ .no-print{display:none} }
      </style></head><body>${body}
      <script>window.onload=()=>{window.print();setTimeout(()=>window.close(),400)}<\/script>
      </body></html>`);
    w.document.close();
    onClose?.();
  }

  function downloadHtml() {
    const blob = new Blob([`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${data.title}</title>
      <style>body{font-family:Arial,sans-serif;font-size:12px;padding:20px}table{width:100%;border-collapse:collapse}</style>
      </head><body>${data.html}</body></html>`], { type:'text/html' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${(data.title||'document').replace(/[^a-z0-9]/gi,'_')}.html`;
    a.click();
  }

  const cfg = SIZES[size];

  return (
    <div onClick={onClose}
      style={{ position:'fixed', inset:0, background:'rgba(17,24,39,.55)', backdropFilter:'blur(3px)', zIndex:800, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
      <div onClick={e=>e.stopPropagation()}
        style={{ background:T.white, borderRadius:16, width:'100%', maxWidth:920, height:'88vh', display:'flex', flexDirection:'column', overflow:'hidden', boxShadow:'0 24px 70px rgba(0,0,0,.3)' }}>

        {/* Header */}
        <div style={{ padding:'14px 22px', borderBottom:`1px solid ${T.bdr}`, background:T.lightRed, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <div>
            <div style={{ fontSize:15, fontWeight:800, color:T.darkRed }}>🖨️ Print Preview</div>
            <div style={{ fontSize:11, color:T.sub, marginTop:1 }}>{data.title||'Document'}</div>
          </div>
          <button onClick={onClose} style={{ background:'none', border:'none', fontSize:24, cursor:'pointer', color:T.muted, lineHeight:1 }}>×</button>
        </div>

        {/* Toolbar */}
        <div style={{ padding:'10px 22px', borderBottom:`1px solid ${T.bdr}`, background:T.white, display:'flex', gap:18, alignItems:'center', flexWrap:'wrap' }}>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <span style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase' }}>Paper</span>
            <div style={{ display:'flex', background:T.bg, borderRadius:8, padding:3, gap:2 }}>
              {Object.entries(SIZES).map(([k,v])=>(
                <button key={k} onClick={()=>setSize(k)}
                  style={{ padding:'5px 11px', background:size===k?T.red:'transparent', color:size===k?T.white:T.sub, border:'none', borderRadius:6, fontSize:11, fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}>
                  {v.label}
                </button>
              ))}
            </div>
          </div>

          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <span style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase' }}>Copies</span>
            <div style={{ display:'flex', alignItems:'center', gap:4 }}>
              <button onClick={()=>setCopies(c=>Math.max(1,c-1))} style={{ width:26, height:26, background:T.bg, border:`1px solid ${T.bdr}`, borderRadius:6, cursor:'pointer', fontFamily:'inherit', color:T.sub }}>−</button>
              <span style={{ minWidth:24, textAlign:'center', fontWeight:700, fontSize:13, color:T.ink }}>{copies}</span>
              <button onClick={()=>setCopies(c=>Math.min(9,c+1))} style={{ width:26, height:26, background:T.bg, border:`1px solid ${T.bdr}`, borderRadius:6, cursor:'pointer', fontFamily:'inherit', color:T.sub }}>+</button>
            </div>
          </div>

          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <span style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase' }}>Zoom</span>
            <input type="range" min="40" max="130" value={zoom} onChange={e=>setZoom(parseInt(e.target.value))} style={{ width:100, accentColor:T.red }}/>
            <span style={{ fontSize:11, color:T.sub, minWidth:34 }}>{zoom}%</span>
          </div>

          <div style={{ marginLeft:'auto', display:'flex', gap:8 }}>
            <button onClick={downloadHtml} style={{ background:T.bg, color:T.sub, border:`1px solid ${T.bdr}`, borderRadius:8, padding:'8px 14px', fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}>💾 Save</button>
            <button onClick={doPrint} style={{ background:T.red, color:T.white, border:'none', borderRadius:8, padding:'8px 20px', fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>🖨️ Print {copies>1?`(${copies})`:''}</button>
          </div>
        </div>

        {/* Preview canvas */}
        <div style={{ flex:1, overflow:'auto', background:'#9CA3AF33', padding:'28px 20px', display:'flex', justifyContent:'center', alignItems:'flex-start' }}>
          <div style={{
            width:cfg.w, minHeight:size.startsWith('thermal')?'auto':'1000px',
            background:T.white, boxShadow:'0 4px 24px rgba(0,0,0,.18)',
            padding: size.startsWith('thermal')?'12px':'28px',
            transform:`scale(${zoom/100})`, transformOrigin:'top center',
            fontFamily: size.startsWith('thermal')?'"Courier New",monospace':'Arial,sans-serif',
            fontSize: size.startsWith('thermal')?11:12, color:'#000',
          }}
            dangerouslySetInnerHTML={{ __html:data.html }}/>
        </div>

        <div style={{ padding:'8px 22px', borderTop:`1px solid ${T.bdr}`, background:T.bg, fontSize:10, color:T.sub, textAlign:'center' }}>
          Preview shows approximate layout · Actual print may vary slightly by printer · Press <kbd style={{ background:T.white, border:`1px solid ${T.bdr}`, borderRadius:4, padding:'1px 5px' }}>ESC</kbd> to close
        </div>
      </div>
    </div>
  );
}
