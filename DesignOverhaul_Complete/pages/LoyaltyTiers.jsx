import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

const T = {
  bg:'#060710', srf:'#0b0d1a', card:'#0f1220', card2:'#141828',
  bdr:'#1a1e32', bdr2:'#222740',
  blue:'#4f7cff', green:'#00d68f', red:'#ff4d6a', amber:'#ffb547',
  purple:'#9b72ff', teal:'#00c9b1', orange:'#ff7043', gold:'#ffc107',
  cyan:'#00d4ff', pink:'#f06292',
  muted:'#4a5175', dim:'#2a3050', card3:'#181d2e',
  ink:'#eef0f8', sub:'#8892b0'
};
const fmt = n => 'Rs.' + (n||0).toLocaleString('en-IN', { maximumFractionDigits:0 });

const DEFAULT_TIERS = [
  { name:'Bronze',   min_spend:0,      max_spend:10000,  color:'#cd7f32', icon:'🥉', earn_rate:1,   redeem_value:0.5,  benefits:['Basic loyalty points','Birthday discount 5%','Monthly newsletter'] },
  { name:'Silver',   min_spend:10000,  max_spend:50000,  color:'#c0c0c0', icon:'🥈', earn_rate:1.5, redeem_value:0.75, benefits:['1.5x loyalty points','Birthday discount 10%','Priority customer service','Monthly offers'] },
  { name:'Gold',     min_spend:50000,  max_spend:150000, color:'#ffc107', icon:'🥇', earn_rate:2,   redeem_value:1,    benefits:['2x loyalty points','Birthday discount 15%','Free gift wrapping','VIP offers','Early access to sales'] },
  { name:'Platinum', min_spend:150000, max_spend:null,   color:'#9b72ff', icon:'💎', earn_rate:3,   redeem_value:1.5,  benefits:['3x loyalty points','Birthday discount 20%','Exclusive member events','Personal shopping assistant','Free delivery'] },
];

