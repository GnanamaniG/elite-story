import { useState, useEffect, useRef } from 'react';
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
const BUCKET = 'elite-store-docs';

async function uploadFile(file, tenantId) {
  const path = `${tenantId}/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g,'_')}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, { upsert:false });
  if (error) throw error;
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return { path, url: data.publicUrl };
}

export default function Documents({ tenant }) {
  const [docs,     setDocs]     = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [uploading,setUploading]= useState(false);
  const [filter,   setFilter]   = useState('all');
  const [search,   setSearch]   = useState('');
  const [note,     setNote]     = useState('');
  const [relType,  setRelType]  = useState('purchase');
  const [preview,  setPreview]  = useState(null);
  const fileRef = useRef();

  useEffect(() => { if (tenant?.id) load(); }, [tenant?.id]);

  async function load() {
    setLoading(true);
    const { data } = await supabase.from('documents').select('*').eq('tenant_id', tenant.id).order('created_at', { ascending:false });
    setDocs(data || []);
    setLoading(false);
  }

  async function handleUpload(e) {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    setUploading(true);
    try {
      for (const file of files) {
        const { path, url } = await uploadFile(file, tenant.id);
        await supabase.from('documents').insert({
          tenant_id: tenant.id, name: file.name, file_path: path,
          file_type: file.type, file_size: file.size, related_type: relType, note,
        });
      }
      setNote('');
      await load();
    } catch (e) { alert('Upload failed: ' + e.message); }
    finally { setUploading(false); }
  }

  async function deleteDoc(doc) {
    if (!confirm(`Delete "${doc.name}"?`)) return;
    await supabase.storage.from(BUCKET).remove([doc.file_path]);
    await supabase.from('documents').delete().eq('id', doc.id);
    setDocs(prev => prev.filter(d => d.id !== doc.id));
  }

  function getPublicUrl(path) {
    const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
    return data.publicUrl;
  }

  function fileIcon(type) {
    if (type?.includes('pdf'))   return '📄';
    if (type?.includes('image')) return '🖼️';
    if (type?.includes('excel') || type?.includes('sheet')) return '📊';
    return '📎';
  }

  function fmtSize(bytes) {
    if (!bytes) return '—';
    if (bytes < 1024) return bytes + 'B';
    if (bytes < 1048576) return (bytes/1024).toFixed(1) + 'KB';
    return (bytes/1048576).toFixed(1) + 'MB';
  }

  const TYPES = ['all','purchase','expense','sale','supplier','other'];
  const displayed = docs.filter(d => (filter==='all'||d.related_type===filter) && (!search||d.name.toLowerCase().includes(search.toLowerCase())||d.note?.toLowerCase().includes(search.toLowerCase())));

  return (
    <div style={{ padding:20 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
        <div>
          <div style={{ fontSize:22, fontWeight:800, color:T.ink }}>Document Manager</div>
          <div style={{ fontSize:13, color:T.sub }}>{docs.length} documents · Bills, receipts, photos</div>
        </div>
        <button onClick={() => fileRef.current.click()} disabled={uploading}
          style={{ background:T.blue, color:'#fff', border:'none', borderRadius:9, padding:'10px 18px', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>
          {uploading ? '⏳ Uploading…' : '⬆️ Upload Files'}
        </button>
      </div>

      {/* Upload options */}
      <div style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:12, padding:16, marginBottom:16, display:'flex', gap:12, alignItems:'center', flexWrap:'wrap' }}>
        <div>
          <label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:5 }}>Category</label>
          <select value={relType} onChange={e=>setRelType(e.target.value)} style={{ background:T.card, border:`1px solid ${T.bdr}`, borderRadius:7, padding:'7px 12px', color:T.ink, fontSize:13, fontFamily:'inherit', outline:'none', cursor:'pointer' }}>
            {['purchase','expense','sale','supplier','other'].map(t=><option key={t} value={t} style={{ textTransform:'capitalize' }}>{t.charAt(0).toUpperCase()+t.slice(1)}</option>)}
          </select>
        </div>
        <div style={{ flex:1 }}>
          <label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:5 }}>Note</label>
          <input value={note} onChange={e=>setNote(e.target.value)} placeholder="e.g. Nike purchase bill Jan 2025"
            style={{ background:T.card, border:`1px solid ${T.bdr}`, borderRadius:7, padding:'7px 12px', color:T.ink, fontSize:13, fontFamily:'inherit', outline:'none', width:'100%' }} />
        </div>
        <div style={{ marginTop:18 }}>
          <button onClick={() => fileRef.current.click()} style={{ background:T.teal+'22', color:T.teal, border:`1px solid ${T.teal}44`, borderRadius:8, padding:'8px 16px', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>
            📎 Choose Files
          </button>
        </div>
        <input ref={fileRef} type="file" multiple accept="image/*,.pdf,.xlsx,.xls,.csv" onChange={handleUpload} style={{ display:'none' }} />
      </div>

      {/* Filters */}
      <div style={{ display:'flex', gap:8, marginBottom:14, flexWrap:'wrap' }}>
        {TYPES.map(t=>(
          <button key={t} onClick={()=>setFilter(t)} style={{ background:filter===t?T.blue:T.srf, color:filter===t?'#fff':T.sub, border:`1px solid ${filter===t?T.blue:T.bdr}`, borderRadius:20, padding:'5px 14px', fontSize:12, cursor:'pointer', fontFamily:'inherit', textTransform:'capitalize' }}>
            {t} {t!=='all'&&`(${docs.filter(d=>d.related_type===t).length})`}
          </button>
        ))}
      </div>

      <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="🔍 Search documents…"
        style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:9, padding:'10px 14px', color:T.ink, fontSize:13, fontFamily:'inherit', outline:'none', width:'100%', marginBottom:14 }} />

      {/* Document grid */}
      {loading ? <div style={{ textAlign:'center', color:T.sub, padding:60 }}>Loading…</div>
      : displayed.length === 0 ? (
        <div style={{ textAlign:'center', color:T.muted, padding:60 }}>
          <div style={{ fontSize:40, marginBottom:12 }}>📂</div>
          <div style={{ fontSize:15, color:T.sub, marginBottom:6 }}>No documents yet</div>
          <div style={{ fontSize:12 }}>Upload bills, receipts, and photos to keep everything organized</div>
        </div>
      ) : (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))', gap:12 }}>
          {displayed.map(doc => {
            const url  = getPublicUrl(doc.file_path);
            const isImg= doc.file_type?.includes('image');
            return (
              <div key={doc.id} style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:12, overflow:'hidden' }}>
                {isImg ? (
                  <div onClick={()=>setPreview(url)} style={{ height:140, background:T.card, cursor:'pointer', overflow:'hidden', display:'flex', alignItems:'center', justifyContent:'center' }}>
                    <img src={url} alt={doc.name} style={{ width:'100%', height:'100%', objectFit:'cover' }} onError={e=>e.target.style.display='none'} />
                  </div>
                ) : (
                  <div onClick={()=>window.open(url,'_blank')} style={{ height:140, background:T.card, display:'flex', alignItems:'center', justifyContent:'center', fontSize:48, cursor:'pointer' }}>
                    {fileIcon(doc.file_type)}
                  </div>
                )}
                <div style={{ padding:'10px 12px' }}>
                  <div style={{ fontSize:12, fontWeight:600, color:T.ink, marginBottom:3, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{doc.name}</div>
                  {doc.note&&<div style={{ fontSize:11, color:T.sub, marginBottom:3 }}>{doc.note}</div>}
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                    <span style={{ background:T.blue+'22', color:T.blue, borderRadius:5, padding:'2px 7px', fontSize:9, fontWeight:700, textTransform:'uppercase' }}>{doc.related_type}</span>
                    <span style={{ fontSize:10, color:T.muted }}>{fmtSize(doc.file_size)}</span>
                  </div>
                  <div style={{ display:'flex', gap:6, marginTop:8 }}>
                    <a href={url} target="_blank" rel="noopener noreferrer" style={{ flex:1, background:T.card, color:T.sub, borderRadius:6, padding:'5px', fontSize:11, textAlign:'center', textDecoration:'none' }}>⬇️ Open</a>
                    <button onClick={()=>deleteDoc(doc)} style={{ background:T.red+'22', color:T.red, border:'none', borderRadius:6, padding:'5px 8px', fontSize:11, cursor:'pointer', fontFamily:'inherit' }}>🗑️</button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Image preview modal */}
      {preview && (
        <div onClick={()=>setPreview(null)} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.9)', zIndex:300, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer' }}>
          <img src={preview} alt="Preview" style={{ maxWidth:'90vw', maxHeight:'90vh', objectFit:'contain', borderRadius:8 }} />
        </div>
      )}
    </div>
  );
}
