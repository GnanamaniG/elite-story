import { useState, useEffect } from 'react';
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
const fmt = n => (n||0).toFixed(2);

const DEFAULT_LEDGERS = {
  sales:       'Sales Account',
  purchases:   'Purchase Account',
  cgst_out:    'CGST Payable',
  sgst_out:    'SGST Payable',
  cgst_in:     'CGST Receivable',
  sgst_in:     'SGST Receivable',
  cash:        'Cash-in-hand',
  bank:        'State Bank of India',
  upi:         'UPI Account',
  card:        'HDFC Credit Card',
  debtors:     'Sundry Debtors',
  creditors:   'Sundry Creditors',
};

const EXP_LEDGERS = {
  Rent:        'Rent Expenses',
  Salary:      'Salary Expenses',
  Electricity: 'Electricity Charges',
  Transport:   'Conveyance Expenses',
  Marketing:   'Advertisement Expenses',
  Miscellaneous:'Miscellaneous Expenses',
};

function buildSaleXML(sale, ledgers, companyName) {
  const items  = sale.items || [];
  const taxable= (sale.subtotal||sale.total||0);
  const cgst   = (sale.gst_amount||0)/2;
  const sgst   = cgst;
  const payMode= sale.payment_mode || 'cash';
  const payLedger = payMode==='upi'?ledgers.upi:payMode==='card'?ledgers.card:ledgers.cash;

  return `  <VOUCHER VCHTYPE="Sales" ACTION="Create">
    <DATE>${(sale.date||'').replace(/-/g,'')}</DATE>
    <NARRATION>Invoice ${sale.inv_num||''} - ${sale.customer||'Walk-in'}</NARRATION>
    <VOUCHERTYPENAME>Sales</VOUCHERTYPENAME>
    <PARTYLEDGERNAME>${sale.customer||'Walk-in Customer'}</PARTYLEDGERNAME>
    <ALLLEDGERENTRIES.LIST>
      <LEDGERNAME>${sale.customer||'Walk-in Customer'}</LEDGERNAME>
      <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
      <AMOUNT>-${fmt(sale.total||0)}</AMOUNT>
    </ALLLEDGERENTRIES.LIST>
    <ALLLEDGERENTRIES.LIST>
      <LEDGERNAME>${ledgers.sales}</LEDGERNAME>
      <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
      <AMOUNT>${fmt(taxable)}</AMOUNT>
    </ALLLEDGERENTRIES.LIST>
    ${cgst>0?`<ALLLEDGERENTRIES.LIST>
      <LEDGERNAME>${ledgers.cgst_out}</LEDGERNAME>
      <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
      <AMOUNT>${fmt(cgst)}</AMOUNT>
    </ALLLEDGERENTRIES.LIST>`:''}
    ${sgst>0?`<ALLLEDGERENTRIES.LIST>
      <LEDGERNAME>${ledgers.sgst_out}</LEDGERNAME>
      <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
      <AMOUNT>${fmt(sgst)}</AMOUNT>
    </ALLLEDGERENTRIES.LIST>`:''}
    <ALLLEDGERENTRIES.LIST>
      <LEDGERNAME>${payLedger}</LEDGERNAME>
      <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
      <AMOUNT>${fmt(sale.total||0)}</AMOUNT>
    </ALLLEDGERENTRIES.LIST>
  </VOUCHER>`;
}

function buildExpenseXML(exp, ledgers, expLedgers) {
  const ledger = expLedgers[exp.category] || `${exp.category} Expenses`;
  return `  <VOUCHER VCHTYPE="Payment" ACTION="Create">
    <DATE>${(exp.date||'').replace(/-/g,'')}</DATE>
    <NARRATION>${exp.category} - ${exp.description||exp.note||''}</NARRATION>
    <VOUCHERTYPENAME>Payment</VOUCHERTYPENAME>
    <ALLLEDGERENTRIES.LIST>
      <LEDGERNAME>${ledger}</LEDGERNAME>
      <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
      <AMOUNT>-${fmt(exp.amount||0)}</AMOUNT>
    </ALLLEDGERENTRIES.LIST>
    <ALLLEDGERENTRIES.LIST>
      <LEDGERNAME>${ledgers.cash}</LEDGERNAME>
      <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
      <AMOUNT>${fmt(exp.amount||0)}</AMOUNT>
    </ALLLEDGERENTRIES.LIST>
  </VOUCHER>`;
}

