import { useState, useEffect } from 'react';
import { getSales, getInventory, getCustomers, getExpenses } from '../lib/supabase';

const T = { bg:'#060710', srf:'#0f1220', card:'#141828', bdr:'#1e2540', blue:'#4f7cff', purple:'#9b72ff', teal:'#00c9b1', ink:'#eef0f8', sub:'#6b7598', muted:'#4a5175', green:'#00d68f', amber:'#ffb547', red:'#ff4d6a' };
const fmt = n => '₹' + (n||0).toLocaleString('en-IN', { maximumFractionDigits:0 });

const PERIODS = [
  { id:'today',      label:'Today' },
  { id:'this_week',  label:'This Week' },
  { id:'this_month', label:'This Month' },
  { id:'this_year',  label:'This Year' },
];

export default function Dashboard({ tenant, onNavigate }) {
  const [period,  setPeriod]  = useState('this_month');
  const [stats,   setStats]   = useState(null);
  const [loading, setLoading] = useState(true);
  const [recent,  setRecent]  = useState([]);

  useEffect(() => {
    if (!tenant?.id) return;
    loadStats();
  }, [tenant?.id, period]);

  async function loadStats() {
    setLoading(true);
    try {
      const [sales, inventory, customers, expenses] = await Promise.all([
        getSales(tenant.id, 500),
        getInventory(tenant.id),
        getCustomers(tenant.id),
        getExpenses(tenant.id),
      ]);

      const now   = new Date();
      const today = now.toISOString().slice(0,10);
      const yr    = now.getFullYear();
      const mo    = String(now.getMonth()+1).padStart(2,'0');
      const weekStart = new Date(now - now.getDay()*86400000).toISOString().slice(0,10);

      const filter = d => {
        if (period === 'today')      return d === today;
        if (period === 'this_week')  return d >= weekStart;
        if (period === 'this_month') return d >= `${yr}-${mo}-01`;
        if (period === 'this_year')  return d >= `${yr}-01-01`;
        return true;
      };

      const filtSales = sales.filter(s => filter(s.date));
      const filtExp   = expenses.filter(e => filter(e.date));

      const revenue  = filtSales.reduce((s, x) => s + (x.total||0), 0);
      const expTotal = filtExp.reduce((s, x) => s + (x.amount||0), 0);
      const orders   = filtSales.length;
      const aov      = orders > 0 ? revenue / orders : 0;
      const lowStock = inventory.filter(i => (i.stock||0) <= (i.alert||10)).length;
      const outstanding = customers.reduce((s, c) => s + (c.outstanding||0), 0);

      setStats({ revenue, expTotal, orders, aov, lowStock, outstanding, customers: customers.length, items: inventory.length });
      setRecent(sales.slice(0, 8));
    } catch (e) {
      console.error('Dashboard error:', e);
    } finally {
      setLoading(false);
    }
  }

  const KPI = ({ label, value, sub, color, icon, onClick }) => (
    <div onClick={onClick} style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:12, padding:'18px 20px', cursor:onClick?'pointer':'default' }}
      onMouseEnter={e => onClick && (e.currentTarget.style.borderColor=T.blue)}
      onMouseLeave={e => onClick && (e.currentTarget.style.borderColor=T.bdr)}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:10 }}>
        <div style={{ fontSize:11, fontWeight:700, color:T.sub, textTransform:'uppercase', letterSpacing:'.05em' }}>{label}</div>
        <span style={{ fontSize:20 }}>{icon}</span>
      </div>
      <div style={{ fontSize:26, fontWeight:800, color, marginBottom:4 }}>{value}</div>
      {sub && <div style={{ fontSize:12, color:T.muted }}>{sub}</div>}
    </div>
  );

  return (
    <div style={{ padding:20 }}>
      {/* Header */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
        <div>
          <div style={{ fontSize:22, fontWeight:800, color:T.ink }}>{tenant?.name || 'Elite Store'}</div>
          <div style={{ fontSize:13, color:T.sub }}>Business Dashboard</div>
        </div>
        <div style={{ display:'flex', gap:6 }}>
          {PERIODS.map(p => (
            <button key={p.id} onClick={() => setPeriod(p.id)} style={{
              background: period===p.id ? T.blue : T.srf,
              color: period===p.id ? '#fff' : T.sub,
              border: `1px solid ${period===p.id ? T.blue : T.bdr}`,
              borderRadius:7, padding:'6px 12px', fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:'inherit'
            }}>{p.label}</button>
          ))}
        </div>
      </div>

      {loading ? (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:14 }}>
          {[...Array(8)].map((_,i) => <div key={i} style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:12, height:110, opacity:.4 }} />)}
        </div>
      ) : (
        <>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:14, marginBottom:14 }}>
            <KPI label="Revenue"     value={fmt(stats?.revenue)}     sub={`${stats?.orders} invoices`}         color={T.blue}   icon="💰" onClick={() => onNavigate('pos')} />
            <KPI label="Gross Profit" value={fmt((stats?.revenue||0)-(stats?.expTotal||0))} sub={`Expenses: ${fmt(stats?.expTotal)}`} color={T.green}  icon="📈" />
            <KPI label="Avg Order"   value={fmt(stats?.aov)}         sub="Per invoice"                         color={T.purple} icon="🧾" />
            <KPI label="Outstanding" value={fmt(stats?.outstanding)}  sub={`${stats?.customers} customers`}    color={stats?.outstanding>0?T.amber:T.green} icon="👥" onClick={() => onNavigate('customers')} />
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:14, marginBottom:24 }}>
            <KPI label="Customers"  value={stats?.customers||0}  sub="Total parties"          color={T.teal}   icon="👥" onClick={() => onNavigate('customers')} />
            <KPI label="Items"      value={stats?.items||0}      sub="In inventory"           color={T.purple} icon="📦" onClick={() => onNavigate('inventory')} />
            <KPI label="Low Stock"  value={stats?.lowStock||0}   sub="Below reorder"          color={stats?.lowStock>0?T.amber:T.green} icon="⚠️" onClick={() => onNavigate('inventory')} />
            <KPI label="Expenses"   value={fmt(stats?.expTotal)} sub="Operating cost"         color={T.red}    icon="💸" onClick={() => onNavigate('expenses')} />
          </div>

          {/* Recent sales */}
          <div style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:12, overflow:'hidden' }}>
            <div style={{ padding:'14px 18px', borderBottom:`1px solid ${T.bdr}`, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <div style={{ fontWeight:700, color:T.ink }}>Recent Sales</div>
              <button onClick={() => onNavigate('pos')} style={{ background:'none', border:'none', color:T.blue, cursor:'pointer', fontSize:12, fontFamily:'inherit' }}>New Sale →</button>
            </div>
            {recent.length === 0 ? (
              <div style={{ padding:40, textAlign:'center', color:T.muted }}>
                <div style={{ fontSize:32, marginBottom:12 }}>🛒</div>
                <div style={{ fontSize:14, fontWeight:600, color:T.sub, marginBottom:8 }}>No sales yet</div>
                <button onClick={() => onNavigate('pos')} style={{ background:T.blue, color:'#fff', border:'none', borderRadius:8, padding:'10px 20px', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>
                  Create First Sale
                </button>
              </div>
            ) : (
              <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
                <thead>
                  <tr style={{ background:T.card }}>
                    {['Invoice','Date','Customer','Items','Total','Mode'].map(h => (
                      <th key={h} style={{ padding:'9px 14px', textAlign:'left', fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', letterSpacing:'.04em', borderBottom:`1px solid ${T.bdr}` }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {recent.map(s => (
                    <tr key={s.id} style={{ borderBottom:`1px solid ${T.bdr}22` }}>
                      <td style={{ padding:'9px 14px', color:T.blue, fontFamily:'monospace', fontSize:12 }}>{s.inv_num}</td>
                      <td style={{ padding:'9px 14px', color:T.sub }}>{s.date}</td>
                      <td style={{ padding:'9px 14px', color:T.ink }}>{s.customer||'Walk-in'}</td>
                      <td style={{ padding:'9px 14px', color:T.sub }}>{(s.items||[]).length} items</td>
                      <td style={{ padding:'9px 14px', color:T.green, fontWeight:700 }}>{fmt(s.total)}</td>
                      <td style={{ padding:'9px 14px' }}>
                        <span style={{ background:T.blue+'22', color:T.blue, borderRadius:5, padding:'2px 8px', fontSize:11, fontWeight:600, textTransform:'capitalize' }}>{s.payment_mode||'cash'}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  );
}
