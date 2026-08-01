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
const STATUS_COLORS = { draft:T.muted, sent:T.blue, responded:T.amber, accepted:T.green, rejected:T.red };

export default function SupplierRFQ({ tenant }) {
  const [rfqs,      setRfqs]      = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [showForm,  setShowForm]  = useState(false);
  const [filter,    setFilter]    = useState('all');
  const [saving,    setSaving]    = useState(false);

  const [form,      setForm]      = useState({ supplier_id:'', supplier:'', supplier_phone:'', deadline:'', notes:'' });
  const [rfqItems,  setRfqItems]  = useState([]);
  const [invSearch, setInvSearch] = useState('');

  useEffect(() => { if (tenant?.id) load(); }, [tenant?.id]);

  async function load() {
    setLoading(true);
    const [rfqRes, supRes, invRes] = await Promise.all([
      supabase.from('rfq_requests').select('*').eq('tenant_id', tenant.id).order('created_at', { ascending:false }),
      supabase.from('suppliers').select('id,name,phone').eq('tenant_id', tenant.id).order('name'),
      supabase.from('inventory').select('id,name,cp,stock,unit').eq('tenant_id', tenant.id).eq('active', true).order('name'),
    ]);
    setRfqs(rfqRes.data||[]);
    setSuppliers(supRes.data||[]);
    setInventory(invRes.data||[]);
    setLoading(false);
  }

  function genRFQNum() { return `RFQ/${new Date().getFullYear()}/${String(Date.now()).slice(-5)}`; }

  function addItem(inv) {
    if (rfqItems.find(i=>i.item_id===inv.id)) return;
    setRfqItems(prev=>[...prev, { item_id:inv.id, name:inv.name, qty:1, unit:inv.unit||'pcs', last_price:inv.cp||0, quoted_price:'' }]);
    setInvSearch('');
  }

  async function createRFQ(e) {
    e.preventDefault();
    if (!form.supplier||!rfqItems.length) return alert('Select supplier and add items');
    setSaving(true);
    await supabase.from('rfq_requests').insert({ ...form, tenant_id:tenant.id, rfq_number:genRFQNum(), items:rfqItems, status:'draft' });
    setShowForm(false);
    setForm({ supplier_id:'', supplier:'', supplier_phone:'', deadline:'', notes:'' });
    setRfqItems([]);
    setSaving(false); await load();
  }

  async function updateStatus(id, status) {
    await supabase.from('rfq_requests').update({ status }).eq('id', id);
    setRfqs(prev=>prev.map(r=>r.id===id?{...r,status}:r));
  }

  function sendRFQWhatsApp(rfq) {
    const deadline = rfq.deadline?`\n📅 Deadline: *${rfq.deadline}*`:'';
    const msg = `📋 *Request for Quotation (RFQ)*\n\nDear ${rfq.supplier},\n\n*${tenant?.name||'Elite Store'}* requests your best price for the following:\n\n*RFQ No: ${rfq.rfq_number}*${deadline}\n\n*Items Required:*\n${(rfq.items||[]).map((i,idx)=>`${idx+1}. ${i.name}\n   Qty: ${i.qty} ${i.unit||'pcs'}${i.last_price?`\n   Last Price: ${fmt(i.last_price)}`:`\n   Quoted: ___`}`).join('\n')}\n\nPlease share your best price per unit along with delivery timeline.\n\nThank you!\n${tenant?.name}`;
    const ph = (rfq.supplier_phone||'').replace(/\D/g,'').replace(/^0/,'91');
    window.open(`https://wa.me/${ph||''}?text=${encodeURIComponent(msg)}`, '_blank');
    updateStatus(rfq.id, 'sent');
  }

  async function convertToPO(rfq) {
    const total = (rfq.items||[]).reduce((s,i)=>s+((i.quoted_price||i.last_price||0)*(i.qty||1)),0);
    const poNum = `PO/${new Date().getFullYear()}/${String(Date.now()).slice(-5)}`;
    await supabase.from('purchases').insert({ tenant_id:tenant.id, po_number:poNum, supplier_id:rfq.supplier_id||null, supplier:rfq.supplier, items:rfq.items, total, status:'draft', date:new Date().toISOString().slice(0,10) });
    await updateStatus(rfq.id, 'accepted');
    alert(`✅ PO ${poNum} created as draft`);
  }

  const displayed = filter==='all'?rfqs:rfqs.filter(r=>r.status===filter);
  const filteredInv = inventory.filter(i=>invSearch&&i.name.toLowerCase().includes(invSearch.toLowerCase())&&!rfqItems.find(x=>x.item_id===i.id));
  const inp = { background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:8, padding:'9px 12px', color:T.ink, fontSize:13, fontFamily:'inherit', outline:'none', width:'100%' };

  return (
    <div style={{ padding:20 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
        <div>
          <div style={{ fontSize:22, fontWeight:800, color:T.ink }}>📨 Supplier RFQ</div>
          <div style={{ fontSize:13, color:T.sub }}>Request for Quotation — compare supplier prices before ordering</div>
        </div>
        <button onClick={()=>setShowForm(true)} style={{ background:T.blue, color:'#fff', border:'none', borderRadius:9, padding:'10px 18px', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>+ New RFQ</button>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:10, marginBottom:18 }}>
        {['draft','sent','responded','accepted','rejected'].map(s=>(
          <div key={s} onClick={()=>setFilter(s===filter?'all':s)} style={{ background:T.srf, border:`1px solid ${filter===s?STATUS_COLORS[s]:T.bdr}`, borderRadius:9, padding:'10px 12px', cursor:'pointer', textAlign:'center' }}>
            <div style={{ fontSize:9, color:T.sub, fontWeight:700, textTransform:'uppercase', marginBottom:3 }}>{s}</div>
            <div style={{ fontSize:20, fontWeight:800, color:STATUS_COLORS[s] }}>{rfqs.filter(r=>r.status===s).length}</div>
          </div>
        ))}
      </div>

      <div style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:12, overflow:'hidden' }}>
        <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
          <thead><tr style={{ background:T.card }}>
            {['RFQ No','Supplier','Items','Deadline','Quoted Total','Status','Actions'].map(h=><th key={h} style={{ padding:'9px 14px', textAlign:'left', fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', borderBottom:`1px solid ${T.bdr}` }}>{h}</th>)}
          </tr></thead>
          <tbody>
            {loading?<tr><td colSpan={7} style={{ textAlign:'center', padding:40, color:T.sub }}>Loading…</td></tr>
            :displayed.length===0?<tr><td colSpan={7} style={{ textAlign:'center', padding:40, color:T.muted }}>No RFQs yet. Create your first request!</td></tr>
            :displayed.map(r=>(
              <tr key={r.id} style={{ borderBottom:`1px solid ${T.bdr}22` }}>
                <td style={{ padding:'10px 14px', color:T.blue, fontFamily:'monospace', fontWeight:700 }}>{r.rfq_number}</td>
                <td style={{ padding:'10px 14px', color:T.ink }}>{r.supplier}<br/><span style={{ fontSize:10, color:T.muted }}>{r.supplier_phone}</span></td>
                <td style={{ padding:'10px 14px', color:T.sub }}>{(r.items||[]).length} items</td>
                <td style={{ padding:'10px 14px', color:r.deadline&&r.deadline<new Date().toISOString().slice(0,10)?T.red:T.muted }}>{r.deadline||'—'}</td>
                <td style={{ padding:'10px 14px', color:T.green, fontWeight:700 }}>{r.quoted_total?fmt(r.quoted_total):'Pending'}</td>
                <td style={{ padding:'10px 14px' }}><span style={{ background:STATUS_COLORS[r.status]+'22', color:STATUS_COLORS[r.status], borderRadius:5, padding:'2px 8px', fontSize:10, fontWeight:700, textTransform:'capitalize' }}>{r.status}</span></td>
                <td style={{ padding:'10px 14px' }}>
                  <div style={{ display:'flex', gap:5 }}>
                    {['draft','sent'].includes(r.status)&&<button onClick={()=>sendRFQWhatsApp(r)} style={{ background:'#25d36622', color:'#25d366', border:'none', borderRadius:5, padding:'4px 8px', fontSize:10, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>💬 Send</button>}
                    {r.status==='sent'&&<button onClick={()=>updateStatus(r.id,'responded')} style={{ background:T.amber+'22', color:T.amber, border:'none', borderRadius:5, padding:'4px 8px', fontSize:10, cursor:'pointer', fontFamily:'inherit' }}>Got Quote</button>}
                    {r.status==='responded'&&<button onClick={()=>convertToPO(r)} style={{ background:T.green+'22', color:T.green, border:'none', borderRadius:5, padding:'4px 8px', fontSize:10, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>→ PO</button>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showForm&&(
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.85)', zIndex:200, display:'flex', alignItems:'flex-start', justifyContent:'center', padding:20, overflowY:'auto' }}>
          <div style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:14, padding:24, width:'100%', maxWidth:560, margin:'20px 0' }}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:18 }}>
              <div style={{ fontSize:17, fontWeight:700, color:T.ink }}>New RFQ</div>
              <button onClick={()=>setShowForm(false)} style={{ background:'none', border:'none', color:T.muted, cursor:'pointer', fontSize:22 }}>×</button>
            </div>
            <form onSubmit={createRFQ}>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:12 }}>
                <div><label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:4 }}>Supplier *</label>
                  <select value={form.supplier_id} onChange={e=>{const s=suppliers.find(x=>x.id===e.target.value);setForm(f=>({...f,supplier_id:e.target.value,supplier:s?.name||'',supplier_phone:s?.phone||''}));}} style={{ ...inp, cursor:'pointer' }}>
                    <option value="">Select supplier…</option>
                    {suppliers.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                  <input value={form.supplier} onChange={e=>setForm(f=>({...f,supplier:e.target.value}))} placeholder="Or type supplier name" style={{ ...inp, marginTop:6 }} required/>
                </div>
                <div>
                  <div style={{ marginBottom:8 }}><label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:4 }}>Response Deadline</label><input type="date" value={form.deadline} onChange={e=>setForm(f=>({...f,deadline:e.target.value}))} style={inp}/></div>
                  <div><label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:4 }}>Phone</label><input value={form.supplier_phone} onChange={e=>setForm(f=>({...f,supplier_phone:e.target.value}))} style={inp}/></div>
                </div>
              </div>

              <div style={{ marginBottom:12, position:'relative' }}>
                <label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:5 }}>Add Items *</label>
                <input value={invSearch} onChange={e=>setInvSearch(e.target.value)} placeholder="Search products to request quotes for…" style={inp}/>
                {filteredInv.length>0&&invSearch&&<div style={{ position:'absolute', top:'100%', left:0, right:0, background:T.card, border:`1px solid ${T.bdr}`, borderRadius:8, zIndex:10, maxHeight:160, overflowY:'auto', marginTop:4 }}>
                  {filteredInv.slice(0,6).map(i=><div key={i.id} onClick={()=>addItem(i)} style={{ padding:'8px 12px', cursor:'pointer', borderBottom:`1px solid ${T.bdr}22`, display:'flex', justifyContent:'space-between', fontSize:13 }}><span style={{ color:T.ink }}>{i.name}</span><span style={{ color:T.muted, fontSize:10 }}>Last: {fmt(i.cp||0)}</span></div>)}
                </div>}
              </div>

              {rfqItems.length>0&&<div style={{ background:T.card, borderRadius:8, overflow:'hidden', marginBottom:12 }}>
                {rfqItems.map((item,i)=>(
                  <div key={item.item_id} style={{ display:'grid', gridTemplateColumns:'1fr 70px 60px auto', gap:8, padding:'7px 10px', borderBottom:`1px solid ${T.bdr}22`, alignItems:'center' }}>
                    <span style={{ fontSize:12, color:T.ink }}>{item.name}<br/><span style={{ fontSize:10, color:T.muted }}>Last price: {fmt(item.last_price)}</span></span>
                    <input type="number" value={item.qty} onChange={e=>setRfqItems(prev=>prev.map((x,j)=>j===i?{...x,qty:parseInt(e.target.value)||1}:x))} style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:5, padding:'4px 6px', color:T.ink, fontSize:12, fontFamily:'inherit', outline:'none', textAlign:'center' }}/>
                    <select value={item.unit} onChange={e=>setRfqItems(prev=>prev.map((x,j)=>j===i?{...x,unit:e.target.value}:x))} style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:5, padding:'4px', color:T.ink, fontSize:11, fontFamily:'inherit', outline:'none' }}>
                      {['pcs','pairs','kg','box','dozen'].map(u=><option key={u} value={u}>{u}</option>)}
                    </select>
                    <button type="button" onClick={()=>setRfqItems(prev=>prev.filter((_,j)=>j!==i))} style={{ background:T.red+'22', color:T.red, border:'none', borderRadius:4, padding:'3px 7px', cursor:'pointer', fontFamily:'inherit', fontSize:11 }}>×</button>
                  </div>
                ))}
              </div>}

              <div style={{ marginBottom:14 }}><label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:4 }}>Notes</label><textarea value={form.notes} onChange={e=>setForm(f=>({...f,notes:e.target.value}))} rows={2} style={{ ...inp, resize:'vertical' }}/></div>

              <div style={{ display:'flex', gap:10 }}>
                <button type="button" onClick={()=>setShowForm(false)} style={{ flex:1, background:T.card, color:T.sub, border:`1px solid ${T.bdr}`, borderRadius:8, padding:'11px', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>Cancel</button>
                <button type="submit" disabled={saving} style={{ flex:2, background:T.blue, color:'#fff', border:'none', borderRadius:8, padding:'11px', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>{saving?'Creating…':'Create RFQ'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
