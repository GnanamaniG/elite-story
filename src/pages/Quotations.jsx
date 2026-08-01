import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

const T = { bg:'#060710', srf:'#0f1220', card:'#141828', bdr:'#1e2540', blue:'#4f7cff', ink:'#eef0f8', sub:'#6b7598', muted:'#4a5175', green:'#00d68f', amber:'#ffb547', red:'#ff4d6a', teal:'#00c9b1', purple:'#9b72ff' };
const fmt = n => 'Rs.' + (n||0).toLocaleString('en-IN', { maximumFractionDigits:0 });
const STATUS_COLORS = { draft:T.muted, sent:T.blue, accepted:T.green, rejected:T.red, expired:T.amber, converted:T.purple };

export default function Quotations({ tenant }) {
  const [quotes,    setQuotes]    = useState([]);
  const [inventory, setInventory] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [showForm,  setShowForm]  = useState(false);
  const [editQ,     setEditQ]     = useState(null);
  const [filter,    setFilter]    = useState('all');

  // Form state
  const [form, setForm] = useState({ customer:'', customer_id:'', customer_phone:'', customer_email:'', notes:'', terms:'Prices valid for 30 days. Subject to availability.', validity_days:30 });
  const [items,   setItems]   = useState([]);
  const [invSrch, setInvSrch] = useState('');
  const [saving,  setSaving]  = useState(false);

  useEffect(() => { if (tenant?.id) load(); }, [tenant?.id]);

  async function load() {
    setLoading(true);
    const [qRes, invRes, custRes] = await Promise.all([
      supabase.from('quotations').select('*').eq('tenant_id', tenant.id).order('created_at', { ascending:false }),
      supabase.from('inventory').select('id,name,sp,gst,cat,code').eq('tenant_id', tenant.id).eq('active', true).order('name'),
      supabase.from('customers').select('id,name,phone,email').eq('tenant_id', tenant.id).order('name'),
    ]);
    setQuotes(qRes.data||[]);
    setInventory(invRes.data||[]);
    setCustomers(custRes.data||[]);
    setLoading(false);
  }

  function genQNumber() { return `QT/${new Date().getFullYear()}/${String(Date.now()).slice(-5)}`; }

  function addItem(inv) {
    setItems(prev=>[...prev, { id:inv.id, name:inv.name, qty:1, rate:inv.sp||0, gst:inv.gst||0, discount:0, amount:inv.sp||0 }]);
    setInvSrch('');
  }

  function updateItem(idx, field, val) {
    setItems(prev => prev.map((it,i) => {
      if (i!==idx) return it;
      const updated = { ...it, [field]: parseFloat(val)||0 };
      const base = updated.rate * updated.qty;
      updated.amount = base - (base * updated.discount/100);
      return updated;
    }));
  }

  const subtotal = items.reduce((s,i)=>s+(i.amount||0),0);
  const gstTotal = items.reduce((s,i)=>s+(i.amount*i.gst/(100+i.gst)),0);
  const total    = subtotal;

  async function saveQuotation(e) {
    e.preventDefault();
    if (!form.customer || !items.length) return alert('Add customer and at least one item');
    setSaving(true);
    const valid_until = new Date(Date.now() + (form.validity_days||30)*86400000).toISOString().slice(0,10);
    const payload = { ...form, tenant_id:tenant.id, quot_number:editQ?.quot_number||genQNumber(), items, subtotal, gst_amount:gstTotal, total, valid_until, validity_days:parseInt(form.validity_days)||30 };
    if (editQ) await supabase.from('quotations').update(payload).eq('id', editQ.id);
    else await supabase.from('quotations').insert(payload);
    setShowForm(false); setEditQ(null); resetForm(); setSaving(false); await load();
  }

  function resetForm() { setForm({ customer:'', customer_id:'', customer_phone:'', customer_email:'', notes:'', terms:'Prices valid for 30 days. Subject to availability.', validity_days:30 }); setItems([]); }

  function openEdit(q) { setEditQ(q); setForm({ customer:q.customer, customer_id:q.customer_id||'', customer_phone:q.customer_phone||'', customer_email:q.customer_email||'', notes:q.notes||'', terms:q.terms||'', validity_days:q.validity_days||30 }); setItems(q.items||[]); setShowForm(true); }

  async function updateStatus(id, status) {
    await supabase.from('quotations').update({ status }).eq('id', id);
    setQuotes(prev=>prev.map(q=>q.id===id?{...q,status}:q));
  }

  async function convertToSale(q) {
    if (!confirm('Convert this quotation to a sale invoice?')) return;
    const invNum = `INV/${new Date().getFullYear()}/${String(Date.now()).slice(-5)}`;
    const { data:sale } = await supabase.from('sales').insert({ tenant_id:tenant.id, inv_num:invNum, date:new Date().toISOString().slice(0,10), customer:q.customer, customer_id:q.customer_id||null, items:q.items, subtotal:q.subtotal, gst_amount:q.gst_amount, total:q.total, payment_mode:'credit', status:'pending' }).select().single();
    await supabase.from('quotations').update({ status:'converted', converted_to:sale.id }).eq('id', q.id);
    alert(`✅ Converted to Invoice ${invNum}`);
    await load();
  }

  function sendQuoteWA(q) {
    const msg = `📋 *Quotation from ${tenant?.name||'Elite Store'}*\n\n*Quote No: ${q.quot_number}*\nDate: ${q.quot_date}\nValid Until: ${q.valid_until}\n\nDear ${q.customer},\n\n*Items:*\n${(q.items||[]).map(i=>`• ${i.name} × ${i.qty} — ${fmt(i.amount)}`).join('\n')}\n\n━━━━━━━━━━━━━\n*Total: ${fmt(q.total)}*\n\n${q.terms||''}\n\nPlease confirm to proceed. 🙏`;
    const ph = (q.customer_phone||'').replace(/\D/g,'').replace(/^0/,'91');
    window.open(`https://wa.me/${ph||''}?text=${encodeURIComponent(msg)}`, '_blank');
  }

  function printQuote(q) {
    const w = window.open('', '_blank');
    w.document.write(`<!DOCTYPE html><html><head><style>body{font-family:Arial,sans-serif;margin:0;padding:20px}table{width:100%;border-collapse:collapse}th,td{padding:8px 12px;border:1px solid #ddd}th{background:#f5f5f5}.right{text-align:right}</style></head><body>
    <div style="display:flex;justify-content:space-between;margin-bottom:20px">
      <div><div style="font-size:24px;font-weight:900">${tenant?.name||'Elite Store'}</div><div style="color:#666">${tenant?.gstin?'GSTIN: '+tenant.gstin:''}</div></div>
      <div style="text-align:right"><div style="font-size:20px;font-weight:700;color:#4f7cff">QUOTATION</div><div>${q.quot_number}</div><div>Date: ${q.quot_date}</div><div>Valid Until: ${q.valid_until}</div></div>
    </div>
    <div style="background:#f5f5ff;padding:10px 14px;border-radius:6px;margin-bottom:16px"><b>To:</b> ${q.customer}${q.customer_phone?'<br>'+q.customer_phone:''}</div>
    <table><tr><th>Item</th><th>Qty</th><th>Rate</th><th>Disc%</th><th>GST%</th><th class="right">Amount</th></tr>
    ${(q.items||[]).map(i=>`<tr><td>${i.name}</td><td>${i.qty}</td><td>Rs.${(i.rate||0).toFixed(2)}</td><td>${i.discount||0}%</td><td>${i.gst||0}%</td><td class="right">Rs.${(i.amount||0).toFixed(2)}</td></tr>`).join('')}
    </table>
    <div style="display:flex;justify-content:flex-end;margin-top:12px"><div style="width:260px">
      <div style="display:flex;justify-content:space-between;padding:4px 0"><span>Subtotal</span><span>Rs.${(q.subtotal||0).toFixed(2)}</span></div>
      <div style="display:flex;justify-content:space-between;padding:4px 0"><span>GST</span><span>Rs.${(q.gst_amount||0).toFixed(2)}</span></div>
      <div style="display:flex;justify-content:space-between;padding:8px 0;font-weight:900;font-size:16px;border-top:2px solid #ddd"><span>TOTAL</span><span style="color:#4f7cff">Rs.${(q.total||0).toFixed(2)}</span></div>
    </div></div>
    ${q.terms?`<div style="margin-top:16px;font-size:12px;color:#666"><b>Terms & Conditions:</b><br>${q.terms}</div>`:''}
    <script>window.onload=()=>{window.print();setTimeout(()=>window.close(),500)}<\/script></body></html>`);
    w.document.close();
  }

  const displayed  = filter==='all'?quotes:quotes.filter(q=>q.status===filter);
  const filteredInv= inventory.filter(i=>invSrch&&i.name.toLowerCase().includes(invSrch.toLowerCase())&&!items.find(x=>x.id===i.id));
  const inp = { background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:8, padding:'8px 11px', color:T.ink, fontSize:13, fontFamily:'inherit', outline:'none', width:'100%' };
  const totOpen    = quotes.filter(q=>['draft','sent'].includes(q.status)).reduce((s,q)=>s+(q.total||0),0);

  return (
    <div style={{ padding:20 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
        <div>
          <div style={{ fontSize:22, fontWeight:800, color:T.ink }}>📋 Quotations</div>
          <div style={{ fontSize:13, color:T.sub }}>{quotes.filter(q=>q.status!=='converted').length} active · {fmt(totOpen)} pipeline value</div>
        </div>
        <button onClick={()=>{resetForm();setEditQ(null);setShowForm(true);}} style={{ background:T.blue, color:'#fff', border:'none', borderRadius:9, padding:'10px 18px', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>+ New Quotation</button>
      </div>

      {/* Stats */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:10, marginBottom:18 }}>
        {[['Draft',T.muted],['Sent',T.blue],['Accepted',T.green],['Rejected',T.red],['Converted',T.purple]].map(([s,c])=>(
          <div key={s} onClick={()=>setFilter(s.toLowerCase())} style={{ background:T.srf, border:`1px solid ${filter===s.toLowerCase()?c:T.bdr}`, borderRadius:9, padding:'10px 14px', cursor:'pointer' }}>
            <div style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', marginBottom:4 }}>{s}</div>
            <div style={{ fontSize:18, fontWeight:800, color:c }}>{quotes.filter(q=>q.status===s.toLowerCase()).length}</div>
          </div>
        ))}
      </div>

      <div style={{ display:'flex', gap:8, marginBottom:14 }}>
        {['all','draft','sent','accepted','rejected','converted'].map(f=>(
          <button key={f} onClick={()=>setFilter(f)} style={{ background:filter===f?T.blue:T.srf, color:filter===f?'#fff':T.sub, border:`1px solid ${filter===f?T.blue:T.bdr}`, borderRadius:7, padding:'5px 12px', fontSize:11, cursor:'pointer', fontFamily:'inherit', textTransform:'capitalize' }}>
            {f} ({f==='all'?quotes.length:quotes.filter(q=>q.status===f).length})
          </button>
        ))}
      </div>

      <div style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:12, overflow:'hidden' }}>
        <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
          <thead><tr style={{ background:T.card }}>
            {['Quote No','Customer','Items','Total','Valid Until','Status','Actions'].map(h=><th key={h} style={{ padding:'9px 14px', textAlign:'left', fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', borderBottom:`1px solid ${T.bdr}` }}>{h}</th>)}
          </tr></thead>
          <tbody>
            {loading?<tr><td colSpan={7} style={{ textAlign:'center', padding:40, color:T.sub }}>Loading…</td></tr>
            :displayed.length===0?<tr><td colSpan={7} style={{ textAlign:'center', padding:40, color:T.muted }}>No quotations found</td></tr>
            :displayed.map(q=>{
              const expired = q.status==='sent'&&new Date(q.valid_until)<new Date();
              return (
                <tr key={q.id} style={{ borderBottom:`1px solid ${T.bdr}22` }}>
                  <td style={{ padding:'10px 14px', color:T.blue, fontFamily:'monospace', fontWeight:700 }}>{q.quot_number}</td>
                  <td style={{ padding:'10px 14px', color:T.ink }}>{q.customer}</td>
                  <td style={{ padding:'10px 14px', color:T.sub }}>{(q.items||[]).length} items</td>
                  <td style={{ padding:'10px 14px', color:T.green, fontWeight:700 }}>{fmt(q.total)}</td>
                  <td style={{ padding:'10px 14px', color:expired?T.red:T.muted }}>{q.valid_until}</td>
                  <td style={{ padding:'10px 14px' }}><span style={{ background:STATUS_COLORS[q.status]+'22', color:STATUS_COLORS[q.status], borderRadius:5, padding:'2px 8px', fontSize:10, fontWeight:700, textTransform:'capitalize' }}>{q.status}</span></td>
                  <td style={{ padding:'10px 14px' }}>
                    <div style={{ display:'flex', gap:5 }}>
                      <button onClick={()=>printQuote(q)} style={{ background:T.blue+'22', color:T.blue, border:'none', borderRadius:5, padding:'4px 8px', fontSize:10, cursor:'pointer', fontFamily:'inherit' }}>🖨️</button>
                      {q.customer_phone&&<button onClick={()=>sendQuoteWA(q)} style={{ background:'#25d36622', color:'#25d366', border:'none', borderRadius:5, padding:'4px 8px', fontSize:10, cursor:'pointer', fontFamily:'inherit' }}>💬</button>}
                      {q.status==='draft'&&<button onClick={()=>updateStatus(q.id,'sent')} style={{ background:T.blue+'22', color:T.blue, border:'none', borderRadius:5, padding:'4px 8px', fontSize:10, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>Send</button>}
                      {q.status==='sent'&&<button onClick={()=>updateStatus(q.id,'accepted')} style={{ background:T.green+'22', color:T.green, border:'none', borderRadius:5, padding:'4px 8px', fontSize:10, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>Accept</button>}
                      {q.status==='accepted'&&<button onClick={()=>convertToSale(q)} style={{ background:T.purple+'22', color:T.purple, border:'none', borderRadius:5, padding:'4px 8px', fontSize:10, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>→ Invoice</button>}
                      {['draft','sent'].includes(q.status)&&<button onClick={()=>openEdit(q)} style={{ background:T.amber+'22', color:T.amber, border:'none', borderRadius:5, padding:'4px 8px', fontSize:10, cursor:'pointer', fontFamily:'inherit' }}>✏️</button>}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {showForm&&(
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.85)', zIndex:200, display:'flex', alignItems:'flex-start', justifyContent:'center', padding:20, overflowY:'auto' }}>
          <div style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:14, padding:24, width:'100%', maxWidth:680, margin:'20px 0' }}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:18 }}>
              <div style={{ fontSize:17, fontWeight:700, color:T.ink }}>{editQ?'Edit':'New'} Quotation</div>
              <button onClick={()=>{setShowForm(false);setEditQ(null);resetForm();}} style={{ background:'none', border:'none', color:T.muted, cursor:'pointer', fontSize:22 }}>×</button>
            </div>
            <form onSubmit={saveQuotation}>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:14 }}>
                <div>
                  <label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:5 }}>Customer *</label>
                  <select value={form.customer_id} onChange={e=>{const c=customers.find(x=>x.id===e.target.value);setForm(f=>({...f,customer_id:e.target.value,customer:c?.name||'',customer_phone:c?.phone||'',customer_email:c?.email||''}));}} style={{ ...inp, cursor:'pointer' }}>
                    <option value="">Select customer…</option>
                    {customers.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                  <input value={form.customer} onChange={e=>setForm(f=>({...f,customer:e.target.value}))} placeholder="Or type customer name" style={{ ...inp, marginTop:6 }} required/>
                </div>
                <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                  <div><label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:4 }}>Phone</label><input value={form.customer_phone} onChange={e=>setForm(f=>({...f,customer_phone:e.target.value}))} style={inp}/></div>
                  <div><label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:4 }}>Validity (days)</label><input type="number" value={form.validity_days} onChange={e=>setForm(f=>({...f,validity_days:e.target.value}))} style={inp}/></div>
                </div>
              </div>

              {/* Add items */}
              <div style={{ marginBottom:12, position:'relative' }}>
                <label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:5 }}>Add Products *</label>
                <input value={invSrch} onChange={e=>setInvSrch(e.target.value)} placeholder="Search product to add…" style={inp}/>
                {filteredInv.length>0&&invSrch&&<div style={{ position:'absolute', top:'100%', left:0, right:0, background:T.card, border:`1px solid ${T.bdr}`, borderRadius:8, zIndex:10, maxHeight:160, overflowY:'auto', marginTop:4 }}>
                  {filteredInv.slice(0,6).map(i=><div key={i.id} onClick={()=>addItem(i)} style={{ padding:'8px 12px', cursor:'pointer', borderBottom:`1px solid ${T.bdr}22`, display:'flex', justifyContent:'space-between', fontSize:13 }}><span style={{ color:T.ink }}>{i.name}</span><span style={{ color:T.green }}>{fmt(i.sp)}</span></div>)}
                </div>}
              </div>

              {items.length>0&&<div style={{ background:T.card, borderRadius:9, overflow:'hidden', marginBottom:14 }}>
                <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
                  <thead><tr style={{ background:T.srf }}>{['Product','Qty','Rate','Disc%','GST%','Amount',''].map(h=><th key={h} style={{ padding:'7px 10px', textAlign:'left', fontSize:9, color:T.sub, fontWeight:700, textTransform:'uppercase' }}>{h}</th>)}</tr></thead>
                  <tbody>
                    {items.map((it,idx)=>(
                      <tr key={idx} style={{ borderTop:`1px solid ${T.bdr}22` }}>
                        <td style={{ padding:'6px 10px', color:T.ink }}>{it.name}</td>
                        {['qty','rate','discount','gst'].map(field=>(
                          <td key={field} style={{ padding:'4px 6px' }}>
                            <input type="number" value={it[field]||0} onChange={e=>updateItem(idx,field,e.target.value)} style={{ width:60, background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:5, padding:'4px 6px', color:T.ink, fontSize:11, fontFamily:'inherit', outline:'none', textAlign:'center' }}/>
                          </td>
                        ))}
                        <td style={{ padding:'6px 10px', color:T.green, fontWeight:700 }}>{fmt(it.amount)}</td>
                        <td style={{ padding:'4px 6px' }}><button type="button" onClick={()=>setItems(prev=>prev.filter((_,i)=>i!==idx))} style={{ background:T.red+'22', color:T.red, border:'none', borderRadius:4, padding:'3px 7px', cursor:'pointer', fontFamily:'inherit', fontSize:11 }}>×</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div style={{ padding:'8px 14px', display:'flex', justifyContent:'flex-end', gap:20, fontSize:12, borderTop:`1px solid ${T.bdr}` }}>
                  <span style={{ color:T.sub }}>GST: {fmt(gstTotal)}</span>
                  <span style={{ color:T.green, fontWeight:800, fontSize:14 }}>Total: {fmt(total)}</span>
                </div>
              </div>}

              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:14 }}>
                <div><label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:5 }}>Notes</label><textarea value={form.notes} onChange={e=>setForm(f=>({...f,notes:e.target.value}))} rows={2} style={{ ...inp, resize:'vertical' }}/></div>
                <div><label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:5 }}>Terms & Conditions</label><textarea value={form.terms} onChange={e=>setForm(f=>({...f,terms:e.target.value}))} rows={2} style={{ ...inp, resize:'vertical' }}/></div>
              </div>

              <div style={{ display:'flex', gap:10 }}>
                <button type="button" onClick={()=>{setShowForm(false);setEditQ(null);resetForm();}} style={{ flex:1, background:T.card, color:T.sub, border:`1px solid ${T.bdr}`, borderRadius:8, padding:'11px', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>Cancel</button>
                <button type="submit" disabled={saving} style={{ flex:2, background:T.blue, color:'#fff', border:'none', borderRadius:8, padding:'11px', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>{saving?'Saving…':(editQ?'Update Quotation':'Create Quotation')}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
