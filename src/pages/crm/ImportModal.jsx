import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../contexts/ThemeContext';
import supabase from '../../lib/supabase';
// ExcelJS is loaded dynamically to reduce bundle size (~917KB)
import { Button, FilterPill } from '../../components/ui';

// Normalize a name for fuzzy comparison: trim, collapse spaces, lowercase,
// strip punctuation/diacritics. Used to match sheet names against real users.
function normalizeName(s) {
  return String(s || '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase()
    .replace(/[.,_-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const SOURCE_PLATFORM = { facebook: 'meta', instagram: 'meta', google_ads: 'google', website: 'organic', call: 'direct', walk_in: 'direct', referral: 'direct', developer: 'direct', cold_call: 'direct', other: 'other' };

// System fields that users can map to
const SYSTEM_FIELDS = [
  { key: 'full_name', en: 'Full Name', ar: 'الاسم الكامل', required: true },
  { key: 'prefix', en: 'Prefix', ar: 'اللقب' },
  { key: 'phone', en: 'Phone', ar: 'رقم الموبايل', required: true },
  { key: 'phone2', en: 'Phone 2', ar: 'رقم ثاني' },
  { key: 'extra_phones', en: 'Extra Phones', ar: 'أرقام إضافية' },
  { key: 'email', en: 'Email', ar: 'البريد الإلكتروني' },
  { key: 'company', en: 'Company', ar: 'الشركة' },
  { key: 'job_title', en: 'Job Title', ar: 'المسمى الوظيفي' },
  { key: 'department', en: 'Department', ar: 'القسم' },
  { key: 'source', en: 'Source', ar: 'المصدر' },
  { key: 'contact_type', en: 'Contact Type', ar: 'نوع العميل' },
  { key: 'contact_status', en: 'Status', ar: 'الحالة' },
  { key: 'notes', en: 'Notes', ar: 'ملاحظات' },
  { key: 'gender', en: 'Gender', ar: 'الجنس' },
  { key: 'nationality', en: 'Nationality', ar: 'الجنسية' },
  { key: 'birth_date', en: 'Birth Date', ar: 'تاريخ الميلاد' },
  { key: 'preferred_location', en: 'Preferred Location', ar: 'الموقع المفضل' },
  { key: 'interested_in_type', en: 'Property Type', ar: 'نوع العقار' },
  { key: 'campaign_name', en: 'Campaign', ar: 'الحملة' },
  { key: 'temperature', en: 'Rating', ar: 'التصنيف' },
  { key: 'assigned_to_name', en: 'Assigned To', ar: 'مسؤول' },
  { key: 'created_at', en: 'Created At', ar: 'تاريخ الإنشاء' },
  { key: 'budget_min', en: 'Budget Min', ar: 'الميزانية (من)' },
  { key: 'budget_max', en: 'Budget Max', ar: 'الميزانية (إلى)' },
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
  'الحالة': 'contact_status', 'حالة': 'contact_status', 'status': 'contact_status',
  'ملاحظات': 'notes',
  'الجنس': 'gender', 'gender': 'gender', 'النوع الاجتماعي': 'gender',
  'الجنسية': 'nationality',
  'تاريخ الميلاد': 'birth_date', 'birth date': 'birth_date', 'birthday': 'birth_date', 'dob': 'birth_date',
  'الموقع': 'preferred_location', 'الموقع المفضل': 'preferred_location',
  'نوع العقار': 'interested_in_type', 'property type': 'interested_in_type', 'property': 'interested_in_type', 'interested in': 'interested_in_type',
  'اللقب': 'prefix', 'prefix': 'prefix', 'لقب': 'prefix', 'salutation': 'prefix',
  'أرقام إضافية': 'extra_phones', 'extra phones': 'extra_phones', 'extra_phones': 'extra_phones', 'other phones': 'extra_phones',
  'budget max': 'budget_max', 'budget_max': 'budget_max', 'الميزانية القصوى': 'budget_max', 'max budget': 'budget_max',
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

// Null-like values to treat as empty
const NULL_VALUES = ['n/a', 'na', 'null', 'undefined', '-', '\u2014', '\u2013', 'none', 'nil', '#n/a', '#ref!', '#value!'];

// ──────────────────────────────────────────────
// DATA CLEANING FUNCTIONS
// ──────────────────────────────────────────────

// Convert Arabic/Hindi digits to English
const arabicToEnglishDigits = (str) => {
  if (!str) return str;
  return String(str)
    .replace(/[\u0660-\u0669]/g, d => d.charCodeAt(0) - 0x0660)
    .replace(/[\u06F0-\u06F9]/g, d => d.charCodeAt(0) - 0x06F0);
};

// Enhanced phone normalization with full cleaning
const cleanPhone = (p) => {
  if (!p) return { cleaned: null, original: null, changed: false, invalid: false };
  const original = String(p).trim();
  if (!original) return { cleaned: null, original: null, changed: false, invalid: false };

  // Convert Arabic digits, strip all non-digit/plus characters
  let cleaned = arabicToEnglishDigits(original);
  cleaned = cleaned.replace(/[\s\-\(\)\.\,]/g, '');

  // Remove leading 00 → +
  if (cleaned.startsWith('00')) cleaned = '+' + cleaned.slice(2);

  // Egyptian normalization
  if (/^01[0-9]{9}$/.test(cleaned)) {
    // Local Egyptian: 01012345678 → +201012345678
    cleaned = '+2' + cleaned;
  } else if (/^201[0-9]{9}$/.test(cleaned)) {
    // Missing plus: 201012345678 → +201012345678
    cleaned = '+' + cleaned;
  }

  // Fix double zero after country code: +2001 → +201
  if (cleaned.startsWith('+200')) {
    cleaned = '+2' + cleaned.slice(4);
  }

  // Strip non-digit except leading +
  const digitsOnly = cleaned.replace(/[^0-9]/g, '');
  const invalid = digitsOnly.length < 10;

  return {
    cleaned,
    original,
    changed: cleaned !== original,
    invalid,
  };
};

// Clean name
const cleanName = (name) => {
  if (!name) return { cleaned: '', original: '', changed: false };
  const original = String(name).trim();
  if (!original) return { cleaned: '', original: '', changed: false };

  let cleaned = original;

  // Trim and collapse whitespace
  cleaned = cleaned.trim().replace(/\s+/g, ' ');

  // Remove special characters (keep Arabic, English, spaces)
  cleaned = cleaned.replace(/[^\u0600-\u06FF\u0750-\u077Fa-zA-Z\s]/g, '');

  // Trim again after removal
  cleaned = cleaned.trim().replace(/\s+/g, ' ');

  // Title case for English-only names
  if (/^[a-zA-Z\s]+$/.test(cleaned)) {
    cleaned = cleaned
      .toLowerCase()
      .replace(/\b\w/g, c => c.toUpperCase());
  }

  return {
    cleaned,
    original,
    changed: cleaned !== original,
  };
};

// Clean email
const cleanEmail = (email) => {
  if (!email) return { cleaned: '', original: '', changed: false, invalid: false };
  const original = String(email).trim();
  if (!original) return { cleaned: '', original: '', changed: false, invalid: false };

  let cleaned = original.trim().toLowerCase();
  const hasAt = cleaned.includes('@');
  const hasDotAfterAt = hasAt && cleaned.split('@')[1]?.includes('.');
  const invalid = !hasAt || !hasDotAfterAt;

  return {
    cleaned,
    original,
    changed: cleaned !== original,
    invalid,
  };
};

// Check if a string is a null-like value
const isNullLike = (val) => {
  if (val === null || val === undefined || val === '') return true;
  return NULL_VALUES.includes(String(val).trim().toLowerCase());
};

// Clean a generic string field
const cleanStringField = (val) => {
  if (val === null || val === undefined) return { cleaned: '', original: '', changed: false };
  const original = String(val);
  let cleaned = original.trim();
  if (NULL_VALUES.includes(cleaned.toLowerCase())) {
    cleaned = '';
  }
  return { cleaned, original, changed: cleaned !== original };
};

// Check if a row is entirely empty
const isRowEmpty = (row) => {
  return Object.values(row).every(v => {
    if (v === null || v === undefined || v === '') return true;
    return String(v).trim() === '' || NULL_VALUES.includes(String(v).trim().toLowerCase());
  });
};

// ──────────────────────────────────────────────

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

// Department / Source / Contact type options for auto-fill defaults
const DEPARTMENT_OPTIONS = [
  { value: 'sales', en: 'Sales', ar: 'المبيعات' },
  { value: 'marketing', en: 'Marketing', ar: 'التسويق' },
  { value: 'support', en: 'Support', ar: 'الدعم' },
  { value: 'operations', en: 'Operations', ar: 'العمليات' },
  { value: 'hr', en: 'HR', ar: 'الموارد البشرية' },
];

const SOURCE_OPTIONS = [
  { value: 'facebook', en: 'Facebook', ar: 'فيسبوك' },
  { value: 'instagram', en: 'Instagram', ar: 'انستجرام' },
  { value: 'google_ads', en: 'Google Ads', ar: 'اعلانات جوجل' },
  { value: 'website', en: 'Website', ar: 'الموقع' },
  { value: 'referral', en: 'Referral', ar: 'تحويل' },
  { value: 'call', en: 'Call', ar: 'اتصال' },
  { value: 'walk_in', en: 'Walk-in', ar: 'حضور' },
  { value: 'other', en: 'Other', ar: 'أخرى' },
];

const CONTACT_TYPE_OPTIONS = [
  { value: 'lead', en: 'Lead', ar: 'ليد' },
  { value: 'client', en: 'Client', ar: 'عميل' },
  { value: 'cold', en: 'Cold Call', ar: 'كولد كول' },
];

export default function ImportModal({ onClose, existingContacts, onImportDone }) {
  const { t, i18n } = useTranslation();
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const isRTL = i18n.language === 'ar';
  const [step, setStep] = useState(1);
  const [rawData, setRawData] = useState([]); // Raw rows from Excel
  const [excelColumns, setExcelColumns] = useState([]); // Detected column headers
  const [columnMapping, setColumnMapping] = useState({}); // excelCol -> systemField
  const [rows, setRows] = useState([]);
  const [dragging, setDragging] = useState(false);
  const [duplicateAction, setDuplicateAction] = useState('opportunity'); // 'skip' | 'opportunity' | 'overwrite'
  const [importProgress, setImportProgress] = useState({ current: 0, total: 0, active: false });

  // Cleaning summary state
  const [cleaningSummary, setCleaningSummary] = useState(null);
  // Track per-cell cleaning details: { rowIdx: { fieldKey: { original, cleaned, status } } }
  const [cellCleaningDetails, setCellCleaningDetails] = useState({});

  // Validation rules state
  const [validationRules, setValidationRules] = useState({
    rejectNoPhone: false,
    rejectNoName: false,
    rejectNoEmail: false,
    autoFillDepartment: false,
    autoFillSource: false,
    autoFillContactType: false,
    defaultDepartment: 'sales',
    defaultSource: 'other',
    defaultContactType: 'lead',
  });

  // Tooltip state for cleaned cells
  const [tooltip, setTooltip] = useState({ visible: false, x: 0, y: 0, text: '' });

  // Shows a spinner + message while the duplicate-detection DB query runs
  // (processMapping is async now — can take a few seconds for large sheets).
  const [previewLoading, setPreviewLoading] = useState(false);

  // ── Agent validation / mapping ─────────────────────────────────────────
  // Users in DB (fetched once). Used to validate the "Assigned To" column
  // of the sheet so imported contacts actually route to real agents.
  const [knownUsers, setKnownUsers] = useState([]);
  // User override map: { rawNameFromSheet: resolvedFullNameInDb | '' }
  // '' means "import as-is without mapping" (the fallback in parent will apply).
  const [agentOverrides, setAgentOverrides] = useState({});
  useEffect(() => {
    supabase.from('users').select('id, full_name_en, full_name_ar').then(({ data }) => {
      setKnownUsers((data || []).filter(u => u.full_name_en || u.full_name_ar));
    }).catch(() => {});
  }, []);

  const processFile = async (file) => {
    const arrayBuffer = await file.arrayBuffer();
    const ExcelJS = await import('exceljs');
    const workbook = new (ExcelJS.default || ExcelJS).Workbook();
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

  // ──────────────────────────────────────────────
  // ENHANCED: Process mapped data with cleaning
  //
  // Duplicate detection used to rely on the `existingContacts` prop from the
  // parent, but that prop holds only the current paginated page (~25 rows).
  // That gave inconsistent "already exists" warnings on re-opens depending
  // on which page the user was viewing. We now query Supabase directly for
  // every phone/email in the sheet so detection is always complete.
  // ──────────────────────────────────────────────
  const processMapping = async () => {
    const mapping = columnMapping;
    const summary = {
      phonesNormalized: 0,
      namesCleaned: 0,
      emailsFixed: 0,
      emptyRowsRemoved: 0,
      invalidPhones: 0,
      invalidEmails: 0,
      rowsRejectedNoPhone: 0,
      rowsRejectedNoName: 0,
      rowsRejectedNoEmail: 0,
    };
    const cellDetails = {};

    // Step 1: Map columns and apply cleaning
    const mappedAndCleaned = rawData.map((row, idx) => {
      const mapped = {};
      Object.entries(mapping).forEach(([excelCol, systemField]) => {
        if (systemField && systemField !== '_skip') {
          mapped[systemField] = row[excelCol];
        }
      });
      return { mapped, idx };
    });

    // Step 2: Remove completely empty rows
    const nonEmptyRows = mappedAndCleaned.filter(({ mapped, idx }) => {
      const empty = isRowEmpty(mapped);
      if (empty) summary.emptyRowsRemoved++;
      return !empty;
    });

    // Step 3: Clean each row
    const cleaned = nonEmptyRows.map(({ mapped, idx }) => {
      const details = {};
      const cleanedRow = { ...mapped };

      // Clean all string fields (trim, null-like removal)
      Object.keys(cleanedRow).forEach(key => {
        if (key === 'phone' || key === 'phone2' || key === 'email' || key === 'full_name') return; // handled separately
        const result = cleanStringField(cleanedRow[key]);
        if (result.changed) {
          details[key] = { original: result.original, cleaned: result.cleaned, status: 'corrected' };
        }
        cleanedRow[key] = result.cleaned;
      });

      // Clean phone
      const phoneResult = cleanPhone(mapped.phone);
      if (phoneResult.changed && phoneResult.cleaned) {
        summary.phonesNormalized++;
        details.phone = { original: phoneResult.original, cleaned: phoneResult.cleaned, status: phoneResult.invalid ? 'warning' : 'corrected' };
      }
      if (phoneResult.invalid && phoneResult.cleaned) {
        summary.invalidPhones++;
        if (!details.phone) {
          details.phone = { original: phoneResult.original, cleaned: phoneResult.cleaned, status: 'warning' };
        }
      }
      cleanedRow.phone = phoneResult.cleaned;

      // Clean phone2
      const phone2Result = cleanPhone(mapped.phone2);
      if (phone2Result.changed && phone2Result.cleaned) {
        summary.phonesNormalized++;
        details.phone2 = { original: phone2Result.original, cleaned: phone2Result.cleaned, status: phone2Result.invalid ? 'warning' : 'corrected' };
      }
      cleanedRow.phone2 = phone2Result.cleaned;

      // Clean name
      const nameResult = cleanName(mapped.full_name);
      if (nameResult.changed) {
        summary.namesCleaned++;
        details.full_name = { original: nameResult.original, cleaned: nameResult.cleaned, status: 'corrected' };
      }
      cleanedRow.full_name = nameResult.cleaned;

      // Clean email
      const emailResult = cleanEmail(mapped.email);
      if (emailResult.changed && emailResult.cleaned) {
        summary.emailsFixed++;
        details.email = { original: emailResult.original, cleaned: emailResult.cleaned, status: emailResult.invalid ? 'warning' : 'corrected' };
      }
      if (emailResult.invalid && emailResult.cleaned) {
        summary.invalidEmails++;
        if (!details.email) {
          details.email = { original: emailResult.original, cleaned: emailResult.cleaned, status: 'warning' };
        }
      }
      cleanedRow.email = emailResult.cleaned;

      // Auto-fill defaults
      if (validationRules.autoFillDepartment && !cleanedRow.department) {
        cleanedRow.department = validationRules.defaultDepartment;
        details.department = { original: '', cleaned: validationRules.defaultDepartment, status: 'corrected' };
      }
      if (validationRules.autoFillSource && !cleanedRow.source) {
        cleanedRow.source = validationRules.defaultSource;
        details.source = { original: '', cleaned: validationRules.defaultSource, status: 'corrected' };
      }
      if (validationRules.autoFillContactType && !cleanedRow.contact_type) {
        cleanedRow.contact_type = validationRules.defaultContactType;
        details.contact_type = { original: '', cleaned: validationRules.defaultContactType, status: 'corrected' };
      }

      cellDetails[idx] = details;

      return { cleanedRow, idx };
    });

    // Step 3.5: Query DB for ALL phones/emails in the sheet (not just the
    // current in-memory page). This is what makes duplicate detection
    // accurate and consistent between opens.
    const allPhones = new Set();
    const allEmails = new Set();
    cleaned.forEach(({ cleanedRow }) => {
      if (cleanedRow.phone) allPhones.add(cleanedRow.phone);
      if (cleanedRow.phone2) allPhones.add(cleanedRow.phone2);
      if (cleanedRow.email) allEmails.add(String(cleanedRow.email).toLowerCase());
    });
    const phonesArr = [...allPhones].filter(Boolean);
    const emailsArr = [...allEmails].filter(Boolean);
    // Batch to keep each request under PostgREST's URL length limit (~1000 items per IN is safe)
    const batchSize = 500;
    const dbMatches = [];
    for (let i = 0; i < phonesArr.length; i += batchSize) {
      const chunk = phonesArr.slice(i, i + batchSize);
      try {
        const { data } = await supabase.from('contacts')
          .select('id, full_name, phone, phone2, email, extra_phones')
          .or(`phone.in.(${chunk.map(p => `"${p.replace(/"/g, '\\"')}"`).join(',')}),phone2.in.(${chunk.map(p => `"${p.replace(/"/g, '\\"')}"`).join(',')})`)
          .or('is_deleted.is.null,is_deleted.eq.false');
        if (Array.isArray(data)) dbMatches.push(...data);
      } catch { /* fall through — partial matches still work */ }
    }
    for (let i = 0; i < emailsArr.length; i += batchSize) {
      const chunk = emailsArr.slice(i, i + batchSize);
      try {
        const { data } = await supabase.from('contacts')
          .select('id, full_name, phone, phone2, email, extra_phones')
          .in('email', chunk)
          .or('is_deleted.is.null,is_deleted.eq.false');
        if (Array.isArray(data)) dbMatches.push(...data);
      } catch { /* noop */ }
    }
    // Merge DB matches with the in-memory existingContacts (deduped by id) so
    // we catch anything loaded in the parent too (e.g. realtime inserts).
    const seen = new Set();
    const combined = [];
    const push = (c) => { if (c && c.id && !seen.has(c.id)) { seen.add(c.id); combined.push(c); } };
    dbMatches.forEach(push);
    (existingContacts || []).forEach(push);

    // Step 4: Process with validation and duplicate detection
    const processed = cleaned.map(({ cleanedRow, idx }) => {
      const phone = cleanedRow.phone;
      const phone2 = cleanedRow.phone2;
      const email = cleanedRow.email || '';
      const full_name = (cleanedRow.full_name || '').trim();

      // Validation rule rejections
      if (validationRules.rejectNoPhone && (!phone || cleanPhone(phone).invalid)) {
        summary.rowsRejectedNoPhone++;
        if (cellDetails[idx]) {
          cellDetails[idx].phone = { ...(cellDetails[idx].phone || {}), original: cellDetails[idx].phone?.original || phone || '', cleaned: phone || '', status: 'rejected' };
        }
        return { ...cleanedRow, _row: idx + 2, _status: 'error', _reason: isRTL ? 'رقم غير صحيح أو مفقود (مطلوب)' : 'Invalid or missing phone (required by rule)' };
      }
      if (validationRules.rejectNoName && !full_name) {
        summary.rowsRejectedNoName++;
        if (cellDetails[idx]) {
          cellDetails[idx].full_name = { ...(cellDetails[idx].full_name || {}), status: 'rejected' };
        }
        return { ...cleanedRow, _row: idx + 2, _status: 'error', _reason: isRTL ? 'الاسم مفقود (مطلوب)' : 'Missing name (required by rule)' };
      }
      if (validationRules.rejectNoEmail && (!email || cleanEmail(email).invalid)) {
        summary.rowsRejectedNoEmail++;
        if (cellDetails[idx]) {
          cellDetails[idx].email = { ...(cellDetails[idx].email || {}), original: cellDetails[idx].email?.original || email || '', cleaned: email || '', status: 'rejected' };
        }
        return { ...cleanedRow, _row: idx + 2, _status: 'error', _reason: isRTL ? 'ايميل غير صحيح أو مفقود (مطلوب)' : 'Invalid or missing email (required by rule)' };
      }

      // Standard validation
      if (!phone || cleanPhone(phone).invalid) {
        return { ...cleanedRow, _row: idx + 2, _status: 'error', _reason: isRTL ? 'رقم غير صحيح أو مفقود' : 'Invalid or missing phone' };
      }
      if (!full_name) {
        return { ...cleanedRow, _row: idx + 2, _status: 'error', _reason: isRTL ? 'الاسم مفقود' : 'Missing name' };
      }

      // Enhanced duplicate detection: phone, email, fuzzy name
      // Matching now runs against `combined` (DB query result ∪ in-memory
      // existingContacts), not just the in-memory page.
      let duplicateMatch = null;
      let duplicateReason = '';

      // Check phone match
      const phoneMatch = combined.find(c => c.phone === phone || c.phone2 === phone || (phone2 && (c.phone === phone2 || c.phone2 === phone2)));
      if (phoneMatch) {
        duplicateMatch = phoneMatch;
        duplicateReason = isRTL ? `رقم مطابق: ${phoneMatch.full_name}` : `Phone match: ${phoneMatch.full_name}`;
      }

      // Check email match
      if (!duplicateMatch && email && validateEmail(email)) {
        const emailMatch = combined.find(c => c.email && c.email.toLowerCase() === email.toLowerCase());
        if (emailMatch) {
          duplicateMatch = emailMatch;
          duplicateReason = isRTL ? `ايميل مطابق: ${emailMatch.full_name}` : `Email match: ${emailMatch.full_name}`;
        }
      }

      // Fuzzy name match (normalized Arabic) — only against in-memory set since
      // DB query was phone/email-based and name fuzziness can't be expressed in SQL
      if (!duplicateMatch && full_name) {
        const normalizedNew = normalizeArabicName(full_name);
        if (normalizedNew.length > 2) {
          const nameMatch = (existingContacts || []).find(c => {
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
          ...cleanedRow, phone, phone2, email, full_name,
          _row: idx + 2,
          _status: duplicateAction === 'skip' ? 'skipped' : duplicateAction === 'overwrite' ? 'overwrite' : 'opportunity',
          _existingId: duplicateMatch.id,
          _existingName: duplicateMatch.full_name,
          _duplicateReason: duplicateReason,
          _origIdx: idx,
        };
      }

      // Handle extra_phones (comma/semicolon separated string → array)
      let extra_phones = null;
      if (cleanedRow.extra_phones) {
        const phones = String(cleanedRow.extra_phones).split(/[,;،]+/).map(p => p.trim()).filter(Boolean);
        if (phones.length) extra_phones = phones;
      }
      // Handle gender mapping
      const GENDER_MAP = { male: 'male', female: 'female', ذكر: 'male', أنثى: 'female', م: 'male', 'M': 'male', 'F': 'female' };
      // Handle interested_in_type mapping
      const PROPERTY_MAP = { residential: 'residential', commercial: 'commercial', administrative: 'administrative', سكني: 'residential', تجاري: 'commercial', إداري: 'administrative' };
      // Handle contact_status mapping
      const STATUS_MAP = { new: 'new', following: 'following', contacted: 'contacted', has_opportunity: 'has_opportunity', disqualified: 'disqualified', جديد: 'new', متابعة: 'following', 'تم التواصل': 'contacted', active: 'following', inactive: 'contacted', نشط: 'following', 'غير نشط': 'contacted' };

      return {
        ...cleanedRow,
        phone,
        phone2,
        email,
        full_name,
        contact_type: TYPE_MAP[cleanedRow.contact_type] || cleanedRow.contact_type || 'lead',
        contact_status: STATUS_MAP[cleanedRow.contact_status] || cleanedRow.contact_status || 'new',
        temperature: RATING_MAP[cleanedRow.temperature] || cleanedRow.temperature || 'warm',
        department: cleanedRow.department || 'sales',
        platform: SOURCE_PLATFORM[cleanedRow.source] || 'other',
        gender: GENDER_MAP[cleanedRow.gender] || cleanedRow.gender || null,
        interested_in_type: PROPERTY_MAP[cleanedRow.interested_in_type] || cleanedRow.interested_in_type || null,
        prefix: cleanedRow.prefix || null,
        birth_date: cleanedRow.birth_date || null,
        budget_min: cleanedRow.budget_min ? Number(cleanedRow.budget_min) || null : null,
        budget_max: cleanedRow.budget_max ? Number(cleanedRow.budget_max) || null : null,
        extra_phones,
        _row: idx + 2,
        _status: 'new',
        _origIdx: idx,
      };
    });

    setCleaningSummary(summary);
    setCellCleaningDetails(cellDetails);
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

  // ── Agent matching ──────────────────────────────────────────────────
  // Build a normalized lookup of known users once knownUsers is loaded.
  const userLookup = useMemo(() => {
    const byNormEn = new Map();
    const byNormAr = new Map();
    const allNormNames = [];
    knownUsers.forEach(u => {
      if (u.full_name_en) { byNormEn.set(normalizeName(u.full_name_en), u.full_name_en); allNormNames.push({ norm: normalizeName(u.full_name_en), full: u.full_name_en }); }
      if (u.full_name_ar) { byNormAr.set(normalizeName(u.full_name_ar), u.full_name_en || u.full_name_ar); allNormNames.push({ norm: normalizeName(u.full_name_ar), full: u.full_name_en || u.full_name_ar }); }
    });
    return { byNormEn, byNormAr, allNormNames };
  }, [knownUsers]);

  // For each unique assigned_to_name in the importable rows, figure out its
  // match status: 'exact' | 'normalized' | 'partial' | 'none'.
  const agentMatchTable = useMemo(() => {
    const importable = [...newRows, ...overwriteRows];
    const names = [...new Set(importable.map(r => r.assigned_to_name).filter(Boolean).map(n => String(n).trim()))];
    return names.map(raw => {
      if (!raw) return null;
      const norm = normalizeName(raw);
      // 1. Exact match against full_name_en
      const exactEn = knownUsers.find(u => u.full_name_en === raw);
      if (exactEn) return { raw, status: 'exact', matchedTo: exactEn.full_name_en, count: importable.filter(r => r.assigned_to_name === raw).length };
      // 2. Normalized match (case/whitespace variant)
      if (userLookup.byNormEn.has(norm)) {
        const matched = userLookup.byNormEn.get(norm);
        return { raw, status: 'normalized', matchedTo: matched, count: importable.filter(r => r.assigned_to_name === raw).length };
      }
      if (userLookup.byNormAr.has(norm)) {
        const matched = userLookup.byNormAr.get(norm);
        return { raw, status: 'normalized', matchedTo: matched, count: importable.filter(r => r.assigned_to_name === raw).length };
      }
      // 3. Partial match — raw is a prefix/contains a user's name (or vice versa)
      const partial = userLookup.allNormNames.find(u => u.norm.includes(norm) || norm.includes(u.norm));
      if (partial) return { raw, status: 'partial', matchedTo: partial.full, count: importable.filter(r => r.assigned_to_name === raw).length };
      // 4. No match
      return { raw, status: 'none', matchedTo: null, count: importable.filter(r => r.assigned_to_name === raw).length };
    }).filter(Boolean);
  }, [newRows, overwriteRows, knownUsers, userLookup]);

  const unmatchedCount = agentMatchTable.filter(a => a.status === 'none' && !agentOverrides[a.raw]).length;
  const partialCount   = agentMatchTable.filter(a => a.status === 'partial' && !agentOverrides[a.raw]).length;

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
    const ExcelJS = await import('exceljs');
    const workbook = new (ExcelJS.default || ExcelJS).Workbook();
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

    // Build a resolver: raw sheet name → canonical DB name (auto-match or user override)
    const resolveAgent = (raw) => {
      if (!raw) return raw;
      const trimmed = String(raw).trim();
      // User-specified override wins (including '' which means "leave as-is")
      if (Object.prototype.hasOwnProperty.call(agentOverrides, trimmed)) {
        const ov = agentOverrides[trimmed];
        return ov || trimmed; // empty override = import literal (parent may fallback)
      }
      const match = agentMatchTable.find(a => a.raw === trimmed);
      if (match && (match.status === 'exact' || match.status === 'normalized')) {
        return match.matchedTo; // auto-fix case/whitespace variants
      }
      return trimmed; // partial/none without override → keep as-is
    };

    const toAdd = [];
    for (let i = 0; i < importable.length; i++) {
      const r = importable[i];
      toAdd.push({
        ...r,
        assigned_to_name: resolveAgent(r.assigned_to_name),
        id: r._status === 'overwrite' ? r._existingId : undefined, // Let Supabase generate UUID
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
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${items.length}, 1fr)`, gap: 10, marginBottom: 20 }}>
      {items.map(s => (
        <div key={s.label} style={{
          borderRadius: 12,
          padding: 12,
          textAlign: 'center',
          background: s.bg,
          border: `1px solid ${s.border}`,
        }}>
          <div style={{ fontSize: 24, fontWeight: 700, color: s.color }}>{s.num}</div>
          <div style={{ fontSize: 11, color: isDark ? '#94a3b8' : '#64748b', marginTop: 4 }}>{s.icon ? `${s.icon} ` : ''}{s.label}</div>
        </div>
      ))}
    </div>
  );

  // Cleaning Summary Card component
  const CleaningSummaryCard = () => {
    if (!cleaningSummary) return null;
    const items = [];
    if (cleaningSummary.phonesNormalized > 0) items.push({ count: cleaningSummary.phonesNormalized, label: isRTL ? 'أرقام تم تنظيفها' : 'Phones normalized', color: '#10B981', type: 'fixed' });
    if (cleaningSummary.namesCleaned > 0) items.push({ count: cleaningSummary.namesCleaned, label: isRTL ? 'أسماء تم تنظيفها' : 'Names cleaned', color: '#10B981', type: 'fixed' });
    if (cleaningSummary.emailsFixed > 0) items.push({ count: cleaningSummary.emailsFixed, label: isRTL ? 'ايميلات تم إصلاحها' : 'Emails fixed', color: '#10B981', type: 'fixed' });
    if (cleaningSummary.emptyRowsRemoved > 0) items.push({ count: cleaningSummary.emptyRowsRemoved, label: isRTL ? 'صفوف فارغة محذوفة' : 'Empty rows removed', color: '#10B981', type: 'fixed' });
    if (cleaningSummary.invalidPhones > 0) items.push({ count: cleaningSummary.invalidPhones, label: isRTL ? 'أرقام غير صحيحة' : 'Invalid phones', color: '#F59E0B', type: 'warning' });
    if (cleaningSummary.invalidEmails > 0) items.push({ count: cleaningSummary.invalidEmails, label: isRTL ? 'ايميلات غير صحيحة' : 'Invalid emails', color: '#F59E0B', type: 'warning' });

    if (items.length === 0) return null;

    return (
      <div style={{
        background: isDark ? '#132337' : '#f8fafc',
        border: `1px solid ${isDark ? 'rgba(74,122,171,0.2)' : '#e2e8f0'}`,
        borderRadius: 12,
        padding: 16,
        marginBottom: 16,
      }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: isDark ? '#e2e8f0' : '#1e293b', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
          {'\u{1F9F9}'} {isRTL ? 'ملخص التنظيف' : 'Cleaning Summary'}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 8 }}>
          {items.map((item, i) => (
            <div key={i} style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 12px',
              borderRadius: 8,
              background: isDark ? 'rgba(0,0,0,0.2)' : '#fff',
              border: `1px solid ${isDark ? 'rgba(255,255,255,0.05)' : '#f1f5f9'}`,
            }}>
              <div style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: item.color,
                flexShrink: 0,
              }} />
              <span style={{ fontSize: 13, fontWeight: 700, color: item.color, minWidth: 20 }}>{item.count}</span>
              <span style={{ fontSize: 12, color: isDark ? '#94a3b8' : '#64748b' }}>{item.label}</span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  // Toggle switch component
  const ToggleSwitch = ({ checked, onChange, label, description }) => (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '8px 0',
    }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 12, color: isDark ? '#e2e8f0' : '#1e293b', fontWeight: 500 }}>{label}</div>
        {description && <div style={{ fontSize: 11, color: isDark ? '#94a3b8' : '#64748b', marginTop: 2 }}>{description}</div>}
      </div>
      <div
        onClick={onChange}
        style={{
          width: 36,
          height: 20,
          borderRadius: 10,
          background: checked ? '#4A7AAB' : (isDark ? '#334155' : '#cbd5e1'),
          cursor: 'pointer',
          position: 'relative',
          transition: 'background 0.2s',
          flexShrink: 0,
          marginLeft: isRTL ? 0 : 12,
          marginRight: isRTL ? 12 : 0,
        }}
      >
        <div style={{
          width: 16,
          height: 16,
          borderRadius: '50%',
          background: '#fff',
          position: 'absolute',
          top: 2,
          left: checked ? 18 : 2,
          transition: 'left 0.2s',
          boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
        }} />
      </div>
    </div>
  );

  // Get cell background color based on cleaning status
  const getCellStyle = (rowOrigIdx, fieldKey) => {
    const detail = cellCleaningDetails[rowOrigIdx]?.[fieldKey];
    if (!detail) return {};
    if (detail.status === 'corrected') {
      return { background: isDark ? 'rgba(16,185,129,0.12)' : 'rgba(16,185,129,0.1)' };
    }
    if (detail.status === 'warning') {
      return { background: isDark ? 'rgba(245,158,11,0.12)' : 'rgba(245,158,11,0.1)' };
    }
    if (detail.status === 'rejected') {
      return { background: isDark ? 'rgba(239,68,68,0.12)' : 'rgba(239,68,68,0.1)' };
    }
    return {};
  };

  // Get cleaning detail tooltip text
  const getCellTooltip = (rowOrigIdx, fieldKey) => {
    const detail = cellCleaningDetails[rowOrigIdx]?.[fieldKey];
    if (!detail || !detail.original) return null;
    if (detail.original === detail.cleaned) return null;
    return `${detail.original} \u2192 ${detail.cleaned}`;
  };

  // Render a cell with cleaning indicator
  const CleanedCell = ({ row, fieldKey, children }) => {
    const origIdx = row._origIdx;
    const cellStyle = getCellStyle(origIdx, fieldKey);
    const tooltipText = getCellTooltip(origIdx, fieldKey);
    const detail = cellCleaningDetails[origIdx]?.[fieldKey];
    const hasChange = detail && detail.original !== detail.cleaned;

    return (
      <td
        style={{
          color: isDark ? '#e2e8f0' : '#1e293b',
          padding: '8px 10px',
          borderBottom: `1px solid ${isDark ? 'rgba(74,122,171,0.06)' : '#f3f4f6'}`,
          fontSize: 12,
          position: 'relative',
          ...cellStyle,
        }}
        onMouseEnter={(e) => {
          if (tooltipText) {
            const rect = e.currentTarget.getBoundingClientRect();
            setTooltip({ visible: true, x: rect.left + rect.width / 2, y: rect.top - 4, text: tooltipText });
          }
        }}
        onMouseLeave={() => setTooltip({ ...tooltip, visible: false })}
      >
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          {children}
          {hasChange && (
            <span style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: detail.status === 'corrected' ? '#10B981' : detail.status === 'warning' ? '#F59E0B' : '#EF4444',
              display: 'inline-block',
              flexShrink: 0,
            }} />
          )}
        </span>
      </td>
    );
  };

  const stepLabels = [
    isRTL ? 'رفع الملف' : 'Upload',
    isRTL ? 'ربط الأعمدة' : 'Map Columns',
    isRTL ? 'مراجعة' : 'Preview',
    isRTL ? 'النتيجة' : 'Result',
  ];

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0,0,0,0.5)',
      zIndex: 200,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    }} dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Tooltip overlay */}
      {tooltip.visible && (
        <div style={{
          position: 'fixed',
          left: tooltip.x,
          top: tooltip.y,
          transform: 'translate(-50%, -100%)',
          background: isDark ? '#1e293b' : '#1e293b',
          color: '#fff',
          padding: '6px 10px',
          borderRadius: 6,
          fontSize: 11,
          whiteSpace: 'nowrap',
          zIndex: 9999,
          pointerEvents: 'none',
          boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
          direction: 'ltr',
          fontFamily: 'monospace',
        }}>
          {tooltip.text}
        </div>
      )}
      <div style={{
        background: isDark ? '#1a2332' : '#ffffff',
        border: `1px solid ${isDark ? 'rgba(74,122,171,0.3)' : '#d1d5db'}`,
        borderRadius: 16,
        width: step === 2 ? 800 : 720,
        maxHeight: '90vh',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        transition: 'width 0.3s',
      }}>

        {/* Header */}
        <div style={{
          padding: '20px 24px 16px',
          borderBottom: `1px solid ${isDark ? 'rgba(74,122,171,0.15)' : '#e5e7eb'}`,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <h2 style={{ color: isDark ? '#e2e8f0' : '#1e293b', fontSize: 16, fontWeight: 700, margin: 0 }}>
            {'\u{1F4E4}'} {isRTL ? 'استيراد جهات الاتصال' : 'Import Contacts'}
          </h2>
          <button onClick={onClose} style={{
            background: 'transparent',
            border: 'none',
            color: '#4A7AAB',
            fontSize: 20,
            cursor: 'pointer',
            padding: 4,
          }}>&times;</button>
        </div>

        {/* Steps */}
        <div style={{
          display: 'flex',
          borderBottom: `1px solid ${isDark ? 'rgba(74,122,171,0.15)' : '#e5e7eb'}`,
        }}>
          {stepLabels.map((s, i) => (
            <div key={i} style={{
              flex: 1,
              padding: 10,
              textAlign: 'center',
              fontSize: 12,
              borderBottom: `2px solid ${step === i + 1 ? '#4A7AAB' : step > i + 1 ? '#10B981' : 'transparent'}`,
              color: step === i + 1 ? '#4A7AAB' : step > i + 1 ? '#10B981' : (isDark ? '#94a3b8' : '#64748b'),
            }}>
              {step > i + 1 ? '\u2713 ' : `${i + 1}. `}{s}
            </div>
          ))}
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflow: 'auto', padding: 24 }}>

          {/* Step 1 - Upload */}
          {step === 1 && (
            <div>
              <div
                onDrop={handleDrop}
                onDragOver={over}
                onDragLeave={leave}
                onClick={() => document.getElementById('fileInput').click()}
                style={{
                  border: `2px dashed ${dragging ? '#4A7AAB' : (isDark ? 'rgba(74,122,171,0.3)' : '#d1d5db')}`,
                  borderRadius: 12,
                  padding: 40,
                  textAlign: 'center',
                  cursor: 'pointer',
                  background: dragging ? (isDark ? 'rgba(74,122,171,0.05)' : 'rgba(74,122,171,0.03)') : 'transparent',
                  transition: 'all 0.2s',
                }}
              >
                <div style={{ fontSize: 40, marginBottom: 12 }}>{'\u{1F4C2}'}</div>
                <div style={{ color: isDark ? '#94a3b8' : '#64748b', fontSize: 14, marginBottom: 8 }}>
                  {isRTL ? 'اسحب الملف هنا أو اضغط للاختيار' : 'Drag file here or click to browse'}
                </div>
                <div style={{ color: isDark ? '#475569' : '#9ca3af', fontSize: 12 }}>
                  Excel (.xlsx) {isRTL ? 'أو' : 'or'} CSV
                </div>
                <input id="fileInput" type="file" accept=".xlsx,.csv" style={{ display: 'none' }} onChange={handleFile} />
              </div>
              <div style={{ textAlign: 'center', marginTop: 16 }}>
                <Button variant="secondary" size="sm" onClick={async () => {
                  const headers = SYSTEM_FIELDS.map(f => f.key);
                  const ExcelJS = await import('exceljs');
                  const workbook = new (ExcelJS.default || ExcelJS).Workbook();
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

          {/* Step 2 - Column Mapping + Validation Rules */}
          {step === 2 && (
            <div>
              <div style={{ marginBottom: 16 }}>
                <div style={{ color: isDark ? '#e2e8f0' : '#1e293b', fontSize: 14, fontWeight: 600, marginBottom: 4 }}>
                  {isRTL ? `تم اكتشاف ${excelColumns.length} عمود و ${rawData.length} صف` : `Detected ${excelColumns.length} columns and ${rawData.length} rows`}
                </div>
                <div style={{ color: isDark ? '#94a3b8' : '#64748b', fontSize: 12 }}>
                  {isRTL ? 'اربط كل عمود من الملف بالحقل المناسب في النظام' : 'Map each file column to the corresponding system field'}
                </div>
              </div>

              {/* Required fields warning */}
              {!requiredMapped && (
                <div style={{
                  marginBottom: 16,
                  padding: '8px 12px',
                  borderRadius: 8,
                  fontSize: 12,
                  background: 'rgba(239,68,68,0.1)',
                  border: '1px solid rgba(239,68,68,0.2)',
                  color: '#EF4444',
                }}>
                  {isRTL ? 'الحقول المطلوبة: الاسم الكامل، رقم الموبايل' : 'Required fields: Full Name, Phone'}
                </div>
              )}

              <div style={{ maxHeight: 260, overflowY: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th style={{ color: isDark ? '#94a3b8' : '#64748b', padding: '8px 10px', textAlign: isRTL ? 'right' : 'left', borderBottom: `1px solid ${isDark ? 'rgba(74,122,171,0.15)' : '#e5e7eb'}`, fontSize: 12, fontWeight: 600, width: '35%' }}>
                        {isRTL ? 'عمود الملف' : 'File Column'}
                      </th>
                      <th style={{ color: isDark ? '#94a3b8' : '#64748b', padding: '8px 10px', textAlign: 'center', borderBottom: `1px solid ${isDark ? 'rgba(74,122,171,0.15)' : '#e5e7eb'}`, fontSize: 12, fontWeight: 600, width: '10%' }}>
                        {'\u2192'}
                      </th>
                      <th style={{ color: isDark ? '#94a3b8' : '#64748b', padding: '8px 10px', textAlign: isRTL ? 'right' : 'left', borderBottom: `1px solid ${isDark ? 'rgba(74,122,171,0.15)' : '#e5e7eb'}`, fontSize: 12, fontWeight: 600, width: '40%' }}>
                        {isRTL ? 'حقل النظام' : 'System Field'}
                      </th>
                      <th style={{ color: isDark ? '#94a3b8' : '#64748b', padding: '8px 10px', textAlign: isRTL ? 'right' : 'left', borderBottom: `1px solid ${isDark ? 'rgba(74,122,171,0.15)' : '#e5e7eb'}`, fontSize: 12, fontWeight: 600, width: '15%' }}>
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
                        <tr key={col} style={{ opacity: currentMapping !== '_skip' ? 1 : 0.5 }}>
                          <td style={{ padding: '8px 10px', borderBottom: `1px solid ${isDark ? 'rgba(74,122,171,0.06)' : '#f3f4f6'}`, fontSize: 12, color: isDark ? '#e2e8f0' : '#1e293b', fontFamily: 'monospace' }}>
                            {col}
                          </td>
                          <td style={{ padding: '8px 10px', borderBottom: `1px solid ${isDark ? 'rgba(74,122,171,0.06)' : '#f3f4f6'}`, textAlign: 'center', fontSize: 12, color: isDark ? '#94a3b8' : '#64748b' }}>
                            {currentMapping !== '_skip' ? (
                              <span style={{ color: '#10B981' }}>{'\u2192'}</span>
                            ) : (
                              <span style={{ color: isDark ? '#475569' : '#9ca3af' }}>{'\u00D7'}</span>
                            )}
                          </td>
                          <td style={{ padding: '8px 10px', borderBottom: `1px solid ${isDark ? 'rgba(74,122,171,0.06)' : '#f3f4f6'}` }}>
                            <select
                              value={currentMapping}
                              onChange={(e) => {
                                setColumnMapping(prev => ({ ...prev, [col]: e.target.value }));
                              }}
                              style={{
                                width: '100%',
                                fontSize: 12,
                                borderRadius: 8,
                                padding: '6px 8px',
                                border: `1px solid ${isAutoDetected ? 'rgba(16,185,129,0.5)' : (isDark ? 'rgba(74,122,171,0.3)' : '#d1d5db')}`,
                                background: isDark ? '#1a2332' : '#fff',
                                color: isDark ? '#e2e8f0' : '#1e293b',
                                outline: 'none',
                              }}
                            >
                              <option value="_skip">{isRTL ? '-- تخطي --' : '-- Skip --'}</option>
                              {SYSTEM_FIELDS.map(f => (
                                <option key={f.key} value={f.key} disabled={usedFields.has(f.key)}>
                                  {isRTL ? f.ar : f.en}{f.required ? ' *' : ''}{usedFields.has(f.key) ? (isRTL ? ' (مستخدم)' : ' (used)') : ''}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td style={{
                            padding: '8px 10px',
                            borderBottom: `1px solid ${isDark ? 'rgba(74,122,171,0.06)' : '#f3f4f6'}`,
                            fontSize: 12,
                            color: isDark ? '#94a3b8' : '#64748b',
                            maxWidth: 100,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }} title={String(sampleValue)}>
                            {String(sampleValue).slice(0, 20) || '\u2014'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Duplicate handling */}
              <div style={{ marginTop: 16, paddingTop: 16, borderTop: `1px solid ${isDark ? 'rgba(74,122,171,0.15)' : '#e5e7eb'}` }}>
                <div style={{ color: isDark ? '#e2e8f0' : '#1e293b', fontSize: 12, fontWeight: 600, marginBottom: 8 }}>
                  {isRTL ? 'التعامل مع التكرار (رقم، ايميل، اسم مطابق):' : 'Duplicate handling (phone, email, name match):'}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  {[
                    { value: 'opportunity', label: isRTL ? 'فرصة جديدة' : 'New Opportunity', icon: '\u{1F504}' },
                    { value: 'skip', label: isRTL ? 'تخطي' : 'Skip', icon: '\u23ED' },
                    { value: 'overwrite', label: isRTL ? 'استبدال' : 'Overwrite', icon: '\u270F\uFE0F' },
                  ].map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => setDuplicateAction(opt.value)}
                      style={{
                        flex: 1,
                        padding: '8px 12px',
                        borderRadius: 8,
                        fontSize: 12,
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        border: `1px solid ${duplicateAction === opt.value ? '#4A7AAB' : (isDark ? 'rgba(74,122,171,0.3)' : '#d1d5db')}`,
                        background: duplicateAction === opt.value ? 'rgba(74,122,171,0.1)' : 'transparent',
                        color: duplicateAction === opt.value ? '#4A7AAB' : (isDark ? '#94a3b8' : '#64748b'),
                      }}
                    >
                      {opt.icon} {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* ── Validation Rules Section ── */}
              <div style={{ marginTop: 16, paddingTop: 16, borderTop: `1px solid ${isDark ? 'rgba(74,122,171,0.15)' : '#e5e7eb'}` }}>
                <div style={{ color: isDark ? '#e2e8f0' : '#1e293b', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
                  {'\u2699\uFE0F'} {isRTL ? 'قواعد التنظيف والتحقق' : 'Cleaning & Validation Rules'}
                </div>
                <div style={{ color: isDark ? '#94a3b8' : '#64748b', fontSize: 11, marginBottom: 12 }}>
                  {isRTL ? 'القواعد الأساسية (تعمل تلقائيا): تنظيف الأرقام، ايميل lowercase، إزالة المسافات، حذف الصفوف الفارغة' : 'Default rules (always on): Phone normalization, Email lowercase, Trim whitespace, Remove empty rows'}
                </div>

                {/* Default rules display */}
                <div style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: 6,
                  marginBottom: 14,
                }}>
                  {[
                    isRTL ? 'تنظيف الأرقام' : 'Phone normalization',
                    isRTL ? 'ايميل lowercase' : 'Email lowercase',
                    isRTL ? 'إزالة المسافات' : 'Trim whitespace',
                    isRTL ? 'حذف الصفوف الفارغة' : 'Remove empty rows',
                  ].map(rule => (
                    <span key={rule} style={{
                      padding: '4px 10px',
                      borderRadius: 6,
                      fontSize: 11,
                      background: isDark ? 'rgba(16,185,129,0.1)' : 'rgba(16,185,129,0.08)',
                      color: '#10B981',
                      border: '1px solid rgba(16,185,129,0.2)',
                    }}>
                      {'\u2713'} {rule}
                    </span>
                  ))}
                </div>

                {/* Optional rules */}
                <div style={{
                  background: isDark ? '#0a1929' : '#f8fafc',
                  borderRadius: 10,
                  padding: '4px 14px',
                  border: `1px solid ${isDark ? 'rgba(74,122,171,0.15)' : '#e2e8f0'}`,
                }}>
                  <ToggleSwitch
                    checked={validationRules.rejectNoPhone}
                    onChange={() => setValidationRules(p => ({ ...p, rejectNoPhone: !p.rejectNoPhone }))}
                    label={isRTL ? 'رفض الصفوف بدون رقم صحيح' : 'Reject rows without valid phone'}
                  />
                  <ToggleSwitch
                    checked={validationRules.rejectNoName}
                    onChange={() => setValidationRules(p => ({ ...p, rejectNoName: !p.rejectNoName }))}
                    label={isRTL ? 'رفض الصفوف بدون اسم' : 'Reject rows without name'}
                  />
                  <ToggleSwitch
                    checked={validationRules.rejectNoEmail}
                    onChange={() => setValidationRules(p => ({ ...p, rejectNoEmail: !p.rejectNoEmail }))}
                    label={isRTL ? 'رفض الصفوف بدون ايميل صحيح' : 'Reject rows without valid email'}
                  />

                  {/* Auto-fill department */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 0',
                  }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 12, color: isDark ? '#e2e8f0' : '#1e293b', fontWeight: 500 }}>
                        {isRTL ? 'ملء القسم تلقائيا' : 'Auto-fill empty department'}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {validationRules.autoFillDepartment && (
                        <select
                          value={validationRules.defaultDepartment}
                          onChange={(e) => setValidationRules(p => ({ ...p, defaultDepartment: e.target.value }))}
                          style={{
                            fontSize: 11,
                            padding: '4px 8px',
                            borderRadius: 6,
                            border: `1px solid ${isDark ? 'rgba(74,122,171,0.3)' : '#d1d5db'}`,
                            background: isDark ? '#1a2332' : '#fff',
                            color: isDark ? '#e2e8f0' : '#1e293b',
                            outline: 'none',
                          }}
                        >
                          {DEPARTMENT_OPTIONS.map(o => (
                            <option key={o.value} value={o.value}>{isRTL ? o.ar : o.en}</option>
                          ))}
                        </select>
                      )}
                      <div
                        onClick={() => setValidationRules(p => ({ ...p, autoFillDepartment: !p.autoFillDepartment }))}
                        style={{
                          width: 36,
                          height: 20,
                          borderRadius: 10,
                          background: validationRules.autoFillDepartment ? '#4A7AAB' : (isDark ? '#334155' : '#cbd5e1'),
                          cursor: 'pointer',
                          position: 'relative',
                          transition: 'background 0.2s',
                          flexShrink: 0,
                        }}
                      >
                        <div style={{
                          width: 16, height: 16, borderRadius: '50%', background: '#fff',
                          position: 'absolute', top: 2, left: validationRules.autoFillDepartment ? 18 : 2,
                          transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                        }} />
                      </div>
                    </div>
                  </div>

                  {/* Auto-fill source */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 0',
                  }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 12, color: isDark ? '#e2e8f0' : '#1e293b', fontWeight: 500 }}>
                        {isRTL ? 'ملء المصدر تلقائيا' : 'Auto-fill empty source'}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {validationRules.autoFillSource && (
                        <select
                          value={validationRules.defaultSource}
                          onChange={(e) => setValidationRules(p => ({ ...p, defaultSource: e.target.value }))}
                          style={{
                            fontSize: 11,
                            padding: '4px 8px',
                            borderRadius: 6,
                            border: `1px solid ${isDark ? 'rgba(74,122,171,0.3)' : '#d1d5db'}`,
                            background: isDark ? '#1a2332' : '#fff',
                            color: isDark ? '#e2e8f0' : '#1e293b',
                            outline: 'none',
                          }}
                        >
                          {SOURCE_OPTIONS.map(o => (
                            <option key={o.value} value={o.value}>{isRTL ? o.ar : o.en}</option>
                          ))}
                        </select>
                      )}
                      <div
                        onClick={() => setValidationRules(p => ({ ...p, autoFillSource: !p.autoFillSource }))}
                        style={{
                          width: 36,
                          height: 20,
                          borderRadius: 10,
                          background: validationRules.autoFillSource ? '#4A7AAB' : (isDark ? '#334155' : '#cbd5e1'),
                          cursor: 'pointer',
                          position: 'relative',
                          transition: 'background 0.2s',
                          flexShrink: 0,
                        }}
                      >
                        <div style={{
                          width: 16, height: 16, borderRadius: '50%', background: '#fff',
                          position: 'absolute', top: 2, left: validationRules.autoFillSource ? 18 : 2,
                          transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                        }} />
                      </div>
                    </div>
                  </div>

                  {/* Auto-fill contact type */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 0',
                  }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 12, color: isDark ? '#e2e8f0' : '#1e293b', fontWeight: 500 }}>
                        {isRTL ? 'ملء نوع العميل تلقائيا' : 'Auto-fill empty contact type'}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {validationRules.autoFillContactType && (
                        <select
                          value={validationRules.defaultContactType}
                          onChange={(e) => setValidationRules(p => ({ ...p, defaultContactType: e.target.value }))}
                          style={{
                            fontSize: 11,
                            padding: '4px 8px',
                            borderRadius: 6,
                            border: `1px solid ${isDark ? 'rgba(74,122,171,0.3)' : '#d1d5db'}`,
                            background: isDark ? '#1a2332' : '#fff',
                            color: isDark ? '#e2e8f0' : '#1e293b',
                            outline: 'none',
                          }}
                        >
                          {CONTACT_TYPE_OPTIONS.map(o => (
                            <option key={o.value} value={o.value}>{isRTL ? o.ar : o.en}</option>
                          ))}
                        </select>
                      )}
                      <div
                        onClick={() => setValidationRules(p => ({ ...p, autoFillContactType: !p.autoFillContactType }))}
                        style={{
                          width: 36,
                          height: 20,
                          borderRadius: 10,
                          background: validationRules.autoFillContactType ? '#4A7AAB' : (isDark ? '#334155' : '#cbd5e1'),
                          cursor: 'pointer',
                          position: 'relative',
                          transition: 'background 0.2s',
                          flexShrink: 0,
                        }}
                      >
                        <div style={{
                          width: 16, height: 16, borderRadius: '50%', background: '#fff',
                          position: 'absolute', top: 2, left: validationRules.autoFillContactType ? 18 : 2,
                          transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                        }} />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 3 - Preview */}
          {step === 3 && (
            <div>
              {/* Cleaning Summary */}
              <CleaningSummaryCard />

              {/* Agent Matching Review — only shown when any row has an assignee */}
              {agentMatchTable.length > 0 && (
                <div style={{ marginBottom: 16, padding: 14, borderRadius: 12, background: isDark ? 'rgba(74,122,171,0.08)' : 'rgba(74,122,171,0.04)', border: `1px solid ${isDark ? 'rgba(74,122,171,0.2)' : 'rgba(74,122,171,0.15)'}` }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: isDark ? '#e2e8f0' : '#1e293b' }}>
                      {isRTL ? '🔍 مراجعة المسؤولين' : '🔍 Agent Mapping Review'}
                    </span>
                    {unmatchedCount > 0 && (
                      <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 999, background: 'rgba(239,68,68,0.12)', color: '#EF4444' }}>
                        {isRTL ? `${unmatchedCount} غير مطابق` : `${unmatchedCount} unmatched`}
                      </span>
                    )}
                    {partialCount > 0 && (
                      <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 999, background: 'rgba(245,158,11,0.12)', color: '#D97706' }}>
                        {isRTL ? `${partialCount} تطابق جزئي` : `${partialCount} partial`}
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 11, color: isDark ? '#94a3b8' : '#64748b', marginBottom: 10 }}>
                    {isRTL
                      ? 'الأسماء اللي في عمود "مسؤول" بتاع الشيت — صحّح أي اسم مش متطابق قبل الاستيراد.'
                      : 'Names from the sheet\'s "Assigned To" column — fix any unmatched names before import.'}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 220, overflowY: 'auto' }}>
                    {agentMatchTable.map(a => {
                      const override = agentOverrides[a.raw];
                      const effectiveStatus = override ? 'exact' : a.status;
                      const statusColor = effectiveStatus === 'exact' ? '#10B981'
                        : effectiveStatus === 'normalized' ? '#10B981'
                        : effectiveStatus === 'partial' ? '#D97706'
                        : '#EF4444';
                      const statusIcon = effectiveStatus === 'exact' ? '✓'
                        : effectiveStatus === 'normalized' ? '✓'
                        : effectiveStatus === 'partial' ? '⚠'
                        : '✗';
                      return (
                        <div key={a.raw} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 8, background: isDark ? 'rgba(255,255,255,0.02)' : '#fff', border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}` }}>
                          <span style={{ fontSize: 14, fontWeight: 700, color: statusColor, width: 16, textAlign: 'center' }}>{statusIcon}</span>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 12, fontWeight: 600, color: isDark ? '#e2e8f0' : '#1e293b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} dir="auto">
                              "{a.raw}"
                              <span style={{ fontWeight: 400, marginInlineStart: 6, color: isDark ? '#94a3b8' : '#64748b', fontSize: 10 }}>
                                ({a.count} {isRTL ? 'ليد' : 'leads'})
                              </span>
                            </div>
                            {a.status === 'exact' && !override && (
                              <div style={{ fontSize: 10, color: '#10B981', marginTop: 2 }}>
                                {isRTL ? `مطابق: ${a.matchedTo}` : `Matched: ${a.matchedTo}`}
                              </div>
                            )}
                            {a.status === 'normalized' && !override && (
                              <div style={{ fontSize: 10, color: '#10B981', marginTop: 2 }}>
                                {isRTL ? `مطابق تلقائياً: ${a.matchedTo}` : `Auto-matched: ${a.matchedTo}`}
                              </div>
                            )}
                            {a.status === 'partial' && !override && (
                              <div style={{ fontSize: 10, color: '#D97706', marginTop: 2 }}>
                                {isRTL ? `اقتراح: ${a.matchedTo} — اختار يدوياً للتأكيد` : `Suggested: ${a.matchedTo} — pick manually to confirm`}
                              </div>
                            )}
                            {a.status === 'none' && !override && (
                              <div style={{ fontSize: 10, color: '#EF4444', marginTop: 2 }}>
                                {isRTL ? 'غير موجود في السيستم — لو تركت كده هيتحفظ بنفس الاسم (قد لا يظهر لأي سيلز)' : 'Not found in users — will save as-is (may not appear for any agent)'}
                              </div>
                            )}
                            {override && (
                              <div style={{ fontSize: 10, color: '#4A7AAB', marginTop: 2 }}>
                                {isRTL ? `هيتحول لـ: ${override}` : `Will map to: ${override}`}
                              </div>
                            )}
                          </div>
                          <select
                            value={agentOverrides[a.raw] || (a.status === 'exact' || a.status === 'normalized' ? a.matchedTo : '')}
                            onChange={e => setAgentOverrides(prev => ({ ...prev, [a.raw]: e.target.value }))}
                            style={{ padding: '4px 6px', borderRadius: 6, fontSize: 11, border: `1px solid ${isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)'}`, background: isDark ? 'rgba(255,255,255,0.05)' : '#f8fafc', color: isDark ? '#e2e8f0' : '#1e293b', minWidth: 150 }}
                          >
                            <option value="">{isRTL ? '— اتركه كما هو —' : '— leave as-is —'}</option>
                            {knownUsers.map(u => (
                              <option key={u.id} value={u.full_name_en || u.full_name_ar}>
                                {u.full_name_en || u.full_name_ar}
                              </option>
                            ))}
                          </select>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <SummaryCards items={[
                { num: newRows.length, label: isRTL ? 'عميل جديد' : 'New Contacts', color: '#10B981', bg: 'rgba(16,185,129,0.1)', border: 'rgba(16,185,129,0.2)', icon: '\u2705' },
                { num: dupRows.length, label: isRTL ? (duplicateAction === 'skip' ? 'تخطي' : duplicateAction === 'overwrite' ? 'استبدال' : 'فرصة جديدة') : (duplicateAction === 'skip' ? 'Skipped' : duplicateAction === 'overwrite' ? 'Overwrite' : 'Opportunity'), color: '#4A7AAB', bg: 'rgba(74,122,171,0.1)', border: 'rgba(74,122,171,0.2)', icon: duplicateAction === 'skip' ? '\u23ED' : duplicateAction === 'overwrite' ? '\u270F\uFE0F' : '\u{1F504}' },
                { num: errRows.length, label: isRTL ? 'مرفوض' : 'Rejected', color: '#EF4444', bg: 'rgba(239,68,68,0.1)', border: 'rgba(239,68,68,0.2)', icon: '\u274C' },
              ]} />

              <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
                {[
                  ['all', isRTL ? 'الكل' : 'All', rows.length],
                  ['new', isRTL ? 'جديد' : 'New', newRows.length],
                  ['dup', isRTL ? 'مكرر' : 'Duplicates', dupRows.length],
                  ['err', isRTL ? 'أخطاء' : 'Errors', errRows.length],
                ].map(([v, l, c]) => (
                  <FilterPill key={v} label={l} count={c} active={tab === v} onClick={() => setTab(v)} />
                ))}
              </div>

              {/* Progress bar for large imports */}
              {importing && importProgress.active && (
                <div style={{ marginBottom: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <span style={{ fontSize: 12, color: isDark ? '#94a3b8' : '#64748b' }}>
                      {isRTL ? `جاري المعالجة ${importProgress.current} من ${importProgress.total}...` : `Processing ${importProgress.current} of ${importProgress.total}...`}
                    </span>
                    <span style={{ fontSize: 12, color: '#4A7AAB', fontWeight: 600 }}>
                      {Math.round((importProgress.current / importProgress.total) * 100)}%
                    </span>
                  </div>
                  <div style={{
                    width: '100%',
                    height: 8,
                    borderRadius: 4,
                    background: isDark ? 'rgba(74,122,171,0.1)' : '#e5e7eb',
                    overflow: 'hidden',
                  }}>
                    <div style={{
                      height: '100%',
                      borderRadius: 4,
                      transition: 'width 0.3s',
                      width: `${(importProgress.current / importProgress.total) * 100}%`,
                      background: 'linear-gradient(90deg, #4A7AAB, #10B981)',
                    }} />
                  </div>
                </div>
              )}

              {/* Color legend */}
              {cleaningSummary && (cleaningSummary.phonesNormalized > 0 || cleaningSummary.namesCleaned > 0 || cleaningSummary.emailsFixed > 0 || cleaningSummary.invalidPhones > 0 || cleaningSummary.invalidEmails > 0) && (
                <div style={{
                  display: 'flex',
                  gap: 16,
                  marginBottom: 8,
                  fontSize: 11,
                  color: isDark ? '#94a3b8' : '#64748b',
                }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ width: 10, height: 10, borderRadius: 2, background: isDark ? 'rgba(16,185,129,0.12)' : 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', display: 'inline-block' }} />
                    {isRTL ? 'تم تصحيحه' : 'Auto-corrected'}
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ width: 10, height: 10, borderRadius: 2, background: isDark ? 'rgba(245,158,11,0.12)' : 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', display: 'inline-block' }} />
                    {isRTL ? 'تحذير' : 'Warning'}
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ width: 10, height: 10, borderRadius: 2, background: isDark ? 'rgba(239,68,68,0.12)' : 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', display: 'inline-block' }} />
                    {isRTL ? 'مرفوض' : 'Rejected'}
                  </span>
                </div>
              )}

              <div style={{ maxHeight: 220, overflowY: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead><tr>
                    {[isRTL ? 'الاسم' : 'Name', isRTL ? 'الرقم' : 'Phone', isRTL ? 'الايميل' : 'Email', isRTL ? 'الحالة' : 'Status', isRTL ? 'السبب' : 'Note'].map((h, i) => (
                      <th key={i} style={{
                        color: isDark ? '#94a3b8' : '#64748b',
                        padding: '8px 10px',
                        textAlign: isRTL ? 'right' : 'left',
                        borderBottom: `1px solid ${isDark ? 'rgba(74,122,171,0.15)' : '#e5e7eb'}`,
                        fontSize: 12,
                        fontWeight: 600,
                      }}>{h}</th>
                    ))}
                  </tr></thead>
                  <tbody>
                    {displayRows.map((r, i) => {
                      const isDuplicate = r._status === 'opportunity' || r._status === 'overwrite' || r._status === 'skipped';
                      return (
                        <tr key={i} style={isDuplicate ? { background: 'rgba(74,122,171,0.05)' } : {}}>
                          <CleanedCell row={r} fieldKey="full_name">
                            {r.full_name || '\u2014'}
                          </CleanedCell>
                          <CleanedCell row={r} fieldKey="phone">
                            <span style={{ fontFamily: 'monospace' }}>{r.phone || '\u2014'}</span>
                          </CleanedCell>
                          <CleanedCell row={r} fieldKey="email">
                            {r.email || '\u2014'}
                          </CleanedCell>
                          <td style={{
                            color: isDark ? '#e2e8f0' : '#1e293b',
                            padding: '8px 10px',
                            borderBottom: `1px solid ${isDark ? 'rgba(74,122,171,0.06)' : '#f3f4f6'}`,
                            fontSize: 12,
                          }}>
                            {r._status === 'new' && <span style={{ padding: '2px 8px', borderRadius: 999, background: 'rgba(16,185,129,0.15)', color: '#10B981', fontSize: 12 }}>{'\u2705'} {isRTL ? 'جديد' : 'New'}</span>}
                            {r._status === 'opportunity' && <span style={{ padding: '2px 8px', borderRadius: 999, background: 'rgba(74,122,171,0.15)', color: '#4A7AAB', fontSize: 12 }}>{'\u{1F504}'} {isRTL ? 'فرصة' : 'Opp'}</span>}
                            {r._status === 'overwrite' && <span style={{ padding: '2px 8px', borderRadius: 999, background: 'rgba(245,158,11,0.15)', color: '#F59E0B', fontSize: 12 }}>{'\u270F\uFE0F'} {isRTL ? 'استبدال' : 'Overwrite'}</span>}
                            {r._status === 'skipped' && <span style={{ padding: '2px 8px', borderRadius: 999, background: 'rgba(107,114,128,0.15)', color: '#6B7280', fontSize: 12 }}>{'\u23ED'} {isRTL ? 'تخطي' : 'Skipped'}</span>}
                            {r._status === 'error' && <span style={{ padding: '2px 8px', borderRadius: 999, background: 'rgba(239,68,68,0.15)', color: '#EF4444', fontSize: 12 }}>{'\u274C'} {isRTL ? 'خطأ' : 'Error'}</span>}
                          </td>
                          <td style={{
                            padding: '8px 10px',
                            borderBottom: `1px solid ${isDark ? 'rgba(74,122,171,0.06)' : '#f3f4f6'}`,
                            fontSize: 12,
                            color: isDark ? '#94a3b8' : '#64748b',
                          }}>
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
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>{'\u{1F389}'}</div>
              <div style={{ color: isDark ? '#e2e8f0' : '#1e293b', fontSize: 18, fontWeight: 700, marginBottom: 8 }}>
                {isRTL ? 'تم الاستيراد بنجاح' : 'Import Complete!'}
              </div>
              <div style={{ color: isDark ? '#94a3b8' : '#64748b', fontSize: 12, marginBottom: 24 }}>
                {isRTL ? `تمت معالجة ${rows.length} صف` : `Processed ${rows.length} rows`}
              </div>
              <SummaryCards items={[
                { num: newRows.length, label: isRTL ? 'أضيفوا' : 'Added', color: '#10B981', bg: 'rgba(16,185,129,0.1)', border: 'rgba(16,185,129,0.2)' },
                { num: overwriteRows.length, label: isRTL ? 'تم استبدالهم' : 'Overwritten', color: '#F59E0B', bg: 'rgba(245,158,11,0.1)', border: 'rgba(245,158,11,0.2)' },
                { num: oppRows.length, label: isRTL ? 'فرص جديدة' : 'Opportunities', color: '#4A7AAB', bg: 'rgba(74,122,171,0.1)', border: 'rgba(74,122,171,0.2)' },
                { num: skippedRows.length, label: isRTL ? 'تم تخطيهم' : 'Skipped', color: '#6B7280', bg: 'rgba(107,114,128,0.1)', border: 'rgba(107,114,128,0.2)' },
                { num: errRows.length, label: isRTL ? 'مرفوضين' : 'Rejected', color: '#EF4444', bg: 'rgba(239,68,68,0.1)', border: 'rgba(239,68,68,0.2)' },
              ].filter(s => s.num > 0)} />
              {errRows.length > 0 && (
                <Button variant="danger" onClick={downloadErrors} style={{ width: '100%' }}>
                  {'\u2B07\uFE0F'} {isRTL ? `تحميل تقرير الأخطاء (${errRows.length} صف)` : `Download Error Report (${errRows.length} rows)`}
                </Button>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '16px 24px',
          borderTop: `1px solid ${isDark ? 'rgba(74,122,171,0.15)' : '#e5e7eb'}`,
          display: 'flex',
          justifyContent: 'space-between',
        }}>
          <Button variant="secondary" size="sm" onClick={
            step === 1 ? onClose :
            step === 2 ? () => setStep(1) :
            step === 3 ? () => setStep(2) :
            onClose
          }>
            {step === 1 || step === 4 ? (isRTL ? 'إلغاء' : step === 4 ? 'Close' : 'Cancel') : (isRTL ? '\u2190 رجوع' : '\u2190 Back')}
          </Button>
          {step === 2 && (
            <Button size="sm" onClick={async () => { setPreviewLoading(true); try { await processMapping(); } finally { setPreviewLoading(false); } }} disabled={!requiredMapped || previewLoading}>
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
