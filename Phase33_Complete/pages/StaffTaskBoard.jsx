import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

const T = {
  bg:'#F7F3F3', srf:'#FFFFFF', card:'#FFFFFF', bdr:'#E8DEDE',
  red:'#C0392B', darkRed:'#8B0000', lightRed:'#FEF2F2',
  green:'#16A34A', amber:'#D97706', blue:'#2563EB', purple:'#7C3AED',
  ink:'#111827', sub:'#6B7280', muted:'#9CA3AF', white:'#FFFFFF'
};

const COLUMNS = [
  { id:'todo',       label:'To Do',       color:'#6B7280', bg:'#F9FAFB', border:'#E5E7EB' },
  { id:'inprogress', label:'In Progress', color:'#2563EB', bg:'#EFF6FF', border:'#BFDBFE' },
  { id:'review',     label:'Review',      color:'#7C3AED', bg:'#F5F3FF', border:'#DDD6FE' },
  { id:'done',       label:'Done',        color:'#16A34A', bg:'#F0FDF4', border:'#BBF7D0' },
];

const PRIORITY = {
  low:    { label:'Low',    color:'#6B7280', bg:'#F9FAFB' },
  normal: { label:'Normal', color:'#2563EB', bg:'#EFF6FF' },
  high:   { label:'High',   color:'#D97706', bg:'#FFFBEB' },
  urgent: { label:'Urgent', color:'#C0392B', bg:'#FEF2F2' },
};

const STAFF  = ['Gnanamani','Store Staff 1','Store Staff 2','All Staff'];
const btn    = (bg,color,extra={}) => ({ background:bg, color, border:'none', borderRadius:8, padding:'9px 16px', fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:'inherit', ...extra });
const inp    = { background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:8, padding:'9px 12px', color:T.ink, fontSize:13, fontFamily:'inherit', outline:'none', width:'100%' };

