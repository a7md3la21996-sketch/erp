import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import {
  CheckSquare, Plus, X, Search, Clock, Phone, PhoneCall,
  Users, Mail, MessageCircle, Filter, Trash2, Check,
  AlertCircle, Calendar, User, ChevronDown
} from 'lucide-react';
import { fetchTasks, createTask, updateTask, deleteTask, TASK_PRIORITIES, TASK_STATUSES, TASK_TYPES } from '../services/tasksService';
import { Button, Card, Input, Select, Textarea, Badge, KpiCard } from '../components/ui';
import ExportButton from '../components/ui/ExportButton';

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
  const { user } = useAuth();
  const lang   = i18n.language;
  const isRTL   = lang === 'ar';

  const [tasks, setTasks]           = useState([]);
  const [loading, setLoading]       = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [deptFilter, setDeptFilter] = useState('all');
  const [search, setSearch]         = useState('');
  const [showAdd, setShowAdd]       = useState(false);
  const [form, setForm]             = useState({ title: '', type: 'general', priority: 'medium', status: 'pending', dept: 'crm', due_date: '', notes: '', contact_name: '' });
  const [saving, setSaving]         = useState(false);

  const load = async () => {
    setLoading(true);
    try { setTasks(await fetchTasks()); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    return tasks.filter(t => {
      if (statusFilter !== 'all' && t.status !== statusFilter) return false;
      if (priorityFilter !== 'all' && t.priority !== priorityFilter) return false;
      if (deptFilter !== 'all' && t.dept !== deptFilter) return false;
      if (search && !t.title?.includes(search) && !t.contact_name?.includes(search)) return false;
      return true;
    });
  }, [tasks, statusFilter, priorityFilter, deptFilter, search]);

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
      setTasks(prev => [t, ...prev]);
      setForm({ title: '', type: 'general', priority: 'medium', status: 'pending', dept: 'crm', due_date: '', notes: '', contact_name: '' });
      setShowAdd(false);
    } finally { setSaving(false); }
  };

  const handleStatus = async (task, newStatus) => {
    await updateTask(task.id, { status: newStatus });
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: newStatus } : t));
  };

  const handleDelete = async (id) => {
    await deleteTask(id);
    setTasks(prev => prev.filter(t => t.id !== id));
  };

  return (
    <div className={`p-6 bg-surface-bg dark:bg-surface-bg-dark min-h-screen ${isRTL ? 'direction-rtl' : 'direction-ltr'}`} dir={isRTL ? 'rtl' : 'ltr'}>

      {/* Header */}
      <div className={`flex items-center justify-between mb-5 ${isRTL ? 'flex-row-reverse' : 'flex-row'}`}>
        <div className={`flex items-center gap-3 ${isRTL ? 'flex-row-reverse' : 'flex-row'}`}>
          <div className="w-[42px] h-[42px] rounded-[10px] bg-brand-500 flex items-center justify-center">
            <CheckSquare size={20} color="#fff" />
          </div>
          <div>
            <h1 className="m-0 text-[22px] font-bold text-content dark:text-content-dark">{lang === 'ar' ? 'المهام' : 'Tasks'}</h1>
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
      <div className="grid grid-cols-4 gap-2.5 mb-4">
        {[
          { label: lang==='ar'?'الكل':'Total',    value: stats.total,   color: '#4A7AAB'  },
          { label: lang==='ar'?'معلقة':'Pending', value: stats.pending, color: '#F97316' },
          { label: lang==='ar'?'متأخرة':'Overdue',value: stats.overdue, color: '#EF4444' },
          { label: lang==='ar'?'مكتملة':'Done',   value: stats.done,    color: '#4A7AAB' },
        ].map((s,i) => (
          <Card key={i} className="px-4 py-3">
            <div className="text-[11px] text-content-muted dark:text-content-muted-dark mb-1">{s.label}</div>
            <div className="text-[26px] font-bold" style={{ color: s.color }}>{s.value}</div>
          </Card>
        ))}
      </div>

      {/* Add Form */}
      {showAdd && (
        <Card className="p-[18px] mb-3.5">
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
      <Card className={`px-3.5 py-2.5 mb-3 flex gap-2 flex-wrap items-center ${isRTL ? 'flex-row-reverse' : 'flex-row'}`}>
        <div className="relative flex-1 min-w-[160px]">
          <Search size={13} className={`absolute top-1/2 -translate-y-1/2 text-content-muted dark:text-content-muted-dark ${isRTL ? 'right-2.5' : 'left-2.5'}`} />
          <Input value={search} onChange={e=>setSearch(e.target.value)} placeholder={lang==='ar'?'بحث...':'Search...'}
            size="sm"
            className={isRTL ? 'pr-[30px] pl-2.5' : 'pl-[30px] pr-2.5'} />
        </div>
        {/* Status */}
        {['all','pending','in_progress','done'].map(s => (
          <button key={s} onClick={()=>setStatusFilter(s)} className={`
            px-[11px] py-[5px] rounded-md border text-xs cursor-pointer transition-colors
            ${statusFilter===s
              ? 'border-brand-500 bg-brand-500/[0.09] text-brand-500 font-semibold'
              : 'border-edge dark:border-edge-dark bg-transparent text-content-muted dark:text-content-muted-dark font-normal'}
          `}>
            {s==='all'?(lang==='ar'?'الكل':'All'):lang==='ar'?TASK_STATUSES[s]?.ar:TASK_STATUSES[s]?.en}
          </button>
        ))}
        {/* Priority */}
        <Select value={priorityFilter} onChange={e=>setPriorityFilter(e.target.value)} size="sm" className="!w-auto">
          <option value="all">{lang==='ar'?'كل الأولويات':'All Priorities'}</option>
          {Object.entries(TASK_PRIORITIES).map(([k,v])=><option key={k} value={k}>{lang==='ar'?v.ar:v.en}</option>)}
        </Select>
      </Card>

      {/* Tasks List */}
      <Card className="overflow-hidden">
        {loading ? (
          <div className="text-center p-12 text-content-muted dark:text-content-muted-dark">{lang==='ar'?'جاري التحميل...':'Loading...'}</div>
        ) : filtered.length === 0 ? (
            <div className="text-center py-[60px] px-5">
                <div className="w-16 h-16 rounded-2xl bg-brand-500/10 flex items-center justify-center mx-auto mb-4">
                  <CheckSquare size={24} className="text-brand-500" />
                </div>
                <p className="m-0 mb-1.5 text-[15px] font-bold text-content dark:text-content-dark">{lang==='ar'?'لا توجد مهام':'No Tasks Found'}</p>
                <p className="m-0 text-[13px] text-content-muted dark:text-content-muted-dark">{lang==='ar'?'لم يتم إضافة أي مهام بعد أو جرّب تغيير الفلتر':'No tasks found, try changing the filter'}</p>
              </div>
            ) : filtered.map((task, idx) => {
          const typeDef = TASK_TYPES[task.type] || TASK_TYPES.general;
          const Ic = ICONS[typeDef.icon] || CheckSquare;
          const priDef = TASK_PRIORITIES[task.priority];
          const stDef  = TASK_STATUSES[task.status];
          const due    = formatDue(task.due_date, lang);
          const isDone = task.status === 'done';

          return (
            <div key={task.id} className={`
              flex items-start gap-3 px-4 py-3
              ${idx < filtered.length-1 ? 'border-b border-edge dark:border-edge-dark' : ''}
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
                    <span className="text-[11px] text-brand-500 flex items-center gap-[3px]">
                      <User size={10} /> {task.contact_name}
                    </span>
                  )}
                </div>
                <div className={`flex items-center gap-2.5 mt-[3px] ${isRTL ? 'flex-row-reverse' : 'flex-row'}`}>
                  <span className={`text-[11px] flex items-center gap-[3px] ${
                    due.overdue && !isDone
                      ? 'text-red-500 font-semibold'
                      : 'text-content-muted dark:text-content-muted-dark font-normal'
                  }`}>
                    <Clock size={10} /> {due.label}
                  </span>
                  {task.assigned_to_name_ar && (
                    <span className="text-[11px] text-content-muted dark:text-content-muted-dark">
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
                  <Button variant="secondary" size="sm" onClick={() => handleStatus(task, 'in_progress')} className="!text-[11px] !px-[9px] !py-1">
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
    </div>
  );
}
