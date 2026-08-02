import { useState, useRef } from 'react';
import { supabase } from '../lib/supabase';

const T = {
  bg:'#F7F3F3', srf:'#FFFFFF', card:'#FFFFFF', bdr:'#E8DEDE',
  red:'#C0392B', darkRed:'#8B0000', lightRed:'#FEF2F2',
  green:'#16A34A', amber:'#D97706', blue:'#2563EB', purple:'#7C3AED',
  ink:'#111827', sub:'#6B7280', muted:'#9CA3AF', white:'#FFFFFF'
};
const btn = (bg,color,extra={}) => ({ background:bg, color, border:'none', borderRadius:9, padding:'10px 18px', fontSize:12.5, fontWeight:700, cursor:'pointer', fontFamily:'inherit', ...extra });
const inp = { background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:8, padding:'9px 12px', color:T.ink, fontSize:13, fontFamily:'inherit', outline:'none' };

const EXAMPLES = [
  'Diwali sale — 20% off all sandals this week',
  'New arrival: leather office shoes, festive combo offer',
  'Weekend flat 15% off on bags, limited stock',
];

const SYSTEM = (biz) => `You are writing marketing copy for an Indian retail shop called "${biz}".
Given a short prompt describing a promotion, respond with ONLY a JSON object, no markdown fences, no explanation:

{
  "whatsapp_message": "a warm, short WhatsApp broadcast message, under 300 characters, with 1-2 emoji, ending with a clear call to action. Use {name} as a placeholder for the customer's name.",
  "instagram_caption": "an engaging Instagram caption, 2-4 short lines, conversational tone",
  "hashtags": ["array", "of", "8", "relevant", "hashtags", "without", "the", "hash", "symbol"],
  "headline": "a punchy 3-6 word headline for a promotional graphic",
  "subtext": "a 4-10 word supporting line for the graphic",
  "accent_emoji": "one single emoji that fits the promotion theme"
}`;

