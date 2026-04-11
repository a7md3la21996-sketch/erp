import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { isFavorite as checkFavorite, toggleFavorite } from '../../../services/favoritesService';
import { fetchContactActivities, createActivity } from '../../../services/contactsService';
import { createTask, TASK_PRIORITIES } from '../../../services/tasksService';
import { useSystemConfig } from '../../../contexts/SystemConfigContext';
import { useAuth } from '../../../contexts/AuthContext';
import { logView, getEntityViewers } from '../../../services/viewTrackingService';
import FollowUpReminder from '../../../components/ui/FollowUpReminder';
import DocumentsSection from '../../../components/ui/DocumentsSection';
import CommentsSection from '../../../components/ui/CommentsSection';
import { getEmailsByOpportunity, sendEmail } from '../../../services/emailService';
import { logMessage as logWhatsAppMessage, generateWhatsAppLink } from '../../../services/whatsappService';
import { getDeptStages, deptStageLabel, useEscClose } from '../contacts/constants';
import EditOpportunityModal from './EditOpportunityModal';
import {
  TEMP_CONFIG, PRIORITY_CONFIG, ACTIVITY_ICONS,
  calcLeadScore, scoreColor, scoreLabel, fmtBudget, daysInStage,
  initials, avatarColor, getContactName, getAgentName, getProjectName,
  getStageHistory, addStageHistory, getOppNotes, addOppNote, deleteOppNote,
} from './constants';
import {
  Plus, X, Trash2, Building2, Banknote, Loader2, Pencil,
  Phone, MessageCircle, Mail, Users as UsersIcon, Clock, Star,
  MapPin, Briefcase, Calendar, ExternalLink, StickyNote,
  ChevronUp, ChevronDown, FileText, MoreVertical, MessageSquare, Zap,
  Check, CheckSquare, Target,
} from 'lucide-react';
import { Button, Input, Select, Textarea } from '../../../components/ui';
import { useToast } from '../../../contexts/ToastContext';

