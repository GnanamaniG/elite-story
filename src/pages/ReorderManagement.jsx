import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

const T = { bg:'#060710', srf:'#0f1220', card:'#141828', bdr:'#1e2540', blue:'#4f7cff', ink:'#eef0f8', sub:'#6b7598', muted:'#4a5175', green:'#00d68f', amber:'#ffb547', red:'#ff4d6a', purple:'#9b72ff', teal:'#00c9b1' };
const fmt = n => (n||0).toLocaleString('en-IN', { maximumFractionDigits:0 });
const fmtRs = n => 'Rs.' + (n||0).toLocaleString('en-IN', { maximumFractionDigits:0 });

export default function ReorderManagement({ tenant }) {
  const [inventory,  setInventory]  = useState([]);
  const [suppliers,  setSuppliers]  = useState([]);
  const [rules,      setRules]      = useState([]);
  const [salesData,  setSalesData]  = useState({});
  const [loading,    setLoading]    = useState(true);
  const [selected,   setSelected]   = useState(new Set());
  const [tab,        setTab]        = useState('alerts'); // alerts | rules
  const [showRule,   setShowRule]   = useState(null);
  const [saving,     setSaving]     = useState(false);

  useEffect(() => { if (tenant?.id) load(); }, [tenant?.id]);

  async function load() {
    setLoading(true);
    const past30 = new Date(); past30.setDate(past30.getDate()-30);
    const [invRes, supRes, ruleRes, salesRes] = await Promise.all([
      supabase.from('inventory').select('*').eq('tenant_id', tenant.id).eq('active', true).order('name'),
      supabase.from('suppliers').select('id,name,phone').eq('tenant_id', tenant.id).order('name'),
      supabase.from('reorder_rules').select('*').eq('tenant_id', tenant.id),
      supabase.from('sales').select('items,date').eq('tenant_id', tenant.id).gte('date', past30.toISOString().slice(0,10)),
    ]);
    setInventory(invRes.data||[]);
    setSuppliers(supRes.data||[]);
    setRules(ruleRes.data||[]);

    // Compute sales velocity per item
    const velocity = {};
    (salesRes.data||[]).forEach(s=>(s.items||[]).forEach(i=>{ velocity[i.id]=(velocity[i.id]||0)+(i.qty||0); }));
    setSalesData(velocity);
    setLoading(false);
  }

  async function saveRule(e) {
    e.preventDefault(); setSaving(true);
    const existing = rules.find(r=>r.inventory_id===showRule.id);
    const payload  = { tenant_id:tenant.id, inventory_id:showRule.id, reorder_point:parseInt(showRule.reorder_point)||10, reorder_qty:parseInt(showRule.reorder_qty)||50, preferred_supplier:showRule.preferred_supplier||null, auto_po:showRule.auto_po||false };
    if (existing) await supabase.from('reorder_rules').update(payload).eq('id', existing.id);
    else await supabase.from('reorder_rules').insert(payload);
    setShowRule(null); setSaving(false); await load();
  }

  async function createPO(items) {
    if (!items.length) return;
    // Group by supplier
    const bySupplier = {};
    items.forEach(item => {
      const rule = rules.find(r=>r.inventory_id===item.id);
      const supId = rule?.preferred_supplier||'unknown';
      if (!bySupplier[supId]) bySupplier[supId] = [];
      bySupplier[supId].push({ item_id:item.id, name:item.name, qty:getReorderQty(item), rate:item.cp||0, amount:(getReorderQty(item))*(item.cp||0) });
    });

    for (const [supId, poItems] of Object.entries(bySupplier)) {
      const sup   = suppliers.find(s=>s.id===supId);
      const total = poItems.reduce((s,i)=>s+(i.amount||0),0);
      const poNum = `PO/${new Date().getFullYear()}/${String(Date.now()).slice(-5)}`;
      await supabase.from('purchases').insert({ tenant_id:tenant.id, po_number:poNum, supplier_id:supId!=='unknown'?supId:null, supplier:sup?.name||'Select Supplier', items:poItems, total, status:'draft', date:new Date().toISOString().slice(0,10) });
    }
    alert(`✅ ${Object.keys(bySupplier).length} purchase order(s) created as drafts`);
    setSelected(new Set());
  }

  function getReorderQty(item) {
    const rule = rules.find(r=>r.inventory_id===item.id);
    return rule?.reorder_qty || Math.max(50, (salesData[item.id]||0)*2);
  }

  function getReorderPoint(item) {
    const rule = rules.find(r=>r.inventory_id===item.id);
    return rule?.reorder_point || (item.alert||10);
  }

  // Items needing reorder
  const alerts = inventory.filter(item=>(item.stock||0)<=getReorderPoint(item));
  const displayed = tab==='alerts' ? alerts : inventory;
  const selectedItems = inventory.filter(i=>selected.has(i.id));

  return (
    <div style={{ padding:20 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
        <div>
          <div style={{ fontSize:22, fontWeight:800, color:T.ink }}>🔄 Reorder Management</div>
          <div style={{ fontSize:13, color:T.sub }}>{alerts.length} items need reordering · Smart suggestions based on sales velocity</div>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          {selected.size>0&&<button onClick={()=>createPO(selectedItems)} style={{ background:T.blue, color:'#fff', border:'none', borderRadius:9, padding:'9px 16px', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>📦 Create PO ({selected.size} items)</button>}
        </div>
      </div>

      {alerts.length>0&&<div style={{ background:T.red+'12', border:`1px solid ${T.red}33`, borderRadius:10, padding:'10px 14px', marginBottom:16, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <div style={{ fontSize:13, color:T.red, fontWeight:700 }}>⚠️ {alerts.length} items at or below reorder point</div>
        <div style={{ display:'flex', gap:8 }}>
          <button onClick={()=>{setSelected(new Set(alerts.map(i=>i.id)));setTab('alerts');}} style={{ background:T.red+'22', color:T.red, border:'none', borderRadius:7, padding:'5px 12px', fontSize:11, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>Select All</button>
          <button onClick={()=>createPO(alerts)} style={{ background:T.red, color:'#fff', border:'none', borderRadius:7, padding:'5px 14px', fontSize:11, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>📦 Reorder All</button>
        </div>
      </div>}

      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12, marginBottom:16 }}>
        {[['Critical (0 stock)',inventory.filter(i=>(i.stock||0)===0).length,T.red],['Low Stock',alerts.filter(i=>(i.stock||0)>0).length,T.amber],['Reorder Rules',rules.length,T.blue],['Suppliers',suppliers.length,T.teal]].map(([label,val,color])=>(
          <div key={label} style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:10, padding:'12px 16px' }}>
            <div style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', marginBottom:5 }}>{label}</div>
            <div style={{ fontSize:20, fontWeight:800, color }}>{val}</div>
          </div>
        ))}
      </div>

      <div style={{ display:'flex', gap:8, marginBottom:14 }}>
        <button onClick={()=>setTab('alerts')} style={{ background:tab==='alerts'?T.blue:T.srf, color:tab==='alerts'?'#fff':T.sub, border:`1px solid ${tab==='alerts'?T.blue:T.bdr}`, borderRadius:7, padding:'7px 16px', fontSize:12, cursor:'pointer', fontFamily:'inherit' }}>⚠️ Reorder Alerts ({alerts.length})</button>
        <button onClick={()=>setTab('all')} style={{ background:tab==='all'?T.blue:T.srf, color:tab==='all'?'#fff':T.sub, border:`1px solid ${tab==='all'?T.blue:T.bdr}`, borderRadius:7, padding:'7px 16px', fontSize:12, cursor:'pointer', fontFamily:'inherit' }}>📦 All Items ({inventory.length})</button>
      </div>

      <div style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:12, overflow:'hidden' }}>
        <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
          <thead><tr style={{ background:T.card }}>
            <th style={{ padding:'9px 12px', width:36, borderBottom:`1px solid ${T.bdr}` }}/>
            {['Product','Category','Stock','Alert At','Reorder Point','30d Sales','Reorder Qty','Est. Cost','Preferred Supplier','Actions'].map(h=>(
              <th key={h} style={{ padding:'9px 12px', textAlign:'left', fontSize:9, color:T.sub, fontWeight:700, textTransform:'uppercase', borderBottom:`1px solid ${T.bdr}`, whiteSpace:'nowrap' }}>{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {loading?<tr><td colSpan={11} style={{ textAlign:'center', padding:40, color:T.sub }}>Loading…</td></tr>
            :displayed.length===0?<tr><td colSpan={11} style={{ textAlign:'center', padding:40, color:T.muted }}>{tab==='alerts'?'✅ All items are well stocked!':'No inventory items found'}</td></tr>
            :displayed.map(item=>{
              const reorderQty  = getReorderQty(item);
              const reorderPt   = getReorderPoint(item);
              const vel         = salesData[item.id]||0;
              const rule        = rules.find(r=>r.inventory_id===item.id);
              const prefSup     = suppliers.find(s=>s.id===rule?.preferred_supplier);
              const critical    = (item.stock||0)===0;
              const needsReorder= (item.stock||0)<=reorderPt;
              return (
                <tr key={item.id} style={{ borderBottom:`1px solid ${T.bdr}22`, background:critical?T.red+'0a':needsReorder?T.amber+'06':'transparent' }}>
                  <td style={{ padding:'9px 12px', textAlign:'center' }}>
                    <div onClick={()=>setSelected(s=>{const n=new Set(s);n.has(item.id)?n.delete(item.id):n.add(item.id);return n;})} style={{ width:16, height:16, border:`2px solid ${selected.has(item.id)?T.blue:T.bdr}`, borderRadius:3, background:selected.has(item.id)?T.blue:'transparent', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, color:'#fff', margin:'0 auto' }}>{selected.has(item.id)?'✓':''}</div>
                  </td>
                  <td style={{ padding:'9px 12px', color:T.ink, fontWeight:600 }}>{item.name}</td>
                  <td style={{ padding:'9px 12px', color:T.muted }}>{item.cat||'—'}</td>
                  <td style={{ padding:'9px 12px', color:critical?T.red:needsReorder?T.amber:T.green, fontWeight:needsReorder?700:400 }}>{fmt(item.stock||0)}{critical?' ❌':needsReorder?' ⚠️':''}</td>
                  <td style={{ padding:'9px 12px', color:T.muted }}>{fmt(item.alert||10)}</td>
                  <td style={{ padding:'9px 12px', color:T.blue }}>{fmt(reorderPt)}</td>
                  <td style={{ padding:'9px 12px', color:T.sub }}>{fmt(vel)} units</td>
                  <td style={{ padding:'9px 12px', color:T.amber, fontWeight:700 }}>{fmt(reorderQty)}</td>
                  <td style={{ padding:'9px 12px', color:T.green }}>{fmtRs(reorderQty*(item.cp||0))}</td>
                  <td style={{ padding:'9px 12px', color:T.muted, fontSize:11 }}>{prefSup?.name||'—'}</td>
                  <td style={{ padding:'9px 12px' }}>
                    <div style={{ display:'flex', gap:5 }}>
                      <button onClick={()=>setShowRule({ ...item, reorder_point:reorderPt, reorder_qty:reorderQty, preferred_supplier:rule?.preferred_supplier||'', auto_po:rule?.auto_po||false })} style={{ background:T.blue+'22', color:T.blue, border:'none', borderRadius:5, padding:'4px 8px', fontSize:10, cursor:'pointer', fontFamily:'inherit' }}>⚙️</button>
                      <button onClick={()=>createPO([item])} style={{ background:T.green+'22', color:T.green, border:'none', borderRadius:5, padding:'4px 8px', fontSize:10, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>PO</button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Rule editor modal */}
      {showRule&&(
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.8)', zIndex:200, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
          <div style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:14, padding:24, width:'100%', maxWidth:420 }}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:18 }}>
              <div style={{ fontSize:17, fontWeight:700, color:T.ink }}>Reorder Rule — {showRule.name}</div>
              <button onClick={()=>setShowRule(null)} style={{ background:'none', border:'none', color:T.muted, cursor:'pointer', fontSize:22 }}>×</button>
            </div>
            <form onSubmit={saveRule}>
              {[['Reorder Point (alert when stock falls below)','number','reorder_point'],['Reorder Quantity (qty to order)','number','reorder_qty']].map(([label,type,key])=>(
                <div key={key} style={{ marginBottom:12 }}>
                  <label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:5 }}>{label}</label>
                  <input type={type} value={showRule[key]} onChange={e=>setShowRule(r=>({...r,[key]:e.target.value}))} style={{ background:T.card, border:`1px solid ${T.bdr}`, borderRadius:8, padding:'9px 12px', color:T.ink, fontSize:13, fontFamily:'inherit', outline:'none', width:'100%' }}/>
                </div>
              ))}
              <div style={{ marginBottom:12 }}>
                <label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:5 }}>Preferred Supplier</label>
                <select value={showRule.preferred_supplier} onChange={e=>setShowRule(r=>({...r,preferred_supplier:e.target.value}))} style={{ background:T.card, border:`1px solid ${T.bdr}`, borderRadius:8, padding:'9px 12px', color:T.ink, fontSize:13, fontFamily:'inherit', outline:'none', width:'100%', cursor:'pointer' }}>
                  <option value="">None</option>
                  {suppliers.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div onClick={()=>setShowRule(r=>({...r,auto_po:!r.auto_po}))} style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 0', cursor:'pointer', marginBottom:14 }}>
                <div style={{ width:16, height:16, border:`2px solid ${showRule.auto_po?T.blue:T.bdr}`, borderRadius:3, background:showRule.auto_po?T.blue:'transparent', display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, color:'#fff' }}>{showRule.auto_po?'✓':''}</div>
                <span style={{ fontSize:12, color:T.ink }}>Auto-create PO when stock hits reorder point</span>
              </div>
              <div style={{ display:'flex', gap:10 }}>
                <button type="button" onClick={()=>setShowRule(null)} style={{ flex:1, background:T.card, color:T.sub, border:`1px solid ${T.bdr}`, borderRadius:8, padding:'11px', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>Cancel</button>
                <button type="submit" disabled={saving} style={{ flex:2, background:T.blue, color:'#fff', border:'none', borderRadius:8, padding:'11px', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>{saving?'Saving…':'Save Rule'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
