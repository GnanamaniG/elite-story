import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';

const T = {
  bg:'#F7F3F3', srf:'#FFFFFF', card:'#FFFFFF', bdr:'#E8DEDE',
  red:'#C0392B', darkRed:'#8B0000', lightRed:'#FEF2F2',
  green:'#16A34A', amber:'#D97706', blue:'#2563EB', purple:'#7C3AED', teal:'#0D9488',
  ink:'#111827', sub:'#6B7280', muted:'#9CA3AF', white:'#FFFFFF'
};
const fmt  = n => 'Rs.' + Math.abs(n||0).toLocaleString('en-IN', { maximumFractionDigits:0 });
const fmtL = n => { const a=Math.abs(n||0); return a>=100000 ? '₹'+(a/100000).toFixed(1)+'L' : a>=1000 ? '₹'+(a/1000).toFixed(1)+'K' : fmt(a); };
const btn  = (bg,color,extra={}) => ({ background:bg, color, border:'none', borderRadius:9, padding:'9px 16px', fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:'inherit', ...extra });

// Channels the app can genuinely act on today, vs ones that need an API integration
const CHANNELS = {
  whatsapp: { l:'WhatsApp', icon:'💬', color:'#16A34A', live:true,  how:'Opens wa.me links — you send manually' },
  sms:      { l:'SMS',      icon:'📱', color:'#2563EB', live:true,  how:'Via your SMS gateway' },
  promo:    { l:'Promo Codes', icon:'🏷️', color:'#7C3AED', live:true, how:'Redemptions tracked at checkout' },
  referral: { l:'Referrals',   icon:'🔗', color:'#0D9488', live:true, how:'Tracked when referred customer buys' },
  instagram:{ l:'Instagram',icon:'📷', color:'#EA580C', live:true,  how:'Auto-posts via Campaign Bot once Meta app is approved' },
  email:    { l:'Email',    icon:'✉️', color:'#D97706', live:false, how:'Needs an email service provider' },
};

