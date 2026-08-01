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

export default function WhatsAppDailyReport({ tenant }) {
  const [date,      setDate]      = useState(new Date().toISOString().slice(0,10));
  const [report,    setReport]    = useState(null);
  const [history,   setHistory]   = useState([]);
  const [loading,   setLoading]   = useState(false);
  const [sending,   setSending]   = useState(false);
  const [phone,     setPhone]     = useState('');
  const [showPhone, setShowPhone] = useState(false);
  const [extraNotes,setExtraNotes]= useState('');

  useEffect(() => { if (tenant?.id) { loadHistory(); loadReport(); } }, [tenant?.id, date]);

  async function loadHistory() {
    const { data } = await supabase.from('wa_daily_reports').select('*').eq('tenant_id', tenant.id).order('report_date', { ascending:false }).limit(10);
    setHistory(data||[]);
  }

  async function loadReport() {
    setLoading(true);
    const [salesRes, expRes, custRes, invRes] = await Promise.all([
      supabase.from('sales').select('total,items,customer,payment_mode,staff_name').eq('tenant_id', tenant.id).eq('date', date),
      supabase.from('expenses').select('amount,category').eq('tenant_id', tenant.id).eq('date', date),
      supabase.from('customers').select('id,created_at').eq('tenant_id', tenant.id).gte('created_at', date+'T00:00:00').lte('created_at', date+'T23:59:59'),
      supabase.from('inventory').select('id,name,stock,alert').eq('tenant_id', tenant.id).eq('active', true),
    ]);

    const sales    = salesRes.data  || [];
    const expenses = expRes.data    || [];
    const newCusts = custRes.data   || [];
    const inv      = invRes.data    || [];

    const revenue    = sales.reduce((s,x)=>s+(x.total||0), 0);
    const totalExp   = expenses.reduce((s,x)=>s+(x.amount||0), 0);
    const profit     = revenue - totalExp;
    const orders     = sales.length;
    const avgOrder   = orders>0 ? revenue/orders : 0;
    const lowStock   = inv.filter(i=>(i.stock||0)<=(i.alert||5));

    // Top products
    const prodMap = {};
    sales.forEach(s=>(s.items||[]).forEach(i=>{ const k=i.name||i.id; if(!prodMap[k])prodMap[k]={name:i.name,qty:0,rev:0}; prodMap[k].qty+=(i.qty||1); prodMap[k].rev+=(i.rate||0)*(i.qty||1); }));
    const topProducts = Object.values(prodMap).sort((a,b)=>b.rev-a.rev).slice(0,3);

    // Payment breakdown
    const payMap = {};
    sales.forEach(s=>{ const m=s.payment_mode||'cash'; payMap[m]=(payMap[m]||0)+(s.total||0); });

    setReport({ revenue, totalExp, profit, orders, avgOrder, newCusts:newCusts.length, lowStock, topProducts, payMap, expenses });
    setLoading(false);
  }

  function buildMessage(r) {
    const dayName = new Date(date).toLocaleDateString('en-IN', { weekday:'long' });
    const profitEmoji = r.profit>=0?'✅':'⚠️';
    const lines = [
      `📊 *Daily Business Report*`,
      `*${tenant?.name||'7SQ'}* — ${dayName}, ${date}`,
      ``,
      `💰 *REVENUE & PROFIT*`,
      `Revenue:  *${fmt(r.revenue)}*`,
      `Expenses: ${fmt(r.totalExp)}`,
      `${profitEmoji} Profit:   *${fmt(r.profit)}*`,
      ``,
      `🛍️ *SALES*`,
      `Orders:     ${r.orders}`,
      `Avg Order:  ${fmt(r.avgOrder)}`,
      `New Customers: ${r.newCusts}`,
      ``,
    ];
    if (r.topProducts.length>0) {
      lines.push(`🏆 *TOP PRODUCTS*`);
      r.topProducts.forEach((p,i)=>lines.push(`${i+1}. ${p.name} — ${p.qty} units · ${fmt(p.rev)}`));
      lines.push('');
    }
    if (Object.keys(r.payMap).length>0) {
      lines.push(`💳 *PAYMENT MODES*`);
      Object.entries(r.payMap).forEach(([mode,amt])=>lines.push(`${mode.toUpperCase()}: ${fmt(amt)}`));
      lines.push('');
    }
    if (r.lowStock.length>0) {
      lines.push(`⚠️ *LOW STOCK ALERT*`);
      r.lowStock.slice(0,3).forEach(i=>lines.push(`• ${i.name}: ${i.stock} units left`));
      if (r.lowStock.length>3) lines.push(`  ...and ${r.lowStock.length-3} more`);
      lines.push('');
    }
    if (extraNotes) { lines.push(`📝 *NOTES*`); lines.push(extraNotes); lines.push(''); }
    lines.push(`_Sent via 7SQ Business Platform_`);
    return lines.join('\n');
  }

  async function sendReport() {
    if (!report) return;
    const ph = (phone||'').replace(/\D/g,'').replace(/^0/,'91');
    if (!ph) { setShowPhone(true); return; }
    setSending(true);
    const msg = buildMessage(report);
    // Save to history
    await supabase.from('wa_daily_reports').upsert({
      tenant_id:tenant.id, report_date:date,
      revenue:report.revenue, orders:report.orders, expenses:report.totalExp, profit:report.profit,
      sent_to:phone, sent_at:new Date().toISOString(),
    }, { onConflict:'tenant_id,report_date' });
    window.open(`https://wa.me/${ph}?text=${encodeURIComponent(msg)}`, '_blank');
    setSending(false); await loadHistory();
  }

  const wasSent = history.find(h=>h.report_date===date&&h.sent_at);

  return (
    <div style={{ padding:24, background:T.bg, minHeight:'100%' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:24 }}>
        <div>
          <div style={{ fontSize:22, fontWeight:800, color:T.darkRed, letterSpacing:'-0.02em' }}>📱 WhatsApp Daily Report</div>
          <div style={{ fontSize:13, color:T.sub, marginTop:2 }}>One-tap daily business summary sent to your WhatsApp</div>
        </div>
        <div style={{ display:'flex', gap:8, alignItems:'center' }}>
          <input type="date" value={date} onChange={e=>setDate(e.target.value)}
            style={{ background:T.white, border:`1px solid ${T.bdr}`, borderRadius:8, padding:'8px 12px', color:T.ink, fontSize:13, fontFamily:'inherit', outline:'none' }}/>
        </div>
      </div>

      {wasSent&&<div style={{ background:'#F0FDF4', border:'1px solid #BBF7D0', borderRadius:10, padding:'10px 16px', marginBottom:16, fontSize:12, color:T.green, fontWeight:600 }}>
        ✅ Report for {date} was already sent to {wasSent.sent_to} at {wasSent.sent_at?.slice(11,16)}
      </div>}

      <div style={{ display:'grid', gridTemplateColumns:'1fr 360px', gap:20, alignItems:'flex-start' }}>
        {/* Report preview */}
        <div style={{ background:T.white, border:`1px solid ${T.bdr}`, borderRadius:14, overflow:'hidden', boxShadow:'0 1px 4px rgba(0,0,0,.05)' }}>
          <div style={{ background:T.lightRed, padding:'14px 18px', borderBottom:`1px solid ${T.bdr}`, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <div style={{ fontWeight:800, color:T.darkRed }}>Report Preview — {date}</div>
            {loading&&<div style={{ fontSize:11, color:T.sub }}>Loading data…</div>}
          </div>
          {report&&!loading?(
            <div style={{ padding:20 }}>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12, marginBottom:20 }}>
                {[['Revenue',fmt(report.revenue),T.blue],['Profit',fmt(report.profit),report.profit>=0?T.green:T.red],['Orders',report.orders,T.purple]].map(([label,val,color])=>(
                  <div key={label} style={{ background:T.bg, borderRadius:10, padding:'14px 16px', textAlign:'center' }}>
                    <div style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', marginBottom:6 }}>{label}</div>
                    <div style={{ fontSize:20, fontWeight:900, color }}>{val}</div>
                  </div>
                ))}
              </div>
              {report.topProducts.length>0&&<div style={{ marginBottom:16 }}>
                <div style={{ fontSize:11, fontWeight:700, color:T.darkRed, textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:8 }}>🏆 Top Products</div>
                {report.topProducts.map((p,i)=>(
                  <div key={i} style={{ display:'flex', justifyContent:'space-between', padding:'6px 0', borderBottom:`1px solid ${T.bdr}22`, fontSize:12 }}>
                    <span style={{ color:T.ink }}>{i+1}. {p.name}</span>
                    <span style={{ color:T.red, fontWeight:600 }}>{p.qty} units · {fmt(p.rev)}</span>
                  </div>
                ))}
              </div>}
              {Object.keys(report.payMap).length>0&&<div style={{ marginBottom:16 }}>
                <div style={{ fontSize:11, fontWeight:700, color:T.darkRed, textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:8 }}>💳 Payment Modes</div>
                <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                  {Object.entries(report.payMap).map(([mode,amt])=>(
                    <div key={mode} style={{ background:T.lightRed, borderRadius:8, padding:'6px 12px', fontSize:12 }}>
                      <span style={{ color:T.sub, textTransform:'capitalize' }}>{mode}:</span> <span style={{ color:T.red, fontWeight:700 }}>{fmt(amt)}</span>
                    </div>
                  ))}
                </div>
              </div>}
              {report.lowStock.length>0&&<div style={{ background:'#FFFBEB', border:'1px solid #FDE68A', borderRadius:10, padding:'10px 14px' }}>
                <div style={{ fontSize:11, fontWeight:700, color:T.amber, marginBottom:6 }}>⚠️ Low Stock ({report.lowStock.length} items)</div>
                {report.lowStock.slice(0,3).map(i=><div key={i.id} style={{ fontSize:12, color:T.sub }}>{i.name}: <strong>{i.stock}</strong> units</div>)}
              </div>}
              <div style={{ marginTop:16 }}>
                <label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:5 }}>Extra Notes (optional)</label>
                <textarea value={extraNotes} onChange={e=>setExtraNotes(e.target.value)} rows={2} placeholder="Add any notes for today's report…" style={{ ...inp, resize:'vertical' }}/>
              </div>
            </div>
          ):<div style={{ padding:60, textAlign:'center', color:T.muted }}>Loading report data…</div>}
        </div>

        {/* Send panel */}
        <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
          <div style={{ background:T.white, border:`1px solid ${T.bdr}`, borderRadius:14, padding:20, boxShadow:'0 1px 4px rgba(0,0,0,.05)' }}>
            <div style={{ fontSize:14, fontWeight:800, color:T.darkRed, marginBottom:14 }}>📤 Send Report</div>
            <div style={{ marginBottom:14 }}>
              <label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:5 }}>WhatsApp Number</label>
              <input value={phone} onChange={e=>setPhone(e.target.value)} placeholder="e.g. 9876543210" style={inp}/>
              <div style={{ fontSize:10, color:T.muted, marginTop:4 }}>Owner's mobile number (without country code)</div>
            </div>
            <button onClick={sendReport} disabled={sending||loading||!report} style={{ width:'100%', ...btn('#25D366', T.white, { padding:'13px', fontSize:14 }) }}>
              {sending?'Opening WhatsApp…':'💬 Send via WhatsApp'}
            </button>
            <div style={{ fontSize:11, color:T.muted, textAlign:'center', marginTop:8 }}>Opens WhatsApp with pre-filled message ready to send</div>
          </div>

          {/* History */}
          <div style={{ background:T.white, border:`1px solid ${T.bdr}`, borderRadius:14, padding:20, boxShadow:'0 1px 4px rgba(0,0,0,.05)' }}>
            <div style={{ fontSize:13, fontWeight:800, color:T.darkRed, marginBottom:12 }}>📋 Recent Reports</div>
            {history.length===0?<div style={{ textAlign:'center', color:T.muted, fontSize:12, padding:'20px 0' }}>No reports sent yet</div>
            :history.map(h=>(
              <div key={h.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'8px 0', borderBottom:`1px solid ${T.bdr}22` }}>
                <div>
                  <div style={{ fontSize:12, fontWeight:600, color:T.ink }}>{h.report_date}</div>
                  <div style={{ fontSize:10, color:T.sub }}>{h.sent_to} · {h.sent_at?.slice(11,16)}</div>
                </div>
                <div style={{ textAlign:'right' }}>
                  <div style={{ fontSize:12, fontWeight:700, color:T.green }}>{fmt(h.revenue)}</div>
                  <div style={{ fontSize:10, color:h.profit>=0?T.green:T.red }}>Profit: {fmt(h.profit)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
