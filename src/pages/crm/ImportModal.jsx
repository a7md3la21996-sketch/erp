import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import * as XLSX from 'xlsx';

const COLUMN_MAP = {
  FULL_NAME: 'full_name',
  MOBILE_NUMBERS: 'phone',
  SOURCE: 'source',
  CAMPAIGNS: 'campaign_name',
  TYPE: 'contact_type',
  RATING: 'temperature',
  STATUS: 'stage',
  ASSIGNEES: 'assigned_to_name',
  CREATED_AT: 'created_at',
  DESCRIPTION: 'notes',
  LAST_ACTIVITY: 'last_activity_at',
  WALLET: 'budget_min',
  EMAILS: 'email',
};

const TYPE_MAP = {
  lead: 'lead', 'Lead': 'lead', ليد: 'lead',
  client: 'client', 'Client': 'client', عميل: 'client',
  cold: 'cold', 'Cold Call': 'cold', 'كولد كول': 'cold',
};

const RATING_MAP = {
  hot: 'hot', Hot: 'hot', حار: 'hot',
  warm: 'warm', Warm: 'warm', دافئ: 'warm',
  cold: 'cold', Cold: 'cold', بارد: 'cold',
};

const normalizePhone = (p) => {
  if (!p) return null;
  const str = String(p).trim().replace(/\s+/g, '');
  if (str.startsWith('00')) return '+' + str.slice(2);
  return str;
};

const validatePhone = (p) => {
  if (!p) return false;
  const n = normalizePhone(p);
  if (n.startsWith('0') && n.startsWith('01') && n.length === 11) return true;
  if (n.startsWith('+') && n.length >= 10 && n.length <= 16) return true;
  return false;
};

