import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';

const T = {
  bg:'#F7F3F3', srf:'#FFFFFF', card:'#FFFFFF', bdr:'#E8DEDE',
  red:'#C0392B', darkRed:'#8B0000', lightRed:'#FEF2F2',
  green:'#16A34A', amber:'#D97706', blue:'#2563EB', purple:'#7C3AED',
  ink:'#111827', sub:'#6B7280', muted:'#9CA3AF', white:'#FFFFFF'
};
const fmt  = n => 'Rs.' + (n||0).toLocaleString('en-IN', { maximumFractionDigits:0 });
const fmtL = n => Math.abs(n)>=100000 ? '₹'+(n/100000).toFixed(1)+'L' : fmt(n);
const btn  = (bg,color,extra={}) => ({ background:bg, color, border:'none', borderRadius:9, padding:'9px 16px', fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:'inherit', ...extra });
const inp  = { background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:8, padding:'9px 12px', color:T.ink, fontSize:13, fontFamily:'inherit', outline:'none' };
const REVENUE_WINDOW_DAYS = 180;

const PAY_STATUS = {
  settled: { l:'Settled', color:T.green, bg:'#F0FDF4', bdr:'#BBF7D0' },
  partial: { l:'Partial', color:T.purple,bg:'#F5F3FF', bdr:'#DDD6FE' },
  pending: { l:'Pending', color:T.amber, bg:'#FFFBEB', bdr:'#FDE68A' },
};
const PO_STATUS = {
  received:  { l:'Received',  color:T.green,  bg:'#F0FDF4', bdr:'#BBF7D0' },
  draft:     { l:'Draft',     color:T.muted,  bg:'#F9FAFB', bdr:'#E5E7EB' },
  ordered:   { l:'Ordered',   color:T.blue,   bg:'#EFF6FF', bdr:'#BFDBFE' },
  partial:   { l:'Partial',   color:T.amber,  bg:'#FFFBEB', bdr:'#FDE68A' },
  cancelled: { l:'Cancelled', color:T.red,    bg:'#FEF2F2', bdr:'#FECACA' },
};

