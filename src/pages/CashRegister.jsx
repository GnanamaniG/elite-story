import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

// ── Inline thermal print (no external lib needed) ─────────────
function printCashSummary(session, sales, tenant) {
  const w    = window.open('', '_blank', 'width=340,height=500');
  const biz  = tenant?.name || 'Elite Store';
  const date = new Date(session.opened_at).toLocaleDateString('en-IN');
  const cashSales = sales.filter(s=>s.payment_mode==='cash').reduce((t,s)=>t+(s.total||0),0);
  const upiSales  = sales.filter(s=>s.payment_mode==='upi').reduce((t,s)=>t+(s.total||0),0);
  const cardSales = sales.filter(s=>s.payment_mode==='card').reduce((t,s)=>t+(s.total||0),0);
  const totalSales= sales.reduce((t,s)=>t+(s.total||0),0);
  const html = `<!DOCTYPE html><html><head><style>
    body{font-family:'Courier New',monospace;font-size:12px;margin:0;padding:8px;}
    .center{text-align:center;}.bold{font-weight:bold;}.large{font-size:15px;}
    .divider{border-top:1px dashed #000;margin:5px 0;}
    .row{display:flex;justify-content:space-between;padding:2px 0;}
  </style></head><body>
    <div class="center bold large">${biz}</div>
    <div class="center">END OF DAY REPORT</div>
    <div class="center">${date}</div>
    <div class="divider"></div>
    <div class="row"><span>Opening Float</span><span>Rs.${(session.opening_float||0).toFixed(2)}</span></div>
    <div class="divider"></div>
    <div class="bold">SALES SUMMARY</div>
    <div class="row"><span>Total Orders</span><span>${sales.length}</span></div>
    <div class="row"><span>Cash Sales</span><span>Rs.${cashSales.toFixed(2)}</span></div>
    <div class="row"><span>UPI Sales</span><span>Rs.${upiSales.toFixed(2)}</span></div>
    <div class="row"><span>Card Sales</span><span>Rs.${cardSales.toFixed(2)}</span></div>
    <div class="divider"></div>
    <div class="row bold"><span>Total Revenue</span><span>Rs.${totalSales.toFixed(2)}</span></div>
    <div class="row bold"><span>Expected Cash</span><span>Rs.${(session.expected_cash||0).toFixed(2)}</span></div>
    <div class="row bold"><span>Actual Cash</span><span>Rs.${(session.closing_cash||0).toFixed(2)}</span></div>
    <div class="divider"></div>
    <div class="row bold large"><span>Difference</span><span style="color:${(session.difference||0)>=0?'green':'red'}">Rs.${(session.difference||0).toFixed(2)}</span></div>
    <div style="height:20px"></div>
    <script>window.onload=()=>{window.print();setTimeout(()=>window.close(),1000);}<\/script>
  </body></html>`;
  w.document.write(html); w.document.close();
}




const T = { bg:'#060710', srf:'#0f1220', card:'#141828', bdr:'#1e2540', blue:'#4f7cff', ink:'#eef0f8', sub:'#6b7598', muted:'#4a5175', green:'#00d68f', amber:'#ffb547', red:'#ff4d6a', teal:'#00c9b1' };
const fmt = n => 'Rs.' + (n||0).toLocaleString('en-IN', { minimumFractionDigits:2, maximumFractionDigits:2 });
const fmtN = n => 'Rs.' + (n||0).toLocaleString('en-IN', { maximumFractionDigits:0 });


async function getSalesData(tenantId) {
  const { data } = await supabase.from('sales').select('total,payment_mode,date,customer').eq('tenant_id', tenantId).order('date', { ascending:false }).limit(200);
  return data || [];
}

