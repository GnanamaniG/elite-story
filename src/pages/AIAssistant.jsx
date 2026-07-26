import { useState, useEffect, useRef } from 'react';
import { getSales, getInventory, getExpenses, getPurchases, getCustomers } from '../lib/supabase';

const T = { bg:'#060710', srf:'#0f1220', card:'#141828', bdr:'#1e2540', blue:'#4f7cff', purple:'#9b72ff', ink:'#eef0f8', sub:'#6b7598', muted:'#4a5175', green:'#00d68f', amber:'#ffb547', red:'#ff4d6a' };

const SUGGESTED = [
  "What is my total revenue this month?",
  "Which are my top selling products?",
  "What is my gross profit margin?",
  "Which items are low on stock?",
  "Give me a business health summary",
  "How are my expenses this month?",
];

function buildContext(data) {
  const { sales, inventory, expenses, purchases, customers, tenant } = data;
  const now       = new Date();
  const thisMonth = now.toISOString().slice(0, 7);
  const mSales    = sales.filter(s => (s.date||'').startsWith(thisMonth));
  const revenue   = mSales.reduce((s, x) => s + (x.total||0), 0);
  const gst       = mSales.reduce((s, x) => s + (x.gst_amount||0), 0);
  const expTotal  = expenses.filter(e => (e.date||'').startsWith(thisMonth)).reduce((s, x) => s + (x.amount||0), 0);
  const lowStock  = inventory.filter(i => (i.stock||0) <= (i.alert||10));
  const overdue   = customers.filter(c => (c.outstanding||0) > 0);

  const itemSales = {};
  mSales.forEach(s => (s.items||[]).forEach(item => {
    itemSales[item.name] = (itemSales[item.name]||0) + (item.amount||0);
  }));
  const topItems = Object.entries(itemSales).sort((a,b) => b[1]-a[1]).slice(0,5)
    .map(([name, rev]) => `${name}: Rs.${Math.round(rev)}`);

  const expByCategory = expenses
    .filter(e => (e.date||'').startsWith(thisMonth))
    .reduce((acc, e) => { acc[e.category] = (acc[e.category]||0) + (e.amount||0); return acc; }, {});

  return `You are a business analytics assistant for ${tenant?.name || 'Elite Store'}, a retail business in Tamil Nadu, India.

CURRENT MONTH (${thisMonth}) DATA:
- Revenue: Rs.${Math.round(revenue)} from ${mSales.length} invoices
- GST Collected: Rs.${Math.round(gst)}
- Expenses: Rs.${Math.round(expTotal)}
- Gross Profit: Rs.${Math.round(revenue - expTotal)}
- Avg Order Value: Rs.${mSales.length > 0 ? Math.round(revenue/mSales.length) : 0}

INVENTORY:
- Total Items: ${inventory.length}
- Low Stock (${lowStock.length}): ${lowStock.slice(0,5).map(i => `${i.name} (${i.stock} left)`).join(', ') || 'None'}

CUSTOMERS:
- Total: ${customers.length}
- With Outstanding: ${overdue.length} (Rs.${Math.round(overdue.reduce((s,c) => s+(c.outstanding||0), 0))})

TOP ITEMS THIS MONTH:
${topItems.join('\n') || 'No sales yet'}

EXPENSE BREAKDOWN:
${Object.entries(expByCategory).map(([cat, amt]) => `${cat}: Rs.${Math.round(amt)}`).join('\n') || 'None'}

Answer concisely in plain English. Use Indian formatting (Rs., lakhs). Be specific with numbers and give actionable advice.`;
}

