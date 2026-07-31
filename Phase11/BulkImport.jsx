import { useState, useRef } from 'react';
import { supabase } from '../lib/supabase';

const T = { bg:'#060710', srf:'#0f1220', card:'#141828', bdr:'#1e2540', blue:'#4f7cff', ink:'#eef0f8', sub:'#6b7598', muted:'#4a5175', green:'#00d68f', amber:'#ffb547', red:'#ff4d6a', teal:'#00c9b1' };

const INVENTORY_COLS = ['name','code','cat','unit','sp','cp','gst','stock','alert','hsn'];
const CUSTOMER_COLS  = ['name','phone','email','gstin','address','credit_limit'];

const SAMPLE_INVENTORY = `name,code,cat,unit,sp,cp,gst,stock,alert
Nike Air Max,NK001,Footwear,Pairs,3499,2100,18,10,3
Leather Handbag,LH002,Bags,Pcs,1999,1200,18,15,5
Canvas Sneakers,CS003,Footwear,Pairs,1299,800,18,20,5`;

const SAMPLE_CUSTOMERS = `name,phone,email,gstin,address,credit_limit
John Doe,9876543210,john@example.com,,Chennai,5000
Priya Sharma,9123456789,priya@gmail.com,,Coimbatore,10000`;

async function loadXLSX() {
  if (window.XLSX) return window.XLSX;
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
    s.onload = () => resolve(window.XLSX); s.onerror = reject;
    document.head.appendChild(s);
  });
}

function parseCSV(text) {
  const lines = text.trim().split('\n').map(l => l.split(',').map(c => c.trim().replace(/^"|"$/g,'')));
  const headers = lines[0].map(h => h.toLowerCase().replace(/\s+/g,'_'));
  return lines.slice(1).map(row => Object.fromEntries(headers.map((h,i) => [h, row[i]||''])));
}

