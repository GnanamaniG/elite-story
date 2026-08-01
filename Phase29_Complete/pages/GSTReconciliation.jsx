import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

const T = {
  bg:'#F7F3F3', srf:'#FFFFFF', card:'#FFFFFF', bdr:'#E8DEDE',
  red:'#C0392B', darkRed:'#8B0000', lightRed:'#FEF2F2',
  green:'#16A34A', amber:'#D97706', blue:'#2563EB', purple:'#7C3AED',
  ink:'#111827', sub:'#6B7280', muted:'#9CA3AF', white:'#FFFFFF'
};
const fmt = n => 'Rs.' + Math.abs(n||0).toLocaleString('en-IN', { maximumFractionDigits:0 });
const btn = (bg,color,extra={}) => ({ background:bg, color, border:'none', borderRadius:8, padding:'9px 16px', fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:'inherit', ...extra });
const inp = { background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:8, padding:'9px 12px', color:T.ink, fontSize:13, fontFamily:'inherit', outline:'none', width:'100%' };

const MATCH = {
  matched:     { label:'Matched',      color:'#16A34A', bg:'#F0FDF4', bdr:'#BBF7D0', icon:'✅' },
  mismatched:  { label:'Mismatch',     color:'#D97706', bg:'#FFFBEB', bdr:'#FDE68A', icon:'⚠️' },
  books_only:  { label:'Books Only',   color:'#C0392B', bg:'#FEF2F2', bdr:'#FECACA', icon:'📕' },
  portal_only: { label:'Portal Only',  color:'#7C3AED', bg:'#F5F3FF', bdr:'#DDD6FE', icon:'🌐' },
  unmatched:   { label:'Unmatched',    color:'#6B7280', bg:'#F9FAFB', bdr:'#E5E7EB', icon:'❓' },
};

