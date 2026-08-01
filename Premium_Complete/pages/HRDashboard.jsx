import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

const T = {
  bg:'#F7F3F3', srf:'#FFFFFF', card:'#FFFFFF', card2:'#FFF5F5',
  bdr:'#E8DEDE', bdr2:'#F0E8E8',
  red:'#C0392B', darkRed:'#8B0000', lightRed:'#FDECEA',
  green:'#16A34A', amber:'#D97706', blue:'#2563EB',
  purple:'#7C3AED', teal:'#0D9488', orange:'#EA580C',
  ink:'#111827', sub:'#6B7280', muted:'#9CA3AF',
  white:'#FFFFFF',
  sidebar:'#7B1E1E', sideHov:'#9B2C2C', sideTxt:'#FFCDD2', sideActTxt:'#7B1E1E'
};
const fmt = n => 'Rs.' + (n||0).toLocaleString('en-IN', { maximumFractionDigits:0 });
const DAYS = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
const STAFF_LIST = ['Gnanamani','Store Staff 1','Store Staff 2'];

function HeatmapCell({ status }) {
  const colors = { present:'#00d68f', absent:'#ff4d6a', late:'#ffb547', holiday:'#4f7cff', leave:'#9b72ff', '':T.bdr };
  return <div style={{ width:22, height:22, borderRadius:3, background:colors[status||'']||T.bdr, title:status }} title={status||'no record'}/>;
}

