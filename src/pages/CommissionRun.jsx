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

const STATUS = {
  draft:     { label:'Draft',     color:'#6B7280', bg:'#F9FAFB', bdr:'#E5E7EB' },
  approved:  { label:'Approved',  color:'#2563EB', bg:'#EFF6FF', bdr:'#BFDBFE' },
  paid:      { label:'Paid',      color:'#16A34A', bg:'#F0FDF4', bdr:'#BBF7D0' },
  cancelled: { label:'Cancelled', color:'#C0392B', bg:'#FEF2F2', bdr:'#FECACA' },
};

export default function CommissionRun({ tenant }) {
  const [runs,    setRuns]    = useState([]);
  const [loading, setLoading] = useState(true);
  const [period,  setPeriod]  = useState(new Date().toISOString().slice(0,7));
  const [calcing, setCalcing] = useState(false);
  const [baseRate, setBaseRate] = useState('2');
  const [bonusRate,setBonusRate]= useState('1');
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => { if (tenant?.id) load(); }, [tenant?.id, period]);

  async function load() {
    setLoading(true);
    const { data } = await supabase.from('commission_runs').select('*').eq('tenant_id', tenant.id).eq('period', period).order('sales_total', { ascending:false });
    setRuns(data||[]);
    setLoading(false);
  }

  async function calculate() {
    setCalcing(true);
    const monthStart = period+'-01';
    const monthEnd   = new Date(parseInt(period.split('-')[0]), parseInt(period.split('-')[1]), 0).toISOString().slice(0,10);

    const [salesRes, targetRes] = await Promise.all([
      supabase.from('sales').select('total,staff_name,date').eq('tenant_id', tenant.id).gte('date', monthStart).lte('date', monthEnd),
      supabase.from('sales_targets').select('staff_name,target_sales,incentive_rate').eq('tenant_id', tenant.id).eq('period', period),
    ]);

    const sales   = salesRes.data  || [];
    const targets = targetRes.data || [];

    // Aggregate by staff
    const byStaff = {};
    sales.forEach(s=>{
      const name = s.staff_name || 'Unassigned';
      if (!byStaff[name]) byStaff[name] = { total:0, count:0 };
      byStaff[name].total += s.total || 0;
      byStaff[name].count += 1;
    });

    const base  = parseFloat(baseRate)  || 0;
    const bonus = parseFloat(bonusRate) || 0;

    const rows = Object.entries(byStaff).map(([staff, d])=>{
      const tgt      = targets.find(t=>t.staff_name===staff);
      const target   = tgt?.target_sales || 0;
      const rate     = tgt?.incentive_rate || base;
      const metTarget= target>0 && d.total >= target;
      const baseComm = d.total * rate / 100;
      const bonusComm= metTarget ? (d.total * bonus / 100) : 0;
      return {
        tenant_id: tenant.id, run_no:`CR/${period}/${staff.slice(0,3).toUpperCase()}`,
        period, staff_name: staff,
        sales_total: d.total, orders_count: d.count,
        base_rate: rate, bonus_rate: metTarget?bonus:0,
        target_amount: target, target_met: metTarget,
        base_commission: parseFloat(baseComm.toFixed(2)),
        bonus_commission: parseFloat(bonusComm.toFixed(2)),
        deductions: 0,
        net_payable: parseFloat((baseComm+bonusComm).toFixed(2)),
        status: 'draft',
      };
    });

    await supabase.from('commission_runs').delete().eq('tenant_id', tenant.id).eq('period', period).eq('status','draft');
    if (rows.length>0) await supabase.from('commission_runs').insert(rows);
    setCalcing(false); await load();
    alert(`✅ Calculated commission for ${rows.length} staff members`);
  }

  async function updateStatus(id, status) {
    const upd = { status };
    if (status==='approved') upd.approved_by = 'Admin';
    if (status==='paid')     upd.paid_date   = new Date().toISOString().slice(0,10);
    await supabase.from('commission_runs').update(upd).eq('id', id);
    setRuns(prev=>prev.map(r=>r.id===id?{...r,...upd}:r));
  }

  async function setDeduction(run) {
    const d = prompt(`Deduction amount for ${run.staff_name} (Rs.):`, '0');
    if (d===null) return;
    const ded = parseFloat(d)||0;
    const net = (run.base_commission||0)+(run.bonus_commission||0)-ded;
    await supabase.from('commission_runs').update({ deductions:ded, net_payable:net }).eq('id', run.id);
    await load();
  }

  function printSlip(run) {
    const w = window.open('','_blank');
    w.document.write(`<!DOCTYPE html><html><head><style>
      body{font-family:Arial,sans-serif;font-size:12px;padding:30px;max-width:520px;margin:0 auto}
      h2{color:#8B0000;margin-bottom:2px}
      table{width:100%;border-collapse:collapse;margin-top:14px}
      td{padding:8px 12px;border-bottom:1px solid #eee}
      .right{text-align:right}
      .total{font-weight:800;border-top:2px solid #8B0000;border-bottom:2px double #8B0000;background:#f9f5f5}
      .green{color:#16A34A}.red{color:#C0392B}
    </style></head><body>
    <h2>${tenant?.name||'7SQ'}</h2>
    <div style="color:#666;margin-bottom:14px">Commission Statement · ${run.period}</div>
    <table>
      <tr><td>Staff Name</td><td class="right"><strong>${run.staff_name}</strong></td></tr>
      <tr><td>Sales Achieved</td><td class="right">${fmt(run.sales_total)}</td></tr>
      <tr><td>Orders Handled</td><td class="right">${run.orders_count}</td></tr>
      <tr><td>Target</td><td class="right">${run.target_amount>0?fmt(run.target_amount):'—'} ${run.target_met?'<span class="green">✓ Met</span>':''}</td></tr>
      <tr><td>Base Commission (${run.base_rate}%)</td><td class="right green">${fmt(run.base_commission)}</td></tr>
      ${run.bonus_commission>0?`<tr><td>Target Bonus (${run.bonus_rate}%)</td><td class="right green">${fmt(run.bonus_commission)}</td></tr>`:''}
      ${run.deductions>0?`<tr><td>Deductions</td><td class="right red">(${fmt(run.deductions)})</td></tr>`:''}
      <tr class="total"><td>NET PAYABLE</td><td class="right">${fmt(run.net_payable)}</td></tr>
    </table>
    <div style="margin-top:40px;display:flex;justify-content:space-between">
      <div style="border-top:1px solid #333;padding-top:5px;width:150px;text-align:center;font-size:11px">Employee</div>
      <div style="border-top:1px solid #333;padding-top:5px;width:150px;text-align:center;font-size:11px">Authorised</div>
    </div>
    <script>window.onload=()=>{window.print();setTimeout(()=>window.close(),500)}<\/script>
    </body></html>`);
    w.document.close();
  }

  const totalSales = runs.reduce((s,r)=>s+(r.sales_total||0),0);
  const totalComm  = runs.reduce((s,r)=>s+(r.net_payable||0),0);
  const targetsMet = runs.filter(r=>r.target_met).length;
  const paid       = runs.filter(r=>r.status==='paid').reduce((s,r)=>s+(r.net_payable||0),0);

  return (
    <div style={{ padding:24, background:T.bg, minHeight:'100%' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
        <div>
          <div style={{ fontSize:18, fontWeight:800, color:T.darkRed }}>💵 Commission Run</div>
          <div style={{ fontSize:12, color:T.sub, marginTop:2 }}>Auto-calculate staff commission from actual sales and targets</div>
        </div>
        <div style={{ display:'flex', gap:8, alignItems:'center' }}>
          <input type="month" value={period} onChange={e=>setPeriod(e.target.value)} style={{ background:T.white, border:`1px solid ${T.bdr}`, borderRadius:8, padding:'8px 12px', color:T.ink, fontSize:12, fontFamily:'inherit', outline:'none' }}/>
          <button onClick={()=>setShowSettings(s=>!s)} style={btn(T.bg, T.sub, { border:`1px solid ${T.bdr}` })}>⚙️ Rates</button>
          <button onClick={calculate} disabled={calcing} style={btn(T.red, T.white)}>{calcing?'Calculating…':'⚡ Run Calculation'}</button>
        </div>
      </div>

      {showSettings&&<div style={{ background:T.white, border:`1px solid ${T.bdr}`, borderRadius:12, padding:'14px 18px', marginBottom:16, display:'flex', gap:20, alignItems:'flex-end' }}>
        <div style={{ flex:1 }}><label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:4 }}>Default Base Rate (%)</label><input type="number" value={baseRate} onChange={e=>setBaseRate(e.target.value)} style={inp}/><div style={{ fontSize:10, color:T.muted, marginTop:3 }}>Used when staff has no individual target rate</div></div>
        <div style={{ flex:1 }}><label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:4 }}>Target Bonus Rate (%)</label><input type="number" value={bonusRate} onChange={e=>setBonusRate(e.target.value)} style={inp}/><div style={{ fontSize:10, color:T.muted, marginTop:3 }}>Extra % when monthly target is met</div></div>
        <button onClick={()=>setShowSettings(false)} style={btn(T.lightRed, T.red, { border:`1px solid ${T.bdr}` })}>Done</button>
      </div>}

      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:14, marginBottom:18 }}>
        {[['Total Sales',fmt(totalSales),T.blue,'💰'],['Commission Due',fmt(totalComm),T.red,'💵'],['Targets Met',`${targetsMet}/${runs.length}`,T.green,'🎯'],['Already Paid',fmt(paid),T.purple,'✅']].map(([label,val,color,icon])=>(
          <div key={label} style={{ background:T.white, border:`1px solid ${T.bdr}`, borderRadius:12, padding:'16px 18px', boxShadow:'0 1px 4px rgba(0,0,0,.05)' }}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:6 }}>
              <div style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.05em' }}>{label}</div>
              <span style={{ fontSize:18 }}>{icon}</span>
            </div>
            <div style={{ fontSize:20, fontWeight:900, color, letterSpacing:'-0.02em' }}>{val}</div>
          </div>
        ))}
      </div>

      <div style={{ background:T.white, border:`1px solid ${T.bdr}`, borderRadius:14, overflow:'hidden', boxShadow:'0 1px 4px rgba(0,0,0,.05)' }}>
        <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
          <thead><tr style={{ background:T.lightRed }}>
            {['Staff','Sales','Orders','Target','Base %','Base Comm.','Bonus','Deductions','Net Payable','Status','Actions'].map(h=>(
              <th key={h} style={{ padding:'11px 12px', textAlign:['Sales','Orders','Target','Base %','Base Comm.','Bonus','Deductions','Net Payable'].includes(h)?'right':'left', fontSize:9, color:T.darkRed, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.04em', borderBottom:`1px solid ${T.bdr}`, whiteSpace:'nowrap' }}>{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {loading?<tr><td colSpan={11} style={{ textAlign:'center', padding:50, color:T.muted }}>Loading…</td></tr>
            :runs.length===0?<tr><td colSpan={11} style={{ textAlign:'center', padding:50 }}>
              <div style={{ fontSize:36, marginBottom:8 }}>💵</div>
              <div style={{ color:T.muted, fontWeight:600 }}>No commission calculated for {period}</div>
              <div style={{ color:T.muted, fontSize:11, marginTop:4 }}>Click "Run Calculation" to compute from actual sales</div>
            </td></tr>
            :runs.map(r=>{
              const s = STATUS[r.status]||STATUS.draft;
              return (
                <tr key={r.id} style={{ borderBottom:`1px solid ${T.bdr}22`, background:r.target_met?'#FAFDFA':'transparent' }}>
                  <td style={{ padding:'11px 12px', color:T.ink, fontWeight:700 }}>{r.staff_name}</td>
                  <td style={{ padding:'11px 12px', textAlign:'right', color:T.blue, fontWeight:600 }}>{fmt(r.sales_total)}</td>
                  <td style={{ padding:'11px 12px', textAlign:'right', color:T.sub }}>{r.orders_count}</td>
                  <td style={{ padding:'11px 12px', textAlign:'right', color:T.sub }}>
                    {r.target_amount>0?fmt(r.target_amount):'—'}
                    {r.target_met&&<span style={{ marginLeft:5, color:T.green, fontWeight:700 }}>✓</span>}
                  </td>
                  <td style={{ padding:'11px 12px', textAlign:'right', color:T.muted }}>{r.base_rate}%</td>
                  <td style={{ padding:'11px 12px', textAlign:'right', color:T.green, fontWeight:600 }}>{fmt(r.base_commission)}</td>
                  <td style={{ padding:'11px 12px', textAlign:'right', color:r.bonus_commission>0?T.purple:T.muted, fontWeight:r.bonus_commission>0?700:400 }}>{r.bonus_commission>0?fmt(r.bonus_commission):'—'}</td>
                  <td style={{ padding:'11px 12px', textAlign:'right', color:r.deductions>0?T.red:T.muted }}>{r.deductions>0?fmt(r.deductions):'—'}</td>
                  <td style={{ padding:'11px 12px', textAlign:'right', color:T.red, fontWeight:800, fontSize:14 }}>{fmt(r.net_payable)}</td>
                  <td style={{ padding:'11px 12px' }}><span style={{ background:s.bg, color:s.color, border:`1px solid ${s.bdr}`, borderRadius:5, padding:'2px 9px', fontSize:10, fontWeight:700 }}>{s.label}</span></td>
                  <td style={{ padding:'11px 12px' }}>
                    <div style={{ display:'flex', gap:5 }}>
                      {r.status==='draft'&&<>
                        <button onClick={()=>setDeduction(r)} style={{ background:T.bg, color:T.sub, border:`1px solid ${T.bdr}`, borderRadius:6, padding:'4px 8px', fontSize:9, cursor:'pointer', fontFamily:'inherit' }}>Deduct</button>
                        <button onClick={()=>updateStatus(r.id,'approved')} style={{ background:'#EFF6FF', color:T.blue, border:'none', borderRadius:6, padding:'4px 9px', fontSize:9, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>Approve</button>
                      </>}
                      {r.status==='approved'&&<button onClick={()=>updateStatus(r.id,'paid')} style={{ background:'#F0FDF4', color:T.green, border:'none', borderRadius:6, padding:'4px 9px', fontSize:9, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>Mark Paid</button>}
                      <button onClick={()=>printSlip(r)} style={{ background:T.lightRed, color:T.red, border:'none', borderRadius:6, padding:'4px 8px', fontSize:9, cursor:'pointer', fontFamily:'inherit' }}>🖨️</button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {runs.length>0&&<tr style={{ background:T.lightRed }}>
              <td style={{ padding:'11px 12px', fontWeight:800, color:T.darkRed }}>TOTAL</td>
              <td style={{ padding:'11px 12px', textAlign:'right', fontWeight:800, color:T.blue }}>{fmt(totalSales)}</td>
              <td colSpan={6}/>
              <td style={{ padding:'11px 12px', textAlign:'right', fontWeight:900, color:T.red, fontSize:15 }}>{fmt(totalComm)}</td>
              <td colSpan={2}/>
            </tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
