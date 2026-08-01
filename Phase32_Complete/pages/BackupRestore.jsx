import { useState } from 'react';
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

const TABLES = [
  { key:'inventory',    label:'Inventory',     icon:'📦', desc:'All products and stock levels' },
  { key:'customers',    label:'Customers',     icon:'👥', desc:'Customer profiles and balances' },
  { key:'sales',        label:'Sales',         icon:'🧾', desc:'All invoices and transactions' },
  { key:'expenses',     label:'Expenses',      icon:'💸', desc:'Expense records' },
  { key:'purchases',    label:'Purchases',     icon:'🛒', desc:'Purchase orders from suppliers' },
  { key:'suppliers',    label:'Suppliers',     icon:'🏭', desc:'Supplier profiles and contacts' },
  { key:'loyalty_txns', label:'Loyalty',       icon:'⭐', desc:'Loyalty points transactions' },
  { key:'attendance',   label:'Attendance',    icon:'📅', desc:'Staff attendance records' },
  { key:'repairs',      label:'Repairs',       icon:'🔧', desc:'Repair and service jobs' },
  { key:'gift_cards',   label:'Gift Cards',    icon:'🎁', desc:'Gift card ledger' },
];

export default function BackupRestore({ tenant }) {
  const [selected,  setSelected]  = useState(new Set(TABLES.map(t=>t.key)));
  const [backing,   setBacking]   = useState(false);
  const [progress,  setProgress]  = useState('');
  const [lastBackup,setLastBackup]= useState(null);
  const [restoring, setRestoring] = useState(false);
  const [restoreFile,setRestoreFile]=useState(null);
  const [restorePreview,setRestorePreview]=useState(null);

  function toggleTable(key) { setSelected(s=>{const n=new Set(s);n.has(key)?n.delete(key):n.add(key);return n;}); }

  async function runBackup() {
    setBacking(true);
    setProgress('Starting backup…');
    const backup = {
      metadata: { tenant_id:tenant.id, tenant_name:tenant.name, exported_at:new Date().toISOString(), tables:[] },
      data:{}
    };

    for (const table of TABLES.filter(t=>selected.has(t.key))) {
      setProgress(`Exporting ${table.label}…`);
      const { data, error } = await supabase.from(table.key).select('*').eq('tenant_id', tenant.id);
      if (!error) {
        backup.data[table.key] = data||[];
        backup.metadata.tables.push({ name:table.key, rows:(data||[]).length });
      }
    }

    setProgress('Generating file…');
    const json = JSON.stringify(backup, null, 2);
    const blob = new Blob([json], { type:'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    const date = new Date().toISOString().slice(0,10);
    a.href = url; a.download = `EliteStore_Backup_${tenant.name?.replace(/\s+/g,'_')}_${date}.json`; a.click();
    URL.revokeObjectURL(url);

    setLastBackup(new Date().toLocaleString('en-IN'));
    setProgress('');
    setBacking(false);
  }

  async function exportCSV(tableKey) {
    const { data } = await supabase.from(tableKey).select('*').eq('tenant_id', tenant.id);
    if (!data?.length) return alert('No data to export');
    const headers = Object.keys(data[0]).join(',');
    const rows    = data.map(r=>Object.values(r).map(v=>typeof v==='object'?JSON.stringify(v||''):String(v||'')).join(',')).join('\n');
    const csv     = headers + '\n' + rows;
    const blob    = new Blob([csv], { type:'text/csv' });
    const url     = URL.createObjectURL(blob);
    const a       = document.createElement('a');
    a.href = url; a.download = `${tableKey}_${new Date().toISOString().slice(0,10)}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  async function handleRestoreFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    const text = await file.text();
    try {
      const parsed = JSON.parse(text);
      if (!parsed.metadata || !parsed.data) throw new Error('Invalid backup file');
      setRestoreFile(parsed);
      setRestorePreview(parsed.metadata);
    } catch(err) { alert('Invalid backup file: ' + err.message); }
  }

  async function runRestore() {
    if (!restoreFile) return;
    if (!confirm(`⚠️ RESTORE FROM BACKUP\n\nThis will OVERWRITE existing data for the selected tables.\n\nBackup from: ${new Date(restoreFile.metadata.exported_at).toLocaleString('en-IN')}\n\nAre you sure?`)) return;
    setRestoring(true);
    setProgress('Restoring…');
    let restored = 0;
    for (const [tableName, rows] of Object.entries(restoreFile.data)) {
      if (!rows.length) continue;
      setProgress(`Restoring ${tableName} (${rows.length} rows)…`);
      try {
        await supabase.from(tableName).delete().eq('tenant_id', tenant.id);
        const CHUNK = 100;
        for (let i=0; i<rows.length; i+=CHUNK) {
          await supabase.from(tableName).upsert(rows.slice(i,i+CHUNK), { onConflict:'id' });
        }
        restored++;
      } catch(e) { console.error('Restore error for', tableName, e); }
    }
    setProgress('');
    setRestoring(false);
    setRestoreFile(null);
    setRestorePreview(null);
    alert(`✅ Restore complete — ${restored} tables restored`);
  }

  const totalSelected = selected.size;

  return (
    <div style={{ padding:20 }}>
      <div style={{ fontSize:22, fontWeight:800, color:T.ink, marginBottom:6 }}>💾 Backup & Restore</div>
      <div style={{ fontSize:13, color:T.sub, marginBottom:20 }}>Export your data or restore from a previous backup</div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:20 }}>
        {/* Backup */}
        <div>
          <div style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:12, padding:20, marginBottom:14 }}>
            <div style={{ fontWeight:700, color:T.ink, marginBottom:14, fontSize:15 }}>📤 Export Backup</div>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:10 }}>
              <div style={{ fontSize:12, color:T.sub }}>{totalSelected} of {TABLES.length} tables selected</div>
              <button onClick={()=>setSelected(s=>s.size===TABLES.length?new Set():new Set(TABLES.map(t=>t.key)))} style={{ background:'none', border:'none', color:T.blue, fontSize:11, cursor:'pointer', fontFamily:'inherit', fontWeight:700 }}>
                {selected.size===TABLES.length?'Deselect All':'Select All'}
              </button>
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:6, marginBottom:16 }}>
              {TABLES.map(table=>(
                <div key={table.key} onClick={()=>toggleTable(table.key)} style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 10px', background:selected.has(table.key)?T.blue+'18':T.card, border:`1px solid ${selected.has(table.key)?T.blue+'44':T.bdr+'44'}`, borderRadius:8, cursor:'pointer' }}>
                  <div style={{ width:16, height:16, border:`2px solid ${selected.has(table.key)?T.blue:T.bdr}`, borderRadius:3, background:selected.has(table.key)?T.blue:'transparent', display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, color:'#fff', flexShrink:0 }}>
                    {selected.has(table.key)?'✓':''}
                  </div>
                  <span style={{ fontSize:16 }}>{table.icon}</span>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:12, fontWeight:600, color:T.ink }}>{table.label}</div>
                    <div style={{ fontSize:10, color:T.muted }}>{table.desc}</div>
                  </div>
                  <button onClick={e=>{e.stopPropagation();exportCSV(table.key);}} style={{ background:T.teal+'22', color:T.teal, border:'none', borderRadius:5, padding:'3px 7px', fontSize:9, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>CSV</button>
                </div>
              ))}
            </div>
            {lastBackup&&<div style={{ fontSize:11, color:T.green, marginBottom:10 }}>✅ Last backup: {lastBackup}</div>}
            {progress&&<div style={{ fontSize:12, color:T.amber, marginBottom:10 }}>⏳ {progress}</div>}
            <button onClick={runBackup} disabled={backing||!totalSelected} style={{ width:'100%', background:T.blue, color:'#fff', border:'none', borderRadius:9, padding:'12px', fontSize:14, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>
              {backing?`⏳ ${progress||'Backing up…'}`:` ⬇️ Download Backup (${totalSelected} tables)`}
            </button>
          </div>

          <div style={{ background:T.amber+'12', border:`1px solid ${T.amber}44`, borderRadius:10, padding:'12px 16px', fontSize:12, color:T.amber, lineHeight:1.7 }}>
            <strong>💡 Tip:</strong> Schedule regular backups (weekly or before major changes). The backup file is JSON and can be used to restore or migrate to another account.
          </div>
        </div>

        {/* Restore */}
        <div>
          <div style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:12, padding:20, marginBottom:14 }}>
            <div style={{ fontWeight:700, color:T.ink, marginBottom:14, fontSize:15 }}>📥 Restore from Backup</div>
            <div style={{ background:T.red+'12', border:`1px solid ${T.red}44`, borderRadius:9, padding:'10px 14px', marginBottom:14, fontSize:12, color:T.red }}>
              ⚠️ Restore will overwrite existing data. Always take a fresh backup before restoring.
            </div>

            <div onClick={()=>document.getElementById('restoreInput').click()} style={{ border:`2px dashed ${T.bdr}`, borderRadius:10, padding:32, textAlign:'center', cursor:'pointer', background:T.card }}>
              <div style={{ fontSize:36, marginBottom:8 }}>📂</div>
              <div style={{ fontSize:14, color:T.ink, fontWeight:600 }}>Drop backup file or click to browse</div>
              <div style={{ fontSize:11, color:T.muted, marginTop:4 }}>Accepts .json backup files</div>
            </div>
            <input id="restoreInput" type="file" accept=".json" onChange={handleRestoreFile} style={{ display:'none' }}/>

            {restorePreview && (
              <div style={{ marginTop:14 }}>
                <div style={{ background:T.green+'18', border:`1px solid ${T.green}44`, borderRadius:9, padding:'12px 14px', marginBottom:12 }}>
                  <div style={{ fontSize:13, fontWeight:700, color:T.green, marginBottom:8 }}>✅ Valid Backup File</div>
                  <div style={{ fontSize:12, color:T.sub }}>From: {new Date(restorePreview.exported_at).toLocaleString('en-IN')}</div>
                  <div style={{ fontSize:12, color:T.sub }}>Account: {restorePreview.tenant_name}</div>
                  <div style={{ marginTop:8, fontSize:11, color:T.muted }}>
                    Tables: {restorePreview.tables.map(t=>`${t.name} (${t.rows})`).join(', ')}
                  </div>
                </div>
                {progress&&<div style={{ fontSize:12, color:T.amber, marginBottom:10 }}>⏳ {progress}</div>}
                <button onClick={runRestore} disabled={restoring} style={{ width:'100%', background:T.amber, color:'#fff', border:'none', borderRadius:9, padding:'12px', fontSize:14, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>
                  {restoring?`⏳ ${progress||'Restoring…'}`:'🔄 Start Restore'}
                </button>
              </div>
            )}
          </div>

          {/* Quick CSV exports */}
          <div style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:12, padding:18 }}>
            <div style={{ fontWeight:700, color:T.ink, marginBottom:12 }}>⬇️ Quick CSV Exports</div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
              {TABLES.slice(0,6).map(table=>(
                <button key={table.key} onClick={()=>exportCSV(table.key)} style={{ background:T.card, color:T.sub, border:`1px solid ${T.bdr}`, borderRadius:7, padding:'8px 10px', fontSize:11, fontWeight:600, cursor:'pointer', fontFamily:'inherit', textAlign:'left', display:'flex', alignItems:'center', gap:6 }}>
                  <span>{table.icon}</span><span>{table.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
