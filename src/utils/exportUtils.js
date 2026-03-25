/**
 * Export data as Excel file
 * @param {Array<Object>} data - Array of row objects
 * @param {string} filename - File name without extension
 * @param {string} sheetName - Sheet name (default: 'Sheet1')
 */
export async function exportToExcel(data, filename = 'export', sheetName = 'Sheet1') {
  if (!data || data.length === 0) return;
  const ExcelJSModule = await import('exceljs');
  const ExcelJS = ExcelJSModule.default || ExcelJSModule;
  const workbook = new ExcelJS.Workbook();
  const ws = workbook.addWorksheet(sheetName);
  const keys = Object.keys(data[0]);
  ws.columns = keys.map(key => ({ header: key, key }));
  data.forEach(row => ws.addRow(row));
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${filename}.xlsx`;
  link.click();
  URL.revokeObjectURL(url);
}

/**
 * Export data as CSV file
 * @param {Array<Object>} data - Array of row objects
 * @param {string} filename - File name without extension
 */
export function exportToCSV(data, filename = 'export') {
  if (!data || data.length === 0) return;
  const keys = Object.keys(data[0]);
  const header = keys.join(',');
  const rows = data.map(row =>
    keys.map(k => {
      const val = row[k] ?? '';
      const str = String(val);
      // Escape fields that contain commas, quotes, or newlines
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return '"' + str.replace(/"/g, '""') + '"';
      }
      return str;
    }).join(',')
  );
  const csv = [header, ...rows].join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${filename}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

/**
 * Print table data (opens print dialog)
 * @param {Array<Object>} data - Array of row objects
 * @param {string} title - Document title
 * @param {Array<{key: string, label: string}>} columns - Column definitions
 */
export function printTable(data, title = '', columns) {
  if (!data || data.length === 0) return;
  const cols = columns || Object.keys(data[0]).map(k => ({ key: k, label: k }));
  const html = `
    <!DOCTYPE html>
    <html dir="auto">
    <head>
      <title>${title}</title>
      <style>
        body { font-family: 'Cairo', Arial, sans-serif; padding: 20px; direction: rtl; }
        h1 { font-size: 18px; margin-bottom: 16px; }
        table { width: 100%; border-collapse: collapse; font-size: 12px; }
        th { background: #f3f4f6; padding: 8px 12px; text-align: right; border: 1px solid #e5e7eb; font-weight: 600; }
        td { padding: 8px 12px; border: 1px solid #e5e7eb; }
        tr:nth-child(even) { background: #f9fafb; }
        @media print { body { padding: 0; } }
      </style>
    </head>
    <body>
      <h1>${title}</h1>
      <table>
        <thead><tr>${cols.map(c => `<th>${c.label}</th>`).join('')}</tr></thead>
        <tbody>${data.map(row => `<tr>${cols.map(c => `<td>${row[c.key] ?? '—'}</td>`).join('')}</tr>`).join('')}</tbody>
      </table>
    </body>
    </html>
  `;
  const win = window.open('', '_blank');
  win.document.write(html);
  win.document.close();
  win.print();
}
