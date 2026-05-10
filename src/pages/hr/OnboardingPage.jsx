import { useState, useMemo, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../contexts/ThemeContext';
import { useToast } from '../../contexts/ToastContext';
import { useAuditFilter } from '../../hooks/useAuditFilter';
import {
  UserPlus, CheckCircle2, Clock, AlertCircle, Plus,
  ChevronRight, UserCheck, Timer, CheckSquare, Square,
} from 'lucide-react';
import { KpiCard, SmartFilter, applySmartFilters, Pagination, PageSkeleton, Button, Modal, ModalFooter, Select } from '../../components/ui';
import {
  fetchOnboardingRecords,
  createOnboarding,
  toggleChecklistItem as svcToggle,
  DEFAULT_CHECKLIST,
} from '../../services/onboardingService';
import { fetchEmployees, fetchDepartments } from '../../services/employeesService';
import { useAuth } from '../../contexts/AuthContext';

/* ─── Checklist Template ─── */
const CHECKLIST_ITEMS = [
  { id: 'documents',       label_ar: 'تسليم المستندات',      label_en: 'Document Submission',      icon: '📄' },
  { id: 'it_setup',        label_ar: 'إعداد تكنولوجيا المعلومات', label_en: 'IT Setup',            icon: '💻' },
  { id: 'workspace',       label_ar: 'تخصيص مساحة العمل',    label_en: 'Workspace Assigned',       icon: '🏢' },
  { id: 'orientation',     label_ar: 'جلسة التوجيه',          label_en: 'Orientation Done',         icon: '🧭' },
  { id: 'team_intro',      label_ar: 'تعريف بالفريق',         label_en: 'Team Introduction',        icon: '🤝' },
  { id: 'policy_ack',      label_ar: 'الإقرار بالسياسات',      label_en: 'Policy Acknowledgment',    icon: '📋' },
  { id: 'training',        label_ar: 'بدء التدريب',           label_en: 'Training Started',         icon: '🎓' },
  { id: 'first_review',    label_ar: 'جدولة المراجعة الأولى',  label_en: 'First Review Scheduled',   icon: '📅' },
];

// Onboarding records now live in Supabase (employee_onboarding table).
// The localStorage helpers were removed — they leaked sensitive HR data
// to the browser and didn't sync across devices.

// Normalizes a joined Supabase row into the flat shape the rest of the
// page expects (employee_name_ar/en, mentor_name, department, etc).
function normalizeRecord(row, deptMap) {
  const emp = row.employee || {};
  const mentor = row.mentor || {};
  const dept = deptMap[emp.department_id];
  return {
    id: row.id,
    employee_id: row.employee_id,
    employee_name_ar: emp.full_name_ar || '',
    employee_name_en: emp.full_name_en || '',
    department: dept?.key || emp.department_id || '',
    department_label_ar: dept?.name_ar || '',
    department_label_en: dept?.name_en || '',
    position: emp.position || '',
    position_en: emp.position || '',
    start_date: row.start_date,
    target_completion_date: row.target_completion_date,
    mentor_name: mentor.full_name_ar || '',
    mentor_name_en: mentor.full_name_en || '',
    status: row.status,
    checklist: { ...DEFAULT_CHECKLIST, ...(row.checklist || {}) },
    notes: row.notes,
  };
}

// DEFAULT_ONBOARDING was 12 fabricated records — removed since real data
// now comes from the employee_onboarding table.

const STATUS_CONFIG = {
  in_progress: { ar: 'قيد التنفيذ', en: 'In Progress', color: '#6B8DB5' },
  completed:   { ar: 'مكتمل',      en: 'Completed',   color: '#4A7AAB' },
  not_started: { ar: 'لم يبدأ',     en: 'Not Started', color: '#EF4444' },
};

/* ─── Helper: compute progress ─── */
function getProgress(checklist) {
  const vals = Object.values(checklist);
  const done = vals.filter(Boolean).length;
  return { done, total: vals.length, pct: Math.round((done / vals.length) * 100) };
}

/* ─── Helper: derive status from checklist ─── */
function deriveStatus(checklist) {
  const vals = Object.values(checklist);
  if (vals.every(Boolean)) return 'completed';
  if (vals.some(Boolean)) return 'in_progress';
  return 'not_started';
}

/* ══════════════════════════════════════════════
   MAIN PAGE
══════════════════════════════════════════════ */
export default function OnboardingPage() {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const { i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const lang = i18n.language;
  const toast = useToast();

  const { profile } = useAuth();
  const [onboardingRecords, setOnboardingRecords] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(null);
  const [smartFilters, setSmartFilters] = useState([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const { auditFields, applyAuditFilters } = useAuditFilter('onboarding');

  // Add modal state
  const emptyForm = {
    employee_id: '',
    mentor_id: '',
    start_date: new Date().toISOString().slice(0, 10),
    target_completion_date: '',
    status: 'not_started',
    notes: '',
  };
  const [addOpen, setAddOpen] = useState(false);
  const [addForm, setAddForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  // Load from Supabase + departments + employees lookup
  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetchOnboardingRecords(),
      fetchDepartments(),
      fetchEmployees(),
    ])
      .then(([records, depts, emps]) => {
        if (cancelled) return;
        setOnboardingRecords(records || []);
        setDepartments(depts || []);
        setEmployees(emps || []);
      })
      .catch(err => {
        toast.error(isRTL ? 'فشل تحميل بيانات التهيئة' : 'Failed to load onboarding');
        if (import.meta.env.DEV) console.error(err);
      })
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
    // toast is omitted from deps — its identity changes on every render and
    // would create an infinite loop hammering Supabase.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openAdd = () => { setAddForm(emptyForm); setAddOpen(true); };
  const handleAdd = async () => {
    if (!addForm.employee_id || !addForm.start_date) {
      toast.error(isRTL ? 'الموظف وتاريخ البدء مطلوبان' : 'Employee and start date are required');
      return;
    }
    setSaving(true);
    try {
      const created = await createOnboarding({
        ...addForm,
        mentor_id: addForm.mentor_id || null,
        target_completion_date: addForm.target_completion_date || null,
        notes: addForm.notes || null,
        created_by: profile?.id || null,
      });
      setOnboardingRecords(prev => [created, ...prev]);
      setAddOpen(false);
      toast.success(isRTL ? 'تم بدء التهيئة' : 'Onboarding started');
    } catch (err) {
      // FK / unique-constraint errors get a nicer message
      const msg = /unique|duplicate/i.test(err?.message || '')
        ? (isRTL ? 'هذا الموظف لديه سجل تهيئة بالفعل' : 'This employee already has an onboarding record')
        : (isRTL ? 'فشل الحفظ' : 'Save failed');
      toast.error(msg);
      if (import.meta.env.DEV) console.error(err);
    } finally {
      setSaving(false);
    }
  };

  // Filter out employees who already have an onboarding record
  const availableEmployees = useMemo(() => {
    const taken = new Set(onboardingRecords.map(r => r.employee_id));
    return employees.filter(e => !taken.has(e.id) && (e.is_active !== false));
  }, [employees, onboardingRecords]);

  // Build dept lookup map keyed by id
  const deptMap = useMemo(() => {
    const map = {};
    for (const d of departments) {
      map[d.id] = { key: d.id, name_ar: d.name_ar, name_en: d.name_en };
    }
    return map;
  }, [departments]);

  // Toggle checklist item — writes through to DB
  const toggleChecklistItem = async (obId, itemKey) => {
    const ob = onboardingRecords.find(r => r.id === obId);
    if (!ob) return;
    // Optimistic update
    const newChecklist = { ...ob.checklist, [itemKey]: !ob.checklist?.[itemKey] };
    setOnboardingRecords(prev => prev.map(r => r.id === obId ? { ...r, checklist: newChecklist } : r));
    try {
      const updated = await svcToggle(obId, itemKey, ob.checklist || {});
      setOnboardingRecords(prev => prev.map(r => r.id === obId ? updated : r));
    } catch (err) {
      // Revert on failure
      setOnboardingRecords(prev => prev.map(r => r.id === obId ? ob : r));
      toast.error(isRTL ? 'فشل تحديث القائمة' : 'Failed to update checklist');
      if (import.meta.env.DEV) console.error(err);
    }
  };

  /* ─── Enrich data with normalized fields ─── */
  const enrichedData = useMemo(() => {
    return onboardingRecords.map(row => {
      const ob = normalizeRecord(row, deptMap);
      const { done, total, pct } = getProgress(ob.checklist);
      // Status comes from DB (kept in sync by service.toggleChecklistItem)
      return { ...ob, progress: pct, done, total };
    });
  }, [onboardingRecords, deptMap]);

  /* ─── Smart Filter fields ─── */
  const SMART_FIELDS = useMemo(() => {
    // Department options come from the live departments table (no more hardcoded list).
    const deptOptions = departments.map(d => ({
      value: d.id, label: d.name_ar || d.name_en, labelEn: d.name_en || d.name_ar,
    }));
    // Mentor options derive from records that actually have a mentor assigned.
    const mentorOptions = [...new Map(
      onboardingRecords
        .filter(r => r.mentor_id && r.mentor)
        .map(r => [r.mentor_id, r.mentor])
    ).values()].map(m => ({
      value: m.full_name_ar || m.full_name_en,
      label: m.full_name_ar || m.full_name_en,
      labelEn: m.full_name_en || m.full_name_ar,
    }));
    return [
      { id: 'department', label: 'القسم', labelEn: 'Department', type: 'select', options: deptOptions },
      {
        id: 'status', label: 'الحالة', labelEn: 'Status', type: 'select',
        options: Object.entries(STATUS_CONFIG).map(([val, cfg]) => ({
          value: val, label: cfg.ar, labelEn: cfg.en,
        })),
      },
      { id: 'start_date', label: 'تاريخ البدء', labelEn: 'Start Date', type: 'date' },
      { id: 'mentor_name', label: 'المرشد', labelEn: 'Mentor', type: 'select', options: mentorOptions },
      ...auditFields,
    ];
  }, [auditFields, departments, onboardingRecords]);

  /* ─── Filtering ─── */
  const filtered = useMemo(() => {
    let result = enrichedData;
    result = applySmartFilters(result, smartFilters, SMART_FIELDS);
    result = applyAuditFilters(result, smartFilters);
    return result;
  }, [enrichedData, smartFilters, SMART_FIELDS, applyAuditFilters]);

  /* ─── KPI stats ─── */
  const totalCount = filtered.length;
  const completedCount = filtered.filter(o => o.status === 'completed').length;
  const inProgressCount = filtered.filter(o => o.status === 'in_progress').length;

  // Avg completion time (days from start_date to today for completed)
  const avgCompletionDays = useMemo(() => {
    const completedItems = filtered.filter(o => o.status === 'completed');
    if (completedItems.length === 0) return 0;
    const today = new Date();
    const totalDays = completedItems.reduce((sum, o) => {
      const start = new Date(o.start_date);
      const days = Math.ceil((today - start) / 86400000);
      return sum + days;
    }, 0);
    return Math.round(totalDays / completedItems.length);
  }, [filtered]);

  /* ─── Pagination ─── */
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const paged = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);

  // Reset page on filter change
  useEffect(() => { setPage(1); }, [smartFilters]);

  if (loading) return (
    <div className="px-4 py-4 md:px-7 md:py-6">
      <PageSkeleton hasKpis kpiCount={4} tableRows={4} tableCols={3} />
    </div>
  );

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} className="px-4 py-4 md:px-7 md:py-6 bg-surface-bg dark:bg-surface-bg-dark min-h-screen">
      {/* ─── Header ─── */}
      <div className={`flex justify-between items-center mb-5 ${isRTL ? 'flex-row-reverse' : ''}`}>
        <div className={`flex items-center gap-3.5 ${isRTL ? 'flex-row-reverse' : ''}`}>
          <div className="w-10 h-10 rounded-xl bg-brand-500/[0.12] flex items-center justify-center">
            <UserPlus size={22} className="text-brand-500" />
          </div>
          <div className="text-start">
            <h1 className="m-0 text-xl font-bold text-content dark:text-content-dark">
              {lang === 'ar' ? 'استقبال الموظفين' : 'Employee Onboarding'}
            </h1>
            <p className="m-0 text-xs text-content-muted dark:text-content-muted-dark">
              {lang === 'ar' ? 'تتبع مسار استقبال الموظفين الجدد' : 'Track new employee onboarding progress'}
            </p>
          </div>
        </div>
        <Button size="md" onClick={openAdd}>
          <Plus size={16} />
          {lang === 'ar' ? 'بدء تهيئة موظف' : 'Start Onboarding'}
        </Button>
      </div>

      {/* ─── KPI Cards ─── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5 mb-5">
        <KpiCard icon={UserPlus}     label={lang === 'ar' ? 'إجمالي التهيئة' : 'Total Onboarding'}      value={totalCount}       color="#1B3347" />
        <KpiCard icon={Clock}        label={lang === 'ar' ? 'قيد التنفيذ' : 'In Progress'}              value={inProgressCount}   color="#6B8DB5" />
        <KpiCard icon={CheckCircle2} label={lang === 'ar' ? 'مكتمل' : 'Completed'}                      value={completedCount}    color="#4A7AAB" />
        <KpiCard icon={Timer}        label={lang === 'ar' ? 'متوسط مدة الإكمال' : 'Avg Completion Time'} value={`${avgCompletionDays} ${lang === 'ar' ? 'يوم' : 'days'}`} color="#1B3347" />
      </div>

      {/* ─── Smart Filter ─── */}
      <div className="mb-4">
        <SmartFilter
          fields={SMART_FIELDS}
          filters={smartFilters}
          onChange={setSmartFilters}
        />
      </div>

      {/* ─── Cards ─── */}
      <div className="flex flex-col gap-3">
        {paged.length === 0 ? (
          <div className="text-center py-16 px-5">
            <div className="w-16 h-16 rounded-2xl bg-brand-500/10 flex items-center justify-center mx-auto mb-4">
              <UserCheck size={24} color="#4A7AAB" />
            </div>
            <p className="m-0 mb-1.5 text-sm font-bold text-content dark:text-content-dark">
              {lang === 'ar' ? 'لا يوجد موظفون في التهيئة' : 'No Onboarding Employees'}
            </p>
            <p className="m-0 text-xs text-content-muted dark:text-content-muted-dark">
              {lang === 'ar' ? 'لم يتم العثور على نتائج مطابقة' : 'No matching results found'}
            </p>
          </div>
        ) : paged.map(ob => (
          <OnboardingCard
            key={ob.id}
            ob={ob}
            isExpanded={expanded === ob.id}
            isRTL={isRTL}
            lang={lang}
            isDark={isDark}
            onToggle={() => setExpanded(expanded === ob.id ? null : ob.id)}
            onChecklistToggle={(itemId) => toggleChecklistItem(ob.id, itemId)}
          />
        ))}
      </div>

      {/* ─── Pagination ─── */}
      {filtered.length > 0 && (
        <div className="mt-5">
          <Pagination
            page={safePage}
            totalPages={totalPages}
            onPageChange={setPage}
            pageSize={pageSize}
            onPageSizeChange={(sz) => { setPageSize(sz); setPage(1); }}
            totalItems={filtered.length}
            safePage={safePage}
          />
        </div>
      )}

      {/* ── Add Onboarding Modal ── */}
      <Modal open={addOpen} onClose={() => setAddOpen(false)} title={lang === 'ar' ? 'بدء تهيئة موظف' : 'Start Onboarding'}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <div className="sm:col-span-2">
            <label className="block text-xs text-content-muted dark:text-content-muted-dark mb-1">{lang === 'ar' ? 'الموظف' : 'Employee'} *</label>
            <Select value={addForm.employee_id} onChange={e => setAddForm(f => ({ ...f, employee_id: e.target.value }))}>
              <option value="">{lang === 'ar' ? 'اختر موظف' : 'Select employee'}</option>
              {availableEmployees.map(emp => (
                <option key={emp.id} value={emp.id}>
                  {(isRTL ? emp.full_name_ar : emp.full_name_en) || emp.full_name_ar}
                  {emp.employee_id ? ` (${emp.employee_id})` : ''}
                </option>
              ))}
            </Select>
            {availableEmployees.length === 0 && (
              <p className="m-0 mt-1 text-[11px] text-content-muted dark:text-content-muted-dark">
                {isRTL ? 'كل الموظفين النشطين عندهم سجل تهيئة بالفعل' : 'All active employees already have an onboarding record'}
              </p>
            )}
          </div>

          <div>
            <label className="block text-xs text-content-muted dark:text-content-muted-dark mb-1">{lang === 'ar' ? 'المرشد' : 'Mentor'}</label>
            <Select value={addForm.mentor_id} onChange={e => setAddForm(f => ({ ...f, mentor_id: e.target.value }))}>
              <option value="">{lang === 'ar' ? 'بدون مرشد' : 'No mentor'}</option>
              {employees
                .filter(e => e.id !== addForm.employee_id && e.is_active !== false)
                .map(emp => (
                  <option key={emp.id} value={emp.id}>
                    {(isRTL ? emp.full_name_ar : emp.full_name_en) || emp.full_name_ar}
                  </option>
                ))}
            </Select>
          </div>

          <div>
            <label className="block text-xs text-content-muted dark:text-content-muted-dark mb-1">{lang === 'ar' ? 'تاريخ البدء' : 'Start Date'} *</label>
            <input
              type="date"
              value={addForm.start_date}
              onChange={e => setAddForm(f => ({ ...f, start_date: e.target.value }))}
              className="w-full px-3 py-2 rounded-xl border border-edge dark:border-edge-dark bg-surface-card dark:bg-surface-card-dark text-content dark:text-content-dark text-sm"
            />
          </div>

          <div>
            <label className="block text-xs text-content-muted dark:text-content-muted-dark mb-1">{lang === 'ar' ? 'تاريخ الإكمال المستهدف' : 'Target Completion'}</label>
            <input
              type="date"
              value={addForm.target_completion_date}
              onChange={e => setAddForm(f => ({ ...f, target_completion_date: e.target.value }))}
              className="w-full px-3 py-2 rounded-xl border border-edge dark:border-edge-dark bg-surface-card dark:bg-surface-card-dark text-content dark:text-content-dark text-sm"
            />
          </div>

          <div>
            <label className="block text-xs text-content-muted dark:text-content-muted-dark mb-1">{lang === 'ar' ? 'الحالة الابتدائية' : 'Initial Status'}</label>
            <Select value={addForm.status} onChange={e => setAddForm(f => ({ ...f, status: e.target.value }))}>
              <option value="not_started">{lang === 'ar' ? 'لم يبدأ' : 'Not Started'}</option>
              <option value="in_progress">{lang === 'ar' ? 'قيد التنفيذ' : 'In Progress'}</option>
            </Select>
          </div>

          <div className="sm:col-span-2">
            <label className="block text-xs text-content-muted dark:text-content-muted-dark mb-1">{lang === 'ar' ? 'ملاحظات' : 'Notes'}</label>
            <textarea
              rows={2}
              value={addForm.notes}
              onChange={e => setAddForm(f => ({ ...f, notes: e.target.value }))}
              className="w-full px-3 py-2 rounded-xl border border-edge dark:border-edge-dark bg-surface-card dark:bg-surface-card-dark text-content dark:text-content-dark text-sm resize-none"
            />
          </div>
        </div>

        <ModalFooter>
          <Button variant="secondary" onClick={() => setAddOpen(false)}>{lang === 'ar' ? 'إلغاء' : 'Cancel'}</Button>
          <Button onClick={handleAdd} disabled={saving || !addForm.employee_id || !addForm.start_date}>
            {saving ? (lang === 'ar' ? 'جاري الحفظ...' : 'Saving...') : (lang === 'ar' ? 'بدء التهيئة' : 'Start')}
          </Button>
        </ModalFooter>
      </Modal>
    </div>
  );
}

