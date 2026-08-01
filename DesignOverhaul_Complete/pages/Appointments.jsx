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
const STATUS_COLORS = { pending:T.amber, confirmed:T.blue, completed:T.green, cancelled:T.red, no_show:T.muted };
const TIME_SLOTS = ['09:00','09:30','10:00','10:30','11:00','11:30','12:00','12:30','13:00','13:30','14:00','14:30','15:00','15:30','16:00','16:30','17:00','17:30','18:00'];

function BookingForm({ appt, tenantId, services, staff, onSave, onCancel }) {
  const [form, setForm] = useState(appt || { customer:'', customer_phone:'', service:'', date:new Date().toISOString().slice(0,10), time_slot:'10:00', duration_mins:30, staff:'', notes:'' });
  const [saving, setSaving] = useState(false);
  const set = (k,v) => setForm(f=>({...f,[k]:v}));
  const inp = { background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:8, padding:'9px 12px', color:T.ink, fontSize:13, fontFamily:'inherit', outline:'none', width:'100%' };
  const lbl = { fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:5 };

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = { ...form, tenant_id:tenantId };
      if (appt?.id) await supabase.from('appointments').update(payload).eq('id', appt.id);
      else await supabase.from('appointments').insert(payload);
      onSave();
    } catch(e) { alert('Error: '+e.message); }
    finally { setSaving(false); }
  }

  function sendConfirmWhatsApp() {
    if (!form.customer_phone) return alert('Enter customer phone first');
    const msg = `Hi ${form.customer}! 👋\n\n*Appointment Confirmed* ✅\n\n📅 Date: ${form.date}\n⏰ Time: ${form.time_slot}\n🏪 ${form.service||'Visit'}\n\nWe look forward to seeing you!\n\nFor changes, reply to this message. 🙏`;
    const ph  = form.customer_phone.replace(/\D/g,'').replace(/^0/,'91');
    window.open(`https://wa.me/${ph}?text=${encodeURIComponent(msg)}`, '_blank');
  }

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.8)', zIndex:200, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
      <div style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:14, padding:24, width:'100%', maxWidth:500 }}>
        <div style={{ display:'flex', justifyContent:'space-between', marginBottom:18 }}>
          <div style={{ fontSize:17, fontWeight:700, color:T.ink }}>{appt?.id?'Edit Appointment':'New Appointment'}</div>
          <button onClick={onCancel} style={{ background:'none', border:'none', color:T.muted, cursor:'pointer', fontSize:22 }}>×</button>
        </div>
        <form onSubmit={handleSave}>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
            <div style={{ gridColumn:'1/-1' }}>
              <label style={lbl}>Customer Name *</label>
              <input value={form.customer} onChange={e=>set('customer',e.target.value)} placeholder="Customer name" style={inp} required/>
            </div>
            <div>
              <label style={lbl}>Phone</label>
              <input value={form.customer_phone||''} onChange={e=>set('customer_phone',e.target.value)} placeholder="Mobile number" style={inp}/>
            </div>
            <div>
              <label style={lbl}>Service</label>
              <input value={form.service||''} onChange={e=>set('service',e.target.value)} placeholder="e.g. Shoe Repair, Fitting" list="services-list" style={inp}/>
              <datalist id="services-list">{services.map(s=><option key={s.id} value={s.name}/>)}</datalist>
            </div>
            <div>
              <label style={lbl}>Date *</label>
              <input type="date" value={form.date} onChange={e=>set('date',e.target.value)} min={new Date().toISOString().slice(0,10)} style={inp} required/>
            </div>
            <div>
              <label style={lbl}>Time Slot *</label>
              <select value={form.time_slot} onChange={e=>set('time_slot',e.target.value)} style={{ ...inp, cursor:'pointer' }} required>
                {TIME_SLOTS.map(t=><option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label style={lbl}>Duration (mins)</label>
              <select value={form.duration_mins} onChange={e=>set('duration_mins',parseInt(e.target.value))} style={{ ...inp, cursor:'pointer' }}>
                {[15,30,45,60,90,120].map(d=><option key={d} value={d}>{d} min</option>)}
              </select>
            </div>
            <div>
              <label style={lbl}>Staff</label>
              <input value={form.staff||''} onChange={e=>set('staff',e.target.value)} placeholder="Assigned staff" list="staff-list" style={inp}/>
              <datalist id="staff-list">{staff.map((s,i)=><option key={i} value={s}/>)}</datalist>
            </div>
            <div style={{ gridColumn:'1/-1' }}>
              <label style={lbl}>Notes</label>
              <input value={form.notes||''} onChange={e=>set('notes',e.target.value)} placeholder="Any special requirements" style={inp}/>
            </div>
          </div>
          <div style={{ display:'flex', gap:10, marginTop:16 }}>
            <button type="button" onClick={onCancel} style={{ flex:1, background:T.card, color:T.sub, border:`1px solid ${T.bdr}`, borderRadius:8, padding:'11px', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>Cancel</button>
            {form.customer_phone && <button type="button" onClick={sendConfirmWhatsApp} style={{ background:'#25d36622', color:'#25d366', border:'none', borderRadius:8, padding:'11px 14px', fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>💬</button>}
            <button type="submit" disabled={saving} style={{ flex:2, background:T.blue, color:'#fff', border:'none', borderRadius:8, padding:'11px', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>
              {saving?'Saving…':appt?.id?'Update':'Book Appointment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function Appointments({ tenant }) {
  const [appts,    setAppts]    = useState([]);
  const [services, setServices] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editAppt, setEditAppt] = useState(null);
  const [view,     setView]     = useState('calendar'); // calendar | list
  const [selDate,  setSelDate]  = useState(new Date().toISOString().slice(0,10));
  const [filter,   setFilter]   = useState('all');

  const staff = ['Gnanamani', 'Store Staff'];

  useEffect(() => { if (tenant?.id) load(); }, [tenant?.id]);

  async function load() {
    setLoading(true);
    const [apptRes, svcRes] = await Promise.all([
      supabase.from('appointments').select('*').eq('tenant_id', tenant.id).order('date').order('time_slot'),
      supabase.from('service_types').select('*').eq('tenant_id', tenant.id).eq('active', true),
    ]);
    setAppts(apptRes.data||[]);
    setServices(svcRes.data||[]);
    setLoading(false);
  }

  async function updateStatus(id, status) {
    await supabase.from('appointments').update({ status }).eq('id', id);
    setAppts(prev=>prev.map(a=>a.id===id?{...a,status}:a));
  }

  function sendReminder(appt) {
    const msg = `Hi ${appt.customer}! 👋\n\n*Reminder:* You have an appointment at *${tenant?.name||'Elite Store'}*\n\n📅 ${appt.date} at ⏰ ${appt.time_slot}\n${appt.service?`🔧 ${appt.service}`:''}\n\nLooking forward to seeing you! 🙏`;
    const ph  = (appt.customer_phone||'').replace(/\D/g,'').replace(/^0/,'91');
    window.open(`https://wa.me/${ph||''}?text=${encodeURIComponent(msg)}`, '_blank');
  }

  // Calendar view - week days
  const today = new Date();
  const weekDates = Array.from({length:7}, (_,i) => {
    const d = new Date(today);
    d.setDate(today.getDate() - today.getDay() + i + 1);
    return d.toISOString().slice(0,10);
  });

  const dayAppts = appts.filter(a => a.date === selDate);
  const displayAppts = filter==='all' ? appts : appts.filter(a=>a.status===filter);
  const todayCount  = appts.filter(a=>a.date===new Date().toISOString().slice(0,10)).length;
  const weekCount   = appts.filter(a=>weekDates.includes(a.date)).length;
  const pendingCount= appts.filter(a=>a.status==='pending'||a.status==='confirmed').length;

  return (
    <div style={{ padding:20 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
        <div>
          <div style={{ fontSize:22, fontWeight:800, color:T.ink }}>📅 Appointments</div>
          <div style={{ fontSize:13, color:T.sub }}>{pendingCount} upcoming · {todayCount} today</div>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          {[['calendar','📅 Calendar'],['list','📋 List']].map(([id,label])=>(
            <button key={id} onClick={()=>setView(id)} style={{ background:view===id?T.blue:T.srf, color:view===id?'#fff':T.sub, border:`1px solid ${view===id?T.blue:T.bdr}`, borderRadius:7, padding:'7px 14px', fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}>{label}</button>
          ))}
          <button onClick={()=>{setEditAppt(null);setShowForm(true);}} style={{ background:T.blue, color:'#fff', border:'none', borderRadius:8, padding:'9px 16px', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>+ Book</button>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12, marginBottom:20 }}>
        {[['Today',todayCount,T.blue],['This Week',weekCount,T.purple],['Upcoming',pendingCount,T.amber],['Total',appts.length,T.sub]].map(([label,val,color])=>(
          <div key={label} style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:10, padding:'12px 16px' }}>
            <div style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', marginBottom:5 }}>{label}</div>
            <div style={{ fontSize:22, fontWeight:800, color }}>{val}</div>
          </div>
        ))}
      </div>

      {view === 'calendar' ? (
        <div style={{ display:'grid', gridTemplateColumns:'200px 1fr', gap:16 }}>
          {/* Week picker */}
          <div style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:12, overflow:'hidden' }}>
            <div style={{ padding:'10px 14px', borderBottom:`1px solid ${T.bdr}`, fontWeight:700, color:T.ink, fontSize:13 }}>This Week</div>
            {weekDates.map(d => {
              const count = appts.filter(a=>a.date===d).length;
              const isToday = d === new Date().toISOString().slice(0,10);
              const dow = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'][new Date(d).getDay()===0?6:new Date(d).getDay()-1];
              return (
                <div key={d} onClick={()=>setSelDate(d)}
                  style={{ padding:'10px 14px', cursor:'pointer', background:selDate===d?T.blue+'22':isToday?T.card:'transparent', borderLeft:`3px solid ${selDate===d?T.blue:isToday?T.amber:'transparent'}`, borderBottom:`1px solid ${T.bdr}22`, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                  <div>
                    <div style={{ fontSize:12, fontWeight:600, color:selDate===d?T.blue:T.ink }}>{dow}</div>
                    <div style={{ fontSize:10, color:T.muted }}>{d.slice(5)}</div>
                  </div>
                  {count>0&&<span style={{ background:T.blue+'33', color:T.blue, borderRadius:10, padding:'1px 7px', fontSize:10, fontWeight:700 }}>{count}</span>}
                </div>
              );
            })}
            <div style={{ padding:'10px 14px', borderTop:`1px solid ${T.bdr}` }}>
              <input type="date" value={selDate} onChange={e=>setSelDate(e.target.value)} style={{ background:T.card, border:`1px solid ${T.bdr}`, borderRadius:7, padding:'6px 10px', color:T.ink, fontSize:12, fontFamily:'inherit', outline:'none', width:'100%' }}/>
            </div>
          </div>

          {/* Day schedule */}
          <div style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:12, overflow:'hidden' }}>
            <div style={{ padding:'12px 18px', borderBottom:`1px solid ${T.bdr}`, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <div style={{ fontWeight:700, color:T.ink }}>{selDate} — {dayAppts.length} appointment{dayAppts.length!==1?'s':''}</div>
              <button onClick={()=>{setEditAppt({date:selDate});setShowForm(true);}} style={{ background:T.blue+'22', color:T.blue, border:'none', borderRadius:7, padding:'5px 12px', fontSize:11, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>+ Add</button>
            </div>
            {dayAppts.length===0 ? (
              <div style={{ textAlign:'center', color:T.muted, padding:60 }}>
                <div style={{ fontSize:32, marginBottom:8 }}>📅</div>
                <div style={{ fontSize:13 }}>No appointments on {selDate}</div>
              </div>
            ) : TIME_SLOTS.map(slot => {
              const slotAppts = dayAppts.filter(a=>a.time_slot===slot+':00'||a.time_slot===slot);
              return (
                <div key={slot} style={{ display:'flex', gap:10, padding:'6px 16px', borderBottom:`1px solid ${T.bdr}11`, minHeight:48, alignItems:'flex-start' }}>
                  <div style={{ fontSize:11, color:T.muted, width:40, flexShrink:0, paddingTop:6 }}>{slot}</div>
                  <div style={{ flex:1, display:'flex', gap:8, flexWrap:'wrap' }}>
                    {slotAppts.map(a=>(
                      <div key={a.id} style={{ background:STATUS_COLORS[a.status]+'22', border:`1px solid ${STATUS_COLORS[a.status]}44`, borderRadius:8, padding:'6px 10px', flex:1, cursor:'pointer' }} onClick={()=>{setEditAppt(a);setShowForm(true);}}>
                        <div style={{ fontSize:12, fontWeight:700, color:T.ink }}>{a.customer}</div>
                        <div style={{ fontSize:10, color:T.sub }}>{a.service||'Visit'} · {a.duration_mins}min</div>
                        {a.staff&&<div style={{ fontSize:10, color:T.muted }}>👤 {a.staff}</div>}
                        <div style={{ display:'flex', gap:4, marginTop:4 }}>
                          {a.status==='confirmed'&&<button onClick={e=>{e.stopPropagation();updateStatus(a.id,'completed');}} style={{ background:T.green+'22', color:T.green, border:'none', borderRadius:4, padding:'2px 6px', fontSize:9, cursor:'pointer', fontFamily:'inherit' }}>✅ Done</button>}
                          {a.customer_phone&&<button onClick={e=>{e.stopPropagation();sendReminder(a);}} style={{ background:'#25d36622', color:'#25d366', border:'none', borderRadius:4, padding:'2px 6px', fontSize:9, cursor:'pointer', fontFamily:'inherit' }}>💬</button>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <>
          <div style={{ display:'flex', gap:8, marginBottom:14 }}>
            {['all','confirmed','pending','completed','cancelled'].map(f=>(
              <button key={f} onClick={()=>setFilter(f)} style={{ background:filter===f?T.blue:T.srf, color:filter===f?'#fff':T.sub, border:`1px solid ${filter===f?T.blue:T.bdr}`, borderRadius:7, padding:'6px 12px', fontSize:11, cursor:'pointer', fontFamily:'inherit', textTransform:'capitalize' }}>{f}</button>
            ))}
          </div>
          <div style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:12, overflow:'hidden' }}>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
              <thead><tr style={{ background:T.card }}>
                {['Customer','Phone','Service','Date','Time','Staff','Status','Actions'].map(h=>(
                  <th key={h} style={{ padding:'9px 14px', textAlign:'left', fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', borderBottom:`1px solid ${T.bdr}` }}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {loading?<tr><td colSpan={8} style={{ textAlign:'center', padding:40, color:T.sub }}>Loading…</td></tr>
                :displayAppts.length===0?<tr><td colSpan={8} style={{ textAlign:'center', padding:40, color:T.muted }}>No appointments</td></tr>
                :displayAppts.map(a=>(
                  <tr key={a.id} style={{ borderBottom:`1px solid ${T.bdr}22` }}>
                    <td style={{ padding:'10px 14px', color:T.ink, fontWeight:600 }}>{a.customer}</td>
                    <td style={{ padding:'10px 14px', color:T.sub }}>{a.customer_phone||'—'}</td>
                    <td style={{ padding:'10px 14px', color:T.sub }}>{a.service||'—'}</td>
                    <td style={{ padding:'10px 14px', color:T.sub }}>{a.date}</td>
                    <td style={{ padding:'10px 14px', color:T.ink, fontWeight:700 }}>{a.time_slot}</td>
                    <td style={{ padding:'10px 14px', color:T.muted }}>{a.staff||'—'}</td>
                    <td style={{ padding:'10px 14px' }}>
                      <span style={{ background:STATUS_COLORS[a.status]+'22', color:STATUS_COLORS[a.status], borderRadius:5, padding:'2px 8px', fontSize:10, fontWeight:700, textTransform:'capitalize' }}>{a.status}</span>
                    </td>
                    <td style={{ padding:'10px 14px' }}>
                      <div style={{ display:'flex', gap:6 }}>
                        <button onClick={()=>{setEditAppt(a);setShowForm(true);}} style={{ background:T.blue+'22', color:T.blue, border:'none', borderRadius:5, padding:'3px 8px', fontSize:10, cursor:'pointer', fontFamily:'inherit' }}>Edit</button>
                        {a.customer_phone&&<button onClick={()=>sendReminder(a)} style={{ background:'#25d36622', color:'#25d366', border:'none', borderRadius:5, padding:'3px 8px', fontSize:10, cursor:'pointer', fontFamily:'inherit' }}>💬</button>}
                        {a.status==='confirmed'&&<button onClick={()=>updateStatus(a.id,'completed')} style={{ background:T.green+'22', color:T.green, border:'none', borderRadius:5, padding:'3px 8px', fontSize:10, cursor:'pointer', fontFamily:'inherit' }}>✅</button>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {showForm && <BookingForm appt={editAppt} tenantId={tenant?.id} services={services} staff={staff} onSave={()=>{setShowForm(false);load();}} onCancel={()=>setShowForm(false)}/>}
    </div>
  );
}