export default function StaffTaskBoard({ tenant }) {
  const [tasks,    setTasks]    = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editTask, setEditTask] = useState(null);
  const [saving,   setSaving]   = useState(false);
  const [dragId,   setDragId]   = useState(null);
  const [view,     setView]     = useState('kanban');
  const [filterBy, setFilterBy] = useState('all');
  const [form, setForm] = useState({ title:'', description:'', assigned_to:'', priority:'normal', due_date:'', tags:'' });

  useEffect(() => { if (tenant?.id) load(); }, [tenant?.id]);

  async function load() {
    setLoading(true);
    const { data } = await supabase.from('staff_tasks').select('*').eq('tenant_id', tenant.id).order('updated_at', { ascending:false });
    setTasks(data||[]);
    setLoading(false);
  }

  async function save(e) {
    e.preventDefault(); setSaving(true);
    const payload = { ...form, tenant_id:tenant.id, tags:form.tags?form.tags.split(',').map(t=>t.trim()).filter(Boolean):[], updated_at:new Date().toISOString() };
    if (editTask) await supabase.from('staff_tasks').update(payload).eq('id', editTask.id);
    else await supabase.from('staff_tasks').insert({ ...payload, status:'todo' });
    setShowForm(false); setEditTask(null);
    setForm({ title:'', description:'', assigned_to:'', priority:'normal', due_date:'', tags:'' });
    setSaving(false); await load();
  }

  async function moveTask(id, newStatus) {
    await supabase.from('staff_tasks').update({ status:newStatus, updated_at:new Date().toISOString() }).eq('id', id);
    setTasks(prev=>prev.map(t=>t.id===id?{...t,status:newStatus}:t));
  }

  async function deleteTask(id) {
    if (!confirm('Delete this task?')) return;
    await supabase.from('staff_tasks').delete().eq('id', id);
    setTasks(prev=>prev.filter(t=>t.id!==id));
  }

  function openEdit(t) {
    setEditTask(t);
    setForm({ title:t.title, description:t.description||'', assigned_to:t.assigned_to||'', priority:t.priority||'normal', due_date:t.due_date||'', tags:(t.tags||[]).join(', ') });
    setShowForm(true);
  }

  const today    = new Date().toISOString().slice(0,10);
  const overdue  = tasks.filter(t=>t.due_date&&t.due_date<today&&t.status!=='done');
  const filtered = filterBy==='all' ? tasks : tasks.filter(t=>t.assigned_to===filterBy);

  const TaskCard = ({ task }) => {
    const p   = PRIORITY[task.priority]||PRIORITY.normal;
    const col = COLUMNS.find(c=>c.id===task.status)||COLUMNS[0];
    const due = task.due_date && task.due_date < today && task.status !== 'done';
    return (
      <div draggable onDragStart={()=>setDragId(task.id)}
        style={{ background:T.white, border:`1px solid ${T.bdr}`, borderRadius:10, padding:'12px 14px', marginBottom:8, cursor:'grab', boxShadow:'0 1px 3px rgba(0,0,0,.06)', borderLeft:`3px solid ${p.color}` }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:6 }}>
          <div style={{ fontSize:13, fontWeight:700, color:T.ink, flex:1, lineHeight:1.3 }}>{task.title}</div>
          <div style={{ display:'flex', gap:4, marginLeft:8 }}>
            <button onClick={()=>openEdit(task)} style={{ background:'none', border:'none', color:T.muted, cursor:'pointer', padding:2, fontSize:12 }}>✏️</button>
            <button onClick={()=>deleteTask(task.id)} style={{ background:'none', border:'none', color:T.muted, cursor:'pointer', padding:2, fontSize:12 }}>×</button>
          </div>
        </div>
        {task.description&&<div style={{ fontSize:11, color:T.sub, marginBottom:8, lineHeight:1.5 }}>{task.description}</div>}
        <div style={{ display:'flex', flexWrap:'wrap', gap:5, marginBottom:task.due_date||task.assigned_to?8:0 }}>
          <span style={{ background:p.bg, color:p.color, borderRadius:5, padding:'1px 7px', fontSize:9, fontWeight:700 }}>{p.label}</span>
          {(task.tags||[]).map(tag=><span key={tag} style={{ background:'#F3F4F6', color:T.sub, borderRadius:5, padding:'1px 7px', fontSize:9 }}>#{tag}</span>)}
        </div>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', fontSize:10, color:T.muted }}>
          {task.assigned_to&&<span style={{ color:T.blue }}>👤 {task.assigned_to}</span>}
          {task.due_date&&<span style={{ color:due?T.red:T.muted, fontWeight:due?700:400 }}>📅 {task.due_date}{due?' ⚠️':''}</span>}
        </div>
        {/* Move buttons */}
        <div style={{ display:'flex', gap:4, marginTop:8 }}>
          {COLUMNS.filter(c=>c.id!==task.status).map(c=>(
            <button key={c.id} onClick={()=>moveTask(task.id,c.id)} style={{ flex:1, background:c.bg, color:c.color, border:`1px solid ${c.border}`, borderRadius:5, padding:'3px 5px', fontSize:9, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>→ {c.label}</button>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div style={{ padding:24, background:T.bg, minHeight:'100%' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
        <div>
          <div style={{ fontSize:22, fontWeight:800, color:T.darkRed, letterSpacing:'-0.02em' }}>📋 Staff Task Board</div>
          <div style={{ fontSize:13, color:T.sub, marginTop:2 }}>{tasks.filter(t=>t.status!=='done').length} active · {overdue.length} overdue</div>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <div style={{ display:'flex', background:T.white, border:`1px solid ${T.bdr}`, borderRadius:8, overflow:'hidden' }}>
            {[['kanban','📊'],['list','📋']].map(([v,icon])=><button key={v} onClick={()=>setView(v)} style={{ padding:'8px 14px', background:view===v?T.red:'transparent', color:view===v?T.white:T.sub, border:'none', cursor:'pointer', fontFamily:'inherit', fontSize:13 }}>{icon}</button>)}
          </div>
          <button onClick={()=>{setEditTask(null);setForm({title:'',description:'',assigned_to:'',priority:'normal',due_date:'',tags:''});setShowForm(true);}} style={btn(T.red, T.white)}>+ New Task</button>
        </div>
      </div>

      {overdue.length>0&&<div style={{ background:'#FEF2F2', border:'1px solid #FECACA', borderRadius:10, padding:'10px 16px', marginBottom:16, fontSize:12, color:T.red, fontWeight:600 }}>
        ⚠️ {overdue.length} overdue tasks: {overdue.map(t=>t.title).slice(0,3).join(', ')}{overdue.length>3?'…':''}
      </div>}

      {/* Filter by staff */}
      <div style={{ display:'flex', gap:6, marginBottom:16 }}>
        {['all',...STAFF].map(s=>(
          <button key={s} onClick={()=>setFilterBy(s)} style={{ padding:'5px 12px', background:filterBy===s?T.red:T.white, color:filterBy===s?T.white:T.sub, border:`1px solid ${filterBy===s?T.red:T.bdr}`, borderRadius:20, fontSize:11, fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}>
            {s==='all'?'All Staff':s.split(' ')[0]}
          </button>
        ))}
      </div>

      {/* Kanban board */}
      {view==='kanban'&&(
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:14, alignItems:'flex-start' }}>
          {COLUMNS.map(col=>{
            const colTasks = filtered.filter(t=>t.status===col.id);
            return (
              <div key={col.id}
                onDragOver={e=>{e.preventDefault();}}
                onDrop={()=>{ if(dragId) { moveTask(dragId,col.id); setDragId(null); }}}>
                {/* Column header */}
                <div style={{ background:col.bg, border:`1px solid ${col.border}`, borderRadius:10, padding:'10px 14px', marginBottom:10, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                  <span style={{ fontSize:12, fontWeight:700, color:col.color }}>{col.label}</span>
                  <span style={{ background:col.color, color:T.white, borderRadius:20, width:22, height:22, display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:800 }}>{colTasks.length}</span>
                </div>
                {/* Tasks */}
                <div style={{ minHeight:100 }}>
                  {colTasks.map(t=><TaskCard key={t.id} task={t}/>)}
                  {colTasks.length===0&&<div style={{ border:`2px dashed ${T.bdr}`, borderRadius:10, padding:20, textAlign:'center', color:T.muted, fontSize:11 }}>Drop here</div>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* List view */}
      {view==='list'&&(
        <div style={{ background:T.white, border:`1px solid ${T.bdr}`, borderRadius:14, overflow:'hidden' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
            <thead><tr style={{ background:T.lightRed }}>
              {['Task','Priority','Assigned To','Due Date','Status','Actions'].map(h=>(
                <th key={h} style={{ padding:'11px 16px', textAlign:'left', fontSize:10, color:T.darkRed, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.05em', borderBottom:`1px solid ${T.bdr}` }}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {filtered.map(t=>{
                const p   = PRIORITY[t.priority]||PRIORITY.normal;
                const col = COLUMNS.find(c=>c.id===t.status)||COLUMNS[0];
                const due = t.due_date&&t.due_date<today&&t.status!=='done';
                return (
                  <tr key={t.id} style={{ borderBottom:`1px solid ${T.bdr}44` }}>
                    <td style={{ padding:'12px 16px', color:T.ink, fontWeight:600 }}>{t.title}{t.description&&<div style={{ fontSize:11, color:T.sub }}>{t.description}</div>}</td>
                    <td style={{ padding:'12px 16px' }}><span style={{ background:p.bg, color:p.color, borderRadius:5, padding:'2px 8px', fontSize:10, fontWeight:700 }}>{p.label}</span></td>
                    <td style={{ padding:'12px 16px', color:T.blue, fontSize:12 }}>{t.assigned_to||'—'}</td>
                    <td style={{ padding:'12px 16px', color:due?T.red:T.muted, fontSize:12, fontWeight:due?700:400 }}>{t.due_date||'—'}{due?' ⚠️':''}</td>
                    <td style={{ padding:'12px 16px' }}><span style={{ background:col.bg, color:col.color, border:`1px solid ${col.border}`, borderRadius:5, padding:'2px 8px', fontSize:10, fontWeight:700 }}>{col.label}</span></td>
                    <td style={{ padding:'12px 16px' }}>
                      <div style={{ display:'flex', gap:5 }}>
                        <button onClick={()=>openEdit(t)} style={{ background:T.lightRed, color:T.red, border:'none', borderRadius:6, padding:'4px 8px', fontSize:10, cursor:'pointer', fontFamily:'inherit' }}>✏️</button>
                        {t.status!=='done'&&<button onClick={()=>moveTask(t.id,'done')} style={{ background:'#F0FDF4', color:T.green, border:'none', borderRadius:6, padding:'4px 8px', fontSize:10, cursor:'pointer', fontFamily:'inherit' }}>✅</button>}
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
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.5)', zIndex:200, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
          <div style={{ background:T.white, borderRadius:16, padding:28, width:'100%', maxWidth:480, boxShadow:'0 20px 60px rgba(0,0,0,.2)' }}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:20 }}>
              <div style={{ fontSize:17, fontWeight:800, color:T.darkRed }}>{editTask?'Edit':'New'} Task</div>
              <button onClick={()=>{setShowForm(false);setEditTask(null);}} style={{ background:'none', border:'none', fontSize:22, cursor:'pointer', color:T.muted }}>×</button>
            </div>
            <form onSubmit={save}>
              <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                <div><label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:4 }}>Task Title *</label><input value={form.title} onChange={e=>setForm(f=>({...f,title:e.target.value}))} required style={inp}/></div>
                <div><label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:4 }}>Description</label><textarea value={form.description} onChange={e=>setForm(f=>({...f,description:e.target.value}))} rows={2} style={{ ...inp, resize:'vertical' }}/></div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                  <div><label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:4 }}>Assign To</label>
                    <select value={form.assigned_to} onChange={e=>setForm(f=>({...f,assigned_to:e.target.value}))} style={{ ...inp, cursor:'pointer' }}>
                      <option value="">Unassigned</option>
                      {STAFF.map(s=><option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div><label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:4 }}>Priority</label>
                    <select value={form.priority} onChange={e=>setForm(f=>({...f,priority:e.target.value}))} style={{ ...inp, cursor:'pointer' }}>
                      {Object.entries(PRIORITY).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}
                    </select>
                  </div>
                  <div><label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:4 }}>Due Date</label><input type="date" value={form.due_date} onChange={e=>setForm(f=>({...f,due_date:e.target.value}))} style={inp}/></div>
                  <div><label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:4 }}>Tags (comma separated)</label><input value={form.tags} onChange={e=>setForm(f=>({...f,tags:e.target.value}))} placeholder="e.g. urgent, display, stock" style={inp}/></div>
                </div>
              </div>
              <div style={{ display:'flex', gap:10, marginTop:20 }}>
                <button type="button" onClick={()=>{setShowForm(false);setEditTask(null);}} style={{ flex:1, background:T.bg, color:T.sub, border:`1px solid ${T.bdr}`, borderRadius:9, padding:'12px', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>Cancel</button>
                <button type="submit" disabled={saving} style={{ flex:2, ...btn(T.red, T.white), padding:'12px', fontSize:13 }}>{saving?'Saving…':(editTask?'Update Task':'Add Task')}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
