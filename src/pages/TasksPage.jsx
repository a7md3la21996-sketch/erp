import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import {
  CheckSquare, Plus, X, Search, Clock, Phone, PhoneCall,
  Users, Mail, MessageCircle, Filter, Trash2, Check,
  AlertCircle, Calendar, User, ChevronDown
} from 'lucide-react';
import { fetchTasks, createTask, updateTask, deleteTask, TASK_PRIORITIES, TASK_STATUSES, TASK_TYPES } from '../services/tasksService';

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
  const { theme } = useTheme();
  const { user } = useAuth();
  const lang   = i18n.language;
  const isDark  = theme === 'dark';
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

  const c = {
    bg:      isDark ? '#152232' : '#f9fafb',
    cardBg:  isDark ? '#1a2234' : '#ffffff',
    border:  isDark ? 'rgba(74,122,171,0.2)' : '#e5e7eb',
    text:    isDark ? '#E2EAF4' : '#111827',
    muted:   isDark ? '#8BA8C8' : '#6b7280',
    inputBg: isDark ? '#0F1E2D' : '#ffffff',
    hover:   isDark ? 'rgba(74,122,171,0.06)' : '#f8fafc',
    accent:  '#4A7AAB',
    primary: '#2B4C6F',
  };

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

  const inputStyle = {
    width: '100%', padding: '8px 11px', borderRadius: 8, border: '1px solid ' + c.border,
    background: c.inputBg, color: c.text, fontSize: 13, outline: 'none', boxSizing: 'border-box',
    direction: isRTL ? 'rtl' : 'ltr',
  };

  return (
    <div style={{ padding: 24, background: c.bg, minHeight: '100vh', direction: isRTL ? 'rtl' : 'ltr' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexDirection: isRTL ? 'row-reverse' : 'row' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexDirection: isRTL ? 'row-reverse' : 'row' }}>
          <div style={{ width: 42, height: 42, borderRadius: 10, background: c.primary, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <CheckSquare size={20} color="#fff" />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: c.text }}>{lang === 'ar' ? 'المهام' : 'Tasks'}</h1>
            <p style={{ margin: 0, fontSize: 12, color: c.muted }}>{lang === 'ar' ? 'كل المهام والمتابعات' : 'All tasks & follow-ups'}</p>
          </div>
        </div>
        <button onClick={() => setShowAdd(!showAdd)} style={{
          display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 8,
          border: 'none', cursor: 'pointer', background: showAdd ? c.border : c.primary, color: showAdd ? c.muted : '#fff',
          fontSize: 13, fontWeight: 600, flexDirection: isRTL ? 'row-reverse' : 'row',
        }}>
          {showAdd ? <X size={15} /> : <Plus size={15} />}
          {showAdd ? (lang === 'ar' ? 'إلغاء' : 'Cancel') : (lang === 'ar' ? 'مهمة جديدة' : 'New Task')}
        </button>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginBottom: 16 }}>
        {[
          { label: lang==='ar'?'الكل':'Total',    value: stats.total,   color: c.accent  },
          { label: lang==='ar'?'معلقة':'Pending', value: stats.pending, color: '#F97316' },
          { label: lang==='ar'?'متأخرة':'Overdue',value: stats.overdue, color: '#EF4444' },
          { label: lang==='ar'?'مكتملة':'Done',   value: stats.done,    color: c.primary },
        ].map((s,i) => (
          <div key={i} style={{ background: c.cardBg, borderRadius: 10, padding: '12px 16px', border: '1px solid ' + c.border }}>
            <div style={{ fontSize: 11, color: c.muted, marginBottom: 4 }}>{s.label}</div>
            <div style={{ fontSize: 26, fontWeight: 700, color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Add Form */}
      {showAdd && (
        <div style={{ background: c.cardBg, borderRadius: 12, padding: 18, marginBottom: 14, border: '1px solid ' + c.border }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
            <div style={{ gridColumn: '1/-1' }}>
              <input value={form.title} onChange={e => setForm(f=>({...f,title:e.target.value}))}
                placeholder={lang==='ar'?'عنوان المهمة...':'Task title...'} style={inputStyle} />
            </div>
            <select value={form.type} onChange={e => setForm(f=>({...f,type:e.target.value}))} style={inputStyle}>
              {Object.entries(TASK_TYPES).map(([k,v]) => <option key={k} value={k}>{lang==='ar'?v.ar:v.en}</option>)}
            </select>
            <select value={form.priority} onChange={e => setForm(f=>({...f,priority:e.target.value}))} style={inputStyle}>
              {Object.entries(TASK_PRIORITIES).map(([k,v]) => <option key={k} value={k}>{lang==='ar'?v.ar:v.en}</option>)}
            </select>
            <select value={form.dept} onChange={e => setForm(f=>({...f,dept:e.target.value}))} style={inputStyle}>
              {[['crm','CRM'],['hr','HR'],['finance',lang==='ar'?'المالية':'Finance'],['general',lang==='ar'?'عام':'General']].map(([k,v])=>(
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
            <input type="datetime-local" value={form.due_date} onChange={e => setForm(f=>({...f,due_date:e.target.value}))} style={inputStyle} />
            <input value={form.contact_name} onChange={e => setForm(f=>({...f,contact_name:e.target.value}))}
              placeholder={lang==='ar'?'اسم العميل (اختياري)':'Contact name (optional)'} style={inputStyle} />
            <textarea value={form.notes} onChange={e => setForm(f=>({...f,notes:e.target.value}))}
              placeholder={lang==='ar'?'ملاحظات...':'Notes...'} rows={2}
              style={{...inputStyle, resize:'vertical', gridColumn:'1/-1'}} />
          </div>
          <div style={{ display:'flex', justifyContent: isRTL?'flex-start':'flex-end', gap:8 }}>
            <button onClick={()=>setShowAdd(false)} style={{ padding:'7px 14px', borderRadius:8, border:'1px solid '+c.border, background:'transparent', color:c.muted, fontSize:13, cursor:'pointer' }}>
              {lang==='ar'?'إلغاء':'Cancel'}
            </button>
            <button onClick={handleAdd} disabled={saving||!form.title.trim()||!form.due_date} style={{
              padding:'7px 18px', borderRadius:8, border:'none', background:c.primary, color:'#fff',
              fontSize:13, fontWeight:600, cursor:'pointer', opacity:saving||!form.title.trim()||!form.due_date?0.6:1,
            }}>
              {saving?'...':(lang==='ar'?'حفظ':'Save')}
            </button>
          </div>
        </div>
      )}

      {/* Filters */}
      <div style={{ background: c.cardBg, borderRadius: 12, padding: '10px 14px', marginBottom: 12, border: '1px solid ' + c.border, display:'flex', gap:8, flexWrap:'wrap', alignItems:'center', flexDirection: isRTL?'row-reverse':'row' }}>
        <div style={{ position:'relative', flex:1, minWidth:160 }}>
          <Search size={13} style={{ position:'absolute', [isRTL?'right':'left']:10, top:'50%', transform:'translateY(-50%)', color:c.muted }} />
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder={lang==='ar'?'بحث...':'Search...'} style={{
            width:'100%', padding: isRTL?'7px 30px 7px 10px':'7px 10px 7px 30px',
            borderRadius:7, border:'1px solid '+c.border, background:c.inputBg, color:c.text, fontSize:12, outline:'none', boxSizing:'border-box',
          }} />
        </div>
        {/* Status */}
        {['all','pending','in_progress','done'].map(s => (
          <button key={s} onClick={()=>setStatusFilter(s)} style={{
            padding:'5px 11px', borderRadius:6, border:'1px solid '+(statusFilter===s?c.accent:c.border),
            background: statusFilter===s?c.accent+'18':'transparent', color:statusFilter===s?c.accent:c.muted,
            fontSize:12, fontWeight:statusFilter===s?600:400, cursor:'pointer',
          }}>
            {s==='all'?(lang==='ar'?'الكل':'All'):lang==='ar'?TASK_STATUSES[s]?.ar:TASK_STATUSES[s]?.en}
          </button>
        ))}
        {/* Priority */}
        <select value={priorityFilter} onChange={e=>setPriorityFilter(e.target.value)} style={{ padding:'6px 10px', borderRadius:7, border:'1px solid '+c.border, background:c.inputBg, color:c.text, fontSize:12, outline:'none' }}>
          <option value="all">{lang==='ar'?'كل الأولويات':'All Priorities'}</option>
          {Object.entries(TASK_PRIORITIES).map(([k,v])=><option key={k} value={k}>{lang==='ar'?v.ar:v.en}</option>)}
        </select>
      </div>

      {/* Tasks List */}
      <div style={{ background: c.cardBg, borderRadius: 12, border: '1px solid ' + c.border, overflow:'hidden' }}>
        {loading ? (
          <div style={{ textAlign:'center', padding:48, color:c.muted }}>{lang==='ar'?'جاري التحميل...':'Loading...'}</div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign:'center', padding:48, color:c.muted }}>
            <CheckSquare size={32} color={c.border} style={{ marginBottom:12 }} />
            <p style={{ margin:0, fontSize:14 }}>{lang==='ar'?'لا توجد مهام':'No tasks found'}</p>
          </div>
        ) : filtered.map((task, idx) => {
          const typeDef = TASK_TYPES[task.type] || TASK_TYPES.general;
          const Ic = ICONS[typeDef.icon] || CheckSquare;
          const priDef = TASK_PRIORITIES[task.priority];
          const stDef  = TASK_STATUSES[task.status];
          const due    = formatDue(task.due_date, lang);
          const isDone = task.status === 'done';

          return (
            <div key={task.id} style={{
              display:'flex', alignItems:'flex-start', gap:12, padding:'12px 16px',
              borderBottom: idx < filtered.length-1 ? '1px solid '+c.border : 'none',
              flexDirection: isRTL?'row-reverse':'row', opacity: isDone ? 0.65 : 1,
              transition:'background 0.15s',
            }}
              onMouseEnter={e => e.currentTarget.style.background = c.hover}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              {/* Done toggle */}
              <button onClick={() => handleStatus(task, isDone ? 'pending' : 'done')} style={{
                width:20, height:20, borderRadius:5, border:'2px solid '+(isDone?c.primary:c.border),
                background: isDone?c.primary:'transparent', display:'flex', alignItems:'center', justifyContent:'center',
                cursor:'pointer', flexShrink:0, marginTop:2,
              }}>
                {isDone && <Check size={11} color="#fff" />}
              </button>

              {/* Type icon */}
              <div style={{ width:32, height:32, borderRadius:8, background:(priDef?.color||c.accent)+'18', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                <Ic size={14} color={priDef?.color||c.accent} />
              </div>

              {/* Content */}
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ display:'flex', alignItems:'center', gap:7, flexWrap:'wrap', flexDirection: isRTL?'row-reverse':'row' }}>
                  <span style={{ fontSize:14, fontWeight:600, color:c.text, textDecoration: isDone?'line-through':'none' }}>{task.title}</span>
                  <span style={{ fontSize:10, padding:'1px 7px', borderRadius:6, background:(priDef?.color||c.accent)+'18', color:priDef?.color||c.accent, fontWeight:600 }}>
                    {lang==='ar'?priDef?.ar:priDef?.en}
                  </span>
                  <span style={{ fontSize:10, padding:'1px 7px', borderRadius:6, background:(stDef?.color||c.accent)+'18', color:stDef?.color||c.accent }}>
                    {lang==='ar'?stDef?.ar:stDef?.en}
                  </span>
                  {task.contact_name && (
                    <span style={{ fontSize:11, color:c.accent, display:'flex', alignItems:'center', gap:3 }}>
                      <User size={10} /> {task.contact_name}
                    </span>
                  )}
                </div>
                <div style={{ display:'flex', alignItems:'center', gap:10, marginTop:3, flexDirection: isRTL?'row-reverse':'row' }}>
                  <span style={{ fontSize:11, color: due.overdue && !isDone ? '#EF4444' : c.muted, fontWeight: due.overdue && !isDone ? 600 : 400, display:'flex', alignItems:'center', gap:3 }}>
                    <Clock size={10} /> {due.label}
                  </span>
                  {task.assigned_to_name_ar && (
                    <span style={{ fontSize:11, color:c.muted }}>
                      {lang==='ar'?task.assigned_to_name_ar:task.assigned_to_name_en}
                    </span>
                  )}
                  {task.dept && (
                    <span style={{ fontSize:10, padding:'1px 6px', borderRadius:5, background:c.accent+'15', color:c.accent }}>
                      {task.dept.toUpperCase()}
                    </span>
                  )}
                </div>
                {task.notes && <div style={{ fontSize:12, color:c.muted, marginTop:3 }}>{task.notes}</div>}
              </div>

              {/* Actions */}
              <div style={{ display:'flex', gap:4, flexShrink:0 }}>
                {task.status !== 'in_progress' && task.status !== 'done' && (
                  <button onClick={() => handleStatus(task, 'in_progress')} style={{
                    padding:'4px 9px', borderRadius:6, border:'1px solid '+c.border,
                    background:'transparent', color:c.muted, fontSize:11, cursor:'pointer',
                  }}>
                    {lang==='ar'?'جارية':'Start'}
                  </button>
                )}
                <button onClick={() => handleDelete(task.id)} style={{
                  padding:'4px 7px', borderRadius:6, border:'none', background:'transparent',
                  color:c.muted, cursor:'pointer', opacity:0.5,
                }}
                  onMouseEnter={e=>e.currentTarget.style.opacity=1}
                  onMouseLeave={e=>e.currentTarget.style.opacity=0.5}
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
