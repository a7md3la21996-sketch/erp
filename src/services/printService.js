import { syncToSupabase } from '../utils/supabaseSync';
// ── Print Layout Service ──────────────────────────────────────────

function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

const STORAGE_KEY = 'platform_company_info';

const DEFAULTS = {
  name_ar: 'Platform ERP',
  name_en: 'Platform ERP',
  phone: '',
  email: '',
  address_ar: '',
  address_en: '',
  logo_url: '/logo.webp',
  tax_id: '',
  website: '',
};

export function getCompanyInfo() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch { /* ignore */ }
  return { ...DEFAULTS };
}

export function saveCompanyInfo(info) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(info));
}

export function printElement(elementId) {
  const el = document.getElementById(elementId);
  if (!el) return;
  const printWindow = window.open('', '_blank');
  const doc = printWindow.document;
  doc.open();
  doc.write('<!DOCTYPE html><html><head><title>Print</title><style>body{margin:0;padding:0;} @media print{body{margin:0;}}</style></head><body></body></html>');
  doc.close();
  // Clone DOM instead of injecting innerHTML string to prevent XSS
  const cloned = el.cloneNode(true);
  doc.body.appendChild(cloned);
  printWindow.focus();
  printWindow.print();
  printWindow.close();
}

// ── Shared CSS for all print templates ──
const printCSS = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #1e293b; line-height: 1.6; }
  .print-page { max-width: 210mm; margin: 0 auto; padding: 15mm; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #4A7AAB; padding-bottom: 16px; margin-bottom: 24px; }
  .header-logo { max-height: 60px; max-width: 140px; object-fit: contain; }
  .company-info { text-align: right; }
  .company-info.ltr { text-align: left; }
  .company-name { font-size: 20px; font-weight: 700; color: #1e293b; margin-bottom: 4px; }
  .company-detail { font-size: 11px; color: #64748b; }
  .doc-title { font-size: 22px; font-weight: 700; color: #4A7AAB; margin-bottom: 16px; text-align: center; }
  .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 20px; }
  .info-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; }
  .info-label { font-size: 10px; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px; }
  .info-value { font-size: 13px; font-weight: 600; color: #1e293b; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
  th { background: #4A7AAB; color: white; padding: 10px 14px; font-size: 12px; font-weight: 600; text-align: left; }
  td { padding: 10px 14px; font-size: 12px; border-bottom: 1px solid #e2e8f0; }
  tr:nth-child(even) td { background: #f8fafc; }
  .totals-section { margin-top: 8px; display: flex; justify-content: flex-end; }
  .totals-box { width: 260px; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; }
  .total-row { display: flex; justify-content: space-between; padding: 8px 14px; font-size: 12px; border-bottom: 1px solid #e2e8f0; }
  .total-row:last-child { border-bottom: none; }
  .total-row.grand { background: #4A7AAB; color: white; font-weight: 700; font-size: 14px; }
  .footer { margin-top: 40px; border-top: 2px solid #e2e8f0; padding-top: 16px; display: flex; justify-content: space-between; align-items: flex-end; }
  .footer-left { font-size: 10px; color: #94a3b8; }
  .qr-placeholder { width: 80px; height: 80px; border: 2px dashed #cbd5e1; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 9px; color: #94a3b8; text-align: center; }
  .page-number { text-align: center; font-size: 10px; color: #94a3b8; margin-top: 20px; }
  .rtl { direction: rtl; text-align: right; }
  .rtl th { text-align: right; }
  .rtl .company-info { text-align: left; }
  .rtl .totals-section { justify-content: flex-start; }
  .contact-card { text-align: center; }
  .contact-avatar { width: 80px; height: 80px; border-radius: 50%; background: linear-gradient(135deg, #2B4C6F, #4A7AAB); color: white; display: flex; align-items: center; justify-content: center; font-size: 28px; font-weight: 700; margin: 0 auto 16px; }
  .contact-name { font-size: 22px; font-weight: 700; color: #1e293b; margin-bottom: 4px; }
  .contact-role { font-size: 13px; color: #64748b; margin-bottom: 20px; }
  .contact-details { text-align: left; max-width: 400px; margin: 0 auto; }
  .contact-details.rtl-details { text-align: right; }
  .detail-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #f1f5f9; font-size: 13px; }
  .detail-label { color: #64748b; }
  .detail-value { color: #1e293b; font-weight: 600; }
  @media print {
    body { margin: 0; padding: 0; }
    .print-page { padding: 10mm; }
    @page { margin: 10mm; size: A4; }
  }
`;

function buildHeader(companyInfo, lang) {
  const isAr = lang === 'ar';
  const name = escapeHtml(isAr ? companyInfo.name_ar : companyInfo.name_en);
  const address = escapeHtml(isAr ? companyInfo.address_ar : companyInfo.address_en);
  return `
    <div class="header">
      <div>
        <img src="${escapeHtml(companyInfo.logo_url)}" alt="Logo" class="header-logo" onerror="this.style.display='none'" />
      </div>
      <div class="company-info ${isAr ? '' : 'ltr'}">
        <div class="company-name">${name}</div>
        ${address ? `<div class="company-detail">${address}</div>` : ''}
        ${companyInfo.phone ? `<div class="company-detail">${escapeHtml(companyInfo.phone)}</div>` : ''}
        ${companyInfo.email ? `<div class="company-detail">${escapeHtml(companyInfo.email)}</div>` : ''}
        ${companyInfo.tax_id ? `<div class="company-detail">${isAr ? 'الرقم الضريبي' : 'Tax ID'}: ${escapeHtml(companyInfo.tax_id)}</div>` : ''}
        ${companyInfo.website ? `<div class="company-detail">${escapeHtml(companyInfo.website)}</div>` : ''}
      </div>
    </div>
  `;
}

function buildFooter(companyInfo, lang) {
  const isAr = lang === 'ar';
  const name = isAr ? companyInfo.name_ar : companyInfo.name_en;
  return `
    <div class="footer">
      <div class="footer-left">
        <div>${escapeHtml(name || '')}</div>
        ${companyInfo.phone ? `<div>${escapeHtml(companyInfo.phone)}</div>` : ''}
        ${companyInfo.email ? `<div>${escapeHtml(companyInfo.email)}</div>` : ''}
        ${companyInfo.website ? `<div>${escapeHtml(companyInfo.website)}</div>` : ''}
      </div>
      <div class="qr-placeholder">QR Code</div>
    </div>
    <div class="page-number">${isAr ? 'صفحة 1' : 'Page 1'}</div>
  `;
}

function wrap(content, lang) {
  const isAr = lang === 'ar';
  return `<!DOCTYPE html>
<html lang="${lang}" dir="${isAr ? 'rtl' : 'ltr'}">
<head><meta charset="UTF-8"><style>${printCSS}</style></head>
<body><div class="print-page ${isAr ? 'rtl' : ''}">${content}</div></body>
</html>`;
}

function fmtNum(n) {
  if (n == null) return '—';
  return Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ── Invoice HTML ──
export function generateInvoiceHTML(invoice, items, companyInfo, lang) {
  const isAr = lang === 'ar';
  const ci = companyInfo || getCompanyInfo();
  const inv = invoice || {};
  const lineItems = items || [];

  const subtotal = lineItems.reduce((s, it) => s + ((it.qty || 0) * (it.price || 0)), 0);
  const taxRate = inv.tax_rate || 0;
  const taxAmount = subtotal * (taxRate / 100);
  const grandTotal = subtotal + taxAmount;

  const content = `
    ${buildHeader(ci, lang)}
    <div class="doc-title">${isAr ? 'فاتورة' : 'INVOICE'}</div>
    <div class="info-grid">
      <div class="info-box">
        <div class="info-label">${isAr ? 'رقم الفاتورة' : 'Invoice Number'}</div>
        <div class="info-value">${inv.invoice_number || inv.deal_number || '—'}</div>
      </div>
      <div class="info-box">
        <div class="info-label">${isAr ? 'التاريخ' : 'Date'}</div>
        <div class="info-value">${inv.date || new Date().toLocaleDateString(isAr ? 'ar-EG' : 'en-US')}</div>
      </div>
      <div class="info-box">
        <div class="info-label">${isAr ? 'العميل' : 'Client'}</div>
        <div class="info-value">${isAr ? (inv.client_ar || inv.client_en || '—') : (inv.client_en || inv.client_ar || '—')}</div>
        ${inv.phone ? `<div class="company-detail">${inv.phone}</div>` : ''}
      </div>
      <div class="info-box">
        <div class="info-label">${isAr ? 'الحالة' : 'Status'}</div>
        <div class="info-value">${inv.status || '—'}</div>
      </div>
    </div>
    <table>
      <thead><tr>
        <th>#</th>
        <th>${isAr ? 'الوصف' : 'Description'}</th>
        <th>${isAr ? 'الكمية' : 'Qty'}</th>
        <th>${isAr ? 'سعر الوحدة' : 'Unit Price'}</th>
        <th>${isAr ? 'الإجمالي' : 'Total'}</th>
      </tr></thead>
      <tbody>
        ${lineItems.map((it, i) => `<tr>
          <td>${i + 1}</td>
          <td>${it.description || '—'}</td>
          <td>${it.qty || 0}</td>
          <td>${fmtNum(it.price)}</td>
          <td>${fmtNum((it.qty || 0) * (it.price || 0))}</td>
        </tr>`).join('')}
      </tbody>
    </table>
    <div class="totals-section">
      <div class="totals-box">
        <div class="total-row"><span>${isAr ? 'الإجمالي الفرعي' : 'Subtotal'}</span><span>${fmtNum(subtotal)}</span></div>
        <div class="total-row"><span>${isAr ? 'الضريبة' : 'Tax'} (${taxRate}%)</span><span>${fmtNum(taxAmount)}</span></div>
        <div class="total-row grand"><span>${isAr ? 'الإجمالي الكلي' : 'Grand Total'}</span><span>${fmtNum(grandTotal)}</span></div>
      </div>
    </div>
    ${buildFooter(ci, lang)}
  `;
  return wrap(content, lang);
}

// ── Quotation HTML ──
export function generateQuotationHTML(quotation, items, companyInfo, lang) {
  const isAr = lang === 'ar';
  const ci = companyInfo || getCompanyInfo();
  const q = quotation || {};
  const lineItems = items || [];

  const subtotal = lineItems.reduce((s, it) => s + ((it.qty || 0) * (it.price || 0)), 0);
  const taxRate = q.tax_rate || 0;
  const taxAmount = subtotal * (taxRate / 100);
  const grandTotal = subtotal + taxAmount;

  const content = `
    ${buildHeader(ci, lang)}
    <div class="doc-title">${isAr ? 'عرض سعر' : 'QUOTATION'}</div>
    <div class="info-grid">
      <div class="info-box">
        <div class="info-label">${isAr ? 'رقم العرض' : 'Quotation #'}</div>
        <div class="info-value">${q.quotation_number || '—'}</div>
      </div>
      <div class="info-box">
        <div class="info-label">${isAr ? 'التاريخ' : 'Date'}</div>
        <div class="info-value">${q.date || new Date().toLocaleDateString(isAr ? 'ar-EG' : 'en-US')}</div>
      </div>
      <div class="info-box">
        <div class="info-label">${isAr ? 'العميل' : 'Client'}</div>
        <div class="info-value">${isAr ? (q.client_ar || q.client_en || '—') : (q.client_en || q.client_ar || '—')}</div>
      </div>
      <div class="info-box">
        <div class="info-label">${isAr ? 'صالح حتى' : 'Valid Until'}</div>
        <div class="info-value">${q.valid_until || '—'}</div>
      </div>
    </div>
    <table>
      <thead><tr>
        <th>#</th>
        <th>${isAr ? 'الوصف' : 'Description'}</th>
        <th>${isAr ? 'الكمية' : 'Qty'}</th>
        <th>${isAr ? 'سعر الوحدة' : 'Unit Price'}</th>
        <th>${isAr ? 'الإجمالي' : 'Total'}</th>
      </tr></thead>
      <tbody>
        ${lineItems.map((it, i) => `<tr>
          <td>${i + 1}</td>
          <td>${it.description || '—'}</td>
          <td>${it.qty || 0}</td>
          <td>${fmtNum(it.price)}</td>
          <td>${fmtNum((it.qty || 0) * (it.price || 0))}</td>
        </tr>`).join('')}
      </tbody>
    </table>
    <div class="totals-section">
      <div class="totals-box">
        <div class="total-row"><span>${isAr ? 'الإجمالي الفرعي' : 'Subtotal'}</span><span>${fmtNum(subtotal)}</span></div>
        <div class="total-row"><span>${isAr ? 'الضريبة' : 'Tax'} (${taxRate}%)</span><span>${fmtNum(taxAmount)}</span></div>
        <div class="total-row grand"><span>${isAr ? 'الإجمالي الكلي' : 'Grand Total'}</span><span>${fmtNum(grandTotal)}</span></div>
      </div>
    </div>
    ${buildFooter(ci, lang)}
  `;
  return wrap(content, lang);
}

// ── Contract HTML ──
export function generateContractHTML(contract, companyInfo, lang) {
  const isAr = lang === 'ar';
  const ci = companyInfo || getCompanyInfo();
  const c = contract || {};

  const content = `
    ${buildHeader(ci, lang)}
    <div class="doc-title">${isAr ? 'عقد' : 'CONTRACT'}</div>
    <div class="info-grid">
      <div class="info-box">
        <div class="info-label">${isAr ? 'رقم العقد' : 'Contract #'}</div>
        <div class="info-value">${c.contract_number || '—'}</div>
      </div>
      <div class="info-box">
        <div class="info-label">${isAr ? 'التاريخ' : 'Date'}</div>
        <div class="info-value">${c.date || new Date().toLocaleDateString(isAr ? 'ar-EG' : 'en-US')}</div>
      </div>
      <div class="info-box">
        <div class="info-label">${isAr ? 'الطرف الأول' : 'Party 1'}</div>
        <div class="info-value">${isAr ? ci.name_ar : ci.name_en}</div>
      </div>
      <div class="info-box">
        <div class="info-label">${isAr ? 'الطرف الثاني' : 'Party 2'}</div>
        <div class="info-value">${isAr ? (c.client_ar || c.client_en || '—') : (c.client_en || c.client_ar || '—')}</div>
      </div>
    </div>
    <div style="padding:16px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;margin-bottom:20px;font-size:13px;line-height:1.8;">
      ${c.terms || (isAr ? 'شروط وأحكام العقد تُكتب هنا...' : 'Contract terms and conditions go here...')}
    </div>
    <div style="display:flex;justify-content:space-between;margin-top:60px;">
      <div style="text-align:center;width:200px;">
        <div style="border-top:2px solid #1e293b;padding-top:8px;font-size:12px;">${isAr ? 'الطرف الأول' : 'Party 1'}</div>
      </div>
      <div style="text-align:center;width:200px;">
        <div style="border-top:2px solid #1e293b;padding-top:8px;font-size:12px;">${isAr ? 'الطرف الثاني' : 'Party 2'}</div>
      </div>
    </div>
    ${buildFooter(ci, lang)}
  `;
  return wrap(content, lang);
}

// ── Report HTML ──
export function generateReportHTML(title, data, columns, companyInfo, lang) {
  const isAr = lang === 'ar';
  const ci = companyInfo || getCompanyInfo();
  const rows = data || [];
  const cols = columns || [];

  const content = `
    ${buildHeader(ci, lang)}
    <div class="doc-title">${title || (isAr ? 'تقرير' : 'Report')}</div>
    <div style="font-size:11px;color:#64748b;text-align:center;margin-bottom:16px;">
      ${isAr ? 'تاريخ التقرير' : 'Report Date'}: ${new Date().toLocaleDateString(isAr ? 'ar-EG' : 'en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
    </div>
    <table>
      <thead><tr>
        ${cols.map(c => `<th>${typeof c === 'string' ? c : (c.header || c.label || c.key || '')}</th>`).join('')}
      </tr></thead>
      <tbody>
        ${rows.map(row => `<tr>
          ${cols.map(c => {
            const key = typeof c === 'string' ? c : (c.key || '');
            const val = Array.isArray(row) ? row[cols.indexOf(c)] : (row[key] ?? '');
            return `<td>${escapeHtml(String(val))}</td>`;
          }).join('')}
        </tr>`).join('')}
      </tbody>
    </table>
    <div style="font-size:11px;color:#94a3b8;text-align:center;margin-top:12px;">
      ${isAr ? `إجمالي السجلات: ${rows.length}` : `Total Records: ${rows.length}`}
    </div>
    ${buildFooter(ci, lang)}
  `;
  return wrap(content, lang);
}

// ── Contact Card HTML ──
export function generateContactCardHTML(contact, companyInfo, lang) {
  const isAr = lang === 'ar';
  const ci = companyInfo || getCompanyInfo();
  const c = contact || {};
  const name = escapeHtml(isAr ? (c.name_ar || c.full_name || c.name || '') : (c.name_en || c.full_name || c.name || ''));
  const initStr = escapeHtml(name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase());

  const rows = [
    { label: isAr ? 'الهاتف' : 'Phone', value: escapeHtml(c.phone) },
    { label: isAr ? 'البريد' : 'Email', value: escapeHtml(c.email) },
    { label: isAr ? 'الشركة' : 'Company', value: escapeHtml(isAr ? (c.company_ar || c.company) : (c.company_en || c.company)) },
    { label: isAr ? 'المسمى الوظيفي' : 'Job Title', value: escapeHtml(c.job_title) },
    { label: isAr ? 'المصدر' : 'Source', value: escapeHtml(c.source) },
    { label: isAr ? 'النوع' : 'Type', value: escapeHtml(c.contact_type) },
    { label: isAr ? 'الحالة' : 'Status', value: escapeHtml(c.contact_status) },
    { label: isAr ? 'الميزانية' : 'Budget', value: escapeHtml(c.budget) },
    { label: isAr ? 'تاريخ الإنشاء' : 'Created', value: c.created_at ? new Date(c.created_at).toLocaleDateString(isAr ? 'ar-EG' : 'en-US') : null },
    { label: isAr ? 'ملاحظات' : 'Notes', value: escapeHtml(c.notes) },
  ].filter(r => r.value);

  const content = `
    ${buildHeader(ci, lang)}
    <div class="contact-card">
      <div class="contact-avatar">${initStr}</div>
      <div class="contact-name">${name}</div>
      ${c.job_title ? `<div class="contact-role">${escapeHtml(c.job_title)}</div>` : ''}
      <div class="contact-details ${isAr ? 'rtl-details' : ''}">
        ${rows.map(r => `<div class="detail-row"><span class="detail-label">${r.label}</span><span class="detail-value">${r.value}</span></div>`).join('')}
      </div>
    </div>
    ${buildFooter(ci, lang)}
  `;
  return wrap(content, lang);
}
