import supabase from '../../lib/supabase';
import { reportError } from '../../utils/errorReporter';
import { useState, useEffect, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { fetchEmployees } from '../../services/employeesService';
import { logAction } from '../../services/auditService';
import { useAuditFilter } from '../../hooks/useAuditFilter';
import { Shield, AlertTriangle, XCircle, CheckCircle2, Plus, ShieldAlert, Edit2, Trash2 } from 'lucide-react';
import { Button, Card, KpiCard, Table, Th, Tr, Td, PageSkeleton, ExportButton, SmartFilter, applySmartFilters, Pagination, Modal, ModalFooter, Select } from '../../components/ui';

const TABLE = 'disciplinary';

/* ─── Dynamic Badge ─── */
function DynBadge({ label, color = '#4A7AAB' }) {
  return (
    <span
      className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold"
      style={{ background: color + '18', color, border: `1px solid ${color}35` }}
    >
      {label}
    </span>
  );
}

export default function DisciplinaryPage() {
  const { i18n } = useTranslation();
  const { profile } = useAuth();
  const isRTL = i18n.language==='ar'; const lang = i18n.language;

  // Disciplinary records are confidential — only admin and HR may view.
  if (profile && !['admin', 'hr'].includes(profile.role)) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-lg font-bold text-content dark:text-content-dark">
          {isRTL ? 'غير مصرح' : 'Unauthorized'}
        </p>
      </div>
    );
  }

  const toast = useToast();
  const userName = profile?.full_name_ar || profile?.full_name_en || '';

  const [cases, setCases] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [smartFilters, setSmartFilters] = useState([]);
  const [search, setSearch] = useState('');

  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCase, setEditingCase] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [saving, setSaving] = useState(false);

  const emptyForm = {
    emp_id: '',
    type: 'warning',
    reason: '',
    date: new Date().toISOString().slice(0, 10),
    severity: 'low',
    status: 'open',
    notes: '',
  };
  const [form, setForm] = useState(emptyForm);

  // Fetch cases from Supabase on mount. No auto-seeding — disciplinary
  // records about real-looking employee IDs are unsafe to inject into a
  // fresh production DB.
  const fetchCases = useCallback(async () => {
    try {
      const { data, error } = await supabase.from(TABLE).select('*').order('created_at', { ascending: false });
      if (error) throw error;
      setCases(data || []);
    } catch (err) {
      reportError(`supabase.${TABLE}`, 'fetch', err);
    }
  }, []);

  useEffect(() => {
    Promise.all([
      fetchCases(),
      fetchEmployees().then(data => setEmployees(data)),
    ]).finally(() => setLoading(false));
  }, [fetchCases]);

  const { auditFields, applyAuditFilters } = useAuditFilter('disciplinary');

  const SMART_FIELDS = useMemo(() => [
    {
      id: 'type', label: 'النوع', labelEn: 'Type', type: 'select',
      options: [
        { value: 'warning', label: 'إنذار', labelEn: 'Warning' },
        { value: 'suspension', label: 'إيقاف', labelEn: 'Suspension' },
        { value: 'termination', label: 'فصل', labelEn: 'Termination' },
      ],
    },
    {
      id: 'severity', label: 'الخطورة', labelEn: 'Severity', type: 'select',
      options: [
        { value: 'high', label: 'عالي', labelEn: 'High' },
        { value: 'medium', label: 'متوسط', labelEn: 'Medium' },
        { value: 'low', label: 'منخفض', labelEn: 'Low' },
      ],
    },
    {
      id: 'status', label: 'الحالة', labelEn: 'Status', type: 'select',
      options: [
        { value: 'open', label: 'مفتوح', labelEn: 'Open' },
        { value: 'closed', label: 'مغلق', labelEn: 'Closed' },
      ],
    },
    { id: 'date', label: 'التاريخ', labelEn: 'Date', type: 'date' },
    ...auditFields,
  ], [auditFields]);

  const filtered = useMemo(() => {
    let result = cases;

    // Apply smart filters
    result = applySmartFilters(result, smartFilters, SMART_FIELDS);
    result = applyAuditFilters(result, smartFilters);

    // Apply search
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(c => {
        const emp = employees.find(e => e.employee_id === c.emp_id || e.id === c.emp_id);
        const name = emp ? ((isRTL ? emp.full_name_ar : emp.full_name_en) || emp.full_name_ar) : c.emp_id;
        return name.toLowerCase().includes(q) || (c.reason || '').toLowerCase().includes(q) || (c.emp_id || '').toLowerCase().includes(q);
      });
    }

    return result;
  }, [cases, smartFilters, SMART_FIELDS, search, employees, isRTL]);

  const open   = filtered.filter(c=>c.status==='open').length;
  const closed = filtered.filter(c=>c.status==='closed').length;
  const high   = filtered.filter(c=>c.severity==='high').length;

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const paged = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);
  useEffect(() => { if (page > totalPages) setPage(totalPages); }, [page, totalPages]);
  useEffect(() => { setPage(1); }, [search, smartFilters]);

  const severityColor = s => s==='high'?'#EF4444':s==='medium'?'#6B8DB5':'#4A7AAB';
  const severityLabel = (s,lang) => ({ high:lang==='ar'?'عالي':'High', medium:lang==='ar'?'متوسط':'Medium', low:lang==='ar'?'منخفض':'Low' }[s]||s);
  const typeLabel     = (t,lang) => ({ warning:lang==='ar'?'إنذار':'Warning', suspension:lang==='ar'?'إيقاف':'Suspension', termination:lang==='ar'?'فصل':'Termination' }[t]||t);
  const statusLabel   = (s,lang) => ({ open:lang==='ar'?'مفتوح':'Open', closed:lang==='ar'?'مغلق':'Closed' }[s]||s);

  const openNew = () => {
    setEditingCase(null);
    setForm(emptyForm);
    setModalOpen(true);
  };
  const openEdit = (cas) => {
    setEditingCase(cas);
    setForm({
      emp_id: cas.emp_id || '',
      type: cas.type || 'warning',
      reason: cas.reason || '',
      date: cas.date || new Date().toISOString().slice(0, 10),
      severity: cas.severity || 'low',
      status: cas.status || 'open',
      notes: cas.notes || '',
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.emp_id || !form.reason.trim()) {
      toast.error(lang === 'ar' ? 'يجب اختيار الموظف وكتابة السبب' : 'Employee and reason are required');
      return;
    }
    setSaving(true);
    try {
      if (editingCase) {
        const { data, error } = await supabase
          .from(TABLE)
          .update({ ...form, updated_at: new Date().toISOString() })
          .eq('id', editingCase.id)
          .select('*')
          .single();
        if (error) throw error;
        setCases(prev => prev.map(c => c.id === editingCase.id ? data : c));
        logAction({
          action: 'update', entity: 'disciplinary', entityId: editingCase.id,
          entityName: form.emp_id, description: `Updated disciplinary case: ${form.reason}`,
          oldValue: JSON.stringify(editingCase), newValue: JSON.stringify(data), userName,
        });
        toast.success(lang === 'ar' ? 'تم حفظ التعديلات' : 'Case updated');
      } else {
        const { data, error } = await supabase
          .from(TABLE)
          .insert([{ ...form, created_at: new Date().toISOString() }])
          .select('*')
          .single();
        if (error) throw error;
        setCases(prev => [data, ...prev]);
        logAction({
          action: 'create', entity: 'disciplinary', entityId: data.id,
          entityName: form.emp_id, description: `Created disciplinary case: ${form.reason}`,
          newValue: JSON.stringify(data), userName,
        });
        toast.success(lang === 'ar' ? 'تم إضافة الحالة' : 'Case created');
      }
      setModalOpen(false);
    } catch (err) {
      toast.error(lang === 'ar' ? 'فشل الحفظ' : 'Save failed');
      reportError(`supabase.${TABLE}`, 'save', err);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      const { error } = await supabase.from(TABLE).delete().eq('id', deleteTarget.id);
      if (error) throw error;
      setCases(prev => prev.filter(c => c.id !== deleteTarget.id));
      logAction({
        action: 'delete', entity: 'disciplinary', entityId: deleteTarget.id,
        entityName: deleteTarget.emp_id, description: `Deleted disciplinary case: ${deleteTarget.reason}`,
        oldValue: JSON.stringify(deleteTarget), userName,
      });
      toast.success(lang === 'ar' ? 'تم الحذف' : 'Deleted');
    } catch (err) {
      toast.error(lang === 'ar' ? 'فشل الحذف' : 'Delete failed');
      reportError(`supabase.${TABLE}`, 'delete', err);
    } finally {
      setDeleteTarget(null);
    }
  };

  if (loading) return (
    <div className="px-4 py-4 md:px-7 md:py-6">
      <PageSkeleton hasKpis kpiCount={4} tableRows={4} tableCols={6} />
    </div>
  );

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} className="px-4 py-4 md:px-7 md:py-6 bg-surface-bg dark:bg-surface-bg-dark min-h-screen">
      <div className={`flex flex-wrap justify-between items-center gap-3 mb-5 ${isRTL ? 'flex-row-reverse' : ''}`}>
        <div className={`flex items-center gap-3.5 ${isRTL ? 'flex-row-reverse' : ''}`}>
          <div className="w-10 h-10 rounded-xl bg-brand-500/[0.12] flex items-center justify-center">
            <Shield size={22} className="text-brand-500" />
          </div>
          <div className={'text-start'}>
            <h1 className="m-0 text-xl font-bold text-content dark:text-content-dark">{lang==='ar'?'الشؤون التأديبية':'Disciplinary'}</h1>
            <p className="m-0 text-xs text-content-muted dark:text-content-muted-dark">{lang==='ar'?'إدارة الحالات التأديبية':'Manage disciplinary cases'}</p>
          </div>
        </div>
        <div className={`flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : 'flex-row'}`}>
          <ExportButton
            data={cases}
            filename={isRTL ? 'الشؤون_التأديبية' : 'disciplinary'}
            title={isRTL ? 'الشؤون التأديبية' : 'Disciplinary Cases'}
            columns={[
              { header: isRTL ? 'رقم الموظف' : 'Employee ID', key: 'emp_id' },
              { header: isRTL ? 'النوع' : 'Type', key: r => typeLabel(r.type, lang) },
              { header: isRTL ? 'السبب' : 'Reason', key: 'reason' },
              { header: isRTL ? 'التاريخ' : 'Date', key: 'date' },
              { header: isRTL ? 'الخطورة' : 'Severity', key: r => severityLabel(r.severity, lang) },
              { header: isRTL ? 'الحالة' : 'Status', key: r => statusLabel(r.status, lang) },
            ]}
          />
          <Button size="md" onClick={openNew}>
            <Plus size={16} />{lang==='ar'?'+ حالة جديدة':'+ New Case'}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5 mb-5">
        <KpiCard icon={Shield}       label={lang==='ar'?'إجمالي الحالات':'Total Cases'} value={filtered.length} color="#1B3347" />
        <KpiCard icon={AlertTriangle} label={lang==='ar'?'مفتوحة':'Open'}           value={open}         color="#6B8DB5" />
        <KpiCard icon={XCircle}      label={lang==='ar'?'خطورة عالية':'High Severity'} value={high}         color="#EF4444" />
        <KpiCard icon={CheckCircle2} label={lang==='ar'?'مغلقة':'Closed'}          value={closed}       color="#4A7AAB" />
      </div>

      <SmartFilter
        fields={SMART_FIELDS}
        filters={smartFilters}
        onFiltersChange={setSmartFilters}
      />

      <Card className="!rounded-xl overflow-hidden">
        <div className="px-4 py-3.5 border-b border-edge dark:border-edge-dark">
          <p className="m-0 text-sm font-bold text-content dark:text-content-dark">{lang==='ar'?'سجل الحالات':'Cases Log'}</p>
        </div>
        <Table>
          <thead>
            <tr>
              {[lang==='ar'?'الموظف':'Employee', lang==='ar'?'النوع':'Type', lang==='ar'?'السبب':'Reason', lang==='ar'?'التاريخ':'Date', lang==='ar'?'الخطورة':'Severity', lang==='ar'?'الحالة':'Status', ''].map((h,i)=>(
                <Th key={i}>{h}</Th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7}>
                  <div className="text-center py-16 px-5">
                    <div className="w-16 h-16 rounded-2xl bg-brand-500/10 flex items-center justify-center mx-auto mb-4">
                      <ShieldAlert size={24} color="#4A7AAB" />
                    </div>
                    <p className="m-0 mb-1.5 text-sm font-bold text-content dark:text-content-dark">{lang==='ar'?'لا توجد مخالفات تأديبية':'No Disciplinary Records'}</p>
                    <p className="m-0 text-xs text-content-muted dark:text-content-muted-dark">{lang==='ar'?'لم يتم تسجيل أي مخالفات':'No disciplinary records found'}</p>
                  </div>
                </td>
              </tr>
            ) : paged.map(cas => {
              const emp = employees.find(e=>e.employee_id===cas.emp_id||e.id===cas.emp_id);
              const name = emp ? ((isRTL?emp.full_name_ar:emp.full_name_en)||emp.full_name_ar) : cas.emp_id;
              return (
                <Tr key={cas.id}>
                  <Td className="font-semibold">{name}</Td>
                  <Td><DynBadge label={typeLabel(cas.type,lang)} color="#4A7AAB" /></Td>
                  <Td className="text-content-muted dark:text-content-muted-dark">{cas.reason}</Td>
                  <Td className="text-content-muted dark:text-content-muted-dark">{cas.date}</Td>
                  <Td><DynBadge label={severityLabel(cas.severity,lang)} color={severityColor(cas.severity)} /></Td>
                  <Td><DynBadge label={statusLabel(cas.status,lang)} color={cas.status==='open'?'#6B8DB5':'#4A7AAB'} /></Td>
                  <Td>
                    <div className={`flex items-center gap-1.5 ${isRTL ? 'flex-row-reverse' : ''}`}>
                      <button
                        onClick={() => openEdit(cas)}
                        title={lang === 'ar' ? 'تعديل' : 'Edit'}
                        className="p-1.5 rounded-lg text-content-muted hover:bg-brand-500/10 hover:text-brand-500 transition-colors"
                      >
                        <Edit2 size={15} />
                      </button>
                      <button
                        onClick={() => setDeleteTarget(cas)}
                        title={lang === 'ar' ? 'حذف' : 'Delete'}
                        className="p-1.5 rounded-lg text-content-muted hover:bg-red-500/10 hover:text-red-500 transition-colors"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </Td>
                </Tr>
              );
            })}
          </tbody>
        </Table>
        <Pagination page={safePage} totalPages={totalPages} onPageChange={setPage} pageSize={pageSize} onPageSizeChange={(s) => { setPageSize(s); setPage(1); }} totalItems={filtered.length} />
      </Card>

      {/* ── Add / Edit Modal ── */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingCase
          ? (lang === 'ar' ? 'تعديل الحالة' : 'Edit Case')
          : (lang === 'ar' ? 'حالة تأديبية جديدة' : 'New Disciplinary Case')}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <div className="sm:col-span-2">
            <label className="block text-xs text-content-muted dark:text-content-muted-dark mb-1">
              {lang === 'ar' ? 'الموظف' : 'Employee'} *
            </label>
            <Select value={form.emp_id} onChange={e => setForm(f => ({ ...f, emp_id: e.target.value }))}>
              <option value="">{lang === 'ar' ? 'اختر موظف' : 'Select employee'}</option>
              {employees.map(emp => (
                <option key={emp.id} value={emp.employee_id || emp.id}>
                  {(isRTL ? emp.full_name_ar : emp.full_name_en) || emp.full_name_ar}
                  {emp.employee_id ? ` (${emp.employee_id})` : ''}
                </option>
              ))}
            </Select>
          </div>

          <div>
            <label className="block text-xs text-content-muted dark:text-content-muted-dark mb-1">
              {lang === 'ar' ? 'النوع' : 'Type'}
            </label>
            <Select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
              <option value="warning">{lang === 'ar' ? 'إنذار' : 'Warning'}</option>
              <option value="suspension">{lang === 'ar' ? 'إيقاف' : 'Suspension'}</option>
              <option value="termination">{lang === 'ar' ? 'فصل' : 'Termination'}</option>
            </Select>
          </div>

          <div>
            <label className="block text-xs text-content-muted dark:text-content-muted-dark mb-1">
              {lang === 'ar' ? 'الخطورة' : 'Severity'}
            </label>
            <Select value={form.severity} onChange={e => setForm(f => ({ ...f, severity: e.target.value }))}>
              <option value="low">{lang === 'ar' ? 'منخفض' : 'Low'}</option>
              <option value="medium">{lang === 'ar' ? 'متوسط' : 'Medium'}</option>
              <option value="high">{lang === 'ar' ? 'عالي' : 'High'}</option>
            </Select>
          </div>

          <div>
            <label className="block text-xs text-content-muted dark:text-content-muted-dark mb-1">
              {lang === 'ar' ? 'التاريخ' : 'Date'}
            </label>
            <input
              type="date"
              value={form.date}
              onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
              className="w-full px-3 py-2 rounded-xl border border-edge dark:border-edge-dark bg-surface-card dark:bg-surface-card-dark text-content dark:text-content-dark text-sm"
            />
          </div>

          <div>
            <label className="block text-xs text-content-muted dark:text-content-muted-dark mb-1">
              {lang === 'ar' ? 'الحالة' : 'Status'}
            </label>
            <Select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
              <option value="open">{lang === 'ar' ? 'مفتوح' : 'Open'}</option>
              <option value="closed">{lang === 'ar' ? 'مغلق' : 'Closed'}</option>
            </Select>
          </div>

          <div className="sm:col-span-2">
            <label className="block text-xs text-content-muted dark:text-content-muted-dark mb-1">
              {lang === 'ar' ? 'السبب' : 'Reason'} *
            </label>
            <input
              value={form.reason}
              onChange={e => setForm(f => ({ ...f, reason: e.target.value }))}
              className="w-full px-3 py-2 rounded-xl border border-edge dark:border-edge-dark bg-surface-card dark:bg-surface-card-dark text-content dark:text-content-dark text-sm"
              placeholder={lang === 'ar' ? 'مثال: تأخير متكرر' : 'e.g. Repeated tardiness'}
            />
          </div>

          <div className="sm:col-span-2">
            <label className="block text-xs text-content-muted dark:text-content-muted-dark mb-1">
              {lang === 'ar' ? 'ملاحظات' : 'Notes'}
            </label>
            <textarea
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              rows={3}
              className="w-full px-3 py-2 rounded-xl border border-edge dark:border-edge-dark bg-surface-card dark:bg-surface-card-dark text-content dark:text-content-dark text-sm resize-none"
            />
          </div>
        </div>

        <ModalFooter>
          <Button variant="secondary" onClick={() => setModalOpen(false)}>
            {lang === 'ar' ? 'إلغاء' : 'Cancel'}
          </Button>
          <Button onClick={handleSave} disabled={saving || !form.emp_id || !form.reason.trim()}>
            {saving ? (lang === 'ar' ? 'جاري الحفظ...' : 'Saving...') : (lang === 'ar' ? 'حفظ' : 'Save')}
          </Button>
        </ModalFooter>
      </Modal>

      {/* ── Delete Confirm Modal ── */}
      <Modal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title={lang === 'ar' ? 'تأكيد الحذف' : 'Confirm Delete'}
      >
        <p className="text-sm text-content dark:text-content-dark mb-2">
          {lang === 'ar'
            ? `هل أنت متأكد من حذف هذه الحالة التأديبية؟ لا يمكن التراجع عن هذا الإجراء.`
            : 'Are you sure you want to delete this disciplinary case? This action cannot be undone.'}
        </p>
        {deleteTarget && (
          <p className="text-xs text-content-muted dark:text-content-muted-dark">
            {deleteTarget.emp_id} — {deleteTarget.reason}
          </p>
        )}
        <ModalFooter>
          <Button variant="secondary" onClick={() => setDeleteTarget(null)}>
            {lang === 'ar' ? 'إلغاء' : 'Cancel'}
          </Button>
          <Button variant="danger" onClick={handleDelete}>
            {lang === 'ar' ? 'حذف' : 'Delete'}
          </Button>
        </ModalFooter>
      </Modal>
    </div>
  );
}
