import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';

const T = {
  bg:'#F7F3F3', srf:'#FFFFFF', card:'#FFFFFF', bdr:'#E8DEDE',
  red:'#C0392B', darkRed:'#8B0000', lightRed:'#FEF2F2',
  green:'#16A34A', amber:'#D97706', blue:'#2563EB', purple:'#7C3AED', teal:'#0D9488',
  ink:'#111827', sub:'#6B7280', muted:'#9CA3AF', white:'#FFFFFF'
};
const fmt  = n => 'Rs.' + Math.abs(n||0).toLocaleString('en-IN', { maximumFractionDigits:0 });
const fmtL = n => { const a=Math.abs(n||0); const s=n<0?'-':''; return a>=100000 ? s+'₹'+(a/100000).toFixed(1)+'L' : a>=1000 ? s+'₹'+(a/1000).toFixed(1)+'K' : s+fmt(a); };
const pct  = n => (n||0).toFixed(0)+'%';
const btn  = (bg,color,extra={}) => ({ background:bg, color, border:'none', borderRadius:9, padding:'9px 16px', fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:'inherit', ...extra });
const inp  = { background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:8, padding:'9px 12px', color:T.ink, fontSize:13, fontFamily:'inherit', outline:'none' };

const KIND = {
  cash: { l:'Cash in Hand',  icon:'💵', color:'#16A34A', sub:'Petty cash + counter cash' },
  upi:  { l:'UPI / Wallet',  icon:'📱', color:'#2563EB', sub:'PhonePe · GPay · Paytm collected' },
  bank: { l:'Bank Accounts', icon:'🏦', color:'#7C3AED', sub:'Current · Savings · OD' },
};
const PALETTE = ['#16A34A','#2563EB','#7C3AED','#0D9488','#D97706','#C0392B'];

