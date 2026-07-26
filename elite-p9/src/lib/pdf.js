// ── GST Invoice PDF Generator ─────────────────────────────────
// Generates A4 GST-compliant invoice using jsPDF + autoTable

export async function generateInvoicePDF(sale, tenant) {
  // Dynamically load jsPDF from CDN
  if (!window.jspdf) {
    await new Promise((resolve, reject) => {
      const s1 = document.createElement('script');
      s1.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
      s1.onload = () => {
        const s2 = document.createElement('script');
        s2.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js';
        s2.onload = resolve;
        s2.onerror = reject;
        document.head.appendChild(s2);
      };
      s1.onerror = reject;
      document.head.appendChild(s1);
    });
  }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const W = 210, M = 14;

  // ── Header bar ────────────────────────────────────────────────
  doc.setFillColor(6, 7, 16);
  doc.rect(0, 0, W, 38, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(20); doc.setFont('helvetica', 'bold');
  doc.text(tenant?.name || 'Elite Store', M, 14);

  doc.setFontSize(8); doc.setFont('helvetica', 'normal');
  doc.setTextColor(160, 170, 210);
  if (tenant?.gstin) doc.text('GSTIN: ' + tenant.gstin, M, 21);
  if (tenant?.phone) doc.text('Ph: ' + tenant.phone, M, 27);
  if (tenant?.email) doc.text(tenant.email, M, 33);

  // TAX INVOICE label
  doc.setFillColor(79, 124, 255);
  doc.rect(W - 60, 0, 60, 38, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(11); doc.setFont('helvetica', 'bold');
  doc.text('TAX INVOICE', W - 30, 16, { align: 'center' });
  doc.setFontSize(8); doc.setFont('helvetica', 'normal');
  doc.text(sale.inv_num || 'INV-0001', W - 30, 23, { align: 'center' });
  doc.text('Date: ' + (sale.date || new Date().toLocaleDateString('en-IN')), W - 30, 29, { align: 'center' });

  // ── Bill To ───────────────────────────────────────────────────
  let y = 46;
  doc.setFillColor(240, 242, 248);
  doc.rect(M, y, 88, 28, 'F');
  doc.rect(W - M - 88, y, 88, 28, 'F');

  doc.setTextColor(74, 81, 117);
  doc.setFontSize(8); doc.setFont('helvetica', 'bold');
  doc.text('BILL TO', M + 3, y + 6);
  doc.setFont('helvetica', 'normal'); doc.setTextColor(6, 7, 16);
  doc.setFontSize(10);
  doc.text(sale.customer || 'Walk-in Customer', M + 3, y + 13);
  if (sale.customer_gstin) { doc.setFontSize(8); doc.setTextColor(74, 81, 117); doc.text('GSTIN: ' + sale.customer_gstin, M + 3, y + 19); }

  doc.setTextColor(74, 81, 117);
  doc.setFontSize(8); doc.setFont('helvetica', 'bold');
  doc.text('PAYMENT MODE', W - M - 85, y + 6);
  doc.setFont('helvetica', 'normal'); doc.setTextColor(6, 7, 16);
  doc.setFontSize(10);
  doc.text((sale.payment_mode || 'Cash').toUpperCase(), W - M - 85, y + 13);
  doc.setFontSize(8); doc.setTextColor(74, 81, 117);
  doc.text('Status: ' + (sale.status || 'PAID').toUpperCase(), W - M - 85, y + 19);

  // ── Items table ───────────────────────────────────────────────
  y += 34;
  const items = sale.items || [];
  const tableBody = items.map((item, i) => {
    const taxable = item.amount || (item.qty * item.rate);
    const gstPct  = item.gst || 18;
    const gstAmt  = taxable * gstPct / (100 + gstPct);
    return [
      i + 1,
      item.name,
      item.hsn || '—',
      gstPct + '%',
      item.qty,
      'Rs.' + (item.rate || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 }),
      'Rs.' + taxable.toLocaleString('en-IN', { minimumFractionDigits: 2 }),
    ];
  });

  doc.autoTable({
    startY: y,
    head: [['#', 'Item Description', 'HSN', 'GST', 'Qty', 'Rate', 'Amount']],
    body: tableBody,
    theme: 'grid',
    headStyles: { fillColor: [6, 7, 16], textColor: [255, 255, 255], fontSize: 8, fontStyle: 'bold', halign: 'center' },
    bodyStyles: { fontSize: 8, textColor: [6, 7, 16] },
    columnStyles: {
      0: { halign: 'center', cellWidth: 8 },
      2: { halign: 'center', cellWidth: 18 },
      3: { halign: 'center', cellWidth: 14 },
      4: { halign: 'center', cellWidth: 12 },
      5: { halign: 'right',  cellWidth: 24 },
      6: { halign: 'right',  cellWidth: 28 },
    },
    margin: { left: M, right: M },
  });

  // ── Totals ────────────────────────────────────────────────────
  const finalY = doc.lastAutoTable.finalY + 4;
  const totalsX = W - M - 70;

  const rows = [
    ['Subtotal',    'Rs.' + (sale.subtotal || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })],
    ['GST Amount',  'Rs.' + (sale.gst_amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })],
    sale.discount > 0 ? ['Discount', '-Rs.' + sale.discount.toLocaleString('en-IN', { minimumFractionDigits: 2 })] : null,
  ].filter(Boolean);

  doc.setFontSize(8); doc.setFont('helvetica', 'normal');
  rows.forEach((row, i) => {
    doc.setTextColor(74, 81, 117);
    doc.text(row[0], totalsX, finalY + i * 6);
    doc.setTextColor(6, 7, 16);
    doc.text(row[1], W - M, finalY + i * 6, { align: 'right' });
  });

  // Grand Total
  const gtY = finalY + rows.length * 6 + 2;
  doc.setFillColor(6, 7, 16);
  doc.rect(totalsX - 4, gtY - 5, W - M - totalsX + 4 + M, 10, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(10); doc.setFont('helvetica', 'bold');
  doc.text('TOTAL', totalsX, gtY + 2);
  doc.text('Rs.' + (sale.total || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 }), W - M, gtY + 2, { align: 'right' });

  // ── UPI QR hint ───────────────────────────────────────────────
  if (tenant?.upi_id) {
    doc.setFontSize(8); doc.setFont('helvetica', 'normal'); doc.setTextColor(74, 81, 117);
    doc.text('Pay via UPI: ' + tenant.upi_id, M, gtY + 12);
  }

  // ── Terms & footer ────────────────────────────────────────────
  const pgH = 297;
  doc.setFillColor(6, 7, 16);
  doc.rect(0, pgH - 18, W, 18, 'F');
  doc.setTextColor(160, 170, 210); doc.setFontSize(7); doc.setFont('helvetica', 'normal');
  doc.text('This is a computer-generated invoice. No signature required.', W / 2, pgH - 11, { align: 'center' });
  doc.text('Thank you for shopping at ' + (tenant?.name || 'Elite Store') + ' · GST Compliant Invoice', W / 2, pgH - 6, { align: 'center' });

  // ── Save ──────────────────────────────────────────────────────
  doc.save((sale.inv_num || 'invoice') + '.pdf');
}

// ── WhatsApp invoice share ────────────────────────────────────
export function shareInvoiceWhatsApp(sale, tenant) {
  const items = (sale.items || []).map(i => `  • ${i.name} × ${i.qty} — Rs.${(i.amount || i.qty * i.rate).toLocaleString('en-IN')}`).join('\n');
  const msg = [
    `*${tenant?.name || 'Elite Store'}*`,
    `Invoice: *${sale.inv_num}*`,
    `Date: ${sale.date}`,
    `Customer: ${sale.customer || 'Walk-in'}`,
    '',
    '*Items:*',
    items,
    '',
    `GST: Rs.${(sale.gst_amount || 0).toLocaleString('en-IN')}`,
    `*Total: Rs.${(sale.total || 0).toLocaleString('en-IN')}*`,
    `Payment: ${(sale.payment_mode || 'Cash').toUpperCase()}`,
    '',
    tenant?.upi_id ? `Pay via UPI: ${tenant.upi_id}` : '',
    '',
    '_Thank you for your business!_',
  ].filter(l => l !== undefined).join('\n');

  window.open('https://wa.me/?text=' + encodeURIComponent(msg), '_blank');
}
