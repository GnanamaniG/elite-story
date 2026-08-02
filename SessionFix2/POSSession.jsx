import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';

const T = {
  bg:'#F7F3F3', srf:'#FFFFFF', card:'#FFFFFF', bdr:'#E8DEDE',
  red:'#C0392B', darkRed:'#8B0000', lightRed:'#FEF2F2',
  green:'#16A34A', amber:'#D97706', blue:'#2563EB', purple:'#7C3AED',
  ink:'#111827', sub:'#6B7280', muted:'#9CA3AF', white:'#FFFFFF'
};
const fmt   = n => '₹' + (n||0).toLocaleString('en-IN', { maximumFractionDigits:0 });
const NOTES = [2000, 500, 200, 100, 50, 20, 10, 5];
const QUICK = [2000, 500, 200, 100, 50, 20, 10];

/**
 * Gate shown before POS opens.
 * Forces a counted opening float so the drawer can be reconciled at close.
 */
export default function POSSession({ tenant, user, activeBranch, onOpen }) {
  const [denoms,  setDenoms]  = useState({});
  const [manual,  setManual]  = useState('');
  const [mode,    setMode]    = useState('quick');   // quick | count
  const [saving,  setSaving]  = useState(false);
  const [error,   setError]   = useState(null);
  const [lastSession, setLastSession] = useState(null);

  useEffect(() => { if (tenant?.id) loadLast(); }, [tenant?.id]);

  async function loadLast() {
    const { data } = await supabase.from('cash_sessions')
      .select('*').eq('tenant_id', tenant.id).eq('status','closed')
      .order('closed_at', { ascending:false }).limit(1).maybeSingle();
    setLastSession(data||null);
  }

  const counted = NOTES.reduce((s,n)=>s + n*(denoms[n]||0), 0);
  const total   = mode==='count' ? counted : (parseFloat(manual)||0);

  function quickAdd(v) { setManual(m => String((parseFloat(m)||0) + v)); }

  async function open() {
    if (total <= 0) { setError('Enter the opening cash in the drawer'); return; }
    setSaving(true); setError(null);
    try {
      const base = {
        tenant_id: tenant.id,
        branch_id: activeBranch?.id || null,
        opening_float: total,
        denominations: mode==='count' ? denoms : null,
        opened_by_email: user?.email || null,
        status: 'open',
      };

      // Try with opened_by; if a foreign key rejects it, retry without.
      let { data, error:err } = await supabase.from('cash_sessions')
        .insert({ ...base, opened_by: user?.id || null }).select().single();

      if (err && /foreign key|violates/i.test(err.message||'')) {
        ({ data, error:err } = await supabase.from('cash_sessions')
          .insert(base).select().single());
      }
      if (err) throw err;
      onOpen?.(data);
    } catch (e) {
      setError(e.message || 'Could not open the session');
      setSaving(false);
    }
  }

  return (
    <div style={{ minHeight:'100%', background:T.bg, display:'flex', alignItems:'flex-start', justifyContent:'center', padding:'32px 20px 60px' }}>
      <div style={{ width:'100%', maxWidth:520 }}>

        {/* Header */}
        <div style={{ textAlign:'center', marginBottom:22 }}>
          <div style={{ fontSize:44, marginBottom:8 }}>🏪</div>
          <div style={{ fontSize:21, fontWeight:900, color:T.darkRed, letterSpacing:'-0.02em' }}>Open POS Session</div>
          <div style={{ fontSize:12.5, color:T.sub, marginTop:4 }}>
            {tenant?.name||'7SQ'}{activeBranch?.name ? ` · ${activeBranch.name}` : ''}
          </div>
        </div>

        {/* Previous session hint */}
        {lastSession&&(
          <div style={{
            background: (lastSession.difference||0)===0 ? '#F0FDF4' : '#FFFBEB',
            border:`1px solid ${(lastSession.difference||0)===0 ? '#BBF7D0' : '#FDE68A'}`,
            borderRadius:11, padding:'11px 16px', marginBottom:16, fontSize:12,
          }}>
            <span style={{ color:(lastSession.difference||0)===0 ? T.green : T.amber, fontWeight:600 }}>
              {(lastSession.difference||0)===0 ? '✅' : '⚠️'} Last session closed with {fmt(lastSession.closing_cash)} in the drawer
              {(lastSession.difference||0)!==0 && ` — ${lastSession.difference>0?'excess':'short'} by ${fmt(Math.abs(lastSession.difference))}`}
            </span>
          </div>
        )}

        <div style={{ background:T.white, border:`1px solid ${T.bdr}`, borderRadius:16, padding:'22px 24px', boxShadow:'0 3px 16px rgba(0,0,0,.06)' }}>

          <label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.06em', display:'block', marginBottom:8 }}>
            Opening Cash Balance
          </label>

          {/* Big amount display */}
          <div style={{
            background: total>0 ? '#F0FDF4' : T.bg,
            border:`2px solid ${total>0 ? T.green : T.bdr}`,
            borderRadius:12, padding:'18px', textAlign:'center', marginBottom:6,
          }}>
            {mode==='quick'
              ? <input type="number" value={manual} onChange={e=>setManual(e.target.value)} placeholder="0"
                  style={{ width:'100%', background:'transparent', border:'none', outline:'none', textAlign:'center',
                           fontSize:34, fontWeight:900, color: total>0?T.green:T.muted, fontFamily:'inherit', letterSpacing:'-0.02em' }}/>
              : <div style={{ fontSize:34, fontWeight:900, color: total>0?T.green:T.muted, letterSpacing:'-0.02em' }}>{counted.toLocaleString('en-IN')}</div>}
          </div>
          <div style={{ textAlign:'center', fontSize:11, color:T.sub, marginBottom:18 }}>
            Total in drawer: <strong style={{ color:T.ink }}>{fmt(total)}</strong>
          </div>

          {/* Mode switch */}
          <div style={{ display:'flex', background:T.bg, borderRadius:10, padding:4, gap:3, marginBottom:16 }}>
            {[['quick','⚡ Quick Add'],['count','🧮 Count Notes']].map(([v,l])=>(
              <button key={v} type="button" onClick={()=>setMode(v)}
                style={{ flex:1, padding:'9px', background: mode===v?T.red:'transparent', color: mode===v?T.white:T.sub,
                         border:'none', borderRadius:8, fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>{l}</button>
            ))}
          </div>

          {/* Quick add */}
          {mode==='quick'&&(
            <>
              <label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.06em', display:'block', marginBottom:8 }}>
                Quick Add Denomination
              </label>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:8, marginBottom:6 }}>
                {QUICK.map(v=>(
                  <button key={v} type="button" onClick={()=>quickAdd(v)}
                    style={{ background:T.bg, border:`1px solid ${T.bdr}`, borderRadius:9, padding:'11px 4px',
                             fontSize:12.5, fontWeight:700, color:T.ink, cursor:'pointer', fontFamily:'inherit' }}>
                    +₹{v.toLocaleString('en-IN')}
                  </button>
                ))}
                <button type="button" onClick={()=>{ setManual(''); setDenoms({}); }}
                  style={{ background:T.lightRed, border:`1px solid #FECACA`, borderRadius:9, padding:'11px 4px',
                           fontSize:12.5, fontWeight:700, color:T.red, cursor:'pointer', fontFamily:'inherit' }}>Reset</button>
              </div>
            </>
          )}

          {/* Denomination counter */}
          {mode==='count'&&(
            <div style={{ background:T.bg, borderRadius:11, padding:'14px 16px', marginBottom:6 }}>
              <div style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:10 }}>
                Count Denominations
              </div>
              {NOTES.map(n=>(
                <div key={n} style={{ display:'flex', alignItems:'center', gap:10, padding:'5px 0' }}>
                  <span style={{ fontSize:12.5, color:T.ink, fontWeight:600, width:52 }}>₹{n.toLocaleString('en-IN')}</span>
                  <span style={{ color:T.muted, fontSize:12 }}>×</span>
                  <input type="number" min="0" value={denoms[n]||''} placeholder="0"
                    onChange={e=>setDenoms(d=>({ ...d, [n]: parseInt(e.target.value)||0 }))}
                    style={{ width:72, background:T.white, border:`1px solid ${T.bdr}`, borderRadius:7,
                             padding:'7px 9px', fontSize:13, textAlign:'center', fontFamily:'inherit', outline:'none', fontWeight:700 }}/>
                  <span style={{ marginLeft:'auto', fontSize:12.5, color: denoms[n]>0?T.green:T.muted, fontWeight:denoms[n]>0?700:400 }}>
                    = {fmt(n*(denoms[n]||0))}
                  </span>
                </div>
              ))}
              <div style={{ display:'flex', justifyContent:'space-between', marginTop:12, paddingTop:11, borderTop:`1px solid ${T.bdr}` }}>
                <span style={{ fontSize:12, color:T.sub, fontWeight:700 }}>Counted total</span>
                <span style={{ fontSize:16, fontWeight:900, color:T.green }}>{fmt(counted)}</span>
              </div>
            </div>
          )}

          {error&&<div style={{ background:'#FEF2F2', border:'1px solid #FECACA', borderRadius:9, padding:'10px 14px', margin:'14px 0 0', fontSize:12, color:T.red }}>⚠️ {error}</div>}

          <button onClick={open} disabled={saving||total<=0}
            style={{ width:'100%', marginTop:18, background: total>0?T.green:T.bdr, color:T.white, border:'none',
                     borderRadius:11, padding:'15px', fontSize:15, fontWeight:800, cursor: total>0?'pointer':'not-allowed', fontFamily:'inherit' }}>
            {saving ? 'Opening…' : total>0 ? `Open Session → ${fmt(total)} cash` : 'Enter opening cash'}
          </button>

          <div style={{ fontSize:11, color:T.muted, textAlign:'center', marginTop:10 }}>
            The opening balance is recorded and reconciled when you close the session
          </div>
        </div>
      </div>
    </div>
  );
}
