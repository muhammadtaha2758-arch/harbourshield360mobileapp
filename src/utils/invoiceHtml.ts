import type { InvoiceDetailResponse } from '../types/invoice';

function esc(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function money(value: unknown): string {
  const num = typeof value === 'number' ? value : Number(String(value ?? '').replace(/[^0-9.-]/g, ''));
  if (!Number.isFinite(num)) {
    return '$0.00';
  }
  return `$${num.toFixed(2)}`;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

function toNumber(value: unknown): number {
  const num = typeof value === 'number' ? value : Number(String(value ?? '').replace(/[^0-9.-]/g, ''));
  return Number.isFinite(num) ? num : 0;
}

/**
 * CRM stores line `tax` as Tax (%). Amount = subtotal * (tax / 100).
 */
export function calculateInvoiceTotals(detail: InvoiceDetailResponse): {
  subtotal: number;
  tax: number;
  total: number;
  rows: Array<{
    description: string;
    quantity: unknown;
    unit: number;
    amount: number;
  }>;
} {
  const invoice = asRecord(detail.Invoice);
  const items = Array.isArray(detail.items) ? detail.items : [];
  const totals = asRecord(detail.totals);

  let subtotal = 0;
  let tax = 0;
  const rows = items.map((raw) => {
    const item = asRecord(raw);
    const lineSubtotal = toNumber(item.subtotal ?? item.price ?? 0);
    const taxPercent = toNumber(item.tax ?? 0);
    const taxAmount = Math.round(lineSubtotal * (taxPercent / 100) * 100) / 100;
    const unit = toNumber(item.unit_cost ?? item.price ?? lineSubtotal);
    const qty = item.quantity != null && item.quantity !== '' ? item.quantity : 1;
    const desc = String(item.name || item.description || 'Item');

    subtotal += lineSubtotal;
    tax += taxAmount;

    return {
      description: desc,
      quantity: qty,
      unit,
      amount: lineSubtotal,
    };
  });

  subtotal = Math.round(subtotal * 100) / 100;
  tax = Math.round(tax * 100) / 100;
  let total = Math.round((subtotal + tax) * 100) / 100;

  if (!items.length) {
    total = toNumber(totals.total ?? invoice.amount ?? 0);
    subtotal = total;
    tax = 0;
  } else if (total <= 0) {
    total = toNumber(invoice.amount ?? totals.total ?? 0);
    if (subtotal <= 0) {
      subtotal = total;
    }
  } else if (toNumber(totals.tax) > 0 || toNumber(totals.subtotal) > 0) {
    // Prefer API-computed totals when backend already calculated percent tax.
    subtotal = toNumber(totals.subtotal) || subtotal;
    tax = toNumber(totals.tax) || tax;
    total = toNumber(totals.total) || total;
  }

  return { subtotal, tax, total, rows };
}

/**
 * Builds a printable invoice HTML document from the mobile invoice detail API.
 */
export function buildInvoiceHtml(detail: InvoiceDetailResponse): string {
  const invoice = asRecord(detail.Invoice);
  const settings = asRecord((detail as { settings?: unknown }).settings);
  const { subtotal, tax, total, rows } = calculateInvoiceTotals(detail);

  const number =
    invoice.estimate_id != null && String(invoice.estimate_id) !== '' && String(invoice.estimate_id) !== 'None'
      ? String(invoice.estimate_id)
      : String(invoice.id ?? '');

  const company = esc(settings.CompanyName || 'HarbourShield 360');
  const billName = esc(invoice.customer_name || '');
  const billAddress = esc(invoice.customer_address || invoice.project_address || '');
  const billPhone = esc(invoice.customer_phone || '');
  const billEmail = esc(invoice.customer_email || '');

  const bodyRows =
    rows
      .map(
        (row) => `<tr>
        <td>${esc(row.description)}</td>
        <td style="text-align:center">${esc(row.quantity)}</td>
        <td style="text-align:right">${esc(money(row.unit))}</td>
        <td style="text-align:right">${esc(money(row.amount))}</td>
      </tr>`,
      )
      .join('') ||
    `<tr>
      <td>Invoice total</td>
      <td style="text-align:center">1</td>
      <td style="text-align:right">${esc(money(total))}</td>
      <td style="text-align:right">${esc(money(total))}</td>
    </tr>`;

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Invoice ${esc(number)}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; color: #222; margin: 20px; }
    h1 { font-size: 22px; margin: 0 0 8px; }
    .muted { color: #666; }
    table { width: 100%; border-collapse: collapse; margin-top: 16px; }
    th, td { border: 1px solid #ddd; padding: 8px; font-size: 13px; }
    th { background: #f2f2f2; text-align: left; }
  </style>
</head>
<body>
  <h1>${company}</h1>
  <p class="muted">${esc(settings.CompanyAdress || '')}</p>
  <h2>INVOICE ${esc(number)}</h2>
  <p>
    Status: ${esc(invoice.display_status || invoice.status || '')}<br/>
    Due: ${esc(invoice.due_date || invoice.due_label || '')}
  </p>
  <p>
    <strong>Bill To</strong><br/>
    ${billName}<br/>
    ${billAddress}<br/>
    ${billPhone}<br/>
    ${billEmail}
  </p>
  <table>
    <thead>
      <tr>
        <th>Description</th>
        <th>Qty</th>
        <th>Unit Price</th>
        <th>Amount</th>
      </tr>
    </thead>
    <tbody>
      ${bodyRows}
      <tr>
        <td colspan="3" style="text-align:right"><strong>Subtotal</strong></td>
        <td style="text-align:right">${esc(money(subtotal))}</td>
      </tr>
      ${
        tax > 0
          ? `<tr>
        <td colspan="3" style="text-align:right"><strong>Tax</strong></td>
        <td style="text-align:right">${esc(money(tax))}</td>
      </tr>`
          : ''
      }
      <tr>
        <td colspan="3" style="text-align:right"><strong>Total</strong></td>
        <td style="text-align:right"><strong>${esc(money(total))}</strong></td>
      </tr>
    </tbody>
  </table>
</body>
</html>`;
}
