import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';

const T = {
  bg:'#F7F3F3', srf:'#FFFFFF', card:'#FFFFFF', bdr:'#E8DEDE',
  red:'#C0392B', darkRed:'#8B0000', lightRed:'#FEF2F2',
  green:'#16A34A', amber:'#D97706', blue:'#2563EB', purple:'#7C3AED', gold:'#B45309',
  ink:'#111827', sub:'#6B7280', muted:'#9CA3AF', white:'#FFFFFF'
};
const fmt  = n => 'Rs.' + (n||0).toLocaleString('en-IN', { maximumFractionDigits:0 });
const fmtL = n => Math.abs(n)>=100000 ? (n<0?'-':'')+'₹'+(Math.abs(n)/100000).toFixed(1)+'L' : fmt(n);
const btn  = (bg,color,extra={}) => ({ background:bg, color, border:'none', borderRadius:9, padding:'9px 16px', fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:'inherit', ...extra });
const inp  = { background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:8, padding:'9px 12px', color:T.ink, fontSize:13, fontFamily:'inherit', outline:'none' };
const REVENUE_WINDOW_DAYS = 180;

// ── Customer RFM tier (lightweight — matches the fuller RFM Analysis tab) ──
const CTIER = {
  vip:      { l:'VIP',       icon:'🏆', color:T.gold,  bg:'#FFFBEB', bdr:'#FDE68A' },
  regular:  { l:'Regular',   icon:'💚', color:T.green, bg:'#F0FDF4', bdr:'#BBF7D0' },
  new:      { l:'New',       icon:'✨', color:T.blue,  bg:'#EFF6FF', bdr:'#BFDBFE' },
  at_risk:  { l:'At Risk',   icon:'⚠️', color:T.amber, bg:'#FFFBEB', bdr:'#FDE68A' },
  lapsed:   { l:'Lapsed',    icon:'😴', color:T.muted, bg:'#F9FAFB', bdr:'#E5E7EB' },
};
function custTier(c) {
  const days = c.lastPurchase ? Math.floor((Date.now()-new Date(c.lastPurchase))/86400000) : 999;
  if (days > 180) return 'lapsed';
  if ((c.purchase_count||0) <= 1 && days <= 30) return 'new';
  if ((c.total_spent||0) >= 20000 && (c.purchase_count||0) >= 5) return 'vip';
  if (days > 60) return 'at_risk';
  return 'regular';
}

// ── Supplier grade (matches Supplier Scorecard's weighting logic) ──
function supplierGrade(pct) {
  if (pct==null) return null;
  const g = pct>=90?'A+':pct>=80?'A':pct>=70?'B+':pct>=60?'B':pct>=45?'C':'D';
  const color = pct>=80?T.green:pct>=60?T.blue:pct>=45?T.amber:T.red;
  return { g, color };
}