export default function CashRegister({ tenant, user }) {
  const [session,    setSession]    = useState(null);
  const [sessions,   setSessions]   = useState([]);
  const [txns,       setTxns]       = useState([]);
  const [todaySales, setTodaySales] = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [openFloat,  setOpenFloat]  = useState('');
  const [cashIn,     setCashIn]     = useState('');
  const [cashOut,    setCashOut]    = useState('');
  const [txnReason,  setTxnReason]  = useState('');
  const [closing,    setClosing]    = useState('');
  const [saving,     setSaving]     = useState(false);
  const [view,       setView]       = useState('current'); // current | history

  useEffect(() => { if (tenant?.id) load(); }, [tenant?.id]);

  async function load() {
    setLoading(true);
    const today = new Date().toISOString().slice(0,10);
    const [sessRes, salesRes] = await Promise.all([
      supabase.from('cash_sessions').select('*').eq('tenant_id', tenant.id).order('opened_at', { ascending:false }).limit(30),
      getSalesData(tenant.id),
    ]);
    const allSessions = sessRes.data || [];
    const openSession = allSessions.find(s => s.status === 'open');
    setSession(openSession || null);
    setSessions(allSessions);
    const todaySalesData = salesRes.filter(s => s.date === today);
    setTodaySales(todaySalesData);
    if (openSession) {
      const { data: txnData } = await supabase.from('cash_transactions').select('*').eq('session_id', openSession.id).order('created_at');
      setTxns(txnData || []);
    }
    setLoading(false);
  }

  async function openSession() {
    if (!openFloat && openFloat !== '0') return alert('Enter opening float amount');
    setSaving(true);
    const { data } = await supabase.from('cash_sessions').insert({
      tenant_id: tenant.id, opened_by: user?.id,
      opening_float: parseFloat(openFloat)||0, status:'open',
    }).select().single();
    setSession(data); setOpenFloat('');
    setSaving(false);
    await load();
  }

  async function addTransaction(type) {
    const amount = parseFloat(type==='in'?cashIn:cashOut)||0;
    if (!amount || !txnReason) return alert('Enter amount and reason');
    setSaving(true);
    await supabase.from('cash_transactions').insert({
      tenant_id: tenant.id, session_id: session.id,
      type, amount, reason: txnReason,
    });
    setCashIn(''); setCashOut(''); setTxnReason('');
    setSaving(false);
    await load();
  }

  async function closeSession() {
    if (!closing && closing !== '0') return alert('Enter actual cash count');
    const closingAmt   = parseFloat(closing)||0;
    const cashSales    = todaySales.filter(s=>s.payment_mode==='cash').reduce((t,s)=>t+(s.total||0),0);
    const txnIn        = txns.filter(t=>t.type==='in').reduce((s,t)=>s+(t.amount||0),0);
    const txnOut       = txns.filter(t=>t.type==='out').reduce((s,t)=>s+(t.amount||0),0);
    const expected     = (session.opening_float||0) + cashSales + txnIn - txnOut;
    const diff         = closingAmt - expected;
    setSaving(true);
    const { data: updated } = await supabase.from('cash_sessions').update({
      status:'closed', closed_at:new Date().toISOString(),
      closing_cash:closingAmt, expected_cash:expected, difference:diff,
    }).eq('id', session.id).select().single();
    printCashSummary(updated, todaySales, tenant);
    setSession(null); setClosing('');
    setSaving(false);
    await load();
  }

  const cashSales = todaySales.filter(s=>s.payment_mode==='cash').reduce((t,s)=>t+(s.total||0),0);
  const upiSales  = todaySales.filter(s=>s.payment_mode==='upi').reduce((t,s)=>t+(s.total||0),0);
  const cardSales = todaySales.filter(s=>s.payment_mode==='card').reduce((t,s)=>t+(s.total||0),0);
  const txnIn     = txns.filter(t=>t.type==='in').reduce((s,t)=>s+(t.amount||0),0);
  const txnOut    = txns.filter(t=>t.type==='out').reduce((s,t)=>s+(t.amount||0),0);
  const expectedCash = session ? (session.opening_float||0) + cashSales + txnIn - txnOut : 0;
  const inp = { background:T.card, border:`1px solid ${T.bdr}`, borderRadius:8, padding:'9px 12px', color:T.ink, fontSize:13, fontFamily:'inherit', outline:'none', width:'100%' };

  return (
    <div style={{ padding:20 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
        <div>
          <div style={{ fontSize:22, fontWeight:800, color:T.ink }}>💵 Cash Register</div>
          <div style={{ fontSize:13, color:T.sub }}>{new Date().toLocaleDateString('en-IN', { weekday:'long', day:'numeric', month:'long' })}</div>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          {[['current','Today'],['history','History']].map(([id,label]) => (
            <button key={id} onClick={() => setView(id)} style={{ background:view===id?T.blue:T.srf, color:view===id?'#fff':T.sub, border:`1px solid ${view===id?T.blue:T.bdr}`, borderRadius:7, padding:'7px 14px', fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}>{label}</button>
          ))}
        </div>
      </div>

      {view === 'history' ? (
        <div style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:12, overflow:'hidden' }}>
          <div style={{ padding:'12px 18px', borderBottom:`1px solid ${T.bdr}`, fontWeight:700, color:T.ink }}>Session History</div>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
            <thead><tr style={{ background:T.card }}>
              {['Date','Opened','Float','Cash Sales','Expected','Actual','Diff','Status'].map(h=>(
                <th key={h} style={{ padding:'9px 14px', textAlign:'left', fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', borderBottom:`1px solid ${T.bdr}` }}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {sessions.map(s => (
                <tr key={s.id} style={{ borderBottom:`1px solid ${T.bdr}22` }}>
                  <td style={{ padding:'10px 14px', color:T.sub }}>{new Date(s.opened_at).toLocaleDateString('en-IN')}</td>
                  <td style={{ padding:'10px 14px', color:T.sub }}>{new Date(s.opened_at).toLocaleTimeString('en-IN', { hour:'2-digit', minute:'2-digit' })}</td>
                  <td style={{ padding:'10px 14px', color:T.ink }}>{fmt(s.opening_float)}</td>
                  <td style={{ padding:'10px 14px', color:T.green }}>{fmt(s.expected_cash)}</td>
                  <td style={{ padding:'10px 14px', color:T.ink }}>{fmt(s.expected_cash)}</td>
                  <td style={{ padding:'10px 14px', color:T.ink }}>{s.closing_cash!=null?fmt(s.closing_cash):'—'}</td>
                  <td style={{ padding:'10px 14px', color:(s.difference||0)>=0?T.green:T.red, fontWeight:700 }}>{s.difference!=null?fmt(s.difference):'—'}</td>
                  <td style={{ padding:'10px 14px' }}>
                    <span style={{ background:s.status==='open'?T.green+'22':T.muted+'22', color:s.status==='open'?T.green:T.muted, borderRadius:5, padding:'2px 8px', fontSize:10, fontWeight:700 }}>{s.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : loading ? <div style={{ textAlign:'center', color:T.sub, padding:60 }}>Loading…</div> : (
        <>
          {/* No session — open drawer */}
          {!session && (
            <div style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:14, padding:32, textAlign:'center', maxWidth:400, margin:'0 auto' }}>
              <div style={{ fontSize:48, marginBottom:16 }}>💰</div>
              <div style={{ fontSize:18, fontWeight:700, color:T.ink, marginBottom:6 }}>Open Cash Drawer</div>
              <div style={{ fontSize:13, color:T.sub, marginBottom:20 }}>Count opening cash and start today's session</div>
              <div style={{ marginBottom:14, textAlign:'left' }}>
                <label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:5 }}>Opening Float (Rs.)</label>
                <input type="number" value={openFloat} onChange={e=>setOpenFloat(e.target.value)} placeholder="e.g. 1000" style={inp} autoFocus />
              </div>
              <button onClick={openSession} disabled={saving} style={{ background:T.green, color:'#fff', border:'none', borderRadius:9, padding:'13px', fontSize:15, fontWeight:700, cursor:'pointer', fontFamily:'inherit', width:'100%' }}>
                {saving?'Opening…':'Open Drawer ✅'}
              </button>
            </div>
          )}

          {/* Active session */}
          {session && (
            <>
              {/* Today's summary */}
              <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:12, marginBottom:20 }}>
                {[
                  ['Opening Float', fmt(session.opening_float), T.sub],
                  ['Cash Sales', fmtN(cashSales), T.green],
                  ['UPI Sales', fmtN(upiSales), T.blue],
                  ['Card Sales', fmtN(cardSales), T.purple],
                  ['Expected Cash', fmt(expectedCash), T.amber],
                ].map(([label,val,color]) => (
                  <div key={label} style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:10, padding:'12px 16px' }}>
                    <div style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', marginBottom:5 }}>{label}</div>
                    <div style={{ fontSize:18, fontWeight:800, color }}>{val}</div>
                  </div>
                ))}
              </div>

              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
                {/* Cash in/out */}
                <div>
                  <div style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:12, padding:18, marginBottom:14 }}>
                    <div style={{ fontWeight:700, color:T.ink, marginBottom:14 }}>Record Cash Movement</div>
                    <div style={{ marginBottom:10 }}>
                      <label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:5 }}>Reason *</label>
                      <input value={txnReason} onChange={e=>setTxnReason(e.target.value)} placeholder="e.g. Petty cash, Refund, Expense" style={inp} />
                    </div>
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                      <div>
                        <label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:5 }}>Cash In</label>
                        <input type="number" value={cashIn} onChange={e=>setCashIn(e.target.value)} placeholder="0.00" style={inp} />
                        <button onClick={() => addTransaction('in')} disabled={saving} style={{ background:T.green, color:'#fff', border:'none', borderRadius:7, padding:'9px', fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:'inherit', width:'100%', marginTop:6 }}>+ Cash In</button>
                      </div>
                      <div>
                        <label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:5 }}>Cash Out</label>
                        <input type="number" value={cashOut} onChange={e=>setCashOut(e.target.value)} placeholder="0.00" style={inp} />
                        <button onClick={() => addTransaction('out')} disabled={saving} style={{ background:T.red, color:'#fff', border:'none', borderRadius:7, padding:'9px', fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:'inherit', width:'100%', marginTop:6 }}>- Cash Out</button>
                      </div>
                    </div>
                  </div>

                  {/* Close drawer */}
                  <div style={{ background:T.amber+'12', border:`1px solid ${T.amber}44`, borderRadius:12, padding:18 }}>
                    <div style={{ fontWeight:700, color:T.amber, marginBottom:10 }}>🔒 Close Drawer</div>
                    <div style={{ fontSize:12, color:T.sub, marginBottom:12 }}>Count actual cash and close today's session</div>
                    <input type="number" value={closing} onChange={e=>setClosing(e.target.value)} placeholder="Actual cash count" style={inp} />
                    {closing && <div style={{ fontSize:12, color:(parseFloat(closing)-expectedCash)>=0?T.green:T.red, marginTop:6, fontWeight:700 }}>
                      Difference: {fmt(parseFloat(closing)-expectedCash)}
                    </div>}
                    <button onClick={closeSession} disabled={saving} style={{ background:T.amber, color:'#fff', border:'none', borderRadius:8, padding:'11px', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit', width:'100%', marginTop:10 }}>
                      {saving?'Closing…':'Close & Print Summary'}
                    </button>
                  </div>
                </div>

                {/* Transaction log */}
                <div style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:12, overflow:'hidden' }}>
                  <div style={{ padding:'12px 18px', borderBottom:`1px solid ${T.bdr}`, fontWeight:700, color:T.ink }}>Cash Log</div>
                  <div style={{ maxHeight:360, overflowY:'auto' }}>
                    <div style={{ padding:'8px 16px', borderBottom:`1px solid ${T.bdr}22`, display:'flex', justifyContent:'space-between', fontSize:12 }}>
                      <span style={{ color:T.muted }}>Opening Float</span>
                      <span style={{ color:T.sub, fontWeight:700 }}>{fmt(session.opening_float)}</span>
                    </div>
                    {txns.map(t => (
                      <div key={t.id} style={{ padding:'8px 16px', borderBottom:`1px solid ${T.bdr}22`, display:'flex', justifyContent:'space-between', alignItems:'center', fontSize:12 }}>
                        <div>
                          <div style={{ color:T.ink }}>{t.reason}</div>
                          <div style={{ fontSize:10, color:T.muted }}>{new Date(t.created_at).toLocaleTimeString('en-IN', { hour:'2-digit', minute:'2-digit' })}</div>
                        </div>
                        <span style={{ color:t.type==='in'?T.green:T.red, fontWeight:700 }}>{t.type==='in'?'+':'-'}{fmt(t.amount)}</span>
                      </div>
                    ))}
                    {!txns.length && <div style={{ padding:24, textAlign:'center', color:T.muted, fontSize:12 }}>No transactions yet</div>}
                  </div>
                </div>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
