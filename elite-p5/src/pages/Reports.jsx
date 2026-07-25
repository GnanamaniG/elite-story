import { useState, useEffect } from 'react';
import { getSales, getExpenses, getPurchases, getInventory } from '../lib/supabase';

const T = { bg:'#060710', srf:'#0f1220', card:'#141828', bdr:'#1e2540', blue:'#4f7cff', purple:'#9b72ff', ink:'#eef0f8', sub:'#6b7598', muted:'#4a5175', green:'#00d68f', amber:'#ffb547', red:'#ff4d6a', teal:'#00c9b1' };
const fmt  = n => '₹' + (n||0).toLocaleString('en-IN', { maximumFractionDigits:0 });
const fmtD = n => '₹' + (n||0).toLocaleString('en-IN', { minimumFractionDigits:2, maximumFractionDigits:2 });

export default function Reports({ tenant }) {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [period,  setPeriod]  = useState('this_month');

  useEffect(() => { if (tenant?.id) loadData(); }, [tenant?.id, period]);

  async function loadData() {
    setLoading(true);
    try {
      const [sales, expenses, purchases, inventory] = await Promise.all([
        getSales(tenant.id, 1000),
        getExpenses(tenant.id),
        getPurchases(tenant.id),
        getInventory(tenant.id),
      ]);

      const now = new Date();
      const yr  = now.getFullYear();
      const mo  = String(now.getMonth()+1).padStart(2,'0');
      const weekStart = new Date(now - now.getDay()*86400000).toISOString().slice(0,10);

      const filter = d => {
        if (period === 'today')      return d === now.toISOString().slice(0,10);
        if (period === 'this_week')  return d >= weekStart;
        if (period === 'this_month') return d >= `${yr}-${mo}-01`;
        if (period === 'this_year')  return d >= `${yr}-01-01`;
        return true;
      };

      const filtSales = sales.filter(s => filter(s.date));
      const filtExp   = expenses.filter(e => filter(e.date));
      const filtPurch = purchases.filter(p => filter(p.date));

      const revenue   = filtSales.reduce((s, x) => s + (x.total||0), 0);
      const cogs      = filtPurch.reduce((s, x) => s + (x.total||0), 0);
      const expTotal  = filtExp.reduce((s, x) => s + (x.amount||0), 0);
      const gstColl   = filtSales.reduce((s, x) => s + (x.gst_amount||0), 0);
      const grossProfit = revenue - cogs;
      const netProfit   = grossProfit - expTotal;

      // Top selling items
      const itemSales = {};
      filtSales.forEach(s => {
        (s.items||[]).forEach(item => {
          if (!itemSales[item.name]) itemSales[item.name] = { qty:0, revenue:0 };
          itemSales[item.name].qty     += item.qty||0;
          itemSales[item.name].revenue += item.amount||0;
        });
      });
      const topItems = Object.entries(itemSales).sort((a,b) => b[1].revenue - a[1].revenue).slice(0, 8);

      // Monthly sales trend (last 6 months)
      const trend = {};
      sales.forEach(s => {
        const mo = s.date?.slice(0,7);
        if (mo) trend[mo] = (trend[mo]||0) + (s.total||0);
      });
      const trendData = Object.entries(trend).sort().slice(-6);

      // GST by rate
      const gstBreakdown = {};
      filtSales.forEach(s => {
        (s.items||[]).forEach(item => {
          const rate = item.gst||18;
          if (!gstBreakdown[rate]) gstBreakdown[rate] = { taxable:0, gst:0 };
          const taxable = item.amount||0;
          const gstAmt  = taxable * rate / (100+rate);
          gstBreakdown[rate].taxable += taxable - gstAmt;
          gstBreakdown[rate].gst     += gstAmt;
        });
      });

      // Payment mode breakdown
      const payModes = filtSales.reduce((acc, s) => {
        const m = s.payment_mode||'cash';
        acc[m] = (acc[m]||0) + (s.total||0);
        return acc;
      }, {});

      setData({ revenue, cogs, expTotal, gstColl, grossProfit, netProfit, orders:filtSales.length, topItems, trendData, gstBreakdown, payModes, inventory });
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }

  const PERIODS = [
    { id:'today',      label:'Today' },
    { id:'this_week',  label:'This Week' },
    { id:'this_month', label:'This Month' },
    { id:'this_year',  label:'This Year' },
  ];

  const Card = ({ label, value, color, sub }) => (
    <div style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:10, padding:'16px 18px' }}>
      <div style={{ fontSize:11, color:T.sub, fontWeight:700, textTransform:'uppercase', marginBottom:8 }}>{label}</div>
      <div style={{ fontSize:22, fontWeight:800, color }}>{value}</div>
      {sub && <div style={{ fontSize:11, color:T.muted, marginTop:4 }}>{sub}</div>}
    </div>
  );

  return (
    <div style={{ padding:20 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
        <div style={{ fontSize:22, fontWeight:800, color:T.ink }}>Reports</div>
        <div style={{ display:'flex', gap:6 }}>
          {PERIODS.map(p => (
            <button key={p.id} onClick={() => setPeriod(p.id)} style={{ background:period===p.id?T.blue:T.srf, color:period===p.id?'#fff':T.sub, border:`1px solid ${period===p.id?T.blue:T.bdr}`, borderRadius:7, padding:'6px 12px', fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}>{p.label}</button>
          ))}
        </div>
      </div>

      {loading ? <div style={{ textAlign:'center', color:T.sub, padding:60 }}>Loading reports…</div> : data && (
        <>
          {/* P&L Summary */}
          <div style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:12, padding:20, marginBottom:16 }}>
            <div style={{ fontWeight:700, color:T.ink, marginBottom:14, fontSize:15 }}>📊 Profit & Loss Summary</div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:12 }}>
              <Card label="Revenue"      value={fmt(data.revenue)}     color={T.blue}   sub={`${data.orders} invoices`} />
              <Card label="Cost (COGS)"  value={fmt(data.cogs)}        color={T.amber}  sub="Purchase cost" />
              <Card label="Expenses"     value={fmt(data.expTotal)}    color={T.red}    sub="Operating cost" />
              <Card label="Gross Profit" value={fmt(data.grossProfit)} color={data.grossProfit>=0?T.green:T.red} sub={`Margin ${data.revenue>0?Math.round(data.grossProfit/data.revenue*100):0}%`} />
              <Card label="Net Profit"   value={fmt(data.netProfit)}   color={data.netProfit>=0?T.green:T.red} sub="After all expenses" />
            </div>
          </div>

          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, marginBottom:16 }}>
            {/* Top Items */}
            <div style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:12, overflow:'hidden' }}>
              <div style={{ padding:'12px 16px', borderBottom:`1px solid ${T.bdr}`, fontWeight:700, color:T.ink }}>🏆 Top Selling Items</div>
              <div style={{ padding:12 }}>
                {data.topItems.length === 0 ? (
                  <div style={{ color:T.muted, fontSize:12, textAlign:'center', padding:20 }}>No sales data for this period</div>
                ) : data.topItems.map(([name, item], i) => (
                  <div key={name} style={{ display:'flex', alignItems:'center', gap:10, padding:'7px 0', borderBottom:`1px solid ${T.bdr}22` }}>
                    <div style={{ width:22, height:22, borderRadius:6, background:T.blue+'22', color:T.blue, fontSize:11, fontWeight:800, display:'flex', alignItems:'center', justifyContent:'center' }}>{i+1}</div>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:13, color:T.ink }}>{name}</div>
                      <div style={{ fontSize:10, color:T.muted }}>{item.qty} units sold</div>
                    </div>
                    <div style={{ fontSize:13, fontWeight:700, color:T.green }}>{fmt(item.revenue)}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* GST Summary */}
            <div style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:12, overflow:'hidden' }}>
              <div style={{ padding:'12px 16px', borderBottom:`1px solid ${T.bdr}`, fontWeight:700, color:T.ink }}>📋 GST Summary</div>
              <div style={{ padding:16 }}>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8, marginBottom:16 }}>
                  {[['GST Rate','Taxable Value','GST Collected']].concat(
                    Object.entries(data.gstBreakdown).sort().map(([rate, vals]) => [rate+'%', fmtD(vals.taxable), fmtD(vals.gst)])
                  ).map((row, i) => (
                    <div key={i} style={{ display:'contents' }}>
                      {row.map((cell, j) => (
                        <div key={j} style={{ padding:'6px 8px', background:i===0?T.card:'transparent', borderBottom:`1px solid ${T.bdr}33`, fontSize:i===0?10:12, color:i===0?T.sub:j===0?T.ink:j===2?T.teal:T.sub, fontWeight:i===0?700:j===2?700:400, textTransform:i===0?'uppercase':'none' }}>{cell}</div>
                      ))}
                    </div>
                  ))}
                </div>
                <div style={{ background:T.card, borderRadius:8, padding:'10px 14px', display:'flex', justifyContent:'space-between' }}>
                  <span style={{ fontSize:13, fontWeight:700, color:T.ink }}>Total GST Collected</span>
                  <span style={{ fontSize:14, fontWeight:800, color:T.teal }}>{fmtD(data.gstColl)}</span>
                </div>
              </div>
            </div>
          </div>

          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
            {/* Payment modes */}
            <div style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:12, overflow:'hidden' }}>
              <div style={{ padding:'12px 16px', borderBottom:`1px solid ${T.bdr}`, fontWeight:700, color:T.ink }}>💳 Payment Modes</div>
              <div style={{ padding:16 }}>
                {Object.entries(data.payModes).map(([mode, amount]) => (
                  <div key={mode} style={{ display:'flex', justifyContent:'space-between', padding:'7px 0', borderBottom:`1px solid ${T.bdr}22`, fontSize:13 }}>
                    <span style={{ color:T.ink, textTransform:'capitalize' }}>{mode}</span>
                    <span style={{ color:T.blue, fontWeight:700 }}>{fmt(amount)}</span>
                  </div>
                ))}
                {!Object.keys(data.payModes).length && <div style={{ color:T.muted, textAlign:'center', padding:20, fontSize:12 }}>No data</div>}
              </div>
            </div>

            {/* Inventory value */}
            <div style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:12, overflow:'hidden' }}>
              <div style={{ padding:'12px 16px', borderBottom:`1px solid ${T.bdr}`, fontWeight:700, color:T.ink }}>📦 Inventory Value</div>
              <div style={{ padding:16 }}>
                {[
                  ['Total Items',    data.inventory.length,                                       T.blue],
                  ['Stock Value (CP)', fmt(data.inventory.reduce((s,i)=>s+(i.stock||0)*(i.cp||0),0)), T.amber],
                  ['Stock Value (SP)', fmt(data.inventory.reduce((s,i)=>s+(i.stock||0)*(i.sp||0),0)), T.green],
                  ['Low Stock Items', data.inventory.filter(i=>(i.stock||0)<=(i.alert||10)).length, T.red],
                ].map(([label, val, color]) => (
                  <div key={label} style={{ display:'flex', justifyContent:'space-between', padding:'7px 0', borderBottom:`1px solid ${T.bdr}22`, fontSize:13 }}>
                    <span style={{ color:T.sub }}>{label}</span>
                    <span style={{ color, fontWeight:700 }}>{val}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
