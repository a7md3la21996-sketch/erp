import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../contexts/ThemeContext';
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
  const { theme } = useTheme();
  const isDark = theme === 'dark';
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

  const th = { color: isDark ? '#6B8DB5' : '#6b7280', padding: '8px 10px', textAlign: isRTL ? 'right' : 'left', borderBottom: `1px solid ${isDark ? 'rgba(74,122,171,0.15)' : '#e5e7eb'}`, fontSize: 11, fontWeight: 600 };
  const td = { color: isDark ? '#E2EAF4' : '#1f2937', padding: '8px 10px', borderBottom: `1px solid ${isDark ? 'rgba(74,122,171,0.06)' : '#f3f4f6'}`, fontSize: 12 };
  const muted = isDark ? '#8BA8C8' : '#6b7280';
  const textPrimary = isDark ? '#E2EAF4' : '#1f2937';
  const textSecondary = isDark ? '#6B8DB5' : '#9ca3af';
  const borderColor = isDark ? 'rgba(74,122,171,0.15)' : '#e5e7eb';
  const borderAccent = isDark ? 'rgba(74,122,171,0.3)' : '#d1d5db';

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', direction: isRTL ? 'rtl' : 'ltr' }}>
      <div style={{ background: isDark ? '#1A2B3C' : '#ffffff', border: `1px solid ${borderAccent}`, borderRadius: 16, width: 640, maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* Header */}
        <div style={{ padding: '20px 24px 16px', borderBottom: `1px solid ${borderColor}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ color: textPrimary, fontSize: 16, fontWeight: 700 }}>📤 {isRTL ? 'استيراد جهات الاتصال' : 'Import Contacts'}</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: textSecondary, fontSize: 22, cursor: 'pointer' }}>×</button>
        </div>

        {/* Steps */}
        <div style={{ display: 'flex', borderBottom: `1px solid ${borderColor}` }}>
          {[isRTL ? 'رفع الملف' : 'Upload', isRTL ? 'مراجعة' : 'Preview', isRTL ? 'النتيجة' : 'Result'].map((s, i) => (
            <div key={i} style={{ flex: 1, padding: '10px', textAlign: 'center', fontSize: 12, color: step === i+1 ? '#4A7AAB' : step > i+1 ? '#10B981' : textSecondary, borderBottom: `2px solid ${step === i+1 ? '#4A7AAB' : step > i+1 ? '#10B981' : 'transparent'}` }}>
              {step > i+1 ? '✓ ' : `${i+1}. `}{s}
            </div>
          ))}
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflow: 'auto', padding: 24 }}>

          {/* Step 1 - Upload */}
          {step === 1 && (
            <div>
              <div onDrop={handleDrop} onDragOver={over} onDragLeave={leave}
                style={{ border: `2px dashed ${dragging ? '#4A7AAB' : borderAccent}`, borderRadius: 12, padding: 40, textAlign: 'center', cursor: 'pointer', background: dragging ? (isDark ? 'rgba(74,122,171,0.05)' : 'rgba(74,122,171,0.03)') : 'none', transition: 'all 0.2s' }}
                onClick={() => document.getElementById('fileInput').click()}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>📂</div>
                <div style={{ color: muted, fontSize: 14, marginBottom: 8 }}>{isRTL ? 'اسحب الملف هنا أو اضغط للاختيار' : 'Drag file here or click to browse'}</div>
                <div style={{ color: isDark ? '#4A5568' : '#9ca3af', fontSize: 12 }}>Excel (.xlsx) {isRTL ? 'أو' : 'or'} CSV</div>
                <input id="fileInput" type="file" accept=".xlsx,.csv" style={{ display: 'none' }} onChange={handleFile} />
              </div>
              <div style={{ textAlign: 'center', marginTop: 16 }}>
                <button onClick={() => {
                  const headers = Object.keys(COLUMN_MAP);
                  const ws = XLSX.utils.aoa_to_sheet([headers]);
                  const wb = XLSX.utils.book_new();
                  XLSX.utils.book_append_sheet(wb, ws, 'Contacts');
                  XLSX.writeFile(wb, 'import_template.xlsx');
                }} style={{ padding: '8px 16px', background: isDark ? 'rgba(74,122,171,0.1)' : 'rgba(74,122,171,0.06)', border: `1px solid ${isDark ? 'rgba(74,122,171,0.25)' : '#d1d5db'}`, borderRadius: 8, color: isDark ? '#6B8DB5' : '#4A7AAB', fontSize: 12, cursor: 'pointer' }}>
                  ⬇️ {isRTL ? 'تحميل نموذج الاستيراد' : 'Download Template'}
                </button>
              </div>
            </div>
          )}

          {/* Step 2 - Preview */}
          {step === 2 && (
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 20 }}>
                {[
                  { num: newRows.length, label: isRTL ? 'عميل جديد' : 'New Contacts', color: '#10B981', bg: 'rgba(16,185,129,0.1)', border: 'rgba(16,185,129,0.2)', icon: '✅' },
                  { num: oppRows.length, label: isRTL ? 'فرصة جديدة' : 'New Opportunity', color: '#4A7AAB', bg: 'rgba(74,122,171,0.1)', border: 'rgba(74,122,171,0.2)', icon: '🔄' },
                  { num: errRows.length, label: isRTL ? 'مرفوض' : 'Rejected', color: '#EF4444', bg: 'rgba(239,68,68,0.1)', border: 'rgba(239,68,68,0.2)', icon: '❌' },
                ].map(s => (
                  <div key={s.label} style={{ background: s.bg, border: `1px solid ${s.border}`, borderRadius: 10, padding: 12, textAlign: 'center' }}>
                    <div style={{ fontSize: 24, fontWeight: 700, color: s.color }}>{s.num}</div>
                    <div style={{ fontSize: 11, color: muted, marginTop: 4 }}>{s.icon} {s.label}</div>
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
                {[['all', `${isRTL ? 'الكل' : 'All'} (${rows.length})`], ['new', `${isRTL ? 'جديد' : 'New'} (${newRows.length})`], ['opp', `${isRTL ? 'فرص' : 'Opps'} (${oppRows.length})`], ['err', `${isRTL ? 'أخطاء' : 'Errors'} (${errRows.length})`]].map(([v, l]) => (
                  <button key={v} onClick={() => setTab(v)} style={{ padding: '5px 12px', borderRadius: 20, fontSize: 11, cursor: 'pointer', border: `1px solid ${tab===v ? (isDark ? 'rgba(74,122,171,0.4)' : '#4A7AAB') : borderColor}`, background: tab===v ? (isDark ? 'rgba(74,122,171,0.15)' : 'rgba(74,122,171,0.08)') : 'none', color: tab===v ? '#4A7AAB' : textSecondary }}>{l}</button>
                ))}
              </div>

              <div style={{ maxHeight: 220, overflowY: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead><tr>
                    <th style={th}>{isRTL ? 'الاسم' : 'Name'}</th>
                    <th style={th}>{isRTL ? 'الرقم' : 'Phone'}</th>
                    <th style={th}>{isRTL ? 'الحالة' : 'Status'}</th>
                    <th style={th}>{isRTL ? 'السبب' : 'Note'}</th>
                  </tr></thead>
                  <tbody>
                    {displayRows.map((r, i) => (
                      <tr key={i}>
                        <td style={td}>{r.full_name || '—'}</td>
                        <td style={{ ...td, fontFamily: 'monospace', fontSize: 11 }}>{r.phone || '—'}</td>
                        <td style={td}>
                          {r._status === 'new' && <span style={{ padding: '3px 8px', borderRadius: 20, background: 'rgba(16,185,129,0.15)', color: '#10B981', fontSize: 11 }}>✅ {isRTL ? 'جديد' : 'New'}</span>}
                          {r._status === 'opportunity' && <span style={{ padding: '3px 8px', borderRadius: 20, background: 'rgba(74,122,171,0.15)', color: '#4A7AAB', fontSize: 11 }}>🔄 {isRTL ? 'فرصة' : 'Opp'}</span>}
                          {r._status === 'error' && <span style={{ padding: '3px 8px', borderRadius: 20, background: 'rgba(239,68,68,0.15)', color: '#EF4444', fontSize: 11 }}>❌ {isRTL ? 'خطأ' : 'Error'}</span>}
                        </td>
                        <td style={{ ...td, fontSize: 11, color: muted }}>
                          {r._status === 'opportunity' ? (isRTL ? `موجود: ${r._existingName}` : `Exists: ${r._existingName}`) : r._reason || '—'}
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
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>🎉</div>
              <div style={{ color: textPrimary, fontSize: 18, fontWeight: 700, marginBottom: 8 }}>{isRTL ? 'تم الاستيراد بنجاح' : 'Import Complete!'}</div>
              <div style={{ color: muted, fontSize: 13, marginBottom: 24 }}>{isRTL ? `تمت معالجة ${rows.length} صف` : `Processed ${rows.length} rows`}</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 20 }}>
                {[
                  { num: newRows.length, label: isRTL ? 'أضيفوا' : 'Added', color: '#10B981', bg: 'rgba(16,185,129,0.1)', border: 'rgba(16,185,129,0.2)' },
                  { num: oppRows.length, label: isRTL ? 'فرص جديدة' : 'Opportunities', color: '#4A7AAB', bg: 'rgba(74,122,171,0.1)', border: 'rgba(74,122,171,0.2)' },
                  { num: errRows.length, label: isRTL ? 'مرفوضين' : 'Rejected', color: '#EF4444', bg: 'rgba(239,68,68,0.1)', border: 'rgba(239,68,68,0.2)' },
                ].map(s => (
                  <div key={s.label} style={{ background: s.bg, border: `1px solid ${s.border}`, borderRadius: 10, padding: 12, textAlign: 'center' }}>
                    <div style={{ fontSize: 24, fontWeight: 700, color: s.color }}>{s.num}</div>
                    <div style={{ fontSize: 11, color: muted, marginTop: 4 }}>{s.label}</div>
                  </div>
                ))}
              </div>
              {errRows.length > 0 && (
                <button onClick={downloadErrors} style={{ width: '100%', padding: 12, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 10, color: '#EF4444', fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                  ⬇️ {isRTL ? `تحميل تقرير الأخطاء (${errRows.length} صف)` : `Download Error Report (${errRows.length} rows)`}
                </button>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '16px 24px', borderTop: `1px solid ${borderColor}`, display: 'flex', justifyContent: 'space-between' }}>
          <button onClick={step === 1 ? onClose : () => setStep(s => s-1)} style={{ padding: '9px 18px', background: isDark ? 'rgba(74,122,171,0.1)' : '#f3f4f6', border: `1px solid ${borderColor}`, borderRadius: 8, color: muted, fontSize: 13, cursor: 'pointer' }}>
            {step === 1 ? (isRTL ? 'إلغاء' : 'Cancel') : (isRTL ? '← رجوع' : '← Back')}
          </button>
          {step === 2 && (
            <button onClick={handleImport} disabled={importing || newRows.length === 0 && oppRows.length === 0} style={{ padding: '9px 22px', background: 'linear-gradient(135deg,#2B4C6F,#4A7AAB)', border: 'none', borderRadius: 8, color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
              {importing ? (isRTL ? 'جاري الاستيراد...' : 'Importing...') : (isRTL ? 'تأكيد الرفع ✓' : 'Confirm Import ✓')}
            </button>
          )}
          {step === 3 && (
            <button onClick={onClose} style={{ padding: '9px 22px', background: 'linear-gradient(135deg,#2B4C6F,#4A7AAB)', border: 'none', borderRadius: 8, color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
              {isRTL ? 'إغلاق' : 'Close'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
