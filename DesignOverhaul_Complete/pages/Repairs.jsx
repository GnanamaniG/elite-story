import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

const T = {
  bg:'#060710', srf:'#0b0d1a', card:'#0f1220', card2:'#141828',
  bdr:'#1a1e32', bdr2:'#222740',
  blue:'#4f7cff', green:'#00d68f', red:'#ff4d6a', amber:'#ffb547',
  purple:'#9b72ff', teal:'#00c9b1', orange:'#ff7043', gold:'#ffc107',
  cyan:'#00d4ff', pink:'#f06292',
  muted:'#4a5175', dim:'#2a3050', card3:'#181d2e',
  ink:'#eef0f8', sub:'#8892b0'
};
const fmt = n => 'Rs.' + (n||0).toLocaleString('en-IN', { maximumFractionDigits:0 });

const STATUS_FLOW = [
  { id:'received',  label:'Received',   icon:'📥', color:T.sub },
  { id:'diagnosed', label:'Diagnosed',  icon:'🔍', color:T.blue },
  { id:'in_repair', label:'In Repair',  icon:'🔧', color:T.amber },
  { id:'ready',     label:'Ready',      icon:'✅', color:T.green },
  { id:'delivered', label:'Delivered',  icon:'📦', color:T.teal },
];
const PRIORITY_COLORS = { low:T.muted, normal:T.sub, high:T.amber, urgent:T.red };

const WA_MESSAGES = {
  received:  (job, biz) => `Dear ${job.customer},\n\nYour ${job.item_type||'item'} has been received at *${biz}*.\n\nJob No: *${job.job_num}*\nProblem: ${job.problem}\n\nWe will diagnose and update you shortly. 🙏`,
  diagnosed: (job, biz) => `Dear ${job.customer},\n\nWe have diagnosed your ${job.item_type||'item'} at *${biz}*.\n\nJob No: *${job.job_num}*\nDiagnosis: ${job.diagnosis||'Please contact us'}\nEstimated Cost: *${fmt(job.total_charge)}*\n\nPlease confirm to proceed with repair. 📞`,
  in_repair: (job, biz) => `Dear ${job.customer},\n\nYour ${job.item_type||'item'} repair is now *in progress* at *${biz}*.\n\nJob No: *${job.job_num}*\nEst. Completion: ${job.est_completion||'TBD'}\n\nWe will notify you when ready! 🔧`,
  ready:     (job, biz) => `Dear ${job.customer},\n\n🎉 Your ${job.item_type||'item'} is *READY for pickup* at *${biz}*!\n\nJob No: *${job.job_num}*\nAmount Due: *${fmt(job.total_charge - job.advance_paid)}*\n\nPlease collect at your earliest convenience. Thank you! 🙏`,
  delivered: (job, biz) => `Dear ${job.customer},\n\nThank you for choosing *${biz}*!\n\nYour ${job.item_type||'item'} has been delivered.\nJob No: *${job.job_num}*\n\nWe hope you are satisfied. Please visit us again! 😊`,
};

