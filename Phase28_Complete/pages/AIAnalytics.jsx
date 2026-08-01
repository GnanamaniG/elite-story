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

const SUGGESTED = [
  'What were my top 5 selling products this month?',
  'Which customer segment spent the most?',
  'What is my average order value trend?',
  'Which expense category is highest this month?',
  'Show me sales by payment mode breakdown',
  'How many new customers did I get this month?',
  'What is my profit margin this month?',
  'Which day of the week has highest sales?',
];

export default function AIAnalytics({ tenant }) {
  const [messages, setMessages] = useState([]);
  const [input,    setInput]    = useState('');
  const [loading,  setLoading]  = useState(false);
  const [context,  setContext]  = useState(null);

  useEffect(() => { if (tenant?.id) loadContext(); }, [tenant?.id]);

  async function loadContext() {
    const now   = new Date();
    const mo    = String(now.getMonth()+1).padStart(2,'0');
    const yr    = now.getFullYear();
    const mStart= `${yr}-${mo}-01`;
    const today = now.toISOString().slice(0,10);

    const [salesRes, expRes, invRes, custRes] = await Promise.all([
      supabase.from('sales').select('total,items,payment_mode,customer,date,gst_amount').eq('tenant_id', tenant.id).gte('date', mStart).lte('date', today),
      supabase.from('expenses').select('amount,category,date').eq('tenant_id', tenant.id).gte('date', mStart),
      supabase.from('inventory').select('name,cat,stock,sp,cp,alert').eq('tenant_id', tenant.id).eq('active', true),
      supabase.from('customers').select('name,total_spent,segment,purchase_count,loyalty_points').eq('tenant_id', tenant.id),
    ]);

    const sales    = salesRes.data||[];
    const expenses = expRes.data||[];
    const inventory= invRes.data||[];
    const customers= custRes.data||[];

    // Build compact context
    const totalRev     = sales.reduce((s,x)=>s+(x.total||0),0);
    const totalOrders  = sales.length;
    const avgOrder     = totalOrders>0?totalRev/totalOrders:0;
    const totalExp     = expenses.reduce((s,e)=>s+(e.amount||0),0);
    const netProfit    = totalRev - totalExp;

    const payBreakdown = sales.reduce((acc,s)=>{ acc[s.payment_mode||'cash']=(acc[s.payment_mode||'cash']||0)+(s.total||0); return acc; },{});
    const expByCat     = expenses.reduce((acc,e)=>{ acc[e.category]=(acc[e.category]||0)+(e.amount||0); return acc; },{});
    const topProducts  = Object.entries(sales.reduce((acc,s)=>{(s.items||[]).forEach(i=>{ acc[i.name]=(acc[i.name]||0)+(i.amount||0); }); return acc;},{})).sort((a,b)=>b[1]-a[1]).slice(0,10);
    const lowStock     = inventory.filter(i=>(i.stock||0)<=(i.alert||10)).map(i=>i.name);
    const dayOfWeek    = sales.reduce((acc,s)=>{ const d=new Date(s.date).toLocaleDateString('en-IN',{weekday:'short'}); acc[d]=(acc[d]||0)+(s.total||0); return acc;},{});

    const ctx = {
      store: tenant?.name||'Elite Store',
      period: `${mStart} to ${today}`,
      revenue: totalRev, orders: totalOrders, avgOrder, expenses: totalExp, netProfit,
      paymentBreakdown: payBreakdown, expensesByCategory: expByCat,
      topProducts: topProducts.map(([name,rev])=>({ name, revenue:rev })),
      inventory: { total:inventory.length, lowStock, lowStockCount:lowStock.length },
      customers: { total:customers.length, vip:customers.filter(c=>c.segment==='vip').length, newThisMonth:customers.filter(c=>(c.purchase_count||0)<=1).length },
      salesByDay: dayOfWeek,
    };
    setContext(ctx);

    // Welcome message
    setMessages([{
      role:'assistant',
      content:`👋 Hi! I'm your **AI Business Analyst** for **${tenant?.name||'Elite Store'}**.\n\nI have access to your live business data for **${mStart} to ${today}**:\n\n📊 **${totalOrders} orders** · Rs.${totalRev.toLocaleString('en-IN',{maximumFractionDigits:0})} revenue\n💰 Net Profit: Rs.${netProfit.toLocaleString('en-IN',{maximumFractionDigits:0})}\n📦 ${inventory.length} products · ${lowStock.length} low stock\n👥 ${customers.length} customers\n\nAsk me anything about your business! Try the suggestions below.`
    }]);
  }

  async function sendMessage(question) {
    const q = question || input.trim();
    if (!q) return;
    setInput('');
    setMessages(prev=>[...prev, { role:'user', content:q }]);
    setLoading(true);

    try {
      const systemPrompt = `You are an AI business analyst for ${context?.store||'Elite Store'}, an Indian retail store.

You have access to the following LIVE business data for ${context?.period}:

FINANCIAL SUMMARY:
- Total Revenue: Rs.${(context?.revenue||0).toFixed(2)}
- Total Orders: ${context?.orders}
- Average Order Value: Rs.${(context?.avgOrder||0).toFixed(2)}
- Total Expenses: Rs.${(context?.expenses||0).toFixed(2)}
- Net Profit: Rs.${(context?.netProfit||0).toFixed(2)}

PAYMENT BREAKDOWN:
${JSON.stringify(context?.paymentBreakdown, null, 2)}

EXPENSES BY CATEGORY:
${JSON.stringify(context?.expensesByCategory, null, 2)}

TOP PRODUCTS (by revenue):
${JSON.stringify(context?.topProducts, null, 2)}

INVENTORY:
- Total Products: ${context?.inventory?.total}
- Low Stock Items: ${context?.inventory?.lowStockCount}
- Low Stock Products: ${(context?.inventory?.lowStock||[]).slice(0,10).join(', ')}

CUSTOMERS:
- Total: ${context?.customers?.total}
- VIP Customers: ${context?.customers?.vip}
- New Customers (1 purchase): ${context?.customers?.newThisMonth}

SALES BY DAY OF WEEK:
${JSON.stringify(context?.salesByDay, null, 2)}

Provide clear, concise business insights. Format numbers as Rs.X,XX,XXX (Indian format). Keep answers focused and actionable. Use bullet points for lists. Be friendly and business-focused.`;

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6',
          max_tokens: 1000,
          system: systemPrompt,
          messages: [
            ...messages.filter(m=>m.role!=='assistant'||messages.indexOf(m)>0).map(m=>({ role:m.role, content:m.content })),
            { role:'user', content:q }
          ]
        })
      });

      const data = await response.json();
      const reply = data.content?.[0]?.text || 'Sorry, I could not process that. Please try again.';
      setMessages(prev=>[...prev, { role:'assistant', content:reply }]);
    } catch(err) {
      setMessages(prev=>[...prev, { role:'assistant', content:'⚠️ Error connecting to AI. Please check your connection and try again.' }]);
    }
    setLoading(false);
  }

  function renderMessage(msg) {
    // Simple markdown rendering
    let html = msg.content
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/`(.*?)`/g, '<code style="background:#1e2540;padding:1px 5px;border-radius:3px;font-family:monospace">$1</code>')
      .replace(/\n/g, '<br/>');
    return html;
  }

  return (
    <div style={{ padding:20, display:'flex', flexDirection:'column', height:'calc(100vh - 60px)' }}>
      <div style={{ fontSize:22, fontWeight:800, color:T.ink, marginBottom:4 }}>🤖 AI Analytics</div>
      <div style={{ fontSize:13, color:T.sub, marginBottom:16 }}>Ask questions about your business data in plain English</div>

      {/* Chat messages */}
      <div style={{ flex:1, overflowY:'auto', background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:12, padding:16, marginBottom:14, display:'flex', flexDirection:'column', gap:12 }}>
        {messages.map((msg,i)=>(
          <div key={i} style={{ display:'flex', justifyContent:msg.role==='user'?'flex-end':'flex-start' }}>
            <div style={{ maxWidth:'85%', background:msg.role==='user'?T.blue:T.card, borderRadius:msg.role==='user'?'14px 14px 4px 14px':'14px 14px 14px 4px', padding:'10px 14px' }}>
              {msg.role==='assistant'&&<div style={{ fontSize:10, color:T.blue, fontWeight:700, marginBottom:5 }}>🤖 AI Analyst</div>}
              <div style={{ fontSize:13, color:T.ink, lineHeight:1.6 }} dangerouslySetInnerHTML={{ __html:renderMessage(msg) }}/>
            </div>
          </div>
        ))}
        {loading&&<div style={{ display:'flex', justifyContent:'flex-start' }}>
          <div style={{ background:T.card, borderRadius:'14px 14px 14px 4px', padding:'12px 16px' }}>
            <div style={{ display:'flex', gap:4 }}>
              {[0,1,2].map(i=><div key={i} style={{ width:8, height:8, borderRadius:'50%', background:T.blue, animation:`bounce 1.2s ${i*0.2}s infinite` }}/>)}
            </div>
          </div>
        </div>}
      </div>

      {/* Suggested questions */}
      {messages.length<=1&&<div style={{ marginBottom:10 }}>
        <div style={{ fontSize:11, color:T.muted, marginBottom:6 }}>💡 Suggested questions:</div>
        <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
          {SUGGESTED.slice(0,4).map(q=>(
            <button key={q} onClick={()=>sendMessage(q)} style={{ background:T.card, color:T.blue, border:`1px solid ${T.bdr}`, borderRadius:20, padding:'5px 12px', fontSize:11, cursor:'pointer', fontFamily:'inherit' }}>{q}</button>
          ))}
        </div>
      </div>}

      {/* Input */}
      <div style={{ display:'flex', gap:8 }}>
        <input value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key==='Enter'&&!e.shiftKey&&sendMessage()} placeholder="Ask anything about your business… (e.g. 'What's my best-selling category?')" disabled={loading||!context}
          style={{ flex:1, background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:10, padding:'12px 16px', color:T.ink, fontSize:13, fontFamily:'inherit', outline:'none' }}/>
        <button onClick={()=>sendMessage()} disabled={!input.trim()||loading||!context} style={{ background:T.blue, color:'#fff', border:'none', borderRadius:10, padding:'12px 18px', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit', minWidth:80 }}>
          {loading?'…':'Send ›'}
        </button>
      </div>
      <style>{`@keyframes bounce{0%,80%,100%{transform:translateY(0)}40%{transform:translateY(-6px)}}`}</style>
    </div>
  );
}
