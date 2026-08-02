import { useState, useEffect } from 'react';
import { canSee } from '../lib/roleAccess';
import { supabase } from '../lib/supabase';

const T = {
  bg:'#F7F3F3', srf:'#FFFFFF', card:'#FFFFFF', bdr:'#E8DEDE',
  red:'#C0392B', darkRed:'#8B0000', lightRed:'#FEF2F2',
  green:'#16A34A', amber:'#D97706', blue:'#2563EB', purple:'#7C3AED',
  ink:'#111827', sub:'#6B7280', muted:'#9CA3AF', white:'#FFFFFF'
};
const fmt = n => 'Rs.' + (n||0).toLocaleString('en-IN', { maximumFractionDigits:0 });
const btn = (bg,color,extra={}) => ({ background:bg, color, border:'none', borderRadius:8, padding:'9px 16px', fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:'inherit', ...extra });
const inp = { background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:8, padding:'9px 12px', color:T.ink, fontSize:13, fontFamily:'inherit', outline:'none', width:'100%' };

const QC = {
  pending: { label:'QC Pending', color:'#6B7280', bg:'#F9FAFB', bdr:'#E5E7EB' },
  passed:  { label:'QC Passed',  color:'#16A34A', bg:'#F0FDF4', bdr:'#BBF7D0' },
  partial: { label:'QC Partial', color:'#D97706', bg:'#FFFBEB', bdr:'#FDE68A' },
  failed:  { label:'QC Failed',  color:'#C0392B', bg:'#FEF2F2', bdr:'#FECACA' },
};

