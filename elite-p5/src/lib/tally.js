// ── Tally XML Export ──────────────────────────────────────────
// Generates Tally-compatible XML for import into Tally Prime/ERP9

function escapeXML(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function formatDate(dateStr) {
  // Tally date format: YYYYMMDD
  return (dateStr || '').replace(/-/g, '');
}

/** Export Sales as Tally XML Vouchers */
export function exportSalesToTally(sales, tenant) {
  const bizName = escapeXML(tenant?.name || 'Elite Store');

  const vouchers = sales.map(sale => {
    const items   = sale.items || [];
    const invNum  = escapeXML(sale.inv_num || '');
    const date    = formatDate(sale.date);
    const custName = escapeXML(sale.customer || 'Walk-in Customer');
    const total   = (sale.total || 0).toFixed(2);

    const ledgerEntries = [
      // Debit: Customer/Cash
      `<ALLLEDGERENTRIES.LIST>
        <LEDGERNAME>${custName}</LEDGERNAME>
        <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
        <AMOUNT>-${total}</AMOUNT>
      </ALLLEDGERENTRIES.LIST>`,

      // Credit: Sales
      `<ALLLEDGERENTRIES.LIST>
        <LEDGERNAME>Sales Account</LEDGERNAME>
        <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
        <AMOUNT>${((sale.subtotal || 0) - (sale.gst_amount || 0)).toFixed(2)}</AMOUNT>
      </ALLLEDGERENTRIES.LIST>`,

      // Credit: CGST
      sale.gst_amount > 0 ? `<ALLLEDGERENTRIES.LIST>
        <LEDGERNAME>Output CGST</LEDGERNAME>
        <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
        <AMOUNT>${((sale.gst_amount || 0) / 2).toFixed(2)}</AMOUNT>
      </ALLLEDGERENTRIES.LIST>` : '',

      // Credit: SGST
      sale.gst_amount > 0 ? `<ALLLEDGERENTRIES.LIST>
        <LEDGERNAME>Output SGST</LEDGERNAME>
        <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
        <AMOUNT>${((sale.gst_amount || 0) / 2).toFixed(2)}</AMOUNT>
      </ALLLEDGERENTRIES.LIST>` : '',
    ].filter(Boolean).join('\n');

    return `<VOUCHER REMOTEID="${invNum}" VCHTYPE="Sales" ACTION="Create">
      <DATE>${date}</DATE>
      <VOUCHERTYPENAME>Sales</VOUCHERTYPENAME>
      <VOUCHERNUMBER>${invNum}</VOUCHERNUMBER>
      <PARTYLEDGERNAME>${custName}</PARTYLEDGERNAME>
      <GSTREGISTRATIONTYPE>Regular</GSTREGISTRATIONTYPE>
      <NARRATION>Sale Invoice ${invNum} - ${custName}</NARRATION>
      ${ledgerEntries}
    </VOUCHER>`;
  }).join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<ENVELOPE>
  <HEADER>
    <TALLYREQUEST>Import Data</TALLYREQUEST>
  </HEADER>
  <BODY>
    <IMPORTDATA>
      <REQUESTDESC>
        <REPORTNAME>Vouchers</REPORTNAME>
        <STATICVARIABLES>
          <SVCURRENTCOMPANY>${bizName}</SVCURRENTCOMPANY>
        </STATICVARIABLES>
      </REQUESTDESC>
      <REQUESTDATA>
        <TALLYMESSAGE xmlns:UDF="TallyUDF">
          ${vouchers}
        </TALLYMESSAGE>
      </REQUESTDATA>
    </IMPORTDATA>
  </BODY>
</ENVELOPE>`;

  downloadXML(xml, `EliteStore_Sales_${new Date().toISOString().slice(0,10)}.xml`);
}

/** Export Purchases as Tally XML */
export function exportPurchasesToTally(purchases, tenant) {
  const bizName = escapeXML(tenant?.name || 'Elite Store');

  const vouchers = purchases.map(p => {
    const date     = formatDate(p.date);
    const supplier = escapeXML(p.supplier || 'Supplier');
    const total    = (p.total || 0).toFixed(2);
    const invRef   = escapeXML(p.invoice_ref || p.id?.slice(0,8) || '');

    return `<VOUCHER REMOTEID="${invRef}" VCHTYPE="Purchase" ACTION="Create">
      <DATE>${date}</DATE>
      <VOUCHERTYPENAME>Purchase</VOUCHERTYPENAME>
      <VOUCHERNUMBER>${invRef}</VOUCHERNUMBER>
      <PARTYLEDGERNAME>${supplier}</PARTYLEDGERNAME>
      <NARRATION>Purchase from ${supplier}</NARRATION>
      <ALLLEDGERENTRIES.LIST>
        <LEDGERNAME>Purchase Account</LEDGERNAME>
        <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
        <AMOUNT>${total}</AMOUNT>
      </ALLLEDGERENTRIES.LIST>
      <ALLLEDGERENTRIES.LIST>
        <LEDGERNAME>${supplier}</LEDGERNAME>
        <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
        <AMOUNT>-${total}</AMOUNT>
      </ALLLEDGERENTRIES.LIST>
    </VOUCHER>`;
  }).join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<ENVELOPE>
  <HEADER><TALLYREQUEST>Import Data</TALLYREQUEST></HEADER>
  <BODY>
    <IMPORTDATA>
      <REQUESTDESC>
        <REPORTNAME>Vouchers</REPORTNAME>
        <STATICVARIABLES><SVCURRENTCOMPANY>${bizName}</SVCURRENTCOMPANY></STATICVARIABLES>
      </REQUESTDESC>
      <REQUESTDATA>
        <TALLYMESSAGE xmlns:UDF="TallyUDF">${vouchers}</TALLYMESSAGE>
      </REQUESTDATA>
    </IMPORTDATA>
  </BODY>
</ENVELOPE>`;

  downloadXML(xml, `EliteStore_Purchases_${new Date().toISOString().slice(0,10)}.xml`);
}

function downloadXML(xml, filename) {
  const blob = new Blob([xml], { type: 'application/xml' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}
