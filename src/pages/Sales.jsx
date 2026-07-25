import { useState, useEffect } from 'react';
import { getSales } from '../lib/supabase';
import { generateInvoicePDF, shareInvoiceWhatsApp } from '../lib/pdf';

const T = { bg:'#060710', srf:'#0f1220', card:'#141828', bdr:'#1e2540', blue:'#4f7cff', ink:'#eef0f8', sub:'#6b7598', muted:'#4a5175', green:'#00d68f', amber:'#ffb547', red:'#ff4d6a' };
const fmt = n => 'Rs.' + (n||0).toLocaleString('en-IN', { maximumFractionDigits:0 });

const STATUS_COLORS = { paid:'#00d68f', pending:'#ffb547', overdue:'#ff4d6a', cancelled:'#4a5175', draft:'#6b7598' };

export default function Sales({ tenant }) {
  const [sales,    setSales]    = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [search,   setSearch]   = useState('');
  const [selected, setSelected] = useState(null);
  const [period,   setPeriod]   = useState('this_month');
  const [pdfBusy,  setPdfBusy]  = useState(null);

  useEffect(() => { if (tenant?.id) load(); }, [tenant?.id]);

  async function load() {
    setLoading(true);
    const data = await getSales(tenant.id, 500);
    setSales(data);
    setLoading(false);
  }

  const now = new Date();
  const yr  = now.getFullYear();
  const mo  = String(now.getMonth()+1).padStart(2,'0');

  const filtered = sales.filter(s => {
    const matchSearch = !search || s.inv_num?.toLowerCase().includes(search.toLowerCase()) || s.customer?.toLowerCase().includes(search.toLowerCase());
    const d = s.date || '';
    const matchPeriod =
      period === 'all'        ? true :
      period === 'today'      ? d === now.toISOString().slice(0,10) :
      period === 'this_week'  ? d >= new Date(now - now.getDay()*86400000).toISOString().slice(0,10) :
      period === 'this_month' ? d >= `${yr}-${mo}-01` :
      period === 'this_year'  ? d >= `${yr}-01-01` : true;
    return matchSearch && matchPeriod;
  });

  const totalRevenue = filtered.reduce((s, x) => s + (x.total||0), 0);

  async function handlePDF(sale) {
    setPdfBusy(sale.id);
    await generateInvoicePDF(sale, tenant).catch(e => alert('PDF error: ' + e.message));
    setPdfBusy(null);
  }

  const PERIODS = [
    { id:'today',      label:'Today' },
    { id:'this_week',  label:'This Week' },
    { id:'this_month', label:'This Month' },
    { id:'this_year',  label:'This Year' },
    { id:'all',        label:'All Time' },
  ];

  return (
    <div style={{ padding:20 }}>
      {/* Header */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
        <div>
          <div style={{ fontSize:22, fontWeight:800, color:T.ink }}>Sales History</div>
          <div style={{ fontSize:13, color:T.sub }}>{filtered.length} invoices · {fmt(totalRevenue)}</div>
        </div>
      </div>

      {/* Filters */}
      <div style={{ display:'flex', gap:10, marginBottom:16, flexWrap:'wrap' }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 Search invoice or customer…"
          style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:8, padding:'8px 12px', color:T.ink, fontSize:13, fontFamily:'inherit', outline:'none', flex:1, minWidth:200 }} />
        <div style={{ display:'flex', gap:6 }}>
          {PERIODS.map(p => (
            <button key={p.id} onClick={() => setPeriod(p.id)} style={{
              background:period===p.id?T.blue:T.srf, color:period===p.id?'#fff':T.sub,
              border:`1px solid ${period===p.id?T.blue:T.bdr}`, borderRadius:7, padding:'8px 12px', fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:'inherit'
            }}>{p.label}</button>
          ))}
        </div>
      </div>

      {/* Stats row */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12, marginBottom:16 }}>
        {[
          ['Invoices',   filtered.length,                                                         T.blue],
          ['Revenue',    fmt(totalRevenue),                                                        T.green],
          ['Avg Order',  fmt(filtered.length > 0 ? totalRevenue/filtered.length : 0),             T.blue],
          ['Overdue',    filtered.filter(s=>s.status==='overdue').length + ' invoices',            T.red],
        ].map(([label,val,color]) => (
          <div key={label} style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:10, padding:'12px 16px' }}>
            <div style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', marginBottom:5 }}>{label}</div>
            <div style={{ fontSize:18, fontWeight:800, color }}>{val}</div>
          </div>
        ))}
      </div>

      {/* Sales table */}
      <div style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:12, overflow:'hidden' }}>
        <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
          <thead>
            <tr style={{ background:T.card }}>
              {['Invoice','Date','Customer','Items','GST','Total','Mode','Status','Actions'].map(h => (
                <th key={h} style={{ padding:'10px 14px', textAlign:'left', fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', letterSpacing:'.04em', borderBottom:`1px solid ${T.bdr}` }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={9} style={{ textAlign:'center', padding:40, color:T.sub }}>Loading…</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={9} style={{ textAlign:'center', padding:40, color:T.muted }}>No sales found for this period</td></tr>
            ) : filtered.map(sale => (
              <tr key={sale.id} style={{ borderBottom:`1px solid ${T.bdr}22`, cursor:'pointer' }}
                onMouseEnter={e => e.currentTarget.style.background=T.card}
                onMouseLeave={e => e.currentTarget.style.background='transparent'}
                onClick={() => setSelected(selected?.id===sale.id ? null : sale)}>
                <td style={{ padding:'10px 14px', color:T.blue, fontFamily:'monospace', fontSize:12 }}>{sale.inv_num}</td>
                <td style={{ padding:'10px 14px', color:T.sub }}>{sale.date}</td>
                <td style={{ padding:'10px 14px', color:T.ink, fontWeight:600 }}>{sale.customer||'Walk-in'}</td>
                <td style={{ padding:'10px 14px', color:T.sub }}>{(sale.items||[]).length}</td>
                <td style={{ padding:'10px 14px', color:T.sub }}>Rs.{(sale.gst_amount||0).toFixed(0)}</td>
                <td style={{ padding:'10px 14px', color:T.green, fontWeight:700 }}>{fmt(sale.total)}</td>
                <td style={{ padding:'10px 14px' }}>
                  <span style={{ background:T.blue+'22', color:T.blue, borderRadius:5, padding:'2px 8px', fontSize:11, textTransform:'capitalize' }}>{sale.payment_mode||'cash'}</span>
                </td>
                <td style={{ padding:'10px 14px' }}>
                  <span style={{ background:(STATUS_COLORS[sale.status]||T.muted)+'22', color:STATUS_COLORS[sale.status]||T.muted, borderRadius:5, padding:'2px 8px', fontSize:11, textTransform:'capitalize', fontWeight:600 }}>{sale.status||'paid'}</span>
                </td>
                <td style={{ padding:'10px 14px' }} onClick={e => e.stopPropagation()}>
                  <div style={{ display:'flex', gap:6 }}>
                    <button onClick={() => handlePDF(sale)} disabled={pdfBusy===sale.id}
                      style={{ background:T.blue+'22', color:T.blue, border:'none', borderRadius:6, padding:'4px 10px', fontSize:11, cursor:'pointer', fontFamily:'inherit' }}>
                      {pdfBusy===sale.id ? '…' : '📄 PDF'}
                    </button>
                    <button onClick={() => shareInvoiceWhatsApp(sale, tenant)}
                      style={{ background:'#25d36622', color:'#25d366', border:'none', borderRadius:6, padding:'4px 10px', fontSize:11, cursor:'pointer', fontFamily:'inherit' }}>
                      💬
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Expanded sale details */}
      {selected && (
        <div style={{ marginTop:16, background:T.srf, border:`1px solid ${T.blue}44`, borderRadius:12, padding:20 }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
            <div style={{ fontSize:15, fontWeight:700, color:T.ink }}>{selected.inv_num} · {selected.customer||'Walk-in'}</div>
            <button onClick={() => setSelected(null)} style={{ background:'none', border:'none', color:T.muted, cursor:'pointer', fontSize:20 }}>×</button>
          </div>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
            <thead>
              <tr style={{ background:T.card }}>
                {['Item','Qty','Rate','GST%','Amount'].map(h => (
                  <th key={h} style={{ padding:'8px 12px', textAlign:'left', fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', borderBottom:`1px solid ${T.bdr}` }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(selected.items||[]).map((item,i) => (
                <tr key={i} style={{ borderBottom:`1px solid ${T.bdr}22` }}>
                  <td style={{ padding:'8px 12px', color:T.ink }}>{item.name}</td>
                  <td style={{ padding:'8px 12px', color:T.sub }}>{item.qty}</td>
                  <td style={{ padding:'8px 12px', color:T.sub }}>Rs.{item.rate}</td>
                  <td style={{ padding:'8px 12px', color:T.sub }}>{item.gst||18}%</td>
                  <td style={{ padding:'8px 12px', color:T.green, fontWeight:700 }}>Rs.{(item.amount||0).toFixed(2)}</td>
                </tr>
              ))}
              <tr>
                <td colSpan={4} style={{ padding:'10px 12px', textAlign:'right', fontSize:14, fontWeight:700, color:T.ink }}>Total</td>
                <td style={{ padding:'10px 12px', fontSize:16, fontWeight:800, color:T.green }}>Rs.{(selected.total||0).toFixed(2)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