function RepairForm({ repair, tenantId, onSave, onCancel }) {
  const [form, setForm] = useState(repair || { customer:'', customer_phone:'', item_type:'', item_brand:'', problem:'', labour_charge:0, parts_charge:0, advance_paid:0, priority:'normal', est_completion:'', technician:'', notes:'' });
  const [saving, setSaving] = useState(false);
  const set = (k,v) => setForm(f=>({...f,[k]:v}));
  const inp = { background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:8, padding:'9px 12px', color:T.ink, fontSize:13, fontFamily:'inherit', outline:'none', width:'100%' };
  const lbl = { fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:5 };
  const total = (parseFloat(form.labour_charge)||0) + (parseFloat(form.parts_charge)||0);

  async function handleSave(e) {
    e.preventDefault();
    if (!form.customer || !form.problem) return alert('Customer name and problem required');
    setSaving(true);
    try {
      const jobNum = repair?.job_num || `JOB/${new Date().toISOString().slice(0,10).replace(/-/g,'')}/${String(Date.now()).slice(-4)}`;
      const payload = { ...form, tenant_id:tenantId, job_num:jobNum, total_charge:total };
      let data;
      if (repair?.id) {
        const { data:d } = await supabase.from('repairs').update(payload).eq('id', repair.id).select().single();
        data = d;
      } else {
        const { data:d } = await supabase.from('repairs').insert(payload).select().single();
        data = d;
      }
      onSave(data);
    } catch(e) { alert('Error: ' + e.message); }
    finally { setSaving(false); }
  }

  const ITEM_TYPES = ['Shoe','Bag','Watch','Leather Goods','Belt','Wallet','Other'];

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.8)', zIndex:200, display:'flex', alignItems:'center', justifyContent:'center', padding:20, overflowY:'auto' }}>
      <div style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:14, padding:24, width:'100%', maxWidth:560, margin:'20px 0' }}>
        <div style={{ display:'flex', justifyContent:'space-between', marginBottom:18 }}>
          <div style={{ fontSize:17, fontWeight:700, color:T.ink }}>{repair?.id?'Edit Job':'New Repair Job'}</div>
          <button onClick={onCancel} style={{ background:'none', border:'none', color:T.muted, cursor:'pointer', fontSize:22 }}>×</button>
        </div>
        <form onSubmit={handleSave}>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:14 }}>
            <div style={{ gridColumn:'1/-1' }}><label style={lbl}>Customer Name *</label><input value={form.customer} onChange={e=>set('customer',e.target.value)} placeholder="Customer name" style={inp} required/></div>
            <div><label style={lbl}>Phone</label><input value={form.customer_phone||''} onChange={e=>set('customer_phone',e.target.value)} placeholder="Mobile number" style={inp}/></div>
            <div><label style={lbl}>Priority</label>
              <select value={form.priority} onChange={e=>set('priority',e.target.value)} style={{ ...inp, cursor:'pointer' }}>
                {['low','normal','high','urgent'].map(p=><option key={p} value={p} style={{ textTransform:'capitalize' }}>{p.charAt(0).toUpperCase()+p.slice(1)}</option>)}
              </select>
            </div>
            <div><label style={lbl}>Item Type</label>
              <select value={form.item_type||''} onChange={e=>set('item_type',e.target.value)} style={{ ...inp, cursor:'pointer' }}>
                <option value="">Select type</option>
                {ITEM_TYPES.map(t=><option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div><label style={lbl}>Brand</label><input value={form.item_brand||''} onChange={e=>set('item_brand',e.target.value)} placeholder="e.g. Nike, Prada" style={inp}/></div>
            <div style={{ gridColumn:'1/-1' }}><label style={lbl}>Problem Description *</label><input value={form.problem} onChange={e=>set('problem',e.target.value)} placeholder="Describe the issue" style={inp} required/></div>
            <div><label style={lbl}>Labour Charge</label><input type="number" value={form.labour_charge||0} onChange={e=>set('labour_charge',parseFloat(e.target.value)||0)} style={inp}/></div>
            <div><label style={lbl}>Parts Charge</label><input type="number" value={form.parts_charge||0} onChange={e=>set('parts_charge',parseFloat(e.target.value)||0)} style={inp}/></div>
            <div><label style={lbl}>Advance Paid</label><input type="number" value={form.advance_paid||0} onChange={e=>set('advance_paid',parseFloat(e.target.value)||0)} style={inp}/></div>
            <div><label style={lbl}>Est. Completion</label><input type="date" value={form.est_completion||''} onChange={e=>set('est_completion',e.target.value)} style={inp}/></div>
            <div><label style={lbl}>Technician</label><input value={form.technician||''} onChange={e=>set('technician',e.target.value)} placeholder="Assigned to" style={inp}/></div>
            <div><label style={lbl}>Total Charge</label><div style={{ background:T.card, border:`1px solid ${T.bdr}`, borderRadius:8, padding:'9px 12px', fontSize:16, fontWeight:800, color:T.green }}>{fmt(total)}</div></div>
            <div style={{ gridColumn:'1/-1' }}><label style={lbl}>Notes</label><input value={form.notes||''} onChange={e=>set('notes',e.target.value)} placeholder="Internal notes" style={inp}/></div>
          </div>
          <div style={{ display:'flex', gap:10 }}>
            <button type="button" onClick={onCancel} style={{ flex:1, background:T.card, color:T.sub, border:`1px solid ${T.bdr}`, borderRadius:8, padding:'11px', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>Cancel</button>
            <button type="submit" disabled={saving} style={{ flex:2, background:T.blue, color:'#fff', border:'none', borderRadius:8, padding:'11px', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>
              {saving?'Saving…':repair?.id?'Update Job':'Create Job'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function Repairs({ tenant }) {
  const [repairs,  setRepairs]  = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [filter,   setFilter]   = useState('all');
  const [selected, setSelected] = useState(null);

  useEffect(() => { if (tenant?.id) load(); }, [tenant?.id]);

  async function load() {
    setLoading(true);
    const { data } = await supabase.from('repairs').select('*').eq('tenant_id', tenant.id).order('received_date', { ascending:false });
    setRepairs(data || []);
    setLoading(false);
  }

  async function updateStatus(repair, newStatus) {
    await supabase.from('repairs').update({ status:newStatus, ...(newStatus==='delivered'?{delivered_date:new Date().toISOString().slice(0,10)}:{}) }).eq('id', repair.id);
    setRepairs(prev=>prev.map(r=>r.id===repair.id?{...r,status:newStatus}:r));
    if (selected?.id===repair.id) setSelected(prev=>({...prev,status:newStatus}));
    // Send WhatsApp notification
    sendStatusWhatsApp({ ...repair, status:newStatus });
  }

  function sendStatusWhatsApp(repair) {
    if (!repair.customer_phone) return;
    const msg = WA_MESSAGES[repair.status]?.(repair, tenant?.name||'Elite Store');
    if (!msg) return;
    const ph  = repair.customer_phone.replace(/\D/g,'').replace(/^0/,'91');
    window.open(`https://wa.me/${ph}?text=${encodeURIComponent(msg)}`, '_blank');
  }

  const displayed = filter==='all' ? repairs : repairs.filter(r=>r.status===filter);
  const statusCounts = STATUS_FLOW.reduce((acc,s)=>({...acc,[s.id]:repairs.filter(r=>r.status===s.id).length}),{});
  const pendingRevenue = repairs.filter(r=>r.status!=='delivered').reduce((s,r)=>s+(r.total_charge||0)-(r.advance_paid||0),0);

  return (
    <div style={{ padding:20 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
        <div>
          <div style={{ fontSize:22, fontWeight:800, color:T.ink }}>🔧 Repairs & Service</div>
          <div style={{ fontSize:13, color:T.sub }}>{repairs.length} jobs · {fmt(pendingRevenue)} pending collection</div>
        </div>
        <button onClick={()=>{setEditItem(null);setShowForm(true);}} style={{ background:T.blue, color:'#fff', border:'none', borderRadius:9, padding:'10px 18px', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>+ New Job</button>
      </div>

      {/* Status pipeline */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:10, marginBottom:20 }}>
        {STATUS_FLOW.map(s=>(
          <div key={s.id} onClick={()=>setFilter(filter===s.id?'all':s.id)}
            style={{ background:filter===s.id?s.color+'22':T.srf, border:`1px solid ${filter===s.id?s.color:T.bdr}`, borderRadius:10, padding:'12px 14px', cursor:'pointer', textAlign:'center' }}>
            <div style={{ fontSize:22, marginBottom:4 }}>{s.icon}</div>
            <div style={{ fontSize:20, fontWeight:800, color:s.color }}>{statusCounts[s.id]||0}</div>
            <div style={{ fontSize:11, color:T.sub }}>{s.label}</div>
          </div>
        ))}
      </div>

      <div style={{ display:'grid', gridTemplateColumns:selected?'1fr 380px':'1fr', gap:16 }}>
        {/* Repairs list */}
        <div style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:12, overflow:'hidden' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
            <thead><tr style={{ background:T.card }}>
              {['Job#','Customer','Item','Problem','Charge','Priority','Status','Action'].map(h=>(
                <th key={h} style={{ padding:'9px 14px', textAlign:'left', fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', borderBottom:`1px solid ${T.bdr}` }}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {loading?<tr><td colSpan={8} style={{ textAlign:'center', padding:40, color:T.sub }}>Loading…</td></tr>
              :displayed.length===0?<tr><td colSpan={8} style={{ textAlign:'center', padding:40, color:T.muted }}>No repair jobs{filter!=='all'?' in this status':''}</td></tr>
              :displayed.map(r=>(
                <tr key={r.id} onClick={()=>setSelected(selected?.id===r.id?null:r)} style={{ borderBottom:`1px solid ${T.bdr}22`, cursor:'pointer', background:selected?.id===r.id?T.card:'transparent' }}>
                  <td style={{ padding:'10px 14px', color:T.blue, fontFamily:'monospace', fontSize:11 }}>{r.job_num}</td>
                  <td style={{ padding:'10px 14px', color:T.ink, fontWeight:600 }}>
                    <div>{r.customer}</div>
                    {r.customer_phone&&<div style={{ fontSize:10, color:T.muted }}>{r.customer_phone}</div>}
                  </td>
                  <td style={{ padding:'10px 14px', color:T.sub }}>{r.item_type||'—'}{r.item_brand&&` · ${r.item_brand}`}</td>
                  <td style={{ padding:'10px 14px', color:T.sub, maxWidth:150, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{r.problem}</td>
                  <td style={{ padding:'10px 14px', color:T.green, fontWeight:700 }}>{fmt(r.total_charge)}</td>
                  <td style={{ padding:'10px 14px' }}>
                    <span style={{ background:PRIORITY_COLORS[r.priority]+'22', color:PRIORITY_COLORS[r.priority], borderRadius:5, padding:'2px 8px', fontSize:10, fontWeight:700, textTransform:'capitalize' }}>{r.priority}</span>
                  </td>
                  <td style={{ padding:'10px 14px' }}>
                    <span style={{ background:STATUS_FLOW.find(s=>s.id===r.status)?.color+'22'||T.sub, color:STATUS_FLOW.find(s=>s.id===r.status)?.color||T.sub, borderRadius:5, padding:'2px 8px', fontSize:10, fontWeight:700 }}>
                      {STATUS_FLOW.find(s=>s.id===r.status)?.label||r.status}
                    </span>
                  </td>
                  <td style={{ padding:'10px 14px' }}>
                    <button onClick={e=>{e.stopPropagation();setEditItem(r);setShowForm(true);}} style={{ background:T.blue+'22', color:T.blue, border:'none', borderRadius:6, padding:'4px 10px', fontSize:11, cursor:'pointer', fontFamily:'inherit' }}>Edit</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Job detail panel */}
        {selected && (
          <div style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:12, overflow:'hidden' }}>
            <div style={{ padding:'14px 18px', borderBottom:`1px solid ${T.bdr}`, display:'flex', justifyContent:'space-between' }}>
              <div>
                <div style={{ fontSize:14, fontWeight:700, color:T.blue }}>{selected.job_num}</div>
                <div style={{ fontSize:12, color:T.sub }}>{selected.customer} · {selected.received_date}</div>
              </div>
              <button onClick={()=>setSelected(null)} style={{ background:'none', border:'none', color:T.muted, cursor:'pointer', fontSize:18 }}>×</button>
            </div>
            <div style={{ padding:16 }}>
              {[['Item',`${selected.item_type||'—'}${selected.item_brand?' · '+selected.item_brand:''}`],['Problem',selected.problem],['Diagnosis',selected.diagnosis||'—'],['Technician',selected.technician||'—'],['Est. Completion',selected.est_completion||'—']].map(([label,val])=>(
                <div key={label} style={{ display:'flex', justifyContent:'space-between', padding:'5px 0', borderBottom:`1px solid ${T.bdr}22`, fontSize:12 }}>
                  <span style={{ color:T.sub }}>{label}</span><span style={{ color:T.ink }}>{val}</span>
                </div>
              ))}
              <div style={{ display:'flex', justifyContent:'space-between', padding:'8px 0', fontSize:13, fontWeight:700 }}>
                <span style={{ color:T.sub }}>Total</span><span style={{ color:T.green }}>{fmt(selected.total_charge)}</span>
              </div>
              <div style={{ display:'flex', justifyContent:'space-between', padding:'4px 0', fontSize:12 }}>
                <span style={{ color:T.sub }}>Advance Paid</span><span style={{ color:T.amber }}>{fmt(selected.advance_paid)}</span>
              </div>
              <div style={{ display:'flex', justifyContent:'space-between', padding:'4px 0', fontSize:13, fontWeight:700 }}>
                <span style={{ color:T.sub }}>Balance Due</span><span style={{ color:T.red }}>{fmt((selected.total_charge||0)-(selected.advance_paid||0))}</span>
              </div>

              {/* Status update */}
              <div style={{ marginTop:14, fontWeight:700, color:T.ink, marginBottom:10, fontSize:13 }}>Update Status</div>
              <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                {STATUS_FLOW.filter(s=>s.id!==selected.status&&s.id!=='cancelled').map(s=>(
                  <button key={s.id} onClick={()=>updateStatus(selected,s.id)}
                    style={{ background:s.color+'22', color:s.color, border:`1px solid ${s.color}44`, borderRadius:7, padding:'8px 12px', fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:'inherit', display:'flex', alignItems:'center', gap:8 }}>
                    {s.icon} Mark as {s.label} {selected.customer_phone?'+ Send WhatsApp':''}
                  </button>
                ))}
              </div>

              {selected.customer_phone && (
                <button onClick={()=>sendStatusWhatsApp(selected)}
                  style={{ width:'100%', marginTop:10, background:'#25d36622', color:'#25d366', border:'none', borderRadius:8, padding:'9px', fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>
                  💬 Send WhatsApp Update
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {showForm && <RepairForm repair={editItem} tenantId={tenant?.id}
        onSave={async(data)=>{ setShowForm(false); await load(); setSelected(data); }}
        onCancel={()=>setShowForm(false)} />}
    </div>
  );
}