/* ══════════════════════════════════════════════
   ONBOARDING CARD
══════════════════════════════════════════════ */
function OnboardingCard({ ob, isExpanded, isRTL, lang, isDark, onToggle, onChecklistToggle }) {
  const [hov, setHov] = useState(false);
  const name = (isRTL ? ob.employee_name_ar : ob.employee_name_en) || ob.employee_name_ar || ob.employee_name_en || '—';
  const initials = name?.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase() || '??';
  const { pct, done, total } = getProgress(ob.checklist);
  const statusCfg = STATUS_CONFIG[ob.status] || STATUS_CONFIG.not_started;
  const deptLabel = (isRTL ? ob.department_label_ar : ob.department_label_en) || ob.department || '—';
  const mentorLabel = (isRTL ? ob.mentor_name : ob.mentor_name_en) || '—';
  const positionLabel = ob.position || '—';

  return (
    <div
      className="bg-surface-card dark:bg-surface-card-dark rounded-xl border border-edge dark:border-edge-dark overflow-hidden transition-all duration-200"
      style={{
        borderColor: hov || isExpanded ? 'rgba(74,122,171,0.25)' : undefined,
        boxShadow: isExpanded ? '0 4px 16px rgba(74,122,171,0.12)' : 'none',
      }}
    >
      {/* ─── Card Header (clickable) ─── */}
      <div
        onMouseEnter={() => setHov(true)}
        onMouseLeave={() => setHov(false)}
        onClick={onToggle}
        className={`px-5 py-4 cursor-pointer flex justify-between items-center ${isRTL ? 'flex-row-reverse' : ''}`}
      >
        <div className={`flex items-center gap-3 flex-1 min-w-0 ${isRTL ? 'flex-row-reverse' : ''}`}>
          {/* Avatar */}
          <div className="w-[42px] h-[42px] rounded-xl bg-gradient-to-br from-brand-900 to-brand-500 flex items-center justify-center shrink-0">
            <span className="text-xs font-bold text-white">{initials}</span>
          </div>
          {/* Info */}
          <div className="text-start min-w-0 flex-1">
            <div className={`flex items-center gap-2 flex-wrap ${isRTL ? 'flex-row-reverse' : ''}`}>
              <p className="m-0 text-sm font-bold text-content dark:text-content-dark truncate">{name}</p>
              <span
                className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold shrink-0"
                style={{ background: statusCfg.color + '18', color: statusCfg.color, border: `1px solid ${statusCfg.color}35` }}
              >
                {lang === 'ar' ? statusCfg.ar : statusCfg.en}
              </span>
            </div>
            <div className={`flex items-center gap-3 mt-0.5 flex-wrap ${isRTL ? 'flex-row-reverse' : ''}`}>
              <p className="m-0 text-xs text-content-muted dark:text-content-muted-dark">{positionLabel}</p>
              <span className="text-content-muted dark:text-content-muted-dark text-[8px]">|</span>
              <p className="m-0 text-xs text-content-muted dark:text-content-muted-dark">{deptLabel}</p>
              <span className="text-content-muted dark:text-content-muted-dark text-[8px]">|</span>
              <p className="m-0 text-xs text-content-muted dark:text-content-muted-dark">
                {lang === 'ar' ? 'المرشد:' : 'Mentor:'} {mentorLabel}
              </p>
            </div>
          </div>
        </div>

        {/* Right side: progress */}
        <div className={`flex items-center gap-4 shrink-0 ${isRTL ? 'flex-row-reverse' : ''}`}>
          <div className="hidden sm:block text-center">
            <p className="m-0 text-xs text-content-muted dark:text-content-muted-dark mb-0.5">
              {lang === 'ar' ? 'بدأ:' : 'Started:'} {ob.start_date}
            </p>
          </div>
          <div className="text-center" style={{ minWidth: 48 }}>
            <p className="m-0 text-xl font-bold" style={{ color: statusCfg.color }}>{pct}%</p>
            <p className="m-0 text-[10px] text-content-muted dark:text-content-muted-dark">{done}/{total}</p>
          </div>
          <div className="w-20 h-2 rounded-full bg-gray-200 dark:bg-white/[0.08]">
            <div
              className="h-full rounded-full transition-[width] duration-500"
              style={{
                width: pct + '%',
                background: pct === 100 ? '#4A7AAB' : pct >= 50 ? '#6B8DB5' : statusCfg.color,
              }}
            />
          </div>
          <div className={`text-content-muted dark:text-content-muted-dark transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''} ${isRTL && !isExpanded ? 'rotate-180' : ''}`}>
            <ChevronRight size={16} />
          </div>
        </div>
      </div>

      {/* ─── Expanded Checklist ─── */}
      {isExpanded && (
        <div className="px-5 pb-5 pt-4 border-t border-edge dark:border-edge-dark">
          {/* Mobile start date */}
          <p className="sm:hidden m-0 mb-3 text-xs text-content-muted dark:text-content-muted-dark">
            {lang === 'ar' ? 'تاريخ البدء:' : 'Start Date:'} {ob.start_date}
          </p>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {CHECKLIST_ITEMS.map(item => {
              const checked = ob.checklist[item.id] || false;
              return (
                <div
                  key={item.id}
                  onClick={(e) => { e.stopPropagation(); onChecklistToggle(item.id); }}
                  className={`px-3.5 py-3 rounded-xl border cursor-pointer transition-all duration-150 hover:scale-[1.02] ${
                    checked
                      ? 'border-brand-500/25 bg-brand-500/[0.08]'
                      : 'border-edge dark:border-edge-dark bg-transparent hover:border-brand-500/15'
                  }`}
                >
                  <div className={`flex items-start gap-2.5 ${isRTL ? 'flex-row-reverse' : ''}`}>
                    <div className="mt-0.5 shrink-0">
                      {checked
                        ? <CheckSquare size={16} color="#4A7AAB" />
                        : <Square size={16} className="text-content-muted dark:text-content-muted-dark" />
                      }
                    </div>
                    <div className="text-start flex-1">
                      <div className="text-base mb-0.5">{item.icon}</div>
                      <p className={`m-0 text-xs font-semibold ${checked ? 'text-content dark:text-content-dark' : 'text-content-muted dark:text-content-muted-dark'}`}>
                        {lang === 'ar' ? item.label_ar : item.label_en}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
