import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

const T = { bg:'#060710', srf:'#0f1220', card:'#141828', bdr:'#1e2540', blue:'#4f7cff', ink:'#eef0f8', sub:'#6b7598', muted:'#4a5175', green:'#00d68f', amber:'#ffb547', red:'#ff4d6a', teal:'#00c9b1' };
const fmt = n => 'Rs.' + (n||0).toLocaleString('en-IN', { maximumFractionDigits:0 });
const STATUS_COLORS = { pending:T.amber, acknowledged:T.blue, adjusted:T.green, cancelled:T.red };

export default function PurchaseReturns({ tenant }) {
  const [returns,   setReturns]   = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [showForm,  setShowForm]  = useState(false);
  const [filter,    setFilter]    = useState('all');

  // Form state
  const [selSupplier, setSelSupplier] = useState('');
  const [selPurchase, setSelPurchase] = useState('');
  const [returnItems, setReturnItems] = useState([]);
  const [reason,      setReason]      = useState('');
  const [notes,       setNotes]       = useState('');
  const [saving,      setSaving]      = useState(false);
  const [invSearch,   setInvSearch]   = useState('');

  useEffect(() => { if (tenant?.id) load(); }, [tenant?.id]);

  async function load() {
    setLoading(true);
    const [retRes, supRes, purRes, invRes] = await Promise.all([
      supabase.from('purchase_returns').select('*').eq('tenant_id', tenant.id).order('created_at', { ascending:false }),
      supabase.from('suppliers').select('id,name,phone').eq('tenant_id', tenant.id).order('name'),
      supabase.from('purchases').select('id,supplier,supplier_id,items,total,date').eq('tenant_id', tenant.id).order('date', { ascending:false }).limit(50),
      supabase.from('inventory').select('id,name,cp,stock').eq('tenant_id', tenant.id).eq('active', true).order('name'),
    ]);
    setReturns(retRes.data||[]);
    setSuppliers(supRes.data||[]);
    setPurchases(purRes.data||[]);
    setInventory(invRes.data||[]);
    setLoading(false);
  }

  function genDNNumber() {
    return `DN/${new Date().getFullYear()}/${String(Date.now()).slice(-5)}`;
  }

  function addReturnItem(inv) {
    if (returnItems.find(i=>i.item_id===inv.id)) return;
    setReturnItems(prev=>[...prev, { item_id:inv.id, name:inv.name, qty:1, rate:inv.cp||0, amount:inv.cp||0 }]);
    setInvSearch('');
  }

  function updateReturnQty(id, qty) {
    setReturnItems(prev=>prev.map(i=>i.item_id===id?{...i,qty:parseInt(qty)||1,amount:(parseInt(qty)||1)*i.rate}:i));
  }

  async function createReturn(e) {
    e.preventDefault();
    if (!selSupplier || !returnItems.length || !reason) return alert('Fill all required fields');
    setSaving(true);
    try {
      const sup   = suppliers.find(s=>s.id===selSupplier);
      const total = returnItems.reduce((s,i)=>s+(i.amount||0),0);
      const dn    = genDNNumber();
      await supabase.from('purchase_returns').insert({ tenant_id:tenant.id, dn_number:dn, supplier_id:selSupplier, supplier:sup?.name||'', supplier_phone:sup?.phone||'', purchase_id:selPurchase||null, items:returnItems, total, reason, notes });
      // Reduce inventory stock
      for (const item of returnItems) {
        const inv = inventory.find(i=>i.id===item.item_id);
        if (inv) await supabase.from('inventory').update({ stock:Math.max(0,(inv.stock||0)-item.qty) }).eq('id', item.item_id);
      }
      setShowForm(false); setSelSupplier(''); setSelPurchase(''); setReturnItems([]); setReason(''); setNotes('');
      await load();
    } catch(e) { alert('Error: '+e.message); }
    finally { setSaving(false); }
  }

  async function updateStatus(id, status) {
    await supabase.from('purchase_returns').update({ status }).eq('id', id);
    setReturns(prev=>prev.map(r=>r.id===id?{...r,status}:r));
  }

  function sendDNWhatsApp(ret) {
    const msg = `Dear ${ret.supplier},\n\nPlease find below our *Debit Note* for goods returned:\n\n📋 DN Number: *${ret.dn_number}*\n📅 Date: ${ret.return_date}\n\n*Items Returned:*\n${(ret.items||[]).map(i=>`• ${i.name} × ${i.qty} — ${fmt(i.amount)}`).join('\n')}\n\n*Total: ${fmt(ret.total)}*\n\nReason: ${ret.reason}\n\nKindly acknowledge receipt and arrange credit/adjustment.\n\nRegards,\n${tenant?.name||'Elite Store'}`;
    const ph  = (ret.supplier_phone||'').replace(/\D/g,'').replace(/^0/,'91');
    window.open(`https://wa.me/${ph||''}?text=${encodeURIComponent(msg)}`, '_blank');
  }

  function printDN(ret) {
    const w = window.open('', '_blank');
    w.document.write(`<!DOCTYPE html><html><head><style>body{font-family:Arial,sans-serif;margin:0;padding:20px}.center{text-align:center}.row{display:flex;justify-content:space-between;padding:4px 0}.divider{border-top:1px solid #ddd;margin:10px 0}table{width:100%;border-collapse:collapse}th,td{padding:8px;border:1px solid #ddd;text-align:left}th{background:#f5f5f5}</style></head><body>
    <div class="center" style="font-size:22px;font-weight:bold">${tenant?.name||'Elite Store'}</div>
    <div class="center" style="font-size:18px;color:#4f7cff;margin:10px 0">DEBIT NOTE</div>
    <div class="divider"></div>
    <div class="row"><span><b>DN Number:</b> ${ret.dn_number}</span><span><b>Date:</b> ${ret.return_date}</span></div>
    <div class="row"><span><b>Supplier:</b> ${ret.supplier}</span></div>
    <div class="divider"></div>
    <table><tr><th>Item</th><th>Qty</th><th>Rate</th><th>Amount</th></tr>
    ${(ret.items||[]).map(i=>`<tr><td>${i.name}</td><td>${i.qty}</td><td>Rs.${(i.rate||0).toFixed(2)}</td><td>Rs.${(i.amount||0).toFixed(2)}</td></tr>`).join('')}
    </table>
    <div class="divider"></div>
    <div class="row" style="font-size:18px;font-weight:bold"><span>Total Debit:</span><span style="color:red">Rs.${(ret.total||0).toFixed(2)}</span></div>
    <div class="row"><span><b>Reason:</b> ${ret.reason}</span></div>
    <script>window.onload=()=>{window.print();setTimeout(()=>window.close(),500)}<\/script></body></html>`);
    w.document.close();
  }

  const displayed = filter==='all'?returns:returns.filter(r=>r.status===filter);
  const totalValue= returns.reduce((s,r)=>s+(r.total||0),0);
  const filteredInv = inventory.filter(i=>invSearch&&i.name.toLowerCase().includes(invSearch.toLowerCase())&&!returnItems.find(x=>x.item_id===i.id));
  const inp = { background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:8, padding:'9px 12px', color:T.ink, fontSize:13, fontFamily:'inherit', outline:'none', width:'100%' };

  return (
    <div style={{ padding:20 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
        <div>
          <div style={{ fontSize:22, fontWeight:800, color:T.ink }}>↩️ Purchase Returns</div>
          <div style={{ fontSize:13, color:T.sub }}>{returns.length} debit notes · {fmt(totalValue)} total returned</div>
        </div>
        <button onClick={()=>setShowForm(true)} style={{ background:T.blue, color:'#fff', border:'none', borderRadius:9, padding:'10px 18px', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>+ New Return</button>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12, marginBottom:20 }}>
        {[['Pending',returns.filter(r=>r.status==='pending').length,T.amber],['Acknowledged',returns.filter(r=>r.status==='acknowledged').length,T.blue],['Adjusted',returns.filter(r=>r.status==='adjusted').length,T.green],['Total Value',fmt(totalValue),T.red]].map(([label,val,color])=>(
          <div key={label} style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:10, padding:'12px 16px' }}>
            <div style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', marginBottom:5 }}>{label}</div>
            <div style={{ fontSize:20, fontWeight:800, color }}>{val}</div>
          </div>
        ))}
      </div>

      <div style={{ display:'flex', gap:8, marginBottom:14 }}>
        {['all','pending','acknowledged','adjusted','cancelled'].map(f=>(
          <button key={f} onClick={()=>setFilter(f)} style={{ background:filter===f?T.blue:T.srf, color:filter===f?'#fff':T.sub, border:`1px solid ${filter===f?T.blue:T.bdr}`, borderRadius:7, padding:'6px 12px', fontSize:11, cursor:'pointer', fontFamily:'inherit', textTransform:'capitalize' }}>
            {f} ({f==='all'?returns.length:returns.filter(r=>r.status===f).length})
          </button>
        ))}
      </div>

      <div style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:12, overflow:'hidden' }}>
        <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
          <thead><tr style={{ background:T.card }}>
            {['DN Number','Supplier','Items','Total','Date','Status','Actions'].map(h=>(
              <th key={h} style={{ padding:'9px 14px', textAlign:'left', fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', borderBottom:`1px solid ${T.bdr}` }}>{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {loading?<tr><td colSpan={7} style={{ textAlign:'center', padding:40, color:T.sub }}>Loading…</td></tr>
            :displayed.length===0?<tr><td colSpan={7} style={{ textAlign:'center', padding:40, color:T.muted }}>No purchase returns</td></tr>
            :displayed.map(r=>(
              <tr key={r.id} style={{ borderBottom:`1px solid ${T.bdr}22` }}>
                <td style={{ padding:'10px 14px', color:T.blue, fontFamily:'monospace', fontWeight:700 }}>{r.dn_number}</td>
                <td style={{ padding:'10px 14px', color:T.ink }}>{r.supplier}</td>
                <td style={{ padding:'10px 14px', color:T.sub }}>{(r.items||[]).length} items</td>
                <td style={{ padding:'10px 14px', color:T.red, fontWeight:700 }}>{fmt(r.total)}</td>
                <td style={{ padding:'10px 14px', color:T.muted }}>{r.return_date}</td>
                <td style={{ padding:'10px 14px' }}><span style={{ background:STATUS_COLORS[r.status]+'22', color:STATUS_COLORS[r.status], borderRadius:5, padding:'2px 8px', fontSize:10, fontWeight:700, textTransform:'capitalize' }}>{r.status}</span></td>
                <td style={{ padding:'10px 14px' }}>
                  <div style={{ display:'flex', gap:5 }}>
                    <button onClick={()=>printDN(r)} style={{ background:T.blue+'22', color:T.blue, border:'none', borderRadius:5, padding:'4px 8px', fontSize:10, cursor:'pointer', fontFamily:'inherit' }}>🖨️</button>
                    {r.supplier_phone&&<button onClick={()=>sendDNWhatsApp(r)} style={{ background:'#25d36622', color:'#25d366', border:'none', borderRadius:5, padding:'4px 8px', fontSize:10, cursor:'pointer', fontFamily:'inherit' }}>💬</button>}
                    {r.status==='pending'&&<button onClick={()=>updateStatus(r.id,'acknowledged')} style={{ background:T.green+'22', color:T.green, border:'none', borderRadius:5, padding:'4px 8px', fontSize:10, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>✅</button>}
                    {r.status==='acknowledged'&&<button onClick={()=>updateStatus(r.id,'adjusted')} style={{ background:T.teal+'22', color:T.teal, border:'none', borderRadius:5, padding:'4px 8px', fontSize:10, cursor:'pointer', fontFamily:'inherit' }}>Adjusted</button>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showForm&&(
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.85)', zIndex:200, display:'flex', alignItems:'center', justifyContent:'center', padding:20, overflowY:'auto' }}>
          <div style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:14, padding:24, width:'100%', maxWidth:560, margin:'20px 0' }}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:18 }}>
              <div style={{ fontSize:17, fontWeight:700, color:T.ink }}>New Purchase Return</div>
              <button onClick={()=>setShowForm(false)} style={{ background:'none', border:'none', color:T.muted, cursor:'pointer', fontSize:22 }}>×</button>
            </div>
            <form onSubmit={createReturn}>
              <div style={{ marginBottom:12 }}>
                <label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:5 }}>Supplier *</label>
                <select value={selSupplier} onChange={e=>setSelSupplier(e.target.value)} required style={{ ...inp, cursor:'pointer' }}>
                  <option value="">Select supplier…</option>
                  {suppliers.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div style={{ marginBottom:12 }}>
                <label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:5 }}>Link to Purchase (optional)</label>
                <select value={selPurchase} onChange={e=>setSelPurchase(e.target.value)} style={{ ...inp, cursor:'pointer' }}>
                  <option value="">— No linked purchase —</option>
                  {purchases.filter(p=>!selSupplier||p.supplier_id===selSupplier).map(p=><option key={p.id} value={p.id}>{p.date} · {p.supplier} · {fmt(p.total)}</option>)}
                </select>
              </div>
              <div style={{ marginBottom:12, position:'relative' }}>
                <label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:5 }}>Add Items *</label>
                <input value={invSearch} onChange={e=>setInvSearch(e.target.value)} placeholder="Search inventory to add return items…" style={inp}/>
                {filteredInv.length>0&&invSearch&&<div style={{ position:'absolute', top:'100%', left:0, right:0, background:T.card, border:`1px solid ${T.bdr}`, borderRadius:8, zIndex:10, maxHeight:160, overflowY:'auto', marginTop:4 }}>
                  {filteredInv.slice(0,6).map(i=><div key={i.id} onClick={()=>addReturnItem(i)} style={{ padding:'8px 12px', cursor:'pointer', borderBottom:`1px solid ${T.bdr}22`, display:'flex', justifyContent:'space-between', fontSize:13 }}><span style={{ color:T.ink }}>{i.name}</span><span style={{ color:T.amber }}>{fmt(i.cp||0)}/unit</span></div>)}
                </div>}
              </div>
              {returnItems.length>0&&<div style={{ background:T.card, borderRadius:8, padding:12, marginBottom:12 }}>
                {returnItems.map(item=>(
                  <div key={item.item_id} style={{ display:'flex', alignItems:'center', gap:10, padding:'5px 0', borderBottom:`1px solid ${T.bdr}22` }}>
                    <span style={{ flex:1, fontSize:12, color:T.ink }}>{item.name}</span>
                    <input type="number" min={1} value={item.qty} onChange={e=>updateReturnQty(item.item_id,e.target.value)} style={{ width:60, background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:5, padding:'4px 8px', color:T.ink, fontSize:12, fontFamily:'inherit', outline:'none', textAlign:'center' }}/>
                    <span style={{ fontSize:12, color:T.red, fontWeight:700, minWidth:70, textAlign:'right' }}>{fmt(item.amount)}</span>
                    <button type="button" onClick={()=>setReturnItems(prev=>prev.filter(i=>i.item_id!==item.item_id))} style={{ background:T.red+'22', color:T.red, border:'none', borderRadius:4, padding:'3px 7px', cursor:'pointer', fontFamily:'inherit', fontSize:11 }}>×</button>
                  </div>
                ))}
                <div style={{ display:'flex', justifyContent:'space-between', marginTop:8, fontWeight:700, fontSize:13 }}><span style={{ color:T.sub }}>Total</span><span style={{ color:T.red }}>{fmt(returnItems.reduce((s,i)=>s+(i.amount||0),0))}</span></div>
              </div>}
              <div style={{ marginBottom:12 }}>
                <label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:5 }}>Reason *</label>
                <input value={reason} onChange={e=>setReason(e.target.value)} placeholder="e.g. Defective goods, Wrong items received" style={inp} required/>
              </div>
              <div style={{ marginBottom:16 }}>
                <label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:5 }}>Notes</label>
                <input value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Additional notes" style={inp}/>
              </div>
              <div style={{ display:'flex', gap:10 }}>
                <button type="button" onClick={()=>setShowForm(false)} style={{ flex:1, background:T.card, color:T.sub, border:`1px solid ${T.bdr}`, borderRadius:8, padding:'11px', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>Cancel</button>
                <button type="submit" disabled={saving} style={{ flex:2, background:T.blue, color:'#fff', border:'none', borderRadius:8, padding:'11px', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>{saving?'Creating…':'Create Debit Note'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