export default function AIAssistant({ tenant }) {
  const [messages,   setMessages]   = useState([]);
  const [input,      setInput]      = useState('');
  const [loading,    setLoading]    = useState(false);
  const [dataLoaded, setDataLoaded] = useState(false);
  const [bizData,    setBizData]    = useState(null);
  const [noKey,      setNoKey]      = useState(false);
  const bottomRef = useRef(null);

  const API_KEY = import.meta.env.VITE_ANTHROPIC_API_KEY;

  useEffect(() => {
    if (!API_KEY) setNoKey(true);
    if (tenant?.id) loadBizData();
  }, [tenant?.id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function loadBizData() {
    try {
      const [sales, inventory, expenses, purchases, customers] = await Promise.all([
        getSales(tenant.id, 500),
        getInventory(tenant.id),
        getExpenses(tenant.id),
        getPurchases(tenant.id),
        getCustomers(tenant.id),
      ]);
      setBizData({ sales, inventory, expenses, purchases, customers, tenant });
      setDataLoaded(true);
      setMessages([{
        role: 'assistant',
        content: `👋 Hello! I'm your Elite Store AI Assistant.\n\nI have access to your live business data. Ask me anything!\n\n**Try:**\n${SUGGESTED.slice(0,4).map(s => `• ${s}`).join('\n')}`,
      }]);
    } catch (e) {
      console.error('Failed to load biz data:', e);
    }
  }

  async function sendMessage(text) {
    const userMsg = text || input.trim();
    if (!userMsg || loading || !bizData) return;
    if (!API_KEY) {
      setMessages(m => [...m,
        { role:'user', content: userMsg },
        { role:'assistant', content: '⚠️ **API key not set.**\n\nGo to Vercel → your project → Settings → Environment Variables → add:\n\n**Key:** `VITE_ANTHROPIC_API_KEY`\n**Value:** your key from console.anthropic.com\n\nThen redeploy.' }
      ]);
      return;
    }

    setInput('');
    setMessages(m => [...m, { role: 'user', content: userMsg }]);
    setLoading(true);

    try {
      const context = buildContext(bizData);
      const history = messages.slice(-6).map(m => ({ role: m.role, content: m.content }));

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': API_KEY,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5',
          max_tokens: 1000,
          system: context,
          messages: [...history, { role: 'user', content: userMsg }],
        }),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error?.message || `API error ${response.status}`);
      }

      const data   = await response.json();
      const answer = data.content?.[0]?.text || 'No response received.';
      setMessages(m => [...m, { role: 'assistant', content: answer }]);
    } catch (e) {
      setMessages(m => [...m, {
        role: 'assistant',
        content: `⚠️ **Error:** ${e.message}\n\nCheck that your API key is correctly added in Vercel environment variables and the app has been redeployed.`,
      }]);
    } finally {
      setLoading(false);
    }
  }

  function renderMessage(content) {
    return content.split('\n').map((line, i) => {
      const bold = line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
      const code = bold.replace(/`(.*?)`/g, '<code style="background:#1e2540;padding:2px 6px;border-radius:4px;font-size:12px">$1</code>');
      return `<div style="margin-bottom:${line===''?'8px':'3px'}">${code}</div>`;
    }).join('');
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'calc(100vh - 50px)' }}>

      {/* Header */}
      <div style={{ padding:'14px 20px', borderBottom:`1px solid ${T.bdr}`, display:'flex', alignItems:'center', gap:12, flexShrink:0 }}>
        <div style={{ width:40, height:40, background:T.purple, borderRadius:10, display:'flex', alignItems:'center', justifyContent:'center', fontSize:20 }}>🤖</div>
        <div>
          <div style={{ fontSize:16, fontWeight:700, color:T.ink }}>AI Business Assistant</div>
          <div style={{ fontSize:12, color: noKey ? T.red : dataLoaded ? T.green : T.amber }}>
            {noKey ? '⚠️ API key not configured' : dataLoaded ? '● Live data connected' : '○ Loading…'}
          </div>
        </div>
      </div>

      {/* No key warning */}
      {noKey && (
        <div style={{ margin:16, background:T.amber+'18', border:`1px solid ${T.amber}44`, borderRadius:10, padding:'14px 18px', fontSize:13, color:T.amber, lineHeight:1.7 }}>
          <strong>API key missing.</strong> To enable AI Assistant:<br/>
          1. Go to <strong>console.anthropic.com</strong> → API Keys → Create Key<br/>
          2. Go to <strong>Vercel</strong> → your project → Settings → Environment Variables<br/>
          3. Add: <code style={{ background:'#1e2540', padding:'1px 6px', borderRadius:4 }}>VITE_ANTHROPIC_API_KEY</code> = your key<br/>
          4. Click <strong>Save</strong> → go to Deployments → <strong>Redeploy</strong>
        </div>
      )}

      {/* Messages */}
      <div style={{ flex:1, overflowY:'auto', padding:20 }}>
        {messages.map((msg, i) => (
          <div key={i} style={{ marginBottom:16, display:'flex', justifyContent:msg.role==='user'?'flex-end':'flex-start' }}>
            <div style={{
              maxWidth:'80%',
              background: msg.role==='user' ? T.blue : T.srf,
              border: `1px solid ${msg.role==='user' ? T.blue : T.bdr}`,
              borderRadius: msg.role==='user' ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
              padding:'12px 16px', fontSize:14, color:T.ink, lineHeight:1.6,
            }}>
              {msg.role === 'assistant'
                ? <div dangerouslySetInnerHTML={{ __html: renderMessage(msg.content) }} />
                : msg.content}
            </div>
          </div>
        ))}

        {loading && (
          <div style={{ display:'flex', gap:8, alignItems:'center', marginBottom:16 }}>
            <div style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:'14px 14px 14px 4px', padding:'14px 18px', display:'flex', gap:5 }}>
              {[0,1,2].map(i => (
                <div key={i} style={{ width:8, height:8, borderRadius:'50%', background:T.purple, animation:`pulse 1s ${i*0.2}s infinite ease-in-out` }} />
              ))}
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Suggested questions */}
      {messages.length <= 1 && !noKey && (
        <div style={{ padding:'0 20px 12px', display:'flex', gap:8, flexWrap:'wrap', flexShrink:0 }}>
          {SUGGESTED.map(q => (
            <button key={q} onClick={() => sendMessage(q)} style={{ background:T.srf, color:T.sub, border:`1px solid ${T.bdr}`, borderRadius:20, padding:'6px 14px', fontSize:12, cursor:'pointer', fontFamily:'inherit' }}>
              {q}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div style={{ padding:'12px 20px', borderTop:`1px solid ${T.bdr}`, display:'flex', gap:10, flexShrink:0 }}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
          placeholder={noKey ? 'Add API key to Vercel to enable…' : 'Ask anything about your business…'}
          disabled={loading || !dataLoaded || noKey}
          style={{ flex:1, background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:10, padding:'11px 16px', color:T.ink, fontSize:14, fontFamily:'inherit', outline:'none' }}
        />
        <button
          onClick={() => sendMessage()}
          disabled={loading || !input.trim() || !dataLoaded || noKey}
          style={{ background: input.trim() && !loading && !noKey ? T.blue : T.bdr, color:'#fff', border:'none', borderRadius:10, padding:'11px 20px', fontSize:14, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>
          {loading ? '…' : '→'}
        </button>
      </div>

      <style>{`@keyframes pulse{0%,100%{opacity:.3;transform:scale(.8)}50%{opacity:1;transform:scale(1)}}`}</style>
    </div>
  );
}
