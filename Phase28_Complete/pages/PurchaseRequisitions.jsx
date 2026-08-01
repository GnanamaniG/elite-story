import { useState, useEffect } from 'react';
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

const PRIORITY_CFG = {
  low:    { color:'#6B7280', bg:'#F9FAFB', label:'Low'    },
  normal: { color:'#2563EB', bg:'#EFF6FF', label:'Normal' },
  high:   { color:'#D97706', bg:'#FFFBEB', label:'High'   },
  urgent: { color:'#C0392B', bg:'#FEF2F2', label:'Urgent' },
};

const STATUS_CFG = {
  pending:  { color:'#D97706', bg:'#FFFBEB', border:'#FDE68A', label:'Pending Approval' },
  approved: { color:'#16A34A', bg:'#F0FDF4', border:'#BBF7D0', label:'Approved'         },
  rejected: { color:'#C0392B', bg:'#FEF2F2', border:'#FECACA', label:'Rejected'         },
  ordered:  { color:'#2563EB', bg:'#EFF6FF', border:'#BFDBFE', label:'PO Created'       },
};

const STAFF = ['Gnanamani','Store Staff 1','Store Staff 2'];
const DEPTS = ['Store','Warehouse','Admin','Management','IT'];

export default function PurchaseRequisitions({ tenant }) {
  const [reqs,     setReqs]     = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [filter,   setFilter]   = useState('all');
  const [saving,   setSaving]   = useState(false);
  const [rejectId, setRejectId] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [reqItems, setReqItems] = useState([{ name:'', qty:1, unit:'pcs', est_price:0 }]);
  const [form, setForm] = useState({ requested_by:'', department:'', priority:'normal', required_by:'', notes:'' });

  useEffect(() => { if (tenant?.id) load(); }, [tenant?.id]);

  async function load() {
    setLoading(true);
    const { data } = await supabase.from('purchase_requisitions').select('*').eq('tenant_id', tenant.id).order('created_at', { ascending:false });
    setReqs(data||[]);
    setLoading(false);
  }

  function genNo() { return `REQ/${new Date().getFullYear()}/${String(Date.now()).slice(-5)}`; }

  const totalEst = reqItems.reduce((s,i)=>s+(i.est_price||0)*(i.qty||1),0);

  async function saveReq(e) {
    e.preventDefault(); setSaving(true);
    await supabase.from('purchase_requisitions').insert({
      ...form, tenant_id:tenant.id, req_no:genNo(),
      items:reqItems, total_est:totalEst, status:'pending',
    });
    setShowForm(false);
    setReqItems([{ name:'', qty:1, unit:'pcs', est_price:0 }]);
    setForm({ requested_by:'', department:'', priority:'normal', required_by:'', notes:'' });
    setSaving(false); await load();
  }

  async function approve(id) {
    await supabase.from('purchase_requisitions').update({ status:'approved', approved_by:'Admin', approved_at:new Date().toISOString() }).eq('id', id);
    setReqs(prev=>prev.map(r=>r.id===id?{...r,status:'approved',approved_by:'Admin'}:r));
  }

  async function reject(id) {
    if (!rejectReason) return;
    await supabase.from('purchase_requisitions').update({ status:'rejected', reject_reason:rejectReason }).eq('id', id);
    setReqs(prev=>prev.map(r=>r.id===id?{...r,status:'rejected',reject_reason:rejectReason}:r));
    setRejectId(null); setRejectReason('');
  }

  async function convertToPO(req) {
    const poNum = `PO/${new Date().getFullYear()}/${String(Date.now()).slice(-5)}`;
    const items = (req.items||[]).map(i=>({ name:i.name, qty:i.qty||1, rate:i.est_price||0, amount:(i.est_price||0)*(i.qty||1) }));
    const total = items.reduce((s,i)=>s+(i.amount||0),0);
    const { data:po } = await supabase.from('purchases').insert({ tenant_id:tenant.id, po_number:poNum, supplier:'TBD', items, total, status:'draft', date:new Date().toISOString().slice(0,10) }).select().single();
    await supabase.from('purchase_requisitions').update({ status:'ordered', po_id:po.id }).eq('id', req.id);
    setReqs(prev=>prev.map(r=>r.id===req.id?{...r,status:'ordered'}:r));
    alert(`✅ PO ${poNum} created as draft. Update supplier in Purchases.`);
  }

  const displayed  = filter==='all'?reqs:reqs.filter(r=>r.status===filter);
  const pendingCnt = reqs.filter(r=>r.status==='pending').length;

  return (
    <div style={{ padding:24, background:T.bg, minHeight:'100%' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:24 }}>
        <div>
          <div style={{ fontSize:22, fontWeight:800, color:T.darkRed, letterSpacing:'-0.02em' }}>📝 Purchase Requisitions</div>
          <div style={{ fontSize:13, color:T.sub, marginTop:2 }}>Staff raises purchase requests · Manager approves · Auto converts to PO</div>
        </div>
        <button onClick={()=>setShowForm(true)} style={btn(T.red, T.white)}>+ New Request</button>
      </div>

      {pendingCnt>0&&<div style={{ background:'#FFFBEB', border:'1px solid #FDE68A', borderRadius:10, padding:'10px 16px', marginBottom:16, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <span style={{ fontSize:13, fontWeight:600, color:T.amber }}>⏳ {pendingCnt} requisition{pendingCnt>1?'s':''} awaiting approval</span>
        <button onClick={()=>setFilter('pending')} style={{ background:'#FDE68A', color:'#92400E', border:'none', borderRadius:7, padding:'4px 12px', fontSize:11, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>Review Now</button>
      </div>}

      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:14, marginBottom:20 }}>
        {[['Total',reqs.length,T.blue],['Pending',reqs.filter(r=>r.status==='pending').length,T.amber],['Approved',reqs.filter(r=>r.status==='approved').length,T.green],['PO Created',reqs.filter(r=>r.status==='ordered').length,T.purple]].map(([label,val,color])=>(
          <div key={label} style={{ background:T.white, border:`1px solid ${T.bdr}`, borderRadius:12, padding:'14px 16px', boxShadow:'0 1px 4px rgba(0,0,0,.05)' }}>
            <div style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:5 }}>{label}</div>
            <div style={{ fontSize:22, fontWeight:900, color }}>{val}</div>
          </div>
        ))}
      </div>

      <div style={{ display:'flex', gap:6, marginBottom:14 }}>
        {['all','pending','approved','rejected','ordered'].map(f=>(
          <button key={f} onClick={()=>setFilter(f)} style={{ padding:'6px 14px', background:filter===f?T.red:T.white, color:filter===f?T.white:T.sub, border:`1px solid ${filter===f?T.red:T.bdr}`, borderRadius:20, fontSize:11, fontWeight:600, cursor:'pointer', fontFamily:'inherit', textTransform:'capitalize' }}>
            {STATUS_CFG[f]?.label||'All'} ({f==='all'?reqs.length:reqs.filter(r=>r.status===f).length})
          </button>
        ))}
      </div>

      <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
        {loading?<div style={{ textAlign:'center', padding:60, color:T.muted }}>Loading…</div>
        :displayed.length===0?<div style={{ background:T.white, border:`1px solid ${T.bdr}`, borderRadius:12, padding:60, textAlign:'center' }}>
          <div style={{ fontSize:36, marginBottom:8 }}>📝</div>
          <div style={{ color:T.muted, fontWeight:600 }}>No requisitions found</div>
        </div>
        :displayed.map(r=>{
          const s = STATUS_CFG[r.status]||STATUS_CFG.pending;
          const p = PRIORITY_CFG[r.priority]||PRIORITY_CFG.normal;
          return (
            <div key={r.id} style={{ background:T.white, border:`1px solid ${r.status==='pending'?'#FDE68A':T.bdr}`, borderRadius:12, padding:'16px 20px', boxShadow:'0 1px 3px rgba(0,0,0,.04)' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:10 }}>
                <div>
                  <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:4 }}>
                    <span style={{ fontFamily:'monospace', fontWeight:700, color:T.blue, fontSize:12 }}>{r.req_no}</span>
                    <span style={{ background:s.bg, color:s.color, border:`1px solid ${s.border}`, borderRadius:5, padding:'2px 8px', fontSize:10, fontWeight:700 }}>{s.label}</span>
                    <span style={{ background:p.bg, color:p.color, borderRadius:5, padding:'2px 7px', fontSize:9, fontWeight:700 }}>{p.label}</span>
                  </div>
                  <div style={{ fontSize:13, fontWeight:600, color:T.ink }}>By: {r.requested_by} {r.department?`· ${r.department}`:''}</div>
                  <div style={{ fontSize:11, color:T.muted, marginTop:2 }}>Created: {r.created_at?.slice(0,10)} {r.required_by?`· Required by: ${r.required_by}`:''}</div>
                </div>
                <div style={{ textAlign:'right' }}>
                  <div style={{ fontSize:18, fontWeight:800, color:T.red }}>{fmt(r.total_est)}</div>
                  <div style={{ fontSize:10, color:T.muted }}>{(r.items||[]).length} items</div>
                </div>
              </div>
              {/* Items preview */}
              <div style={{ background:T.bg, borderRadius:8, padding:'10px 14px', marginBottom:12, fontSize:12 }}>
                {(r.items||[]).slice(0,3).map((item,i)=>(
                  <div key={i} style={{ display:'flex', justifyContent:'space-between', padding:'3px 0', color:T.sub }}>
                    <span>{item.name} × {item.qty} {item.unit}</span>
                    <span style={{ color:T.ink }}>{fmt((item.est_price||0)*(item.qty||1))}</span>
                  </div>
                ))}
                {(r.items||[]).length>3&&<div style={{ color:T.muted, fontSize:11, marginTop:4 }}>+{r.items.length-3} more items…</div>}
              </div>
              {r.reject_reason&&<div style={{ background:'#FEF2F2', border:'1px solid #FECACA', borderRadius:7, padding:'8px 12px', marginBottom:10, fontSize:12, color:T.red }}>❌ Rejected: {r.reject_reason}</div>}
              {r.approved_by&&r.status!=='rejected'&&<div style={{ fontSize:11, color:T.green, marginBottom:10 }}>✅ Approved by {r.approved_by} on {r.approved_at?.slice(0,10)}</div>}
              <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                {r.status==='pending'&&<>
                  <button onClick={()=>approve(r.id)} style={btn('#F0FDF4', T.green, { padding:'6px 14px', fontSize:11 })}>✅ Approve</button>
                  <button onClick={()=>setRejectId(r.id)} style={btn('#FEF2F2', T.red, { padding:'6px 14px', fontSize:11 })}>❌ Reject</button>
                </>}
                {r.status==='approved'&&<button onClick={()=>convertToPO(r)} style={btn('#EFF6FF', T.blue, { padding:'6px 14px', fontSize:11 })}>📋 Convert to PO</button>}
              </div>
              {rejectId===r.id&&<div style={{ marginTop:10, display:'flex', gap:8 }}>
                <input value={rejectReason} onChange={e=>setRejectReason(e.target.value)} placeholder="Reason for rejection…" style={{ ...inp, flex:1 }}/>
                <button onClick={()=>reject(r.id)} style={btn(T.red, T.white, { padding:'9px 14px' })}>Submit</button>
                <button onClick={()=>setRejectId(null)} style={btn(T.bg, T.sub, { border:`1px solid ${T.bdr}`, padding:'9px 14px' })}>Cancel</button>
              </div>}
            </div>
          );
        })}
      </div>

      {showForm&&(
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.5)', zIndex:200, display:'flex', alignItems:'flex-start', justifyContent:'center', padding:20, overflowY:'auto' }}>
          <div style={{ background:T.white, borderRadius:16, padding:28, width:'100%', maxWidth:560, margin:'20px 0', boxShadow:'0 20px 60px rgba(0,0,0,.2)' }}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:20 }}>
              <div style={{ fontSize:17, fontWeight:800, color:T.darkRed }}>New Purchase Requisition</div>
              <button onClick={()=>setShowForm(false)} style={{ background:'none', border:'none', fontSize:22, cursor:'pointer', color:T.muted }}>×</button>
            </div>
            <form onSubmit={saveReq}>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:16 }}>
                <div><label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:4 }}>Requested By *</label>
                  <select value={form.requested_by} onChange={e=>setForm(f=>({...f,requested_by:e.target.value}))} required style={{ ...inp, cursor:'pointer' }}>
                    <option value="">Select staff…</option>
                    {STAFF.map(s=><option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div><label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:4 }}>Department</label>
                  <select value={form.department} onChange={e=>setForm(f=>({...f,department:e.target.value}))} style={{ ...inp, cursor:'pointer' }}>
                    <option value="">Select…</option>
                    {DEPTS.map(d=><option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                <div><label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:4 }}>Priority</label>
                  <select value={form.priority} onChange={e=>setForm(f=>({...f,priority:e.target.value}))} style={{ ...inp, cursor:'pointer' }}>
                    {Object.entries(PRIORITY_CFG).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}
                  </select>
                </div>
                <div><label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:4 }}>Required By</label>
                  <input type="date" value={form.required_by} onChange={e=>setForm(f=>({...f,required_by:e.target.value}))} style={inp}/>
                </div>
              </div>

              <div style={{ marginBottom:12 }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
                  <label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase' }}>Items *</label>
                  <button type="button" onClick={()=>setReqItems(prev=>[...prev,{ name:'', qty:1, unit:'pcs', est_price:0 }])} style={btn('#EFF6FF', T.blue, { padding:'4px 10px', fontSize:10 })}>+ Add Item</button>
                </div>
                {reqItems.map((item,i)=>(
                  <div key={i} style={{ display:'grid', gridTemplateColumns:'2fr 80px 60px 100px auto', gap:8, marginBottom:8, alignItems:'center' }}>
                    <input value={item.name} onChange={e=>setReqItems(prev=>prev.map((x,j)=>j===i?{...x,name:e.target.value}:x))} placeholder="Item name" required style={inp}/>
                    <input type="number" value={item.qty} onChange={e=>setReqItems(prev=>prev.map((x,j)=>j===i?{...x,qty:parseInt(e.target.value)||1}:x))} style={{ ...inp, textAlign:'center' }}/>
                    <select value={item.unit} onChange={e=>setReqItems(prev=>prev.map((x,j)=>j===i?{...x,unit:e.target.value}:x))} style={{ ...inp, fontSize:11, cursor:'pointer', padding:'9px 6px' }}>
                      {['pcs','kg','box','pairs','litre','dozen'].map(u=><option key={u} value={u}>{u}</option>)}
                    </select>
                    <input type="number" value={item.est_price} onChange={e=>setReqItems(prev=>prev.map((x,j)=>j===i?{...x,est_price:parseFloat(e.target.value)||0}:x))} placeholder="Est. price" style={inp}/>
                    {reqItems.length>1&&<button type="button" onClick={()=>setReqItems(prev=>prev.filter((_,j)=>j!==i))} style={{ background:'#FEF2F2', color:T.red, border:'none', borderRadius:6, padding:'9px 10px', cursor:'pointer', fontFamily:'inherit' }}>×</button>}
                  </div>
                ))}
                {totalEst>0&&<div style={{ textAlign:'right', fontSize:13, fontWeight:700, color:T.red, marginTop:6 }}>Estimated Total: {fmt(totalEst)}</div>}
              </div>

              <div style={{ marginBottom:14 }}><label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:4 }}>Notes</label><textarea value={form.notes} onChange={e=>setForm(f=>({...f,notes:e.target.value}))} rows={2} style={{ ...inp, resize:'vertical' }}/></div>
              <div style={{ display:'flex', gap:10 }}>
                <button type="button" onClick={()=>setShowForm(false)} style={{ flex:1, background:T.bg, color:T.sub, border:`1px solid ${T.bdr}`, borderRadius:9, padding:'12px', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>Cancel</button>
                <button type="submit" disabled={saving} style={{ flex:2, ...btn(T.red, T.white), padding:'12px', fontSize:13 }}>{saving?'Submitting…':'📝 Submit Requisition'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
