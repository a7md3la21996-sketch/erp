import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useToast } from '../../contexts/ToastContext';
import { fetchEmployees } from '../../services/employeesService';
import { Star, Plus, Pencil, Trash2 } from 'lucide-react';
import { Button, Card, CardHeader, KpiCard, Table, Th, Td, Tr, Modal, ModalFooter, Select, PageSkeleton } from '../../components/ui';
import supabase from '../../lib/supabase';

/* ─── Helpers ─── */
const REVIEW_TABLE = 'performance_reviews';

function StarRating({ value = 0, size = 14 }) {
  return (
    <span className="inline-flex gap-0.5">
      {[1, 2, 3, 4, 5].map(i => (
        <Star key={i} size={size} className={i <= value ? 'text-yellow-500 fill-yellow-500' : 'text-gray-300 dark:text-gray-600'} />
      ))}
    </span>
  );
}

function StarInput({ value = 0, onChange }) {
  const [hover, setHover] = useState(0);
  return (
    <span className="inline-flex gap-1 cursor-pointer">
      {[1, 2, 3, 4, 5].map(i => (
        <Star
          key={i}
          size={22}
          className={`transition-colors duration-100 ${i <= (hover || value) ? 'text-yellow-500 fill-yellow-500' : 'text-gray-300 dark:text-gray-600'}`}
          onMouseEnter={() => setHover(i)}
          onMouseLeave={() => setHover(0)}
          onClick={() => onChange(i)}
        />
      ))}
    </span>
  );
}

function StatusBadge({ status, config }) {
  const cfg = config[status] || { color: '#6B7280', label: status };
  return (
    <span
      className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold"
      style={{ background: `${cfg.color}18`, color: cfg.color, border: `1px solid ${cfg.color}35` }}
    >
      {cfg.label}
    </span>
  );
}

function ActionBtn({ icon: Icon, color = 'brand', title, onClick }) {
  const colors = {
    brand: 'hover:bg-brand-500/10 hover:border-brand-500/40 text-brand-500',
    red: 'hover:bg-red-500/10 hover:border-red-500/40 text-red-500',
  };
  return (
    <button
      onClick={onClick}
      title={title}
      className={`w-[30px] h-[30px] rounded-lg border border-edge dark:border-edge-dark bg-transparent flex items-center justify-center cursor-pointer transition-all duration-150 ${colors[color]}`}
    >
      <Icon size={13} />
    </button>
  );
}

