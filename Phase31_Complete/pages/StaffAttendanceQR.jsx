import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

const T = {
  bg:'#F7F3F3', srf:'#FFFFFF', card:'#FFFFFF', bdr:'#E8DEDE',
  red:'#C0392B', darkRed:'#8B0000', lightRed:'#FEF2F2',
  green:'#16A34A', amber:'#D97706', blue:'#2563EB', purple:'#7C3AED',
  ink:'#111827', sub:'#6B7280', muted:'#9CA3AF', white:'#FFFFFF'
};
const btn = (bg,color,extra={}) => ({ background:bg, color, border:'none', borderRadius:8, padding:'9px 16px', fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:'inherit', ...extra });
const inp = { background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:8, padding:'9px 12px', color:T.ink, fontSize:13, fontFamily:'inherit', outline:'none', width:'100%' };

const STAFF = ['Gnanamani','Store Staff 1','Store Staff 2'];
const SHIFT_START = 10; // 10 AM

export default function StaffAttendanceQR({ tenant }) {
  const [records,  setRecords]  = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [date,     setDate]     = useState(new Date().toISOString().slice(0,10));
  const [showQR,   setShowQR]   = useState(null);
  const [saving,   setSaving]   = useState(false);

  useEffect(() => { if (tenant?.id) load(); }, [tenant?.id, date]);

  async function load() {
    setLoading(true);
    const { data } = await supabase.from('attendance_qr').select('*').eq('tenant_id', tenant.id).eq('check_date', date).order('check_in');
    setRecords(data||[]);
    setLoading(false);
  }

  function genToken(staff) {
    return btoa(`${tenant?.id?.slice(0,8)}|${staff}|${date}`).replace(/=/g,'');
  }

  async function checkIn(staff) {
    setSaving(true);
    const now  = new Date();
    const late = now.getHours() > SHIFT_START || (now.getHours()===SHIFT_START && now.getMinutes()>15);
    await supabase.from('attendance_qr').upsert({
      tenant_id:tenant.id, staff_name:staff, qr_token:genToken(staff),
      check_date:date, check_in:now.toISOString(), status: late?'late':'present',
    }, { onConflict:'tenant_id,staff_name,check_date' });
    setSaving(false); await load();
  }

  async function checkOut(rec) {
    setSaving(true);
    const now   = new Date();
    const inT   = new Date(rec.check_in);
    const hours = ((now - inT)/3600000);
    await supabase.from('attendance_qr').update({
      check_out: now.toISOString(),
      hours_worked: parseFloat(hours.toFixed(2)),
      status: hours < 4 ? 'half_day' : rec.status,
    }).eq('id', rec.id);
    setSaving(false); await load();
  }

  // Simple QR code generator via public API (no external lib needed)
  function qrUrl(token) {
    return `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(token)}`;
  }

  const present   = records.filter(r=>r.check_in).length;
  const late      = records.filter(r=>r.status==='late').length;
  const absent    = STAFF.length - present;
  const totalHrs  = records.reduce((s,r)=>s+(r.hours_worked||0),0);
  const isToday   = date === new Date().toISOString().slice(0,10);

  const fmtTime = iso => iso ? new Date(iso).toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'}) : '—';

  return (
    <div style={{ padding:24, background:T.bg, minHeight:'100%' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
        <div>
          <div style={{ fontSize:18, fontWeight:800, color:T.darkRed }}>📲 QR Attendance</div>
          <div style={{ fontSize:12, color:T.sub, marginTop:2 }}>Quick check-in/out with QR codes · Shift starts {SHIFT_START}:00 AM</div>
        </div>
        <input type="date" value={date} onChange={e=>setDate(e.target.value)}
          style={{ background:T.white, border:`1px solid ${T.bdr}`, borderRadius:8, padding:'8px 12px', color:T.ink, fontSize:13, fontFamily:'inherit', outline:'none' }}/>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:14, marginBottom:20 }}>
        {[['Present',present,T.green,'✅'],['Late',late,T.amber,'⏰'],['Absent',absent,T.red,'❌'],['Total Hours',totalHrs.toFixed(1),T.blue,'⏱️']].map(([label,val,color,icon])=>(
          <div key={label} style={{ background:T.white, border:`1px solid ${T.bdr}`, borderRadius:12, padding:'16px 18px', boxShadow:'0 1px 4px rgba(0,0,0,.05)' }}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:6 }}>
              <div style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.05em' }}>{label}</div>
              <span style={{ fontSize:18 }}>{icon}</span>
            </div>
            <div style={{ fontSize:24, fontWeight:900, color, letterSpacing:'-0.02em' }}>{val}</div>
          </div>
        ))}
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(300px,1fr))', gap:14 }}>
        {loading?<div style={{ textAlign:'center', padding:60, color:T.muted, gridColumn:'1/-1' }}>Loading…</div>
        :STAFF.map(staff=>{
          const rec       = records.find(r=>r.staff_name===staff);
          const checkedIn = rec?.check_in;
          const checkedOut= rec?.check_out;
          const statusCfg = !checkedIn ? { label:'Not Checked In', color:T.muted, bg:'#F9FAFB', bdr:'#E5E7EB' }
                          : rec.status==='late' ? { label:'Late', color:T.amber, bg:'#FFFBEB', bdr:'#FDE68A' }
                          : rec.status==='half_day' ? { label:'Half Day', color:T.purple, bg:'#F5F3FF', bdr:'#DDD6FE' }
                          : { label:'Present', color:T.green, bg:'#F0FDF4', bdr:'#BBF7D0' };
          return (
            <div key={staff} style={{ background:T.white, border:`1px solid ${T.bdr}`, borderRadius:14, overflow:'hidden', boxShadow:'0 1px 4px rgba(0,0,0,.05)' }}>
              <div style={{ padding:'14px 18px', background:statusCfg.bg, borderBottom:`1px solid ${T.bdr}`, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <div>
                  <div style={{ fontSize:14, fontWeight:800, color:T.ink }}>{staff}</div>
                  <div style={{ fontSize:10, color:T.sub, marginTop:2 }}>{date}</div>
                </div>
                <span style={{ background:T.white, color:statusCfg.color, border:`1px solid ${statusCfg.bdr}`, borderRadius:20, padding:'3px 11px', fontSize:10, fontWeight:700 }}>{statusCfg.label}</span>
              </div>
              <div style={{ padding:'16px 18px' }}>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:10, marginBottom:14, textAlign:'center' }}>
                  {[['Check In',fmtTime(rec?.check_in),T.green],['Check Out',fmtTime(rec?.check_out),T.red],['Hours',rec?.hours_worked?rec.hours_worked.toFixed(1):'—',T.blue]].map(([label,val,color])=>(
                    <div key={label} style={{ background:T.bg, borderRadius:8, padding:'9px 6px' }}>
                      <div style={{ fontSize:9, color:T.muted, fontWeight:700, textTransform:'uppercase', marginBottom:3 }}>{label}</div>
                      <div style={{ fontSize:13, fontWeight:700, color }}>{val}</div>
                    </div>
                  ))}
                </div>
                <div style={{ display:'flex', gap:8 }}>
                  {!checkedIn&&isToday&&<button onClick={()=>checkIn(staff)} disabled={saving} style={{ flex:1, ...btn('#F0FDF4', T.green, { padding:'9px' }) }}>✅ Check In</button>}
                  {checkedIn&&!checkedOut&&isToday&&<button onClick={()=>checkOut(rec)} disabled={saving} style={{ flex:1, ...btn('#FEF2F2', T.red, { padding:'9px' }) }}>🚪 Check Out</button>}
                  {checkedOut&&<div style={{ flex:1, textAlign:'center', padding:'9px', background:T.bg, borderRadius:8, fontSize:11, color:T.sub, fontWeight:600 }}>Shift complete ✓</div>}
                  <button onClick={()=>setShowQR(staff)} style={btn(T.lightRed, T.red, { padding:'9px 14px', border:`1px solid ${T.bdr}` })}>📱 QR</button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {showQR&&(
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.6)', zIndex:200, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}
          onClick={()=>setShowQR(null)}>
          <div onClick={e=>e.stopPropagation()} style={{ background:T.white, borderRadius:16, padding:28, textAlign:'center', maxWidth:320, boxShadow:'0 20px 60px rgba(0,0,0,.3)' }}>
            <div style={{ fontSize:16, fontWeight:800, color:T.darkRed, marginBottom:4 }}>{showQR}</div>
            <div style={{ fontSize:11, color:T.sub, marginBottom:18 }}>Scan to check in/out · {date}</div>
            <img src={qrUrl(genToken(showQR))} alt="QR Code" style={{ width:220, height:220, border:`1px solid ${T.bdr}`, borderRadius:12, padding:8 }}/>
            <div style={{ fontSize:10, color:T.muted, marginTop:14, wordBreak:'break-all', fontFamily:'monospace' }}>{genToken(showQR).slice(0,32)}…</div>
            <button onClick={()=>setShowQR(null)} style={{ width:'100%', marginTop:18, ...btn(T.red, T.white, { padding:'11px' }) }}>Close</button>
          </div>
        </div>
      )}
    </div>
  );
}