export default function GSTReconciliation({ tenant }) {
  const [records,  setRecords]  = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [importing,setImporting]= useState(false);
  const [period,   setPeriod]   = useState(new Date().toISOString().slice(0,7));
  const [filter,   setFilter]   = useState('all');
  const [showForm, setShowForm] = useState(false);
  const [saving,   setSaving]   = useState(false);
  const [form, setForm] = useState({ supplier_name:'', supplier_gstin:'', invoice_no:'', invoice_date:'', portal_taxable:'', portal_igst:'', portal_cgst:'', portal_sgst:'' });

  useEffect(() => { if (tenant?.id) load(); }, [tenant?.id, period]);

  async function load() {
    setLoading(true);
    const { data } = await supabase.from('gst_reconciliation').select('*').eq('tenant_id', tenant.id).eq('period', period).order('match_status');
    setRecords(data||[]);
    setLoading(false);
  }

  async function importFromBooks() {
    setImporting(true);
    const monthStart = period+'-01';
    const monthEnd   = new Date(parseInt(period.split('-')[0]), parseInt(period.split('-')[1]), 0).toISOString().slice(0,10);
    const { data:purchases } = await supabase.from('purchases').select('po_number,supplier,total,date,items').eq('tenant_id', tenant.id).gte('date', monthStart).lte('date', monthEnd);

    const rows = (purchases||[]).map(p=>{
      const taxable = (p.total||0) / 1.18; // assume 18% inclusive
      const gst     = (p.total||0) - taxable;
      return {
        tenant_id: tenant.id, period,
        supplier_name: p.supplier || 'Unknown',
        invoice_no: p.po_number || '—',
        invoice_date: p.date,
        books_taxable: parseFloat(taxable.toFixed(2)),
        books_cgst: parseFloat((gst/2).toFixed(2)),
        books_sgst: parseFloat((gst/2).toFixed(2)),
        books_igst: 0,
        match_status: 'books_only',
        difference: parseFloat(gst.toFixed(2)),
      };
    });

    await supabase.from('gst_reconciliation').delete().eq('tenant_id', tenant.id).eq('period', period).eq('match_status','books_only');
    if (rows.length>0) await supabase.from('gst_reconciliation').insert(rows);
    setImporting(false); await load();
    alert(`✅ Imported ${rows.length} purchase invoices from books`);
  }

  async function addPortalEntry(e) {
    e.preventDefault(); setSaving(true);
    // Try to match against an existing books entry
    const match = records.find(r=>r.invoice_no===form.invoice_no&&r.supplier_name.toLowerCase()===form.supplier_name.toLowerCase());
    const pTax  = parseFloat(form.portal_taxable)||0;
    const pCgst = parseFloat(form.portal_cgst)||0;
    const pSgst = parseFloat(form.portal_sgst)||0;
    const pIgst = parseFloat(form.portal_igst)||0;
    const pTotal= pCgst+pSgst+pIgst;

    if (match) {
      const bTotal = (match.books_cgst||0)+(match.books_sgst||0)+(match.books_igst||0);
      const diff   = bTotal - pTotal;
      await supabase.from('gst_reconciliation').update({
        supplier_gstin:form.supplier_gstin, portal_taxable:pTax,
        portal_cgst:pCgst, portal_sgst:pSgst, portal_igst:pIgst,
        difference:parseFloat(diff.toFixed(2)),
        match_status: Math.abs(diff)<1 ? 'matched' : 'mismatched',
      }).eq('id', match.id);
    } else {
      await supabase.from('gst_reconciliation').insert({
        tenant_id:tenant.id, period, ...form,
        portal_taxable:pTax, portal_cgst:pCgst, portal_sgst:pSgst, portal_igst:pIgst,
        difference:-pTotal, match_status:'portal_only',
        invoice_date:form.invoice_date||null,
      });
    }
    setShowForm(false);
    setForm({ supplier_name:'', supplier_gstin:'', invoice_no:'', invoice_date:'', portal_taxable:'', portal_igst:'', portal_cgst:'', portal_sgst:'' });
    setSaving(false); await load();
  }

  async function resolve(id) {
    const action = prompt('Action taken to resolve:');
    if (action===null) return;
    await supabase.from('gst_reconciliation').update({ resolved:true, action_taken:action }).eq('id', id);
    setRecords(prev=>prev.map(r=>r.id===id?{...r,resolved:true,action_taken:action}:r));
  }

  const displayed  = filter==='all'?records:records.filter(r=>r.match_status===filter);
  const booksITC   = records.reduce((s,r)=>s+(r.books_cgst||0)+(r.books_sgst||0)+(r.books_igst||0),0);
  const portalITC  = records.reduce((s,r)=>s+(r.portal_cgst||0)+(r.portal_sgst||0)+(r.portal_igst||0),0);
  const itcAtRisk  = records.filter(r=>r.match_status==='books_only'&&!r.resolved).reduce((s,r)=>s+(r.books_cgst||0)+(r.books_sgst||0)+(r.books_igst||0),0);
  const counts     = Object.keys(MATCH).reduce((a,k)=>({ ...a, [k]:records.filter(r=>r.match_status===k).length }), {});

  return (
    <div style={{ padding:24, background:T.bg, minHeight:'100%' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
        <div>
          <div style={{ fontSize:18, fontWeight:800, color:T.darkRed }}>🔍 GST Reconciliation (GSTR-2B)</div>
          <div style={{ fontSize:12, color:T.sub, marginTop:2 }}>Match purchase books against GST portal to protect ITC claims</div>
        </div>
        <div style={{ display:'flex', gap:8, alignItems:'center' }}>
          <input type="month" value={period} onChange={e=>setPeriod(e.target.value)} style={{ background:T.white, border:`1px solid ${T.bdr}`, borderRadius:8, padding:'8px 12px', color:T.ink, fontSize:12, fontFamily:'inherit', outline:'none' }}/>
          <button onClick={importFromBooks} disabled={importing} style={btn(T.lightRed, T.red, { border:`1px solid ${T.bdr}` })}>{importing?'Importing…':'📕 Import Books'}</button>
          <button onClick={()=>setShowForm(true)} style={btn(T.red, T.white)}>+ Portal Entry</button>
        </div>
      </div>

      {itcAtRisk>0&&<div style={{ background:'#FEF2F2', border:'1px solid #FECACA', borderRadius:10, padding:'11px 16px', marginBottom:16 }}>
        <span style={{ fontSize:13, fontWeight:600, color:T.red }}>🚨 <strong>{fmt(itcAtRisk)}</strong> ITC at risk — {counts.books_only} invoices in your books not appearing in GSTR-2B. Follow up with suppliers.</span>
      </div>}

      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:14, marginBottom:18 }}>
        {[['ITC in Books',fmt(booksITC),T.blue,'📕'],['ITC on Portal',fmt(portalITC),T.purple,'🌐'],['Difference',fmt(booksITC-portalITC),Math.abs(booksITC-portalITC)<1?T.green:T.amber,'⚖️'],['ITC at Risk',fmt(itcAtRisk),T.red,'🚨']].map(([label,val,color,icon])=>(
          <div key={label} style={{ background:T.white, border:`1px solid ${T.bdr}`, borderRadius:12, padding:'16px 18px', boxShadow:'0 1px 4px rgba(0,0,0,.05)' }}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:6 }}>
              <div style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.05em' }}>{label}</div>
              <span style={{ fontSize:18 }}>{icon}</span>
            </div>
            <div style={{ fontSize:19, fontWeight:900, color, letterSpacing:'-0.02em' }}>{val}</div>
          </div>
        ))}
      </div>

      <div style={{ display:'flex', gap:6, marginBottom:14, flexWrap:'wrap' }}>
        <button onClick={()=>setFilter('all')} style={{ padding:'6px 14px', background:filter==='all'?T.red:T.white, color:filter==='all'?T.white:T.sub, border:`1px solid ${filter==='all'?T.red:T.bdr}`, borderRadius:20, fontSize:11, fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}>All ({records.length})</button>
        {Object.entries(MATCH).map(([k,v])=>(
          <button key={k} onClick={()=>setFilter(k)} style={{ padding:'6px 14px', background:filter===k?T.red:T.white, color:filter===k?T.white:T.sub, border:`1px solid ${filter===k?T.red:T.bdr}`, borderRadius:20, fontSize:11, fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}>
            {v.icon} {v.label} ({counts[k]||0})
          </button>
        ))}
      </div>

      <div style={{ background:T.white, border:`1px solid ${T.bdr}`, borderRadius:14, overflow:'hidden', boxShadow:'0 1px 4px rgba(0,0,0,.05)' }}>
        <table style={{ width:'100%', borderCollapse:'collapse', fontSize:11 }}>
          <thead>
            <tr style={{ background:T.lightRed }}>
              <th rowSpan={2} style={{ padding:'8px 10px', textAlign:'left', fontSize:9, color:T.darkRed, fontWeight:700, textTransform:'uppercase', borderBottom:`1px solid ${T.bdr}` }}>Supplier</th>
              <th rowSpan={2} style={{ padding:'8px 10px', textAlign:'left', fontSize:9, color:T.darkRed, fontWeight:700, textTransform:'uppercase', borderBottom:`1px solid ${T.bdr}` }}>Invoice</th>
              <th colSpan={2} style={{ padding:'6px 10px', textAlign:'center', fontSize:9, color:T.blue, fontWeight:700, textTransform:'uppercase', borderBottom:`1px solid ${T.bdr}`, background:'#EFF6FF' }}>📕 Books</th>
              <th colSpan={2} style={{ padding:'6px 10px', textAlign:'center', fontSize:9, color:T.purple, fontWeight:700, textTransform:'uppercase', borderBottom:`1px solid ${T.bdr}`, background:'#F5F3FF' }}>🌐 Portal</th>
              <th rowSpan={2} style={{ padding:'8px 10px', textAlign:'right', fontSize:9, color:T.darkRed, fontWeight:700, textTransform:'uppercase', borderBottom:`1px solid ${T.bdr}` }}>Diff</th>
              <th rowSpan={2} style={{ padding:'8px 10px', textAlign:'left', fontSize:9, color:T.darkRed, fontWeight:700, textTransform:'uppercase', borderBottom:`1px solid ${T.bdr}` }}>Status</th>
              <th rowSpan={2} style={{ padding:'8px 10px', textAlign:'left', fontSize:9, color:T.darkRed, fontWeight:700, textTransform:'uppercase', borderBottom:`1px solid ${T.bdr}` }}>Action</th>
            </tr>
            <tr style={{ background:T.lightRed }}>
              {['Taxable','GST','Taxable','GST'].map((h,i)=>(
                <th key={i} style={{ padding:'5px 10px', textAlign:'right', fontSize:9, color:i<2?T.blue:T.purple, fontWeight:600, borderBottom:`1px solid ${T.bdr}`, background:i<2?'#EFF6FF':'#F5F3FF' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading?<tr><td colSpan={9} style={{ textAlign:'center', padding:50, color:T.muted }}>Loading…</td></tr>
            :displayed.length===0?<tr><td colSpan={9} style={{ textAlign:'center', padding:50 }}>
              <div style={{ fontSize:36, marginBottom:8 }}>🔍</div>
              <div style={{ color:T.muted, fontWeight:600 }}>No reconciliation data</div>
              <div style={{ color:T.muted, fontSize:11, marginTop:4 }}>Click "Import Books" to load purchase invoices, then add portal entries</div>
            </td></tr>
            :displayed.map(r=>{
              const m = MATCH[r.match_status]||MATCH.unmatched;
              const booksGst  = (r.books_cgst||0)+(r.books_sgst||0)+(r.books_igst||0);
              const portalGst = (r.portal_cgst||0)+(r.portal_sgst||0)+(r.portal_igst||0);
              return (
                <tr key={r.id} style={{ borderBottom:`1px solid ${T.bdr}22`, background:r.resolved?'#FAFDFA':'transparent', opacity:r.resolved?.7:1 }}>
                  <td style={{ padding:'9px 10px', color:T.ink, fontWeight:600 }}>{r.supplier_name}{r.supplier_gstin&&<div style={{ fontSize:9, color:T.muted, fontFamily:'monospace' }}>{r.supplier_gstin}</div>}</td>
                  <td style={{ padding:'9px 10px', color:T.sub, fontFamily:'monospace', fontSize:10 }}>{r.invoice_no}<div style={{ fontSize:9, color:T.muted }}>{r.invoice_date}</div></td>
                  <td style={{ padding:'9px 10px', textAlign:'right', color:T.sub, background:'#FBFCFF' }}>{r.books_taxable?fmt(r.books_taxable):'—'}</td>
                  <td style={{ padding:'9px 10px', textAlign:'right', color:T.blue, fontWeight:600, background:'#FBFCFF' }}>{booksGst?fmt(booksGst):'—'}</td>
                  <td style={{ padding:'9px 10px', textAlign:'right', color:T.sub, background:'#FDFBFF' }}>{r.portal_taxable?fmt(r.portal_taxable):'—'}</td>
                  <td style={{ padding:'9px 10px', textAlign:'right', color:T.purple, fontWeight:600, background:'#FDFBFF' }}>{portalGst?fmt(portalGst):'—'}</td>
                  <td style={{ padding:'9px 10px', textAlign:'right', fontWeight:700, color:Math.abs(r.difference||0)<1?T.green:T.red }}>{r.difference?fmt(r.difference):'—'}</td>
                  <td style={{ padding:'9px 10px' }}><span style={{ background:m.bg, color:m.color, border:`1px solid ${m.bdr}`, borderRadius:5, padding:'2px 8px', fontSize:9, fontWeight:700, whiteSpace:'nowrap' }}>{m.icon} {m.label}</span></td>
                  <td style={{ padding:'9px 10px' }}>
                    {r.resolved
                      ? <span style={{ fontSize:9, color:T.green, fontWeight:700 }}>✓ {r.action_taken?.slice(0,18)}</span>
                      : r.match_status!=='matched'&&<button onClick={()=>resolve(r.id)} style={{ background:T.lightRed, color:T.red, border:'none', borderRadius:5, padding:'3px 9px', fontSize:9, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>Resolve</button>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {showForm&&(
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.5)', zIndex:200, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
          <div style={{ background:T.white, borderRadius:16, padding:28, width:'100%', maxWidth:480, boxShadow:'0 20px 60px rgba(0,0,0,.2)' }}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:6 }}>
              <div style={{ fontSize:17, fontWeight:800, color:T.darkRed }}>Add GSTR-2B Portal Entry</div>
              <button onClick={()=>setShowForm(false)} style={{ background:'none', border:'none', fontSize:22, cursor:'pointer', color:T.muted }}>×</button>
            </div>
            <div style={{ fontSize:11, color:T.sub, marginBottom:18 }}>Enter values as shown in your GST portal GSTR-2B download. Matching invoices will auto-reconcile.</div>
            <form onSubmit={addPortalEntry}>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                {[['Supplier Name *','text','supplier_name'],['Supplier GSTIN','text','supplier_gstin'],['Invoice No *','text','invoice_no'],['Invoice Date','date','invoice_date'],['Taxable Value','number','portal_taxable'],['IGST','number','portal_igst'],['CGST','number','portal_cgst'],['SGST','number','portal_sgst']].map(([label,type,key])=>(
                  <div key={key}><label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:4 }}>{label}</label><input type={type} value={form[key]} onChange={e=>setForm(f=>({...f,[key]:e.target.value}))} required={label.includes('*')} style={inp}/></div>
                ))}
              </div>
              <div style={{ display:'flex', gap:10, marginTop:20 }}>
                <button type="button" onClick={()=>setShowForm(false)} style={{ flex:1, background:T.bg, color:T.sub, border:`1px solid ${T.bdr}`, borderRadius:9, padding:'12px', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>Cancel</button>
                <button type="submit" disabled={saving} style={{ flex:2, ...btn(T.red, T.white), padding:'12px', fontSize:13 }}>{saving?'Matching…':'🔍 Add & Match'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
