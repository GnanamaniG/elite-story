import { useState, useEffect, useCallback } from 'react';
import { getInventory, getCustomers, saveSale, updateStock, updateOutstanding } from '../lib/supabase';
import { generateInvoicePDF, shareInvoiceWhatsApp } from '../lib/pdf';

const T = { bg:'#060710', srf:'#0f1220', card:'#141828', bdr:'#1e2540', blue:'#4f7cff', ink:'#eef0f8', sub:'#6b7598', muted:'#4a5175', green:'#00d68f', amber:'#ffb547', red:'#ff4d6a', teal:'#00c9b1' };
const fmt = n => '₹' + (n||0).toLocaleString('en-IN', { minimumFractionDigits:2, maximumFractionDigits:2 });
const p2  = n => Math.round((n||0) * 100) / 100;

export default function POS({ tenant, user }) {
  const [items,     setItems]     = useState([]);
  const [customers, setCustomers] = useState([]);
  const [cart,      setCart]      = useState([]);
  const [search,    setSearch]    = useState('');
  const [cust,      setCust]      = useState(null);
  const [custSearch,setCustSearch]= useState('');
  const [payMode,   setPayMode]   = useState('cash');
  const [disc,      setDisc]      = useState(0);
  const [loading,   setLoading]   = useState(true);
  const [receipt,   setReceipt]   = useState(null);
  const [saving,    setSaving]    = useState(false);
  const [pdfLoading,setPdfLoading]= useState(false);

  useEffect(() => {
    if (!tenant?.id) return;
    Promise.all([getInventory(tenant.id), getCustomers(tenant.id)])
      .then(([inv, custs]) => { setItems(inv); setCustomers(custs); })
      .finally(() => setLoading(false));
  }, [tenant?.id]);

  const addToCart = useCallback((item) => {
    setCart(c => {
      const ex = c.find(x => x.id === item.id);
      if (ex) return c.map(x => x.id === item.id ? { ...x, qty: x.qty + 1 } : x);
      return [...c, { ...item, qty: 1, rate: item.sp || 0 }];
    });
  }, []);

  const updateQty  = (id, qty) => { if (qty <= 0) setCart(c => c.filter(x => x.id !== id)); else setCart(c => c.map(x => x.id === id ? { ...x, qty } : x)); };
  const updateRate = (id, rate) => setCart(c => c.map(x => x.id === id ? { ...x, rate: parseFloat(rate)||0 } : x));
  const clearCart  = () => { setCart([]); setCust(null); setDisc(0); setSearch(''); setCustSearch(''); };

  const totals = (() => {
    const lines = cart.map(item => {
      const sub    = p2(item.qty * item.rate);
      const gstPct = item.gst || 18;
      const gstAmt = p2(sub * gstPct / (100 + gstPct));
      return { ...item, sub, gstAmt };
    });
    const subtotal   = p2(lines.reduce((s, l) => s + l.sub, 0));
    const tax        = p2(lines.reduce((s, l) => s + l.gstAmt, 0));
    const discAmt    = p2(subtotal * (disc / 100));
    const grandTotal = p2(subtotal - discAmt);
    const roundOff   = p2(Math.round(grandTotal) - grandTotal);
    return { lines, subtotal, tax, discAmt, grandTotal: grandTotal + roundOff, roundOff };
  })();

  async function handleCheckout() {
    if (!cart.length) return;
    setSaving(true);
    try {
      const ts     = Date.now();
      const invNum = `${tenant?.invoice_prefix || 'INV'}/${tenant?.financial_year || '2024-25'}/${String(ts).slice(-4)}`;
      const sale   = {
        tenant_id:    tenant.id,
        inv_num:      invNum,
        date:         new Date().toISOString().slice(0, 10),
        customer:     cust?.name || 'Walk-in',
        customer_id:  cust?.id || null,
        customer_gstin: cust?.gstin || null,
        items:        totals.lines.map(l => ({ name:l.name, qty:l.qty, rate:l.rate, gst:l.gst||18, hsn:l.hsn||'', amount:l.sub })),
        subtotal:     totals.subtotal,
        gst_amount:   totals.tax,
        discount:     totals.discAmt,
        total:        totals.grandTotal,
        paid:         totals.grandTotal,
        status:       'paid',
        payment_mode: payMode,
      };

      const saved = await saveSale(sale);

      for (const line of totals.lines) {
        const item = items.find(i => i.id === line.id);
        if (item) await updateStock(line.id, Math.max(0, (item.stock||0) - line.qty));
      }
      if (cust?.id && payMode === 'credit') await updateOutstanding(cust.id, totals.grandTotal);

      setItems(prev => prev.map(i => {
        const line = totals.lines.find(l => l.id === i.id);
        return line ? { ...i, stock: Math.max(0, (i.stock||0) - line.qty) } : i;
      }));
      setReceipt({ ...saved, lines: totals.lines });
      clearCart();
    } catch (e) { alert('Error: ' + e.message); }
    finally { setSaving(false); }
  }

  const filtered  = items.filter(i => !search || i.name.toLowerCase().includes(search.toLowerCase()) || (i.code||'').toLowerCase().includes(search.toLowerCase()));
  const filtCust  = customers.filter(c => !custSearch || c.name.toLowerCase().includes(custSearch.toLowerCase()) || (c.phone||'').includes(custSearch));
  const inp       = { background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:8, padding:'9px 12px', color:T.ink, fontSize:13, fontFamily:'inherit', outline:'none', width:'100%' };
  const btn       = (bg, col='#fff') => ({ background:bg, color:col, border:'none', borderRadius:8, padding:'10px 16px', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit' });

  // ── Receipt ──────────────────────────────────────────────────
  if (receipt) return (
    <div style={{ padding:24, maxWidth:460, margin:'0 auto' }}>
      <div style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:14, padding:28 }}>
        <div style={{ textAlign:'center', marginBottom:20 }}>
          <div style={{ fontSize:40, marginBottom:8 }}>✅</div>
          <div style={{ fontSize:20, fontWeight:800, color:T.ink }}>Sale Complete!</div>
          <div style={{ fontSize:13, color:T.sub, marginTop:2 }}>{receipt.inv_num}</div>
        </div>

        <div style={{ background:T.card, borderRadius:10, padding:16, marginBottom:16 }}>
          <div style={{ display:'flex', justifyContent:'space-between', fontSize:13, color:T.sub, marginBottom:10, paddingBottom:8, borderBottom:`1px solid ${T.bdr}` }}>
            <span>Customer</span><span style={{ color:T.ink, fontWeight:600 }}>{receipt.customer}</span>
          </div>
          {receipt.lines.map((l, i) => (
            <div key={i} style={{ display:'flex', justifyContent:'space-between', fontSize:12.5, color:T.sub, marginBottom:5 }}>
              <span>{l.name} × {l.qty}</span><span style={{ color:T.ink }}>{fmt(l.sub)}</span>
            </div>
          ))}
          <div style={{ borderTop:`1px solid ${T.bdr}`, marginTop:10, paddingTop:10 }}>
            <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, color:T.sub, marginBottom:5 }}>
              <span>GST</span><span>{fmt(receipt.gst_amount)}</span>
            </div>
            <div style={{ display:'flex', justifyContent:'space-between', fontSize:20, fontWeight:800, color:T.green, marginTop:6 }}>
              <span>Total</span><span>{fmt(receipt.total)}</span>
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:10 }}>
          <button
            onClick={async () => { setPdfLoading(true); await generateInvoicePDF(receipt, tenant).catch(e => alert('PDF error: '+e.message)); setPdfLoading(false); }}
            style={btn(T.srf, T.ink)}>
            {pdfLoading ? '⏳ Generating…' : '📄 Download PDF'}
          </button>
          <button
            onClick={() => shareInvoiceWhatsApp(receipt, tenant)}
            style={btn('#25d366')}>
            💬 WhatsApp
          </button>
        </div>
        <button onClick={() => setReceipt(null)} style={{ ...btn(T.blue), width:'100%', fontSize:15 }}>
          New Sale
        </button>
      </div>
    </div>
  );

  if (loading) return <div style={{ padding:40, textAlign:'center', color:T.sub }}>Loading inventory…</div>;

  return (
    <div style={{ display:'flex', height:'calc(100vh - 50px)' }}>

      {/* Items grid */}
      <div style={{ flex:1, display:'flex', flexDirection:'column', borderRight:`1px solid ${T.bdr}` }}>
        <div style={{ padding:'12px 14px', borderBottom:`1px solid ${T.bdr}` }}>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 Search items…" style={inp} />
        </div>
        <div style={{ flex:1, overflowY:'auto', padding:12, display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(145px,1fr))', gap:10, alignContent:'start' }}>
          {filtered.map(item => (
            <div key={item.id} onClick={() => addToCart(item)}
              style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:10, padding:12, cursor:'pointer' }}
              onMouseEnter={e => e.currentTarget.style.borderColor=T.blue}
              onMouseLeave={e => e.currentTarget.style.borderColor=T.bdr}>
              <div style={{ fontSize:13, fontWeight:600, color:T.ink, marginBottom:4 }}>{item.name}</div>
              <div style={{ fontSize:12, color:T.green, fontWeight:700 }}>{fmt(item.sp)}</div>
              <div style={{ fontSize:10, color:(item.stock||0)<=(item.alert||10)?T.amber:T.muted, marginTop:3 }}>Stock: {item.stock||0}</div>
            </div>
          ))}
          {!filtered.length && <div style={{ color:T.muted, fontSize:13, gridColumn:'1/-1', textAlign:'center', padding:40 }}>No items found</div>}
        </div>
      </div>

      {/* Cart */}
      <div style={{ width:340, display:'flex', flexDirection:'column', background:T.srf }}>
        {/* Customer */}
        <div style={{ padding:'10px 14px', borderBottom:`1px solid ${T.bdr}` }}>
          <input value={custSearch} onChange={e => setCustSearch(e.target.value)} placeholder="👤 Customer (Walk-in)" style={{ ...inp, fontSize:12 }} />
          {custSearch && filtCust.length > 0 && (
            <div style={{ background:T.card, border:`1px solid ${T.bdr}`, borderRadius:8, marginTop:4, maxHeight:120, overflowY:'auto' }}>
              {filtCust.slice(0,5).map(c => (
                <div key={c.id} onClick={() => { setCust(c); setCustSearch(c.name); }}
                  style={{ padding:'7px 12px', cursor:'pointer', fontSize:12, color:T.ink, borderBottom:`1px solid ${T.bdr}44` }}>
                  {c.name} {c.phone && <span style={{ color:T.sub }}>· {c.phone}</span>}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Cart items */}
        <div style={{ flex:1, overflowY:'auto', padding:'8px 14px' }}>
          {!cart.length && <div style={{ textAlign:'center', color:T.muted, padding:40, fontSize:13 }}>Cart is empty<br/>Click items to add</div>}
          {cart.map(item => (
            <div key={item.id} style={{ background:T.card, borderRadius:9, padding:'10px 12px', marginBottom:8 }}>
              <div style={{ display:'flex', justifyContent:'space-between', marginBottom:6 }}>
                <div style={{ fontSize:12, fontWeight:600, color:T.ink }}>{item.name}</div>
                <button onClick={() => updateQty(item.id, 0)} style={{ background:'none', border:'none', color:T.red, cursor:'pointer', fontSize:16 }}>×</button>
              </div>
              <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                <button onClick={() => updateQty(item.id, item.qty-1)} style={{ background:T.bdr, border:'none', color:T.ink, borderRadius:5, width:26, height:26, cursor:'pointer', fontSize:14 }}>−</button>
                <span style={{ fontSize:13, fontWeight:700, color:T.ink, minWidth:24, textAlign:'center' }}>{item.qty}</span>
                <button onClick={() => updateQty(item.id, item.qty+1)} style={{ background:T.blue, border:'none', color:'#fff', borderRadius:5, width:26, height:26, cursor:'pointer', fontSize:14 }}>+</button>
                <input type="number" value={item.rate} onChange={e => updateRate(item.id, e.target.value)}
                  style={{ ...inp, width:80, padding:'4px 8px', fontSize:12 }} />
                <span style={{ fontSize:12, fontWeight:700, color:T.green, marginLeft:'auto' }}>{fmt(item.qty*item.rate)}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Totals */}
        <div style={{ padding:'10px 14px', borderTop:`1px solid ${T.bdr}` }}>
          <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:10 }}>
            <span style={{ fontSize:12, color:T.sub }}>Disc %</span>
            <input type="number" value={disc} onChange={e => setDisc(Math.min(100, Math.max(0, parseFloat(e.target.value)||0)))}
              style={{ ...inp, width:70, padding:'5px 8px', fontSize:12 }} />
          </div>
          {[
            ['Subtotal', fmt(totals.subtotal)],
            ['GST', fmt(totals.tax)],
            disc > 0 ? [`Disc (${disc}%)`, '-'+fmt(totals.discAmt)] : null,
          ].filter(Boolean).map(([l, v]) => (
            <div key={l} style={{ display:'flex', justifyContent:'space-between', fontSize:12, color:T.sub, marginBottom:4 }}>
              <span>{l}</span><span>{v}</span>
            </div>
          ))}
          <div style={{ display:'flex', justifyContent:'space-between', fontSize:18, fontWeight:800, color:T.ink, borderTop:`1px solid ${T.bdr}`, paddingTop:8, marginTop:4, marginBottom:12 }}>
            <span>Total</span><span style={{ color:T.green }}>{fmt(totals.grandTotal)}</span>
          </div>
          <div style={{ display:'flex', gap:6, marginBottom:12 }}>
            {[['cash','💵 Cash'],['upi','📱 UPI'],['card','💳 Card'],['credit','📒 Credit']].map(([id,label]) => (
              <button key={id} onClick={() => setPayMode(id)} style={{
                flex:1, background:payMode===id?T.blue:T.card, color:payMode===id?'#fff':T.sub,
                border:`1px solid ${payMode===id?T.blue:T.bdr}`, borderRadius:7, padding:'6px 2px', fontSize:10, fontWeight:700, cursor:'pointer', fontFamily:'inherit'
              }}>{label}</button>
            ))}
          </div>
          <div style={{ display:'flex', gap:8 }}>
            <button onClick={clearCart} style={btn(T.card, T.sub)}>Clear</button>
            <button onClick={handleCheckout} disabled={!cart.length||saving} style={{ ...btn(cart.length?T.green:T.bdr, cart.length?'#fff':T.muted), flex:1, fontSize:15 }}>
              {saving ? 'Saving…' : `Checkout ${fmt(totals.grandTotal)}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