/* ─── Component ─── */
export default function PerformanceReviewPage() {
  const { i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const lang = i18n.language;
  const toast = useToast();

  const now = new Date();
  const [yearFilter, setYearFilter] = useState(now.getFullYear());
  const [employees, setEmployees] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingReview, setEditingReview] = useState(null);
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  const defaultForm = { employee_id: '', reviewer_id: '', period: 'Q1', year: now.getFullYear(), overall_rating: 3, strengths: '', improvements: '', goals: '', comments: '' };
  const [form, setForm] = useState({ ...defaultForm });

  /* ─── Load Data ─── */
  const loadData = async () => {
    setLoading(true);
    try {
      const [{ data: reviewsData }, emps] = await Promise.all([
        supabase.from(REVIEW_TABLE).select('*').eq('year', yearFilter).order('created_at', { ascending: false }),
        fetchEmployees(),
      ]);
      setReviews(reviewsData || []);
      setEmployees(emps || []);
    } catch {
      toast.error(lang === 'ar' ? 'فشل تحميل البيانات' : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, [yearFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ─── Status config ─── */
  const statusConfig = useMemo(() => ({
    draft:     { color: '#6B7280', label: lang === 'ar' ? 'مسودة' : 'Draft' },
    submitted: { color: '#F59E0B', label: lang === 'ar' ? 'مُقدّم' : 'Submitted' },
    approved:  { color: '#10B981', label: lang === 'ar' ? 'معتمد' : 'Approved' },
  }), [lang]);

  const periodLabels = useMemo(() => ({
    Q1:     { ar: 'الربع الأول', en: 'Q1' },
    Q2:     { ar: 'الربع الثاني', en: 'Q2' },
    Q3:     { ar: 'الربع الثالث', en: 'Q3' },
    Q4:     { ar: 'الربع الرابع', en: 'Q4' },
    Annual: { ar: 'سنوي', en: 'Annual' },
  }), []);

  /* ─── KPIs ─── */
  const kpis = useMemo(() => {
    const total = reviews.length;
    const avgRating = total ? (reviews.reduce((s, r) => s + (r.overall_rating || 0), 0) / total).toFixed(1) : '0';
    const completed = reviews.filter(r => r.status === 'approved').length;
    const pending = reviews.filter(r => r.status !== 'approved').length;
    return { total, avgRating, completed, pending };
  }, [reviews]);

  /* ─── Employee name helper ─── */
  const empName = (id) => {
    const emp = employees.find(e => e.id === id);
    if (!emp) return id || '—';
    return (isRTL ? emp.full_name_ar : (emp.full_name_en || emp.full_name_ar)) || id;
  };

  /* ─── Actions ─── */
  const openAdd = () => {
    setEditingReview(null);
    setForm({ ...defaultForm, year: yearFilter });
    setShowModal(true);
  };

  const openEdit = (review) => {
    setEditingReview(review);
    setForm({
      employee_id: review.employee_id || '',
      reviewer_id: review.reviewer_id || '',
      period: review.period || 'Q1',
      year: review.year || yearFilter,
      overall_rating: review.overall_rating || 3,
      strengths: review.strengths || '',
      improvements: review.improvements || '',
      goals: review.goals || '',
      comments: review.comments || '',
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.employee_id) return;
    setSaving(true);
    try {
      const payload = {
        employee_id: form.employee_id,
        reviewer_id: form.reviewer_id || null,
        period: form.period,
        year: form.year,
        overall_rating: Number(form.overall_rating),
        strengths: form.strengths || null,
        improvements: form.improvements || null,
        goals: form.goals || null,
        comments: form.comments || null,
        status: editingReview ? editingReview.status : 'draft',
      };

      if (editingReview) {
        const { data, error } = await supabase.from(REVIEW_TABLE).update(payload).eq('id', editingReview.id).select().single();
        if (error) throw error;
        setReviews(prev => prev.map(r => r.id === editingReview.id ? data : r));
      } else {
        const { data, error } = await supabase.from(REVIEW_TABLE).insert(payload).select().single();
        if (error) throw error;
        setReviews(prev => [data, ...prev]);
      }
      setShowModal(false);
      toast.success(lang === 'ar' ? 'تم الحفظ بنجاح' : 'Saved successfully');
    } catch {
      toast.error(lang === 'ar' ? 'فشل الحفظ' : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      const { error } = await supabase.from(REVIEW_TABLE).delete().eq('id', id);
      if (error) throw error;
      setReviews(prev => prev.filter(r => r.id !== id));
      setDeleteConfirm(null);
      toast.success(lang === 'ar' ? 'تم الحذف' : 'Deleted');
    } catch {
      toast.error(lang === 'ar' ? 'فشل الحذف' : 'Delete failed');
    }
  };

  /* ─── Year options ─── */
  const years = Array.from({ length: 5 }, (_, i) => now.getFullYear() - 2 + i);

  if (loading) return (
    <div className="px-4 py-4 md:px-7 md:py-6">
      <PageSkeleton hasKpis kpiCount={4} tableRows={6} tableCols={7} />
    </div>
  );

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} className="px-4 py-4 md:px-7 md:py-6 bg-surface-bg dark:bg-surface-bg-dark min-h-screen">
      {/* Header */}
      <div className={`flex flex-wrap justify-between items-center gap-3 mb-5 ${isRTL ? 'flex-row-reverse' : ''}`}>
        <div className={`flex items-center gap-3.5 ${isRTL ? 'flex-row-reverse' : ''}`}>
          <div className="w-10 h-10 rounded-xl bg-brand-500/[0.12] flex items-center justify-center">
            <Star size={22} className="text-brand-500" />
          </div>
          <div className="text-start">
            <h1 className="m-0 text-xl font-bold text-content dark:text-content-dark">{lang === 'ar' ? 'تقييم الأداء' : 'Performance Reviews'}</h1>
            <p className="m-0 text-xs text-content-muted dark:text-content-muted-dark">{lang === 'ar' ? 'إدارة تقييمات أداء الموظفين' : 'Manage employee performance appraisals'}</p>
          </div>
        </div>
        <div className={`flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : 'flex-row'}`}>
          <Button size="md" onClick={openAdd}>
            <Plus size={16} />
            {lang === 'ar' ? 'تقييم جديد' : 'New Review'}
          </Button>
        </div>
      </div>

      {/* Year Filter */}
      <div className={`flex items-center gap-2.5 mb-5 ${isRTL ? 'flex-row-reverse' : ''}`}>
        <label className="text-xs text-content-muted dark:text-content-muted-dark whitespace-nowrap">{lang === 'ar' ? 'السنة:' : 'Year:'}</label>
        <Select value={yearFilter} onChange={e => setYearFilter(Number(e.target.value))}>
          {years.map(y => <option key={y} value={y}>{y}</option>)}
        </Select>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5 mb-5">
        <KpiCard icon={Star} label={lang === 'ar' ? 'إجمالي التقييمات' : 'Total Reviews'} value={kpis.total} color="#1B3347" />
        <KpiCard icon={Star} label={lang === 'ar' ? 'متوسط التقييم' : 'Avg Rating'} value={kpis.avgRating} color="#F59E0B" />
        <KpiCard icon={Star} label={lang === 'ar' ? 'مكتملة' : 'Completed'} value={kpis.completed} color="#10B981" />
        <KpiCard icon={Star} label={lang === 'ar' ? 'قيد الانتظار' : 'Pending'} value={kpis.pending} color="#6B8DB5" />
      </div>

      {/* Table */}
      <Card className="overflow-hidden">
        <CardHeader>
          <p className="m-0 text-sm font-bold text-content dark:text-content-dark">{lang === 'ar' ? 'سجل التقييمات' : 'Reviews Log'}</p>
        </CardHeader>
        <Table>
          <thead>
            <tr>
              {[
                lang === 'ar' ? 'الموظف' : 'Employee',
                lang === 'ar' ? 'المُقيّم' : 'Reviewer',
                lang === 'ar' ? 'الفترة' : 'Period',
                lang === 'ar' ? 'السنة' : 'Year',
                lang === 'ar' ? 'التقييم' : 'Rating',
                lang === 'ar' ? 'الحالة' : 'Status',
                '',
              ].map((h, i) => <Th key={i}>{h}</Th>)}
            </tr>
          </thead>
          <tbody>
            {reviews.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center py-16 px-5">
                  <div className="w-16 h-16 rounded-2xl bg-brand-500/10 flex items-center justify-center mx-auto mb-4">
                    <Star size={24} color="#4A7AAB" />
                  </div>
                  <p className="m-0 mb-1.5 text-sm font-bold text-content dark:text-content-dark">{lang === 'ar' ? 'لا توجد تقييمات' : 'No Reviews'}</p>
                  <p className="m-0 text-xs text-content-muted dark:text-content-muted-dark">{lang === 'ar' ? 'لم يتم إضافة أي تقييمات بعد' : 'No performance reviews added yet'}</p>
                </td>
              </tr>
            ) : reviews.map(review => (
              <Tr key={review.id}>
                <Td className="font-semibold">{empName(review.employee_id)}</Td>
                <Td className="text-content-muted dark:text-content-muted-dark">{empName(review.reviewer_id)}</Td>
                <Td className="text-content-muted dark:text-content-muted-dark">
                  {periodLabels[review.period] ? (lang === 'ar' ? periodLabels[review.period].ar : periodLabels[review.period].en) : review.period}
                </Td>
                <Td className="text-content-muted dark:text-content-muted-dark">{review.year}</Td>
                <Td><StarRating value={review.overall_rating} /></Td>
                <Td><StatusBadge status={review.status} config={statusConfig} /></Td>
                <Td>
                  {deleteConfirm === review.id ? (
                    <div className={`flex gap-1.5 ${isRTL ? 'flex-row-reverse' : ''}`}>
                      <button onClick={() => handleDelete(review.id)} className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-red-500 text-white border-none cursor-pointer transition-all duration-150 hover:bg-red-600">
                        {lang === 'ar' ? 'تأكيد' : 'Confirm'}
                      </button>
                      <button onClick={() => setDeleteConfirm(null)} className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-transparent text-content-muted dark:text-content-muted-dark border border-edge dark:border-edge-dark cursor-pointer transition-all duration-150 hover:bg-gray-100 dark:hover:bg-brand-500/10">
                        {lang === 'ar' ? 'إلغاء' : 'Cancel'}
                      </button>
                    </div>
                  ) : (
                    <div className={`flex gap-1.5 ${isRTL ? 'flex-row-reverse' : ''}`}>
                      <ActionBtn icon={Pencil} color="brand" title={lang === 'ar' ? 'تعديل' : 'Edit'} onClick={() => openEdit(review)} />
                      <ActionBtn icon={Trash2} color="red" title={lang === 'ar' ? 'حذف' : 'Delete'} onClick={() => setDeleteConfirm(review.id)} />
                    </div>
                  )}
                </Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      </Card>

      {/* ─── Add/Edit Review Modal ─── */}
      <Modal open={showModal} onClose={() => setShowModal(false)} title={editingReview ? (lang === 'ar' ? 'تعديل التقييم' : 'Edit Review') : (lang === 'ar' ? 'تقييم جديد' : 'New Review')}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <div>
            <label className="block text-xs text-content-muted dark:text-content-muted-dark mb-1">{lang === 'ar' ? 'الموظف' : 'Employee'}</label>
            <Select value={form.employee_id} onChange={e => setForm(f => ({ ...f, employee_id: e.target.value }))}>
              <option value="">{lang === 'ar' ? 'اختر الموظف...' : 'Select employee...'}</option>
              {employees.map(e => (
                <option key={e.id} value={e.id}>{isRTL ? e.full_name_ar : (e.full_name_en || e.full_name_ar)}</option>
              ))}
            </Select>
          </div>
          <div>
            <label className="block text-xs text-content-muted dark:text-content-muted-dark mb-1">{lang === 'ar' ? 'المُقيّم' : 'Reviewer'}</label>
            <Select value={form.reviewer_id} onChange={e => setForm(f => ({ ...f, reviewer_id: e.target.value }))}>
              <option value="">{lang === 'ar' ? 'اختر المُقيّم...' : 'Select reviewer...'}</option>
              {employees.map(e => (
                <option key={e.id} value={e.id}>{isRTL ? e.full_name_ar : (e.full_name_en || e.full_name_ar)}</option>
              ))}
            </Select>
          </div>
          <div>
            <label className="block text-xs text-content-muted dark:text-content-muted-dark mb-1">{lang === 'ar' ? 'الفترة' : 'Period'}</label>
            <Select value={form.period} onChange={e => setForm(f => ({ ...f, period: e.target.value }))}>
              {Object.entries(periodLabels).map(([key, labels]) => (
                <option key={key} value={key}>{lang === 'ar' ? labels.ar : labels.en}</option>
              ))}
            </Select>
          </div>
          <div>
            <label className="block text-xs text-content-muted dark:text-content-muted-dark mb-1">{lang === 'ar' ? 'السنة' : 'Year'}</label>
            <Select value={form.year} onChange={e => setForm(f => ({ ...f, year: Number(e.target.value) }))}>
              {years.map(y => <option key={y} value={y}>{y}</option>)}
            </Select>
          </div>
          <div className="col-span-full">
            <label className="block text-xs text-content-muted dark:text-content-muted-dark mb-1.5">{lang === 'ar' ? 'التقييم العام' : 'Overall Rating'}</label>
            <StarInput value={form.overall_rating} onChange={v => setForm(f => ({ ...f, overall_rating: v }))} />
          </div>
          <div className="col-span-full">
            <label className="block text-xs text-content-muted dark:text-content-muted-dark mb-1">{lang === 'ar' ? 'نقاط القوة' : 'Strengths'}</label>
            <textarea
              rows={2}
              value={form.strengths}
              onChange={e => setForm(f => ({ ...f, strengths: e.target.value }))}
              className="w-full px-3 py-2 rounded-xl border border-edge dark:border-edge-dark bg-surface-card dark:bg-surface-card-dark text-content dark:text-content-dark text-sm resize-none"
            />
          </div>
          <div className="col-span-full">
            <label className="block text-xs text-content-muted dark:text-content-muted-dark mb-1">{lang === 'ar' ? 'نقاط التحسين' : 'Areas for Improvement'}</label>
            <textarea
              rows={2}
              value={form.improvements}
              onChange={e => setForm(f => ({ ...f, improvements: e.target.value }))}
              className="w-full px-3 py-2 rounded-xl border border-edge dark:border-edge-dark bg-surface-card dark:bg-surface-card-dark text-content dark:text-content-dark text-sm resize-none"
            />
          </div>
          <div className="col-span-full">
            <label className="block text-xs text-content-muted dark:text-content-muted-dark mb-1">{lang === 'ar' ? 'الأهداف' : 'Goals'}</label>
            <textarea
              rows={2}
              value={form.goals}
              onChange={e => setForm(f => ({ ...f, goals: e.target.value }))}
              className="w-full px-3 py-2 rounded-xl border border-edge dark:border-edge-dark bg-surface-card dark:bg-surface-card-dark text-content dark:text-content-dark text-sm resize-none"
            />
          </div>
          <div className="col-span-full">
            <label className="block text-xs text-content-muted dark:text-content-muted-dark mb-1">{lang === 'ar' ? 'ملاحظات' : 'Comments'}</label>
            <textarea
              rows={2}
              value={form.comments}
              onChange={e => setForm(f => ({ ...f, comments: e.target.value }))}
              className="w-full px-3 py-2 rounded-xl border border-edge dark:border-edge-dark bg-surface-card dark:bg-surface-card-dark text-content dark:text-content-dark text-sm resize-none"
            />
          </div>
        </div>
        <ModalFooter className="justify-end">
          <Button variant="secondary" onClick={() => setShowModal(false)}>{lang === 'ar' ? 'إلغاء' : 'Cancel'}</Button>
          <Button disabled={saving || !form.employee_id} onClick={handleSave}>
            {saving ? (lang === 'ar' ? 'جاري الحفظ...' : 'Saving...') : (lang === 'ar' ? 'حفظ' : 'Save')}
          </Button>
        </ModalFooter>
      </Modal>
    </div>
  );
}
