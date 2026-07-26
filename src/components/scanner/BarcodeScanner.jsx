import { useState, useEffect, useRef, useCallback } from 'react';

const T = { bg:'#060710', srf:'#0f1220', card:'#141828', bdr:'#1e2540', blue:'#4f7cff', ink:'#eef0f8', sub:'#6b7598', muted:'#4a5175', green:'#00d68f', amber:'#ffb547', red:'#ff4d6a' };

/**
 * BarcodeScanner — Camera-based barcode/QR scanner
 * Uses Web Barcode Detection API (Chrome 83+) with fallback
 *
 * Props:
 *  onScan(code)  — called when a barcode is detected
 *  onClose()     — called when scanner is dismissed
 */
export default function BarcodeScanner({ onScan, onClose }) {
  const videoRef      = useRef(null);
  const streamRef     = useRef(null);
  const detectorRef   = useRef(null);
  const animFrameRef  = useRef(null);
  const [error,       setError]       = useState('');
  const [scanning,    setScanning]    = useState(false);
  const [lastCode,    setLastCode]    = useState('');
  const [manualCode,  setManualCode]  = useState('');
  const [showManual,  setShowManual]  = useState(false);

  useEffect(() => {
    startCamera();
    return () => stopCamera();
  }, []);

  async function startCamera() {
    // Check if Barcode Detection API is available
    if (!('BarcodeDetector' in window)) {
      setShowManual(true);
      setError('Camera scanner not supported in this browser. Use manual entry or Chrome.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      // Create barcode detector
      detectorRef.current = new window.BarcodeDetector({
        formats: ['code_128','code_39','code_93','ean_13','ean_8','qr_code','upc_a','upc_e','itf','codabar']
      });

      setScanning(true);
      scanLoop();
    } catch (e) {
      if (e.name === 'NotAllowedError') {
        setError('Camera permission denied. Please allow camera access or use manual entry.');
      } else {
        setError('Camera not available: ' + e.message);
      }
      setShowManual(true);
    }
  }

  const scanLoop = useCallback(async () => {
    if (!videoRef.current || !detectorRef.current) return;
    if (videoRef.current.readyState < 2) {
      animFrameRef.current = requestAnimationFrame(scanLoop);
      return;
    }

    try {
      const barcodes = await detectorRef.current.detect(videoRef.current);
      if (barcodes.length > 0) {
        const code = barcodes[0].rawValue;
        if (code && code !== lastCode) {
          setLastCode(code);
          // Flash success
          onScan(code);
          // Debounce — wait 2s before scanning again
          setTimeout(() => setLastCode(''), 2000);
          return;
        }
      }
    } catch (e) {
      // Detection errors are normal (empty frame, etc.)
    }

    animFrameRef.current = requestAnimationFrame(scanLoop);
  }, [lastCode, onScan]);

  function stopCamera() {
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
    setScanning(false);
  }

  function handleManualSubmit(e) {
    e.preventDefault();
    if (manualCode.trim()) {
      onScan(manualCode.trim());
      setManualCode('');
    }
  }

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.85)', zIndex:300, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
      <div style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:16, overflow:'hidden', width:'100%', maxWidth:480 }}>

        {/* Header */}
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'16px 20px', borderBottom:`1px solid ${T.bdr}` }}>
          <div>
            <div style={{ fontSize:16, fontWeight:700, color:T.ink }}>📷 Barcode Scanner</div>
            <div style={{ fontSize:12, color: scanning ? T.green : T.amber, marginTop:2 }}>
              {scanning ? '● Scanning…' : '○ Camera off'}
            </div>
          </div>
          <button onClick={() => { stopCamera(); onClose?.(); }} style={{ background:'none', border:'none', color:T.muted, cursor:'pointer', fontSize:24 }}>×</button>
        </div>

        {/* Camera view */}
        {!showManual && (
          <div style={{ position:'relative', background:'#000', aspectRatio:'4/3' }}>
            <video ref={videoRef} style={{ width:'100%', height:'100%', objectFit:'cover' }} playsInline muted />

            {/* Scanning overlay */}
            <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center', pointerEvents:'none' }}>
              <div style={{ width:240, height:160, border:`2px solid ${T.green}`, borderRadius:12, boxShadow:`0 0 0 4000px rgba(0,0,0,.4)`, position:'relative' }}>
                {/* Corner indicators */}
                {[['0','0','borderTop','borderLeft'],['0','auto','borderTop','borderRight'],['auto','0','borderBottom','borderLeft'],['auto','auto','borderBottom','borderRight']].map(([t,r,bt,bl],i)=>(
                  <div key={i} style={{ position:'absolute', top:t, right:r, bottom:t==='auto'?0:undefined, left:r==='auto'?undefined:0, width:20, height:20, [bt]:`3px solid ${T.blue}`, [bl]:`3px solid ${T.blue}` }} />
                ))}
                {/* Scanning line */}
                {scanning && <div style={{ position:'absolute', left:4, right:4, height:2, background:T.green, top:'50%', boxShadow:`0 0 8px ${T.green}`, animation:'scan 2s ease-in-out infinite' }} />}
              </div>
            </div>

            {/* Last scanned */}
            {lastCode && (
              <div style={{ position:'absolute', bottom:12, left:12, right:12, background:T.green, color:'#fff', borderRadius:8, padding:'8px 14px', fontSize:13, fontWeight:700, textAlign:'center' }}>
                ✓ Found: {lastCode}
              </div>
            )}
          </div>
        )}

        {/* Error */}
        {error && (
          <div style={{ padding:'12px 20px', background:T.amber+'18', color:T.amber, fontSize:13, borderBottom:`1px solid ${T.bdr}` }}>
            ⚠️ {error}
          </div>
        )}

        {/* Manual entry */}
        <div style={{ padding:16 }}>
          <div style={{ fontSize:11, color:T.sub, fontWeight:700, textTransform:'uppercase', marginBottom:8 }}>
            {showManual ? 'Enter Barcode Manually' : 'Or Enter Barcode Manually'}
          </div>
          <form onSubmit={handleManualSubmit} style={{ display:'flex', gap:8 }}>
            <input
              type="text"
              value={manualCode}
              onChange={e => setManualCode(e.target.value)}
              placeholder="Type or paste barcode / item code…"
              autoFocus={showManual}
              style={{ flex:1, background:T.card, border:`1px solid ${T.bdr}`, borderRadius:8, padding:'10px 14px', color:T.ink, fontSize:14, fontFamily:'inherit', outline:'none' }}
            />
            <button type="submit" style={{ background:T.blue, color:'#fff', border:'none', borderRadius:8, padding:'10px 16px', fontSize:14, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>
              Add
            </button>
          </form>
          <div style={{ fontSize:11, color:T.muted, marginTop:8 }}>
            💡 USB barcode scanners work automatically — just click the search box in POS and scan
          </div>
        </div>
      </div>

      <style>{`
        @keyframes scan {
          0%,100% { top: 10%; }
          50%      { top: 85%; }
        }
      `}</style>
    </div>
  );
}
