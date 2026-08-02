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
const BUCKET = 'campaign-images';

const EXAMPLES = [
  'Diwali sale — 20% off all sandals this week',
  'New arrival: leather office shoes, festive combo offer',
  'Weekend flat 15% off on bags, limited stock',
];

const COPY_SYSTEM = (biz) => `You are writing marketing copy for an Indian retail shop called "${biz}".
Given a short prompt describing a promotion, respond with ONLY a JSON object, no markdown fences, no explanation:

{
  "whatsapp_message": "a warm, short WhatsApp broadcast message, under 300 characters, with 1-2 emoji, ending with a clear call to action. Use {name} as a placeholder for the customer's name.",
  "instagram_caption": "an engaging Instagram caption, 2-4 short lines, conversational tone",
  "hashtags": ["array", "of", "8", "relevant", "hashtags", "without", "the", "hash", "symbol"],
  "image_prompt": "a detailed prompt for an image generation model describing an appealing promotional product photo based on this campaign — describe composition, lighting and mood, not text overlays"
}`;

export default function CampaignBot({ tenant, role='owner' }) {
  const [prompt,     setPrompt]     = useState('');
  const [refFiles,   setRefFiles]   = useState([]);
  const [refPreviews,setRefPreviews]= useState([]);
  const [busy,       setBusy]       = useState(false);
  const [imgBusy,    setImgBusy]    = useState(false);
  const [error,      setError]      = useState(null);
  const [imgError,   setImgError]   = useState(null);
  const [result,     setResult]     = useState(null);
  const [imageUrl,   setImageUrl]   = useState(null);
  const [copied,     setCopied]     = useState(null);
  const [target,     setTarget]     = useState('all');
  const [saving,     setSaving]     = useState(false);
  const [saved,      setSaved]      = useState(false);
  const [posting,    setPosting]    = useState(null);  // 'instagram' | 'whatsapp' | null
  const [postResult,   setPostResult]   = useState(null);
  const fileRef = useRef(null);

  function onPickFiles(e) {
    const files = Array.from(e.target.files||[]).slice(0,4);
    setRefFiles(files);
    setRefPreviews(files.map(f=>URL.createObjectURL(f)));
  }

  // ── Step 1: generate copy + an image prompt via Claude (text only) ──
  async function generateCopy() {
    if (!prompt.trim()) return;
    setBusy(true); setError(null); setResult(null); setImageUrl(null); setPostResult(null);
    try {
      const resp = await fetch('https://api.anthropic.com/v1/messages', {
        method:'POST', headers:{ 'Content-Type':'application/json' },
        body: JSON.stringify({
          model:'claude-sonnet-4-6', max_tokens:700,
          system: COPY_SYSTEM(tenant?.name||'our store'),
          messages:[{ role:'user', content:prompt }],
        }),
      });
      if (!resp.ok) { const e = await resp.json().catch(()=>({})); throw new Error(e.error?.message || `API error ${resp.status}`); }
      const data = await resp.json();
      const text = (data.content||[]).filter(x=>x.type==='text').map(x=>x.text).join('');
      const parsed = JSON.parse(text.replace(/```json/gi,'').replace(/```/g,'').trim());
      setResult(parsed);
    } catch (e) {
      setError(e.message.includes('JSON') ? 'Could not generate clean copy — try rephrasing your prompt.' : e.message);
    }
    setBusy(false);
  }

  // ── Step 2: generate the actual image via OpenAI, using your product photos as reference ──
  async function generateImage() {
    if (!result?.image_prompt) return;
    setImgBusy(true); setImgError(null); setImageUrl(null);
    try {
      const { data: cfg } = await supabase.from('marketing_integrations').select('openai_api_key').eq('tenant_id', tenant.id).maybeSingle();
      const key = cfg?.openai_api_key;
      if (!key) throw new Error('No OpenAI key saved — set it up under Marketing → Integrations first.');

      let resp;
      if (refFiles.length > 0) {
        // Reference photos supplied: use the image-editing endpoint so the
        // result is genuinely built from your product photos, not invented from scratch.
        const fd = new FormData();
        fd.append('model', 'gpt-image-1');
        refFiles.forEach(f => fd.append('image[]', f));
        fd.append('prompt', result.image_prompt);
        fd.append('size', '1024x1024');
        resp = await fetch('https://api.openai.com/v1/images/edits', {
          method:'POST', headers:{ 'Authorization':`Bearer ${key}` }, body: fd,
        });
      } else {
        resp = await fetch('https://api.openai.com/v1/images/generations', {
          method:'POST',
          headers:{ 'Authorization':`Bearer ${key}`, 'Content-Type':'application/json' },
          body: JSON.stringify({ model:'gpt-image-1', prompt: result.image_prompt, size:'1024x1024' }),
        });
      }
      if (!resp.ok) { const e = await resp.json().catch(()=>({})); throw new Error(e.error?.message || `OpenAI error ${resp.status}`); }
      const data = await resp.json();
      const b64 = data.data?.[0]?.b64_json;
      if (!b64) throw new Error('No image returned');

      // Upload to the public bucket — Instagram's API needs a real public URL, not base64
      const bytes = Uint8Array.from(atob(b64), c=>c.charCodeAt(0));
      const path = `${tenant.id}/${Date.now()}.png`;
      const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, new Blob([bytes],{type:'image/png'}), { upsert:false });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);
      setImageUrl(pub.publicUrl);
    } catch (e) {
      setImgError(e.message);
    }
    setImgBusy(false);
  }

  function copyText(key, text) { navigator.clipboard?.writeText(text); setCopied(key); setTimeout(()=>setCopied(null), 1800); }

  // ── Real Instagram publish: create media container, then publish it ──
  async function postToInstagram() {
    if (!imageUrl || !result) return;
    setPosting('instagram'); setPostResult(null);
    try {
      const { data: cfg } = await supabase.from('marketing_integrations').select('*').eq('tenant_id', tenant.id).maybeSingle();
      if (!cfg?.meta_access_token || !cfg?.ig_business_id) throw new Error('Instagram is not connected — set it up under Marketing → Integrations.');

      const caption = result.instagram_caption + '\n\n' + result.hashtags.map(h=>'#'+h).join(' ');
      const create = await fetch(`https://graph.facebook.com/v20.0/${cfg.ig_business_id}/media`, {
        method:'POST', headers:{ 'Content-Type':'application/json' },
        body: JSON.stringify({ image_url:imageUrl, caption, access_token:cfg.meta_access_token }),
      });
      const createData = await create.json();
      if (!create.ok) throw new Error(createData.error?.message || 'Instagram rejected the media — check your access token has instagram_content_publish approved.');

      const publish = await fetch(`https://graph.facebook.com/v20.0/${cfg.ig_business_id}/media_publish`, {
        method:'POST', headers:{ 'Content-Type':'application/json' },
        body: JSON.stringify({ creation_id:createData.id, access_token:cfg.meta_access_token }),
      });
      const pubData = await publish.json();
      if (!publish.ok) throw new Error(pubData.error?.message || 'Publish step failed');

      await supabase.from('campaign_posts').insert({
        tenant_id:tenant.id, channel:'instagram', image_url:imageUrl, caption,
        status:'sent', external_id:pubData.id, recipients_total:1, recipients_sent:1,
      });
      setPostResult({ channel:'instagram', ok:true, msg:'Posted to Instagram successfully.' });
    } catch (e) {
      await supabase.from('campaign_posts').insert({ tenant_id:tenant.id, channel:'instagram', image_url:imageUrl, status:'failed', error:e.message });
      setPostResult({ channel:'instagram', ok:false, msg:e.message });
    }
    setPosting(null);
  }

  // ── Real WhatsApp send: approved template message, one per customer ──
  async function sendWhatsApp() {
    if (!result) return;
    setPosting('whatsapp'); setPostResult(null);
    try {
      const { data: cfg } = await supabase.from('marketing_integrations').select('*').eq('tenant_id', tenant.id).maybeSingle();
      if (!cfg?.meta_access_token || !cfg?.wa_phone_number_id || !cfg?.wa_template_name)
        throw new Error('WhatsApp is not connected, or no approved template name is set — check Marketing → Integrations.');

      const { data: custs } = await supabase.from('customers').select('id,name,phone,segment').eq('tenant_id', tenant.id);
      const contacts = (custs||[]).filter(c => c.phone && (target==='all' || c.segment===target));
      if (contacts.length===0) throw new Error('No customers with a phone number match this target.');

      let sent = 0, failed = 0;
      for (const c of contacts) {
        const to = c.phone.replace(/\D/g,'').replace(/^0/,'91');
        try {
          const resp = await fetch(`https://graph.facebook.com/v20.0/${cfg.wa_phone_number_id}/messages`, {
            method:'POST',
            headers:{ 'Authorization':`Bearer ${cfg.meta_access_token}`, 'Content-Type':'application/json' },
            body: JSON.stringify({
              messaging_product:'whatsapp', to,
              type:'template',
              template:{ name:cfg.wa_template_name, language:{ code:cfg.wa_template_lang||'en' },
                         components:[{ type:'body', parameters:[{ type:'text', text:c.name||'there' }] }] },
            }),
          });
          if (resp.ok) sent++; else failed++;
        } catch { failed++; }
      }

      await supabase.from('campaign_posts').insert({
        tenant_id:tenant.id, channel:'whatsapp', caption:result.whatsapp_message,
        status: failed===0?'sent':(sent>0?'sent':'failed'),
        recipients_total:contacts.length, recipients_sent:sent, recipients_failed:failed,
      });
      setPostResult({ channel:'whatsapp', ok:sent>0, msg:`Sent to ${sent} of ${contacts.length} customers.${failed?` ${failed} failed — check the template is APPROVED, not just submitted.`:''}` });
    } catch (e) {
      setPostResult({ channel:'whatsapp', ok:false, msg:e.message });
    }
    setPosting(null);
  }

  return (
    <div style={{ padding:22, background:T.bg, minHeight:'100%' }}>

      <div style={{ marginBottom:18 }}>
        <div style={{ fontSize:20, fontWeight:900, color:T.darkRed, letterSpacing:'-0.02em' }}>🤖 Campaign Bot</div>
        <div style={{ fontSize:12, color:T.sub, marginTop:3 }}>Photos + a prompt → a generated image, written copy, and a real post</div>
      </div>

      <div style={{ background:'#EFF6FF', border:'1px solid #BFDBFE', borderRadius:11, padding:'11px 16px', marginBottom:18, fontSize:11.5, color:T.sub }}>
        Needs OpenAI + Meta credentials saved under <strong>Marketing → Integrations</strong> first. Posting only works once your Meta app is approved for the relevant permissions.
      </div>

      {/* Prompt + reference photos */}
      <div style={{ background:T.white, border:`1px solid ${T.bdr}`, borderRadius:13, padding:'18px 20px', marginBottom:16, boxShadow:'0 1px 4px rgba(0,0,0,.05)' }}>
        <label style={{ fontSize:11, color:T.sub, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.05em', display:'block', marginBottom:8 }}>What are you promoting?</label>
        <textarea value={prompt} onChange={e=>setPrompt(e.target.value)} rows={3} placeholder="e.g. Diwali sale — 20% off all sandals this week"
          style={{ ...inp, width:'100%', resize:'vertical', fontSize:14, marginBottom:10 }}/>
        <div style={{ display:'flex', gap:7, flexWrap:'wrap', marginBottom:14 }}>
          {EXAMPLES.map(ex=><button key={ex} onClick={()=>setPrompt(ex)} style={{ background:T.bg, border:`1px solid ${T.bdr}`, borderRadius:20, padding:'5px 13px', fontSize:11, color:T.sub, cursor:'pointer', fontFamily:'inherit' }}>{ex}</button>)}
        </div>

        <label style={{ fontSize:11, color:T.sub, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.05em', display:'block', marginBottom:8 }}>Reference photos (optional, up to 4)</label>
        <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:12 }}>
          {refPreviews.map((src,i)=><img key={i} src={src} style={{ width:64, height:64, objectFit:'cover', borderRadius:8, border:`1px solid ${T.bdr}` }}/>)}
          <button onClick={()=>fileRef.current?.click()} style={{ width:64, height:64, border:`1.5px dashed ${T.bdr}`, borderRadius:8, background:T.bg, color:T.muted, cursor:'pointer', fontSize:20 }}>+</button>
          <input ref={fileRef} type="file" accept="image/*" multiple onChange={onPickFiles} style={{ display:'none' }}/>
        </div>
        <div style={{ fontSize:10.5, color:T.muted, marginBottom:14 }}>Your product photos are blended with the prompt into the generated image</div>

        <button onClick={generateCopy} disabled={busy||!prompt.trim()} style={btn(T.red, T.white, { padding:'12px 24px', fontSize:13.5 })}>
          {busy ? '✨ Writing…' : '✨ Generate Copy'}
        </button>
        {error && <div style={{ marginTop:12, background:'#FEF2F2', border:'1px solid #FECACA', borderRadius:8, padding:'10px 14px', fontSize:12, color:T.red }}>⚠️ {error}</div>}
      </div>

      {result && (
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>

          <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
            <div style={{ background:T.white, border:`1px solid ${T.bdr}`, borderRadius:13, padding:'16px 18px', boxShadow:'0 1px 4px rgba(0,0,0,.05)' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
                <div style={{ fontSize:13, fontWeight:800, color:'#16A34A' }}>💬 WhatsApp Message</div>
                <button onClick={()=>copyText('wa', result.whatsapp_message)} style={{ background:copied==='wa'?'#F0FDF4':T.bg, color:copied==='wa'?T.green:T.sub, border:`1px solid ${T.bdr}`, borderRadius:6, padding:'3px 11px', fontSize:10.5, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>{copied==='wa'?'✓ Copied':'Copy'}</button>
              </div>
              <div style={{ background:'#DCF8C6', borderRadius:'12px 12px 12px 3px', padding:'11px 14px', fontSize:13, color:'#1a1a1a', lineHeight:1.5, whiteSpace:'pre-wrap' }}>{result.whatsapp_message.replace(/\{name\}/g,'Priya')}</div>
            </div>

            <div style={{ background:T.white, border:`1px solid ${T.bdr}`, borderRadius:13, padding:'16px 18px', boxShadow:'0 1px 4px rgba(0,0,0,.05)' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
                <div style={{ fontSize:13, fontWeight:800, color:'#C13584' }}>📷 Instagram Caption</div>
                <button onClick={()=>copyText('ig', result.instagram_caption+'\n\n'+result.hashtags.map(h=>'#'+h).join(' '))} style={{ background:copied==='ig'?'#F0FDF4':T.bg, color:copied==='ig'?T.green:T.sub, border:`1px solid ${T.bdr}`, borderRadius:6, padding:'3px 11px', fontSize:10.5, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>{copied==='ig'?'✓ Copied':'Copy'}</button>
              </div>
              <div style={{ fontSize:13, color:T.ink, lineHeight:1.6, marginBottom:10 }}>{result.instagram_caption}</div>
              <div style={{ display:'flex', flexWrap:'wrap', gap:5 }}>{result.hashtags.map(h=><span key={h} style={{ background:'#FDF2F8', color:'#C13584', borderRadius:5, padding:'2px 8px', fontSize:11 }}>#{h}</span>)}</div>
            </div>

            <div style={{ background:T.white, border:`1px solid ${T.bdr}`, borderRadius:13, padding:'16px 18px', boxShadow:'0 1px 4px rgba(0,0,0,.05)' }}>
              <div style={{ fontSize:13, fontWeight:800, color:T.darkRed, marginBottom:10 }}>Send this campaign</div>
              <select value={target} onChange={e=>setTarget(e.target.value)} style={{ ...inp, width:'100%', cursor:'pointer', marginBottom:11 }}>
                <option value="all">All customers with a phone number</option>
                <option value="vip">VIP segment only</option>
                <option value="regular">Regular segment only</option>
              </select>
              <div style={{ display:'flex', gap:8 }}>
                <button onClick={postToInstagram} disabled={!imageUrl||posting} style={{ flex:1, ...btn('#C13584', T.white, { padding:'12px', fontSize:12.5, opacity: imageUrl?1:.5 }) }}>
                  {posting==='instagram'?'Posting…':'📷 Post to Instagram'}
                </button>
                <button onClick={sendWhatsApp} disabled={posting} style={{ flex:1, ...btn(T.green, T.white, { padding:'12px', fontSize:12.5 }) }}>
                  {posting==='whatsapp'?'Sending…':'💬 Send WhatsApp'}
                </button>
              </div>
              {!imageUrl && <div style={{ fontSize:10.5, color:T.muted, marginTop:8 }}>Generate the image on the right before posting to Instagram</div>}
              {postResult && (
                <div style={{ marginTop:11, background: postResult.ok?'#F0FDF4':'#FEF2F2', border:`1px solid ${postResult.ok?'#BBF7D0':'#FECACA'}`, borderRadius:8, padding:'10px 13px', fontSize:12, color: postResult.ok?T.green:T.red }}>
                  {postResult.ok?'✅':'⚠️'} {postResult.msg}
                </div>
              )}
            </div>
          </div>

          {/* Right: real generated image */}
          <div style={{ background:T.white, border:`1px solid ${T.bdr}`, borderRadius:13, padding:'16px 18px', boxShadow:'0 1px 4px rgba(0,0,0,.05)', display:'flex', flexDirection:'column' }}>
            <div style={{ fontSize:13, fontWeight:800, color:T.darkRed, marginBottom:4 }}>🎨 Generated Image</div>
            <div style={{ fontSize:10.5, color:T.muted, marginBottom:12 }}>{result.image_prompt}</div>

            {imageUrl ? (
              <img src={imageUrl} style={{ width:'100%', borderRadius:10, marginBottom:14, boxShadow:'0 4px 16px rgba(0,0,0,.15)' }}/>
            ) : (
              <div style={{ aspectRatio:'1', background:T.bg, borderRadius:10, display:'flex', alignItems:'center', justifyContent:'center', color:T.muted, marginBottom:14 }}>
                {imgBusy ? 'Generating…' : 'No image yet'}
              </div>
            )}

            <button onClick={generateImage} disabled={imgBusy} style={{ ...btn(T.purple, T.white, { padding:'11px', fontSize:13 }) }}>
              {imgBusy ? '🎨 Generating (10-20s)…' : imageUrl ? '🔄 Regenerate' : '🎨 Generate Image'}
            </button>
            {imgError && <div style={{ marginTop:10, background:'#FEF2F2', border:'1px solid #FECACA', borderRadius:8, padding:'10px 13px', fontSize:11.5, color:T.red }}>⚠️ {imgError}</div>}
            {imageUrl && <a href={imageUrl} download target="_blank" rel="noopener noreferrer" style={{ fontSize:11, color:T.blue, textAlign:'center', marginTop:9, textDecoration:'none', fontWeight:700 }}>Download PNG</a>}
          </div>
        </div>
      )}
    </div>
  );
}
