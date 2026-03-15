import { useState, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../contexts/ThemeContext';
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

  // ──────────────────────────────────────────────
  // ENHANCED: Process mapped data with cleaning
  // ──────────────────────────────────────────────
  const processMapping = () => {
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
          ...cleanedRow, phone, phone2, email, full_name,
          _row: idx + 2,
          _status: duplicateAction === 'skip' ? 'skipped' : duplicateAction === 'overwrite' ? 'overwrite' : 'opportunity',
          _existingId: duplicateMatch.id,
          _existingName: duplicateMatch.full_name,
          _duplicateReason: duplicateReason,
          _origIdx: idx,
        };
      }

      return {
        ...cleanedRow,
        phone,
        phone2,
        email,
        full_name,
        contact_type: TYPE_MAP[cleanedRow.contact_type] || cleanedRow.contact_type || 'lead',
        temperature: RATING_MAP[cleanedRow.temperature] || cleanedRow.temperature || 'warm',
        department: cleanedRow.department || 'sales',
        platform: SOURCE_PLATFORM[cleanedRow.source] || 'other',
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
