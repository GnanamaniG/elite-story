import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { getCustomers } from '../lib/supabase';

const T = { bg:'#060710', srf:'#0f1220', card:'#141828', bdr:'#1e2540', blue:'#4f7cff', ink:'#eef0f8', sub:'#6b7598', muted:'#4a5175', green:'#00d68f', amber:'#ffb547', red:'#ff4d6a', purple:'#9b72ff', teal:'#00c9b1' };
const fmt = n => 'Rs.' + (n||0).toLocaleString('en-IN', { maximumFractionDigits:0 });

export default function Loyalty({ tenant, onTenantUpdate }) {
  const [customers,  setCustomers]  = useState([]);
  const [txns,       setTxns]       = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [search,     setSearch]     = useState('');
  const [adjustForm, setAdjustForm] = useState(null);
  const [saving,     setSaving]     = useState(false);
  const [settings,   setSettings]   = useState({ loyalty_enabled: tenant?.loyalty_enabled || false, loyalty_rate: tenant?.loyalty_rate || 1, loyalty_redeem: tenant?.loyalty_redeem || 1 });

  useEffect(() => { if (tenant?.id) load(); }, [tenant?.id]);

  async function load() {
    setLoading(true);
    const [custs, txnsRes] = await Promise.all([
      getCustomers(tenant.id),
      supabase.from('loyalty_txns').select('*, customer:customers(name)').eq('tenant_id', tenant.id).order('created_at', { ascending:false }).limit(50),
    ]);
    setCustomers(custs);
    setTxns(txnsRes.data || []);
    setLoading(false);
  }

  async function saveSettings() {
    setSaving(true);
    await supabase.from('tenants').update(settings).eq('id', tenant.id);
    onTenantUpdate?.({ ...tenant, ...settings });
    setSaving(false);
  }

  async function adjustPoints(customer, points, note, type) {
    setSaving(true);
    await supabase.from('loyalty_txns').insert({ tenant_id:tenant.id, customer_id:customer.id, txn_type:type, points, note });
    await supabase.from('customers').update({ loyalty_pts: Math.max(0, (customer.loyalty_pts||0) + (type==='earn'?points:-points)) }).eq('id', customer.id);
    setAdjustForm(null);
    setSaving(false);
    await load();
  }

  const filtered = customers.filter(c => !search || c.name.toLowerCase().includes(search.toLowerCase()) || (c.phone||'').includes(search));
  const totalPoints = customers.reduce((s, c) => s + (c.loyalty_pts||0), 0);
  const inp = { background:T.card, border:`1px solid ${T.bdr}`, borderRadius:8, padding:'8px 12px', color:T.ink, fontSize:13, fontFamily:'inherit', outline:'none', width:'100%' };

  return (
    <div style={{ padding:20 }}>
      <div style={{ fontSize:22, fontWeight:800, color:T.ink, marginBottom:20 }}>🎁 Loyalty Program</div>

      {/* Settings card */}
      <div style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:12, padding:20, marginBottom:20 }}>
        <div style={{ fontWeight:700, color:T.ink, marginBottom:14 }}>Program Settings</div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr auto', gap:14, alignItems:'flex-end' }}>
          <div>
            <label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:5 }}>Status</label>
            <div style={{ display:'flex', gap:0, background:T.bg, borderRadius:8, padding:3 }}>
              {[[true,'Enabled'],[false,'Disabled']].map(([val,label]) => (
                <button key={String(val)} onClick={() => setSettings(s => ({ ...s, loyalty_enabled:val }))} style={{ flex:1, background:settings.loyalty_enabled===val?T.green:'transparent', color:settings.loyalty_enabled===val?'#fff':T.sub, border:'none', borderRadius:6, padding:'7px', fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>{label}</button>
              ))}
            </div>
          </div>
          <div>
            <label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:5 }}>Points per ₹100</label>
            <input type="number" value={settings.loyalty_rate} onChange={e => setSettings(s => ({ ...s, loyalty_rate: parseFloat(e.target.value)||1 }))} style={inp} min={0.1} step={0.1} />
            <div style={{ fontSize:10, color:T.muted, marginTop:3 }}>e.g. 1 point per ₹100 spent</div>
          </div>
          <div>
            <label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:5 }}>₹ Value per Point</label>
            <input type="number" value={settings.loyalty_redeem} onChange={e => setSettings(s => ({ ...s, loyalty_redeem: parseFloat(e.target.value)||1 }))} style={inp} min={0.1} step={0.1} />
            <div style={{ fontSize:10, color:T.muted, marginTop:3 }}>e.g. 1 point = ₹1 discount</div>
          </div>
          <button onClick={saveSettings} disabled={saving} style={{ background:T.blue, color:'#fff', border:'none', borderRadius:8, padding:'11px 20px', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
        <div style={{ marginTop:14, background:T.card, borderRadius:8, padding:'10px 14px', fontSize:12, color:T.sub, lineHeight:1.7 }}>
          <strong style={{ color:T.ink }}>How it works:</strong> Customer earns <strong style={{ color:T.teal }}>{settings.loyalty_rate} point</strong> per ₹100 spent.
          Points can be redeemed at <strong style={{ color:T.amber }}>₹{settings.loyalty_redeem} per point</strong> on future purchases.
          Example: ₹1,000 purchase = {Math.floor(1000/100*settings.loyalty_rate)} points = ₹{Math.floor(1000/100*settings.loyalty_rate) * settings.loyalty_redeem} discount next time.
        </div>
      </div>

      {/* Stats */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12, marginBottom:20 }}>
        {[
          ['Total Points Outstanding', totalPoints.toLocaleString(), T.teal],
          ['Value of Points', fmt(totalPoints * settings.loyalty_redeem), T.amber],
          ['Customers with Points', customers.filter(c => (c.loyalty_pts||0) > 0).length, T.blue],
        ].map(([label, val, color]) => (
          <div key={label} style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:10, padding:'14px 18px' }}>
            <div style={{ fontSize:11, color:T.sub, fontWeight:700, textTransform:'uppercase', marginBottom:6 }}>{label}</div>
            <div style={{ fontSize:22, fontWeight:800, color }}>{val}</div>
          </div>
        ))}
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'3fr 2fr', gap:16 }}>
        {/* Customers list */}
        <div>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 Search customers…"
            style={{ ...inp, marginBottom:12 }} />
          <div style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:12, overflow:'hidden' }}>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
              <thead>
                <tr style={{ background:T.card }}>
                  {['Customer','Phone','Points','Value','Action'].map(h => (
                    <th key={h} style={{ padding:'9px 14px', textAlign:'left', fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', borderBottom:`1px solid ${T.bdr}` }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={5} style={{ padding:30, textAlign:'center', color:T.sub }}>Loading…</td></tr>
                ) : filtered.map(c => (
                  <tr key={c.id} style={{ borderBottom:`1px solid ${T.bdr}22` }}>
                    <td style={{ padding:'10px 14px', color:T.ink, fontWeight:600 }}>{c.name}</td>
                    <td style={{ padding:'10px 14px', color:T.sub }}>{c.phone||'—'}</td>
                    <td style={{ padding:'10px 14px', color:T.teal, fontWeight:800, fontSize:16 }}>{(c.loyalty_pts||0).toLocaleString()}</td>
                    <td style={{ padding:'10px 14px', color:T.amber }}>{fmt((c.loyalty_pts||0) * settings.loyalty_redeem)}</td>
                    <td style={{ padding:'10px 14px' }}>
                      <button onClick={() => setAdjustForm(c)} style={{ background:T.blue+'22', color:T.blue, border:'none', borderRadius:6, padding:'4px 10px', fontSize:11, cursor:'pointer', fontFamily:'inherit' }}>
                        Adjust
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Recent transactions */}
        <div style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:12, overflow:'hidden' }}>
          <div style={{ padding:'12px 16px', borderBottom:`1px solid ${T.bdr}`, fontWeight:700, color:T.ink }}>Recent Transactions</div>
          <div style={{ maxHeight:400, overflowY:'auto' }}>
            {txns.map(txn => (
              <div key={txn.id} style={{ display:'flex', justifyContent:'space-between', padding:'10px 14px', borderBottom:`1px solid ${T.bdr}22` }}>
                <div>
                  <div style={{ fontSize:13, color:T.ink }}>{txn.customer?.name || 'Unknown'}</div>
                  <div style={{ fontSize:10, color:T.muted }}>{txn.note || txn.txn_type}</div>
                </div>
                <div style={{ fontSize:14, fontWeight:700, color: txn.txn_type==='earn' ? T.green : T.red }}>
                  {txn.txn_type==='earn' ? '+' : '-'}{txn.points} pts
                </div>
              </div>
            ))}
            {!txns.length && <div style={{ padding:30, textAlign:'center', color:T.muted, fontSize:12 }}>No transactions yet</div>}
          </div>
        </div>
      </div>

      {/* Adjust modal */}
      {adjustForm && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.75)', zIndex:200, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
          <div style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:14, padding:24, width:'100%', maxWidth:380 }}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:16 }}>
              <div style={{ fontSize:16, fontWeight:700, color:T.ink }}>Adjust Points — {adjustForm.name}</div>
              <button onClick={() => setAdjustForm(null)} style={{ background:'none', border:'none', color:T.muted, cursor:'pointer', fontSize:22 }}>×</button>
            </div>
            <div style={{ fontSize:13, color:T.sub, marginBottom:16 }}>Current: <strong style={{ color:T.teal }}>{adjustForm.loyalty_pts||0} points</strong></div>
            {[['earn','Add Points',T.green],['redeem','Redeem Points',T.amber],['adjust','Manual Adjust',T.blue]].map(([type,label,color]) => {
              const [pts, setPts] = useState(0);
              const [note, setNote] = useState('');
              return (
                <div key={type} style={{ background:T.card, borderRadius:9, padding:14, marginBottom:10 }}>
                  <div style={{ fontSize:12, fontWeight:700, color, marginBottom:8 }}>{label}</div>
                  <div style={{ display:'flex', gap:8 }}>
                    <input type="number" placeholder="Points" value={pts} onChange={e => setPts(parseInt(e.target.value)||0)} style={{ ...inp, flex:1 }} />
                    <input placeholder="Note" value={note} onChange={e => setNote(e.target.value)} style={{ ...inp, flex:2 }} />
                    <button onClick={() => adjustPoints(adjustForm, pts, note, type)} disabled={saving||pts<=0} style={{ background:color, color:'#fff', border:'none', borderRadius:7, padding:'8px 12px', fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>OK</button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
