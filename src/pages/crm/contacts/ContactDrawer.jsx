import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useToast } from '../../../contexts/ToastContext';
import { useAuth } from '../../../contexts/AuthContext';
import { logView, getEntityViewers } from '../../../services/viewTrackingService';
import { addRecentItem } from '../../../services/recentItemsService';
import { Phone, MessageCircle, Mail, Ban, X, Clock, Star, Users, FileDown, CheckSquare, Pencil, Target, Plus, Briefcase, UserCheck, Megaphone, Settings, DollarSign, Zap, ChevronDown, ChevronUp, MoreVertical, Pin, PhoneCall, Bell, Trash2, FileText, MessageSquare, FileUp, History, Award, Send, Calendar, Check, XCircle, ExternalLink, Download, Building2 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { getTemplates, renderBody, sendSMS, SAMPLE_DATA } from '../../../services/smsTemplateService';
import { Button, Input, Select, Textarea } from '../../../components/ui/';
import {
  fetchContactActivities, createActivity, updateActivity,
  fetchContactOpportunities, getAssignmentHistory,
} from '../../../services/contactsService';
import { createOpportunity } from '../../../services/opportunitiesService';
import { createNotification } from '../../../services/notificationsService';
import { useSystemConfig } from '../../../contexts/SystemConfigContext';
import { fetchTasks, createTask, TASK_PRIORITIES, TASK_STATUSES } from '../../../services/tasksService';
import EditContactModal from './EditContactModal';
import TakeActionForm from './TakeActionForm';
import ContactSMSModal from './ContactSMSModal';
import ResaleUnitsTab from './ResaleUnitsTab';
import CustomFieldsRenderer from '../../../components/ui/CustomFieldsRenderer';
import DocumentsSection from '../../../components/ui/DocumentsSection';
import CommentsSection from '../../../components/ui/CommentsSection';
import { getLocalAuditLogs, ACTION_TYPES, logAction } from '../../../services/auditService';
import { isFavorite as checkFavorite, toggleFavorite } from '../../../services/favoritesService';
import { getComments } from '../../../services/chatService';
import { getDocumentsByEntity, DOCUMENT_TYPES } from '../../../services/documentService';
import { getWonDeals } from '../../../services/dealsService';
import { generateContactCardHTML, getCompanyInfo } from '../../../services/printService';
import PrintPreview from '../../../components/ui/PrintPreview';
import {
  logMessage as logWhatsAppMessage, getTemplates as getWhatsAppTemplates,
  generateWhatsAppLink, fillTemplate, getMessagesByContact,
} from '../../../services/whatsappService';
import {
  useEscClose, SOURCE_LABELS, SOURCE_EN,
  TEMP, TYPE, fmtBudget, daysSince, initials, normalizePhone,
  Chip, ScorePill, PhoneCell, getDeptStages, deptStageLabel,
} from './constants';

const ACT_ICON_MAP = { call: Phone, whatsapp: MessageCircle, email: Mail, meeting: Users, note: Clock };

const TIMELINE_CONFIG = {
  activity:    { color: '#4A7AAB', bg: 'rgba(74,122,171,0.10)',  defaultIcon: Clock },
  task:        { color: '#F59E0B', bg: 'rgba(245,158,11,0.10)',  defaultIcon: CheckSquare },
  opportunity: { color: '#10B981', bg: 'rgba(16,185,129,0.10)',  defaultIcon: Target },
  comment:     { color: '#8B5CF6', bg: 'rgba(139,92,246,0.10)',  defaultIcon: MessageSquare },
  document:    { color: '#EC4899', bg: 'rgba(236,72,153,0.10)',  defaultIcon: FileUp },
  audit:       { color: '#6B8DB5', bg: 'rgba(107,141,181,0.10)', defaultIcon: History },
  deal:        { color: '#0F766E', bg: 'rgba(15,118,110,0.10)',  defaultIcon: Award },
};

// Department tab config
const DEPT_TABS = {
  sales:      { key: 'opportunities', label_ar: 'الفرص',     label_en: 'Opportunities', icon: Target,    color: '#10B981' },
  hr:         { key: 'recruitment',   label_ar: 'التوظيف',   label_en: 'Recruitment',   icon: UserCheck, color: '#6B21A8' },
  marketing:  { key: 'campaigns',     label_ar: 'الحملات',   label_en: 'Campaigns',     icon: Megaphone, color: '#F59E0B' },
  operations: { key: 'orders',        label_ar: 'الطلبات',   label_en: 'Orders',        icon: Settings,  color: '#4A7AAB' },
  finance:    { key: 'invoices',      label_ar: 'الفواتير',  label_en: 'Invoices',      icon: DollarSign, color: '#0F766E' },
};

// ── Contact Drawer ─────────────────────────────────────────────────────────
export default function ContactDrawer({ contact, onClose, onBlacklist, onUpdate, initialAction = false, onPrev, onNext, onPin, isPinned, onLogCall, onReminder, onDelete }) {
  const [showEdit, setShowEdit] = useState(false);
  const [showDrawerMenu, setShowDrawerMenu] = useState(false);
  const [showSMSModal, setShowSMSModal] = useState(false);
  const [showPrintPreview, setShowPrintPreview] = useState(false);
  const [showWAPopup, setShowWAPopup] = useState(false);
  const [waMessage, setWaMessage] = useState('');
  const [waSelectedTpl, setWaSelectedTpl] = useState('');
  const [waTemplates, setWaTemplates] = useState([]);
  useEffect(() => {
    const load = async () => {
      try { const t = await getWhatsAppTemplates(true); setWaTemplates(Array.isArray(t) ? t : []); } catch { setWaTemplates([]); }
    };
    load();
  }, []);
  const [recentWAMessages, setRecentWAMessages] = useState([]);
  useEffect(() => {
    const load = async () => {
      try {
        const msgs = await getMessagesByContact(contact?.id);
        setRecentWAMessages(Array.isArray(msgs) ? msgs.slice(0, 5) : []);
      } catch { setRecentWAMessages([]); }
    };
    if (contact?.id) load();
  }, [contact?.id]);
  const navigate = useNavigate();
  const { i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const toast = useToast();
  useEscClose(onClose);
  const [tab, setTab] = useState('activity');
  const [selectedAgent, setSelectedAgent] = useState('all');
  const [showAddAgent, setShowAddAgent] = useState(false);
  const [addAgentSearch, setAddAgentSearch] = useState('');
  const [activities, setActivities] = useState([]);
  const [opportunities, setOpportunities] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [loadingData, setLoadingData] = useState(true);
  const [showActionForm, setShowActionForm] = useState(initialAction);
  const [showOppModal, setShowOppModal] = useState(false);
  const [timelineFilter, setTimelineFilter] = useState('all');
  const [activityAgentFilter, setActivityAgentFilter] = useState('all');
  const assignmentHistory = useMemo(() => contact?.id ? getAssignmentHistory(contact.id) : [], [contact?.id]);
  const { profile } = useAuth();
  const isSalesAgent = profile?.role === 'sales_agent';

  // Privacy: hide previous agent's activities if system config says so
  const hidePreviousHistory = useMemo(() => {
    if (!isSalesAgent) return false; // managers/admins always see everything
    try {
      const cfg = JSON.parse(localStorage.getItem('platform_system_config') || '{}');
      return cfg.hide_previous_agent_history === true;
    } catch { return false; }
  }, [isSalesAgent]);

  // Find when current agent was assigned (to filter timeline)
  const myAssignmentDate = useMemo(() => {
    if (!hidePreviousHistory || !assignmentHistory.length) return null;
    const selfName = isRTL ? (profile?.full_name_ar || profile?.full_name_en || '') : (profile?.full_name_en || profile?.full_name_ar || '');
    // Find the last assignment TO the current agent
    const myAssign = [...assignmentHistory].reverse().find(h => h.to === selfName || h.to === profile?.full_name_ar || h.to === profile?.full_name_en);
    return myAssign ? new Date(myAssign.at) : null;
  }, [hidePreviousHistory, assignmentHistory, profile, isRTL]);
  const selfName = isRTL ? (profile?.full_name_ar || profile?.full_name_en || '') : (profile?.full_name_en || profile?.full_name_ar || '');
  const [newOpp, setNewOpp] = useState({ project:'', budget:'', stage:'qualification', temperature:'warm', priority:'medium', notes:'', assigned_to_name: isSalesAgent ? selfName : '' });

  // Get agents list for assignment dropdown
  const [agentsList, setAgentsList] = useState([]);
  useEffect(() => {
    import('../../../services/opportunitiesService').then(({ fetchSalesAgents }) => {
      fetchSalesAgents().then(agents => {
        setAgentsList(agents.map(a => a.full_name_en || a.full_name_ar).filter(Boolean).sort());
      }).catch(() => {});
    }).catch(() => {});
  }, []);

  // Favorites
  const [isFav, setIsFav] = useState(false);
  useEffect(() => {
    setIsFav(checkFavorite(`contact_${contact.id}`));
  }, [contact.id]);
  const handleToggleFav = () => {
    const result = toggleFavorite({
      id: `contact_${contact.id}`,
      type: 'contact',
      name: contact.full_name_en || contact.full_name || contact.full_name_ar || '',
      nameAr: contact.full_name_ar || contact.full_name || '',
      path: `/contacts?highlight=${contact.id}`,
    });
    setIsFav(result.added);
  };

  // Log view
  const lastViewedId = useRef(null);
  useEffect(() => {
    if (contact.id && contact.id !== lastViewedId.current) {
      lastViewedId.current = contact.id;
      logView({ entityType: 'contact', entityId: contact.id, entityName: contact.full_name, viewer: profile });
      addRecentItem({ type: 'contact', id: contact.id, name: contact.full_name, path: '/contacts?highlight=' + contact.id, extra: { company: contact.company, type: contact.contact_type } });
    }
  }, [contact.id, profile]);

  // Reset tab when contact changes
  useEffect(() => {
    setTab('activity');
    setTimelineFilter('all');
    setActivityAgentFilter('all');
    setShowActionForm(false);
    setSelectedAgent('all');
  }, [contact.id]);

  // Fetch all data on mount
  useEffect(() => {
    let cancelled = false;
    setLoadingData(true);
    Promise.allSettled([
      fetchContactActivities(contact.id, { role: profile?.role, userId: profile?.id, teamId: profile?.team_id }),
      fetchTasks({ contactId: contact.id, role: profile?.role, userId: profile?.id, teamId: profile?.team_id }),
      fetchContactOpportunities(contact.id, { role: profile?.role, userId: profile?.id, teamId: profile?.team_id }),
    ]).then(([actsRes, tasksRes, oppsRes]) => {
      if (cancelled) return;
      if (actsRes.status === 'fulfilled') setActivities(actsRes.value);
      if (tasksRes.status === 'fulfilled') setTasks(tasksRes.value);
      if (oppsRes.status === 'fulfilled') setOpportunities(oppsRes.value);
      setLoadingData(false);
    });
    return () => { cancelled = true; };
  }, [contact.id]);

  // Arrow key navigation between contacts
  useEffect(() => {
    const handler = (e) => {
      if (showEdit || showOppModal || showSMSModal || showWAPopup || showPrintPreview) return;
      const tag = e.target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || e.target.isContentEditable) return;
      if (e.key === 'ArrowLeft' && onNext) { e.preventDefault(); onNext(); }
      if (e.key === 'ArrowRight' && onPrev) { e.preventDefault(); onPrev(); }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onPrev, onNext, showEdit, showOppModal, showSMSModal, showWAPopup, showPrintPreview]);

  useEffect(() => {
    if (!showOppModal) return;
    const handler = (e) => { if (e.key === 'Escape') { e.stopImmediatePropagation(); setShowOppModal(false); } };
    document.addEventListener('keydown', handler, true);
    return () => document.removeEventListener('keydown', handler, true);
  }, [showOppModal]);

  const handleSaveActivity = async (form) => {
    try {
      const act = await createActivity({
        ...form,
        contact_id: contact.id,
        user_id: profile?.id || null,
        user_name_ar: profile?.full_name_ar || '',
        user_name_en: profile?.full_name_en || '',
      });
      setActivities(prev => [act, ...prev]);
      toast.success(isRTL ? 'تم حفظ النشاط' : 'Activity saved');
    } catch (err) {
      console.error('Activity save error:', err?.message || err);
      toast.error(isRTL ? `حدث خطأ: ${err?.message || 'غير معروف'}` : `Error: ${err?.message || 'Unknown'}`);
    }
    // Auto-update status based on activity (skip if disqualified)
    const myName = profile?.full_name_en || profile?.full_name_ar;
    const currentStatus = (contact.agent_statuses || {})[myName] || contact.contact_status || 'new';
    let newStatus = null;

    if (currentStatus !== 'disqualified') {
      const result = form.result || '';
      if (result === 'not_interested' && currentStatus !== 'has_opportunity' && currentStatus !== 'active') {
        newStatus = 'disqualified';
      } else if (['no_answer', 'busy', 'switched_off'].includes(result)) {
        newStatus = 'inactive';
      } else if (result === 'answered' || result === 'replied') {
        newStatus = 'active';
      } else if (currentStatus === 'new' || !currentStatus) {
        newStatus = 'active';
      }
    }

    if (newStatus && newStatus !== currentStatus) {
      const newStatuses = { ...(contact.agent_statuses || {}), [myName]: newStatus };
      if (onUpdate) onUpdate({ ...contact, agent_statuses: newStatuses, contact_status: newStatus });
    }
  };

  const handleSaveTask = async (taskData) => {
    try {
      const savedTask = await createTask({ ...taskData, assigned_to: profile?.id || null, assigned_to_name_ar: profile?.full_name_ar || '', assigned_to_name_en: profile?.full_name_en || '' });
      setTasks(prev => [savedTask, ...prev]);
    } catch (err) {
      const localTask = { id: String(Date.now()), ...taskData, status: 'todo', created_at: new Date().toISOString() };
      setTasks(prev => [localTask, ...prev]);
      toast.success(isRTL ? 'تم حفظ المهمة محلياً' : 'Task saved locally');
    }
  };

  // Handle contact status change from TakeActionForm (per-agent)
  const handleStatusChange = (newStatus) => {
    if (onUpdate) {
      const myName = profile?.full_name_en || profile?.full_name_ar;
      const newStatuses = { ...(contact.agent_statuses || {}), [myName]: newStatus };
      onUpdate({ ...contact, agent_statuses: newStatuses, contact_status: newStatus });
      toast.success(isRTL ? 'تم تحديث حالة التواصل' : 'Lead status updated');
    }
  };

  const handleSaveOpp = async () => {
    if (!newOpp.project.trim()) { toast.warning(isRTL ? 'اسم المشروع مطلوب' : 'Project name is required'); return; }
    if (!newOpp.assigned_to_name?.trim()) { toast.warning(isRTL ? 'اختر السيلز المسؤول' : 'Select sales agent'); return; }
    const oppData = { contact_id: contact.id, budget: Number(newOpp.budget) || 0, stage: newOpp.stage, temperature: newOpp.temperature, priority: newOpp.priority, notes: newOpp.notes, assigned_to_name: newOpp.assigned_to_name, title: contact.full_name, source: contact.source || 'manual', created_by: profile?.id || null, created_by_name: profile?.full_name_ar || profile?.full_name_en || null };
    const resetForm = () => setNewOpp({ project: '', budget: '', stage: 'qualification', temperature: 'warm', priority: 'medium', notes: '', assigned_to_name: isSalesAgent ? selfName : '' });
    try {
      const saved = await createOpportunity(oppData);
      const opp = { ...saved, contactName: contact.full_name, contacts: { id: contact.id, full_name: contact.full_name, phone: contact.phone, email: contact.email, department: contact.department, contact_type: contact.contact_type }, projects: { name_ar: newOpp.project, name_en: newOpp.project } };
      setOpportunities(prev => [opp, ...prev]);
      setShowOppModal(false);
      resetForm();
      toast.success(isRTL ? 'تم إنشاء الفرصة' : 'Opportunity created');
      // Notify assigned agent (if not self)
      if (newOpp.assigned_to_name !== selfName) {
        createNotification({ type: 'opportunity_assigned', title_ar: 'فرصة جديدة', title_en: 'New Opportunity Assigned', body_ar: `تم تعيين فرصة "${contact.full_name}" لك بواسطة ${selfName}`, body_en: `Opportunity "${contact.full_name}" assigned to you by ${selfName}`, for_user_name: newOpp.assigned_to_name, entity_type: 'opportunity', from_user: selfName });
      }
      logAction({ action: 'create_opportunity', entity: 'opportunity', entityId: saved.id, description: `Created opportunity for ${contact.full_name} → ${newOpp.assigned_to_name}`, userName: profile?.full_name_ar });
      // Auto-set status to interested when opportunity is created
      const currentStatus = contact.contact_status || 'new';
      if (currentStatus !== 'disqualified' && currentStatus !== 'has_opportunity') {
        const myName = profile?.full_name_en || profile?.full_name_ar;
        const newStatuses = { ...(contact.agent_statuses || {}), [myName]: 'has_opportunity' };
        if (onUpdate) onUpdate({ ...contact, agent_statuses: newStatuses, contact_status: 'has_opportunity' });
      }
    } catch (err) {
      const localOpp = {
        id: String(Date.now()),
        ...oppData,
        contactName: contact.full_name,
        projects: { name_ar: newOpp.project, name_en: newOpp.project },
        created_at: new Date().toISOString(),
      };
      setOpportunities(prev => [localOpp, ...prev]);
      setShowOppModal(false);
      resetForm();
      toast.success(isRTL ? 'تم حفظ الفرصة محلياً' : 'Opportunity saved locally');
    }
  };

  const { drawerFields: df } = useSystemConfig();
  if (!contact) return null;
  const show = (key) => !df || df[key] !== false; // default show if not configured

  const tempInfo = contact.temperature ? TEMP[contact.temperature] : null;
  const tp = contact.contact_type ? TYPE[contact.contact_type] : null;
  const isSupplier = contact.contact_type === 'supplier';
  const dept = contact.department || 'sales';
  const deptTab = isSupplier ? DEPT_TABS.finance : (DEPT_TABS[dept] || DEPT_TABS.sales);

  // Unique agents from activities
  const uniqueAgents = useMemo(() => {
    const map = new Map();
    (activities || []).forEach(a => {
      const id = a.user_id || a.user_name_en || a.user_name_ar;
      if (!id) return;
      const name = isRTL
        ? (a.user_name_ar || a.user_name_en || a.users?.full_name_ar || a.users?.full_name_en || '—')
        : (a.user_name_en || a.user_name_ar || a.users?.full_name_en || a.users?.full_name_ar || '—');
      if (name === '—') return;
      if (!map.has(id)) map.set(id, { id, name, count: 0 });
      map.get(id).count++;
    });
    return Array.from(map.values());
  }, [activities, isRTL]);
  const agentCount = uniqueAgents.length;

  const actCount = activities.length;
  const oppCount = opportunities.length;
  const openTaskCount = (tasks || []).filter(t => t.status !== 'done' && t.status !== 'cancelled').length;

  // ── Extra timeline sources (comments, documents, audit, deals) ───────────
  const [extraSources, setExtraSources] = useState({ comments: [], documents: [], audits: [], deals: [] });

  useEffect(() => {
    if (!contact?.id) return;
    const cid = String(contact.id);
    const loadExtra = async () => {
      try {
        const [comments, documents, allDeals] = await Promise.all([
          getComments('contact', cid).catch(() => []),
          getDocumentsByEntity('contact', cid).catch(() => []),
          getWonDeals({ role: profile?.role, userId: profile?.id, teamId: profile?.team_id, userName: profile?.full_name_en || profile?.full_name_ar }).catch(() => []),
        ]);
        const { data: allAudits } = await getLocalAuditLogs({ limit: 500, entity: 'contact' });
        const audits = (Array.isArray(allAudits) ? allAudits : []).filter(a => String(a.entity_id) === cid);
        const meaningfulAudits = audits.filter(a => !['create'].includes(a.action));
        const deals = (Array.isArray(allDeals) ? allDeals : []).filter(d => String(d.contact_id) === cid);
        setExtraSources({
          comments: Array.isArray(comments) ? comments : [],
          documents: Array.isArray(documents) ? documents : [],
          audits: meaningfulAudits,
          deals,
        });
      } catch {
        setExtraSources({ comments: [], documents: [], audits: [], deals: [] });
      }
    };
    loadExtra();
  }, [contact?.id]);

  // Listen for real-time updates
  useEffect(() => {
    const refresh = async () => {
      if (!contact?.id) return;
      const cid = String(contact.id);
      try {
        const [comments, documents] = await Promise.all([
          getComments('contact', cid).catch(() => []),
          getDocumentsByEntity('contact', cid).catch(() => []),
        ]);
        setExtraSources(prev => ({ ...prev, comments: Array.isArray(comments) ? comments : [], documents: Array.isArray(documents) ? documents : [] }));
      } catch { /* ignore */ }
    };
    window.addEventListener('platform_comment', refresh);
    window.addEventListener('platform_document', refresh);
    return () => {
      window.removeEventListener('platform_comment', refresh);
      window.removeEventListener('platform_document', refresh);
    };
  }, [contact?.id]);

  // ── Update activity status (scheduled -> completed/cancelled) ────────────
  const handleUpdateActivityStatus = async (activityId, newStatus) => {
    try {
      await updateActivity(activityId, { status: newStatus });
      setActivities(prev => prev.map(a => String(a.id) === String(activityId) ? { ...a, status: newStatus } : a));
      toast.success(isRTL
        ? (newStatus === 'completed' ? 'تم إكمال النشاط' : 'تم إلغاء النشاط')
        : (newStatus === 'completed' ? 'Activity completed' : 'Activity cancelled'));
    } catch {
      toast.error(isRTL ? 'حدث خطأ' : 'Error updating activity');
    }
  };

  // ── Unified Timeline ─────────────────────────────────────────────────────
  const timeline = useMemo(() => {
    const items = [];
    (activities || []).forEach(a => items.push({ ...a, _type: 'activity', _date: a.created_at }));
    (tasks || []).forEach(t => items.push({ ...t, _type: 'task', _date: t.created_at || t.due_date }));
    opportunities.forEach(o => items.push({ ...o, _type: 'opportunity', _date: o.created_at }));
    extraSources.comments.forEach(c => items.push({ ...c, _type: 'comment', _date: c.created_at }));
    extraSources.documents.forEach(d => items.push({ ...d, _type: 'document', _date: d.uploaded_at || d.created_at }));
    extraSources.audits.forEach(a => items.push({ ...a, _type: 'audit', _date: a.created_at }));
    extraSources.deals.forEach(d => items.push({ ...d, _type: 'deal', _date: d.created_at }));
    // Include assignment history in timeline
    assignmentHistory.forEach(h => items.push({
      ...h, _type: 'assignment', _date: h.at,
      type: 'reassignment',
      notes: `${h.from || '—'} → ${h.to}${h.notes ? ' · ' + h.notes : ''}`,
      user_name_ar: h.by, user_name_en: h.by,
    }));
    return items.sort((a, b) => new Date(b._date || 0) - new Date(a._date || 0));
  }, [activities, tasks, opportunities, extraSources, assignmentHistory]);

  const filteredTimeline = useMemo(() => {
    let items = timeline;

    // Privacy filter: hide activities before current agent's assignment date
    if (hidePreviousHistory && myAssignmentDate) {
      items = items.filter(item => {
        // Always show assignment entries (so agent knows history exists)
        if (item._type === 'assignment') return true;
        // Hide activities from before this agent was assigned
        const itemDate = new Date(item._date || 0);
        return itemDate >= myAssignmentDate;
      });
    }

    if (timelineFilter !== 'all') items = items.filter(item => item._type === timelineFilter);
    if (activityAgentFilter !== 'all') {
      items = items.filter(item => {
        const id = item.user_id || item.users?.full_name_ar || item.users?.full_name_en || item.author_name || item.uploaded_by || item.user_name;
        return id === activityAgentFilter;
      });
    }
    // Per-agent profile filter — activities always shown, only filter opps/tasks
    if (selectedAgent !== 'all') {
      items = items.filter(item => {
        if (item._type === 'opportunity') return item.assigned_to_name === selectedAgent;
        if (item._type === 'task') return item.assigned_to_name_en === selectedAgent || item.assigned_to_name_ar === selectedAgent;
        return true; // activities, comments, audit, documents, deals — always shown
      });
    }
    return items;
  }, [timeline, timelineFilter, activityAgentFilter, hidePreviousHistory, myAssignmentDate, selectedAgent]);

  // Grouped contact info for data tab
  const dataGroups = [
    {
      title: isRTL ? 'معلومات التواصل' : 'Lead Info',
      icon: Phone,
      color: '#10B981',
      rows: [
        show('phone') && { label: isRTL ? 'الهاتف' : 'Phone', val: contact.phone || '—' },
        show('phone2') && { label: isRTL ? 'الهاتف الثاني' : 'Phone 2', val: contact.phone2 || '—' },
        show('email') && { label: isRTL ? 'الإيميل' : 'Email', val: contact.email || '—' },
      ].filter(Boolean),
    },
    {
      title: isRTL ? 'معلومات العمل' : 'Business Info',
      icon: Briefcase,
      color: '#4A7AAB',
      rows: [
        show('company') && { label: isRTL ? 'الشركة' : 'Company', val: contact.company || '—' },
        show('job_title') && { label: isRTL ? 'المسمى الوظيفي' : 'Job Title', val: contact.job_title || '—' },
        show('budget') && { label: isRTL ? 'الميزانية' : 'Budget', val: fmtBudget(contact.budget_min, contact.budget_max, isRTL) },
        show('preferred_location') && { label: isRTL ? 'الموقع' : 'Location', val: contact.preferred_location || '—' },
        show('interested_in_type') && { label: isRTL ? 'نوع العقار' : 'Property', val: (isRTL ? { residential: 'سكني', commercial: 'تجاري', administrative: 'إداري' } : { residential: 'Residential', commercial: 'Commercial', administrative: 'Administrative' })[contact.interested_in_type] || '—' },
        contact.gender && { label: isRTL ? 'النوع' : 'Gender', val: (isRTL ? { male: 'ذكر', female: 'أنثى' } : { male: 'Male', female: 'Female' })[contact.gender] || contact.gender },
        contact.nationality && { label: isRTL ? 'الجنسية' : 'Nationality', val: contact.nationality },
        contact.birth_date && { label: isRTL ? 'تاريخ الميلاد' : 'Birth Date', val: new Date(contact.birth_date).toLocaleDateString(isRTL ? 'ar-EG' : 'en-US', { year: 'numeric', month: 'short', day: 'numeric' }) },
        contact.prefix && { label: isRTL ? 'اللقب' : 'Prefix', val: contact.prefix },
      ].filter(Boolean),
    },
    {
      title: isRTL ? 'التوزيع والمصدر' : 'Assignment',
      icon: Users,
      color: '#F59E0B',
      rows: [
        show('assigned_to_name') && !isSalesAgent && {
          label: isRTL ? 'المسؤول' : 'Assigned',
          val: (profile?.role === 'admin' || profile?.role === 'operations')
            ? (Array.isArray(contact.assigned_to_names) && contact.assigned_to_names.length > 0
              ? contact.assigned_to_names.join(' · ')
              : (contact.assigned_to_name || '—'))
            : (contact.assigned_to_name || '—'),
          action: onUpdate ? {
            label: isRTL ? 'تعديل' : 'Edit',
            onClick: () => {
              const current = Array.isArray(contact.assigned_to_names) ? contact.assigned_to_names : (contact.assigned_to_name ? [contact.assigned_to_name] : []);
              const isAdminOrOps = profile?.role === 'admin' || profile?.role === 'operations';
              const input = prompt(
                isAdminOrOps
                  ? (isRTL ? 'أدخل أسماء المسؤولين (مفصولين بفاصلة):' : 'Enter assignee names (comma-separated):')
                  : (isRTL ? 'أدخل اسم المسؤول الجديد:' : 'Enter new assignee name:'),
                isAdminOrOps ? current.join(', ') : ''
              );
              if (input !== null && input.trim()) {
                const names = input.split(',').map(n => n.trim()).filter(Boolean);
                const newAssignee = names[0] || null;
                onUpdate({ ...contact, assigned_to_names: names, assigned_to_name: newAssignee });
                // Send notification to the new assignee
                if (newAssignee && newAssignee !== (profile?.full_name_en || profile?.full_name_ar)) {
                  import('../../../services/notificationService').then(({ notifyLeadAssigned }) => {
                    notifyLeadAssigned({
                      contactName: contact.full_name || contact.phone || '—',
                      contactId: contact.id,
                      agentId: newAssignee,
                      agentName: newAssignee,
                      assignedBy: profile?.full_name_ar || profile?.full_name_en || '—',
                    });
                  });
                }
              }
            }
          } : null,
        },
        show('assigned_by_name') && { label: isRTL ? 'تم التعيين بواسطة' : 'Assigned By', val: contact.assigned_by_name || '—' },
        show('created_by_name') && { label: isRTL ? 'أنشأها' : 'Created By', val: contact.created_by_name || '—' },
        show('source') && { label: isRTL ? 'المصدر' : 'Source', val: isRTL ? SOURCE_LABELS[contact.source] : (SOURCE_EN[contact.source] || contact.source) },
        show('campaign_name') && (() => {
          const interactions = contact.campaign_interactions || [];
          const uniqueCampaigns = [...new Set(interactions.map(i => i.campaign))];
          if (uniqueCampaigns.length > 0) return { label: isRTL ? 'الحملات' : 'Campaigns', val: `${uniqueCampaigns.length} ${isRTL ? 'حملات' : 'campaigns'} (${interactions.length} ${isRTL ? 'تفاعل' : 'interactions'})` };
          return { label: isRTL ? 'الحملة' : 'Campaign', val: contact.campaign_name || '—' };
        })(),
        show('assigned_at') && { label: isRTL ? 'تاريخ التوزيع' : 'Assigned Date', val: contact.assigned_at ? new Date(contact.assigned_at).toLocaleDateString(isRTL ? 'ar-EG' : 'en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : '—' },
        ...(show('dq_reason') && contact.contact_status === 'disqualified' ? [
          { label: isRTL ? 'سبب الاستبعاد' : 'DQ Reason', val: contact.disqualify_reason ? ({ resale: isRTL ? 'عايز يبيع وحدته' : 'Wants to sell unit', not_interested: isRTL ? 'غير مهتم' : 'Not interested', no_budget: isRTL ? 'ميزانية غير مناسبة' : 'No budget', wrong_audience: isRTL ? 'جمهور خاطئ' : 'Wrong audience', duplicate: isRTL ? 'مكرر' : 'Duplicate', other: isRTL ? 'آخر' : 'Other' }[contact.disqualify_reason] || contact.disqualify_reason) : '—', color: '#EF4444' },
          ...(contact.disqualify_note ? [{ label: isRTL ? 'ملاحظة الاستبعاد' : 'DQ Note', val: contact.disqualify_note }] : []),
        ] : []),
      ].filter(Boolean),
    },
    {
      title: isRTL ? 'الحالة والتقييم' : 'Status & Score',
      icon: Star,
      color: '#6B21A8',
      rows: [
        show('contact_status') && (() => {
          const myName = profile?.full_name_en || profile?.full_name_ar;
          const statuses = contact.agent_statuses || {};
          const statusLabels = isRTL ? { new: 'جديد', active: 'نشط', inactive: 'غير نشط', has_opportunity: 'لديه فرصة', disqualified: 'غير مؤهل' } : { new: 'New', active: 'Active', inactive: 'Inactive', has_opportunity: 'Has Opportunity', disqualified: 'Disqualified' };
          const statusColor = (s) => s === 'disqualified' ? '#EF4444' : s === 'has_opportunity' ? '#059669' : s === 'active' ? '#10B981' : s === 'inactive' ? '#F59E0B' : s === 'new' ? '#4A7AAB' : undefined;
          const isAdminOrOps = profile?.role === 'admin' || profile?.role === 'operations';
          if (isAdminOrOps && Object.keys(statuses).length > 0) {
            // Admin sees all agents' statuses
            return { label: isRTL ? 'الحالة' : 'Status', val: Object.entries(statuses).map(([name, s]) => `${name}: ${statusLabels[s] || s}`).join(' · ') };
          }
          const myStatus = statuses[myName] || contact.contact_status;
          return { label: isRTL ? 'حالتي' : 'My Status', val: myStatus ? (statusLabels[myStatus] || myStatus) : '—', color: statusColor(myStatus) };
        })(),
        // For TL/Manager: show team members' statuses
        ...(() => {
          if (isSalesAgent || profile?.role === 'admin' || profile?.role === 'operations') return [];
          const statuses = contact.agent_statuses || {};
          const statusLabels = isRTL ? { new: 'جديد', active: 'نشط', inactive: 'غير نشط', has_opportunity: 'لديه فرصة', disqualified: 'غير مؤهل' } : { new: 'New', active: 'Active', inactive: 'Inactive', has_opportunity: 'Has Opportunity', disqualified: 'Disqualified' };
          const entries = Object.entries(statuses);
          if (entries.length <= 1) return [];
          return entries.map(([name, s]) => ({
            label: name,
            val: statusLabels[s] || s,
            color: s === 'disqualified' ? '#EF4444' : s === 'has_opportunity' ? '#059669' : s === 'active' ? '#10B981' : s === 'inactive' ? '#F59E0B' : s === 'new' ? '#4A7AAB' : '#6B8DB5',
          }));
        })(),
        show('lead_score') && { label: isRTL ? 'تقييم العميل' : 'Lead Score', val: contact.lead_score != null ? `${contact.lead_score}/100` : '—' },
        contact.contact_type && { label: isRTL ? 'النوع' : 'Type', val: tp ? (isRTL ? tp.label : tp.labelEn) : contact.contact_type },
        contact.department && { label: isRTL ? 'القسم' : 'Department', val: (isRTL ? { sales: 'مبيعات', hr: 'HR', finance: 'مالية', marketing: 'تسويق', operations: 'عمليات' } : {})[contact.department] || contact.department },
        contact.contact_number && { label: isRTL ? 'رقم التعريف' : 'Lead #', val: contact.contact_number },
      ].filter(Boolean),
    },
    {
      title: isRTL ? 'ملاحظات' : 'Notes',
      icon: FileText,
      color: '#8BA8C8',
      rows: [
        show('notes') && { label: isRTL ? 'ملاحظات' : 'Notes', val: contact.notes || '—' },
      ].filter(Boolean),
    },
    {
      title: isRTL ? 'التواريخ' : 'Dates',
      icon: Clock,
      color: '#6B8DB5',
      rows: [
        show('last_activity_at') && { label: isRTL ? 'آخر نشاط' : 'Last Activity', val: contact.last_activity_at ? (() => { const d = daysSince(contact.last_activity_at); return d === 0 ? (isRTL ? 'اليوم' : 'Today') : isRTL ? `منذ ${d} يوم` : `${d} days ago`; })() : '—' },
        show('created_at') && { label: isRTL ? 'تاريخ الإنشاء' : 'Created', val: contact.created_at ? new Date(contact.created_at).toLocaleDateString(isRTL ? 'ar-EG' : 'en-US', { year: 'numeric', month: 'short', day: 'numeric' }) + ' ' + new Date(contact.created_at).toLocaleTimeString(isRTL ? 'ar-EG' : 'en-US', { hour: '2-digit', minute: '2-digit' }) : '—' },
      ].filter(Boolean),
    },
  ].filter(s => s.rows.length > 0);

  const rowCls = 'flex justify-between items-center py-2 border-b border-brand-500/[0.06] text-xs gap-3';

  // ── Date grouping helper ────────────────────────────────────────────
  const getDateGroup = (dateStr) => {
    if (!dateStr) return isRTL ? 'غير محدد' : 'Unknown';
    const d = new Date(dateStr);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
    const itemDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    if (itemDay.getTime() === today.getTime()) return isRTL ? 'اليوم' : 'Today';
    if (itemDay.getTime() === yesterday.getTime()) return isRTL ? 'أمس' : 'Yesterday';
    const diffDays = Math.floor((today - itemDay) / 86400000);
    if (diffDays < 7) return isRTL ? 'هذا الأسبوع' : 'This Week';
    return d.toLocaleDateString(isRTL ? 'ar-EG' : 'en-US', { month: 'short', day: 'numeric', year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined });
  };

  // Group timeline by date
  const groupedTimeline = useMemo(() => {
    const groups = [];
    let currentGroup = null;
    filteredTimeline.forEach(item => {
      const label = getDateGroup(item._date);
      if (!currentGroup || currentGroup.label !== label) {
        currentGroup = { label, items: [] };
        groups.push(currentGroup);
      }
      currentGroup.items.push(item);
    });
    return groups;
  }, [filteredTimeline]);

  // ── Timeline Item Renderer ─────────────────────────────────────────────
  const renderTimelineItem = (item, isLast) => {
    const cfg = TIMELINE_CONFIG[item._type];
    const dateObj = item._date ? new Date(item._date) : null;
    const dateTimeStr = dateObj ? dateObj.toLocaleDateString(isRTL ? 'ar-EG' : 'en-US', { month: 'short', day: 'numeric' }) + ' · ' + dateObj.toLocaleTimeString(isRTL ? 'ar-EG' : 'en-US', { hour: '2-digit', minute: '2-digit' }) : '';

    // Get who created this item
    const createdBy = (() => {
      if (item._type === 'activity') return isRTL ? (item.users?.full_name_ar || item.user_name_ar || item.user_name_en || 'مجهول') : (item.users?.full_name_en || item.user_name_en || item.users?.full_name_ar || item.user_name_ar || 'Unknown');
      if (item._type === 'task') return isRTL ? (item.users?.full_name_ar || item.assigned_to_name_ar || item.created_by_name || 'مجهول') : (item.users?.full_name_en || item.assigned_to_name_en || item.users?.full_name_ar || item.created_by_name || 'Unknown');
      if (item._type === 'opportunity') return isRTL ? (item.users?.full_name_ar || item.agent_name || 'مجهول') : (item.users?.full_name_en || item.users?.full_name_ar || item.agent_name || 'Unknown');
      if (item._type === 'comment') return item.author_name || (isRTL ? 'مجهول' : 'Unknown');
      if (item._type === 'document') return item.uploaded_by || (isRTL ? 'النظام' : 'System');
      if (item._type === 'audit') return item.user_name || (isRTL ? 'النظام' : 'System');
      if (item._type === 'deal') return isRTL ? (item.agent_ar || 'مجهول') : (item.agent_en || item.agent_ar || 'Unknown');
      return '';
    })();

    const dotContent = (() => {
      if (item._type === 'activity') {
        const ActIcon = ACT_ICON_MAP[item.type] || cfg.defaultIcon;
        return <ActIcon size={11} color={cfg.color} />;
      }
      if (item._type === 'task') return <CheckSquare size={11} color={cfg.color} />;
      if (item._type === 'opportunity') return <Target size={11} color={cfg.color} />;
      if (item._type === 'comment') return <MessageSquare size={11} color={cfg.color} />;
      if (item._type === 'document') return <FileUp size={11} color={cfg.color} />;
      if (item._type === 'audit') return <History size={11} color={cfg.color} />;
      if (item._type === 'deal') return <Award size={11} color={cfg.color} />;
      return null;
    })();

    // Action type label
    const actionLabel = (() => {
      if (item._type === 'activity') {
        const labels = { call: { ar: 'مكالمة', en: 'Call' }, whatsapp: { ar: 'واتساب', en: 'WhatsApp' }, email: { ar: 'إيميل', en: 'Email' }, meeting: { ar: 'اجتماع', en: 'Meeting' }, site_visit: { ar: 'زيارة موقع', en: 'Site Visit' }, note: { ar: 'ملاحظة', en: 'Note' }, status_change: { ar: 'تغيير حالة', en: 'Status Change' } };
        return isRTL ? (labels[item.type]?.ar || 'نشاط') : (labels[item.type]?.en || 'Activity');
      }
      if (item._type === 'task') return isRTL ? 'مهمة' : 'Task';
      if (item._type === 'opportunity') return isRTL ? 'فرصة' : 'Opportunity';
      if (item._type === 'comment') return isRTL ? 'تعليق' : 'Comment';
      if (item._type === 'document') return isRTL ? 'مستند' : 'Document';
      if (item._type === 'audit') {
        const at = ACTION_TYPES[item.action];
        return isRTL ? (at?.ar || 'إجراء') : (at?.en || 'Action');
      }
      if (item._type === 'deal') return isRTL ? 'صفقة' : 'Deal';
      return '';
    })();

    // Meta line: type + who + when (shared across all types)
    const metaLine = (
      <div className="flex items-center gap-1.5 mt-1 text-[11px] text-content-muted dark:text-content-muted-dark">
        <span className="font-bold" style={{ color: cfg.color }}>{actionLabel}</span>
        <span className="opacity-30">|</span>
        <span className="font-medium text-content dark:text-content-dark">{createdBy}</span>
        {dateTimeStr && <><span className="opacity-30">|</span><span>{dateTimeStr}</span></>}
      </div>
    );

    const content = (() => {
      if (item._type === 'activity') {
        const actStatus = item.status || 'completed';
        const STATUS_COLORS = { scheduled: '#3B82F6', completed: '#10B981', cancelled: '#EF4444' };
        const STATUS_LABELS = { scheduled: { ar: 'مجدول', en: 'Scheduled' }, completed: { ar: 'مكتمل', en: 'Completed' }, cancelled: { ar: 'ملغي', en: 'Cancelled' } };
        return (
          <>
            <div className="flex items-center gap-2">
              <div className="text-xs font-semibold text-content dark:text-content-dark leading-snug flex-1">{item.notes || item.description || (isRTL ? 'نشاط' : 'Activity')}</div>
              {actStatus !== 'completed' && (
                <span className="text-[10px] px-1.5 py-px rounded-[5px] font-semibold shrink-0" style={{ background: STATUS_COLORS[actStatus] + '22', color: STATUS_COLORS[actStatus] }}>
                  {isRTL ? STATUS_LABELS[actStatus]?.ar : STATUS_LABELS[actStatus]?.en}
                </span>
              )}
            </div>
            {metaLine}
            {item.scheduled_date && (
              <div className="mt-1 text-[11px] flex items-center gap-1 text-blue-500">
                <Calendar size={10} />
                {new Date(item.scheduled_date).toLocaleDateString(isRTL ? 'ar-EG' : 'en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                {' · '}
                {new Date(item.scheduled_date).toLocaleTimeString(isRTL ? 'ar-EG' : 'en-US', { hour: '2-digit', minute: '2-digit' })}
              </div>
            )}
            {actStatus === 'scheduled' && (
              <div className="flex gap-1.5 mt-1.5">
                <button onClick={(e) => { e.stopPropagation(); handleUpdateActivityStatus(item.id, 'completed'); }}
                  className="flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold cursor-pointer border-0 transition-colors"
                  style={{ background: '#10B98122', color: '#10B981' }}>
                  <Check size={10} /> {isRTL ? 'اكتمل' : 'Complete'}
                </button>
                <button onClick={(e) => { e.stopPropagation(); handleUpdateActivityStatus(item.id, 'cancelled'); }}
                  className="flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold cursor-pointer border-0 transition-colors"
                  style={{ background: '#EF444422', color: '#EF4444' }}>
                  <XCircle size={10} /> {isRTL ? 'إلغاء' : 'Cancel'}
                </button>
              </div>
            )}
            {item.next_action && (
              <div className="mt-1.5 px-2.5 py-1 bg-brand-500/[0.08] rounded-md text-[11px] text-[#6B8DB5] dark:text-[#6B8DB5]">
                › {item.next_action}{item.next_action_date ? ` — ${item.next_action_date}` : ''}
              </div>
            )}
          </>
        );
      }
      if (item._type === 'task') {
        const pri = TASK_PRIORITIES[item.priority];
        const st = TASK_STATUSES[item.status];
        const due = new Date(item.due_date);
        const overdue = due < new Date() && item.status !== 'done';
        return (
          <>
            <div className={`text-xs font-semibold text-content dark:text-content-dark leading-snug ${item.status === 'done' ? 'line-through opacity-60' : ''}`}>
              {item.title}
            </div>
            {metaLine}
            <div className="flex gap-1.5 flex-wrap mt-1">
              <span className="text-[10px] px-1.5 py-px rounded-[5px] font-semibold" style={{ background: (pri?.color || '#4A7AAB') + '22', color: pri?.color || '#4A7AAB' }}>
                {isRTL ? pri?.ar : pri?.en}
              </span>
              <span className="text-[10px] px-1.5 py-px rounded-[5px]" style={{ background: (st?.color || '#4A7AAB') + '22', color: st?.color || '#4A7AAB' }}>
                {isRTL ? st?.ar : st?.en}
              </span>
              {overdue && (
                <span className="text-[10px] flex items-center gap-0.5 text-red-500">
                  <Clock size={9} /> {isRTL ? 'متأخر' : 'Overdue'}
                </span>
              )}
            </div>
          </>
        );
      }
      if (item._type === 'opportunity') {
        return (
          <>
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-xs font-semibold text-content dark:text-content-dark">{isRTL ? 'فرصة' : 'Opp'} #{String(item.id).slice(-4)}</span>
              <Chip label={deptStageLabel(item.stage, dept, isRTL)} color="#10B981" bg="rgba(16,185,129,0.1)" />
            </div>
            {metaLine}
            <div className="text-[11px] text-content-muted dark:text-content-muted-dark flex items-center gap-2 mt-0.5">
              {item.projects?.name_ar && <span>{isRTL ? item.projects.name_ar : (item.projects.name_en || item.projects.name_ar)}</span>}
              {item.budget > 0 && <><span className="opacity-40">·</span><span>{fmtBudget(item.budget, null, isRTL)}</span></>}
            </div>
          </>
        );
      }
      if (item._type === 'comment') {
        // Highlight @mentions in text
        const renderText = (text) => {
          if (!text) return '';
          const parts = text.split(/(@\S+)/g);
          return parts.map((p, i) => p.startsWith('@') ? <span key={i} style={{ color: '#8B5CF6', fontWeight: 600 }}>{p}</span> : p);
        };
        return (
          <>
            <div className="text-xs text-content dark:text-content-dark leading-relaxed">{renderText(item.text)}</div>
            {metaLine}
          </>
        );
      }
      if (item._type === 'document') {
        const docType = DOCUMENT_TYPES?.[item.type];
        return (
          <>
            <div className="text-xs font-semibold text-content dark:text-content-dark">{item.name || item.file_name}</div>
            {metaLine}
            <div className="flex gap-1.5 flex-wrap mt-1">
              {docType && (
                <span className="text-[10px] px-1.5 py-px rounded-[5px] font-semibold" style={{ background: (docType.color || '#6B7280') + '22', color: docType.color || '#6B7280' }}>
                  {isRTL ? docType.ar : docType.en}
                </span>
              )}
              {item.file_size > 0 && <span className="text-[10px] text-content-muted dark:text-content-muted-dark">{(item.file_size / 1024).toFixed(0)} KB</span>}
            </div>
          </>
        );
      }
      if (item._type === 'audit') {
        const desc = item.description || (isRTL ? (ACTION_TYPES[item.action]?.ar || item.action) : (ACTION_TYPES[item.action]?.en || item.action));
        const changes = item.changes ? Object.entries(item.changes) : [];
        return (
          <>
            <div className="text-xs text-content dark:text-content-dark">{desc}</div>
            {metaLine}
            {changes.length > 0 && changes.length <= 3 && (
              <div className="mt-1.5 text-[10px] space-y-0.5">
                {changes.map(([key, val]) => (
                  <div key={key} className="flex items-center gap-1 text-content-muted dark:text-content-muted-dark">
                    <span className="font-medium">{key}:</span>
                    <span className="line-through text-red-400">{String(val.from ?? '—').slice(0, 20)}</span>
                    <span className="opacity-40">→</span>
                    <span className="text-emerald-500">{String(val.to ?? '—').slice(0, 20)}</span>
                  </div>
                ))}
              </div>
            )}
          </>
        );
      }
      if (item._type === 'deal') {
        return (
          <>
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-xs font-semibold text-content dark:text-content-dark">{item.deal_number || (isRTL ? 'صفقة' : 'Deal')}</span>
              <Chip label={isRTL ? 'تم الإغلاق' : 'Closed Won'} color="#0F766E" bg="rgba(15,118,110,0.1)" />
            </div>
            {metaLine}
            <div className="text-[11px] text-content-muted dark:text-content-muted-dark flex items-center gap-2 mt-0.5">
              {item.deal_value > 0 && <span className="font-bold text-emerald-500">{Number(item.deal_value).toLocaleString()} {isRTL ? 'ج.م' : 'EGP'}</span>}
              {(item.project_ar || item.project_en) && <><span className="opacity-40">·</span><span>{isRTL ? item.project_ar : (item.project_en || item.project_ar)}</span></>}
            </div>
          </>
        );
      }
      return null;
    })();

    return (
      <div key={`${item._type}-${item.id}`} className="flex gap-0 relative">
        {/* Line + Dot */}
        <div className="flex flex-col items-center shrink-0" style={{ width: 28 }}>
          <div className="w-[22px] h-[22px] rounded-full border-2 flex items-center justify-center shrink-0 bg-surface-card dark:bg-surface-card-dark z-[1]" style={{ borderColor: cfg.color, background: cfg.bg }}>
            {dotContent}
          </div>
          {!isLast && <div className="w-px flex-1 min-h-[16px]" style={{ background: `${cfg.color}30` }} />}
        </div>
        {/* Content */}
        <div className="flex-1 min-w-0 pb-4 ps-2.5 pt-0.5">
          {content}
        </div>
      </div>
    );
  };

  // ── Dept-specific tab labels ─────────────────────────────────────────────
  const tabs = [
    { key: 'activity', label: isRTL ? 'النشاط' : 'Activity', icon: Clock },
    { key: deptTab.key, label: isRTL ? deptTab.label_ar : deptTab.label_en, icon: deptTab.icon },
    { key: 'units', label: isRTL ? 'وحدات للبيع' : 'Units', icon: Building2 },
    { key: 'comments', label: isRTL ? 'تعليقات' : 'Comments', icon: MessageSquare },
    { key: 'documents', label: isRTL ? 'المستندات' : 'Documents', icon: FileText },
    { key: 'data', label: isRTL ? 'البيانات' : 'Data', icon: Briefcase },
  ];

  // ── Status helpers for hero section ──────────────────────────────────────
  const getContactStatus = () => {
    const myName = profile?.full_name_en || profile?.full_name_ar;
    const statuses = contact.agent_statuses || {};
    const isAdminOrOps = profile?.role === 'admin' || profile?.role === 'operations';
    const statusLabels = isRTL
      ? { new: 'جديد', active: 'نشط', inactive: 'غير نشط', has_opportunity: 'لديه فرصة', disqualified: 'غير مؤهل' }
      : { new: 'New', active: 'Active', inactive: 'Inactive', has_opportunity: 'Has Opportunity', disqualified: 'Disqualified' };
    const statusColor = (s) => s === 'disqualified' ? '#EF4444' : s === 'has_opportunity' ? '#059669' : s === 'active' ? '#10B981' : s === 'inactive' ? '#F59E0B' : s === 'new' ? '#4A7AAB' : '#6B8DB5';
    if (isAdminOrOps && Object.keys(statuses).length > 0) {
      const entries = Object.entries(statuses);
      const primary = entries[0];
      return { label: statusLabels[primary[1]] || primary[1], color: statusColor(primary[1]) };
    }
    const myStatus = statuses[myName] || contact.contact_status || 'new';
    return { label: statusLabels[myStatus] || myStatus, color: statusColor(myStatus) };
  };
  const contactStatus = getContactStatus();

  // ── Info grid items (only non-empty) ───────────────────────────────────
  const infoGridItems = [
    contact.phone && { label: isRTL ? 'الهاتف' : 'Phone', val: contact.phone, isPhone: true },
    contact.phone2 && { label: isRTL ? 'الهاتف 2' : 'Phone 2', val: contact.phone2, isPhone: true },
    contact.email && { label: isRTL ? 'الإيميل' : 'Email', val: contact.email },
    contact.company && { label: isRTL ? 'الشركة' : 'Company', val: contact.company },
    contact.job_title && { label: isRTL ? 'المسمى' : 'Title', val: contact.job_title },
    (contact.budget_min || contact.budget_max) && { label: isRTL ? 'الميزانية' : 'Budget', val: fmtBudget(contact.budget_min, contact.budget_max, isRTL) },
    contact.source && { label: isRTL ? 'المصدر' : 'Source', val: isRTL ? (SOURCE_LABELS[contact.source] || contact.source) : (SOURCE_EN[contact.source] || contact.source) },
    contact.campaign_name && { label: isRTL ? 'الحملة' : 'Campaign', val: contact.campaign_name },
    contact.created_at && { label: isRTL ? 'الإنشاء' : 'Created', val: new Date(contact.created_at).toLocaleDateString(isRTL ? 'ar-EG' : 'en-US', { month: 'short', day: 'numeric', year: 'numeric' }) },
  ].filter(Boolean);

  return (
    <>
    {showEdit && <EditContactModal contact={contact} onClose={() => setShowEdit(false)} onSave={async (updated) => { onUpdate(updated); }} />}
    <div className="fixed inset-0 z-[900] flex" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Backdrop */}
      <div onClick={onClose} className="flex-1 bg-black/50 backdrop-blur-[2px]" />

      {/* Drawer Panel */}
      <div className={`contact-drawer w-[480px] max-w-[100vw] bg-surface-card dark:bg-surface-card-dark flex flex-col overflow-x-hidden shadow-2xl ${isRTL ? 'border-s' : 'border-e'} border-edge dark:border-edge-dark`}>

        {/* ═══ STICKY TOP BAR ═══ */}
        <div className="shrink-0 sticky top-0 z-10 bg-surface-card/95 dark:bg-surface-card-dark/95 backdrop-blur-sm border-b border-edge dark:border-edge-dark">
          <div className="flex items-center justify-between h-11 px-3">
            {/* Left: nav arrows */}
            <div className="flex items-center gap-0.5">
              {onPrev && (
                <button onClick={onPrev} title={isRTL ? 'السابق' : 'Previous'}
                  className="w-7 h-7 rounded-md flex items-center justify-center bg-transparent border-none text-content-muted dark:text-content-muted-dark cursor-pointer hover:bg-surface-bg dark:hover:bg-brand-500/10 transition-colors">
                  <ChevronUp size={16} />
                </button>
              )}
              {onNext && (
                <button onClick={onNext} title={isRTL ? 'التالي' : 'Next'}
                  className="w-7 h-7 rounded-md flex items-center justify-center bg-transparent border-none text-content-muted dark:text-content-muted-dark cursor-pointer hover:bg-surface-bg dark:hover:bg-brand-500/10 transition-colors">
                  <ChevronDown size={16} />
                </button>
              )}
            </div>

            {/* Center: contact name */}
            <span className="text-xs font-semibold text-content dark:text-content-dark truncate max-w-[200px] px-2">
              {contact.full_name || (isRTL ? 'بدون اسم' : 'No Name')}
            </span>

            {/* Right: close */}
            <button onClick={onClose}
              className="w-7 h-7 rounded-md flex items-center justify-center bg-transparent border-none text-content-muted dark:text-content-muted-dark cursor-pointer hover:bg-red-500/10 hover:text-red-500 transition-colors">
              <X size={16} />
            </button>
          </div>
        </div>

        {/* ═══ SCROLLABLE CONTENT ═══ */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden">

          {/* ═══ HERO SECTION ═══ */}
          <div className="px-5 pt-5 pb-4">
            {/* Avatar + Name + Badges */}
            <div className="flex flex-col items-center text-center mb-4">
              {/* Large Avatar */}
              <div className={`w-14 h-14 rounded-2xl shrink-0 flex items-center justify-center text-lg font-bold mb-3 shadow-sm ${
                contact.is_blacklisted
                  ? 'bg-red-500/15 text-red-500 border border-red-500/25'
                  : tp?.color
                    ? ''
                    : 'bg-gradient-to-br from-[#2B4C6F] to-brand-500 text-white'
              }`}
                style={!contact.is_blacklisted && tp?.color ? { background: `linear-gradient(135deg, ${tp.color}30, ${tp.color}15)`, color: tp.color, border: `1px solid ${tp.color}20` } : undefined}
              >
                {contact.is_blacklisted ? <Ban size={22} /> : initials(contact.full_name)}
              </div>

              {/* Full Name */}
              <h2 className={`m-0 text-base font-bold leading-tight mb-1.5 ${contact.is_blacklisted ? 'text-red-500' : 'text-content dark:text-content-dark'}`}>
                {contact.prefix && <span className="text-[#6B8DB5] font-medium me-1 text-sm">{contact.prefix}</span>}
                {contact.full_name || (isRTL ? 'بدون اسم' : 'No Name')}
              </h2>

              {/* Horizontal Chips Row */}
              <div className="flex items-center gap-1.5 flex-wrap justify-center mb-2">
                {tp && <Chip label={isRTL ? tp.label : tp.labelEn} color={tp.color} bg={tp.bg} />}
                {contact.department && (
                  <Chip
                    label={(isRTL ? { sales: 'مبيعات', hr: 'HR', finance: 'مالية', marketing: 'تسويق', operations: 'عمليات' } : { sales: 'Sales', hr: 'HR', finance: 'Finance', marketing: 'Marketing', operations: 'Operations' })[contact.department] || contact.department}
                    color="#8BA8C8" bg="rgba(139,168,200,0.1)"
                  />
                )}
                {tempInfo && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full" style={{ color: tempInfo.color, background: tempInfo.bg }}>
                    {tempInfo.Icon && <tempInfo.Icon size={11} />}
                    {isRTL ? tempInfo.labelAr : tempInfo.label}
                  </span>
                )}
                {contact.lead_score != null && contact.lead_score > 0 && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-brand-500/10 text-brand-500">
                    {contact.lead_score}/100
                  </span>
                )}
                {contact.contact_number && (
                  <span className="text-[10px] font-mono font-medium text-content-muted dark:text-content-muted-dark bg-brand-500/[0.06] px-1.5 py-0.5 rounded-full">
                    {contact.contact_number}
                  </span>
                )}
              </div>

              {/* Status Badge */}
              <span className="inline-flex items-center text-[11px] font-bold px-3 py-1 rounded-full" style={{ color: contactStatus.color, background: contactStatus.color + '18', border: `1px solid ${contactStatus.color}25` }}>
                {contactStatus.label}
              </span>
              {contact.is_blacklisted && (
                <span className="inline-flex items-center gap-1 text-[11px] font-bold px-3 py-1 rounded-full mt-1.5 bg-red-500/10 text-red-500 border border-red-500/20">
                  <Ban size={11} /> {isRTL ? 'بلاك ليست' : 'Blacklisted'}
                </span>
              )}
            </div>

            {/* ═══ QUICK ACTIONS ROW ═══ */}
            <div className="grid grid-cols-6 gap-1 mb-4">
              {/* Call */}
              {contact.phone ? (
                <a href={`tel:${contact.phone}`} className="flex flex-col items-center gap-1 py-2 rounded-xl no-underline hover:bg-emerald-500/10 transition-colors group cursor-pointer">
                  <div className="w-9 h-9 rounded-xl bg-emerald-500/10 flex items-center justify-center group-hover:bg-emerald-500/20 transition-colors">
                    <Phone size={16} className="text-emerald-500" />
                  </div>
                  <span className="text-[10px] font-semibold text-content-muted dark:text-content-muted-dark">{isRTL ? 'اتصال' : 'Call'}</span>
                </a>
              ) : (
                <div className="flex flex-col items-center gap-1 py-2 opacity-30">
                  <div className="w-9 h-9 rounded-xl bg-surface-bg dark:bg-surface-bg-dark flex items-center justify-center"><Phone size={16} className="text-content-muted dark:text-content-muted-dark" /></div>
                  <span className="text-[10px] text-content-muted dark:text-content-muted-dark">{isRTL ? 'اتصال' : 'Call'}</span>
                </div>
              )}

              {/* WhatsApp */}
              {contact.phone ? (
                <button onClick={() => setShowWAPopup(p => !p)} className="flex flex-col items-center gap-1 py-2 rounded-xl bg-transparent border-none cursor-pointer hover:bg-[#25D366]/10 transition-colors group">
                  <div className="w-9 h-9 rounded-xl bg-[#25D366]/10 flex items-center justify-center group-hover:bg-[#25D366]/20 transition-colors">
                    <MessageCircle size={16} className="text-[#25D366]" />
                  </div>
                  <span className="text-[10px] font-semibold text-content-muted dark:text-content-muted-dark">{isRTL ? 'واتساب' : 'WA'}</span>
                </button>
              ) : (
                <div className="flex flex-col items-center gap-1 py-2 opacity-30">
                  <div className="w-9 h-9 rounded-xl bg-surface-bg dark:bg-surface-bg-dark flex items-center justify-center"><MessageCircle size={16} className="text-content-muted dark:text-content-muted-dark" /></div>
                  <span className="text-[10px] text-content-muted dark:text-content-muted-dark">{isRTL ? 'واتساب' : 'WA'}</span>
                </div>
              )}

              {/* Email */}
              {contact.email ? (
                <a href={`mailto:${contact.email}`} className="flex flex-col items-center gap-1 py-2 rounded-xl no-underline hover:bg-brand-500/10 transition-colors group cursor-pointer">
                  <div className="w-9 h-9 rounded-xl bg-brand-500/10 flex items-center justify-center group-hover:bg-brand-500/20 transition-colors">
                    <Mail size={16} className="text-brand-500" />
                  </div>
                  <span className="text-[10px] font-semibold text-content-muted dark:text-content-muted-dark">{isRTL ? 'إيميل' : 'Email'}</span>
                </a>
              ) : (
                <div className="flex flex-col items-center gap-1 py-2 opacity-30">
                  <div className="w-9 h-9 rounded-xl bg-surface-bg dark:bg-surface-bg-dark flex items-center justify-center"><Mail size={16} className="text-content-muted dark:text-content-muted-dark" /></div>
                  <span className="text-[10px] text-content-muted dark:text-content-muted-dark">{isRTL ? 'إيميل' : 'Email'}</span>
                </div>
              )}

              {/* Action */}
              <button onClick={() => { setTab('activity'); setShowActionForm(true); }} className="flex flex-col items-center gap-1 py-2 rounded-xl bg-transparent border-none cursor-pointer hover:bg-brand-500/10 transition-colors group">
                <div className="w-9 h-9 rounded-xl bg-brand-500/10 flex items-center justify-center group-hover:bg-brand-500/20 transition-colors">
                  <Zap size={16} className="text-brand-500" />
                </div>
                <span className="text-[10px] font-semibold text-content-muted dark:text-content-muted-dark">{isRTL ? 'إجراء' : 'Action'}</span>
              </button>

              {/* SMS */}
              {contact.phone ? (
                <button onClick={() => setShowSMSModal(true)} className="flex flex-col items-center gap-1 py-2 rounded-xl bg-transparent border-none cursor-pointer hover:bg-brand-500/10 transition-colors group">
                  <div className="w-9 h-9 rounded-xl bg-brand-500/10 flex items-center justify-center group-hover:bg-brand-500/20 transition-colors">
                    <Send size={16} className="text-brand-500" />
                  </div>
                  <span className="text-[10px] font-semibold text-content-muted dark:text-content-muted-dark">{isRTL ? 'رسالة' : 'SMS'}</span>
                </button>
              ) : (
                <div className="flex flex-col items-center gap-1 py-2 opacity-30">
                  <div className="w-9 h-9 rounded-xl bg-surface-bg dark:bg-surface-bg-dark flex items-center justify-center"><Send size={16} className="text-content-muted dark:text-content-muted-dark" /></div>
                  <span className="text-[10px] text-content-muted dark:text-content-muted-dark">{isRTL ? 'رسالة' : 'SMS'}</span>
                </div>
              )}

              {/* More menu */}
              <div className="relative flex flex-col items-center gap-1 py-2">
                <button onClick={() => setShowDrawerMenu(p => !p)} className="flex flex-col items-center gap-1 rounded-xl bg-transparent border-none cursor-pointer hover:bg-surface-bg dark:hover:bg-brand-500/10 transition-colors group w-full">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center transition-colors ${showDrawerMenu ? 'bg-brand-500 text-white' : 'bg-surface-bg dark:bg-brand-500/10 group-hover:bg-brand-500/15'}`}>
                    <MoreVertical size={16} className={showDrawerMenu ? 'text-white' : 'text-content-muted dark:text-content-muted-dark'} />
                  </div>
                  <span className="text-[10px] font-semibold text-content-muted dark:text-content-muted-dark">{isRTL ? 'المزيد' : 'More'}</span>
                </button>
                {/* Dropdown Menu */}
                {showDrawerMenu && (
                  <div className="absolute top-[58px] end-0 bg-surface-card dark:bg-surface-card-dark border border-edge dark:border-edge-dark rounded-xl min-w-[190px] z-[100] shadow-[0_12px_40px_rgba(27,51,71,0.18)] overflow-hidden">
                    <div className="p-1">
                      <button onClick={() => { setShowEdit(true); setShowDrawerMenu(false); }} className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg border-none bg-transparent cursor-pointer text-xs text-content dark:text-content-dark font-inherit hover:bg-surface-bg dark:hover:bg-brand-500/10">
                        <Pencil size={13} className="text-brand-500" /> {isRTL ? 'تعديل البيانات' : 'Edit Lead'}
                      </button>
                      <button onClick={handleToggleFav} className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg border-none bg-transparent cursor-pointer text-xs text-content dark:text-content-dark font-inherit hover:bg-surface-bg dark:hover:bg-brand-500/10">
                        <Star size={13} className={isFav ? 'text-amber-500' : 'text-content-muted dark:text-content-muted-dark'} fill={isFav ? '#F59E0B' : 'none'} /> {isFav ? (isRTL ? 'إزالة المفضلة' : 'Unfavorite') : (isRTL ? 'إضافة للمفضلة' : 'Favorite')}
                      </button>
                      {onPin && (
                        <button onClick={() => { onPin(contact.id); setShowDrawerMenu(false); }} className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg border-none bg-transparent cursor-pointer text-xs text-content dark:text-content-dark font-inherit hover:bg-surface-bg dark:hover:bg-brand-500/10">
                          <Pin size={13} className={isPinned ? 'text-amber-500' : 'text-content-muted dark:text-content-muted-dark'} /> {isPinned ? (isRTL ? 'إلغاء التثبيت' : 'Unpin') : (isRTL ? 'تثبيت' : 'Pin')}
                        </button>
                      )}
                      {onLogCall && (
                        <button onClick={() => { onLogCall(contact); setShowDrawerMenu(false); }} className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg border-none bg-transparent cursor-pointer text-xs text-content dark:text-content-dark font-inherit hover:bg-surface-bg dark:hover:bg-brand-500/10">
                          <PhoneCall size={13} className="text-brand-500" /> {isRTL ? 'تسجيل مكالمة' : 'Log Call'}
                        </button>
                      )}
                      {onReminder && (
                        <button onClick={() => { onReminder(contact); setShowDrawerMenu(false); }} className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg border-none bg-transparent cursor-pointer text-xs text-content dark:text-content-dark font-inherit hover:bg-surface-bg dark:hover:bg-brand-500/10">
                          <Bell size={13} className="text-amber-500" /> {isRTL ? 'تذكير' : 'Reminder'}
                        </button>
                      )}
                      <button onClick={() => { setShowPrintPreview(true); setShowDrawerMenu(false); }} className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg border-none bg-transparent cursor-pointer text-xs text-content dark:text-content-dark font-inherit hover:bg-surface-bg dark:hover:bg-brand-500/10">
                        <FileDown size={13} className="text-brand-500" /> {isRTL ? 'طباعة' : 'Print'}
                      </button>
                      {onDelete && (
                        <button onClick={() => { onDelete(contact.id); setShowDrawerMenu(false); }} className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg border-none bg-transparent cursor-pointer text-xs text-content dark:text-content-dark font-inherit hover:bg-surface-bg dark:hover:bg-brand-500/10">
                          <Trash2 size={13} className="text-content-muted dark:text-content-muted-dark" /> {isRTL ? 'حذف' : 'Delete'}
                        </button>
                      )}
                      {!contact.is_blacklisted && (
                        <>
                          <div className="h-px bg-edge dark:bg-edge-dark mx-1 my-0.5" />
                          <button onClick={() => { onBlacklist(contact); setShowDrawerMenu(false); }} className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg border-none bg-transparent cursor-pointer text-xs text-red-500 font-inherit hover:bg-red-500/[0.05]">
                            <Ban size={13} /> {isRTL ? 'بلاك ليست' : 'Blacklist'}
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* ═══ WHATSAPP QUICK SEND POPUP ═══ */}
            {showWAPopup && contact.phone && (
              <div className="mb-4 rounded-xl border border-[#25D366]/20 bg-[#25D366]/[0.03] dark:bg-[#25D366]/[0.05] p-3.5">
                <div className="flex items-center justify-between mb-2.5">
                  <span className="text-xs font-bold text-[#25D366] flex items-center gap-1.5">
                    <MessageCircle size={13} /> {isRTL ? 'إرسال واتساب' : 'Send WhatsApp'}
                  </span>
                  <button onClick={() => setShowWAPopup(false)} className="w-6 h-6 rounded-md flex items-center justify-center bg-transparent border-0 cursor-pointer text-content-muted dark:text-content-muted-dark hover:bg-surface-bg dark:hover:bg-brand-500/10 transition-colors">
                    <X size={13} />
                  </button>
                </div>
                <select
                  value={waSelectedTpl}
                  onChange={e => {
                    setWaSelectedTpl(e.target.value);
                    if (e.target.value) {
                      const tpl = waTemplates.find(t => t.id === e.target.value);
                      if (tpl) {
                        const body = isRTL ? (tpl.body_ar || tpl.body) : tpl.body;
                        const filled = fillTemplate(body, {
                          name: contact.full_name || '',
                          company: contact.company || '',
                          amount: '',
                          date: new Date().toLocaleDateString(isRTL ? 'ar-EG' : 'en-US'),
                        });
                        setWaMessage(filled);
                      }
                    }
                  }}
                  className="w-full px-2.5 py-2 rounded-lg border border-edge dark:border-edge-dark bg-surface-input dark:bg-surface-input-dark text-content dark:text-content-dark text-xs outline-none mb-2 font-cairo"
                >
                  <option value="">{isRTL ? 'اختر قالب...' : 'Pick a template...'}</option>
                  {waTemplates.map(t => (
                    <option key={t.id} value={t.id}>{isRTL ? (t.name_ar || t.name) : t.name}</option>
                  ))}
                </select>
                <textarea
                  value={waMessage}
                  onChange={e => setWaMessage(e.target.value)}
                  placeholder={isRTL ? 'اكتب رسالة...' : 'Type a message...'}
                  rows={3}
                  className="w-full px-2.5 py-2 rounded-lg border border-edge dark:border-edge-dark bg-surface-input dark:bg-surface-input-dark text-content dark:text-content-dark text-xs outline-none resize-none font-cairo"
                  style={{ lineHeight: 1.5 }}
                />
                <div className="flex gap-2 mt-2.5">
                  <button
                    onClick={() => {
                      const phone = normalizePhone(contact.phone).replace('+', '');
                      const link = generateWhatsAppLink(phone, waMessage);
                      logWhatsAppMessage({
                        contact_id: contact.id,
                        contact_name: contact.full_name,
                        contact_phone: contact.phone,
                        direction: 'outgoing',
                        message: waMessage || '',
                        template_id: waSelectedTpl || null,
                        type: waSelectedTpl ? 'template' : 'text',
                      });
                      window.open(link, '_blank');
                      setWaMessage('');
                      setWaSelectedTpl('');
                      setShowWAPopup(false);
                    }}
                    className="flex-1 py-2 rounded-lg border-0 text-white text-xs font-semibold cursor-pointer flex items-center justify-center gap-1.5 hover:opacity-90 transition-opacity"
                    style={{ background: '#25D366' }}
                  >
                    <Send size={12} /> {isRTL ? 'إرسال' : 'Send'}
                  </button>
                  <a
                    href={generateWhatsAppLink(normalizePhone(contact.phone).replace('+', ''))}
                    target="_blank"
                    rel="noreferrer"
                    className="py-2 px-4 rounded-lg border border-[#25D366]/25 text-[#25D366] text-xs font-semibold no-underline flex items-center justify-center gap-1.5 hover:bg-[#25D366]/5 transition-colors"
                  >
                    <ExternalLink size={12} /> {isRTL ? 'فتح' : 'Open'}
                  </a>
                </div>
                {recentWAMessages.length > 0 && (
                  <div className="mt-3 pt-2.5 border-t border-[#25D366]/10">
                    <span className="text-[10px] font-semibold text-content-muted dark:text-content-muted-dark mb-1 block">
                      {isRTL ? 'آخر الرسائل' : 'Recent Messages'}
                    </span>
                    {recentWAMessages.map(m => (
                      <div key={m.id} className="flex items-start gap-1.5 mt-1.5">
                        {m.direction === 'outgoing' ? <Send size={9} className="text-[#25D366] mt-0.5 flex-shrink-0" /> : <Download size={9} className="text-brand-500 mt-0.5 flex-shrink-0" />}
                        <span className="text-[10px] text-content-muted dark:text-content-muted-dark truncate flex-1">{m.message?.slice(0, 50)}</span>
                        <span className="text-[9px] text-content-muted dark:text-content-muted-dark flex-shrink-0 opacity-60">
                          {new Date(m.sent_at).toLocaleDateString(isRTL ? 'ar-EG' : 'en-US', { month: 'short', day: 'numeric' })}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ═══ INFO GRID ═══ */}
            {infoGridItems.length > 0 && (
              <div className="grid grid-cols-2 gap-x-4 gap-y-0 mb-4 px-1">
                {infoGridItems.map((item, idx) => (
                  <div key={idx} className="py-2 border-b border-edge/50 dark:border-edge-dark/50">
                    <div className="text-[10px] text-content-muted dark:text-content-muted-dark mb-0.5 uppercase tracking-wide font-medium">{item.label}</div>
                    {item.isPhone ? (
                      <PhoneCell phone={item.val} />
                    ) : (
                      <div className="text-xs font-medium text-content dark:text-content-dark truncate">{item.val}</div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Notes preview */}
            {contact.notes && (
              <div className="text-[11px] text-content-muted dark:text-content-muted-dark bg-surface-bg/50 dark:bg-surface-bg-dark/50 border border-edge/40 dark:border-edge-dark/40 rounded-lg px-3 py-2 mb-4 leading-relaxed line-clamp-2">
                {contact.notes}
              </div>
            )}

            {/* Privacy notice */}
            {hidePreviousHistory && myAssignmentDate && (
              <div className="mb-3 px-3 py-2 rounded-lg bg-brand-500/[0.05] border border-brand-500/10">
                <p className="m-0 text-[10px] text-brand-500 font-medium">
                  {isRTL
                    ? `بتشوف الأنشطة من ${myAssignmentDate.toLocaleDateString('ar-EG', { month: 'short', day: 'numeric', year: 'numeric' })} — الأنشطة السابقة مخفية`
                    : `Showing activities from ${myAssignmentDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} — previous history hidden`}
                </p>
              </div>
            )}

            {/* Assignment History Banner */}
            {assignmentHistory.length > 0 && (
              <div className="mb-3 p-3 rounded-xl bg-amber-500/[0.04] border border-amber-500/15">
                <div className="flex items-center gap-2 mb-1.5">
                  <History size={12} className="text-amber-500" />
                  <span className="text-[11px] font-bold text-amber-600 dark:text-amber-400">
                    {isRTL ? `تم تعيينه ${assignmentHistory.length} مرة` : `Reassigned ${assignmentHistory.length} time${assignmentHistory.length > 1 ? 's' : ''}`}
                  </span>
                </div>
                <div className="flex flex-col gap-1">
                  {assignmentHistory.slice(-3).map((h, i) => (
                    <div key={i} className="flex items-center gap-1.5 text-[10px] text-content-muted dark:text-content-muted-dark">
                      <span className="font-semibold">{h.from || '—'}</span>
                      <span className="opacity-40">→</span>
                      <span className="font-semibold text-brand-500">{h.to}</span>
                      <span className="opacity-50">· {new Date(h.at).toLocaleDateString(isRTL ? 'ar-EG' : 'en-US', { month: 'short', day: 'numeric' })}</span>
                      {h.by && <span className="opacity-40">({isRTL ? 'بواسطة' : 'by'} {h.by})</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* ═══ AGENT PROFILE SELECTOR — hidden for sales_agent ═══ */}
          {!isSalesAgent && (() => {
            const assignedNames = contact.assigned_to_names || [];
            return (
            <>
              <div className="px-5 py-3 border-b border-edge/40 dark:border-edge-dark/40">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] text-content-muted dark:text-content-muted-dark uppercase tracking-wide font-medium">
                    {isRTL ? 'السيلز المعينين' : 'Assigned Agents'}
                  </span>
                  <button onClick={() => setSelectedAgent(selectedAgent === 'all' ? (assignedNames[0] || 'all') : 'all')}
                    className="text-[10px] text-brand-500 bg-transparent border-none cursor-pointer font-semibold">
                    {selectedAgent === 'all' ? (isRTL ? 'عرض بروفايل' : 'View Profile') : (isRTL ? 'عرض الكل' : 'View All')}
                  </button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {assignedNames.map(name => (
                    <button key={name} onClick={() => setSelectedAgent(selectedAgent === name ? 'all' : name)}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold cursor-pointer transition-all ${
                        selectedAgent === name
                          ? 'bg-brand-500 text-white border border-brand-500'
                          : 'bg-surface-bg dark:bg-surface-bg-dark border border-edge dark:border-edge-dark text-content dark:text-content-dark hover:border-brand-500/30'
                      }`}>
                      <span className={`w-5 h-5 rounded-lg flex items-center justify-center text-[10px] font-bold ${
                        selectedAgent === name ? 'bg-white/20 text-white' : 'bg-brand-500/10 text-brand-500'
                      }`}>{name.charAt(0)}</span>
                      {name}
                      {assignedNames.length > 1 && (
                        <span onClick={e => {
                          e.stopPropagation();
                          const newNames = assignedNames.filter(n => n !== name);
                          const updates = { assigned_to_names: newNames, assigned_to_name: newNames[0] || null };
                          // Remove from agent_statuses and agent_temperatures
                          const newStatuses = { ...(contact.agent_statuses || {}) }; delete newStatuses[name];
                          const newTemps = { ...(contact.agent_temperatures || {}) }; delete newTemps[name];
                          if (onUpdate) onUpdate({ ...contact, ...updates, agent_statuses: newStatuses, agent_temperatures: newTemps });
                          if (selectedAgent === name) setSelectedAgent('all');
                        }} className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] hover:bg-red-500 hover:text-white transition-colors ${
                          selectedAgent === name ? 'text-white/60' : 'text-content-muted/40 dark:text-content-muted-dark/40'
                        }`}>✕</span>
                      )}
                    </button>
                  ))}
                  {/* Add Agent Button */}
                  <div className="relative">
                    <button onClick={() => setShowAddAgent(!showAddAgent)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold cursor-pointer bg-transparent border border-dashed border-edge dark:border-edge-dark text-content-muted dark:text-content-muted-dark hover:border-brand-500 hover:text-brand-500 transition-colors">
                      + {isRTL ? 'إضافة' : 'Add'}
                    </button>
                    {showAddAgent && (
                      <div className="absolute top-full mt-1 start-0 z-20 bg-surface-card dark:bg-surface-card-dark border border-edge dark:border-edge-dark rounded-xl shadow-lg w-56 overflow-hidden">
                        <div className="p-2">
                          <input type="text" value={addAgentSearch} onChange={e => setAddAgentSearch(e.target.value)}
                            placeholder={isRTL ? 'ابحث...' : 'Search...'}
                            className="w-full px-2.5 py-2 rounded-lg bg-surface-bg dark:bg-surface-bg-dark border border-edge dark:border-edge-dark text-xs text-content dark:text-content-dark outline-none"
                            autoFocus />
                        </div>
                        <div className="max-h-[180px] overflow-y-auto px-1 pb-1">
                          {agentsList.filter(a => !assignedNames.includes(a) && (!addAgentSearch || a.toLowerCase().includes(addAgentSearch.toLowerCase()))).map(a => (
                            <button key={a} onClick={() => {
                              const newNames = [...assignedNames, a];
                              if (onUpdate) onUpdate({ ...contact, assigned_to_names: newNames });
                              setShowAddAgent(false); setAddAgentSearch('');
                            }} className="w-full px-3 py-2 rounded-lg text-xs text-content dark:text-content-dark bg-transparent border-none cursor-pointer text-start hover:bg-surface-bg dark:hover:bg-surface-bg-dark">
                              {a}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              {selectedAgent !== 'all' && (
                <div className="px-5 py-3 border-b border-edge/40 dark:border-edge-dark/40">
                  <div className="flex gap-3">
                    {/* Per-agent Status */}
                    <div className="flex-1 rounded-xl p-3 bg-brand-500/[0.05] border border-brand-500/10">
                      <div className="text-[10px] text-content-muted dark:text-content-muted-dark uppercase tracking-wide mb-1 font-medium">{isRTL ? 'حالة السيلز' : 'Agent Status'}</div>
                      {(() => {
                        const agentStatus = (contact.agent_statuses || {})[selectedAgent];
                        const statusLabels = isRTL
                          ? { new: 'جديد', active: 'نشط', inactive: 'غير نشط', has_opportunity: 'لديه فرصة', disqualified: 'غير مؤهل' }
                          : { new: 'New', active: 'Active', inactive: 'Inactive', has_opportunity: 'Has Opportunity', disqualified: 'Disqualified' };
                        const statusColor = (s) => s === 'disqualified' ? '#EF4444' : s === 'has_opportunity' ? '#059669' : s === 'active' ? '#10B981' : s === 'inactive' ? '#F59E0B' : s === 'new' ? '#4A7AAB' : '#6B8DB5';
                        const color = statusColor(agentStatus);
                        return (
                          <span className="inline-flex items-center text-[11px] font-bold px-2 py-0.5 rounded-full" style={{ color, background: color + '18' }}>
                            {agentStatus ? (statusLabels[agentStatus] || agentStatus) : (isRTL ? 'غير محدد' : 'Not set')}
                          </span>
                        );
                      })()}
                    </div>
                    {/* Per-agent Temperature */}
                    <div className="flex-1 rounded-xl p-3 bg-amber-500/[0.05] border border-amber-500/10">
                      <div className="text-[10px] text-content-muted dark:text-content-muted-dark uppercase tracking-wide mb-1 font-medium">{isRTL ? 'حرارة السيلز' : 'Agent Temp'}</div>
                      {(() => {
                        const agentTemp = (contact.agent_temperatures || {})[selectedAgent];
                        const tempData = agentTemp ? TEMP[agentTemp] : null;
                        return tempData ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full" style={{ color: tempData.color, background: tempData.bg }}>
                            {tempData.Icon && <tempData.Icon size={11} />}
                            {isRTL ? tempData.labelAr : tempData.label}
                          </span>
                        ) : (
                          <span className="text-xs text-content-muted dark:text-content-muted-dark">--</span>
                        );
                      })()}
                      {/* Temperature selector */}
                      <div className="flex gap-1 mt-2 flex-wrap">
                        {['hot', 'warm', 'cool', 'cold'].map(v => ({ v, ar: TEMP[v]?.labelAr || v, en: TEMP[v]?.label || v })).map(opt => {
                          const isActive = (contact.agent_temperatures || {})[selectedAgent] === opt.v;
                          const optTemp = TEMP[opt.v];
                          return (
                            <button
                              key={opt.v}
                              onClick={() => {
                                if (onUpdate) {
                                  const newTemps = { ...(contact.agent_temperatures || {}), [selectedAgent]: opt.v };
                                  onUpdate({ ...contact, agent_temperatures: newTemps });
                                }
                              }}
                              className={`px-2 py-0.5 rounded-full text-[10px] font-semibold cursor-pointer border transition-all ${
                                isActive
                                  ? 'border-transparent text-white'
                                  : 'bg-transparent border-edge dark:border-edge-dark text-content-muted dark:text-content-muted-dark hover:opacity-80'
                              }`}
                              style={isActive && optTemp ? { background: optTemp.color } : undefined}
                            >
                              {isRTL ? opt.ar : opt.en}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </>
          );
          })()}

          {/* ═══ TABS SECTION ═══ */}
          <div className="sticky top-0 z-[5] bg-surface-card dark:bg-surface-card-dark border-b border-edge dark:border-edge-dark">
            <div className="flex px-3 gap-0 overflow-x-auto scrollbar-none">
              {tabs.map(t => {
                const TabIcon = t.icon;
                const isActive = tab === t.key;
                const badge = t.key === 'activity' ? actCount : t.key === deptTab.key ? oppCount : t.key === 'comments' ? extraSources.comments.length : null;
                return (
                  <button key={t.key} onClick={() => setTab(t.key)} title={t.label}
                    className={`relative flex items-center gap-1.5 px-3 py-2.5 bg-transparent border-0 border-b-2 border-solid text-[11px] cursor-pointer whitespace-nowrap transition-all ${
                      isActive
                        ? 'border-b-brand-500 text-brand-500 font-bold'
                        : 'border-b-transparent text-content-muted dark:text-content-muted-dark font-medium hover:text-content dark:hover:text-content-dark'
                    }`}>
                    <TabIcon size={13} />
                    <span>{t.label}</span>
                    {badge > 0 && (
                      <span className={`text-[9px] font-bold min-w-[16px] h-4 rounded-full flex items-center justify-center px-1 ${
                        isActive ? 'bg-brand-500 text-white' : 'bg-surface-bg dark:bg-brand-500/15 text-content-muted dark:text-content-muted-dark'
                      }`}>{badge}</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* ═══ TAB CONTENT ═══ */}
          <div className="p-5">

            {/* ══════ ACTIVITY / TIMELINE TAB ══════ */}
            {tab === 'activity' && (
              <div>
                {/* Take Action + New Opp Buttons */}
                <div className="flex gap-2 mb-4">
                  <button onClick={() => setShowActionForm(p => !p)}
                    className={`flex-1 py-2.5 rounded-xl text-xs font-semibold cursor-pointer flex items-center justify-center gap-1.5 border transition-all ${
                      showActionForm
                        ? 'bg-brand-500 text-white border-brand-500 shadow-sm shadow-brand-500/20'
                        : 'bg-brand-500/[0.06] border-brand-500/20 text-brand-500 hover:bg-brand-500/[0.12]'
                    }`}>
                    <Zap size={14} /> {isRTL ? 'اتخذ إجراء' : 'Take Action'}
                  </button>
                  <button onClick={() => setShowOppModal(true)}
                    className="flex-1 py-2.5 rounded-xl text-xs font-semibold cursor-pointer flex items-center justify-center gap-1.5 border bg-emerald-500/[0.06] border-emerald-500/20 text-emerald-500 hover:bg-emerald-500/[0.12] transition-all">
                    <Plus size={14} /> {isRTL ? 'فرصة جديدة' : 'New Opp'}
                  </button>
                </div>

                {/* Take Action Form */}
                {showActionForm && (
                  <div className="mb-4">
                    <TakeActionForm
                      contact={contact}
                      onSaveActivity={handleSaveActivity}
                      onSaveTask={handleSaveTask}
                      onStatusChange={handleStatusChange}
                      onCancel={() => setShowActionForm(false)}
                    />
                  </div>
                )}

                {/* Timeline Filter Chips */}
                {!loadingData && timeline.length > 0 && (
                  <div className="flex gap-1.5 mb-3 flex-wrap">
                    {[
                      { key: 'all', label: isRTL ? 'الكل' : 'All', count: timeline.length },
                      { key: 'activity', label: isRTL ? 'نشاط' : 'Activities', count: activities.length },
                      { key: 'task', label: isRTL ? 'مهام' : 'Tasks', count: (tasks || []).length },
                      { key: 'opportunity', label: isRTL ? 'فرص' : 'Opps', count: opportunities.length },
                      { key: 'comment', label: isRTL ? 'تعليقات' : 'Comments', count: extraSources.comments.length },
                      { key: 'document', label: isRTL ? 'مستندات' : 'Docs', count: extraSources.documents.length },
                      { key: 'deal', label: isRTL ? 'صفقات' : 'Deals', count: extraSources.deals.length },
                      { key: 'audit', label: isRTL ? 'سجل' : 'Log', count: extraSources.audits.length },
                    ].filter(f => f.key === 'all' || f.count > 0).map(f => (
                      <button key={f.key} onClick={() => setTimelineFilter(f.key)}
                        className={`px-2.5 py-1 rounded-full text-[11px] cursor-pointer border transition-all ${
                          timelineFilter === f.key
                            ? 'bg-brand-500 text-white border-brand-500 font-bold shadow-sm shadow-brand-500/15'
                            : 'bg-transparent border-edge dark:border-edge-dark text-content-muted dark:text-content-muted-dark font-medium hover:border-brand-500/30 hover:text-brand-500'
                        }`}>
                        {f.label} {f.count > 0 ? `(${f.count})` : ''}
                      </button>
                    ))}
                  </div>
                )}

                {/* Agent Filter Chips */}
                {!loadingData && uniqueAgents.length > 1 && (
                  <div className="flex gap-1.5 mb-4 flex-wrap">
                    <button
                      onClick={() => setActivityAgentFilter('all')}
                      className={`px-2.5 py-1 rounded-full text-[11px] cursor-pointer border transition-all ${
                        activityAgentFilter === 'all'
                          ? 'bg-amber-500 text-white border-amber-500 font-bold'
                          : 'bg-transparent border-edge dark:border-edge-dark text-content-muted dark:text-content-muted-dark font-medium hover:border-amber-500/30'
                      }`}
                    >
                      {isRTL ? 'كل الموظفين' : 'All Agents'}
                    </button>
                    {uniqueAgents.map(ag => (
                      <button
                        key={ag.id}
                        onClick={() => setActivityAgentFilter(activityAgentFilter === ag.id ? 'all' : ag.id)}
                        className={`px-2.5 py-1 rounded-full text-[11px] cursor-pointer border transition-all ${
                          activityAgentFilter === ag.id
                            ? 'bg-amber-500 text-white border-amber-500 font-bold'
                            : 'bg-transparent border-edge dark:border-edge-dark text-content-muted dark:text-content-muted-dark font-medium hover:border-amber-500/30'
                        }`}
                      >
                        {ag.name} ({ag.count})
                      </button>
                    ))}
                  </div>
                )}

                {/* Timeline Content */}
                {loadingData ? (
                  <div className="flex flex-col items-center py-12 text-content-muted dark:text-content-muted-dark">
                    <div className="w-8 h-8 border-2 border-brand-500/30 border-t-brand-500 rounded-full animate-spin mb-3" />
                    <span className="text-xs">{isRTL ? 'جاري التحميل...' : 'Loading...'}</span>
                  </div>
                ) : filteredTimeline.length === 0 ? (
                  <div className="flex flex-col items-center py-12 text-content-muted dark:text-content-muted-dark">
                    <div className="w-12 h-12 rounded-2xl bg-surface-bg dark:bg-surface-bg-dark flex items-center justify-center mb-3">
                      <Clock size={24} className="opacity-30" />
                    </div>
                    <p className="m-0 text-xs font-medium">{isRTL ? 'لا توجد سجلات بعد' : 'No records yet'}</p>
                    <p className="m-0 mt-1 text-[11px] opacity-60">{isRTL ? 'ابدأ بإضافة نشاط أو إجراء' : 'Start by adding an activity or action'}</p>
                  </div>
                ) : (
                  <div>
                    {groupedTimeline.map((group, gi) => (
                      <div key={group.label}>
                        {/* Date Group Header */}
                        <div className="flex items-center gap-2.5 mb-3 mt-1">
                          <span className="text-[10px] font-bold text-content-muted dark:text-content-muted-dark uppercase tracking-wider">{group.label}</span>
                          <div className="flex-1 h-px bg-edge/60 dark:bg-edge-dark/60" />
                        </div>
                        {/* Timeline Items */}
                        {group.items.map((item, ii) => {
                          const isLastInAll = gi === groupedTimeline.length - 1 && ii === group.items.length - 1;
                          return renderTimelineItem(item, isLastInAll);
                        })}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ══════ DEPARTMENT-SPECIFIC TAB ══════ */}
            {tab === deptTab.key && (
              <div>
                {isSupplier ? (
                  <div className="flex flex-col items-center py-12 text-content-muted dark:text-content-muted-dark">
                    <div className="w-12 h-12 rounded-2xl bg-surface-bg dark:bg-surface-bg-dark flex items-center justify-center mb-3">
                      <FileDown size={24} className="opacity-30" />
                    </div>
                    <p className="m-0 text-xs font-semibold text-content dark:text-content-dark">{isRTL ? 'لا توجد فواتير بعد' : 'No invoices yet'}</p>
                    <p className="mt-1 mb-0 text-[11px]">{isRTL ? 'أضف فاتورة لهذا المورد' : 'Add an invoice for this supplier'}</p>
                  </div>
                ) : (
                  <>
                    {/* ── Sales: Opportunities ── */}
                    {dept === 'sales' && (
                      <>
                        <div className="flex items-center justify-between mb-4">
                          <div className="text-sm font-bold text-content dark:text-content-dark">{isRTL ? 'الفرص' : 'Opportunities'} <span className="text-content-muted dark:text-content-muted-dark font-normal">({oppCount})</span></div>
                          <button onClick={() => setShowOppModal(true)} className="px-3 py-1.5 bg-emerald-500/[0.08] border border-emerald-500/20 rounded-lg text-emerald-500 text-xs font-semibold cursor-pointer flex items-center gap-1.5 hover:bg-emerald-500/[0.15] transition-colors">
                            <Plus size={12} /> {isRTL ? 'فرصة جديدة' : 'New'}
                          </button>
                        </div>
                        {loadingData ? (
                          <div className="flex flex-col items-center py-12 text-content-muted dark:text-content-muted-dark">
                            <div className="w-8 h-8 border-2 border-brand-500/30 border-t-brand-500 rounded-full animate-spin mb-3" />
                            <span className="text-xs">{isRTL ? 'جاري التحميل...' : 'Loading...'}</span>
                          </div>
                        ) : (() => {
                          const filteredOpps = selectedAgent !== 'all'
                            ? opportunities.filter(o => o.assigned_to_name === selectedAgent || o.users?.full_name_en === selectedAgent || o.users?.full_name_ar === selectedAgent)
                            : opportunities;
                          return filteredOpps.length === 0 ? (
                          <div className="flex flex-col items-center py-12 text-content-muted dark:text-content-muted-dark">
                            <div className="w-12 h-12 rounded-2xl bg-surface-bg dark:bg-surface-bg-dark flex items-center justify-center mb-3">
                              <Target size={24} className="opacity-30" />
                            </div>
                            <p className="m-0 text-xs">{isRTL ? 'لا توجد فرص بعد' : 'No opportunities yet'}</p>
                          </div>
                        ) : (
                          <div className="flex flex-col gap-2.5">
                            {filteredOpps.map(opp => (
                              <button
                                key={opp.id}
                                onClick={() => navigate(`/crm/opportunities?highlight=${opp.id}`)}
                                className="w-full text-start bg-surface-bg/50 dark:bg-surface-bg-dark/50 border border-edge/60 dark:border-edge-dark/60 rounded-xl p-3.5 cursor-pointer hover:bg-emerald-500/[0.05] hover:border-emerald-500/20 transition-all group"
                              >
                                <div className="flex items-center justify-between mb-2">
                                  <span className="text-xs font-bold text-content dark:text-content-dark">{isRTL ? 'فرصة' : 'Opp'} #{String(opp.id).slice(-4)}</span>
                                  <Chip label={deptStageLabel(opp.stage, dept, isRTL)} color="#10B981" bg="rgba(16,185,129,0.1)" />
                                </div>
                                {opp.projects?.name_ar && (
                                  <div className="text-xs text-content-muted dark:text-content-muted-dark mb-1.5">{isRTL ? opp.projects.name_ar : (opp.projects.name_en || opp.projects.name_ar)}</div>
                                )}
                                {(opp.users || opp.assigned_to_name) && (
                                  <div className="text-[11px] font-semibold text-brand-500 mb-1.5">
                                    {opp.users ? (isRTL ? (opp.users.full_name_ar || opp.users.full_name_en) : (opp.users.full_name_en || opp.users.full_name_ar)) : opp.assigned_to_name}
                                  </div>
                                )}
                                <div className="flex gap-3 text-[11px] text-content-muted dark:text-content-muted-dark">
                                  {opp.budget > 0 && <span className="font-medium">{fmtBudget(opp.budget, null, isRTL)} {isRTL ? 'ج.م' : 'EGP'}</span>}
                                  {opp.temperature && (
                                    <span style={{ color: TEMP[opp.temperature]?.color }}>{isRTL ? TEMP[opp.temperature]?.labelAr : TEMP[opp.temperature]?.label}</span>
                                  )}
                                  <span className="opacity-60">{opp.created_at?.slice(0, 10)}</span>
                                </div>
                              </button>
                            ))}
                          </div>
                        );
                        })()}
                      </>
                    )}

                    {/* ── HR: Recruitment ── */}
                    {dept === 'hr' && (
                      <div className="flex flex-col items-center py-12 text-content-muted dark:text-content-muted-dark">
                        <div className="w-12 h-12 rounded-2xl bg-surface-bg dark:bg-surface-bg-dark flex items-center justify-center mb-3">
                          <UserCheck size={24} className="opacity-30" />
                        </div>
                        <p className="m-0 text-xs font-semibold text-content dark:text-content-dark">{isRTL ? 'لا توجد عمليات توظيف بعد' : 'No recruitment records yet'}</p>
                        <p className="mt-1 mb-0 text-[11px]">{isRTL ? 'سجل عمليات التوظيف لهذا الشخص' : 'Track recruitment for this person'}</p>
                      </div>
                    )}

                    {/* ── Marketing: Campaign Interactions ── */}
                    {dept === 'marketing' && (() => {
                      const interactions = contact.campaign_interactions?.length > 0
                        ? contact.campaign_interactions
                        : contact.campaign_name
                          ? [{ campaign: contact.campaign_name, source: contact.source, platform: contact.platform, date: contact.created_at }]
                          : [];

                      if (interactions.length === 0) return (
                        <div className="flex flex-col items-center py-12 text-content-muted dark:text-content-muted-dark">
                          <div className="w-12 h-12 rounded-2xl bg-surface-bg dark:bg-surface-bg-dark flex items-center justify-center mb-3">
                            <Megaphone size={24} className="opacity-30" />
                          </div>
                          <p className="m-0 text-xs font-semibold text-content dark:text-content-dark">{isRTL ? 'لا توجد تفاعلات بعد' : 'No campaign interactions yet'}</p>
                        </div>
                      );

                      const campaignMap = {};
                      interactions.forEach(i => {
                        if (!campaignMap[i.campaign]) campaignMap[i.campaign] = { count: 0, source: i.source, first: i.date, last: i.date };
                        campaignMap[i.campaign].count++;
                        if (i.date < campaignMap[i.campaign].first) campaignMap[i.campaign].first = i.date;
                        if (i.date > campaignMap[i.campaign].last) campaignMap[i.campaign].last = i.date;
                      });
                      const uniqueCampaigns = Object.entries(campaignMap);
                      const firstSource = interactions.reduce((a, b) => a.date < b.date ? a : b);
                      const lastSource = interactions.reduce((a, b) => a.date > b.date ? a : b);

                      return (
                        <div className="space-y-3">
                          <div className="grid grid-cols-3 gap-2">
                            <div className="p-3 bg-brand-500/[0.05] rounded-xl text-center border border-brand-500/10">
                              <p className="m-0 text-[10px] text-content-muted dark:text-content-muted-dark uppercase tracking-wide">{isRTL ? 'التفاعلات' : 'Interactions'}</p>
                              <p className="m-0 text-lg font-bold text-brand-500">{interactions.length}</p>
                            </div>
                            <div className="p-3 bg-brand-500/[0.05] rounded-xl text-center border border-brand-500/10">
                              <p className="m-0 text-[10px] text-content-muted dark:text-content-muted-dark uppercase tracking-wide">{isRTL ? 'أول مصدر' : 'First'}</p>
                              <p className="m-0 text-[11px] font-bold text-content dark:text-content-dark truncate mt-0.5">{firstSource.campaign}</p>
                            </div>
                            <div className="p-3 bg-brand-500/[0.05] rounded-xl text-center border border-brand-500/10">
                              <p className="m-0 text-[10px] text-content-muted dark:text-content-muted-dark uppercase tracking-wide">{isRTL ? 'آخر مصدر' : 'Last'}</p>
                              <p className="m-0 text-[11px] font-bold text-content dark:text-content-dark truncate mt-0.5">{lastSource.campaign}</p>
                            </div>
                          </div>

                          <p className="m-0 text-xs font-semibold text-content dark:text-content-dark mt-1">
                            {isRTL ? 'تفاصيل الحملات' : 'Campaign Breakdown'} <span className="text-brand-500">({uniqueCampaigns.length})</span>
                          </p>
                          {uniqueCampaigns.map(([name, data]) => (
                            <div key={name} className="p-3 bg-surface-bg/50 dark:bg-surface-bg-dark/50 border border-edge/60 dark:border-edge-dark/60 rounded-xl">
                              <div className="flex justify-between items-center">
                                <div className="min-w-0 flex-1">
                                  <p className="m-0 text-xs font-bold text-content dark:text-content-dark truncate">{name}</p>
                                  <p className="m-0 mt-1 text-[11px] text-content-muted dark:text-content-muted-dark">
                                    {isRTL ? (SOURCE_LABELS[data.source] || data.source) : (SOURCE_EN[data.source] || data.source)}
                                  </p>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                  {data.count > 1 && (
                                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 font-bold">
                                      {data.count}x {isRTL ? 'تكرار' : 'repeat'}
                                    </span>
                                  )}
                                  <span className="text-[10px] text-content-muted dark:text-content-muted-dark whitespace-nowrap">
                                    {new Date(data.first).toLocaleDateString(isRTL ? 'ar-EG' : 'en-US', { month: 'short', day: 'numeric' })}
                                  </span>
                                </div>
                              </div>
                            </div>
                          ))}

                          <details className="mt-1">
                            <summary className="text-[11px] text-brand-500 cursor-pointer font-semibold">{isRTL ? 'سجل التفاعلات الكامل' : 'Full Interaction Log'}</summary>
                            <div className="mt-2 space-y-1">
                              {interactions.sort((a, b) => new Date(b.date) - new Date(a.date)).map((int, idx) => (
                                <div key={idx} className="flex items-center justify-between py-1.5 border-b border-edge/40 dark:border-edge-dark/40 text-[11px]">
                                  <span className="text-content dark:text-content-dark font-medium">{int.campaign}</span>
                                  <span className="text-content-muted dark:text-content-muted-dark">
                                    {isRTL ? (SOURCE_LABELS[int.source] || int.source) : (SOURCE_EN[int.source] || int.source)} · {new Date(int.date).toLocaleDateString(isRTL ? 'ar-EG' : 'en-US', { month: 'short', day: 'numeric' })}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </details>
                        </div>
                      );
                    })()}

                    {/* ── Operations: Orders ── */}
                    {dept === 'operations' && (
                      <div className="flex flex-col items-center py-12 text-content-muted dark:text-content-muted-dark">
                        <div className="w-12 h-12 rounded-2xl bg-surface-bg dark:bg-surface-bg-dark flex items-center justify-center mb-3">
                          <Settings size={24} className="opacity-30" />
                        </div>
                        <p className="m-0 text-xs font-semibold text-content dark:text-content-dark">{isRTL ? 'لا توجد طلبات بعد' : 'No orders yet'}</p>
                        <p className="mt-1 mb-0 text-[11px]">{isRTL ? 'سجل الطلبات لهذا الشخص' : 'Track orders for this person'}</p>
                      </div>
                    )}

                    {/* ── Finance: Invoices ── */}
                    {dept === 'finance' && (
                      <div className="flex flex-col items-center py-12 text-content-muted dark:text-content-muted-dark">
                        <div className="w-12 h-12 rounded-2xl bg-surface-bg dark:bg-surface-bg-dark flex items-center justify-center mb-3">
                          <FileDown size={24} className="opacity-30" />
                        </div>
                        <p className="m-0 text-xs font-semibold text-content dark:text-content-dark">{isRTL ? 'لا توجد فواتير بعد' : 'No invoices yet'}</p>
                        <p className="mt-1 mb-0 text-[11px]">{isRTL ? 'أضف فاتورة لهذا الشخص' : 'Add an invoice for this person'}</p>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {/* ══════ RESALE UNITS TAB ══════ */}
            {tab === 'units' && (
              <ResaleUnitsTab contact={contact} isRTL={isRTL} />
            )}

            {/* ══════ COMMENTS TAB ══════ */}
            {tab === 'comments' && (
              <CommentsSection
                entity="contact"
                entityId={contact.id}
                entityName={contact.full_name}
              />
            )}

            {/* ══════ DOCUMENTS TAB ══════ */}
            {tab === 'documents' && (
              <DocumentsSection
                entity="contact"
                entityId={contact.id}
                entityName={contact.full_name}
              />
            )}

            {/* ══════ DATA / DETAILS TAB ══════ */}
            {tab === 'data' && (
              <div>
                {/* Score & Temperature Cards */}
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="bg-brand-500/[0.05] rounded-xl p-3.5 border border-brand-500/10">
                    <div className="text-[10px] text-content-muted dark:text-content-muted-dark uppercase tracking-wide mb-2 font-medium">{isRTL ? 'نقاط التقييم' : 'Lead Score'}</div>
                    <ScorePill score={contact.lead_score} />
                  </div>
                  <div className="rounded-xl p-3.5" style={{ background: tempInfo?.bg || 'rgba(74,122,171,0.04)', border: `1px solid ${tempInfo?.color || '#4A7AAB'}15` }}>
                    <div className="text-[10px] text-content-muted dark:text-content-muted-dark uppercase tracking-wide mb-1.5 font-medium">{isRTL ? 'الحرارة' : 'Temperature'}</div>
                    {tempInfo?.Icon ? (
                      <div className="flex items-center gap-1.5">
                        <tempInfo.Icon size={15} color={tempInfo.color} />
                        <span className="font-bold text-sm" style={{ color: tempInfo?.color }}>{isRTL ? tempInfo?.labelAr : tempInfo?.label}</span>
                      </div>
                    ) : (
                      <span className="text-xs text-content-muted dark:text-content-muted-dark">--</span>
                    )}
                  </div>
                </div>

                {/* Grouped Data Sections */}
                <div className="flex flex-col gap-3 mb-4">
                  {dataGroups.map(group => {
                    const GroupIcon = group.icon;
                    return (
                      <div key={group.title} className="rounded-xl border border-edge/70 dark:border-edge-dark/70 overflow-hidden">
                        <div className="flex items-center gap-2 px-3.5 py-2.5 bg-surface-bg/60 dark:bg-surface-bg-dark/40 border-b border-edge/50 dark:border-edge-dark/50">
                          <div className="w-5 h-5 rounded-md flex items-center justify-center" style={{ background: group.color + '15' }}>
                            <GroupIcon size={12} style={{ color: group.color }} />
                          </div>
                          <span className="text-[11px] font-bold text-content dark:text-content-dark uppercase tracking-wider">{group.title}</span>
                        </div>
                        <div className="px-3.5">
                          {group.rows.map(r => (
                            <div key={r.label} className={rowCls}>
                              <span className="text-content-muted dark:text-content-muted-dark shrink-0">{r.label}</span>
                              <div className="flex items-center gap-1.5">
                                <span className="text-content dark:text-content-dark font-medium text-end whitespace-nowrap" style={r.color ? { color: r.color } : undefined}>{r.val}</span>
                                {r.action && <button onClick={r.action.onClick} className="text-[9px] text-brand-500 bg-brand-500/10 px-1.5 py-0.5 rounded border-none cursor-pointer hover:bg-brand-500/20 transition-colors">{r.action.label}</button>}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Blacklist reason */}
                {contact.is_blacklisted && contact.blacklist_reason && (
                  <div className="mb-4 px-3.5 py-2.5 bg-red-500/[0.06] border border-red-500/15 rounded-xl text-xs text-red-500 flex gap-2 items-start">
                    <Ban size={13} className="shrink-0 mt-0.5" />
                    <span className="overflow-hidden text-ellipsis">{isRTL ? 'سبب البلاك ليست:' : 'Blacklist Reason:'} {contact.blacklist_reason}</span>
                  </div>
                )}

                {/* Viewed By */}
                {(() => {
                  const viewers = getEntityViewers('contact', contact.id);
                  if (viewers.length === 0) return null;
                  return (
                    <div className="rounded-xl border border-edge/70 dark:border-edge-dark/70 overflow-hidden mb-4">
                      <div className="flex items-center gap-2 px-3.5 py-2.5 bg-surface-bg/60 dark:bg-surface-bg-dark/40 border-b border-edge/50 dark:border-edge-dark/50">
                        <div className="w-5 h-5 rounded-md flex items-center justify-center bg-purple-500/15">
                          <Star size={12} style={{ color: '#6B21A8' }} />
                        </div>
                        <span className="text-[11px] font-bold text-content dark:text-content-dark uppercase tracking-wider">{isRTL ? 'شوهد بواسطة' : 'Viewed By'}</span>
                        <span className="text-[9px] text-content-muted dark:text-content-muted-dark ms-auto">{viewers.length} {isRTL ? 'مستخدم' : 'users'}</span>
                      </div>
                      <div className="px-3.5 py-1 max-h-[180px] overflow-y-auto">
                        {viewers.map(v => (
                          <div key={v.user_id} className="flex items-center justify-between py-1.5 border-b border-edge/30 dark:border-edge-dark/30 last:border-b-0 text-[11px]">
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

                {/* Custom Fields */}
                <CustomFieldsRenderer entity="contact" entityId={contact.id} mode="edit" defaultCollapsed={false} />

                {/* Campaign History Analytics */}
                {(() => {
                  const interactions = contact.campaign_interactions || [];
                  if (interactions.length === 0) return null;

                  const campaignMap = {};
                  interactions.forEach(i => {
                    if (!campaignMap[i.campaign]) campaignMap[i.campaign] = { name: i.campaign, count: 0, dates: [] };
                    campaignMap[i.campaign].count++;
                    if (i.date) campaignMap[i.campaign].dates.push(i.date);
                  });
                  const chartData = Object.values(campaignMap).map(c => ({
                    name: c.name.length > 18 ? c.name.slice(0, 16) + '...' : c.name,
                    fullName: c.name,
                    [isRTL ? 'تفاعلات' : 'Interactions']: c.count,
                  }));
                  const campaignList = Object.values(campaignMap).sort((a, b) => {
                    const aLast = a.dates.length ? a.dates.sort().pop() : '';
                    const bLast = b.dates.length ? b.dates.sort().pop() : '';
                    return bLast.localeCompare(aLast);
                  });

                  return (
                    <div className="mt-3 rounded-xl border border-edge/70 dark:border-edge-dark/70 overflow-hidden">
                      <div className="flex items-center gap-2 px-3.5 py-2.5 bg-surface-bg/60 dark:bg-surface-bg-dark/40 border-b border-edge/50 dark:border-edge-dark/50">
                        <div className="w-5 h-5 rounded-md flex items-center justify-center bg-brand-500/15">
                          <Megaphone size={12} style={{ color: '#4A7AAB' }} />
                        </div>
                        <span className="text-[11px] font-bold text-content dark:text-content-dark uppercase tracking-wider">
                          {isRTL ? 'سجل الحملات' : 'Campaign History'}
                        </span>
                        <span className="text-[9px] text-content-muted dark:text-content-muted-dark ms-auto">
                          {interactions.length} {isRTL ? 'تفاعل' : 'interactions'}
                        </span>
                      </div>
                      <div className="px-3.5 py-3">
                        <div style={{ width: '100%', height: Math.max(120, chartData.length * 36) }} dir="ltr">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={chartData} layout="vertical" margin={{ top: 0, right: 20, left: 0, bottom: 0 }}>
                              <XAxis type="number" hide allowDecimals={false} />
                              <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 10, fill: '#6B8DB5' }} />
                              <Tooltip
                                contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #e5e7eb' }}
                                formatter={(value, name, props) => [value, props.payload.fullName]}
                              />
                              <Bar dataKey={isRTL ? 'تفاعلات' : 'Interactions'} fill="#4A7AAB" radius={[0, 4, 4, 0]} barSize={16} />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                        <div className="mt-2.5 border-t border-edge/50 dark:border-edge-dark/50 pt-2">
                          {campaignList.map(c => (
                            <div key={c.name} className="flex items-center justify-between py-1.5 border-b border-edge/30 dark:border-edge-dark/30 last:border-b-0 text-[11px]">
                              <span className="text-content dark:text-content-dark font-medium truncate max-w-[60%]">{c.name}</span>
                              <span className="text-content-muted dark:text-content-muted-dark whitespace-nowrap">
                                {c.count}x
                                {c.dates.length > 0 && ` · ${new Date(c.dates.sort().pop()).toLocaleDateString(isRTL ? 'ar-EG' : 'en-US', { month: 'short', day: 'numeric' })}`}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>

    {/* ═══ New Opportunity Modal ═══ */}
    {showOppModal && (
      <div onClick={() => setShowOppModal(false)} className="fixed inset-0 z-[1100] flex items-center justify-center p-5 bg-black/50 backdrop-blur-[2px]">
        <div dir={isRTL ? 'rtl' : 'ltr'} onClick={e => e.stopPropagation()} className="modal-content bg-surface-card dark:bg-surface-card-dark rounded-2xl p-6 w-full max-w-[440px] border border-edge dark:border-edge-dark shadow-2xl">
          <div className="flex justify-between items-center mb-5">
            <h3 className="m-0 text-content dark:text-content-dark text-sm font-bold">{isRTL ? 'فرصة جديدة' : 'New Opportunity'}</h3>
            <button onClick={() => setShowOppModal(false)} className="w-7 h-7 rounded-lg flex items-center justify-center bg-transparent border-none text-content-muted dark:text-content-muted-dark cursor-pointer hover:bg-red-500/10 hover:text-red-500 transition-colors">
              <X size={16} />
            </button>
          </div>
          <div className="mb-4 px-3 py-2 rounded-lg bg-brand-500/[0.05] border border-brand-500/10">
            <span className="text-[11px] text-content-muted dark:text-content-muted-dark">{isRTL ? 'العميل:' : 'Lead:'}</span>
            <span className="text-xs font-semibold text-content dark:text-content-dark ms-1.5">{contact.full_name}</span>
          </div>
          <div className="flex flex-col gap-3">
            {[
              { key: 'project', label_ar: 'المشروع', label_en: 'Project', type: 'text' },
              { key: 'budget', label_ar: 'الميزانية', label_en: 'Budget', type: 'number' },
              { key: 'notes', label_ar: 'ملاحظات', label_en: 'Notes', type: 'text' },
            ].map(f => (
              <div key={f.key}>
                <label className="text-[11px] text-content-muted dark:text-content-muted-dark block mb-1 text-start font-medium uppercase tracking-wide">{isRTL ? f.label_ar : f.label_en}</label>
                <input type={f.type} value={newOpp[f.key]} onChange={e => setNewOpp(p => ({ ...p, [f.key]: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-lg border border-edge dark:border-edge-dark bg-surface-card dark:bg-surface-card-dark text-content dark:text-content-dark text-xs outline-none box-border font-inherit focus:border-brand-500 transition-colors"
                  style={{ textAlign: isRTL ? 'right' : 'left', direction: isRTL ? 'rtl' : 'ltr' }} />
              </div>
            ))}
            <div>
              <label className="text-[11px] text-content-muted dark:text-content-muted-dark block mb-1 text-start font-medium uppercase tracking-wide">{isRTL ? 'السيلز المسؤول *' : 'Sales Agent *'}</label>
              {isSalesAgent ? (
                <Input value={newOpp.assigned_to_name} disabled className="w-full" />
              ) : (
                <Select value={newOpp.assigned_to_name} onChange={e => setNewOpp(p => ({ ...p, assigned_to_name: e.target.value }))} className="w-full">
                  <option value="">{isRTL ? '-- اختر السيلز --' : '-- Select Agent --'}</option>
                  {selfName && <option value={selfName}>{selfName} {isRTL ? '(أنا)' : '(Me)'}</option>}
                  {agentsList.filter(a => a !== selfName).map(a => <option key={a} value={a}>{a}</option>)}
                </Select>
              )}
            </div>
            <div>
              <label className="text-[11px] text-content-muted dark:text-content-muted-dark block mb-1 text-start font-medium uppercase tracking-wide">{isRTL ? 'المرحلة' : 'Stage'}</label>
              <Select value={newOpp.stage} onChange={e => setNewOpp(p => ({ ...p, stage: e.target.value }))} className="w-full">
                {getDeptStages(dept).map(s => <option key={s.id} value={s.id}>{isRTL ? s.label_ar : s.label_en}</option>)}
              </Select>
            </div>
            {[
              { key: 'temperature', label_ar: 'الحرارة', label_en: 'Temperature', options: [{ v: 'hot', ar: 'ساخن', en: 'Hot' }, { v: 'warm', ar: 'دافئ', en: 'Warm' }, { v: 'normal', ar: 'عادي', en: 'Normal' }, { v: 'cold', ar: 'بارد', en: 'Cold' }] },
              { key: 'priority', label_ar: 'الأولوية', label_en: 'Priority', options: [{ v: 'urgent', ar: 'عاجل', en: 'Urgent' }, { v: 'high', ar: 'عالي', en: 'High' }, { v: 'medium', ar: 'متوسط', en: 'Medium' }, { v: 'low', ar: 'منخفض', en: 'Low' }] },
            ].map(f => (
              <div key={f.key}>
                <label className="text-[11px] text-content-muted dark:text-content-muted-dark block mb-1 text-start font-medium uppercase tracking-wide">{isRTL ? f.label_ar : f.label_en}</label>
                <Select value={newOpp[f.key]} onChange={e => setNewOpp(p => ({ ...p, [f.key]: e.target.value }))} className="w-full">
                  {f.options.map(o => <option key={o.v} value={o.v}>{isRTL ? o.ar : o.en}</option>)}
                </Select>
              </div>
            ))}
          </div>
          <div className="flex gap-2.5 mt-5">
            <Button className="flex-1" size="sm" onClick={handleSaveOpp}>
              {isRTL ? 'حفظ' : 'Save'}
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setShowOppModal(false)}>
              {isRTL ? 'إلغاء' : 'Cancel'}
            </Button>
          </div>
        </div>
      </div>
    )}

    {/* Send SMS Modal */}
    {showSMSModal && contact.phone && (
      <ContactSMSModal
        contact={contact}
        isRTL={isRTL}
        onClose={() => setShowSMSModal(false)}
        onSent={() => {
          toast.success(isRTL ? 'تم إرسال الرسالة' : 'SMS sent successfully');
          setShowSMSModal(false);
        }}
      />
    )}
    {showPrintPreview && (
      <PrintPreview
        html={generateContactCardHTML(contact, getCompanyInfo(), isRTL ? 'ar' : 'en')}
        title={isRTL ? 'بطاقة عميل' : 'Lead Card'}
        onClose={() => setShowPrintPreview(false)}
      />
    )}
    </>
  );
}

