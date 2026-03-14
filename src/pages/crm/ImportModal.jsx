import { useState, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import ExcelJS from 'exceljs';
import { Button, FilterPill } from '../../components/ui';

const SOURCE_PLATFORM = { facebook: 'meta', instagram: 'meta', google_ads: 'google', website: 'organic', call: 'direct', walk_in: 'direct', referral: 'direct', developer: 'direct', cold_call: 'direct', other: 'other' };

// System fields that users can map to
const SYSTEM_FIELDS = [
  { key: 'full_name', en: 'Full Name', ar: 'الاسم الكامل', required: true },
  { key: 'phone', en: 'Phone', ar: 'رقم الموبايل', required: true },
  { key: 'phone2', en: 'Phone 2', ar: 'رقم ثاني' },
  { key: 'email', en: 'Email', ar: 'البريد الإلكتروني' },
  { key: 'company', en: 'Company', ar: 'الشركة' },
  { key: 'job_title', en: 'Job Title', ar: 'المسمى الوظيفي' },
  { key: 'department', en: 'Department', ar: 'القسم' },
  { key: 'source', en: 'Source', ar: 'المصدر' },
  { key: 'contact_type', en: 'Contact Type', ar: 'نوع العميل' },
  { key: 'notes', en: 'Notes', ar: 'ملاحظات' },
  { key: 'nationality', en: 'Nationality', ar: 'الجنسية' },
  { key: 'preferred_location', en: 'Preferred Location', ar: 'الموقع المفضل' },
  { key: 'campaign_name', en: 'Campaign', ar: 'الحملة' },
  { key: 'temperature', en: 'Rating', ar: 'التصنيف' },
  { key: 'assigned_to_name', en: 'Assigned To', ar: 'مسؤول' },
  { key: 'created_at', en: 'Created At', ar: 'تاريخ الإنشاء' },
  { key: 'budget_min', en: 'Budget', ar: 'الميزانية' },
];

// Auto-detect mapping from common column header names (case-insensitive)
const AUTO_DETECT_MAP = {
  // English variants
  'full_name': 'full_name', 'fullname': 'full_name', 'full name': 'full_name', 'name': 'full_name', 'contact name': 'full_name', 'customer name': 'full_name', 'client name': 'full_name',
  'phone': 'phone', 'phone1': 'phone', 'phone 1': 'phone', 'mobile': 'phone', 'mobile_numbers': 'phone', 'mobile number': 'phone', 'tel': 'phone', 'telephone': 'phone', 'cell': 'phone',
  'phone2': 'phone2', 'phone 2': 'phone2', 'mobile2': 'phone2', 'mobile 2': 'phone2', 'secondary phone': 'phone2', 'alt phone': 'phone2',
  'email': 'email', 'emails': 'email', 'e-mail': 'email', 'email address': 'email', 'mail': 'email',
  'company': 'company', 'company name': 'company', 'organization': 'company', 'org': 'company',
  'job_title': 'job_title', 'job title': 'job_title', 'title': 'job_title', 'position': 'job_title', 'role': 'job_title',
  'department': 'department', 'dept': 'department', 'dept.': 'department',
  'source': 'source', 'lead source': 'source', 'channel': 'source',
  'contact_type': 'contact_type', 'type': 'contact_type', 'contact type': 'contact_type', 'category': 'contact_type',
  'notes': 'notes', 'note': 'notes', 'description': 'notes', 'comment': 'notes', 'comments': 'notes',
  'nationality': 'nationality', 'country': 'nationality',
  'preferred_location': 'preferred_location', 'location': 'preferred_location', 'preferred location': 'preferred_location', 'area': 'preferred_location',
  'campaigns': 'campaign_name', 'campaign': 'campaign_name', 'campaign_name': 'campaign_name',
  'rating': 'temperature', 'temperature': 'temperature',
  'assignees': 'assigned_to_name', 'assigned_to': 'assigned_to_name', 'assigned to': 'assigned_to_name', 'assignee': 'assigned_to_name',
  'created_at': 'created_at', 'created at': 'created_at', 'date': 'created_at', 'created': 'created_at',
  'wallet': 'budget_min', 'budget': 'budget_min', 'budget_min': 'budget_min',
  // Also support the old COLUMN_MAP keys
  'FULL_NAME': 'full_name', 'MOBILE_NUMBERS': 'phone', 'SOURCE': 'source', 'CAMPAIGNS': 'campaign_name',
  'TYPE': 'contact_type', 'RATING': 'temperature', 'DEPARTMENT': 'department', 'ASSIGNEES': 'assigned_to_name',
  'CREATED_AT': 'created_at', 'DESCRIPTION': 'notes', 'LAST_ACTIVITY': 'last_activity_at', 'WALLET': 'budget_min', 'EMAILS': 'email',
  // Arabic variants
  'الاسم': 'full_name', 'الاسم الكامل': 'full_name', 'اسم العميل': 'full_name', 'اسم': 'full_name',
  'الموبايل': 'phone', 'رقم الموبايل': 'phone', 'الهاتف': 'phone', 'رقم الهاتف': 'phone', 'موبايل': 'phone', 'تليفون': 'phone',
  'موبايل 2': 'phone2', 'رقم ثاني': 'phone2',
  'الايميل': 'email', 'البريد': 'email', 'البريد الإلكتروني': 'email', 'ايميل': 'email',
  'الشركة': 'company', 'شركة': 'company', 'اسم الشركة': 'company',
  'المسمى الوظيفي': 'job_title', 'الوظيفة': 'job_title',
  'القسم': 'department',
  'المصدر': 'source',
  'النوع': 'contact_type', 'نوع العميل': 'contact_type',
  'ملاحظات': 'notes',
  'الجنسية': 'nationality',
  'الموقع': 'preferred_location', 'الموقع المفضل': 'preferred_location',
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

// Normalize Arabic name for fuzzy matching
const normalizeArabicName = (name) => {
  if (!name) return '';
  return String(name)
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    // Normalize Arabic characters
    .replace(/[إأآا]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/[َُِّْـً]/g, '') // Remove tashkeel
    .trim();
};

// Validate email format
const validateEmail = (email) => {
  if (!email) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).trim());
};

