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

const STATUS_CFG = {
  draft:       { color:'#6B7280', bg:'#F9FAFB', border:'#E5E7EB', label:'Draft'       },
  confirmed:   { color:'#2563EB', bg:'#EFF6FF', border:'#BFDBFE', label:'Confirmed'   },
  processing:  { color:'#7C3AED', bg:'#F5F3FF', border:'#DDD6FE', label:'Processing'  },
  dispatched:  { color:'#D97706', bg:'#FFFBEB', border:'#FDE68A', label:'Dispatched'  },
  delivered:   { color:'#16A34A', bg:'#F0FDF4', border:'#BBF7D0', label:'Delivered'   },
  cancelled:   { color:'#C0392B', bg:'#FEF2F2', border:'#FECACA', label:'Cancelled'   },
};

export default function B2BOrders({ tenant }) {
  const [orders,    setOrders]    = useState([]);
  const [inventory, setInventory] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [showForm,  setShowForm]  = useState(false);
  const [selOrder,  setSelOrder]  = useState(null);
  const [filter,    setFilter]    = useState('all');
  const [saving,    setSaving]    = useState(false);
  const [invSearch, setInvSearch] = useState('');
  const [items,     setItems]     = useState([]);
  const [form, setForm] = useState({ customer:'', customer_id:'', customer_phone:'', customer_gstin:'', discount_pct:'0', advance_paid:'0', delivery_date:'', notes:'' });

  useEffect(() => { if (tenant?.id) load(); }, [tenant?.id]);

  async function load() {
    setLoading(true);
    const [oRes, invRes, custRes] = await Promise.all([
      supabase.from('b2b_orders').select('*').eq('tenant_id', tenant.id).order('created_at', { ascending:false }),
      supabase.from('inventory').select('id,name,cp,sp,gst,stock,code').eq('tenant_id', tenant.id).eq('active', true).order('name'),
      supabase.from('customers').select('id,name,phone').eq('tenant_id', tenant.id).order('name'),
    ]);
    setOrders(oRes.data||[]);
    setInventory(invRes.data||[]);
    setCustomers(custRes.data||[]);
    setLoading(false);
  }

  function genNo() { return `B2B/${new Date().getFullYear()}/${String(Date.now()).slice(-5)}`; }

  function addItem(inv) {
    setItems(prev=>[...prev, { id:inv.id, name:inv.name, code:inv.code||'', qty:1, rate:inv.sp||0, gst:inv.gst||0, amount:inv.sp||0 }]);
    setInvSearch('');
  }

  function updateItem(idx, field, val) {
    setItems(prev=>prev.map((it,i)=>{ if(i!==idx) return it; const u={...it,[field]:parseFloat(val)||0}; u.amount=u.rate*u.qty; return u; }));
  }

  const subtotal    = items.reduce((s,i)=>s+(i.amount||0),0);
  const discPct     = parseFloat(form.discount_pct)||0;
  const discAmt     = subtotal * discPct / 100;
  const afterDisc   = subtotal - discAmt;
  const gstAmt      = items.reduce((s,i)=>s+((i.amount-(i.amount*discPct/100))*i.gst/(100+i.gst)),0);
  const total       = afterDisc;
  const advance     = parseFloat(form.advance_paid)||0;
  const balance     = total - advance;

  async function saveOrder(e) {
    e.preventDefault(); setSaving(true);
    await supabase.from('b2b_orders').insert({
      ...form, tenant_id:tenant.id, order_no:genNo(), items,
      subtotal, discount_pct:discPct, discount_amt:discAmt,
      gst_amount:gstAmt, total, advance_paid:advance, balance_due:balance,
      status:'draft', payment_status: advance>=total?'paid':advance>0?'partial':'pending',
    });
    setShowForm(false); setItems([]); setForm({ customer:'', customer_id:'', customer_phone:'', customer_gstin:'', discount_pct:'0', advance_paid:'0', delivery_date:'', notes:'' });
    setSaving(false); await load();
  }

  async function updateStatus(id, status) {
    await supabase.from('b2b_orders').update({ status }).eq('id', id);
    setOrders(prev=>prev.map(o=>o.id===id?{...o,status}:o));
    if (selOrder?.id===id) setSelOrder(prev=>({...prev,status}));
  }

  function sendOrderConfirm(order) {
    const msg = `📦 *Order Confirmation — ${tenant?.name||'7SQ'}*\n\n*Order No: ${order.order_no}*\nDate: ${order.created_at?.slice(0,10)}\n\nDear ${order.customer},\n\nYour wholesale order has been ${order.status}.\n\n*Items:*\n${(order.items||[]).map(i=>`• ${i.name} × ${i.qty} @ ${fmt(i.rate)} = ${fmt(i.amount)}`).join('\n')}\n\n━━━━━━━━━━━━━\nSubtotal: ${fmt(order.subtotal)}\nDiscount: ${order.discount_pct}% (${fmt(order.discount_amt)})\nGST: ${fmt(order.gst_amount)}\n*Total: ${fmt(order.total)}*\nAdvance: ${fmt(order.advance_paid)}\n*Balance Due: ${fmt(order.balance_due)}*\n\nDelivery: ${order.delivery_date||'TBD'}\n\nThank you for your business! 🙏`;
    const ph = (order.customer_phone||'').replace(/\D/g,'').replace(/^0/,'91');
    window.open(`https://wa.me/${ph||''}?text=${encodeURIComponent(msg)}`, '_blank');
  }

  const displayed = filter==='all'?orders:orders.filter(o=>o.status===filter);
  const filteredInv = inventory.filter(i=>invSearch&&i.name.toLowerCase().includes(invSearch.toLowerCase())&&!items.find(x=>x.id===i.id));
  const totalRevenue = orders.filter(o=>o.status==='delivered').reduce((s,o)=>s+(o.total||0),0);
  const totalPending = orders.filter(o=>['confirmed','processing'].includes(o.status)).reduce((s,o)=>s+(o.balance_due||0),0);

  return (
    <div style={{ padding:24, background:T.bg, minHeight:'100%' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:24 }}>
        <div>
          <div style={{ fontSize:22, fontWeight:800, color:T.darkRed, letterSpacing:'-0.02em' }}>🏢 B2B / Wholesale Orders</div>
          <div style={{ fontSize:13, color:T.sub, marginTop:2 }}>Bulk orders for business customers with custom pricing</div>
        </div>
        <button onClick={()=>setShowForm(true)} style={btn(T.red, T.white)}>+ New B2B Order</button>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:14, marginBottom:20 }}>
        {[['Total Orders',orders.length,T.blue,'📦'],['Active Orders',orders.filter(o=>['confirmed','processing'].includes(o.status)).length,T.purple,'⚙️'],['Pending Collection',fmt(totalPending),T.amber,'💰'],['Delivered Revenue',fmt(totalRevenue),T.green,'✅']].map(([label,val,color,icon])=>(
          <div key={label} style={{ background:T.white, border:`1px solid ${T.bdr}`, borderRadius:12, padding:'16px 18px', boxShadow:'0 1px 4px rgba(0,0,0,.05)' }}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:6 }}>
              <div style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.05em' }}>{label}</div>
              <span style={{ fontSize:18 }}>{icon}</span>
            </div>
            <div style={{ fontSize:22, fontWeight:900, color, letterSpacing:'-0.02em' }}>{val}</div>
          </div>
        ))}
      </div>

      <div style={{ display:'flex', gap:6, marginBottom:16, flexWrap:'wrap' }}>
        {['all','draft','confirmed','processing','dispatched','delivered','cancelled'].map(f=>(
          <button key={f} onClick={()=>setFilter(f)} style={{ padding:'6px 14px', background:filter===f?T.red:T.white, color:filter===f?T.white:T.sub, border:`1px solid ${filter===f?T.red:T.bdr}`, borderRadius:20, fontSize:11, fontWeight:600, cursor:'pointer', fontFamily:'inherit', textTransform:'capitalize' }}>
            {f==='all'?'All':STATUS_CFG[f]?.label} ({f==='all'?orders.length:orders.filter(o=>o.status===f).length})
          </button>
        ))}
      </div>

      <div style={{ display:'grid', gridTemplateColumns:selOrder?'1fr 1fr':'1fr', gap:16 }}>
        {/* Orders list */}
        <div style={{ background:T.white, border:`1px solid ${T.bdr}`, borderRadius:14, overflow:'hidden', boxShadow:'0 1px 4px rgba(0,0,0,.05)' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
            <thead><tr style={{ background:T.lightRed }}>
              {['Order No','Customer','Items','Total','Balance','Delivery','Status'].map(h=>(
                <th key={h} style={{ padding:'11px 14px', textAlign:'left', fontSize:10, color:T.darkRed, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.05em', borderBottom:`1px solid ${T.bdr}` }}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {loading?<tr><td colSpan={7} style={{ textAlign:'center', padding:50, color:T.muted }}>Loading…</td></tr>
              :displayed.length===0?<tr><td colSpan={7} style={{ textAlign:'center', padding:50 }}><div style={{ fontSize:36, marginBottom:8 }}>🏢</div><div style={{ color:T.muted, fontWeight:600 }}>No B2B orders yet</div></td></tr>
              :displayed.map(o=>{
                const s = STATUS_CFG[o.status]||STATUS_CFG.draft;
                return (
                  <tr key={o.id} onClick={()=>setSelOrder(selOrder?.id===o.id?null:o)} style={{ borderBottom:`1px solid ${T.bdr}33`, cursor:'pointer', background:selOrder?.id===o.id?'#FEF2F2':'transparent' }}>
                    <td style={{ padding:'11px 14px', fontFamily:'monospace', fontWeight:700, color:T.blue, fontSize:12 }}>{o.order_no}</td>
                    <td style={{ padding:'11px 14px', color:T.ink, fontWeight:600 }}>{o.customer}</td>
                    <td style={{ padding:'11px 14px', color:T.sub }}>{(o.items||[]).length} items</td>
                    <td style={{ padding:'11px 14px', color:T.red, fontWeight:700 }}>{fmt(o.total)}</td>
                    <td style={{ padding:'11px 14px', color:o.balance_due>0?T.amber:T.green, fontWeight:600 }}>{fmt(o.balance_due)}</td>
                    <td style={{ padding:'11px 14px', color:T.muted, fontSize:11 }}>{o.delivery_date||'—'}</td>
                    <td style={{ padding:'11px 14px' }}><span style={{ background:s.bg, color:s.color, border:`1px solid ${s.border}`, borderRadius:6, padding:'2px 9px', fontSize:10, fontWeight:700 }}>{s.label}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Order detail */}
        {selOrder&&(
          <div style={{ background:T.white, border:`1px solid ${T.bdr}`, borderRadius:14, overflow:'hidden', boxShadow:'0 1px 4px rgba(0,0,0,.05)' }}>
            <div style={{ padding:'14px 18px', background:T.lightRed, borderBottom:`1px solid ${T.bdr}`, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <div>
                <div style={{ fontWeight:800, color:T.darkRed }}>{selOrder.order_no}</div>
                <div style={{ fontSize:11, color:T.sub, marginTop:2 }}>{selOrder.customer} · {selOrder.customer_phone}</div>
              </div>
              <button onClick={()=>setSelOrder(null)} style={{ background:'none', border:'none', fontSize:18, cursor:'pointer', color:T.muted }}>×</button>
            </div>
            <div style={{ padding:'14px 18px', maxHeight:420, overflowY:'auto' }}>
              {(selOrder.items||[]).map((item,i)=>(
                <div key={i} style={{ display:'flex', justifyContent:'space-between', padding:'8px 0', borderBottom:`1px solid ${T.bdr}22`, fontSize:13 }}>
                  <div><div style={{ fontWeight:600, color:T.ink }}>{item.name}</div><div style={{ fontSize:11, color:T.muted }}>Qty: {item.qty} × {fmt(item.rate)}</div></div>
                  <div style={{ fontWeight:700, color:T.red }}>{fmt(item.amount)}</div>
                </div>
              ))}
              <div style={{ background:T.bg, borderRadius:9, padding:'12px 14px', marginTop:12 }}>
                {[['Subtotal',fmt(selOrder.subtotal),T.ink],['Discount',`${selOrder.discount_pct}% — ${fmt(selOrder.discount_amt)}`,T.amber],['GST',fmt(selOrder.gst_amount),T.sub],['Total',fmt(selOrder.total),T.red],['Advance Paid',fmt(selOrder.advance_paid),T.green],['Balance Due',fmt(selOrder.balance_due),selOrder.balance_due>0?T.amber:T.green]].map(([label,val,color])=>(
                  <div key={label} style={{ display:'flex', justifyContent:'space-between', padding:'4px 0', fontSize:12 }}>
                    <span style={{ color:T.sub }}>{label}</span>
                    <span style={{ color, fontWeight:label==='Total'||label==='Balance Due'?800:500 }}>{val}</span>
                  </div>
                ))}
              </div>
              <div style={{ display:'flex', gap:8, marginTop:14, flexWrap:'wrap' }}>
                {Object.entries(STATUS_CFG).filter(([k])=>k!==selOrder.status&&k!=='cancelled').map(([k,v])=>(
                  <button key={k} onClick={()=>updateStatus(selOrder.id,k)} style={{ background:v.bg, color:v.color, border:`1px solid ${v.border}`, borderRadius:7, padding:'5px 10px', fontSize:10, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>→ {v.label}</button>
                ))}
                {selOrder.customer_phone&&<button onClick={()=>sendOrderConfirm(selOrder)} style={{ background:'#DCFCE7', color:T.green, border:'none', borderRadius:7, padding:'5px 12px', fontSize:10, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>💬 WhatsApp</button>}
              </div>
            </div>
          </div>
        )}
      </div>

      {showForm&&(
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.5)', zIndex:200, display:'flex', alignItems:'flex-start', justifyContent:'center', padding:20, overflowY:'auto' }}>
          <div style={{ background:T.white, borderRadius:16, padding:28, width:'100%', maxWidth:640, margin:'20px 0', boxShadow:'0 20px 60px rgba(0,0,0,.2)' }}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:20 }}>
              <div style={{ fontSize:17, fontWeight:800, color:T.darkRed }}>New B2B Order</div>
              <button onClick={()=>setShowForm(false)} style={{ background:'none', border:'none', fontSize:22, cursor:'pointer', color:T.muted }}>×</button>
            </div>
            <form onSubmit={saveOrder}>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:16 }}>
                <div style={{ gridColumn:'1/-1' }}>
                  <label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:5 }}>Customer *</label>
                  <select onChange={e=>{const c=customers.find(x=>x.id===e.target.value);if(c)setForm(f=>({...f,customer_id:c.id,customer:c.name,customer_phone:c.phone||''}));}} style={{ ...inp, cursor:'pointer', marginBottom:6 }}>
                    <option value="">Select customer…</option>
                    {customers.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                  <input value={form.customer} onChange={e=>setForm(f=>({...f,customer:e.target.value}))} placeholder="Or type customer name" required style={inp}/>
                </div>
                {[['Phone','tel','customer_phone'],['GSTIN','text','customer_gstin'],['Discount %','number','discount_pct'],['Advance Paid (Rs.)','number','advance_paid'],['Delivery Date','date','delivery_date']].map(([label,type,key])=>(
                  <div key={key}><label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:4 }}>{label}</label><input type={type} value={form[key]} onChange={e=>setForm(f=>({...f,[key]:e.target.value}))} style={inp}/></div>
                ))}
              </div>

              <div style={{ marginBottom:12, position:'relative' }}>
                <label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:5 }}>Add Products *</label>
                <input value={invSearch} onChange={e=>setInvSearch(e.target.value)} placeholder="Search products…" style={inp}/>
                {filteredInv.length>0&&invSearch&&<div style={{ position:'absolute', top:'100%', left:0, right:0, background:T.white, border:`1px solid ${T.bdr}`, borderRadius:8, zIndex:10, maxHeight:160, overflowY:'auto', marginTop:4, boxShadow:'0 4px 16px rgba(0,0,0,.1)' }}>
                  {filteredInv.slice(0,6).map(i=><div key={i.id} onClick={()=>addItem(i)} style={{ padding:'9px 14px', cursor:'pointer', borderBottom:`1px solid ${T.bdr}22`, display:'flex', justifyContent:'space-between', fontSize:13 }}><span style={{ color:T.ink }}>{i.name}</span><span style={{ color:T.red, fontWeight:600 }}>{fmt(i.sp)}</span></div>)}
                </div>}
              </div>

              {items.length>0&&<div style={{ background:T.bg, borderRadius:10, overflow:'hidden', marginBottom:14 }}>
                <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
                  <thead><tr style={{ background:T.lightRed }}>{['Product','Qty','Rate (Rs.)','GST %','Amount',''].map(h=><th key={h} style={{ padding:'7px 10px', textAlign:'left', fontSize:9, color:T.darkRed, fontWeight:700, textTransform:'uppercase' }}>{h}</th>)}</tr></thead>
                  <tbody>{items.map((it,i)=>(
                    <tr key={i} style={{ borderBottom:`1px solid ${T.bdr}22` }}>
                      <td style={{ padding:'7px 10px', color:T.ink }}>{it.name}</td>
                      {['qty','rate','gst'].map(f=><td key={f} style={{ padding:'5px 6px' }}>
                        <input type="number" value={it[f]||0} onChange={e=>updateItem(i,f,e.target.value)} style={{ width:70, background:T.white, border:`1px solid ${T.bdr}`, borderRadius:6, padding:'5px 7px', color:T.ink, fontSize:12, fontFamily:'inherit', outline:'none', textAlign:'center' }}/>
                      </td>)}
                      <td style={{ padding:'7px 10px', color:T.red, fontWeight:700 }}>{fmt(it.amount)}</td>
                      <td style={{ padding:'5px 6px' }}><button type="button" onClick={()=>setItems(prev=>prev.filter((_,j)=>j!==i))} style={{ background:'#FEF2F2', color:T.red, border:'none', borderRadius:5, padding:'3px 8px', cursor:'pointer', fontFamily:'inherit', fontSize:11 }}>×</button></td>
                    </tr>
                  ))}</tbody>
                </table>
                <div style={{ padding:'10px 14px', background:T.lightRed, display:'flex', justifyContent:'flex-end', gap:16, fontSize:12 }}>
                  {discPct>0&&<span style={{ color:T.amber }}>Discount: -{fmt(discAmt)}</span>}
                  <span style={{ color:T.sub }}>GST: {fmt(gstAmt)}</span>
                  <span style={{ color:T.red, fontWeight:800, fontSize:14 }}>Total: {fmt(total)}</span>
                  <span style={{ color:T.amber }}>Balance: {fmt(balance)}</span>
                </div>
              </div>}

              <div style={{ marginBottom:14 }}><label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:4 }}>Notes</label><textarea value={form.notes} onChange={e=>setForm(f=>({...f,notes:e.target.value}))} rows={2} style={{ ...inp, resize:'vertical' }}/></div>
              <div style={{ display:'flex', gap:10 }}>
                <button type="button" onClick={()=>setShowForm(false)} style={{ flex:1, background:T.bg, color:T.sub, border:`1px solid ${T.bdr}`, borderRadius:9, padding:'12px', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>Cancel</button>
                <button type="submit" disabled={saving||!items.length} style={{ flex:2, ...btn(T.red, T.white), padding:'12px', fontSize:13 }}>{saving?'Creating…':'🏢 Create B2B Order'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