export default function LoyaltyTiers({ tenant }) {
  const [tiers,     setTiers]     = useState([]);
  const [customers, setCustomers] = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [editTier,  setEditTier]  = useState(null);
  const [saving,    setSaving]    = useState(false);
  const [seeded,    setSeeded]    = useState(false);

  useEffect(() => { if (tenant?.id) load(); }, [tenant?.id]);

  async function load() {
    setLoading(true);
    const [tierRes, custRes] = await Promise.all([
      supabase.from('loyalty_tiers').select('*').eq('tenant_id', tenant.id).order('min_spend'),
      supabase.from('customers').select('id,name,total_spent,loyalty_points,segment').eq('tenant_id', tenant.id),
    ]);
    setTiers(tierRes.data||[]);
    setCustomers(custRes.data||[]);
    setLoading(false);
  }

  async function seedDefaultTiers() {
    setSaving(true);
    await supabase.from('loyalty_tiers').insert(DEFAULT_TIERS.map(t=>({ ...t, tenant_id:tenant.id, benefits:JSON.stringify(t.benefits) })));
    setSaving(false); setSeeded(true); await load();
  }

  function getTier(totalSpent) {
    const activeTiers = tiers.length>0?tiers:DEFAULT_TIERS;
    for (let i=activeTiers.length-1;i>=0;i--) {
      if ((totalSpent||0)>=activeTiers[i].min_spend) return activeTiers[i];
    }
    return activeTiers[0];
  }

  async function saveTier(e) {
    e.preventDefault(); setSaving(true);
    const payload = { ...editTier, tenant_id:tenant.id, benefits:Array.isArray(editTier.benefits)?editTier.benefits:editTier.benefits.split('\n').filter(Boolean) };
    if (editTier.id) await supabase.from('loyalty_tiers').update(payload).eq('id', editTier.id);
    else await supabase.from('loyalty_tiers').insert(payload);
    setEditTier(null); setSaving(false); await load();
  }

  async function upgradeCustomers() {
    let upgraded=0;
    for (const cust of customers) {
      const tier   = getTier(cust.total_spent||0);
      const newSeg = tier.name.toLowerCase();
      if (cust.segment !== newSeg) {
        await supabase.from('customers').update({ segment:newSeg }).eq('id', cust.id);
        upgraded++;
      }
    }
    alert(`✅ ${upgraded} customers upgraded to new tier!`);
    await load();
  }

  const activeTiers = tiers.length>0?tiers:DEFAULT_TIERS;
  const tierCounts  = activeTiers.map(tier=>({ ...tier, count:customers.filter(c=>getTier(c.total_spent||0).name===tier.name).length }));
  const inp = { background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:8, padding:'9px 12px', color:T.ink, fontSize:13, fontFamily:'inherit', outline:'none', width:'100%' };

  return (
    <div style={{ padding:20 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
        <div>
          <div style={{ fontSize:22, fontWeight:800, color:T.ink }}>👑 Loyalty Tiers</div>
          <div style={{ fontSize:13, color:T.sub }}>Customer tier management — Bronze, Silver, Gold, Platinum</div>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <button onClick={upgradeCustomers} style={{ background:T.amber+'22', color:T.amber, border:`1px solid ${T.amber}44`, borderRadius:8, padding:'9px 14px', fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>🔄 Auto-Upgrade All</button>
          {tiers.length===0&&!seeded&&<button onClick={seedDefaultTiers} disabled={saving} style={{ background:T.blue, color:'#fff', border:'none', borderRadius:8, padding:'9px 16px', fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>{saving?'Setting up…':'✨ Setup Default Tiers'}</button>}
        </div>
      </div>

      {/* Tier cards */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:14, marginBottom:24 }}>
        {tierCounts.map(tier=>(
          <div key={tier.name} style={{ background:T.srf, border:`2px solid ${tier.color}44`, borderRadius:14, overflow:'hidden' }}>
            <div style={{ background:`linear-gradient(135deg,${tier.color}22,${tier.color}44)`, padding:'20px 18px', textAlign:'center', borderBottom:`1px solid ${tier.color}33` }}>
              <div style={{ fontSize:36, marginBottom:6 }}>{tier.icon}</div>
              <div style={{ fontSize:18, fontWeight:900, color:tier.color }}>{tier.name}</div>
              <div style={{ fontSize:12, color:T.sub, marginTop:3 }}>{fmt(tier.min_spend)}{tier.max_spend?` – ${fmt(tier.max_spend)}`:'+'}  lifetime spend</div>
            </div>
            <div style={{ padding:16 }}>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:12 }}>
                {[['Earn Rate',`${tier.earn_rate}x pts`,tier.color],['Redeem',`Rs.${tier.redeem_value}/pt`,T.green]].map(([l,v,c])=>(
                  <div key={l} style={{ background:T.card, borderRadius:7, padding:'7px 10px', textAlign:'center' }}>
                    <div style={{ fontSize:9, color:T.muted, textTransform:'uppercase', marginBottom:2 }}>{l}</div>
                    <div style={{ fontSize:13, fontWeight:700, color:c }}>{v}</div>
                  </div>
                ))}
              </div>
              <div style={{ fontSize:12, color:T.sub, fontWeight:700, marginBottom:6 }}>Benefits</div>
              {(Array.isArray(tier.benefits)?tier.benefits:JSON.parse(tier.benefits||'[]')).slice(0,3).map((b,i)=>(
                <div key={i} style={{ fontSize:11, color:T.muted, padding:'2px 0' }}>✓ {b}</div>
              ))}
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginTop:12, paddingTop:10, borderTop:`1px solid ${T.bdr}` }}>
                <span style={{ fontSize:20, fontWeight:800, color:tier.color }}>{tier.count}</span>
                <span style={{ fontSize:10, color:T.muted }}>customers</span>
                {tiers.length>0&&<button onClick={()=>setEditTier({...tier,benefits:Array.isArray(tier.benefits)?tier.benefits.join('\n'):JSON.parse(tier.benefits||'[]').join('\n')})} style={{ background:T.blue+'22', color:T.blue, border:'none', borderRadius:5, padding:'4px 8px', fontSize:10, cursor:'pointer', fontFamily:'inherit' }}>✏️</button>}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Customer tier breakdown */}
      <div style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:12, overflow:'hidden' }}>
        <div style={{ padding:'12px 16px', background:T.card, fontWeight:700, color:T.ink, borderBottom:`1px solid ${T.bdr}` }}>👥 Customer Tier Distribution</div>
        <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
          <thead><tr style={{ background:T.card+'88' }}>
            {['Customer','Total Spent','Tier','Points','Next Tier','Gap'].map(h=><th key={h} style={{ padding:'9px 14px', textAlign:'left', fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', borderBottom:`1px solid ${T.bdr}` }}>{h}</th>)}
          </tr></thead>
          <tbody>
            {loading?<tr><td colSpan={6} style={{ textAlign:'center', padding:30, color:T.sub }}>Loading…</td></tr>
            :[...customers].sort((a,b)=>(b.total_spent||0)-(a.total_spent||0)).slice(0,20).map(c=>{
              const tier    = getTier(c.total_spent||0);
              const tierIdx = activeTiers.findIndex(t=>t.name===tier.name);
              const nextTier= activeTiers[tierIdx+1];
              const gap     = nextTier?Math.max(0,(nextTier.min_spend||0)-(c.total_spent||0)):0;
              return (
                <tr key={c.id} style={{ borderBottom:`1px solid ${T.bdr}22` }}>
                  <td style={{ padding:'9px 14px', color:T.ink }}>{c.name}</td>
                  <td style={{ padding:'9px 14px', color:T.blue, fontWeight:600 }}>{fmt(c.total_spent||0)}</td>
                  <td style={{ padding:'9px 14px' }}><span style={{ background:(tier.color||T.muted)+'22', color:tier.color||T.muted, borderRadius:5, padding:'2px 8px', fontSize:10, fontWeight:700 }}>{tier.icon} {tier.name}</span></td>
                  <td style={{ padding:'9px 14px', color:T.amber }}>{(c.loyalty_points||0).toLocaleString('en-IN')} pts</td>
                  <td style={{ padding:'9px 14px', color:T.muted }}>{nextTier?`${nextTier.icon} ${nextTier.name}`:'🏆 Max Tier'}</td>
                  <td style={{ padding:'9px 14px', color:gap>0?T.red:T.green, fontWeight:600 }}>{gap>0?fmt(gap)+' more':'✅ Achieved'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Edit modal */}
      {editTier&&<div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.8)', zIndex:200, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
        <div style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:14, padding:24, width:'100%', maxWidth:440 }}>
          <div style={{ display:'flex', justifyContent:'space-between', marginBottom:18 }}>
            <div style={{ fontSize:17, fontWeight:700, color:T.ink }}>Edit {editTier.name} Tier</div>
            <button onClick={()=>setEditTier(null)} style={{ background:'none', border:'none', color:T.muted, cursor:'pointer', fontSize:22 }}>×</button>
          </div>
          <form onSubmit={saveTier}>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
              {[['Min Spend','number','min_spend'],['Max Spend','number','max_spend'],['Earn Rate (multiplier)','number','earn_rate'],['Redeem Value (Rs/pt)','number','redeem_value'],['Color','color','color'],['Icon (emoji)','text','icon']].map(([label,type,key])=>(
                <div key={key}><label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:4 }}>{label}</label>
                  <input type={type} value={editTier[key]||''} onChange={e=>setEditTier(t=>({...t,[key]:e.target.value}))} style={{ ...inp, height:type==='color'?40:'auto' }}/></div>
              ))}
              <div style={{ gridColumn:'1/-1' }}><label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:4 }}>Benefits (one per line)</label>
                <textarea value={editTier.benefits} onChange={e=>setEditTier(t=>({...t,benefits:e.target.value}))} rows={4} style={{ ...inp, resize:'vertical' }}/></div>
            </div>
            <div style={{ display:'flex', gap:10, marginTop:14 }}>
              <button type="button" onClick={()=>setEditTier(null)} style={{ flex:1, background:T.card, color:T.sub, border:`1px solid ${T.bdr}`, borderRadius:8, padding:'11px', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>Cancel</button>
              <button type="submit" disabled={saving} style={{ flex:2, background:T.blue, color:'#fff', border:'none', borderRadius:8, padding:'11px', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>{saving?'Saving…':'Save Tier'}</button>
            </div>
          </form>
        </div>
      </div>}
    </div>
  );
}
