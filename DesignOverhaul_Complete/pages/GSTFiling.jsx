import { useState, useEffect } from 'react';
import { getSales, getPurchases } from '../lib/supabase';
import { computeGSTR1, exportGSTR1JSON, computeGSTR3B } from '../lib/gst';

const T = {
  bg:'#060710', srf:'#0b0d1a', card:'#0f1220', card2:'#141828',
  bdr:'#1a1e32', bdr2:'#222740',
  blue:'#4f7cff', green:'#00d68f', red:'#ff4d6a', amber:'#ffb547',
  purple:'#9b72ff', teal:'#00c9b1', orange:'#ff7043', gold:'#ffc107',
  cyan:'#00d4ff', pink:'#f06292',
  muted:'#4a5175', dim:'#2a3050', card3:'#181d2e',
  ink:'#eef0f8', sub:'#8892b0'
};
const fmt  = n => 'Rs.' + (n||0).toLocaleString('en-IN', { maximumFractionDigits:2, minimumFractionDigits:2 });
const fmtN = n => (n||0).toLocaleString('en-IN', { maximumFractionDigits:0 });

const MONTHS = [
  { value:'2025-04', label:'April 2025' },
  { value:'2025-05', label:'May 2025' },
  { value:'2025-06', label:'June 2025' },
  { value:'2025-07', label:'July 2025' },
  { value:'2025-08', label:'August 2025' },
  { value:'2025-09', label:'September 2025' },
  { value:'2025-10', label:'October 2025' },
  { value:'2025-11', label:'November 2025' },
  { value:'2025-12', label:'December 2025' },
  { value:'2026-01', label:'January 2026' },
  { value:'2026-02', label:'February 2026' },
  { value:'2026-03', label:'March 2026' },
];