export default function PurchasesDashboard({ tenant, role='owner', onSwitchTab }) {
  const [purchases, setPurchases] = useState([]);
  const [payments,  setPayments]  = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [search,    setSearch]    = useState('');
  const [statusF,   setStatusF]   = useState('all');
  const [payF,      setPayF]      = useState('all');
  const [supF,      setSupF]      = useState('all');
  const [sortBy,    setSortBy]    = useState('date');
  const [payFor,    setPayFor]    = useState(null);
  const [payAmt,    setPayAmt]    = useState('');
  const [payMode,   setPayMode]   = useState('cash');
  const [saving,    setSaving]    = useState(false);
  const [saved,     setSaved]     = useState(false);

  useEffect(() => { if (tenant?.id) load(); }, [tenant?.id]);

  async function load() {
    setLoading(true);
    const since = new Date(); since.setDate(since.getDate()-REVENUE_WINDOW_DAYS);
    const [pRes, payRes, sRes] = await Promise.all([
      supabase.from('purchases').select('*').eq('tenant_id', tenant.id).gte('date', since.toISOString().slice(0,10)).order('date',{ ascending:false }),
      supabase.from('supplier_payments').select('purchase_id,paid_amount,payment_date').eq('tenant_id', tenant.id),
      supabase.from('suppliers').select('id,name').eq('tenant_id', tenant.id).eq('active',true).order('name'),
    ]);
    setPurchases(pRes.data||[]); setPayments(payRes.data||[]); setSuppliers(sRes.data||[]);
    setLoading(false);
  }

  // Paid per PO = whatever the PO recorded + anything logged against it in supplier_payments
  const enriched = useMemo(() => {
    const paidByPo = {};
    payments.forEach(p => { if (p.purchase_id) paidByPo[p.purchase_id] = (paidByPo[p.purchase_id]||0) + (p.paid_amount||0); });
    return purchases.map(p => {
      const extraPaid = paidByPo[p.id] || 0;
      const paid = Math.max(p.paid||0, extraPaid) || extraPaid;
      const total = p.total||0;
      const balance = Math.max(0, total - paid);
      const payStatus = balance <= 0.5 ? 'settled' : paid > 0 ? 'partial' : 'pending';
      const ageDays = Math.floor((Date.now()-new Date(p.date))/86400000);
      return { ...p, paid, balance, payStatus, ageDays };
    });
  }, [purchases, payments]);

  const [debounced, setDebounced] = useState('');
  useEffect(()=>{ const t=setTimeout(()=>setDebounced(search),200); return ()=>clearTimeout(t); },[search]);

  const displayed = useMemo(() => enriched
    .filter(p => statusF==='all' || p.status===statusF)
    .filter(p => payF==='all'    || p.payStatus===payF)
    .filter(p => supF==='all'    || p.supplier===supF)
    .filter(p => !debounced
      || (p.po_number||'').toLowerCase().includes(debounced.toLowerCase())
      || (p.supplier||'').toLowerCase().includes(debounced.toLowerCase()))
    .sort((a,b)=> sortBy==='date'    ? b.date.localeCompare(a.date)
               : sortBy==='amount'  ? (b.total||0)-(a.total||0)
               : sortBy==='balance' ? b.balance-a.balance
               : (b.ageDays||0)-(a.ageDays||0)),
    [enriched, statusF, payF, supF, debounced, sortBy]);

  const PAGE = 150;
  const [showAll, setShowAll] = useState(false);
  const rows = showAll ? displayed : displayed.slice(0, PAGE);

  const kpis = useMemo(() => {
    const total   = enriched.reduce((s,p)=>s+(p.total||0),0);
    const paid    = enriched.reduce((s,p)=>s+(p.paid||0),0);
    const payable = enriched.reduce((s,p)=>s+p.balance,0);
    const pending = enriched.filter(p=>p.payStatus!=='settled').length;
    const overdue = enriched.filter(p=>p.balance>0 && p.ageDays>30);
    const supCount= new Set(enriched.map(p=>p.supplier).filter(Boolean)).size;
    return { total, paid, payable, pending, overdue, supCount, overdueAmt:overdue.reduce((s,p)=>s+p.balance,0) };
  }, [enriched]);

  async function recordPayment(e) {
    e.preventDefault();
    const amt = parseFloat(payAmt)||0;
    if (!payFor || amt<=0) return;
    setSaving(true);
    await supabase.from('supplier_payments').insert({
      tenant_id: tenant.id, payment_no:`SPY/${new Date().getFullYear()}/${String(Date.now()).slice(-5)}`,
      supplier: payFor.supplier, purchase_id: payFor.id, invoice_ref: payFor.po_number,
      invoice_amt: payFor.total, paid_amount: amt, balance: Math.max(0, payFor.balance-amt),
      payment_mode: payMode, payment_date: new Date().toISOString().slice(0,10),
    });
    setPayFor(null); setPayAmt('');
    setSaved(true); setTimeout(()=>setSaved(false),2500);
    await load(); setSaving(false);
  }

  const KPI = ({ label, value, icon, color, sub }) => (
    <div style={{ background:T.white, border:`1px solid ${T.bdr}`, borderRadius:12, padding:'14px 16px', boxShadow:'0 1px 4px rgba(0,0,0,.05)' }}>
      <div style={{ display:'flex', justifyContent:'space-between', marginBottom:6 }}>
        <div style={{ fontSize:9, color:T.sub, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.05em' }}>{label}</div>
        <span style={{ fontSize:15 }}>{icon}</span>
      </div>
      <div style={{ fontSize:20, fontWeight:900, color:color||T.ink, letterSpacing:'-0.02em' }}>{value}</div>
      {sub && <div style={{ fontSize:10, color:T.muted, marginTop:2 }}>{sub}</div>}
    </div>
  );

  return (
    <div style={{ padding:22, background:T.bg, minHeight:'100%' }}>

      {/* Header */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:18, flexWrap:'wrap', gap:12 }}>
        <div>
          <div style={{ fontSize:20, fontWeight:900, color:T.darkRed, letterSpacing:'-0.02em' }}>Purchases</div>
          <div style={{ fontSize:12, color:T.sub, marginTop:3 }}>
            {enriched.length} POs · {fmtL(kpis.total)} total · {kpis.supCount} suppliers
            <span style={{ color:T.muted }}> · last {REVENUE_WINDOW_DAYS} days</span>
            {saved && <span style={{ color:T.green, fontWeight:700, marginLeft:8 }}>✓ Payment recorded</span>}
          </div>
        </div>
        <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
          <button onClick={()=>onSwitchTab?.('scan')} style={btn(T.purple, T.white)}>📸 Scan Bill</button>
          <button onClick={()=>onSwitchTab?.('grn')}  style={btn(T.bg, T.sub, { border:`1px solid ${T.bdr}` })}>📥 Receive</button>
          <button onClick={()=>onSwitchTab?.('orders')} style={btn(T.red, T.white)}>+ New PO</button>
        </div>
      </div>

      {/* Overdue alert */}
      {kpis.overdue.length>0 && (
        <div style={{ background:'#FEF2F2', border:'1px solid #FECACA', borderRadius:10, padding:'11px 16px', marginBottom:16, display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:8 }}>
          <span style={{ fontSize:13, fontWeight:600, color:T.red }}>
            ⚠️ {kpis.overdue.length} invoice{kpis.overdue.length>1?'s':''} unpaid past 30 days — <strong>{fmt(kpis.overdueAmt)}</strong> owed
          </span>
          <button onClick={()=>{ setPayF('pending'); setSortBy('age'); }} style={{ background:'#FECACA', color:'#991B1B', border:'none', borderRadius:7, padding:'5px 13px', fontSize:11, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>Show these</button>
        </div>
      )}

      {/* KPIs */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(150px,1fr))', gap:11, marginBottom:16 }}>
        <KPI label="Total Purchases" value={fmtL(kpis.total)}   icon="🛒" />
        <KPI label="Paid Out"        value={fmtL(kpis.paid)}    icon="✅" color={T.green}/>
        <KPI label="Payable"         value={fmtL(kpis.payable)} icon="⏳" color={kpis.payable>0?T.red:T.green} sub="still owed"/>
        <KPI label="Suppliers"       value={kpis.supCount}      icon="🏭" color={T.blue}/>
        <KPI label="Pending POs"     value={kpis.pending}       icon="⚠️" color={kpis.pending?T.amber:T.green} sub="not fully paid"/>
      </div>

      {/* Filters */}
      <div style={{ display:'flex', gap:9, marginBottom:12, flexWrap:'wrap', alignItems:'center' }}>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="🔍 PO number or supplier…" style={{ ...inp, flex:1, minWidth:200 }}/>
        <select value={payF} onChange={e=>setPayF(e.target.value)} style={{ ...inp, cursor:'pointer' }}>
          <option value="all">All Payment Status</option>
          {Object.entries(PAY_STATUS).map(([k,v])=><option key={k} value={k}>{v.l}</option>)}
        </select>
        <select value={statusF} onChange={e=>setStatusF(e.target.value)} style={{ ...inp, cursor:'pointer' }}>
          <option value="all">All PO Status</option>
          {Object.entries(PO_STATUS).map(([k,v])=><option key={k} value={k}>{v.l}</option>)}
        </select>
        <select value={supF} onChange={e=>setSupF(e.target.value)} style={{ ...inp, cursor:'pointer' }}>
          <option value="all">All Suppliers</option>
          {suppliers.map(s=><option key={s.id} value={s.name}>{s.name}</option>)}
        </select>
        <select value={sortBy} onChange={e=>setSortBy(e.target.value)} style={{ ...inp, cursor:'pointer' }}>
          <option value="date">↓ Newest</option>
          <option value="amount">↓ Amount</option>
          <option value="balance">↓ Balance Owed</option>
          <option value="age">↓ Oldest Unpaid</option>
        </select>
        <div style={{ fontSize:11, color:T.muted, whiteSpace:'nowrap' }}>{displayed.length} POs</div>
      </div>

      {/* Table */}
      <div style={{ background:T.white, border:`1px solid ${T.bdr}`, borderRadius:13, overflow:'hidden', boxShadow:'0 1px 4px rgba(0,0,0,.05)' }}>
        <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12.5 }}>
          <thead><tr style={{ background:T.lightRed }}>
            {['PO Number','Date','Supplier','Amount','Paid','Balance','Status','Action'].map(h=>(
              <th key={h} style={{ padding:'10px 12px', textAlign:['Amount','Paid','Balance'].includes(h)?'right':'left', fontSize:9, color:T.darkRed, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.04em', borderBottom:`1px solid ${T.bdr}`, whiteSpace:'nowrap' }}>{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {loading ? Array.from({length:6}).map((_,i)=>(
              <tr key={'sk'+i}>{Array.from({length:8}).map((_,j)=>(
                <td key={j} style={{ padding:12 }}><div style={{ height:14, background:'linear-gradient(90deg,#F0E8E8 25%,#F8F0F0 50%,#F0E8E8 75%)', backgroundSize:'200% 100%', animation:'skelShine 1.4s ease-in-out infinite', borderRadius:5, width:j===0?'70%':'50%' }}/></td>
              ))}</tr>
            ))
            : rows.length===0 ? (
              <tr><td colSpan={8} style={{ textAlign:'center', padding:50 }}>
                <div style={{ fontSize:34, marginBottom:8 }}>🛒</div>
                <div style={{ color:T.muted, fontWeight:600 }}>No purchase orders match these filters</div>
              </td></tr>
            )
            : rows.map(p=>{
                const ps = PAY_STATUS[p.payStatus];
                const os = PO_STATUS[p.status] || PO_STATUS.received;
                const overdue = p.balance>0 && p.ageDays>30;
                return (
                  <tr key={p.id} style={{ borderBottom:`1px solid ${T.bdr}22`, background: overdue?'#FFFAFA':'transparent' }}>
                    <td style={{ padding:'10px 12px', fontFamily:'monospace', fontWeight:700, color:T.blue, fontSize:11.5 }}>{p.po_number||'—'}</td>
                    <td style={{ padding:'10px 12px', color:T.sub }}>
                      {p.date}
                      {overdue && <div style={{ fontSize:9.5, color:T.red, fontWeight:700 }}>{p.ageDays}d overdue</div>}
                    </td>
                    <td style={{ padding:'10px 12px', color:T.ink, fontWeight:600 }}>{p.supplier||'—'}</td>
                    <td style={{ padding:'10px 12px', textAlign:'right', color:T.ink, fontWeight:700 }}>{fmt(p.total)}</td>
                    <td style={{ padding:'10px 12px', textAlign:'right', color:p.paid>0?T.green:T.muted, fontWeight:p.paid>0?700:400 }}>{fmt(p.paid)}</td>
                    <td style={{ padding:'10px 12px', textAlign:'right', color:p.balance>0?T.red:T.muted, fontWeight:p.balance>0?800:400 }}>{p.balance>0?fmt(p.balance):'—'}</td>
                    <td style={{ padding:'10px 12px' }}>
                      <div style={{ display:'flex', gap:5, flexWrap:'wrap' }}>
                        <span style={{ background:os.bg, color:os.color, border:`1px solid ${os.bdr}`, borderRadius:5, padding:'2px 8px', fontSize:9, fontWeight:700 }}>{os.l.toUpperCase()}</span>
                        <span style={{ background:ps.bg, color:ps.color, border:`1px solid ${ps.bdr}`, borderRadius:5, padding:'2px 8px', fontSize:9, fontWeight:700 }}>{ps.l.toUpperCase()}</span>
                      </div>
                    </td>
                    <td style={{ padding:'10px 12px' }}>
                      {p.balance > 0.5
                        ? <button onClick={()=>{ setPayFor(p); setPayAmt(String(Math.round(p.balance))); }}
                            style={{ background:T.lightRed, color:T.red, border:`1px solid ${T.bdr}`, borderRadius:7, padding:'5px 13px', fontSize:10.5, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>Pay ↑</button>
                        : <span style={{ background:'#F0FDF4', color:T.green, border:'1px solid #BBF7D0', borderRadius:7, padding:'4px 12px', fontSize:10, fontWeight:700 }}>Settled</span>}
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>

      {displayed.length > PAGE && (
        <div style={{ textAlign:'center', margin:'12px 0' }}>
          <button onClick={()=>setShowAll(s=>!s)} style={btn(T.white, T.red, { border:`1px solid ${T.bdr}`, padding:'9px 20px' })}>
            {showAll ? 'Show fewer' : `Show all ${displayed.length} (${displayed.length-PAGE} more)`}
          </button>
        </div>
      )}

      {/* Pay modal */}
      {payFor && (
        <div onClick={()=>setPayFor(null)} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.5)', zIndex:300, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
          <div onClick={e=>e.stopPropagation()} style={{ background:T.white, borderRadius:15, padding:25, width:'100%', maxWidth:400, boxShadow:'0 20px 60px rgba(0,0,0,.25)' }}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:5 }}>
              <div style={{ fontSize:16, fontWeight:800, color:T.darkRed }}>Record Payment</div>
              <button onClick={()=>setPayFor(null)} style={{ background:'none', border:'none', fontSize:21, cursor:'pointer', color:T.muted }}>×</button>
            </div>
            <div style={{ fontSize:12, color:T.sub, marginBottom:16 }}>{payFor.po_number} · {payFor.supplier}</div>

            <div style={{ background:T.bg, borderRadius:10, padding:'12px 15px', marginBottom:15, fontSize:12.5 }}>
              {[['Invoice total', fmt(payFor.total), T.ink],['Already paid', fmt(payFor.paid), T.green],['Balance owed', fmt(payFor.balance), T.red]].map(([k,v,col])=>(
                <div key={k} style={{ display:'flex', justifyContent:'space-between', padding:'3px 0' }}>
                  <span style={{ color:T.sub }}>{k}</span><strong style={{ color:col }}>{v}</strong>
                </div>
              ))}
            </div>

            <form onSubmit={recordPayment}>
              <label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:5 }}>Amount Paying Now</label>
              <input type="number" value={payAmt} onChange={e=>setPayAmt(e.target.value)} required autoFocus
                style={{ ...inp, width:'100%', fontSize:17, fontWeight:800, color:T.green, marginBottom:12 }}/>

              <label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:5 }}>Payment Mode</label>
              <div style={{ display:'flex', gap:6, marginBottom:16, flexWrap:'wrap' }}>
                {['cash','upi','bank_transfer','cheque'].map(m=>(
                  <button key={m} type="button" onClick={()=>setPayMode(m)}
                    style={{ flex:1, minWidth:70, padding:'8px 6px', background: payMode===m?T.red:T.bg, color: payMode===m?'#fff':T.sub,
                             border:`1px solid ${payMode===m?T.red:T.bdr}`, borderRadius:8, fontSize:11, fontWeight:700, cursor:'pointer', fontFamily:'inherit', textTransform:'capitalize' }}>
                    {m.replace('_',' ')}
                  </button>
                ))}
              </div>

              {parseFloat(payAmt)>0 && (
                <div style={{ background: parseFloat(payAmt)>=payFor.balance?'#F0FDF4':'#FFFBEB', border:`1px solid ${parseFloat(payAmt)>=payFor.balance?'#BBF7D0':'#FDE68A'}`, borderRadius:8, padding:'10px 13px', marginBottom:15, fontSize:12, color: parseFloat(payAmt)>=payFor.balance?T.green:T.amber, fontWeight:600 }}>
                  {parseFloat(payAmt)>=payFor.balance
                    ? '✅ This settles the invoice in full'
                    : `Remaining after this: ${fmt(payFor.balance - parseFloat(payAmt))}`}
                </div>
              )}

              <div style={{ display:'flex', gap:10 }}>
                <button type="button" onClick={()=>setPayFor(null)} style={{ flex:1, background:T.bg, color:T.sub, border:`1px solid ${T.bdr}`, borderRadius:9, padding:'12px', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>Cancel</button>
                <button type="submit" disabled={saving} style={{ flex:2, ...btn(T.green, T.white, { padding:'12px', fontSize:13 }) }}>{saving?'Recording…':'Record Payment'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
