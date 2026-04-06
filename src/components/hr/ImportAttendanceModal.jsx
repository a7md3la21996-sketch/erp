import { useState, useCallback, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, ModalFooter, Button } from '../ui';
import { Upload, FileSpreadsheet, CheckCircle2, AlertCircle, Users, Calendar, X, Link2 } from 'lucide-react';
import supabase from '../../lib/supabase';

// ── Parse fingerprint Excel ──────────────────────────────────

const TIME_RE = /^(\d{1,2}):(\d{2})$/;

function isTimeValue(val) {
  if (!val) return false;
  return TIME_RE.test(String(val).trim());
}

function excelTimeToString(val) {
  if (val instanceof Date) {
    const h = String(val.getHours()).padStart(2, '0');
    const m = String(val.getMinutes()).padStart(2, '0');
    return `${h}:${m}`;
  }
  if (typeof val === 'number' && val < 1) {
    const totalMinutes = Math.round(val * 24 * 60);
    const h = String(Math.floor(totalMinutes / 60)).padStart(2, '0');
    const m = String(totalMinutes % 60).padStart(2, '0');
    return `${h}:${m}`;
  }
  const s = String(val).trim();
  if (TIME_RE.test(s)) return s;
  return null;
}

async function parseFingerPrintExcel(file, selectedMonth, selectedYear) {
  const buffer = await file.arrayBuffer();
  const fileName = file.name.toLowerCase();

  let rows = [];

  if (fileName.endsWith('.xls') && !fileName.endsWith('.xlsx')) {
    const XLSX = (await import('xlsx')).default || (await import('xlsx'));
    const wb = XLSX.read(buffer, { type: 'array' });
    const sheetName = wb.SheetNames[0];
    if (!sheetName) return { employees: [], errors: ['لا يوجد شيت في الملف'] };
    const ws = wb.Sheets[sheetName];
    const jsonData = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
    jsonData.forEach((row, idx) => {
      // Keep 0-indexed — do NOT prepend null, SheetJS rows already start at col 0
      rows.push({ rowNum: idx + 1, values: row });
    });
  } else {
    const ExcelJS = (await import('exceljs')).default;
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);
    const sheet = workbook.worksheets[0];
    if (!sheet) return { employees: [], errors: ['لا يوجد شيت في الملف'] };
    sheet.eachRow({ includeEmpty: true }, (row, rowNum) => {
      rows.push({ rowNum, values: row.values });
    });
  }

  const employees = [];
  const errors = [];

  let i = 0;
  while (i < rows.length) {
    const row = rows[i];
    const firstCell = String(row.values[0] || row.values[1] || '');

    if (firstCell.includes('رقم هوية') || firstCell.includes('رقم') || firstCell.match(/^(No|ID|رقم)/i)) {
      const headerText = row.values.filter(Boolean).join(' ');
      const emp = parseEmployeeHeader(headerText);

      if (emp) {
        const dayRow = rows[i + 1];
        const timeRow = rows[i + 2];

        if (dayRow && timeRow) {
          const attendance = parseDayTimes(dayRow.values, timeRow.values, selectedMonth, selectedYear);

          let timeRow2 = rows[i + 3];
          if (timeRow2 && !isEmployeeHeaderRow(String(timeRow2.values[1] || '')) && !isDayNumberRow(timeRow2.values)) {
            const extra = parseDayTimesSecondRow(dayRow.values, timeRow.values, timeRow2.values, selectedMonth, selectedYear);
            if (extra.length > 0) {
              attendance.length = 0;
              extra.forEach(r => attendance.push(r));
            }
          }

          employees.push({ ...emp, attendance });
          i += 3;
          continue;
        }
      }
    }
    i++;
  }

  if (employees.length === 0) {
    errors.push('لم يتم العثور على بيانات موظفين في الملف');
  }

  return { employees, errors };
}

function isEmployeeHeaderRow(text) {
  return text.includes('رقم هوية') || text.includes('رقم') || text.match(/^(No|ID)/i);
}

