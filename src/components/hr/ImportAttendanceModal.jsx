import { useState, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, ModalFooter, Button, Card } from '../ui';
import { Upload, FileSpreadsheet, CheckCircle2, AlertCircle, Users, Calendar, X } from 'lucide-react';
import supabase from '../../lib/supabase';

// ── Parse fingerprint Excel ──────────────────────────────────

const TIME_RE = /^(\d{1,2}):(\d{2})$/;

function isTimeValue(val) {
  if (!val) return false;
  return TIME_RE.test(String(val).trim());
}

function excelTimeToString(val) {
  // ExcelJS may return Date objects for time cells
  if (val instanceof Date) {
    const h = String(val.getHours()).padStart(2, '0');
    const m = String(val.getMinutes()).padStart(2, '0');
    return `${h}:${m}`;
  }
  if (typeof val === 'number' && val < 1) {
    // Excel time fraction (0.4375 = 10:30)
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
    // Use SheetJS (xlsx) for .xls files
    const XLSX = (await import('xlsx')).default || (await import('xlsx'));
    const wb = XLSX.read(buffer, { type: 'array' });
    const sheetName = wb.SheetNames[0];
    if (!sheetName) return { employees: [], errors: ['لا يوجد شيت في الملف'] };
    const ws = wb.Sheets[sheetName];
    const jsonData = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
    jsonData.forEach((row, idx) => {
      // Shift values to 1-indexed to match ExcelJS format
      const values = [null, ...row];
      rows.push({ rowNum: idx + 1, values });
    });
  } else {
    // Use ExcelJS for .xlsx files
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
    const firstCell = String(row.values[1] || '');

    // Detect employee header row: contains "رقم هوية" or "رقم" or ID-like pattern
    if (firstCell.includes('رقم هوية') || firstCell.includes('رقم') || firstCell.match(/^(No|ID|رقم)/i)) {
      const headerText = row.values.filter(Boolean).join(' ');
      const emp = parseEmployeeHeader(headerText);

      if (emp) {
        // Look for day numbers row and times row(s) below
        const dayRow = rows[i + 1];
        const timeRow = rows[i + 2];

        if (dayRow && timeRow) {
          const attendance = parseDayTimes(dayRow.values, timeRow.values, selectedMonth, selectedYear);

          // Check if there's a second time row (some exports split check-in/check-out)
          let timeRow2 = rows[i + 3];
          if (timeRow2 && !isEmployeeHeaderRow(String(timeRow2.values[1] || '')) && !isDayNumberRow(timeRow2.values)) {
            const extra = parseDayTimesSecondRow(dayRow.values, timeRow.values, timeRow2.values, selectedMonth, selectedYear);
            if (extra.length > 0) {
              attendance.length = 0;
              extra.forEach(r => attendance.push(r));
            }
          }

          employees.push({
            ...emp,
            attendance,
          });
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
  for (let c = 1; c < values.length; c++) {
    const v = Number(values[c]);
    if (v >= 1 && v <= 31) numCount++;
  }
  return numCount >= 15;
}

function parseEmployeeHeader(text) {
  // Format: "رقم هوية:12 الاسم:SaraRamadan القسم:مكتب فترة الدوام:فترة الدوام1"
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
  const dayMap = {}; // col index → day number

  // Map columns to day numbers
  for (let c = 1; c < dayValues.length; c++) {
    const v = Number(dayValues[c]);
    if (v >= 1 && v <= 31) dayMap[c] = v;
  }

  // Parse times — each day column may have "HH:MM" for check-in
  // and the next column has check-out, OR single cell has "HH:MM HH:MM"
  const dayCols = Object.keys(dayMap).map(Number).sort((a, b) => a - b);

  for (let d = 0; d < dayCols.length; d++) {
    const col = dayCols[d];
    const day = dayMap[col];
    const val = timeValues[col];

    if (!val) continue;

    const valStr = String(val).trim();

    // Try "HH:MM HH:MM" in single cell
    const parts = valStr.split(/\s+/);
    if (parts.length >= 2 && isTimeValue(parts[0]) && isTimeValue(parts[1])) {
      records.push({
        day,
        date: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
        check_in: parts[0],
        check_out: parts[1],
      });
      continue;
    }

    // Single time in this cell — check next cell for check-out
    const t1 = excelTimeToString(val);
    if (t1) {
      const nextCol = col + 1;
      const t2 = timeValues[nextCol] ? excelTimeToString(timeValues[nextCol]) : null;

      // If next column is NOT a day column, it's likely the check-out
      if (t2 && !dayMap[nextCol]) {
        records.push({
          day,
          date: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
          check_in: t1,
          check_out: t2,
        });
      } else {
        // Just check-in, no check-out
        records.push({
          day,
          date: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
          check_in: t1,
          check_out: null,
        });
      }
    }
  }

  return records;
}

function parseDayTimesSecondRow(dayValues, timeRow1, timeRow2, month, year) {
  // Format where row1 = check-in times, row2 = check-out times
  const records = [];
  const dayMap = {};

  for (let c = 1; c < dayValues.length; c++) {
    const v = Number(dayValues[c]);
    if (v >= 1 && v <= 31) dayMap[c] = v;
  }

  for (const [col, day] of Object.entries(dayMap)) {
    const c = Number(col);
    const t1 = excelTimeToString(timeRow1[c]);
    const t2 = excelTimeToString(timeRow2[c]);

    if (t1 || t2) {
      records.push({
        day,
        date: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
        check_in: t1 || null,
        check_out: t2 || null,
      });
    }
  }

  return records;
}

// ── Component ────────────────────────────────────────────────

export default function ImportAttendanceModal({ open, onClose, onImported }) {
  const { i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const lang = i18n.language;
  const fileRef = useRef(null);

  const [step, setStep] = useState('upload'); // upload | preview | importing | done
  const [file, setFile] = useState(null);
  const [month, setMonth] = useState(() => new Date().getMonth() + 1);
  const [year, setYear] = useState(() => new Date().getFullYear());
  const [parsed, setParsed] = useState(null);
  const [errors, setErrors] = useState([]);
  const [importProgress, setImportProgress] = useState(0);
  const [importResult, setImportResult] = useState(null);

  const MONTHS_AR = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];

  const handleFile = useCallback(async (f) => {
    if (!f) return;
    setFile(f);
    setStep('preview');
    setErrors([]);

    try {
      const result = await parseFingerPrintExcel(f, month, year);
      setParsed(result.employees);
      if (result.errors.length) setErrors(result.errors);
    } catch (err) {
      setErrors([`خطأ في قراءة الملف: ${err.message}`]);
      setParsed(null);
    }
  }, [month, year]);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  }, [handleFile]);

  const handleImport = useCallback(async () => {
    if (!parsed || !parsed.length) return;
    setStep('importing');
    setImportProgress(0);

    let inserted = 0;
    let skipped = 0;
    let failed = 0;
    const unmatchedNames = [];

    for (let i = 0; i < parsed.length; i++) {
      const emp = parsed[i];
      setImportProgress(Math.round(((i + 1) / parsed.length) * 100));

      // Try to find employee in Supabase by employee_number or name
      let employeeId = null;
      try {
        const { data } = await supabase
          .from('employees')
          .select('id, employee_number, full_name_ar, full_name_en')
          .or(`employee_number.eq.${emp.employee_id},full_name_en.ilike.%${emp.name}%,full_name_ar.ilike.%${emp.name}%`)
          .limit(1)
          .single();
        if (data) employeeId = data.id;
      } catch { /* no match */ }

      if (!employeeId) {
        skipped++;
        unmatchedNames.push({ id: emp.employee_id, name: emp.name, department: emp.department });
        continue;
      }

      // Insert attendance records
      for (const rec of emp.attendance) {
        try {
          const { error } = await supabase
            .from('attendance')
            .upsert({
              employee_id: employeeId,
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

    setImportResult({ inserted, skipped, failed, unmatchedNames });
    setStep('done');
    if (onImported) onImported();
  }, [parsed, onImported]);

  const reset = () => {
    setStep('upload');
    setFile(null);
    setParsed(null);
    setErrors([]);
    setImportProgress(0);
    setImportResult(null);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  if (!open) return null;

  const totalRecords = parsed ? parsed.reduce((s, e) => s + e.attendance.length, 0) : 0;

  return (
    <Modal open={open} onClose={handleClose} title={lang === 'ar' ? 'استيراد شيت البصمة' : 'Import Fingerprint Sheet'} size="lg">
      <div dir={isRTL ? 'rtl' : 'ltr'} className="space-y-4">

        {/* Month/Year selector */}
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

            {/* Drop zone */}
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

        {/* Preview */}
        {step === 'preview' && parsed && (
          <>
            <div className="flex items-center gap-2 mb-3">
              <FileSpreadsheet size={18} className="text-brand-500" />
              <span className="text-sm font-bold text-content dark:text-content-dark">{file?.name}</span>
              <button onClick={reset} className="ms-auto text-content-muted hover:text-red-500 transition-colors">
                <X size={16} />
              </button>
            </div>

            {/* Summary cards */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-brand-500/5 rounded-xl p-3 text-center">
                <Users size={18} className="text-brand-500 mx-auto mb-1" />
                <p className="m-0 text-lg font-bold text-content dark:text-content-dark">{parsed.length}</p>
                <p className="m-0 text-xs text-content-muted dark:text-content-muted-dark">{lang === 'ar' ? 'موظف' : 'Employees'}</p>
              </div>
              <div className="bg-brand-500/5 rounded-xl p-3 text-center">
                <Calendar size={18} className="text-brand-500 mx-auto mb-1" />
                <p className="m-0 text-lg font-bold text-content dark:text-content-dark">{totalRecords}</p>
                <p className="m-0 text-xs text-content-muted dark:text-content-muted-dark">{lang === 'ar' ? 'سجل حضور' : 'Records'}</p>
              </div>
              <div className="bg-brand-500/5 rounded-xl p-3 text-center">
                <Calendar size={18} className="text-brand-500 mx-auto mb-1" />
                <p className="m-0 text-lg font-bold text-content dark:text-content-dark">{MONTHS_AR[month - 1]} {year}</p>
                <p className="m-0 text-xs text-content-muted dark:text-content-muted-dark">{lang === 'ar' ? 'الشهر' : 'Month'}</p>
              </div>
            </div>

            {/* Employee preview table */}
            <div className="max-h-64 overflow-auto rounded-xl border border-edge dark:border-edge-dark">
              <table className="w-full text-sm">
                <thead className="bg-surface-bg dark:bg-surface-bg-dark sticky top-0">
                  <tr>
                    <th className="px-3 py-2 text-start text-xs font-bold text-content-muted dark:text-content-muted-dark">{lang === 'ar' ? 'الكود' : 'ID'}</th>
                    <th className="px-3 py-2 text-start text-xs font-bold text-content-muted dark:text-content-muted-dark">{lang === 'ar' ? 'الاسم' : 'Name'}</th>
                    <th className="px-3 py-2 text-start text-xs font-bold text-content-muted dark:text-content-muted-dark">{lang === 'ar' ? 'القسم' : 'Dept'}</th>
                    <th className="px-3 py-2 text-start text-xs font-bold text-content-muted dark:text-content-muted-dark">{lang === 'ar' ? 'الفترة' : 'Shift'}</th>
                    <th className="px-3 py-2 text-start text-xs font-bold text-content-muted dark:text-content-muted-dark">{lang === 'ar' ? 'أيام الحضور' : 'Days'}</th>
                  </tr>
                </thead>
                <tbody>
                  {parsed.map((emp, idx) => (
                    <tr key={idx} className="border-t border-edge dark:border-edge-dark">
                      <td className="px-3 py-2 text-content dark:text-content-dark font-mono">{emp.employee_id}</td>
                      <td className="px-3 py-2 text-content dark:text-content-dark font-medium">{emp.name}</td>
                      <td className="px-3 py-2 text-content-muted dark:text-content-muted-dark">{emp.department}</td>
                      <td className="px-3 py-2 text-content-muted dark:text-content-muted-dark">{emp.shift}</td>
                      <td className="px-3 py-2 font-bold text-brand-500">{emp.attendance.length}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* Importing progress */}
        {step === 'importing' && (
          <div className="text-center py-8">
            <div className="w-14 h-14 rounded-2xl bg-brand-500/10 flex items-center justify-center mx-auto mb-4 animate-pulse">
              <Upload size={24} className="text-brand-500" />
            </div>
            <p className="m-0 text-sm font-bold text-content dark:text-content-dark mb-3">
              {lang === 'ar' ? 'جاري الاستيراد...' : 'Importing...'}
            </p>
            <div className="w-full h-2 rounded-full bg-slate-200 dark:bg-white/10 overflow-hidden">
              <div
                className="h-full bg-brand-500 rounded-full transition-all duration-300"
                style={{ width: `${importProgress}%` }}
              />
            </div>
            <p className="m-0 text-xs text-content-muted dark:text-content-muted-dark mt-2">{importProgress}%</p>
          </div>
        )}

        {/* Done */}
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
                {importResult.skipped > 0 && (
                  <div>
                    <span className="font-bold text-yellow-500">{importResult.skipped}</span>
                    <span className="text-content-muted dark:text-content-muted-dark ms-1">{lang === 'ar' ? 'موظف لم يتطابق' : 'unmatched'}</span>
                  </div>
                )}
                {importResult.failed > 0 && (
                  <div>
                    <span className="font-bold text-red-500">{importResult.failed}</span>
                    <span className="text-content-muted dark:text-content-muted-dark ms-1">{lang === 'ar' ? 'سجل فشل' : 'failed'}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Unmatched employees list */}
            {importResult.unmatchedNames?.length > 0 && (
              <div className="mt-4 bg-yellow-50 dark:bg-yellow-500/10 border border-yellow-200 dark:border-yellow-500/30 rounded-xl p-3">
                <p className="m-0 text-sm font-bold text-yellow-700 dark:text-yellow-300 mb-2">
                  <AlertCircle size={14} className="inline me-1" />
                  {lang === 'ar' ? 'موظفين لم يتم التعرف عليهم (مش مسجلين على السيستم):' : 'Unmatched employees (not registered):'}
                </p>
                <div className="max-h-40 overflow-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-yellow-600 dark:text-yellow-400">
                        <th className="px-2 py-1 text-start font-semibold">{lang === 'ar' ? 'الكود' : 'ID'}</th>
                        <th className="px-2 py-1 text-start font-semibold">{lang === 'ar' ? 'الاسم' : 'Name'}</th>
                        <th className="px-2 py-1 text-start font-semibold">{lang === 'ar' ? 'القسم' : 'Dept'}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {importResult.unmatchedNames.map((emp, idx) => (
                        <tr key={idx} className="border-t border-yellow-200/50 dark:border-yellow-500/20">
                          <td className="px-2 py-1 text-yellow-800 dark:text-yellow-200 font-mono">{emp.id}</td>
                          <td className="px-2 py-1 text-yellow-800 dark:text-yellow-200">{emp.name}</td>
                          <td className="px-2 py-1 text-yellow-800 dark:text-yellow-200">{emp.department}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="m-0 text-xs text-yellow-600 dark:text-yellow-400 mt-2">
                  {lang === 'ar' ? 'سجل الموظفين دول من صفحة الموظفين الأول وبعدين ارفع الشيت تاني.' : 'Add these employees from the Employees page first, then re-import.'}
                </p>
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
        {step === 'preview' && (
          <>
            <Button variant="secondary" onClick={reset}>
              {lang === 'ar' ? 'رجوع' : 'Back'}
            </Button>
            <Button onClick={() => {
              const monthName = MONTHS_AR[month - 1];
              const msg = lang === 'ar'
                ? `هيتم رفع ${totalRecords} سجل حضور لشهر ${monthName} ${year}.\n\nمتأكد إن الشهر صح؟`
                : `${totalRecords} records will be imported for ${monthName} ${year}.\n\nAre you sure the month is correct?`;
              if (window.confirm(msg)) handleImport();
            }} disabled={!parsed?.length}>
              {lang === 'ar' ? `استيراد ${totalRecords} سجل` : `Import ${totalRecords} records`}
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
