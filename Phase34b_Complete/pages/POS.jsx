import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { cacheGet, cacheSet, queueAdd, OFFLINE_KEYS } from '../lib/offlineStore';
import POSSession from '../components/shell/POSSession';

const T = {
  bg:'#F7F3F3', srf:'#FFFFFF', card:'#FFFFFF', card2:'#FFF5F5',
  bdr:'#E8DEDE', bdr2:'#F0E8E8',
  red:'#C0392B', darkRed:'#8B0000', lightRed:'#FDECEA',
  green:'#16A34A', amber:'#D97706', blue:'#2563EB',
  purple:'#7C3AED', teal:'#0D9488', orange:'#EA580C',
  ink:'#111827', sub:'#6B7280', muted:'#9CA3AF',
  white:'#FFFFFF',
  sidebar:'#7B1E1E', sideHov:'#9B2C2C', sideTxt:'#FFCDD2', sideActTxt:'#7B1E1E'
};
const fmt = n => 'Rs.' + (n||0).toLocaleString('en-IN', { maximumFractionDigits:0 });

export default function POS({ tenant, activeBranch, user }) {
  const [inventory,   setInventory]   = useState([]);
  const [cart,        setCart]        = useState([]);
  const [customer,    setCustomer]    = useState(null);
  const [customers,   setCustomers]   = useState([]);
  const [search,      setSearch]      = useState('');
  const [custSearch,  setCustSearch]  = useState('');
  const [cat,         setCat]         = useState('all');
  const [showNewCust, setShowNewCust] = useState(false);
  const [newCust,     setNewCust]     = useState({ name:'', phone:'', email:'' });
  const [savingCust,  setSavingCust]  = useState(false);
  const [serialPick,  setSerialPick]  = useState(null);   // { line, options }
  const [pickedSerials, setPickedSerials] = useState({}); // { cartItemId: [serialRow,…] }
  const [payMode,     setPayMode]     = useState('cash');
  const [promoCode,   setPromoCode]   = useState('');
  const [promoResult, setPromoResult] = useState(null);
  const [promoCodes,  setPromoCodes]  = useState([]);
  const [discount,    setDiscount]    = useState(0);
  const [heldBills,   setHeldBills]   = useState([]);
  const [saving,      setSaving]      = useState(false);
  const [lastInv,     setLastInv]     = useState(null);
  const [splitPay,    setSplitPay]    = useState(false);
  const [splitAmounts,setSplitAmounts]= useState({ cash:0, upi:0, card:0 });
  const [loyaltyRedeem,setLoyaltyRedeem]=useState(0);
  const searchRef = useRef();

  const [session, setSession] = useState(null);
  const [sessionChecked, setSessionChecked] = useState(false);
  const [closingSession, setClosingSession] = useState(false);
  const [closeCash, setCloseCash] = useState('');

  async function closeSession() {
    if (!session) return;
    const actual = parseFloat(closeCash)||0;
    // Cash sales rung up during this session
    const { data: sessSales } = await supabase.from('sales')
      .select('total,payment_mode').eq('tenant_id', tenant.id).eq('session_id', session.id);
    const cashSales = (sessSales||[]).filter(s=>(s.payment_mode||'cash')==='cash')
      .reduce((a,s)=>a+(s.total||0),0);
    const expected = (session.opening_float||0) + cashSales;
    await supabase.from('cash_sessions').update({
      status:'closed', closed_at:new Date().toISOString(),
      closing_cash: actual, expected_cash: expected, difference: actual-expected,
    }).eq('id', session.id);
    setSession(null); setClosingSession(false); setCloseCash('');
  }

  useEffect(() => {
    if (!tenant?.id) return;
    (async () => {
      if (!navigator.onLine) { setSessionChecked(true); return; }   // offline: don't block billing
      const { data } = await supabase.from('cash_sessions')
        .select('*').eq('tenant_id', tenant.id).eq('status','open')
        .order('opened_at', { ascending:false }).limit(1).maybeSingle();
      setSession(data||null);
      setSessionChecked(true);
    })();
  }, [tenant?.id]);

  useEffect(() => { if (tenant?.id) load(); }, [tenant?.id]);
  useEffect(() => { searchRef.current?.focus(); }, []);

  async function load() {
    // Offline: serve from the local cache so billing never stops
    if (!navigator.onLine) {
      const [ci, cc] = await Promise.all([
        cacheGet(OFFLINE_KEYS.inventory),
        cacheGet(OFFLINE_KEYS.customers),
      ]);
      setInventory(ci||[]);
      setCustomers(cc||[]);
      setPromoCodes([]);           // promos need live validation
      return;
    }
    try {
      const [inv, custs, promos] = await Promise.all([
        supabase.from('inventory').select('*').eq('tenant_id', tenant.id).eq('active', true).order('name'),
        supabase.from('customers').select('id,name,phone,loyalty_points,outstanding,total_spent,purchase_count').eq('tenant_id', tenant.id).order('name'),
        supabase.from('promo_codes').select('*').eq('tenant_id', tenant.id).eq('active', true),
      ]);
      setInventory(inv.data||[]);
      setCustomers(custs.data||[]);
      setPromoCodes(promos.data||[]);
      // Refresh the offline cache while we have a connection
      if (inv.data)   cacheSet(OFFLINE_KEYS.inventory, inv.data);
      if (custs.data) cacheSet(OFFLINE_KEYS.customers, custs.data);
    } catch {
      const [ci, cc] = await Promise.all([
        cacheGet(OFFLINE_KEYS.inventory),
        cacheGet(OFFLINE_KEYS.customers),
      ]);
      setInventory(ci||[]);
      setCustomers(cc||[]);
    }
  }

  function addItem(item) {
    setCart(prev => {
      const ex = prev.find(c => c.id === item.id);
      if (ex) return prev.map(c => c.id === item.id ? { ...c, qty: c.qty+1, amount: (c.qty+1)*c.rate } : c);
      return [...prev, { id:item.id, name:item.name, code:item.code, rate:item.sp||0, qty:1, amount:item.sp||0, gst:item.gst||0, hsn:item.hsn||'', cat:item.cat||'', is_serialised:!!item.is_serialised, serial_label:item.serial_label||'Serial No' }];
    });
    setSearch('');
    if (item.is_serialised && navigator.onLine) openSerialPicker(item);
  }

  async function openSerialPicker(item) {
    const { data } = await supabase.from('item_serials')
      .select('id,serial_no,serial_alt').eq('tenant_id', tenant.id)
      .eq('item_id', item.id).eq('status','in_stock').order('received_date').limit(200);
    setSerialPick({ item, options: data||[] });
  }

  function chooseSerial(itemId, row) {
    setPickedSerials(prev => {
      const cur = prev[itemId] || [];
      if (cur.find(s=>s.id===row.id)) return { ...prev, [itemId]: cur.filter(s=>s.id!==row.id) };
      return { ...prev, [itemId]: [...cur, row] };
    });
  }

  function updateQty(id, qty) {
    if (qty < 1) return removeItem(id);
    setCart(prev => prev.map(c => c.id === id ? { ...c, qty, amount: qty*c.rate } : c));
  }

  function removeItem(id) { setCart(prev => prev.filter(c => c.id !== id)); }

  function applyPromo() {
    const code  = promoCode.trim().toUpperCase();
    const promo = promoCodes.find(p => p.code.toUpperCase() === code);
    if (!promo) { setPromoResult({ error:'Invalid promo code' }); setDiscount(0); return; }
    if (promo.valid_until && new Date(promo.valid_until) < new Date()) { setPromoResult({ error:'Code expired' }); setDiscount(0); return; }
    if (promo.min_order && subtotal < promo.min_order) { setPromoResult({ error:`Min order ${fmt(promo.min_order)} required` }); setDiscount(0); return; }
    let disc = promo.type==='percent' ? subtotal*promo.value/100 : promo.value;
    if (promo.max_discount) disc = Math.min(disc, promo.max_discount);
    setDiscount(Math.round(disc));
    setPromoResult({ success:true, promo, discount:disc });
  }

  function holdBill() {
    if (!cart.length) return;
    setHeldBills(prev => [...prev, { id:Date.now(), cart:[...cart], customer, discount, promoCode, time:new Date().toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'}) }]);
    setCart([]); setCustomer(null); setDiscount(0); setPromoCode(''); setPromoResult(null);
  }

  function resumeBill(bill) {
    setCart(bill.cart); setCustomer(bill.customer); setDiscount(bill.discount||0); setPromoCode(bill.promoCode||'');
    setHeldBills(prev => prev.filter(b => b.id !== bill.id));
  }

  const subtotal    = cart.reduce((s,c) => s + c.amount, 0);
  const gstTotal    = cart.reduce((s,c) => s + (c.amount*c.gst/(100+c.gst)), 0);
  const loyaltyDisc = Math.min(loyaltyRedeem*(tenant?.loyalty_point_value||0.5), subtotal*0.1);
  const total       = Math.max(0, subtotal - discount - loyaltyDisc);

  async function checkout() {
    if (!cart.length) return alert('Cart is empty');
    setSaving(true);
    try {
      const invNum = `${tenant?.invoice_prefix||'INV'}/${new Date().getFullYear()}/${String(Date.now()).slice(-5)}`;

      // ── OFFLINE: queue the sale locally, adjust stock in memory ──
      if (!navigator.onLine) {
        const offlineSale = {
          tenant_id:tenant.id, branch_id:activeBranch?.id,
          inv_num:invNum, date:new Date().toISOString().slice(0,10),
          customer:customer?.name||'Walk-in', customer_id:customer?.id,
          items:cart, subtotal, gst_amount:gstTotal,
          discount, promo_code:null, promo_discount:discount,
          total, payment_mode:payMode, status:'paid',
        };
        await queueAdd('sales', offlineSale, { localRef:invNum });
        // reflect the stock drop locally so the next bill sees it
        const adjusted = inventory.map(i => {
          const line = cart.find(x=>x.id===i.id);
          return line ? { ...i, stock: Math.max(0,(i.stock||0)-line.qty) } : i;
        });
        setInventory(adjusted);
        cacheSet(OFFLINE_KEYS.inventory, adjusted);
        setLastInv({ ...offlineSale, inv_num:invNum, _offline:true });
        setCart([]); setCustomer(null); setDiscount(0); setPromoCode(''); setPromoResult(null); setLoyaltyRedeem(0); setPickedSerials({});
        setSaving(false);
        return;
      }

      const { data: sale } = await supabase.from('sales').insert({
        tenant_id:tenant.id, branch_id:activeBranch?.id, session_id:session?.id,
        inv_num:invNum, date:new Date().toISOString().slice(0,10),
        customer:customer?.name||'Walk-in', customer_id:customer?.id,
        items:cart.map(li => pickedSerials[li.id]?.length ? { ...li, serials:pickedSerials[li.id].map(s=>s.serial_no) } : li),
        subtotal, gst_amount:gstTotal,
        discount, promo_code:promoCode||null, promo_discount:discount,
        total, payment_mode:payMode, status:'paid',
      }).select().single();

      for (const item of cart) {
        const inv = inventory.find(i => i.id === item.id);
        if (inv) await supabase.from('inventory').update({ stock:Math.max(0,(inv.stock||0)-item.qty) }).eq('id', item.id);
      }

      // Link the specific physical units sold to this invoice
      for (const [itemId, chosen] of Object.entries(pickedSerials)) {
        for (const row of chosen) {
          await supabase.from('item_serials').update({
            status:'sold', sale_id:sale.id, invoice_no:invNum,
            customer:customer?.name||'Walk-in', customer_id:customer?.id||null,
            sold_price:cart.find(x=>x.id===itemId)?.rate||null,
            sold_date:new Date().toISOString().slice(0,10),
          }).eq('id', row.id);
        }
      }

      if (customer?.id) {
        const earnPts = Math.floor(total/(tenant?.loyalty_earn_every||100));
        if (earnPts > 0 || loyaltyRedeem > 0) {
          if (earnPts > 0) await supabase.from('loyalty_txns').insert({ tenant_id:tenant.id, customer_id:customer.id, type:'earn', points:earnPts, sale_id:sale.id });
          if (loyaltyRedeem > 0) await supabase.from('loyalty_txns').insert({ tenant_id:tenant.id, customer_id:customer.id, type:'redeem', points:-loyaltyRedeem, sale_id:sale.id });
          await supabase.from('customers').update({ loyalty_points:Math.max(0,(customer.loyalty_points||0)+earnPts-loyaltyRedeem), total_spent:(customer.total_spent||0)+total, purchase_count:(customer.purchase_count||0)+1, last_purchase:new Date().toISOString().slice(0,10) }).eq('id', customer.id);
        }
      }

      if (promoResult?.promo) await supabase.from('promo_codes').update({ uses_count:(promoResult.promo.uses_count||0)+1 }).eq('id', promoResult.promo.id);

      setLastInv({ ...sale, inv_num: invNum });
      setCart([]); setCustomer(null); setDiscount(0); setPromoCode(''); setPromoResult(null); setLoyaltyRedeem(0); setPickedSerials({});
      await load();
    } catch(e) { alert('Checkout error: '+e.message); }
    finally { setSaving(false); }
  }

  function printReceipt(sale) {
    const w = window.open('', '_blank', 'width=340,height=600');
    const biz = tenant?.name||'Elite Store';
    const html = `<!DOCTYPE html><html><head><style>body{font-family:'Courier New',monospace;font-size:12px;margin:0;padding:8px}.center{text-align:center}.row{display:flex;justify-content:space-between;padding:1px 0}.divider{border-top:1px dashed #000;margin:4px 0}.bold{font-weight:bold}.large{font-size:16px}</style></head><body>
    <div class="center bold large">${biz}</div><div class="center">${tenant?.address||''}</div><div class="center">${tenant?.phone||''}</div>
    <div class="divider"></div><div class="row"><span>Invoice:</span><span class="bold">${sale.inv_num}</span></div><div class="row"><span>Date:</span><span>${sale.date}</span></div><div class="row"><span>Customer:</span><span>${sale.customer}</span></div>
    <div class="divider"></div>${(sale.items||[]).map(i=>`<div class="row"><span>${i.name} x${i.qty}</span><span>Rs.${(i.amount||0).toFixed(2)}</span></div>`).join('')}
    <div class="divider"></div><div class="row"><span>Subtotal</span><span>Rs.${(sale.subtotal||0).toFixed(2)}</span></div><div class="row"><span>GST</span><span>Rs.${(sale.gst_amount||0).toFixed(2)}</span></div>${(sale.discount||0)>0?`<div class="row"><span>Discount</span><span>-Rs.${(sale.discount||0).toFixed(2)}</span></div>`:''}<div class="row bold large"><span>TOTAL</span><span>Rs.${(sale.total||0).toFixed(2)}</span></div>
    <div class="divider"></div><div class="center">Thank you! Please visit again 🙏</div><div style="height:20px"></div>
    <script>window.onload=()=>{window.print();setTimeout(()=>window.close(),500)}<\/script></body></html>`;
    w.document.write(html); w.document.close();
  }

  const categories   = ['all', ...new Set(inventory.map(i=>i.cat||i.category).filter(Boolean))];
  const gridItems    = inventory
    .filter(i => cat==='all' || (i.cat||i.category)===cat)
    .filter(i => !search
      || i.name.toLowerCase().includes(search.toLowerCase())
      || (i.code||'').toLowerCase().includes(search.toLowerCase())
      || (i.barcode||'').includes(search));
  const filtered     = search ? gridItems : [];
  const custFiltered = customers.filter(c => custSearch && (c.name.toLowerCase().includes(custSearch.toLowerCase())||(c.phone||'').includes(custSearch)));
  async function addCustomer(e) {
    e.preventDefault();
    if (!newCust.name.trim()) return;
    setSavingCust(true);
    try {
      const { data, error } = await supabase.from('customers')
        .insert({ tenant_id:tenant.id, name:newCust.name.trim(), phone:newCust.phone.trim()||null, email:newCust.email.trim()||null })
        .select().single();
      if (error) throw error;
      setCustomers(prev=>[...prev, data]);
      setCustomer(data);
      setShowNewCust(false); setCustSearch('');
      setNewCust({ name:'', phone:'', email:'' });
    } catch (err) { alert('Could not add customer: '+err.message); }
    finally { setSavingCust(false); }
  }

  const btn = (active, color) => ({ background:active?color:T.card, color:active?'#fff':T.sub, border:`1px solid ${active?color:T.bdr}`, borderRadius:7, padding:'8px 12px', fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:'inherit' });

  // ── Session gate: no open session means no billing ──────────
  if (sessionChecked && !session && navigator.onLine) {
    return <POSSession tenant={tenant} user={user} activeBranch={activeBranch} onOpen={setSession}/>;
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'calc(100vh - 50px)' }}>

      {/* Session status bar */}
      {session && (
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'7px 14px',
                      background:'#F0FDF4', borderBottom:`1px solid #BBF7D0`, fontSize:11.5, flexShrink:0 }}>
          <span style={{ color:'#16A34A', fontWeight:600 }}>
            🏪 Session open · opened {new Date(session.opened_at).toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'})}
            {session.opening_float>0 && <span style={{ color:T.sub }}> · float {fmt(session.opening_float)}</span>}
          </span>
          <button onClick={()=>setClosingSession(true)}
            style={{ background:'#fff', color:'#16A34A', border:'1px solid #BBF7D0', borderRadius:6, padding:'4px 12px', fontSize:10.5, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>
            Close Session
          </button>
        </div>
      )}

    <div style={{ display:'grid', gridTemplateColumns:'1fr 380px', flex:1, minHeight:0 }}>
      {/* Left */}
      <div style={{ display:'flex', flexDirection:'column', overflow:'hidden', borderRight:`1px solid ${T.bdr}` }}>
        <div style={{ padding:12, borderBottom:`1px solid ${T.bdr}`, background:T.srf }}>
          <div style={{ position:'relative', marginBottom:heldBills.length?8:0 }}>
            <input ref={searchRef} value={search} onChange={e=>setSearch(e.target.value)} placeholder="🔍 Search product or scan barcode…"
              style={{ background:T.card, border:`1px solid ${T.bdr}`, borderRadius:9, padding:'10px 14px', color:T.ink, fontSize:14, fontFamily:'inherit', outline:'none', width:'100%' }}/>
            {filtered.length>0&&search&&(
              <div style={{ position:'absolute', top:'100%', left:0, right:0, background:T.card, border:`1px solid ${T.bdr}`, borderRadius:9, zIndex:10, maxHeight:280, overflowY:'auto', marginTop:4, boxShadow:'0 8px 24px rgba(0,0,0,.4)' }}>
                {filtered.map(item=>(
                  <div key={item.id} onClick={()=>addItem(item)} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'10px 14px', cursor:'pointer', borderBottom:`1px solid ${T.bdr}22` }}>
                    <div><div style={{ fontSize:14, color:T.ink, fontWeight:600 }}>{item.name}</div><div style={{ fontSize:11, color:T.muted }}>{item.cat||'—'} · Stock: {item.stock||0}{item.code?` · Code: ${item.code}`:''}</div></div>
                    <div style={{ fontSize:15, fontWeight:800, color:T.green }}>{fmt(item.sp)}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
          {heldBills.length>0&&<div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
            <span style={{ fontSize:11, color:T.muted, lineHeight:'24px' }}>⏸ Held:</span>
            {heldBills.map(b=><button key={b.id} onClick={()=>resumeBill(b)} style={{ background:T.amber+'22', color:T.amber, border:`1px solid ${T.amber}44`, borderRadius:6, padding:'3px 10px', fontSize:11, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>{b.time} · {b.cart.length} items</button>)}
          </div>}
        </div>
        {/* Category filter */}
        {categories.length>1&&(
          <div style={{ display:'flex', gap:6, padding:'8px 12px', borderBottom:`1px solid ${T.bdr}`, overflowX:'auto', background:T.srf }}>
            {categories.map(ct=>(
              <button key={ct} onClick={()=>setCat(ct)}
                style={{ padding:'5px 13px', background: cat===ct?T.red:T.card, color: cat===ct?'#fff':T.sub,
                         border:`1px solid ${cat===ct?T.red:T.bdr}`, borderRadius:20, fontSize:11, fontWeight:600,
                         cursor:'pointer', fontFamily:'inherit', whiteSpace:'nowrap' }}>
                {ct==='all'?'All Items':ct}
              </button>
            ))}
          </div>
        )}

        {/* Cart */}
        <div style={{ flex:cart.length?1:0, overflowY:'auto', padding: cart.length?12:0, borderBottom: cart.length?`1px solid ${T.bdr}`:'none' }}>
          {cart.map(item=>(
            <div key={item.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 0', borderBottom:`1px solid ${T.bdr}22` }}>
              <div style={{ flex:1 }}><div style={{ fontSize:14, color:T.ink, fontWeight:600 }}>{item.name}</div><div style={{ fontSize:12, color:T.muted }}>{fmt(item.rate)} each{item.gst>0?` · GST ${item.gst}%`:''}</div></div>
              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                <button onClick={()=>updateQty(item.id,item.qty-1)} style={{ background:T.bdr, color:T.ink, border:'none', borderRadius:6, width:28, height:28, cursor:'pointer', fontFamily:'inherit', fontSize:16 }}>−</button>
                <span style={{ fontSize:14, fontWeight:700, color:T.ink, minWidth:24, textAlign:'center' }}>{item.qty}</span>
                <button onClick={()=>updateQty(item.id,item.qty+1)} style={{ background:T.blue, color:'#fff', border:'none', borderRadius:6, width:28, height:28, cursor:'pointer', fontFamily:'inherit', fontSize:16 }}>+</button>
              </div>
              <div style={{ fontSize:15, fontWeight:800, color:T.green, minWidth:70, textAlign:'right' }}>{fmt(item.amount)}</div>
              <button onClick={()=>removeItem(item.id)} style={{ background:'none', border:'none', color:T.muted, cursor:'pointer', fontSize:18 }}>×</button>
            </div>
          ))}
        </div>

        {/* Product grid — always browsable */}
        <div style={{ flex:cart.length?1.2:1, overflowY:'auto', padding:12, background:T.bg }}>
          <div style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:9 }}>
            {search ? `${gridItems.length} match${gridItems.length!==1?'es':''}` : `${gridItems.length} products`}
          </div>
          {gridItems.length===0
            ? <div style={{ textAlign:'center', color:T.muted, padding:'50px 20px' }}>
                <div style={{ fontSize:38, marginBottom:10 }}>📦</div>
                <div style={{ fontSize:14, fontWeight:600 }}>{search?`Nothing matches "${search}"`:'No products yet'}</div>
                <div style={{ fontSize:12, marginTop:5 }}>{search?'Try a different name or code':'Add products under Inventory first'}</div>
              </div>
            : <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(150px,1fr))', gap:9 }}>
                {gridItems.map(item=>{
                  const out = (item.stock||0)<=0;
                  return (
                    <button key={item.id} onClick={()=>!out&&addItem(item)} disabled={out}
                      style={{ background:T.srf, border:`1px solid ${out?'#FECACA':T.bdr}`, borderRadius:10,
                               padding:'11px 12px', textAlign:'left', cursor: out?'not-allowed':'pointer',
                               fontFamily:'inherit', opacity: out?.55:1, transition:'all .12s' }}
                      onMouseEnter={e=>{ if(!out){ e.currentTarget.style.borderColor=T.red; e.currentTarget.style.transform='translateY(-1px)'; }}}
                      onMouseLeave={e=>{ e.currentTarget.style.borderColor= out?'#FECACA':T.bdr; e.currentTarget.style.transform='none'; }}>
                      <div style={{ fontSize:12.5, fontWeight:700, color:T.ink, marginBottom:3, lineHeight:1.3,
                                    display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical', overflow:'hidden', minHeight:32 }}>
                        {item.name}
                      </div>
                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                        <span style={{ fontSize:14, fontWeight:800, color:T.green }}>{fmt(item.sp)}</span>
                        <span style={{ fontSize:10, color: out?T.red:(item.stock||0)<=5?T.amber:T.muted, fontWeight: out?700:500 }}>
                          {out?'Out':`${item.stock} left`}
                        </span>
                      </div>
                      {item.code&&<div style={{ fontSize:9, color:T.muted, marginTop:3 }}>{item.code}</div>}
                    </button>
                  );
                })}
              </div>}
        </div>
      </div>

      {/* Right: checkout */}
      <div style={{ display:'flex', flexDirection:'column', background:T.srf, overflow:'hidden' }}>
        <div style={{ flex:1, overflowY:'auto', padding:14 }}>
          {/* Customer */}
          <div style={{ marginBottom:12 }}>
            <div style={{ fontSize:11, color:T.sub, fontWeight:700, textTransform:'uppercase', marginBottom:6 }}>Customer</div>
            {customer?(<div style={{ background:T.card, borderRadius:9, padding:'10px 12px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <div><div style={{ fontSize:13, fontWeight:700, color:T.ink }}>{customer.name}</div><div style={{ fontSize:11, color:T.amber }}>⭐ {customer.loyalty_points||0} pts · {fmt(customer.total_spent||0)} spent</div></div>
              <button onClick={()=>{setCustomer(null);setLoyaltyRedeem(0);}} style={{ background:'none', border:'none', color:T.muted, cursor:'pointer', fontSize:18 }}>×</button>
            </div>):(
              <div style={{ position:'relative' }}>
                <div style={{ display:'flex', gap:6 }}>
                  <input value={custSearch} onChange={e=>setCustSearch(e.target.value)}
                    placeholder="Search by name or phone…"
                    style={{ flex:1, background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:8, padding:'9px 12px', color:T.ink, fontSize:13, fontFamily:'inherit', outline:'none' }}/>
                  <button type="button" onClick={()=>{ setNewCust(n=>({ ...n, name:/^\d+$/.test(custSearch)?'':custSearch, phone:/^\d+$/.test(custSearch)?custSearch:'' })); setShowNewCust(true); }}
                    title="Add new customer"
                    style={{ background:T.red, color:'#fff', border:'none', borderRadius:8, padding:'0 14px', fontSize:17, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>+</button>
                </div>

                {custSearch&&(
                  <div style={{ position:'absolute', top:'100%', left:0, right:0, background:T.srf,
                                border:`1px solid ${T.bdr}`, borderRadius:9, zIndex:50, maxHeight:230, overflowY:'auto',
                                marginTop:5, boxShadow:'0 8px 28px rgba(0,0,0,.16)' }}>
                    {custFiltered.length>0
                      ? custFiltered.slice(0,8).map(cu=>(
                          <div key={cu.id} onClick={()=>{ setCustomer(cu); setCustSearch(''); }}
                            style={{ padding:'10px 13px', cursor:'pointer', borderBottom:`1px solid ${T.bdr}33`, display:'flex', justifyContent:'space-between', alignItems:'center' }}
                            onMouseEnter={e=>e.currentTarget.style.background=T.bg}
                            onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                            <div>
                              <div style={{ fontSize:13, color:T.ink, fontWeight:600 }}>{cu.name}</div>
                              <div style={{ fontSize:11, color:T.muted }}>{cu.phone||'No phone'}</div>
                            </div>
                            <span style={{ fontSize:10, color:T.amber, fontWeight:700 }}>⭐{cu.loyalty_points||0}</span>
                          </div>
                        ))
                      : (
                        <div style={{ padding:'14px 13px', textAlign:'center' }}>
                          <div style={{ fontSize:12, color:T.muted, marginBottom:9 }}>No customer matches "{custSearch}"</div>
                          <button type="button" onClick={()=>{ setNewCust(n=>({ ...n, name:/^\d+$/.test(custSearch)?'':custSearch, phone:/^\d+$/.test(custSearch)?custSearch:'' })); setShowNewCust(true); }}
                            style={{ background:T.red, color:'#fff', border:'none', borderRadius:8, padding:'8px 16px', fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>
                            + Add "{custSearch}" as new customer
                          </button>
                        </div>
                      )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Loyalty redeem */}
          {customer&&(customer.loyalty_points||0)>0&&(<div style={{ background:T.amber+'12', border:`1px solid ${T.amber}44`, borderRadius:9, padding:'10px 12px', marginBottom:12 }}>
            <div style={{ fontSize:11, color:T.amber, fontWeight:700, marginBottom:6 }}>⭐ Redeem Points (max 10%)</div>
            <div style={{ display:'flex', gap:8, alignItems:'center' }}>
              <input type="number" min={0} max={customer.loyalty_points||0} value={loyaltyRedeem} onChange={e=>setLoyaltyRedeem(parseInt(e.target.value)||0)} style={{ width:80, background:T.card, border:`1px solid ${T.bdr}`, borderRadius:6, padding:'6px 8px', color:T.ink, fontSize:12, fontFamily:'inherit', outline:'none', textAlign:'center' }}/>
              <span style={{ fontSize:11, color:T.muted }}>pts = {fmt(loyaltyDisc)} off</span>
            </div>
          </div>)}

          {/* Promo */}
          <div style={{ marginBottom:12 }}>
            <div style={{ fontSize:11, color:T.sub, fontWeight:700, textTransform:'uppercase', marginBottom:6 }}>Promo Code</div>
            <div style={{ display:'flex', gap:6 }}>
              <input value={promoCode} onChange={e=>setPromoCode(e.target.value.toUpperCase())} onKeyDown={e=>e.key==='Enter'&&applyPromo()} placeholder="Enter code…" style={{ flex:1, background:T.card, border:`1px solid ${promoResult?.success?T.green:promoResult?.error?T.red:T.bdr}`, borderRadius:7, padding:'8px 10px', color:T.ink, fontSize:13, fontFamily:'monospace', outline:'none', letterSpacing:1 }}/>
              <button onClick={applyPromo} style={{ background:T.blue+'22', color:T.blue, border:'none', borderRadius:7, padding:'8px 12px', fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>Apply</button>
              {discount>0&&<button onClick={()=>{setDiscount(0);setPromoCode('');setPromoResult(null);}} style={{ background:T.red+'22', color:T.red, border:'none', borderRadius:7, padding:'8px 10px', fontSize:12, cursor:'pointer', fontFamily:'inherit' }}>×</button>}
            </div>
            {promoResult?.error&&<div style={{ fontSize:11, color:T.red, marginTop:4 }}>❌ {promoResult.error}</div>}
            {promoResult?.success&&<div style={{ fontSize:11, color:T.green, marginTop:4 }}>✅ {fmt(discount)} discount applied!</div>}
          </div>

          {/* Totals */}
          <div style={{ background:T.card, borderRadius:9, padding:12, marginBottom:12 }}>
            {[[`Subtotal (${cart.length} items)`,fmt(subtotal),T.sub],['GST',fmt(gstTotal),T.muted],discount>0&&['Promo Discount','-'+fmt(discount),T.green],loyaltyDisc>0&&['Loyalty Discount','-'+fmt(loyaltyDisc),T.amber]].filter(Boolean).map(([label,val,color])=>(
              <div key={label} style={{ display:'flex', justifyContent:'space-between', padding:'3px 0', fontSize:12 }}><span style={{ color:T.sub }}>{label}</span><span style={{ color }}>{val}</span></div>
            ))}
            <div style={{ display:'flex', justifyContent:'space-between', paddingTop:8, marginTop:6, borderTop:`1px solid ${T.bdr}`, fontSize:18, fontWeight:900 }}>
              <span style={{ color:T.ink }}>TOTAL</span><span style={{ color:T.green }}>{fmt(total)}</span>
            </div>
          </div>

          {/* Payment */}
          <div style={{ marginBottom:8 }}>
            <div style={{ fontSize:11, color:T.sub, fontWeight:700, textTransform:'uppercase', marginBottom:6 }}>Payment Mode</div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:6 }}>
              {[['cash','💵'],['upi','📱'],['card','💳'],['credit','📒']].map(([m,icon])=>(
                <button key={m} onClick={()=>{setPayMode(m);setSplitPay(false);}} style={btn(payMode===m&&!splitPay,T.blue)}>{icon} {m.charAt(0).toUpperCase()+m.slice(1)}</button>
              ))}
            </div>
            <button onClick={()=>setSplitPay(s=>!s)} style={{ width:'100%', marginTop:6, ...btn(splitPay,T.purple) }}>⚡ Split Payment</button>
            {splitPay&&<div style={{ marginTop:8, display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:6 }}>
              {['cash','upi','card'].map(m=><div key={m}><div style={{ fontSize:10, color:T.muted, marginBottom:3, textTransform:'capitalize' }}>{m}</div><input type="number" value={splitAmounts[m]||''} onChange={e=>setSplitAmounts(p=>({...p,[m]:parseFloat(e.target.value)||0}))} placeholder="0" style={{ width:'100%', background:T.card, border:`1px solid ${T.bdr}`, borderRadius:6, padding:'6px 8px', color:T.ink, fontSize:12, fontFamily:'inherit', outline:'none', textAlign:'center' }}/></div>)}
            </div>}
          </div>
        </div>

        {/* Buttons */}
        <div style={{ padding:14, borderTop:`1px solid ${T.bdr}`, display:'flex', flexDirection:'column', gap:8 }}>
          <div style={{ display:'flex', gap:8 }}>
            <button onClick={holdBill} disabled={!cart.length} style={{ flex:1, background:T.amber+'22', color:T.amber, border:`1px solid ${T.amber}44`, borderRadius:8, padding:'10px', fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>⏸ Hold</button>
            <button onClick={()=>{setCart([]);setCustomer(null);setDiscount(0);setPromoCode('');setPromoResult(null);setLoyaltyRedeem(0);}} disabled={!cart.length} style={{ flex:1, background:T.red+'22', color:T.red, border:`1px solid ${T.red}44`, borderRadius:8, padding:'10px', fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>🗑 Clear</button>
          </div>
          <button onClick={checkout} disabled={!cart.length||saving} style={{ background:T.green, color:'#fff', border:'none', borderRadius:9, padding:'14px', fontSize:16, fontWeight:800, cursor:'pointer', fontFamily:'inherit' }}>
            {saving?'Processing…':`✅ Checkout ${fmt(total)}`}
          </button>
          {lastInv&&<button onClick={()=>printReceipt(lastInv)} style={{ background:T.blue+'22', color:T.blue, border:'none', borderRadius:8, padding:'10px', fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>🖨️ Print Last Receipt — {lastInv.inv_num}</button>}
        </div>
      </div>

      {/* ── Quick add customer ─────────────────────────────── */}
      {showNewCust&&(
        <div onClick={()=>setShowNewCust(false)}
          style={{ position:'fixed', inset:0, background:'rgba(17,24,39,.5)', zIndex:300, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
          <div onClick={e=>e.stopPropagation()}
            style={{ background:T.srf, borderRadius:15, padding:26, width:'100%', maxWidth:400, boxShadow:'0 20px 60px rgba(0,0,0,.25)' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:18 }}>
              <div>
                <div style={{ fontSize:16, fontWeight:800, color:T.red }}>Add Customer</div>
                <div style={{ fontSize:11, color:T.sub, marginTop:2 }}>They'll be selected for this bill straight away</div>
              </div>
              <button onClick={()=>setShowNewCust(false)} style={{ background:'none', border:'none', fontSize:22, cursor:'pointer', color:T.muted, lineHeight:1 }}>×</button>
            </div>
            <form onSubmit={addCustomer}>
              {[['Name *','text','name','Customer name'],['Phone','tel','phone','10-digit mobile'],['Email','email','email','Optional']].map(([lb,tp,key,ph])=>(
                <div key={key} style={{ marginBottom:13 }}>
                  <label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.05em', display:'block', marginBottom:5 }}>{lb}</label>
                  <input type={tp} value={newCust[key]} autoFocus={key==='name'}
                    onChange={e=>setNewCust(n=>({ ...n, [key]:e.target.value }))}
                    required={lb.includes('*')} placeholder={ph}
                    style={{ width:'100%', background:T.bg, border:`1px solid ${T.bdr}`, borderRadius:8, padding:'10px 13px', color:T.ink, fontSize:14, fontFamily:'inherit', outline:'none' }}/>
                </div>
              ))}
              <div style={{ display:'flex', gap:9, marginTop:18 }}>
                <button type="button" onClick={()=>setShowNewCust(false)}
                  style={{ flex:1, background:T.bg, color:T.sub, border:`1px solid ${T.bdr}`, borderRadius:9, padding:'12px', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>Cancel</button>
                <button type="submit" disabled={savingCust||!newCust.name.trim()}
                  style={{ flex:2, background: newCust.name.trim()?T.green:T.bdr, color:'#fff', border:'none', borderRadius:9, padding:'12px', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>
                  {savingCust?'Saving…':'Add & Select'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}


      {/* ── Serial / IMEI picker ───────────────────────────── */}
      {serialPick && (
        <div onClick={()=>setSerialPick(null)} style={{ position:'fixed', inset:0, background:'rgba(17,24,39,.5)', zIndex:310, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
          <div onClick={e=>e.stopPropagation()} style={{ background:T.srf, borderRadius:15, padding:24, width:'100%', maxWidth:460, maxHeight:'82vh', display:'flex', flexDirection:'column', boxShadow:'0 20px 60px rgba(0,0,0,.25)' }}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:5 }}>
              <div style={{ fontSize:15, fontWeight:800, color:T.red }}>Select {serialPick.item.serial_label||'Serial No'}</div>
              <button onClick={()=>setSerialPick(null)} style={{ background:'none', border:'none', fontSize:21, cursor:'pointer', color:T.muted }}>×</button>
            </div>
            <div style={{ fontSize:11.5, color:T.sub, marginBottom:14 }}>
              {serialPick.item.name} — pick the unit(s) you're handing over
              {(pickedSerials[serialPick.item.id]||[]).length>0 && <strong style={{ color:T.green }}> · {(pickedSerials[serialPick.item.id]||[]).length} selected</strong>}
            </div>

            <div style={{ flex:1, overflowY:'auto', border:`1px solid ${T.bdr}`, borderRadius:9 }}>
              {serialPick.options.length===0
                ? <div style={{ padding:'34px 18px', textAlign:'center', color:T.muted }}>
                    <div style={{ fontSize:30, marginBottom:8 }}>📭</div>
                    <div style={{ fontSize:13, fontWeight:600 }}>No units in stock for this product</div>
                    <div style={{ fontSize:11, marginTop:4 }}>Add serials under Inventory → Serial Registry</div>
                  </div>
                : serialPick.options.map(o=>{
                    const on = (pickedSerials[serialPick.item.id]||[]).some(s=>s.id===o.id);
                    return (
                      <div key={o.id} onClick={()=>chooseSerial(serialPick.item.id, o)}
                        style={{ display:'flex', alignItems:'center', gap:10, padding:'11px 14px', cursor:'pointer', borderBottom:`1px solid ${T.bdr}33`, background: on?'#F0FDF4':'transparent' }}>
                        <div style={{ width:18, height:18, borderRadius:5, border:`2px solid ${on?T.green:T.bdr}`, background:on?T.green:'transparent', display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontSize:12, fontWeight:900 }}>{on?'✓':''}</div>
                        <div style={{ flex:1 }}>
                          <div style={{ fontFamily:'monospace', fontSize:12.5, fontWeight:700, color:T.ink }}>{o.serial_no}</div>
                          {o.serial_alt && <div style={{ fontFamily:'monospace', fontSize:10, color:T.muted }}>{o.serial_alt}</div>}
                        </div>
                      </div>
                    );
                  })}
            </div>

            <button onClick={()=>setSerialPick(null)}
              style={{ marginTop:14, background:T.red, color:'#fff', border:'none', borderRadius:9, padding:'12px', fontSize:13.5, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>
              Done
            </button>
          </div>
        </div>
      )}

    </div>

      {/* Close session modal */}
      {closingSession && session && (
        <div onClick={()=>setClosingSession(false)} style={{ position:'fixed', inset:0, background:'rgba(17,24,39,.5)', zIndex:320, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
          <div onClick={e=>e.stopPropagation()} style={{ background:T.srf, borderRadius:15, padding:24, width:'100%', maxWidth:390, boxShadow:'0 20px 60px rgba(0,0,0,.25)' }}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:5 }}>
              <div style={{ fontSize:16, fontWeight:800, color:T.red }}>Close Session</div>
              <button onClick={()=>setClosingSession(false)} style={{ background:'none', border:'none', fontSize:21, cursor:'pointer', color:T.muted }}>×</button>
            </div>
            <div style={{ fontSize:11.5, color:T.sub, marginBottom:16 }}>
              Count the drawer and enter what's actually in it. The difference is recorded.
            </div>
            <div style={{ background:T.bg, borderRadius:9, padding:'11px 14px', marginBottom:14, fontSize:12.5 }}>
              <div style={{ display:'flex', justifyContent:'space-between', padding:'3px 0' }}>
                <span style={{ color:T.sub }}>Opening float</span>
                <strong style={{ color:T.ink }}>{fmt(session.opening_float||0)}</strong>
              </div>
            </div>
            <label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:5 }}>Cash counted in drawer</label>
            <input type="number" value={closeCash} onChange={e=>setCloseCash(e.target.value)} autoFocus
              style={{ width:'100%', background:T.card, border:`1px solid ${T.bdr}`, borderRadius:9, padding:'13px', fontSize:20, fontWeight:800, textAlign:'center', color:T.green, fontFamily:'inherit', outline:'none', marginBottom:16 }}/>
            <div style={{ display:'flex', gap:10 }}>
              <button onClick={()=>setClosingSession(false)} style={{ flex:1, background:T.card, color:T.sub, border:`1px solid ${T.bdr}`, borderRadius:9, padding:'12px', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>Cancel</button>
              <button onClick={closeSession} style={{ flex:2, background:T.red, color:'#fff', border:'none', borderRadius:9, padding:'12px', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>Close &amp; Reconcile</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}