export default function GSTFiling({ tenant }) {
  const [tab,       setTab]       = useState('gstr1');
  const [period,    setPeriod]    = useState('2025-07');
  const [sales,     setSales]     = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [gstr1,     setGstr1]     = useState(null);
  const [gstr3b,    setGstr3b]    = useState(null);

  useEffect(() => { if (tenant?.id) loadData(); }, [tenant?.id, period]);

  async function loadData() {
    setLoading(true);
    try {
      const [s, p] = await Promise.all([getSales(tenant.id, 1000), getPurchases(tenant.id)]);
      const filtSales = s.filter(x => (x.date || '').startsWith(period));
      const filtPurch = p.filter(x => (x.date || '').startsWith(period));
      setSales(filtSales);
      setPurchases(filtPurch);
      setGstr1(computeGSTR1(filtSales, tenant.gstin));
      setGstr3b(computeGSTR3B(filtSales, filtPurch));
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }

  const totalRevenue = sales.reduce((s, x) => s + (x.total||0), 0);
  const totalGST     = sales.reduce((s, x) => s + (x.gst_amount||0), 0);
  const totalTaxable = totalRevenue - totalGST;

  const TABS = [
    { id:'gstr1', label:'GSTR-1', sub:'Outward Supplies' },
    { id:'gstr3b', label:'GSTR-3B', sub:'Summary Return' },
    { id:'hsn', label:'HSN Summary', sub:'Item-wise GST' },
    { id:'tally', label:'Tally Export', sub:'XML for Tally' },
  ];

  return (
    <div style={{ padding:20 }}>
      {/* Header */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
        <div>
          <div style={{ fontSize:22, fontWeight:800, color:T.ink }}>GST Filing</div>
          <div style={{ fontSize:13, color:T.sub }}>GSTIN: <span style={{ color:T.teal, fontFamily:'monospace' }}>{tenant?.gstin || 'Not set — update in Settings'}</span></div>
        </div>
        <select value={period} onChange={e => setPeriod(e.target.value)}
          style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:8, padding:'9px 14px', color:T.ink, fontSize:13, fontFamily:'inherit', outline:'none' }}>
          {MONTHS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
        </select>
      </div>

      {/* Summary KPIs */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12, marginBottom:20 }}>
        {[
          ['Invoices',       sales.length,    T.blue],
          ['Taxable Value',  fmt(totalTaxable), T.ink],
          ['GST Collected',  fmt(totalGST),   T.green],
          ['Total Revenue',  fmt(totalRevenue), T.amber],
        ].map(([label, val, color]) => (
          <div key={label} style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:10, padding:'14px 16px' }}>
            <div style={{ fontSize:11, color:T.sub, fontWeight:700, textTransform:'uppercase', marginBottom:6 }}>{label}</div>
            <div style={{ fontSize:20, fontWeight:800, color }}>{val}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display:'flex', gap:6, marginBottom:16 }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            background:tab===t.id?T.blue:T.srf, color:tab===t.id?'#fff':T.sub,
            border:`1px solid ${tab===t.id?T.blue:T.bdr}`, borderRadius:8,
            padding:'8px 16px', fontSize:13, fontWeight:600, cursor:'pointer', fontFamily:'inherit'
          }}>
            {t.label} <span style={{ fontSize:10, opacity:.7 }}>· {t.sub}</span>
          </button>
        ))}
      </div>

      {loading ? <div style={{ textAlign:'center', color:T.sub, padding:60 }}>Loading GST data…</div> : (

        <>
          {/* GSTR-1 Tab */}
          {tab === 'gstr1' && (
            <div>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
                <div style={{ fontSize:14, fontWeight:700, color:T.ink }}>GSTR-1 — Outward Supplies</div>
                <div style={{ display:'flex', gap:8 }}>
                  <button onClick={() => exportGSTR1JSON(sales, tenant, period)}
                    style={{ background:T.green+'22', color:T.green, border:`1px solid ${T.green}44`, borderRadius:8, padding:'8px 16px', fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>
                    ⬇️ Download GSTR-1 JSON
                  </button>
                </div>
              </div>

              {/* B2B Section */}
              <div style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:12, overflow:'hidden', marginBottom:16 }}>
                <div style={{ padding:'12px 16px', background:T.card, borderBottom:`1px solid ${T.bdr}`, display:'flex', justifyContent:'space-between' }}>
                  <span style={{ fontWeight:700, color:T.ink }}>B2B Supplies (GST Registered Customers)</span>
                  <span style={{ color:T.sub, fontSize:12 }}>{(gstr1?.b2b||[]).length} parties</span>
                </div>
                {(gstr1?.b2b||[]).length === 0 ? (
                  <div style={{ padding:24, textAlign:'center', color:T.muted, fontSize:13 }}>No B2B invoices this period</div>
                ) : (
                  <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
                    <thead>
                      <tr style={{ background:T.card }}>
                        {['Customer GSTIN','Name','Invoices','Total Value'].map(h => (
                          <th key={h} style={{ padding:'8px 14px', textAlign:'left', fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', borderBottom:`1px solid ${T.bdr}` }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {(gstr1?.b2b||[]).map(party => (
                        <tr key={party.gstin} style={{ borderBottom:`1px solid ${T.bdr}22` }}>
                          <td style={{ padding:'10px 14px', fontFamily:'monospace', color:T.teal, fontSize:12 }}>{party.gstin}</td>
                          <td style={{ padding:'10px 14px', color:T.ink }}>{party.name}</td>
                          <td style={{ padding:'10px 14px', color:T.sub }}>{party.invoices.length}</td>
                          <td style={{ padding:'10px 14px', color:T.green, fontWeight:700 }}>
                            {fmt(party.invoices.reduce((s,i) => s+(i.val||0), 0))}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              {/* B2C Section */}
              <div style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:12, padding:16 }}>
                <div style={{ fontWeight:700, color:T.ink, marginBottom:12 }}>B2C Supplies (Walk-in / Unregistered Customers)</div>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12 }}>
                  {[
                    ['Invoices', sales.filter(s => !s.customer_gstin).length, T.blue],
                    ['Taxable Value', fmt(sales.filter(s=>!s.customer_gstin).reduce((a,s)=>a+(s.subtotal||0)-(s.gst_amount||0),0)), T.ink],
                    ['GST Amount', fmt(sales.filter(s=>!s.customer_gstin).reduce((a,s)=>a+(s.gst_amount||0),0)), T.green],
                  ].map(([label, val, color]) => (
                    <div key={label} style={{ background:T.card, borderRadius:8, padding:'12px 14px' }}>
                      <div style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', marginBottom:4 }}>{label}</div>
                      <div style={{ fontSize:18, fontWeight:800, color }}>{val}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* GSTR-3B Tab */}
          {tab === 'gstr3b' && gstr3b && (
            <div>
              <div style={{ fontWeight:700, color:T.ink, marginBottom:16 }}>GSTR-3B Summary — {MONTHS.find(m=>m.value===period)?.label}</div>

              {/* Section 3.1 - Outward */}
              <div style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:12, overflow:'hidden', marginBottom:16 }}>
                <div style={{ padding:'12px 16px', background:T.blue+'18', borderBottom:`1px solid ${T.bdr}`, fontWeight:700, color:T.blue }}>
                  3.1 Details of Outward Supplies
                </div>
                <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
                  <thead>
                    <tr style={{ background:T.card }}>
                      {['Nature','Taxable Value','IGST','CGST','SGST','Total Tax'].map(h => (
                        <th key={h} style={{ padding:'8px 14px', textAlign:'right', fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', borderBottom:`1px solid ${T.bdr}` }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <tr style={{ borderBottom:`1px solid ${T.bdr}22` }}>
                      <td style={{ padding:'10px 14px', color:T.ink, textAlign:'left' }}>Taxable Outward Supplies</td>
                      <td style={{ padding:'10px 14px', color:T.ink, textAlign:'right' }}>{fmt(gstr3b.outward.taxable)}</td>
                      <td style={{ padding:'10px 14px', color:T.sub, textAlign:'right' }}>{fmt(gstr3b.outward.igst)}</td>
                      <td style={{ padding:'10px 14px', color:T.sub, textAlign:'right' }}>{fmt(gstr3b.outward.cgst)}</td>
                      <td style={{ padding:'10px 14px', color:T.sub, textAlign:'right' }}>{fmt(gstr3b.outward.sgst)}</td>
                      <td style={{ padding:'10px 14px', color:T.green, fontWeight:700, textAlign:'right' }}>{fmt(gstr3b.outward.cgst + gstr3b.outward.sgst)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Section 4 - ITC */}
              <div style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:12, overflow:'hidden', marginBottom:16 }}>
                <div style={{ padding:'12px 16px', background:T.amber+'18', borderBottom:`1px solid ${T.bdr}`, fontWeight:700, color:T.amber }}>
                  4. Eligible ITC (Input Tax Credit from Purchases)
                </div>
                <div style={{ padding:16, display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12 }}>
                  {[['IGST ITC', fmt(gstr3b.itc.igst), T.sub],['CGST ITC', fmt(gstr3b.itc.cgst), T.amber],['SGST ITC', fmt(gstr3b.itc.sgst), T.amber],['Total ITC', fmt(gstr3b.itc.cgst+gstr3b.itc.sgst), T.green]].map(([label,val,color])=>(
                    <div key={label} style={{ background:T.card, borderRadius:8, padding:'10px 14px' }}>
                      <div style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', marginBottom:4 }}>{label}</div>
                      <div style={{ fontSize:16, fontWeight:800, color }}>{val}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Net Tax Payable */}
              <div style={{ background: gstr3b.totalNetTax > 0 ? T.red+'18' : T.green+'18', border:`1px solid ${gstr3b.totalNetTax>0?T.red:T.green}44`, borderRadius:12, padding:20 }}>
                <div style={{ fontWeight:700, color:T.ink, marginBottom:12 }}>Net GST Payable</div>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12 }}>
                  {[['IGST Payable', fmt(gstr3b.netTax.igst)],['CGST Payable', fmt(gstr3b.netTax.cgst)],['SGST Payable', fmt(gstr3b.netTax.sgst)]].map(([label,val])=>(
                    <div key={label} style={{ textAlign:'center' }}>
                      <div style={{ fontSize:12, color:T.sub, marginBottom:4 }}>{label}</div>
                      <div style={{ fontSize:20, fontWeight:800, color:gstr3b.totalNetTax>0?T.red:T.green }}>{val}</div>
                    </div>
                  ))}
                </div>
                <div style={{ textAlign:'center', marginTop:16, fontSize:22, fontWeight:800, color:gstr3b.totalNetTax>0?T.red:T.green }}>
                  Total: {fmt(gstr3b.totalNetTax)}
                  {gstr3b.totalNetTax === 0 && <span style={{ fontSize:13, color:T.green, marginLeft:8 }}>🎉 No tax payable this period!</span>}
                </div>
              </div>
            </div>
          )}

          {/* HSN Summary Tab */}
          {tab === 'hsn' && (
            <div>
              <div style={{ fontWeight:700, color:T.ink, marginBottom:14 }}>HSN/SAC Summary</div>
              <div style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:12, overflow:'hidden' }}>
                <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
                  <thead>
                    <tr style={{ background:T.card }}>
                      {['HSN Code','Description','Qty','Total Value','Taxable Value','CGST','SGST','Total GST'].map(h => (
                        <th key={h} style={{ padding:'10px 14px', textAlign:'left', fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', borderBottom:`1px solid ${T.bdr}` }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(gstr1?.hsn?.details || []).length === 0 ? (
                      <tr><td colSpan={8} style={{ textAlign:'center', padding:40, color:T.muted }}>No sales this period</td></tr>
                    ) : (gstr1?.hsn?.details || []).map((row, i) => (
                      <tr key={i} style={{ borderBottom:`1px solid ${T.bdr}22` }}>
                        <td style={{ padding:'10px 14px', fontFamily:'monospace', color:T.teal }}>{row.hsn}</td>
                        <td style={{ padding:'10px 14px', color:T.ink }}>{row.desc}</td>
                        <td style={{ padding:'10px 14px', color:T.sub }}>{fmtN(row.qty)}</td>
                        <td style={{ padding:'10px 14px', color:T.ink }}>{fmt(row.val)}</td>
                        <td style={{ padding:'10px 14px', color:T.sub }}>{fmt(row.taxable)}</td>
                        <td style={{ padding:'10px 14px', color:T.amber }}>{fmt(row.cgst)}</td>
                        <td style={{ padding:'10px 14px', color:T.amber }}>{fmt(row.sgst)}</td>
                        <td style={{ padding:'10px 14px', color:T.green, fontWeight:700 }}>{fmt(row.cgst+row.sgst)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Tally Export Tab */}
          {tab === 'tally' && (
            <div>
              <div style={{ fontWeight:700, color:T.ink, marginBottom:16 }}>Tally XML Export</div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
                {[
                  { title:'Sales Vouchers', desc:`Export ${sales.length} sales invoices as Tally XML. Import into Tally Prime or ERP9 to auto-create sales vouchers.`, icon:'📤', action:'Export Sales XML', color:T.blue,
                    fn: async () => {
                      const { exportSalesToTally } = await import('../lib/tally.js');
                      exportSalesToTally(sales, tenant);
                    }},
                  { title:'Purchase Vouchers', desc:`Export ${purchases.length} purchase orders as Tally XML. Import to auto-create purchase vouchers in Tally.`, icon:'📥', action:'Export Purchases XML', color:T.amber,
                    fn: async () => {
                      const { exportPurchasesToTally } = await import('../lib/tally.js');
                      exportPurchasesToTally(purchases, tenant);
                    }},
                ].map(item => (
                  <div key={item.title} style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:12, padding:24 }}>
                    <div style={{ fontSize:32, marginBottom:12 }}>{item.icon}</div>
                    <div style={{ fontSize:16, fontWeight:700, color:T.ink, marginBottom:8 }}>{item.title}</div>
                    <div style={{ fontSize:13, color:T.sub, lineHeight:1.6, marginBottom:20 }}>{item.desc}</div>
                    <button onClick={item.fn} style={{ background:item.color, color:'#fff', border:'none', borderRadius:8, padding:'10px 20px', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>
                      {item.action}
                    </button>
                  </div>
                ))}
              </div>
              <div style={{ marginTop:16, background:T.card, borderRadius:10, padding:'14px 18px', fontSize:12, color:T.muted, lineHeight:1.7 }}>
                <strong style={{ color:T.ink }}>How to import in Tally:</strong><br/>
                Tally Prime → Gateway of Tally → Import → Vouchers → Select the downloaded XML file → Accept
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
