import { useState, useRef } from 'react';
import { supabase } from '../lib/supabase';

const T = {
  bg:'#F7F3F3', srf:'#FFFFFF', card:'#FFFFFF', bdr:'#E8DEDE',
  red:'#C0392B', darkRed:'#8B0000', lightRed:'#FEF2F2',
  green:'#16A34A', amber:'#D97706', blue:'#2563EB', purple:'#7C3AED',
  ink:'#111827', sub:'#6B7280', muted:'#9CA3AF', white:'#FFFFFF'
};
const fmt = n => 'Rs.' + (n||0).toLocaleString('en-IN', { maximumFractionDigits:2 });
const btn = (bg,color,extra={}) => ({ background:bg, color, border:'none', borderRadius:8, padding:'9px 16px', fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:'inherit', ...extra });
const inp = { background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:8, padding:'9px 12px', color:T.ink, fontSize:13, fontFamily:'inherit', outline:'none', width:'100%' };

const EXTRACT_PROMPT = `You are reading a supplier purchase bill/invoice from an Indian retail shop.
Extract the data and respond with ONLY a JSON object, no markdown fences, no explanation.

Schema:
{
  "supplier": "supplier/vendor name",
  "gstin": "supplier GSTIN if visible, else empty string",
  "invoice_no": "invoice/bill number",
  "invoice_date": "YYYY-MM-DD",
  "items": [
    { "name": "product name", "qty": number, "rate": number, "gst": number, "amount": number }
  ],
  "subtotal": number,
  "gst_total": number,
  "total": number,
  "confidence": "high" | "medium" | "low"
}

Rules:
- All amounts in Indian Rupees as plain numbers, no symbols or commas.
- gst is the GST percentage for that line (e.g. 5, 12, 18), 0 if unknown.
- If a field is unreadable, use an empty string for text or 0 for numbers.
- Set confidence to "low" if the image is blurry or key fields are unclear.`;

