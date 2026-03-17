// ── Report Export Service ──────────────────────────────────────────
// CSV export with BOM for Arabic, printable HTML for PDF via browser print

import { getCompanyInfo } from './printService';

// ═══════════════════════════════════════════════════════════════════
// CSV Export
// ═══════════════════════════════════════════════════════════════════

/**
 * Export data to CSV with BOM for Arabic support
 * @param {Array<Object>} data - rows
 * @param {Array<{key:string, label:string}>} columns - column definitions
 * @param {string} filename - without extension
 */
export function exportToCSV(data, columns, filename = 'export') {
  if (!data || data.length === 0) return;

  const cols = columns || Object.keys(data[0]).map(k => ({ key: k, label: k }));
  const header = cols.map(c => escapeCSV(c.label)).join(',');
  const rows = data.map(row =>
    cols.map(c => escapeCSV(String(row[c.key] ?? ''))).join(',')
  );
  const csv = [header, ...rows].join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  downloadBlob(blob, `${filename}.csv`);
}

function escapeCSV(val) {
  const str = String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

function downloadBlob(blob, name) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}

// ═══════════════════════════════════════════════════════════════════
// Printable HTML (opens in new window with print dialog)
// ═══════════════════════════════════════════════════════════════════

const ACCENT = '#4A7AAB';

