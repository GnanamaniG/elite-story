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

const STAGES = [
  { id:'new',         label:'New Lead',    color:'#6b7598', icon:'🆕' },
  { id:'contacted',   label:'Contacted',   color:'#4f7cff', icon:'📞' },
  { id:'interested',  label:'Interested',  color:'#9b72ff', icon:'👍' },
  { id:'quoted',      label:'Quoted',      color:'#ffb547', icon:'📋' },
  { id:'negotiating', label:'Negotiating', color:'#ff7043', icon:'🤝' },
  { id:'won',         label:'Won',         color:'#00d68f', icon:'🏆' },
  { id:'lost',        label:'Lost',        color:'#ff4d6a', icon:'❌' },
];

const SOURCES = ['walk-in','whatsapp','instagram','referral','website','cold-call','other'];
const STAFF   = ['Gnanamani','Store Staff 1','Store Staff 2'];

export default function SalesPipeline({ tenant }) {
  const [leads,    setLeads]    = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [view,     setView]     = useState('kanban'); // kanban | list
  const [showForm, setShowForm] = useState(false);
  const [editLead, setEditLead] = useState(null);
  const [saving,   setSaving]   = useState(false);
  const [form,     setForm]     = useState({ name:'', phone:'', email:'', source:'walk-in', product_interest:'', est_value:'', stage:'new', assigned_to:'', next_followup:'', notes:'' });

  useEffect(() => { if (tenant?.id) load(); }, [tenant?.id]);

  async function load() {
    setLoading(true);
    const { data } = await supabase.from('leads').select('*').eq('tenant_id', tenant.id).order('updated_at', { ascending:false });
    setLeads(data||[]);
    setLoading(false);
  }

  async function saveLead(e) {
    e.preventDefault();
    setSaving(true);
    const payload = { ...form, tenant_id:tenant.id, est_value:parseFloat(form.est_value)||0, updated_at:new Date().toISOString() };
    try {
      if (editLead) await supabase.from('leads').update(payload).eq('id', editLead.id);
      else await supabase.from('leads').insert(payload);
      setShowForm(false); setEditLead(null); resetForm(); await load();
    } catch(e) { alert('Error: '+e.message); }
    finally { setSaving(false); }
  }

  function resetForm() { setForm({ name:'', phone:'', email:'', source:'walk-in', product_interest:'', est_value:'', stage:'new', assigned_to:'', next_followup:'', notes:'' }); }

  function openEdit(l) { setEditLead(l); setForm({ name:l.name, phone:l.phone||'', email:l.email||'', source:l.source, product_interest:l.product_interest||'', est_value:l.est_value||'', stage:l.stage, assigned_to:l.assigned_to||'', next_followup:l.next_followup||'', notes:l.notes||'' }); setShowForm(true); }

  async function moveStage(leadId, newStage) {
    await supabase.from('leads').update({ stage:newStage, updated_at:new Date().toISOString() }).eq('id', leadId);
    setLeads(prev=>prev.map(l=>l.id===leadId?{...l,stage:newStage}:l));
  }

  function callLead(lead) { if (lead.phone) window.open(`tel:${lead.phone}`, '_self'); }
  function whatsappLead(lead) {
    const msg = `Hi ${lead.name}! 👋\n\nThank you for your interest in *${tenant?.name||'Elite Store'}*.\n\n${lead.product_interest?`We noticed you're interested in: *${lead.product_interest}*\n\n`:''}We'd love to assist you. Please let us know how we can help.\n\nLooking forward to connecting! 😊`;
    const ph  = (lead.phone||'').replace(/\D/g,'').replace(/^0/,'91');
    window.open(`https://wa.me/${ph}?text=${encodeURIComponent(msg)}`, '_blank');
  }

  const today      = new Date().toISOString().slice(0,10);
  const overdue    = leads.filter(l=>l.next_followup&&l.next_followup<today&&!['won','lost'].includes(l.stage));
  const totalPipe  = leads.filter(l=>!['won','lost'].includes(l.stage)).reduce((s,l)=>s+(l.est_value||0),0);
  const wonValue   = leads.filter(l=>l.stage==='won').reduce((s,l)=>s+(l.est_value||0),0);
  const inp = { background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:8, padding:'8px 11px', color:T.ink, fontSize:13, fontFamily:'inherit', outline:'none', width:'100%' };

  return (
    <div style={{ padding:20 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
        <div>
          <div style={{ fontSize:22, fontWeight:800, color:T.ink }}>🎯 Sales Pipeline</div>
          <div style={{ fontSize:13, color:T.sub }}>{leads.filter(l=>!['won','lost'].includes(l.stage)).length} active · {fmt(totalPipe)} pipeline · {fmt(wonValue)} won</div>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <div style={{ display:'flex', background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:8, overflow:'hidden' }}>
            {[['kanban','📊'],['list','📋']].map(([id,icon])=><button key={id} onClick={()=>setView(id)} style={{ background:view===id?T.blue:'transparent', color:view===id?'#fff':T.sub, border:'none', padding:'8px 14px', fontSize:13, cursor:'pointer', fontFamily:'inherit' }}>{icon}</button>)}
          </div>
          <button onClick={()=>{setEditLead(null);resetForm();setShowForm(true);}} style={{ background:T.blue, color:'#fff', border:'none', borderRadius:9, padding:'10px 18px', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>+ New Lead</button>
        </div>
      </div>

      {overdue.length>0&&<div style={{ background:T.red+'12', border:`1px solid ${T.red}33`, borderRadius:10, padding:'10px 14px', marginBottom:14, fontSize:12, color:T.red }}>
        ⚠️ {overdue.length} leads overdue for follow-up: {overdue.map(l=>l.name).join(', ')}
      </div>}

      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12, marginBottom:20 }}>
        {[['Pipeline',fmt(totalPipe),T.blue],['Won',fmt(wonValue),T.green],['Lost',leads.filter(l=>l.stage==='lost').length+' leads',T.red],['Follow-ups Due',overdue.length,T.amber]].map(([label,val,color])=>(
          <div key={label} style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:10, padding:'12px 16px' }}>
            <div style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', marginBottom:5 }}>{label}</div>
            <div style={{ fontSize:18, fontWeight:800, color }}>{val}</div>
          </div>
        ))}
      </div>

      {/* Kanban view */}
      {view==='kanban'&&(
        <div style={{ display:'flex', gap:10, overflowX:'auto', paddingBottom:10 }}>
          {STAGES.map(stage=>{
            const stageLeads = leads.filter(l=>l.stage===stage.id);
            const stageValue = stageLeads.reduce((s,l)=>s+(l.est_value||0),0);
            return (
              <div key={stage.id} style={{ minWidth:220, maxWidth:220 }}>
                <div style={{ background:T.card, borderRadius:'10px 10px 0 0', padding:'10px 14px', borderTop:`3px solid ${stage.color}`, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                  <div>
                    <div style={{ fontSize:12, fontWeight:700, color:stage.color }}>{stage.icon} {stage.label}</div>
                    <div style={{ fontSize:10, color:T.muted }}>{stageLeads.length} · {fmt(stageValue)}</div>
                  </div>
                </div>
                <div style={{ background:T.srf, borderRadius:'0 0 10px 10px', border:`1px solid ${T.bdr}`, borderTop:'none', minHeight:200, padding:8, display:'flex', flexDirection:'column', gap:6 }}>
                  {stageLeads.map(lead=>(
                    <div key={lead.id} style={{ background:T.card, borderRadius:8, padding:'10px 12px', border:`1px solid ${T.bdr}22`, cursor:'pointer' }} onClick={()=>openEdit(lead)}>
                      <div style={{ fontSize:13, fontWeight:600, color:T.ink, marginBottom:4 }}>{lead.name}</div>
                      {lead.product_interest&&<div style={{ fontSize:10, color:T.sub, marginBottom:4 }}>🛍️ {lead.product_interest}</div>}
                      {lead.est_value>0&&<div style={{ fontSize:11, color:T.green, fontWeight:700 }}>{fmt(lead.est_value)}</div>}
                      {lead.next_followup&&<div style={{ fontSize:10, color:lead.next_followup<today?T.red:T.muted, marginTop:3 }}>📅 {lead.next_followup}</div>}
                      <div style={{ display:'flex', gap:5, marginTop:6 }}>
                        {lead.phone&&<button onClick={e=>{e.stopPropagation();whatsappLead(lead);}} style={{ background:'#25d36622', color:'#25d366', border:'none', borderRadius:4, padding:'3px 7px', fontSize:9, cursor:'pointer', fontFamily:'inherit' }}>💬</button>}
                        {STAGES.filter(s=>s.id!==stage.id&&s.id!=='lost').slice(0,2).map(s=>(
                          <button key={s.id} onClick={e=>{e.stopPropagation();moveStage(lead.id,s.id);}} style={{ background:s.color+'22', color:s.color, border:'none', borderRadius:4, padding:'3px 7px', fontSize:9, cursor:'pointer', fontFamily:'inherit' }}>→{s.label.split(' ')[0]}</button>
                        ))}
                      </div>
                    </div>
                  ))}
                  {stageLeads.length===0&&<div style={{ textAlign:'center', color:T.muted, fontSize:11, padding:20 }}>No leads</div>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* List view */}
      {view==='list'&&(
        <div style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:12, overflow:'hidden' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
            <thead><tr style={{ background:T.card }}>
              {['Name','Source','Interest','Est. Value','Assigned','Follow-up','Stage','Actions'].map(h=><th key={h} style={{ padding:'9px 12px', textAlign:'left', fontSize:9, color:T.sub, fontWeight:700, textTransform:'uppercase', borderBottom:`1px solid ${T.bdr}` }}>{h}</th>)}
            </tr></thead>
            <tbody>
              {loading?<tr><td colSpan={8} style={{ textAlign:'center', padding:40, color:T.sub }}>Loading…</td></tr>
              :leads.map(l=>{
                const stage = STAGES.find(s=>s.id===l.stage);
                const due   = l.next_followup&&l.next_followup<today;
                return (
                  <tr key={l.id} style={{ borderBottom:`1px solid ${T.bdr}22` }}>
                    <td style={{ padding:'9px 12px', color:T.ink, fontWeight:600 }}>{l.name}<br/><span style={{ fontSize:10, color:T.muted }}>{l.phone}</span></td>
                    <td style={{ padding:'9px 12px' }}><span style={{ background:T.blue+'22', color:T.blue, borderRadius:5, padding:'1px 7px', fontSize:10, textTransform:'capitalize' }}>{l.source}</span></td>
                    <td style={{ padding:'9px 12px', color:T.sub, fontSize:11 }}>{l.product_interest||'—'}</td>
                    <td style={{ padding:'9px 12px', color:T.green, fontWeight:700 }}>{l.est_value>0?fmt(l.est_value):'—'}</td>
                    <td style={{ padding:'9px 12px', color:T.muted, fontSize:11 }}>{l.assigned_to||'—'}</td>
                    <td style={{ padding:'9px 12px', color:due?T.red:T.muted, fontSize:11 }}>{l.next_followup||'—'}{due?' ⚠️':''}</td>
                    <td style={{ padding:'9px 12px' }}><span style={{ background:(stage?.color||T.muted)+'22', color:stage?.color||T.muted, borderRadius:5, padding:'2px 8px', fontSize:10, fontWeight:700 }}>{stage?.icon} {stage?.label}</span></td>
                    <td style={{ padding:'9px 12px' }}>
                      <div style={{ display:'flex', gap:5 }}>
                        <button onClick={()=>openEdit(l)} style={{ background:T.blue+'22', color:T.blue, border:'none', borderRadius:5, padding:'4px 8px', fontSize:10, cursor:'pointer', fontFamily:'inherit' }}>✏️</button>
                        {l.phone&&<button onClick={()=>whatsappLead(l)} style={{ background:'#25d36622', color:'#25d366', border:'none', borderRadius:5, padding:'4px 8px', fontSize:10, cursor:'pointer', fontFamily:'inherit' }}>💬</button>}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {showForm&&(
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.85)', zIndex:200, display:'flex', alignItems:'flex-start', justifyContent:'center', padding:20, overflowY:'auto' }}>
          <div style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:14, padding:24, width:'100%', maxWidth:520, margin:'20px 0' }}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:18 }}>
              <div style={{ fontSize:17, fontWeight:700, color:T.ink }}>{editLead?'Edit Lead':'New Lead'}</div>
              <button onClick={()=>{setShowForm(false);setEditLead(null);resetForm();}} style={{ background:'none', border:'none', color:T.muted, cursor:'pointer', fontSize:22 }}>×</button>
            </div>
            <form onSubmit={saveLead}>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                {[['Name *','text','name'],['Phone','tel','phone'],['Email','email','email'],['Est. Value','number','est_value']].map(([label,type,key])=>(
                  <div key={key}><label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:4 }}>{label}</label><input type={type} value={form[key]} onChange={e=>setForm(f=>({...f,[key]:e.target.value}))} required={label.includes('*')} style={inp}/></div>
                ))}
                <div><label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:4 }}>Source</label>
                  <select value={form.source} onChange={e=>setForm(f=>({...f,source:e.target.value}))} style={{ ...inp, cursor:'pointer' }}>
                    {SOURCES.map(s=><option key={s} value={s} style={{ textTransform:'capitalize' }}>{s.charAt(0).toUpperCase()+s.slice(1)}</option>)}
                  </select>
                </div>
                <div><label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:4 }}>Stage</label>
                  <select value={form.stage} onChange={e=>setForm(f=>({...f,stage:e.target.value}))} style={{ ...inp, cursor:'pointer' }}>
                    {STAGES.map(s=><option key={s.id} value={s.id}>{s.icon} {s.label}</option>)}
                  </select>
                </div>
                <div><label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:4 }}>Assigned To</label>
                  <select value={form.assigned_to} onChange={e=>setForm(f=>({...f,assigned_to:e.target.value}))} style={{ ...inp, cursor:'pointer' }}>
                    <option value="">Unassigned</option>
                    {STAFF.map(s=><option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div><label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:4 }}>Follow-up Date</label><input type="date" value={form.next_followup} onChange={e=>setForm(f=>({...f,next_followup:e.target.value}))} style={inp}/></div>
                <div style={{ gridColumn:'1/-1' }}><label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:4 }}>Product Interest</label><input value={form.product_interest} onChange={e=>setForm(f=>({...f,product_interest:e.target.value}))} placeholder="e.g. Men's Formal Shoes, Bags" style={inp}/></div>
                <div style={{ gridColumn:'1/-1' }}><label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:4 }}>Notes</label><textarea value={form.notes} onChange={e=>setForm(f=>({...f,notes:e.target.value}))} rows={2} style={{ ...inp, resize:'vertical' }}/></div>
              </div>
              <div style={{ display:'flex', gap:10, marginTop:16 }}>
                <button type="button" onClick={()=>{setShowForm(false);setEditLead(null);resetForm();}} style={{ flex:1, background:T.card, color:T.sub, border:`1px solid ${T.bdr}`, borderRadius:8, padding:'11px', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>Cancel</button>
                <button type="submit" disabled={saving} style={{ flex:2, background:T.blue, color:'#fff', border:'none', borderRadius:8, padding:'11px', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>{saving?'Saving…':(editLead?'Update Lead':'Add Lead')}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