function isDayNumberRow(values) {
  let numCount = 0;
  for (let c = 0; c < values.length; c++) {
    const v = Number(values[c]);
    if (v >= 1 && v <= 31) numCount++;
  }
  return numCount >= 15;
}

function parseEmployeeHeader(text) {
  const idMatch = text.match(/(?:رقم هوية|رقم|No|ID)[:\s]*(\S+)/i);
  const nameMatch = text.match(/(?:الاسم|Name)[:\s]*(\S+)/i);
  const deptMatch = text.match(/(?:القسم|Dept|Department)[:\s]*(\S+)/i);
  const shiftMatch = text.match(/(?:فترة الدوام|Shift)[:\s]*(\S+)/i);

  if (!idMatch && !nameMatch) return null;

  return {
    employee_id: idMatch?.[1] || '',
    name: nameMatch?.[1] || '',
    department: deptMatch?.[1] || '',
    shift: shiftMatch?.[1] || 'فترة الدوام1',
  };
}

function parseDayTimes(dayValues, timeValues, month, year) {
  const records = [];
  const dayMap = {};

  for (let c = 0; c < dayValues.length; c++) {
    const v = Number(dayValues[c]);
    if (v >= 1 && v <= 31) dayMap[c] = v;
  }

  const dayCols = Object.keys(dayMap).map(Number).sort((a, b) => a - b);

  for (let d = 0; d < dayCols.length; d++) {
    const col = dayCols[d];
    const day = dayMap[col];
    const val = timeValues[col];

    if (!val) continue;

    const valStr = String(val).trim();
    // Extract all HH:MM timestamps from the cell
    const allTimes = valStr.match(/\d{1,2}:\d{2}/g);
    if (allTimes && allTimes.length >= 2) {
      // First timestamp = check_in, last = check_out (handles 3+ punches)
      records.push({ day, date: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`, check_in: allTimes[0], check_out: allTimes[allTimes.length - 1] });
      continue;
    }
    if (allTimes && allTimes.length === 1) {
      records.push({ day, date: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`, check_in: allTimes[0], check_out: null });
      continue;
    }

    const t1 = excelTimeToString(val);
    if (t1) {
      const nextCol = col + 1;
      const t2 = timeValues[nextCol] ? excelTimeToString(timeValues[nextCol]) : null;

      if (t2 && !dayMap[nextCol]) {
        records.push({ day, date: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`, check_in: t1, check_out: t2 });
      } else {
        records.push({ day, date: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`, check_in: t1, check_out: null });
      }
    }
  }

  return records;
}

