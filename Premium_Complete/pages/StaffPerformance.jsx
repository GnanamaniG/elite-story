import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { getSales } from '../lib/supabase';

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
const fmt  = n => 'Rs.' + (n||0).toLocaleString('en-IN', { maximumFractionDigits:0 });
const MEDALS = ['🥇','🥈','🥉'];

export default function StaffPerformance({ tenant }) {
  const [targets,  setTargets]  = useState([]);
  const [sales,    setSales]    = useState([]);
  const [period,   setPeriod]   = useState(new Date().toISOString().slice(0,7));
  const [loading,  setLoading]  = useState(true);
  const [editing,  setEditing]  = useState(false);
  const [staffList,setStaffList]= useState(['Gnanamani','Store Staff 1','Store Staff 2']);
  const [editForm, setEditForm] = useState({});
  const [saving,   setSaving]   = useState(false);

  useEffect(() => { if (tenant?.id) load(); }, [tenant?.id, period]);

  async function load() {
    setLoading(true);
    const [targetsRes, salesData] = await Promise.all([
      supabase.from('staff_targets').select('*').eq('tenant_id', tenant.id).eq('period', period),
      getSales(tenant.id, 1000),
    ]);
    setTargets(targetsRes.data||[]);
    setSales(salesData.filter(s=>(s.date||'').startsWith(period)));

    const initForm = {};
    const tData    = targetsRes.data||[];
    staffList.forEach(name => {
      const t = tData.find(x=>x.staff_name===name);
      initForm[name] = { target_rev:t?.target_rev||0, target_orders:t?.target_orders||0, commission_rate:t?.commission_rate||0 };
    });
    setEditForm(initForm);
    setLoading(false);
  }

  async function saveTargets() {
    setSaving(true);
    for (const [name, vals] of Object.entries(editForm)) {
      await supabase.from('staff_targets').upsert({
        tenant_id:tenant.id, staff_name:name, period,
        target_rev:parseFloat(vals.target_rev)||0,
        target_orders:parseInt(vals.target_orders)||0,
        commission_rate:parseFloat(vals.commission_rate)||0,
      }, { onConflict:'tenant_id,user_id,period' });
    }
    setEditing(false); setSaving(false); await load();
  }

  // Build performance per staff
  const staffPerf = staffList.map((name, idx) => {
    const target  = targets.find(t=>t.staff_name===name);
    const staffSales = sales.filter(s=>s.staff_name===name);
    const revenue = staffSales.reduce((s,x)=>s+(x.total||0),0);
    const orders  = staffSales.length;
    const commission = target ? revenue * (target.commission_rate||0)/100 : 0;
    const revPct  = target?.target_rev>0 ? Math.min(100,revenue/target.target_rev*100) : 0;
    const ordPct  = target?.target_orders>0 ? Math.min(100,orders/target.target_orders*100) : 0;
    return { name, revenue, orders, commission, target, revPct, ordPct };
  }).sort((a,b)=>b.revenue-a.revenue);

  const totalRevenue    = staffPerf.reduce((s,x)=>s+x.revenue,0);
  const totalCommission = staffPerf.reduce((s,x)=>s+x.commission,0);

  return (
    <div style={{ padding:20 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
        <div>
          <div style={{ fontSize:22, fontWeight:800, color:T.ink }}>🏆 Staff Performance</div>
          <div style={{ fontSize:13, color:T.sub }}>{period} · {staffList.length} staff members</div>
        </div>
        <div style={{ display:'flex', gap:8, alignItems:'center' }}>
          <input type="month" value={period} onChange={e=>setPeriod(e.target.value)} style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:8, padding:'8px 12px', color:T.ink, fontSize:13, fontFamily:'inherit', outline:'none' }}/>
          <button onClick={()=>setEditing(true)} style={{ background:T.blue, color:'#fff', border:'none', borderRadius:8, padding:'9px 16px', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>🎯 Set Targets</button>
        </div>
      </div>

      {/* Summary */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12, marginBottom:20 }}>
        {[['Total Revenue',fmt(totalRevenue),T.blue],['Total Orders',sales.length,T.purple],['Total Commission',fmt(totalCommission),T.amber],['Avg per Staff',staffList.length>0?fmt(totalRevenue/staffList.length):0,T.green]].map(([label,val,color])=>(
          <div key={label} style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:10, padding:'14px 18px' }}>
            <div style={{ fontSize:11, color:T.sub, fontWeight:700, textTransform:'uppercase', marginBottom:6 }}>{label}</div>
            <div style={{ fontSize:20, fontWeight:800, color }}>{val}</div>
          </div>
        ))}
      </div>

      {/* Leaderboard */}
      <div style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:12, overflow:'hidden', marginBottom:16 }}>
        <div style={{ padding:'12px 18px', borderBottom:`1px solid ${T.bdr}`, fontWeight:700, color:T.ink, display:'flex', justifyContent:'space-between' }}>
          <span>🏆 Leaderboard</span>
          <span style={{ fontSize:11, color:T.muted }}>{period}</span>
        </div>
        {loading?<div style={{ padding:40, textAlign:'center', color:T.sub }}>Loading…</div>
        :staffPerf.map((staff, idx)=>(
          <div key={staff.name} style={{ padding:'16px 20px', borderBottom:`1px solid ${T.bdr}22`, background:idx===0?T.amber+'0a':'transparent' }}>
            <div style={{ display:'flex', alignItems:'center', gap:14, marginBottom:10 }}>
              <div style={{ fontSize:24 }}>{MEDALS[idx]||`#${idx+1}`}</div>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:15, fontWeight:700, color:T.ink }}>{staff.name}</div>
                <div style={{ fontSize:11, color:T.muted }}>{staff.orders} orders</div>
              </div>
              <div style={{ textAlign:'right' }}>
                <div style={{ fontSize:20, fontWeight:800, color:T.green }}>{fmt(staff.revenue)}</div>
                {staff.commission>0&&<div style={{ fontSize:11, color:T.amber }}>Commission: {fmt(staff.commission)}</div>}
              </div>
            </div>
            {staff.target && (
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                <div>
                  <div style={{ display:'flex', justifyContent:'space-between', fontSize:10, color:T.muted, marginBottom:3 }}>
                    <span>Revenue Target</span>
                    <span>{Math.round(staff.revPct)}%</span>
                  </div>
                  <div style={{ height:6, background:T.bdr, borderRadius:3, overflow:'hidden' }}>
                    <div style={{ height:'100%', width:`${staff.revPct}%`, background:staff.revPct>=100?T.green:staff.revPct>=75?T.amber:T.red, borderRadius:3, transition:'width .4s' }}/>
                  </div>
                  <div style={{ fontSize:10, color:T.muted, marginTop:2 }}>{fmt(staff.revenue)} / {fmt(staff.target.target_rev)}</div>
                </div>
                <div>
                  <div style={{ display:'flex', justifyContent:'space-between', fontSize:10, color:T.muted, marginBottom:3 }}>
                    <span>Orders Target</span>
                    <span>{Math.round(staff.ordPct)}%</span>
                  </div>
                  <div style={{ height:6, background:T.bdr, borderRadius:3, overflow:'hidden' }}>
                    <div style={{ height:'100%', width:`${staff.ordPct}%`, background:staff.ordPct>=100?T.green:staff.ordPct>=75?T.amber:T.red, borderRadius:3, transition:'width .4s' }}/>
                  </div>
                  <div style={{ fontSize:10, color:T.muted, marginTop:2 }}>{staff.orders} / {staff.target.target_orders} orders</div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* No targets notice */}
      {!loading&&!targets.length&&(
        <div style={{ background:T.amber+'12', border:`1px solid ${T.amber}44`, borderRadius:10, padding:'12px 18px', fontSize:13, color:T.amber }}>
          ⚡ No targets set for {period}. Click "Set Targets" to add monthly revenue goals and commission rates for each staff member.
        </div>
      )}

      {/* Set targets modal */}
      {editing && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.8)', zIndex:200, display:'flex', alignItems:'center', justifyContent:'center', padding:20, overflowY:'auto' }}>
          <div style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:14, padding:24, width:'100%', maxWidth:560, margin:'20px 0' }}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:18 }}>
              <div style={{ fontSize:17, fontWeight:700, color:T.ink }}>Set Targets — {period}</div>
              <button onClick={()=>setEditing(false)} style={{ background:'none', border:'none', color:T.muted, cursor:'pointer', fontSize:22 }}>×</button>
            </div>
            {staffList.map(name=>(
              <div key={name} style={{ background:T.card, borderRadius:10, padding:'14px 16px', marginBottom:12 }}>
                <div style={{ fontWeight:700, color:T.ink, marginBottom:10 }}>{name}</div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:10 }}>
                  {[['Revenue Target','target_rev'],['Order Target','target_orders'],['Commission %','commission_rate']].map(([label,key])=>(
                    <div key={key}>
                      <label style={{ fontSize:9, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:4 }}>{label}</label>
                      <input type="number" min={0} value={editForm[name]?.[key]||''} placeholder="0" onChange={e=>setEditForm(f=>({...f,[name]:{...f[name],[key]:e.target.value}}))}
                        style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:7, padding:'7px 10px', color:T.ink, fontSize:13, fontFamily:'inherit', outline:'none', width:'100%' }}/>
                    </div>
                  ))}
                </div>
              </div>
            ))}
            <div style={{ display:'flex', gap:10, marginTop:16 }}>
              <button onClick={()=>setEditing(false)} style={{ flex:1, background:T.card, color:T.sub, border:`1px solid ${T.bdr}`, borderRadius:8, padding:'11px', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>Cancel</button>
              <button onClick={saveTargets} disabled={saving} style={{ flex:2, background:T.blue, color:'#fff', border:'none', borderRadius:8, padding:'11px', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>{saving?'Saving…':'Save Targets'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