export default function CampaignBot({ tenant, role='owner' }) {
  const [prompt,   setPrompt]   = useState('');
  const [busy,     setBusy]     = useState(false);
  const [error,    setError]    = useState(null);
  const [result,   setResult]   = useState(null);
  const [copied,   setCopied]   = useState(null);
  const [target,   setTarget]   = useState('all');
  const [saving,   setSaving]   = useState(false);
  const [saved,    setSaved]    = useState(false);
  const canvasRef = useRef(null);

  async function generate() {
    if (!prompt.trim()) return;
    setBusy(true); setError(null); setResult(null);
    try {
      const resp = await fetch('https://api.anthropic.com/v1/messages', {
        method:'POST',
        headers:{ 'Content-Type':'application/json' },
        body: JSON.stringify({
          model:'claude-sonnet-4-6', max_tokens:800,
          system: SYSTEM(tenant?.name||'our store'),
          messages:[{ role:'user', content:prompt }],
        }),
      });
      if (!resp.ok) { const e = await resp.json().catch(()=>({})); throw new Error(e.error?.message || `API error ${resp.status}`); }
      const data = await resp.json();
      const text = (data.content||[]).filter(x=>x.type==='text').map(x=>x.text).join('');
      const clean = text.replace(/```json/gi,'').replace(/```/g,'').trim();
      const parsed = JSON.parse(clean);
      setResult(parsed);
      setTimeout(()=>drawGraphic(parsed), 50);
    } catch (e) {
      setError(e.message.includes('JSON') ? 'Could not generate clean copy — try rephrasing your prompt.' : e.message);
    }
    setBusy(false);
  }

  function drawGraphic(r) {
    const cv = canvasRef.current; if (!cv) return;
    const ctx = cv.getContext('2d');
    const S = 1080; // native Instagram-square resolution; CSS scales the on-screen preview down
    cv.width = S; cv.height = S;

    // Background
    const grad = ctx.createLinearGradient(0,0,S,S);
    grad.addColorStop(0, '#7B1E1E'); grad.addColorStop(1, '#3D0F0F');
    ctx.fillStyle = grad; ctx.fillRect(0,0,S,S);

    // Decorative circles
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    ctx.beginPath(); ctx.arc(S*0.85, S*0.12, 180, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(S*0.1, S*0.9, 260, 0, Math.PI*2); ctx.fill();

    // Business name tag
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.font = '600 30px Arial';
    const bizName = (tenant?.name||'YOUR STORE').toUpperCase();
    ctx.fillText(bizName, 68, 92);

    // Emoji
    ctx.font = '128px Arial';
    ctx.fillText(r.accent_emoji||'✨', 68, 300);

    // Headline
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '900 84px Arial';
    wrapText(ctx, r.headline||'Special Offer', 68, 460, S-136, 96);

    // Subtext
    ctx.fillStyle = '#FFD9D9';
    ctx.font = '500 40px Arial';
    wrapText(ctx, r.subtext||'', 68, S-220, S-136, 54);

    // Bottom bar
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, S-92, S, 92);
    ctx.fillStyle = '#7B1E1E';
    ctx.font = '700 32px Arial';
    ctx.fillText('Visit us today', 68, S-32);
  }

  function wrapText(ctx, text, x, y, maxW, lineH) {
    const words = (text||'').split(' ');
    let line = '', cy = y;
    words.forEach(w => {
      const test = line + w + ' ';
      if (ctx.measureText(test).width > maxW && line) {
        ctx.fillText(line, x, cy); line = w + ' '; cy += lineH;
      } else line = test;
    });
    ctx.fillText(line, x, cy);
  }

  function downloadGraphic() {
    const cv = canvasRef.current; if (!cv) return;
    const a = document.createElement('a');
    a.href = cv.toDataURL('image/png');
    a.download = `campaign-${Date.now()}.png`;
    a.click();
  }

  function copyText(key, text) {
    navigator.clipboard?.writeText(text);
    setCopied(key); setTimeout(()=>setCopied(null), 1800);
  }

  async function saveAsCampaign() {
    if (!result) return;
    setSaving(true);
    const { data: custs } = await supabase.from('customers').select('id,phone,segment').eq('tenant_id', tenant.id);
    const contacts = (custs||[]).filter(c => c.phone && (target==='all' || c.segment===target));
    await supabase.from('campaigns').insert({
      tenant_id: tenant.id, name: prompt.slice(0,60), type:'whatsapp',
      message: result.whatsapp_message, target, total_contacts: contacts.length,
      status:'draft', notes: `AI-generated from prompt: "${prompt}"`,
    });
    setSaving(false); setSaved(true); setTimeout(()=>setSaved(false), 3000);
  }

  return (
    <div style={{ padding:22, background:T.bg, minHeight:'100%' }}>

      <div style={{ marginBottom:18 }}>
        <div style={{ fontSize:20, fontWeight:900, color:T.darkRed, letterSpacing:'-0.02em' }}>🤖 Campaign Bot</div>
        <div style={{ fontSize:12, color:T.sub, marginTop:3 }}>
          Describe your promotion once — get a WhatsApp message, Instagram caption and a ready graphic
        </div>
      </div>

      {/* Honest capability notice */}
      <div style={{ background:'#EFF6FF', border:'1px solid #BFDBFE', borderRadius:11, padding:'12px 16px', marginBottom:18, fontSize:12, color:T.sub, lineHeight:1.6 }}>
        <strong style={{ color:T.blue }}>What this does and doesn't do:</strong> it writes the copy and designs the graphic for you.
        <strong> WhatsApp</strong> sends open a chat per customer for you to hit send — that's how WhatsApp works without a paid Business API.
        <strong> Instagram</strong> has no auto-post button here either — download the image and caption below and post them yourself from the Instagram app.
        Both can become one-click once you connect those APIs; for now this saves you the writing and design work.
      </div>

      {/* Prompt input */}
      <div style={{ background:T.white, border:`1px solid ${T.bdr}`, borderRadius:13, padding:'18px 20px', marginBottom:16, boxShadow:'0 1px 4px rgba(0,0,0,.05)' }}>
        <label style={{ fontSize:11, color:T.sub, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.05em', display:'block', marginBottom:8 }}>
          What are you promoting?
        </label>
        <textarea value={prompt} onChange={e=>setPrompt(e.target.value)} rows={3}
          placeholder="e.g. Diwali sale — 20% off all sandals this week"
          style={{ ...inp, width:'100%', resize:'vertical', fontSize:14, marginBottom:10 }}/>
        <div style={{ display:'flex', gap:7, flexWrap:'wrap', marginBottom:14 }}>
          {EXAMPLES.map(ex=>(
            <button key={ex} onClick={()=>setPrompt(ex)}
              style={{ background:T.bg, border:`1px solid ${T.bdr}`, borderRadius:20, padding:'5px 13px', fontSize:11, color:T.sub, cursor:'pointer', fontFamily:'inherit' }}>
              {ex}
            </button>
          ))}
        </div>
        <button onClick={generate} disabled={busy||!prompt.trim()} style={btn(T.red, T.white, { padding:'12px 24px', fontSize:13.5 })}>
          {busy ? '✨ Writing…' : '✨ Generate Campaign'}
        </button>
        {error && <div style={{ marginTop:12, background:'#FEF2F2', border:'1px solid #FECACA', borderRadius:8, padding:'10px 14px', fontSize:12, color:T.red }}>
          ⚠️ {error}
          {error.includes('API') && <div style={{ marginTop:5, fontSize:11, color:T.sub }}>Set <code>VITE_ANTHROPIC_API_KEY</code> in your Vercel environment variables.</div>}
        </div>}
      </div>

      {result && (
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>

          {/* Left: copy */}
          <div style={{ display:'flex', flexDirection:'column', gap:14 }}>

            {/* WhatsApp */}
            <div style={{ background:T.white, border:`1px solid ${T.bdr}`, borderRadius:13, padding:'16px 18px', boxShadow:'0 1px 4px rgba(0,0,0,.05)' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
                <div style={{ fontSize:13, fontWeight:800, color:'#16A34A' }}>💬 WhatsApp Message</div>
                <button onClick={()=>copyText('wa', result.whatsapp_message)}
                  style={{ background:copied==='wa'?'#F0FDF4':T.bg, color:copied==='wa'?T.green:T.sub, border:`1px solid ${T.bdr}`, borderRadius:6, padding:'3px 11px', fontSize:10.5, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>
                  {copied==='wa'?'✓ Copied':'Copy'}
                </button>
              </div>
              <div style={{ background:'#DCF8C6', borderRadius:'12px 12px 12px 3px', padding:'11px 14px', fontSize:13, color:'#1a1a1a', lineHeight:1.5, whiteSpace:'pre-wrap' }}>
                {result.whatsapp_message.replace(/\{name\}/g,'Priya')}
              </div>
              <div style={{ fontSize:10, color:T.muted, marginTop:6 }}>{'{name}'} personalises per customer when sent</div>
            </div>

            {/* Instagram caption */}
            <div style={{ background:T.white, border:`1px solid ${T.bdr}`, borderRadius:13, padding:'16px 18px', boxShadow:'0 1px 4px rgba(0,0,0,.05)' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
                <div style={{ fontSize:13, fontWeight:800, color:'#C13584' }}>📷 Instagram Caption</div>
                <button onClick={()=>copyText('ig', result.instagram_caption+'\n\n'+result.hashtags.map(h=>'#'+h).join(' '))}
                  style={{ background:copied==='ig'?'#F0FDF4':T.bg, color:copied==='ig'?T.green:T.sub, border:`1px solid ${T.bdr}`, borderRadius:6, padding:'3px 11px', fontSize:10.5, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>
                  {copied==='ig'?'✓ Copied':'Copy'}
                </button>
              </div>
              <div style={{ fontSize:13, color:T.ink, lineHeight:1.6, marginBottom:10, whiteSpace:'pre-wrap' }}>{result.instagram_caption}</div>
              <div style={{ display:'flex', flexWrap:'wrap', gap:5 }}>
                {result.hashtags.map(h=>(
                  <span key={h} style={{ background:'#FDF2F8', color:'#C13584', borderRadius:5, padding:'2px 8px', fontSize:11 }}>#{h}</span>
                ))}
              </div>
            </div>

            {/* Send via WhatsApp */}
            <div style={{ background:T.white, border:`1px solid ${T.bdr}`, borderRadius:13, padding:'16px 18px', boxShadow:'0 1px 4px rgba(0,0,0,.05)' }}>
              <div style={{ fontSize:13, fontWeight:800, color:T.darkRed, marginBottom:10 }}>Send this campaign</div>
              <select value={target} onChange={e=>setTarget(e.target.value)} style={{ ...inp, width:'100%', cursor:'pointer', marginBottom:11 }}>
                <option value="all">All customers with a phone number</option>
                <option value="vip">VIP segment only</option>
                <option value="regular">Regular segment only</option>
              </select>
              <button onClick={saveAsCampaign} disabled={saving} style={{ width:'100%', ...btn(T.green, T.white, { padding:'12px', fontSize:13.5 }) }}>
                {saving ? 'Saving…' : saved ? '✓ Saved to Campaigns' : '💾 Save as Draft Campaign'}
              </button>
              <div style={{ fontSize:10.5, color:T.muted, marginTop:8, textAlign:'center' }}>
                Then send it from Marketing → Campaigns, which opens one WhatsApp chat per customer for you to tap send
              </div>
            </div>
          </div>

          {/* Right: graphic */}
          <div style={{ background:T.white, border:`1px solid ${T.bdr}`, borderRadius:13, padding:'16px 18px', boxShadow:'0 1px 4px rgba(0,0,0,.05)', display:'flex', flexDirection:'column' }}>
            <div style={{ fontSize:13, fontWeight:800, color:T.darkRed, marginBottom:12 }}>🎨 Instagram Graphic</div>
            <div style={{ display:'flex', justifyContent:'center', marginBottom:14 }}>
              <canvas ref={canvasRef} style={{ width:'100%', maxWidth:340, borderRadius:10, boxShadow:'0 4px 16px rgba(0,0,0,.15)' }}/>
            </div>
            <button onClick={downloadGraphic} style={{ ...btn(T.purple, T.white, { padding:'11px', fontSize:13 }) }}>
              ⬇ Download PNG (1080×1080)
            </button>
            <div style={{ fontSize:10.5, color:T.muted, marginTop:9, textAlign:'center', lineHeight:1.5 }}>
              Post this on Instagram with the caption above.<br/>Square format, ready for feed or as a Story.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
