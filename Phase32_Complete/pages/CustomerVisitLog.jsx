import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

const T = {
  bg:'#F7F3F3', srf:'#FFFFFF', card:'#FFFFFF', bdr:'#E8DEDE',
  red:'#C0392B', darkRed:'#8B0000', lightRed:'#FEF2F2',
  green:'#16A34A', amber:'#D97706', blue:'#2563EB', purple:'#7C3AED',
  ink:'#111827', sub:'#6B7280', muted:'#9CA3AF', white:'#FFFFFF'
};
const fmt = n => 'Rs.' + (n||0).toLocaleString('en-IN', { maximumFractionDigits:0 });
const pct = n => (n||0).toFixed(1) + '%';
const btn = (bg,color,extra={}) => ({ background:bg, color, border:'none', borderRadius:8, padding:'9px 16px', fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:'inherit', ...extra });
const inp = { background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:8, padding:'9px 12px', color:T.ink, fontSize:13, fontFamily:'inherit', outline:'none', width:'100%' };

const TYPES = {
  walk_in:     { label:'Walk-in',     icon:'🚶', color:'#2563EB', bg:'#EFF6FF' },
  appointment: { label:'Appointment', icon:'📅', color:'#7C3AED', bg:'#F5F3FF' },
  enquiry:     { label:'Enquiry',     icon:'❓', color:'#D97706', bg:'#FFFBEB' },
  repeat:      { label:'Repeat',      icon:'🔁', color:'#16A34A', bg:'#F0FDF4' },
  return:      { label:'Return',      icon:'↩️', color:'#C0392B', bg:'#FEF2F2' },
};
const STAFF = ['Gnanamani','Store Staff 1','Store Staff 2'];
const LOST_REASONS = ['Price too high','Size not available','Colour not available','Just browsing','Comparing options','Out of stock','Other'];

