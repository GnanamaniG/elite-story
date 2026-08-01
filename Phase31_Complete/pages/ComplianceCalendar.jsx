import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

const T = {
  bg:'#F7F3F3', srf:'#FFFFFF', card:'#FFFFFF', bdr:'#E8DEDE',
  red:'#C0392B', darkRed:'#8B0000', lightRed:'#FEF2F2',
  green:'#16A34A', amber:'#D97706', blue:'#2563EB', purple:'#7C3AED',
  ink:'#111827', sub:'#6B7280', muted:'#9CA3AF', white:'#FFFFFF'
};
const fmt = n => 'Rs.' + (n||0).toLocaleString('en-IN', { maximumFractionDigits:0 });
const btn = (bg,color,extra={}) => ({ background:bg, color, border:'none', borderRadius:8, padding:'9px 16px', fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:'inherit', ...extra });
const inp = { background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:8, padding:'9px 12px', color:T.ink, fontSize:13, fontFamily:'inherit', outline:'none', width:'100%' };

// Standard Indian compliance templates
const TEMPLATES = [
  { type:'GSTR-1',   title:'GSTR-1 Filing',        day:11, freq:'monthly',   authority:'GST Portal',  penalty:'Rs.50/day late fee' },
  { type:'GSTR-3B',  title:'GSTR-3B Filing',       day:20, freq:'monthly',   authority:'GST Portal',  penalty:'Rs.50/day + 18% interest' },
  { type:'TDS',      title:'TDS Payment',          day:7,  freq:'monthly',   authority:'Income Tax',  penalty:'1.5% per month interest' },
  { type:'PF',       title:'PF Contribution',      day:15, freq:'monthly',   authority:'EPFO',        penalty:'Damages up to 25%' },
  { type:'ESI',      title:'ESI Contribution',     day:15, freq:'monthly',   authority:'ESIC',        penalty:'12% p.a. interest' },
  { type:'PT',       title:'Professional Tax',     day:20, freq:'monthly',   authority:'State Govt',  penalty:'Varies by state' },
  { type:'TDS-Q',    title:'TDS Return (Quarterly)',day:31, freq:'quarterly',authority:'Income Tax',  penalty:'Rs.200/day' },
  { type:'ITR',      title:'Income Tax Return',    day:31, freq:'annual',    authority:'Income Tax',  penalty:'Up to Rs.5,000' },
];

const TYPE_COLOR = {
  'GSTR-1':T.blue, 'GSTR-3B':T.blue, 'TDS':T.purple, 'TDS-Q':T.purple,
  'PF':T.green, 'ESI':T.green, 'PT':T.amber, 'ITR':T.red,
};

const STATUS = {
  pending:        { label:'Pending',     color:'#D97706', bg:'#FFFBEB', bdr:'#FDE68A' },
  in_progress:    { label:'In Progress', color:'#2563EB', bg:'#EFF6FF', bdr:'#BFDBFE' },
  filed:          { label:'Filed',       color:'#16A34A', bg:'#F0FDF4', bdr:'#BBF7D0' },
  late_filed:     { label:'Late Filed',  color:'#C0392B', bg:'#FEF2F2', bdr:'#FECACA' },
  not_applicable: { label:'N/A',         color:'#6B7280', bg:'#F9FAFB', bdr:'#E5E7EB' },
};

