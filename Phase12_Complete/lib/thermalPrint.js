// ── Thermal Printer Utility ───────────────────────────────────
// Works via browser print dialog with thermal-optimized CSS
// Compatible with: Epson TM-T88, Star, Bixolon, any ESC/POS printer
// Set printer paper width: 58mm or 80mm in printer settings

const THERMAL_CSS = `
  @media print {
    * { margin:0; padding:0; box-sizing:border-box; }
    body { font-family: 'Courier New', monospace; font-size:12px; color:#000; background:#fff; }
    .receipt { width:100%; max-width:300px; }
    .center  { text-align:center; }
    .right   { text-align:right; }
    .bold    { font-weight:bold; }
    .large   { font-size:16px; }
    .small   { font-size:10px; }
    .divider { border-top:1px dashed #000; margin:4px 0; }
    .row     { display:flex; justify-content:space-between; padding:1px 0; }
    .item    { padding:2px 0; }
    .spacer  { height:4px; }
    @page    { margin:2mm; size: 80mm auto; }
  }
`;

export function printThermalReceipt(sale, tenant) {
  const items  = sale.items || [];
  const w = window.open('', '_blank', 'width=340,height=600');
  const biz    = tenant?.name || 'Elite Store';
  const addr   = tenant?.address || '';
  const gstin  = tenant?.gstin || '';
  const phone  = tenant?.phone || '';
  const upi    = tenant?.upi_id || '';

  const itemRows = items.map(i => `
    <div class="item">
      <div>${i.name}</div>
      <div class="row">
        <span>${i.qty} x ${fmtR(i.rate)}</span>
        <span class="bold">${fmtR(i.amount)}</span>
      </div>
    </div>
  `).join('');

  const html = `<!DOCTYPE html><html><head>
    <meta charset="UTF-8"/>
    <style>
      body { font-family:'Courier New',monospace; font-size:12px; color:#000; margin:0; padding:8px; }
      .center { text-align:center; } .right { text-align:right; } .bold { font-weight:bold; }
      .large { font-size:16px; } .small { font-size:10px; }
      .divider { border-top:1px dashed #000; margin:5px 0; }
      .row { display:flex; justify-content:space-between; padding:1px 0; }
      .item { padding:2px 0; font-size:11px; }
      ${THERMAL_CSS}
    </style>
  </head><body>
    <div class="receipt">
      <div class="center bold large">${biz}</div>
      ${addr ? `<div class="center small">${addr}</div>` : ''}
      ${phone ? `<div class="center small">📞 ${phone}</div>` : ''}
      ${gstin ? `<div class="center small">GSTIN: ${gstin}</div>` : ''}
      <div class="divider"></div>

      <div class="row"><span>Invoice:</span><span class="bold">${sale.inv_num||'—'}</span></div>
      <div class="row"><span>Date:</span><span>${sale.date||new Date().toLocaleDateString('en-IN')}</span></div>
      <div class="row"><span>Customer:</span><span>${sale.customer||'Walk-in'}</span></div>
      <div class="row"><span>Payment:</span><span style="text-transform:capitalize">${sale.payment_mode||'Cash'}</span></div>
      <div class="divider"></div>

      <div class="row bold small"><span>ITEM</span><span>AMT</span></div>
      <div class="divider"></div>
      ${itemRows}
      <div class="divider"></div>

      <div class="row"><span>Subtotal</span><span>${fmtR(sale.subtotal)}</span></div>
      ${sale.gst_amount > 0 ? `<div class="row"><span>GST</span><span>${fmtR(sale.gst_amount)}</span></div>` : ''}
      ${sale.discount > 0 ? `<div class="row"><span>Discount</span><span>-${fmtR(sale.discount)}</span></div>` : ''}
      <div class="divider"></div>
      <div class="row bold large"><span>TOTAL</span><span>Rs.${(sale.total||0).toLocaleString('en-IN',{minimumFractionDigits:2})}</span></div>
      <div class="row small"><span>Paid</span><span>Rs.${(sale.paid||sale.total||0).toLocaleString('en-IN',{minimumFractionDigits:2})}</span></div>
      ${(sale.total||0) > (sale.paid||sale.total||0) ? `<div class="row small bold"><span>Balance Due</span><span>Rs.${((sale.total||0)-(sale.paid||0)).toLocaleString('en-IN',{minimumFractionDigits:2})}</span></div>` : ''}
      <div class="divider"></div>

      ${upi ? `<div class="center small">Pay via UPI: ${upi}</div>` : ''}
      <div class="center small" style="margin-top:6px">Thank you for shopping!</div>
      <div class="center small">Please visit again 🙏</div>
      <div style="height:20px"></div>
    </div>
    <script>window.onload=()=>{window.print();setTimeout(()=>window.close(),1000);}<\/script>
  </body></html>`;

  w.document.write(html);
  w.document.close();
}

