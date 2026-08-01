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
  { id:'new',         label:'New Lead',     color:T.muted,  icon:'🆕' },
  { id:'contacted',   label:'Contacted',    color:T.blue,   icon:'📞' },
  { id:'interested',  label:'Interested',   color:T.teal,   icon:'🤝' },
  { id:'proposal',    label:'Proposal',     color:T.purple, icon:'📋' },
  { id:'negotiation', label:'Negotiating',  color:T.amber,  icon:'💬' },
  { id:'won',         label:'Won',          color:T.green,  icon:'🏆' },
  { id:'lost',        label:'Lost',         color:T.red,    icon:'❌' },
];

const SOURCES = ['walk-in','whatsapp','phone','referral','social','website','exhibition','other'];

export default function CRMPipeline({ tenant }) {
  const [leads,   setLeads]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm,setShowForm]= useState(false);
  const [editLead,setEditLead]= useState(null);
  const [view,    setView]    = useState('kanban'); // kanban | table
  const [saving,  setSaving]  = useState(false);
  const [form,    setForm]    = useState({ name:'', phone:'', email:'', company:'', source:'walk-in', stage:'new', value:'', probability:'50', assigned_to:'', notes:'', next_followup:'' });

  useEffect(() => { if (tenant?.id) load(); }, [tenant?.id]);

  async function load() {
    setLoading(true);
    const { data } = await supabase.from('crm_leads').select('*').eq('tenant_id', tenant.id).order('created_at', { ascending:false });
    setLeads(data||[]);
    setLoading(false);
  }

  function openNew()     { setEditLead(null); setForm({ name:'', phone:'', email:'', company:'', source:'walk-in', stage:'new', value:'', probability:'50', assigned_to:'', notes:'', next_followup:'' }); setShowForm(true); }
  function openEdit(l)   { setEditLead(l); setForm({ ...l, value:l.value||'', probability:l.probability||50, next_followup:l.next_followup||'' }); setShowForm(true); }

  async function saveLead(e) {
    e.preventDefault();
    setSaving(true);
    const payload = { ...form, tenant_id:tenant.id, value:parseFloat(form.value)||0, probability:parseInt(form.probability)||50 };
    if (editLead) await supabase.from('crm_leads').update(payload).eq('id', editLead.id);
    else          await supabase.from('crm_leads').insert(payload);
    setShowForm(false); setSaving(false); await load();
  }

  async function moveStage(lead, stage) {
    await supabase.from('crm_leads').update({ stage, updated_at:new Date().toISOString() }).eq('id', lead.id);
    setLeads(prev=>prev.map(l=>l.id===lead.id?{...l,stage}:l));
  }

  function contactLead(lead) {
    if (lead.phone) window.open(`https://wa.me/${lead.phone.replace(/\D/g,'').replace(/^0/,'91')}?text=${encodeURIComponent(`Hi ${lead.name}! This is ${tenant?.name||'Elite Store'}. Following up on your enquiry. How can we help you today? 😊`)}`, '_blank');
    else if (lead.email) window.open(`mailto:${lead.email}?subject=Following up - ${tenant?.name}`, '_blank');
  }

  const totalPipeline = leads.filter(l=>!['won','lost'].includes(l.stage)).reduce((s,l)=>s+(l.value*l.probability/100||0),0);
  const wonRevenue    = leads.filter(l=>l.stage==='won').reduce((s,l)=>s+(l.value||0),0);
  const today         = new Date().toISOString().slice(0,10);
  const followupToday = leads.filter(l=>l.next_followup===today&&!['won','lost'].includes(l.stage));

  const inp = { background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:8, padding:'8px 11px', color:T.ink, fontSize:13, fontFamily:'inherit', outline:'none', width:'100%' };

  return (
    <div style={{ padding:20 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
        <div>
          <div style={{ fontSize:22, fontWeight:800, color:T.ink }}>🎯 Sales Pipeline</div>
          <div style={{ fontSize:13, color:T.sub }}>{leads.filter(l=>!['won','lost'].includes(l.stage)).length} active leads · {fmt(totalPipeline)} weighted pipeline</div>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <div style={{ display:'flex', background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:8, overflow:'hidden' }}>
            {[['kanban','🗂️'],['table','📋']].map(([v,icon])=><button key={v} onClick={()=>setView(v)} style={{ background:view===v?T.blue:'transparent', color:view===v?'#fff':T.sub, border:'none', padding:'8px 14px', cursor:'pointer', fontSize:12, fontFamily:'inherit' }}>{icon} {v}</button>)}
          </div>
          <button onClick={openNew} style={{ background:T.blue, color:'#fff', border:'none', borderRadius:9, padding:'10px 18px', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>+ New Lead</button>
        </div>
      </div>

      {followupToday.length>0&&<div style={{ background:T.amber+'12', border:`1px solid ${T.amber}33`, borderRadius:10, padding:'10px 14px', marginBottom:14 }}>
        <div style={{ fontWeight:700, color:T.amber, marginBottom:6 }}>📅 {followupToday.length} Follow-ups Due Today</div>
        <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
          {followupToday.map(l=><button key={l.id} onClick={()=>contactLead(l)} style={{ background:T.amber+'22', color:T.amber, border:'none', borderRadius:6, padding:'4px 10px', fontSize:11, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>💬 {l.name}</button>)}
        </div>
      </div>}

      {/* Stats */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:10, marginBottom:18 }}>
        {[['Pipeline',fmt(totalPipeline),T.blue],['Won',fmt(wonRevenue),T.green],['Leads',leads.length,T.purple],['Win Rate',leads.filter(l=>l.stage==='won').length+leads.filter(l=>l.stage==='lost').length>0?Math.round(leads.filter(l=>l.stage==='won').length/(leads.filter(l=>l.stage==='won').length+leads.filter(l=>l.stage==='lost').length)*100)+'%':'—',T.amber],['Follow-ups',followupToday.length,followupToday.length>0?T.red:T.muted]].map(([label,val,color])=>(
          <div key={label} style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:9, padding:'10px 14px' }}>
            <div style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', marginBottom:4 }}>{label}</div>
            <div style={{ fontSize:18, fontWeight:800, color }}>{val}</div>
          </div>
        ))}
      </div>

      {/* Kanban view */}
      {view==='kanban'&&(
        <div style={{ display:'flex', gap:12, overflowX:'auto', paddingBottom:8 }}>
          {STAGES.map(stage=>{
            const stageLeads = leads.filter(l=>l.stage===stage.id);
            const stageValue = stageLeads.reduce((s,l)=>s+(l.value||0),0);
            return (
              <div key={stage.id} style={{ minWidth:200, flex:'0 0 200px' }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8, padding:'8px 10px', background:stage.color+'22', borderRadius:8, border:`1px solid ${stage.color}44` }}>
                  <div><span style={{ fontSize:14 }}>{stage.icon}</span> <span style={{ fontSize:11, fontWeight:700, color:stage.color }}>{stage.label}</span></div>
                  <span style={{ background:stage.color+'33', color:stage.color, borderRadius:12, padding:'1px 8px', fontSize:11, fontWeight:700 }}>{stageLeads.length}</span>
                </div>
                {stageValue>0&&<div style={{ fontSize:10, color:T.muted, marginBottom:8, paddingLeft:2 }}>{fmt(stageValue)} total</div>}
                <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                  {stageLeads.map(lead=>(
                    <div key={lead.id} style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:9, padding:'10px 12px', cursor:'pointer' }} onClick={()=>openEdit(lead)}>
                      <div style={{ fontSize:13, fontWeight:700, color:T.ink, marginBottom:4 }}>{lead.name}</div>
                      {lead.company&&<div style={{ fontSize:10, color:T.muted }}>{lead.company}</div>}
                      {lead.value>0&&<div style={{ fontSize:13, fontWeight:700, color:T.green, marginTop:4 }}>{fmt(lead.value)}</div>}
                      <div style={{ display:'flex', gap:4, marginTop:6 }}>
                        <span style={{ background:T.blue+'22', color:T.blue, borderRadius:4, padding:'1px 6px', fontSize:9, textTransform:'capitalize' }}>{lead.source}</span>
                        {lead.probability&&stage.id!=='won'&&stage.id!=='lost'&&<span style={{ background:T.amber+'22', color:T.amber, borderRadius:4, padding:'1px 6px', fontSize:9 }}>{lead.probability}%</span>}
                      </div>
                      {lead.next_followup&&<div style={{ fontSize:9, color:lead.next_followup<today?T.red:T.muted, marginTop:4 }}>📅 {lead.next_followup}</div>}
                      {/* Quick move buttons */}
                      <div style={{ display:'flex', gap:4, marginTop:7 }} onClick={e=>e.stopPropagation()}>
                        {lead.phone&&<button onClick={()=>contactLead(lead)} style={{ background:'#25d36622', color:'#25d366', border:'none', borderRadius:4, padding:'3px 7px', fontSize:9, cursor:'pointer', fontFamily:'inherit' }}>💬</button>}
                        {STAGES.findIndex(s=>s.id===lead.stage)<5&&<button onClick={()=>moveStage(lead,STAGES[STAGES.findIndex(s=>s.id===lead.stage)+1].id)} style={{ background:T.blue+'22', color:T.blue, border:'none', borderRadius:4, padding:'3px 7px', fontSize:9, cursor:'pointer', fontFamily:'inherit' }}>→ Next</button>}
                      </div>
                    </div>
                  ))}
                  {stageLeads.length===0&&<div style={{ background:T.card, borderRadius:8, padding:'20px 12px', textAlign:'center', color:T.muted, fontSize:11, border:`1px dashed ${T.bdr}` }}>No leads</div>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Table view */}
      {view==='table'&&(
        <div style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:12, overflow:'hidden' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
            <thead><tr style={{ background:T.card }}>
              {['Name','Company','Stage','Value','Prob.','Source','Follow-up','Actions'].map(h=><th key={h} style={{ padding:'9px 14px', textAlign:'left', fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', borderBottom:`1px solid ${T.bdr}` }}>{h}</th>)}
            </tr></thead>
            <tbody>
              {leads.map(lead=>{
                const stage = STAGES.find(s=>s.id===lead.stage)||STAGES[0];
                return (
                  <tr key={lead.id} style={{ borderBottom:`1px solid ${T.bdr}22` }}>
                    <td style={{ padding:'10px 14px', color:T.ink, fontWeight:600 }}>{lead.name}<br/><span style={{ fontSize:10, color:T.muted }}>{lead.phone}</span></td>
                    <td style={{ padding:'10px 14px', color:T.sub }}>{lead.company||'—'}</td>
                    <td style={{ padding:'10px 14px' }}><span style={{ background:stage.color+'22', color:stage.color, borderRadius:5, padding:'2px 8px', fontSize:10, fontWeight:700 }}>{stage.icon} {stage.label}</span></td>
                    <td style={{ padding:'10px 14px', color:T.green, fontWeight:700 }}>{lead.value?fmt(lead.value):'—'}</td>
                    <td style={{ padding:'10px 14px', color:T.amber }}>{lead.probability}%</td>
                    <td style={{ padding:'10px 14px', color:T.sub, textTransform:'capitalize' }}>{lead.source}</td>
                    <td style={{ padding:'10px 14px', color:lead.next_followup&&lead.next_followup<today?T.red:T.muted }}>{lead.next_followup||'—'}</td>
                    <td style={{ padding:'10px 14px' }}>
                      <div style={{ display:'flex', gap:5 }}>
                        <button onClick={()=>openEdit(lead)} style={{ background:T.blue+'22', color:T.blue, border:'none', borderRadius:5, padding:'4px 8px', fontSize:10, cursor:'pointer', fontFamily:'inherit' }}>✏️</button>
                        {lead.phone&&<button onClick={()=>contactLead(lead)} style={{ background:'#25d36622', color:'#25d366', border:'none', borderRadius:5, padding:'4px 8px', fontSize:10, cursor:'pointer', fontFamily:'inherit' }}>💬</button>}
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
              <button onClick={()=>setShowForm(false)} style={{ background:'none', border:'none', color:T.muted, cursor:'pointer', fontSize:22 }}>×</button>
            </div>
            <form onSubmit={saveLead}>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                {[['Name *','text','name'],['Phone','tel','phone'],['Email','email','email'],['Company','text','company']].map(([label,type,key])=>(
                  <div key={key}><label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:4 }}>{label}</label><input type={type} value={form[key]} onChange={e=>setForm(f=>({...f,[key]:e.target.value}))} required={label.includes('*')} style={inp}/></div>
                ))}
                <div><label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:4 }}>Stage</label>
                  <select value={form.stage} onChange={e=>setForm(f=>({...f,stage:e.target.value}))} style={{ ...inp, cursor:'pointer' }}>
                    {STAGES.map(s=><option key={s.id} value={s.id}>{s.icon} {s.label}</option>)}
                  </select>
                </div>
                <div><label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:4 }}>Source</label>
                  <select value={form.source} onChange={e=>setForm(f=>({...f,source:e.target.value}))} style={{ ...inp, cursor:'pointer' }}>
                    {SOURCES.map(s=><option key={s} value={s} style={{ textTransform:'capitalize' }}>{s}</option>)}
                  </select>
                </div>
                <div><label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:4 }}>Deal Value</label><input type="number" value={form.value} onChange={e=>setForm(f=>({...f,value:e.target.value}))} placeholder="Rs." style={inp}/></div>
                <div><label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:4 }}>Win Probability %</label><input type="number" min={0} max={100} value={form.probability} onChange={e=>setForm(f=>({...f,probability:e.target.value}))} style={inp}/></div>
                <div><label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:4 }}>Assigned To</label><input value={form.assigned_to} onChange={e=>setForm(f=>({...f,assigned_to:e.target.value}))} style={inp}/></div>
                <div><label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:4 }}>Next Follow-up</label><input type="date" value={form.next_followup} onChange={e=>setForm(f=>({...f,next_followup:e.target.value}))} style={inp}/></div>
                <div style={{ gridColumn:'1/-1' }}><label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:4 }}>Notes</label><textarea value={form.notes} onChange={e=>setForm(f=>({...f,notes:e.target.value}))} rows={2} style={{ ...inp, resize:'vertical' }}/></div>
              </div>
              <div style={{ display:'flex', gap:10, marginTop:14 }}>
                <button type="button" onClick={()=>setShowForm(false)} style={{ flex:1, background:T.card, color:T.sub, border:`1px solid ${T.bdr}`, borderRadius:8, padding:'11px', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>Cancel</button>
                <button type="submit" disabled={saving} style={{ flex:2, background:T.blue, color:'#fff', border:'none', borderRadius:8, padding:'11px', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>{saving?'Saving…':(editLead?'Update Lead':'Add Lead')}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