function parseDayTimesSecondRow(dayValues, timeRow1, timeRow2, month, year) {
  const records = [];
  const dayMap = {};

  for (let c = 0; c < dayValues.length; c++) {
    const v = Number(dayValues[c]);
    if (v >= 1 && v <= 31) dayMap[c] = v;
  }

  for (const [col, day] of Object.entries(dayMap)) {
    const c = Number(col);
    const t1 = excelTimeToString(timeRow1[c]);
    const t2 = excelTimeToString(timeRow2[c]);

    if (t1 || t2) {
      records.push({ day, date: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`, check_in: t1 || null, check_out: t2 || null });
    }
  }

  return records;
}

// ── Match employees against Supabase ─────────────────────────

async function matchEmployees(parsedEmployees) {
  // Load all active employees
  const { data: dbEmployees } = await supabase
    .from('employees')
    .select('id, employee_number, full_name_ar, full_name_en, fingerprint_id, is_active')
    .eq('is_active', true);

  const matched = [];
  const unmatched = [];

  for (const emp of parsedEmployees) {
    let match = null;

    // 1. Match by fingerprint_id (highest priority — previously linked)
    if (emp.employee_id) {
      match = dbEmployees?.find(e => e.fingerprint_id === emp.employee_id);
    }

    // 2. Match by employee_number
    if (!match && emp.employee_id) {
      match = dbEmployees?.find(e => e.employee_number === emp.employee_id);
    }

    // 3. Match by name (exact or contains)
    if (!match && emp.name) {
      const nameLower = emp.name.toLowerCase().replace(/\s/g, '');
      match = dbEmployees?.find(e => {
        const arName = (e.full_name_ar || '').toLowerCase().replace(/\s/g, '');
        const enName = (e.full_name_en || '').toLowerCase().replace(/\s/g, '');
        return arName === nameLower || enName === nameLower ||
               arName.includes(nameLower) || enName.includes(nameLower) ||
               nameLower.includes(arName) || nameLower.includes(enName);
      });
    }

    if (match) {
      matched.push({ ...emp, dbEmployee: match, dbEmployeeId: match.id });
    } else {
      unmatched.push({ ...emp, dbEmployee: null, dbEmployeeId: null });
    }
  }

  return { matched, unmatched, dbEmployees: dbEmployees || [] };
}

// ── Component ────────────────────────────────────────────────

export default function ImportAttendanceModal({ open, onClose, onImported }) {
  const { i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const lang = i18n.language;
  const fileRef = useRef(null);

  // Steps: upload → preview → mapping → importing → done
  const [step, setStep] = useState('upload');
  const [file, setFile] = useState(null);
  const [month, setMonth] = useState(() => new Date().getMonth() + 1);
  const [year, setYear] = useState(() => new Date().getFullYear());
  const [parsed, setParsed] = useState(null);
  const [errors, setErrors] = useState([]);
  const [importProgress, setImportProgress] = useState(0);
  const [importResult, setImportResult] = useState(null);

  // Matching state
  const [matched, setMatched] = useState([]);
  const [unmatched, setUnmatched] = useState([]);
  const [dbEmployees, setDbEmployees] = useState([]);
  const [manualMapping, setManualMapping] = useState({}); // { sheetIndex: dbEmployeeId }

  const MONTHS_AR = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];

  const handleFile = useCallback(async (f) => {
    if (!f) return;
    setFile(f);
    setErrors([]);

    try {
      const result = await parseFingerPrintExcel(f, month, year);
      setParsed(result.employees);
      if (result.errors.length) {
        setErrors(result.errors);
        setStep('upload');
        return;
      }

      // Auto-match employees
      const matchResult = await matchEmployees(result.employees);
      setMatched(matchResult.matched);
      setUnmatched(matchResult.unmatched);
      setDbEmployees(matchResult.dbEmployees);
      setManualMapping({});

      // If all matched → go to preview, otherwise → mapping step
      if (matchResult.unmatched.length === 0) {
        setStep('preview');
      } else {
        setStep('mapping');
      }
    } catch (err) {
      setErrors([`خطأ في قراءة الملف: ${err.message}`]);
      setParsed(null);
      setStep('upload');
    }
  }, [month, year]);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  }, [handleFile]);

  // Get employees not already matched (available for manual mapping)
  const availableEmployees = dbEmployees.filter(e => {
    const alreadyMatched = matched.some(m => m.dbEmployeeId === e.id);
    const alreadyMapped = Object.values(manualMapping).includes(e.id);
    return !alreadyMatched && !alreadyMapped;
  });

  const handleConfirmMapping = () => {
    // Move manually mapped employees to matched list
    const newMatched = [...matched];
    const stillUnmatched = [];

    unmatched.forEach((emp, idx) => {
      const mappedId = manualMapping[idx];
      if (mappedId) {
        const dbEmp = dbEmployees.find(e => e.id === mappedId);
        newMatched.push({ ...emp, dbEmployee: dbEmp, dbEmployeeId: mappedId });
      } else {
        stillUnmatched.push(emp);
      }
    });

    setMatched(newMatched);
    setUnmatched(stillUnmatched);
    setStep('preview');
  };

  const handleImport = useCallback(async () => {
    if (!matched.length) return;
    setStep('importing');
    setImportProgress(0);

    let inserted = 0;
    let failed = 0;
    const savedFingerprints = [];

    for (let i = 0; i < matched.length; i++) {
      const emp = matched[i];
      setImportProgress(Math.round(((i + 1) / matched.length) * 100));

      // Save fingerprint_id if not already set
      if (emp.employee_id && emp.dbEmployee && emp.dbEmployee.fingerprint_id !== emp.employee_id) {
        try {
          await supabase
            .from('employees')
            .update({ fingerprint_id: emp.employee_id })
            .eq('id', emp.dbEmployeeId);
          savedFingerprints.push(emp.dbEmployee.full_name_en || emp.dbEmployee.full_name_ar);
        } catch { /* ignore */ }
      }

      // Insert attendance records
      for (const rec of emp.attendance) {
        try {
          const { error } = await supabase
            .from('attendance')
            .upsert({
              employee_id: emp.dbEmployeeId,
              date: rec.date,
              check_in: rec.check_in,
              check_out: rec.check_out,
              status: rec.check_in ? 'present' : 'absent',
              created_at: new Date().toISOString(),
            }, { onConflict: 'employee_id,date' });
          if (error) throw error;
          inserted++;
        } catch {
          failed++;
        }
      }
    }

    setImportResult({
      inserted,
      matched: matched.length,
      skipped: unmatched.length,
      failed,
      savedFingerprints,
      unmatchedNames: unmatched.map(e => ({ id: e.employee_id, name: e.name, department: e.department })),
    });
    setStep('done');
    if (onImported) onImported();
  }, [matched, unmatched, onImported]);

  const reset = () => {
    setStep('upload');
    setFile(null);
    setParsed(null);
    setErrors([]);
    setImportProgress(0);
    setImportResult(null);
    setMatched([]);
    setUnmatched([]);
    setManualMapping({});
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  if (!open) return null;

  const totalMatchedRecords = matched.reduce((s, e) => s + e.attendance.length, 0);

  return (
    <Modal open={open} onClose={handleClose} title={lang === 'ar' ? 'استيراد شيت البصمة' : 'Import Fingerprint Sheet'} size="lg">
      <div dir={isRTL ? 'rtl' : 'ltr'} className="space-y-4">

        {/* Step 1: Upload */}
        {step === 'upload' && (
          <>
            <div className="flex gap-3 items-center">
              <label className="text-sm font-medium text-content dark:text-content-dark">
                {lang === 'ar' ? 'الشهر:' : 'Month:'}
              </label>
              <select
                value={month}
                onChange={e => setMonth(+e.target.value)}
                className="px-3 py-1.5 rounded-lg border border-edge dark:border-edge-dark bg-surface dark:bg-surface-dark text-sm text-content dark:text-content-dark"
              >
                {MONTHS_AR.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
              </select>
              <input
                type="number"
                value={year}
                onChange={e => setYear(+e.target.value)}
                className="w-20 px-3 py-1.5 rounded-lg border border-edge dark:border-edge-dark bg-surface dark:bg-surface-dark text-sm text-content dark:text-content-dark"
              />
            </div>

            <div
              onDragOver={e => e.preventDefault()}
              onDrop={handleDrop}
              onClick={() => fileRef.current?.click()}
              className="border-2 border-dashed border-brand-500/30 rounded-xl p-10 text-center cursor-pointer hover:border-brand-500/60 hover:bg-brand-500/5 transition-all"
            >
              <input
                ref={fileRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={e => handleFile(e.target.files[0])}
              />
              <div className="w-14 h-14 rounded-2xl bg-brand-500/10 flex items-center justify-center mx-auto mb-4">
                <Upload size={24} className="text-brand-500" />
              </div>
              <p className="m-0 text-sm font-bold text-content dark:text-content-dark mb-1">
                {lang === 'ar' ? 'اسحب ملف البصمة هنا أو اضغط للاختيار' : 'Drag fingerprint file here or click to browse'}
              </p>
              <p className="m-0 text-xs text-content-muted dark:text-content-muted-dark">
                {lang === 'ar' ? 'يدعم ملفات Excel (.xlsx, .xls)' : 'Supports Excel files (.xlsx, .xls)'}
              </p>
            </div>
          </>
        )}

        {/* Errors */}
        {errors.length > 0 && (
          <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-xl p-3">
            {errors.map((err, i) => (
              <div key={i} className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400">
                <AlertCircle size={14} />
                <span>{err}</span>
              </div>
            ))}
          </div>
        )}

        {/* Step 2: Mapping — link unmatched employees */}
        {step === 'mapping' && (
          <>
            <div className="flex items-center gap-2 mb-2">
              <Link2 size={18} className="text-yellow-500" />
              <span className="text-sm font-bold text-content dark:text-content-dark">
                {lang === 'ar' ? `${unmatched.length} موظف محتاج ربط يدوي` : `${unmatched.length} employees need manual matching`}
              </span>
            </div>

            {matched.length > 0 && (
              <div className="bg-green-50 dark:bg-green-500/10 border border-green-200 dark:border-green-500/30 rounded-lg p-2 text-xs text-green-700 dark:text-green-300">
                <CheckCircle2 size={12} className="inline me-1" />
                {lang === 'ar' ? `${matched.length} موظف تم التعرف عليهم تلقائياً` : `${matched.length} employees auto-matched`}
              </div>
            )}

            <div className="max-h-72 overflow-auto space-y-2">
              {unmatched.map((emp, idx) => (
                <div key={idx} className="flex items-center gap-3 border border-edge dark:border-edge-dark rounded-xl p-3">
                  <div className="flex-1 min-w-0">
                    <p className="m-0 text-sm font-bold text-content dark:text-content-dark truncate">
                      {emp.name}
                    </p>
                    <p className="m-0 text-xs text-content-muted dark:text-content-muted-dark">
                      {lang === 'ar' ? 'كود البصمة:' : 'Fingerprint ID:'} {emp.employee_id} · {emp.department} · {emp.attendance.length} {lang === 'ar' ? 'يوم' : 'days'}
                    </p>
                  </div>
                  <select
                    value={manualMapping[idx] || ''}
                    onChange={e => setManualMapping(prev => ({ ...prev, [idx]: e.target.value || null }))}
                    className="w-48 px-2 py-1.5 rounded-lg border border-edge dark:border-edge-dark bg-surface dark:bg-surface-dark text-xs text-content dark:text-content-dark"
                  >
                    <option value="">{lang === 'ar' ? '— اختر الموظف —' : '— Select employee —'}</option>
                    {availableEmployees.map(e => (
                      <option key={e.id} value={e.id}>
                        {(isRTL ? e.full_name_ar : e.full_name_en) || e.full_name_ar} ({e.employee_number})
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>

            <p className="m-0 text-xs text-content-muted dark:text-content-muted-dark">
              {lang === 'ar'
                ? 'اربط كل موظف في الشيت بالموظف المقابل في السيستم. الربط بيتحفظ تلقائي ومش هتحتاج تعمله تاني.'
                : 'Link each sheet employee to their system match. This is saved automatically for future imports.'}
            </p>
          </>
        )}

        {/* Step 3: Preview */}
        {step === 'preview' && (
          <>
            <div className="flex items-center gap-2 mb-3">
              <FileSpreadsheet size={18} className="text-brand-500" />
              <span className="text-sm font-bold text-content dark:text-content-dark">{file?.name}</span>
              <button onClick={reset} className="ms-auto text-content-muted hover:text-red-500 transition-colors">
                <X size={16} />
              </button>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="bg-brand-500/5 rounded-xl p-3 text-center">
                <Users size={18} className="text-brand-500 mx-auto mb-1" />
                <p className="m-0 text-lg font-bold text-content dark:text-content-dark">{matched.length}</p>
                <p className="m-0 text-xs text-content-muted dark:text-content-muted-dark">{lang === 'ar' ? 'موظف متطابق' : 'Matched'}</p>
              </div>
              <div className="bg-brand-500/5 rounded-xl p-3 text-center">
                <Calendar size={18} className="text-brand-500 mx-auto mb-1" />
                <p className="m-0 text-lg font-bold text-content dark:text-content-dark">{totalMatchedRecords}</p>
                <p className="m-0 text-xs text-content-muted dark:text-content-muted-dark">{lang === 'ar' ? 'سجل حضور' : 'Records'}</p>
              </div>
              <div className="bg-brand-500/5 rounded-xl p-3 text-center">
                <Calendar size={18} className="text-brand-500 mx-auto mb-1" />
                <p className="m-0 text-lg font-bold text-content dark:text-content-dark">{MONTHS_AR[month - 1]} {year}</p>
                <p className="m-0 text-xs text-content-muted dark:text-content-muted-dark">{lang === 'ar' ? 'الشهر' : 'Month'}</p>
              </div>
            </div>

            <div className="max-h-64 overflow-auto rounded-xl border border-edge dark:border-edge-dark">
              <table className="w-full text-sm">
                <thead className="bg-surface-bg dark:bg-surface-bg-dark sticky top-0">
                  <tr>
                    <th className="px-3 py-2 text-start text-xs font-bold text-content-muted dark:text-content-muted-dark">{lang === 'ar' ? 'كود البصمة' : 'FP ID'}</th>
                    <th className="px-3 py-2 text-start text-xs font-bold text-content-muted dark:text-content-muted-dark">{lang === 'ar' ? 'الاسم (الشيت)' : 'Sheet Name'}</th>
                    <th className="px-3 py-2 text-start text-xs font-bold text-content-muted dark:text-content-muted-dark">{lang === 'ar' ? 'الموظف (السيستم)' : 'System Match'}</th>
                    <th className="px-3 py-2 text-start text-xs font-bold text-content-muted dark:text-content-muted-dark">{lang === 'ar' ? 'أيام' : 'Days'}</th>
                  </tr>
                </thead>
                <tbody>
                  {matched.map((emp, idx) => (
                    <tr key={idx} className="border-t border-edge dark:border-edge-dark">
                      <td className="px-3 py-2 text-content dark:text-content-dark font-mono text-xs">{emp.employee_id}</td>
                      <td className="px-3 py-2 text-content-muted dark:text-content-muted-dark text-xs">{emp.name}</td>
                      <td className="px-3 py-2 text-content dark:text-content-dark font-medium text-xs">
                        {(isRTL ? emp.dbEmployee?.full_name_ar : emp.dbEmployee?.full_name_en) || emp.dbEmployee?.full_name_ar}
                      </td>
                      <td className="px-3 py-2 font-bold text-brand-500 text-xs">{emp.attendance.length}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {unmatched.length > 0 && (
              <div className="bg-yellow-50 dark:bg-yellow-500/10 border border-yellow-200 dark:border-yellow-500/30 rounded-lg p-2 text-xs text-yellow-700 dark:text-yellow-300">
                <AlertCircle size={12} className="inline me-1" />
                {lang === 'ar' ? `${unmatched.length} موظف لم يتم ربطهم وهيتم تخطيهم` : `${unmatched.length} unlinked employees will be skipped`}
              </div>
            )}
          </>
        )}

        {/* Step 4: Importing */}
        {step === 'importing' && (
          <div className="text-center py-8">
            <div className="w-14 h-14 rounded-2xl bg-brand-500/10 flex items-center justify-center mx-auto mb-4 animate-pulse">
              <Upload size={24} className="text-brand-500" />
            </div>
            <p className="m-0 text-sm font-bold text-content dark:text-content-dark mb-3">
              {lang === 'ar' ? 'جاري الاستيراد...' : 'Importing...'}
            </p>
            <div className="w-full h-2 rounded-full bg-slate-200 dark:bg-white/10 overflow-hidden">
              <div className="h-full bg-brand-500 rounded-full transition-all duration-300" style={{ width: `${importProgress}%` }} />
            </div>
            <p className="m-0 text-xs text-content-muted dark:text-content-muted-dark mt-2">{importProgress}%</p>
          </div>
        )}

        {/* Step 5: Done */}
        {step === 'done' && importResult && (
          <div className="py-6">
            <div className="text-center mb-4">
              <div className="w-14 h-14 rounded-2xl bg-green-500/10 flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 size={24} className="text-green-500" />
              </div>
              <p className="m-0 text-sm font-bold text-content dark:text-content-dark mb-3">
                {lang === 'ar' ? 'تم الاستيراد' : 'Import Complete'}
              </p>
              <div className="flex justify-center gap-6 text-sm">
                <div>
                  <span className="font-bold text-green-500">{importResult.inserted}</span>
                  <span className="text-content-muted dark:text-content-muted-dark ms-1">{lang === 'ar' ? 'سجل تم إضافته' : 'records added'}</span>
                </div>
                <div>
                  <span className="font-bold text-brand-500">{importResult.matched}</span>
                  <span className="text-content-muted dark:text-content-muted-dark ms-1">{lang === 'ar' ? 'موظف متطابق' : 'matched'}</span>
                </div>
                {importResult.skipped > 0 && (
                  <div>
                    <span className="font-bold text-yellow-500">{importResult.skipped}</span>
                    <span className="text-content-muted dark:text-content-muted-dark ms-1">{lang === 'ar' ? 'لم يتطابق' : 'skipped'}</span>
                  </div>
                )}
                {importResult.failed > 0 && (
                  <div>
                    <span className="font-bold text-red-500">{importResult.failed}</span>
                    <span className="text-content-muted dark:text-content-muted-dark ms-1">{lang === 'ar' ? 'فشل' : 'failed'}</span>
                  </div>
                )}
              </div>
            </div>

            {importResult.savedFingerprints?.length > 0 && (
              <div className="bg-brand-500/5 border border-brand-500/20 rounded-xl p-3 mb-3">
                <p className="m-0 text-xs text-brand-600 dark:text-brand-400">
                  <Link2 size={12} className="inline me-1" />
                  {lang === 'ar'
                    ? `تم حفظ كود البصمة لـ ${importResult.savedFingerprints.length} موظف — المرة الجاية هيتعرف عليهم تلقائي`
                    : `Fingerprint ID saved for ${importResult.savedFingerprints.length} employees — they'll auto-match next time`}
                </p>
              </div>
            )}

            {importResult.unmatchedNames?.length > 0 && (
              <div className="bg-yellow-50 dark:bg-yellow-500/10 border border-yellow-200 dark:border-yellow-500/30 rounded-xl p-3">
                <p className="m-0 text-sm font-bold text-yellow-700 dark:text-yellow-300 mb-2">
                  <AlertCircle size={14} className="inline me-1" />
                  {lang === 'ar' ? 'موظفين لم يتم ربطهم:' : 'Unlinked employees:'}
                </p>
                <div className="max-h-32 overflow-auto">
                  {importResult.unmatchedNames.map((emp, idx) => (
                    <p key={idx} className="m-0 text-xs text-yellow-800 dark:text-yellow-200">
                      {emp.id} — {emp.name} ({emp.department})
                    </p>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <ModalFooter>
        {step === 'upload' && (
          <Button variant="secondary" onClick={handleClose}>
            {lang === 'ar' ? 'إلغاء' : 'Cancel'}
          </Button>
        )}
        {step === 'mapping' && (
          <>
            <Button variant="secondary" onClick={reset}>
              {lang === 'ar' ? 'رجوع' : 'Back'}
            </Button>
            <Button onClick={handleConfirmMapping}>
              {lang === 'ar'
                ? `تأكيد الربط (${Object.values(manualMapping).filter(Boolean).length + matched.length} موظف)`
                : `Confirm (${Object.values(manualMapping).filter(Boolean).length + matched.length} matched)`}
            </Button>
          </>
        )}
        {step === 'preview' && (
          <>
            <Button variant="secondary" onClick={reset}>
              {lang === 'ar' ? 'رجوع' : 'Back'}
            </Button>
            <Button onClick={() => {
              const monthName = MONTHS_AR[month - 1];
              const msg = lang === 'ar'
                ? `هيتم رفع ${totalMatchedRecords} سجل حضور لشهر ${monthName} ${year}.\n\nمتأكد إن الشهر صح؟`
                : `${totalMatchedRecords} records will be imported for ${monthName} ${year}.\n\nIs the month correct?`;
              if (window.confirm(msg)) handleImport();
            }} disabled={!matched.length}>
              {lang === 'ar' ? `استيراد ${totalMatchedRecords} سجل` : `Import ${totalMatchedRecords} records`}
            </Button>
          </>
        )}
        {step === 'done' && (
          <Button onClick={handleClose}>
            {lang === 'ar' ? 'تم' : 'Done'}
          </Button>
        )}
      </ModalFooter>
    </Modal>
  );
}
