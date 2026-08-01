import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

const T = { bg:'#060710', srf:'#0f1220', card:'#141828', bdr:'#1e2540', blue:'#4f7cff', ink:'#eef0f8', sub:'#6b7598', muted:'#4a5175', green:'#00d68f', amber:'#ffb547', red:'#ff4d6a', purple:'#9b72ff', teal:'#00c9b1' };
const fmt = n => 'Rs.' + Math.abs(n||0).toLocaleString('en-IN', { maximumFractionDigits:0 });

const TXN_TYPES = {
  capital_add:      { label:'Capital Added',    color:'#00d68f', sign:+1 },
  capital_withdraw: { label:'Capital Withdrawn',color:'#ff4d6a', sign:-1 },
  drawing:          { label:'Drawing',          color:'#ffb547', sign:-1 },
  profit_share:     { label:'Profit Share',     color:'#00c9b1', sign:+1 },
  interest:         { label:'Interest on Capital',color:'#9b72ff',sign:+1 },
};

export default function PartnershipAccounts({ tenant }) {
  const [partners, setPartners] = useState([]);
  const [txns,     setTxns]     = useState([]);
  const [sales,    setSales]    = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [selPtnr,  setSelPtnr]  = useState(null);
  const [showAdd,  setShowAdd]  = useState(false);
  const [showTxn,  setShowTxn]  = useState(false);
  const [saving,   setSaving]   = useState(false);
  const [period,   setPeriod]   = useState(new Date().toISOString().slice(0,7));
  const [pForm,    setPForm]    = useState({ name:'', phone:'', email:'', capital:'', profit_share:'', notes:'' });
  const [tForm,    setTForm]    = useState({ type:'drawing', amount:'', description:'', txn_date:new Date().toISOString().slice(0,10) });

  useEffect(() => { if (tenant?.id) load(); }, [tenant?.id, period]);

  async function load() {
    setLoading(true);
    const monthStart = period+'-01';
    const monthEnd   = new Date(parseInt(period.split('-')[0]), parseInt(period.split('-')[1]), 0).toISOString().slice(0,10);
    const [pRes, tRes, sRes, eRes] = await Promise.all([
      supabase.from('partners').select('*').eq('tenant_id', tenant.id).eq('active', true).order('name'),
      supabase.from('partner_txns').select('*').eq('tenant_id', tenant.id).order('txn_date', { ascending:false }),
      supabase.from('sales').select('total').eq('tenant_id', tenant.id).gte('date', monthStart).lte('date', monthEnd),
      supabase.from('expenses').select('amount').eq('tenant_id', tenant.id).gte('date', monthStart).lte('date', monthEnd),
    ]);
    setPartners(pRes.data||[]);
    setTxns(tRes.data||[]);
    setSales(sRes.data||[]);
    setExpenses(eRes.data||[]);
    setLoading(false);
  }

  async function addPartner(e) {
    e.preventDefault(); setSaving(true);
    await supabase.from('partners').insert({ ...pForm, tenant_id:tenant.id, capital:parseFloat(pForm.capital)||0, profit_share:parseFloat(pForm.profit_share)||0 });
    setShowAdd(false); setPForm({ name:'', phone:'', email:'', capital:'', profit_share:'', notes:'' });
    setSaving(false); await load();
  }

  async function addTxn(e) {
    e.preventDefault(); setSaving(true);
    await supabase.from('partner_txns').insert({ ...tForm, tenant_id:tenant.id, partner_id:selPtnr.id, amount:parseFloat(tForm.amount)||0 });
    setShowTxn(false); setTForm({ type:'drawing', amount:'', description:'', txn_date:new Date().toISOString().slice(0,10) });
    setSaving(false); await load();
  }

  async function distributeProfit() {
    const revenue  = sales.reduce((s,x)=>s+(x.total||0),0);
    const expTotal = expenses.reduce((s,e)=>s+(e.amount||0),0);
    const netProfit= revenue - expTotal;
    if (netProfit <= 0) return alert('No profit to distribute this period');
    if (!confirm(`Distribute net profit of ${fmt(netProfit)} for ${period}?`)) return;
    for (const p of partners) {
      const share = netProfit * p.profit_share / 100;
      await supabase.from('partner_txns').insert({ tenant_id:tenant.id, partner_id:p.id, type:'profit_share', amount:share, description:`Profit share for ${period}`, txn_date:monthEnd() });
    }
    await load();
  }

  function monthEnd() { const [y,m]=period.split('-'); return new Date(parseInt(y),parseInt(m),0).toISOString().slice(0,10); }

  function getBalance(partnerId) {
    return txns.filter(t=>t.partner_id===partnerId).reduce((s,t)=>{
      const type = TXN_TYPES[t.type];
      return s + (t.amount||0) * (type?.sign||1);
    }, partners.find(p=>p.id===partnerId)?.capital||0);
  }

  const revenue   = sales.reduce((s,x)=>s+(x.total||0),0);
  const expTotal  = expenses.reduce((s,e)=>s+(e.amount||0),0);
  const netProfit = revenue - expTotal;
  const totalCap  = partners.reduce((s,p)=>s+(p.capital||0),0);
  const inp = { background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:8, padding:'9px 12px', color:T.ink, fontSize:13, fontFamily:'inherit', outline:'none', width:'100%' };

  return (
    <div style={{ padding:20 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
        <div>
          <div style={{ fontSize:22, fontWeight:800, color:T.ink }}>🤝 Partnership Accounts</div>
          <div style={{ fontSize:13, color:T.sub }}>{partners.length} partners · {fmt(totalCap)} total capital</div>
        </div>
        <div style={{ display:'flex', gap:8, alignItems:'center' }}>
          <input type="month" value={period} onChange={e=>setPeriod(e.target.value)} style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:8, padding:'8px 12px', color:T.ink, fontSize:13, fontFamily:'inherit', outline:'none' }}/>
          <button onClick={distributeProfit} disabled={partners.length===0} style={{ background:T.green+'22', color:T.green, border:`1px solid ${T.green}44`, borderRadius:8, padding:'9px 14px', fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>📊 Distribute Profit</button>
          <button onClick={()=>setShowAdd(true)} style={{ background:T.blue, color:'#fff', border:'none', borderRadius:9, padding:'9px 16px', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>+ Add Partner</button>
        </div>
      </div>

      {/* P&L Summary */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12, marginBottom:20 }}>
        {[['Revenue',fmt(revenue),T.blue],['Expenses',fmt(expTotal),T.red],['Net Profit',fmt(netProfit),netProfit>=0?T.green:T.red],['Total Capital',fmt(totalCap),T.purple]].map(([label,val,color])=>(
          <div key={label} style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:10, padding:'12px 16px' }}>
            <div style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', marginBottom:5 }}>{label} · {period}</div>
            <div style={{ fontSize:18, fontWeight:800, color }}>{val}</div>
          </div>
        ))}
      </div>

      <div style={{ display:'grid', gridTemplateColumns:selPtnr?'1fr 1fr':'1fr', gap:16 }}>
        {/* Partners */}
        <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
          {partners.length===0&&!loading&&<div style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:12, padding:40, textAlign:'center', color:T.muted }}><div style={{ fontSize:32, marginBottom:10 }}>🤝</div>Add partners to start tracking capital accounts</div>}
          {partners.map(p=>{
            const balance    = getBalance(p.id);
            const pTxns      = txns.filter(t=>t.partner_id===p.id);
            const drawings   = pTxns.filter(t=>t.type==='drawing').reduce((s,t)=>s+(t.amount||0),0);
            const profitGot  = pTxns.filter(t=>t.type==='profit_share').reduce((s,t)=>s+(t.amount||0),0);
            const myShare    = netProfit * p.profit_share / 100;
            return (
              <div key={p.id} onClick={()=>setSelPtnr(selPtnr?.id===p.id?null:p)} style={{ background:T.srf, border:`1px solid ${selPtnr?.id===p.id?T.blue:T.bdr}`, borderRadius:12, padding:18, cursor:'pointer' }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:14 }}>
                  <div>
                    <div style={{ fontSize:16, fontWeight:800, color:T.ink }}>{p.name}</div>
                    <div style={{ fontSize:12, color:T.sub }}>{p.profit_share}% profit share · {p.phone||''}</div>
                  </div>
                  <div style={{ textAlign:'right' }}>
                    <div style={{ fontSize:20, fontWeight:900, color:T.blue }}>{fmt(balance)}</div>
                    <div style={{ fontSize:10, color:T.muted }}>Current Balance</div>
                  </div>
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:8 }}>
                  {[['Capital',fmt(p.capital),T.blue],['Drawings',fmt(drawings),T.amber],['Profit Rcvd',fmt(profitGot),T.green],['My Share '+period,fmt(myShare),T.teal]].map(([label,val,color])=>(
                    <div key={label} style={{ background:T.card, borderRadius:7, padding:'8px 10px', textAlign:'center' }}>
                      <div style={{ fontSize:9, color:T.muted, textTransform:'uppercase', marginBottom:3 }}>{label}</div>
                      <div style={{ fontSize:13, fontWeight:700, color }}>{val}</div>
                    </div>
                  ))}
                </div>
                <button onClick={e=>{e.stopPropagation();setSelPtnr(p);setShowTxn(true);}} style={{ marginTop:10, background:T.blue+'22', color:T.blue, border:'none', borderRadius:7, padding:'5px 12px', fontSize:11, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>+ Add Transaction</button>
              </div>
            );
          })}
        </div>

        {/* Ledger */}
        {selPtnr&&<div style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:12, overflow:'hidden' }}>
          <div style={{ padding:'12px 16px', borderBottom:`1px solid ${T.bdr}`, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <div style={{ fontWeight:700, color:T.ink }}>{selPtnr.name} — Ledger</div>
            <button onClick={()=>setShowTxn(true)} style={{ background:T.blue, color:'#fff', border:'none', borderRadius:7, padding:'5px 12px', fontSize:11, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>+ Txn</button>
          </div>
          <div style={{ maxHeight:420, overflowY:'auto' }}>
            {txns.filter(t=>t.partner_id===selPtnr.id).map(t=>{
              const type = TXN_TYPES[t.type]||{};
              return (
                <div key={t.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'10px 14px', borderBottom:`1px solid ${T.bdr}22` }}>
                  <div>
                    <div style={{ fontSize:13, fontWeight:600, color:T.ink }}>{type.label||t.type}</div>
                    <div style={{ fontSize:11, color:T.muted }}>{t.txn_date} · {t.description||'—'}</div>
                  </div>
                  <div style={{ fontSize:15, fontWeight:800, color:type.color||T.ink }}>{type.sign===-1?'-':'+'}{fmt(t.amount)}</div>
                </div>
              );
            })}
            {txns.filter(t=>t.partner_id===selPtnr.id).length===0&&<div style={{ padding:30, textAlign:'center', color:T.muted, fontSize:12 }}>No transactions yet</div>}
          </div>
        </div>}
      </div>

      {/* Add Partner Modal */}
      {showAdd&&<div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.8)', zIndex:200, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
        <div style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:14, padding:24, width:'100%', maxWidth:440 }}>
          <div style={{ display:'flex', justifyContent:'space-between', marginBottom:18 }}>
            <div style={{ fontSize:17, fontWeight:700, color:T.ink }}>Add Partner</div>
            <button onClick={()=>setShowAdd(false)} style={{ background:'none', border:'none', color:T.muted, cursor:'pointer', fontSize:22 }}>×</button>
          </div>
          <form onSubmit={addPartner}>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
              {[['Name *','text','name'],['Phone','tel','phone'],['Email','email','email'],['Capital (Rs.) *','number','capital'],['Profit Share (%) *','number','profit_share'],['Notes','text','notes']].map(([label,type,key])=>(
                <div key={key}><label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:4 }}>{label}</label><input type={type} value={pForm[key]} onChange={e=>setPForm(f=>({...f,[key]:e.target.value}))} required={label.includes('*')} style={inp}/></div>
              ))}
            </div>
            <div style={{ display:'flex', gap:10, marginTop:16 }}>
              <button type="button" onClick={()=>setShowAdd(false)} style={{ flex:1, background:T.card, color:T.sub, border:`1px solid ${T.bdr}`, borderRadius:8, padding:'11px', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>Cancel</button>
              <button type="submit" disabled={saving} style={{ flex:2, background:T.blue, color:'#fff', border:'none', borderRadius:8, padding:'11px', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>{saving?'Adding…':'Add Partner'}</button>
            </div>
          </form>
        </div>
      </div>}

      {/* Add Transaction Modal */}
      {showTxn&&selPtnr&&<div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.8)', zIndex:200, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
        <div style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:14, padding:24, width:'100%', maxWidth:380 }}>
          <div style={{ display:'flex', justifyContent:'space-between', marginBottom:18 }}>
            <div style={{ fontSize:17, fontWeight:700, color:T.ink }}>Add Transaction — {selPtnr.name}</div>
            <button onClick={()=>setShowTxn(false)} style={{ background:'none', border:'none', color:T.muted, cursor:'pointer', fontSize:22 }}>×</button>
          </div>
          <form onSubmit={addTxn}>
            <div style={{ marginBottom:12 }}><label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:5 }}>Type</label>
              <select value={tForm.type} onChange={e=>setTForm(f=>({...f,type:e.target.value}))} style={{ ...inp, cursor:'pointer' }}>
                {Object.entries(TXN_TYPES).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
            {[['Amount (Rs.) *','number','amount'],['Description','text','description'],['Date','date','txn_date']].map(([label,type,key])=>(
              <div key={key} style={{ marginBottom:12 }}><label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:4 }}>{label}</label><input type={type} value={tForm[key]} onChange={e=>setTForm(f=>({...f,[key]:e.target.value}))} required={label.includes('*')} style={inp}/></div>
            ))}
            <div style={{ display:'flex', gap:10 }}>
              <button type="button" onClick={()=>setShowTxn(false)} style={{ flex:1, background:T.card, color:T.sub, border:`1px solid ${T.bdr}`, borderRadius:8, padding:'11px', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>Cancel</button>
              <button type="submit" disabled={saving} style={{ flex:2, background:T.blue, color:'#fff', border:'none', borderRadius:8, padding:'11px', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>{saving?'Saving…':'Add Transaction'}</button>
            </div>
          </form>
        </div>
      </div>}
    </div>
  );
}
