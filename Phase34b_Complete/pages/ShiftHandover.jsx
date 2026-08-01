import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

const T = {
  bg:'#F7F3F3', srf:'#FFFFFF', card:'#FFFFFF', bdr:'#E8DEDE',
  red:'#C0392B', darkRed:'#8B0000', lightRed:'#FEF2F2',
  green:'#16A34A', amber:'#D97706', blue:'#2563EB', purple:'#7C3AED',
  ink:'#111827', sub:'#6B7280', muted:'#9CA3AF', white:'#FFFFFF'
};
const fmt = n => 'Rs.' + Math.abs(n||0).toLocaleString('en-IN', { maximumFractionDigits:0 });
const btn = (bg,color,extra={}) => ({ background:bg, color, border:'none', borderRadius:8, padding:'9px 16px', fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:'inherit', ...extra });
const inp = { background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:8, padding:'9px 12px', color:T.ink, fontSize:13, fontFamily:'inherit', outline:'none', width:'100%' };

const NOTES = [2000,500,200,100,50,20,10,5,2,1];
const STAFF = ['Gnanamani','Store Staff 1','Store Staff 2'];

export default function ShiftHandover({ tenant }) {
  const [handovers, setHandovers] = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [showForm,  setShowForm]  = useState(false);
  const [saving,    setSaving]    = useState(false);
  const [todayData, setTodayData] = useState(null);
  const [denoms,    setDenoms]    = useState({});
  const [form, setForm] = useState({ shift_type:'full', staff_out:'', staff_in:'', opening_cash:'0', cash_expenses:'0', pending_tasks:'', handover_notes:'', issues_reported:'' });

  useEffect(() => { if (tenant?.id) load(); }, [tenant?.id]);

  async function load() {
    setLoading(true);
    const today = new Date().toISOString().slice(0,10);
    const [hRes, sRes, eRes] = await Promise.all([
      supabase.from('shift_handovers').select('*').eq('tenant_id', tenant.id).order('shift_date', { ascending:false }).limit(30),
      supabase.from('sales').select('total,payment_mode').eq('tenant_id', tenant.id).eq('date', today),
      supabase.from('expenses').select('amount,payment_mode').eq('tenant_id', tenant.id).eq('date', today),
    ]);
    setHandovers(hRes.data||[]);

    const sales = sRes.data||[];
    const exps  = eRes.data||[];
    const byMode = { cash:0, card:0, upi:0 };
    sales.forEach(s=>{ const m=(s.payment_mode||'cash').toLowerCase(); if(m.includes('card'))byMode.card+=s.total||0; else if(m.includes('upi'))byMode.upi+=s.total||0; else byMode.cash+=s.total||0; });
    const cashExp = exps.filter(e=>!(e.payment_mode||'').toLowerCase().includes('card')).reduce((s,e)=>s+(e.amount||0),0);
    setTodayData({ ...byMode, cashExp, orders:sales.length });
    setLoading(false);
  }

  const countedCash = NOTES.reduce((s,n)=>s+(n*(denoms[n]||0)), 0);
  const expectedCash = (parseFloat(form.opening_cash)||0) + (todayData?.cash||0) - (parseFloat(form.cash_expenses)||0);
  const variance     = countedCash - expectedCash;

  async function closeShift(e) {
    e.preventDefault(); setSaving(true);
    await supabase.from('shift_handovers').insert({
      ...form, tenant_id:tenant.id,
      opening_cash:parseFloat(form.opening_cash)||0,
      cash_sales:todayData?.cash||0,
      card_sales:todayData?.card||0,
      upi_sales:todayData?.upi||0,
      cash_expenses:parseFloat(form.cash_expenses)||0,
      expected_cash:expectedCash, counted_cash:countedCash, variance,
      denominations:denoms, status:'closed', closed_at:new Date().toISOString(),
    });
    setShowForm(false); setDenoms({});
    setForm({ shift_type:'full', staff_out:'', staff_in:'', opening_cash:'0', cash_expenses:'0', pending_tasks:'', handover_notes:'', issues_reported:'' });
    setSaving(false); await load();
  }

  function shareHandover(h) {
    const msg = `🔄 *Shift Handover — ${tenant?.name||'7SQ'}*\n📅 ${h.shift_date} · ${h.shift_type} shift\n\n👤 Closed by: ${h.staff_out}\n👤 Handed to: ${h.staff_in||'—'}\n\n💰 *CASH RECONCILIATION*\nOpening: ${fmt(h.opening_cash)}\nCash Sales: ${fmt(h.cash_sales)}\nCash Expenses: -${fmt(h.cash_expenses)}\nExpected: *${fmt(h.expected_cash)}*\nCounted: *${fmt(h.counted_cash)}*\n${h.variance===0?'✅ Balanced':h.variance>0?`⚠️ Excess: ${fmt(h.variance)}`:`🚨 Short: ${fmt(h.variance)}`}\n\n💳 *OTHER SALES*\nCard: ${fmt(h.card_sales)}\nUPI: ${fmt(h.upi_sales)}\n\n${h.pending_tasks?`📋 *PENDING TASKS*\n${h.pending_tasks}\n\n`:''}${h.issues_reported?`⚠️ *ISSUES*\n${h.issues_reported}\n\n`:''}${h.handover_notes?`📝 *NOTES*\n${h.handover_notes}`:''}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
  }

  const totalVariance = handovers.reduce((s,h)=>s+Math.abs(h.variance||0),0);
  const shortShifts   = handovers.filter(h=>(h.variance||0)<0).length;

  return (
    <div style={{ padding:24, background:T.bg, minHeight:'100%' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
        <div>
          <div style={{ fontSize:18, fontWeight:800, color:T.darkRed }}>🔄 Shift Handover</div>
          <div style={{ fontSize:12, color:T.sub, marginTop:2 }}>Close shift with cash count, denominations and handover notes</div>
        </div>
        <button onClick={()=>setShowForm(true)} style={btn(T.red, T.white)}>+ Close Shift</button>
      </div>

      {todayData&&<div style={{ background:T.white, border:`1px solid ${T.bdr}`, borderRadius:12, padding:'14px 18px', marginBottom:18 }}>
        <div style={{ fontSize:11, fontWeight:700, color:T.darkRed, textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:10 }}>Today's Live Figures</div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:14 }}>
          {[['Orders',todayData.orders,T.blue],['Cash Sales',fmt(todayData.cash),T.green],['Card Sales',fmt(todayData.card),T.purple],['UPI Sales',fmt(todayData.upi),T.blue],['Cash Expenses',fmt(todayData.cashExp),T.red]].map(([label,val,color])=>(
            <div key={label}>
              <div style={{ fontSize:9, color:T.muted, fontWeight:700, textTransform:'uppercase', marginBottom:3 }}>{label}</div>
              <div style={{ fontSize:17, fontWeight:900, color }}>{val}</div>
            </div>
          ))}
        </div>
      </div>}

      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:14, marginBottom:18 }}>
        {[['Shifts Logged',handovers.length,T.blue,'📋'],['Balanced',handovers.filter(h=>h.variance===0).length,T.green,'✅'],['Short Shifts',shortShifts,T.red,'🚨'],['Total Variance',fmt(totalVariance),T.amber,'⚖️']].map(([label,val,color,icon])=>(
          <div key={label} style={{ background:T.white, border:`1px solid ${T.bdr}`, borderRadius:12, padding:'16px 18px', boxShadow:'0 1px 4px rgba(0,0,0,.05)' }}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:6 }}>
              <div style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.05em' }}>{label}</div>
              <span style={{ fontSize:18 }}>{icon}</span>
            </div>
            <div style={{ fontSize:20, fontWeight:900, color, letterSpacing:'-0.02em' }}>{val}</div>
          </div>
        ))}
      </div>

      <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
        {loading?<div style={{ textAlign:'center', padding:60, color:T.muted }}>Loading…</div>
        :handovers.length===0?<div style={{ background:T.white, border:`1px solid ${T.bdr}`, borderRadius:12, padding:60, textAlign:'center' }}>
          <div style={{ fontSize:40, marginBottom:10 }}>🔄</div>
          <div style={{ color:T.muted, fontWeight:600 }}>No shift handovers recorded</div>
        </div>
        :handovers.map(h=>{
          const vColor = h.variance===0?T.green:h.variance>0?T.amber:T.red;
          const vBg    = h.variance===0?'#F0FDF4':h.variance>0?'#FFFBEB':'#FEF2F2';
          return (
            <div key={h.id} style={{ background:T.white, border:`1px solid ${h.variance!==0?vColor+'44':T.bdr}`, borderRadius:12, padding:'14px 18px', boxShadow:'0 1px 3px rgba(0,0,0,.04)' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:10 }}>
                <div>
                  <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:3 }}>
                    <span style={{ fontSize:13, fontWeight:700, color:T.ink }}>{h.shift_date}</span>
                    <span style={{ background:T.bg, color:T.sub, borderRadius:5, padding:'2px 8px', fontSize:10, textTransform:'capitalize' }}>{h.shift_type}</span>
                    <span style={{ background:vBg, color:vColor, border:`1px solid ${vColor}33`, borderRadius:5, padding:'2px 9px', fontSize:10, fontWeight:700 }}>
                      {h.variance===0?'✅ Balanced':h.variance>0?`⚠️ Excess ${fmt(h.variance)}`:`🚨 Short ${fmt(h.variance)}`}
                    </span>
                  </div>
                  <div style={{ fontSize:11, color:T.sub }}>Out: {h.staff_out}{h.staff_in?` → In: ${h.staff_in}`:''}</div>
                </div>
                <button onClick={()=>shareHandover(h)} style={{ background:'#DCFCE7', color:T.green, border:'none', borderRadius:7, padding:'5px 12px', fontSize:10, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>💬 Share</button>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(6,1fr)', gap:12, background:T.bg, borderRadius:9, padding:'10px 14px', fontSize:12 }}>
                {[['Opening',fmt(h.opening_cash)],['Cash Sales',fmt(h.cash_sales)],['Card',fmt(h.card_sales)],['UPI',fmt(h.upi_sales)],['Expected',fmt(h.expected_cash)],['Counted',fmt(h.counted_cash)]].map(([label,val])=>(
                  <div key={label}>
                    <div style={{ fontSize:9, color:T.muted, textTransform:'uppercase', fontWeight:700 }}>{label}</div>
                    <div style={{ color:T.ink, fontWeight:700, marginTop:2 }}>{val}</div>
                  </div>
                ))}
              </div>
              {(h.pending_tasks||h.issues_reported||h.handover_notes)&&<div style={{ marginTop:10, fontSize:11, display:'flex', flexDirection:'column', gap:4 }}>
                {h.pending_tasks&&<div style={{ color:T.blue }}>📋 <strong>Pending:</strong> {h.pending_tasks}</div>}
                {h.issues_reported&&<div style={{ color:T.red }}>⚠️ <strong>Issues:</strong> {h.issues_reported}</div>}
                {h.handover_notes&&<div style={{ color:T.sub }}>📝 {h.handover_notes}</div>}
              </div>}
            </div>
          );
        })}
      </div>

      {showForm&&(
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.5)', zIndex:200, display:'flex', alignItems:'flex-start', justifyContent:'center', padding:20, overflowY:'auto' }}>
          <div style={{ background:T.white, borderRadius:16, padding:28, width:'100%', maxWidth:620, margin:'20px 0', boxShadow:'0 20px 60px rgba(0,0,0,.2)' }}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:20 }}>
              <div style={{ fontSize:17, fontWeight:800, color:T.darkRed }}>Close Shift & Handover</div>
              <button onClick={()=>setShowForm(false)} style={{ background:'none', border:'none', fontSize:22, cursor:'pointer', color:T.muted }}>×</button>
            </div>
            <form onSubmit={closeShift}>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12, marginBottom:16 }}>
                <div><label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:4 }}>Shift</label>
                  <select value={form.shift_type} onChange={e=>setForm(f=>({...f,shift_type:e.target.value}))} style={{ ...inp, cursor:'pointer', textTransform:'capitalize' }}>
                    {['morning','evening','night','full'].map(s=><option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div><label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:4 }}>Closed By *</label>
                  <select value={form.staff_out} onChange={e=>setForm(f=>({...f,staff_out:e.target.value}))} required style={{ ...inp, cursor:'pointer' }}>
                    <option value="">Select…</option>{STAFF.map(s=><option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div><label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:4 }}>Handed To</label>
                  <select value={form.staff_in} onChange={e=>setForm(f=>({...f,staff_in:e.target.value}))} style={{ ...inp, cursor:'pointer' }}>
                    <option value="">—</option>{STAFF.map(s=><option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div><label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:4 }}>Opening Cash</label><input type="number" value={form.opening_cash} onChange={e=>setForm(f=>({...f,opening_cash:e.target.value}))} style={inp}/></div>
                <div><label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:4 }}>Cash Expenses</label><input type="number" value={form.cash_expenses} onChange={e=>setForm(f=>({...f,cash_expenses:e.target.value}))} style={inp}/></div>
                <div style={{ display:'flex', flexDirection:'column', justifyContent:'flex-end' }}>
                  <div style={{ background:T.lightRed, borderRadius:8, padding:'8px 12px', textAlign:'center' }}>
                    <div style={{ fontSize:9, color:T.sub, textTransform:'uppercase', fontWeight:700 }}>Expected Cash</div>
                    <div style={{ fontSize:15, fontWeight:900, color:T.red }}>{fmt(expectedCash)}</div>
                  </div>
                </div>
              </div>

              {/* Denomination counter */}
              <div style={{ background:T.bg, borderRadius:10, padding:'14px 16px', marginBottom:16 }}>
                <div style={{ fontSize:11, fontWeight:700, color:T.darkRed, textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:10 }}>💵 Cash Denomination Count</div>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:10 }}>
                  {NOTES.map(n=>(
                    <div key={n}>
                      <label style={{ fontSize:10, color:T.sub, fontWeight:700, display:'block', marginBottom:3 }}>Rs.{n}</label>
                      <input type="number" value={denoms[n]||''} onChange={e=>setDenoms(d=>({...d,[n]:parseInt(e.target.value)||0}))} placeholder="0"
                        style={{ ...inp, padding:'6px 8px', fontSize:12, textAlign:'center' }}/>
                      {denoms[n]>0&&<div style={{ fontSize:9, color:T.green, textAlign:'center', marginTop:2, fontWeight:700 }}>{fmt(n*denoms[n])}</div>}
                    </div>
                  ))}
                </div>
                <div style={{ display:'flex', justifyContent:'space-between', marginTop:14, paddingTop:12, borderTop:`1px solid ${T.bdr}` }}>
                  <div><div style={{ fontSize:10, color:T.muted, textTransform:'uppercase', fontWeight:700 }}>Counted Cash</div><div style={{ fontSize:20, fontWeight:900, color:T.ink }}>{fmt(countedCash)}</div></div>
                  <div style={{ textAlign:'right' }}>
                    <div style={{ fontSize:10, color:T.muted, textTransform:'uppercase', fontWeight:700 }}>Variance</div>
                    <div style={{ fontSize:20, fontWeight:900, color:variance===0?T.green:variance>0?T.amber:T.red }}>
                      {variance===0?'✅ Balanced':`${variance>0?'+':'-'}${fmt(variance)}`}
                    </div>
                  </div>
                </div>
              </div>

              <div style={{ display:'flex', flexDirection:'column', gap:12, marginBottom:16 }}>
                {[['Pending Tasks for Next Shift','pending_tasks'],['Issues to Report','issues_reported'],['Handover Notes','handover_notes']].map(([label,key])=>(
                  <div key={key}><label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:4 }}>{label}</label><textarea value={form[key]} onChange={e=>setForm(f=>({...f,[key]:e.target.value}))} rows={2} style={{ ...inp, resize:'vertical' }}/></div>
                ))}
              </div>
              <div style={{ display:'flex', gap:10 }}>
                <button type="button" onClick={()=>setShowForm(false)} style={{ flex:1, background:T.bg, color:T.sub, border:`1px solid ${T.bdr}`, borderRadius:9, padding:'12px', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>Cancel</button>
                <button type="submit" disabled={saving} style={{ flex:2, ...btn(T.red, T.white), padding:'12px', fontSize:13 }}>{saving?'Closing…':'🔄 Close Shift'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
