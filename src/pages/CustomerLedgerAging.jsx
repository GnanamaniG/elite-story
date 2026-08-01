import { useState, useEffect, Fragment } from 'react';
import { supabase } from '../lib/supabase';

const T = {
  bg:'#F7F3F3', srf:'#FFFFFF', card:'#FFFFFF', bdr:'#E8DEDE',
  red:'#C0392B', darkRed:'#8B0000', lightRed:'#FEF2F2',
  green:'#16A34A', amber:'#D97706', blue:'#2563EB', purple:'#7C3AED',
  ink:'#111827', sub:'#6B7280', muted:'#9CA3AF', white:'#FFFFFF'
};
const fmt = n => 'Rs.' + Math.abs(n||0).toLocaleString('en-IN', { maximumFractionDigits:0 });
const btn = (bg,color,extra={}) => ({ background:bg, color, border:'none', borderRadius:8, padding:'9px 16px', fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:'inherit', ...extra });

export default function CustomerLedgerAging({ tenant }) {
  const [data,    setData]    = useState([]);
  const [loading, setLoading] = useState(true);
  const [selCust, setSelCust] = useState(null);
  const [txns,    setTxns]    = useState([]);
  const [search,  setSearch]  = useState('');
  const [sortBy,  setSortBy]  = useState('balance');

  useEffect(() => { if (tenant?.id) load(); }, [tenant?.id]);

  async function load() {
    setLoading(true);
    const [custRes, ledgerRes, salesRes] = await Promise.all([
      supabase.from('customers').select('id,name,phone,total_spent').eq('tenant_id', tenant.id),
      supabase.from('credit_ledger').select('*').eq('tenant_id', tenant.id).order('date'),
      supabase.from('sales').select('id,customer,customer_id,total,date,inv_num').eq('tenant_id', tenant.id).order('date'),
    ]);

    const customers = custRes.data   || [];
    const ledger    = ledgerRes.data || [];
    const sales     = salesRes.data  || [];
    const today     = new Date();

    const rows = customers.map(c=>{
      const entries = ledger.filter(l=>l.customer_id===c.id||l.customer===c.name);
      let balance = 0;
      const buckets = { b0:0, b30:0, b60:0, b90:0 };
      let oldestDate = null;

      entries.forEach(l=>{
        const amt = l.type==='credit' ? (l.amount||0) : -(l.amount||0);
        balance += amt;
        if (l.type==='credit') {
          const days = Math.floor((today-new Date(l.date))/86400000);
          if (days<=30)      buckets.b0  += l.amount||0;
          else if (days<=60) buckets.b30 += l.amount||0;
          else if (days<=90) buckets.b60 += l.amount||0;
          else               buckets.b90 += l.amount||0;
          if (!oldestDate || l.date < oldestDate) oldestDate = l.date;
        }
      });

      const lastSale = sales.filter(s=>s.customer_id===c.id||s.customer===c.name).slice(-1)[0];
      return {
        ...c, balance, ...buckets, oldestDate,
        entryCount: entries.length,
        lastSaleDate: lastSale?.date || null,
        daysOld: oldestDate ? Math.floor((today-new Date(oldestDate))/86400000) : 0,
      };
    }).filter(r=>r.balance>0.5);

    setData(rows);
    setLoading(false);
  }

  async function loadTxns(cust) {
    if (selCust?.id===cust.id) { setSelCust(null); setTxns([]); return; }
    setSelCust(cust);
    const { data } = await supabase.from('credit_ledger').select('*').eq('tenant_id', tenant.id)
      .or(`customer_id.eq.${cust.id},customer.eq.${cust.name}`).order('date', { ascending:false });
    setTxns(data||[]);
  }

  function printStatement(cust) {
    let running = 0;
    const rows = [...txns].reverse();
    const w = window.open('','_blank');
    w.document.write(`<!DOCTYPE html><html><head><style>
      body{font-family:Arial,sans-serif;font-size:11px;padding:26px;max-width:720px;margin:0 auto}
      h2{color:#8B0000;margin-bottom:2px}
      table{width:100%;border-collapse:collapse;margin-top:14px}
      th,td{padding:6px 10px;border-bottom:1px solid #eee;text-align:left}
      th{background:#f5f0f0;font-size:9px;text-transform:uppercase;font-weight:700;color:#8B0000}
      .right{text-align:right}.green{color:#16A34A}.red{color:#C0392B}
      .total{font-weight:800;background:#f9f5f5;border-top:2px solid #8B0000}
      .aging{display:flex;gap:10px;margin:14px 0}
      .ab{flex:1;background:#f9f5f5;padding:9px;border-radius:6px;text-align:center}
      .ab-l{font-size:9px;color:#666;text-transform:uppercase}
      .ab-v{font-size:14px;font-weight:800;color:#C0392B;margin-top:2px}
    </style></head><body>
    <div style="display:flex;justify-content:space-between">
      <div><h2>${tenant?.name||'7SQ'}</h2><div style="color:#666">Statement of Account</div></div>
      <div style="text-align:right;font-size:11px">
        <div><strong>${cust.name}</strong></div>
        <div>${cust.phone||''}</div>
        <div>As on ${new Date().toLocaleDateString('en-IN')}</div>
      </div>
    </div>
    <div class="aging">
      <div class="ab"><div class="ab-l">0-30 days</div><div class="ab-v">${fmt(cust.b0)}</div></div>
      <div class="ab"><div class="ab-l">31-60 days</div><div class="ab-v">${fmt(cust.b30)}</div></div>
      <div class="ab"><div class="ab-l">61-90 days</div><div class="ab-v">${fmt(cust.b60)}</div></div>
      <div class="ab"><div class="ab-l">90+ days</div><div class="ab-v">${fmt(cust.b90)}</div></div>
    </div>
    <table>
      <tr><th>Date</th><th>Particulars</th><th>Ref</th><th class="right">Debit</th><th class="right">Credit</th><th class="right">Balance</th></tr>
      ${rows.map(t=>{
        const isCredit = t.type==='credit';
        running += isCredit ? (t.amount||0) : -(t.amount||0);
        return `<tr><td>${t.date}</td><td>${t.note||t.description||(isCredit?'Credit Sale':'Payment Received')}</td><td>${t.ref||'—'}</td>
        <td class="right red">${isCredit?fmt(t.amount):'—'}</td>
        <td class="right green">${!isCredit?fmt(t.amount):'—'}</td>
        <td class="right"><strong>${fmt(running)}</strong></td></tr>`;
      }).join('')}
      <tr class="total"><td colspan="5">CLOSING BALANCE DUE</td><td class="right">${fmt(cust.balance)}</td></tr>
    </table>
    <div style="margin-top:18px;font-size:10px;color:#666">This is a computer-generated statement. Please contact us for any discrepancy.</div>
    <script>window.onload=()=>{window.print();setTimeout(()=>window.close(),500)}<\/script>
    </body></html>`);
    w.document.close();
  }

  function sendStatement(cust) {
    const msg = `📄 *Statement of Account*\n${tenant?.name||'7SQ'}\n\nDear ${cust.name},\n\nYour account summary as on ${new Date().toLocaleDateString('en-IN')}:\n\n💰 *Total Outstanding: ${fmt(cust.balance)}*\n\n*Aging Breakdown:*\n0-30 days: ${fmt(cust.b0)}\n31-60 days: ${fmt(cust.b30)}\n61-90 days: ${fmt(cust.b60)}\n90+ days: ${fmt(cust.b90)}\n\n${cust.daysOld>60?'⚠️ Some amounts are long overdue. Please arrange payment at the earliest.\n\n':''}For any clarification, please contact us.\n\nThank you! 🙏`;
    const ph = (cust.phone||'').replace(/\D/g,'').replace(/^0/,'91');
    window.open(`https://wa.me/${ph}?text=${encodeURIComponent(msg)}`, '_blank');
  }

  const filtered = data
    .filter(d=>!search||d.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a,b)=> sortBy==='balance' ? b.balance-a.balance : sortBy==='age' ? b.daysOld-a.daysOld : a.name.localeCompare(b.name));

  const totals = filtered.reduce((a,d)=>({ balance:a.balance+d.balance, b0:a.b0+d.b0, b30:a.b30+d.b30, b60:a.b60+d.b60, b90:a.b90+d.b90 }), { balance:0,b0:0,b30:0,b60:0,b90:0 });

  return (
    <div style={{ padding:24, background:T.bg, minHeight:'100%' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
        <div>
          <div style={{ fontSize:18, fontWeight:800, color:T.darkRed }}>📊 Customer Ledger & Aging</div>
          <div style={{ fontSize:12, color:T.sub, marginTop:2 }}>Statement of account per customer with aging buckets</div>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search customer…" style={{ background:T.white, border:`1px solid ${T.bdr}`, borderRadius:8, padding:'8px 12px', color:T.ink, fontSize:12, fontFamily:'inherit', outline:'none', width:180 }}/>
          <select value={sortBy} onChange={e=>setSortBy(e.target.value)} style={{ background:T.white, border:`1px solid ${T.bdr}`, borderRadius:8, padding:'8px 10px', color:T.ink, fontSize:11, fontFamily:'inherit', outline:'none' }}>
            {[['balance','Sort: Balance'],['age','Sort: Oldest'],['name','Sort: Name']].map(([v,l])=><option key={v} value={v}>{l}</option>)}
          </select>
        </div>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:14, marginBottom:18 }}>
        {[
          ['Total Outstanding', fmt(totals.balance), T.red],
          ['0-30 days',  fmt(totals.b0),  T.blue],
          ['31-60 days', fmt(totals.b30), T.amber],
          ['61-90 days', fmt(totals.b60), T.red],
          ['90+ days',   fmt(totals.b90), T.darkRed],
        ].map(([label,val,color])=>(
          <div key={label} style={{ background:T.white, border:`1px solid ${T.bdr}`, borderRadius:12, padding:'14px 16px', boxShadow:'0 1px 4px rgba(0,0,0,.05)' }}>
            <div style={{ fontSize:9, color:T.sub, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:5 }}>{label}</div>
            <div style={{ fontSize:18, fontWeight:900, color, letterSpacing:'-0.02em' }}>{val}</div>
            {totals.balance>0&&label!=='Total Outstanding'&&<div style={{ height:4, background:'#F3F4F6', borderRadius:2, overflow:'hidden', marginTop:6 }}>
              <div style={{ height:'100%', width:`${(parseFloat(val.replace(/[^\d.]/g,''))/totals.balance*100)||0}%`, background:color, borderRadius:2 }}/>
            </div>}
          </div>
        ))}
      </div>

      <div style={{ background:T.white, border:`1px solid ${T.bdr}`, borderRadius:14, overflow:'hidden', boxShadow:'0 1px 4px rgba(0,0,0,.05)' }}>
        <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
          <thead><tr style={{ background:T.lightRed }}>
            {['Customer','Oldest Due','0-30d','31-60d','61-90d','90+d','Total Due','Actions'].map(h=>(
              <th key={h} style={{ padding:'11px 12px', textAlign:['Customer','Actions'].includes(h)?'left':'right', fontSize:9, color:T.darkRed, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.04em', borderBottom:`1px solid ${T.bdr}` }}>{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {loading?<tr><td colSpan={8} style={{ textAlign:'center', padding:50, color:T.muted }}>Loading ledger…</td></tr>
            :filtered.length===0?<tr><td colSpan={8} style={{ textAlign:'center', padding:50 }}>
              <div style={{ fontSize:36, marginBottom:8 }}>✅</div>
              <div style={{ color:T.green, fontWeight:700 }}>No outstanding balances</div>
            </td></tr>
            :filtered.map(c=>(
              <Fragment key={c.id}>
                <tr onClick={()=>loadTxns(c)} style={{ borderBottom:`1px solid ${T.bdr}22`, cursor:'pointer', background:selCust?.id===c.id?'#FEF2F2':c.daysOld>90?'#FFFAFA':'transparent' }}>
                  <td style={{ padding:'11px 12px' }}>
                    <div style={{ color:T.ink, fontWeight:700 }}>{c.name}</div>
                    <div style={{ fontSize:10, color:T.muted }}>{c.phone||'No phone'} · {c.entryCount} entries</div>
                  </td>
                  <td style={{ padding:'11px 12px', textAlign:'right' }}>
                    <span style={{ background:c.daysOld>90?'#FEF2F2':c.daysOld>60?'#FFFBEB':'#EFF6FF', color:c.daysOld>90?T.red:c.daysOld>60?T.amber:T.blue, border:`1px solid ${c.daysOld>90?'#FECACA':c.daysOld>60?'#FDE68A':'#BFDBFE'}`, borderRadius:5, padding:'2px 8px', fontSize:10, fontWeight:700 }}>{c.daysOld}d</span>
                  </td>
                  <td style={{ padding:'11px 12px', textAlign:'right', color:c.b0>0?T.blue:T.muted }}>{c.b0>0?fmt(c.b0):'—'}</td>
                  <td style={{ padding:'11px 12px', textAlign:'right', color:c.b30>0?T.amber:T.muted }}>{c.b30>0?fmt(c.b30):'—'}</td>
                  <td style={{ padding:'11px 12px', textAlign:'right', color:c.b60>0?T.red:T.muted }}>{c.b60>0?fmt(c.b60):'—'}</td>
                  <td style={{ padding:'11px 12px', textAlign:'right', color:c.b90>0?T.darkRed:T.muted, fontWeight:c.b90>0?700:400 }}>{c.b90>0?fmt(c.b90):'—'}</td>
                  <td style={{ padding:'11px 12px', textAlign:'right', color:T.red, fontWeight:800, fontSize:14 }}>{fmt(c.balance)}</td>
                  <td style={{ padding:'11px 12px' }}>
                    <div style={{ display:'flex', gap:5 }}>
                      <button onClick={e=>{e.stopPropagation();printStatement(c);}} style={{ background:T.lightRed, color:T.red, border:'none', borderRadius:6, padding:'4px 9px', fontSize:9, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>🖨️</button>
                      {c.phone&&<button onClick={e=>{e.stopPropagation();sendStatement(c);}} style={{ background:'#DCFCE7', color:T.green, border:'none', borderRadius:6, padding:'4px 9px', fontSize:9, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>💬</button>}
                    </div>
                  </td>
                </tr>
                {selCust?.id===c.id&&(
                  <tr>
                    <td colSpan={8} style={{ padding:0, background:'#FDFAFA' }}>
                      <div style={{ padding:'12px 20px' }}>
                        <div style={{ fontSize:11, fontWeight:700, color:T.darkRed, textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:8 }}>Transaction History</div>
                        {txns.length===0?<div style={{ fontSize:12, color:T.muted, padding:'8px 0' }}>No transactions found</div>
                        :<table style={{ width:'100%', borderCollapse:'collapse', fontSize:11 }}>
                          <thead><tr>{['Date','Particulars','Ref','Debit','Credit'].map(h=><th key={h} style={{ padding:'5px 10px', textAlign:['Debit','Credit'].includes(h)?'right':'left', fontSize:9, color:T.muted, fontWeight:700, textTransform:'uppercase' }}>{h}</th>)}</tr></thead>
                          <tbody>{txns.slice(0,10).map(t=>(
                            <tr key={t.id} style={{ borderTop:`1px solid ${T.bdr}22` }}>
                              <td style={{ padding:'5px 10px', color:T.muted }}>{t.date}</td>
                              <td style={{ padding:'5px 10px', color:T.ink }}>{t.note||t.description||(t.type==='credit'?'Credit Sale':'Payment Received')}</td>
                              <td style={{ padding:'5px 10px', color:T.muted, fontFamily:'monospace', fontSize:10 }}>{t.ref||'—'}</td>
                              <td style={{ padding:'5px 10px', textAlign:'right', color:T.red, fontWeight:t.type==='credit'?700:400 }}>{t.type==='credit'?fmt(t.amount):'—'}</td>
                              <td style={{ padding:'5px 10px', textAlign:'right', color:T.green, fontWeight:t.type!=='credit'?700:400 }}>{t.type!=='credit'?fmt(t.amount):'—'}</td>
                            </tr>
                          ))}</tbody>
                        </table>}
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
            {filtered.length>0&&<tr style={{ background:T.lightRed }}>
              <td colSpan={2} style={{ padding:'11px 12px', fontWeight:800, color:T.darkRed }}>TOTAL ({filtered.length} customers)</td>
              <td style={{ padding:'11px 12px', textAlign:'right', fontWeight:800, color:T.blue }}>{fmt(totals.b0)}</td>
              <td style={{ padding:'11px 12px', textAlign:'right', fontWeight:800, color:T.amber }}>{fmt(totals.b30)}</td>
              <td style={{ padding:'11px 12px', textAlign:'right', fontWeight:800, color:T.red }}>{fmt(totals.b60)}</td>
              <td style={{ padding:'11px 12px', textAlign:'right', fontWeight:800, color:T.darkRed }}>{fmt(totals.b90)}</td>
              <td style={{ padding:'11px 12px', textAlign:'right', fontWeight:900, color:T.red, fontSize:15 }}>{fmt(totals.balance)}</td>
              <td/>
            </tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
