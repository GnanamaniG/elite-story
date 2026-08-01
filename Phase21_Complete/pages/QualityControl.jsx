import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

const T = { bg:'#060710', srf:'#0f1220', card:'#141828', bdr:'#1e2540', blue:'#4f7cff', ink:'#eef0f8', sub:'#6b7598', muted:'#4a5175', green:'#00d68f', amber:'#ffb547', red:'#ff4d6a', teal:'#00c9b1' };
const fmt = n => (n||0).toLocaleString('en-IN');
const RESULT_COLORS = { pending:T.amber, pass:T.green, fail:T.red, conditional:T.blue };

const DEFAULT_CHECKLIST = [
  'Physical condition — no visible damage or defects',
  'Quantity matches order',
  'Labels and packaging intact',
  'Size/variant matches specification',
  'Color accuracy confirmed',
  'Stitching/finish quality acceptable',
  'No stains, marks or contamination',
];

export default function QualityControl({ tenant }) {
  const [inspections, setInspections] = useState([]);
  const [inventory,   setInventory]   = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [showForm,    setShowForm]    = useState(false);
  const [filter,      setFilter]      = useState('all');
  const [saving,      setSaving]      = useState(false);
  const [selInsp,     setSelInsp]     = useState(null);

  const [form, setForm] = useState({ type:'inbound', item_id:'', item_name:'', batch_qty:'', inspector:'', notes:'' });
  const [checks, setChecks] = useState(DEFAULT_CHECKLIST.map(l=>({ label:l, pass:null })));

  useEffect(() => { if (tenant?.id) load(); }, [tenant?.id]);

  async function load() {
    setLoading(true);
    const [insRes, invRes] = await Promise.all([
      supabase.from('qc_inspections').select('*').eq('tenant_id', tenant.id).order('created_at', { ascending:false }),
      supabase.from('inventory').select('id,name').eq('tenant_id', tenant.id).eq('active', true).order('name'),
    ]);
    setInspections(insRes.data||[]);
    setInventory(invRes.data||[]);
    setLoading(false);
  }

  function genRef() { return `QC/${new Date().getFullYear()}/${String(Date.now()).slice(-5)}`; }

  function toggleCheck(idx, val) { setChecks(prev=>prev.map((c,i)=>i===idx?{...c,pass:val}:c)); }
  function addCheck()             { setChecks(prev=>[...prev, { label:'', pass:null }]); }

  const passedChecks  = checks.filter(c=>c.pass===true).length;
  const failedChecks  = checks.filter(c=>c.pass===false).length;
  const overallResult = failedChecks===0&&passedChecks===checks.length?'pass':failedChecks>0&&failedChecks<=2?'conditional':failedChecks>2?'fail':'pending';

  async function submitInspection(e) {
    e.preventDefault();
    setSaving(true);
    const batchQty    = parseInt(form.batch_qty)||0;
    const failedPct   = failedChecks/checks.length;
    const failedItems = Math.round(batchQty * failedPct);
    const passedItems = batchQty - failedItems;
    try {
      await supabase.from('qc_inspections').insert({
        ...form, tenant_id:tenant.id, ref_number:genRef(),
        batch_qty:batchQty, passed_qty:passedItems, failed_qty:failedItems,
        checklist:checks, result:overallResult
      });
      setShowForm(false);
      setForm({ type:'inbound', item_id:'', item_name:'', batch_qty:'', inspector:'', notes:'' });
      setChecks(DEFAULT_CHECKLIST.map(l=>({ label:l, pass:null })));
      await load();
    } catch(e) { alert('Error: '+e.message); }
    finally { setSaving(false); }
  }

  const displayed   = filter==='all'?inspections:inspections.filter(i=>i.result===filter||i.type===filter);
  const passRate    = inspections.length>0?Math.round(inspections.filter(i=>i.result==='pass').length/inspections.length*100):0;
  const failedItems = inspections.reduce((s,i)=>s+(i.failed_qty||0),0);
  const inp = { background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:8, padding:'9px 12px', color:T.ink, fontSize:13, fontFamily:'inherit', outline:'none', width:'100%' };

  return (
    <div style={{ padding:20 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
        <div>
          <div style={{ fontSize:22, fontWeight:800, color:T.ink }}>✅ Quality Control</div>
          <div style={{ fontSize:13, color:T.sub }}>{passRate}% pass rate · {failedItems} items failed</div>
        </div>
        <button onClick={()=>setShowForm(true)} style={{ background:T.blue, color:'#fff', border:'none', borderRadius:9, padding:'10px 18px', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>+ New Inspection</button>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12, marginBottom:18 }}>
        {[['Pass Rate',passRate+'%',passRate>=90?T.green:passRate>=70?T.amber:T.red],['Total Inspections',inspections.length,T.blue],['Items Failed',fmt(failedItems),T.red],['Pending',inspections.filter(i=>i.result==='pending').length,T.amber]].map(([label,val,color])=>(
          <div key={label} style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:10, padding:'12px 16px' }}>
            <div style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', marginBottom:5 }}>{label}</div>
            <div style={{ fontSize:20, fontWeight:800, color }}>{val}</div>
          </div>
        ))}
      </div>

      <div style={{ display:'flex', gap:8, marginBottom:14 }}>
        {['all','pending','pass','fail','conditional','inbound','outbound'].map(f=>(
          <button key={f} onClick={()=>setFilter(f)} style={{ background:filter===f?T.blue:T.srf, color:filter===f?'#fff':T.sub, border:`1px solid ${filter===f?T.blue:T.bdr}`, borderRadius:7, padding:'5px 10px', fontSize:11, cursor:'pointer', fontFamily:'inherit', textTransform:'capitalize' }}>
            {f}
          </button>
        ))}
      </div>

      <div style={{ display:'grid', gridTemplateColumns:selInsp?'1fr 1fr':'1fr', gap:16 }}>
        <div style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:12, overflow:'hidden' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
            <thead><tr style={{ background:T.card }}>
              {['Ref','Item','Type','Batch','Passed','Failed','Inspector','Date','Result'].map(h=><th key={h} style={{ padding:'9px 12px', textAlign:'left', fontSize:9, color:T.sub, fontWeight:700, textTransform:'uppercase', borderBottom:`1px solid ${T.bdr}` }}>{h}</th>)}
            </tr></thead>
            <tbody>
              {loading?<tr><td colSpan={9} style={{ textAlign:'center', padding:40, color:T.sub }}>Loading…</td></tr>
              :displayed.length===0?<tr><td colSpan={9} style={{ textAlign:'center', padding:40, color:T.muted }}>No inspections yet</td></tr>
              :displayed.map(ins=>(
                <tr key={ins.id} onClick={()=>setSelInsp(selInsp?.id===ins.id?null:ins)} style={{ borderBottom:`1px solid ${T.bdr}22`, cursor:'pointer', background:selInsp?.id===ins.id?T.blue+'18':'transparent' }}>
                  <td style={{ padding:'9px 12px', color:T.blue, fontFamily:'monospace', fontSize:11 }}>{ins.ref_number}</td>
                  <td style={{ padding:'9px 12px', color:T.ink }}>{ins.item_name}</td>
                  <td style={{ padding:'9px 12px' }}><span style={{ background:T.blue+'22', color:T.blue, borderRadius:5, padding:'1px 7px', fontSize:10, textTransform:'capitalize' }}>{ins.type}</span></td>
                  <td style={{ padding:'9px 12px', color:T.sub }}>{ins.batch_qty}</td>
                  <td style={{ padding:'9px 12px', color:T.green }}>{ins.passed_qty}</td>
                  <td style={{ padding:'9px 12px', color:ins.failed_qty>0?T.red:T.muted }}>{ins.failed_qty}</td>
                  <td style={{ padding:'9px 12px', color:T.muted }}>{ins.inspector||'—'}</td>
                  <td style={{ padding:'9px 12px', color:T.muted }}>{ins.inspected_at}</td>
                  <td style={{ padding:'9px 12px' }}><span style={{ background:RESULT_COLORS[ins.result]+'22', color:RESULT_COLORS[ins.result], borderRadius:5, padding:'2px 8px', fontSize:10, fontWeight:700, textTransform:'capitalize' }}>{ins.result}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {selInsp&&<div style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:12, overflow:'hidden' }}>
          <div style={{ padding:'12px 16px', borderBottom:`1px solid ${T.bdr}`, fontWeight:700, color:T.ink }}>Checklist — {selInsp.ref_number}</div>
          <div style={{ maxHeight:400, overflowY:'auto', padding:14 }}>
            {(selInsp.checklist||[]).map((c,i)=>(
              <div key={i} style={{ display:'flex', alignItems:'center', gap:10, padding:'7px 0', borderBottom:`1px solid ${T.bdr}22` }}>
                <div style={{ width:20, height:20, borderRadius:'50%', background:c.pass===true?T.green:c.pass===false?T.red:T.bdr, display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, color:'#fff', flexShrink:0 }}>
                  {c.pass===true?'✓':c.pass===false?'✗':'?'}
                </div>
                <span style={{ fontSize:12, color:c.pass===true?T.ink:c.pass===false?T.red:T.sub }}>{c.label}</span>
              </div>
            ))}
            {selInsp.notes&&<div style={{ marginTop:12, background:T.card, borderRadius:7, padding:10, fontSize:12, color:T.sub }}>{selInsp.notes}</div>}
          </div>
        </div>}
      </div>

      {showForm&&(
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.85)', zIndex:200, display:'flex', alignItems:'flex-start', justifyContent:'center', padding:20, overflowY:'auto' }}>
          <div style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:14, padding:24, width:'100%', maxWidth:580, margin:'20px 0' }}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:18 }}>
              <div style={{ fontSize:17, fontWeight:700, color:T.ink }}>New QC Inspection</div>
              <button onClick={()=>setShowForm(false)} style={{ background:'none', border:'none', color:T.muted, cursor:'pointer', fontSize:22 }}>×</button>
            </div>
            <form onSubmit={submitInspection}>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:14 }}>
                <div><label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:5 }}>Type</label>
                  <select value={form.type} onChange={e=>setForm(f=>({...f,type:e.target.value}))} style={{ ...inp, cursor:'pointer' }}>
                    {['inbound','outbound','process','random'].map(t=><option key={t} value={t} style={{ textTransform:'capitalize' }}>{t.charAt(0).toUpperCase()+t.slice(1)}</option>)}
                  </select>
                </div>
                <div><label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:5 }}>Product</label>
                  <select value={form.item_id} onChange={e=>{const inv=inventory.find(i=>i.id===e.target.value);setForm(f=>({...f,item_id:e.target.value,item_name:inv?.name||''}));}} style={{ ...inp, cursor:'pointer' }}>
                    <option value="">Select product…</option>
                    {inventory.map(i=><option key={i.id} value={i.id}>{i.name}</option>)}
                  </select>
                  <input value={form.item_name} onChange={e=>setForm(f=>({...f,item_name:e.target.value}))} placeholder="Or type item name" style={{ ...inp, marginTop:6 }} required/>
                </div>
                <div><label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:5 }}>Batch Quantity *</label><input type="number" value={form.batch_qty} onChange={e=>setForm(f=>({...f,batch_qty:e.target.value}))} required style={inp}/></div>
                <div><label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:5 }}>Inspector</label><input value={form.inspector} onChange={e=>setForm(f=>({...f,inspector:e.target.value}))} style={inp}/></div>
              </div>

              {/* Checklist */}
              <div style={{ marginBottom:14 }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
                  <label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase' }}>Inspection Checklist</label>
                  <div style={{ display:'flex', gap:8, fontSize:12 }}>
                    <span style={{ color:T.green }}>✅ {passedChecks} pass</span>
                    <span style={{ color:T.red }}>❌ {failedChecks} fail</span>
                    <span style={{ color:T.amber }}>⬜ {checks.length-passedChecks-failedChecks} pending</span>
                  </div>
                </div>
                <div style={{ background:T.card, borderRadius:9, overflow:'hidden', maxHeight:280, overflowY:'auto' }}>
                  {checks.map((c,i)=>(
                    <div key={i} style={{ display:'flex', alignItems:'center', gap:10, padding:'9px 14px', borderBottom:`1px solid ${T.bdr}22` }}>
                      <input value={c.label} onChange={e=>setChecks(prev=>prev.map((x,j)=>j===i?{...x,label:e.target.value}:x))} style={{ flex:1, background:'transparent', border:'none', color:T.ink, fontSize:12, fontFamily:'inherit', outline:'none' }}/>
                      <button type="button" onClick={()=>toggleCheck(i,true)} style={{ width:28, height:28, borderRadius:6, background:c.pass===true?T.green:T.bdr+'44', border:`1px solid ${c.pass===true?T.green:T.bdr}`, color:c.pass===true?'#fff':T.muted, cursor:'pointer', fontFamily:'inherit', fontSize:14 }}>✓</button>
                      <button type="button" onClick={()=>toggleCheck(i,false)} style={{ width:28, height:28, borderRadius:6, background:c.pass===false?T.red:T.bdr+'44', border:`1px solid ${c.pass===false?T.red:T.bdr}`, color:c.pass===false?'#fff':T.muted, cursor:'pointer', fontFamily:'inherit', fontSize:14 }}>✗</button>
                      <button type="button" onClick={()=>setChecks(prev=>prev.filter((_,j)=>j!==i))} style={{ width:24, height:24, borderRadius:4, background:'none', border:'none', color:T.muted, cursor:'pointer', fontFamily:'inherit', fontSize:14 }}>×</button>
                    </div>
                  ))}
                </div>
                <button type="button" onClick={addCheck} style={{ marginTop:6, background:T.blue+'22', color:T.blue, border:'none', borderRadius:7, padding:'5px 12px', fontSize:11, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>+ Add Check</button>
              </div>

              {/* Result preview */}
              <div style={{ background:RESULT_COLORS[overallResult]+'18', border:`1px solid ${RESULT_COLORS[overallResult]}44`, borderRadius:9, padding:'10px 14px', marginBottom:14, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <span style={{ fontSize:13, color:T.ink }}>Inspection Result</span>
                <span style={{ fontSize:16, fontWeight:800, color:RESULT_COLORS[overallResult], textTransform:'uppercase' }}>{overallResult}</span>
              </div>

              <div style={{ marginBottom:14 }}><label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:5 }}>Notes</label><textarea value={form.notes} onChange={e=>setForm(f=>({...f,notes:e.target.value}))} rows={2} style={{ ...inp, resize:'vertical' }}/></div>

              <div style={{ display:'flex', gap:10 }}>
                <button type="button" onClick={()=>setShowForm(false)} style={{ flex:1, background:T.card, color:T.sub, border:`1px solid ${T.bdr}`, borderRadius:8, padding:'11px', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>Cancel</button>
                <button type="submit" disabled={saving} style={{ flex:2, background:T.blue, color:'#fff', border:'none', borderRadius:8, padding:'11px', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>{saving?'Saving…':'Submit Inspection'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
