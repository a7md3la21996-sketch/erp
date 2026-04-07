import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useToast } from '../../contexts/ToastContext';
import { fetchDepartments } from '../../services/employeesService';
import { Users, Plus, Pencil, Trash2, Briefcase, Star } from 'lucide-react';
import { Button, Card, CardHeader, KpiCard, Table, Th, Td, Tr, Modal, ModalFooter, Select, PageSkeleton } from '../../components/ui';
import supabase from '../../lib/supabase';

/* ─── Helpers ─── */
const JOB_TABLE = 'ats_job_postings';
const APP_TABLE = 'ats_applicants';

function StatusBadge({ status, config }) {
  const cfg = config[status] || { color: '#6B7280', label: status };
  return (
    <span
      className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold"
      style={{ background: `${cfg.color}18`, color: cfg.color, border: `1px solid ${cfg.color}35`, fontWeight: cfg.bold ? 700 : 600 }}
    >
      {cfg.label}
    </span>
  );
}

function StarRating({ value = 0 }) {
  return (
    <span className="inline-flex gap-0.5">
      {[1, 2, 3, 4, 5].map(i => (
        <Star key={i} size={14} className={i <= value ? 'text-yellow-500 fill-yellow-500' : 'text-gray-300 dark:text-gray-600'} />
      ))}
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
export default function ATSPage() {
  const { i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const lang = i18n.language;
  const toast = useToast();

  /* ─── State ─── */
  const [activeTab, setActiveTab] = useState('jobs');
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);

  // Jobs
  const [jobs, setJobs] = useState([]);
  const [showJobModal, setShowJobModal] = useState(false);
  const [editingJob, setEditingJob] = useState(null);
  const [jobForm, setJobForm] = useState({ title: '', title_ar: '', department_id: '', description: '', requirements: '', salary_range: '', closing_date: '' });
  const [savingJob, setSavingJob] = useState(false);
  const [deleteJobConfirm, setDeleteJobConfirm] = useState(null);

  // Applicants
  const [applicants, setApplicants] = useState([]);
  const [showAppModal, setShowAppModal] = useState(false);
  const [appForm, setAppForm] = useState({ posting_id: '', name: '', email: '', phone: '', resume_url: '', notes: '' });
  const [savingApp, setSavingApp] = useState(false);
  const [deleteAppConfirm, setDeleteAppConfirm] = useState(null);
  const [filterPostingId, setFilterPostingId] = useState('');

  /* ─── Load Data ─── */
  const loadData = async () => {
    setLoading(true);
    try {
      const [{ data: jobsData }, { data: appsData }, depts] = await Promise.all([
        supabase.from(JOB_TABLE).select('*').order('created_at', { ascending: false }),
        supabase.from(APP_TABLE).select('*').order('created_at', { ascending: false }),
        fetchDepartments(),
      ]);
      setJobs(jobsData || []);
      setApplicants(appsData || []);
      setDepartments(depts || []);
    } catch {
      toast.error(lang === 'ar' ? 'فشل تحميل البيانات' : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /* ─── Status configs ─── */
  const jobStatusConfig = useMemo(() => ({
    open:    { color: '#10B981', label: lang === 'ar' ? 'مفتوح' : 'Open' },
    closed:  { color: '#EF4444', label: lang === 'ar' ? 'مغلق' : 'Closed' },
    on_hold: { color: '#F59E0B', label: lang === 'ar' ? 'معلّق' : 'On Hold' },
  }), [lang]);

  const appStatusConfig = useMemo(() => ({
    new:       { color: '#3B82F6', label: lang === 'ar' ? 'جديد' : 'New' },
    screening: { color: '#F59E0B', label: lang === 'ar' ? 'فرز' : 'Screening' },
    interview: { color: '#4A7AAB', label: lang === 'ar' ? 'مقابلة' : 'Interview' },
    offered:   { color: '#10B981', label: lang === 'ar' ? 'عرض' : 'Offered' },
    rejected:  { color: '#EF4444', label: lang === 'ar' ? 'مرفوض' : 'Rejected' },
    hired:     { color: '#10B981', label: lang === 'ar' ? 'تم التعيين' : 'Hired', bold: true },
  }), [lang]);

  /* ─── Job Actions ─── */
  const openAddJob = () => {
    setEditingJob(null);
    setJobForm({ title: '', title_ar: '', department_id: '', description: '', requirements: '', salary_range: '', closing_date: '' });
    setShowJobModal(true);
  };

  const openEditJob = (job) => {
    setEditingJob(job);
    setJobForm({
      title: job.title || '',
      title_ar: job.title_ar || '',
      department_id: job.department_id || '',
      description: job.description || '',
      requirements: job.requirements || '',
      salary_range: job.salary_range || '',
      closing_date: job.closing_date || '',
    });
    setShowJobModal(true);
  };

  const handleSaveJob = async () => {
    if (!jobForm.title && !jobForm.title_ar) return;
    setSavingJob(true);
    try {
      const payload = {
        title: jobForm.title,
        title_ar: jobForm.title_ar,
        department_id: jobForm.department_id || null,
        description: jobForm.description || null,
        requirements: jobForm.requirements || null,
        salary_range: jobForm.salary_range || null,
        closing_date: jobForm.closing_date || null,
        status: editingJob ? editingJob.status : 'open',
      };

      if (editingJob) {
        const { data, error } = await supabase.from(JOB_TABLE).update(payload).eq('id', editingJob.id).select().single();
        if (error) throw error;
        setJobs(prev => prev.map(j => j.id === editingJob.id ? data : j));
      } else {
        const { data, error } = await supabase.from(JOB_TABLE).insert(payload).select().single();
        if (error) throw error;
        setJobs(prev => [data, ...prev]);
      }
      setShowJobModal(false);
      toast.success(lang === 'ar' ? 'تم الحفظ بنجاح' : 'Saved successfully');
    } catch {
      toast.error(lang === 'ar' ? 'فشل الحفظ' : 'Save failed');
    } finally {
      setSavingJob(false);
    }
  };

  const handleDeleteJob = async (id) => {
    try {
      const { error } = await supabase.from(JOB_TABLE).delete().eq('id', id);
      if (error) throw error;
      setJobs(prev => prev.filter(j => j.id !== id));
      setDeleteJobConfirm(null);
      toast.success(lang === 'ar' ? 'تم الحذف' : 'Deleted');
    } catch {
      toast.error(lang === 'ar' ? 'فشل الحذف' : 'Delete failed');
    }
  };

  const handleJobStatusChange = async (job, newStatus) => {
    try {
      const { data, error } = await supabase.from(JOB_TABLE).update({ status: newStatus }).eq('id', job.id).select().single();
      if (error) throw error;
      setJobs(prev => prev.map(j => j.id === job.id ? data : j));
    } catch {
      toast.error(lang === 'ar' ? 'فشل التحديث' : 'Update failed');
    }
  };

  /* ─── Applicant Actions ─── */
  const openAddApp = () => {
    setAppForm({ posting_id: '', name: '', email: '', phone: '', resume_url: '', notes: '' });
    setShowAppModal(true);
  };

  const handleSaveApp = async () => {
    if (!appForm.name || !appForm.posting_id) return;
    setSavingApp(true);
    try {
      const payload = {
        posting_id: appForm.posting_id,
        name: appForm.name,
        email: appForm.email || null,
        phone: appForm.phone || null,
        resume_url: appForm.resume_url || null,
        notes: appForm.notes || null,
        status: 'new',
        rating: 0,
      };
      const { data, error } = await supabase.from(APP_TABLE).insert(payload).select().single();
      if (error) throw error;
      setApplicants(prev => [data, ...prev]);
      setShowAppModal(false);
      toast.success(lang === 'ar' ? 'تمت الإضافة بنجاح' : 'Added successfully');
    } catch {
      toast.error(lang === 'ar' ? 'فشل الحفظ' : 'Save failed');
    } finally {
      setSavingApp(false);
    }
  };

  const handleAppStatusChange = async (app, newStatus) => {
    try {
      const { data, error } = await supabase.from(APP_TABLE).update({ status: newStatus }).eq('id', app.id).select().single();
      if (error) throw error;
      setApplicants(prev => prev.map(a => a.id === app.id ? data : a));
    } catch {
      toast.error(lang === 'ar' ? 'فشل التحديث' : 'Update failed');
    }
  };

  const handleDeleteApp = async (id) => {
    try {
      const { error } = await supabase.from(APP_TABLE).delete().eq('id', id);
      if (error) throw error;
      setApplicants(prev => prev.filter(a => a.id !== id));
      setDeleteAppConfirm(null);
      toast.success(lang === 'ar' ? 'تم الحذف' : 'Deleted');
    } catch {
      toast.error(lang === 'ar' ? 'فشل الحذف' : 'Delete failed');
    }
  };

  /* ─── Derived ─── */
  const deptName = (id) => {
    const d = departments.find(d => d.id === id);
    return d ? (isRTL ? d.name_ar : (d.name_en || d.name_ar)) : '—';
  };

  const jobTitle = (id) => {
    const j = jobs.find(j => j.id === id);
    if (!j) return '—';
    return isRTL ? (j.title_ar || j.title) : (j.title || j.title_ar);
  };

  const applicantCount = (jobId) => applicants.filter(a => a.posting_id === jobId).length;

  const filteredApplicants = useMemo(() => {
    if (!filterPostingId) return applicants;
    return applicants.filter(a => a.posting_id === filterPostingId);
  }, [applicants, filterPostingId]);

  /* ─── Tabs ─── */
  const tabs = [
    { key: 'jobs', label: lang === 'ar' ? 'الوظائف' : 'Job Postings' },
    { key: 'applicants', label: lang === 'ar' ? 'المتقدمين' : 'Applicants' },
  ];

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
            <Users size={22} className="text-brand-500" />
          </div>
          <div className="text-start">
            <h1 className="m-0 text-xl font-bold text-content dark:text-content-dark">{lang === 'ar' ? 'التوظيف' : 'Recruitment'}</h1>
            <p className="m-0 text-xs text-content-muted dark:text-content-muted-dark">{lang === 'ar' ? 'نظام تتبع المتقدمين' : 'Applicant Tracking System'}</p>
          </div>
        </div>
        <div className={`flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : 'flex-row'}`}>
          {activeTab === 'jobs' ? (
            <Button size="md" onClick={openAddJob}>
              <Plus size={16} />
              {lang === 'ar' ? 'إضافة وظيفة' : 'Add Job'}
            </Button>
          ) : (
            <Button size="md" onClick={openAddApp}>
              <Plus size={16} />
              {lang === 'ar' ? 'إضافة متقدم' : 'Add Applicant'}
            </Button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className={`flex gap-1 mb-5 p-1 rounded-xl bg-surface-card dark:bg-surface-card-dark border border-edge dark:border-edge-dark w-fit ${isRTL ? 'flex-row-reverse' : ''}`}>
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold cursor-pointer border-none transition-all duration-150
              ${activeTab === tab.key
                ? 'bg-brand-500 text-white shadow-sm'
                : 'bg-transparent text-content-muted dark:text-content-muted-dark hover:bg-brand-500/10'
              }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ─── Jobs Tab ─── */}
      {activeTab === 'jobs' && (
        <Card className="overflow-hidden">
          <CardHeader>
            <p className="m-0 text-sm font-bold text-content dark:text-content-dark">{lang === 'ar' ? 'الوظائف المتاحة' : 'Job Postings'}</p>
          </CardHeader>
          <Table>
            <thead>
              <tr>
                {[
                  lang === 'ar' ? 'المسمى الوظيفي' : 'Job Title',
                  lang === 'ar' ? 'القسم' : 'Department',
                  lang === 'ar' ? 'الحالة' : 'Status',
                  lang === 'ar' ? 'تاريخ النشر' : 'Posted',
                  lang === 'ar' ? 'تاريخ الإغلاق' : 'Closing Date',
                  lang === 'ar' ? 'المتقدمون' : 'Applicants',
                  '',
                ].map((h, i) => <Th key={i}>{h}</Th>)}
              </tr>
            </thead>
            <tbody>
              {jobs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-16 px-5">
                    <div className="w-16 h-16 rounded-2xl bg-brand-500/10 flex items-center justify-center mx-auto mb-4">
                      <Briefcase size={24} color="#4A7AAB" />
                    </div>
                    <p className="m-0 mb-1.5 text-sm font-bold text-content dark:text-content-dark">{lang === 'ar' ? 'لا توجد وظائف' : 'No Job Postings'}</p>
                    <p className="m-0 text-xs text-content-muted dark:text-content-muted-dark">{lang === 'ar' ? 'لم يتم إضافة أي وظائف بعد' : 'No job postings added yet'}</p>
                  </td>
                </tr>
              ) : jobs.map(job => (
                <Tr key={job.id}>
                  <Td className="font-semibold">{isRTL ? (job.title_ar || job.title) : (job.title || job.title_ar)}</Td>
                  <Td className="text-content-muted dark:text-content-muted-dark">{deptName(job.department_id)}</Td>
                  <Td><StatusBadge status={job.status} config={jobStatusConfig} /></Td>
                  <Td className="text-content-muted dark:text-content-muted-dark text-xs">{job.created_at ? new Date(job.created_at).toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-US') : '—'}</Td>
                  <Td className="text-content-muted dark:text-content-muted-dark text-xs">{job.closing_date || '—'}</Td>
                  <Td><span className="font-bold text-brand-500">{applicantCount(job.id)}</span></Td>
                  <Td>
                    {deleteJobConfirm === job.id ? (
                      <div className={`flex gap-1.5 ${isRTL ? 'flex-row-reverse' : ''}`}>
                        <button onClick={() => handleDeleteJob(job.id)} className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-red-500 text-white border-none cursor-pointer transition-all duration-150 hover:bg-red-600">
                          {lang === 'ar' ? 'تأكيد' : 'Confirm'}
                        </button>
                        <button onClick={() => setDeleteJobConfirm(null)} className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-transparent text-content-muted dark:text-content-muted-dark border border-edge dark:border-edge-dark cursor-pointer transition-all duration-150 hover:bg-gray-100 dark:hover:bg-brand-500/10">
                          {lang === 'ar' ? 'إلغاء' : 'Cancel'}
                        </button>
                      </div>
                    ) : (
                      <div className={`flex gap-1.5 ${isRTL ? 'flex-row-reverse' : ''}`}>
                        <ActionBtn icon={Pencil} color="brand" title={lang === 'ar' ? 'تعديل' : 'Edit'} onClick={() => openEditJob(job)} />
                        <ActionBtn icon={Trash2} color="red" title={lang === 'ar' ? 'حذف' : 'Delete'} onClick={() => setDeleteJobConfirm(job.id)} />
                      </div>
                    )}
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        </Card>
      )}

      {/* ─── Applicants Tab ─── */}
      {activeTab === 'applicants' && (
        <>
          {/* Filter by posting */}
          <div className={`flex items-center gap-2.5 mb-4 ${isRTL ? 'flex-row-reverse' : ''}`}>
            <label className="text-xs text-content-muted dark:text-content-muted-dark whitespace-nowrap">{lang === 'ar' ? 'تصفية حسب الوظيفة:' : 'Filter by Job:'}</label>
            <Select value={filterPostingId} onChange={e => setFilterPostingId(e.target.value)} className="max-w-xs">
              <option value="">{lang === 'ar' ? 'جميع الوظائف' : 'All Jobs'}</option>
              {jobs.map(j => (
                <option key={j.id} value={j.id}>{isRTL ? (j.title_ar || j.title) : (j.title || j.title_ar)}</option>
              ))}
            </Select>
          </div>

          <Card className="overflow-hidden">
            <CardHeader>
              <p className="m-0 text-sm font-bold text-content dark:text-content-dark">{lang === 'ar' ? 'المتقدمون' : 'Applicants'}</p>
            </CardHeader>
            <Table>
              <thead>
                <tr>
                  {[
                    lang === 'ar' ? 'الاسم' : 'Name',
                    lang === 'ar' ? 'البريد الإلكتروني' : 'Email',
                    lang === 'ar' ? 'الهاتف' : 'Phone',
                    lang === 'ar' ? 'الوظيفة' : 'Job Applied',
                    lang === 'ar' ? 'الحالة' : 'Status',
                    lang === 'ar' ? 'تاريخ المقابلة' : 'Interview Date',
                    lang === 'ar' ? 'التقييم' : 'Rating',
                    '',
                  ].map((h, i) => <Th key={i}>{h}</Th>)}
                </tr>
              </thead>
              <tbody>
                {filteredApplicants.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center py-16 px-5">
                      <div className="w-16 h-16 rounded-2xl bg-brand-500/10 flex items-center justify-center mx-auto mb-4">
                        <Users size={24} color="#4A7AAB" />
                      </div>
                      <p className="m-0 mb-1.5 text-sm font-bold text-content dark:text-content-dark">{lang === 'ar' ? 'لا يوجد متقدمون' : 'No Applicants'}</p>
                      <p className="m-0 text-xs text-content-muted dark:text-content-muted-dark">{lang === 'ar' ? 'لم يتم إضافة أي متقدمين بعد' : 'No applicants added yet'}</p>
                    </td>
                  </tr>
                ) : filteredApplicants.map(app => (
                  <Tr key={app.id}>
                    <Td className="font-semibold">{app.name}</Td>
                    <Td className="text-content-muted dark:text-content-muted-dark text-xs">{app.email || '—'}</Td>
                    <Td className="text-content-muted dark:text-content-muted-dark text-xs">{app.phone || '—'}</Td>
                    <Td className="text-content-muted dark:text-content-muted-dark">{jobTitle(app.posting_id)}</Td>
                    <Td>
                      <Select
                        value={app.status}
                        onChange={e => handleAppStatusChange(app, e.target.value)}
                        className="!py-1 !px-2 !text-xs !min-w-[100px]"
                      >
                        {Object.entries(appStatusConfig).map(([key, cfg]) => (
                          <option key={key} value={key}>{cfg.label}</option>
                        ))}
                      </Select>
                    </Td>
                    <Td className="text-content-muted dark:text-content-muted-dark text-xs">{app.interview_date || '—'}</Td>
                    <Td><StarRating value={app.rating || 0} /></Td>
                    <Td>
                      {deleteAppConfirm === app.id ? (
                        <div className={`flex gap-1.5 ${isRTL ? 'flex-row-reverse' : ''}`}>
                          <button onClick={() => handleDeleteApp(app.id)} className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-red-500 text-white border-none cursor-pointer transition-all duration-150 hover:bg-red-600">
                            {lang === 'ar' ? 'تأكيد' : 'Confirm'}
                          </button>
                          <button onClick={() => setDeleteAppConfirm(null)} className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-transparent text-content-muted dark:text-content-muted-dark border border-edge dark:border-edge-dark cursor-pointer transition-all duration-150 hover:bg-gray-100 dark:hover:bg-brand-500/10">
                            {lang === 'ar' ? 'إلغاء' : 'Cancel'}
                          </button>
                        </div>
                      ) : (
                        <ActionBtn icon={Trash2} color="red" title={lang === 'ar' ? 'حذف' : 'Delete'} onClick={() => setDeleteAppConfirm(app.id)} />
                      )}
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          </Card>
        </>
      )}

      {/* ─── Add/Edit Job Modal ─── */}
      <Modal open={showJobModal} onClose={() => setShowJobModal(false)} title={editingJob ? (lang === 'ar' ? 'تعديل الوظيفة' : 'Edit Job') : (lang === 'ar' ? 'إضافة وظيفة' : 'Add Job')}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <div>
            <label className="block text-xs text-content-muted dark:text-content-muted-dark mb-1">{lang === 'ar' ? 'المسمى (English)' : 'Title (English)'}</label>
            <input
              type="text"
              value={jobForm.title}
              onChange={e => setJobForm(f => ({ ...f, title: e.target.value }))}
              className="w-full px-3 py-2 rounded-xl border border-edge dark:border-edge-dark bg-surface-card dark:bg-surface-card-dark text-content dark:text-content-dark text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-content-muted dark:text-content-muted-dark mb-1">{lang === 'ar' ? 'المسمى (عربي)' : 'Title (Arabic)'}</label>
            <input
              type="text"
              dir="rtl"
              value={jobForm.title_ar}
              onChange={e => setJobForm(f => ({ ...f, title_ar: e.target.value }))}
              className="w-full px-3 py-2 rounded-xl border border-edge dark:border-edge-dark bg-surface-card dark:bg-surface-card-dark text-content dark:text-content-dark text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-content-muted dark:text-content-muted-dark mb-1">{lang === 'ar' ? 'القسم' : 'Department'}</label>
            <Select value={jobForm.department_id} onChange={e => setJobForm(f => ({ ...f, department_id: e.target.value }))}>
              <option value="">{lang === 'ar' ? 'اختر القسم...' : 'Select department...'}</option>
              {departments.map(d => (
                <option key={d.id} value={d.id}>{isRTL ? d.name_ar : (d.name_en || d.name_ar)}</option>
              ))}
            </Select>
          </div>
          <div>
            <label className="block text-xs text-content-muted dark:text-content-muted-dark mb-1">{lang === 'ar' ? 'نطاق الراتب' : 'Salary Range'}</label>
            <input
              type="text"
              value={jobForm.salary_range}
              onChange={e => setJobForm(f => ({ ...f, salary_range: e.target.value }))}
              className="w-full px-3 py-2 rounded-xl border border-edge dark:border-edge-dark bg-surface-card dark:bg-surface-card-dark text-content dark:text-content-dark text-sm"
              placeholder={lang === 'ar' ? 'مثال: 5000 - 8000' : 'e.g. 5000 - 8000'}
            />
          </div>
          <div>
            <label className="block text-xs text-content-muted dark:text-content-muted-dark mb-1">{lang === 'ar' ? 'تاريخ الإغلاق' : 'Closing Date'}</label>
            <input
              type="date"
              value={jobForm.closing_date}
              onChange={e => setJobForm(f => ({ ...f, closing_date: e.target.value }))}
              className="w-full px-3 py-2 rounded-xl border border-edge dark:border-edge-dark bg-surface-card dark:bg-surface-card-dark text-content dark:text-content-dark text-sm"
            />
          </div>
          <div className="col-span-full">
            <label className="block text-xs text-content-muted dark:text-content-muted-dark mb-1">{lang === 'ar' ? 'الوصف' : 'Description'}</label>
            <textarea
              rows={3}
              value={jobForm.description}
              onChange={e => setJobForm(f => ({ ...f, description: e.target.value }))}
              className="w-full px-3 py-2 rounded-xl border border-edge dark:border-edge-dark bg-surface-card dark:bg-surface-card-dark text-content dark:text-content-dark text-sm resize-none"
            />
          </div>
          <div className="col-span-full">
            <label className="block text-xs text-content-muted dark:text-content-muted-dark mb-1">{lang === 'ar' ? 'المتطلبات' : 'Requirements'}</label>
            <textarea
              rows={3}
              value={jobForm.requirements}
              onChange={e => setJobForm(f => ({ ...f, requirements: e.target.value }))}
              className="w-full px-3 py-2 rounded-xl border border-edge dark:border-edge-dark bg-surface-card dark:bg-surface-card-dark text-content dark:text-content-dark text-sm resize-none"
            />
          </div>
        </div>
        <ModalFooter className="justify-end">
          <Button variant="secondary" onClick={() => setShowJobModal(false)}>{lang === 'ar' ? 'إلغاء' : 'Cancel'}</Button>
          <Button disabled={savingJob || (!jobForm.title && !jobForm.title_ar)} onClick={handleSaveJob}>
            {savingJob ? (lang === 'ar' ? 'جاري الحفظ...' : 'Saving...') : (lang === 'ar' ? 'حفظ' : 'Save')}
          </Button>
        </ModalFooter>
      </Modal>

      {/* ─── Add Applicant Modal ─── */}
      <Modal open={showAppModal} onClose={() => setShowAppModal(false)} title={lang === 'ar' ? 'إضافة متقدم' : 'Add Applicant'}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <div className="col-span-full">
            <label className="block text-xs text-content-muted dark:text-content-muted-dark mb-1">{lang === 'ar' ? 'الوظيفة' : 'Job Posting'}</label>
            <Select value={appForm.posting_id} onChange={e => setAppForm(f => ({ ...f, posting_id: e.target.value }))}>
              <option value="">{lang === 'ar' ? 'اختر الوظيفة...' : 'Select job...'}</option>
              {jobs.map(j => (
                <option key={j.id} value={j.id}>{isRTL ? (j.title_ar || j.title) : (j.title || j.title_ar)}</option>
              ))}
            </Select>
          </div>
          <div>
            <label className="block text-xs text-content-muted dark:text-content-muted-dark mb-1">{lang === 'ar' ? 'الاسم' : 'Name'}</label>
            <input
              type="text"
              value={appForm.name}
              onChange={e => setAppForm(f => ({ ...f, name: e.target.value }))}
              className="w-full px-3 py-2 rounded-xl border border-edge dark:border-edge-dark bg-surface-card dark:bg-surface-card-dark text-content dark:text-content-dark text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-content-muted dark:text-content-muted-dark mb-1">{lang === 'ar' ? 'البريد الإلكتروني' : 'Email'}</label>
            <input
              type="email"
              value={appForm.email}
              onChange={e => setAppForm(f => ({ ...f, email: e.target.value }))}
              className="w-full px-3 py-2 rounded-xl border border-edge dark:border-edge-dark bg-surface-card dark:bg-surface-card-dark text-content dark:text-content-dark text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-content-muted dark:text-content-muted-dark mb-1">{lang === 'ar' ? 'الهاتف' : 'Phone'}</label>
            <input
              type="tel"
              value={appForm.phone}
              onChange={e => setAppForm(f => ({ ...f, phone: e.target.value }))}
              className="w-full px-3 py-2 rounded-xl border border-edge dark:border-edge-dark bg-surface-card dark:bg-surface-card-dark text-content dark:text-content-dark text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-content-muted dark:text-content-muted-dark mb-1">{lang === 'ar' ? 'رابط السيرة الذاتية' : 'Resume URL'}</label>
            <input
              type="url"
              value={appForm.resume_url}
              onChange={e => setAppForm(f => ({ ...f, resume_url: e.target.value }))}
              className="w-full px-3 py-2 rounded-xl border border-edge dark:border-edge-dark bg-surface-card dark:bg-surface-card-dark text-content dark:text-content-dark text-sm"
            />
          </div>
          <div className="col-span-full">
            <label className="block text-xs text-content-muted dark:text-content-muted-dark mb-1">{lang === 'ar' ? 'ملاحظات' : 'Notes'}</label>
            <textarea
              rows={2}
              value={appForm.notes}
              onChange={e => setAppForm(f => ({ ...f, notes: e.target.value }))}
              className="w-full px-3 py-2 rounded-xl border border-edge dark:border-edge-dark bg-surface-card dark:bg-surface-card-dark text-content dark:text-content-dark text-sm resize-none"
            />
          </div>
        </div>
        <ModalFooter className="justify-end">
          <Button variant="secondary" onClick={() => setShowAppModal(false)}>{lang === 'ar' ? 'إلغاء' : 'Cancel'}</Button>
          <Button disabled={savingApp || !appForm.name || !appForm.posting_id} onClick={handleSaveApp}>
            {savingApp ? (lang === 'ar' ? 'جاري الحفظ...' : 'Saving...') : (lang === 'ar' ? 'إضافة' : 'Add')}
          </Button>
        </ModalFooter>
      </Modal>
    </div>
  );
}