export default function BillScanner({ tenant }) {
  const [image,    setImage]    = useState(null);
  const [preview,  setPreview]  = useState(null);
  const [scanning, setScanning] = useState(false);
  const [result,   setResult]   = useState(null);
  const [error,    setError]    = useState(null);
  const [saving,   setSaving]   = useState(false);
  const [saved,    setSaved]    = useState(null);
  const fileRef = useRef(null);
  const camRef  = useRef(null);

  function onFile(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 5*1024*1024) { setError('Image is larger than 5MB. Please use a smaller photo.'); return; }
    setError(null); setResult(null); setSaved(null);
    setImage(f);
    const r = new FileReader();
    r.onload = () => setPreview(r.result);
    r.readAsDataURL(f);
  }

  async function scan() {
    if (!image) return;
    setScanning(true); setError(null); setResult(null);
    try {
      const b64 = await new Promise((res, rej) => {
        const r = new FileReader();
        r.onload  = () => res(r.result.split(',')[1]);
        r.onerror = () => rej(new Error('Could not read the image'));
        r.readAsDataURL(image);
      });

      const resp = await fetch('https://api.anthropic.com/v1/messages', {
        method:'POST',
        headers:{ 'Content-Type':'application/json' },
        body: JSON.stringify({
          model:'claude-sonnet-4-6',
          max_tokens:1500,
          messages:[{
            role:'user',
            content:[
              { type:'image', source:{ type:'base64', media_type:image.type||'image/jpeg', data:b64 } },
              { type:'text',  text:EXTRACT_PROMPT },
            ],
          }],
        }),
      });

      if (!resp.ok) {
        const e = await resp.json().catch(()=>({}));
        throw new Error(e.error?.message || `API returned ${resp.status}`);
      }

      const data = await resp.json();
      const text = (data.content||[]).filter(x=>x.type==='text').map(x=>x.text).join('');
      const clean = text.replace(/```json/gi,'').replace(/```/g,'').trim();
      const parsed = JSON.parse(clean);
      parsed.items = (parsed.items||[]).map(i=>({
        name:  i.name || '',
        qty:   parseFloat(i.qty)   || 1,
        rate:  parseFloat(i.rate)  || 0,
        gst:   parseFloat(i.gst)   || 0,
        amount:parseFloat(i.amount)|| (parseFloat(i.qty)||1)*(parseFloat(i.rate)||0),
      }));
      setResult(parsed);
    } catch (e) {
      setError(e.message.includes('JSON')
        ? 'Could not read the bill clearly. Try a sharper, well-lit photo taken straight on.'
        : e.message);
    }
    setScanning(false);
  }

  function updItem(i, field, val) {
    setResult(r => {
      const items = r.items.map((it,j)=>{
        if (j!==i) return it;
        const u = { ...it, [field]: field==='name' ? val : (parseFloat(val)||0) };
        u.amount = u.qty * u.rate;
        return u;
      });
      const subtotal = items.reduce((s,x)=>s+x.amount,0);
      return { ...r, items, subtotal, total:subtotal };
    });
  }

  async function savePurchase() {
    if (!result) return;
    setSaving(true);
    const poNum = `PO/${new Date().getFullYear()}/${String(Date.now()).slice(-5)}`;
    const total = result.items.reduce((s,i)=>s+(i.amount||0),0);
    const { data, error:err } = await supabase.from('purchases').insert({
      tenant_id: tenant.id,
      po_number: poNum,
      supplier:  result.supplier || 'Unknown Supplier',
      items:     result.items,
      total,
      date:      result.invoice_date || new Date().toISOString().slice(0,10),
      status:    'received',
      notes:     `Scanned from bill ${result.invoice_no||''}`.trim(),
    }).select().single();

    if (err) { setError('Could not save: '+err.message); setSaving(false); return; }
    setSaved({ po:poNum, id:data?.id });
    setSaving(false);
  }

  function reset() {
    setImage(null); setPreview(null); setResult(null); setError(null); setSaved(null);
    if (fileRef.current) fileRef.current.value='';
    if (camRef.current)  camRef.current.value='';
  }

  const total = result ? result.items.reduce((s,i)=>s+(i.amount||0),0) : 0;
  const confColor = result?.confidence==='high' ? T.green : result?.confidence==='medium' ? T.amber : T.red;

  return (
    <div style={{ padding:24, background:T.bg, minHeight:'100%' }}>
      <div style={{ marginBottom:20 }}>
        <div style={{ fontSize:18, fontWeight:800, color:T.darkRed }}>📸 Bill Scanner</div>
        <div style={{ fontSize:12, color:T.sub, marginTop:2 }}>Photograph a supplier bill — AI reads it and creates the purchase entry</div>
      </div>

      {saved&&(
        <div style={{ background:'#F0FDF4', border:'1px solid #BBF7D0', borderRadius:12, padding:'16px 20px', marginBottom:18, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <div>
            <div style={{ fontSize:14, fontWeight:800, color:T.green }}>✅ Purchase created — {saved.po}</div>
            <div style={{ fontSize:12, color:T.sub, marginTop:2 }}>Find it under Purchases → Purchase History. Receive stock via Goods Receipt.</div>
          </div>
          <button onClick={reset} style={btn(T.green, T.white)}>Scan Another</button>
        </div>
      )}

      <div style={{ display:'grid', gridTemplateColumns: result?'380px 1fr':'1fr', gap:18, alignItems:'flex-start' }}>

        {/* ── Upload panel ─────────────────────────────── */}
        <div style={{ background:T.white, border:`1px solid ${T.bdr}`, borderRadius:14, padding:20, boxShadow:'0 1px 4px rgba(0,0,0,.05)' }}>
          {!preview?(
            <>
              <div style={{ border:`2px dashed ${T.bdr}`, borderRadius:12, padding:'40px 20px', textAlign:'center', marginBottom:14 }}>
                <div style={{ fontSize:44, marginBottom:10 }}>📄</div>
                <div style={{ fontSize:14, fontWeight:700, color:T.ink, marginBottom:4 }}>Upload or photograph a bill</div>
                <div style={{ fontSize:12, color:T.muted }}>JPG or PNG · up to 5MB · shoot straight on with good light</div>
              </div>
              <div style={{ display:'flex', gap:10 }}>
                <button onClick={()=>camRef.current?.click()} style={{ flex:1, ...btn(T.red, T.white, { padding:'12px' }) }}>📷 Take Photo</button>
                <button onClick={()=>fileRef.current?.click()} style={{ flex:1, ...btn(T.bg, T.sub, { padding:'12px', border:`1px solid ${T.bdr}` }) }}>📁 Choose File</button>
              </div>
              <input ref={camRef}  type="file" accept="image/*" capture="environment" onChange={onFile} style={{ display:'none' }}/>
              <input ref={fileRef} type="file" accept="image/*" onChange={onFile} style={{ display:'none' }}/>
            </>
          ):(
            <>
              <div style={{ position:'relative', marginBottom:14 }}>
                <img src={preview} alt="Bill" style={{ width:'100%', borderRadius:10, border:`1px solid ${T.bdr}`, maxHeight:340, objectFit:'contain', background:T.bg }}/>
                <button onClick={reset} style={{ position:'absolute', top:8, right:8, background:'rgba(0,0,0,.65)', color:'#fff', border:'none', borderRadius:8, width:30, height:30, cursor:'pointer', fontSize:16 }}>×</button>
              </div>
              {!result&&<button onClick={scan} disabled={scanning} style={{ width:'100%', ...btn(T.red, T.white, { padding:'13px', fontSize:14 }) }}>
                {scanning?'🔍 Reading the bill…':'🔍 Scan & Extract'}
              </button>}
              {scanning&&<div style={{ fontSize:11, color:T.muted, textAlign:'center', marginTop:8 }}>This usually takes 5–10 seconds</div>}
            </>
          )}

          {error&&<div style={{ background:'#FEF2F2', border:'1px solid #FECACA', borderRadius:9, padding:'11px 14px', marginTop:14, fontSize:12, color:T.red }}>
            ⚠️ {error}
            {error.includes('API')&&<div style={{ marginTop:6, fontSize:11, color:T.sub }}>Set <code>VITE_ANTHROPIC_API_KEY</code> in your Vercel environment variables.</div>}
          </div>}

          <div style={{ marginTop:16, paddingTop:14, borderTop:`1px solid ${T.bdr}` }}>
            <div style={{ fontSize:10, fontWeight:700, color:T.sub, textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:7 }}>Tips for a good scan</div>
            {['Lay the bill flat, avoid folds','Shoot straight down, not at an angle','Make sure all line items are visible','Avoid shadows and glare'].map(t=>(
              <div key={t} style={{ fontSize:11, color:T.sub, padding:'2px 0' }}>• {t}</div>
            ))}
          </div>
        </div>

        {/* ── Extracted data ───────────────────────────── */}
        {result&&(
          <div style={{ background:T.white, border:`1px solid ${T.bdr}`, borderRadius:14, overflow:'hidden', boxShadow:'0 1px 4px rgba(0,0,0,.05)' }}>
            <div style={{ padding:'14px 20px', background:T.lightRed, borderBottom:`1px solid ${T.bdr}`, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <div>
                <div style={{ fontSize:14, fontWeight:800, color:T.darkRed }}>Extracted Data</div>
                <div style={{ fontSize:11, color:T.sub, marginTop:2 }}>Check every field before saving — edit anything that looks wrong</div>
              </div>
              <span style={{ background:T.white, color:confColor, border:`1px solid ${confColor}44`, borderRadius:20, padding:'3px 12px', fontSize:10, fontWeight:700, textTransform:'uppercase' }}>
                {result.confidence||'medium'} confidence
              </span>
            </div>

            <div style={{ padding:'16px 20px' }}>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12, marginBottom:16 }}>
                {[['Supplier','supplier'],['GSTIN','gstin'],['Invoice No','invoice_no'],['Invoice Date','invoice_date']].map(([label,key])=>(
                  <div key={key}>
                    <label style={{ fontSize:9, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:4 }}>{label}</label>
                    <input type={key==='invoice_date'?'date':'text'} value={result[key]||''} onChange={e=>setResult(r=>({...r,[key]:e.target.value}))}
                      style={{ ...inp, padding:'7px 10px', fontSize:12 }}/>
                  </div>
                ))}
              </div>

              <div style={{ fontSize:10, fontWeight:700, color:T.sub, textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:8 }}>
                Line Items ({result.items.length})
              </div>
              <div style={{ background:T.bg, borderRadius:10, overflow:'hidden', marginBottom:14 }}>
                <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
                  <thead><tr style={{ background:T.lightRed }}>
                    {['Product','Qty','Rate','GST %','Amount',''].map(h=>(
                      <th key={h} style={{ padding:'8px 10px', textAlign:'left', fontSize:9, color:T.darkRed, fontWeight:700, textTransform:'uppercase' }}>{h}</th>
                    ))}
                  </tr></thead>
                  <tbody>
                    {result.items.map((it,i)=>(
                      <tr key={i} style={{ borderBottom:`1px solid ${T.bdr}22` }}>
                        <td style={{ padding:'4px 6px' }}>
                          <input value={it.name} onChange={e=>updItem(i,'name',e.target.value)}
                            style={{ width:'100%', background:T.white, border:`1px solid ${it.name?T.bdr:'#FECACA'}`, borderRadius:5, padding:'5px 8px', fontSize:12, fontFamily:'inherit', outline:'none' }}/>
                        </td>
                        {['qty','rate','gst'].map(f=>(
                          <td key={f} style={{ padding:'4px 5px' }}>
                            <input type="number" value={it[f]} onChange={e=>updItem(i,f,e.target.value)}
                              style={{ width:70, background:T.white, border:`1px solid ${T.bdr}`, borderRadius:5, padding:'5px 7px', fontSize:12, textAlign:'center', fontFamily:'inherit', outline:'none' }}/>
                          </td>
                        ))}
                        <td style={{ padding:'8px 10px', color:T.red, fontWeight:700 }}>{fmt(it.amount)}</td>
                        <td style={{ padding:'4px 6px' }}>
                          <button onClick={()=>setResult(r=>({...r, items:r.items.filter((_,j)=>j!==i)}))}
                            style={{ background:'#FEF2F2', color:T.red, border:'none', borderRadius:5, padding:'4px 9px', cursor:'pointer', fontFamily:'inherit' }}>×</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div style={{ padding:'10px 14px', background:T.lightRed, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                  <button onClick={()=>setResult(r=>({...r, items:[...r.items,{name:'',qty:1,rate:0,gst:0,amount:0}]}))}
                    style={btn(T.white, T.red, { padding:'5px 12px', fontSize:11, border:`1px solid ${T.bdr}` })}>+ Add Line</button>
                  <div style={{ display:'flex', gap:20, fontSize:12 }}>
                    {result.gst_total>0&&<span style={{ color:T.sub }}>GST on bill: {fmt(result.gst_total)}</span>}
                    <span style={{ color:T.red, fontWeight:800, fontSize:15 }}>Total: {fmt(total)}</span>
                  </div>
                </div>
              </div>

              {result.total&&Math.abs(result.total-total)>1&&(
                <div style={{ background:'#FFFBEB', border:'1px solid #FDE68A', borderRadius:9, padding:'10px 14px', marginBottom:14, fontSize:12, color:T.amber }}>
                  ⚠️ Bill total reads {fmt(result.total)} but line items add to {fmt(total)} — difference of {fmt(Math.abs(result.total-total))}. Check for a missed line.
                </div>
              )}

              <div style={{ display:'flex', gap:10 }}>
                <button onClick={reset} style={{ flex:1, ...btn(T.bg, T.sub, { padding:'12px', border:`1px solid ${T.bdr}` }) }}>Discard</button>
                <button onClick={savePurchase} disabled={saving||!result.items.length} style={{ flex:2, ...btn(T.red, T.white, { padding:'12px', fontSize:13 }) }}>
                  {saving?'Saving…':`💾 Create Purchase — ${fmt(total)}`}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
