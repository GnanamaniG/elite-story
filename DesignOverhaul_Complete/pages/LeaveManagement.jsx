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
const STATUS_COLORS = { pending:T.amber, approved:T.green, rejected:T.red };
const LEAVE_TYPES   = ['sick','casual','earned','holiday','unpaid'];
const LEAVE_COLORS  = { sick:T.red, casual:T.blue, earned:T.green, holiday:T.teal, unpaid:T.muted };

const STAFF_LIST = ['Gnanamani','Store Staff 1','Store Staff 2'];

function daysBetween(a, b) {
  return Math.max(1, Math.ceil((new Date(b)-new Date(a))/86400000) + 1);
}

export default function LeaveManagement({ tenant, user }) {
  const [requests,  setRequests]  = useState([]);
  const [balances,  setBalances]  = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [showForm,  setShowForm]  = useState(false);
  const [tab,       setTab]       = useState('requests'); // requests | balances | calendar
  const [filterStatus,setFilterStatus] = useState('all');
  const [form,      setForm]      = useState({ staff_name:STAFF_LIST[0], leave_type:'casual', from_date:'', to_date:'', reason:'' });
  const [saving,    setSaving]    = useState(false);
  const year = new Date().getFullYear();

  useEffect(() => { if (tenant?.id) load(); }, [tenant?.id]);

  async function load() {
    setLoading(true);
    const [reqRes, balRes] = await Promise.all([
      supabase.from('leave_requests').select('*').eq('tenant_id', tenant.id).order('created_at', { ascending:false }),
      supabase.from('leave_balances').select('*').eq('tenant_id', tenant.id).eq('year', year),
    ]);
    setRequests(reqRes.data||[]);
    // Ensure balances exist for all staff
    const bal = balRes.data||[];
    const missing = STAFF_LIST.filter(s=>!bal.find(b=>b.staff_name===s));
    if (missing.length) {
      const newBal = missing.map(s=>({ tenant_id:tenant.id, staff_name:s, year, casual_total:12, sick_total:12, earned_total:15 }));
      const { data } = await supabase.from('leave_balances').insert(newBal).select();
      setBalances([...bal,...(data||[])]);
    } else { setBalances(bal); }
    setLoading(false);
  }

  async function submitRequest(e) {
    e.preventDefault();
    if (!form.from_date || !form.to_date) return alert('Select dates');
    setSaving(true);
    const days = daysBetween(form.from_date, form.to_date);
    await supabase.from('leave_requests').insert({ ...form, tenant_id:tenant.id, days });
    setSaving(false); setShowForm(false);
    setForm({ staff_name:STAFF_LIST[0], leave_type:'casual', from_date:'', to_date:'', reason:'' });
    await load();
  }

  async function updateStatus(id, status, staffName, leaveType, days) {
    await supabase.from('leave_requests').update({ status, approved_by:'Manager', approved_at:new Date().toISOString() }).eq('id', id);
    if (status==='approved') {
      const balField = leaveType+'_used';
      const bal = balances.find(b=>b.staff_name===staffName);
      if (bal) await supabase.from('leave_balances').update({ [balField]:(bal[balField]||0)+days }).eq('id', bal.id);
    }
    await load();
  }

  const displayed = requests.filter(r=>filterStatus==='all'||r.status===filterStatus);
  const pending   = requests.filter(r=>r.status==='pending').length;

  const inp = { background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:8, padding:'9px 12px', color:T.ink, fontSize:13, fontFamily:'inherit', outline:'none', width:'100%' };

  return (
    <div style={{ padding:20 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
        <div>
          <div style={{ fontSize:22, fontWeight:800, color:T.ink }}>🗓️ Leave Management</div>
          <div style={{ fontSize:13, color:T.sub }}>{pending} pending approvals · {year}</div>
        </div>
        <button onClick={()=>setShowForm(true)} style={{ background:T.blue, color:'#fff', border:'none', borderRadius:9, padding:'10px 18px', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>+ Apply Leave</button>
      </div>

      {/* Tabs */}
      <div style={{ display:'flex', gap:6, marginBottom:16 }}>
        {[['requests','📋 Requests'],['balances','📊 Leave Balance'],['calendar','📅 Calendar']].map(([id,label])=>(
          <button key={id} onClick={()=>setTab(id)} style={{ background:tab===id?T.blue:T.srf, color:tab===id?'#fff':T.sub, border:`1px solid ${tab===id?T.blue:T.bdr}`, borderRadius:7, padding:'7px 14px', fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}>
            {label} {id==='requests'&&pending>0?<span style={{ background:T.red, color:'#fff', borderRadius:10, padding:'0 5px', fontSize:10, marginLeft:4 }}>{pending}</span>:''}
          </button>
        ))}
      </div>

      {tab === 'requests' && (
        <>
          <div style={{ display:'flex', gap:8, marginBottom:12 }}>
            {['all','pending','approved','rejected'].map(f=>(
              <button key={f} onClick={()=>setFilterStatus(f)} style={{ background:filterStatus===f?T.blue:T.srf, color:filterStatus===f?'#fff':T.sub, border:`1px solid ${filterStatus===f?T.blue:T.bdr}`, borderRadius:7, padding:'5px 12px', fontSize:11, cursor:'pointer', fontFamily:'inherit', textTransform:'capitalize' }}>{f} ({f==='all'?requests.length:requests.filter(r=>r.status===f).length})</button>
            ))}
          </div>
          <div style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:12, overflow:'hidden' }}>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
              <thead><tr style={{ background:T.card }}>
                {['Staff','Type','From','To','Days','Reason','Status','Action'].map(h=>(
                  <th key={h} style={{ padding:'9px 14px', textAlign:'left', fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', borderBottom:`1px solid ${T.bdr}` }}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {loading?<tr><td colSpan={8} style={{ textAlign:'center', padding:40, color:T.sub }}>Loading…</td></tr>
                :displayed.length===0?<tr><td colSpan={8} style={{ textAlign:'center', padding:40, color:T.muted }}>No leave requests</td></tr>
                :displayed.map(r=>(
                  <tr key={r.id} style={{ borderBottom:`1px solid ${T.bdr}22` }}>
                    <td style={{ padding:'10px 14px', color:T.ink, fontWeight:600 }}>{r.staff_name}</td>
                    <td style={{ padding:'10px 14px' }}>
                      <span style={{ background:LEAVE_COLORS[r.leave_type]+'22', color:LEAVE_COLORS[r.leave_type], borderRadius:5, padding:'2px 8px', fontSize:10, fontWeight:700, textTransform:'capitalize' }}>{r.leave_type}</span>
                    </td>
                    <td style={{ padding:'10px 14px', color:T.sub }}>{r.from_date}</td>
                    <td style={{ padding:'10px 14px', color:T.sub }}>{r.to_date}</td>
                    <td style={{ padding:'10px 14px', color:T.ink, fontWeight:700 }}>{r.days}</td>
                    <td style={{ padding:'10px 14px', color:T.muted, maxWidth:150, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{r.reason||'—'}</td>
                    <td style={{ padding:'10px 14px' }}>
                      <span style={{ background:STATUS_COLORS[r.status]+'22', color:STATUS_COLORS[r.status], borderRadius:5, padding:'2px 8px', fontSize:10, fontWeight:700, textTransform:'capitalize' }}>{r.status}</span>
                    </td>
                    <td style={{ padding:'10px 14px' }}>
                      {r.status==='pending'&&<div style={{ display:'flex', gap:5 }}>
                        <button onClick={()=>updateStatus(r.id,'approved',r.staff_name,r.leave_type,r.days)} style={{ background:T.green+'22', color:T.green, border:'none', borderRadius:5, padding:'4px 10px', fontSize:10, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>✅</button>
                        <button onClick={()=>updateStatus(r.id,'rejected',r.staff_name,r.leave_type,r.days)} style={{ background:T.red+'22', color:T.red, border:'none', borderRadius:5, padding:'4px 10px', fontSize:10, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>❌</button>
                      </div>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {tab === 'balances' && (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))', gap:14 }}>
          {STAFF_LIST.map(name => {
            const bal = balances.find(b=>b.staff_name===name)||{};
            return (
              <div key={name} style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:12, padding:18 }}>
                <div style={{ fontWeight:700, color:T.ink, fontSize:15, marginBottom:14 }}>{name}</div>
                {[['Casual','casual',T.blue],['Sick','sick',T.red],['Earned','earned',T.green]].map(([label,key,color])=>{
                  const total = bal[key+'_total']||0;
                  const used  = bal[key+'_used']||0;
                  const avail = total - used;
                  return (
                    <div key={key} style={{ marginBottom:12 }}>
                      <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4, fontSize:12 }}>
                        <span style={{ color:T.sub }}>{label}</span>
                        <span style={{ color, fontWeight:700 }}>{avail} / {total} days left</span>
                      </div>
                      <div style={{ height:6, background:T.bdr, borderRadius:3, overflow:'hidden' }}>
                        <div style={{ height:'100%', width:`${total>0?Math.min(100,(used/total)*100):0}%`, background:color, borderRadius:3 }}/>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}

      {tab === 'calendar' && (
        <div style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:12, padding:20 }}>
          <div style={{ fontWeight:700, color:T.ink, marginBottom:16 }}>Upcoming & Recent Leaves</div>
          {requests.filter(r=>r.status==='approved').sort((a,b)=>b.from_date.localeCompare(a.from_date)).map(r=>(
            <div key={r.id} style={{ display:'flex', alignItems:'center', gap:12, padding:'10px 14px', background:T.card, borderRadius:9, marginBottom:8 }}>
              <div style={{ width:40, height:40, borderRadius:8, background:LEAVE_COLORS[r.leave_type]+'22', display:'flex', alignItems:'center', justifyContent:'center', fontSize:16 }}>
                {r.leave_type==='sick'?'🤒':r.leave_type==='casual'?'🏖️':r.leave_type==='earned'?'🌟':'📅'}
              </div>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:13, fontWeight:600, color:T.ink }}>{r.staff_name}</div>
                <div style={{ fontSize:11, color:T.sub }}>{r.from_date} → {r.to_date} · {r.days} day{r.days!==1?'s':''}</div>
              </div>
              <span style={{ background:LEAVE_COLORS[r.leave_type]+'22', color:LEAVE_COLORS[r.leave_type], borderRadius:5, padding:'2px 8px', fontSize:10, fontWeight:700, textTransform:'capitalize' }}>{r.leave_type}</span>
            </div>
          ))}
          {!requests.filter(r=>r.status==='approved').length&&<div style={{ textAlign:'center', color:T.muted, padding:40, fontSize:12 }}>No approved leaves yet</div>}
        </div>
      )}

      {showForm && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.8)', zIndex:200, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
          <div style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:14, padding:24, width:'100%', maxWidth:440 }}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:18 }}>
              <div style={{ fontSize:17, fontWeight:700, color:T.ink }}>Apply for Leave</div>
              <button onClick={()=>setShowForm(false)} style={{ background:'none', border:'none', color:T.muted, cursor:'pointer', fontSize:22 }}>×</button>
            </div>
            <form onSubmit={submitRequest}>
              {[['Staff Member','select','staff_name',null,STAFF_LIST],['Leave Type','select','leave_type',null,LEAVE_TYPES],['From Date','date','from_date'],['To Date','date','to_date'],['Reason','text','reason','Optional reason or notes']].map(([label,type,key,ph,opts])=>(
                <div key={key} style={{ marginBottom:12 }}>
                  <label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:5 }}>{label}</label>
                  {type==='select'?
                    <select value={form[key]} onChange={e=>setForm(f=>({...f,[key]:e.target.value}))} style={{ ...inp, cursor:'pointer' }}>
                      {opts.map(o=><option key={o} value={o} style={{ textTransform:'capitalize' }}>{o.charAt(0).toUpperCase()+o.slice(1)}</option>)}
                    </select>:
                    <input type={type} value={form[key]} onChange={e=>setForm(f=>({...f,[key]:e.target.value}))} placeholder={ph||''} style={inp} min={type==='date'?new Date().toISOString().slice(0,10):undefined}/>
                  }
                </div>
              ))}
              {form.from_date&&form.to_date&&<div style={{ background:T.blue+'18', borderRadius:7, padding:'8px 12px', fontSize:12, color:T.blue, marginBottom:12 }}>📅 {daysBetween(form.from_date,form.to_date)} day(s) of {form.leave_type} leave</div>}
              <div style={{ display:'flex', gap:10 }}>
                <button type="button" onClick={()=>setShowForm(false)} style={{ flex:1, background:T.card, color:T.sub, border:`1px solid ${T.bdr}`, borderRadius:8, padding:'11px', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>Cancel</button>
                <button type="submit" disabled={saving} style={{ flex:2, background:T.blue, color:'#fff', border:'none', borderRadius:8, padding:'11px', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>{saving?'Submitting…':'Submit Request'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
