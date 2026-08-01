import { useEffect, useRef } from 'react';

// Sequence map: first key → { second key: [pageId, tabId] }
const SEQUENCES = {
  g: { // Go to
    d:['dashboard'],      p:['pos'],           s:['saleshub'],
    i:['invhub'],         c:['custhub'],       b:['purchhub'],
    r:['reportshub'],     a:['accountinghub'], h:['hrhub'],
    t:['toolshub'],       e:['expenses'],      o:['opshub'],
    m:['marketinghub'],   l:['loyaltyhub'],    x:['gsthub'],
  },
  n: { // New
    s:['pos'],                   i:['invhub','products'],
    c:['custhub','list'],        p:['purchhub','history'],
    e:['expenses'],              q:['saleshub','quotations'],
  },
};

function isTyping(el) {
  if (!el) return false;
  const tag = el.tagName?.toLowerCase();
  return tag==='input' || tag==='textarea' || tag==='select' || el.isContentEditable;
}

export function useShortcuts({ onNavigate, onPalette, onHelp, onToggleSidebar, enabled = true }) {
  const seqRef   = useRef(null);
  const timerRef = useRef(null);

  useEffect(() => {
    if (!enabled) return;

    function handler(e) {
      const typing = isTyping(document.activeElement);

      // ── Ctrl / Cmd combos ────────────────────────────────
      if (e.ctrlKey || e.metaKey) {
        const k = e.key.toLowerCase();
        if (k==='k') { e.preventDefault(); onPalette?.(); return; }
        if (k==='b' && !typing) { e.preventDefault(); onToggleSidebar?.(); return; }
        if (k==='/' && !typing) {
          e.preventDefault();
          const search = document.querySelector('input[placeholder*="earch" i]');
          search?.focus();
          return;
        }
        return;
      }

      if (typing) return;

      // ── ? for help ───────────────────────────────────────
      if (e.key==='?' || (e.key==='/' && e.shiftKey)) { e.preventDefault(); onHelp?.(); return; }

      // ── Escape clears any pending sequence ───────────────
      if (e.key==='Escape') { seqRef.current=null; clearTimeout(timerRef.current); return; }

      const key = e.key.toLowerCase();

      // ── Second key of a sequence ─────────────────────────
      if (seqRef.current) {
        const map = SEQUENCES[seqRef.current];
        const target = map?.[key];
        seqRef.current = null;
        clearTimeout(timerRef.current);
        if (target) { e.preventDefault(); onNavigate?.(target[0], target[1]); }
        return;
      }

      // ── First key of a sequence ──────────────────────────
      if (SEQUENCES[key]) {
        e.preventDefault();
        seqRef.current = key;
        clearTimeout(timerRef.current);
        timerRef.current = setTimeout(()=>{ seqRef.current=null; }, 1500);
        // Broadcast so the UI can show a hint
        window.dispatchEvent(new CustomEvent('seq-start', { detail:{ key } }));
        setTimeout(()=>{ if(!seqRef.current) window.dispatchEvent(new CustomEvent('seq-end')); }, 1500);
      }
    }

    window.addEventListener('keydown', handler);
    return () => { window.removeEventListener('keydown', handler); clearTimeout(timerRef.current); };
  }, [enabled, onNavigate, onPalette, onHelp, onToggleSidebar]);

  return seqRef;
}

export default useShortcuts;