export default function GoodsReceiptNote({ tenant, role='owner' }) {
  const showCost = canSee(role, 'costPrice');
  const [grns,      setGrns]      = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [showForm,  setShowForm]  = useState(false);
  const [saving,    setSaving]    = useState(false);
  const [selGrn,    setSelGrn]    = useState(null);
  const [filter,    setFilter]    = useState('all');
  const [items,     setItems]     = useState([]);
  const [form, setForm] = useState({ purchase_id:'', po_number:'', supplier:'', invoice_no:'', invoice_date:new Date().toISOString().slice(0,10), received_by:'', qc_status:'pending', qc_notes:'', notes:'' });

  useEffect(() => { if (tenant?.id) load(); }, [tenant?.id]);

  async function load() {
    setLoading(true);
    const [gRes, pRes] = await Promise.all([
      supabase.from('goods_receipts').select('*').eq('tenant_id', tenant.id).order('created_at', { ascending:false }),
      supabase.from('purchases').select('id,po_number,supplier,items,total,date,status').eq('tenant_id', tenant.id).order('date', { ascending:false }).limit(60),
    ]);
    setGrns(gRes.data||[]);
    setPurchases(pRes.data||[]);
    setLoading(false);
  }

  function genNo() { return `GRN/${new Date().getFullYear()}/${String(Date.now()).slice(-5)}`; }

  function loadPO(poId) {
    const po = purchases.find(p=>p.id===poId);
    if (!po) return;
    setForm(f=>({ ...f, purchase_id:po.id, po_number:po.po_number, supplier:po.supplier }));
    setItems((po.items||[]).map(i=>({
      name:i.name, code:i.code||'', ordered:i.qty||0,
      received:i.qty||0, rejected:0, rate:i.rate||i.cp||0, batch_no:'', expiry:'',
    })));
  }

  function updItem(idx, field, val) {
    setItems(prev=>prev.map((it,i)=>i===idx?{ ...it, [field]: field==='batch_no'||field==='expiry' ? val : (parseInt(val)||0) }:it));
  }

  const totOrdered  = items.reduce((s,i)=>s+(i.ordered||0),0);
  const totReceived = items.reduce((s,i)=>s+(i.received||0),0);
  const totRejected = items.reduce((s,i)=>s+(i.rejected||0),0);
  const grnValue    = items.reduce((s,i)=>s+((i.received||0)*(i.rate||0)),0);

  async function saveGrn(e) {
    e.preventDefault(); setSaving(true);
    const status = totReceived===0 ? 'draft' : totReceived < totOrdered ? 'partial' : 'completed';
    const { data:grn } = await supabase.from('goods_receipts').insert({
      ...form, tenant_id:tenant.id, grn_no:genNo(), items,
      total_ordered:totOrdered, total_received:totReceived, total_rejected:totRejected,
      grn_value:grnValue, status,
      purchase_id:form.purchase_id||null,
    }).select().single();

    // Update inventory stock + create batches where batch_no given
    for (const it of items) {
      if (!it.received) continue;
      const { data:inv } = await supabase.from('inventory').select('id,stock').eq('tenant_id', tenant.id).eq('name', it.name).maybeSingle();
      if (inv) {
        await supabase.from('inventory').update({ stock:(inv.stock||0)+it.received }).eq('id', inv.id);
        if (it.batch_no) {
          await supabase.from('product_batches').insert({
            tenant_id:tenant.id, item_id:inv.id, item_name:it.name, batch_no:it.batch_no,
            supplier:form.supplier, expiry_date:it.expiry||null,
            qty_received:it.received, qty_remaining:it.received, cost_price:it.rate,
            grn_id:grn?.id, status:'active',
          });
        }
      }
    }

    setShowForm(false); setItems([]);
    setForm({ purchase_id:'', po_number:'', supplier:'', invoice_no:'', invoice_date:new Date().toISOString().slice(0,10), received_by:'', qc_status:'pending', qc_notes:'', notes:'' });
    setSaving(false); await load();
  }

  async function updateQC(id, qc_status) {
    await supabase.from('goods_receipts').update({ qc_status }).eq('id', id);
    setGrns(prev=>prev.map(g=>g.id===id?{...g,qc_status}:g));
    if (selGrn?.id===id) setSelGrn(prev=>({...prev,qc_status}));
  }

  const displayed = filter==='all'?grns:grns.filter(g=>g.status===filter||g.qc_status===filter);
  const pendingQC = grns.filter(g=>g.qc_status==='pending').length;
  const totalVal  = grns.reduce((s,g)=>s+(g.grn_value||0),0);
  const rejected  = grns.reduce((s,g)=>s+(g.total_rejected||0),0);

  return (
    <div style={{ padding:24, background:T.bg, minHeight:'100%' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
        <div>
          <div style={{ fontSize:18, fontWeight:800, color:T.darkRed }}>📥 Goods Receipt Notes</div>
          <div style={{ fontSize:12, color:T.sub, marginTop:2 }}>Receive stock against POs with quality check and batch capture</div>
        </div>
        <button onClick={()=>setShowForm(true)} style={btn(T.red, T.white)}>+ New GRN</button>
      </div>

      {pendingQC>0&&<div style={{ background:'#FFFBEB', border:'1px solid #FDE68A', borderRadius:10, padding:'10px 16px', marginBottom:16 }}>
        <span style={{ fontSize:13, fontWeight:600, color:T.amber }}>🔍 {pendingQC} GRN{pendingQC>1?'s':''} awaiting quality check</span>
      </div>}

      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:14, marginBottom:18 }}>
        {[['Total GRNs',grns.length,T.blue,'📥'],['Pending QC',pendingQC,T.amber,'🔍'],['Units Rejected',rejected,T.red,'❌'],['Receipt Value',fmt(totalVal),T.green,'💰']].map(([label,val,color,icon])=>(
          <div key={label} style={{ background:T.white, border:`1px solid ${T.bdr}`, borderRadius:12, padding:'16px 18px', boxShadow:'0 1px 4px rgba(0,0,0,.05)' }}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:6 }}>
              <div style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.05em' }}>{label}</div>
              <span style={{ fontSize:18 }}>{icon}</span>
            </div>
            <div style={{ fontSize:20, fontWeight:900, color, letterSpacing:'-0.02em' }}>{val}</div>
          </div>
        ))}
      </div>

      <div style={{ display:'flex', gap:6, marginBottom:14, flexWrap:'wrap' }}>
        {[['all','All'],['completed','Completed'],['partial','Partial'],['pending','QC Pending'],['failed','QC Failed']].map(([f,label])=>(
          <button key={f} onClick={()=>setFilter(f)} style={{ padding:'6px 14px', background:filter===f?T.red:T.white, color:filter===f?T.white:T.sub, border:`1px solid ${filter===f?T.red:T.bdr}`, borderRadius:20, fontSize:11, fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}>{label}</button>
        ))}
      </div>

      <div style={{ display:'grid', gridTemplateColumns:selGrn?'1fr 400px':'1fr', gap:16, alignItems:'flex-start' }}>
        <div style={{ background:T.white, border:`1px solid ${T.bdr}`, borderRadius:14, overflow:'hidden', boxShadow:'0 1px 4px rgba(0,0,0,.05)' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
            <thead><tr style={{ background:T.lightRed }}>
              {['GRN No','Date','PO Ref','Supplier','Ordered','Received','Rejected','Value','QC'].map(h=>(
                <th key={h} style={{ padding:'11px 12px', textAlign:['Ordered','Received','Rejected','Value'].includes(h)?'right':'left', fontSize:9, color:T.darkRed, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.04em', borderBottom:`1px solid ${T.bdr}`, whiteSpace:'nowrap' }}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {loading?<tr><td colSpan={9} style={{ textAlign:'center', padding:50, color:T.muted }}>Loading…</td></tr>
              :displayed.length===0?<tr><td colSpan={9} style={{ textAlign:'center', padding:50 }}>
                <div style={{ fontSize:36, marginBottom:8 }}>📥</div>
                <div style={{ color:T.muted, fontWeight:600 }}>No goods receipts yet</div>
              </td></tr>
              :displayed.map(g=>{
                const q = QC[g.qc_status]||QC.pending;
                return (
                  <tr key={g.id} onClick={()=>setSelGrn(selGrn?.id===g.id?null:g)} style={{ borderBottom:`1px solid ${T.bdr}22`, cursor:'pointer', background:selGrn?.id===g.id?'#FEF2F2':'transparent' }}>
                    <td style={{ padding:'10px 12px', fontFamily:'monospace', fontSize:10, color:T.blue, fontWeight:700 }}>{g.grn_no}</td>
                    <td style={{ padding:'10px 12px', color:T.muted, fontSize:11 }}>{g.receipt_date}</td>
                    <td style={{ padding:'10px 12px', color:T.sub, fontSize:11 }}>{g.po_number||'—'}</td>
                    <td style={{ padding:'10px 12px', color:T.ink, fontWeight:600 }}>{g.supplier}</td>
                    <td style={{ padding:'10px 12px', textAlign:'right', color:T.sub }}>{g.total_ordered}</td>
                    <td style={{ padding:'10px 12px', textAlign:'right', color:T.green, fontWeight:700 }}>{g.total_received}</td>
                    <td style={{ padding:'10px 12px', textAlign:'right', color:g.total_rejected>0?T.red:T.muted, fontWeight:g.total_rejected>0?700:400 }}>{g.total_rejected}</td>
                    <td style={{ padding:'10px 12px', textAlign:'right', color:T.red, fontWeight:700 }}>{fmt(g.grn_value)}</td>
                    <td style={{ padding:'10px 12px' }}><span style={{ background:q.bg, color:q.color, border:`1px solid ${q.bdr}`, borderRadius:5, padding:'2px 8px', fontSize:9, fontWeight:700, whiteSpace:'nowrap' }}>{q.label}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {selGrn&&(
          <div style={{ background:T.white, border:`1px solid ${T.bdr}`, borderRadius:14, overflow:'hidden', boxShadow:'0 1px 4px rgba(0,0,0,.05)' }}>
            <div style={{ padding:'14px 18px', background:T.lightRed, borderBottom:`1px solid ${T.bdr}`, display:'flex', justifyContent:'space-between' }}>
              <div>
                <div style={{ fontWeight:800, color:T.darkRed, fontSize:13 }}>{selGrn.grn_no}</div>
                <div style={{ fontSize:11, color:T.sub, marginTop:2 }}>{selGrn.supplier} · Inv: {selGrn.invoice_no||'—'}</div>
              </div>
              <button onClick={()=>setSelGrn(null)} style={{ background:'none', border:'none', fontSize:18, cursor:'pointer', color:T.muted }}>×</button>
            </div>
            <div style={{ padding:'14px 18px', maxHeight:420, overflowY:'auto' }}>
              {(selGrn.items||[]).map((it,i)=>(
                <div key={i} style={{ padding:'9px 0', borderBottom:`1px solid ${T.bdr}22` }}>
                  <div style={{ fontSize:12, fontWeight:600, color:T.ink, marginBottom:3 }}>{it.name}</div>
                  <div style={{ display:'flex', gap:12, fontSize:11, color:T.sub }}>
                    <span>Ordered: {it.ordered}</span>
                    <span style={{ color:T.green }}>Received: {it.received}</span>
                    {it.rejected>0&&<span style={{ color:T.red }}>Rejected: {it.rejected}</span>}
                  </div>
                  {it.batch_no&&<div style={{ fontSize:10, color:T.purple, marginTop:3 }}>🏷️ Batch: {it.batch_no}{it.expiry?` · Exp: ${it.expiry}`:''}</div>}
                </div>
              ))}
              <div style={{ marginTop:14 }}>
                <div style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', marginBottom:6 }}>Update QC Status</div>
                <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                  {Object.entries(QC).filter(([k])=>k!==selGrn.qc_status).map(([k,v])=>(
                    <button key={k} onClick={()=>updateQC(selGrn.id,k)} style={{ background:v.bg, color:v.color, border:`1px solid ${v.bdr}`, borderRadius:7, padding:'5px 11px', fontSize:10, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>{v.label}</button>
                  ))}
                </div>
              </div>
              {selGrn.qc_notes&&<div style={{ marginTop:12, fontSize:11, color:T.sub, fontStyle:'italic' }}>QC: {selGrn.qc_notes}</div>}
            </div>
          </div>
        )}
      </div>

      {showForm&&(
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.5)', zIndex:200, display:'flex', alignItems:'flex-start', justifyContent:'center', padding:20, overflowY:'auto' }}>
          <div style={{ background:T.white, borderRadius:16, padding:28, width:'100%', maxWidth:820, margin:'20px 0', boxShadow:'0 20px 60px rgba(0,0,0,.2)' }}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:20 }}>
              <div style={{ fontSize:17, fontWeight:800, color:T.darkRed }}>New Goods Receipt</div>
              <button onClick={()=>setShowForm(false)} style={{ background:'none', border:'none', fontSize:22, cursor:'pointer', color:T.muted }}>×</button>
            </div>
            <form onSubmit={saveGrn}>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12, marginBottom:16 }}>
                <div style={{ gridColumn:'1/-1' }}>
                  <label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:5 }}>Purchase Order *</label>
                  <select value={form.purchase_id} onChange={e=>loadPO(e.target.value)} required style={{ ...inp, cursor:'pointer' }}>
                    <option value="">Select PO to receive against…</option>
                    {purchases.map(p=><option key={p.id} value={p.id}>{p.po_number} · {p.supplier} · {fmt(p.total)}</option>)}
                  </select>
                </div>
                {[['Supplier','text','supplier'],['Invoice No','text','invoice_no'],['Invoice Date','date','invoice_date'],['Received By','text','received_by']].map(([label,type,key])=>(
                  <div key={key}><label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:4 }}>{label}</label><input type={type} value={form[key]} onChange={e=>setForm(f=>({...f,[key]:e.target.value}))} style={inp}/></div>
                ))}
                <div><label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:4 }}>QC Status</label>
                  <select value={form.qc_status} onChange={e=>setForm(f=>({...f,qc_status:e.target.value}))} style={{ ...inp, cursor:'pointer' }}>
                    {Object.entries(QC).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}
                  </select>
                </div>
              </div>

              {items.length>0&&<div style={{ background:T.bg, borderRadius:10, overflow:'hidden', marginBottom:14 }}>
                <table style={{ width:'100%', borderCollapse:'collapse', fontSize:11 }}>
                  <thead><tr style={{ background:T.lightRed }}>
                    {['Product','Ordered','Received','Rejected','Batch No','Expiry','Value'].map(h=>(
                      <th key={h} style={{ padding:'8px 10px', textAlign:'left', fontSize:9, color:T.darkRed, fontWeight:700, textTransform:'uppercase' }}>{h}</th>
                    ))}
                  </tr></thead>
                  <tbody>{items.map((it,i)=>(
                    <tr key={i} style={{ borderBottom:`1px solid ${T.bdr}22` }}>
                      <td style={{ padding:'6px 10px', color:T.ink, fontWeight:600 }}>{it.name}</td>
                      <td style={{ padding:'6px 10px', color:T.sub }}>{it.ordered}</td>
                      <td style={{ padding:'4px 6px' }}><input type="number" value={it.received} onChange={e=>updItem(i,'received',e.target.value)} style={{ width:65, background:T.white, border:`1px solid ${T.bdr}`, borderRadius:5, padding:'4px 6px', fontSize:11, textAlign:'center', fontFamily:'inherit', outline:'none', color:T.green, fontWeight:700 }}/></td>
                      <td style={{ padding:'4px 6px' }}><input type="number" value={it.rejected} onChange={e=>updItem(i,'rejected',e.target.value)} style={{ width:60, background:T.white, border:`1px solid ${T.bdr}`, borderRadius:5, padding:'4px 6px', fontSize:11, textAlign:'center', fontFamily:'inherit', outline:'none', color:T.red }}/></td>
                      <td style={{ padding:'4px 6px' }}><input value={it.batch_no} onChange={e=>updItem(i,'batch_no',e.target.value)} placeholder="optional" style={{ width:90, background:T.white, border:`1px solid ${T.bdr}`, borderRadius:5, padding:'4px 6px', fontSize:11, fontFamily:'inherit', outline:'none' }}/></td>
                      <td style={{ padding:'4px 6px' }}><input type="date" value={it.expiry} onChange={e=>updItem(i,'expiry',e.target.value)} style={{ width:120, background:T.white, border:`1px solid ${T.bdr}`, borderRadius:5, padding:'4px 6px', fontSize:10, fontFamily:'inherit', outline:'none' }}/></td>
                      <td style={{ padding:'6px 10px', color:T.red, fontWeight:700 }}>{showCost?fmt((it.received||0)*(it.rate||0)):<span style={{ color:T.muted, fontWeight:400 }}>🔒</span>}</td>
                    </tr>
                  ))}</tbody>
                </table>
                <div style={{ padding:'10px 14px', background:T.lightRed, display:'flex', justifyContent:'flex-end', gap:18, fontSize:12 }}>
                  <span style={{ color:T.sub }}>Ordered: <strong>{totOrdered}</strong></span>
                  <span style={{ color:T.green }}>Received: <strong>{totReceived}</strong></span>
                  {totRejected>0&&<span style={{ color:T.red }}>Rejected: <strong>{totRejected}</strong></span>}
                  {showCost && <span style={{ color:T.red, fontWeight:800, fontSize:14 }}>Value: {fmt(grnValue)}</span>}
                </div>
              </div>}

              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:16 }}>
                <div><label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:4 }}>QC Notes</label><input value={form.qc_notes} onChange={e=>setForm(f=>({...f,qc_notes:e.target.value}))} style={inp}/></div>
                <div><label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:4 }}>Notes</label><input value={form.notes} onChange={e=>setForm(f=>({...f,notes:e.target.value}))} style={inp}/></div>
              </div>
              <div style={{ display:'flex', gap:10 }}>
                <button type="button" onClick={()=>setShowForm(false)} style={{ flex:1, background:T.bg, color:T.sub, border:`1px solid ${T.bdr}`, borderRadius:9, padding:'12px', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>Cancel</button>
                <button type="submit" disabled={saving||!items.length} style={{ flex:2, ...btn(T.red, T.white), padding:'12px', fontSize:13 }}>{saving?'Receiving…':'📥 Receive Goods & Update Stock'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
