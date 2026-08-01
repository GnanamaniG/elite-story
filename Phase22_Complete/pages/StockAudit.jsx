import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { getInventory } from '../lib/supabase';

const T = { bg:'#060710', srf:'#0f1220', card:'#141828', bdr:'#1e2540', blue:'#4f7cff', ink:'#eef0f8', sub:'#6b7598', muted:'#4a5175', green:'#00d68f', amber:'#ffb547', red:'#ff4d6a', purple:'#9b72ff', teal:'#00c9b1' };
const STATUS_COLOR = { pending:T.sub, matched:T.green, short:T.red, excess:T.amber };

export default function StockAudit({ tenant, user }) {
  const [audits,    setAudits]    = useState([]);
  const [activeAudit,setActiveAudit]=useState(null);
  const [auditItems,setAuditItems]= useState([]);
  const [loading,   setLoading]   = useState(true);
  const [creating,  setCreating]  = useState(false);
  const [search,    setSearch]    = useState('');
  const [filterStatus,setFilterStatus]=useState('all');
  const [saving,    setSaving]    = useState('');

  useEffect(() => { if (tenant?.id) load(); }, [tenant?.id]);

  async function load() {
    setLoading(true);
    const { data } = await supabase.from('stock_audits').select('*').eq('tenant_id', tenant.id).order('started_at', { ascending:false });
    setAudits(data||[]);
    const open = data?.find(a=>a.status==='in_progress');
    if (open) { setActiveAudit(open); await loadAuditItems(open.id); }
    setLoading(false);
  }

  async function loadAuditItems(auditId) {
    const { data } = await supabase.from('audit_items').select('*').eq('audit_id', auditId).order('item_name');
    setAuditItems(data||[]);
  }

  async function createAudit() {
    const name   = `Stock Audit — ${new Date().toLocaleDateString('en-IN')}`;
    setCreating(true);
    const inventory = await getInventory(tenant.id);
    const { data:audit } = await supabase.from('stock_audits').insert({ tenant_id:tenant.id, name, total_items:inventory.length, started_by:user?.id }).select().single();
    const items = inventory.map(i=>({ tenant_id:tenant.id, audit_id:audit.id, item_id:i.id, item_name:i.name, system_qty:i.stock||0, status:'pending' }));
    await supabase.from('audit_items').insert(items);
    setActiveAudit(audit); await loadAuditItems(audit.id); setCreating(false); await load();
  }

  async function updateCount(itemId, countedQty) {
    const qty    = parseFloat(countedQty);
    if (isNaN(qty)) return;
    const item   = auditItems.find(i=>i.id===itemId);
    const diff   = qty - (item?.system_qty||0);
    const status = diff===0?'matched':diff<0?'short':'excess';
    setSaving(itemId);
    await supabase.from('audit_items').update({ counted_qty:qty, difference:diff, status }).eq('id', itemId);
    setAuditItems(prev=>prev.map(i=>i.id===itemId?{...i,counted_qty:qty,difference:diff,status}:i));
    setSaving('');
  }

  async function completeAudit() {
    if (!confirm('Complete this audit? Counted quantities can be applied to inventory.')) return;
    const counted  = auditItems.filter(i=>i.counted_qty!==null);
    const matched  = counted.filter(i=>i.status==='matched').length;
    const discrepancies = counted.filter(i=>i.status!=='matched'&&i.status!=='pending').length;
    await supabase.from('stock_audits').update({ status:'completed', completed_at:new Date().toISOString(), matched, discrepancies }).eq('id', activeAudit.id);
    setAudits(prev=>prev.map(a=>a.id===activeAudit.id?{...a,status:'completed',matched,discrepancies}:a));
    setActiveAudit(null); setAuditItems([]);
  }

  async function applyCountsToInventory() {
    if (!confirm('Apply counted quantities to inventory? This will update actual stock levels.')) return;
    const counted = auditItems.filter(i=>i.counted_qty!==null&&i.item_id);
    for (const item of counted) {
      await supabase.from('inventory').update({ stock:item.counted_qty }).eq('id', item.item_id);
    }
    alert(`✅ Updated stock for ${counted.length} items`);
  }

  async function cancelAudit() {
    if (!confirm('Cancel this audit?')) return;
    await supabase.from('stock_audits').update({ status:'cancelled' }).eq('id', activeAudit.id);
    setActiveAudit(null); setAuditItems([]); await load();
  }

  const displayed = auditItems.filter(i=>{
    const matchSearch = !search || i.item_name.toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus==='all' || i.status===filterStatus;
    return matchSearch && matchStatus;
  });

  const counted   = auditItems.filter(i=>i.counted_qty!==null).length;
  const shortItems= auditItems.filter(i=>i.status==='short');
  const excessItems=auditItems.filter(i=>i.status==='excess');
  const pct       = auditItems.length>0?Math.round(counted/auditItems.length*100):0;

  return (
    <div style={{ padding:20 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
        <div>
          <div style={{ fontSize:22, fontWeight:800, color:T.ink }}>📋 Stock Audit</div>
          <div style={{ fontSize:13, color:T.sub }}>Physical count vs system reconciliation</div>
        </div>
        {!activeAudit&&<button onClick={createAudit} disabled={creating} style={{ background:T.blue, color:'#fff', border:'none', borderRadius:9, padding:'10px 18px', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>
          {creating?'Creating…':'+ Start New Audit'}
        </button>}
      </div>

      {/* Active audit */}
      {activeAudit ? (
        <>
          <div style={{ background:T.amber+'12', border:`1px solid ${T.amber}44`, borderRadius:12, padding:'14px 18px', marginBottom:16 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <div>
                <div style={{ fontSize:14, fontWeight:700, color:T.amber }}>{activeAudit.name}</div>
                <div style={{ fontSize:12, color:T.sub, marginTop:2 }}>Progress: {counted}/{auditItems.length} counted · {pct}% done</div>
              </div>
              <div style={{ display:'flex', gap:8 }}>
                <button onClick={applyCountsToInventory} style={{ background:T.green+'22', color:T.green, border:`1px solid ${T.green}44`, borderRadius:8, padding:'7px 14px', fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>✅ Apply to Inventory</button>
                <button onClick={completeAudit} style={{ background:T.blue, color:'#fff', border:'none', borderRadius:8, padding:'7px 14px', fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>🔒 Complete</button>
                <button onClick={cancelAudit} style={{ background:T.red+'22', color:T.red, border:'none', borderRadius:8, padding:'7px 12px', fontSize:12, cursor:'pointer', fontFamily:'inherit' }}>Cancel</button>
              </div>
            </div>
            <div style={{ height:6, background:T.bdr, borderRadius:3, overflow:'hidden', marginTop:10 }}>
              <div style={{ height:'100%', width:`${pct}%`, background:T.amber, borderRadius:3, transition:'width .3s' }}/>
            </div>
          </div>

          {/* Discrepancy summary */}
          {(shortItems.length>0||excessItems.length>0)&&(
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:14 }}>
              {[['Short Items 📉',shortItems,T.red],['Excess Items 📈',excessItems,T.amber]].map(([label,items,color])=>(
                <div key={label} style={{ background:color+'12', border:`1px solid ${color}44`, borderRadius:10, padding:'12px 16px' }}>
                  <div style={{ fontWeight:700, color, marginBottom:8 }}>{label} ({items.length})</div>
                  {items.slice(0,4).map(i=>(
                    <div key={i.id} style={{ display:'flex', justifyContent:'space-between', fontSize:12, marginBottom:4 }}>
                      <span style={{ color:T.ink }}>{i.item_name}</span>
                      <span style={{ color, fontWeight:700 }}>{i.difference>0?'+':''}{i.difference}</span>
                    </div>
                  ))}
                  {items.length>4&&<div style={{ fontSize:11, color }}>{items.length-4} more…</div>}
                </div>
              ))}
            </div>
          )}

          {/* Item list */}
          <div style={{ display:'flex', gap:8, marginBottom:10 }}>
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="🔍 Search items…"
              style={{ flex:1, background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:8, padding:'9px 14px', color:T.ink, fontSize:13, fontFamily:'inherit', outline:'none' }}/>
            {['all','pending','matched','short','excess'].map(s=>(
              <button key={s} onClick={()=>setFilterStatus(s)} style={{ background:filterStatus===s?T.blue:T.srf, color:filterStatus===s?'#fff':T.sub, border:`1px solid ${filterStatus===s?T.blue:T.bdr}`, borderRadius:7, padding:'7px 12px', fontSize:11, cursor:'pointer', fontFamily:'inherit', textTransform:'capitalize' }}>{s} {s!=='all'?`(${auditItems.filter(i=>i.status===s).length})`:''}</button>
            ))}
          </div>

          <div style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:12, overflow:'hidden' }}>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
              <thead><tr style={{ background:T.card }}>
                {['Item','System Qty','Counted','Difference','Status'].map(h=>(
                  <th key={h} style={{ padding:'9px 14px', textAlign:'left', fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', borderBottom:`1px solid ${T.bdr}` }}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {displayed.map(item=>(
                  <tr key={item.id} style={{ borderBottom:`1px solid ${T.bdr}22`, background:item.status==='short'?T.red+'0a':item.status==='excess'?T.amber+'0a':'transparent' }}>
                    <td style={{ padding:'9px 14px', color:T.ink, fontWeight:600 }}>{item.item_name}</td>
                    <td style={{ padding:'9px 14px', color:T.sub, fontWeight:700 }}>{item.system_qty}</td>
                    <td style={{ padding:'9px 14px' }}>
                      <input type="number" min={0} placeholder="Count…" defaultValue={item.counted_qty??''} key={item.id+'_'+item.counted_qty}
                        onBlur={e=>updateCount(item.id, e.target.value)} onKeyDown={e=>e.key==='Enter'&&updateCount(item.id, e.target.value)}
                        style={{ width:80, background:T.card, border:`1px solid ${item.counted_qty!==null?T.blue:T.bdr}`, borderRadius:6, padding:'5px 8px', color:T.ink, fontSize:13, fontFamily:'inherit', outline:'none', textAlign:'center' }}/>
                      {saving===item.id&&<span style={{ fontSize:10, color:T.blue, marginLeft:6 }}>…</span>}
                    </td>
                    <td style={{ padding:'9px 14px', color:item.difference===0?T.green:item.difference<0?T.red:T.amber, fontWeight:700 }}>
                      {item.difference!=null?(item.difference>0?'+':'')+item.difference:'—'}
                    </td>
                    <td style={{ padding:'9px 14px' }}>
                      <span style={{ background:STATUS_COLOR[item.status]+'22', color:STATUS_COLOR[item.status], borderRadius:5, padding:'2px 8px', fontSize:10, fontWeight:700, textTransform:'capitalize' }}>{item.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <>
          {/* Past audits */}
          <div style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:12, overflow:'hidden' }}>
            <div style={{ padding:'12px 18px', borderBottom:`1px solid ${T.bdr}`, fontWeight:700, color:T.ink }}>Audit History</div>
            {loading?<div style={{ padding:40, textAlign:'center', color:T.sub }}>Loading…</div>
            :audits.length===0?<div style={{ padding:60, textAlign:'center', color:T.muted, fontSize:13 }}>No audits yet. Start your first stock audit.</div>
            :audits.map(a=>(
              <div key={a.id} style={{ padding:'12px 18px', borderBottom:`1px solid ${T.bdr}22`, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <div>
                  <div style={{ fontSize:13, fontWeight:600, color:T.ink }}>{a.name}</div>
                  <div style={{ fontSize:11, color:T.muted, marginTop:2 }}>{new Date(a.started_at).toLocaleDateString('en-IN')} · {a.total_items} items</div>
                </div>
                <div style={{ display:'flex', alignItems:'center', gap:14 }}>
                  {a.status==='completed'&&<div style={{ textAlign:'right', fontSize:12 }}>
                    <span style={{ color:T.green }}>{a.matched} matched</span>
                    {a.discrepancies>0&&<span style={{ color:T.red, marginLeft:10 }}>{a.discrepancies} discrepancies</span>}
                  </div>}
                  <span style={{ background:a.status==='completed'?T.green+'22':a.status==='cancelled'?T.red+'22':T.amber+'22', color:a.status==='completed'?T.green:a.status==='cancelled'?T.red:T.amber, borderRadius:5, padding:'3px 10px', fontSize:11, fontWeight:700, textTransform:'capitalize' }}>{a.status.replace('_',' ')}</span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
