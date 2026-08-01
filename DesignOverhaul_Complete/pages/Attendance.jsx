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
const STATUS_COLORS = { present: T.green, absent: T.red, half_day: T.amber, leave: T.purple };
const STATUS_LABELS = { present: '✅ Present', absent: '❌ Absent', half_day: '🔆 Half Day', leave: '🏖️ Leave' };

export default function Attendance({ tenant }) {
  const [staff,      setStaff]      = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [date,       setDate]       = useState(new Date().toISOString().slice(0,10));
  const [loading,    setLoading]    = useState(true);
  const [saving,     setSaving]     = useState('');
  const [view,       setView]       = useState('today'); // today | history | summary

  useEffect(() => { if (tenant?.id) { loadStaff(); loadAttendance(); } }, [tenant?.id, date]);

  async function loadStaff() {
    const { data } = await supabase.from('users').select('*').eq('tenant_id', tenant.id).eq('active', true);
    setStaff(data || []);
  }

  async function loadAttendance() {
    setLoading(true);
    const { data } = await supabase.from('attendance').select('*').eq('tenant_id', tenant.id).eq('date', date);
    setAttendance(data || []);
    setLoading(false);
  }

  async function markAttendance(staffMember, status) {
    setSaving(staffMember.id);
    const existing = attendance.find(a => a.user_id === staffMember.id);
    const record = {
      tenant_id:  tenant.id,
      user_id:    staffMember.id,
      staff_name: staffMember.name,
      date,
      status,
      check_in:   status === 'present' ? new Date().toTimeString().slice(0,5) : null,
    };
    if (existing) {
      await supabase.from('attendance').update({ status }).eq('id', existing.id);
    } else {
      await supabase.from('attendance').insert(record);
    }
    await loadAttendance();
    setSaving('');
  }

  const getStatus = (staffId) => attendance.find(a => a.user_id === staffId)?.status;

  // Month summary
  const [monthData, setMonthData] = useState([]);
  const [month, setMonth] = useState(new Date().toISOString().slice(0,7));

  async function loadMonthSummary() {
    const { data } = await supabase.from('attendance').select('*')
      .eq('tenant_id', tenant.id)
      .gte('date', month + '-01')
      .lte('date', month + '-31');
    setMonthData(data || []);
  }

  useEffect(() => { if (tenant?.id && view === 'summary') loadMonthSummary(); }, [tenant?.id, month, view]);

  const inp = { background:T.card, border:`1px solid ${T.bdr}`, borderRadius:8, padding:'8px 12px', color:T.ink, fontSize:13, fontFamily:'inherit', outline:'none' };

  const presentToday = attendance.filter(a => a.status === 'present').length;
  const absentToday  = attendance.filter(a => a.status === 'absent').length;

  return (
    <div style={{ padding:20 }}>
      {/* Header */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
        <div>
          <div style={{ fontSize:22, fontWeight:800, color:T.ink }}>Attendance</div>
          <div style={{ fontSize:13, color:T.sub }}>{staff.length} staff members</div>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          {[['today','Today'],['summary','Monthly Summary']].map(([id,label]) => (
            <button key={id} onClick={() => setView(id)} style={{ background:view===id?T.blue:T.srf, color:view===id?'#fff':T.sub, border:`1px solid ${view===id?T.blue:T.bdr}`, borderRadius:7, padding:'7px 14px', fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}>{label}</button>
          ))}
        </div>
      </div>

      {/* Today's attendance */}
      {view === 'today' && (
        <>
          <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:20 }}>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} style={inp} />
            <div style={{ display:'flex', gap:10 }}>
              <span style={{ background:T.green+'22', color:T.green, borderRadius:7, padding:'5px 12px', fontSize:12, fontWeight:700 }}>✅ Present: {presentToday}</span>
              <span style={{ background:T.red+'22', color:T.red, borderRadius:7, padding:'5px 12px', fontSize:12, fontWeight:700 }}>❌ Absent: {absentToday}</span>
              <span style={{ background:T.muted+'22', color:T.muted, borderRadius:7, padding:'5px 12px', fontSize:12, fontWeight:700 }}>⬜ Unmarked: {staff.length - attendance.length}</span>
            </div>
          </div>

          {staff.length === 0 ? (
            <div style={{ textAlign:'center', color:T.muted, padding:60 }}>
              <div style={{ fontSize:36, marginBottom:12 }}>👥</div>
              <div style={{ fontSize:15, color:T.sub, marginBottom:8 }}>No staff members found</div>
              <div style={{ fontSize:13 }}>Add team members in the Team section first</div>
            </div>
          ) : (
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))', gap:14 }}>
              {staff.map(member => {
                const status = getStatus(member.id);
                return (
                  <div key={member.id} style={{ background:T.srf, border:`1px solid ${status ? STATUS_COLORS[status]+'44' : T.bdr}`, borderRadius:12, padding:18 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:14 }}>
                      <div style={{ width:42, height:42, borderRadius:'50%', background:T.blue+'33', color:T.blue, display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, fontWeight:700 }}>
                        {(member.name||'?')[0].toUpperCase()}
                      </div>
                      <div>
                        <div style={{ fontSize:14, fontWeight:700, color:T.ink }}>{member.name}</div>
                        <div style={{ fontSize:11, color:T.muted, textTransform:'capitalize' }}>{member.role}</div>
                      </div>
                      {status && (
                        <div style={{ marginLeft:'auto', background:STATUS_COLORS[status]+'22', color:STATUS_COLORS[status], borderRadius:6, padding:'3px 10px', fontSize:11, fontWeight:700 }}>
                          {STATUS_LABELS[status]}
                        </div>
                      )}
                    </div>
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6 }}>
                      {Object.entries(STATUS_LABELS).map(([s, label]) => (
                        <button key={s} onClick={() => markAttendance(member, s)} disabled={saving === member.id}
                          style={{ background: status===s ? STATUS_COLORS[s]+'33' : T.card, color: status===s ? STATUS_COLORS[s] : T.muted, border:`1px solid ${status===s ? STATUS_COLORS[s] : T.bdr}`, borderRadius:7, padding:'7px 8px', fontSize:11, fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}>
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Monthly summary */}
      {view === 'summary' && (
        <>
          <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:20 }}>
            <input type="month" value={month} onChange={e => setMonth(e.target.value)} style={inp} />
          </div>
          <div style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:12, overflow:'hidden' }}>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
              <thead>
                <tr style={{ background:T.card }}>
                  {['Staff Member','Present','Absent','Half Day','Leave','Attendance %'].map(h => (
                    <th key={h} style={{ padding:'10px 16px', textAlign:'left', fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', borderBottom:`1px solid ${T.bdr}` }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {staff.map(member => {
                  const records = monthData.filter(a => a.user_id === member.id);
                  const present  = records.filter(r => r.status === 'present').length;
                  const absent   = records.filter(r => r.status === 'absent').length;
                  const halfDay  = records.filter(r => r.status === 'half_day').length;
                  const leave    = records.filter(r => r.status === 'leave').length;
                  const total    = records.length;
                  const pct      = total > 0 ? Math.round(present / total * 100) : 0;
                  return (
                    <tr key={member.id} style={{ borderBottom:`1px solid ${T.bdr}22` }}>
                      <td style={{ padding:'12px 16px', color:T.ink, fontWeight:600 }}>{member.name}</td>
                      <td style={{ padding:'12px 16px', color:T.green, fontWeight:700 }}>{present}</td>
                      <td style={{ padding:'12px 16px', color:T.red }}>{absent}</td>
                      <td style={{ padding:'12px 16px', color:T.amber }}>{halfDay}</td>
                      <td style={{ padding:'12px 16px', color:T.purple }}>{leave}</td>
                      <td style={{ padding:'12px 16px' }}>
                        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                          <div style={{ height:6, width:80, background:T.bdr, borderRadius:3, overflow:'hidden' }}>
                            <div style={{ height:'100%', width:`${pct}%`, background: pct >= 75 ? T.green : T.amber, borderRadius:3 }} />
                          </div>
                          <span style={{ color: pct >= 75 ? T.green : T.amber, fontWeight:700, fontSize:12 }}>{pct}%</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
