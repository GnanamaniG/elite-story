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

const DOC_TYPES = [
  { type:'GST Registration',  icon:'📋', color:'#2563EB' },
  { type:'Trade Licence',     icon:'🏪', color:'#16A34A' },
  { type:'Shop Establishment',icon:'🏬', color:'#16A34A' },
  { type:'FSSAI Licence',     icon:'🍽️', color:'#D97706' },
  { type:'Fire Safety NOC',   icon:'🔥', color:'#C0392B' },
  { type:'Insurance Policy',  icon:'🛡️', color:'#7C3AED' },
  { type:'Rental Agreement',  icon:'📄', color:'#6B7280' },
  { type:'Vehicle RC',        icon:'🚚', color:'#2563EB' },
  { type:'Vehicle Insurance', icon:'🚗', color:'#7C3AED' },
  { type:'Digital Signature', icon:'🔐', color:'#C0392B' },
  { type:'Domain / Hosting',  icon:'🌐', color:'#2563EB' },
  { type:'Other',             icon:'📎', color:'#6B7280' },
];

export default function DocumentExpiry({ tenant }) {
  const [docs,     setDocs]     = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving,   setSaving]   = useState(false);
  const [filter,   setFilter]   = useState('all');
  const [form, setForm] = useState({ doc_type:'GST Registration', doc_name:'', doc_number:'', issuing_body:'', issue_date:'', expiry_date:'', renewal_cost:'', reminder_days:'30', responsible:'', notes:'' });

  useEffect(() => { if (tenant?.id) load(); }, [tenant?.id]);

  async function load() {
    setLoading(true);
    const { data } = await supabase.from('document_expiry').select('*').eq('tenant_id', tenant.id).order('expiry_date');
    setDocs(data||[]);
    setLoading(false);
  }

  async function saveDoc(e) {
    e.preventDefault(); setSaving(true);
    await supabase.from('document_expiry').insert({
      ...form, tenant_id:tenant.id,
      renewal_cost:parseFloat(form.renewal_cost)||0,
      reminder_days:parseInt(form.reminder_days)||30,
      issue_date:form.issue_date||null, status:'active',
    });
    setShowForm(false);
    setForm({ doc_type:'GST Registration', doc_name:'', doc_number:'', issuing_body:'', issue_date:'', expiry_date:'', renewal_cost:'', reminder_days:'30', responsible:'', notes:'' });
    setSaving(false); await load();
  }

  async function renew(doc) {
    const newDate = prompt(`New expiry date for ${doc.doc_name} (YYYY-MM-DD):`);
    if (!newDate) return;
    await supabase.from('document_expiry').update({ expiry_date:newDate, status:'active', renewed_to:newDate, issue_date:new Date().toISOString().slice(0,10) }).eq('id', doc.id);
    await load();
  }

  const daysTo  = d => Math.ceil((new Date(d)-new Date())/86400000);
  const enriched= docs.map(d=>({ ...d, days: daysTo(d.expiry_date) }));
  const expired = enriched.filter(d=>d.days<0);
  const expiring= enriched.filter(d=>d.days>=0&&d.days<=(d.reminder_days||30));
  const active  = enriched.filter(d=>d.days>(d.reminder_days||30));
  const renewCost = [...expired,...expiring].reduce((s,d)=>s+(d.renewal_cost||0),0);

  const displayed = filter==='expired'?expired:filter==='expiring'?expiring:filter==='active'?active:enriched;

  function Badge({ days, reminder }) {
    if (days<0)  return <span style={{ background:'#FEF2F2', color:T.red, border:'1px solid #FECACA', borderRadius:5, padding:'2px 9px', fontSize:10, fontWeight:700 }}>🚨 Expired {Math.abs(days)}d ago</span>;
    if (days===0)return <span style={{ background:'#FEF2F2', color:T.red, border:'1px solid #FECACA', borderRadius:5, padding:'2px 9px', fontSize:10, fontWeight:700 }}>Expires today</span>;
    if (days<=(reminder||30)) return <span style={{ background:'#FFFBEB', color:T.amber, border:'1px solid #FDE68A', borderRadius:5, padding:'2px 9px', fontSize:10, fontWeight:700 }}>⏰ {days}d left</span>;
    if (days<=90)return <span style={{ background:'#EFF6FF', color:T.blue, border:'1px solid #BFDBFE', borderRadius:5, padding:'2px 9px', fontSize:10, fontWeight:600 }}>{days}d left</span>;
    return <span style={{ background:'#F0FDF4', color:T.green, border:'1px solid #BBF7D0', borderRadius:5, padding:'2px 9px', fontSize:10, fontWeight:600 }}>{days}d left</span>;
  }

  return (
    <div style={{ padding:24, background:T.bg, minHeight:'100%' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
        <div>
          <div style={{ fontSize:18, fontWeight:800, color:T.darkRed }}>📜 Document Expiry Tracker</div>
          <div style={{ fontSize:12, color:T.sub, marginTop:2 }}>Licences, registrations, insurance and renewals — never let one lapse</div>
        </div>
        <button onClick={()=>setShowForm(true)} style={btn(T.red, T.white)}>+ Add Document</button>
      </div>

      {(expired.length>0||expiring.length>0)&&<div style={{ background:expired.length>0?'#FEF2F2':'#FFFBEB', border:`1px solid ${expired.length>0?'#FECACA':'#FDE68A'}`, borderRadius:10, padding:'11px 16px', marginBottom:16 }}>
        <span style={{ fontSize:13, fontWeight:600, color:expired.length>0?T.red:T.amber }}>
          {expired.length>0&&`🚨 ${expired.length} expired document${expired.length>1?'s':''} · `}
          {expiring.length>0&&`⏰ ${expiring.length} expiring soon · `}
          Estimated renewal cost: <strong>{fmt(renewCost)}</strong>
        </span>
      </div>}

      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:14, marginBottom:18 }}>
        {[['Total Documents',docs.length,T.blue,'📜'],['Expiring Soon',expiring.length,T.amber,'⏰'],['Expired',expired.length,T.red,'🚨'],['Renewal Cost',fmt(renewCost),T.purple,'💰']].map(([label,val,color,icon])=>(
          <div key={label} style={{ background:T.white, border:`1px solid ${T.bdr}`, borderRadius:12, padding:'16px 18px', boxShadow:'0 1px 4px rgba(0,0,0,.05)' }}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:6 }}>
              <div style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.05em' }}>{label}</div>
              <span style={{ fontSize:18 }}>{icon}</span>
            </div>
            <div style={{ fontSize:20, fontWeight:900, color, letterSpacing:'-0.02em' }}>{val}</div>
          </div>
        ))}
      </div>

      <div style={{ display:'flex', gap:6, marginBottom:14 }}>
        {[['all','All'],['expired','Expired'],['expiring','Expiring Soon'],['active','Active']].map(([f,label])=>(
          <button key={f} onClick={()=>setFilter(f)} style={{ padding:'6px 14px', background:filter===f?T.red:T.white, color:filter===f?T.white:T.sub, border:`1px solid ${filter===f?T.red:T.bdr}`, borderRadius:20, fontSize:11, fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}>{label}</button>
        ))}
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(330px,1fr))', gap:14 }}>
        {loading?<div style={{ textAlign:'center', padding:60, color:T.muted, gridColumn:'1/-1' }}>Loading…</div>
        :displayed.length===0?<div style={{ background:T.white, border:`1px solid ${T.bdr}`, borderRadius:12, padding:60, textAlign:'center', gridColumn:'1/-1' }}>
          <div style={{ fontSize:40, marginBottom:10 }}>📜</div>
          <div style={{ color:T.muted, fontWeight:600 }}>No documents tracked</div>
          <div style={{ color:T.muted, fontSize:12, marginTop:4 }}>Add your GST certificate, trade licence, insurance policies</div>
        </div>
        :displayed.map(d=>{
          const cfg = DOC_TYPES.find(t=>t.type===d.doc_type)||DOC_TYPES[DOC_TYPES.length-1];
          const urgent = d.days<0;
          return (
            <div key={d.id} style={{ background:T.white, border:`1px solid ${urgent?'#FECACA':T.bdr}`, borderLeft:`4px solid ${cfg.color}`, borderRadius:12, padding:'16px 18px', boxShadow:'0 1px 4px rgba(0,0,0,.05)' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:10 }}>
                <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                  <div style={{ width:38, height:38, borderRadius:9, background:`${cfg.color}15`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:19 }}>{cfg.icon}</div>
                  <div>
                    <div style={{ fontSize:13, fontWeight:700, color:T.ink }}>{d.doc_name}</div>
                    <div style={{ fontSize:10, color:cfg.color, fontWeight:600 }}>{d.doc_type}</div>
                  </div>
                </div>
                <Badge days={d.days} reminder={d.reminder_days}/>
              </div>

              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, background:T.bg, borderRadius:9, padding:'10px 14px', marginBottom:12, fontSize:11 }}>
                <div><div style={{ color:T.muted, fontWeight:700, textTransform:'uppercase', fontSize:9, marginBottom:2 }}>Number</div><div style={{ color:T.ink, fontFamily:'monospace', fontSize:11 }}>{d.doc_number||'—'}</div></div>
                <div><div style={{ color:T.muted, fontWeight:700, textTransform:'uppercase', fontSize:9, marginBottom:2 }}>Authority</div><div style={{ color:T.ink }}>{d.issuing_body||'—'}</div></div>
                <div><div style={{ color:T.muted, fontWeight:700, textTransform:'uppercase', fontSize:9, marginBottom:2 }}>Issued</div><div style={{ color:T.sub }}>{d.issue_date||'—'}</div></div>
                <div><div style={{ color:T.muted, fontWeight:700, textTransform:'uppercase', fontSize:9, marginBottom:2 }}>Expires</div><div style={{ color:urgent?T.red:T.ink, fontWeight:700 }}>{d.expiry_date}</div></div>
              </div>

              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <div style={{ fontSize:11, color:T.sub }}>
                  {d.renewal_cost>0&&<span>Renewal: <strong style={{ color:T.red }}>{fmt(d.renewal_cost)}</strong></span>}
                  {d.responsible&&<span style={{ marginLeft:8 }}>👤 {d.responsible}</span>}
                </div>
                <button onClick={()=>renew(d)} style={btn(T.lightRed, T.red, { padding:'5px 12px', fontSize:10, border:`1px solid ${T.bdr}` })}>🔄 Renew</button>
              </div>
            </div>
          );
        })}
      </div>

      {showForm&&(
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.5)', zIndex:200, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
          <div style={{ background:T.white, borderRadius:16, padding:28, width:'100%', maxWidth:500, boxShadow:'0 20px 60px rgba(0,0,0,.2)' }}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:20 }}>
              <div style={{ fontSize:17, fontWeight:800, color:T.darkRed }}>Add Document</div>
              <button onClick={()=>setShowForm(false)} style={{ background:'none', border:'none', fontSize:22, cursor:'pointer', color:T.muted }}>×</button>
            </div>
            <form onSubmit={saveDoc}>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                <div style={{ gridColumn:'1/-1' }}><label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:4 }}>Document Type</label>
                  <select value={form.doc_type} onChange={e=>setForm(f=>({...f,doc_type:e.target.value}))} style={{ ...inp, cursor:'pointer' }}>
                    {DOC_TYPES.map(t=><option key={t.type} value={t.type}>{t.icon} {t.type}</option>)}
                  </select>
                </div>
                {[['Document Name *','text','doc_name'],['Document Number','text','doc_number'],['Issuing Authority','text','issuing_body'],['Responsible Person','text','responsible'],['Issue Date','date','issue_date'],['Expiry Date *','date','expiry_date'],['Renewal Cost (Rs.)','number','renewal_cost'],['Remind Before (days)','number','reminder_days']].map(([label,type,key])=>(
                  <div key={key} style={label==='Document Name *'?{ gridColumn:'1/-1' }:{}}><label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:4 }}>{label}</label><input type={type} value={form[key]} onChange={e=>setForm(f=>({...f,[key]:e.target.value}))} required={label.includes('*')} style={inp}/></div>
                ))}
              </div>
              {form.expiry_date&&<div style={{ background:T.lightRed, borderRadius:9, padding:'10px 14px', marginTop:12, fontSize:12, color:T.darkRed, fontWeight:600 }}>
                📜 Expires in {Math.ceil((new Date(form.expiry_date)-new Date())/86400000)} days · Reminder {form.reminder_days} days before
              </div>}
              <div style={{ display:'flex', gap:10, marginTop:20 }}>
                <button type="button" onClick={()=>setShowForm(false)} style={{ flex:1, background:T.bg, color:T.sub, border:`1px solid ${T.bdr}`, borderRadius:9, padding:'12px', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>Cancel</button>
                <button type="submit" disabled={saving} style={{ flex:2, ...btn(T.red, T.white), padding:'12px', fontSize:13 }}>{saving?'Saving…':'📜 Add Document'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
