import { useState } from 'react';
import { supabase } from '../lib/supabase';

const T = { bg:'#060710', srf:'#0f1220', card:'#141828', bdr:'#1e2540', blue:'#4f7cff', ink:'#eef0f8', sub:'#6b7598', muted:'#4a5175', green:'#00d68f', amber:'#ffb547', red:'#ff4d6a', purple:'#9b72ff', teal:'#00c9b1' };
const fmt = n => 'Rs.' + (n||0).toLocaleString('en-IN', { maximumFractionDigits:0 });

export default function CustomerApp({ tenant }) {
  const [phone,     setPhone]     = useState('');
  const [customer,  setCustomer]  = useState(null);
  const [sales,     setSales]     = useState([]);
  const [loyalty,   setLoyalty]   = useState(null);
  const [promos,    setPromos]    = useState([]);
  const [loading,   setLoading]   = useState(false);
  const [tab,       setTab]       = useState('points');
  const [shareLink, setShareLink] = useState('');

  async function lookup() {
    if (!phone.trim() || phone.length < 10) return alert('Enter a valid 10-digit phone number');
    setLoading(true);
    const ph = phone.replace(/\D/g, '').slice(-10);
    const [custRes, loyaltyRes, promosRes] = await Promise.all([
      supabase.from('customers').select('*').eq('tenant_id', tenant.id).ilike('phone', `%${ph}%`).single(),
      supabase.from('loyalty_txns').select('*').eq('tenant_id', tenant.id).order('created_at', { ascending:false }).limit(20),
      supabase.from('promo_codes').select('*').eq('tenant_id', tenant.id).eq('active', true),
    ]);
    if (!custRes.data) { setLoading(false); return alert('No customer found with this number. Contact the store.'); }
    const cust = custRes.data;
    setCustomer(cust);
    const custLoyalty = (loyaltyRes.data||[]).filter(t => t.customer_id === cust.id);
    setLoyalty({ txns: custLoyalty, balance: cust.loyalty_points || 0 });
    const salesRes = await supabase.from('sales').select('*').eq('tenant_id', tenant.id).eq('customer_id', cust.id).order('date', { ascending:false }).limit(20);
    setSales(salesRes.data||[]);
    setPromos(promosRes.data||[]);
    setLoading(false);
  }

  function generateShareLink() {
    const link = `${window.location.origin}?customerApp=1&tenant=${tenant.id}&phone=${phone}`;
    setShareLink(link);
    navigator.clipboard.writeText(link);
    alert('Link copied! Share this with customer via WhatsApp.');
  }

  function shareOnWhatsApp() {
    if (!customer) return;
    const msg = `Hi ${customer.name}! 👋\n\nYour loyalty status at *${tenant?.name||'Elite Store'}*:\n\n⭐ Points Balance: *${customer.loyalty_points||0} pts*\n💰 Total Spent: *${fmt(customer.total_spent||0)}*\n🛍️ Total Orders: *${customer.purchase_count||0}*\n\nCheck your account: ${window.location.origin}/customer-app\n\nThank you for being our valued customer! 🙏`;
    const ph = (customer.phone||'').replace(/\D/g,'').replace(/^0/,'91');
    window.open(`https://wa.me/${ph}?text=${encodeURIComponent(msg)}`, '_blank');
  }

  const pointValue = tenant?.loyalty_point_value || 0.5;

  return (
    <div style={{ padding:20 }}>
      <div style={{ fontSize:22, fontWeight:800, color:T.ink, marginBottom:6 }}>📱 Customer Loyalty App</div>
      <div style={{ fontSize:13, color:T.sub, marginBottom:20 }}>Customer portal — lookup points, invoices and offers by phone number</div>

      {/* Lookup form */}
      <div style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:12, padding:20, marginBottom:20 }}>
        <div style={{ fontWeight:700, color:T.ink, marginBottom:12 }}>🔍 Customer Lookup</div>
        <div style={{ display:'flex', gap:10 }}>
          <input value={phone} onChange={e=>setPhone(e.target.value)} onKeyDown={e=>e.key==='Enter'&&lookup()} placeholder="Enter customer phone number" type="tel" maxLength={10}
            style={{ flex:1, background:T.card, border:`1px solid ${T.bdr}`, borderRadius:8, padding:'10px 14px', color:T.ink, fontSize:14, fontFamily:'inherit', outline:'none' }}/>
          <button onClick={lookup} disabled={loading} style={{ background:T.blue, color:'#fff', border:'none', borderRadius:8, padding:'10px 20px', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>
            {loading?'…':'Search'}
          </button>
        </div>
        <div style={{ fontSize:11, color:T.muted, marginTop:8 }}>Customer enters their phone number to view their account details</div>
      </div>

      {/* Share portal link */}
      <div style={{ background:T.card, border:`1px solid ${T.bdr}`, borderRadius:10, padding:'12px 16px', marginBottom:20, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <div>
          <div style={{ fontSize:13, fontWeight:600, color:T.ink }}>Share Customer Portal</div>
          <div style={{ fontSize:11, color:T.muted }}>Send customers a direct link to check their account</div>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <button onClick={generateShareLink} style={{ background:T.blue+'22', color:T.blue, border:'none', borderRadius:7, padding:'7px 14px', fontSize:11, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>📋 Copy Link</button>
          {customer&&<button onClick={shareOnWhatsApp} style={{ background:'#25d36622', color:'#25d366', border:'none', borderRadius:7, padding:'7px 14px', fontSize:11, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>💬 WhatsApp</button>}
        </div>
      </div>

      {customer && (
        <>
          {/* Customer profile */}
          <div style={{ background:T.srf, border:`2px solid ${T.blue}44`, borderRadius:14, padding:20, marginBottom:16 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
              <div>
                <div style={{ fontSize:20, fontWeight:800, color:T.ink }}>{customer.name}</div>
                <div style={{ fontSize:13, color:T.sub }}>{customer.phone} · {customer.email||'No email'}</div>
                <div style={{ marginTop:8 }}>
                  <span style={{ background:T.amber+'22', color:T.amber, borderRadius:5, padding:'2px 10px', fontSize:11, fontWeight:700, textTransform:'capitalize' }}>
                    {customer.segment||'Regular'} Customer
                  </span>
                </div>
              </div>
              <div style={{ textAlign:'right' }}>
                <div style={{ fontSize:11, color:T.muted }}>Loyalty Points</div>
                <div style={{ fontSize:32, fontWeight:900, color:T.amber }}>⭐ {customer.loyalty_points||0}</div>
                <div style={{ fontSize:11, color:T.green }}>≈ {fmt((customer.loyalty_points||0)*pointValue)} value</div>
              </div>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10, marginTop:16 }}>
              {[['Total Spent',fmt(customer.total_spent||0),T.green],['Orders',customer.purchase_count||0,T.blue],['Outstanding',fmt(customer.outstanding||0),T.red]].map(([label,val,color])=>(
                <div key={label} style={{ background:T.card, borderRadius:8, padding:'10px 12px', textAlign:'center' }}>
                  <div style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', marginBottom:4 }}>{label}</div>
                  <div style={{ fontSize:16, fontWeight:800, color }}>{val}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Tabs */}
          <div style={{ display:'flex', gap:6, marginBottom:14 }}>
            {[['points','⭐ Points'],['invoices','🧾 Invoices'],['offers','🎁 Offers']].map(([id,label])=>(
              <button key={id} onClick={()=>setTab(id)} style={{ background:tab===id?T.blue:T.srf, color:tab===id?'#fff':T.sub, border:`1px solid ${tab===id?T.blue:T.bdr}`, borderRadius:7, padding:'7px 14px', fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}>{label}</button>
            ))}
          </div>

          {/* Points history */}
          {tab==='points' && (
            <div style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:12, overflow:'hidden' }}>
              <div style={{ padding:'12px 18px', borderBottom:`1px solid ${T.bdr}`, fontWeight:700, color:T.ink }}>Points History</div>
              {!loyalty?.txns?.length ? <div style={{ padding:40, textAlign:'center', color:T.muted }}>No points transactions yet</div>
              : loyalty.txns.map(t=>(
                <div key={t.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'10px 16px', borderBottom:`1px solid ${T.bdr}22` }}>
                  <div>
                    <div style={{ fontSize:13, color:T.ink }}>{t.type==='earn'?'Earned from purchase':'Redeemed'}</div>
                    <div style={{ fontSize:11, color:T.muted }}>{t.created_at?.slice(0,10)}</div>
                  </div>
                  <div style={{ fontSize:15, fontWeight:700, color:t.type==='earn'?T.green:T.red }}>
                    {t.type==='earn'?'+':'-'}{t.points} pts
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Invoice history */}
          {tab==='invoices' && (
            <div style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:12, overflow:'hidden' }}>
              <div style={{ padding:'12px 18px', borderBottom:`1px solid ${T.bdr}`, fontWeight:700, color:T.ink }}>Purchase History</div>
              {!sales.length ? <div style={{ padding:40, textAlign:'center', color:T.muted }}>No purchases yet</div>
              : sales.map(s=>(
                <div key={s.id} style={{ padding:'12px 16px', borderBottom:`1px solid ${T.bdr}22` }}>
                  <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                    <div style={{ fontSize:13, fontWeight:700, color:T.blue, fontFamily:'monospace' }}>{s.inv_num}</div>
                    <div style={{ fontSize:14, fontWeight:800, color:T.green }}>{fmt(s.total)}</div>
                  </div>
                  <div style={{ display:'flex', justifyContent:'space-between' }}>
                    <div style={{ fontSize:11, color:T.muted }}>{s.date} · {(s.items||[]).length} items</div>
                    <span style={{ background:s.status==='paid'?T.green+'22':T.amber+'22', color:s.status==='paid'?T.green:T.amber, borderRadius:5, padding:'1px 7px', fontSize:10, fontWeight:700, textTransform:'capitalize' }}>{s.status}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Offers */}
          {tab==='offers' && (
            <div>
              {!promos.length ? <div style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:12, padding:40, textAlign:'center', color:T.muted }}>No active offers right now</div>
              : <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(240px,1fr))', gap:12 }}>
                {promos.map(p=>(
                  <div key={p.id} style={{ background:T.srf, border:`2px dashed ${T.blue}44`, borderRadius:12, padding:18 }}>
                    <div style={{ fontSize:20, fontWeight:900, color:T.blue, fontFamily:'monospace', letterSpacing:1, marginBottom:8 }}>{p.code}</div>
                    <div style={{ fontSize:22, fontWeight:800, color:T.amber, marginBottom:6 }}>{p.type==='percent'?`${p.value}% OFF`:`Rs.${p.value} OFF`}</div>
                    <div style={{ fontSize:12, color:T.sub }}>{p.description||'Use this code at checkout'}</div>
                    {p.min_order>0&&<div style={{ fontSize:11, color:T.muted, marginTop:4 }}>Min order: {fmt(p.min_order)}</div>}
                    {p.valid_until&&<div style={{ fontSize:11, color:T.red, marginTop:4 }}>Valid until: {p.valid_until}</div>}
                    <button onClick={()=>{navigator.clipboard.writeText(p.code);alert('Code copied!');}} style={{ background:T.blue+'22', color:T.blue, border:'none', borderRadius:7, padding:'6px 14px', fontSize:11, fontWeight:700, cursor:'pointer', fontFamily:'inherit', marginTop:10 }}>📋 Copy Code</button>
                  </div>
                ))}
              </div>}
            </div>
          )}
        </>
      )}
    </div>
  );
}