export default function AccountingDashboard({ tenant, role='owner', onSwitchTab, onNavigate }) {
  const [accounts, setAccounts] = useState([]);
  const [fin,      setFin]      = useState(null);
  const [loading,  setLoading]  = useState(true);
  const [period,   setPeriod]   = useState('month');
  const [showBal,  setShowBal]  = useState(false);
  const [editRows, setEditRows] = useState([]);
  const [saving,   setSaving]   = useState(false);
  const [saved,    setSaved]    = useState(false);

  useEffect(() => { if (tenant?.id) load(); }, [tenant?.id, period]);

  async function load() {
    setLoading(true);
    const now = new Date(), yr = now.getFullYear();
    const from = period==='month' ? `${yr}-${String(now.getMonth()+1).padStart(2,'0')}-01`
               : period==='quarter' ? new Date(yr, Math.floor(now.getMonth()/3)*3, 1).toISOString().slice(0,10)
               : `${yr}-04-01`;
    const to = now.toISOString().slice(0,10);

    const [accRes, sRes, eRes, pRes, iRes, cRes, payRes] = await Promise.all([
      supabase.from('bank_accounts').select('*').eq('tenant_id', tenant.id).eq('active', true).order('kind').order('name'),
      supabase.from('sales').select('total,gst_amount,items,date').eq('tenant_id', tenant.id).gte('date', from).lte('date', to),
      supabase.from('expenses').select('amount,category,date').eq('tenant_id', tenant.id).gte('date', from).lte('date', to),
      supabase.from('purchases').select('total,gst_amount,paid,date').eq('tenant_id', tenant.id).gte('date', from).lte('date', to),
      supabase.from('inventory').select('stock,cp').eq('tenant_id', tenant.id).eq('active', true),
      supabase.from('customers').select('outstanding').eq('tenant_id', tenant.id),
      supabase.from('supplier_payments').select('paid_amount,purchase_id').eq('tenant_id', tenant.id),
    ]);

    const sales = sRes.data||[], exps = eRes.data||[], purs = pRes.data||[], inv = iRes.data||[], custs = cRes.data||[];

    const revenue    = sales.reduce((s,x)=>s+(x.total||0),0);
    const gstOut     = sales.reduce((s,x)=>s+(x.gst_amount||0),0);
    const gstIn      = purs.reduce((s,x)=>s+(x.gst_amount||0),0);
    const expTotal   = exps.reduce((s,x)=>s+(x.amount||0),0);
    const purTotal   = purs.reduce((s,x)=>s+(x.total||0),0);
    const purPaid    = purs.reduce((s,x)=>s+(x.paid||0),0)
                     + (payRes.data||[]).reduce((s,x)=>s+(x.paid_amount||0),0);
    const payables   = Math.max(0, purTotal - purPaid);
    const receivables= custs.reduce((s,c)=>s+(c.outstanding||0),0);
    const stockValue = inv.reduce((s,i)=>s+(i.stock||0)*(i.cp||0),0);

    // COGS from sale line items where cost is known
    let cogs = 0;
    sales.forEach(s => (s.items||[]).forEach(li => { cogs += (li.cp||0)*(li.qty||1); }));
    if (cogs === 0) cogs = purTotal;   // fall back when line items carry no cost

    const grossProfit = revenue - cogs;
    const netProfit   = grossProfit - expTotal;
    const netMargin   = revenue>0 ? netProfit/revenue*100 : 0;
    const gstPayable  = Math.max(0, gstOut - gstIn);

    setAccounts(accRes.data||[]);
    setFin({ revenue, cogs, grossProfit, expTotal, netProfit, netMargin,
             gstOut, gstIn, gstPayable, payables, receivables, stockValue,
             expByCat: exps.reduce((a,e)=>{ const k=e.category||'Other'; a[k]=(a[k]||0)+(e.amount||0); return a; }, {}) });
    setLoading(false);
  }

  const funds = useMemo(() => {
    const byKind = { cash:0, upi:0, bank:0 };
    accounts.forEach(a => {
      const v = a.is_overdraft ? -Math.abs(a.balance||0) : (a.balance||0);
      byKind[a.kind] = (byKind[a.kind]||0) + v;
    });
    const total = byKind.cash + byKind.upi + byKind.bank;
    const lastRec = accounts.map(a=>a.last_reconciled).filter(Boolean).sort().pop();
    return { ...byKind, total, lastRec, bankList: accounts.filter(a=>a.kind==='bank') };
  }, [accounts]);

  const sheet = useMemo(() => {
    if (!fin) return null;
    const assets = funds.total + fin.receivables + fin.stockValue;
    const liabs  = fin.payables + fin.gstPayable;
    return { assets, liabs, netWorth: assets - liabs };
  }, [fin, funds]);

  function openBalances() {
    setEditRows(accounts.map(a=>({ ...a, _bal:String(a.balance||0) })));
    setShowBal(true);
  }

  async function saveBalances() {
    setSaving(true);
    for (const r of editRows) {
      if (r._new) {
        if (!r.name?.trim()) continue;
        await supabase.from('bank_accounts').insert({
          tenant_id: tenant.id, name:r.name, kind:r.kind||'bank',
          balance: parseFloat(r._bal)||0, is_overdraft: !!r.is_overdraft,
          last_reconciled: new Date().toISOString(),
        });
      } else {
        await supabase.from('bank_accounts').update({
          balance: parseFloat(r._bal)||0, name:r.name, is_overdraft: !!r.is_overdraft,
          last_reconciled: new Date().toISOString(),
        }).eq('id', r.id);
      }
    }
    setShowBal(false); setSaved(true); setTimeout(()=>setSaved(false),2500);
    await load(); setSaving(false);
  }

  const Tile = ({ kind, value }) => {
    const k = KIND[kind];
    const share = funds.total>0 ? Math.abs(value)/Math.abs(funds.total)*100 : 0;
    return (
      <div style={{ background:T.white, border:`1px solid ${T.bdr}`, borderRadius:12, padding:'15px 17px', flex:1, minWidth:200 }}>
        <div style={{ display:'flex', alignItems:'center', gap:11, marginBottom:9 }}>
          <div style={{ width:36, height:36, borderRadius:9, background:k.color+'18', display:'flex', alignItems:'center', justifyContent:'center', fontSize:17 }}>{k.icon}</div>
          <div>
            <div style={{ fontSize:9, color:T.sub, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.05em' }}>{k.l}</div>
            <div style={{ fontSize:20, fontWeight:900, color: value<0?T.red:k.color, letterSpacing:'-0.02em' }}>{fmtL(value)}</div>
          </div>
        </div>
        {kind==='bank' && funds.bankList.length>0 ? (
          <div style={{ marginBottom:8 }}>
            {funds.bankList.slice(0,4).map((b,i)=>(
              <div key={b.id} style={{ display:'flex', justifyContent:'space-between', padding:'2px 0', fontSize:11 }}>
                <span style={{ color:T.sub }}>
                  <span style={{ display:'inline-block', width:6, height:6, borderRadius:'50%', background:PALETTE[i%PALETTE.length], marginRight:6 }}/>
                  {b.name}{b.is_overdraft?' (OD)':''}
                </span>
                <span style={{ color: b.is_overdraft?T.red:T.ink, fontWeight:600 }}>{fmtL(b.is_overdraft?-Math.abs(b.balance):b.balance)}</span>
              </div>
            ))}
          </div>
        ) : <div style={{ fontSize:11, color:T.muted, marginBottom:8 }}>{k.sub}</div>}
        <div style={{ height:4, background:'#F3F4F6', borderRadius:2, overflow:'hidden' }}>
          <div style={{ height:'100%', width:`${Math.min(100,share)}%`, background:k.color, borderRadius:2 }}/>
        </div>
        <div style={{ fontSize:10, color:T.muted, marginTop:5 }}>
          {pct(share)} of total funds{kind==='bank'&&funds.bankList.length?` · ${funds.bankList.length} account${funds.bankList.length>1?'s':''}`:''}
        </div>
      </div>
    );
  };

  const StatCard = ({ label, value, sub, icon, color }) => (
    <div style={{ background:T.white, border:`1px solid ${T.bdr}`, borderRadius:12, padding:'14px 16px', display:'flex', gap:12, alignItems:'center' }}>
      <div style={{ width:36, height:36, borderRadius:9, background:(color||T.red)+'18', display:'flex', alignItems:'center', justifyContent:'center', fontSize:17, flexShrink:0 }}>{icon}</div>
      <div style={{ minWidth:0 }}>
        <div style={{ fontSize:9, color:T.sub, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.05em' }}>{label}</div>
        <div style={{ fontSize:19, fontWeight:900, color:color||T.ink, letterSpacing:'-0.02em' }}>{value}</div>
        {sub && <div style={{ fontSize:10, color:T.muted }}>{sub}</div>}
      </div>
    </div>
  );

  if (loading || !fin) return (
    <div style={{ padding:22, background:T.bg, minHeight:'100%' }}>
      <div style={{ height:22, width:220, background:'#F0E8E8', borderRadius:6, marginBottom:20, animation:'skelShine 1.4s ease-in-out infinite' }}/>
      <div style={{ height:180, background:'#F0E8E8', borderRadius:14, marginBottom:16, animation:'skelShine 1.4s ease-in-out infinite' }}/>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12 }}>
        {[1,2,3,4].map(i=><div key={i} style={{ height:74, background:'#F0E8E8', borderRadius:12, animation:'skelShine 1.4s ease-in-out infinite' }}/>)}
      </div>
    </div>
  );

  return (
    <div style={{ padding:22, background:T.bg, minHeight:'100%' }}>

      {/* Header */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:18, flexWrap:'wrap', gap:12 }}>
        <div>
          <div style={{ fontSize:20, fontWeight:900, color:T.darkRed, letterSpacing:'-0.02em' }}>Accounting &amp; GST</div>
          <div style={{ fontSize:12, color:T.sub, marginTop:3 }}>
            Funds · Financial position · GST compliance
            {saved && <span style={{ color:T.green, fontWeight:700, marginLeft:8 }}>✓ Balances updated</span>}
          </div>
        </div>
        <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
          <select value={period} onChange={e=>setPeriod(e.target.value)} style={{ ...inp, cursor:'pointer' }}>
            <option value="month">This Month</option>
            <option value="quarter">This Quarter</option>
            <option value="year">This FY</option>
          </select>
          <button onClick={()=>onSwitchTab?.('pl')}       style={btn(T.bg, T.sub, { border:`1px solid ${T.bdr}` })}>📊 P&amp;L</button>
          <button onClick={()=>onSwitchTab?.('cashflow')} style={btn(T.bg, T.sub, { border:`1px solid ${T.bdr}` })}>💹 Cash Flow</button>
        </div>
      </div>

      {/* ── Total available funds ── */}
      <div style={{ background:T.white, border:`1px solid ${T.bdr}`, borderRadius:14, padding:'20px 22px', marginBottom:16, boxShadow:'0 1px 4px rgba(0,0,0,.05)' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:16, flexWrap:'wrap', gap:12 }}>
          <div>
            <div style={{ fontSize:10, color:T.darkRed, fontWeight:800, textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:5 }}>
              💰 Total Available Funds
            </div>
            <div style={{ fontSize:34, fontWeight:900, color: funds.total<0?T.red:T.green, letterSpacing:'-0.03em', lineHeight:1 }}>
              {fmtL(funds.total)}
            </div>
            <div style={{ fontSize:11.5, color:T.sub, marginTop:5 }}>Cash · UPI · Bank — ready to use</div>
          </div>
          {funds.total !== 0 && (
            <div style={{ minWidth:210 }}>
              <div style={{ display:'flex', height:9, borderRadius:5, overflow:'hidden', marginBottom:7 }}>
                {[['cash',funds.cash],['upi',funds.upi],['bank',funds.bank]].filter(([,v])=>v>0).map(([k,v])=>(
                  <div key={k} style={{ width:`${v/Math.abs(funds.total)*100}%`, background:KIND[k].color }}/>
                ))}
              </div>
              <div style={{ display:'flex', gap:11, flexWrap:'wrap', fontSize:10 }}>
                {Object.entries(KIND).map(([k,cfg])=>(
                  <span key={k} style={{ color:T.sub, display:'flex', alignItems:'center', gap:4 }}>
                    <span style={{ width:7, height:7, borderRadius:'50%', background:cfg.color }}/>{cfg.l.split(' ')[0]}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        <div style={{ display:'flex', gap:12, flexWrap:'wrap' }}>
          <Tile kind="cash" value={funds.cash}/>
          <Tile kind="upi"  value={funds.upi}/>
          <Tile kind="bank" value={funds.bank}/>
        </div>

        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginTop:14, paddingTop:13, borderTop:`1px solid ${T.bdr}`, flexWrap:'wrap', gap:9 }}>
          <span style={{ fontSize:11, color:T.muted }}>
            {funds.lastRec ? `Last reconciled: ${new Date(funds.lastRec).toLocaleString('en-IN',{ day:'numeric', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' })}` : 'Not reconciled yet — enter your balances to begin'}
          </span>
          <button onClick={openBalances} style={btn(T.lightRed, T.red, { border:`1px solid ${T.bdr}`, padding:'7px 15px', fontSize:11.5 })}>+ Update Balances</button>
        </div>
      </div>

      {/* ── Financial position ── */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(190px,1fr))', gap:12, marginBottom:16 }}>
        <StatCard label="Total Assets"      value={fmtL(sheet.assets)}  icon="🏛️" color={T.blue}   sub="funds + stock + receivables"/>
        <StatCard label="Total Liabilities" value={fmtL(sheet.liabs)}   icon="📋" color={T.amber}  sub="payables + GST due"/>
        <StatCard label="Net Worth"         value={fmtL(sheet.netWorth)} icon="💼" color={sheet.netWorth>=0?T.green:T.red} sub="owner's equity"/>
        <StatCard label="Net Profit"        value={fmtL(fin.netProfit)} icon="📈" color={fin.netProfit>=0?T.green:T.red} sub={`${fin.netMargin.toFixed(0)}% margin`}/>
      </div>

      {/* ── Two-column: P&L summary + GST ── */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(330px,1fr))', gap:14 }}>

        {/* P&L waterfall */}
        <div style={{ background:T.white, border:`1px solid ${T.bdr}`, borderRadius:13, padding:'17px 19px', boxShadow:'0 1px 4px rgba(0,0,0,.05)' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
            <div style={{ fontSize:13, fontWeight:800, color:T.darkRed }}>📊 Profit &amp; Loss</div>
            <button onClick={()=>onSwitchTab?.('pl')} style={{ background:'none', border:'none', color:T.red, fontSize:11, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>Full statement →</button>
          </div>
          {[
            ['Revenue',       fin.revenue,      T.blue,  null],
            ['Cost of Goods', -fin.cogs,        T.amber, fin.revenue?fin.cogs/fin.revenue*100:0],
            ['Gross Profit',  fin.grossProfit,  T.green, fin.revenue?fin.grossProfit/fin.revenue*100:0],
            ['Expenses',      -fin.expTotal,    T.red,   fin.revenue?fin.expTotal/fin.revenue*100:0],
            ['Net Profit',    fin.netProfit,    fin.netProfit>=0?T.green:T.red, fin.netMargin],
          ].map(([label,val,color,p],i,arr)=>(
            <div key={label} style={{ marginBottom:12, paddingTop: i===arr.length-1?11:0, borderTop: i===arr.length-1?`2px solid ${T.bdr}`:'none' }}>
              <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                <span style={{ fontSize:12, color:T.sub, fontWeight: i===arr.length-1?800:600 }}>{label}</span>
                <span style={{ fontSize: i===arr.length-1?16:13.5, fontWeight:800, color }}>
                  {val<0?'(':''}{fmt(val)}{val<0?')':''}
                  {p!=null && <span style={{ fontSize:10.5, color:T.muted, marginLeft:6 }}>{p.toFixed(0)}%</span>}
                </span>
              </div>
              <div style={{ height:6, background:'#F3F4F6', borderRadius:3, overflow:'hidden' }}>
                <div style={{ height:'100%', width:`${Math.min(100, Math.abs(val)/(fin.revenue||1)*100)}%`, background:color, borderRadius:3, transition:'width .5s' }}/>
              </div>
            </div>
          ))}
        </div>

        {/* GST position */}
        <div style={{ background:T.white, border:`1px solid ${T.bdr}`, borderRadius:13, padding:'17px 19px', boxShadow:'0 1px 4px rgba(0,0,0,.05)' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
            <div style={{ fontSize:13, fontWeight:800, color:T.darkRed }}>📋 GST Position</div>
            <button onClick={()=>onNavigate?.('gsthub','gstr1')} style={{ background:'none', border:'none', color:T.red, fontSize:11, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>Filing →</button>
          </div>

          <div style={{ background: fin.gstPayable>0?'#FEF2F2':'#F0FDF4', border:`1px solid ${fin.gstPayable>0?'#FECACA':'#BBF7D0'}`, borderRadius:11, padding:'15px 17px', marginBottom:14, textAlign:'center' }}>
            <div style={{ fontSize:9.5, color:T.sub, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:5 }}>
              {fin.gstPayable>0 ? 'GST Payable' : 'Input Credit Available'}
            </div>
            <div style={{ fontSize:27, fontWeight:900, color: fin.gstPayable>0?T.red:T.green, letterSpacing:'-0.02em' }}>
              {fmtL(fin.gstPayable>0 ? fin.gstPayable : fin.gstIn-fin.gstOut)}
            </div>
            <div style={{ fontSize:11, color:T.sub, marginTop:4 }}>
              {fin.gstPayable>0 ? 'to be paid this period' : 'carried forward'}
            </div>
          </div>

          {[
            ['Output GST (on sales)',    fin.gstOut, T.red],
            ['Input GST (on purchases)', fin.gstIn,  T.green],
          ].map(([l,v,col])=>(
            <div key={l} style={{ display:'flex', justifyContent:'space-between', padding:'8px 0', borderBottom:`1px solid ${T.bdr}33`, fontSize:12.5 }}>
              <span style={{ color:T.sub }}>{l}</span>
              <strong style={{ color:col }}>{fmt(v)}</strong>
            </div>
          ))}

          <div style={{ marginTop:14, display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
            {[['Receivables', fin.receivables, T.amber, 'customers owe you'],
              ['Payables',    fin.payables,    T.red,   'you owe suppliers']].map(([l,v,col,s])=>(
              <div key={l} style={{ background:T.bg, borderRadius:9, padding:'11px 13px' }}>
                <div style={{ fontSize:9, color:T.muted, fontWeight:700, textTransform:'uppercase' }}>{l}</div>
                <div style={{ fontSize:16, fontWeight:800, color:col, marginTop:2 }}>{fmtL(v)}</div>
                <div style={{ fontSize:9.5, color:T.muted }}>{s}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Update balances modal ── */}
      {showBal && (
        <div onClick={()=>setShowBal(false)} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.5)', zIndex:300, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
          <div onClick={e=>e.stopPropagation()} style={{ background:T.white, borderRadius:15, padding:25, width:'100%', maxWidth:540, maxHeight:'86vh', display:'flex', flexDirection:'column', boxShadow:'0 20px 60px rgba(0,0,0,.25)' }}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:5 }}>
              <div style={{ fontSize:16, fontWeight:800, color:T.darkRed }}>Update Balances</div>
              <button onClick={()=>setShowBal(false)} style={{ background:'none', border:'none', fontSize:21, cursor:'pointer', color:T.muted }}>×</button>
            </div>
            <div style={{ fontSize:11.5, color:T.sub, marginBottom:16 }}>
              Enter what each account actually holds right now. This is a manual reconciliation — it doesn't auto-sync with your bank.
            </div>

            <div style={{ flex:1, overflowY:'auto', marginBottom:14 }}>
              {editRows.map((r,i)=>(
                <div key={r.id||`new${i}`} style={{ display:'grid', gridTemplateColumns:'90px 1fr 130px auto', gap:8, alignItems:'center', marginBottom:9 }}>
                  <select value={r.kind||'bank'} onChange={e=>setEditRows(rs=>rs.map((x,j)=>j===i?{...x,kind:e.target.value}:x))}
                    style={{ ...inp, padding:'8px 7px', fontSize:11.5, cursor:'pointer' }}>
                    {Object.entries(KIND).map(([k,v])=><option key={k} value={k}>{v.icon} {k.toUpperCase()}</option>)}
                  </select>
                  <input value={r.name||''} onChange={e=>setEditRows(rs=>rs.map((x,j)=>j===i?{...x,name:e.target.value}:x))}
                    placeholder="Account name" style={{ ...inp, fontSize:12.5 }}/>
                  <input type="number" value={r._bal} onChange={e=>setEditRows(rs=>rs.map((x,j)=>j===i?{...x,_bal:e.target.value}:x))}
                    style={{ ...inp, fontSize:13, fontWeight:700, textAlign:'right', color: r.is_overdraft?T.red:T.green }}/>
                  <label title="Overdraft — counts as a liability" style={{ display:'flex', alignItems:'center', gap:4, fontSize:10, color:T.sub, cursor:'pointer', whiteSpace:'nowrap' }}>
                    <input type="checkbox" checked={!!r.is_overdraft} onChange={e=>setEditRows(rs=>rs.map((x,j)=>j===i?{...x,is_overdraft:e.target.checked}:x))}
                      style={{ accentColor:T.red, cursor:'pointer' }}/>OD
                  </label>
                </div>
              ))}
              <button type="button" onClick={()=>setEditRows(rs=>[...rs,{ _new:true, kind:'bank', name:'', _bal:'0' }])}
                style={{ ...btn(T.bg, T.sub, { border:`1px dashed ${T.bdr}`, padding:'9px 15px', fontSize:11.5 }), width:'100%', marginTop:5 }}>
                + Add another account
              </button>
            </div>

            <div style={{ background:T.lightRed, borderRadius:9, padding:'11px 14px', marginBottom:14, display:'flex', justifyContent:'space-between', fontSize:13 }}>
              <span style={{ color:T.sub, fontWeight:600 }}>New total</span>
              <strong style={{ color:T.darkRed, fontSize:16 }}>
                {fmtL(editRows.reduce((s,r)=>s+(r.is_overdraft?-Math.abs(parseFloat(r._bal)||0):(parseFloat(r._bal)||0)),0))}
              </strong>
            </div>

            <div style={{ display:'flex', gap:10 }}>
              <button onClick={()=>setShowBal(false)} style={{ flex:1, background:T.bg, color:T.sub, border:`1px solid ${T.bdr}`, borderRadius:9, padding:'12px', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>Cancel</button>
              <button onClick={saveBalances} disabled={saving} style={{ flex:2, ...btn(T.red,T.white,{ padding:'12px', fontSize:13 }) }}>{saving?'Saving…':'Save & Reconcile'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
