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
const STATUS_COLORS = { pending:T.amber, approved:T.blue, rejected:T.red, paid:T.green };
const STAFF = ['Gnanamani','Store Staff 1','Store Staff 2'];
const CATEGORIES = ['Travel','Food','Office Supplies','Equipment','Utilities','Marketing','Maintenance','Other'];

export default function ExpenseClaims({ tenant }) {
  const [claims,   setClaims]   = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [filter,   setFilter]   = useState('all');
  const [form,     setForm]     = useState({ staff_name:STAFF[0], title:'', category:'Travel', amount:'', claim_date:new Date().toISOString().slice(0,10), description:'' });
  const [saving,   setSaving]   = useState(false);

  useEffect(() => { if (tenant?.id) load(); }, [tenant?.id]);

  async function load() {
    setLoading(true);
    const { data } = await supabase.from('expense_claims').select('*').eq('tenant_id', tenant.id).order('created_at', { ascending:false });
    setClaims(data||[]);
    setLoading(false);
  }

  async function submitClaim(e) {
    e.preventDefault();
    if (!form.title || !form.amount) return;
    setSaving(true);
    await supabase.from('expense_claims').insert({ ...form, tenant_id:tenant.id, amount:parseFloat(form.amount)||0 });
    setShowForm(false);
    setForm({ staff_name:STAFF[0], title:'', category:'Travel', amount:'', claim_date:new Date().toISOString().slice(0,10), description:'' });
    setSaving(false); await load();
  }

  async function updateStatus(id, status) {
    const updates = { status, ...(status==='approved'||status==='rejected'?{ approved_by:'Manager', approved_at:new Date().toISOString() }:{}), ...(status==='paid'?{ paid_at:new Date().toISOString() }:{}) };
    await supabase.from('expense_claims').update(updates).eq('id', id);
    setClaims(prev=>prev.map(c=>c.id===id?{...c,...updates}:c));
  }

  const displayed  = filter==='all'?claims:claims.filter(c=>c.status===filter);
  const totalPending  = claims.filter(c=>c.status==='pending').reduce((s,c)=>s+(c.amount||0),0);
  const totalApproved = claims.filter(c=>c.status==='approved').reduce((s,c)=>s+(c.amount||0),0);
  const totalPaid     = claims.filter(c=>c.status==='paid').reduce((s,c)=>s+(c.amount||0),0);
  const inp = { background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:8, padding:'9px 12px', color:T.ink, fontSize:13, fontFamily:'inherit', outline:'none', width:'100%' };

  return (
    <div style={{ padding:20 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
        <div>
          <div style={{ fontSize:22, fontWeight:800, color:T.ink }}>🧾 Expense Claims</div>
          <div style={{ fontSize:13, color:T.sub }}>Staff expense submissions and reimbursements</div>
        </div>
        <button onClick={()=>setShowForm(true)} style={{ background:T.blue, color:'#fff', border:'none', borderRadius:9, padding:'10px 18px', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>+ Submit Claim</button>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12, marginBottom:20 }}>
        {[['Pending Approval',fmt(totalPending),T.amber],['Approved (Unpaid)',fmt(totalApproved),T.blue],['Total Reimbursed',fmt(totalPaid),T.green]].map(([label,val,color])=>(
          <div key={label} style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:10, padding:'14px 18px' }}>
            <div style={{ fontSize:11, color:T.sub, fontWeight:700, textTransform:'uppercase', marginBottom:6 }}>{label}</div>
            <div style={{ fontSize:20, fontWeight:800, color }}>{val}</div>
          </div>
        ))}
      </div>

      <div style={{ display:'flex', gap:8, marginBottom:14 }}>
        {['all','pending','approved','rejected','paid'].map(f=>(
          <button key={f} onClick={()=>setFilter(f)} style={{ background:filter===f?T.blue:T.srf, color:filter===f?'#fff':T.sub, border:`1px solid ${filter===f?T.blue:T.bdr}`, borderRadius:7, padding:'6px 12px', fontSize:11, cursor:'pointer', fontFamily:'inherit', textTransform:'capitalize' }}>
            {f} ({f==='all'?claims.length:claims.filter(c=>c.status===f).length})
          </button>
        ))}
      </div>

      <div style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:12, overflow:'hidden' }}>
        <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
          <thead><tr style={{ background:T.card }}>
            {['Staff','Title','Category','Amount','Date','Status','Actions'].map(h=>(
              <th key={h} style={{ padding:'9px 14px', textAlign:'left', fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', borderBottom:`1px solid ${T.bdr}` }}>{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {loading?<tr><td colSpan={7} style={{ textAlign:'center', padding:40, color:T.sub }}>Loading…</td></tr>
            :displayed.length===0?<tr><td colSpan={7} style={{ textAlign:'center', padding:40, color:T.muted }}>No claims found</td></tr>
            :displayed.map(c=>(
              <tr key={c.id} style={{ borderBottom:`1px solid ${T.bdr}22` }}>
                <td style={{ padding:'10px 14px', color:T.ink, fontWeight:600 }}>{c.staff_name}</td>
                <td style={{ padding:'10px 14px', color:T.ink }}>{c.title}{c.description&&<div style={{ fontSize:10, color:T.muted }}>{c.description}</div>}</td>
                <td style={{ padding:'10px 14px' }}><span style={{ background:T.blue+'22', color:T.blue, borderRadius:5, padding:'2px 8px', fontSize:10, fontWeight:700 }}>{c.category}</span></td>
                <td style={{ padding:'10px 14px', color:T.green, fontWeight:700 }}>{fmt(c.amount)}</td>
                <td style={{ padding:'10px 14px', color:T.muted }}>{c.claim_date}</td>
                <td style={{ padding:'10px 14px' }}><span style={{ background:STATUS_COLORS[c.status]+'22', color:STATUS_COLORS[c.status], borderRadius:5, padding:'2px 8px', fontSize:10, fontWeight:700, textTransform:'capitalize' }}>{c.status}</span></td>
                <td style={{ padding:'10px 14px' }}>
                  <div style={{ display:'flex', gap:5 }}>
                    {c.status==='pending'&&<><button onClick={()=>updateStatus(c.id,'approved')} style={{ background:T.green+'22', color:T.green, border:'none', borderRadius:5, padding:'4px 8px', fontSize:10, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>✅ Approve</button><button onClick={()=>updateStatus(c.id,'rejected')} style={{ background:T.red+'22', color:T.red, border:'none', borderRadius:5, padding:'4px 8px', fontSize:10, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>❌ Reject</button></>}
                    {c.status==='approved'&&<button onClick={()=>updateStatus(c.id,'paid')} style={{ background:T.blue+'22', color:T.blue, border:'none', borderRadius:5, padding:'4px 8px', fontSize:10, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>💰 Mark Paid</button>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showForm&&(
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.8)', zIndex:200, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
          <div style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:14, padding:24, width:'100%', maxWidth:460 }}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:18 }}>
              <div style={{ fontSize:17, fontWeight:700, color:T.ink }}>Submit Expense Claim</div>
              <button onClick={()=>setShowForm(false)} style={{ background:'none', border:'none', color:T.muted, cursor:'pointer', fontSize:22 }}>×</button>
            </div>
            <form onSubmit={submitClaim}>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                <div><label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:5 }}>Staff Member</label>
                  <select value={form.staff_name} onChange={e=>setForm(f=>({...f,staff_name:e.target.value}))} style={{ ...inp, cursor:'pointer' }}>{STAFF.map(s=><option key={s} value={s}>{s}</option>)}</select></div>
                <div><label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:5 }}>Category</label>
                  <select value={form.category} onChange={e=>setForm(f=>({...f,category:e.target.value}))} style={{ ...inp, cursor:'pointer' }}>{CATEGORIES.map(c=><option key={c} value={c}>{c}</option>)}</select></div>
                <div style={{ gridColumn:'1/-1' }}><label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:5 }}>Claim Title *</label>
                  <input value={form.title} onChange={e=>setForm(f=>({...f,title:e.target.value}))} placeholder="e.g. Auto fare to supplier visit" style={inp} required/></div>
                <div><label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:5 }}>Amount (Rs.) *</label>
                  <input type="number" value={form.amount} onChange={e=>setForm(f=>({...f,amount:e.target.value}))} placeholder="0" style={inp} required/></div>
                <div><label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:5 }}>Date</label>
                  <input type="date" value={form.claim_date} onChange={e=>setForm(f=>({...f,claim_date:e.target.value}))} style={inp}/></div>
                <div style={{ gridColumn:'1/-1' }}><label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:5 }}>Description</label>
                  <input value={form.description} onChange={e=>setForm(f=>({...f,description:e.target.value}))} placeholder="Brief description of the expense" style={inp}/></div>
              </div>
              <div style={{ display:'flex', gap:10, marginTop:16 }}>
                <button type="button" onClick={()=>setShowForm(false)} style={{ flex:1, background:T.card, color:T.sub, border:`1px solid ${T.bdr}`, borderRadius:8, padding:'11px', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>Cancel</button>
                <button type="submit" disabled={saving} style={{ flex:2, background:T.blue, color:'#fff', border:'none', borderRadius:8, padding:'11px', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>{saving?'Submitting…':'Submit Claim'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