export default function ImportModal({ onClose, existingContacts, onImportDone }) {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const [step, setStep] = useState(1);
  const [rows, setRows] = useState([]);
  const [dragging, setDragging] = useState(false);

  const processFile = (file) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const wb = XLSX.read(e.target.result, { type: 'binary' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const raw = XLSX.utils.sheet_to_json(ws, { defval: '' });

      const processed = raw.map((row, idx) => {
        const mapped = {};
        Object.entries(COLUMN_MAP).forEach(([col, field]) => {
          if (row[col] !== undefined) mapped[field] = row[col];
        });

        const phone = normalizePhone(mapped.phone);
        const full_name = (mapped.full_name || '').trim();

        // Validate
        if (!phone || !validatePhone(phone)) {
          return { ...mapped, _row: idx + 2, _status: 'error', _reason: isRTL ? 'رقم غير صحيح أو مفقود' : 'Invalid or missing phone' };
        }
        if (!full_name) {
          return { ...mapped, _row: idx + 2, _status: 'error', _reason: isRTL ? 'الاسم مفقود' : 'Missing name' };
        }

        // Check duplicate
        const existing = existingContacts.find(c => c.phone === phone || c.phone2 === phone);
        if (existing) {
          return { ...mapped, phone, full_name, _row: idx + 2, _status: 'opportunity', _existingId: existing.id, _existingName: existing.full_name };
        }

        return {
          ...mapped,
          phone,
          full_name,
          contact_type: TYPE_MAP[mapped.contact_type] || 'lead',
          temperature: RATING_MAP[mapped.temperature] || 'warm',
          _row: idx + 2,
          _status: 'new',
        };
      });

      setRows(processed);
      setStep(2);
    };
    reader.readAsBinaryString(file);
  };

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  }, [existingContacts]);

  const handleFile = (e) => {
    const file = e.target.files[0];
    if (file) processFile(file);
  };

  const newRows = rows.filter(r => r._status === 'new');
  const oppRows = rows.filter(r => r._status === 'opportunity');
  const errRows = rows.filter(r => r._status === 'error');

  const [tab, setTab] = useState('all');
  const [importing, setImporting] = useState(false);

  const displayRows = tab === 'all' ? rows : tab === 'new' ? newRows : tab === 'opp' ? oppRows : errRows;

  const downloadErrors = () => {
    const data = errRows.map(r => ({
      ROW: r._row,
      FULL_NAME: r.full_name || '',
      MOBILE_NUMBERS: r.phone || '',
      SOURCE: r.source || '',
      CAMPAIGNS: r.campaign_name || '',
      TYPE: r.contact_type || '',
      REASON: r._reason,
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Errors');
    XLSX.writeFile(wb, 'import_errors.xlsx');
  };

  const handleImport = async () => {
    setImporting(true);
    const toAdd = newRows.map(r => ({
      ...r,
      id: String(Math.max(0, ...existingContacts.map(c => parseInt(c.id) || 0)) + newRows.indexOf(r) + 1),
      lead_score: 0,
      is_blacklisted: false,
      created_at: r.created_at || new Date().toISOString(),
    }));
    await new Promise(r => setTimeout(r, 800));
    onImportDone(toAdd, oppRows);
    setStep(3);
    setImporting(false);
  };

  const over = (e) => { e.preventDefault(); setDragging(true); };
  const leave = () => setDragging(false);

  const SummaryCards = ({ items }) => (
    <div className="grid grid-cols-3 gap-2.5 mb-5">
      {items.map(s => (
        <div key={s.label} className="rounded-xl p-3 text-center" style={{ background: s.bg, border: `1px solid ${s.border}` }}>
          <div className="text-2xl font-bold" style={{ color: s.color }}>{s.num}</div>
          <div className="text-[11px] text-content-muted dark:text-content-muted-dark mt-1">{s.icon ? `${s.icon} ` : ''}{s.label}</div>
        </div>
      ))}
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black/50 z-[200] flex items-center justify-center" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="bg-surface-card dark:bg-surface-card-dark border border-gray-300 dark:border-brand-500/30 rounded-2xl w-[640px] max-h-[90vh] flex flex-col overflow-hidden">

        {/* Header */}
        <div className="px-6 pt-5 pb-4 border-b border-edge dark:border-edge-dark flex justify-between items-center">
          <h2 className="text-content dark:text-content-dark text-base font-bold">{'\u{1F4E4}'} {isRTL ? 'استيراد جهات الاتصال' : 'Import Contacts'}</h2>
          <button onClick={onClose} className="bg-transparent border-none text-brand-400 dark:text-brand-400 text-[22px] cursor-pointer">&times;</button>
        </div>

        {/* Steps */}
        <div className="flex border-b border-edge dark:border-edge-dark">
          {[isRTL ? 'رفع الملف' : 'Upload', isRTL ? 'مراجعة' : 'Preview', isRTL ? 'النتيجة' : 'Result'].map((s, i) => (
            <div key={i} className={`flex-1 p-2.5 text-center text-xs border-b-2 ${step === i+1 ? 'text-brand-500 border-brand-500' : step > i+1 ? 'text-emerald-500 border-emerald-500' : 'text-brand-400 dark:text-brand-400 border-transparent'}`}>
              {step > i+1 ? '\u2713 ' : `${i+1}. `}{s}
            </div>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-auto p-6">

          {/* Step 1 - Upload */}
          {step === 1 && (
            <div>
              <div onDrop={handleDrop} onDragOver={over} onDragLeave={leave}
                className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all ${dragging ? 'border-brand-500 bg-brand-500/[0.03] dark:bg-brand-500/5' : 'border-gray-300 dark:border-brand-500/30'}`}
                onClick={() => document.getElementById('fileInput').click()}>
                <div className="text-[40px] mb-3">{'\u{1F4C2}'}</div>
                <div className="text-content-muted dark:text-content-muted-dark text-sm mb-2">{isRTL ? 'اسحب الملف هنا أو اضغط للاختيار' : 'Drag file here or click to browse'}</div>
                <div className="text-gray-400 dark:text-gray-600 text-xs">Excel (.xlsx) {isRTL ? 'أو' : 'or'} CSV</div>
                <input id="fileInput" type="file" accept=".xlsx,.csv" className="hidden" onChange={handleFile} />
              </div>
              <div className="text-center mt-4">
                <button onClick={() => {
                  const headers = Object.keys(COLUMN_MAP);
                  const ws = XLSX.utils.aoa_to_sheet([headers]);
                  const wb = XLSX.utils.book_new();
                  XLSX.utils.book_append_sheet(wb, ws, 'Contacts');
                  XLSX.writeFile(wb, 'import_template.xlsx');
                }} className="py-2 px-4 bg-brand-500/10 dark:bg-brand-500/10 border border-gray-300 dark:border-brand-500/25 rounded-lg text-brand-400 dark:text-brand-400 text-xs cursor-pointer">
                  {'\u2B07\uFE0F'} {isRTL ? 'تحميل نموذج الاستيراد' : 'Download Template'}
                </button>
              </div>
            </div>
          )}

          {/* Step 2 - Preview */}
          {step === 2 && (
            <div>
              <SummaryCards items={[
                { num: newRows.length, label: isRTL ? 'عميل جديد' : 'New Contacts', color: '#10B981', bg: 'rgba(16,185,129,0.1)', border: 'rgba(16,185,129,0.2)', icon: '\u2705' },
                { num: oppRows.length, label: isRTL ? 'فرصة جديدة' : 'New Opportunity', color: '#4A7AAB', bg: 'rgba(74,122,171,0.1)', border: 'rgba(74,122,171,0.2)', icon: '\u{1F504}' },
                { num: errRows.length, label: isRTL ? 'مرفوض' : 'Rejected', color: '#EF4444', bg: 'rgba(239,68,68,0.1)', border: 'rgba(239,68,68,0.2)', icon: '\u274C' },
              ]} />

              <div className="flex gap-1.5 mb-3">
                {[['all', `${isRTL ? 'الكل' : 'All'} (${rows.length})`], ['new', `${isRTL ? 'جديد' : 'New'} (${newRows.length})`], ['opp', `${isRTL ? 'فرص' : 'Opps'} (${oppRows.length})`], ['err', `${isRTL ? 'أخطاء' : 'Errors'} (${errRows.length})`]].map(([v, l]) => (
                  <button key={v} onClick={() => setTab(v)}
                    className={`py-[5px] px-3 rounded-full text-[11px] cursor-pointer border ${tab===v ? 'border-brand-500/40 dark:border-brand-500/40 bg-brand-500/[0.08] dark:bg-brand-500/15 text-brand-500' : 'border-edge dark:border-edge-dark bg-transparent text-brand-400 dark:text-brand-400'}`}>{l}</button>
                ))}
              </div>

              <div className="max-h-[220px] overflow-y-auto">
                <table className="w-full border-collapse">
                  <thead><tr>
                    {[isRTL ? 'الاسم' : 'Name', isRTL ? 'الرقم' : 'Phone', isRTL ? 'الحالة' : 'Status', isRTL ? 'السبب' : 'Note'].map((h, i) => (
                      <th key={i} className={`text-content-muted dark:text-content-muted-dark py-2 px-2.5 text-start border-b border-edge dark:border-edge-dark text-[11px] font-semibold`}>{h}</th>
                    ))}
                  </tr></thead>
                  <tbody>
                    {displayRows.map((r, i) => (
                      <tr key={i}>
                        <td className="text-content dark:text-content-dark py-2 px-2.5 border-b border-gray-100 dark:border-brand-500/[0.06] text-xs">{r.full_name || '\u2014'}</td>
                        <td className="text-content dark:text-content-dark py-2 px-2.5 border-b border-gray-100 dark:border-brand-500/[0.06] text-[11px] font-mono">{r.phone || '\u2014'}</td>
                        <td className="text-content dark:text-content-dark py-2 px-2.5 border-b border-gray-100 dark:border-brand-500/[0.06] text-xs">
                          {r._status === 'new' && <span className="px-2 py-[3px] rounded-full bg-emerald-500/15 text-emerald-500 text-[11px]">{'\u2705'} {isRTL ? 'جديد' : 'New'}</span>}
                          {r._status === 'opportunity' && <span className="px-2 py-[3px] rounded-full bg-brand-500/15 text-brand-500 text-[11px]">{'\u{1F504}'} {isRTL ? 'فرصة' : 'Opp'}</span>}
                          {r._status === 'error' && <span className="px-2 py-[3px] rounded-full bg-red-500/15 text-red-500 text-[11px]">{'\u274C'} {isRTL ? 'خطأ' : 'Error'}</span>}
                        </td>
                        <td className="py-2 px-2.5 border-b border-gray-100 dark:border-brand-500/[0.06] text-[11px] text-content-muted dark:text-content-muted-dark">
                          {r._status === 'opportunity' ? (isRTL ? `موجود: ${r._existingName}` : `Exists: ${r._existingName}`) : r._reason || '\u2014'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Step 3 - Result */}
          {step === 3 && (
            <div className="text-center">
              <div className="text-[48px] mb-4">{'\u{1F389}'}</div>
              <div className="text-content dark:text-content-dark text-lg font-bold mb-2">{isRTL ? 'تم الاستيراد بنجاح' : 'Import Complete!'}</div>
              <div className="text-content-muted dark:text-content-muted-dark text-xs mb-6">{isRTL ? `تمت معالجة ${rows.length} صف` : `Processed ${rows.length} rows`}</div>
              <SummaryCards items={[
                { num: newRows.length, label: isRTL ? 'أضيفوا' : 'Added', color: '#10B981', bg: 'rgba(16,185,129,0.1)', border: 'rgba(16,185,129,0.2)' },
                { num: oppRows.length, label: isRTL ? 'فرص جديدة' : 'Opportunities', color: '#4A7AAB', bg: 'rgba(74,122,171,0.1)', border: 'rgba(74,122,171,0.2)' },
                { num: errRows.length, label: isRTL ? 'مرفوضين' : 'Rejected', color: '#EF4444', bg: 'rgba(239,68,68,0.1)', border: 'rgba(239,68,68,0.2)' },
              ]} />
              {errRows.length > 0 && (
                <button onClick={downloadErrors} className="w-full p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-500 text-xs font-bold cursor-pointer flex items-center justify-center gap-2">
                  {'\u2B07\uFE0F'} {isRTL ? `تحميل تقرير الأخطاء (${errRows.length} صف)` : `Download Error Report (${errRows.length} rows)`}
                </button>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-edge dark:border-edge-dark flex justify-between">
          <button onClick={step === 1 ? onClose : () => setStep(s => s-1)}
            className="py-2.5 px-5 bg-gray-100 dark:bg-brand-500/10 border border-edge dark:border-edge-dark rounded-lg text-content-muted dark:text-content-muted-dark text-xs cursor-pointer">
            {step === 1 ? (isRTL ? 'إلغاء' : 'Cancel') : (isRTL ? '\u2190 رجوع' : '\u2190 Back')}
          </button>
          {step === 2 && (
            <button onClick={handleImport} disabled={importing || newRows.length === 0 && oppRows.length === 0}
              className="py-2.5 px-[22px] bg-gradient-to-br from-brand-800 to-brand-500 border-none rounded-lg text-white text-xs font-bold cursor-pointer">
              {importing ? (isRTL ? 'جاري الاستيراد...' : 'Importing...') : (isRTL ? 'تأكيد الرفع \u2713' : 'Confirm Import \u2713')}
            </button>
          )}
          {step === 3 && (
            <button onClick={onClose}
              className="py-2.5 px-[22px] bg-gradient-to-br from-brand-800 to-brand-500 border-none rounded-lg text-white text-xs font-bold cursor-pointer">
              {isRTL ? 'إغلاق' : 'Close'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
