import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

const T = { bg:'#060710', srf:'#0f1220', card:'#141828', bdr:'#1e2540', blue:'#4f7cff', ink:'#eef0f8', sub:'#6b7598', muted:'#4a5175', green:'#00d68f', amber:'#ffb547', red:'#ff4d6a', teal:'#00c9b1', purple:'#9b72ff' };
const fmt = n => 'Rs.' + (n||0).toLocaleString('en-IN', { maximumFractionDigits:0 });

const STATUS_COLORS = { draft:T.muted, sent:T.blue, confirmed:T.amber, received:T.green, cancelled:T.red };

export default function PurchaseOrders({ tenant }) {
  const [orders,    setOrders]    = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [showForm,  setShowForm]  = useState(false);
  const [selected,  setSelected]  = useState(null);
  const [form,      setForm]      = useState({ supplier_id:'', expected_date:'', notes:'' });
  const [lines,     setLines]     = useState([{ name:'', qty:1, rate:0, gst:18 }]);
  const [saving,    setSaving]    = useState(false);

  useEffect(() => { if (tenant?.id) load(); }, [tenant?.id]);

  async function load() {
    setLoading(true);
    const [ordRes, supRes, invRes] = await Promise.all([
      supabase.from('purchase_orders').select('*').eq('tenant_id', tenant.id).order('date', { ascending:false }),
      supabase.from('suppliers').select('id,name,phone,email').eq('tenant_id', tenant.id).eq('active', true),
      supabase.from('inventory').select('id,name,cp,gst').eq('tenant_id', tenant.id).eq('active', true),
    ]);
    setOrders(ordRes.data || []);
    setSuppliers(supRes.data || []);
    setInventory(invRes.data || []);
    setLoading(false);
  }

  async function savePO(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const validLines = lines.filter(l => l.name && l.qty > 0);
      const subtotal   = validLines.reduce((s, l) => s + l.qty*l.rate, 0);
      const gstAmt     = validLines.reduce((s, l) => s + l.qty*l.rate*(l.gst||18)/(100+(l.gst||18)), 0);
      const supplier   = suppliers.find(s => s.id === form.supplier_id);
      const poNum      = `PO/${new Date().toISOString().slice(0,10).replace(/-/g,'')}/${String(Date.now()).slice(-4)}`;
      await supabase.from('purchase_orders').insert({
        tenant_id: tenant.id, po_number: poNum,
        supplier_id: form.supplier_id||null, supplier_name: supplier?.name||'',
        date: new Date().toISOString().slice(0,10),
        expected_date: form.expected_date||null,
        items: validLines, subtotal, gst_amount: gstAmt, total: subtotal,
        status: 'draft', notes: form.notes,
      });
      setShowForm(false); setForm({ supplier_id:'', expected_date:'', notes:'' }); setLines([{ name:'', qty:1, rate:0, gst:18 }]);
      await load();
    } catch (e) { alert('Error: '+e.message); }
    finally { setSaving(false); }
  }

  async function updateStatus(id, status) {
    await supabase.from('purchase_orders').update({ status }).eq('id', id);
    setOrders(prev => prev.map(o => o.id===id ? { ...o, status } : o));
    if (selected?.id === id) setSelected(prev => ({ ...prev, status }));

    // If received, convert to purchase and add stock
    if (status === 'received') {
      const order = orders.find(o => o.id===id);
      if (order) {
        for (const line of (order.items||[])) {
          const item = inventory.find(i => i.name.toLowerCase() === line.name.toLowerCase());
          if (item) {
            const { data: inv } = await supabase.from('inventory').select('stock').eq('id', item.id).single();
            await supabase.from('inventory').update({ stock: (inv?.stock||0) + line.qty }).eq('id', item.id);
          }
        }
        await supabase.from('purchases').insert({
          tenant_id: tenant.id, supplier: order.supplier_name, invoice_ref: order.po_number,
          date: new Date().toISOString().slice(0,10), items: order.items,
          subtotal: order.subtotal, total: order.total, status: 'paid',
        });
      }
    }
  }

  async function sendPOWhatsApp(order) {
    const supplier = suppliers.find(s => s.id===order.supplier_id);
    const msg = `*Purchase Order: ${order.po_number}*\nDate: ${order.date}\nExpected: ${order.expected_date||'TBD'}\n\n*Items:*\n${(order.items||[]).map(i=>`• ${i.name} x${i.qty} @ Rs.${i.rate}`).join('\n')}\n\n*Total: ${fmt(order.total)}*\n\nPlease confirm receipt of this order.\n\nThank you!`;
    const phone = (supplier?.phone||'').replace(/\D/g,'').replace(/^0/,'91');
    window.open(`https://wa.me/${phone||''}?text=${encodeURIComponent(msg)}`, '_blank');
  }

  const inp = { background:T.card, border:`1px solid ${T.bdr}`, borderRadius:8, padding:'8px 12px', color:T.ink, fontSize:13, fontFamily:'inherit', outline:'none', width:'100%' };
  const pendingTotal = orders.filter(o=>o.status!=='received'&&o.status!=='cancelled').reduce((s,o)=>s+(o.total||0),0);

  return (
    <div style={{ padding:20 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
        <div>
          <div style={{ fontSize:22, fontWeight:800, color:T.ink }}>Purchase Orders</div>
          <div style={{ fontSize:13, color:T.sub }}>{orders.length} orders · {fmt(pendingTotal)} pending</div>
        </div>
        <button onClick={() => setShowForm(true)} style={{ background:T.blue, color:'#fff', border:'none', borderRadius:9, padding:'10px 18px', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>
          + Create PO
        </button>
      </div>

      {/* Stats */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12, marginBottom:20 }}>
        {[['Draft',orders.filter(o=>o.status==='draft').length,T.muted],['Sent',orders.filter(o=>o.status==='sent').length,T.blue],['Confirmed',orders.filter(o=>o.status==='confirmed').length,T.amber],['Received',orders.filter(o=>o.status==='received').length,T.green]].map(([label,val,color]) => (
          <div key={label} style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:10, padding:'12px 16px' }}>
            <div style={{ fontSize:11, color:T.sub, fontWeight:700, textTransform:'uppercase', marginBottom:5 }}>{label}</div>
            <div style={{ fontSize:22, fontWeight:800, color }}>{val}</div>
          </div>
        ))}
      </div>

      <div style={{ display:'grid', gridTemplateColumns:selected?'1fr 1fr':'1fr', gap:16 }}>
        {/* Orders list */}
        <div style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:12, overflow:'hidden' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
            <thead>
              <tr style={{ background:T.card }}>
                {['PO Number','Supplier','Date','Expected','Total','Status'].map(h=>(
                  <th key={h} style={{ padding:'9px 14px', textAlign:'left', fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', borderBottom:`1px solid ${T.bdr}` }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? <tr><td colSpan={6} style={{ textAlign:'center', padding:40, color:T.sub }}>Loading…</td></tr>
              : orders.length===0 ? <tr><td colSpan={6} style={{ textAlign:'center', padding:40, color:T.muted }}>No purchase orders yet</td></tr>
              : orders.map(o=>(
                <tr key={o.id} onClick={()=>setSelected(o)} style={{ borderBottom:`1px solid ${T.bdr}22`, cursor:'pointer', background:selected?.id===o.id?T.card:'transparent' }}>
                  <td style={{ padding:'10px 14px', color:T.blue, fontFamily:'monospace', fontSize:12 }}>{o.po_number}</td>
                  <td style={{ padding:'10px 14px', color:T.ink }}>{o.supplier_name||'—'}</td>
                  <td style={{ padding:'10px 14px', color:T.sub }}>{o.date}</td>
                  <td style={{ padding:'10px 14px', color:o.expected_date?T.amber:T.muted }}>{o.expected_date||'—'}</td>
                  <td style={{ padding:'10px 14px', color:T.green, fontWeight:700 }}>{fmt(o.total)}</td>
                  <td style={{ padding:'10px 14px' }}>
                    <span style={{ background:STATUS_COLORS[o.status]+'22', color:STATUS_COLORS[o.status], borderRadius:5, padding:'2px 8px', fontSize:10, fontWeight:700, textTransform:'capitalize' }}>{o.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* PO Detail */}
        {selected && (
          <div style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:12, overflow:'hidden' }}>
            <div style={{ padding:'14px 18px', borderBottom:`1px solid ${T.bdr}`, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <div>
                <div style={{ fontSize:15, fontWeight:700, color:T.blue }}>{selected.po_number}</div>
                <div style={{ fontSize:12, color:T.sub }}>{selected.supplier_name||'No supplier'} · {selected.date}</div>
              </div>
              <button onClick={()=>setSelected(null)} style={{ background:'none', border:'none', color:T.muted, cursor:'pointer', fontSize:18 }}>×</button>
            </div>
            <div style={{ padding:16 }}>
              {/* Items */}
              <div style={{ fontWeight:700, color:T.ink, marginBottom:10, fontSize:13 }}>Items</div>
              {(selected.items||[]).map((item,i)=>(
                <div key={i} style={{ display:'flex', justifyContent:'space-between', padding:'7px 0', borderBottom:`1px solid ${T.bdr}22`, fontSize:12 }}>
                  <span style={{ color:T.ink }}>{item.name}</span>
                  <span style={{ color:T.sub }}>×{item.qty}</span>
                  <span style={{ color:T.amber }}>@ Rs.{item.rate}</span>
                  <span style={{ color:T.green, fontWeight:700 }}>{fmt(item.qty*item.rate)}</span>
                </div>
              ))}
              <div style={{ display:'flex', justifyContent:'space-between', fontSize:16, fontWeight:800, color:T.green, paddingTop:10, marginTop:4 }}>
                <span>Total</span><span>{fmt(selected.total)}</span>
              </div>

              {/* Status actions */}
              <div style={{ marginTop:16, fontWeight:700, color:T.ink, marginBottom:10, fontSize:13 }}>Update Status</div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:12 }}>
                {[['sent','Mark Sent',T.blue],['confirmed','Confirmed',T.amber],['received','Mark Received ✅',T.green],['cancelled','Cancel',T.red]].map(([s,label,color])=>(
                  <button key={s} onClick={()=>updateStatus(selected.id,s)} disabled={selected.status===s}
                    style={{ background:selected.status===s?color+'33':T.card, color:selected.status===s?color:T.sub, border:`1px solid ${selected.status===s?color:T.bdr}`, borderRadius:7, padding:'8px', fontSize:11, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>
                    {label}
                  </button>
                ))}
              </div>
              <button onClick={()=>sendPOWhatsApp(selected)} style={{ width:'100%', background:'#25d36622', color:'#25d366', border:'none', borderRadius:8, padding:'10px', fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>
                💬 Send PO via WhatsApp
              </button>
              {selected.notes && <div style={{ marginTop:12, fontSize:12, color:T.muted }}>Note: {selected.notes}</div>}
            </div>
          </div>
        )}
      </div>

      {/* Create PO modal */}
      {showForm && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.8)', zIndex:200, display:'flex', alignItems:'center', justifyContent:'center', padding:20, overflowY:'auto' }}>
          <div style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:14, padding:24, width:'100%', maxWidth:560, margin:'20px 0' }}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:18 }}>
              <div style={{ fontSize:17, fontWeight:700, color:T.ink }}>Create Purchase Order</div>
              <button onClick={()=>setShowForm(false)} style={{ background:'none', border:'none', color:T.muted, cursor:'pointer', fontSize:22 }}>×</button>
            </div>
            <form onSubmit={savePO}>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:16 }}>
                <div>
                  <label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:5 }}>Supplier</label>
                  <select value={form.supplier_id} onChange={e=>setForm(f=>({...f,supplier_id:e.target.value}))} style={{ ...inp, cursor:'pointer' }}>
                    <option value="">Select supplier</option>
                    {suppliers.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:5 }}>Expected Delivery</label>
                  <input type="date" value={form.expected_date} onChange={e=>setForm(f=>({...f,expected_date:e.target.value}))} style={inp} />
                </div>
              </div>

              <div style={{ fontWeight:700, color:T.ink, marginBottom:10 }}>Items *</div>
              {lines.map((line, idx) => (
                <div key={idx} style={{ display:'grid', gridTemplateColumns:'2fr 1fr 1fr 1fr auto', gap:8, marginBottom:8, alignItems:'center' }}>
                  <select value={line.name} onChange={e=>{
                    const item=inventory.find(i=>i.name===e.target.value);
                    setLines(prev=>prev.map((l,i)=>i===idx?{...l,name:e.target.value,rate:item?.cp||0,gst:item?.gst||18}:l));
                  }} style={{ ...inp, cursor:'pointer', fontSize:12 }}>
                    <option value="">Select item</option>
                    {inventory.map(i=><option key={i.id} value={i.name}>{i.name}</option>)}
                  </select>
                  <input type="number" min={1} value={line.qty} onChange={e=>setLines(prev=>prev.map((l,i)=>i===idx?{...l,qty:parseInt(e.target.value)||1}:l))} placeholder="Qty" style={{ ...inp, fontSize:12 }} />
                  <input type="number" min={0} value={line.rate} onChange={e=>setLines(prev=>prev.map((l,i)=>i===idx?{...l,rate:parseFloat(e.target.value)||0}:l))} placeholder="Rate" style={{ ...inp, fontSize:12 }} />
                  <input type="number" min={0} value={line.gst} onChange={e=>setLines(prev=>prev.map((l,i)=>i===idx?{...l,gst:parseFloat(e.target.value)||18}:l))} placeholder="GST%" style={{ ...inp, fontSize:12 }} />
                  {lines.length>1&&<button type="button" onClick={()=>setLines(prev=>prev.filter((_,i)=>i!==idx))} style={{ background:'none', border:'none', color:T.red, cursor:'pointer', fontSize:18 }}>×</button>}
                </div>
              ))}
              <button type="button" onClick={()=>setLines(prev=>[...prev,{name:'',qty:1,rate:0,gst:18}])} style={{ background:T.card, color:T.sub, border:`1px solid ${T.bdr}`, borderRadius:7, padding:'7px 14px', fontSize:12, cursor:'pointer', fontFamily:'inherit', marginBottom:14 }}>
                + Add Item
              </button>

              <div style={{ marginBottom:14 }}>
                <label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:5 }}>Notes</label>
                <input value={form.notes} onChange={e=>setForm(f=>({...f,notes:e.target.value}))} placeholder="Delivery instructions, terms…" style={inp} />
              </div>

              <div style={{ background:T.card, borderRadius:8, padding:'10px 14px', marginBottom:14, display:'flex', justifyContent:'space-between' }}>
                <span style={{ fontSize:13, color:T.sub }}>Order Total</span>
                <span style={{ fontSize:16, fontWeight:800, color:T.green }}>{fmt(lines.reduce((s,l)=>s+l.qty*l.rate,0))}</span>
              </div>

              <div style={{ display:'flex', gap:10 }}>
                <button type="button" onClick={()=>setShowForm(false)} style={{ flex:1, background:T.card, color:T.sub, border:`1px solid ${T.bdr}`, borderRadius:8, padding:'11px', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>Cancel</button>
                <button type="submit" disabled={saving} style={{ flex:2, background:T.blue, color:'#fff', border:'none', borderRadius:8, padding:'11px', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>
                  {saving ? 'Creating…' : 'Create Purchase Order'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