// ─── Take Action Form (matches ContactDrawer pattern) ───
function OppTakeActionForm({ selectedOpp, isRTL, configActivityTypes, configActivityResults, ACTIVITY_ICON_MAP, stages, profile, onSaveActivity, onSaveTask, onStageChange, onCancel }) {
  const [actMode, setActMode] = useState('log');
  const [actForm, setActForm] = useState({ type: 'call', description: '', result: '', scheduled_date: '' });
  const setAct = (k, v) => setActForm(f => ({ ...f, [k]: v, ...(k === 'type' ? { result: '' } : {}) }));

  const currentResults = (configActivityResults?.[actForm.type] || []).map(r => ({
    value: r.value, label: isRTL ? r.label_ar : r.label_en, color: r.color,
  }));
  const resultRequired = actMode === 'log' && currentResults.length > 0;

  // Task section
  const [addTask, setAddTask] = useState(false);
  const TASK_TYPES = [
    { key: 'followup', ar: 'متابعة', en: 'Follow Up' },
    { key: 'callback', ar: 'معاودة اتصال', en: 'Callback' },
    { key: 'send_info', ar: 'إرسال معلومات', en: 'Send Info' },
    { key: 'note', ar: 'ملاحظة', en: 'Note' },
  ];
  const [taskForm, setTaskForm] = useState({ type: 'followup', notes: '', priority: 'medium', due_date: '' });

  // Stage section
  const [changeStage, setChangeStage] = useState(false);
  const [newStage, setNewStage] = useState(selectedOpp?.stage || '');

  const [saving, setSaving] = useState(false);

  const canSave = actMode === 'schedule' ? !!actForm.scheduled_date : (!resultRequired || actForm.result);

  const RESULT_TITLES = {
    call: isRTL ? 'نتيجة المكالمة' : 'Call Result',
    whatsapp: isRTL ? 'نتيجة الرسالة' : 'Message Result',
    email: isRTL ? 'نتيجة الإيميل' : 'Email Result',
    meeting: isRTL ? 'نتيجة الاجتماع' : 'Meeting Result',
    site_visit: isRTL ? 'نتيجة الزيارة' : 'Visit Result',
  };

  const handleSaveAll = async () => {
    if (!canSave) return;
    setSaving(true);

    // 1. Save activity
    const actData = { type: actForm.type, description: actForm.description, result: actForm.result || null, created_at: new Date().toISOString() };
    actData.status = actMode === 'schedule' ? 'scheduled' : 'completed';
    if (actMode === 'schedule' && actForm.scheduled_date) actData.scheduled_date = actForm.scheduled_date;
    if (actForm.result && currentResults.length > 0) {
      const found = currentResults.find(r => r.value === actForm.result);
      const resultLabel = found ? found.label : actForm.result;
      actData.description = `${resultLabel}${actForm.description ? ' — ' + actForm.description : ''}`;
    }
    await onSaveActivity(actData);

    // 2. Save task if enabled
    if (addTask && taskForm.type && taskForm.due_date) {
      const selectedType = TASK_TYPES.find(t => t.key === taskForm.type);
      const title = selectedType ? (isRTL ? selectedType.ar : selectedType.en) : taskForm.type;
      await onSaveTask({ ...taskForm, title, contact_id: selectedOpp.contact_id, contact_name: getContactName(selectedOpp), entity_type: 'opportunity', entity_id: selectedOpp.id, dept: 'sales', created_by: profile?.id, created_by_name: profile?.full_name_ar || profile?.full_name_en });
    }

    // 3. Change stage if enabled
    if (changeStage && newStage && newStage !== selectedOpp.stage) {
      onStageChange(newStage);
    }

    setSaving(false);
    onCancel();
  };

  const sectionHeader = (icon, label, enabled, onToggle, required) => (
    <button
      onClick={required ? undefined : onToggle}
      className={`w-full flex items-center gap-2 py-2 px-3 rounded-lg text-xs font-bold border-0 font-cairo transition-colors ${
        required ? 'bg-transparent cursor-default' : 'cursor-pointer hover:bg-surface-input/50 dark:hover:bg-surface-input-dark/50 bg-transparent'
      } ${enabled ? 'text-content dark:text-content-dark' : 'text-content-muted dark:text-content-muted-dark'}`}
    >
      {icon}
      <span>{label}</span>
      {required && <span className="text-red-500 text-[10px]">*</span>}
      <span className="flex-1" />
      {!required && (
        <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${enabled ? 'bg-brand-500/15 text-brand-500' : 'bg-surface-input dark:bg-surface-input-dark text-content-muted dark:text-content-muted-dark'}`}>
          {enabled ? (isRTL ? 'مفعل' : 'ON') : (isRTL ? 'اختياري' : 'OFF')}
        </span>
      )}
    </button>
  );

  const activityTypes = (configActivityTypes || []).map(t => ({ key: t.key, label: t.label_en, labelAr: t.label_ar, Icon: ACTIVITY_ICON_MAP?.[t.key] || ACTIVITY_ICONS[t.key] || Clock }));

  return (
    <div className="bg-gradient-to-b from-brand-500/[0.06] to-transparent border border-brand-500/20 rounded-xl p-3.5 mb-4">
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <div className="w-7 h-7 rounded-lg bg-brand-500/15 flex items-center justify-center">
          <Zap size={14} className="text-brand-500" />
        </div>
        <span className="text-xs font-bold text-content dark:text-content-dark">{isRTL ? 'اتخذ إجراء' : 'Take Action'}</span>
      </div>

      {/* ── Section 1: Activity (Required) ── */}
      {sectionHeader(<Phone size={13} className="text-brand-500" />, isRTL ? 'سجل نشاط' : 'Log Activity', true, null, true)}
      <div className="ps-3 mb-3">
        {/* Log now / Schedule toggle */}
        <div className="flex gap-1.5 mb-2.5">
          <button onClick={() => setActMode('log')}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold cursor-pointer border transition-colors font-cairo ${
              actMode === 'log' ? 'bg-emerald-500 text-white border-emerald-500' : 'bg-transparent border-edge dark:border-edge-dark text-content-muted dark:text-content-muted-dark hover:border-emerald-500/40'
            }`}>
            <Check size={11} /> {isRTL ? 'سجل الآن' : 'Log now'}
          </button>
          <button onClick={() => setActMode('schedule')}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold cursor-pointer border transition-colors font-cairo ${
              actMode === 'schedule' ? 'bg-blue-500 text-white border-blue-500' : 'bg-transparent border-edge dark:border-edge-dark text-content-muted dark:text-content-muted-dark hover:border-blue-500/40'
            }`}>
            <Calendar size={11} /> {isRTL ? 'جدول' : 'Schedule'}
          </button>
        </div>
        {/* Scheduled date */}
        {actMode === 'schedule' && (
          <div className="mb-2.5">
            <div className="text-[11px] font-semibold text-content-muted dark:text-content-muted-dark mb-1.5">
              {isRTL ? 'تاريخ الموعد' : 'Scheduled Date'} <span className="text-red-500">*</span>
            </div>
            <input type="datetime-local" value={actForm.scheduled_date} onChange={e => setAct('scheduled_date', e.target.value)}
              className="w-full px-2 py-1.5 rounded-lg border border-edge dark:border-edge-dark bg-surface-input dark:bg-surface-input-dark text-content dark:text-content-dark text-xs outline-none" />
          </div>
        )}
        {/* Activity type chips */}
        <div className="flex gap-1.5 flex-wrap mb-2.5">
          {(activityTypes || []).map(v => (
            <button key={v.key} onClick={() => setAct('type', v.key)}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold cursor-pointer border transition-colors font-cairo ${
                actForm.type === v.key ? 'bg-brand-500 text-white border-brand-500' : 'bg-transparent border-edge dark:border-edge-dark text-content-muted dark:text-content-muted-dark hover:border-brand-500/40'
              }`}>
              <v.Icon size={11} /> {isRTL ? v.labelAr : v.label}
            </button>
          ))}
        </div>
        {/* Result buttons */}
        {currentResults.length > 0 && (
          <div className="mb-2.5">
            <div className="text-[11px] font-semibold text-content-muted dark:text-content-muted-dark mb-1.5">
              {RESULT_TITLES[actForm.type] || (isRTL ? 'النتيجة' : 'Result')} <span className="text-red-500">*</span>
            </div>
            <div className="flex gap-1.5 flex-wrap">
              {currentResults.map(r => (
                <button key={r.value} onClick={() => setActForm(f => ({ ...f, result: f.result === r.value ? '' : r.value }))}
                  className={`px-2.5 py-1 rounded-lg text-[11px] cursor-pointer border font-cairo ${actForm.result === r.value ? 'font-bold' : 'font-normal bg-transparent border-edge dark:border-edge-dark text-content-muted dark:text-content-muted-dark'}`}
                  style={actForm.result === r.value ? { background: r.color + '18', border: `1px solid ${r.color}`, color: r.color } : undefined}>
                  {r.label}
                </button>
              ))}
            </div>
          </div>
        )}
        <Textarea size="sm" rows={2}
          placeholder={isRTL ? 'وصف / ملاحظات...' : 'Description / notes...'}
          value={actForm.description} onChange={e => setAct('description', e.target.value)} />
      </div>

      <div className="border-t border-brand-500/10 my-2" />

      {/* ── Section 2: Task (Optional) ── */}
      {sectionHeader(<CheckSquare size={13} className="text-amber-500" />, isRTL ? 'أضف مهمة' : 'Add Task', addTask, () => setAddTask(p => !p))}
      {addTask && (
        <div className="ps-3 mb-3 mt-1">
          <div className="text-[11px] font-semibold text-content-muted dark:text-content-muted-dark mb-1.5">{isRTL ? 'نوع المهمة' : 'Task Type'}</div>
          <div className="flex gap-1.5 flex-wrap mb-2.5">
            {TASK_TYPES.map(ft => (
              <button key={ft.key} onClick={() => setTaskForm(f => ({ ...f, type: ft.key }))}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold cursor-pointer border transition-colors font-cairo ${
                  taskForm.type === ft.key ? 'bg-amber-500 text-white border-amber-500' : 'bg-transparent border-edge dark:border-edge-dark text-content-muted dark:text-content-muted-dark hover:border-amber-500/40'
                }`}>
                {isRTL ? ft.ar : ft.en}
              </button>
            ))}
          </div>
          <Textarea size="sm" rows={2}
            placeholder={isRTL ? 'وصف / تفاصيل...' : 'Description / details...'}
            value={taskForm.notes} onChange={e => setTaskForm(f => ({ ...f, notes: e.target.value }))}
            className="mb-2" />
          <div className="flex gap-2">
            <Select value={taskForm.priority} onChange={e => setTaskForm(f => ({ ...f, priority: e.target.value }))} className="flex-1" size="sm">
              {Object.entries(TASK_PRIORITIES).map(([k, v]) => <option key={k} value={k}>{isRTL ? v.ar : v.en}</option>)}
            </Select>
            <input type="datetime-local" value={taskForm.due_date} onChange={e => setTaskForm(f => ({ ...f, due_date: e.target.value }))}
              className="flex-1 px-2 py-1.5 rounded-lg border border-edge dark:border-edge-dark bg-surface-input dark:bg-surface-input-dark text-content dark:text-content-dark text-xs outline-none" />
          </div>
        </div>
      )}

      <div className="border-t border-brand-500/10 my-2" />

      {/* ── Section 3: Stage Change (Optional) ── */}
      {sectionHeader(<Target size={13} className="text-emerald-500" />, isRTL ? 'تغيير المرحلة' : 'Change Stage', changeStage, () => setChangeStage(p => !p))}
      {changeStage && (
        <div className="ps-3 mb-3 mt-1">
          <div className="flex gap-1.5 flex-wrap">
            {stages.map(s => (
              <button key={s.id} onClick={() => setNewStage(s.id)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold cursor-pointer border transition-colors font-cairo ${
                  newStage === s.id ? '' : 'border-edge dark:border-edge-dark bg-transparent text-content-muted dark:text-content-muted-dark hover:border-emerald-500/40'
                }`}
                style={newStage === s.id ? { background: (s.color || '#10B981') + '18', border: `1px solid ${s.color || '#10B981'}`, color: s.color || '#10B981' } : undefined}>
                {isRTL ? s.label_ar : s.label_en}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Save / Cancel ── */}
      <div className="flex gap-2 justify-end mt-3 pt-3 border-t border-brand-500/10">
        <Button variant="secondary" size="sm" onClick={onCancel}>{isRTL ? 'إلغاء' : 'Cancel'}</Button>
        <Button size="sm" onClick={handleSaveAll} disabled={!canSave || saving} className={!canSave ? 'opacity-50 cursor-not-allowed' : ''}>
          <Zap size={12} />
          {saving ? '...' : (isRTL ? 'حفظ الكل' : 'Save All')}
        </Button>
      </div>
    </div>
  );
}

export default function OpportunityDrawer({
  selectedOpp, onClose, onMove, onDelete, onUpdate,
  agents, projects, opps,
  isAdmin, isRTL: isRTLProp, lang, isDark, profile,
  scoreMap, configActivityResults, configActivityTypes, ACTIVITY_ICON_MAP,
  sourceLabelsMap, configTypeMap, deptLabelsMap, lostReasonsMap, configLostReasons,
  onPrev, onNext,
  onEditStageLost,
  onSelectOpp,
}) {
  const navigate = useNavigate();
  const toast = useToast();
  const { i18n } = useTranslation();
  const isRTL = isRTLProp ?? i18n.language === 'ar';
  const { profile: authProfile } = useAuth();
  const viewerProfile = profile || authProfile;

  // ─── State ───
  const [tab, setTab] = useState('activity');
  const [showEdit, setShowEdit] = useState(false);
  const [showDrawerMenu, setShowDrawerMenu] = useState(false);
  const [showAddActivity, setShowAddActivity] = useState(false);
  const [allActivities, setAllActivities] = useState([]);
  const [drawerActivities, setDrawerActivities] = useState([]);
  const [loadingActivities, setLoadingActivities] = useState(false);
  const [activityLimit, setActivityLimit] = useState(5);
  const [drawerNotes, setDrawerNotes] = useState([]);
  const [newNote, setNewNote] = useState('');
  const [editingNote, setEditingNote] = useState(null);
  const [editNoteText, setEditNoteText] = useState('');
  const [stageHistory, setStageHistory] = useState([]);
  const [stageConfirm, setStageConfirm] = useState(null);
  const [activityAgentFilter, setActivityAgentFilter] = useState('all');

  // Favorites
  const [isFav, setIsFav] = useState(false);
  useEffect(() => {
    if (selectedOpp?.id) setIsFav(checkFavorite(`opp_${selectedOpp.id}`));
  }, [selectedOpp?.id]);
  const handleToggleFav = () => {
    const contactName = selectedOpp.contacts ? (isRTL ? (selectedOpp.contacts.full_name_ar || selectedOpp.contacts.full_name_en) : (selectedOpp.contacts.full_name_en || selectedOpp.contacts.full_name_ar)) : '';
    const result = toggleFavorite({
      id: `opp_${selectedOpp.id}`,
      type: 'opportunity',
      name: contactName || `Opportunity #${selectedOpp.id}`,
      nameAr: selectedOpp.contacts?.full_name_ar || selectedOpp.contacts?.full_name_en || `فرصة #${selectedOpp.id}`,
      path: `/crm/opportunities?highlight=${selectedOpp.id}`,
    });
    setIsFav(result.added);
  };

  // ESC close
  useEscClose(onClose);

  // Log view when opportunity opens
  const lastViewedId = useRef(null);
  useEffect(() => {
    if (selectedOpp?.id && selectedOpp.id !== lastViewedId.current) {
      lastViewedId.current = selectedOpp.id;
      const contactName = selectedOpp.contacts
        ? (isRTL ? (selectedOpp.contacts.full_name_ar || selectedOpp.contacts.full_name_en) : (selectedOpp.contacts.full_name_en || selectedOpp.contacts.full_name_ar))
        : '';
      logView({ entityType: 'opportunity', entityId: selectedOpp.id, entityName: contactName || `Opportunity #${selectedOpp.id}`, viewer: viewerProfile });
    }
  }, [selectedOpp?.id, viewerProfile]);

  // Arrow key navigation (prev/next)
  useEffect(() => {
    const handler = (e) => {
      if (showEdit || showAddActivity || showDrawerMenu) return;
      const tag = e.target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || e.target.isContentEditable) return;
      if (e.key === 'ArrowLeft' && onNext) { e.preventDefault(); onNext(); }
      if (e.key === 'ArrowRight' && onPrev) { e.preventDefault(); onPrev(); }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onPrev, onNext, showEdit, showAddActivity, showDrawerMenu]);

  // Reset tab on opp change
  useEffect(() => {
    setTab('activity');
    setShowAddActivity(false);
    setShowDrawerMenu(false);
    setActivityAgentFilter('all');
  }, [selectedOpp?.id]);

  // Fetch activities
  useEffect(() => {
    if (!selectedOpp?.contact_id) { setAllActivities([]); setDrawerActivities([]); return; }
    let cancelled = false;
    setLoadingActivities(true);
    setActivityLimit(5);
    fetchContactActivities(selectedOpp.contact_id, { role: viewerProfile?.role, userId: viewerProfile?.id, teamId: viewerProfile?.team_id })
      .then(data => { if (!cancelled) { setAllActivities(data || []); setDrawerActivities((data || []).slice(0, 5)); } })
      .catch(() => { if (!cancelled) { setAllActivities([]); setDrawerActivities([]); } })
      .finally(() => { if (!cancelled) setLoadingActivities(false); });
    return () => { cancelled = true; };
  }, [selectedOpp?.contact_id]);

  useEffect(() => {
    setDrawerActivities(allActivities.slice(0, activityLimit));
  }, [activityLimit, allActivities]);

  // Notes & stage history
  useEffect(() => {
    if (!selectedOpp?.id) { setDrawerNotes([]); setStageHistory([]); return; }
    setDrawerNotes(getOppNotes(selectedOpp.id));
    setStageHistory(getStageHistory(selectedOpp.id));
  }, [selectedOpp?.id, selectedOpp?.stage]);

  // Close outside click on menu
  const menuRef = useRef(null);
  useEffect(() => {
    const handler = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) setShowDrawerMenu(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handlePrev = onPrev ? () => onPrev() : null;
  const handleNext = onNext ? () => onNext() : null;

  const handleSaveEdit = async (oppId, updates) => {
    await onUpdate(oppId, updates);
    if (updates.stage && updates.stage !== selectedOpp.stage) {
      setStageHistory(getStageHistory(oppId));
    }
  };

  if (!selectedOpp) return null;

  // Derived
  const score = scoreMap[selectedOpp.id] ?? calcLeadScore(selectedOpp);
  const stages = getDeptStages(selectedOpp.contacts?.department || 'sales');
  const currentIdx = stages.findIndex(st => st.id === selectedOpp.stage);
  const progressPct = stages.length > 1 ? Math.round((Math.max(0, currentIdx) / (stages.length - 1)) * 100) : 0;

  // Unique agents from activities
  const uniqueAgents = useMemo(() => {
    const map = new Map();
    allActivities.forEach(a => {
      const id = a.user_id || a.users?.full_name_ar || a.users?.full_name_en;
      if (!id) return;
      const name = isRTL ? (a.users?.full_name_ar || a.users?.full_name_en || '—') : (a.users?.full_name_en || a.users?.full_name_ar || '—');
      if (!map.has(id)) map.set(id, { id, name, count: 0 });
      map.get(id).count++;
    });
    return Array.from(map.values());
  }, [allActivities, isRTL]);
  const agentCount = uniqueAgents.length;

  // Filtered activities by agent
  const filteredActivities = useMemo(() => {
    if (activityAgentFilter === 'all') return drawerActivities;
    return drawerActivities.filter(a => {
      const id = a.user_id || a.users?.full_name_ar || a.users?.full_name_en;
      return id === activityAgentFilter;
    });
  }, [drawerActivities, activityAgentFilter]);

  // Client's other opportunities
  const clientOpps = useMemo(() => {
    if (!selectedOpp.contact_id) return [];
    return (opps || []).filter(o => o.contact_id === selectedOpp.contact_id && o.id !== selectedOpp.id);
  }, [opps, selectedOpp.contact_id, selectedOpp.id]);

  // Tabs config
  const tabs = [
    { key: 'activity', label: isRTL ? 'النشاط' : 'Activity', icon: Clock },
    { key: 'details', label: isRTL ? 'التفاصيل' : 'Details', icon: Briefcase },
    { key: 'documents', label: isRTL ? 'المستندات' : 'Documents', icon: FileText },
    { key: 'comments', label: isRTL ? 'تعليقات' : 'Comments', icon: MessageSquare },
  ];

  return (
    <>
    {showEdit && (
      <EditOpportunityModal
        opp={selectedOpp}
        agents={agents}
        projects={projects}
        profile={profile}
        onClose={() => setShowEdit(false)}
        onSave={handleSaveEdit}
        onEditStageLost={onEditStageLost}
      />
    )}
    <div className="fixed inset-0 z-[900] flex" dir={isRTL ? 'rtl' : 'ltr'}>
      <div onClick={onClose} className="flex-1 bg-black/45" />
      <div className={`w-[440px] max-w-[100vw] bg-surface-card dark:bg-surface-card-dark flex flex-col overflow-x-hidden ${isRTL ? 'border-l' : 'border-r'} border-edge dark:border-edge-dark`}>

        {/* ═══ COMPACT HEADER ═══ */}
        <div className="shrink-0 bg-gradient-to-b from-surface-bg to-surface-card dark:from-[#1B3347] dark:to-surface-card-dark">
          {/* Top bar */}
          <div className="flex justify-between items-center px-5 pt-3.5 pb-0">
            <div className="flex items-center gap-1">
              <button onClick={onClose} className="bg-transparent border-none text-content-muted dark:text-content-muted-dark cursor-pointer p-1 hover:bg-brand-500/10 rounded-lg transition-colors"><X size={18} /></button>
              {handlePrev && <button onClick={handlePrev} title={isRTL ? 'السابق' : 'Previous'} className="bg-transparent border-none text-content-muted dark:text-content-muted-dark cursor-pointer p-1 hover:bg-brand-500/10 rounded-lg transition-colors"><ChevronUp size={18} /></button>}
              {handleNext && <button onClick={handleNext} title={isRTL ? 'التالي' : 'Next'} className="bg-transparent border-none text-content-muted dark:text-content-muted-dark cursor-pointer p-1 hover:bg-brand-500/10 rounded-lg transition-colors"><ChevronDown size={18} /></button>}
            </div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={handleToggleFav}
                title={isFav ? (isRTL ? 'إزالة من المفضلة' : 'Remove from Favorites') : (isRTL ? 'إضافة للمفضلة' : 'Add to Favorites')}
                className={`bg-transparent border-none cursor-pointer p-1 rounded-md transition-colors ${isFav ? '' : 'text-content-muted dark:text-content-muted-dark'}`}
                style={isFav ? { color: '#F59E0B' } : {}}
              >
                <Star size={16} fill={isFav ? '#F59E0B' : 'none'} />
              </button>
              <Button variant="secondary" size="sm" onClick={() => setShowEdit(true)} className="!text-xs !px-2.5 !py-1">
                <Pencil size={12} /> {isRTL ? 'تعديل' : 'Edit'}
              </Button>
              <div ref={menuRef} className="relative">
                <button onClick={() => setShowDrawerMenu(p => !p)} className={`p-1.5 rounded-lg cursor-pointer transition-colors border ${showDrawerMenu ? 'bg-brand-500 border-brand-500 text-white' : 'bg-transparent border-edge dark:border-edge-dark text-content-muted dark:text-content-muted-dark hover:bg-brand-500/10'}`}>
                  <MoreVertical size={14} />
                </button>
                {showDrawerMenu && (
                  <div className="absolute top-[36px] end-0 bg-surface-card dark:bg-surface-card-dark border border-edge dark:border-edge-dark rounded-xl min-w-[180px] z-[100] shadow-[0_8px_30px_rgba(27,51,71,0.15)] overflow-hidden">
                    <div className="p-1">
                      {selectedOpp.contact_id && (
                        <button onClick={() => { navigate(`/crm/contacts?highlight=${selectedOpp.contact_id}`); setShowDrawerMenu(false); }} className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg border-none bg-transparent cursor-pointer text-xs text-content dark:text-content-dark font-inherit hover:bg-surface-bg dark:hover:bg-brand-500/10">
                          <ExternalLink size={13} className="text-brand-500" /> {isRTL ? 'عرض العميل' : 'View Contact'}
                        </button>
                      )}
                      <div className="h-px bg-edge dark:bg-edge-dark mx-1" />
                      <button onClick={() => { onDelete(selectedOpp.id); setShowDrawerMenu(false); }} className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg border-none bg-transparent cursor-pointer text-xs text-red-500 font-inherit hover:bg-red-500/[0.05]">
                        <Trash2 size={13} /> {isRTL ? 'حذف' : 'Delete'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Avatar + Name + Chips */}
          <div className="flex items-start gap-3.5 px-5 pt-3 pb-3">
            <div
              className="w-12 h-12 rounded-full shrink-0 flex items-center justify-center text-base font-bold bg-gradient-to-br from-[#2B4C6F] to-brand-500 text-white"
            >
              {initials(getContactName(selectedOpp))}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-bold leading-snug mb-0.5 flex items-center gap-1.5 text-content dark:text-content-dark">
                <span>{selectedOpp.contacts?.prefix ? <span className="text-[#6B8DB5] me-1">{selectedOpp.contacts.prefix}</span> : null}{getContactName(selectedOpp)}</span>
                {selectedOpp.id && <span className="text-[9px] font-medium text-content-muted dark:text-content-muted-dark bg-brand-500/[0.08] px-1.5 py-0.5 rounded-full shrink-0">#{String(selectedOpp.id).slice(-5)}</span>}
              </div>
              <div className="flex gap-1.5 items-center flex-wrap mb-1.5">
                {selectedOpp.contacts?.contact_type && (
                  <span className="text-[10px] px-1.5 py-px rounded-full bg-brand-500/15 text-brand-600 dark:text-brand-400 font-semibold">
                    {isRTL ? (configTypeMap[selectedOpp.contacts.contact_type]?.label || selectedOpp.contacts.contact_type) : (configTypeMap[selectedOpp.contacts.contact_type]?.labelEn || selectedOpp.contacts.contact_type)}
                  </span>
                )}
                {selectedOpp.contacts?.department && (
                  <span className="text-[10px] px-1.5 py-px rounded-full text-[#8BA8C8] bg-[rgba(139,168,200,0.1)] font-semibold">
                    {isRTL ? (deptLabelsMap[selectedOpp.contacts.department]?.ar || selectedOpp.contacts.department) : (deptLabelsMap[selectedOpp.contacts.department]?.en || selectedOpp.contacts.department)}
                  </span>
                )}
              </div>
              {(selectedOpp.contacts?.company || selectedOpp.contacts?.job_title) && (
                <div className="flex items-center gap-1.5 flex-wrap text-[10.5px] text-content-muted dark:text-content-muted-dark mb-1.5 opacity-80">
                  {selectedOpp.contacts.company && <span className="flex items-center gap-0.5"><Building2 size={9} /> {selectedOpp.contacts.company}</span>}
                  {selectedOpp.contacts.company && selectedOpp.contacts.job_title && <span className="opacity-40">·</span>}
                  {selectedOpp.contacts.job_title && <span className="flex items-center gap-0.5"><Briefcase size={9} /> {selectedOpp.contacts.job_title}</span>}
                </div>
              )}
              {selectedOpp.created_at && (
                <div className="text-[10.5px] text-content-muted dark:text-content-muted-dark opacity-70">
                  {new Date(selectedOpp.created_at).toLocaleDateString(isRTL ? 'ar-EG' : 'en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                </div>
              )}
            </div>
          </div>

          {/* Quick Actions */}
          {selectedOpp.contacts && (
            <div className="flex gap-2 px-5 pb-2.5">
              {selectedOpp.contacts.phone && (
                <a href={`tel:${selectedOpp.contacts.phone}`} className="flex-1 py-1.5 bg-emerald-500/10 border border-emerald-500/25 rounded-lg text-emerald-500 text-[11px] font-semibold text-center no-underline flex items-center justify-center gap-1">
                  <Phone size={12} /> {isRTL ? 'اتصال' : 'Call'}
                </a>
              )}
              {selectedOpp.contacts.phone && (
                <button
                  onClick={() => {
                    const phone = (selectedOpp.contacts.phone || '').replace(/[^0-9]/g, '');
                    logWhatsAppMessage({
                      contact_id: selectedOpp.contact_id,
                      contact_name: getContactName(selectedOpp),
                      contact_phone: selectedOpp.contacts.phone,
                      direction: 'outgoing',
                      message: '',
                      type: 'text',
                    });
                    window.open(generateWhatsAppLink(phone), '_blank');
                  }}
                  className="flex-1 py-1.5 bg-[#25D366]/10 border border-[#25D366]/25 rounded-lg text-[#25D366] text-[11px] font-semibold text-center cursor-pointer flex items-center justify-center gap-1"
                >
                  <MessageCircle size={12} /> {isRTL ? 'واتساب' : 'WA'}
                </button>
              )}
              {selectedOpp.contacts.email && (
                <a href={`mailto:${selectedOpp.contacts.email}`} className="flex-1 py-1.5 bg-brand-500/10 border border-brand-500/25 rounded-lg text-[#6B8DB5] text-[11px] font-semibold text-center no-underline flex items-center justify-center gap-1">
                  <Mail size={12} /> {isRTL ? 'إيميل' : 'Email'}
                </a>
              )}
              {selectedOpp.contact_id && (
                <button
                  onClick={() => navigate(`/crm/contacts?highlight=${selectedOpp.contact_id}`)}
                  className="flex-1 py-1.5 bg-brand-500/10 border border-brand-500/25 rounded-lg text-brand-500 text-[11px] font-semibold text-center cursor-pointer flex items-center justify-center gap-1"
                >
                  <ExternalLink size={12} /> {isRTL ? 'العميل' : 'Contact'}
                </button>
              )}
            </div>
          )}

          {/* Stats Bar */}
          <div className="flex gap-0 mx-5 mb-2.5 rounded-lg border border-edge dark:border-edge-dark overflow-hidden">
            <div className="flex-1 py-1.5 text-center bg-brand-500/[0.05]">
              <span className="text-sm font-bold" style={{ color: scoreColor(score) }}>{score}</span>
              <span className="text-[10px] text-content-muted dark:text-content-muted-dark ms-1">{isRTL ? 'نقاط' : 'Score'}</span>
            </div>
            <div className="w-px bg-edge dark:bg-edge-dark" />
            <div className="flex-1 py-1.5 text-center bg-brand-500/[0.05]">
              <span className="text-sm font-bold text-brand-500">{fmtBudget(selectedOpp.budget)}</span>
              <span className="text-[10px] text-content-muted dark:text-content-muted-dark ms-1">{isRTL ? 'ج.م' : 'EGP'}</span>
            </div>
            <div className="w-px bg-edge dark:bg-edge-dark" />
            <div className="flex-1 py-1.5 text-center bg-brand-500/[0.05]">
              <span className="text-sm font-bold" style={{ color: daysInStage(selectedOpp) > 7 ? '#EF4444' : daysInStage(selectedOpp) > 3 ? '#F59E0B' : '#6B8DB5' }}>
                {daysInStage(selectedOpp)}
              </span>
              <span className="text-[10px] text-content-muted dark:text-content-muted-dark ms-1">{isRTL ? 'يوم' : 'days'}</span>
            </div>
            <div className="w-px bg-edge dark:bg-edge-dark" />
            <div className="flex-1 py-1.5 text-center bg-amber-500/[0.05]">
              <span className="text-sm font-bold text-amber-500">{loadingActivities ? '…' : agentCount}</span>
              <span className="text-[10px] text-content-muted dark:text-content-muted-dark ms-1">{isRTL ? 'موظف' : 'Agents'}</span>
            </div>
          </div>

          {/* ═══ TABS ═══ */}
          <div className="flex border-b border-edge dark:border-edge-dark px-2">
            {tabs.map(t => {
              const TabIcon = t.icon;
              const isActive = tab === t.key;
              return (
                <button key={t.key} onClick={() => setTab(t.key)} title={t.label}
                  className={`flex-1 py-2.5 bg-transparent border-0 border-b-2 border-solid text-xs cursor-pointer flex items-center justify-center gap-1 transition-colors ${isActive ? 'border-b-brand-500 text-brand-500 font-bold' : 'border-b-transparent text-content-muted dark:text-content-muted-dark font-normal hover:text-content dark:hover:text-content-dark'}`}>
                  <TabIcon size={14} />
                  <span className="hidden sm:inline truncate max-w-[60px]">{t.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* ═══ Drawer Body ═══ */}
        <div className="flex-1 overflow-auto p-5">

          {/* ══════ ACTIVITY TAB ══════ */}
          {tab === 'activity' && (
            <div>
              {/* Take Action Button */}
              <div className="mb-4">
                <button onClick={() => setShowAddActivity(p => !p)}
                  className={`w-full py-2 rounded-lg text-xs font-semibold cursor-pointer flex items-center justify-center gap-1.5 border transition-colors ${showAddActivity ? 'bg-brand-500 text-white border-brand-500' : 'bg-brand-500/[0.08] border-brand-500/25 text-brand-500'}`}>
                  <Zap size={13} /> {isRTL ? 'اتخذ إجراء' : 'Take Action'}
                </button>
              </div>

              {/* Take Action Form */}
              {showAddActivity && (
                <OppTakeActionForm
                  selectedOpp={selectedOpp}
                  isRTL={isRTL}
                  configActivityTypes={configActivityTypes}
                  configActivityResults={configActivityResults}
                  ACTIVITY_ICON_MAP={ACTIVITY_ICON_MAP}
                  stages={stages}
                  profile={profile}
                  onSaveActivity={async (actData) => {
                    try {
                      const act = await createActivity({
                        ...actData,
                        contact_id: selectedOpp.contact_id,
                        entity_type: 'opportunity',
                        entity_id: selectedOpp.id,
                        user_id: viewerProfile?.id || null,
                        user_name_ar: viewerProfile?.full_name_ar || '',
                        user_name_en: viewerProfile?.full_name_en || '',
                      });
                      setAllActivities(prev => [act, ...prev]);
                      toast.success(isRTL ? 'تم حفظ النشاط' : 'Activity saved');
                    } catch {
                      toast.error(isRTL ? 'فشل حفظ النشاط' : 'Failed to save activity');
                    }
                  }}
                  onSaveTask={async (taskData) => {
                    try {
                      await createTask({ ...taskData, assigned_to: viewerProfile?.id || null, assigned_to_name_ar: viewerProfile?.full_name_ar || '', assigned_to_name_en: viewerProfile?.full_name_en || '' });
                      toast.success(isRTL ? 'تم إنشاء المهمة' : 'Task created');
                    } catch {
                      toast.error(isRTL ? 'فشل إنشاء المهمة' : 'Failed to create task');
                    }
                  }}
                  onStageChange={(newStage) => {
                    if (newStage !== selectedOpp.stage) {
                      addStageHistory(selectedOpp.id, selectedOpp.stage, newStage);
                      onMove(selectedOpp.id, newStage);
                    }
                  }}
                  onCancel={() => setShowAddActivity(false)}
                />
              )}

              {/* Pipeline Stepper */}
              <div className="mb-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="m-0 text-xs font-semibold text-content-muted dark:text-content-muted-dark">
                    {isRTL ? 'مراحل التقدم' : 'Pipeline Progress'}
                  </p>
                  <span className="text-xs font-bold" style={{ color: progressPct >= 80 ? '#10B981' : progressPct >= 40 ? '#F59E0B' : '#6B8DB5' }}>
                    {progressPct}%
                  </span>
                </div>
                <div className="flex items-start">
                  {stages.map((s, i) => {
                    const isPast = i < currentIdx;
                    const isCurrent = i === currentIdx;
                    const isLost = selectedOpp.stage === 'closed_lost';
                    const isBackward = !isAdmin && i < currentIdx;
                    return (
                      <div key={s.id} className="flex items-start flex-1 min-w-0">
                        <button
                          onClick={() => !isBackward && !isCurrent && setStageConfirm(s)}
                          className={`flex flex-col items-center gap-1 bg-transparent border-none w-full group p-0 ${isBackward ? 'cursor-not-allowed opacity-50' : isCurrent ? 'cursor-default' : 'cursor-pointer'}`}
                        >
                          <div
                            className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold transition-all ${
                              isCurrent ? 'ring-2 ring-offset-1 ring-offset-surface-card dark:ring-offset-surface-card-dark' : ''
                            } ${
                              isPast || isCurrent
                                ? isLost && isCurrent ? 'bg-red-500 text-white ring-red-500' : 'text-white'
                                : 'bg-gray-100 dark:bg-white/10 text-content-muted dark:text-content-muted-dark group-hover:bg-brand-500/20'
                            }`}
                            style={(isPast || isCurrent) && !(isLost && isCurrent) ? { background: s.color, '--tw-ring-color': s.color } : {}}
                          >
                            {isPast ? '✓' : i + 1}
                          </div>
                          <span className={`text-[8px] text-center leading-tight max-w-full ${isCurrent ? 'font-bold text-content dark:text-content-dark' : 'text-content-muted dark:text-content-muted-dark'}`}>
                            {isRTL ? s.label_ar : s.label_en}
                          </span>
                        </button>
                        {i < stages.length - 1 && (
                          <div className={`h-[2px] flex-1 min-w-[4px] mt-[13px] -mx-0.5 ${i < currentIdx ? 'bg-brand-500' : 'bg-gray-200 dark:bg-white/10'}`} />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Stage Confirmation */}
              {stageConfirm && (
                <div className="bg-brand-500/[0.08] border border-brand-500/20 rounded-xl p-3 mb-4">
                  <p className="m-0 mb-2 text-xs font-semibold text-content dark:text-content-dark">
                    {isRTL ? 'تأكيد تغيير المرحلة' : 'Confirm Stage Change'}
                  </p>
                  <p className="m-0 mb-3 text-[11px] text-content-muted dark:text-content-muted-dark">
                    {isRTL
                      ? `نقل من "${deptStageLabel(selectedOpp.stage, selectedOpp.contacts?.department || 'sales', true)}" إلى "${stageConfirm.label_ar}"؟`
                      : `Move from "${deptStageLabel(selectedOpp.stage, selectedOpp.contacts?.department || 'sales', false)}" to "${stageConfirm.label_en}"?`}
                  </p>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => { onMove(selectedOpp.id, stageConfirm.id); setStageConfirm(null); }}>
                      {isRTL ? 'تأكيد' : 'Confirm'}
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setStageConfirm(null)}>
                      {isRTL ? 'إلغاء' : 'Cancel'}
                    </Button>
                  </div>
                </div>
              )}

              {/* Agent Filter Chips */}
              {!loadingActivities && uniqueAgents.length > 1 && (
                <div className="flex gap-1.5 mb-3 flex-wrap">
                  <button
                    onClick={() => setActivityAgentFilter('all')}
                    className={`px-2.5 py-1 rounded-full text-[11px] cursor-pointer border transition-colors ${activityAgentFilter === 'all' ? 'bg-brand-500 text-white border-brand-500 font-bold' : 'bg-transparent border-edge dark:border-edge-dark text-content-muted dark:text-content-muted-dark font-normal hover:border-brand-500/40'}`}
                  >
                    {isRTL ? 'الكل' : 'All'} ({allActivities.length})
                  </button>
                  {uniqueAgents.map(ag => (
                    <button
                      key={ag.id}
                      onClick={() => setActivityAgentFilter(activityAgentFilter === ag.id ? 'all' : ag.id)}
                      className={`px-2.5 py-1 rounded-full text-[11px] cursor-pointer border transition-colors ${activityAgentFilter === ag.id ? 'bg-brand-500 text-white border-brand-500 font-bold' : 'bg-transparent border-edge dark:border-edge-dark text-content-muted dark:text-content-muted-dark font-normal hover:border-brand-500/40'}`}
                    >
                      {ag.name} ({ag.count})
                    </button>
                  ))}
                </div>
              )}

              {/* Activities Timeline */}
              {loadingActivities ? (
                <div className="text-center py-4 text-xs text-content-muted dark:text-content-muted-dark"><Loader2 size={16} className="animate-spin inline-block" /></div>
              ) : filteredActivities.length === 0 ? (
                <div className="text-center py-6 text-xs text-content-muted dark:text-content-muted-dark opacity-60">
                  <Clock size={24} className="opacity-30 mb-1.5 mx-auto" />
                  <p className="m-0 mb-2">{isRTL ? 'لا توجد أنشطة' : 'No activities'}</p>
                  <button onClick={() => setShowAddActivity(true)} className="text-[10px] text-brand-500 bg-brand-500/10 border-none rounded-md px-2.5 py-1.5 cursor-pointer hover:bg-brand-500/20 transition-colors font-cairo font-semibold">
                    <Plus size={10} className="inline -mt-px" /> {isRTL ? 'سجّل أول نشاط' : 'Log first activity'}
                  </button>
                </div>
              ) : (
                <div>
                  {filteredActivities.map(act => {
                    const ActIcon = ACTIVITY_ICON_MAP[act.type] || ACTIVITY_ICONS[act.type] || Clock;
                    const resultConfig = act.result && configActivityResults[act.type]?.find(r => r.value === act.result);
                    return (
                      <div key={act.id} className="flex gap-0 relative mb-0.5">
                        <div className="flex flex-col items-center shrink-0" style={{ width: 28 }}>
                          <div className="w-[22px] h-[22px] rounded-full border-2 flex items-center justify-center shrink-0 bg-surface-card dark:bg-surface-card-dark z-[1]" style={{ borderColor: '#4A7AAB', background: 'rgba(74,122,171,0.10)' }}>
                            <ActIcon size={11} color="#4A7AAB" />
                          </div>
                          <div className="w-px flex-1 min-h-[8px]" style={{ background: 'rgba(74,122,171,0.20)' }} />
                        </div>
                        <div className="flex-1 min-w-0 pb-3 ps-2.5 pt-0.5 group">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-content dark:text-content-dark text-xs font-semibold">{act.notes || act.description || (isRTL ? 'نشاط' : 'Activity')}</span>
                            {resultConfig && (
                              <span className="text-[9px] font-bold px-1.5 py-px rounded-md" style={{ background: `${resultConfig.color}18`, color: resultConfig.color }}>
                                {isRTL ? resultConfig.label_ar : resultConfig.label_en}
                              </span>
                            )}
                            <button
                              onClick={() => { setAllActivities(prev => prev.filter(a => a.id !== act.id)); toast.success(isRTL ? 'تم حذف النشاط' : 'Activity deleted'); }}
                              className="bg-transparent border-none cursor-pointer text-red-400 p-0 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 ms-auto"
                              title={isRTL ? 'حذف' : 'Delete'}
                            ><X size={11} /></button>
                          </div>
                          <div className="flex items-center gap-1.5 mt-1 text-[11px] text-content-muted dark:text-content-muted-dark">
                            <span className="font-bold" style={{ color: '#4A7AAB' }}>
                              {isRTL ? ({ call: 'مكالمة', whatsapp: 'واتساب', email: 'إيميل', meeting: 'اجتماع', site_visit: 'زيارة', note: 'ملاحظة' }[act.type] || 'نشاط') : ({ call: 'Call', whatsapp: 'WhatsApp', email: 'Email', meeting: 'Meeting', site_visit: 'Site Visit', note: 'Note' }[act.type] || 'Activity')}
                            </span>
                            <span className="opacity-30">|</span>
                            <span className="font-medium text-content dark:text-content-dark">{isRTL ? (act.users?.full_name_ar || '—') : (act.users?.full_name_en || act.users?.full_name_ar || '—')}</span>
                            <span className="opacity-30">|</span>
                            <span>{act.created_at?.slice(0, 10)}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  {allActivities.length > activityLimit && (
                    <button
                      onClick={() => setActivityLimit(l => l + 10)}
                      className="text-[10px] text-brand-500 bg-brand-500/10 border-none rounded-md px-2.5 py-1.5 cursor-pointer hover:bg-brand-500/20 transition-colors font-cairo font-semibold mt-1 w-full"
                    >
                      {isRTL ? `عرض المزيد (${allActivities.length - activityLimit} متبقي)` : `Load more (${allActivities.length - activityLimit} remaining)`}
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ══════ DETAILS TAB ══════ */}
          {tab === 'details' && (
            <div className="flex flex-col gap-4">
              {/* Data Grid */}
              <div className="grid grid-cols-2 gap-2.5">
                {[
                  { label: isRTL ? 'المرحلة' : 'Stage', value: deptStageLabel(selectedOpp.stage, selectedOpp.contacts?.department || 'sales', isRTL), color: (stages.find(s => s.id === selectedOpp.stage)?.color || '#4A7AAB') },
                  { label: isRTL ? 'الميزانية' : 'Budget', value: fmtBudget(selectedOpp.budget) + ' ' + (isRTL ? 'ج.م' : 'EGP'), color: '#4A7AAB' },
                  { label: isRTL ? 'الحرارة' : 'Temperature', value: isRTL ? (TEMP_CONFIG[selectedOpp.temperature] || TEMP_CONFIG.cold).label_ar : (TEMP_CONFIG[selectedOpp.temperature] || TEMP_CONFIG.cold).label_en, color: (TEMP_CONFIG[selectedOpp.temperature] || TEMP_CONFIG.cold).color },
                  { label: isRTL ? 'الأولوية' : 'Priority', value: isRTL ? (PRIORITY_CONFIG[selectedOpp.priority] || PRIORITY_CONFIG.medium).label_ar : (PRIORITY_CONFIG[selectedOpp.priority] || PRIORITY_CONFIG.medium).label_en, color: (PRIORITY_CONFIG[selectedOpp.priority] || PRIORITY_CONFIG.medium).color },
                  { label: isRTL ? 'المسؤول' : 'Agent', value: getAgentName(selectedOpp, lang), color: isDark ? '#E2EAF4' : '#1B3347' },
                  { label: isRTL ? 'تم التعيين بواسطة' : 'Assigned By', value: (() => { if (!selectedOpp.assigned_by) return '—'; const a = agents.find(ag => ag.id === selectedOpp.assigned_by); return a ? (lang === 'ar' ? a.full_name_ar : (a.full_name_en || a.full_name_ar)) : '—'; })(), color: '#6B8DB5' },
                  { label: isRTL ? 'أنشأها' : 'Created By', value: selectedOpp.created_by_name || '—', color: '#6B8DB5' },
                  { label: isRTL ? 'في المرحلة منذ' : 'In Stage', value: daysInStage(selectedOpp) + (isRTL ? ' يوم' : ' days'), color: daysInStage(selectedOpp) > 7 ? '#EF4444' : daysInStage(selectedOpp) > 3 ? '#F59E0B' : '#6B8DB5' },
                  ...(selectedOpp.expected_close_date ? [{ label: isRTL ? 'الإغلاق المتوقع' : 'Expected Close', value: new Date(selectedOpp.expected_close_date).toLocaleDateString(isRTL ? 'ar-EG' : 'en-US', { month: 'short', day: 'numeric', year: 'numeric' }), color: new Date(selectedOpp.expected_close_date) < new Date() ? '#EF4444' : '#6B8DB5' }] : []),
                  ...((selectedOpp.contacts?.source || selectedOpp.source) ? [{ label: isRTL ? 'المصدر' : 'Source', value: (() => { const src = selectedOpp.contacts?.source || selectedOpp.source; return isRTL ? (sourceLabelsMap[src]?.ar || src) : (sourceLabelsMap[src]?.en || src); })(), color: '#6B8DB5' }] : []),
                  { label: isRTL ? 'عدد فرص العميل' : 'Client Opps', value: (opps || []).filter(o => o.contact_id === selectedOpp.contact_id).length, color: '#6B8DB5' },
                ].map((item, i) => (
                  <div key={i} className="bg-brand-500/[0.08] dark:bg-brand-500/[0.08] rounded-xl px-3.5 py-3">
                    <p className="m-0 mb-1 text-xs text-content-muted dark:text-content-muted-dark">{item.label}</p>
                    <p className="m-0 text-sm font-bold" style={{ color: item.color }}>{item.value}</p>
                  </div>
                ))}
              </div>

              {/* Project */}
              {getProjectName(selectedOpp, lang) && (
                <div className="bg-brand-500/[0.08] rounded-xl px-3.5 py-3">
                  <p className="m-0 mb-1 text-xs text-content-muted dark:text-content-muted-dark">{isRTL ? 'المشروع' : 'Project'}</p>
                  <p className="m-0 text-sm font-semibold text-content dark:text-content-dark">{getProjectName(selectedOpp, lang)}</p>
                </div>
              )}

              {/* Lost Reason */}
              {selectedOpp.lost_reason && selectedOpp.stage === 'closed_lost' && (
                <div className="bg-red-500/[0.08] rounded-xl px-3.5 py-3">
                  <p className="m-0 mb-1 text-xs text-red-500 font-semibold">{isRTL ? 'سبب الخسارة' : 'Lost Reason'}</p>
                  <p className="m-0 text-xs text-content dark:text-content-dark">
                    {lostReasonsMap[selectedOpp.lost_reason]
                      ? (isRTL ? lostReasonsMap[selectedOpp.lost_reason].label_ar : lostReasonsMap[selectedOpp.lost_reason].label_en)
                      : selectedOpp.lost_reason}
                  </p>
                </div>
              )}

              {/* Notes from opp */}
              {selectedOpp.notes && (
                <div className="bg-brand-500/[0.08] rounded-xl px-3.5 py-3">
                  <p className="m-0 mb-1 text-xs text-content-muted dark:text-content-muted-dark">{isRTL ? 'ملاحظات' : 'Notes'}</p>
                  <p className="m-0 text-xs text-content dark:text-content-dark leading-relaxed">{selectedOpp.notes}</p>
                </div>
              )}

              {/* Notes Timeline (CRUD) */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="m-0 text-xs font-semibold text-content-muted dark:text-content-muted-dark">
                    <StickyNote size={12} className="inline -mt-px" /> {isRTL ? 'ملاحظات إضافية' : 'Extra Notes'} ({drawerNotes.length})
                  </p>
                </div>
                <div className="flex gap-1.5 mb-2">
                  <Input value={newNote} onChange={e => setNewNote(e.target.value)} placeholder={isRTL ? 'أضف ملاحظة...' : 'Add note...'} className="text-xs flex-1" onKeyDown={e => {
                    if (e.key === 'Enter' && newNote.trim()) {
                      e.stopPropagation();
                      const note = addOppNote(selectedOpp.id, newNote.trim());
                      setDrawerNotes(prev => [note, ...prev]);
                      setNewNote('');
                    }
                  }} />
                  <Button size="sm" onClick={() => {
                    if (!newNote.trim()) return;
                    const note = addOppNote(selectedOpp.id, newNote.trim());
                    setDrawerNotes(prev => [note, ...prev]);
                    setNewNote('');
                  }}><Plus size={12} /></Button>
                </div>
                {drawerNotes.map(n => (
                  <div key={n.id} className="bg-amber-500/[0.06] border border-amber-500/10 rounded-lg p-2.5 mb-1.5 group">
                    {editingNote === n.id ? (
                      <div className="flex gap-1.5">
                        <Input value={editNoteText} onChange={e => setEditNoteText(e.target.value)} className="text-xs flex-1" onKeyDown={e => {
                          if (e.key === 'Enter' && editNoteText.trim()) {
                            e.stopPropagation();
                            deleteOppNote(selectedOpp.id, n.id);
                            const updated = addOppNote(selectedOpp.id, editNoteText.trim());
                            setDrawerNotes(prev => prev.map(x => x.id === n.id ? { ...updated, id: updated.id } : x));
                            setEditingNote(null);
                          }
                          if (e.key === 'Escape') setEditingNote(null);
                        }} autoFocus />
                        <Button size="sm" onClick={() => {
                          if (!editNoteText.trim()) return;
                          deleteOppNote(selectedOpp.id, n.id);
                          const updated = addOppNote(selectedOpp.id, editNoteText.trim());
                          setDrawerNotes(prev => prev.map(x => x.id === n.id ? { ...updated, id: updated.id } : x));
                          setEditingNote(null);
                        }}>✓</Button>
                        <Button variant="ghost" size="sm" onClick={() => setEditingNote(null)}>✕</Button>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-start justify-between gap-2">
                          <p className="m-0 text-xs text-content dark:text-content-dark leading-relaxed flex-1 cursor-pointer" onClick={() => { setEditingNote(n.id); setEditNoteText(n.text); }}>{n.text}</p>
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                            <button onClick={() => { setEditingNote(n.id); setEditNoteText(n.text); }} className="bg-transparent border-none cursor-pointer text-brand-500 p-0" title={isRTL ? 'تعديل' : 'Edit'}><Pencil size={10} /></button>
                            <button onClick={() => { deleteOppNote(selectedOpp.id, n.id); setDrawerNotes(prev => prev.filter(x => x.id !== n.id)); }} className="bg-transparent border-none cursor-pointer text-red-400 p-0" title={isRTL ? 'حذف' : 'Delete'}><X size={11} /></button>
                          </div>
                        </div>
                        <p className="m-0 mt-1 text-[10px] text-content-muted dark:text-content-muted-dark">{new Date(n.at).toLocaleDateString(isRTL ? 'ar-EG' : 'en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                      </>
                    )}
                  </div>
                ))}
              </div>

              {/* Lead Score */}
              <div className="bg-brand-500/[0.08] rounded-xl px-3.5 py-3">
                <p className="m-0 mb-1.5 text-xs text-content-muted dark:text-content-muted-dark">{isRTL ? 'درجة العميل' : 'Lead Score'}</p>
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-2 bg-gray-200 dark:bg-white/10 rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-500" style={{ width: `${score}%`, background: scoreColor(score) }} />
                  </div>
                  <span className="text-sm font-bold" style={{ color: scoreColor(score) }}>{score}</span>
                  <span className="text-[10px] font-semibold" style={{ color: scoreColor(score) }}>{scoreLabel(score, isRTL)}</span>
                </div>
              </div>

              {/* Stage History */}
              {stageHistory.length > 0 && (
                <div>
                  <p className="m-0 mb-2 text-xs font-semibold text-content-muted dark:text-content-muted-dark">
                    {isRTL ? 'سجل المراحل' : 'Stage History'}
                  </p>
                  <div className="space-y-1">
                    {stageHistory.slice(0, 5).map((h, i) => {
                      const fromLabel = stages.find(s => s.id === h.from);
                      const toLabel = stages.find(s => s.id === h.to);
                      return (
                        <div key={i} className="flex items-center gap-2 text-[10px] text-content-muted dark:text-content-muted-dark bg-gray-50 dark:bg-white/[0.03] rounded-lg px-2.5 py-1.5">
                          <span className="font-semibold" style={{ color: fromLabel?.color || '#6B8DB5' }}>{isRTL ? (fromLabel?.label_ar || h.from) : (fromLabel?.label_en || h.from)}</span>
                          <span>→</span>
                          <span className="font-semibold" style={{ color: toLabel?.color || '#6B8DB5' }}>{isRTL ? (toLabel?.label_ar || h.to) : (toLabel?.label_en || h.to)}</span>
                          <span className="ms-auto">{new Date(h.at).toLocaleDateString(isRTL ? 'ar-EG' : 'en-US', { month: 'short', day: 'numeric' })}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Client's Other Opportunities */}
              {clientOpps.length > 0 && (
                <div>
                  <p className="m-0 mb-2 text-xs font-semibold text-content-muted dark:text-content-muted-dark">
                    {isRTL ? `فرص العميل الأخرى (${clientOpps.length})` : `Other Client Opps (${clientOpps.length})`}
                  </p>
                  <div className="flex flex-col gap-1.5">
                    {clientOpps.slice(0, 5).map(opp => {
                      const stg = stages.find(s => s.id === opp.stage);
                      return (
                        <button
                          key={opp.id}
                          onClick={() => onSelectOpp && onSelectOpp(opp)}
                          className="w-full flex items-center gap-3 p-2.5 rounded-xl bg-emerald-500/[0.05] border border-emerald-500/15 text-start cursor-pointer hover:bg-emerald-500/[0.10] transition-colors"
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-0.5">
                              <span className="text-xs font-bold text-content dark:text-content-dark">#{String(opp.id).slice(-4)}</span>
                              <span className="text-[10px] px-1.5 py-px rounded-full font-semibold" style={{ background: (stg?.color || '#6B8DB5') + '18', color: stg?.color || '#6B8DB5' }}>
                                {isRTL ? (stg?.label_ar || opp.stage) : (stg?.label_en || opp.stage)}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 text-[10px] text-content-muted dark:text-content-muted-dark">
                              {opp.budget > 0 && <span>{fmtBudget(opp.budget)} {isRTL ? 'ج.م' : 'EGP'}</span>}
                              {opp.temperature && <><span className="opacity-40">·</span><span style={{ color: (TEMP_CONFIG[opp.temperature] || TEMP_CONFIG.cold).color }}>{isRTL ? (TEMP_CONFIG[opp.temperature] || TEMP_CONFIG.cold).label_ar : (TEMP_CONFIG[opp.temperature] || TEMP_CONFIG.cold).label_en}</span></>}
                              <span className="opacity-40">·</span>
                              <span>{opp.created_at?.slice(0, 10)}</span>
                            </div>
                          </div>
                          <ChevronDown size={12} className="text-content-muted dark:text-content-muted-dark rotate-[-90deg] shrink-0" />
                        </button>
                      );
                    })}
                    {clientOpps.length > 5 && (
                      <p className="m-0 text-[10px] text-brand-500 text-center font-semibold">
                        {isRTL ? `+${clientOpps.length - 5} فرص أخرى` : `+${clientOpps.length - 5} more`}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Emails */}
              <OppEmailsSection oppId={selectedOpp.id} contactName={getContactName(selectedOpp)} contactId={selectedOpp.contact_id} isRTL={isRTL} isDark={isDark} />

              {/* Follow Up Reminder */}
              <FollowUpReminder entityType="opportunity" entityId={String(selectedOpp.id)} entityName={getContactName(selectedOpp)} />

              {/* Viewed By */}
              {(() => {
                const viewers = getEntityViewers('opportunity', selectedOpp.id);
                if (viewers.length === 0) return null;
                return (
                  <div className="rounded-xl border border-edge dark:border-edge-dark overflow-hidden">
                    <div className="flex items-center gap-2 px-3.5 py-2 bg-surface-input/50 dark:bg-surface-input-dark/50 border-b border-edge dark:border-edge-dark">
                      <Star size={13} style={{ color: '#6B21A8' }} />
                      <span className="text-[11px] font-bold text-content dark:text-content-dark uppercase tracking-wide">{isRTL ? 'شوهد بواسطة' : 'Viewed By'}</span>
                      <span className="text-[9px] text-content-muted dark:text-content-muted-dark ms-auto">{viewers.length} {isRTL ? 'مستخدم' : 'users'}</span>
                    </div>
                    <div className="px-3.5 py-1.5 max-h-[180px] overflow-y-auto">
                      {viewers.map(v => (
                        <div key={v.user_id} className="flex items-center justify-between py-1.5 border-b border-brand-500/[0.06] last:border-b-0 text-[11px]">
                          <div>
                            <span className="text-content dark:text-content-dark font-medium">{v.user_name}</span>
                            {v.user_role && <span className="text-content-muted/50 dark:text-content-muted-dark/50 ms-1.5 text-[9px]">{v.user_role}</span>}
                          </div>
                          <div className="text-end">
                            <span className="text-content-muted dark:text-content-muted-dark">
                              {v.views}x · {new Date(v.last_view).toLocaleDateString(isRTL ? 'ar-EG' : 'en-US', { month: 'short', day: 'numeric' })} {new Date(v.last_view).toLocaleTimeString(isRTL ? 'ar-EG' : 'en-US', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

          {/* ══════ DOCUMENTS TAB ══════ */}
          {tab === 'documents' && (
            <DocumentsSection
              entity="opportunity"
              entityId={selectedOpp.id}
              entityName={getContactName(selectedOpp)}
            />
          )}

          {/* ══════ COMMENTS TAB ══════ */}
          {tab === 'comments' && (
            <CommentsSection
              entity="opportunity"
              entityId={selectedOpp.id}
              entityName={getContactName(selectedOpp)}
            />
          )}
        </div>
      </div>
    </div>
    </>
  );
}

// ── Opportunity Emails Section ─────────────────────────────────
function OppEmailsSection({ oppId, contactName, contactId, isRTL, isDark }) {
  const [emails, setEmails] = useState([]);
  const [expanded, setExpanded] = useState(false);
  const [showCompose, setShowCompose] = useState(false);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');

  const refresh = useCallback(() => {
    setEmails(getEmailsByOpportunity(oppId));
  }, [oppId]);

  useEffect(() => { refresh(); }, [refresh]);
  useEffect(() => {
    const handler = () => refresh();
    window.addEventListener('platform_emails_changed', handler);
    return () => window.removeEventListener('platform_emails_changed', handler);
  }, [refresh]);

  const handleSend = () => {
    if (!subject.trim() && !body.trim()) return;
    sendEmail({
      to: contactName || '',
      to_name: contactName || '',
      subject,
      body,
      contact_id: contactId || null,
      opportunity_id: oppId,
    });
    setSubject('');
    setBody('');
    setShowCompose(false);
  };

  return (
    <div className={`rounded-xl p-3 ${isDark ? 'bg-[rgba(74,122,171,0.06)]' : 'bg-[rgba(74,122,171,0.04)]'}`}>
      <div onClick={() => setExpanded(!expanded)} className="flex items-center gap-2 cursor-pointer justify-between">
        <div className="flex items-center gap-2">
          <Mail size={15} className="text-[#4A7AAB]" />
          <span className="text-xs font-semibold text-content dark:text-content-dark">
            {isRTL ? 'الرسائل' : 'Emails'}
          </span>
          {emails.length > 0 && (
            <span className="min-w-[18px] h-[18px] rounded-full text-[10px] font-bold flex items-center justify-center px-1 bg-[rgba(74,122,171,0.15)] text-[#4A7AAB]">
              {emails.length}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={(e) => { e.stopPropagation(); setShowCompose(!showCompose); setExpanded(true); }}
            className="w-6 h-6 rounded-md border-none cursor-pointer flex items-center justify-center bg-[rgba(74,122,171,0.1)]"
          >
            <Plus size={13} className="text-[#4A7AAB]" />
          </button>
          {expanded ? <ChevronUp size={14} className="text-content-muted dark:text-content-muted-dark" /> : <ChevronDown size={14} className="text-content-muted dark:text-content-muted-dark" />}
        </div>
      </div>

      {expanded && (
        <div className="mt-2.5">
          {showCompose && (
            <div className={`p-2.5 rounded-lg mb-2.5 border ${isDark ? 'bg-black/20 border-white/[0.06]' : 'bg-white/80 border-black/[0.06]'}`}>
              <input
                value={subject}
                onChange={e => setSubject(e.target.value)}
                placeholder={isRTL ? 'الموضوع' : 'Subject'}
                className="w-full px-2 py-1.5 rounded-md border border-edge dark:border-edge-dark bg-transparent text-content dark:text-content-dark text-xs outline-none mb-1.5"
              />
              <textarea
                value={body}
                onChange={e => setBody(e.target.value)}
                placeholder={isRTL ? 'محتوى الرسالة...' : 'Message body...'}
                rows={3}
                className="w-full px-2 py-1.5 rounded-md border border-edge dark:border-edge-dark bg-transparent text-content dark:text-content-dark text-xs outline-none resize-y font-inherit mb-1.5"
              />
              <div className="flex gap-1.5 justify-end">
                <button onClick={() => setShowCompose(false)} className="px-2.5 py-1 rounded-md border-none cursor-pointer bg-surface-input dark:bg-surface-input-dark text-content-muted dark:text-content-muted-dark text-[11px] font-semibold">
                  {isRTL ? 'إلغاء' : 'Cancel'}
                </button>
                <button onClick={handleSend} className="px-3 py-1 rounded-md border-none cursor-pointer bg-[#4A7AAB] text-white text-[11px] font-semibold">
                  {isRTL ? 'إرسال' : 'Send'}
                </button>
              </div>
            </div>
          )}

          {emails.length === 0 ? (
            <p className="m-0 text-[11px] text-content-muted dark:text-content-muted-dark text-center py-2">
              {isRTL ? 'لا توجد رسائل مرتبطة' : 'No linked emails'}
            </p>
          ) : (
            <div className="flex flex-col gap-1">
              {emails.slice(0, 5).map(email => (
                <div key={email.id} className={`p-2 rounded-lg border ${isDark ? 'bg-black/15 border-white/[0.04]' : 'bg-white/60 border-black/[0.04]'}`}>
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-[11px] font-semibold text-content dark:text-content-dark">
                      {email.subject || (isRTL ? '(بدون موضوع)' : '(No subject)')}
                    </span>
                    <span className="text-[10px] text-content-muted dark:text-content-muted-dark">
                      {new Date(email.sent_at).toLocaleDateString(isRTL ? 'ar-EG' : 'en-US', { month: 'short', day: 'numeric' })}
                    </span>
                  </div>
                  <p className="m-0 text-[10px] text-content-muted dark:text-content-muted-dark truncate">
                    {email.body?.slice(0, 60)}
                  </p>
                </div>
              ))}
              {emails.length > 5 && (
                <p className="m-0 text-[10px] text-[#4A7AAB] text-center py-1 font-semibold">
                  {isRTL ? `+${emails.length - 5} رسائل أخرى` : `+${emails.length - 5} more`}
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
