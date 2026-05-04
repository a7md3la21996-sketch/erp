import supabase from '../../lib/supabase';
import { reportError } from '../../utils/errorReporter';
import { useState, useEffect, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useToast } from '../../contexts/ToastContext';
import { BookOpen, Users, CheckCircle2, Clock, Plus, GraduationCap, Edit2, Trash2 } from 'lucide-react';
import { KpiCard, Badge, Button, Card, CardHeader, Table, Th, Td, Tr, ExportButton, Pagination, SmartFilter, applySmartFilters, Modal, ModalFooter, Select } from '../../components/ui';
import { useAuditFilter } from '../../hooks/useAuditFilter';

const TABLE = 'training';

export default function TrainingPage() {
  const { i18n } = useTranslation();
  const toast = useToast();
  const isRTL = i18n.language==='ar'; const lang = i18n.language;
  const [programs, setPrograms] = useState([]);
  const [loading, setLoading] = useState(true);

  const emptyForm = {
    title: '', title_en: '', category: 'sales',
    duration: 8, enrolled: 0, completed: 0,
    status: 'upcoming', start: new Date().toISOString().slice(0, 10),
  };
  const [modalOpen, setModalOpen] = useState(false);
  const [editingProg, setEditingProg] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const openNew = () => { setEditingProg(null); setForm(emptyForm); setModalOpen(true); };
  const openEdit = (prog) => {
    setEditingProg(prog);
    setForm({
      title: prog.title || '', title_en: prog.title_en || '',
      category: prog.category || 'sales',
      duration: prog.duration ?? 8,
      enrolled: prog.enrolled ?? 0,
      completed: prog.completed ?? 0,
      status: prog.status || 'upcoming',
      start: prog.start || new Date().toISOString().slice(0, 10),
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.title.trim() && !form.title_en.trim()) {
      toast.error(lang === 'ar' ? 'يجب إدخال اسم البرنامج' : 'Program title is required');
      return;
    }
    if (Number(form.completed) > Number(form.enrolled)) {
      toast.error(lang === 'ar' ? 'عدد المكتملين أكبر من المسجلين' : 'Completed cannot exceed enrolled');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        ...form,
        duration: Number(form.duration) || 0,
        enrolled: Number(form.enrolled) || 0,
        completed: Number(form.completed) || 0,
      };
      if (editingProg) {
        const { data, error } = await supabase
          .from(TABLE)
          .update({ ...payload, updated_at: new Date().toISOString() })
          .eq('id', editingProg.id)
          .select('*')
          .single();
        if (error) throw error;
        setPrograms(prev => prev.map(p => p.id === editingProg.id ? data : p));
        toast.success(lang === 'ar' ? 'تم حفظ التعديلات' : 'Program updated');
      } else {
        const { data, error } = await supabase
          .from(TABLE)
          .insert([{ ...payload, created_at: new Date().toISOString() }])
          .select('*')
          .single();
        if (error) throw error;
        setPrograms(prev => [data, ...prev]);
        toast.success(lang === 'ar' ? 'تم إضافة البرنامج' : 'Program created');
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
      setPrograms(prev => prev.filter(p => p.id !== deleteTarget.id));
      toast.success(lang === 'ar' ? 'تم الحذف' : 'Deleted');
    } catch (err) {
      toast.error(lang === 'ar' ? 'فشل الحذف' : 'Delete failed');
      reportError(`supabase.${TABLE}`, 'delete', err);
    } finally {
      setDeleteTarget(null);
    }
  };

  // Fetch from Supabase on mount. No auto-seeding to avoid polluting a
  // fresh production database with fabricated programs.
  const fetchPrograms = useCallback(async () => {
    try {
      const { data, error } = await supabase.from(TABLE).select('*').order('created_at', { ascending: false });
      if (error) throw error;
      setPrograms(data || []);
    } catch (err) {
      reportError(`supabase.${TABLE}`, 'fetch', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchPrograms(); }, [fetchPrograms]);

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [smartFilters, setSmartFilters] = useState([]);

  const { auditFields, applyAuditFilters } = useAuditFilter('training');

  const SMART_FIELDS = useMemo(() => [
    ...auditFields,
  ], [auditFields]);

  const filtered = useMemo(() => {
    let result = programs;
    result = applySmartFilters(result, smartFilters, SMART_FIELDS);
    result = applyAuditFilters(result, smartFilters);
    return result;
  }, [programs, smartFilters, SMART_FIELDS]);

  const active    = filtered.filter(p=>p.status==='active').length;
  const totalEnr  = filtered.reduce((s,p)=>s+(p.enrolled||0),0);
  const totalComp = filtered.reduce((s,p)=>s+(p.completed||0),0);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const paged = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);
  useEffect(() => { if (page > totalPages) setPage(totalPages); }, [page, totalPages]);

  const statusColor = s => s==='completed'?'#4A7AAB':s==='active'?'#6B8DB5':'#8BA8C8';
  const statusLabel = (s,lang) => ({ active:lang==='ar'?'نشط':'Active', completed:lang==='ar'?'مكتمل':'Completed', upcoming:lang==='ar'?'قادم':'Upcoming' }[s]||s);

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} className="px-4 py-4 md:px-7 md:py-6 bg-surface-bg dark:bg-surface-bg-dark min-h-screen">
      {/* Header */}
      <div className={`flex justify-between items-center mb-5 ${isRTL ? 'flex-row-reverse' : ''}`}>
        <div className={`flex items-center gap-3.5 ${isRTL ? 'flex-row-reverse' : ''}`}>
          <div className="w-10 h-10 rounded-xl bg-brand-500/[0.12] flex items-center justify-center">
            <BookOpen size={22} className="text-brand-500" />
          </div>
          <div className={'text-start'}>
            <h1 className="m-0 text-xl font-bold text-content dark:text-content-dark">{lang==='ar'?'التدريب والتطوير':'Training & Development'}</h1>
            <p className="m-0 text-xs text-content-muted dark:text-content-muted-dark">{lang==='ar'?'برامج تطوير الكفاءات':'Skills development programs'}</p>
          </div>
        </div>
        <div className={`flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : 'flex-row'}`}>
          <ExportButton
            data={filtered}
            filename={isRTL ? 'التدريب' : 'training'}
            title={isRTL ? 'التدريب والتطوير' : 'Training & Development'}
            columns={[
              { header: isRTL ? 'البرنامج' : 'Program', key: r => isRTL ? r.title : r.title_en },
              { header: isRTL ? 'التصنيف' : 'Category', key: 'category' },
              { header: isRTL ? 'المدة (ساعات)' : 'Duration (hrs)', key: 'duration' },
              { header: isRTL ? 'المسجلين' : 'Enrolled', key: 'enrolled' },
              { header: isRTL ? 'المكتملين' : 'Completed', key: 'completed' },
              { header: isRTL ? 'الحالة' : 'Status', key: r => statusLabel(r.status, lang) },
            ]}
          />
          <Button size="md" onClick={openNew}><Plus size={16}/>{lang==='ar'?'+ برنامج جديد':'+ New Program'}</Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5 mb-5">
        <KpiCard icon={BookOpen}     label={lang==='ar'?'إجمالي البرامج':'Total Programs'} value={filtered.length} color="#1B3347" />
        <KpiCard icon={Clock}        label={lang==='ar'?'نشطة':'Active'}            value={active}          color="#6B8DB5" />
        <KpiCard icon={Users}        label={lang==='ar'?'إجمالي المسجلين':'Enrolled'}         value={totalEnr}        color="#4A7AAB" />
        <KpiCard icon={CheckCircle2} label={lang==='ar'?'أتموا التدريب':'Completed'}        value={totalComp}       color="#2B4C6F" />
      </div>

      <SmartFilter fields={SMART_FIELDS} filters={smartFilters} onFiltersChange={setSmartFilters} />

      {/* Program Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 mb-4">
        {filtered.length === 0 ? (
          <div className="text-center py-16 px-5 col-span-2">
            <div className="w-16 h-16 rounded-2xl bg-brand-500/10 flex items-center justify-center mx-auto mb-4">
              <GraduationCap size={24} color='#4A7AAB' />
            </div>
            <p className="m-0 mb-1.5 text-sm font-bold text-content dark:text-content-dark">{lang==='ar'?'لا توجد برامج تدريبية':'No Training Programs'}</p>
            <p className="m-0 text-xs text-content-muted dark:text-content-muted-dark">{lang==='ar'?'لم يتم إضافة أي برامج تدريبية بعد':'No training programs added yet'}</p>
          </div>
        ) : paged.map(prog => {
          const pct = prog.enrolled ? Math.round(prog.completed/prog.enrolled*100) : 0;
          return (
            <Card key={prog.id} hover className="p-5">
              <div className={`flex justify-between items-start mb-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
                <div className={'text-start flex-1 min-w-0'}>
                  <p className="m-0 mb-1 text-sm font-bold text-content dark:text-content-dark">{lang==='ar'?prog.title:prog.title_en}</p>
                  <p className="m-0 text-xs text-content-muted dark:text-content-muted-dark">{prog.duration} {lang==='ar'?'ساعة':'hrs'} • {prog.start}</p>
                </div>
                <div className={`flex items-center gap-1.5 shrink-0 ${isRTL ? 'flex-row-reverse' : ''}`}>
                  <Badge style={{ background:statusColor(prog.status)+'18', color:statusColor(prog.status), border:`1px solid ${statusColor(prog.status)}35` }}>{statusLabel(prog.status,lang)}</Badge>
                  <button
                    onClick={() => openEdit(prog)}
                    title={lang === 'ar' ? 'تعديل' : 'Edit'}
                    className="p-1.5 rounded-lg text-content-muted hover:bg-brand-500/10 hover:text-brand-500 transition-colors"
                  >
                    <Edit2 size={13} />
                  </button>
                  <button
                    onClick={() => setDeleteTarget(prog)}
                    title={lang === 'ar' ? 'حذف' : 'Delete'}
                    className="p-1.5 rounded-lg text-content-muted hover:bg-red-500/10 hover:text-red-500 transition-colors"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
              <div className={`flex justify-between mb-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                <span className="text-xs text-content-muted dark:text-content-muted-dark">{lang==='ar'?'التقدم':'Progress'}: {pct}%</span>
                <span className="text-xs font-semibold text-brand-500">{prog.completed}/{prog.enrolled} {lang==='ar'?'موظف':'emp'}</span>
              </div>
              <div className="h-[5px] rounded-sm bg-slate-200 dark:bg-white/[0.08]">
                <div className="h-full rounded-sm transition-[width] duration-500" style={{ width:pct+'%', background:'linear-gradient(90deg,#1B3347,#4A7AAB)' }} />
              </div>
            </Card>
          );
        })}
      </div>

      {/* Training Records Table */}
      <Card className="overflow-hidden">
        <CardHeader>
          <p className="m-0 text-sm font-bold text-content dark:text-content-dark">{lang==='ar'?'سجل التدريب':'Training Records'}</p>
        </CardHeader>
        <Table>
          <thead>
            <tr>
              {[lang==='ar'?'البرنامج':'Program', lang==='ar'?'المدة':'Duration', lang==='ar'?'مسجلون':'Enrolled', lang==='ar'?'أتموا':'Completed', lang==='ar'?'الحالة':'Status'].map((h,i)=>(
                <Th key={i}>{h}</Th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paged.map(prog => (
              <Tr key={prog.id}>
                <Td>
                  <div className={`flex items-center gap-2.5 ${isRTL ? 'flex-row-reverse' : ''}`}>
                    <div className="w-8 h-8 rounded-[9px] flex items-center justify-center shrink-0" style={{ background:'linear-gradient(135deg,#1B3347,#4A7AAB)' }}>
                      <BookOpen size={14} color="#fff" />
                    </div>
                    <span className="font-bold">{lang==='ar'?prog.title:prog.title_en}</span>
                  </div>
                </Td>
                <Td className="text-content-muted dark:text-content-muted-dark">{prog.duration}h</Td>
                <Td className="font-semibold text-brand-500">{prog.enrolled}</Td>
                <Td className="font-semibold">{prog.completed}</Td>
                <Td><Badge style={{ background:statusColor(prog.status)+'18', color:statusColor(prog.status), border:`1px solid ${statusColor(prog.status)}35` }}>{statusLabel(prog.status,lang)}</Badge></Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      </Card>
      <Pagination page={safePage} totalPages={totalPages} onPageChange={setPage} pageSize={pageSize} onPageSizeChange={(s) => { setPageSize(s); setPage(1); }} totalItems={filtered.length} />

      {/* ── Add / Edit Modal ── */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingProg
          ? (lang === 'ar' ? 'تعديل البرنامج' : 'Edit Program')
          : (lang === 'ar' ? 'برنامج تدريبي جديد' : 'New Training Program')}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <div>
            <label className="block text-xs text-content-muted dark:text-content-muted-dark mb-1">{lang === 'ar' ? 'الاسم (AR)' : 'Title (AR)'}</label>
            <input
              dir="rtl"
              value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              className="w-full px-3 py-2 rounded-xl border border-edge dark:border-edge-dark bg-surface-card dark:bg-surface-card-dark text-content dark:text-content-dark text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-content-muted dark:text-content-muted-dark mb-1">{lang === 'ar' ? 'الاسم (EN)' : 'Title (EN)'}</label>
            <input
              value={form.title_en}
              onChange={e => setForm(f => ({ ...f, title_en: e.target.value }))}
              className="w-full px-3 py-2 rounded-xl border border-edge dark:border-edge-dark bg-surface-card dark:bg-surface-card-dark text-content dark:text-content-dark text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-content-muted dark:text-content-muted-dark mb-1">{lang === 'ar' ? 'التصنيف' : 'Category'}</label>
            <Select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
              <option value="sales">{lang === 'ar' ? 'مبيعات' : 'Sales'}</option>
              <option value="crm">{lang === 'ar' ? 'علاقات عملاء' : 'CRM'}</option>
              <option value="real_estate">{lang === 'ar' ? 'عقارات' : 'Real Estate'}</option>
              <option value="marketing">{lang === 'ar' ? 'تسويق' : 'Marketing'}</option>
              <option value="leadership">{lang === 'ar' ? 'قيادة' : 'Leadership'}</option>
              <option value="technical">{lang === 'ar' ? 'تقني' : 'Technical'}</option>
              <option value="soft_skills">{lang === 'ar' ? 'مهارات شخصية' : 'Soft Skills'}</option>
            </Select>
          </div>
          <div>
            <label className="block text-xs text-content-muted dark:text-content-muted-dark mb-1">{lang === 'ar' ? 'الحالة' : 'Status'}</label>
            <Select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
              <option value="upcoming">{lang === 'ar' ? 'قادم' : 'Upcoming'}</option>
              <option value="active">{lang === 'ar' ? 'نشط' : 'Active'}</option>
              <option value="completed">{lang === 'ar' ? 'مكتمل' : 'Completed'}</option>
            </Select>
          </div>
          <div>
            <label className="block text-xs text-content-muted dark:text-content-muted-dark mb-1">{lang === 'ar' ? 'المدة (ساعات)' : 'Duration (hrs)'}</label>
            <input
              type="number" min="0"
              value={form.duration}
              onChange={e => setForm(f => ({ ...f, duration: e.target.value }))}
              className="w-full px-3 py-2 rounded-xl border border-edge dark:border-edge-dark bg-surface-card dark:bg-surface-card-dark text-content dark:text-content-dark text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-content-muted dark:text-content-muted-dark mb-1">{lang === 'ar' ? 'تاريخ البدء' : 'Start Date'}</label>
            <input
              type="date"
              value={form.start}
              onChange={e => setForm(f => ({ ...f, start: e.target.value }))}
              className="w-full px-3 py-2 rounded-xl border border-edge dark:border-edge-dark bg-surface-card dark:bg-surface-card-dark text-content dark:text-content-dark text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-content-muted dark:text-content-muted-dark mb-1">{lang === 'ar' ? 'المسجلون' : 'Enrolled'}</label>
            <input
              type="number" min="0"
              value={form.enrolled}
              onChange={e => setForm(f => ({ ...f, enrolled: e.target.value }))}
              className="w-full px-3 py-2 rounded-xl border border-edge dark:border-edge-dark bg-surface-card dark:bg-surface-card-dark text-content dark:text-content-dark text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-content-muted dark:text-content-muted-dark mb-1">{lang === 'ar' ? 'المكتملون' : 'Completed'}</label>
            <input
              type="number" min="0" max={form.enrolled || undefined}
              value={form.completed}
              onChange={e => setForm(f => ({ ...f, completed: e.target.value }))}
              className="w-full px-3 py-2 rounded-xl border border-edge dark:border-edge-dark bg-surface-card dark:bg-surface-card-dark text-content dark:text-content-dark text-sm"
            />
          </div>
        </div>
        <ModalFooter>
          <Button variant="secondary" onClick={() => setModalOpen(false)}>{lang === 'ar' ? 'إلغاء' : 'Cancel'}</Button>
          <Button onClick={handleSave} disabled={saving || (!form.title.trim() && !form.title_en.trim())}>
            {saving ? (lang === 'ar' ? 'جاري الحفظ...' : 'Saving...') : (lang === 'ar' ? 'حفظ' : 'Save')}
          </Button>
        </ModalFooter>
      </Modal>

      {/* ── Delete Confirm ── */}
      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title={lang === 'ar' ? 'تأكيد الحذف' : 'Confirm Delete'}>
        <p className="text-sm text-content dark:text-content-dark mb-2">
          {lang === 'ar' ? 'هل أنت متأكد من حذف هذا البرنامج؟' : 'Are you sure you want to delete this program?'}
        </p>
        {deleteTarget && (
          <p className="text-xs text-content-muted dark:text-content-muted-dark">
            {(isRTL ? deleteTarget.title : deleteTarget.title_en) || deleteTarget.title}
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