export default function ImportModal({ onClose, existingContacts, onImportDone }) {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const [step, setStep] = useState(1);
  const [rawData, setRawData] = useState([]); // Raw rows from Excel
  const [excelColumns, setExcelColumns] = useState([]); // Detected column headers
  const [columnMapping, setColumnMapping] = useState({}); // excelCol -> systemField
  const [rows, setRows] = useState([]);
  const [dragging, setDragging] = useState(false);
  const [duplicateAction, setDuplicateAction] = useState('opportunity'); // 'skip' | 'opportunity' | 'overwrite'
  const [importProgress, setImportProgress] = useState({ current: 0, total: 0, active: false });

  const processFile = async (file) => {
    const arrayBuffer = await file.arrayBuffer();
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(arrayBuffer);
    const ws = workbook.worksheets[0];
    if (!ws || ws.rowCount === 0) return;

    // Extract headers from first row
    const headerRow = ws.getRow(1);
    const cols = [];
    headerRow.eachCell({ includeEmpty: false }, (cell, colNumber) => {
      cols.push({ colNumber, name: String(cell.value || '').trim() });
    });
    if (cols.length === 0) return;

    const colNames = cols.map(c => c.name);

    // Extract data rows
    const raw = [];
    ws.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      if (rowNumber === 1) return; // skip header
      const obj = {};
      cols.forEach(({ colNumber, name }) => {
        const cellValue = row.getCell(colNumber).value;
        obj[name] = cellValue != null ? cellValue : '';
      });
      raw.push(obj);
    });

    if (raw.length === 0) return;

    setExcelColumns(colNames);
    setRawData(raw);

    // Auto-detect column mappings
    const autoMap = {};
    const usedSystemFields = new Set();
    colNames.forEach(col => {
      const normalized = col.trim().toLowerCase();
      const detected = AUTO_DETECT_MAP[normalized] || AUTO_DETECT_MAP[col];
      if (detected && !usedSystemFields.has(detected)) {
        autoMap[col] = detected;
        usedSystemFields.add(detected);
      }
    });
    setColumnMapping(autoMap);
    setStep(2); // Go to mapping step
  };

  // Process mapped data into rows with validation and duplicate detection
  const processMapping = () => {
    const mapping = columnMapping;
    const processed = rawData.map((row, idx) => {
      const mapped = {};
      Object.entries(mapping).forEach(([excelCol, systemField]) => {
        if (systemField && systemField !== '_skip') {
          mapped[systemField] = row[excelCol];
        }
      });

      const phone = normalizePhone(mapped.phone);
      const phone2 = normalizePhone(mapped.phone2);
      const email = mapped.email ? String(mapped.email).trim() : '';
      const full_name = (mapped.full_name || '').trim();

      // Validate
      if (!phone || !validatePhone(phone)) {
        return { ...mapped, _row: idx + 2, _status: 'error', _reason: isRTL ? 'رقم غير صحيح أو مفقود' : 'Invalid or missing phone' };
      }
      if (!full_name) {
        return { ...mapped, _row: idx + 2, _status: 'error', _reason: isRTL ? 'الاسم مفقود' : 'Missing name' };
      }

      // Enhanced duplicate detection: phone, email, fuzzy name
      let duplicateMatch = null;
      let duplicateReason = '';

      // Check phone match
      const phoneMatch = existingContacts.find(c => c.phone === phone || c.phone2 === phone || (phone2 && (c.phone === phone2 || c.phone2 === phone2)));
      if (phoneMatch) {
        duplicateMatch = phoneMatch;
        duplicateReason = isRTL ? `رقم مطابق: ${phoneMatch.full_name}` : `Phone match: ${phoneMatch.full_name}`;
      }

      // Check email match
      if (!duplicateMatch && email && validateEmail(email)) {
        const emailMatch = existingContacts.find(c => c.email && c.email.toLowerCase() === email.toLowerCase());
        if (emailMatch) {
          duplicateMatch = emailMatch;
          duplicateReason = isRTL ? `ايميل مطابق: ${emailMatch.full_name}` : `Email match: ${emailMatch.full_name}`;
        }
      }

      // Fuzzy name match (normalized Arabic)
      if (!duplicateMatch && full_name) {
        const normalizedNew = normalizeArabicName(full_name);
        if (normalizedNew.length > 2) {
          const nameMatch = existingContacts.find(c => {
            const normalizedExisting = normalizeArabicName(c.full_name);
            return normalizedExisting === normalizedNew;
          });
          if (nameMatch) {
            duplicateMatch = nameMatch;
            duplicateReason = isRTL ? `اسم مطابق: ${nameMatch.full_name}` : `Name match: ${nameMatch.full_name}`;
          }
        }
      }

      if (duplicateMatch) {
        return {
          ...mapped, phone, phone2, email, full_name,
          _row: idx + 2,
          _status: duplicateAction === 'skip' ? 'skipped' : duplicateAction === 'overwrite' ? 'overwrite' : 'opportunity',
          _existingId: duplicateMatch.id,
          _existingName: duplicateMatch.full_name,
          _duplicateReason: duplicateReason,
        };
      }

      return {
        ...mapped,
        phone,
        phone2,
        email,
        full_name,
        contact_type: TYPE_MAP[mapped.contact_type] || 'lead',
        temperature: RATING_MAP[mapped.temperature] || 'warm',
        department: mapped.department || 'sales',
        platform: SOURCE_PLATFORM[mapped.source] || 'other',
        _row: idx + 2,
        _status: 'new',
      };
    });

    setRows(processed);
    setStep(3);
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
  const overwriteRows = rows.filter(r => r._status === 'overwrite');
  const skippedRows = rows.filter(r => r._status === 'skipped');
  const errRows = rows.filter(r => r._status === 'error');
  const dupRows = [...oppRows, ...overwriteRows, ...skippedRows];

  const [tab, setTab] = useState('all');
  const [importing, setImporting] = useState(false);

  const displayRows = tab === 'all' ? rows : tab === 'new' ? newRows : tab === 'dup' ? dupRows : errRows;

  const downloadErrors = async () => {
    const data = errRows.map(r => ({
      ROW: r._row,
      FULL_NAME: r.full_name || '',
      MOBILE_NUMBERS: r.phone || '',
      SOURCE: r.source || '',
      CAMPAIGNS: r.campaign_name || '',
      TYPE: r.contact_type || '',
      REASON: r._reason,
    }));
    const workbook = new ExcelJS.Workbook();
    const ws = workbook.addWorksheet('Errors');
    const keys = Object.keys(data[0]);
    ws.columns = keys.map(key => ({ header: key, key }));
    data.forEach(row => ws.addRow(row));
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'import_errors.xlsx'; a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = async () => {
    setImporting(true);
    const importable = [...newRows, ...overwriteRows];
    const total = importable.length;
    const showProgress = total > 100;

    if (showProgress) {
      setImportProgress({ current: 0, total, active: true });
    }

    const toAdd = [];
    const baseId = Math.max(0, ...existingContacts.map(c => parseInt(c.id) || 0));

    for (let i = 0; i < importable.length; i++) {
      const r = importable[i];
      toAdd.push({
        ...r,
        id: r._status === 'overwrite' ? r._existingId : String(baseId + i + 1),
        lead_score: 0,
        is_blacklisted: false,
        created_at: r.created_at || new Date().toISOString(),
      });

      // Update progress for large imports
      if (showProgress && (i % 10 === 0 || i === importable.length - 1)) {
        setImportProgress({ current: i + 1, total, active: true });
        await new Promise(resolve => setTimeout(resolve, 5));
      }
    }

    await new Promise(r => setTimeout(r, 400));
    setImportProgress({ current: total, total, active: false });
    onImportDone(toAdd, oppRows);
    setStep(4);
    setImporting(false);
  };

  const over = (e) => { e.preventDefault(); setDragging(true); };
  const leave = () => setDragging(false);

  // How many required fields are mapped
  const requiredMapped = SYSTEM_FIELDS.filter(f => f.required).every(f =>
    Object.values(columnMapping).includes(f.key)
  );

  const SummaryCards = ({ items }) => (
    <div className={`grid gap-2.5 mb-5`} style={{ gridTemplateColumns: `repeat(${items.length}, 1fr)` }}>
      {items.map(s => (
        <div key={s.label} className="rounded-xl p-3 text-center" style={{ background: s.bg, border: `1px solid ${s.border}` }}>
          <div className="text-2xl font-bold" style={{ color: s.color }}>{s.num}</div>
          <div className="text-xs text-content-muted dark:text-content-muted-dark mt-1">{s.icon ? `${s.icon} ` : ''}{s.label}</div>
        </div>
      ))}
    </div>
  );

  const stepLabels = [
    isRTL ? 'رفع الملف' : 'Upload',
    isRTL ? 'ربط الأعمدة' : 'Map Columns',
    isRTL ? 'مراجعة' : 'Preview',
    isRTL ? 'النتيجة' : 'Result',
  ];

  return (
    <div className="fixed inset-0 bg-black/50 z-[200] flex items-center justify-center" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="bg-surface-card dark:bg-surface-card-dark border border-gray-300 dark:border-brand-500/30 rounded-2xl w-[720px] max-h-[90vh] flex flex-col overflow-hidden">

        {/* Header */}
        <div className="px-6 pt-5 pb-4 border-b border-edge dark:border-edge-dark flex justify-between items-center">
          <h2 className="text-content dark:text-content-dark text-base font-bold">{'\u{1F4E4}'} {isRTL ? 'استيراد جهات الاتصال' : 'Import Contacts'}</h2>
          <button onClick={onClose} className="bg-transparent border-none text-brand-400 dark:text-brand-400 text-xl cursor-pointer">&times;</button>
        </div>

        {/* Steps */}
        <div className="flex border-b border-edge dark:border-edge-dark">
          {stepLabels.map((s, i) => (
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
                <Button variant="secondary" size="sm" onClick={async () => {
                  const headers = SYSTEM_FIELDS.map(f => f.key);
                  const workbook = new ExcelJS.Workbook();
                  const ws = workbook.addWorksheet('Contacts');
                  ws.addRow(headers);
                  const buffer = await workbook.xlsx.writeBuffer();
                  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a'); a.href = url; a.download = 'import_template.xlsx'; a.click();
                  URL.revokeObjectURL(url);
                }}>
                  {'\u2B07\uFE0F'} {isRTL ? 'تحميل نموذج الاستيراد' : 'Download Template'}
                </Button>
              </div>
            </div>
          )}

          {/* Step 2 - Column Mapping */}
          {step === 2 && (
            <div>
              <div className="mb-4">
                <div className="text-content dark:text-content-dark text-sm font-semibold mb-1">
                  {isRTL ? `تم اكتشاف ${excelColumns.length} عمود و ${rawData.length} صف` : `Detected ${excelColumns.length} columns and ${rawData.length} rows`}
                </div>
                <div className="text-content-muted dark:text-content-muted-dark text-xs">
                  {isRTL ? 'اربط كل عمود من الملف بالحقل المناسب في النظام' : 'Map each file column to the corresponding system field'}
                </div>
              </div>

              {/* Required fields warning */}
              {!requiredMapped && (
                <div className="mb-4 px-3 py-2 rounded-lg text-xs" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#EF4444' }}>
                  {isRTL ? 'الحقول المطلوبة: الاسم الكامل، رقم الموبايل' : 'Required fields: Full Name, Phone'}
                </div>
              )}

              <div className="max-h-[340px] overflow-y-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr>
                      <th className="text-content-muted dark:text-content-muted-dark py-2 px-2.5 text-start border-b border-edge dark:border-edge-dark text-xs font-semibold" style={{ width: '35%' }}>
                        {isRTL ? 'عمود الملف' : 'File Column'}
                      </th>
                      <th className="text-content-muted dark:text-content-muted-dark py-2 px-2.5 text-center border-b border-edge dark:border-edge-dark text-xs font-semibold" style={{ width: '10%' }}>
                        {'\u2192'}
                      </th>
                      <th className="text-content-muted dark:text-content-muted-dark py-2 px-2.5 text-start border-b border-edge dark:border-edge-dark text-xs font-semibold" style={{ width: '40%' }}>
                        {isRTL ? 'حقل النظام' : 'System Field'}
                      </th>
                      <th className="text-content-muted dark:text-content-muted-dark py-2 px-2.5 text-start border-b border-edge dark:border-edge-dark text-xs font-semibold" style={{ width: '15%' }}>
                        {isRTL ? 'مثال' : 'Sample'}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {excelColumns.map((col) => {
                      const currentMapping = columnMapping[col] || '_skip';
                      const sampleValue = rawData[0]?.[col] || '';
                      const isAutoDetected = currentMapping !== '_skip' && AUTO_DETECT_MAP[col.trim().toLowerCase()] === currentMapping;
                      // Fields already used by other columns
                      const usedFields = new Set(
                        Object.entries(columnMapping)
                          .filter(([k, v]) => k !== col && v && v !== '_skip')
                          .map(([, v]) => v)
                      );

                      return (
                        <tr key={col} className={currentMapping !== '_skip' ? '' : 'opacity-50'}>
                          <td className="py-2 px-2.5 border-b border-gray-100 dark:border-brand-500/[0.06] text-xs text-content dark:text-content-dark font-mono">
                            {col}
                          </td>
                          <td className="py-2 px-2.5 border-b border-gray-100 dark:border-brand-500/[0.06] text-center text-xs text-content-muted dark:text-content-muted-dark">
                            {currentMapping !== '_skip' ? (
                              <span className="text-emerald-500">{'\u2192'}</span>
                            ) : (
                              <span className="text-gray-400">{'\u00D7'}</span>
                            )}
                          </td>
                          <td className="py-2 px-2.5 border-b border-gray-100 dark:border-brand-500/[0.06]">
                            <select
                              value={currentMapping}
                              onChange={(e) => {
                                setColumnMapping(prev => ({ ...prev, [col]: e.target.value }));
                              }}
                              className="w-full text-xs rounded-lg px-2 py-1.5 border bg-surface-card dark:bg-surface-card-dark text-content dark:text-content-dark border-gray-300 dark:border-brand-500/30 outline-none"
                              style={isAutoDetected ? { borderColor: 'rgba(16,185,129,0.5)' } : {}}
                            >
                              <option value="_skip">{isRTL ? '-- تخطي --' : '-- Skip --'}</option>
                              {SYSTEM_FIELDS.map(f => (
                                <option key={f.key} value={f.key} disabled={usedFields.has(f.key)}>
                                  {isRTL ? f.ar : f.en}{f.required ? ' *' : ''}{usedFields.has(f.key) ? (isRTL ? ' (مستخدم)' : ' (used)') : ''}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="py-2 px-2.5 border-b border-gray-100 dark:border-brand-500/[0.06] text-xs text-content-muted dark:text-content-muted-dark truncate max-w-[100px]" title={String(sampleValue)}>
                            {String(sampleValue).slice(0, 20) || '\u2014'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Duplicate handling */}
              <div className="mt-4 pt-4 border-t border-edge dark:border-edge-dark">
                <div className="text-content dark:text-content-dark text-xs font-semibold mb-2">
                  {isRTL ? 'التعامل مع التكرار (رقم، ايميل، اسم مطابق):' : 'Duplicate handling (phone, email, name match):'}
                </div>
                <div className="flex gap-2">
                  {[
                    { value: 'opportunity', label: isRTL ? 'فرصة جديدة' : 'New Opportunity', icon: '\u{1F504}' },
                    { value: 'skip', label: isRTL ? 'تخطي' : 'Skip', icon: '\u23ED' },
                    { value: 'overwrite', label: isRTL ? 'استبدال' : 'Overwrite', icon: '\u270F\uFE0F' },
                  ].map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => setDuplicateAction(opt.value)}
                      className={`flex-1 px-3 py-2 rounded-lg text-xs border cursor-pointer transition-all ${
                        duplicateAction === opt.value
                          ? 'border-brand-500 bg-brand-500/10 text-brand-500'
                          : 'border-gray-300 dark:border-brand-500/30 bg-transparent text-content-muted dark:text-content-muted-dark'
                      }`}
                    >
                      {opt.icon} {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Step 3 - Preview */}
          {step === 3 && (
            <div>
              <SummaryCards items={[
                { num: newRows.length, label: isRTL ? 'عميل جديد' : 'New Contacts', color: '#10B981', bg: 'rgba(16,185,129,0.1)', border: 'rgba(16,185,129,0.2)', icon: '\u2705' },
                { num: dupRows.length, label: isRTL ? (duplicateAction === 'skip' ? 'تخطي' : duplicateAction === 'overwrite' ? 'استبدال' : 'فرصة جديدة') : (duplicateAction === 'skip' ? 'Skipped' : duplicateAction === 'overwrite' ? 'Overwrite' : 'Opportunity'), color: '#4A7AAB', bg: 'rgba(74,122,171,0.1)', border: 'rgba(74,122,171,0.2)', icon: duplicateAction === 'skip' ? '\u23ED' : duplicateAction === 'overwrite' ? '\u270F\uFE0F' : '\u{1F504}' },
                { num: errRows.length, label: isRTL ? 'مرفوض' : 'Rejected', color: '#EF4444', bg: 'rgba(239,68,68,0.1)', border: 'rgba(239,68,68,0.2)', icon: '\u274C' },
              ]} />

              <div className="flex gap-1.5 mb-3">
                {[
                  ['all', isRTL ? 'الكل' : 'All', rows.length],
                  ['new', isRTL ? 'جديد' : 'New', newRows.length],
                  ['dup', isRTL ? 'مكرر' : 'Duplicates', dupRows.length],
                  ['err', isRTL ? 'أخطاء' : 'Errors', errRows.length],
                ].map(([v, l, c]) => (
                  <FilterPill key={v} label={l} count={c} active={tab===v} onClick={() => setTab(v)} />
                ))}
              </div>

              {/* Progress bar for large imports */}
              {importing && importProgress.active && (
                <div className="mb-4">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-xs text-content-muted dark:text-content-muted-dark">
                      {isRTL ? `جاري المعالجة ${importProgress.current} من ${importProgress.total}...` : `Processing ${importProgress.current} of ${importProgress.total}...`}
                    </span>
                    <span className="text-xs text-brand-500 font-semibold">
                      {Math.round((importProgress.current / importProgress.total) * 100)}%
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-gray-200 dark:bg-brand-500/10 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-300"
                      style={{
                        width: `${(importProgress.current / importProgress.total) * 100}%`,
                        background: 'linear-gradient(90deg, #4A7AAB, #10B981)',
                      }}
                    />
                  </div>
                </div>
              )}

              <div className="max-h-[220px] overflow-y-auto">
                <table className="w-full border-collapse">
                  <thead><tr>
                    {[isRTL ? 'الاسم' : 'Name', isRTL ? 'الرقم' : 'Phone', isRTL ? 'الايميل' : 'Email', isRTL ? 'الحالة' : 'Status', isRTL ? 'السبب' : 'Note'].map((h, i) => (
                      <th key={i} className="text-content-muted dark:text-content-muted-dark py-2 px-2.5 text-start border-b border-edge dark:border-edge-dark text-xs font-semibold">{h}</th>
                    ))}
                  </tr></thead>
                  <tbody>
                    {displayRows.map((r, i) => {
                      const isDuplicate = r._status === 'opportunity' || r._status === 'overwrite' || r._status === 'skipped';
                      return (
                        <tr key={i} style={isDuplicate ? { background: 'rgba(74,122,171,0.05)' } : {}}>
                          <td className="text-content dark:text-content-dark py-2 px-2.5 border-b border-gray-100 dark:border-brand-500/[0.06] text-xs">{r.full_name || '\u2014'}</td>
                          <td className="text-content dark:text-content-dark py-2 px-2.5 border-b border-gray-100 dark:border-brand-500/[0.06] text-xs font-mono">{r.phone || '\u2014'}</td>
                          <td className="text-content dark:text-content-dark py-2 px-2.5 border-b border-gray-100 dark:border-brand-500/[0.06] text-xs">{r.email || '\u2014'}</td>
                          <td className="text-content dark:text-content-dark py-2 px-2.5 border-b border-gray-100 dark:border-brand-500/[0.06] text-xs">
                            {r._status === 'new' && <span className="px-2 py-[3px] rounded-full bg-emerald-500/15 text-emerald-500 text-xs">{'\u2705'} {isRTL ? 'جديد' : 'New'}</span>}
                            {r._status === 'opportunity' && <span className="px-2 py-[3px] rounded-full bg-brand-500/15 text-brand-500 text-xs">{'\u{1F504}'} {isRTL ? 'فرصة' : 'Opp'}</span>}
                            {r._status === 'overwrite' && <span className="px-2 py-[3px] rounded-full bg-amber-500/15 text-amber-500 text-xs">{'\u270F\uFE0F'} {isRTL ? 'استبدال' : 'Overwrite'}</span>}
                            {r._status === 'skipped' && <span className="px-2 py-[3px] rounded-full bg-gray-500/15 text-gray-500 text-xs">{'\u23ED'} {isRTL ? 'تخطي' : 'Skipped'}</span>}
                            {r._status === 'error' && <span className="px-2 py-[3px] rounded-full bg-red-500/15 text-red-500 text-xs">{'\u274C'} {isRTL ? 'خطأ' : 'Error'}</span>}
                          </td>
                          <td className="py-2 px-2.5 border-b border-gray-100 dark:border-brand-500/[0.06] text-xs text-content-muted dark:text-content-muted-dark">
                            {isDuplicate ? (r._duplicateReason || (isRTL ? `موجود: ${r._existingName}` : `Exists: ${r._existingName}`)) : r._reason || '\u2014'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Step 4 - Result */}
          {step === 4 && (
            <div className="text-center">
              <div className="text-[48px] mb-4">{'\u{1F389}'}</div>
              <div className="text-content dark:text-content-dark text-lg font-bold mb-2">{isRTL ? 'تم الاستيراد بنجاح' : 'Import Complete!'}</div>
              <div className="text-content-muted dark:text-content-muted-dark text-xs mb-6">{isRTL ? `تمت معالجة ${rows.length} صف` : `Processed ${rows.length} rows`}</div>
              <SummaryCards items={[
                { num: newRows.length, label: isRTL ? 'أضيفوا' : 'Added', color: '#10B981', bg: 'rgba(16,185,129,0.1)', border: 'rgba(16,185,129,0.2)' },
                { num: overwriteRows.length, label: isRTL ? 'تم استبدالهم' : 'Overwritten', color: '#F59E0B', bg: 'rgba(245,158,11,0.1)', border: 'rgba(245,158,11,0.2)' },
                { num: oppRows.length, label: isRTL ? 'فرص جديدة' : 'Opportunities', color: '#4A7AAB', bg: 'rgba(74,122,171,0.1)', border: 'rgba(74,122,171,0.2)' },
                { num: skippedRows.length, label: isRTL ? 'تم تخطيهم' : 'Skipped', color: '#6B7280', bg: 'rgba(107,114,128,0.1)', border: 'rgba(107,114,128,0.2)' },
                { num: errRows.length, label: isRTL ? 'مرفوضين' : 'Rejected', color: '#EF4444', bg: 'rgba(239,68,68,0.1)', border: 'rgba(239,68,68,0.2)' },
              ].filter(s => s.num > 0)} />
              {errRows.length > 0 && (
                <Button variant="danger" onClick={downloadErrors} className="w-full">
                  {'\u2B07\uFE0F'} {isRTL ? `تحميل تقرير الأخطاء (${errRows.length} صف)` : `Download Error Report (${errRows.length} rows)`}
                </Button>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-edge dark:border-edge-dark flex justify-between">
          <Button variant="secondary" size="sm" onClick={
            step === 1 ? onClose :
            step === 2 ? () => setStep(1) :
            step === 3 ? () => setStep(2) :
            onClose
          }>
            {step === 1 || step === 4 ? (isRTL ? 'إلغاء' : step === 4 ? 'Close' : 'Cancel') : (isRTL ? '\u2190 رجوع' : '\u2190 Back')}
          </Button>
          {step === 2 && (
            <Button size="sm" onClick={processMapping} disabled={!requiredMapped}>
              {isRTL ? 'معاينة \u2192' : 'Preview \u2192'}
            </Button>
          )}
          {step === 3 && (
            <Button size="sm" onClick={handleImport} disabled={importing || (newRows.length === 0 && oppRows.length === 0 && overwriteRows.length === 0)}>
              {importing ? (isRTL ? 'جاري الاستيراد...' : 'Importing...') : (isRTL ? 'تأكيد الرفع \u2713' : 'Confirm Import \u2713')}
            </Button>
          )}
          {step === 4 && (
            <Button size="sm" onClick={onClose}>
              {isRTL ? 'إغلاق' : 'Close'}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
