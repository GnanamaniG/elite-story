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
const DAYS     = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
const SHIFTS   = ['off','09:00-18:00','10:00-19:00','08:00-17:00','12:00-21:00','Half Day AM','Half Day PM'];
const STAFF    = ['Gnanamani','Store Staff 1','Store Staff 2'];
const SHIFT_COLORS = { 'off':T.muted,'09:00-18:00':T.blue,'10:00-19:00':T.teal,'08:00-17:00':T.green,'12:00-21:00':T.purple,'Half Day AM':T.amber,'Half Day PM':T.amber };

function getMonday(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day===0?-6:1);
  return new Date(d.setDate(diff)).toISOString().slice(0,10);
}

export default function StaffScheduler({ tenant }) {
  const [weekStart, setWeekStart] = useState(getMonday(new Date()));
  const [schedules, setSchedules] = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [saving,    setSaving]    = useState(false);
  const [drafts,    setDrafts]    = useState({});

  useEffect(() => { if (tenant?.id) load(); }, [tenant?.id, weekStart]);

  async function load() {
    setLoading(true);
    const { data } = await supabase.from('staff_schedules').select('*').eq('tenant_id', tenant.id).eq('week_start', weekStart);
    setSchedules(data||[]);
    // Init drafts from saved schedules
    const init = {};
    STAFF.forEach(name => {
      const saved = (data||[]).find(s=>s.staff_name===name);
      init[name] = saved ? { ...saved.shifts } : Object.fromEntries(DAYS.map(d=>[d,'off']));
    });
    setDrafts(init);
    setLoading(false);
  }

  function setShift(staffName, day, shift) {
    setDrafts(prev=>({ ...prev, [staffName]:{ ...prev[staffName], [day]:shift } }));
  }

  async function saveSchedules() {
    setSaving(true);
    for (const staffName of STAFF) {
      const existing = schedules.find(s=>s.staff_name===staffName);
      const payload  = { tenant_id:tenant.id, staff_name:staffName, week_start:weekStart, shifts:drafts[staffName]||{} };
      if (existing) await supabase.from('staff_schedules').update(payload).eq('id', existing.id);
      else await supabase.from('staff_schedules').insert(payload);
    }
    setSaving(false); await load();
  }

  function prevWeek() { const d=new Date(weekStart); d.setDate(d.getDate()-7); setWeekStart(d.toISOString().slice(0,10)); }
  function nextWeek() { const d=new Date(weekStart); d.setDate(d.getDate()+7); setWeekStart(d.toISOString().slice(0,10)); }
  function thisWeek() { setWeekStart(getMonday(new Date())); }

  const weekDates = DAYS.map((_,i)=>{ const d=new Date(weekStart); d.setDate(d.getDate()+i); return d.toLocaleDateString('en-IN',{day:'numeric',month:'short'}); });
  const today     = new Date().toISOString().slice(0,10);
  const todayDay  = DAYS[new Date().getDay()===0?6:new Date().getDay()-1];

  function shareScheduleWA() {
    let msg = `📅 *Staff Schedule — Week of ${weekStart}*\n\n*${tenant?.name||'Elite Store'}*\n\n`;
    DAYS.forEach((day,i)=>{
      const date = weekDates[i];
      const working = STAFF.filter(s=>(drafts[s]?.[day]||'off')!=='off');
      if (working.length>0) msg+=`*${day} ${date}:* ${working.map(s=>`${s.split(' ')[0]} (${drafts[s][day]})`).join(', ')}\n`;
    });
    msg += '\nPlease confirm your shifts. Thank you!';
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
  }

  // Summary row
  const summary = STAFF.map(name=>({
    name, workDays:DAYS.filter(d=>(drafts[name]?.[d]||'off')!=='off').length,
    hours:DAYS.reduce((t,d)=>{ const s=drafts[name]?.[d]||'off'; if(s==='off') return t; if(s.startsWith('Half')) return t+4.5; if(s.includes('-')){const [a,b]=s.split('-');return t+(parseInt(b)-parseInt(a));} return t+9; },0)
  }));

  return (
    <div style={{ padding:20 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
        <div>
          <div style={{ fontSize:22, fontWeight:800, color:T.ink }}>📅 Staff Scheduler</div>
          <div style={{ fontSize:13, color:T.sub }}>Weekly shift planning — drag-select or click to assign shifts</div>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <button onClick={shareScheduleWA} style={{ background:'#25d36622', color:'#25d366', border:'none', borderRadius:8, padding:'9px 14px', fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>💬 Share</button>
          <button onClick={saveSchedules} disabled={saving} style={{ background:T.blue, color:'#fff', border:'none', borderRadius:9, padding:'9px 18px', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>{saving?'Saving…':'💾 Save'}</button>
        </div>
      </div>

      {/* Week navigation */}
      <div style={{ display:'flex', gap:8, marginBottom:16, alignItems:'center' }}>
        <button onClick={prevWeek} style={{ background:T.srf, color:T.sub, border:`1px solid ${T.bdr}`, borderRadius:7, padding:'7px 12px', fontSize:13, cursor:'pointer', fontFamily:'inherit' }}>‹</button>
        <div style={{ fontWeight:700, color:T.ink, minWidth:180, textAlign:'center' }}>Week of {weekStart}</div>
        <button onClick={nextWeek} style={{ background:T.srf, color:T.sub, border:`1px solid ${T.bdr}`, borderRadius:7, padding:'7px 12px', fontSize:13, cursor:'pointer', fontFamily:'inherit' }}>›</button>
        <button onClick={thisWeek} style={{ background:T.blue+'22', color:T.blue, border:'none', borderRadius:7, padding:'7px 12px', fontSize:11, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>This Week</button>
      </div>

      {loading?<div style={{ textAlign:'center', color:T.sub, padding:60 }}>Loading…</div>:(
        <>
          {/* Schedule grid */}
          <div style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:12, overflow:'hidden', marginBottom:16 }}>
            {/* Header */}
            <div style={{ display:'grid', gridTemplateColumns:'140px repeat(7,1fr)', background:T.card }}>
              <div style={{ padding:'10px 14px', fontSize:11, color:T.sub, fontWeight:700, textTransform:'uppercase' }}>Staff</div>
              {DAYS.map((day,i)=>(
                <div key={day} style={{ padding:'10px 8px', textAlign:'center', background:weekStart.slice(0,4)+'-'+weekDates[i].replace(' ','-')===today?T.blue+'22':'transparent' }}>
                  <div style={{ fontSize:12, fontWeight:700, color:day===todayDay&&weekStart===getMonday(new Date())?T.blue:T.ink }}>{day}</div>
                  <div style={{ fontSize:10, color:T.muted }}>{weekDates[i]}</div>
                </div>
              ))}
            </div>

            {/* Staff rows */}
            {STAFF.map(staffName=>(
              <div key={staffName} style={{ display:'grid', gridTemplateColumns:'140px repeat(7,1fr)', borderTop:`1px solid ${T.bdr}` }}>
                <div style={{ padding:'12px 14px', display:'flex', alignItems:'center' }}>
                  <div style={{ width:28, height:28, borderRadius:'50%', background:T.blue+'33', display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, color:T.blue, fontWeight:700, marginRight:8 }}>
                    {staffName.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase()}
                  </div>
                  <span style={{ fontSize:12, color:T.ink, fontWeight:600 }}>{staffName.split(' ')[0]}</span>
                </div>
                {DAYS.map(day=>{
                  const shift = drafts[staffName]?.[day]||'off';
                  return (
                    <div key={day} style={{ padding:4 }}>
                      <select value={shift} onChange={e=>setShift(staffName, day, e.target.value)}
                        style={{ width:'100%', background:(SHIFT_COLORS[shift]||T.muted)+'22', border:`1px solid ${SHIFT_COLORS[shift]||T.muted}44`, borderRadius:6, padding:'6px 4px', color:SHIFT_COLORS[shift]||T.muted, fontSize:10, fontFamily:'inherit', outline:'none', cursor:'pointer', fontWeight:600 }}>
                        {SHIFTS.map(s=><option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>

          {/* Summary */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12 }}>
            {summary.map(s=>(
              <div key={s.name} style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:10, padding:'12px 16px' }}>
                <div style={{ fontSize:13, fontWeight:700, color:T.ink, marginBottom:6 }}>{s.name}</div>
                <div style={{ display:'flex', gap:16 }}>
                  <div><div style={{ fontSize:20, fontWeight:800, color:T.blue }}>{s.workDays}</div><div style={{ fontSize:10, color:T.muted }}>days/week</div></div>
                  <div><div style={{ fontSize:20, fontWeight:800, color:T.green }}>{s.hours}h</div><div style={{ fontSize:10, color:T.muted }}>total hrs</div></div>
                  <div><div style={{ fontSize:20, fontWeight:800, color:7-s.workDays<=1?T.red:T.amber }}>{7-s.workDays}</div><div style={{ fontSize:10, color:T.muted }}>days off</div></div>
                </div>
              </div>
            ))}
          </div>

          {/* Shift legend */}
          <div style={{ display:'flex', gap:10, marginTop:14, flexWrap:'wrap' }}>
            {Object.entries(SHIFT_COLORS).map(([shift,color])=>(
              <div key={shift} style={{ display:'flex', alignItems:'center', gap:5 }}>
                <div style={{ width:12, height:12, borderRadius:2, background:color+'44', border:`1px solid ${color}` }}/>
                <span style={{ fontSize:10, color:T.muted }}>{shift}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