function fmtR(n) { return 'Rs.' + (n||0).toLocaleString('en-IN', { minimumFractionDigits:2, maximumFractionDigits:2 }); }

export function printCashSummary(session, sales, tenant) {
  const w    = window.open('', '_blank', 'width=340,height=500');
  const biz  = tenant?.name || 'Elite Store';
  const date = new Date(session.opened_at).toLocaleDateString('en-IN');
  const cashSales  = sales.filter(s=>s.payment_mode==='cash').reduce((t,s)=>t+(s.total||0),0);
  const upiSales   = sales.filter(s=>s.payment_mode==='upi').reduce((t,s)=>t+(s.total||0),0);
  const cardSales  = sales.filter(s=>s.payment_mode==='card').reduce((t,s)=>t+(s.total||0),0);
  const totalSales = sales.reduce((t,s)=>t+(s.total||0),0);

  const html = `<!DOCTYPE html><html><head><style>
    body{font-family:'Courier New',monospace;font-size:12px;margin:0;padding:8px;}
    .center{text-align:center;}.bold{font-weight:bold;}.large{font-size:15px;}
    .divider{border-top:1px dashed #000;margin:5px 0;}
    .row{display:flex;justify-content:space-between;padding:2px 0;}
  </style></head><body>
    <div class="center bold large">${biz}</div>
    <div class="center">END OF DAY REPORT</div>
    <div class="center">${date}</div>
    <div class="divider"></div>
    <div class="row"><span>Opening Float</span><span>Rs.${(session.opening_float||0).toFixed(2)}</span></div>
    <div class="divider"></div>
    <div class="bold">SALES SUMMARY</div>
    <div class="row"><span>Total Orders</span><span>${sales.length}</span></div>
    <div class="row"><span>Cash Sales</span><span>Rs.${cashSales.toFixed(2)}</span></div>
    <div class="row"><span>UPI Sales</span><span>Rs.${upiSales.toFixed(2)}</span></div>
    <div class="row"><span>Card Sales</span><span>Rs.${cardSales.toFixed(2)}</span></div>
    <div class="divider"></div>
    <div class="row bold"><span>Total Revenue</span><span>Rs.${totalSales.toFixed(2)}</span></div>
    <div class="row bold"><span>Expected Cash</span><span>Rs.${(session.expected_cash||0).toFixed(2)}</span></div>
    <div class="row bold"><span>Actual Cash</span><span>Rs.${(session.closing_cash||0).toFixed(2)}</span></div>
    <div class="divider"></div>
    <div class="row bold large"><span>Difference</span><span style="color:${(session.difference||0)>=0?'green':'red'}">Rs.${(session.difference||0).toFixed(2)}</span></div>
    <div style="height:20px"></div>
    <script>window.onload=()=>{window.print();setTimeout(()=>window.close(),1000);}<\/script>
  </body></html>`;
  w.document.write(html); w.document.close();
}
