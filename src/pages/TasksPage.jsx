import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import {
  CheckSquare, Plus, X, Clock, Phone, PhoneCall,
  Users, Mail, MessageCircle, Trash2, Check,
  User, CloudOff
} from 'lucide-react';
import { fetchTasks, createTask, updateTask, deleteTask, TASK_PRIORITIES, TASK_STATUSES, TASK_TYPES } from '../services/tasksService';
import { Button, Card, Input, Select, Textarea, Badge, PageSkeleton, ExportButton, SmartFilter, applySmartFilters, Pagination } from '../components/ui';
import { useAuditFilter } from '../hooks/useAuditFilter';
import { logAction } from '../services/auditService';

const ICONS = { Phone, PhoneCall, Users, Mail, MessageCircle, CheckSquare };

function formatDue(dateStr, lang) {
  const diff = Math.floor((new Date(dateStr) - Date.now()) / 60000);
  const abs  = Math.abs(diff);
  const past = diff < 0;
  if (abs < 60)    return { label: past ? (lang==='ar'?`تأخر ${abs}د`:`${abs}m overdue`) : (lang==='ar'?`خلال ${abs}د`:`in ${abs}m`), overdue: past };
  if (abs < 1440)  return { label: past ? (lang==='ar'?`تأخر ${Math.floor(abs/60)}س`:`${Math.floor(abs/60)}h overdue`) : (lang==='ar'?`خلال ${Math.floor(abs/60)}س`:`in ${Math.floor(abs/60)}h`), overdue: past };
  return { label: new Date(dateStr).toLocaleDateString(lang==='ar'?'ar-EG':'en-US',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'}), overdue: past };
}

export default function TasksPage() {
  const { i18n } = useTranslation();
  const { user, profile } = useAuth();
  const lang   = i18n.language;
  const isRTL   = lang === 'ar';

  const [tasks, setTasks]           = useState([]);
  const [loading, setLoading]       = useState(true);
  const [smartFilters, setSmartFilters] = useState([]);
  const [search, setSearch]         = useState('');
  const [showAdd, setShowAdd]       = useState(false);
  const [form, setForm]             = useState({ title: '', type: 'general', priority: 'medium', status: 'pending', dept: 'crm', due_date: '', notes: '', contact_name: '' });
  const [saving, setSaving]         = useState(false);
  const [page, setPage]             = useState(1);
  const [pageSize, setPageSize]     = useState(25);

  const { auditFields, applyAuditFilters } = useAuditFilter('task');

  const assignedToOptions = useMemo(() =>
    [...new Set(tasks.map(t => t.assigned_to_name_en).filter(Boolean))].map(name => {
      const match = tasks.find(t => t.assigned_to_name_en === name);
      return { value: name, label: match?.assigned_to_name_ar || name, labelEn: name };
    }),
  [tasks]);

  const SMART_FIELDS = useMemo(() => [
    { id: 'status', label: 'الحالة', labelEn: 'Status', type: 'select', options: Object.entries(TASK_STATUSES).map(([k, v]) => ({ value: k, label: v.ar, labelEn: v.en })) },
    { id: 'priority', label: 'الأولوية', labelEn: 'Priority', type: 'select', options: Object.entries(TASK_PRIORITIES).map(([k, v]) => ({ value: k, label: v.ar, labelEn: v.en })) },
    { id: 'dept', label: 'القسم', labelEn: 'Department', type: 'select', options: [
      { value: 'crm', label: 'CRM', labelEn: 'CRM' },
      { value: 'hr', label: 'HR', labelEn: 'HR' },
      { value: 'finance', label: 'المالية', labelEn: 'Finance' },
      { value: 'general', label: 'عام', labelEn: 'General' },
    ]},
    { id: 'assigned_to_name_en', label: 'المسؤول', labelEn: 'Assigned To', type: 'select', options: assignedToOptions },
    { id: 'title', label: 'العنوان', labelEn: 'Title', type: 'text' },
    { id: 'contact_name', label: 'العميل', labelEn: 'Contact', type: 'text' },
    { id: 'due_date', label: 'تاريخ الاستحقاق', labelEn: 'Due Date', type: 'date' },
    { id: 'created_at', label: 'تاريخ الإنشاء', labelEn: 'Created At', type: 'date' },
    ...auditFields,
  ], [assignedToOptions, auditFields]);

  const SORT_OPTIONS = useMemo(() => [
    { value: 'due_date_asc', label: 'الاستحقاق (الأقرب)', labelEn: 'Due Date (soonest)' },
    { value: 'due_date_desc', label: 'الاستحقاق (الأبعد)', labelEn: 'Due Date (latest)' },
    { value: 'created_at_desc', label: 'الأحدث', labelEn: 'Newest' },
    { value: 'created_at_asc', label: 'الأقدم', labelEn: 'Oldest' },
    { value: 'priority_desc', label: 'الأولوية (الأعلى)', labelEn: 'Priority (highest)' },
  ], []);

  const [sortBy, setSortBy] = useState('due_date_asc');

  const load = async () => {
    setLoading(true);
    try { setTasks(await fetchTasks()); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    let result = applySmartFilters(tasks, smartFilters, SMART_FIELDS);
    result = applyAuditFilters(result, smartFilters);
    if (search) {
      const s = search.toLowerCase();
      result = result.filter(t => t.title?.toLowerCase().includes(s) || t.contact_name?.toLowerCase().includes(s));
    }
    // Sort
    const PRIORITY_ORDER = { high: 0, medium: 1, low: 2 };
    result = [...result].sort((a, b) => {
      switch (sortBy) {
        case 'due_date_asc': return new Date(a.due_date) - new Date(b.due_date);
        case 'due_date_desc': return new Date(b.due_date) - new Date(a.due_date);
        case 'created_at_desc': return new Date(b.created_at) - new Date(a.created_at);
        case 'created_at_asc': return new Date(a.created_at) - new Date(b.created_at);
        case 'priority_desc': return (PRIORITY_ORDER[a.priority] ?? 9) - (PRIORITY_ORDER[b.priority] ?? 9);
        default: return 0;
      }
    });
    return result;
  }, [tasks, smartFilters, SMART_FIELDS, search, sortBy]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const paged = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);
  useEffect(() => { if (page > totalPages) setPage(totalPages); }, [page, totalPages]);
  useEffect(() => { setPage(1); }, [search, smartFilters, sortBy]);

  const stats = useMemo(() => ({
    total:   tasks.length,
    pending: tasks.filter(t => t.status === 'pending').length,
    overdue: tasks.filter(t => t.status !== 'done' && new Date(t.due_date) < new Date()).length,
    done:    tasks.filter(t => t.status === 'done').length,
  }), [tasks]);

  const handleAdd = async () => {
    if (!form.title.trim() || !form.due_date) return;
    setSaving(true);
    try {
      const t = await createTask({ ...form, assigned_to_name_ar: 'أنت', assigned_to_name_en: 'You' });
      logAction({ action: 'create', entity: 'task', entityId: t.id, entityName: t.title || '', description: 'Created task', userName: profile?.full_name_ar || profile?.full_name_en || '' });
      setTasks(prev => [t, ...prev]);
      setForm({ title: '', type: 'general', priority: 'medium', status: 'pending', dept: 'crm', due_date: '', notes: '', contact_name: '' });
      setShowAdd(false);
    } finally { setSaving(false); }
  };

  const handleStatus = async (task, newStatus) => {
    const oldStatus = task.status;
    await updateTask(task.id, { status: newStatus });
    logAction({ action: 'status_change', entity: 'task', entityId: task.id, entityName: task.title || '', description: `Changed task status from ${oldStatus} to ${newStatus}`, oldValue: oldStatus, newValue: newStatus, userName: profile?.full_name_ar || profile?.full_name_en || '' });
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: newStatus } : t));
  };

  const handleDelete = async (id) => {
    const task = tasks.find(t => t.id === id);
    await deleteTask(id);
    logAction({ action: 'delete', entity: 'task', entityId: id, entityName: task?.title || '', description: 'Deleted task', userName: profile?.full_name_ar || profile?.full_name_en || '' });
    setTasks(prev => prev.filter(t => t.id !== id));
  };

  if (loading) return <PageSkeleton hasKpis={false} tableRows={6} tableCols={5} variant="list" />;

  return (
    <div className={`px-4 py-4 md:px-7 md:py-6 bg-surface-bg dark:bg-surface-bg-dark min-h-screen ${isRTL ? 'direction-rtl' : 'direction-ltr'}`} dir={isRTL ? 'rtl' : 'ltr'}>

      {/* Header */}
      <div className={`flex flex-wrap items-center justify-between gap-3 mb-5 ${isRTL ? 'flex-row-reverse' : 'flex-row'}`}>
        <div className={`flex items-center gap-3 ${isRTL ? 'flex-row-reverse' : 'flex-row'}`}>
          <div className="w-10 h-10 rounded-xl bg-brand-500/[0.12] flex items-center justify-center">
            <CheckSquare size={20} className="text-brand-500" />
          </div>
          <div>
            <h1 className="m-0 text-xl font-bold text-content dark:text-content-dark">{lang === 'ar' ? 'المهام' : 'Tasks'}</h1>
            <p className="m-0 text-xs text-content-muted dark:text-content-muted-dark">{lang === 'ar' ? 'كل المهام والمتابعات' : 'All tasks & follow-ups'}</p>
          </div>
        </div>
        <div className={`flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : 'flex-row'}`}>
          <ExportButton
            data={filtered}
            filename={isRTL ? 'المهام' : 'tasks'}
            title={isRTL ? 'المهام' : 'Tasks'}
            columns={[
              { header: isRTL ? 'العنوان' : 'Title', key: 'title' },
              { header: isRTL ? 'النوع' : 'Type', key: r => isRTL ? TASK_TYPES[r.type]?.ar : TASK_TYPES[r.type]?.en },
              { header: isRTL ? 'الأولوية' : 'Priority', key: r => isRTL ? TASK_PRIORITIES[r.priority]?.ar : TASK_PRIORITIES[r.priority]?.en },
              { header: isRTL ? 'الحالة' : 'Status', key: r => isRTL ? TASK_STATUSES[r.status]?.ar : TASK_STATUSES[r.status]?.en },
              { header: isRTL ? 'تاريخ الاستحقاق' : 'Due Date', key: 'due_date' },
              { header: isRTL ? 'العميل' : 'Contact', key: 'contact_name' },
            ]}
          />
          <Button
            variant={showAdd ? 'secondary' : 'primary'}
            size="sm"
            onClick={() => setShowAdd(!showAdd)}
            className={isRTL ? 'flex-row-reverse' : ''}
          >
            {showAdd ? <X size={15} /> : <Plus size={15} />}
            {showAdd ? (lang === 'ar' ? 'إلغاء' : 'Cancel') : (lang === 'ar' ? 'مهمة جديدة' : 'New Task')}
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 mb-5">
        {[
          { label: lang==='ar'?'الكل':'Total',    value: stats.total,   color: '#4A7AAB'  },
          { label: lang==='ar'?'معلقة':'Pending', value: stats.pending, color: '#F97316' },
          { label: lang==='ar'?'متأخرة':'Overdue',value: stats.overdue, color: '#EF4444' },
          { label: lang==='ar'?'مكتملة':'Done',   value: stats.done,    color: '#4A7AAB' },
        ].map((s,i) => (
          <Card key={i} className="px-4 py-3">
            <div className="text-xs text-content-muted dark:text-content-muted-dark mb-1">{s.label}</div>
            <div className="text-2xl font-bold" style={{ color: s.color }}>{s.value}</div>
          </Card>
        ))}
      </div>

      {/* Add Form */}
      {showAdd && (
        <Card className="p-5 mb-3.5">
          <div className="grid grid-cols-2 gap-2.5 mb-2.5">
            <div className="col-span-2">
              <Input value={form.title} onChange={e => setForm(f=>({...f,title:e.target.value}))}
                placeholder={lang==='ar'?'عنوان المهمة...':'Task title...'} className={isRTL ? 'direction-rtl' : 'direction-ltr'} />
            </div>
            <Select value={form.type} onChange={e => setForm(f=>({...f,type:e.target.value}))} className={isRTL ? 'direction-rtl' : 'direction-ltr'}>
              {Object.entries(TASK_TYPES).map(([k,v]) => <option key={k} value={k}>{lang==='ar'?v.ar:v.en}</option>)}
            </Select>
            <Select value={form.priority} onChange={e => setForm(f=>({...f,priority:e.target.value}))} className={isRTL ? 'direction-rtl' : 'direction-ltr'}>
              {Object.entries(TASK_PRIORITIES).map(([k,v]) => <option key={k} value={k}>{lang==='ar'?v.ar:v.en}</option>)}
            </Select>
            <Select value={form.dept} onChange={e => setForm(f=>({...f,dept:e.target.value}))} className={isRTL ? 'direction-rtl' : 'direction-ltr'}>
              {[['crm','CRM'],['hr','HR'],['finance',lang==='ar'?'المالية':'Finance'],['general',lang==='ar'?'عام':'General']].map(([k,v])=>(
                <option key={k} value={k}>{v}</option>
              ))}
            </Select>
            <Input type="datetime-local" value={form.due_date} onChange={e => setForm(f=>({...f,due_date:e.target.value}))} className={isRTL ? 'direction-rtl' : 'direction-ltr'} />
            <Input value={form.contact_name} onChange={e => setForm(f=>({...f,contact_name:e.target.value}))}
              placeholder={lang==='ar'?'اسم العميل (اختياري)':'Contact name (optional)'} className={isRTL ? 'direction-rtl' : 'direction-ltr'} />
            <Textarea value={form.notes} onChange={e => setForm(f=>({...f,notes:e.target.value}))}
              placeholder={lang==='ar'?'ملاحظات...':'Notes...'} rows={2}
              className={`col-span-2 ${isRTL ? 'direction-rtl' : 'direction-ltr'}`} />
          </div>
          <div className={`flex gap-2 ${isRTL ? 'justify-start' : 'justify-end'}`}>
            <Button variant="secondary" size="sm" onClick={()=>setShowAdd(false)}>
              {lang==='ar'?'إلغاء':'Cancel'}
            </Button>
            <Button variant="primary" size="sm" onClick={handleAdd} disabled={saving||!form.title.trim()||!form.due_date}>
              {saving?'...':(lang==='ar'?'حفظ':'Save')}
            </Button>
          </div>
        </Card>
      )}

      {/* Filters */}
      <SmartFilter
        fields={SMART_FIELDS}
        filters={smartFilters}
        onFiltersChange={setSmartFilters}
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder={lang === 'ar' ? 'بحث بالعنوان أو العميل...' : 'Search by title or contact...'}
        sortOptions={SORT_OPTIONS}
        sortBy={sortBy}
        onSortChange={setSortBy}
        resultsCount={filtered.length}
      />

      {/* Tasks List */}
      <Card className="overflow-hidden">
        {loading ? (
          <div className="text-center p-12 text-content-muted dark:text-content-muted-dark">{lang==='ar'?'جاري التحميل...':'Loading...'}</div>
        ) : filtered.length === 0 ? (
            <div className="text-center py-[60px] px-5">
                <div className="w-16 h-16 rounded-2xl bg-brand-500/10 flex items-center justify-center mx-auto mb-4">
                  <CheckSquare size={24} className="text-brand-500" />
                </div>
                <p className="m-0 mb-1.5 text-sm font-bold text-content dark:text-content-dark">{lang==='ar'?'لا توجد مهام':'No Tasks Found'}</p>
                <p className="m-0 text-xs text-content-muted dark:text-content-muted-dark">{lang==='ar'?'لم يتم إضافة أي مهام بعد أو جرّب تغيير الفلتر':'No tasks found, try changing the filter'}</p>
              </div>
            ) : paged.map((task, idx) => {
          const typeDef = TASK_TYPES[task.type] || TASK_TYPES.general;
          const Ic = ICONS[typeDef.icon] || CheckSquare;
          const priDef = TASK_PRIORITIES[task.priority];
          const stDef  = TASK_STATUSES[task.status];
          const due    = formatDue(task.due_date, lang);
          const isDone = task.status === 'done';

          return (
            <div key={task.id} className={`
              flex items-start gap-3 px-4 py-3
              ${idx < paged.length-1 ? 'border-b border-edge dark:border-edge-dark' : ''}
              ${isRTL ? 'flex-row-reverse' : 'flex-row'}
              ${isDone ? 'opacity-65' : 'opacity-100'}
              transition-colors duration-150 hover:bg-gray-50 dark:hover:bg-brand-500/[0.06]
            `}>
              {/* Done toggle */}
              <button onClick={() => handleStatus(task, isDone ? 'pending' : 'done')} className={`
                w-5 h-5 rounded-[5px] border-2 flex items-center justify-center cursor-pointer shrink-0 mt-0.5
                ${isDone
                  ? 'border-brand-500 bg-brand-500'
                  : 'border-edge dark:border-edge-dark bg-transparent'}
              `}>
                {isDone && <Check size={11} color="#fff" />}
              </button>

              {/* Type icon */}
              <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                style={{ background: (priDef?.color||'#4A7AAB')+'18' }}>
                <Ic size={14} color={priDef?.color||'#4A7AAB'} />
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className={`flex items-center gap-[7px] flex-wrap ${isRTL ? 'flex-row-reverse' : 'flex-row'}`}>
                  <span className={`text-sm font-semibold text-content dark:text-content-dark ${isDone ? 'line-through' : ''}`}>{task.title}</span>
                  <Badge size="sm" style={{ background: (priDef?.color||'#4A7AAB')+'18', color: priDef?.color||'#4A7AAB' }}>
                    {lang==='ar'?priDef?.ar:priDef?.en}
                  </Badge>
                  <Badge size="sm" style={{ background: (stDef?.color||'#4A7AAB')+'18', color: stDef?.color||'#4A7AAB' }}>
                    {lang==='ar'?stDef?.ar:stDef?.en}
                  </Badge>
                  {task.contact_name && (
                    <span className="text-xs text-brand-500 flex items-center gap-[3px]">
                      <User size={10} /> {task.contact_name}
                    </span>
                  )}
                  {task._offline && (
                    <Badge size="sm" style={{ background: 'rgba(239,68,68,0.1)', color: '#EF4444', gap: '3px', display: 'inline-flex', alignItems: 'center' }}>
                      <CloudOff size={9} /> {lang === 'ar' ? 'غير متزامن' : 'Offline'}
                    </Badge>
                  )}
                </div>
                <div className={`flex items-center gap-2.5 mt-[3px] ${isRTL ? 'flex-row-reverse' : 'flex-row'}`}>
                  <span className={`text-xs flex items-center gap-[3px] ${
                    due.overdue && !isDone
                      ? 'text-red-500 font-semibold'
                      : 'text-content-muted dark:text-content-muted-dark font-normal'
                  }`}>
                    <Clock size={10} /> {due.label}
                  </span>
                  {task.assigned_to_name_ar && (
                    <span className="text-xs text-content-muted dark:text-content-muted-dark">
                      {lang==='ar'?task.assigned_to_name_ar:task.assigned_to_name_en}
                    </span>
                  )}
                  {task.dept && (
                    <Badge size="sm" variant="default" className="!text-[10px]">
                      {task.dept.toUpperCase()}
                    </Badge>
                  )}
                </div>
                {task.notes && <div className="text-xs text-content-muted dark:text-content-muted-dark mt-[3px]">{task.notes}</div>}
              </div>

              {/* Actions */}
              <div className="flex gap-1 shrink-0">
                {task.status !== 'in_progress' && task.status !== 'done' && (
                  <Button variant="secondary" size="sm" onClick={() => handleStatus(task, 'in_progress')} className="!text-xs !px-[9px] !py-1">
                    {lang==='ar'?'جارية':'Start'}
                  </Button>
                )}
                <button onClick={() => handleDelete(task.id)} className="p-[4px_7px] rounded-md border-none bg-transparent text-content-muted dark:text-content-muted-dark cursor-pointer opacity-50 hover:opacity-100 transition-opacity">
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          );
        })}
      </Card>

      <Pagination
        page={page}
        totalPages={totalPages}
        onPageChange={setPage}
        pageSize={pageSize}
        onPageSizeChange={v => { setPageSize(v); setPage(1); }}
        totalItems={filtered.length}
        safePage={safePage}
      />
    </div>
  );
}
