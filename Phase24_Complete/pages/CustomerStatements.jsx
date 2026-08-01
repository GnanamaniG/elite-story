import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

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
const fmt = n => 'Rs.' + (n||0).toLocaleString('en-IN', { minimumFractionDigits:2, maximumFractionDigits:2 });

export default function CustomerStatements({ tenant }) {
  const [customers,  setCustomers]  = useState([]);
  const [selected,   setSelected]   = useState(null);
  const [sales,      setSales]      = useState([]);
  const [payments,   setPayments]   = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [loadingStmt,setLoadingStmt]= useState(false);
  const [search,     setSearch]     = useState('');
  const [dateFrom,   setDateFrom]   = useState(new Date().toISOString().slice(0,7)+'-01');
  const [dateTo,     setDateTo]     = useState(new Date().toISOString().slice(0,10));

  useEffect(() => {
    if (!tenant?.id) return;
    supabase.from('customers').select('*').eq('tenant_id', tenant.id).order('name')
      .then(({ data }) => setCustomers(data||[]))
      .finally(() => setLoading(false));
  }, [tenant?.id]);

  async function loadStatement(cust) {
    setSelected(cust); setLoadingStmt(true);
    const [salesRes, creditRes] = await Promise.all([
      supabase.from('sales').select('*').eq('tenant_id', tenant.id).eq('customer_id', cust.id).gte('date', dateFrom).lte('date', dateTo).order('date'),
      supabase.from('credit_notes').select('*').eq('tenant_id', tenant.id).eq('customer_id', cust.id).gte('issued_date', dateFrom).lte('issued_date', dateTo),
    ]);
    setSales(salesRes.data||[]);
    setPayments(creditRes.data||[]);
    setLoadingStmt(false);
  }

  const totalSales    = sales.reduce((s,x)=>s+(x.total||0),0);
  const totalCredits  = payments.reduce((s,p)=>s+(p.amount||0),0);
  const balance       = (selected?.outstanding||0);

  function printStatement() {
    const w   = window.open('', '_blank');
    const biz = tenant?.name||'Elite Store';
    const rows = [
      ...sales.map(s=>({ date:s.date, desc:`Invoice ${s.inv_num}`, debit:s.total||0, credit:0 })),
      ...payments.map(p=>({ date:p.issued_date, desc:`Credit Note ${p.cn_number}`, debit:0, credit:p.amount||0 })),
    ].sort((a,b)=>a.date.localeCompare(b.date));

    let running = 0;
    const html = `<!DOCTYPE html><html><head><style>body{font-family:Arial,sans-serif;margin:0;padding:20px}table{width:100%;border-collapse:collapse}th,td{padding:8px 12px;border:1px solid #ddd;text-align:left}th{background:#f0f0f0}.right{text-align:right}.blue{color:#4f7cff}.bold{font-weight:bold}</style></head><body>
    <div style="display:flex;justify-content:space-between;margin-bottom:20px">
      <div><div style="font-size:24px;font-weight:900">${biz}</div><div style="color:#666">${tenant?.address||''}</div><div style="color:#666">${tenant?.phone||''}</div></div>
      <div style="text-align:right"><div style="font-size:20px;font-weight:700;color:#4f7cff">ACCOUNT STATEMENT</div><div>Period: ${dateFrom} to ${dateTo}</div><div>Generated: ${new Date().toLocaleDateString('en-IN')}</div></div>
    </div>
    <div style="background:#f5f5ff;border:1px solid #4f7cff;border-radius:8px;padding:12px 16px;margin-bottom:16px">
      <div style="font-size:16px;font-weight:700">${selected?.name}</div>
      <div style="color:#666">${selected?.phone||''} ${selected?.email?'· '+selected.email:''}</div>
    </div>
    <table>
      <tr><th>Date</th><th>Description</th><th class="right">Debit</th><th class="right">Credit</th><th class="right">Balance</th></tr>
      ${rows.map(r=>{ running+=r.debit-r.credit; return `<tr><td>${r.date}</td><td>${r.desc}</td><td class="right">${r.debit>0?fmt(r.debit):'—'}</td><td class="right">${r.credit>0?fmt(r.credit):'—'}</td><td class="right ${running>0?'':'blue'}">${fmt(Math.abs(running))}</td></tr>`; }).join('')}
    </table>
    <div style="margin-top:16px;display:flex;justify-content:flex-end">
      <table style="width:280px">
        <tr><td class="bold">Total Invoices</td><td class="right">${fmt(totalSales)}</td></tr>
        <tr><td class="bold">Total Credits</td><td class="right">${fmt(totalCredits)}</td></tr>
        <tr style="background:#fff3cd"><td class="bold">Outstanding Balance</td><td class="right bold" style="color:${balance>0?'red':'green'}">${fmt(balance)}</td></tr>
      </table>
    </div>
    <script>window.onload=()=>{window.print();setTimeout(()=>window.close(),500)}<\/script></body></html>`;
    w.document.write(html); w.document.close();
  }

  function sendViaWhatsApp() {
    const msg = `*Account Statement — ${tenant?.name||'Elite Store'}*\n\nDear ${selected?.name},\n\nHere is your account summary for ${dateFrom} to ${dateTo}:\n\n📋 Total Invoices: *${fmt(totalSales)}*\n✅ Total Credits: *${fmt(totalCredits)}*\n💰 Outstanding Balance: *${fmt(balance)}*\n\n*Invoice History:*\n${sales.slice(0,5).map(s=>`• ${s.inv_num} (${s.date}) — ${fmt(s.total)}`).join('\n')}${sales.length>5?`\n...and ${sales.length-5} more`:''}\n\nFor a detailed statement, please contact us.\n\nThank you! 🙏`;
    const ph  = (selected?.phone||'').replace(/\D/g,'').replace(/^0/,'91');
    window.open(`https://wa.me/${ph||''}?text=${encodeURIComponent(msg)}`, '_blank');
  }

  const filteredCustomers = customers.filter(c=>!search||c.name.toLowerCase().includes(search.toLowerCase())||(c.phone||'').includes(search));
  const withOutstanding   = [...filteredCustomers].sort((a,b)=>(b.outstanding||0)-(a.outstanding||0));

  return (
    <div style={{ padding:20 }}>
      <div style={{ fontSize:22, fontWeight:800, color:T.ink, marginBottom:6 }}>📃 Customer Statements</div>
      <div style={{ fontSize:13, color:T.sub, marginBottom:20 }}>Generate and send account statements to customers</div>

      <div style={{ display:'grid', gridTemplateColumns:'320px 1fr', gap:16 }}>
        {/* Customer list */}
        <div>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="🔍 Search customer…"
            style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:9, padding:'10px 14px', color:T.ink, fontSize:13, fontFamily:'inherit', outline:'none', width:'100%', marginBottom:10 }}/>
          <div style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:12, maxHeight:520, overflowY:'auto' }}>
            {loading?<div style={{ padding:40, textAlign:'center', color:T.sub }}>Loading…</div>
            :withOutstanding.map(c=>(
              <div key={c.id} onClick={()=>loadStatement(c)}
                style={{ padding:'11px 14px', borderBottom:`1px solid ${T.bdr}22`, cursor:'pointer', background:selected?.id===c.id?T.blue+'18':'transparent' }}>
                <div style={{ display:'flex', justifyContent:'space-between' }}>
                  <div style={{ fontSize:14, fontWeight:600, color:T.ink }}>{c.name}</div>
                  {(c.outstanding||0)>0&&<span style={{ color:T.red, fontWeight:700, fontSize:13 }}>{fmt(c.outstanding)}</span>}
                </div>
                <div style={{ fontSize:11, color:T.muted }}>{c.phone||'No phone'} · {c.purchase_count||0} orders</div>
              </div>
            ))}
          </div>
        </div>

        {/* Statement */}
        <div>
          {/* Date range */}
          <div style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:10, padding:'12px 16px', marginBottom:14, display:'flex', gap:12, alignItems:'center', flexWrap:'wrap' }}>
            {[['From','date',dateFrom,setDateFrom],['To','date',dateTo,setDateTo]].map(([label,type,val,setter])=>(
              <div key={label} style={{ display:'flex', alignItems:'center', gap:8 }}>
                <span style={{ fontSize:11, color:T.sub, fontWeight:700 }}>{label}</span>
                <input type={type} value={val} onChange={e=>{setter(e.target.value);if(selected)loadStatement(selected);}} style={{ background:T.card, border:`1px solid ${T.bdr}`, borderRadius:7, padding:'6px 10px', color:T.ink, fontSize:12, fontFamily:'inherit', outline:'none' }}/>
              </div>
            ))}
            {selected&&<div style={{ display:'flex', gap:8, marginLeft:'auto' }}>
              <button onClick={printStatement} style={{ background:T.blue+'22', color:T.blue, border:'none', borderRadius:7, padding:'7px 14px', fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>🖨️ Print</button>
              {selected.phone&&<button onClick={sendViaWhatsApp} style={{ background:'#25d36622', color:'#25d366', border:'none', borderRadius:7, padding:'7px 14px', fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>💬 WhatsApp</button>}
            </div>}
          </div>

          {!selected?<div style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:12, padding:60, textAlign:'center', color:T.muted }}><div style={{ fontSize:36, marginBottom:12 }}>📃</div><div>Select a customer to view their statement</div></div>
          :loadingStmt?<div style={{ textAlign:'center', color:T.sub, padding:60 }}>Loading statement…</div>:(
            <>
              {/* Summary */}
              <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10, marginBottom:14 }}>
                {[['Total Invoiced',fmt(totalSales),T.blue],['Total Credits',fmt(totalCredits),T.green],['Outstanding',fmt(balance),balance>0?T.red:T.green]].map(([label,val,color])=>(
                  <div key={label} style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:9, padding:'12px 14px' }}>
                    <div style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', marginBottom:5 }}>{label}</div>
                    <div style={{ fontSize:17, fontWeight:800, color }}>{val}</div>
                  </div>
                ))}
              </div>

              {/* Transaction table */}
              <div style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:12, overflow:'hidden' }}>
                <div style={{ padding:'12px 18px', borderBottom:`1px solid ${T.bdr}`, fontWeight:700, color:T.ink }}>{selected.name} — Statement ({dateFrom} to {dateTo})</div>
                <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
                  <thead><tr style={{ background:T.card }}>
                    {['Date','Description','Debit','Credit'].map(h=><th key={h} style={{ padding:'9px 14px', textAlign:h==='Date'||h==='Description'?'left':'right', fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', borderBottom:`1px solid ${T.bdr}` }}>{h}</th>)}
                  </tr></thead>
                  <tbody>
                    {!sales.length&&!payments.length?<tr><td colSpan={4} style={{ textAlign:'center', padding:30, color:T.muted }}>No transactions in this period</td></tr>
                    :[...sales.map(s=>({date:s.date,desc:`Invoice ${s.inv_num||''}`,debit:s.total||0,credit:0})),...payments.map(p=>({date:p.issued_date,desc:`Credit Note ${p.cn_number||''}`,debit:0,credit:p.amount||0}))].sort((a,b)=>a.date.localeCompare(b.date)).map((r,i)=>(
                      <tr key={i} style={{ borderBottom:`1px solid ${T.bdr}22` }}>
                        <td style={{ padding:'9px 14px', color:T.muted }}>{r.date}</td>
                        <td style={{ padding:'9px 14px', color:T.ink }}>{r.desc}</td>
                        <td style={{ padding:'9px 14px', textAlign:'right', color:T.red, fontWeight:r.debit>0?700:400 }}>{r.debit>0?fmt(r.debit):'—'}</td>
                        <td style={{ padding:'9px 14px', textAlign:'right', color:T.green, fontWeight:r.credit>0?700:400 }}>{r.credit>0?fmt(r.credit):'—'}</td>
                      </tr>
                    ))}
                    <tr style={{ background:T.card }}>
                      <td colSpan={2} style={{ padding:'10px 14px', fontWeight:700, color:T.ink }}>Outstanding Balance</td>
                      <td colSpan={2} style={{ padding:'10px 14px', textAlign:'right', fontWeight:800, fontSize:15, color:balance>0?T.red:T.green }}>{fmt(balance)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
