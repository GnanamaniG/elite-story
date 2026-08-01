import { useState, useEffect, useRef } from 'react';
import { getSales, getInventory, getExpenses, getPurchases, getCustomers } from '../lib/supabase';

const T = {
  bg:'#060710', srf:'#0b0d1a', card:'#0f1220', card2:'#141828',
  bdr:'#1a1e32', bdr2:'#222740',
  blue:'#4f7cff', green:'#00d68f', red:'#ff4d6a', amber:'#ffb547',
  purple:'#9b72ff', teal:'#00c9b1', orange:'#ff7043', gold:'#ffc107',
  cyan:'#00d4ff', pink:'#f06292',
  muted:'#4a5175', dim:'#2a3050', card3:'#181d2e',
  ink:'#eef0f8', sub:'#8892b0'
};

const SUGGESTED = [
  "What is my total revenue this month?",
  "Which are my top 3 selling products?",
  "What is my gross profit margin?",
  "Which customers have outstanding payments?",
  "What items are low on stock?",
  "How are my expenses distributed this month?",
  "Give me a business health summary",
  "What should I restock urgently?",
];

function buildContext(data) {
  const { sales, inventory, expenses, purchases, customers } = data;
  const now      = new Date();
  const thisMonth = now.toISOString().slice(0,7);
  const mSales   = sales.filter(s => (s.date||'').startsWith(thisMonth));
  const revenue  = mSales.reduce((s,x)=>s+(x.total||0),0);
  const gst      = mSales.reduce((s,x)=>s+(x.gst_amount||0),0);
  const expTotal = expenses.filter(e=>(e.date||'').startsWith(thisMonth)).reduce((s,x)=>s+(x.amount||0),0);
  const lowStock = inventory.filter(i=>(i.stock||0)<=(i.alert||10));
  const overdue  = customers.filter(c=>(c.outstanding||0)>0);

  // Top items
  const itemSales = {};
  mSales.forEach(s => (s.items||[]).forEach(item => {
    itemSales[item.name] = (itemSales[item.name]||0) + (item.amount||0);
  }));
  const topItems = Object.entries(itemSales).sort((a,b)=>b[1]-a[1]).slice(0,5).map(([name,rev])=>`${name}: Rs.${Math.round(rev)}`);

  return `You are a business analytics assistant for ${data.tenant?.name || 'Elite Store'}, a retail business in Tamil Nadu, India.

BUSINESS DATA (Current Month: ${thisMonth}):
- Monthly Revenue: Rs.${Math.round(revenue)}
- GST Collected: Rs.${Math.round(gst)}
- Monthly Expenses: Rs.${Math.round(expTotal)}
- Gross Profit: Rs.${Math.round(revenue - expTotal)}
- Total Invoices: ${mSales.length}
- Average Order Value: Rs.${mSales.length > 0 ? Math.round(revenue/mSales.length) : 0}

INVENTORY:
- Total Items: ${inventory.length}
- Low Stock Items (${lowStock.length}): ${lowStock.slice(0,5).map(i=>`${i.name} (${i.stock} left)`).join(', ') || 'None'}

CUSTOMERS:
- Total: ${customers.length}
- With Outstanding: ${overdue.length}
- Total Outstanding: Rs.${Math.round(overdue.reduce((s,c)=>s+(c.outstanding||0),0))}

TOP SELLING ITEMS THIS MONTH:
${topItems.join('\n') || 'No sales yet'}

EXPENSES BREAKDOWN:
${Object.entries(expenses.filter(e=>(e.date||'').startsWith(thisMonth)).reduce((acc,e)=>{acc[e.category]=(acc[e.category]||0)+(e.amount||0);return acc;},{})).map(([cat,amt])=>`${cat}: Rs.${Math.round(amt)}`).join('\n') || 'No expenses recorded'}

Answer questions concisely in plain English. Use Indian number formatting (Rs., lakhs, crores). Be specific with numbers. Provide actionable advice.`;
}

