import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

const T = {
  bg:'#F7F3F3', srf:'#FFFFFF', card:'#FFFFFF', card2:'#FFF5F5',
  bdr:'#E8DEDE', bdr2:'#F0E8E8',
  red:'#C0392B', darkRed:'#8B0000', lightRed:'#FDECEA',
  green:'#16A34A', amber:'#D97706', blue:'#2563EB',
  purple:'#7C3AED', teal:'#0D9488', orange:'#EA580C',
  ink:'#111827', sub:'#6B7280', muted:'#9CA3AF',
  white:'#FFFFFF',
  sidebar:'#7B1E1E', sideHov:'#9B2C2C', sideTxt:'#FFCDD2', sideActTxt:'#7B1E1E'
};
const fmt = n => 'Rs.' + (n||0).toLocaleString('en-IN', { maximumFractionDigits:0 });

const STAFF = ['Gnanamani','Store Staff 1','Store Staff 2'];
const TIERS = [
  { min:0,      max:50000,  rate:2,  label:'Base',   color:'#6b7598' },
  { min:50000,  max:100000, rate:3,  label:'Silver',  color:'#c0c0c0' },
  { min:100000, max:200000, rate:4,  label:'Gold',    color:'#ffc107' },
  { min:200000, max:Infinity,rate:5, label:'Platinum',color:'#9b72ff' },
];

function getTier(sales) { return TIERS.find(t=>sales>=t.min&&sales<t.max)||TIERS[0]; }