export default function CustomerVisitLog({ tenant }) {
  const [visits,    setVisits]    = useState([]);
  const [customers, setCustomers] = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [showForm,  setShowForm]  = useState(false);
  const [saving,    setSaving]    = useState(false);
  const [date,      setDate]      = useState(new Date().toISOString().slice(0,10));
  const [period,    setPeriod]    = useState('day');
  const [form, setForm] = useState({ customer_name:'', customer_id:'', phone:'', visit_type:'walk_in', interest:'', attended_by:'', converted:false, sale_value:'', lost_reason:'', follow_up:'', notes:'' });

  useEffect(() => { if (tenant?.id) load(); }, [tenant?.id, date, period]);

  async function load() {
    setLoading(true);
    let from = date;
    if (period==='week')  { const d=new Date(date); d.setDate(d.getDate()-7);  from=d.toISOString().slice(0,10); }
    if (period==='month') { const d=new Date(date); d.setDate(d.getDate()-30); from=d.toISOString().slice(0,10); }
    const [vRes, cRes] = await Promise.all([
      supabase.from('customer_visits').select('*').eq('tenant_id', tenant.id).gte('visit_date', from).lte('visit_date', date).order('visit_time', { ascending:false }),
      supabase.from('customers').select('id,name,phone').eq('tenant_id', tenant.id).order('name'),
    ]);
    setVisits(vRes.data||[]);
    setCustomers(cRes.data||[]);
    setLoading(false);
  }

  async function saveVisit(e) {
    e.preventDefault(); setSaving(true);
    await supabase.from('customer_visits').insert({
      ...form, tenant_id:tenant.id, visit_date:date,
      sale_value:parseFloat(form.sale_value)||0,
      customer_id:form.customer_id||null, follow_up:form.follow_up||null,
    });
    setShowForm(false);
    setForm({ customer_name:'', customer_id:'', phone:'', visit_type:'walk_in', interest:'', attended_by:'', converted:false, sale_value:'', lost_reason:'', follow_up:'', notes:'' });
    setSaving(false); await load();
  }

  async function toggleConvert(v) {
    if (v.converted) return;
    const val = prompt('Sale value (Rs.):');
    if (val===null) return;
    await supabase.from('customer_visits').update({ converted:true, sale_value:parseFloat(val)||0, lost_reason:null }).eq('id', v.id);
    await load();
  }

  const total     = visits.length;
  const converted = visits.filter(v=>v.converted).length;
  const convRate  = total>0 ? (converted/total*100) : 0;
  const revenue   = visits.reduce((s,v)=>s+(v.sale_value||0),0);
  const avgTicket = converted>0 ? revenue/converted : 0;

  // Lost reason analysis
  const lostByReason = {};
  visits.filter(v=>!v.converted&&v.lost_reason).forEach(v=>{ lostByReason[v.lost_reason]=(lostByReason[v.lost_reason]||0)+1; });
  const topLost = Object.entries(lostByReason).sort((a,b)=>b[1]-a[1]).slice(0,4);

  // Staff conversion
  const byStaff = {};
  visits.forEach(v=>{ const s=v.attended_by||'Unassigned'; if(!byStaff[s])byStaff[s]={total:0,conv:0,rev:0}; byStaff[s].total++; if(v.converted){byStaff[s].conv++;byStaff[s].rev+=v.sale_value||0;} });

  return (
    <div style={{ padding:24, background:T.bg, minHeight:'100%' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
        <div>
          <div style={{ fontSize:18, fontWeight:800, color:T.darkRed }}>🚶 Customer Visit Log</div>
          <div style={{ fontSize:12, color:T.sub, marginTop:2 }}>Track footfall, conversion rate and lost sale reasons</div>
        </div>
        <div style={{ display:'flex', gap:8, alignItems:'center' }}>
          <div style={{ display:'flex', background:T.white, border:`1px solid ${T.bdr}`, borderRadius:8, overflow:'hidden' }}>
            {[['day','Day'],['week','7d'],['month','30d']].map(([v,l])=>(
              <button key={v} onClick={()=>setPeriod(v)} style={{ padding:'8px 14px', background:period===v?T.red:'transparent', color:period===v?T.white:T.sub, border:'none', cursor:'pointer', fontFamily:'inherit', fontSize:11, fontWeight:600 }}>{l}</button>
            ))}
          </div>
          <input type="date" value={date} onChange={e=>setDate(e.target.value)} style={{ background:T.white, border:`1px solid ${T.bdr}`, borderRadius:8, padding:'8px 12px', color:T.ink, fontSize:12, fontFamily:'inherit', outline:'none' }}/>
          <button onClick={()=>setShowForm(true)} style={btn(T.red, T.white)}>+ Log Visit</button>
        </div>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:14, marginBottom:18 }}>
        {[['Total Visits',total,T.blue,'🚶'],['Converted',converted,T.green,'✅'],['Conversion Rate',pct(convRate),convRate>=30?T.green:convRate>=15?T.amber:T.red,'📊'],['Revenue',fmt(revenue),T.purple,'💰'],['Avg Ticket',fmt(avgTicket),T.amber,'🎫']].map(([label,val,color,icon])=>(
          <div key={label} style={{ background:T.white, border:`1px solid ${T.bdr}`, borderRadius:12, padding:'14px 16px', boxShadow:'0 1px 4px rgba(0,0,0,.05)' }}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:5 }}>
              <div style={{ fontSize:9, color:T.sub, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.05em' }}>{label}</div>
              <span style={{ fontSize:16 }}>{icon}</span>
            </div>
            <div style={{ fontSize:19, fontWeight:900, color, letterSpacing:'-0.02em' }}>{val}</div>
          </div>
        ))}
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14, marginBottom:18 }}>
        {topLost.length>0&&<div style={{ background:T.white, border:`1px solid ${T.bdr}`, borderRadius:12, padding:'14px 18px' }}>
          <div style={{ fontSize:11, fontWeight:700, color:T.darkRed, textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:10 }}>❌ Top Lost Sale Reasons</div>
          {topLost.map(([reason,count])=>(
            <div key={reason} style={{ marginBottom:8 }}>
              <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, marginBottom:3 }}>
                <span style={{ color:T.sub }}>{reason}</span><span style={{ color:T.red, fontWeight:700 }}>{count}</span>
              </div>
              <div style={{ height:5, background:'#F3F4F6', borderRadius:3, overflow:'hidden' }}>
                <div style={{ height:'100%', width:`${count/(total-converted||1)*100}%`, background:T.red, borderRadius:3 }}/>
              </div>
            </div>
          ))}
        </div>}
        {Object.keys(byStaff).length>0&&<div style={{ background:T.white, border:`1px solid ${T.bdr}`, borderRadius:12, padding:'14px 18px' }}>
          <div style={{ fontSize:11, fontWeight:700, color:T.darkRed, textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:10 }}>👤 Staff Conversion</div>
          {Object.entries(byStaff).sort((a,b)=>(b[1].conv/b[1].total)-(a[1].conv/a[1].total)).map(([staff,d])=>{
            const rate = d.total>0?(d.conv/d.total*100):0;
            return (
              <div key={staff} style={{ marginBottom:8 }}>
                <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, marginBottom:3 }}>
                  <span style={{ color:T.ink, fontWeight:600 }}>{staff}</span>
                  <span style={{ color:rate>=30?T.green:T.amber, fontWeight:700 }}>{pct(rate)} · {fmt(d.rev)}</span>
                </div>
                <div style={{ height:5, background:'#F3F4F6', borderRadius:3, overflow:'hidden' }}>
                  <div style={{ height:'100%', width:`${rate}%`, background:rate>=30?T.green:T.amber, borderRadius:3 }}/>
                </div>
                <div style={{ fontSize:10, color:T.muted, marginTop:2 }}>{d.conv} of {d.total} visits converted</div>
              </div>
            );
          })}
        </div>}
      </div>

      <div style={{ background:T.white, border:`1px solid ${T.bdr}`, borderRadius:14, overflow:'hidden', boxShadow:'0 1px 4px rgba(0,0,0,.05)' }}>
        <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
          <thead><tr style={{ background:T.lightRed }}>
            {['Time','Customer','Type','Interest','Attended By','Result','Value','Follow-up'].map(h=>(
              <th key={h} style={{ padding:'11px 12px', textAlign:h==='Value'?'right':'left', fontSize:9, color:T.darkRed, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.04em', borderBottom:`1px solid ${T.bdr}` }}>{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {loading?<tr><td colSpan={8} style={{ textAlign:'center', padding:50, color:T.muted }}>Loading…</td></tr>
            :visits.length===0?<tr><td colSpan={8} style={{ textAlign:'center', padding:50 }}>
              <div style={{ fontSize:36, marginBottom:8 }}>🚶</div>
              <div style={{ color:T.muted, fontWeight:600 }}>No visits logged</div>
              <div style={{ color:T.muted, fontSize:11, marginTop:4 }}>Log walk-ins to track conversion rate</div>
            </td></tr>
            :visits.map(v=>{
              const t = TYPES[v.visit_type]||TYPES.walk_in;
              return (
                <tr key={v.id} style={{ borderBottom:`1px solid ${T.bdr}22`, background:v.converted?'#FAFDFA':'transparent' }}>
                  <td style={{ padding:'10px 12px', color:T.muted, fontSize:11 }}>{v.visit_time?new Date(v.visit_time).toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'}):'—'}</td>
                  <td style={{ padding:'10px 12px' }}>
                    <div style={{ color:T.ink, fontWeight:600 }}>{v.customer_name||'Walk-in'}</div>
                    {v.phone&&<div style={{ fontSize:10, color:T.muted }}>{v.phone}</div>}
                  </td>
                  <td style={{ padding:'10px 12px' }}><span style={{ background:t.bg, color:t.color, borderRadius:5, padding:'2px 8px', fontSize:10, fontWeight:700 }}>{t.icon} {t.label}</span></td>
                  <td style={{ padding:'10px 12px', color:T.sub, fontSize:11 }}>{v.interest||'—'}</td>
                  <td style={{ padding:'10px 12px', color:T.blue, fontSize:11 }}>{v.attended_by||'—'}</td>
                  <td style={{ padding:'10px 12px' }}>
                    {v.converted
                      ? <span style={{ background:'#F0FDF4', color:T.green, border:'1px solid #BBF7D0', borderRadius:5, padding:'2px 9px', fontSize:10, fontWeight:700 }}>✅ Converted</span>
                      : <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                          <span style={{ fontSize:10, color:T.red }}>{v.lost_reason||'Not converted'}</span>
                          <button onClick={()=>toggleConvert(v)} style={{ background:T.lightRed, color:T.red, border:'none', borderRadius:5, padding:'2px 7px', fontSize:9, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>Convert</button>
                        </div>}
                  </td>
                  <td style={{ padding:'10px 12px', textAlign:'right', color:v.sale_value>0?T.green:T.muted, fontWeight:v.sale_value>0?700:400 }}>{v.sale_value>0?fmt(v.sale_value):'—'}</td>
                  <td style={{ padding:'10px 12px', color:T.amber, fontSize:11 }}>{v.follow_up||'—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {showForm&&(
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.5)', zIndex:200, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
          <div style={{ background:T.white, borderRadius:16, padding:28, width:'100%', maxWidth:500, boxShadow:'0 20px 60px rgba(0,0,0,.2)' }}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:20 }}>
              <div style={{ fontSize:17, fontWeight:800, color:T.darkRed }}>Log Customer Visit</div>
              <button onClick={()=>setShowForm(false)} style={{ background:'none', border:'none', fontSize:22, cursor:'pointer', color:T.muted }}>×</button>
            </div>
            <form onSubmit={saveVisit}>
              <div style={{ marginBottom:14 }}>
                <label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:6 }}>Visit Type</label>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:6 }}>
                  {Object.entries(TYPES).map(([k,v])=>(
                    <button key={k} type="button" onClick={()=>setForm(f=>({...f,visit_type:k}))}
                      style={{ background:form.visit_type===k?v.bg:T.white, color:form.visit_type===k?v.color:T.sub, border:`1.5px solid ${form.visit_type===k?v.color:T.bdr}`, borderRadius:8, padding:'8px 4px', fontSize:10, fontWeight:form.visit_type===k?700:500, cursor:'pointer', fontFamily:'inherit' }}>
                      <div style={{ fontSize:15 }}>{v.icon}</div>{v.label}
                    </button>
                  ))}
                </div>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:14 }}>
                <div style={{ gridColumn:'1/-1' }}>
                  <label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:5 }}>Customer (optional)</label>
                  <select onChange={e=>{const c=customers.find(x=>x.id===e.target.value);if(c)setForm(f=>({...f,customer_id:c.id,customer_name:c.name,phone:c.phone||''}));}} style={{ ...inp, cursor:'pointer', marginBottom:6 }}>
                    <option value="">Existing customer…</option>
                    {customers.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                  <input value={form.customer_name} onChange={e=>setForm(f=>({...f,customer_name:e.target.value}))} placeholder="Or name (leave blank for anonymous)" style={inp}/>
                </div>
                <div><label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:4 }}>Phone</label><input value={form.phone} onChange={e=>setForm(f=>({...f,phone:e.target.value}))} style={inp}/></div>
                <div><label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:4 }}>Attended By</label>
                  <select value={form.attended_by} onChange={e=>setForm(f=>({...f,attended_by:e.target.value}))} style={{ ...inp, cursor:'pointer' }}>
                    <option value="">—</option>{STAFF.map(s=><option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div style={{ gridColumn:'1/-1' }}><label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:4 }}>Interested In</label><input value={form.interest} onChange={e=>setForm(f=>({...f,interest:e.target.value}))} placeholder="e.g. Running shoes, size 9" style={inp}/></div>
              </div>

              <div style={{ background:T.bg, borderRadius:10, padding:'12px 16px', marginBottom:14 }}>
                <label style={{ display:'flex', alignItems:'center', gap:10, cursor:'pointer' }}>
                  <input type="checkbox" checked={form.converted} onChange={e=>setForm(f=>({...f,converted:e.target.checked}))} style={{ width:18, height:18, accentColor:T.green, cursor:'pointer' }}/>
                  <span style={{ fontSize:13, fontWeight:700, color:form.converted?T.green:T.sub }}>✅ Visit converted to sale</span>
                </label>
                {form.converted
                  ? <div style={{ marginTop:10 }}><label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:4 }}>Sale Value (Rs.)</label><input type="number" value={form.sale_value} onChange={e=>setForm(f=>({...f,sale_value:e.target.value}))} style={{ ...inp, fontWeight:700, color:T.green }}/></div>
                  : <div style={{ marginTop:10 }}><label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:4 }}>Reason Not Converted</label>
                      <select value={form.lost_reason} onChange={e=>setForm(f=>({...f,lost_reason:e.target.value}))} style={{ ...inp, cursor:'pointer' }}>
                        <option value="">Select reason…</option>{LOST_REASONS.map(r=><option key={r} value={r}>{r}</option>)}
                      </select>
                    </div>}
              </div>

              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:16 }}>
                <div><label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:4 }}>Follow-up Date</label><input type="date" value={form.follow_up} onChange={e=>setForm(f=>({...f,follow_up:e.target.value}))} style={inp}/></div>
                <div><label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:4 }}>Notes</label><input value={form.notes} onChange={e=>setForm(f=>({...f,notes:e.target.value}))} style={inp}/></div>
              </div>
              <div style={{ display:'flex', gap:10 }}>
                <button type="button" onClick={()=>setShowForm(false)} style={{ flex:1, background:T.bg, color:T.sub, border:`1px solid ${T.bdr}`, borderRadius:9, padding:'12px', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>Cancel</button>
                <button type="submit" disabled={saving} style={{ flex:2, ...btn(T.red, T.white), padding:'12px', fontSize:13 }}>{saving?'Saving…':'🚶 Log Visit'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
