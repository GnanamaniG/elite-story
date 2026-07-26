import { useState, useEffect, useRef } from 'react';

const T = { bg:'#060710', srf:'#0f1220', card:'#141828', bdr:'#1e2540', blue:'#4f7cff', ink:'#eef0f8', sub:'#6b7598', muted:'#4a5175', green:'#00d68f', amber:'#ffb547', red:'#ff4d6a' };

export default function BarcodeScanner({ onScan, onClose }) {
  const scannerRef  = useRef(null);
  const html5QrRef  = useRef(null);
  const [error,     setError]     = useState('');
  const [scanning,  setScanning]  = useState(false);
  const [manualCode,setManualCode]= useState('');
  const [libLoaded, setLibLoaded] = useState(false);

  // Load html5-qrcode library (works in Chrome, Edge, Firefox, Safari)
  useEffect(() => {
    if (window.Html5Qrcode) { setLibLoaded(true); return; }
    const script = document.createElement('script');
    script.src = 'https://unpkg.com/html5-qrcode@2.3.8/html5-qrcode.min.js';
    script.onload = () => setLibLoaded(true);
    script.onerror = () => setError('Failed to load scanner library. Check internet connection.');
    document.head.appendChild(script);
  }, []);

  // Start scanner once library is loaded
  useEffect(() => {
    if (!libLoaded || !scannerRef.current) return;
    startScanner();
    return () => stopScanner();
  }, [libLoaded]);

  async function startScanner() {
    try {
      const qr = new window.Html5Qrcode('elite-scanner-div');
      html5QrRef.current = qr;

      await qr.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 250, height: 180 } },
        (decodedText) => {
          onScan(decodedText);
          stopScanner();
        },
        () => {} // ignore errors during scan
      );
      setScanning(true);
    } catch (e) {
      if (e.toString().includes('Permission')) {
        setError('Camera permission denied. Please allow camera access in your browser settings.');
      } else if (e.toString().includes('NotFound')) {
        setError('No camera found on this device.');
      } else {
        setError('Camera error: ' + e.toString());
      }
    }
  }

  async function stopScanner() {
    try {
      if (html5QrRef.current) {
        await html5QrRef.current.stop();
        html5QrRef.current = null;
      }
    } catch {}
    setScanning(false);
  }

  function handleClose() {
    stopScanner();
    onClose?.();
  }

  function handleManualSubmit(e) {
    e.preventDefault();
    if (manualCode.trim()) { onScan(manualCode.trim()); setManualCode(''); }
  }

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.85)', zIndex:300, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
      <div style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:16, overflow:'hidden', width:'100%', maxWidth:460 }}>

        {/* Header */}
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'14px 18px', borderBottom:`1px solid ${T.bdr}` }}>
          <div>
            <div style={{ fontSize:16, fontWeight:700, color:T.ink }}>📷 Barcode Scanner</div>
            <div style={{ fontSize:12, color: scanning ? T.green : T.amber, marginTop:2 }}>
              {!libLoaded ? '○ Loading scanner…' : scanning ? '● Scanning — point at barcode' : '○ Camera starting…'}
            </div>
          </div>
          <button onClick={handleClose} style={{ background:'none', border:'none', color:T.muted, cursor:'pointer', fontSize:24 }}>×</button>
        </div>

        {/* Camera view */}
        <div id="elite-scanner-div" ref={scannerRef} style={{ width:'100%', background:'#000', minHeight:260 }} />

        {/* Error */}
        {error && (
          <div style={{ padding:'12px 18px', background:T.amber+'18', color:T.amber, fontSize:13, lineHeight:1.6, borderBottom:`1px solid ${T.bdr}` }}>
            ⚠️ {error}
            {error.includes('permission') && (
              <div style={{ marginTop:6, fontSize:11, color:T.muted }}>
                Chrome: click 🔒 in address bar → Site settings → Camera → Allow
              </div>
            )}
          </div>
        )}

        {/* Manual entry */}
        <div style={{ padding:16 }}>
          <div style={{ fontSize:11, color:T.sub, fontWeight:700, textTransform:'uppercase', letterSpacing:'.05em', marginBottom:8 }}>
            Or Enter Barcode Manually
          </div>
          <form onSubmit={handleManualSubmit} style={{ display:'flex', gap:8 }}>
            <input
              type="text"
              value={manualCode}
              onChange={e => setManualCode(e.target.value)}
              placeholder="Type or paste barcode / item code…"
              autoFocus
              style={{ flex:1, background:T.card, border:`1px solid ${T.bdr}`, borderRadius:8, padding:'10px 14px', color:T.ink, fontSize:14, fontFamily:'inherit', outline:'none' }}
            />
            <button type="submit" style={{ background:T.blue, color:'#fff', border:'none', borderRadius:8, padding:'10px 16px', fontSize:14, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>
              Add
            </button>
          </form>
          <div style={{ fontSize:11, color:T.muted, marginTop:8 }}>
            💡 USB barcode scanners work automatically — just scan while POS search box is focused
          </div>
        </div>
      </div>
    </div>
  );
}