export default function PartiesDashboard({ tenant, role='owner', onSwitchTab, initialView='customers' }) {
  const [customers, setCustomers] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [view,      setView]      = useState(initialView); // customers | suppliers | all
  const [search,    setSearch]    = useState('');
  const [tierFilter,setTierFilter]= useState('all');
  const [sortBy,    setSortBy]    = useState('value');
  const [showForm,  setShowForm]  = useState(false);
  const [editParty, setEditParty] = useState(null);
  const [saving,    setSaving]    = useState(false);
  const [saved,     setSaved]     = useState(false);
  const [form, setForm] = useState({ kind:'customer', name:'', phone:'', email:'', gstin:'', address:'', payment_terms:'30' });

  useEffect(() => { if (tenant?.id) load(); }, [tenant?.id]);
  useEffect(() => { setView(initialView); }, [initialView]);

  async function load() {
    setLoading(true);
    const since = new Date(); since.setDate(since.getDate() - REVENUE_WINDOW_DAYS);
    const sinceStr = since.toISOString().slice(0,10);

    const [custRes, supRes, salesRes, purRes, scoreRes] = await Promise.all([
      supabase.from('customers').select('*').eq('tenant_id', tenant.id).order('name'),
      supabase.from('suppliers').select('*').eq('tenant_id', tenant.id).eq('active', true).order('name'),
      supabase.from('sales').select('customer,customer_id,total,date').eq('tenant_id', tenant.id).gte('date', sinceStr),
      supabase.from('purchases').select('supplier,total,date').eq('tenant_id', tenant.id).gte('date', sinceStr),
      supabase.from('supplier_scores').select('supplier_name,overall_score').eq('tenant_id', tenant.id).order('created_at',{ ascending:false }),
    ]);

    // Recent-window revenue per customer (on top of their lifetime total_spent)
    const custRecent = {};
    (salesRes.data||[]).forEach(s => {
      const k = s.customer_id || s.customer; if (!k) return;
      custRecent[k] = (custRecent[k]||0) + (s.total||0);
    });
    const custs = (custRes.data||[]).map(c => ({
      ...c, kind:'customer', recentRevenue: custRecent[c.id] || custRecent[c.name] || 0,
    })).map(c => ({ ...c, tier: custTier(c) }));

    // Recent-window spend per supplier + latest score
    const supRecent = {};
    (purRes.data||[]).forEach(p => { supRecent[p.supplier] = (supRecent[p.supplier]||0) + (p.total||0); });
    const scoreBySup = {};
    (scoreRes.data||[]).forEach(s => { if (!(s.supplier_name in scoreBySup)) scoreBySup[s.supplier_name] = s.overall_score; });
    const sups = (supRes.data||[]).map(s => ({
      ...s, kind:'supplier', recentSpend: supRecent[s.name] || 0,
      score: scoreBySup[s.name] != null ? scoreBySup[s.name]*20 : null, // stored 0-5 → convert to 0-100
    }));

    setCustomers(custs); setSuppliers(sups);
    setLoading(false);
  }

  function resetForm(kind) { setForm({ kind, name:'', phone:'', email:'', gstin:'', address:'', payment_terms:'30' }); setEditParty(null); }
  function openNew(kind) { resetForm(kind); setShowForm(true); }
  function openEdit(p) {
    setEditParty(p);
    setForm({ kind:p.kind, name:p.name, phone:p.phone||'', email:p.email||'', gstin:p.gstin||'', address:p.address||'', payment_terms:String(p.payment_terms||30) });
    setShowForm(true);
  }

  async function saveParty(e) {
    e.preventDefault(); setSaving(true);
    const table = form.kind==='customer' ? 'customers' : 'suppliers';
    const payload = form.kind==='customer'
      ? { tenant_id:tenant.id, name:form.name, phone:form.phone||null, email:form.email||null, gstin:form.gstin||null, address:form.address||null }
      : { tenant_id:tenant.id, name:form.name, phone:form.phone||null, email:form.email||null, gstin:form.gstin||null, address:form.address||null, payment_terms:parseInt(form.payment_terms)||30, active:true };
    if (editParty) await supabase.from(table).update(payload).eq('id', editParty.id);
    else           await supabase.from(table).insert(payload);
    setShowForm(false); resetForm(form.kind);
    setSaved(true); setTimeout(()=>setSaved(false), 2500);
    await load(); setSaving(false);
  }

  // ── Merged, memoized rows ──────────────────────────────────
  const merged = useMemo(() => [...customers, ...suppliers], [customers, suppliers]);
  const base = view==='customers' ? customers : view==='suppliers' ? suppliers : merged;

  const [debouncedSearch, setDebouncedSearch] = useState('');
  useEffect(() => { const t=setTimeout(()=>setDebouncedSearch(search), 200); return ()=>clearTimeout(t); }, [search]);

  const displayed = useMemo(() => base
    .filter(p => tierFilter==='all' || p.tier===tierFilter)
    .filter(p => !debouncedSearch
      || p.name.toLowerCase().includes(debouncedSearch.toLowerCase())
      || (p.phone||'').includes(debouncedSearch)
      || (p.gstin||'').toLowerCase().includes(debouncedSearch.toLowerCase()))
    .sort((a,b) => {
      const va = a.kind==='customer' ? (a.total_spent||0) : (a.recentSpend||0);
      const vb = b.kind==='customer' ? (b.total_spent||0) : (b.recentSpend||0);
      if (sortBy==='value')  return vb-va;
      if (sortBy==='name')   return a.name.localeCompare(b.name);
      if (sortBy==='recent') return (b.kind==='customer'?b.recentRevenue:b.recentSpend) - (a.kind==='customer'?a.recentRevenue:a.recentSpend);
      return 0;
    }), [base, tierFilter, debouncedSearch, sortBy]);

  const PAGE_SIZE = 150;
  const [showAll, setShowAll] = useState(false);
  const visibleRows = showAll ? displayed : displayed.slice(0, PAGE_SIZE);

  const kpis = useMemo(() => {
    const totalCustSpend = customers.reduce((s,c)=>s+(c.total_spent||0),0);
    const totalOutstanding = customers.reduce((s,c)=>s+(c.outstanding||0),0);
    const totalSupSpend  = suppliers.reduce((s,su)=>s+(su.recentSpend||0),0);
    const vipCount   = customers.filter(c=>c.tier==='vip').length;
    const atRiskCount= customers.filter(c=>c.tier==='at_risk'||c.tier==='lapsed').length;
    const avgSupScore= (() => { const scored=suppliers.filter(s=>s.score!=null); return scored.length ? scored.reduce((s,x)=>s+x.score,0)/scored.length : null; })();
    return { totalCustSpend, totalOutstanding, totalSupSpend, vipCount, atRiskCount, avgSupScore };
  }, [customers, suppliers]);

  const tierCounts = useMemo(() => Object.keys(CTIER).reduce((a,k)=>({ ...a, [k]:customers.filter(c=>c.tier===k).length }), {}), [customers]);

  const KPI = ({ label, value, sub, icon, color }) => (
    <div style={{ background:T.white, border:`1px solid ${T.bdr}`, borderRadius:12, padding:'14px 16px', boxShadow:'0 1px 4px rgba(0,0,0,.05)' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:6 }}>
        <div style={{ fontSize:9, color:T.sub, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.05em' }}>{label}</div>
        <span style={{ fontSize:15 }}>{icon}</span>
      </div>
      <div style={{ fontSize:19, fontWeight:900, color:color||T.ink, letterSpacing:'-0.02em' }}>{value}</div>
      {sub && <div style={{ fontSize:10, color:T.muted, marginTop:2 }}>{sub}</div>}
    </div>
  );

  return (
    <div style={{ padding:22, background:T.bg, minHeight:'100%' }}>

      {/* Header */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:18, flexWrap:'wrap', gap:12 }}>
        <div>
          <div style={{ fontSize:20, fontWeight:900, color:T.darkRed, letterSpacing:'-0.02em' }}>Parties</div>
          <div style={{ fontSize:12, color:T.sub, marginTop:3 }}>
            {customers.length} customers · {suppliers.length} suppliers
            <span style={{ color:T.muted }}> · spend figures based on last {REVENUE_WINDOW_DAYS} days</span>
            {saved && <span style={{ color:T.green, fontWeight:700, marginLeft:8 }}>✓ Saved</span>}
          </div>
        </div>
        <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
          <button onClick={()=>onSwitchTab?.('reminders')} style={btn(T.bg, T.sub, { border:`1px solid ${T.bdr}` })}>💰 Reminders</button>
          <button onClick={()=>onSwitchTab?.('scorecard')} style={btn(T.bg, T.sub, { border:`1px solid ${T.bdr}` })}>🏅 Scorecard</button>
          <button onClick={()=>openNew('customer')} style={btn(T.red, T.white)}>+ Customer</button>
          <button onClick={()=>openNew('supplier')} style={btn(T.purple, T.white)}>+ Supplier</button>
        </div>
      </div>

      {/* KPI strip */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(150px,1fr))', gap:11, marginBottom:16 }}>
        <KPI label="Customer Lifetime Value" value={fmtL(kpis.totalCustSpend)} sub={`${customers.length} customers`} icon="💚" color={T.green}/>
        <KPI label="Outstanding Dues"        value={fmtL(kpis.totalOutstanding)} sub="to be collected" icon="📒" color={kpis.totalOutstanding>0?T.red:T.green}/>
        <KPI label="Supplier Spend"          value={fmtL(kpis.totalSupSpend)} sub={`last ${REVENUE_WINDOW_DAYS}d`} icon="🛒" color={T.blue}/>
        <KPI label="VIP Customers"           value={kpis.vipCount} sub="top tier" icon="🏆" color={T.gold}/>
        <KPI label="Need Attention"          value={kpis.atRiskCount} sub="at risk / lapsed" icon="⚠️" color={T.amber}/>
        <KPI label="Avg Supplier Score"      value={kpis.avgSupScore!=null?`${kpis.avgSupScore.toFixed(0)}%`:'—'} sub="performance" icon="📊" color={T.purple}/>
      </div>

      {/* Toggle + filters */}
      <div style={{ display:'flex', gap:9, marginBottom:12, flexWrap:'wrap', alignItems:'center' }}>
        <div style={{ display:'flex', background:T.white, border:`1px solid ${T.bdr}`, borderRadius:9, padding:3, gap:2 }}>
          {[['customers',`👥 Customers ${customers.length}`],['suppliers',`🏭 Suppliers ${suppliers.length}`],['all',`All ${merged.length}`]].map(([v,l])=>(
            <button key={v} onClick={()=>{ setView(v); setTierFilter('all'); }}
              style={{ padding:'8px 14px', background:view===v?T.red:'transparent', color:view===v?T.white:T.sub, border:'none', borderRadius:7, fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>{l}</button>
          ))}
        </div>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="🔍 Search name, phone, GSTIN…" style={{ ...inp, flex:1, minWidth:200 }}/>
        {view==='customers'&&(
          <select value={tierFilter} onChange={e=>setTierFilter(e.target.value)} style={{ ...inp, cursor:'pointer' }}>
            <option value="all">All Tiers</option>
            {Object.entries(CTIER).map(([k,v])=><option key={k} value={k}>{v.icon} {v.l}</option>)}
          </select>
        )}
        <select value={sortBy} onChange={e=>setSortBy(e.target.value)} style={{ ...inp, cursor:'pointer' }}>
          <option value="value">↓ Lifetime Value</option>
          <option value="recent">↓ Recent Activity</option>
          <option value="name">A–Z Name</option>
        </select>
        <div style={{ fontSize:11, color:T.muted, whiteSpace:'nowrap' }}>{displayed.length} {view==='all'?'parties':view}</div>
      </div>

      {/* Table */}
      <div style={{ background:T.white, border:`1px solid ${T.bdr}`, borderRadius:13, overflow:'hidden', boxShadow:'0 1px 4px rgba(0,0,0,.05)' }}>
        <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12.5 }}>
          <thead><tr style={{ background:T.lightRed }}>
            {['Name','Type','Phone','GSTIN','Value','Status / Tier','Actions'].map(h=>(
              <th key={h} style={{ padding:'10px 12px', textAlign:h==='Value'?'right':'left', fontSize:9, color:T.darkRed, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.04em', borderBottom:`1px solid ${T.bdr}`, whiteSpace:'nowrap' }}>{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {loading ? Array.from({length:6}).map((_,i)=>(
              <tr key={'sk'+i}>{Array.from({length:7}).map((_,j)=>(
                <td key={j} style={{ padding:12 }}><div style={{ height:14, background:'linear-gradient(90deg,#F0E8E8 25%,#F8F0F0 50%,#F0E8E8 75%)', backgroundSize:'200% 100%', animation:'skelShine 1.4s ease-in-out infinite', borderRadius:5, width:j===0?'70%':'50%' }}/></td>
              ))}</tr>
            ))
            : visibleRows.length===0 ? (
              <tr><td colSpan={7} style={{ textAlign:'center', padding:50 }}>
                <div style={{ fontSize:34, marginBottom:8 }}>👥</div>
                <div style={{ color:T.muted, fontWeight:600 }}>No {view==='all'?'parties':view} match these filters</div>
              </td></tr>
            )
            : visibleRows.map(p => {
                const isCust = p.kind==='customer';
                const tier   = isCust ? CTIER[p.tier] : null;
                const grade  = !isCust ? supplierGrade(p.score) : null;
                const value  = isCust ? (p.total_spent||0) : (p.recentSpend||0);
                return (
                  <tr key={p.kind+p.id} style={{ borderBottom:`1px solid ${T.bdr}22` }}>
                    <td style={{ padding:'10px 12px', fontWeight:700, color:T.ink }}>{p.name}</td>
                    <td style={{ padding:'10px 12px' }}>
                      <span style={{ background:isCust?'#F0FDF4':'#F5F3FF', color:isCust?T.green:T.purple, borderRadius:5, padding:'2px 8px', fontSize:9, fontWeight:700 }}>
                        {isCust?'👥 Customer':'🏭 Supplier'}
                      </span>
                    </td>
                    <td style={{ padding:'10px 12px', color:T.sub }}>{p.phone||'—'}</td>
                    <td style={{ padding:'10px 12px', color:T.muted, fontFamily:'monospace', fontSize:11 }}>{p.gstin||'—'}</td>
                    <td style={{ padding:'10px 12px', textAlign:'right', fontWeight:800, color:isCust?T.green:T.blue }}>
                      {fmt(value)}
                      {isCust&&(p.outstanding||0)>0 && <div style={{ fontSize:9, color:T.red, fontWeight:600 }}>Owes {fmt(p.outstanding)}</div>}
                    </td>
                    <td style={{ padding:'10px 12px' }}>
                      {isCust
                        ? <span style={{ background:tier.bg, color:tier.color, border:`1px solid ${tier.bdr}`, borderRadius:5, padding:'2px 8px', fontSize:9, fontWeight:700 }}>{tier.icon} {tier.l}</span>
                        : grade
                          ? <span style={{ background:'#F9FAFB', color:grade.color, border:`1px solid ${T.bdr}`, borderRadius:5, padding:'2px 8px', fontSize:9, fontWeight:800 }}>Grade {grade.g}</span>
                          : <span style={{ fontSize:10, color:T.muted }}>Not rated</span>}
                    </td>
                    <td style={{ padding:'10px 12px' }}>
                      <div style={{ display:'flex', gap:5 }}>
                        <button onClick={()=>openEdit(p)} style={{ background:T.lightRed, color:T.red, border:'none', borderRadius:6, padding:'4px 10px', fontSize:10, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>Edit</button>
                        {p.phone&&<a href={`https://wa.me/${p.phone.replace(/\D/g,'').replace(/^0/,'91')}`} target="_blank" rel="noopener noreferrer" style={{ background:'#DCFCE7', color:T.green, borderRadius:6, padding:'4px 10px', fontSize:10, fontWeight:700, textDecoration:'none', display:'inline-block' }}>💬</a>}
                      </div>
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>

      {displayed.length > PAGE_SIZE && (
        <div style={{ textAlign:'center', margin:'12px 0' }}>
          <button onClick={()=>setShowAll(s=>!s)} style={btn(T.white, T.red, { border:`1px solid ${T.bdr}`, padding:'9px 20px' })}>
            {showAll ? 'Show fewer' : `Show all ${displayed.length} (${displayed.length-PAGE_SIZE} more)`}
          </button>
        </div>
      )}

      {/* Tier legend — customers only */}
      {view!=='suppliers' && (
        <div style={{ display:'flex', gap:16, marginTop:14, padding:'11px 16px', background:T.white, border:`1px solid ${T.bdr}`, borderRadius:10, flexWrap:'wrap' }}>
          {Object.entries(CTIER).map(([k,t])=>(
            <div key={k} style={{ display:'flex', alignItems:'center', gap:5, fontSize:11 }}>
              <span style={{ width:7, height:7, borderRadius:'50%', background:t.color }}/>
              <span style={{ color:T.sub }}>{t.icon} {t.l}</span>
              <span style={{ color:T.ink, fontWeight:700 }}>{tierCounts[k]||0}</span>
            </div>
          ))}
        </div>
      )}

      {/* Add / edit modal */}
      {showForm&&(
        <div onClick={()=>setShowForm(false)} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.5)', zIndex:300, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
          <div onClick={e=>e.stopPropagation()} style={{ background:T.white, borderRadius:16, padding:26, width:'100%', maxWidth:480, boxShadow:'0 20px 60px rgba(0,0,0,.25)' }}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:18 }}>
              <div style={{ fontSize:16, fontWeight:800, color:T.darkRed }}>{editParty?'Edit':'New'} {form.kind==='customer'?'Customer':'Supplier'}</div>
              <button onClick={()=>setShowForm(false)} style={{ background:'none', border:'none', fontSize:22, cursor:'pointer', color:T.muted }}>×</button>
            </div>
            <form onSubmit={saveParty}>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                <div style={{ gridColumn:'1/-1' }}><label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:4 }}>Name *</label><input value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} required style={inp}/></div>
                {[['Phone','tel','phone'],['Email','email','email'],['GSTIN','text','gstin']].map(([lb,type,key])=>(
                  <div key={key}><label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:4 }}>{lb}</label><input type={type} value={form[key]} onChange={e=>setForm(f=>({...f,[key]:e.target.value}))} style={inp}/></div>
                ))}
                {form.kind==='supplier'&&<div><label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:4 }}>Payment Terms (days)</label><input type="number" value={form.payment_terms} onChange={e=>setForm(f=>({...f,payment_terms:e.target.value}))} style={inp}/></div>}
                <div style={{ gridColumn:'1/-1' }}><label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:4 }}>Address</label><input value={form.address} onChange={e=>setForm(f=>({...f,address:e.target.value}))} style={inp}/></div>
              </div>
              <div style={{ display:'flex', gap:10, marginTop:20 }}>
                <button type="button" onClick={()=>setShowForm(false)} style={{ flex:1, background:T.bg, color:T.sub, border:`1px solid ${T.bdr}`, borderRadius:9, padding:'12px', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>Cancel</button>
                <button type="submit" disabled={saving} style={{ flex:2, ...btn(T.red,T.white,{ padding:'12px', fontSize:13 }) }}>{saving?'Saving…':editParty?'Update':'Add'} {form.kind==='customer'?'Customer':'Supplier'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
