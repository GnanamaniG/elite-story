// ── WhatsApp Business Cloud API ───────────────────────────────
// Meta WhatsApp Business API — sends real WhatsApp messages
// Requires: WA Phone Number ID + Access Token from Meta Business Manager
// Fallback: deep link (wa.me) if API not configured

/**
 * Send invoice via WhatsApp Business API
 * @param {object} sale - Sale object with items, total, inv_num
 * @param {object} tenant - Tenant with wa_phone_id, wa_token
 * @param {string} customerPhone - Customer's phone number (with country code)
 */
export async function sendInvoiceViaWAAPI(sale, tenant, customerPhone) {
  const WA_PHONE_ID = tenant?.wa_phone_id || import.meta.env.VITE_WA_PHONE_ID;
  const WA_TOKEN    = tenant?.wa_token    || import.meta.env.VITE_WA_TOKEN;

  if (!WA_PHONE_ID || !WA_TOKEN) {
    // Fallback to deep link
    return sendInvoiceDeepLink(sale, tenant);
  }

  const phone = formatIndianPhone(customerPhone);
  if (!phone) return { ok: false, error: 'Invalid phone number' };

  const items  = (sale.items || []).map(i => `${i.name} x${i.qty}: Rs.${(i.amount||0).toFixed(0)}`).join('\n');
  const body   = [
    `*${tenant.name || 'Elite Store'}*`,
    `Invoice: *${sale.inv_num}*`,
    `Date: ${sale.date}`,
    '',
    items,
    '',
    `GST: Rs.${(sale.gst_amount||0).toFixed(2)}`,
    `*Total: Rs.${(sale.total||0).toFixed(2)}*`,
    `Mode: ${(sale.payment_mode||'Cash').toUpperCase()}`,
    tenant.upi_id ? `\nPay via UPI: ${tenant.upi_id}` : '',
    '\n_Thank you for shopping with us!_ 🛍️',
  ].filter(Boolean).join('\n');

  try {
    const resp = await fetch(
      `https://graph.facebook.com/v18.0/${WA_PHONE_ID}/messages`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${WA_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: phone,
          type: 'text',
          text: { body },
        }),
      }
    );

    const data = await resp.json();
    if (!resp.ok) throw new Error(data.error?.message || 'WA API error');
    return { ok: true, message_id: data.messages?.[0]?.id };
  } catch (e) {
    console.error('[WhatsApp API]', e.message);
    // Fallback to deep link on error
    sendInvoiceDeepLink(sale, tenant);
    return { ok: false, error: e.message };
  }
}

/**
 * WhatsApp deep link fallback (opens WhatsApp with pre-filled message)
 */
export function sendInvoiceDeepLink(sale, tenant) {
  const items = (sale.items || []).map(i => `• ${i.name} x${i.qty} — Rs.${(i.amount||0).toFixed(0)}`).join('\n');
  const msg = [
    `*${tenant?.name || 'Elite Store'}*`,
    `Invoice: *${sale.inv_num}*`,
    `Date: ${sale.date}`,
    `Customer: ${sale.customer || 'Walk-in'}`,
    '',
    '*Items:*',
    items,
    '',
    `GST: Rs.${(sale.gst_amount||0).toFixed(2)}`,
    `*Total: Rs.${(sale.total||0).toFixed(2)}*`,
    `Payment: ${(sale.payment_mode||'Cash').toUpperCase()}`,
    tenant?.upi_id ? `\nPay via UPI: ${tenant.upi_id}` : '',
    '\n_Thank you for your business!_ 🙏',
  ].filter(Boolean).join('\n');

  window.open('https://wa.me/?text=' + encodeURIComponent(msg), '_blank');
  return { ok: true, method: 'deeplink' };
}

/**
 * Send to specific customer phone number
 */
export function sendToCustomerPhone(sale, tenant, phone) {
  const items = (sale.items||[]).map(i => `• ${i.name} x${i.qty} — Rs.${(i.amount||0).toFixed(0)}`).join('\n');
  const msg = [
    `*${tenant?.name || 'Elite Store'}*`,
    `Invoice: *${sale.inv_num}* | Date: ${sale.date}`,
    '',
    items,
    '',
    `*Total: Rs.${(sale.total||0).toFixed(2)}* (${(sale.payment_mode||'Cash').toUpperCase()})`,
    tenant?.upi_id ? `Pay via UPI: ${tenant.upi_id}` : '',
    '_Thank you! 🙏_',
  ].filter(Boolean).join('\n');

  const formatted = formatIndianPhone(phone);
  if (formatted) {
    window.open(`https://wa.me/${formatted}?text=${encodeURIComponent(msg)}`, '_blank');
  } else {
    window.open('https://wa.me/?text=' + encodeURIComponent(msg), '_blank');
  }
}

function formatIndianPhone(phone) {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10) return '91' + digits;
  if (digits.length === 12 && digits.startsWith('91')) return digits;
  if (digits.length === 13 && digits.startsWith('091')) return digits.slice(1);
  return null;
}