const PRINT_CSS = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', 'Cairo', Tahoma, sans-serif; color: #1e293b; line-height: 1.6; padding: 20mm; }
  .rtl { direction: rtl; text-align: right; }
  .rtl th, .rtl td { text-align: right; }

  .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid ${ACCENT}; padding-bottom: 14px; margin-bottom: 20px; }
  .header-logo { max-height: 55px; max-width: 130px; object-fit: contain; }
  .company-info { text-align: right; }
  .rtl .company-info { text-align: left; }
  .company-name { font-size: 18px; font-weight: 700; color: #1e293b; margin-bottom: 2px; }
  .company-detail { font-size: 10px; color: #64748b; }

  .report-title { font-size: 20px; font-weight: 700; color: ${ACCENT}; text-align: center; margin-bottom: 6px; }
  .report-subtitle { font-size: 11px; color: #64748b; text-align: center; margin-bottom: 18px; }

  .filter-info { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 16px; justify-content: center; }
  .filter-chip { background: #f1f5f9; border: 1px solid #e2e8f0; border-radius: 6px; padding: 4px 10px; font-size: 10px; color: #475569; }

  .section-title { font-size: 14px; font-weight: 600; color: #1e293b; margin: 20px 0 10px; padding-bottom: 6px; border-bottom: 2px solid #e2e8f0; }

  .kpi-grid { display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 18px; }
  .kpi-card { flex: 1 1 140px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; text-align: center; }
  .kpi-label { font-size: 10px; color: #64748b; text-transform: uppercase; margin-bottom: 4px; }
  .kpi-value { font-size: 18px; font-weight: 700; color: ${ACCENT}; }

  table { width: 100%; border-collapse: collapse; margin-bottom: 16px; font-size: 11px; }
  th { background: ${ACCENT}; color: white; padding: 8px 12px; font-weight: 600; text-align: left; }
  td { padding: 8px 12px; border-bottom: 1px solid #e2e8f0; }
  tr:nth-child(even) td { background: #f8fafc; }

  .text-section { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px; font-size: 12px; margin-bottom: 16px; line-height: 1.7; }

  .chart-placeholder { background: #f1f5f9; border: 2px dashed #cbd5e1; border-radius: 8px; padding: 30px; text-align: center; color: #94a3b8; font-size: 12px; margin-bottom: 16px; }

  .footer { margin-top: 30px; border-top: 2px solid #e2e8f0; padding-top: 12px; display: flex; justify-content: space-between; font-size: 10px; color: #94a3b8; }
  .total-records { text-align: center; font-size: 10px; color: #94a3b8; margin-top: 8px; }

  @media print {
    body { padding: 10mm; }
    @page { margin: 10mm; size: A4; }
    .page-break { page-break-before: always; }
  }
`;

function buildCompanyHeader(ci, isRTL) {
  const name = isRTL ? ci.name_ar : ci.name_en;
  const address = isRTL ? ci.address_ar : ci.address_en;
  return `
    <div class="header">
      <div><img src="${ci.logo_url}" alt="" class="header-logo" onerror="this.style.display='none'" /></div>
      <div class="company-info">
        <div class="company-name">${name}</div>
        ${address ? `<div class="company-detail">${address}</div>` : ''}
        ${ci.phone ? `<div class="company-detail">${ci.phone}</div>` : ''}
        ${ci.email ? `<div class="company-detail">${ci.email}</div>` : ''}
        ${ci.tax_id ? `<div class="company-detail">${isRTL ? 'الرقم الضريبي' : 'Tax ID'}: ${ci.tax_id}</div>` : ''}
      </div>
    </div>`;
}

function buildFooter(ci, isRTL) {
  const name = isRTL ? ci.name_ar : ci.name_en;
  return `
    <div class="footer">
      <div>${name} ${ci.phone ? ' | ' + ci.phone : ''}</div>
      <div>${new Date().toLocaleDateString(isRTL ? 'ar-EG' : 'en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</div>
    </div>`;
}

function renderSection(section) {
  let html = '';
  if (section.title) {
    html += `<div class="section-title">${section.title}</div>`;
  }

  switch (section.type) {
    case 'kpi': {
      html += '<div class="kpi-grid">';
      (section.data || []).forEach(kpi => {
        html += `<div class="kpi-card"><div class="kpi-label">${kpi.label}</div><div class="kpi-value">${kpi.value}</div></div>`;
      });
      html += '</div>';
      break;
    }
    case 'table': {
      const cols = section.columns || [];
      const rows = section.data || [];
      if (cols.length && rows.length) {
        html += '<table><thead><tr>';
        cols.forEach(c => { html += `<th>${c.label || c}</th>`; });
        html += '</tr></thead><tbody>';
        rows.forEach((row, ri) => {
          html += '<tr>';
          cols.forEach(c => {
            const key = c.key || c;
            html += `<td>${row[key] ?? '—'}</td>`;
          });
          html += '</tr>';
          // Page break hint every 30 rows
          if ((ri + 1) % 30 === 0 && ri < rows.length - 1) {
            html += '</tbody></table><div class="page-break"></div><table><thead><tr>';
            cols.forEach(c => { html += `<th>${c.label || c}</th>`; });
            html += '</tr></thead><tbody>';
          }
        });
        html += '</tbody></table>';
        html += `<div class="total-records">${rows.length} ${rows.length === 1 ? 'record' : 'records'}</div>`;
      }
      break;
    }
    case 'chart_placeholder': {
      html += `<div class="chart-placeholder">${section.data?.message || 'Chart available in app view'}</div>`;
      break;
    }
    case 'text': {
      html += `<div class="text-section">${section.data || ''}</div>`;
      break;
    }
    default:
      break;
  }
  return html;
}

/**
 * Generate and open a printable HTML report in a new window
 * @param {string} title - report title
 * @param {Array<{title?:string, type:'table'|'kpi'|'chart_placeholder'|'text', data:any, columns?:Array}>} sections
 * @param {Object} options - { isRTL, filters, subtitle }
 */
export function exportToPrintableHTML(title, sections, options = {}) {
  const { isRTL = false, filters = [], subtitle = '' } = options;
  const ci = getCompanyInfo();
  const dateStr = new Date().toLocaleDateString(isRTL ? 'ar-EG' : 'en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  let body = buildCompanyHeader(ci, isRTL);
  body += `<div class="report-title">${title}</div>`;
  body += `<div class="report-subtitle">${subtitle || (isRTL ? 'تاريخ التقرير' : 'Report Date')}: ${dateStr}</div>`;

  if (filters.length > 0) {
    body += '<div class="filter-info">';
    filters.forEach(f => { body += `<span class="filter-chip">${f}</span>`; });
    body += '</div>';
  }

  (sections || []).forEach(s => { body += renderSection(s); });
  body += buildFooter(ci, isRTL);

  const html = `<!DOCTYPE html>
<html lang="${isRTL ? 'ar' : 'en'}" dir="${isRTL ? 'rtl' : 'ltr'}">
<head><meta charset="UTF-8"><title>${title}</title><style>${PRINT_CSS}</style></head>
<body class="${isRTL ? 'rtl' : ''}">${body}</body>
</html>`;

  const win = window.open('', '_blank');
  if (win) {
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 400);
  }
}

// ═══════════════════════════════════════════════════════════════════
// Domain-specific report generators
// ═══════════════════════════════════════════════════════════════════

/**
 * Contacts summary report
 */
export function generateContactsReport(contacts, filters = {}, isRTL = false) {
  const data = contacts || [];
  const bySource = {};
  const byType = {};
  const byStatus = {};
  data.forEach(c => {
    const src = c.source || (isRTL ? 'غير محدد' : 'Unknown');
    bySource[src] = (bySource[src] || 0) + 1;
    const tp = c.contact_type || (isRTL ? 'غير محدد' : 'Unknown');
    byType[tp] = (byType[tp] || 0) + 1;
    const st = c.contact_status || c.status || (isRTL ? 'غير محدد' : 'Unknown');
    byStatus[st] = (byStatus[st] || 0) + 1;
  });

  const title = isRTL ? 'تقرير جهات الاتصال' : 'Contacts Report';
  const sections = [
    {
      type: 'kpi',
      data: [
        { label: isRTL ? 'إجمالي جهات الاتصال' : 'Total Contacts', value: data.length },
        { label: isRTL ? 'المصادر' : 'Sources', value: Object.keys(bySource).length },
        { label: isRTL ? 'الأنواع' : 'Types', value: Object.keys(byType).length },
      ],
    },
    {
      title: isRTL ? 'حسب المصدر' : 'By Source',
      type: 'table',
      columns: [
        { key: 'source', label: isRTL ? 'المصدر' : 'Source' },
        { key: 'count', label: isRTL ? 'العدد' : 'Count' },
        { key: 'pct', label: '%' },
      ],
      data: Object.entries(bySource).map(([s, c]) => ({ source: s, count: c, pct: data.length ? Math.round(c / data.length * 100) + '%' : '0%' })),
    },
    {
      title: isRTL ? 'حسب الحالة' : 'By Status',
      type: 'table',
      columns: [
        { key: 'status', label: isRTL ? 'الحالة' : 'Status' },
        { key: 'count', label: isRTL ? 'العدد' : 'Count' },
      ],
      data: Object.entries(byStatus).map(([s, c]) => ({ status: s, count: c })),
    },
  ];

  const filterChips = [];
  if (filters.dateRange) filterChips.push(`${isRTL ? 'الفترة' : 'Period'}: ${filters.dateRange}`);
  if (filters.source) filterChips.push(`${isRTL ? 'المصدر' : 'Source'}: ${filters.source}`);
  if (filters.type) filterChips.push(`${isRTL ? 'النوع' : 'Type'}: ${filters.type}`);

  return { title, sections, options: { isRTL, filters: filterChips } };
}

/**
 * Opportunities / Pipeline report
 */
export function generateOpportunitiesReport(opportunities, filters = {}, isRTL = false) {
  const data = opportunities || [];
  const byStage = {};
  let totalBudget = 0;
  data.forEach(o => {
    const stage = o.stage || (isRTL ? 'غير محدد' : 'Unknown');
    if (!byStage[stage]) byStage[stage] = { count: 0, budget: 0 };
    byStage[stage].count++;
    byStage[stage].budget += (o.budget || 0);
    totalBudget += (o.budget || 0);
  });

  const wonCount = data.filter(o => o.stage === 'closed_won').length;
  const lostCount = data.filter(o => o.stage === 'closed_lost').length;
  const convRate = data.length > 0 ? Math.round(wonCount / data.length * 100) : 0;

  const title = isRTL ? 'تقرير الفرص والمبيعات' : 'Opportunities Pipeline Report';
  const fmtBudget = (n) => Number(n).toLocaleString();

  const sections = [
    {
      type: 'kpi',
      data: [
        { label: isRTL ? 'إجمالي الفرص' : 'Total Opportunities', value: data.length },
        { label: isRTL ? 'إجمالي الميزانيات' : 'Total Budget', value: fmtBudget(totalBudget) },
        { label: isRTL ? 'صفقات ناجحة' : 'Won', value: wonCount },
        { label: isRTL ? 'صفقات خاسرة' : 'Lost', value: lostCount },
        { label: isRTL ? 'معدل التحويل' : 'Conversion', value: convRate + '%' },
      ],
    },
    {
      title: isRTL ? 'تفصيل المراحل' : 'Stage Breakdown',
      type: 'table',
      columns: [
        { key: 'stage', label: isRTL ? 'المرحلة' : 'Stage' },
        { key: 'count', label: isRTL ? 'العدد' : 'Count' },
        { key: 'budget', label: isRTL ? 'الميزانية' : 'Budget' },
        { key: 'pct', label: '%' },
      ],
      data: Object.entries(byStage).map(([s, v]) => ({
        stage: s,
        count: v.count,
        budget: fmtBudget(v.budget),
        pct: data.length ? Math.round(v.count / data.length * 100) + '%' : '0%',
      })),
    },
  ];

  const filterChips = [];
  if (filters.dateRange) filterChips.push(`${isRTL ? 'الفترة' : 'Period'}: ${filters.dateRange}`);
  if (filters.stage) filterChips.push(`${isRTL ? 'المرحلة' : 'Stage'}: ${filters.stage}`);
  if (filters.agent) filterChips.push(`${isRTL ? 'المسؤول' : 'Agent'}: ${filters.agent}`);

  return { title, sections, options: { isRTL, filters: filterChips } };
}

/**
 * Sales performance report
 */
export function generateSalesReport(data = {}, period = '', isRTL = false) {
  const { revenue = [], performers = [], pipeline = [] } = data;

  const totalRevenue = revenue.reduce((s, r) => s + (r.revenue || 0), 0);
  const totalTarget = revenue.reduce((s, r) => s + (r.target || 0), 0);
  const achievement = totalTarget > 0 ? Math.round(totalRevenue / totalTarget * 100) : 0;
  const fmtNum = (n) => Number(n).toLocaleString();

  const title = isRTL ? 'تقرير أداء المبيعات' : 'Sales Performance Report';
  const sections = [
    {
      type: 'kpi',
      data: [
        { label: isRTL ? 'إجمالي الإيرادات' : 'Total Revenue', value: fmtNum(totalRevenue) },
        { label: isRTL ? 'المستهدف' : 'Target', value: fmtNum(totalTarget) },
        { label: isRTL ? 'نسبة الإنجاز' : 'Achievement', value: achievement + '%' },
      ],
    },
  ];

  if (revenue.length > 0) {
    sections.push({
      title: isRTL ? 'الإيرادات الشهرية' : 'Monthly Revenue',
      type: 'table',
      columns: [
        { key: 'month', label: isRTL ? 'الشهر' : 'Month' },
        { key: 'revenue', label: isRTL ? 'الإيراد' : 'Revenue' },
        { key: 'target', label: isRTL ? 'المستهدف' : 'Target' },
        { key: 'pct', label: '%' },
      ],
      data: revenue.map(r => ({
        month: isRTL ? (r.month_ar || r.month) : r.month,
        revenue: fmtNum(r.revenue || 0),
        target: fmtNum(r.target || 0),
        pct: r.target ? Math.round((r.revenue || 0) / r.target * 100) + '%' : '—',
      })),
    });
  }

  if (performers.length > 0) {
    sections.push({
      title: isRTL ? 'أفضل الموظفين' : 'Top Performers',
      type: 'table',
      columns: [
        { key: 'name', label: isRTL ? 'الاسم' : 'Name' },
        { key: 'deals', label: isRTL ? 'الصفقات' : 'Deals' },
        { key: 'revenue', label: isRTL ? 'الإيراد' : 'Revenue' },
      ],
      data: performers.map(p => ({
        name: isRTL ? (p.name_ar || p.name) : p.name,
        deals: p.deals,
        revenue: fmtNum(p.revenue || 0),
      })),
    });
  }

  const filterChips = period ? [period] : [];
  return { title, sections, options: { isRTL, filters: filterChips } };
}

/**
 * Activity summary report
 */
export function generateActivityReport(activities, period = '', isRTL = false) {
  const data = activities || [];
  const byType = {};
  data.forEach(a => {
    const tp = a.type || a.type_ar || (isRTL ? 'أخرى' : 'Other');
    byType[tp] = (byType[tp] || 0) + 1;
  });

  const title = isRTL ? 'تقرير النشاطات' : 'Activity Report';
  const sections = [
    {
      type: 'kpi',
      data: [
        { label: isRTL ? 'إجمالي النشاطات' : 'Total Activities', value: data.length },
        { label: isRTL ? 'الأنواع' : 'Types', value: Object.keys(byType).length },
      ],
    },
    {
      title: isRTL ? 'حسب النوع' : 'By Type',
      type: 'table',
      columns: [
        { key: 'type', label: isRTL ? 'النوع' : 'Type' },
        { key: 'count', label: isRTL ? 'العدد' : 'Count' },
        { key: 'pct', label: '%' },
      ],
      data: Object.entries(byType).map(([t, c]) => ({
        type: t,
        count: c,
        pct: data.length ? Math.round(c / data.length * 100) + '%' : '0%',
      })),
    },
  ];

  const filterChips = period ? [period] : [];
  return { title, sections, options: { isRTL, filters: filterChips } };
}
