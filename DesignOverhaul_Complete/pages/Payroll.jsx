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

export default function Payroll({ tenant }) {
  const [staff,     setStaff]     = useState([]);
  const [configs,   setConfigs]   = useState([]);
  const [payroll,   setPayroll]   = useState([]);
  const [month,     setMonth]     = useState(new Date().toISOString().slice(0,7));
  const [loading,   setLoading]   = useState(true);
  const [editConfig,setEditConfig]= useState(null);
  const [saving,    setSaving]    = useState(false);

  useEffect(() => { if (tenant?.id) load(); }, [tenant?.id, month]);

  async function load() {
    setLoading(true);
    const [usersRes, configsRes, payrollRes, attendanceRes] = await Promise.all([
      supabase.from('users').select('*').eq('tenant_id', tenant.id).eq('active', true),
      supabase.from('staff_config').select('*').eq('tenant_id', tenant.id),
      supabase.from('payroll').select('*').eq('tenant_id', tenant.id).eq('month', month),
      supabase.from('attendance').select('*').eq('tenant_id', tenant.id).gte('date', month+'-01').lte('date', month+'-31'),
    ]);
    setStaff(usersRes.data || []);
    setConfigs(configsRes.data || []);

    // Auto-compute payroll from attendance if not already saved
    const computed = (usersRes.data||[]).map(u => {
      const existing = (payrollRes.data||[]).find(p => p.user_id === u.id);
      if (existing) return existing;
      const cfg = (configsRes.data||[]).find(c => c.user_id === u.id);
      const att = (attendanceRes.data||[]).filter(a => a.user_id === u.id);
      const present  = att.filter(a => a.status === 'present').length;
      const halfDay  = att.filter(a => a.status === 'half_day').length;
      const salary   = cfg?.monthly_salary || 0;
      const days     = cfg?.working_days || 26;
      const daysWorked = present + (halfDay * 0.5);
      const netPay   = salary > 0 && days > 0 ? Math.round((salary / days) * daysWorked) : 0;
      return { user_id:u.id, staff_name:u.name, salary, days_worked:daysWorked, days_total:days, advance:cfg?.advance_balance||0, deductions:0, bonus:0, net_pay:netPay, status:'pending' };
    });
    setPayroll(computed);
    setLoading(false);
  }

  async function savePayslip(record) {
    setSaving(record.user_id);
    const netPay = Math.round((record.salary / record.days_total) * record.days_worked) + (record.bonus||0) - (record.deductions||0) - (record.advance||0);
    const payload = { ...record, net_pay: Math.max(0, netPay), tenant_id: tenant.id, month };
    if (record.id) {
      await supabase.from('payroll').update(payload).eq('id', record.id);
    } else {
      await supabase.from('payroll').insert(payload);
    }
    await load();
    setSaving('');
  }

  async function markPaid(record) {
    await supabase.from('payroll').upsert({ ...record, tenant_id:tenant.id, month, status:'paid', paid_on: new Date().toISOString().slice(0,10) }, { onConflict:'tenant_id,user_id,month' });
    await load();
  }

  async function saveConfig(cfg) {
    setSaving('config');
    if (cfg.id) await supabase.from('staff_config').update(cfg).eq('id', cfg.id);
    else await supabase.from('staff_config').insert({ ...cfg, tenant_id: tenant.id });
    setEditConfig(null);
    await load();
    setSaving('');
  }

  const inp = { background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:8, padding:'8px 12px', color:T.ink, fontSize:13, fontFamily:'inherit', outline:'none', width:'100%' };
  const totalNetPay  = payroll.reduce((s, p) => s + (p.net_pay||0), 0);
  const totalPending = payroll.filter(p => p.status !== 'paid').reduce((s, p) => s + (p.net_pay||0), 0);

  return (
    <div style={{ padding:20 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
        <div>
          <div style={{ fontSize:22, fontWeight:800, color:T.ink }}>Payroll</div>
          <div style={{ fontSize:13, color:T.sub }}>Monthly salary management</div>
        </div>
        <div style={{ display:'flex', gap:8, alignItems:'center' }}>
          <input type="month" value={month} onChange={e => setMonth(e.target.value)} style={{ ...inp, width:'auto' }} />
        </div>
      </div>

      {/* Stats */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12, marginBottom:20 }}>
        {[
          ['Total Payroll', fmt(totalNetPay), T.blue],
          ['Pending Payment', fmt(totalPending), T.amber],
          ['Staff Count', staff.length, T.green],
        ].map(([label, val, color]) => (
          <div key={label} style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:10, padding:'14px 18px' }}>
            <div style={{ fontSize:11, color:T.sub, fontWeight:700, textTransform:'uppercase', marginBottom:6 }}>{label}</div>
            <div style={{ fontSize:22, fontWeight:800, color }}>{val}</div>
          </div>
        ))}
      </div>

      {/* Payroll table */}
      <div style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:12, overflow:'hidden', marginBottom:16 }}>
        <div style={{ padding:'12px 18px', borderBottom:`1px solid ${T.bdr}`, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <div style={{ fontWeight:700, color:T.ink }}>Payslips — {month}</div>
          <button onClick={() => setEditConfig({})} style={{ background:T.blue+'22', color:T.blue, border:`1px solid ${T.blue}44`, borderRadius:7, padding:'6px 14px', fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>
            ⚙️ Set Salaries
          </button>
        </div>
        {loading ? <div style={{ padding:40, textAlign:'center', color:T.sub }}>Computing payroll…</div> : (
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
            <thead>
              <tr style={{ background:T.card }}>
                {['Staff','Basic Salary','Days Worked','Advance','Deductions','Bonus','Net Pay','Status','Action'].map(h => (
                  <th key={h} style={{ padding:'9px 14px', textAlign:'left', fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', borderBottom:`1px solid ${T.bdr}` }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {payroll.map(p => (
                <tr key={p.user_id} style={{ borderBottom:`1px solid ${T.bdr}22` }}>
                  <td style={{ padding:'12px 14px', color:T.ink, fontWeight:600 }}>{p.staff_name}</td>
                  <td style={{ padding:'12px 14px', color:T.sub }}>{fmt(p.salary)}</td>
                  <td style={{ padding:'12px 14px', color:T.sub }}>{p.days_worked}/{p.days_total}</td>
                  <td style={{ padding:'12px 14px', color:T.red }}>{fmt(p.advance)}</td>
                  <td style={{ padding:'12px 14px', color:T.red }}>{fmt(p.deductions)}</td>
                  <td style={{ padding:'12px 14px', color:T.green }}>{fmt(p.bonus)}</td>
                  <td style={{ padding:'12px 14px', color:T.green, fontWeight:800, fontSize:15 }}>{fmt(p.net_pay)}</td>
                  <td style={{ padding:'12px 14px' }}>
                    <span style={{ background:p.status==='paid'?T.green+'22':T.amber+'22', color:p.status==='paid'?T.green:T.amber, borderRadius:6, padding:'3px 10px', fontSize:11, fontWeight:700 }}>
                      {p.status==='paid'?'✅ Paid':'⏳ Pending'}
                    </span>
                  </td>
                  <td style={{ padding:'12px 14px' }}>
                    {p.status !== 'paid' && (
                      <button onClick={() => markPaid(p)}
                        style={{ background:T.green+'22', color:T.green, border:'none', borderRadius:6, padding:'5px 12px', fontSize:11, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>
                        Mark Paid
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {payroll.length === 0 && (
                <tr><td colSpan={9} style={{ textAlign:'center', padding:40, color:T.muted }}>No staff members. Add them in Team section first.</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Salary config modal */}
      {editConfig !== null && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.75)', zIndex:200, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
          <div style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:14, padding:24, width:'100%', maxWidth:560 }}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:20 }}>
              <div style={{ fontSize:17, fontWeight:700, color:T.ink }}>Set Monthly Salaries</div>
              <button onClick={() => setEditConfig(null)} style={{ background:'none', border:'none', color:T.muted, cursor:'pointer', fontSize:22 }}>×</button>
            </div>
            {staff.map(member => {
              const cfg = configs.find(c => c.user_id === member.id) || {};
              return (
                <div key={member.id} style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:10, marginBottom:12, alignItems:'center' }}>
                  <div style={{ fontSize:13, fontWeight:600, color:T.ink }}>{member.name}</div>
                  <div>
                    <label style={{ fontSize:10, color:T.sub, display:'block', marginBottom:3 }}>Monthly Salary (Rs.)</label>
                    <input type="number" defaultValue={cfg.monthly_salary||0} id={`sal-${member.id}`} style={inp} />
                  </div>
                  <div>
                    <label style={{ fontSize:10, color:T.sub, display:'block', marginBottom:3 }}>Working Days</label>
                    <input type="number" defaultValue={cfg.working_days||26} id={`days-${member.id}`} style={inp} />
                  </div>
                </div>
              );
            })}
            <button onClick={async () => {
              setSaving('config');
              for (const member of staff) {
                const salary = parseFloat(document.getElementById(`sal-${member.id}`)?.value||0);
                const days   = parseInt(document.getElementById(`days-${member.id}`)?.value||26);
                const cfg    = configs.find(c => c.user_id === member.id);
                if (cfg) {
                  await supabase.from('staff_config').update({ monthly_salary:salary, working_days:days }).eq('id', cfg.id);
                } else {
                  await supabase.from('staff_config').insert({ tenant_id:tenant.id, user_id:member.id, staff_name:member.name, monthly_salary:salary, working_days:days });
                }
              }
              setEditConfig(null); setSaving(''); load();
            }} style={{ background:T.blue, color:'#fff', border:'none', borderRadius:9, padding:'12px', fontSize:14, fontWeight:700, cursor:'pointer', fontFamily:'inherit', width:'100%', marginTop:8 }}>
              {saving==='config' ? 'Saving…' : 'Save All Salaries'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