export default function MarketingDashboard({ tenant, role='owner', onSwitchTab }) {
  const [campaigns, setCampaigns] = useState([]);
  const [promos,    setPromos]    = useState([]);
  const [sales,     setSales]     = useState([]);
  const [referrals, setReferrals] = useState([]);
  const [leads,     setLeads]     = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [period,    setPeriod]    = useState('90');
  const [editCamp,  setEditCamp]  = useState(null);
  const [saving,    setSaving]    = useState(false);
  const [saved,     setSaved]     = useState(false);

  useEffect(() => { if (tenant?.id) load(); }, [tenant?.id, period]);

  async function load() {
    setLoading(true);
    const since = new Date(); since.setDate(since.getDate()-parseInt(period));
    const from = since.toISOString().slice(0,10);

    const [cRes, pRes, sRes, rRes, lRes] = await Promise.all([
      supabase.from('campaigns').select('*').eq('tenant_id', tenant.id).order('created_at',{ ascending:false }),
      supabase.from('promo_codes').select('*').eq('tenant_id', tenant.id),
      supabase.from('sales').select('total,promo_code,promo_discount,date,customer_id').eq('tenant_id', tenant.id).gte('date', from),
      supabase.from('referrals').select('*').eq('tenant_id', tenant.id),
      supabase.from('leads').select('id,stage,est_value,source').eq('tenant_id', tenant.id),
    ]);
    setCampaigns(cRes.data||[]); setPromos(pRes.data||[]); setSales(sRes.data||[]);
    setReferrals(rRes.data||[]); setLeads(lRes.data||[]);
    setLoading(false);
  }

  // ── Attribution: revenue we can actually trace back to marketing ──
  const attrib = useMemo(() => {
    const byPromo = {};
    sales.filter(s=>s.promo_code).forEach(s => {
      const k = s.promo_code;
      if (!byPromo[k]) byPromo[k] = { revenue:0, orders:0, discount:0 };
      byPromo[k].revenue  += s.total||0;
      byPromo[k].orders   += 1;
      byPromo[k].discount += s.promo_discount||0;
    });
    const totalAttrib = Object.values(byPromo).reduce((s,x)=>s+x.revenue,0);
    const totalOrders = Object.values(byPromo).reduce((s,x)=>s+x.orders,0);
    const totalDisc   = Object.values(byPromo).reduce((s,x)=>s+x.discount,0);
    const totalRev    = sales.reduce((s,x)=>s+(x.total||0),0);
    return { byPromo, totalAttrib, totalOrders, totalDisc, totalRev,
             share: totalRev>0 ? totalAttrib/totalRev*100 : 0 };
  }, [sales]);

  const campRows = useMemo(() => campaigns.map(c => {
    const a = c.promo_code ? attrib.byPromo[c.promo_code] : null;
    const revenue = a?.revenue || 0;
    const spend   = c.spend || 0;
    const roi     = spend>0 ? (revenue-spend)/spend*100 : null;
    const cpl     = (c.sent_count>0 && spend>0) ? spend/c.sent_count : null;
    return { ...c, revenue, spend, roi, cpl, orders:a?.orders||0 };
  }).sort((a,b)=>(b.revenue||0)-(a.revenue||0)), [campaigns, attrib]);

  const kpis = useMemo(() => {
    const spend    = campaigns.reduce((s,c)=>s+(c.spend||0),0);
    const active   = campaigns.filter(c=>c.status==='active'||c.status==='scheduled').length;
    const reached  = campaigns.reduce((s,c)=>s+(c.sent_count||c.total_contacts||0),0);
    const roi      = spend>0 ? (attrib.totalAttrib-spend)/spend*100 : null;
    const activeLeads = leads.filter(l=>!['won','lost'].includes(l.stage)).length;
    const pipeline = leads.filter(l=>!['won','lost'].includes(l.stage)).reduce((s,l)=>s+(l.est_value||0),0);
    const refConverted = referrals.filter(r=>r.status==='converted'||r.status==='rewarded').length;
    return { spend, active, reached, roi, activeLeads, pipeline, refConverted,
             cpl: reached>0 && spend>0 ? spend/reached : null };
  }, [campaigns, attrib, leads, referrals]);

  const channelStats = useMemo(() => {
    const out = {};
    Object.keys(CHANNELS).forEach(k => { out[k] = { campaigns:0, reached:0, revenue:0 }; });
    campaigns.forEach(c => {
      const k = (c.type||'whatsapp').toLowerCase();
      if (!out[k]) return;
      out[k].campaigns += 1;
      out[k].reached   += c.sent_count || c.total_contacts || 0;
      if (c.promo_code && attrib.byPromo[c.promo_code]) out[k].revenue += attrib.byPromo[c.promo_code].revenue;
    });
    out.promo.campaigns = promos.length;
    out.promo.revenue   = attrib.totalAttrib;
    out.referral.campaigns = referrals.length;
    return out;
  }, [campaigns, promos, referrals, attrib]);

  async function saveSpend(e) {
    e.preventDefault(); setSaving(true);
    await supabase.from('campaigns').update({
      spend: parseFloat(editCamp._spend)||0,
      sent_count: parseInt(editCamp._sent)||0,
      promo_code: editCamp._promo||null,
    }).eq('id', editCamp.id);
    setEditCamp(null); setSaved(true); setTimeout(()=>setSaved(false),2500);
    await load(); setSaving(false);
  }

  const KPI = ({ label, value, sub, icon, color }) => (
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
          <div style={{ fontSize:20, fontWeight:900, color:T.darkRed, letterSpacing:'-0.02em' }}>Marketing</div>
          <div style={{ fontSize:12, color:T.sub, marginTop:3 }}>
            Campaigns · Attribution · Pipeline
            {saved && <span style={{ color:T.green, fontWeight:700, marginLeft:8 }}>✓ Saved</span>}
          </div>
        </div>
        <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
          <select value={period} onChange={e=>setPeriod(e.target.value)} style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:8, padding:'9px 12px', color:T.ink, fontSize:12, fontFamily:'inherit', outline:'none', cursor:'pointer' }}>
            {[['30','Last 30 days'],['90','Last 90 days'],['180','Last 6 months'],['365','Last year']].map(([v,l])=><option key={v} value={v}>{l}</option>)}
          </select>
          <button onClick={()=>onSwitchTab?.('promo')} style={btn(T.bg, T.sub, { border:`1px solid ${T.bdr}` })}>🏷️ Promo Codes</button>
          <button onClick={()=>onSwitchTab?.('bot')} style={btn(T.purple, T.white)}>🤖 Campaign Bot</button>
          <button onClick={()=>onSwitchTab?.('campaigns')} style={btn(T.red, T.white)}>+ New Campaign</button>
        </div>
      </div>

      {/* KPIs */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(155px,1fr))', gap:11, marginBottom:16 }}>
        <KPI label="Attributed Revenue" value={fmtL(attrib.totalAttrib)} icon="💰" color={T.green}
             sub={`${attrib.share.toFixed(0)}% of all sales`}/>
        <KPI label="Campaign Spend" value={kpis.spend?fmtL(kpis.spend):'Not entered'} icon="💸" color={T.red}
             sub={kpis.spend?`across ${campaigns.length} campaigns`:'add spend to see ROI'}/>
        <KPI label="ROI" value={kpis.roi!=null?`${kpis.roi>0?'+':''}${kpis.roi.toFixed(0)}%`:'—'} icon="📈"
             color={kpis.roi==null?T.muted:kpis.roi>0?T.green:T.red}
             sub={kpis.roi!=null?'return on spend':'needs spend data'}/>
        <KPI label="Contacts Reached" value={kpis.reached.toLocaleString('en-IN')} icon="📣" color={T.blue}
             sub={kpis.cpl?`${fmt(kpis.cpl)} per contact`:'across campaigns'}/>
        <KPI label="Active Leads" value={kpis.activeLeads} icon="🎯" color={T.purple}
             sub={kpis.pipeline?`${fmtL(kpis.pipeline)} pipeline`:'in CRM'}/>
        <KPI label="Active Campaigns" value={kpis.active} icon="⚡" color={kpis.active?T.amber:T.muted}
             sub="running or scheduled"/>
      </div>

      {/* Attribution explainer */}
      <div style={{ background:'#EFF6FF', border:'1px solid #BFDBFE', borderRadius:11, padding:'12px 16px', marginBottom:16, fontSize:12, color:T.sub, lineHeight:1.6 }}>
        <strong style={{ color:T.blue }}>How revenue is attributed:</strong> only sales where a promo code was applied at checkout
        can be traced back to a campaign. {attrib.totalOrders} order{attrib.totalOrders!==1?'s':''} in this period used a code,
        worth {fmt(attrib.totalAttrib)} with {fmt(attrib.totalDisc)} given as discount.
        Walk-in sales influenced by a WhatsApp broadcast can't be measured — attach a promo code to a campaign to track it.
      </div>

      {/* Channel status */}
      <div style={{ background:T.white, border:`1px solid ${T.bdr}`, borderRadius:13, padding:'17px 19px', marginBottom:16, boxShadow:'0 1px 4px rgba(0,0,0,.05)' }}>
        <div style={{ fontSize:13, fontWeight:800, color:T.darkRed, marginBottom:4 }}>Channels</div>
        <div style={{ fontSize:11.5, color:T.sub, marginBottom:14 }}>What you can send on today, and what needs setting up</div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(170px,1fr))', gap:11 }}>
          {Object.entries(CHANNELS).map(([k,ch])=>{
            const st = channelStats[k] || { campaigns:0, reached:0, revenue:0 };
            return (
              <div key={k} style={{ background: ch.live?T.white:T.bg, border:`1px solid ${ch.live?ch.color+'44':T.bdr}`, borderRadius:11, padding:'13px 15px', opacity: ch.live?1:.65 }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:8 }}>
                  <span style={{ fontSize:20 }}>{ch.icon}</span>
                  <span style={{ display:'flex', alignItems:'center', gap:4, fontSize:9, fontWeight:700,
                                 color: ch.live?T.green:T.muted, background: ch.live?'#F0FDF4':'#F9FAFB',
                                 border:`1px solid ${ch.live?'#BBF7D0':T.bdr}`, borderRadius:20, padding:'2px 8px' }}>
                    <span style={{ width:5, height:5, borderRadius:'50%', background: ch.live?T.green:T.muted }}/>
                    {ch.live?'Ready':'Not set up'}
                  </span>
                </div>
                <div style={{ fontSize:13, fontWeight:800, color: ch.live?ch.color:T.muted, marginBottom:3 }}>{ch.l}</div>
                {ch.live ? (
                  <>
                    <div style={{ display:'flex', gap:12, marginBottom:5 }}>
                      <div><div style={{ fontSize:15, fontWeight:900, color:T.ink }}>{st.campaigns}</div><div style={{ fontSize:9, color:T.muted }}>campaigns</div></div>
                      {st.revenue>0 && <div><div style={{ fontSize:15, fontWeight:900, color:T.green }}>{fmtL(st.revenue)}</div><div style={{ fontSize:9, color:T.muted }}>tracked</div></div>}
                    </div>
                    <div style={{ fontSize:9.5, color:T.muted, lineHeight:1.4 }}>{ch.how}</div>
                  </>
                ) : (
                  <div style={{ fontSize:10, color:T.muted, lineHeight:1.4, marginTop:4 }}>{ch.how}</div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Campaign performance */}
      <div style={{ background:T.white, border:`1px solid ${T.bdr}`, borderRadius:13, overflow:'hidden', boxShadow:'0 1px 4px rgba(0,0,0,.05)' }}>
        <div style={{ padding:'14px 18px', borderBottom:`1px solid ${T.bdr}`, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <div>
            <div style={{ fontSize:13, fontWeight:800, color:T.darkRed }}>Campaign Performance</div>
            <div style={{ fontSize:11, color:T.sub, marginTop:2 }}>Click any row to add spend and link a promo code</div>
          </div>
          <button onClick={()=>onSwitchTab?.('campaigns')} style={{ background:'none', border:'none', color:T.red, fontSize:11, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>Manage →</button>
        </div>

        {loading ? (
          <div style={{ padding:20 }}>
            {[1,2,3,4].map(i=><div key={i} style={{ height:38, background:'#F0E8E8', borderRadius:7, marginBottom:8, animation:'skelShine 1.4s ease-in-out infinite' }}/>)}
          </div>
        ) : campRows.length===0 ? (
          <div style={{ textAlign:'center', padding:46 }}>
            <div style={{ fontSize:34, marginBottom:8 }}>📣</div>
            <div style={{ color:T.muted, fontWeight:600 }}>No campaigns yet</div>
            <div style={{ color:T.muted, fontSize:11.5, marginTop:4 }}>Create one under the Campaigns tab</div>
          </div>
        ) : (
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12.5 }}>
            <thead><tr style={{ background:T.lightRed }}>
              {['Campaign','Channel','Reached','Promo Code','Orders','Revenue','Spend','ROI'].map(h=>(
                <th key={h} style={{ padding:'10px 12px', textAlign:['Reached','Orders','Revenue','Spend','ROI'].includes(h)?'right':'left', fontSize:9, color:T.darkRed, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.04em', borderBottom:`1px solid ${T.bdr}`, whiteSpace:'nowrap' }}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {campRows.map(c=>{
                const ch = CHANNELS[(c.type||'whatsapp').toLowerCase()] || CHANNELS.whatsapp;
                return (
                  <tr key={c.id} onClick={()=>setEditCamp({ ...c, _spend:String(c.spend||''), _sent:String(c.sent_count||c.total_contacts||''), _promo:c.promo_code||'' })}
                    style={{ borderBottom:`1px solid ${T.bdr}22`, cursor:'pointer' }}
                    onMouseEnter={e=>e.currentTarget.style.background=T.bg}
                    onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                    <td style={{ padding:'10px 12px' }}>
                      <div style={{ color:T.ink, fontWeight:700 }}>{c.name}</div>
                      <span style={{ fontSize:9, color: c.status==='active'?T.green:c.status==='scheduled'?T.blue:T.muted, fontWeight:700, textTransform:'uppercase' }}>{c.status||'draft'}</span>
                    </td>
                    <td style={{ padding:'10px 12px' }}>
                      <span style={{ background:ch.color+'15', color:ch.color, borderRadius:5, padding:'2px 8px', fontSize:10, fontWeight:700 }}>{ch.icon} {ch.l}</span>
                    </td>
                    <td style={{ padding:'10px 12px', textAlign:'right', color:T.sub }}>{(c.sent_count||c.total_contacts||0).toLocaleString('en-IN')}</td>
                    <td style={{ padding:'10px 12px' }}>
                      {c.promo_code
                        ? <span style={{ fontFamily:'monospace', background:'#F5F3FF', color:T.purple, borderRadius:5, padding:'2px 8px', fontSize:10.5, fontWeight:700 }}>{c.promo_code}</span>
                        : <span style={{ fontSize:10.5, color:T.muted }}>not linked</span>}
                    </td>
                    <td style={{ padding:'10px 12px', textAlign:'right', color:T.blue, fontWeight:600 }}>{c.orders||'—'}</td>
                    <td style={{ padding:'10px 12px', textAlign:'right', color: c.revenue?T.green:T.muted, fontWeight: c.revenue?800:400 }}>{c.revenue?fmt(c.revenue):'—'}</td>
                    <td style={{ padding:'10px 12px', textAlign:'right', color: c.spend?T.red:T.muted }}>{c.spend?fmt(c.spend):'—'}</td>
                    <td style={{ padding:'10px 12px', textAlign:'right' }}>
                      {c.roi!=null
                        ? <span style={{ color: c.roi>0?T.green:T.red, fontWeight:800 }}>{c.roi>0?'+':''}{c.roi.toFixed(0)}%</span>
                        : <span style={{ fontSize:10, color:T.muted }}>add spend</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Edit spend modal */}
      {editCamp && (
        <div onClick={()=>setEditCamp(null)} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.5)', zIndex:300, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
          <div onClick={e=>e.stopPropagation()} style={{ background:T.white, borderRadius:15, padding:25, width:'100%', maxWidth:430, boxShadow:'0 20px 60px rgba(0,0,0,.25)' }}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:5 }}>
              <div style={{ fontSize:16, fontWeight:800, color:T.darkRed }}>Campaign Tracking</div>
              <button onClick={()=>setEditCamp(null)} style={{ background:'none', border:'none', fontSize:21, cursor:'pointer', color:T.muted }}>×</button>
            </div>
            <div style={{ fontSize:12.5, color:T.sub, marginBottom:18 }}>{editCamp.name}</div>

            <form onSubmit={saveSpend}>
              {[
                ['Amount Spent','_spend','number','What this campaign cost you'],
                ['Contacts Reached','_sent','number','How many people it went to'],
                ['Promo Code','_promo','text','Links checkout redemptions to this campaign'],
              ].map(([lb,key,type,hint])=>(
                <div key={key} style={{ marginBottom:13 }}>
                  <label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:4 }}>{lb}</label>
                  <input type={type} value={editCamp[key]}
                    onChange={e=>setEditCamp(c=>({ ...c, [key]: key==='_promo'?e.target.value.toUpperCase():e.target.value }))}
                    style={{ width:'100%', background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:8, padding:'10px 13px', color:T.ink, fontSize:13.5, fontFamily: key==='_promo'?'monospace':'inherit', outline:'none' }}/>
                  <div style={{ fontSize:10, color:T.muted, marginTop:3 }}>{hint}</div>
                </div>
              ))}

              {editCamp._promo && attrib.byPromo[editCamp._promo] && (
                <div style={{ background:'#F0FDF4', border:'1px solid #BBF7D0', borderRadius:9, padding:'11px 14px', marginBottom:14, fontSize:12, color:T.green }}>
                  ✅ This code has {attrib.byPromo[editCamp._promo].orders} order{attrib.byPromo[editCamp._promo].orders>1?'s':''} worth <strong>{fmt(attrib.byPromo[editCamp._promo].revenue)}</strong>
                  {parseFloat(editCamp._spend)>0 && (
                    <div style={{ marginTop:4 }}>
                      ROI: <strong>{(((attrib.byPromo[editCamp._promo].revenue - parseFloat(editCamp._spend))/parseFloat(editCamp._spend))*100).toFixed(0)}%</strong>
                    </div>
                  )}
                </div>
              )}

              <div style={{ display:'flex', gap:10 }}>
                <button type="button" onClick={()=>setEditCamp(null)} style={{ flex:1, background:T.bg, color:T.sub, border:`1px solid ${T.bdr}`, borderRadius:9, padding:'12px', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>Cancel</button>
                <button type="submit" disabled={saving} style={{ flex:2, ...btn(T.red,T.white,{ padding:'12px', fontSize:13 }) }}>{saving?'Saving…':'Save'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
