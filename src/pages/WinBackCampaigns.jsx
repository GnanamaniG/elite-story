import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

const T = {
  bg:'#F7F3F3', srf:'#FFFFFF', card:'#FFFFFF', bdr:'#E8DEDE',
  red:'#C0392B', darkRed:'#8B0000', lightRed:'#FEF2F2',
  green:'#16A34A', amber:'#D97706', blue:'#2563EB', purple:'#7C3AED',
  ink:'#111827', sub:'#6B7280', muted:'#9CA3AF', white:'#FFFFFF'
};
const fmt = n => 'Rs.' + (n||0).toLocaleString('en-IN', { maximumFractionDigits:0 });
const btn = (bg,color,extra={}) => ({ background:bg, color, border:'none', borderRadius:8, padding:'9px 16px', fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:'inherit', ...extra });
const inp = { background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:8, padding:'9px 12px', color:T.ink, fontSize:13, fontFamily:'inherit', outline:'none', width:'100%' };

export default function WinBackCampaigns({ tenant }) {
  const [campaigns, setCampaigns] = useState([]);
  const [targets,   setTargets]   = useState([]);
  const [selCamp,   setSelCamp]   = useState(null);
  const [loading,   setLoading]   = useState(true);
  const [scanning,  setScanning]  = useState(false);
  const [showForm,  setShowForm]  = useState(false);
  const [saving,    setSaving]    = useState(false);
  const [form, setForm] = useState({ name:'', lapse_days:'60', offer_type:'percent', offer_value:'10', message_template:'' });

  useEffect(() => { if (tenant?.id) load(); }, [tenant?.id]);
  useEffect(() => { if (selCamp) loadTargets(selCamp.id); }, [selCamp?.id]);

  async function load() {
    setLoading(true);
    const { data } = await supabase.from('winback_campaigns').select('*').eq('tenant_id', tenant.id).order('created_at', { ascending:false });
    setCampaigns(data||[]);
    setLoading(false);
  }

  async function loadTargets(campId) {
    const { data } = await supabase.from('winback_targets').select('*').eq('tenant_id', tenant.id).eq('campaign_id', campId).order('lifetime_val', { ascending:false });
    setTargets(data||[]);
  }

  async function createCampaign(e) {
    e.preventDefault(); setSaving(true);
    const { data } = await supabase.from('winback_campaigns').insert({
      ...form, tenant_id:tenant.id,
      lapse_days:parseInt(form.lapse_days)||60,
      offer_value:parseFloat(form.offer_value)||0,
      status:'draft',
    }).select().single();
    setShowForm(false);
    setForm({ name:'', lapse_days:'60', offer_type:'percent', offer_value:'10', message_template:'' });
    setSaving(false);
    await load();
    if (data) { setSelCamp(data); scanCustomers(data); }
  }

  async function scanCustomers(camp) {
    setScanning(true);
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - (camp.lapse_days||60));
    const cutoffStr = cutoff.toISOString().slice(0,10);

    const [custRes, salesRes] = await Promise.all([
      supabase.from('customers').select('id,name,phone,total_spent').eq('tenant_id', tenant.id),
      supabase.from('sales').select('customer,customer_id,date,total').eq('tenant_id', tenant.id).order('date', { ascending:false }),
    ]);

    const customers = custRes.data || [];
    const sales     = salesRes.data || [];

    // Last order date per customer
    const lastOrder = {};
    sales.forEach(s => {
      const key = s.customer_id || s.customer;
      if (!key) return;
      if (!lastOrder[key] || s.date > lastOrder[key]) lastOrder[key] = s.date;
    });

    const today   = new Date();
    const lapsed  = customers.filter(c => {
      const last = lastOrder[c.id] || lastOrder[c.name];
      if (!last) return false;
      return last < cutoffStr;
    }).map(c => {
      const last = lastOrder[c.id] || lastOrder[c.name];
      const days = Math.floor((today - new Date(last)) / 86400000);
      return {
        tenant_id: tenant.id, campaign_id: camp.id,
        customer_id: c.id, customer: c.name, phone: c.phone || '',
        last_order: last, days_lapsed: days, lifetime_val: c.total_spent || 0,
      };
    });

    // Clear old targets then insert
    await supabase.from('winback_targets').delete().eq('campaign_id', camp.id);
    if (lapsed.length > 0) await supabase.from('winback_targets').insert(lapsed);
    await supabase.from('winback_campaigns').update({ targeted_count: lapsed.length, status:'active' }).eq('id', camp.id);

    setScanning(false);
    await load(); await loadTargets(camp.id);
    alert(`✅ Found ${lapsed.length} lapsed customers (no order in ${camp.lapse_days}+ days)`);
  }

  function buildMessage(camp, target) {
    if (camp.message_template) {
      return camp.message_template
        .replace(/\{name\}/g, target.customer)
        .replace(/\{days\}/g, target.days_lapsed)
        .replace(/\{offer\}/g, camp.offer_type==='percent'?`${camp.offer_value}% OFF`:camp.offer_type==='fixed'?`${fmt(camp.offer_value)} OFF`:'a special gift')
        .replace(/\{shop\}/g, tenant?.name||'7SQ');
    }
    const offer = camp.offer_type==='percent' ? `*${camp.offer_value}% OFF*`
                : camp.offer_type==='fixed'   ? `*${fmt(camp.offer_value)} OFF*`
                : camp.offer_type==='free_item'? '*a FREE gift*' : 'special prices';
    return `Hi ${target.customer}! 👋\n\nWe've missed you at *${tenant?.name||'7SQ'}*!\n\nIt's been a while since your last visit (${target.days_lapsed} days). We have exciting new arrivals waiting for you! 🛍️\n\n🎁 *Special Welcome Back Offer*\nGet ${offer} on your next purchase!\n\n${camp.offer_type!=='none'?'Just show this message at the store.\n\n':''}Visit us soon — we'd love to see you again! 🙏\n\n— Team ${tenant?.name||'7SQ'}`;
  }

  async function sendToTarget(target) {
    if (!selCamp) return;
    const msg = buildMessage(selCamp, target);
    const ph  = (target.phone||'').replace(/\D/g,'').replace(/^0/,'91');
    window.open(`https://wa.me/${ph}?text=${encodeURIComponent(msg)}`, '_blank');
    await supabase.from('winback_targets').update({ sent:true, sent_at:new Date().toISOString() }).eq('id', target.id);
    const newSent = (selCamp.sent_count||0) + 1;
    await supabase.from('winback_campaigns').update({ sent_count:newSent }).eq('id', selCamp.id);
    setTargets(prev=>prev.map(t=>t.id===target.id?{...t,sent:true}:t));
    setSelCamp(prev=>({...prev, sent_count:newSent}));
  }

  async function markReturned(target) {
    await supabase.from('winback_targets').update({ returned:true }).eq('id', target.id);
    const newRet = (selCamp.returned_count||0) + 1;
    await supabase.from('winback_campaigns').update({ returned_count:newRet }).eq('id', selCamp.id);
    setTargets(prev=>prev.map(t=>t.id===target.id?{...t,returned:true}:t));
    setSelCamp(prev=>({...prev, returned_count:newRet}));
  }

  const totalLapsedValue = targets.reduce((s,t)=>s+(t.lifetime_val||0),0);
  const sentCount        = targets.filter(t=>t.sent).length;
  const returnedCount    = targets.filter(t=>t.returned).length;
  const conversionRate   = sentCount>0 ? (returnedCount/sentCount*100).toFixed(1) : 0;

  return (
    <div style={{ padding:24, background:T.bg, minHeight:'100%' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:24 }}>
        <div>
          <div style={{ fontSize:22, fontWeight:800, color:T.darkRed, letterSpacing:'-0.02em' }}>🔄 Win-Back Campaigns</div>
          <div style={{ fontSize:13, color:T.sub, marginTop:2 }}>Find lapsed customers and bring them back with targeted offers</div>
        </div>
        <button onClick={()=>setShowForm(true)} style={btn(T.red, T.white)}>+ New Campaign</button>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'320px 1fr', gap:18, alignItems:'flex-start' }}>
        {/* Campaign list */}
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          {loading?<div style={{ textAlign:'center', padding:40, color:T.muted }}>Loading…</div>
          :campaigns.length===0?<div style={{ background:T.white, border:`1px solid ${T.bdr}`, borderRadius:12, padding:40, textAlign:'center' }}>
            <div style={{ fontSize:36, marginBottom:8 }}>🔄</div>
            <div style={{ color:T.muted, fontWeight:600, fontSize:13 }}>No campaigns yet</div>
          </div>
          :campaigns.map(c=>(
            <div key={c.id} onClick={()=>setSelCamp(c)}
              style={{ background:T.white, border:`2px solid ${selCamp?.id===c.id?T.red:T.bdr}`, borderRadius:12, padding:'14px 16px', cursor:'pointer', transition:'all .15s', boxShadow:selCamp?.id===c.id?'0 3px 12px rgba(192,57,43,.12)':'0 1px 3px rgba(0,0,0,.04)' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:8 }}>
                <div style={{ fontSize:13, fontWeight:700, color:T.ink }}>{c.name}</div>
                <span style={{ background:c.status==='active'?'#F0FDF4':'#F9FAFB', color:c.status==='active'?T.green:T.muted, border:`1px solid ${c.status==='active'?'#BBF7D0':'#E5E7EB'}`, borderRadius:20, padding:'1px 8px', fontSize:9, fontWeight:700, textTransform:'uppercase' }}>{c.status}</span>
              </div>
              <div style={{ fontSize:11, color:T.sub, marginBottom:8 }}>
                Lapsed {c.lapse_days}+ days · {c.offer_type==='percent'?`${c.offer_value}% off`:c.offer_type==='fixed'?`${fmt(c.offer_value)} off`:c.offer_type==='free_item'?'Free gift':'No offer'}
              </div>
              <div style={{ display:'flex', gap:10, fontSize:11 }}>
                <span style={{ color:T.blue }}>🎯 {c.targeted_count||0}</span>
                <span style={{ color:T.amber }}>💬 {c.sent_count||0}</span>
                <span style={{ color:T.green }}>✅ {c.returned_count||0}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Targets panel */}
        <div>
          {!selCamp?<div style={{ background:T.white, border:`1px solid ${T.bdr}`, borderRadius:14, padding:60, textAlign:'center' }}>
            <div style={{ fontSize:40, marginBottom:12 }}>👈</div>
            <div style={{ fontSize:15, fontWeight:700, color:T.sub }}>Select a campaign</div>
            <div style={{ fontSize:12, color:T.muted, marginTop:4 }}>Choose a campaign to view and message lapsed customers</div>
          </div>
          :<>
            {/* Campaign KPIs */}
            <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12, marginBottom:16 }}>
              {[['Targeted',targets.length,T.blue],['Messaged',sentCount,T.amber],['Returned',returnedCount,T.green],['Conversion',`${conversionRate}%`,T.purple]].map(([label,val,color])=>(
                <div key={label} style={{ background:T.white, border:`1px solid ${T.bdr}`, borderRadius:12, padding:'14px 16px', boxShadow:'0 1px 4px rgba(0,0,0,.05)' }}>
                  <div style={{ fontSize:9, color:T.sub, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:5 }}>{label}</div>
                  <div style={{ fontSize:20, fontWeight:900, color }}>{val}</div>
                </div>
              ))}
            </div>

            <div style={{ background:T.lightRed, border:`1px solid ${T.bdr}`, borderRadius:10, padding:'10px 16px', marginBottom:14, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <span style={{ fontSize:12, color:T.darkRed, fontWeight:600 }}>💰 Total lifetime value at risk: <strong>{fmt(totalLapsedValue)}</strong></span>
              <button onClick={()=>scanCustomers(selCamp)} disabled={scanning} style={btn(T.red, T.white, { padding:'6px 14px', fontSize:11 })}>{scanning?'Scanning…':'🔍 Re-scan Customers'}</button>
            </div>

            {/* Targets table */}
            <div style={{ background:T.white, border:`1px solid ${T.bdr}`, borderRadius:14, overflow:'hidden', boxShadow:'0 1px 4px rgba(0,0,0,.05)' }}>
              <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
                <thead><tr style={{ background:T.lightRed }}>
                  {['Customer','Last Order','Days Lapsed','Lifetime Value','Status','Actions'].map(h=>(
                    <th key={h} style={{ padding:'11px 14px', textAlign:'left', fontSize:9, color:T.darkRed, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.05em', borderBottom:`1px solid ${T.bdr}` }}>{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {targets.length===0?<tr><td colSpan={6} style={{ textAlign:'center', padding:50 }}>
                    <div style={{ fontSize:32, marginBottom:8 }}>🎯</div>
                    <div style={{ color:T.muted, fontWeight:600 }}>No lapsed customers found</div>
                    <div style={{ color:T.muted, fontSize:11, marginTop:4 }}>Click "Re-scan Customers" to search</div>
                  </td></tr>
                  :targets.map(t=>(
                    <tr key={t.id} style={{ borderBottom:`1px solid ${T.bdr}22`, background:t.returned?'#F0FDF4':'transparent' }}>
                      <td style={{ padding:'11px 14px' }}>
                        <div style={{ fontWeight:600, color:T.ink }}>{t.customer}</div>
                        <div style={{ fontSize:10, color:T.muted }}>{t.phone||'No phone'}</div>
                      </td>
                      <td style={{ padding:'11px 14px', color:T.sub }}>{t.last_order}</td>
                      <td style={{ padding:'11px 14px' }}>
                        <span style={{ background:t.days_lapsed>180?'#FEF2F2':t.days_lapsed>90?'#FFFBEB':'#EFF6FF', color:t.days_lapsed>180?T.red:t.days_lapsed>90?T.amber:T.blue, border:`1px solid ${t.days_lapsed>180?'#FECACA':t.days_lapsed>90?'#FDE68A':'#BFDBFE'}`, borderRadius:5, padding:'2px 8px', fontSize:10, fontWeight:700 }}>{t.days_lapsed}d</span>
                      </td>
                      <td style={{ padding:'11px 14px', color:T.red, fontWeight:700 }}>{fmt(t.lifetime_val)}</td>
                      <td style={{ padding:'11px 14px' }}>
                        {t.returned?<span style={{ color:T.green, fontWeight:700, fontSize:11 }}>✅ Returned</span>
                        :t.sent?<span style={{ color:T.amber, fontWeight:600, fontSize:11 }}>💬 Sent</span>
                        :<span style={{ color:T.muted, fontSize:11 }}>Pending</span>}
                      </td>
                      <td style={{ padding:'11px 14px' }}>
                        <div style={{ display:'flex', gap:6 }}>
                          {t.phone&&!t.sent&&<button onClick={()=>sendToTarget(t)} style={{ background:'#DCFCE7', color:T.green, border:'none', borderRadius:6, padding:'4px 10px', fontSize:10, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>💬 Send</button>}
                          {t.sent&&!t.returned&&<button onClick={()=>markReturned(t)} style={{ background:'#EFF6FF', color:T.blue, border:'none', borderRadius:6, padding:'4px 10px', fontSize:10, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>✅ Came Back</button>}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>}
        </div>
      </div>

      {showForm&&(
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.5)', zIndex:200, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
          <div style={{ background:T.white, borderRadius:16, padding:28, width:'100%', maxWidth:500, boxShadow:'0 20px 60px rgba(0,0,0,.2)' }}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:20 }}>
              <div style={{ fontSize:17, fontWeight:800, color:T.darkRed }}>New Win-Back Campaign</div>
              <button onClick={()=>setShowForm(false)} style={{ background:'none', border:'none', fontSize:22, cursor:'pointer', color:T.muted }}>×</button>
            </div>
            <form onSubmit={createCampaign}>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                <div style={{ gridColumn:'1/-1' }}><label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:4 }}>Campaign Name *</label><input value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} placeholder="e.g. Diwali Win-Back" required style={inp}/></div>
                <div><label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:4 }}>Lapse Threshold (days)</label><input type="number" value={form.lapse_days} onChange={e=>setForm(f=>({...f,lapse_days:e.target.value}))} style={inp}/><div style={{ fontSize:10, color:T.muted, marginTop:3 }}>No order in X days = lapsed</div></div>
                <div><label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:4 }}>Offer Type</label>
                  <select value={form.offer_type} onChange={e=>setForm(f=>({...f,offer_type:e.target.value}))} style={{ ...inp, cursor:'pointer' }}>
                    <option value="percent">Percentage Off</option>
                    <option value="fixed">Fixed Amount Off</option>
                    <option value="free_item">Free Gift</option>
                    <option value="none">No Offer</option>
                  </select>
                </div>
                {form.offer_type!=='none'&&form.offer_type!=='free_item'&&<div style={{ gridColumn:'1/-1' }}><label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:4 }}>Offer Value</label><input type="number" value={form.offer_value} onChange={e=>setForm(f=>({...f,offer_value:e.target.value}))} style={inp}/></div>}
                <div style={{ gridColumn:'1/-1' }}>
                  <label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:4 }}>Custom Message (optional)</label>
                  <textarea value={form.message_template} onChange={e=>setForm(f=>({...f,message_template:e.target.value}))} rows={3} placeholder="Leave blank for auto-generated message" style={{ ...inp, resize:'vertical' }}/>
                  <div style={{ fontSize:10, color:T.muted, marginTop:4 }}>Variables: {'{name}'} {'{days}'} {'{offer}'} {'{shop}'}</div>
                </div>
              </div>
              <div style={{ display:'flex', gap:10, marginTop:20 }}>
                <button type="button" onClick={()=>setShowForm(false)} style={{ flex:1, background:T.bg, color:T.sub, border:`1px solid ${T.bdr}`, borderRadius:9, padding:'12px', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>Cancel</button>
                <button type="submit" disabled={saving} style={{ flex:2, ...btn(T.red, T.white), padding:'12px', fontSize:13 }}>{saving?'Creating…':'🔄 Create & Scan'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