export default function HRDashboard({ tenant }) {
  const [attendance, setAttendance]  = useState([]);
  const [leaves,     setLeaves]      = useState([]);
  const [payroll,    setPayroll]     = useState([]);
  const [targets,    setTargets]     = useState([]);
  const [sales,      setSales]       = useState([]);
  const [loading,    setLoading]     = useState(true);

  const now = new Date();
  const yr  = now.getFullYear();
  const mo  = String(now.getMonth()+1).padStart(2,'0');
  const period = `${yr}-${mo}`;
  const daysInMonth = new Date(yr, now.getMonth()+1, 0).getDate();

  useEffect(() => { if (tenant?.id) load(); }, [tenant?.id]);

  async function load() {
    setLoading(true);
    const monthStart = `${period}-01`;
    const monthEnd   = `${period}-${String(daysInMonth).padStart(2,'0')}`;
    const [attRes, leaveRes, payRes, targRes, salesRes] = await Promise.all([
      supabase.from('attendance').select('*').eq('tenant_id',tenant.id).gte('date',monthStart).lte('date',monthEnd),
      supabase.from('leave_requests').select('*').eq('tenant_id',tenant.id).eq('status','approved').gte('from_date',monthStart).lte('to_date',monthEnd),
      supabase.from('payroll').select('*').eq('tenant_id',tenant.id).eq('period',period),
      supabase.from('staff_targets').select('*').eq('tenant_id',tenant.id).eq('period',period),
      supabase.from('sales').select('total,staff_name,date').eq('tenant_id',tenant.id).gte('date',monthStart).lte('date',monthEnd),
    ]);
    setAttendance(attRes.data||[]);
    setLeaves(leaveRes.data||[]);
    setPayroll(payRes.data||[]);
    setTargets(targRes.data||[]);
    setSales(salesRes.data||[]);
    setLoading(false);
  }

  // Build attendance grid per staff per day
  function getStatus(staffName, day) {
    const date = `${period}-${String(day).padStart(2,'0')}`;
    const rec  = attendance.find(a=>a.staff_name===staffName&&a.date===date);
    const leave= leaves.find(l=>l.staff_name===staffName&&date>=l.from_date&&date<=l.to_date);
    if (leave)  return 'leave';
    if (!rec)   return '';
    return rec.status || 'present';
  }

  function getAttendanceSummary(staffName) {
    const present = attendance.filter(a=>a.staff_name===staffName&&a.status==='present').length;
    const absent  = attendance.filter(a=>a.staff_name===staffName&&a.status==='absent').length;
    const leave   = leaves.filter(l=>l.staff_name===staffName).reduce((s,l)=>s+(l.days||0),0);
    return { present, absent, leave };
  }

  const todayLeaves = leaves.filter(l=>{const t=new Date().toISOString().slice(0,10);return t>=l.from_date&&t<=l.to_date;});
  const pendingLeave= leaves.filter(l=>l.status==='pending');
  const totalPayroll= payroll.reduce((s,p)=>s+(p.net_pay||0),0);

  return (
    <div style={{ padding:20 }}>
      <div style={{ fontSize:22, fontWeight:800, color:T.ink, marginBottom:6 }}>👥 HR Dashboard</div>
      <div style={{ fontSize:13, color:T.sub, marginBottom:20 }}>{period} · Unified view of attendance, leave, payroll & performance</div>

      {/* KPI row */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12, marginBottom:20 }}>
        {[
          ['On Leave Today', todayLeaves.length, T.amber],
          ['This Month Payroll', fmt(totalPayroll), T.blue],
          ['Pending Leaves', pendingLeave.length, T.red],
          ['Staff Count', STAFF_LIST.length, T.green],
        ].map(([label,val,color])=>(
          <div key={label} style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:10, padding:'12px 16px' }}>
            <div style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', marginBottom:5 }}>{label}</div>
            <div style={{ fontSize:20, fontWeight:800, color }}>{val}</div>
          </div>
        ))}
      </div>

      {/* Attendance heatmap */}
      <div style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:12, padding:20, marginBottom:16 }}>
        <div style={{ fontWeight:700, color:T.ink, marginBottom:14 }}>📅 Attendance Heatmap — {period}</div>
        {loading?<div style={{ color:T.sub, textAlign:'center', padding:20 }}>Loading…</div>:(
          <>
            <div style={{ display:'flex', gap:2, marginBottom:8, marginLeft:120 }}>
              {Array.from({length:daysInMonth},(_,i)=>(
                <div key={i} style={{ width:22, fontSize:9, color:T.muted, textAlign:'center' }}>{i+1}</div>
              ))}
            </div>
            {STAFF_LIST.map(name=>{
              const summary = getAttendanceSummary(name);
              return (
                <div key={name} style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8 }}>
                  <div style={{ width:110, fontSize:12, color:T.ink, fontWeight:600, flexShrink:0 }}>{name.split(' ')[0]}</div>
                  <div style={{ display:'flex', gap:2 }}>
                    {Array.from({length:daysInMonth},(_,i)=><HeatmapCell key={i} status={getStatus(name,i+1)}/>)}
                  </div>
                  <div style={{ fontSize:10, color:T.muted, marginLeft:8, display:'flex', gap:8 }}>
                    <span style={{ color:T.green }}>✅{summary.present}</span>
                    <span style={{ color:T.red }}>❌{summary.absent}</span>
                    <span style={{ color:T.purple }}>🏖️{summary.leave}</span>
                  </div>
                </div>
              );
            })}
            <div style={{ display:'flex', gap:16, marginTop:12, fontSize:11 }}>
              {[['#00d68f','Present'],['#ff4d6a','Absent'],['#ffb547','Late'],['#9b72ff','Leave'],['#4f7cff','Holiday']].map(([color,label])=>(
                <div key={label} style={{ display:'flex', alignItems:'center', gap:5 }}><div style={{ width:12, height:12, borderRadius:2, background:color }}/><span style={{ color:T.muted }}>{label}</span></div>
              ))}
            </div>
          </>
        )}
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
        {/* Leave calendar */}
        <div style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:12, overflow:'hidden' }}>
          <div style={{ padding:'12px 18px', borderBottom:`1px solid ${T.bdr}`, fontWeight:700, color:T.ink }}>🗓️ Approved Leaves</div>
          {leaves.length===0?<div style={{ padding:30, textAlign:'center', color:T.muted, fontSize:12 }}>No approved leaves this month</div>
          :leaves.map(l=>(
            <div key={l.id} style={{ padding:'10px 16px', borderBottom:`1px solid ${T.bdr}22`, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <div>
                <div style={{ fontSize:13, fontWeight:600, color:T.ink }}>{l.staff_name}</div>
                <div style={{ fontSize:11, color:T.muted }}>{l.from_date} → {l.to_date} · {l.days}d · {l.leave_type}</div>
              </div>
              <span style={{ background:T.purple+'22', color:T.purple, borderRadius:5, padding:'2px 8px', fontSize:10, fontWeight:700, textTransform:'capitalize' }}>{l.leave_type}</span>
            </div>
          ))}
        </div>

        {/* Payroll summary */}
        <div style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:12, overflow:'hidden' }}>
          <div style={{ padding:'12px 18px', borderBottom:`1px solid ${T.bdr}`, fontWeight:700, color:T.ink }}>💰 Payroll Summary — {period}</div>
          {payroll.length===0?<div style={{ padding:30, textAlign:'center', color:T.muted, fontSize:12 }}>No payroll records this month</div>
          :payroll.map(p=>(
            <div key={p.id} style={{ padding:'12px 16px', borderBottom:`1px solid ${T.bdr}22` }}>
              <div style={{ display:'flex', justifyContent:'space-between', marginBottom:6 }}>
                <div style={{ fontSize:13, fontWeight:600, color:T.ink }}>{p.staff_name}</div>
                <div style={{ fontSize:15, fontWeight:800, color:T.green }}>{fmt(p.net_pay||0)}</div>
              </div>
              <div style={{ display:'flex', gap:12, fontSize:11, color:T.muted }}>
                <span>Base: {fmt(p.base_salary||0)}</span>
                <span>Present: {p.days_present||0}d</span>
                <span style={{ color:p.paid?T.green:T.amber }}>{p.paid?'✅ Paid':'⏳ Pending'}</span>
              </div>
            </div>
          ))}
          <div style={{ padding:'12px 16px', background:T.card, display:'flex', justifyContent:'space-between', fontWeight:700, fontSize:14 }}>
            <span style={{ color:T.sub }}>Total Payroll</span>
            <span style={{ color:T.blue }}>{fmt(totalPayroll)}</span>
          </div>
        </div>

        {/* Staff performance */}
        <div style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:12, overflow:'hidden', gridColumn:'1/-1' }}>
          <div style={{ padding:'12px 18px', borderBottom:`1px solid ${T.bdr}`, fontWeight:700, color:T.ink }}>🏆 Sales Performance — {period}</div>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
            <thead><tr style={{ background:T.card }}>
              {['Staff','Sales Revenue','Orders','Target','Achievement','Commission'].map(h=><th key={h} style={{ padding:'9px 14px', textAlign:'left', fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', borderBottom:`1px solid ${T.bdr}` }}>{h}</th>)}
            </tr></thead>
            <tbody>
              {STAFF_LIST.map((name,i)=>{
                const staffSales = sales.filter(s=>s.staff_name===name);
                const revenue    = staffSales.reduce((t,s)=>t+(s.total||0),0);
                const orders     = staffSales.length;
                const target     = targets.find(t=>t.staff_name===name);
                const pct        = target?.target_rev>0?Math.min(100,Math.round(revenue/target.target_rev*100)):null;
                const commission = target?.commission_rate>0?(revenue*target.commission_rate/100):0;
                return (
                  <tr key={name} style={{ borderBottom:`1px solid ${T.bdr}22` }}>
                    <td style={{ padding:'10px 14px', color:T.ink, fontWeight:600 }}>{['🥇','🥈','🥉'][i]||'👤'} {name}</td>
                    <td style={{ padding:'10px 14px', color:T.green, fontWeight:700 }}>{fmt(revenue)}</td>
                    <td style={{ padding:'10px 14px', color:T.sub }}>{orders}</td>
                    <td style={{ padding:'10px 14px', color:T.muted }}>{target?fmt(target.target_rev):'—'}</td>
                    <td style={{ padding:'10px 14px' }}>
                      {pct!==null?<div style={{ display:'flex', alignItems:'center', gap:8 }}>
                        <div style={{ height:6, width:80, background:T.bdr, borderRadius:3, overflow:'hidden' }}><div style={{ height:'100%', width:`${pct}%`, background:pct>=100?T.green:pct>=75?T.amber:T.red, borderRadius:3 }}/></div>
                        <span style={{ fontSize:11, color:pct>=100?T.green:T.amber }}>{pct}%</span>
                      </div>:<span style={{ color:T.muted, fontSize:12 }}>No target</span>}
                    </td>
                    <td style={{ padding:'10px 14px', color:T.amber, fontWeight:700 }}>{commission>0?fmt(commission):'—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