export default function AIAssistant({ tenant }) {
  const [messages,  setMessages]  = useState([]);
  const [input,     setInput]     = useState('');
  const [loading,   setLoading]   = useState(false);
  const [dataLoaded,setDataLoaded]= useState(false);
  const [bizData,   setBizData]   = useState(null);
  const bottomRef = useRef(null);

  useEffect(() => {
    if (tenant?.id) loadBizData();
  }, [tenant?.id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior:'smooth' });
  }, [messages]);

  async function loadBizData() {
    const [sales, inventory, expenses, purchases, customers] = await Promise.all([
      getSales(tenant.id, 500),
      getInventory(tenant.id),
      getExpenses(tenant.id),
      getPurchases(tenant.id),
      getCustomers(tenant.id),
    ]);
    setBizData({ sales, inventory, expenses, purchases, customers, tenant });
    setDataLoaded(true);

    // Welcome message
    setMessages([{
      role: 'assistant',
      content: `👋 Hello! I'm your Elite Store AI Assistant.\n\nI have access to your live business data — sales, inventory, expenses, customers, and more. Ask me anything about your business!\n\n**Try asking:**\n${SUGGESTED.slice(0,4).map(s => `• ${s}`).join('\n')}`,
    }]);
  }

  async function sendMessage(text) {
    const userMsg = text || input.trim();
    if (!userMsg || loading || !bizData) return;
    setInput('');
    setMessages(m => [...m, { role:'user', content:userMsg }]);
    setLoading(true);

    try {
      const context = buildContext(bizData);
      const history = messages.slice(-6).map(m => ({ role:m.role, content:m.content }));

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6',
          max_tokens: 1000,
          system: context,
          messages: [...history, { role:'user', content:userMsg }],
        }),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error?.message || 'API error');
      }

      const data   = await response.json();
      const answer = data.content?.[0]?.text || 'Sorry, no response.';
      setMessages(m => [...m, { role:'assistant', content:answer }]);
    } catch (e) {
      setMessages(m => [...m, {
        role:'assistant',
        content:`⚠️ **API Error:** ${e.message}\n\nThe AI Assistant requires a Claude API key. To enable it:\n1. Go to console.anthropic.com\n2. Create an API key\n3. Add it to Vercel as \`VITE_ANTHROPIC_API_KEY\`\n\nNote: For production, API calls should go through your backend (Supabase Edge Function) to protect your key.`,
      }]);
    } finally {
      setLoading(false);
    }
  }

  function renderMessage(content) {
    // Simple markdown: **bold**, bullet points, newlines
    return content
      .split('\n')
      .map((line, i) => {
        const bold = line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        return `<div style="margin-bottom:${line === '' ? '8px' : '3px'}">${bold}</div>`;
      })
      .join('');
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'calc(100vh - 50px)', padding:0 }}>

      {/* Header */}
      <div style={{ padding:'16px 20px', borderBottom:`1px solid ${T.bdr}`, display:'flex', alignItems:'center', gap:12 }}>
        <div style={{ width:40, height:40, background:T.purple, borderRadius:10, display:'flex', alignItems:'center', justifyContent:'center', fontSize:20 }}>🤖</div>
        <div>
          <div style={{ fontSize:16, fontWeight:700, color:T.ink }}>AI Business Assistant</div>
          <div style={{ fontSize:12, color:dataLoaded ? T.green : T.amber }}>
            {dataLoaded ? '● Live data connected' : '○ Loading business data…'}
          </div>
        </div>
      </div>

      {/* Messages */}
      <div style={{ flex:1, overflowY:'auto', padding:20 }}>
        {messages.map((msg, i) => (
          <div key={i} style={{ marginBottom:16, display:'flex', justifyContent:msg.role==='user'?'flex-end':'flex-start' }}>
            <div style={{
              maxWidth:'80%',
              background: msg.role==='user' ? T.blue : T.srf,
              border:`1px solid ${msg.role==='user' ? T.blue : T.bdr}`,
              borderRadius: msg.role==='user' ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
              padding:'12px 16px',
              fontSize:14,
              color:T.ink,
              lineHeight:1.6,
            }}>
              {msg.role === 'assistant' ? (
                <div dangerouslySetInnerHTML={{ __html: renderMessage(msg.content) }} />
              ) : (
                msg.content
              )}
            </div>
          </div>
        ))}
        {loading && (
          <div style={{ display:'flex', gap:10, alignItems:'center', marginBottom:16 }}>
            <div style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:'14px 14px 14px 4px', padding:'12px 16px' }}>
              <div style={{ display:'flex', gap:5 }}>
                {[0,1,2].map(i => (
                  <div key={i} style={{ width:8, height:8, borderRadius:'50%', background:T.purple, animation:`pulse 1s ${i*0.2}s infinite` }} />
                ))}
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Suggested questions */}
      {messages.length <= 1 && (
        <div style={{ padding:'0 20px 12px', display:'flex', gap:8, flexWrap:'wrap' }}>
          {SUGGESTED.slice(0,6).map(q => (
            <button key={q} onClick={() => sendMessage(q)} style={{
              background:T.srf, color:T.sub, border:`1px solid ${T.bdr}`,
              borderRadius:20, padding:'6px 14px', fontSize:12, cursor:'pointer', fontFamily:'inherit',
            }}>{q}</button>
          ))}
        </div>
      )}

      {/* Input */}
      <div style={{ padding:'12px 20px', borderTop:`1px solid ${T.bdr}`, display:'flex', gap:10 }}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
          placeholder="Ask anything about your business…"
          disabled={loading || !dataLoaded}
          style={{ flex:1, background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:10, padding:'11px 16px', color:T.ink, fontSize:14, fontFamily:'inherit', outline:'none' }}
        />
        <button onClick={() => sendMessage()} disabled={loading || !input.trim() || !dataLoaded}
          style={{ background:input.trim() && !loading ? T.blue : T.bdr, color:'#fff', border:'none', borderRadius:10, padding:'11px 20px', fontSize:14, fontWeight:700, cursor:'pointer', fontFamily:'inherit', transition:'background .15s' }}>
          {loading ? '…' : '→'}
        </button>
      </div>

      <style>{`@keyframes pulse { 0%,100%{opacity:.3;transform:scale(.8)} 50%{opacity:1;transform:scale(1)} }`}</style>
    </div>
  );
}
