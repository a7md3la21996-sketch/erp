import { useState, useEffect, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Calendar as CalendarIcon, ChevronLeft, ChevronRight, Plus, X,
  CheckSquare, Bell, Activity, Clock, User
} from 'lucide-react';
import { fetchTasks, createTask, TASK_PRIORITIES, TASK_TYPES } from '../services/tasksService';
import { fetchReminders, createReminder } from '../services/remindersService';
import { fetchActivities, ACTIVITY_TYPES } from '../services/activitiesService';
import { Button, Card, Badge, Modal, ModalFooter, Input, Select, Textarea } from '../components/ui';

const DAYS_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DAYS_AR = ['أحد', 'إثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت'];

const MONTHS_EN = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const MONTHS_AR = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];

const EVENT_COLORS = {
  task: '#4A7AAB',
  reminder: '#F59E0B',
  activity: '#8B5CF6',
};

function isSameDay(d1, d2) {
  return d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate();
}

function getDaysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year, month) {
  return new Date(year, month, 1).getDay();
}

function dateKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

export default function CalendarPage() {
  const { i18n } = useTranslation();
  const lang = i18n.language;
  const isRTL = lang === 'ar';

  const today = new Date();
  const [currentMonth, setCurrentMonth] = useState(today.getMonth());
  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  const [tasks, setTasks] = useState([]);
  const [reminders, setReminders] = useState([]);
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [addType, setAddType] = useState('task');
  const [saving, setSaving] = useState(false);
  const [taskForm, setTaskForm] = useState({
    title: '', type: 'general', priority: 'medium', due_date: '', notes: ''
  });
  const [reminderForm, setReminderForm] = useState({
    entity_name: '', type: 'call', due_at: '', notes: ''
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [t, r, a] = await Promise.all([
        fetchTasks(),
        fetchReminders(),
        fetchActivities({ limit: 200 }),
      ]);
      setTasks(t || []);
      setReminders(r || []);
      setActivities(a || []);
    } catch {
      // fallback already handled in services
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // Build events map: dateKey -> { tasks: [], reminders: [], activities: [] }
  const eventsMap = useMemo(() => {
    const map = {};
    const ensure = (key) => { if (!map[key]) map[key] = { tasks: [], reminders: [], activities: [] }; };

    tasks.forEach(t => {
      if (!t.due_date) return;
      const d = new Date(t.due_date);
      const k = dateKey(d);
      ensure(k);
      map[k].tasks.push(t);
    });

    reminders.forEach(r => {
      if (!r.due_at) return;
      const d = new Date(r.due_at);
      const k = dateKey(d);
      ensure(k);
      map[k].reminders.push(r);
    });

    activities.forEach(a => {
      if (!a.created_at) return;
      const d = new Date(a.created_at);
      const k = dateKey(d);
      ensure(k);
      map[k].activities.push(a);
    });

    return map;
  }, [tasks, reminders, activities]);

  // Calendar grid
  const calendarDays = useMemo(() => {
    const daysInMonth = getDaysInMonth(currentYear, currentMonth);
    const firstDay = getFirstDayOfMonth(currentYear, currentMonth);
    const prevMonthDays = getDaysInMonth(currentYear, currentMonth - 1);

    const days = [];

    // Previous month padding
    for (let i = firstDay - 1; i >= 0; i--) {
      days.push({ day: prevMonthDays - i, currentMonth: false, date: new Date(currentYear, currentMonth - 1, prevMonthDays - i) });
    }

    // Current month
    for (let d = 1; d <= daysInMonth; d++) {
      days.push({ day: d, currentMonth: true, date: new Date(currentYear, currentMonth, d) });
    }

    // Next month padding
    const remaining = 42 - days.length;
    for (let d = 1; d <= remaining; d++) {
      days.push({ day: d, currentMonth: false, date: new Date(currentYear, currentMonth + 1, d) });
    }

    return days;
  }, [currentYear, currentMonth]);

  const goToday = () => {
    setCurrentMonth(today.getMonth());
    setCurrentYear(today.getFullYear());
  };

  const goPrev = () => {
    if (currentMonth === 0) { setCurrentMonth(11); setCurrentYear(y => y - 1); }
    else setCurrentMonth(m => m - 1);
  };

  const goNext = () => {
    if (currentMonth === 11) { setCurrentMonth(0); setCurrentYear(y => y + 1); }
    else setCurrentMonth(m => m + 1);
  };

  const selectedEvents = useMemo(() => {
    if (!selectedDate) return null;
    const k = dateKey(selectedDate);
    return eventsMap[k] || { tasks: [], reminders: [], activities: [] };
  }, [selectedDate, eventsMap]);

  const handleAddEvent = async () => {
    setSaving(true);
    try {
      if (addType === 'task') {
        if (!taskForm.title.trim() || !taskForm.due_date) return;
        const t = await createTask({
          ...taskForm,
          status: 'pending',
          dept: 'crm',
          assigned_to_name_ar: 'أنت',
          assigned_to_name_en: 'You',
        });
        setTasks(prev => [t, ...prev]);
        setTaskForm({ title: '', type: 'general', priority: 'medium', due_date: '', notes: '' });
      } else {
        if (!reminderForm.entity_name.trim() || !reminderForm.due_at) return;
        const r = await createReminder({
          entityType: 'contact',
          entityId: null,
          entityName: reminderForm.entity_name,
          dueAt: reminderForm.due_at,
          type: reminderForm.type,
          notes: reminderForm.notes,
        });
        setReminders(prev => [r, ...prev]);
        setReminderForm({ entity_name: '', type: 'call', due_at: '', notes: '' });
      }
      setShowAddModal(false);
    } finally {
      setSaving(false);
    }
  };

  const openAddModal = (date) => {
    const d = date || new Date();
    const isoLocal = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}T${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
    setTaskForm(f => ({ ...f, due_date: isoLocal }));
    setReminderForm(f => ({ ...f, due_at: isoLocal }));
    setShowAddModal(true);
  };

  const dayNames = isRTL ? DAYS_AR : DAYS_EN;
  const monthLabel = isRTL ? MONTHS_AR[currentMonth] : MONTHS_EN[currentMonth];

  return (
    <div className={`px-4 py-4 md:px-7 md:py-6 bg-surface-bg dark:bg-surface-bg-dark min-h-screen ${isRTL ? 'direction-rtl' : 'direction-ltr'}`} dir={isRTL ? 'rtl' : 'ltr'}>

      {/* Header */}
      <div className={`flex items-center justify-between mb-5 flex-wrap gap-3 ${isRTL ? 'flex-row-reverse' : 'flex-row'}`}>
        <div className={`flex items-center gap-3 ${isRTL ? 'flex-row-reverse' : 'flex-row'}`}>
          <div className="w-10 h-10 rounded-xl bg-brand-500/[0.12] flex items-center justify-center">
            <CalendarIcon size={20} className="text-brand-500" />
          </div>
          <div>
            <h1 className="m-0 text-xl font-bold text-content dark:text-content-dark">
              {isRTL ? 'التقويم' : 'Calendar'}
            </h1>
            <p className="m-0 text-xs text-content-muted dark:text-content-muted-dark">
              {isRTL ? 'المهام والتذكيرات والأنشطة' : 'Tasks, reminders & activities'}
            </p>
          </div>
        </div>
        <Button variant="primary" size="sm" onClick={() => openAddModal(selectedDate || today)} className={isRTL ? 'flex-row-reverse' : ''}>
          <Plus size={15} />
          {isRTL ? 'إضافة حدث' : 'Add Event'}
        </Button>
      </div>

      {/* Legend */}
      <div className={`flex items-center gap-4 mb-4 flex-wrap ${isRTL ? 'flex-row-reverse' : 'flex-row'}`}>
        {[
          { color: EVENT_COLORS.task, label: isRTL ? 'مهام' : 'Tasks' },
          { color: EVENT_COLORS.reminder, label: isRTL ? 'تذكيرات' : 'Reminders' },
          { color: EVENT_COLORS.activity, label: isRTL ? 'أنشطة' : 'Activities' },
        ].map(l => (
          <div key={l.label} className={`flex items-center gap-1.5 ${isRTL ? 'flex-row-reverse' : 'flex-row'}`}>
            <span className="w-2.5 h-2.5 rounded-full" style={{ background: l.color }} />
            <span className="text-xs text-content-muted dark:text-content-muted-dark">{l.label}</span>
          </div>
        ))}
      </div>

      <div className="flex flex-col lg:flex-row gap-4">
        {/* Calendar Grid */}
        <div className="flex-1 min-w-0">
          <Card className="overflow-hidden">
            {/* Month Nav */}
            <div className={`flex items-center justify-between px-4 py-3 border-b border-edge dark:border-edge-dark ${isRTL ? 'flex-row-reverse' : 'flex-row'}`}>
              <div className={`flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : 'flex-row'}`}>
                <button onClick={isRTL ? goNext : goPrev} className="p-1.5 rounded-lg border border-edge dark:border-edge-dark bg-transparent text-content dark:text-content-dark hover:bg-gray-100 dark:hover:bg-brand-500/10 cursor-pointer transition-colors">
                  <ChevronLeft size={16} />
                </button>
                <button onClick={isRTL ? goPrev : goNext} className="p-1.5 rounded-lg border border-edge dark:border-edge-dark bg-transparent text-content dark:text-content-dark hover:bg-gray-100 dark:hover:bg-brand-500/10 cursor-pointer transition-colors">
                  <ChevronRight size={16} />
                </button>
                <h2 className="m-0 text-base font-bold text-content dark:text-content-dark">
                  {monthLabel} {currentYear}
                </h2>
              </div>
              <Button variant="secondary" size="sm" onClick={goToday}>
                {isRTL ? 'اليوم' : 'Today'}
              </Button>
            </div>

            {/* Day Headers */}
            <div className="grid grid-cols-7">
              {dayNames.map(d => (
                <div key={d} className="px-1 py-2 text-center text-[11px] font-semibold text-content-muted dark:text-content-muted-dark border-b border-edge dark:border-edge-dark">
                  {d}
                </div>
              ))}
            </div>

            {/* Days Grid */}
            {loading ? (
              <div className="text-center p-12 text-content-muted dark:text-content-muted-dark">
                {isRTL ? 'جاري التحميل...' : 'Loading...'}
              </div>
            ) : (
              <div className="grid grid-cols-7">
                {calendarDays.map((cell, idx) => {
                  const k = dateKey(cell.date);
                  const events = eventsMap[k];
                  const isToday = isSameDay(cell.date, today);
                  const isSelected = selectedDate && isSameDay(cell.date, selectedDate);
                  const hasTasks = events?.tasks?.length > 0;
                  const hasReminders = events?.reminders?.length > 0;
                  const hasActivities = events?.activities?.length > 0;

                  return (
                    <button
                      key={idx}
                      onClick={() => setSelectedDate(cell.date)}
                      className={`
                        relative min-h-[70px] md:min-h-[90px] p-1.5 md:p-2 border-b border-r border-edge dark:border-edge-dark
                        text-start cursor-pointer transition-colors
                        ${cell.currentMonth
                          ? 'bg-transparent hover:bg-gray-50 dark:hover:bg-brand-500/[0.06]'
                          : 'bg-gray-50/50 dark:bg-white/[0.02]'}
                        ${isSelected ? 'ring-2 ring-inset ring-brand-500' : ''}
                      `}
                    >
                      <span className={`
                        inline-flex items-center justify-center w-6 h-6 md:w-7 md:h-7 rounded-full text-xs font-semibold
                        ${isToday
                          ? 'bg-brand-500 text-white'
                          : cell.currentMonth
                            ? 'text-content dark:text-content-dark'
                            : 'text-content-muted/40 dark:text-content-muted-dark/40'}
                      `}>
                        {cell.day}
                      </span>

                      {/* Event dots */}
                      <div className="flex items-center gap-[3px] mt-1 flex-wrap">
                        {hasTasks && <span className="w-[6px] h-[6px] rounded-full" style={{ background: EVENT_COLORS.task }} />}
                        {hasReminders && <span className="w-[6px] h-[6px] rounded-full" style={{ background: EVENT_COLORS.reminder }} />}
                        {hasActivities && <span className="w-[6px] h-[6px] rounded-full" style={{ background: EVENT_COLORS.activity }} />}
                      </div>

                      {/* Mini labels on desktop */}
                      <div className="hidden md:block mt-0.5 space-y-[2px]">
                        {events?.tasks?.slice(0, 2).map(t => (
                          <div key={t.id} className="text-[9px] leading-tight truncate px-1 py-[1px] rounded" style={{ background: EVENT_COLORS.task + '18', color: EVENT_COLORS.task }}>
                            {t.title}
                          </div>
                        ))}
                        {events?.reminders?.slice(0, 1).map(r => (
                          <div key={r.id} className="text-[9px] leading-tight truncate px-1 py-[1px] rounded" style={{ background: EVENT_COLORS.reminder + '18', color: EVENT_COLORS.reminder }}>
                            {r.entity_name || r.notes || (isRTL ? 'تذكير' : 'Reminder')}
                          </div>
                        ))}
                        {(events?.tasks?.length > 2 || events?.reminders?.length > 1 || events?.activities?.length > 0) && (
                          <div className="text-[9px] text-content-muted dark:text-content-muted-dark">
                            +{(events?.tasks?.length > 2 ? events.tasks.length - 2 : 0) +
                              (events?.reminders?.length > 1 ? events.reminders.length - 1 : 0) +
                              (events?.activities?.length || 0)} {isRTL ? 'أخرى' : 'more'}
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </Card>
        </div>

        {/* Side Panel - Day Detail */}
        <div className="w-full lg:w-[340px] shrink-0">
          <Card className="sticky top-4 overflow-hidden">
            {selectedDate ? (
              <>
                {/* Panel Header */}
                <div className={`flex items-center justify-between px-4 py-3 border-b border-edge dark:border-edge-dark ${isRTL ? 'flex-row-reverse' : 'flex-row'}`}>
                  <div>
                    <div className="text-sm font-bold text-content dark:text-content-dark">
                      {selectedDate.toLocaleDateString(isRTL ? 'ar-EG' : 'en-US', { weekday: 'long', day: 'numeric', month: 'long' })}
                    </div>
                    <div className="text-[11px] text-content-muted dark:text-content-muted-dark mt-0.5">
                      {(selectedEvents?.tasks?.length || 0) + (selectedEvents?.reminders?.length || 0) + (selectedEvents?.activities?.length || 0)} {isRTL ? 'أحداث' : 'events'}
                    </div>
                  </div>
                  <div className={`flex items-center gap-1.5 ${isRTL ? 'flex-row-reverse' : 'flex-row'}`}>
                    <button onClick={() => openAddModal(selectedDate)} className="p-1.5 rounded-lg border border-edge dark:border-edge-dark bg-transparent text-content-muted dark:text-content-muted-dark hover:bg-gray-100 dark:hover:bg-brand-500/10 cursor-pointer transition-colors">
                      <Plus size={14} />
                    </button>
                    <button onClick={() => setSelectedDate(null)} className="p-1.5 rounded-lg border border-edge dark:border-edge-dark bg-transparent text-content-muted dark:text-content-muted-dark hover:bg-gray-100 dark:hover:bg-brand-500/10 cursor-pointer transition-colors">
                      <X size={14} />
                    </button>
                  </div>
                </div>

                {/* Events List */}
                <div className="max-h-[60vh] overflow-y-auto">
                  {/* Tasks */}
                  {selectedEvents?.tasks?.length > 0 && (
                    <div className="px-4 pt-3 pb-1">
                      <div className={`flex items-center gap-1.5 mb-2 ${isRTL ? 'flex-row-reverse' : 'flex-row'}`}>
                        <CheckSquare size={12} style={{ color: EVENT_COLORS.task }} />
                        <span className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: EVENT_COLORS.task }}>
                          {isRTL ? 'مهام' : 'Tasks'}
                        </span>
                      </div>
                      {selectedEvents.tasks.map(t => {
                        const priDef = TASK_PRIORITIES[t.priority];
                        return (
                          <div key={t.id} className={`flex items-start gap-2 mb-2 p-2 rounded-lg bg-gray-50 dark:bg-brand-500/[0.04] ${isRTL ? 'flex-row-reverse text-right' : 'flex-row text-left'}`}>
                            <div className="w-6 h-6 rounded-md flex items-center justify-center shrink-0 mt-0.5" style={{ background: (priDef?.color || '#4A7AAB') + '18' }}>
                              <CheckSquare size={11} color={priDef?.color || '#4A7AAB'} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className={`text-xs font-semibold text-content dark:text-content-dark ${t.status === 'done' ? 'line-through opacity-60' : ''}`}>
                                {t.title}
                              </div>
                              <div className={`flex items-center gap-1.5 mt-0.5 flex-wrap ${isRTL ? 'flex-row-reverse' : 'flex-row'}`}>
                                <Badge size="sm" style={{ background: (priDef?.color || '#4A7AAB') + '18', color: priDef?.color || '#4A7AAB' }}>
                                  {isRTL ? priDef?.ar : priDef?.en}
                                </Badge>
                                {t.contact_name && (
                                  <span className="text-[10px] text-brand-500 flex items-center gap-[2px]">
                                    <User size={9} /> {t.contact_name}
                                  </span>
                                )}
                              </div>
                              {t.due_date && (
                                <div className="text-[10px] text-content-muted dark:text-content-muted-dark mt-0.5 flex items-center gap-1">
                                  <Clock size={9} />
                                  {new Date(t.due_date).toLocaleTimeString(isRTL ? 'ar-EG' : 'en-US', { hour: '2-digit', minute: '2-digit' })}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Reminders */}
                  {selectedEvents?.reminders?.length > 0 && (
                    <div className="px-4 pt-3 pb-1">
                      <div className={`flex items-center gap-1.5 mb-2 ${isRTL ? 'flex-row-reverse' : 'flex-row'}`}>
                        <Bell size={12} style={{ color: EVENT_COLORS.reminder }} />
                        <span className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: EVENT_COLORS.reminder }}>
                          {isRTL ? 'تذكيرات' : 'Reminders'}
                        </span>
                      </div>
                      {selectedEvents.reminders.map(r => (
                        <div key={r.id} className={`flex items-start gap-2 mb-2 p-2 rounded-lg bg-gray-50 dark:bg-brand-500/[0.04] ${isRTL ? 'flex-row-reverse text-right' : 'flex-row text-left'}`}>
                          <div className="w-6 h-6 rounded-md flex items-center justify-center shrink-0 mt-0.5" style={{ background: EVENT_COLORS.reminder + '18' }}>
                            <Bell size={11} color={EVENT_COLORS.reminder} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-semibold text-content dark:text-content-dark">
                              {r.entity_name || (isRTL ? 'تذكير' : 'Reminder')}
                            </div>
                            {r.notes && <div className="text-[10px] text-content-muted dark:text-content-muted-dark mt-0.5">{r.notes}</div>}
                            {r.due_at && (
                              <div className="text-[10px] text-content-muted dark:text-content-muted-dark mt-0.5 flex items-center gap-1">
                                <Clock size={9} />
                                {new Date(r.due_at).toLocaleTimeString(isRTL ? 'ar-EG' : 'en-US', { hour: '2-digit', minute: '2-digit' })}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Activities */}
                  {selectedEvents?.activities?.length > 0 && (
                    <div className="px-4 pt-3 pb-3">
                      <div className={`flex items-center gap-1.5 mb-2 ${isRTL ? 'flex-row-reverse' : 'flex-row'}`}>
                        <Activity size={12} style={{ color: EVENT_COLORS.activity }} />
                        <span className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: EVENT_COLORS.activity }}>
                          {isRTL ? 'أنشطة' : 'Activities'}
                        </span>
                      </div>
                      {selectedEvents.activities.map(a => {
                        const typeDef = ACTIVITY_TYPES[a.type] || {};
                        return (
                          <div key={a.id} className={`flex items-start gap-2 mb-2 p-2 rounded-lg bg-gray-50 dark:bg-brand-500/[0.04] ${isRTL ? 'flex-row-reverse text-right' : 'flex-row text-left'}`}>
                            <div className="w-6 h-6 rounded-md flex items-center justify-center shrink-0 mt-0.5" style={{ background: (typeDef.color || EVENT_COLORS.activity) + '18' }}>
                              <Activity size={11} color={typeDef.color || EVENT_COLORS.activity} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-xs font-semibold text-content dark:text-content-dark">
                                {isRTL ? typeDef.ar : typeDef.en}
                              </div>
                              {a.notes && <div className="text-[10px] text-content-muted dark:text-content-muted-dark mt-0.5 line-clamp-2">{a.notes}</div>}
                              <div className="text-[10px] text-content-muted dark:text-content-muted-dark mt-0.5">
                                {isRTL ? a.user_name_ar : a.user_name_en}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Empty state */}
                  {selectedEvents && !selectedEvents.tasks.length && !selectedEvents.reminders.length && !selectedEvents.activities.length && (
                    <div className="text-center py-10 px-4">
                      <div className="w-12 h-12 rounded-xl bg-brand-500/10 flex items-center justify-center mx-auto mb-3">
                        <CalendarIcon size={20} className="text-brand-500" />
                      </div>
                      <p className="m-0 text-sm font-semibold text-content dark:text-content-dark mb-1">
                        {isRTL ? 'لا توجد أحداث' : 'No Events'}
                      </p>
                      <p className="m-0 text-xs text-content-muted dark:text-content-muted-dark">
                        {isRTL ? 'لا يوجد شيء مجدول لهذا اليوم' : 'Nothing scheduled for this day'}
                      </p>
                      <Button variant="secondary" size="sm" className="mt-3" onClick={() => openAddModal(selectedDate)}>
                        <Plus size={13} />
                        {isRTL ? 'إضافة حدث' : 'Add Event'}
                      </Button>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="text-center py-12 px-4">
                <div className="w-12 h-12 rounded-xl bg-brand-500/10 flex items-center justify-center mx-auto mb-3">
                  <CalendarIcon size={20} className="text-brand-500" />
                </div>
                <p className="m-0 text-sm font-semibold text-content dark:text-content-dark mb-1">
                  {isRTL ? 'اختر يوماً' : 'Select a Day'}
                </p>
                <p className="m-0 text-xs text-content-muted dark:text-content-muted-dark">
                  {isRTL ? 'اضغط على أي يوم لعرض الأحداث' : 'Click any day to view events'}
                </p>
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* Add Event Modal */}
      <Modal open={showAddModal} onClose={() => setShowAddModal(false)} title={isRTL ? 'إضافة حدث' : 'Add Event'} width="max-w-md">
        {/* Type Toggle */}
        <div className={`flex gap-2 mb-4 ${isRTL ? 'flex-row-reverse' : 'flex-row'}`}>
          <button
            onClick={() => setAddType('task')}
            className={`flex-1 py-2 rounded-lg border text-xs font-semibold cursor-pointer transition-colors
              ${addType === 'task'
                ? 'border-brand-500 bg-brand-500/10 text-brand-500'
                : 'border-edge dark:border-edge-dark bg-transparent text-content-muted dark:text-content-muted-dark'}
            `}
          >
            {isRTL ? 'مهمة' : 'Task'}
          </button>
          <button
            onClick={() => setAddType('reminder')}
            className={`flex-1 py-2 rounded-lg border text-xs font-semibold cursor-pointer transition-colors
              ${addType === 'reminder'
                ? 'border-brand-500 bg-brand-500/10 text-brand-500'
                : 'border-edge dark:border-edge-dark bg-transparent text-content-muted dark:text-content-muted-dark'}
            `}
          >
            {isRTL ? 'تذكير' : 'Reminder'}
          </button>
        </div>

        {addType === 'task' ? (
          <div className="space-y-3">
            <Input
              value={taskForm.title}
              onChange={e => setTaskForm(f => ({ ...f, title: e.target.value }))}
              placeholder={isRTL ? 'عنوان المهمة...' : 'Task title...'}
              className={isRTL ? 'direction-rtl' : 'direction-ltr'}
            />
            <div className="grid grid-cols-2 gap-2">
              <Select value={taskForm.type} onChange={e => setTaskForm(f => ({ ...f, type: e.target.value }))} className={isRTL ? 'direction-rtl' : 'direction-ltr'}>
                {Object.entries(TASK_TYPES).map(([k, v]) => (
                  <option key={k} value={k}>{isRTL ? v.ar : v.en}</option>
                ))}
              </Select>
              <Select value={taskForm.priority} onChange={e => setTaskForm(f => ({ ...f, priority: e.target.value }))} className={isRTL ? 'direction-rtl' : 'direction-ltr'}>
                {Object.entries(TASK_PRIORITIES).map(([k, v]) => (
                  <option key={k} value={k}>{isRTL ? v.ar : v.en}</option>
                ))}
              </Select>
            </div>
            <Input
              type="datetime-local"
              value={taskForm.due_date}
              onChange={e => setTaskForm(f => ({ ...f, due_date: e.target.value }))}
              className={isRTL ? 'direction-rtl' : 'direction-ltr'}
            />
            <Textarea
              value={taskForm.notes}
              onChange={e => setTaskForm(f => ({ ...f, notes: e.target.value }))}
              placeholder={isRTL ? 'ملاحظات...' : 'Notes...'}
              rows={2}
              className={isRTL ? 'direction-rtl' : 'direction-ltr'}
            />
          </div>
        ) : (
          <div className="space-y-3">
            <Input
              value={reminderForm.entity_name}
              onChange={e => setReminderForm(f => ({ ...f, entity_name: e.target.value }))}
              placeholder={isRTL ? 'الاسم / الموضوع...' : 'Name / Subject...'}
              className={isRTL ? 'direction-rtl' : 'direction-ltr'}
            />
            <Select value={reminderForm.type} onChange={e => setReminderForm(f => ({ ...f, type: e.target.value }))} className={isRTL ? 'direction-rtl' : 'direction-ltr'}>
              {['call', 'whatsapp', 'meeting', 'email', 'visit'].map(t => (
                <option key={t} value={t}>{isRTL ? { call: 'مكالمة', whatsapp: 'واتساب', meeting: 'اجتماع', email: 'بريد', visit: 'زيارة' }[t] : t.charAt(0).toUpperCase() + t.slice(1)}</option>
              ))}
            </Select>
            <Input
              type="datetime-local"
              value={reminderForm.due_at}
              onChange={e => setReminderForm(f => ({ ...f, due_at: e.target.value }))}
              className={isRTL ? 'direction-rtl' : 'direction-ltr'}
            />
            <Textarea
              value={reminderForm.notes}
              onChange={e => setReminderForm(f => ({ ...f, notes: e.target.value }))}
              placeholder={isRTL ? 'ملاحظات...' : 'Notes...'}
              rows={2}
              className={isRTL ? 'direction-rtl' : 'direction-ltr'}
            />
          </div>
        )}

        <ModalFooter className={isRTL ? 'flex-row-reverse' : ''}>
          <Button variant="secondary" size="sm" onClick={() => setShowAddModal(false)}>
            {isRTL ? 'إلغاء' : 'Cancel'}
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handleAddEvent}
            disabled={saving || (addType === 'task' ? (!taskForm.title.trim() || !taskForm.due_date) : (!reminderForm.entity_name.trim() || !reminderForm.due_at))}
          >
            {saving ? '...' : (isRTL ? 'حفظ' : 'Save')}
          </Button>
        </ModalFooter>
      </Modal>
    </div>
  );
}
