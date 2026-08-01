import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { getInventory, getCustomers, getSales } from '../lib/supabase';

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

export default function Notifications({ tenant, onNavigate }) {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [filter,  setFilter]  = useState('all');

  useEffect(() => { if (tenant?.id) load(); }, [tenant?.id]);

  async function load() {
    setLoading(true);
    const today    = new Date().toISOString().slice(0,10);
    const thisMonth = new Date().toISOString().slice(0,7);

    const [inventory, customers, sales] = await Promise.all([
      getInventory(tenant.id),
      getCustomers(tenant.id),
      getSales(tenant.id, 200),
    ]);

    // Low stock items
    const lowStock = inventory.filter(i => (i.stock||0) <= (i.alert||10) && (i.active !== false))
      .sort((a,b) => (a.stock||0) - (b.stock||0));

    // Out of stock
    const outOfStock = inventory.filter(i => (i.stock||0) === 0 && i.active !== false);

    // Overdue customers
    const overdueCustomers = customers.filter(c => (c.outstanding||0) > 0)
      .sort((a,b) => (b.outstanding||0) - (a.outstanding||0));

    // Today's sales summary
    const todaySales = sales.filter(s => s.date === today);
    const todayRevenue = todaySales.reduce((s,x) => s+(x.total||0), 0);

    // Month sales
    const monthSales = sales.filter(s => (s.date||'').startsWith(thisMonth));
    const monthRevenue = monthSales.reduce((s,x) => s+(x.total||0), 0);

    // Recent pending/credit sales
    const pendingSales = sales.filter(s => s.status === 'pending' || s.status === 'overdue')
      .sort((a,b) => new Date(b.date) - new Date(a.date));

    setData({ lowStock, outOfStock, overdueCustomers, todaySales, todayRevenue, monthSales, monthRevenue, pendingSales, inventory, customers });
    setLoading(false);
  }

  function sendWhatsAppReminder(customer) {
    const msg = `Dear ${customer.name},\n\nThis is a friendly reminder from *${tenant?.name||'Elite Store'}* that you have an outstanding balance of *${fmt(customer.outstanding)}*.\n\nKindly clear the payment at your earliest convenience.\n\nThank you! 🙏`;
    const phone = (customer.phone||'').replace(/\D/g,'').replace(/^0/,'91');
    window.open(`https://wa.me/${phone||''}?text=${encodeURIComponent(msg)}`, '_blank');
  }

  const allNotifications = data ? [
    ...data.outOfStock.map(i => ({ type:'critical', icon:'🚫', title:`Out of Stock: ${i.name}`, body:`Stock: 0 — Reorder immediately`, action:'inventory', color:T.red })),
    ...data.lowStock.filter(i=>(i.stock||0)>0).map(i => ({ type:'warning', icon:'⚠️', title:`Low Stock: ${i.name}`, body:`Only ${i.stock} left (reorder at ${i.alert||10})`, action:'inventory', color:T.amber })),
    ...data.overdueCustomers.slice(0,5).map(c => ({ type:'payment', icon:'💰', title:`Outstanding: ${c.name}`, body:`${fmt(c.outstanding)} pending`, action:'credit', color:T.red, customer:c })),
    ...data.pendingSales.slice(0,5).map(s => ({ type:'invoice', icon:'📄', title:`Pending Invoice: ${s.inv_num}`, body:`${s.customer||'Walk-in'} — ${fmt(s.total)}`, action:'sales', color:T.amber })),
  ] : [];

  const filtered = filter === 'all' ? allNotifications
    : allNotifications.filter(n => n.type === filter);

  return (
    <div style={{ padding:20 }}>
      <div style={{ fontSize:22, fontWeight:800, color:T.ink, marginBottom:20 }}>Notifications</div>

      {/* Today's summary */}
      {!loading && data && (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12, marginBottom:24 }}>
          {[
            ['Today Revenue',    fmt(data.todayRevenue),        data.todaySales.length + ' sales',    T.green],
            ['Month Revenue',    fmt(data.monthRevenue),        data.monthSales.length + ' invoices', T.blue],
            ['Low Stock Items',  data.lowStock.length,          data.outOfStock.length + ' out of stock', T.amber],
            ['Outstanding',      fmt(data.overdueCustomers.reduce((s,c)=>s+(c.outstanding||0),0)), data.overdueCustomers.length + ' customers', T.red],
          ].map(([label,val,sub,color]) => (
            <div key={label} style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:10, padding:'14px 18px' }}>
              <div style={{ fontSize:11, color:T.sub, fontWeight:700, textTransform:'uppercase', marginBottom:6 }}>{label}</div>
              <div style={{ fontSize:20, fontWeight:800, color }}>{val}</div>
              <div style={{ fontSize:11, color:T.muted, marginTop:3 }}>{sub}</div>
            </div>
          ))}
        </div>
      )}

      {/* Filter tabs */}
      <div style={{ display:'flex', gap:8, marginBottom:16 }}>
        {[
          ['all','All', allNotifications.length],
          ['critical','Critical', allNotifications.filter(n=>n.type==='critical').length],
          ['warning','Low Stock', allNotifications.filter(n=>n.type==='warning').length],
          ['payment','Payments', allNotifications.filter(n=>n.type==='payment').length],
          ['invoice','Invoices', allNotifications.filter(n=>n.type==='invoice').length],
        ].map(([id,label,count]) => (
          <button key={id} onClick={() => setFilter(id)} style={{
            background:filter===id?T.blue:T.srf, color:filter===id?'#fff':T.sub,
            border:`1px solid ${filter===id?T.blue:T.bdr}`, borderRadius:7,
            padding:'7px 14px', fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:'inherit',
            display:'flex', alignItems:'center', gap:6,
          }}>
            {label}
            {count > 0 && <span style={{ background:filter===id?'rgba(255,255,255,.3)':T.bdr, borderRadius:10, padding:'1px 7px', fontSize:10 }}>{count}</span>}
          </button>
        ))}
      </div>

      {loading ? <div style={{ textAlign:'center', color:T.sub, padding:60 }}>Loading…</div>
      : filtered.length === 0 ? (
        <div style={{ textAlign:'center', color:T.muted, padding:60 }}>
          <div style={{ fontSize:40, marginBottom:12 }}>✅</div>
          <div style={{ fontSize:16, fontWeight:600, color:T.sub }}>All clear!</div>
          <div style={{ fontSize:13, marginTop:6 }}>No notifications in this category</div>
        </div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          {filtered.map((notif, i) => (
            <div key={i} style={{ background:T.srf, border:`1px solid ${notif.color}44`, borderRadius:12, padding:'14px 18px', display:'flex', alignItems:'center', gap:14 }}>
              <div style={{ width:44, height:44, borderRadius:'50%', background:notif.color+'22', display:'flex', alignItems:'center', justifyContent:'center', fontSize:22, flexShrink:0 }}>
                {notif.icon}
              </div>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:14, fontWeight:700, color:T.ink }}>{notif.title}</div>
                <div style={{ fontSize:12, color:T.muted, marginTop:3 }}>{notif.body}</div>
              </div>
              <div style={{ display:'flex', gap:8 }}>
                {notif.customer && (
                  <button onClick={() => sendWhatsAppReminder(notif.customer)}
                    style={{ background:'#25d36622', color:'#25d366', border:'none', borderRadius:7, padding:'6px 12px', fontSize:11, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>
                    💬 Remind
                  </button>
                )}
                <button onClick={() => onNavigate?.(notif.action)}
                  style={{ background:notif.color+'22', color:notif.color, border:'none', borderRadius:7, padding:'6px 14px', fontSize:11, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>
                  View →
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