export default function BulkImport({ tenant }) {
  const [type,       setType]       = useState('inventory');
  const [rows,       setRows]       = useState([]);
  const [headers,    setHeaders]    = useState([]);
  const [mapping,    setMapping]    = useState({});
  const [importing,  setImporting]  = useState(false);
  const [result,     setResult]     = useState(null);
  const [step,       setStep]       = useState(1);
  const fileRef  = useRef();

  async function handleFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    setResult(null); setRows([]); setHeaders([]);
    const ext = file.name.split('.').pop().toLowerCase();
    let data = [];
    if (ext === 'csv' || ext === 'txt') {
      const text = await file.text();
      data = parseCSV(text);
    } else {
      const XLSX = await loadXLSX();
      const ab   = await file.arrayBuffer();
      const wb   = XLSX.read(ab);
      const ws   = wb.Sheets[wb.SheetNames[0]];
      data = XLSX.utils.sheet_to_json(ws, { defval:'' });
    }
    if (!data.length) return alert('No data found in file');
    setHeaders(Object.keys(data[0]));
    setRows(data);

    // Auto-map columns
    const cols  = type === 'inventory' ? INVENTORY_COLS : CUSTOMER_COLS;
    const autoMap = {};
    const rawHeaders = Object.keys(data[0]).map(h => h.toLowerCase().replace(/\s+/g,'_'));
    cols.forEach(col => {
      const match = rawHeaders.find(h => h.includes(col) || col.includes(h));
      if (match) autoMap[col] = Object.keys(data[0])[rawHeaders.indexOf(match)];
    });
    setMapping(autoMap);
    setStep(2);
  }

  async function runImport() {
    setImporting(true);
    const cols    = type === 'inventory' ? INVENTORY_COLS : CUSTOMER_COLS;
    const mapped  = rows.map(row => {
      const obj = { tenant_id: tenant.id };
      cols.forEach(col => {
        const src = mapping[col];
        if (src && row[src] !== undefined && row[src] !== '') {
          if (['sp','cp','gst','stock','alert','credit_limit'].includes(col)) obj[col] = parseFloat(row[src])||0;
          else obj[col] = row[src];
        }
      });
      return obj;
    }).filter(r => r.name || r.phone);

    let imported=0, failed=0, errors=[];
    const table = type === 'inventory' ? 'inventory' : 'customers';
    const BATCH  = 50;

    for (let i=0; i<mapped.length; i+=BATCH) {
      const batch = mapped.slice(i, i+BATCH);
      const { error } = await supabase.from(table).upsert(batch, { onConflict: type==='inventory'?'tenant_id,name':'tenant_id,phone', ignoreDuplicates:false });
      if (error) { failed+=batch.length; errors.push(error.message); }
      else imported += batch.length;
    }

    // Log import
    await supabase.from('import_log').insert({ tenant_id:tenant.id, type, total:mapped.length, imported, failed, errors });
    setResult({ imported, failed, total:mapped.length, errors });
    setImporting(false);
    setStep(3);
  }

  const cols = type === 'inventory' ? INVENTORY_COLS : CUSTOMER_COLS;
  const inp  = { background:T.card, border:`1px solid ${T.bdr}`, borderRadius:7, padding:'6px 10px', color:T.ink, fontSize:12, fontFamily:'inherit', outline:'none', cursor:'pointer' };

  return (
    <div style={{ padding:20 }}>
      <div style={{ fontSize:22, fontWeight:800, color:T.ink, marginBottom:6 }}>Bulk Import</div>
      <div style={{ fontSize:13, color:T.sub, marginBottom:20 }}>Import inventory or customers from Excel or CSV</div>

      {/* Type selector */}
      <div style={{ display:'flex', gap:10, marginBottom:20 }}>
        {[['inventory','📦 Inventory'],['customers','👥 Customers']].map(([id,label])=>(
          <button key={id} onClick={()=>{ setType(id); setRows([]); setStep(1); setResult(null); }} style={{ background:type===id?T.blue:T.srf, color:type===id?'#fff':T.sub, border:`1px solid ${type===id?T.blue:T.bdr}`, borderRadius:8, padding:'9px 18px', fontSize:13, fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}>{label}</button>
        ))}
      </div>

      {/* Progress steps */}
      <div style={{ display:'flex', gap:0, marginBottom:24 }}>
        {['Upload File','Map Columns','Done'].map((label,i)=>(
          <div key={label} style={{ flex:1, display:'flex', alignItems:'center' }}>
            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
              <div style={{ width:28, height:28, borderRadius:'50%', background:step>i?T.blue:step===i+1?T.blue:T.bdr, color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:700 }}>{step>i+1?'✓':i+1}</div>
              <span style={{ fontSize:12, color:step===i+1?T.ink:T.muted }}>{label}</span>
            </div>
            {i<2&&<div style={{ flex:1, height:2, background:step>i+1?T.blue:T.bdr, margin:'0 10px' }}/>}
          </div>
        ))}
      </div>

      {/* Step 1: Upload */}
      {step === 1 && (
        <div>
          {/* Sample template */}
          <div style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:12, padding:20, marginBottom:16 }}>
            <div style={{ fontWeight:700, color:T.ink, marginBottom:10 }}>Sample Format ({type})</div>
            <pre style={{ background:T.card, borderRadius:8, padding:'12px 14px', fontSize:11, color:T.teal, fontFamily:'monospace', overflowX:'auto' }}>{type==='inventory'?SAMPLE_INVENTORY:SAMPLE_CUSTOMERS}</pre>
            <button onClick={()=>{
              const blob=new Blob([type==='inventory'?SAMPLE_INVENTORY:SAMPLE_CUSTOMERS],{type:'text/csv'});
              const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download=`sample_${type}.csv`; a.click(); URL.revokeObjectURL(url);
            }} style={{ background:T.blue+'22', color:T.blue, border:'none', borderRadius:7, padding:'7px 14px', fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:'inherit', marginTop:10 }}>
              ⬇️ Download Sample CSV
            </button>
          </div>

          {/* Drop zone */}
          <div onClick={()=>fileRef.current.click()} style={{ background:T.srf, border:`2px dashed ${T.bdr}`, borderRadius:12, padding:40, textAlign:'center', cursor:'pointer' }}
            onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();const f=e.dataTransfer.files[0];if(f){fileRef.current.files=e.dataTransfer.files;handleFile({target:{files:[f]}});}}}>
            <div style={{ fontSize:40, marginBottom:12 }}>📂</div>
            <div style={{ fontSize:15, fontWeight:600, color:T.ink, marginBottom:6 }}>Drop file here or click to browse</div>
            <div style={{ fontSize:12, color:T.muted }}>Supports .xlsx, .xls, .csv files</div>
            <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv,.txt" onChange={handleFile} style={{ display:'none' }} />
          </div>
        </div>
      )}

      {/* Step 2: Map columns */}
      {step === 2 && rows.length > 0 && (
        <div>
          <div style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:12, padding:20, marginBottom:16 }}>
            <div style={{ fontWeight:700, color:T.ink, marginBottom:14 }}>Map your columns to system fields</div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
              {cols.map(col=>(
                <div key={col} style={{ display:'flex', alignItems:'center', gap:10 }}>
                  <div style={{ width:110, fontSize:12, color:T.sub, textTransform:'capitalize', flexShrink:0 }}>{col.replace(/_/g,' ')}</div>
                  <select value={mapping[col]||''} onChange={e=>setMapping(m=>({...m,[col]:e.target.value}))} style={{ ...inp, flex:1 }}>
                    <option value="">— skip —</option>
                    {headers.map(h=><option key={h} value={h}>{h}</option>)}
                  </select>
                </div>
              ))}
            </div>
          </div>

          {/* Preview */}
          <div style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:12, overflow:'hidden', marginBottom:16 }}>
            <div style={{ padding:'10px 16px', borderBottom:`1px solid ${T.bdr}`, fontSize:13, fontWeight:700, color:T.ink }}>Preview ({Math.min(3,rows.length)} of {rows.length} rows)</div>
            <div style={{ overflowX:'auto' }}>
              <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
                <thead><tr style={{ background:T.card }}>{cols.filter(c=>mapping[c]).map(c=><th key={c} style={{ padding:'8px 12px', color:T.sub, textAlign:'left', fontWeight:700, fontSize:10, textTransform:'uppercase', borderBottom:`1px solid ${T.bdr}` }}>{c}</th>)}</tr></thead>
                <tbody>{rows.slice(0,3).map((row,i)=>(
                  <tr key={i} style={{ borderBottom:`1px solid ${T.bdr}22` }}>
                    {cols.filter(c=>mapping[c]).map(c=><td key={c} style={{ padding:'8px 12px', color:T.ink }}>{row[mapping[c]]||'—'}</td>)}
                  </tr>
                ))}</tbody>
              </table>
            </div>
          </div>

          <div style={{ display:'flex', gap:10 }}>
            <button onClick={()=>{setStep(1);setRows([]);}} style={{ flex:1, background:T.card, color:T.sub, border:`1px solid ${T.bdr}`, borderRadius:8, padding:'11px', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>← Back</button>
            <button onClick={runImport} disabled={importing} style={{ flex:2, background:T.green, color:'#fff', border:'none', borderRadius:8, padding:'11px', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>
              {importing ? `Importing ${rows.length} records…` : `Import ${rows.length} ${type} records`}
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Result */}
      {step === 3 && result && (
        <div style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:12, padding:32, textAlign:'center' }}>
          <div style={{ fontSize:48, marginBottom:16 }}>{result.failed===0?'✅':'⚠️'}</div>
          <div style={{ fontSize:20, fontWeight:800, color:T.ink, marginBottom:12 }}>Import Complete</div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12, maxWidth:360, margin:'0 auto 20px' }}>
            {[['Total',result.total,T.blue],['Imported',result.imported,T.green],['Failed',result.failed,T.red]].map(([label,val,color])=>(
              <div key={label} style={{ background:T.card, borderRadius:9, padding:'12px' }}>
                <div style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', marginBottom:4 }}>{label}</div>
                <div style={{ fontSize:22, fontWeight:800, color }}>{val}</div>
              </div>
            ))}
          </div>
          {result.errors.length > 0 && <div style={{ background:T.red+'18', borderRadius:8, padding:'10px 14px', fontSize:12, color:T.red, marginBottom:16, textAlign:'left' }}>{result.errors[0]}</div>}
          <button onClick={()=>{setStep(1);setRows([]);setResult(null);}} style={{ background:T.blue, color:'#fff', border:'none', borderRadius:8, padding:'11px 24px', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>Import Another File</button>
        </div>
      )}
    </div>
  );
}