export default function TallyExport({ tenant }) {
  const [period,     setPeriod]     = useState(new Date().toISOString().slice(0,7));
  const [ledgers,    setLedgers]    = useState({ ...DEFAULT_LEDGERS });
  const [expLedgers, setExpLedgers] = useState({ ...EXP_LEDGERS });
  const [companyName,setCompanyName]= useState(tenant?.name||'');
  const [loading,    setLoading]    = useState(false);
  const [stats,      setStats]      = useState(null);
  const [tab,        setTab]        = useState('ledgers'); // ledgers | preview | export
  const [xmlPreview, setXmlPreview] = useState('');

  useEffect(() => { if (tenant?.name) setCompanyName(tenant.name); }, [tenant?.name]);

  async function loadStats() {
    setLoading(true);
    const [sales, expenses, purchases] = await Promise.all([
      (await supabase.from('sales').select('*').eq('tenant_id',tenant.id).order('date',{ascending:false}).limit(1000).then(r=>r.data||[])),
      (await supabase.from('expenses').select('*').eq('tenant_id',tenant.id).then(r=>r.data||[])),
      (await supabase.from('purchases').select('*').eq('tenant_id',tenant.id).then(r=>r.data||[])),
    ]);
    const mSales = sales.filter(s=>(s.date||'').startsWith(period));
    const mExp   = expenses.filter(e=>(e.date||'').startsWith(period));
    const mPurch = purchases.filter(p=>(p.date||'').startsWith(period));
    setStats({ sales:mSales, expenses:mExp, purchases:mPurch });
    setLoading(false);
  }

  async function generateXML(type='all') {
    if (!stats) await loadStats();
    const data = stats || { sales:[], expenses:[], purchases:[] };
    const cn   = companyName || tenant?.name || 'Company';
    let xml = `<?xml version="1.0" encoding="UTF-8"?>
<ENVELOPE>
  <HEADER>
    <TALLYREQUEST>Import Data</TALLYREQUEST>
  </HEADER>
  <BODY>
    <IMPORTDATA>
      <REQUESTDESC>
        <REPORTNAME>Vouchers</REPORTNAME>
        <STATICVARIABLES>
          <SVCURRENTCOMPANY>${cn}</SVCURRENTCOMPANY>
        </STATICVARIABLES>
      </REQUESTDESC>
      <REQUESTDATA>\n`;

    if (type==='all'||type==='sales')
      xml += data.sales.map(s=>buildSaleXML(s,ledgers,cn)).join('\n');
    if (type==='all'||type==='expenses')
      xml += data.expenses.map(e=>buildExpenseXML(e,ledgers,expLedgers)).join('\n');

    xml += `\n      </REQUESTDATA>
    </IMPORTDATA>
  </BODY>
</ENVELOPE>`;
    return xml;
  }

  async function previewXML() {
    if (!stats) await loadStats();
    const xml = await generateXML();
    setXmlPreview(xml.slice(0,3000)+'...\n[Truncated — full file downloads below]');
    setTab('preview');
  }

  async function downloadXML(type) {
    if (!stats) await loadStats();
    const xml  = await generateXML(type);
    const blob = new Blob([xml], { type:'application/xml' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = `Tally_${type}_${period}.xml`; a.click();
    URL.revokeObjectURL(url);
  }

  const inp = { background:T.card, border:`1px solid ${T.bdr}`, borderRadius:7, padding:'7px 10px', color:T.ink, fontSize:12, fontFamily:'inherit', outline:'none', width:'100%' };
  const lbl = { fontSize:9, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:4 };

  return (
    <div style={{ padding:20 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
        <div>
          <div style={{ fontSize:22, fontWeight:800, color:T.ink }}>📊 Tally Export</div>
          <div style={{ fontSize:13, color:T.sub }}>Export sales, purchases & expenses to Tally XML</div>
        </div>
        <div style={{ display:'flex', gap:8, alignItems:'center' }}>
          <input type="month" value={period} onChange={e=>setPeriod(e.target.value)} style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:8, padding:'8px 12px', color:T.ink, fontSize:13, fontFamily:'inherit', outline:'none' }}/>
          <button onClick={loadStats} disabled={loading} style={{ background:T.blue+'22', color:T.blue, border:`1px solid ${T.blue}44`, borderRadius:8, padding:'9px 14px', fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>{loading?'Loading…':'🔄 Load Data'}</button>
        </div>
      </div>

      {stats && (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12, marginBottom:16 }}>
          {[['Sales Vouchers',stats.sales.length,T.blue],['Expense Vouchers',stats.expenses.length,T.red],['Purchase Vouchers',stats.purchases.length,T.amber]].map(([label,val,color])=>(
            <div key={label} style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:10, padding:'12px 16px' }}>
              <div style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', marginBottom:5 }}>{label}</div>
              <div style={{ fontSize:20, fontWeight:800, color }}>{val}</div>
            </div>
          ))}
        </div>
      )}

      <div style={{ display:'flex', gap:6, marginBottom:16 }}>
        {[['ledgers','🗂️ Ledger Mapping'],['preview','👁 XML Preview'],['export','⬇️ Export']].map(([id,label])=>(
          <button key={id} onClick={()=>id==='preview'?previewXML():setTab(id)} style={{ background:tab===id?T.blue:T.srf, color:tab===id?'#fff':T.sub, border:`1px solid ${tab===id?T.blue:T.bdr}`, borderRadius:7, padding:'7px 14px', fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}>{label}</button>
        ))}
      </div>

      {tab === 'ledgers' && (
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
          <div style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:12, padding:18 }}>
            <div style={{ fontWeight:700, color:T.ink, marginBottom:14 }}>Company & Account Ledgers</div>
            <div style={{ marginBottom:12 }}>
              <label style={lbl}>Tally Company Name</label>
              <input value={companyName} onChange={e=>setCompanyName(e.target.value)} style={inp}/>
            </div>
            {Object.entries(DEFAULT_LEDGERS).map(([key,def])=>(
              <div key={key} style={{ marginBottom:8 }}>
                <label style={lbl}>{key.replace(/_/g,' ').toUpperCase()}</label>
                <input value={ledgers[key]||''} onChange={e=>setLedgers(l=>({...l,[key]:e.target.value}))} placeholder={def} style={inp}/>
              </div>
            ))}
          </div>
          <div style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:12, padding:18 }}>
            <div style={{ fontWeight:700, color:T.ink, marginBottom:14 }}>Expense Category → Tally Ledger</div>
            {Object.entries(EXP_LEDGERS).map(([cat,def])=>(
              <div key={cat} style={{ marginBottom:8 }}>
                <label style={lbl}>{cat}</label>
                <input value={expLedgers[cat]||''} onChange={e=>setExpLedgers(l=>({...l,[cat]:e.target.value}))} placeholder={def} style={inp}/>
              </div>
            ))}
            <div style={{ marginTop:12, background:T.card, borderRadius:8, padding:'10px 12px', fontSize:11, color:T.muted, lineHeight:1.6 }}>
              💡 Ledger names must exactly match what's in your Tally company. Import the XML via: Tally → Gateway → Import Data → Vouchers
            </div>
          </div>
        </div>
      )}

      {tab === 'preview' && (
        <div style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:12, overflow:'hidden' }}>
          <div style={{ padding:'12px 18px', borderBottom:`1px solid ${T.bdr}`, fontWeight:700, color:T.ink, fontSize:13 }}>XML Preview — {period}</div>
          <pre style={{ padding:16, fontSize:11, color:T.teal, fontFamily:'monospace', overflowX:'auto', whiteSpace:'pre-wrap', maxHeight:500, overflowY:'auto', lineHeight:1.5 }}>
            {xmlPreview || 'Click "XML Preview" to generate'}
          </pre>
        </div>
      )}

      {tab === 'export' && (
        <div style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:12, padding:24 }}>
          <div style={{ fontWeight:700, color:T.ink, marginBottom:18 }}>Download Tally XML Files</div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12 }}>
            {[['all','📦 Full Export','Sales + Expenses',T.blue],['sales','🧾 Sales Only','All invoices',T.green],['expenses','💸 Expenses Only','All expense payments',T.red]].map(([type,label,desc,color])=>(
              <div key={type} style={{ background:T.card, border:`1px solid ${T.bdr}`, borderRadius:12, padding:20, textAlign:'center' }}>
                <div style={{ fontSize:28, marginBottom:8 }}>{label.split(' ')[0]}</div>
                <div style={{ fontSize:14, fontWeight:700, color:T.ink, marginBottom:4 }}>{label.split(' ').slice(1).join(' ')}</div>
                <div style={{ fontSize:11, color:T.muted, marginBottom:14 }}>{desc}</div>
                <button onClick={()=>downloadXML(type)} style={{ background:color, color:'#fff', border:'none', borderRadius:8, padding:'9px', fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:'inherit', width:'100%' }}>⬇️ Download</button>
              </div>
            ))}
          </div>
          <div style={{ marginTop:16, background:T.amber+'12', border:`1px solid ${T.amber}44`, borderRadius:9, padding:'12px 16px', fontSize:12, color:T.amber }}>
            <strong>Import steps in Tally:</strong> Open Tally → Your Company → Gateway of Tally → Import Data → Vouchers → Select XML file → Import
          </div>
        </div>
      )}
    </div>
  );
}
