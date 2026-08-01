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

// ── Public storefront (no login needed) ───────────────────────
export default function OnlineStore({ tenant }) {
  const [items,   setItems]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [cart,    setCart]    = useState([]);
  const [search,  setSearch]  = useState('');
  const [cat,     setCat]     = useState('All');
  const [order,   setOrder]   = useState(null);
  const [form,    setForm]    = useState({ name:'', phone:'', address:'' });
  const [step,    setStep]    = useState('shop'); // shop | checkout | confirmed
  const [saving,  setSaving]  = useState(false);

  useEffect(() => {
    if (!tenant?.id) return;
    supabase.from('inventory').select('*').eq('tenant_id', tenant.id).eq('active', true).gt('stock', 0).order('name')
      .then(({ data }) => { setItems(data||[]); setLoading(false); });
  }, [tenant?.id]);

  const categories = ['All', ...new Set(items.map(i => i.cat).filter(Boolean))];
  const filtered   = items.filter(i =>
    (cat==='All' || i.cat===cat) &&
    (!search || i.name.toLowerCase().includes(search.toLowerCase()))
  );

  const cartTotal = cart.reduce((s, c) => s + c.qty * c.sp, 0);
  const cartCount = cart.reduce((s, c) => s + c.qty, 0);

  function addToCart(item) {
    setCart(c => {
      const ex = c.find(x => x.id===item.id);
      if (ex) return c.map(x => x.id===item.id ? { ...x, qty:x.qty+1 } : x);
      return [...c, { ...item, qty:1 }];
    });
  }

  function removeFromCart(id) { setCart(c => c.filter(x => x.id!==id)); }
  function updateQty(id, qty) { if(qty<1) removeFromCart(id); else setCart(c=>c.map(x=>x.id===id?{...x,qty}:x)); }

  async function placeOrder(e) {
    e.preventDefault();
    if (!form.name || !form.phone) return;
    setSaving(true);
    try {
      const invNum = `WEB/${new Date().toISOString().slice(0,10).replace(/-/g,'')}/${String(Date.now()).slice(-4)}`;
      const { data } = await supabase.from('sales').insert({
        tenant_id: tenant.id,
        inv_num: invNum,
        date: new Date().toISOString().slice(0,10),
        customer: form.name,
        items: cart.map(i => ({ name:i.name, qty:i.qty, rate:i.sp, gst:i.gst||18, amount:i.qty*i.sp })),
        subtotal: cartTotal,
        gst_amount: cart.reduce((s,i) => s + i.qty*i.sp*(i.gst||18)/(100+(i.gst||18)), 0),
        total: cartTotal,
        paid: 0,
        status: 'pending',
        payment_mode: 'online',
        notes: `Online Order | ${form.address}`,
      }).select().single();
      setOrder({ ...data, customerName: form.name, customerPhone: form.phone });
      setStep('confirmed');
      setCart([]);
    } catch (e) { alert('Order failed: ' + e.message); }
    finally { setSaving(false); }
  }

  const fmt = n => 'Rs.' + (n||0).toLocaleString('en-IN', { maximumFractionDigits:0 });

  // Confirmed screen
  if (step==='confirmed' && order) return (
    <div style={{ minHeight:'100vh', background:T.bg, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
      <div style={{ background:T.srf, borderRadius:16, padding:36, maxWidth:400, width:'100%', textAlign:'center' }}>
        <div style={{ fontSize:52, marginBottom:16 }}>🎉</div>
        <div style={{ fontSize:22, fontWeight:800, color:T.ink, marginBottom:8 }}>Order Placed!</div>
        <div style={{ fontSize:14, color:T.sub, marginBottom:16, lineHeight:1.7 }}>
          Thank you <strong style={{ color:T.ink }}>{order.customerName}</strong>!<br/>
          Order <strong style={{ color:T.blue }}>{order.inv_num}</strong> received.<br/>
          We'll contact you on <strong style={{ color:T.ink }}>{form.phone}</strong> shortly.
        </div>
        {tenant?.upi_id && (
          <a href={`upi://pay?pa=${tenant.upi_id}&pn=${encodeURIComponent(tenant.name)}&am=${order.total}&cu=INR&tn=${order.inv_num}`}
            style={{ display:'block', background:T.green, color:'#fff', borderRadius:9, padding:'12px', fontSize:14, fontWeight:700, textDecoration:'none', marginBottom:10 }}>
            💳 Pay Now via UPI
          </a>
        )}
        <button onClick={() => setStep('shop')} style={{ background:T.blue, color:'#fff', border:'none', borderRadius:9, padding:'12px 24px', fontSize:14, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>
          Continue Shopping
        </button>
      </div>
    </div>
  );

  // Checkout screen
  if (step==='checkout') return (
    <div style={{ minHeight:'100vh', background:T.bg, padding:20 }}>
      <div style={{ maxWidth:500, margin:'0 auto' }}>
        <button onClick={() => setStep('shop')} style={{ background:T.srf, color:T.sub, border:`1px solid ${T.bdr}`, borderRadius:8, padding:'8px 16px', fontSize:13, cursor:'pointer', fontFamily:'inherit', marginBottom:20 }}>← Back to Shop</button>
        <div style={{ fontSize:22, fontWeight:800, color:T.ink, marginBottom:20 }}>Checkout</div>
        <div style={{ background:T.srf, borderRadius:12, padding:20, marginBottom:16 }}>
          {cart.map(item => (
            <div key={item.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'10px 0', borderBottom:`1px solid ${T.bdr}` }}>
              <div>
                <div style={{ fontSize:14, color:T.ink }}>{item.name}</div>
                <div style={{ display:'flex', alignItems:'center', gap:8, marginTop:4 }}>
                  <button onClick={() => updateQty(item.id, item.qty-1)} style={{ background:T.bdr, border:'none', color:T.ink, borderRadius:5, width:24, height:24, cursor:'pointer', fontSize:14 }}>−</button>
                  <span style={{ fontSize:13, color:T.ink }}>{item.qty}</span>
                  <button onClick={() => updateQty(item.id, item.qty+1)} style={{ background:T.blue, border:'none', color:'#fff', borderRadius:5, width:24, height:24, cursor:'pointer', fontSize:14 }}>+</button>
                </div>
              </div>
              <div style={{ textAlign:'right' }}>
                <div style={{ fontSize:14, fontWeight:700, color:T.green }}>{fmt(item.qty*item.sp)}</div>
                <button onClick={() => removeFromCart(item.id)} style={{ background:'none', border:'none', color:T.red, cursor:'pointer', fontSize:11 }}>Remove</button>
              </div>
            </div>
          ))}
          <div style={{ display:'flex', justifyContent:'space-between', fontSize:18, fontWeight:800, color:T.ink, paddingTop:14 }}>
            <span>Total</span><span style={{ color:T.green }}>{fmt(cartTotal)}</span>
          </div>
        </div>
        <form onSubmit={placeOrder} style={{ background:T.srf, borderRadius:12, padding:20 }}>
          <div style={{ fontSize:15, fontWeight:700, color:T.ink, marginBottom:14 }}>Your Details</div>
          {[['name','Your Name *','text'],['phone','Phone Number *','tel'],['address','Delivery Address','text']].map(([key,label,type]) => (
            <div key={key} style={{ marginBottom:12 }}>
              <label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:5 }}>{label}</label>
              <input type={type} value={form[key]} onChange={e=>setForm(f=>({...f,[key]:e.target.value}))} required={key!=='address'}
                style={{ background:T.bg, border:`1px solid ${T.bdr}`, borderRadius:8, padding:'11px 14px', color:T.ink, fontSize:14, fontFamily:'inherit', outline:'none', width:'100%', boxSizing:'border-box' }} />
            </div>
          ))}
          <button type="submit" disabled={saving||!cart.length} style={{ background:T.green, color:'#fff', border:'none', borderRadius:9, padding:'13px', fontSize:15, fontWeight:700, cursor:'pointer', fontFamily:'inherit', width:'100%', marginTop:8 }}>
            {saving ? 'Placing Order…' : `Place Order — ${fmt(cartTotal)}`}
          </button>
        </form>
      </div>
    </div>
  );

  return (
    <div style={{ minHeight:'100vh', background:T.bg }}>
      {/* Header */}
      <div style={{ background:T.srf, borderBottom:`1px solid ${T.bdr}`, padding:'14px 20px', display:'flex', justifyContent:'space-between', alignItems:'center', position:'sticky', top:0, zIndex:10 }}>
        <div>
          <div style={{ fontSize:20, fontWeight:800, color:T.ink }}>{tenant?.name || 'Elite Store'}</div>
          <div style={{ fontSize:11, color:T.sub }}>Online Store</div>
        </div>
        {cartCount > 0 && (
          <button onClick={() => setStep('checkout')} style={{ background:T.blue, color:'#fff', border:'none', borderRadius:9, padding:'10px 18px', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit', display:'flex', alignItems:'center', gap:8 }}>
            🛒 {cartCount} items — {fmt(cartTotal)}
          </button>
        )}
      </div>

      <div style={{ maxWidth:960, margin:'0 auto', padding:20 }}>
        {/* Search + categories */}
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="🔍 Search products…"
          style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:10, padding:'12px 16px', color:T.ink, fontSize:14, fontFamily:'inherit', outline:'none', width:'100%', marginBottom:14, boxSizing:'border-box' }} />
        <div style={{ display:'flex', gap:8, marginBottom:20, flexWrap:'wrap' }}>
          {categories.map(c => (
            <button key={c} onClick={() => setCat(c)} style={{ background:cat===c?T.blue:T.srf, color:cat===c?'#fff':T.sub, border:`1px solid ${cat===c?T.blue:T.bdr}`, borderRadius:20, padding:'6px 16px', fontSize:13, cursor:'pointer', fontFamily:'inherit' }}>{c}</button>
          ))}
        </div>

        {loading ? <div style={{ textAlign:'center', color:T.sub, padding:80 }}>Loading products…</div>
        : (
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))', gap:16 }}>
            {filtered.map(item => {
              const inCart = cart.find(c=>c.id===item.id);
              return (
                <div key={item.id} style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:12, overflow:'hidden', transition:'transform .15s' }}
                  onMouseEnter={e=>e.currentTarget.style.transform='translateY(-2px)'}
                  onMouseLeave={e=>e.currentTarget.style.transform='translateY(0)'}>
                  {/* Product image placeholder */}
                  <div style={{ height:140, background:`linear-gradient(135deg,${T.blue}22,${T.bdr})`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:36 }}>
                    {item.cat==='Footwear'?'👟':item.cat==='Bags'?'👜':item.cat==='Clothing'?'👕':'🛍️'}
                  </div>
                  <div style={{ padding:'12px 14px' }}>
                    <div style={{ fontSize:14, fontWeight:700, color:T.ink, marginBottom:4 }}>{item.name}</div>
                    {item.cat && <div style={{ fontSize:11, color:T.muted, marginBottom:8 }}>{item.cat}</div>}
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                      <div style={{ fontSize:18, fontWeight:800, color:T.green }}>{fmt(item.sp)}</div>
                      <div style={{ fontSize:11, color:T.muted }}>{item.gst||18}% GST</div>
                    </div>
                    <div style={{ fontSize:11, color:T.muted, marginBottom:10 }}>{item.stock} in stock</div>
                    {inCart ? (
                      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                        <button onClick={()=>updateQty(item.id,inCart.qty-1)} style={{ background:T.bdr, border:'none', color:T.ink, borderRadius:5, width:30, height:30, cursor:'pointer', fontSize:16 }}>−</button>
                        <span style={{ flex:1, textAlign:'center', fontSize:14, fontWeight:700, color:T.ink }}>{inCart.qty}</span>
                        <button onClick={()=>updateQty(item.id,inCart.qty+1)} style={{ background:T.blue, border:'none', color:'#fff', borderRadius:5, width:30, height:30, cursor:'pointer', fontSize:16 }}>+</button>
                      </div>
                    ) : (
                      <button onClick={()=>addToCart(item)} style={{ background:T.blue, color:'#fff', border:'none', borderRadius:8, padding:'9px', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit', width:'100%' }}>
                        Add to Cart
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
            {!filtered.length && <div style={{ gridColumn:'1/-1', textAlign:'center', color:T.muted, padding:60, fontSize:14 }}>No products found</div>}
          </div>
        )}
      </div>
    </div>
  );
}
