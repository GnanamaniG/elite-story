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
const fmt = n => 'Rs.' + (n||0).toLocaleString('en-IN', { minimumFractionDigits:2, maximumFractionDigits:2 });

const TDS_SECTIONS = [
  { section:'194C', type:'Contractor / Sub-contractor', rates:[1,2], threshold:30000 },
  { section:'194J', type:'Professional / Technical Services', rates:[2,10], threshold:30000 },
  { section:'194I', type:'Rent', rates:[2,10], threshold:240000 },
  { section:'194A', type:'Interest (Non-bank)', rates:[10], threshold:5000 },
  { section:'194B', type:'Lottery / Winnings', rates:[30], threshold:10000 },
  { section:'194H', type:'Commission / Brokerage', rates:[5], threshold:15000 },
];

function getQuarter(date) {
  const m = new Date(date).getMonth()+1;
  if (m<=3)  return 'Q4 (Jan-Mar)';
  if (m<=6)  return 'Q1 (Apr-Jun)';
  if (m<=9)  return 'Q2 (Jul-Sep)';
  return 'Q3 (Oct-Dec)';
}

export default function TDSManagement({ tenant }) {
  const [entries,  setEntries]  = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [filter,   setFilter]   = useState('all');
  const [saving,   setSaving]   = useState(false);
  const [form,     setForm]     = useState({ party_name:'', party_pan:'', section:'194C', txn_type:'Contractor / Sub-contractor', gross_amount:'', tds_rate:'1', txn_date:new Date().toISOString().slice(0,10), challan_no:'', notes:'' });

  useEffect(() => { if (tenant?.id) load(); }, [tenant?.id]);

  async function load() {
    setLoading(true);
    const { data } = await supabase.from('tds_entries').select('*').eq('tenant_id', tenant.id).order('txn_date', { ascending:false });
    setEntries(data||[]);
    setLoading(false);
  }

  function handleSectionChange(section) {
    const sec = TDS_SECTIONS.find(s=>s.section===section);
    setForm(f=>({ ...f, section, txn_type:sec?.type||f.txn_type, tds_rate:String(sec?.rates[0]||1) }));
  }

  async function saveEntry(e) {
    e.preventDefault(); setSaving(true);
    const gross = parseFloat(form.gross_amount)||0;
    const rate  = parseFloat(form.tds_rate)||0;
    const tds   = gross * rate / 100;
    const net   = gross - tds;
    await supabase.from('tds_entries').insert({ ...form, tenant_id:tenant.id, gross_amount:gross, tds_amount:tds, net_amount:net, tds_rate:rate, quarter:getQuarter(form.txn_date) });
    setShowForm(false);
    setForm({ party_name:'', party_pan:'', section:'194C', txn_type:'Contractor / Sub-contractor', gross_amount:'', tds_rate:'1', txn_date:new Date().toISOString().slice(0,10), challan_no:'', notes:'' });
    setSaving(false); await load();
  }

  async function markDeposited(id) {
    const challan = prompt('Enter Challan Number:');
    if (!challan) return;
    await supabase.from('tds_entries').update({ status:'deposited', challan_no:challan, deposit_date:new Date().toISOString().slice(0,10) }).eq('id', id);
    setEntries(prev=>prev.map(e=>e.id===id?{...e,status:'deposited',challan_no:challan}:e));
  }

  async function markFiled(id) {
    await supabase.from('tds_entries').update({ status:'filed' }).eq('id', id);
    setEntries(prev=>prev.map(e=>e.id===id?{...e,status:'filed'}:e));
  }

  const displayed    = filter==='all'?entries:entries.filter(e=>e.status===filter||e.section===filter);
  const totalDeducted= entries.reduce((s,e)=>s+(e.tds_amount||0),0);
  const toDeposit    = entries.filter(e=>e.status==='deducted').reduce((s,e)=>s+(e.tds_amount||0),0);
  const inp = { background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:8, padding:'9px 12px', color:T.ink, fontSize:13, fontFamily:'inherit', outline:'none', width:'100%' };
  const gross = parseFloat(form.gross_amount)||0;
  const tdsPreview = gross * (parseFloat(form.tds_rate)||0) / 100;

  return (
    <div style={{ padding:20 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
        <div>
          <div style={{ fontSize:22, fontWeight:800, color:T.ink }}>🏦 TDS Management</div>
          <div style={{ fontSize:13, color:T.sub }}>Tax Deducted at Source — track, deposit and file</div>
        </div>
        <button onClick={()=>setShowForm(true)} style={{ background:T.blue, color:'#fff', border:'none', borderRadius:9, padding:'10px 18px', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>+ Add TDS Entry</button>
      </div>

      {/* TDS Sections reference */}
      <div style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:12, padding:16, marginBottom:18 }}>
        <div style={{ fontWeight:700, color:T.ink, marginBottom:10, fontSize:13 }}>Common TDS Sections</div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:8 }}>
          {TDS_SECTIONS.map(s=>(
            <div key={s.section} style={{ background:T.card, borderRadius:8, padding:'8px 12px' }}>
              <div style={{ fontSize:12, fontWeight:700, color:T.blue }}>{s.section}</div>
              <div style={{ fontSize:11, color:T.ink }}>{s.type}</div>
              <div style={{ fontSize:10, color:T.muted }}>Rate: {s.rates.join('/')}% · Threshold: Rs.{s.threshold.toLocaleString('en-IN')}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12, marginBottom:18 }}>
        {[['Total Deducted',fmt(totalDeducted),T.blue],['Pending Deposit',fmt(toDeposit),T.amber],['Deposited',fmt(entries.filter(e=>e.status!=='deducted').reduce((s,e)=>s+(e.tds_amount||0),0)),T.green],['Entries',entries.length,T.sub]].map(([label,val,color])=>(
          <div key={label} style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:10, padding:'12px 16px' }}>
            <div style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', marginBottom:5 }}>{label}</div>
            <div style={{ fontSize:18, fontWeight:800, color }}>{val}</div>
          </div>
        ))}
      </div>

      <div style={{ display:'flex', gap:8, marginBottom:14, flexWrap:'wrap' }}>
        {['all','deducted','deposited','filed',...TDS_SECTIONS.map(s=>s.section)].map(f=>(
          <button key={f} onClick={()=>setFilter(f)} style={{ background:filter===f?T.blue:T.srf, color:filter===f?'#fff':T.sub, border:`1px solid ${filter===f?T.blue:T.bdr}`, borderRadius:7, padding:'5px 10px', fontSize:11, cursor:'pointer', fontFamily:'inherit', textTransform:'capitalize' }}>{f}</button>
        ))}
      </div>

      <div style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:12, overflow:'hidden' }}>
        <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
          <thead><tr style={{ background:T.card }}>
            {['Party','PAN','Section','Gross Amt','TDS Rate','TDS Amt','Net Amt','Date','Quarter','Status','Actions'].map(h=><th key={h} style={{ padding:'9px 12px', textAlign:'left', fontSize:9, color:T.sub, fontWeight:700, textTransform:'uppercase', borderBottom:`1px solid ${T.bdr}`, whiteSpace:'nowrap' }}>{h}</th>)}
          </tr></thead>
          <tbody>
            {loading?<tr><td colSpan={11} style={{ textAlign:'center', padding:40, color:T.sub }}>Loading…</td></tr>
            :displayed.length===0?<tr><td colSpan={11} style={{ textAlign:'center', padding:40, color:T.muted }}>No TDS entries yet</td></tr>
            :displayed.map(e=>(
              <tr key={e.id} style={{ borderBottom:`1px solid ${T.bdr}22` }}>
                <td style={{ padding:'9px 12px', color:T.ink, fontWeight:600 }}>{e.party_name}</td>
                <td style={{ padding:'9px 12px', color:T.muted, fontFamily:'monospace', fontSize:11 }}>{e.party_pan||'—'}</td>
                <td style={{ padding:'9px 12px' }}><span style={{ background:T.blue+'22', color:T.blue, borderRadius:5, padding:'1px 7px', fontSize:10, fontWeight:700 }}>{e.section}</span></td>
                <td style={{ padding:'9px 12px', color:T.ink }}>{fmt(e.gross_amount)}</td>
                <td style={{ padding:'9px 12px', color:T.sub }}>{e.tds_rate}%</td>
                <td style={{ padding:'9px 12px', color:T.red, fontWeight:700 }}>{fmt(e.tds_amount)}</td>
                <td style={{ padding:'9px 12px', color:T.green }}>{fmt(e.net_amount)}</td>
                <td style={{ padding:'9px 12px', color:T.muted, fontSize:11 }}>{e.txn_date}</td>
                <td style={{ padding:'9px 12px', color:T.muted, fontSize:11 }}>{e.quarter}</td>
                <td style={{ padding:'9px 12px' }}><span style={{ background:e.status==='filed'?T.green+'22':e.status==='deposited'?T.blue+'22':T.amber+'22', color:e.status==='filed'?T.green:e.status==='deposited'?T.blue:T.amber, borderRadius:5, padding:'2px 8px', fontSize:10, fontWeight:700, textTransform:'capitalize' }}>{e.status}</span></td>
                <td style={{ padding:'9px 12px' }}>
                  <div style={{ display:'flex', gap:5 }}>
                    {e.status==='deducted'&&<button onClick={()=>markDeposited(e.id)} style={{ background:T.blue+'22', color:T.blue, border:'none', borderRadius:5, padding:'4px 8px', fontSize:10, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>Deposit</button>}
                    {e.status==='deposited'&&<button onClick={()=>markFiled(e.id)} style={{ background:T.green+'22', color:T.green, border:'none', borderRadius:5, padding:'4px 8px', fontSize:10, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>Filed</button>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showForm&&(
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.8)', zIndex:200, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
          <div style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:14, padding:24, width:'100%', maxWidth:520 }}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:18 }}>
              <div style={{ fontSize:17, fontWeight:700, color:T.ink }}>Add TDS Entry</div>
              <button onClick={()=>setShowForm(false)} style={{ background:'none', border:'none', color:T.muted, cursor:'pointer', fontSize:22 }}>×</button>
            </div>
            <form onSubmit={saveEntry}>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                <div><label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:4 }}>Party Name *</label><input value={form.party_name} onChange={e=>setForm(f=>({...f,party_name:e.target.value}))} required style={inp}/></div>
                <div><label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:4 }}>PAN</label><input value={form.party_pan} onChange={e=>setForm(f=>({...f,party_pan:e.target.value.toUpperCase()}))} placeholder="AAAPL1234C" style={inp}/></div>
                <div><label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:4 }}>Section *</label>
                  <select value={form.section} onChange={e=>handleSectionChange(e.target.value)} style={{ ...inp, cursor:'pointer' }}>
                    {TDS_SECTIONS.map(s=><option key={s.section} value={s.section}>{s.section} — {s.type}</option>)}
                  </select>
                </div>
                <div><label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:4 }}>TDS Rate (%)</label>
                  <select value={form.tds_rate} onChange={e=>setForm(f=>({...f,tds_rate:e.target.value}))} style={{ ...inp, cursor:'pointer' }}>
                    {TDS_SECTIONS.find(s=>s.section===form.section)?.rates.map(r=><option key={r} value={r}>{r}%</option>)}
                  </select>
                </div>
                <div><label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:4 }}>Gross Amount *</label><input type="number" value={form.gross_amount} onChange={e=>setForm(f=>({...f,gross_amount:e.target.value}))} required style={inp}/></div>
                <div><label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:4 }}>Transaction Date</label><input type="date" value={form.txn_date} onChange={e=>setForm(f=>({...f,txn_date:e.target.value}))} style={inp}/></div>
              </div>
              {gross>0&&<div style={{ background:T.card, borderRadius:9, padding:'12px 16px', margin:'12px 0', display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10 }}>
                {[['TDS Amount',fmt(tdsPreview),T.red],['Net Payable',fmt(gross-tdsPreview),T.green],['Quarter',getQuarter(form.txn_date),T.blue]].map(([l,v,c])=>(
                  <div key={l} style={{ textAlign:'center' }}><div style={{ fontSize:9, color:T.sub, marginBottom:3, fontWeight:700, textTransform:'uppercase' }}>{l}</div><div style={{ fontSize:15, fontWeight:800, color:c }}>{v}</div></div>
                ))}
              </div>}
              <div style={{ display:'flex', gap:10, marginTop:8 }}>
                <button type="button" onClick={()=>setShowForm(false)} style={{ flex:1, background:T.card, color:T.sub, border:`1px solid ${T.bdr}`, borderRadius:8, padding:'11px', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>Cancel</button>
                <button type="submit" disabled={saving} style={{ flex:2, background:T.blue, color:'#fff', border:'none', borderRadius:8, padding:'11px', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>{saving?'Saving…':'Save TDS Entry'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
