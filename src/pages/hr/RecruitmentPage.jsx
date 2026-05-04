import supabase from '../../lib/supabase';
import { reportError } from '../../utils/errorReporter';
import { useState, useEffect, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useToast } from '../../contexts/ToastContext';
import { useAuditFilter } from '../../hooks/useAuditFilter';
import { Briefcase, Users, Clock, CheckCircle2, Plus, Edit2, Trash2 } from 'lucide-react';
import { KpiCard, Button, Th, Td, Tr, ExportButton, Pagination, SmartFilter, applySmartFilters, Modal, ModalFooter, Select } from '../../components/ui';

const TABLE = 'recruitment';

const statusColor = s => s==='open'?'#4A7AAB':s==='interviewing'?'#6B8DB5':'#8BA8C8';
const statusLabel = (s,lang) => ({ open:lang==='ar'?'مفتوح':'Open', interviewing:lang==='ar'?'مقابلات':'Interviewing', closed:lang==='ar'?'مغلق':'Closed' }[s]||s);

export default function RecruitmentPage() {
  const { i18n } = useTranslation();
  const toast = useToast();
  const isRTL = i18n.language==='ar'; const lang = i18n.language;
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);

  const emptyForm = {
    title_ar: '', title_en: '', dept: '', type: 'full-time',
    status: 'open', applicants: 0, posted: new Date().toISOString().slice(0, 10),
  };
  const [modalOpen, setModalOpen] = useState(false);
  const [editingJob, setEditingJob] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const openNew = () => { setEditingJob(null); setForm(emptyForm); setModalOpen(true); };
  const openEdit = (job) => {
    setEditingJob(job);
    setForm({
      title_ar: job.title_ar || '',
      title_en: job.title_en || '',
      dept: job.dept || '',
      type: job.type || 'full-time',
      status: job.status || 'open',
      applicants: job.applicants ?? 0,
      posted: job.posted || new Date().toISOString().slice(0, 10),
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.title_ar.trim() && !form.title_en.trim()) {
      toast.error(lang === 'ar' ? 'يجب إدخال اسم الوظيفة' : 'Job title is required');
      return;
    }
    setSaving(true);
    try {
      const payload = { ...form, applicants: Number(form.applicants) || 0 };
      if (editingJob) {
        const { data, error } = await supabase
          .from(TABLE)
          .update({ ...payload, updated_at: new Date().toISOString() })
          .eq('id', editingJob.id)
          .select('*')
          .single();
        if (error) throw error;
        setJobs(prev => prev.map(j => j.id === editingJob.id ? data : j));
        toast.success(lang === 'ar' ? 'تم حفظ التعديلات' : 'Job updated');
      } else {
        const { data, error } = await supabase
          .from(TABLE)
          .insert([{ ...payload, created_at: new Date().toISOString() }])
          .select('*')
          .single();
        if (error) throw error;
        setJobs(prev => [data, ...prev]);
        toast.success(lang === 'ar' ? 'تم إضافة الوظيفة' : 'Job created');
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
      setJobs(prev => prev.filter(j => j.id !== deleteTarget.id));
      toast.success(lang === 'ar' ? 'تم الحذف' : 'Deleted');
    } catch (err) {
      toast.error(lang === 'ar' ? 'فشل الحذف' : 'Delete failed');
      reportError(`supabase.${TABLE}`, 'delete', err);
    } finally {
      setDeleteTarget(null);
    }
  };

  // Fetch from Supabase on mount. No auto-seeding — fake job postings would
  // confuse real applicants if RLS ever allowed external visibility.
  const fetchJobs = useCallback(async () => {
    try {
      const { data, error } = await supabase.from(TABLE).select('*').order('created_at', { ascending: false });
      if (error) throw error;
      setJobs(data || []);
    } catch (err) {
      reportError(`supabase.${TABLE}`, 'fetch', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchJobs(); }, [fetchJobs]);

  const [search, setSearch] = useState('');
  const [smartFilters, setSmartFilters] = useState([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const { auditFields, applyAuditFilters } = useAuditFilter('recruitment');

  const SMART_FIELDS = useMemo(() => [
    {
      id: 'status', label: 'الحالة', labelEn: 'Status', type: 'select',
      options: [
        { value: 'open', label: 'مفتوح', labelEn: 'Open' },
        { value: 'interviewing', label: 'مقابلات', labelEn: 'Interviewing' },
        { value: 'closed', label: 'مغلق', labelEn: 'Closed' },
      ],
    },
    { id: 'dept', label: 'القسم', labelEn: 'Department', type: 'text' },
    { id: 'type', label: 'نوع الوظيفة', labelEn: 'Job Type', type: 'text' },
    { id: 'posted', label: 'تاريخ النشر', labelEn: 'Posted Date', type: 'date' },
    ...auditFields,
  ], [auditFields]);

  const filtered = useMemo(() => {
    let result = jobs;

    result = applySmartFilters(result, smartFilters, SMART_FIELDS);
    result = applyAuditFilters(result, smartFilters);

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      result = result.filter(j =>
        (j.title_ar || '').toLowerCase().includes(q) ||
        (j.title_en || '').toLowerCase().includes(q) ||
        (j.dept || '').toLowerCase().includes(q)
      );
    }

    return result;
  }, [jobs, smartFilters, SMART_FIELDS, search, applyAuditFilters]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const paged = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);
  useEffect(() => { if (page > totalPages) setPage(totalPages); }, [page, totalPages]);

  const open = jobs.filter(j=>j.status==='open').length;
  const interviewing = jobs.filter(j=>j.status==='interviewing').length;
  const totalApplicants = jobs.reduce((s,j)=>s+(j.applicants||0),0);

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} className="px-4 py-4 md:px-7 md:py-6 bg-surface-bg dark:bg-surface-bg-dark min-h-screen">
      <div className={`flex justify-between items-center mb-5 ${isRTL ? 'flex-row-reverse' : ''}`}>
        <div className={`flex items-center gap-3.5 ${isRTL ? 'flex-row-reverse' : ''}`}>
          <div className="w-10 h-10 rounded-xl bg-brand-500/[0.12] flex items-center justify-center">
            <Briefcase size={22} className="text-brand-500" />
          </div>
          <div className="text-start">
            <h1 className="m-0 text-xl font-bold text-content dark:text-content-dark">{lang==='ar'?'التوظيف':'Recruitment'}</h1>
            <p className="m-0 text-xs text-content-muted dark:text-content-muted-dark">{lang==='ar'?'إدارة طلبات التوظيف':'Manage job openings & applicants'}</p>
          </div>
        </div>
        <div className={`flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : 'flex-row'}`}>
          <ExportButton
            data={jobs}
            filename={isRTL ? 'التوظيف' : 'recruitment'}
            title={isRTL ? 'التوظيف' : 'Recruitment'}
            columns={[
              { header: isRTL ? 'الوظيفة' : 'Job Title', key: r => isRTL ? r.title_ar : r.title_en },
              { header: isRTL ? 'القسم' : 'Department', key: 'dept' },
              { header: isRTL ? 'النوع' : 'Type', key: 'type' },
              { header: isRTL ? 'المتقدمين' : 'Applicants', key: 'applicants' },
              { header: isRTL ? 'الحالة' : 'Status', key: r => statusLabel(r.status, lang) },
              { header: isRTL ? 'تاريخ النشر' : 'Posted', key: 'posted' },
            ]}
          />
          <Button size="md" onClick={openNew}>
            <Plus size={16} />{lang==='ar'?'+ وظيفة جديدة':'+ New Job'}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5 mb-5">
        <KpiCard icon={Briefcase} label={lang==='ar'?'إجمالي الوظائف':'Total Jobs'} value={jobs.length} color="#1B3347" />
        <KpiCard icon={Clock} label={lang==='ar'?'مفتوحة':'Open'} value={open} color="#4A7AAB" />
        <KpiCard icon={Users} label={lang==='ar'?'المتقدمون':'Applicants'} value={totalApplicants} color="#6B8DB5" />
        <KpiCard icon={CheckCircle2} label={lang==='ar'?'ماتمت المقابلة':'Interviewing'} value={interviewing} color="#2B4C6F" />
      </div>

      <SmartFilter
        fields={SMART_FIELDS}
        filters={smartFilters}
        onFiltersChange={setSmartFilters}
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder={lang === 'ar' ? 'ابحث عن وظيفة...' : 'Search jobs...'}
      />

      <div className="bg-surface-card dark:bg-surface-card-dark rounded-xl border border-edge dark:border-edge-dark overflow-hidden">
        <div className="px-5 py-3.5 border-b border-edge dark:border-edge-dark">
          <p className="m-0 text-sm font-bold text-content dark:text-content-dark">{lang==='ar'?'الوظائف المتاحة':'Job Openings'}</p>
        </div>
        <div className="overflow-x-auto">
        <table className="w-full border-collapse min-w-[600px]">
          <thead>
            <tr>
              {[lang==='ar'?'الوظيفة':'Position', lang==='ar'?'القسم':'Dept', lang==='ar'?'المتقدمون':'Applicants', lang==='ar'?'تاريخ النشر':'Posted', lang==='ar'?'الحالة':'Status', ''].map((h,i)=>(
                <Th key={i}>{h}</Th>
              ))}
            </tr>
          </thead>
          <tbody>
            {jobs.length === 0 ? (
              <tr>
                <td colSpan={6}>
                  <div className="text-center py-16 px-5">
                    <div className="w-16 h-16 rounded-2xl bg-brand-500/10 flex items-center justify-center mx-auto mb-4">
                      <Briefcase size={24} color='#4A7AAB' />
                    </div>
                    <p className="m-0 mb-1.5 text-sm font-bold text-content dark:text-content-dark">{lang==='ar'?'لا توجد طلبات توظيف':'No Recruitment Requests'}</p>
                    <p className="m-0 text-xs text-content-muted dark:text-content-muted-dark">{lang==='ar'?'لم يتم إضافة أي طلبات توظيف بعد':'No recruitment requests added yet'}</p>
                  </div>
                </td>
              </tr>
            ) : paged.map(job => (
              <JobRow
                key={job.id}
                job={job}
                lang={lang}
                isRTL={isRTL}
                onEdit={() => openEdit(job)}
                onDelete={() => setDeleteTarget(job)}
              />
            ))}
          </tbody>
        </table>
        </div>
      </div>
      <Pagination page={safePage} totalPages={totalPages} onPageChange={setPage} pageSize={pageSize} onPageSizeChange={(s) => { setPageSize(s); setPage(1); }} totalItems={filtered.length} />

      {/* ── Add / Edit Modal ── */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingJob
          ? (lang === 'ar' ? 'تعديل الوظيفة' : 'Edit Job')
          : (lang === 'ar' ? 'وظيفة جديدة' : 'New Job')}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <div>
            <label className="block text-xs text-content-muted dark:text-content-muted-dark mb-1">{lang === 'ar' ? 'الوظيفة (AR)' : 'Title (AR)'}</label>
            <input
              dir="rtl"
              value={form.title_ar}
              onChange={e => setForm(f => ({ ...f, title_ar: e.target.value }))}
              className="w-full px-3 py-2 rounded-xl border border-edge dark:border-edge-dark bg-surface-card dark:bg-surface-card-dark text-content dark:text-content-dark text-sm"
              placeholder="مثال: مدير مبيعات"
            />
          </div>
          <div>
            <label className="block text-xs text-content-muted dark:text-content-muted-dark mb-1">{lang === 'ar' ? 'الوظيفة (EN)' : 'Title (EN)'}</label>
            <input
              value={form.title_en}
              onChange={e => setForm(f => ({ ...f, title_en: e.target.value }))}
              className="w-full px-3 py-2 rounded-xl border border-edge dark:border-edge-dark bg-surface-card dark:bg-surface-card-dark text-content dark:text-content-dark text-sm"
              placeholder="e.g. Sales Manager"
            />
          </div>
          <div>
            <label className="block text-xs text-content-muted dark:text-content-muted-dark mb-1">{lang === 'ar' ? 'القسم' : 'Department'}</label>
            <input
              value={form.dept}
              onChange={e => setForm(f => ({ ...f, dept: e.target.value }))}
              className="w-full px-3 py-2 rounded-xl border border-edge dark:border-edge-dark bg-surface-card dark:bg-surface-card-dark text-content dark:text-content-dark text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-content-muted dark:text-content-muted-dark mb-1">{lang === 'ar' ? 'نوع الدوام' : 'Type'}</label>
            <Select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
              <option value="full-time">{lang === 'ar' ? 'دوام كامل' : 'Full Time'}</option>
              <option value="part-time">{lang === 'ar' ? 'دوام جزئي' : 'Part Time'}</option>
              <option value="contract">{lang === 'ar' ? 'عقد' : 'Contract'}</option>
              <option value="internship">{lang === 'ar' ? 'تدريب' : 'Internship'}</option>
            </Select>
          </div>
          <div>
            <label className="block text-xs text-content-muted dark:text-content-muted-dark mb-1">{lang === 'ar' ? 'الحالة' : 'Status'}</label>
            <Select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
              <option value="open">{lang === 'ar' ? 'مفتوح' : 'Open'}</option>
              <option value="interviewing">{lang === 'ar' ? 'مقابلات' : 'Interviewing'}</option>
              <option value="closed">{lang === 'ar' ? 'مغلق' : 'Closed'}</option>
            </Select>
          </div>
          <div>
            <label className="block text-xs text-content-muted dark:text-content-muted-dark mb-1">{lang === 'ar' ? 'تاريخ النشر' : 'Posted Date'}</label>
            <input
              type="date"
              value={form.posted}
              onChange={e => setForm(f => ({ ...f, posted: e.target.value }))}
              className="w-full px-3 py-2 rounded-xl border border-edge dark:border-edge-dark bg-surface-card dark:bg-surface-card-dark text-content dark:text-content-dark text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-content-muted dark:text-content-muted-dark mb-1">{lang === 'ar' ? 'عدد المتقدمين' : 'Applicants Count'}</label>
            <input
              type="number"
              min="0"
              value={form.applicants}
              onChange={e => setForm(f => ({ ...f, applicants: e.target.value }))}
              className="w-full px-3 py-2 rounded-xl border border-edge dark:border-edge-dark bg-surface-card dark:bg-surface-card-dark text-content dark:text-content-dark text-sm"
            />
          </div>
        </div>
        <ModalFooter>
          <Button variant="secondary" onClick={() => setModalOpen(false)}>{lang === 'ar' ? 'إلغاء' : 'Cancel'}</Button>
          <Button onClick={handleSave} disabled={saving || (!form.title_ar.trim() && !form.title_en.trim())}>
            {saving ? (lang === 'ar' ? 'جاري الحفظ...' : 'Saving...') : (lang === 'ar' ? 'حفظ' : 'Save')}
          </Button>
        </ModalFooter>
      </Modal>

      {/* ── Delete Confirm ── */}
      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title={lang === 'ar' ? 'تأكيد الحذف' : 'Confirm Delete'}>
        <p className="text-sm text-content dark:text-content-dark mb-2">
          {lang === 'ar' ? 'هل أنت متأكد من حذف هذه الوظيفة؟' : 'Are you sure you want to delete this job?'}
        </p>
        {deleteTarget && (
          <p className="text-xs text-content-muted dark:text-content-muted-dark">
            {(isRTL ? deleteTarget.title_ar : deleteTarget.title_en) || deleteTarget.title_ar}
          </p>
        )}
        <ModalFooter>
          <Button variant="secondary" onClick={() => setDeleteTarget(null)}>{lang === 'ar' ? 'إلغاء' : 'Cancel'}</Button>
          <Button variant="danger" onClick={handleDelete}>{lang === 'ar' ? 'حذف' : 'Delete'}</Button>
        </ModalFooter>
      </Modal>
    </div>
  );
}

function JobRow({ job, lang, isRTL, onEdit, onDelete }) {
  const sc = statusColor(job.status);
  return (
    <Tr>
      <Td className="font-bold">{lang==='ar'?job.title_ar:job.title_en}</Td>
      <Td className="text-content-muted dark:text-content-muted-dark">{job.dept}</Td>
      <Td><span className="font-bold text-brand-500">{job.applicants}</span></Td>
      <Td className="text-content-muted dark:text-content-muted-dark">{job.posted}</Td>
      <Td>
        <span
          className="px-2.5 py-[3px] rounded-full text-xs font-semibold"
          style={{ background: `${sc}18`, color: sc, border: `1px solid ${sc}35` }}
        >
          {statusLabel(job.status, lang)}
        </span>
      </Td>
      <Td>
        <div className={`flex gap-1.5 ${isRTL ? 'flex-row-reverse' : ''}`}>
          <button
            onClick={onEdit}
            title={lang === 'ar' ? 'تعديل' : 'Edit'}
            className="w-[30px] h-[30px] rounded-lg border border-edge dark:border-edge-dark bg-transparent hover:bg-brand-500/15 hover:border-brand-500/60 cursor-pointer flex items-center justify-center transition-all duration-150 text-content-muted dark:text-content-muted-dark hover:text-brand-500"
          >
            <Edit2 size={13} />
          </button>
          <button
            onClick={onDelete}
            title={lang === 'ar' ? 'حذف' : 'Delete'}
            className="w-[30px] h-[30px] rounded-lg border border-edge dark:border-edge-dark bg-transparent hover:bg-red-500/15 hover:border-red-500/60 cursor-pointer flex items-center justify-center transition-all duration-150 text-content-muted dark:text-content-muted-dark hover:text-red-500"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </Td>
    </Tr>
  );
}