export default function ComplianceCalendar({ tenant }) {
  const [items,    setItems]    = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving,   setSaving]   = useState(false);
  const [gen,      setGen]      = useState(false);
  const [filter,   setFilter]   = useState('upcoming');
  const [form, setForm] = useState({ compliance_type:'GSTR-3B', title:'', period:'', due_date:'', frequency:'monthly', authority:'', assigned_to:'', penalty_note:'', notes:'' });

  useEffect(() => { if (tenant?.id) load(); }, [tenant?.id]);

  async function load() {
    setLoading(true);
    const { data } = await supabase.from('compliance_calendar').select('*').eq('tenant_id', tenant.id).order('due_date');
    setItems(data||[]);
    setLoading(false);
  }

  async function generateYear() {
    setGen(true);
    const now  = new Date();
    const rows = [];
    // Next 6 months of monthly filings
    for (let m=0; m<6; m++) {
      const d = new Date(now.getFullYear(), now.getMonth()+m, 1);
      const periodLabel = d.toLocaleDateString('en-IN',{month:'short',year:'numeric'});
      TEMPLATES.filter(t=>t.freq==='monthly').forEach(t=>{
        const due = new Date(d.getFullYear(), d.getMonth()+1, t.day); // filed next month
        rows.push({
          tenant_id: tenant.id, compliance_type:t.type, title:`${t.title} — ${periodLabel}`,
          period: periodLabel, due_date: due.toISOString().slice(0,10),
          frequency: t.freq, authority: t.authority, penalty_note: t.penalty, status:'pending',
        });
      });
    }
    // Quarterly
    [3,6,9,12].forEach(qm=>{
      if (qm >= now.getMonth()+1) {
        const due = new Date(now.getFullYear(), qm, 31);
        rows.push({
          tenant_id:tenant.id, compliance_type:'TDS-Q', title:`TDS Return Q${Math.ceil(qm/3)}`,
          period:`Q${Math.ceil(qm/3)} FY${now.getFullYear()}`, due_date:due.toISOString().slice(0,10),
          frequency:'quarterly', authority:'Income Tax', penalty_note:'Rs.200/day', status:'pending',
        });
      }
    });

    await supabase.from('compliance_calendar').delete().eq('tenant_id', tenant.id).eq('status','pending');
    if (rows.length>0) await supabase.from('compliance_calendar').insert(rows);
    setGen(false); await load();
    alert(`✅ Generated ${rows.length} compliance due dates for the next 6 months`);
  }

  async function saveItem(e) {
    e.preventDefault(); setSaving(true);
    await supabase.from('compliance_calendar').insert({ ...form, tenant_id:tenant.id, status:'pending' });
    setShowForm(false);
    setForm({ compliance_type:'GSTR-3B', title:'', period:'', due_date:'', frequency:'monthly', authority:'', assigned_to:'', penalty_note:'', notes:'' });
    setSaving(false); await load();
  }

  async function markFiled(item) {
    const ack = prompt('Acknowledgement / ARN number (optional):');
    if (ack===null) return;
    const today = new Date().toISOString().slice(0,10);
    const late  = today > item.due_date;
    await supabase.from('compliance_calendar').update({
      status: late?'late_filed':'filed', filed_date:today, ack_number:ack,
    }).eq('id', item.id);
    await load();
  }

  const today   = new Date().toISOString().slice(0,10);
  const daysTo  = d => Math.ceil((new Date(d)-new Date())/86400000);
  const overdue = items.filter(i=>i.status==='pending'&&i.due_date<today);
  const dueSoon = items.filter(i=>i.status==='pending'&&i.due_date>=today&&daysTo(i.due_date)<=7);
  const upcoming= items.filter(i=>i.status==='pending'&&daysTo(i.due_date)>7);
  const filed   = items.filter(i=>['filed','late_filed'].includes(i.status));

  const displayed = filter==='overdue'?overdue:filter==='soon'?dueSoon:filter==='upcoming'?[...overdue,...dueSoon,...upcoming]:filter==='filed'?filed:items;

  return (
    <div style={{ padding:24, background:T.bg, minHeight:'100%' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
        <div>
          <div style={{ fontSize:18, fontWeight:800, color:T.darkRed }}>📅 Compliance Calendar</div>
          <div style={{ fontSize:12, color:T.sub, marginTop:2 }}>GST, TDS, PF, ESI due dates — never miss a filing deadline</div>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <button onClick={generateYear} disabled={gen} style={btn(T.lightRed, T.red, { border:`1px solid ${T.bdr}` })}>{gen?'Generating…':'⚡ Auto-Generate 6 Months'}</button>
          <button onClick={()=>setShowForm(true)} style={btn(T.red, T.white)}>+ Add Item</button>
        </div>
      </div>

      {overdue.length>0&&<div style={{ background:'#FEF2F2', border:'1px solid #FECACA', borderRadius:10, padding:'11px 16px', marginBottom:16, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <span style={{ fontSize:13, fontWeight:600, color:T.red }}>🚨 {overdue.length} overdue filing{overdue.length>1?'s':''} — penalties may be accruing</span>
        <button onClick={()=>setFilter('overdue')} style={{ background:'#FECACA', color:'#991B1B', border:'none', borderRadius:7, padding:'4px 12px', fontSize:11, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>View</button>
      </div>}
      {dueSoon.length>0&&<div style={{ background:'#FFFBEB', border:'1px solid #FDE68A', borderRadius:10, padding:'11px 16px', marginBottom:16 }}>
        <span style={{ fontSize:13, fontWeight:600, color:T.amber }}>⏰ {dueSoon.length} filing{dueSoon.length>1?'s':''} due within 7 days</span>
      </div>}

      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:14, marginBottom:18 }}>
        {[['Overdue',overdue.length,T.red,'🚨'],['Due ≤7 days',dueSoon.length,T.amber,'⏰'],['Upcoming',upcoming.length,T.blue,'📅'],['Filed',filed.length,T.green,'✅']].map(([label,val,color,icon])=>(
          <div key={label} style={{ background:T.white, border:`1px solid ${T.bdr}`, borderRadius:12, padding:'16px 18px', boxShadow:'0 1px 4px rgba(0,0,0,.05)' }}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:6 }}>
              <div style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.05em' }}>{label}</div>
              <span style={{ fontSize:18 }}>{icon}</span>
            </div>
            <div style={{ fontSize:24, fontWeight:900, color, letterSpacing:'-0.02em' }}>{val}</div>
          </div>
        ))}
      </div>

      <div style={{ display:'flex', gap:6, marginBottom:14 }}>
        {[['upcoming','All Pending'],['overdue','Overdue'],['soon','Due Soon'],['filed','Filed'],['all','Everything']].map(([f,label])=>(
          <button key={f} onClick={()=>setFilter(f)} style={{ padding:'6px 14px', background:filter===f?T.red:T.white, color:filter===f?T.white:T.sub, border:`1px solid ${filter===f?T.red:T.bdr}`, borderRadius:20, fontSize:11, fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}>{label}</button>
        ))}
      </div>

      <div style={{ display:'flex', flexDirection:'column', gap:9 }}>
        {loading?<div style={{ textAlign:'center', padding:60, color:T.muted }}>Loading…</div>
        :displayed.length===0?<div style={{ background:T.white, border:`1px solid ${T.bdr}`, borderRadius:12, padding:60, textAlign:'center' }}>
          <div style={{ fontSize:40, marginBottom:10 }}>📅</div>
          <div style={{ color:T.muted, fontWeight:600 }}>No compliance items</div>
          <div style={{ color:T.muted, fontSize:12, marginTop:4 }}>Click "Auto-Generate" to create standard GST/TDS/PF due dates</div>
        </div>
        :displayed.map(i=>{
          const days = daysTo(i.due_date);
          const s    = STATUS[i.status]||STATUS.pending;
          const isOverdue = i.status==='pending'&&days<0;
          const tColor = TYPE_COLOR[i.compliance_type]||T.sub;
          return (
            <div key={i.id} style={{ background:T.white, border:`1px solid ${isOverdue?'#FECACA':T.bdr}`, borderLeft:`4px solid ${tColor}`, borderRadius:10, padding:'13px 18px', display:'flex', alignItems:'center', gap:16, boxShadow:'0 1px 3px rgba(0,0,0,.04)' }}>
              <div style={{ minWidth:80 }}>
                <div style={{ background:`${tColor}15`, color:tColor, borderRadius:6, padding:'3px 10px', fontSize:10, fontWeight:800, textAlign:'center' }}>{i.compliance_type}</div>
              </div>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:13, fontWeight:700, color:T.ink }}>{i.title}</div>
                <div style={{ fontSize:11, color:T.sub, marginTop:2 }}>
                  {i.authority||'—'} {i.period?`· ${i.period}`:''} {i.assigned_to?`· 👤 ${i.assigned_to}`:''}
                </div>
                {i.penalty_note&&i.status==='pending'&&<div style={{ fontSize:10, color:T.red, marginTop:2 }}>⚠️ Late penalty: {i.penalty_note}</div>}
                {i.ack_number&&<div style={{ fontSize:10, color:T.green, marginTop:2, fontFamily:'monospace' }}>ARN: {i.ack_number}</div>}
              </div>
              <div style={{ textAlign:'right', minWidth:110 }}>
                <div style={{ fontSize:13, fontWeight:700, color:isOverdue?T.red:T.ink }}>{i.due_date}</div>
                {i.status==='pending'&&<div style={{ fontSize:11, fontWeight:700, color:isOverdue?T.red:days<=7?T.amber:T.blue, marginTop:2 }}>
                  {isOverdue?`${Math.abs(days)}d overdue`:days===0?'Due today':`${days}d left`}
                </div>}
                {i.filed_date&&<div style={{ fontSize:10, color:T.green, marginTop:2 }}>Filed {i.filed_date}</div>}
              </div>
              <div style={{ display:'flex', gap:6, alignItems:'center', minWidth:150, justifyContent:'flex-end' }}>
                <span style={{ background:s.bg, color:s.color, border:`1px solid ${s.bdr}`, borderRadius:6, padding:'3px 10px', fontSize:10, fontWeight:700 }}>{s.label}</span>
                {i.status==='pending'&&<button onClick={()=>markFiled(i)} style={btn('#F0FDF4', T.green, { padding:'5px 11px', fontSize:10 })}>✅ Mark Filed</button>}
              </div>
            </div>
          );
        })}
      </div>

      {showForm&&(
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.5)', zIndex:200, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
          <div style={{ background:T.white, borderRadius:16, padding:28, width:'100%', maxWidth:480, boxShadow:'0 20px 60px rgba(0,0,0,.2)' }}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:20 }}>
              <div style={{ fontSize:17, fontWeight:800, color:T.darkRed }}>Add Compliance Item</div>
              <button onClick={()=>setShowForm(false)} style={{ background:'none', border:'none', fontSize:22, cursor:'pointer', color:T.muted }}>×</button>
            </div>
            <form onSubmit={saveItem}>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                <div><label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:4 }}>Type</label>
                  <select value={form.compliance_type} onChange={e=>{const t=TEMPLATES.find(x=>x.type===e.target.value);setForm(f=>({...f,compliance_type:e.target.value,title:t?.title||'',authority:t?.authority||'',penalty_note:t?.penalty||'',frequency:t?.freq||'monthly'}));}} style={{ ...inp, cursor:'pointer' }}>
                    {TEMPLATES.map(t=><option key={t.type} value={t.type}>{t.type}</option>)}
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div><label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:4 }}>Frequency</label>
                  <select value={form.frequency} onChange={e=>setForm(f=>({...f,frequency:e.target.value}))} style={{ ...inp, cursor:'pointer' }}>
                    {['monthly','quarterly','half_yearly','annual','one_time'].map(f=><option key={f} value={f}>{f.replace('_',' ')}</option>)}
                  </select>
                </div>
                {[['Title *','text','title'],['Period','text','period'],['Due Date *','date','due_date'],['Authority','text','authority'],['Assigned To','text','assigned_to'],['Penalty Note','text','penalty_note']].map(([label,type,key])=>(
                  <div key={key} style={label==='Title *'?{ gridColumn:'1/-1' }:{}}><label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:4 }}>{label}</label><input type={type} value={form[key]} onChange={e=>setForm(f=>({...f,[key]:e.target.value}))} required={label.includes('*')} style={inp}/></div>
                ))}
              </div>
              <div style={{ display:'flex', gap:10, marginTop:20 }}>
                <button type="button" onClick={()=>setShowForm(false)} style={{ flex:1, background:T.bg, color:T.sub, border:`1px solid ${T.bdr}`, borderRadius:9, padding:'12px', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>Cancel</button>
                <button type="submit" disabled={saving} style={{ flex:2, ...btn(T.red, T.white), padding:'12px', fontSize:13 }}>{saving?'Saving…':'📅 Add Item'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