export default function Commissions({ tenant }) {
  const [commissions, setCommissions] = useState([]);
  const [sales,       setSales]       = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [period,      setPeriod]      = useState(new Date().toISOString().slice(0,7));
  const [showCalc,    setShowCalc]    = useState(false);
  const [calcResult,  setCalcResult]  = useState([]);
  const [saving,      setSaving]      = useState(false);
  const [filter,      setFilter]      = useState('all');

  useEffect(() => { if (tenant?.id) load(); }, [tenant?.id, period]);

  async function load() {
    setLoading(true);
    const monthStart = period+'-01';
    const monthEnd   = new Date(parseInt(period.split('-')[0]), parseInt(period.split('-')[1]), 0).toISOString().slice(0,10);
    const [commRes, salesRes] = await Promise.all([
      supabase.from('commissions').select('*').eq('tenant_id', tenant.id).eq('period', period).order('created_at', { ascending:false }),
      supabase.from('sales').select('total,staff_name,date').eq('tenant_id', tenant.id).gte('date', monthStart).lte('date', monthEnd),
    ]);
    setCommissions(commRes.data||[]);
    setSales(salesRes.data||[]);
    setLoading(false);
  }

  function calculateCommissions() {
    const result = STAFF.map(name=>{
      const staffSales = sales.filter(s=>s.staff_name===name).reduce((t,s)=>t+(s.total||0),0);
      const tier = getTier(staffSales);
      const commAmt = staffSales * tier.rate / 100;
      return { staff_name:name, total_sales:staffSales, commission_rate:tier.rate, commission_amt:Math.round(commAmt), bonus:0, deductions:0, net_commission:Math.round(commAmt), tier };
    });
    setCalcResult(result);
    setShowCalc(true);
  }

  async function saveCommissions() {
    setSaving(true);
    try {
      // Delete existing for this period
      await supabase.from('commissions').delete().eq('tenant_id', tenant.id).eq('period', period);
      // Insert new
      await supabase.from('commissions').insert(calcResult.map(r=>({ tenant_id:tenant.id, period, staff_name:r.staff_name, total_sales:r.total_sales, commission_rate:r.commission_rate, commission_amt:r.commission_amt, bonus:r.bonus||0, deductions:r.deductions||0, net_commission:r.net_commission })));
      setShowCalc(false); await load();
    } catch(e) { alert('Error: '+e.message); }
    finally { setSaving(false); }
  }

  async function updateStatus(id, status) {
    const paid_date = status==='paid'?new Date().toISOString().slice(0,10):null;
    await supabase.from('commissions').update({ status, ...(paid_date?{paid_date}:{}) }).eq('id', id);
    setCommissions(prev=>prev.map(c=>c.id===id?{...c,status,paid_date}:c));
  }

  function updateCalcBonus(idx, field, val) {
    setCalcResult(prev=>prev.map((r,i)=>{
      if (i!==idx) return r;
      const updated = { ...r, [field]:parseFloat(val)||0 };
      updated.net_commission = updated.commission_amt + updated.bonus - updated.deductions;
      return updated;
    }));
  }

  const displayed = filter==='all'?commissions:commissions.filter(c=>c.status===filter);
  const totalComm = commissions.reduce((s,c)=>s+(c.net_commission||0),0);
  const totalSales= sales.reduce((s,x)=>s+(x.total||0),0);

  return (
    <div style={{ padding:20 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
        <div>
          <div style={{ fontSize:22, fontWeight:800, color:T.ink }}>🏆 Commissions</div>
          <div style={{ fontSize:13, color:T.sub }}>Staff sales commissions · Tier-based structure</div>
        </div>
        <div style={{ display:'flex', gap:8, alignItems:'center' }}>
          <input type="month" value={period} onChange={e=>setPeriod(e.target.value)} style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:8, padding:'8px 12px', color:T.ink, fontSize:13, fontFamily:'inherit', outline:'none' }}/>
          <button onClick={calculateCommissions} style={{ background:T.blue, color:'#fff', border:'none', borderRadius:9, padding:'10px 18px', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>⚡ Calculate</button>
        </div>
      </div>

      {/* Commission tiers */}
      <div style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:12, padding:16, marginBottom:18 }}>
        <div style={{ fontWeight:700, color:T.ink, marginBottom:10 }}>Commission Tiers</div>
        <div style={{ display:'flex', gap:10 }}>
          {TIERS.map(tier=>(
            <div key={tier.label} style={{ flex:1, background:T.card, borderRadius:8, padding:'10px 12px', borderTop:`3px solid ${tier.color}` }}>
              <div style={{ fontSize:11, fontWeight:700, color:tier.color }}>{tier.label}</div>
              <div style={{ fontSize:18, fontWeight:800, color:T.ink }}>{tier.rate}%</div>
              <div style={{ fontSize:10, color:T.muted }}>Sales {tier.max===Infinity?'above '+fmt(tier.min):fmt(tier.min)+' – '+fmt(tier.max)}</div>
            </div>
          ))}
        </div>
      </div>

      {/* This month summary */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12, marginBottom:18 }}>
        {[['Month Sales',fmt(totalSales),T.blue],['Total Commission',fmt(totalComm),T.green],['Pending',fmt(commissions.filter(c=>c.status==='pending').reduce((s,c)=>s+(c.net_commission||0),0)),T.amber],['Paid',fmt(commissions.filter(c=>c.status==='paid').reduce((s,c)=>s+(c.net_commission||0),0)),T.teal]].map(([label,val,color])=>(
          <div key={label} style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:10, padding:'12px 16px' }}>
            <div style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', marginBottom:5 }}>{label}</div>
            <div style={{ fontSize:18, fontWeight:800, color }}>{val}</div>
          </div>
        ))}
      </div>

      {/* Staff performance this month */}
      <div style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:12, padding:18, marginBottom:16 }}>
        <div style={{ fontWeight:700, color:T.ink, marginBottom:12 }}>📊 {period} — Sales vs Commissions</div>
        {STAFF.map(name=>{
          const staffSales = sales.filter(s=>s.staff_name===name).reduce((t,s)=>t+(s.total||0),0);
          const tier = getTier(staffSales);
          const comm = commissions.find(c=>c.staff_name===name);
          return (
            <div key={name} style={{ display:'flex', alignItems:'center', gap:14, padding:'10px 0', borderBottom:`1px solid ${T.bdr}22` }}>
              <div style={{ width:120, fontSize:13, color:T.ink, fontWeight:600 }}>{name}</div>
              <div style={{ flex:1 }}>
                <div style={{ display:'flex', justifyContent:'space-between', fontSize:11, marginBottom:3 }}>
                  <span style={{ color:tier.color, fontWeight:700 }}>{tier.label} Tier ({tier.rate}%)</span>
                  <span style={{ color:T.blue }}>{fmt(staffSales)}</span>
                </div>
                <div style={{ height:6, background:T.bdr, borderRadius:3, overflow:'hidden' }}>
                  <div style={{ height:'100%', width:`${Math.min(100,staffSales/200000*100)}%`, background:tier.color, borderRadius:3, transition:'width .5s' }}/>
                </div>
              </div>
              <div style={{ textAlign:'right', minWidth:90 }}>
                <div style={{ fontSize:14, fontWeight:800, color:T.green }}>{fmt(staffSales*tier.rate/100)}</div>
                <div style={{ fontSize:10, color:T.muted }}>est. commission</div>
              </div>
              <span style={{ background:comm?T.green+'22':T.muted+'22', color:comm?T.green:T.muted, borderRadius:5, padding:'2px 8px', fontSize:10, fontWeight:700, textTransform:'capitalize' }}>{comm?comm.status:'Not Set'}</span>
            </div>
          );
        })}
      </div>

      {/* Saved commissions */}
      <div style={{ display:'flex', gap:8, marginBottom:14 }}>
        {['all','pending','approved','paid'].map(f=>(
          <button key={f} onClick={()=>setFilter(f)} style={{ background:filter===f?T.blue:T.srf, color:filter===f?'#fff':T.sub, border:`1px solid ${filter===f?T.blue:T.bdr}`, borderRadius:7, padding:'6px 12px', fontSize:12, cursor:'pointer', fontFamily:'inherit', textTransform:'capitalize' }}>
            {f} ({f==='all'?commissions.length:commissions.filter(c=>c.status===f).length})
          </button>
        ))}
      </div>

      <div style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:12, overflow:'hidden' }}>
        <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
          <thead><tr style={{ background:T.card }}>
            {['Staff','Period','Sales','Rate','Commission','Bonus','Deductions','Net','Status','Actions'].map(h=><th key={h} style={{ padding:'9px 12px', textAlign:'left', fontSize:9, color:T.sub, fontWeight:700, textTransform:'uppercase', borderBottom:`1px solid ${T.bdr}` }}>{h}</th>)}
          </tr></thead>
          <tbody>
            {loading?<tr><td colSpan={10} style={{ textAlign:'center', padding:40, color:T.sub }}>Loading…</td></tr>
            :displayed.length===0?<tr><td colSpan={10} style={{ textAlign:'center', padding:40, color:T.muted }}>Click "Calculate" to generate commissions for {period}</td></tr>
            :displayed.map(c=>(
              <tr key={c.id} style={{ borderBottom:`1px solid ${T.bdr}22` }}>
                <td style={{ padding:'10px 12px', color:T.ink, fontWeight:600 }}>{c.staff_name}</td>
                <td style={{ padding:'10px 12px', color:T.muted }}>{c.period}</td>
                <td style={{ padding:'10px 12px', color:T.blue }}>{fmt(c.total_sales)}</td>
                <td style={{ padding:'10px 12px', color:T.sub }}>{c.commission_rate}%</td>
                <td style={{ padding:'10px 12px', color:T.amber }}>{fmt(c.commission_amt)}</td>
                <td style={{ padding:'10px 12px', color:T.green }}>{fmt(c.bonus)}</td>
                <td style={{ padding:'10px 12px', color:T.red }}>{fmt(c.deductions)}</td>
                <td style={{ padding:'10px 12px', color:T.green, fontWeight:800, fontSize:15 }}>{fmt(c.net_commission)}</td>
                <td style={{ padding:'10px 12px' }}><span style={{ background:c.status==='paid'?T.green+'22':c.status==='approved'?T.blue+'22':T.amber+'22', color:c.status==='paid'?T.green:c.status==='approved'?T.blue:T.amber, borderRadius:5, padding:'2px 8px', fontSize:10, fontWeight:700, textTransform:'capitalize' }}>{c.status}</span></td>
                <td style={{ padding:'10px 12px' }}>
                  <div style={{ display:'flex', gap:5 }}>
                    {c.status==='pending'&&<button onClick={()=>updateStatus(c.id,'approved')} style={{ background:T.blue+'22', color:T.blue, border:'none', borderRadius:5, padding:'4px 8px', fontSize:10, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>Approve</button>}
                    {c.status==='approved'&&<button onClick={()=>updateStatus(c.id,'paid')} style={{ background:T.green+'22', color:T.green, border:'none', borderRadius:5, padding:'4px 8px', fontSize:10, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>Pay</button>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Calc result modal */}
      {showCalc&&(
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.85)', zIndex:200, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
          <div style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:14, padding:24, width:'100%', maxWidth:640 }}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:16 }}>
              <div style={{ fontSize:17, fontWeight:700, color:T.ink }}>Commission Calculation — {period}</div>
              <button onClick={()=>setShowCalc(false)} style={{ background:'none', border:'none', color:T.muted, cursor:'pointer', fontSize:22 }}>×</button>
            </div>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13, marginBottom:16 }}>
              <thead><tr style={{ background:T.card }}>
                {['Staff','Sales','Tier','Rate','Base Comm','Bonus','Deductions','Net'].map(h=><th key={h} style={{ padding:'8px 10px', textAlign:'left', fontSize:9, color:T.sub, fontWeight:700, textTransform:'uppercase', borderBottom:`1px solid ${T.bdr}` }}>{h}</th>)}
              </tr></thead>
              <tbody>
                {calcResult.map((r,i)=>(
                  <tr key={r.staff_name} style={{ borderBottom:`1px solid ${T.bdr}22` }}>
                    <td style={{ padding:'8px 10px', color:T.ink, fontWeight:600 }}>{r.staff_name}</td>
                    <td style={{ padding:'8px 10px', color:T.blue }}>{fmt(r.total_sales)}</td>
                    <td style={{ padding:'8px 10px' }}><span style={{ color:r.tier.color, fontWeight:700, fontSize:11 }}>{r.tier.label}</span></td>
                    <td style={{ padding:'8px 10px', color:T.sub }}>{r.commission_rate}%</td>
                    <td style={{ padding:'8px 10px', color:T.amber }}>{fmt(r.commission_amt)}</td>
                    <td style={{ padding:'6px 8px' }}><input type="number" value={r.bonus} onChange={e=>updateCalcBonus(i,'bonus',e.target.value)} style={{ width:70, background:T.card, border:`1px solid ${T.bdr}`, borderRadius:5, padding:'4px 6px', color:T.green, fontSize:12, fontFamily:'inherit', outline:'none', textAlign:'center' }}/></td>
                    <td style={{ padding:'6px 8px' }}><input type="number" value={r.deductions} onChange={e=>updateCalcBonus(i,'deductions',e.target.value)} style={{ width:70, background:T.card, border:`1px solid ${T.bdr}`, borderRadius:5, padding:'4px 6px', color:T.red, fontSize:12, fontFamily:'inherit', outline:'none', textAlign:'center' }}/></td>
                    <td style={{ padding:'8px 10px', color:T.green, fontWeight:800 }}>{fmt(r.net_commission)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div style={{ display:'flex', gap:10 }}>
              <button onClick={()=>setShowCalc(false)} style={{ flex:1, background:T.card, color:T.sub, border:`1px solid ${T.bdr}`, borderRadius:8, padding:'11px', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>Cancel</button>
              <button onClick={saveCommissions} disabled={saving} style={{ flex:2, background:T.green, color:'#fff', border:'none', borderRadius:8, padding:'11px', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>{saving?'Saving…':'💾 Save Commissions'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
