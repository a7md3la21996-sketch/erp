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
  fetchContactOpportunities
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
  Chip, ScorePill, getDeptStages, deptStageLabel,
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
  const [activities, setActivities] = useState([]);
  const [opportunities, setOpportunities] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [loadingData, setLoadingData] = useState(true);
  const [showActionForm, setShowActionForm] = useState(initialAction);
  const [showOppModal, setShowOppModal] = useState(false);
  const [timelineFilter, setTimelineFilter] = useState('all');
  const [activityAgentFilter, setActivityAgentFilter] = useState('all');
  const { profile } = useAuth();
  const isSalesAgent = profile?.role === 'sales_agent';
  const selfName = isRTL ? (profile?.full_name_ar || profile?.full_name_en || '') : (profile?.full_name_en || profile?.full_name_ar || '');
  const [newOpp, setNewOpp] = useState({ project:'', budget:'', stage:'qualification', temperature:'warm', priority:'medium', notes:'', assigned_to_name: isSalesAgent ? selfName : '' });

  // Get agents list for assignment dropdown
  const agentsList = useMemo(() => {
    const names = new Set();
    try {
      const allContacts = JSON.parse(localStorage.getItem('platform_contacts') || '[]');
      allContacts.forEach(c => { if (c.assigned_to_name?.trim()) names.add(c.assigned_to_name.trim()); });
    } catch { /* ignore */ }
    try {
      const allOpps = JSON.parse(localStorage.getItem('platform_opportunities') || '[]');
      allOpps.forEach(o => { if (o.assigned_to_name?.trim()) names.add(o.assigned_to_name.trim()); });
    } catch { /* ignore */ }
    return [...names].sort();
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
  }, [contact.id]);

  // Fetch all data on mount
  useEffect(() => {
    let cancelled = false;
    setLoadingData(true);
    Promise.allSettled([
      fetchContactActivities(contact.id),
      fetchTasks({ contactId: contact.id }),
      fetchContactOpportunities(contact.id),
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
      const { user_id, ...formData } = form;
      const act = await createActivity({ ...formData, contact_id: contact.id });
      setActivities(prev => [act, ...prev]);
      toast.success(isRTL ? 'تم حفظ النشاط' : 'Activity saved');
    } catch (err) {
      const localAct = {
        id: String(Date.now()),
        ...form,
        contact_id: contact.id,
        users: { full_name_ar: 'أنت', full_name_en: 'You' },
      };
      setActivities(prev => [localAct, ...prev]);
      toast.success(isRTL ? 'تم حفظ النشاط محلياً' : 'Activity saved locally');
    }
    // Auto-change status from 'new' to 'contacted' on first activity
    if (contact.contact_status === 'new' || !contact.contact_status) {
      if (onUpdate) onUpdate({ ...contact, contact_status: 'contacted' });
    }
  };

  const handleSaveTask = async (taskData) => {
    try {
      const savedTask = await createTask(taskData);
      setTasks(prev => [savedTask, ...prev]);
    } catch (err) {
      const localTask = { id: String(Date.now()), ...taskData, status: 'todo', created_at: new Date().toISOString() };
      setTasks(prev => [localTask, ...prev]);
      toast.success(isRTL ? 'تم حفظ المهمة محلياً' : 'Task saved locally');
    }
  };

  // Handle contact status change from TakeActionForm
  const handleStatusChange = (newStatus) => {
    if (onUpdate) {
      onUpdate({ ...contact, contact_status: newStatus });
      toast.success(isRTL ? 'تم تحديث حالة التواصل' : 'Contact status updated');
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

  if (!contact) return null;
  const tempInfo = contact.temperature ? TEMP[contact.temperature] : null;
  const tp = contact.contact_type ? TYPE[contact.contact_type] : null;
  const isSupplier = contact.contact_type === 'supplier';
  const dept = contact.department || 'sales';
  const deptTab = isSupplier ? DEPT_TABS.finance : (DEPT_TABS[dept] || DEPT_TABS.sales);

  // Unique agents from activities
  const uniqueAgents = useMemo(() => {
    const map = new Map();
    activities.forEach(a => {
      const id = a.user_id || a.users?.full_name_ar || a.users?.full_name_en;
      if (!id) return;
      const name = isRTL ? (a.users?.full_name_ar || a.users?.full_name_en || '—') : (a.users?.full_name_en || a.users?.full_name_ar || '—');
      if (!map.has(id)) map.set(id, { id, name, count: 0 });
      map.get(id).count++;
    });
    return Array.from(map.values());
  }, [activities, isRTL]);
  const agentCount = uniqueAgents.length;

  const actCount = activities.length;
  const oppCount = opportunities.length;
  const openTaskCount = tasks.filter(t => t.status !== 'done' && t.status !== 'cancelled').length;

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
          getWonDeals().catch(() => []),
        ]);
        const { data: allAudits } = getLocalAuditLogs({ limit: 500, entity: 'contact' });
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
    activities.forEach(a => items.push({ ...a, _type: 'activity', _date: a.created_at }));
    tasks.forEach(t => items.push({ ...t, _type: 'task', _date: t.created_at || t.due_date }));
    opportunities.forEach(o => items.push({ ...o, _type: 'opportunity', _date: o.created_at }));
    extraSources.comments.forEach(c => items.push({ ...c, _type: 'comment', _date: c.created_at }));
    extraSources.documents.forEach(d => items.push({ ...d, _type: 'document', _date: d.uploaded_at || d.created_at }));
    extraSources.audits.forEach(a => items.push({ ...a, _type: 'audit', _date: a.created_at }));
    extraSources.deals.forEach(d => items.push({ ...d, _type: 'deal', _date: d.created_at }));
    return items.sort((a, b) => new Date(b._date || 0) - new Date(a._date || 0));
  }, [activities, tasks, opportunities, extraSources]);

  const filteredTimeline = useMemo(() => {
    let items = timeline;
    if (timelineFilter !== 'all') items = items.filter(item => item._type === timelineFilter);
    if (activityAgentFilter !== 'all') {
      items = items.filter(item => {
        const id = item.user_id || item.users?.full_name_ar || item.users?.full_name_en || item.author_name || item.uploaded_by || item.user_name;
        return id === activityAgentFilter;
      });
    }
    return items;
  }, [timeline, timelineFilter, activityAgentFilter]);

  // Grouped contact info for data tab
  const dataGroups = [
    {
      title: isRTL ? 'معلومات التواصل' : 'Contact Info',
      icon: Phone,
      color: '#10B981',
      rows: [
        { label: isRTL ? 'الهاتف' : 'Phone', val: contact.phone || '—' },
        { label: isRTL ? 'الهاتف الثاني' : 'Phone 2', val: contact.phone2 || '—' },
        { label: isRTL ? 'الإيميل' : 'Email', val: contact.email || '—' },
      ],
    },
    {
      title: isRTL ? 'معلومات العمل' : 'Business Info',
      icon: Briefcase,
      color: '#4A7AAB',
      rows: [
        { label: isRTL ? 'الشركة' : 'Company', val: contact.company || '—' },
        { label: isRTL ? 'المسمى الوظيفي' : 'Job Title', val: contact.job_title || '—' },
        { label: isRTL ? 'الميزانية' : 'Budget', val: fmtBudget(contact.budget_min, contact.budget_max, isRTL) },
        { label: isRTL ? 'الموقع' : 'Location', val: contact.preferred_location || '—' },
        { label: isRTL ? 'نوع العقار' : 'Property', val: (isRTL ? { residential: 'سكني', commercial: 'تجاري', administrative: 'إداري' } : { residential: 'Residential', commercial: 'Commercial', administrative: 'Administrative' })[contact.interested_in_type] || '—' },
      ],
    },
    {
      title: isRTL ? 'التوزيع والمصدر' : 'Assignment',
      icon: Users,
      color: '#F59E0B',
      rows: [
        { label: isRTL ? 'المسؤول' : 'Assigned', val: contact.assigned_to_name || '—' },
        { label: isRTL ? 'تم التعيين بواسطة' : 'Assigned By', val: contact.assigned_by_name || '—' },
        { label: isRTL ? 'أنشأها' : 'Created By', val: contact.created_by_name || '—' },
        { label: isRTL ? 'المصدر' : 'Source', val: isRTL ? SOURCE_LABELS[contact.source] : (SOURCE_EN[contact.source] || contact.source) },
        (() => {
          const interactions = contact.campaign_interactions || [];
          const uniqueCampaigns = [...new Set(interactions.map(i => i.campaign))];
          if (uniqueCampaigns.length > 0) return { label: isRTL ? 'الحملات' : 'Campaigns', val: `${uniqueCampaigns.length} ${isRTL ? 'حملات' : 'campaigns'} (${interactions.length} ${isRTL ? 'تفاعل' : 'interactions'})` };
          return { label: isRTL ? 'الحملة' : 'Campaign', val: contact.campaign_name || '—' };
        })(),
        { label: isRTL ? 'تاريخ التوزيع' : 'Assigned Date', val: contact.assigned_at ? new Date(contact.assigned_at).toLocaleDateString(isRTL ? 'ar-EG' : 'en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : '—' },
        ...(contact.contact_status === 'disqualified' ? [
          { label: isRTL ? 'سبب الاستبعاد' : 'DQ Reason', val: contact.disqualify_reason ? ({ resale: isRTL ? 'عايز يبيع وحدته' : 'Wants to sell unit', not_interested: isRTL ? 'غير مهتم' : 'Not interested', no_budget: isRTL ? 'ميزانية غير مناسبة' : 'No budget', wrong_audience: isRTL ? 'جمهور خاطئ' : 'Wrong audience', duplicate: isRTL ? 'مكرر' : 'Duplicate', other: isRTL ? 'آخر' : 'Other' }[contact.disqualify_reason] || contact.disqualify_reason) : '—', color: '#EF4444' },
          ...(contact.disqualify_note ? [{ label: isRTL ? 'ملاحظة الاستبعاد' : 'DQ Note', val: contact.disqualify_note }] : []),
        ] : []),
      ],
    },
    {
      title: isRTL ? 'معلومات شخصية' : 'Personal',
      icon: Star,
      color: '#6B21A8',
      rows: [
        { label: isRTL ? 'الجنس' : 'Gender', val: contact.gender ? ((isRTL ? { male: 'ذكر', female: 'أنثى' } : { male: 'Male', female: 'Female' })[contact.gender] || contact.gender) : '—' },
        { label: isRTL ? 'الجنسية' : 'Nationality', val: contact.nationality ? ((isRTL ? { egyptian: 'مصري', saudi: 'سعودي', emirati: 'إماراتي', kuwaiti: 'كويتي', qatari: 'قطري', libyan: 'ليبي', other: 'أخرى' } : { egyptian: 'Egyptian', saudi: 'Saudi', emirati: 'Emirati', kuwaiti: 'Kuwaiti', qatari: 'Qatari', libyan: 'Libyan', other: 'Other' })[contact.nationality] || contact.nationality) : '—' },
        { label: isRTL ? 'تاريخ الميلاد' : 'Birth Date', val: contact.birth_date || '—' },
      ],
    },
    {
      title: isRTL ? 'التواريخ' : 'Dates',
      icon: Clock,
      color: '#6B8DB5',
      rows: [
        { label: isRTL ? 'آخر نشاط' : 'Last Activity', val: contact.last_activity_at ? (() => { const d = daysSince(contact.last_activity_at); return d === 0 ? (isRTL ? 'اليوم' : 'Today') : isRTL ? `منذ ${d} يوم` : `${d} days ago`; })() : '—' },
        { label: isRTL ? 'تاريخ الإنشاء' : 'Created', val: contact.created_at ? new Date(contact.created_at).toLocaleDateString(isRTL ? 'ar-EG' : 'en-US', { year: 'numeric', month: 'short', day: 'numeric' }) + ' ' + new Date(contact.created_at).toLocaleTimeString(isRTL ? 'ar-EG' : 'en-US', { hour: '2-digit', minute: '2-digit' }) : '—' },
      ],
    },
  ];

  const rowCls = 'flex justify-between items-center py-2 border-b border-brand-500/[0.06] text-xs';

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
      if (item._type === 'activity') return isRTL ? (item.users?.full_name_ar || 'مجهول') : (item.users?.full_name_en || item.users?.full_name_ar || 'Unknown');
      if (item._type === 'task') return isRTL ? (item.users?.full_name_ar || item.created_by_name || 'مجهول') : (item.users?.full_name_en || item.users?.full_name_ar || item.created_by_name || 'Unknown');
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
              <div className="text-xs font-semibold text-content dark:text-content-dark leading-snug flex-1">{item.description || (isRTL ? 'نشاط' : 'Activity')}</div>
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

  return (
    <>
    {showEdit && <EditContactModal contact={contact} onClose={() => setShowEdit(false)} onSave={async (updated) => { onUpdate(updated); }} />}
    <div className="fixed inset-0 z-[900] flex" dir={isRTL ? 'rtl' : 'ltr'}>
      <div onClick={onClose} className="flex-1 bg-black/45" />
      <div className={`contact-drawer w-[440px] max-w-[100vw] bg-surface-card dark:bg-surface-card-dark flex flex-col overflow-x-hidden ${isRTL ? 'border-l' : 'border-r'} border-edge dark:border-edge-dark`}>

        {/* ═══ COMPACT HEADER ═══ */}
        <div className="shrink-0 bg-gradient-to-b from-surface-bg to-surface-card dark:from-[#1B3347] dark:to-surface-card-dark">
          {/* Top bar — close + edit */}
          <div className="flex justify-between items-center px-5 pt-3.5 pb-0">
            <div className="flex items-center gap-1">
              <button onClick={onClose} className="bg-transparent border-none text-content-muted dark:text-content-muted-dark cursor-pointer p-1 hover:bg-brand-500/10 rounded-lg transition-colors"><X size={18} /></button>
              {onPrev && <button onClick={onPrev} title={isRTL ? 'السابق' : 'Previous'} className="bg-transparent border-none text-content-muted dark:text-content-muted-dark cursor-pointer p-1 hover:bg-brand-500/10 rounded-lg transition-colors"><ChevronUp size={18} /></button>}
              {onNext && <button onClick={onNext} title={isRTL ? 'التالي' : 'Next'} className="bg-transparent border-none text-content-muted dark:text-content-muted-dark cursor-pointer p-1 hover:bg-brand-500/10 rounded-lg transition-colors"><ChevronDown size={18} /></button>}
            </div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={handleToggleFav}
                title={isFav ? (isRTL ? 'إزالة من المفضلة' : 'Remove from Favorites') : (isRTL ? 'إضافة للمفضلة' : 'Add to Favorites')}
                style={{
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  padding: 4,
                  borderRadius: 6,
                  display: 'flex',
                  alignItems: 'center',
                  color: isFav ? '#F59E0B' : (undefined),
                  transition: 'color 0.15s',
                }}
                className={isFav ? '' : 'text-content-muted dark:text-content-muted-dark'}
              >
                <Star size={16} fill={isFav ? '#F59E0B' : 'none'} />
              </button>
              <Button variant="secondary" size="sm" onClick={() => setShowEdit(true)} className="!text-xs !px-2.5 !py-1">
                <Pencil size={12} /> {isRTL ? 'تعديل' : 'Edit'}
              </Button>
              <div className="relative">
                <button onClick={() => setShowDrawerMenu(p => !p)} className={`p-1.5 rounded-lg cursor-pointer transition-colors border ${showDrawerMenu ? 'bg-brand-500 border-brand-500 text-white' : 'bg-transparent border-edge dark:border-edge-dark text-content-muted dark:text-content-muted-dark hover:bg-brand-500/10'}`}>
                  <MoreVertical size={14} />
                </button>
                {showDrawerMenu && (
                  <div className={`absolute top-[36px] end-0 bg-surface-card dark:bg-surface-card-dark border border-edge dark:border-edge-dark rounded-xl min-w-[180px] z-[100] shadow-[0_8px_30px_rgba(27,51,71,0.15)] overflow-hidden`}>
                    <div className="p-1">
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
                      {contact.phone && (
                        <button onClick={() => { setShowSMSModal(true); setShowDrawerMenu(false); }} className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg border-none bg-transparent cursor-pointer text-xs text-content dark:text-content-dark font-inherit hover:bg-surface-bg dark:hover:bg-brand-500/10">
                          <Send size={13} className="text-emerald-500" /> {isRTL ? 'إرسال SMS' : 'Send SMS'}
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
                          <div className="h-px bg-edge dark:bg-edge-dark mx-1" />
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
          </div>

          {/* Avatar + Name + Company + Chips — horizontal */}
          <div className="flex items-start gap-3.5 px-5 pt-3 pb-3">
            <div className={`w-12 h-12 rounded-full shrink-0 flex items-center justify-center text-base font-bold ${contact.is_blacklisted ? 'bg-red-500/20 text-red-500' : 'bg-gradient-to-br from-[#2B4C6F] to-brand-500 text-white'}`}>
              {contact.is_blacklisted ? <Ban size={20} /> : initials(contact.full_name)}
            </div>
            <div className="flex-1 min-w-0">
              <div className={`text-sm font-bold leading-snug mb-0.5 flex items-center gap-1.5 ${contact.is_blacklisted ? 'text-red-500' : 'text-content dark:text-content-dark'}`}>
                <span>{contact.prefix ? <span className="text-[#6B8DB5] me-1">{contact.prefix}</span> : null}{contact.full_name || (isRTL ? 'بدون اسم' : 'No Name')}</span>
                {contact.id && <span className="text-[9px] font-medium text-content-muted dark:text-content-muted-dark bg-brand-500/[0.08] px-1.5 py-0.5 rounded-full shrink-0">#{(contact.id || '').slice(-5)}</span>}
              </div>
              <div className="flex gap-1.5 items-center flex-wrap mb-1.5">
                {tp && <Chip label={isRTL ? tp.label : tp.labelEn} color={tp.color} bg={tp.bg} />}
                {contact.department && <Chip label={(isRTL ? { sales: 'مبيعات', hr: 'HR', finance: 'مالية', marketing: 'تسويق', operations: 'عمليات' } : { sales: 'Sales', hr: 'HR', finance: 'Finance', marketing: 'Marketing', operations: 'Operations' })[contact.department] || contact.department} color="#8BA8C8" bg="rgba(139,168,200,0.1)" />}
                {contact.is_blacklisted && <Chip label={isRTL ? "بلاك ليست" : "Blacklist"} color="#EF4444" bg="rgba(239,68,68,0.12)" />}
              </div>
              {contact.notes && (
                <div className="text-[10.5px] text-content-muted dark:text-content-muted-dark bg-brand-500/[0.05] border border-brand-500/10 rounded-md px-2 py-1.5 mb-1.5 leading-relaxed line-clamp-2">
                  {contact.notes}
                </div>
              )}
              {(contact.source || contact.company || contact.job_title) && (
                <div className="flex items-center gap-1.5 flex-wrap text-[10.5px] text-content-muted dark:text-content-muted-dark mb-1.5 opacity-80">
                  {contact.source && <span>{isRTL ? (SOURCE_LABELS[contact.source] || contact.source) : (SOURCE_EN[contact.source] || contact.source)}</span>}
                  {contact.source && (contact.company || contact.job_title) && <span className="opacity-40">·</span>}
                  {contact.company && <span>{contact.company}</span>}
                  {contact.company && contact.job_title && <span className="opacity-40">·</span>}
                  {contact.job_title && <span>{contact.job_title}</span>}
                </div>
              )}
              <div className="flex items-center gap-3 text-[11px] text-content-muted dark:text-content-muted-dark">
                {contact.phone && (
                  <a href={`tel:${contact.phone}`} className="flex items-center gap-1 text-content-muted dark:text-content-muted-dark no-underline hover:text-brand-500 transition-colors" dir="ltr">
                    <Phone size={10} className="opacity-50" /> {contact.phone}
                  </a>
                )}
                {!loadingData && agentCount > 0 && (
                  <span className="flex items-center gap-1 opacity-70">
                    <Users size={10} /> {agentCount} {isRTL ? 'موظف' : `agent${agentCount > 1 ? 's' : ''}`}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Quick Actions — compact icons with labels */}
          <div className="flex gap-2 px-5 pb-2.5">
            {contact.phone && (
              <a href={`tel:${contact.phone}`} className="flex-1 py-1.5 bg-emerald-500/10 border border-emerald-500/25 rounded-lg text-emerald-500 text-[11px] font-semibold text-center no-underline flex items-center justify-center gap-1">
                <Phone size={12} /> {isRTL ? 'اتصال' : 'Call'}
              </a>
            )}
            {contact.phone && (
              <button onClick={() => setShowWAPopup(p => !p)} className="flex-1 py-1.5 bg-[#25D366]/10 border border-[#25D366]/25 rounded-lg text-[#25D366] text-[11px] font-semibold text-center cursor-pointer flex items-center justify-center gap-1 relative">
                <MessageCircle size={12} /> {isRTL ? 'واتساب' : 'WA'}
              </button>
            )}
            {contact.email && (
              <a href={`mailto:${contact.email}`} className="flex-1 py-1.5 bg-brand-500/10 border border-brand-500/25 rounded-lg text-[#6B8DB5] text-[11px] font-semibold text-center no-underline flex items-center justify-center gap-1">
                <Mail size={12} /> {isRTL ? 'إيميل' : 'Email'}
              </a>
            )}
            {!contact.is_blacklisted && (
              <button onClick={() => onBlacklist(contact)} className="flex-1 py-1.5 bg-red-500/[0.08] border border-red-500/25 rounded-lg text-red-500 text-[11px] font-semibold cursor-pointer flex items-center justify-center gap-1">
                <Ban size={12} /> {isRTL ? 'بلاك' : 'Block'}
              </button>
            )}
          </div>

          {/* WhatsApp Quick Send Popup */}
          {showWAPopup && contact.phone && (
            <div className="mx-5 mb-2.5 rounded-xl border border-[#25D366]/25 bg-[#25D366]/[0.04] dark:bg-[#25D366]/[0.06] p-3" style={{ position: 'relative' }}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-[#25D366] flex items-center gap-1.5">
                  <MessageCircle size={13} /> {isRTL ? 'إرسال واتساب' : 'Send WhatsApp'}
                </span>
                <button onClick={() => setShowWAPopup(false)} className="w-5 h-5 rounded flex items-center justify-center bg-transparent border-0 cursor-pointer text-content-muted dark:text-content-muted-dark">
                  <X size={12} />
                </button>
              </div>
              {/* Template selector */}
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
                className="w-full px-2.5 py-1.5 rounded-lg border border-edge dark:border-edge-dark bg-surface-input dark:bg-surface-input-dark text-content dark:text-content-dark text-xs outline-none mb-2 font-cairo"
              >
                <option value="">{isRTL ? 'اختر قالب...' : 'Pick a template...'}</option>
                {waTemplates.map(t => (
                  <option key={t.id} value={t.id}>{isRTL ? (t.name_ar || t.name) : t.name}</option>
                ))}
              </select>
              {/* Message input */}
              <textarea
                value={waMessage}
                onChange={e => setWaMessage(e.target.value)}
                placeholder={isRTL ? 'اكتب رسالة...' : 'Type a message...'}
                rows={3}
                className="w-full px-2.5 py-2 rounded-lg border border-edge dark:border-edge-dark bg-surface-input dark:bg-surface-input-dark text-content dark:text-content-dark text-xs outline-none resize-none font-cairo"
                style={{ lineHeight: 1.5 }}
              />
              <div className="flex gap-2 mt-2">
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
                  className="flex-1 py-1.5 rounded-lg border-0 text-white text-[11px] font-semibold cursor-pointer flex items-center justify-center gap-1"
                  style={{ background: '#25D366' }}
                >
                  <Send size={11} /> {isRTL ? 'إرسال' : 'Send'}
                </button>
                <a
                  href={generateWhatsAppLink(normalizePhone(contact.phone).replace('+', ''))}
                  target="_blank"
                  rel="noreferrer"
                  className="py-1.5 px-3 rounded-lg border border-[#25D366]/25 text-[#25D366] text-[11px] font-semibold no-underline flex items-center justify-center gap-1"
                >
                  <ExternalLink size={11} /> {isRTL ? 'فتح' : 'Open'}
                </a>
              </div>
              {/* Recent WA messages */}
              {recentWAMessages.length > 0 && (
                <div className="mt-2.5 pt-2 border-t border-[#25D366]/15">
                  <span className="text-[10px] font-semibold text-content-muted dark:text-content-muted-dark">
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

          {/* Stats Bar */}
          <div className="flex gap-0 mx-5 mb-2.5 rounded-lg border border-edge dark:border-edge-dark overflow-hidden">
            <div className="flex-1 py-1.5 text-center bg-brand-500/[0.05]">
              <span className="text-sm font-bold text-brand-500">{loadingData ? '…' : actCount}</span>
              <span className="text-[10px] text-content-muted dark:text-content-muted-dark ms-1">{isRTL ? 'نشاط' : 'Activities'}</span>
            </div>
            <div className="w-px bg-edge dark:bg-edge-dark" />
            <div className="flex-1 py-1.5 text-center bg-emerald-500/[0.05]">
              <span className="text-sm font-bold text-emerald-500">{loadingData ? '…' : oppCount}</span>
              <span className="text-[10px] text-content-muted dark:text-content-muted-dark ms-1">{isRTL ? 'فرصة' : 'Opps'}</span>
            </div>
            <div className="w-px bg-edge dark:bg-edge-dark" />
            <div className="flex-1 py-1.5 text-center bg-amber-500/[0.05]">
              <span className="text-sm font-bold text-amber-500">{loadingData ? '…' : openTaskCount}</span>
              <span className="text-[10px] text-content-muted dark:text-content-muted-dark ms-1">{isRTL ? 'مهمة' : 'Tasks'}</span>
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

          {/* ══════ ACTIVITY TAB (النشاط) ══════ */}
          {tab === 'activity' && (
            <div>
              {/* Take Action Button */}
              <div className="flex gap-2 mb-4">
                <button onClick={() => setShowActionForm(p => !p)}
                  className={`flex-1 py-2 rounded-lg text-xs font-semibold cursor-pointer flex items-center justify-center gap-1.5 border transition-colors ${showActionForm ? 'bg-brand-500 text-white border-brand-500' : 'bg-brand-500/[0.08] border-brand-500/25 text-brand-500'}`}>
                  <Zap size={13} /> {isRTL ? 'اتخذ إجراء' : 'Take Action'}
                </button>
                <button onClick={() => setShowOppModal(true)}
                  className="flex-1 py-2 rounded-lg text-xs font-semibold cursor-pointer flex items-center justify-center gap-1.5 border bg-emerald-500/[0.08] border-emerald-500/25 text-emerald-500 transition-colors">
                  <Plus size={13} /> {isRTL ? 'فرصة جديدة' : 'New Opp'}
                </button>
              </div>

              {/* Unified Take Action Form */}
              {showActionForm && (
                <TakeActionForm
                  contact={contact}
                  onSaveActivity={handleSaveActivity}
                  onSaveTask={handleSaveTask}
                  onStatusChange={handleStatusChange}
                  onCancel={() => setShowActionForm(false)}
                />
              )}

              {/* Timeline Filter Chips */}
              {!loadingData && timeline.length > 0 && (
                <div className="flex gap-1.5 mb-3 flex-wrap">
                  {[
                    { key: 'all', label: isRTL ? 'الكل' : 'All', count: timeline.length },
                    { key: 'activity', label: isRTL ? 'نشاط' : 'Activities', count: activities.length },
                    { key: 'task', label: isRTL ? 'مهام' : 'Tasks', count: tasks.length },
                    { key: 'opportunity', label: isRTL ? 'فرص' : 'Opps', count: opportunities.length },
                    { key: 'comment', label: isRTL ? 'تعليقات' : 'Comments', count: extraSources.comments.length },
                    { key: 'document', label: isRTL ? 'مستندات' : 'Docs', count: extraSources.documents.length },
                    { key: 'deal', label: isRTL ? 'صفقات' : 'Deals', count: extraSources.deals.length },
                    { key: 'audit', label: isRTL ? 'سجل' : 'Log', count: extraSources.audits.length },
                  ].filter(f => f.key === 'all' || f.count > 0).map(f => (
                    <button key={f.key} onClick={() => setTimelineFilter(f.key)}
                      className={`px-2.5 py-1 rounded-full text-[11px] cursor-pointer border transition-colors ${timelineFilter === f.key ? 'bg-brand-500 text-white border-brand-500 font-bold' : 'bg-transparent border-edge dark:border-edge-dark text-content-muted dark:text-content-muted-dark font-normal hover:border-brand-500/40'}`}>
                      {f.label} {f.count > 0 ? `(${f.count})` : ''}
                    </button>
                  ))}
                </div>
              )}

              {/* Agent Filter Chips */}
              {!loadingData && uniqueAgents.length > 1 && (
                <div className="flex gap-1.5 mb-3 flex-wrap">
                  <button
                    onClick={() => setActivityAgentFilter('all')}
                    className={`px-2.5 py-1 rounded-full text-[11px] cursor-pointer border transition-colors ${activityAgentFilter === 'all' ? 'bg-amber-500 text-white border-amber-500 font-bold' : 'bg-transparent border-edge dark:border-edge-dark text-content-muted dark:text-content-muted-dark font-normal hover:border-amber-500/40'}`}
                  >
                    {isRTL ? 'كل الموظفين' : 'All Agents'}
                  </button>
                  {uniqueAgents.map(ag => (
                    <button
                      key={ag.id}
                      onClick={() => setActivityAgentFilter(activityAgentFilter === ag.id ? 'all' : ag.id)}
                      className={`px-2.5 py-1 rounded-full text-[11px] cursor-pointer border transition-colors ${activityAgentFilter === ag.id ? 'bg-amber-500 text-white border-amber-500 font-bold' : 'bg-transparent border-edge dark:border-edge-dark text-content-muted dark:text-content-muted-dark font-normal hover:border-amber-500/40'}`}
                    >
                      {ag.name} ({ag.count})
                    </button>
                  ))}
                </div>
              )}

              {/* Full Timeline */}
              {loadingData ? (
                <div className="text-center p-8 text-content-muted dark:text-content-muted-dark text-xs">{isRTL ? 'جاري التحميل...' : 'Loading...'}</div>
              ) : filteredTimeline.length === 0 ? (
                <div className="text-center p-8 text-content-muted dark:text-content-muted-dark">
                  <Clock size={28} className="opacity-25 mb-2 mx-auto" />
                  <p className="m-0 text-xs">{isRTL ? 'لا توجد سجلات بعد' : 'No records yet'}</p>
                </div>
              ) : (
                <div>
                  {groupedTimeline.map((group, gi) => (
                    <div key={group.label}>
                      {/* Date Header */}
                      <div className="flex items-center gap-2 mb-2.5 mt-1">
                        <span className="text-[11px] font-bold text-content dark:text-content-dark uppercase tracking-wide">{group.label}</span>
                        <div className="flex-1 h-px bg-edge dark:bg-edge-dark" />
                      </div>
                      {/* Items */}
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
              {/* Supplier always sees Invoices regardless of dept */}
              {isSupplier ? (
                <div className="text-center p-8 text-content-muted dark:text-content-muted-dark">
                  <FileDown size={28} className="mb-2 opacity-30 mx-auto" />
                  <p className="m-0 text-xs font-semibold text-content dark:text-content-dark">{isRTL ? 'لا توجد فواتير بعد' : 'No invoices yet'}</p>
                  <p className="mt-1 mb-3 text-xs">{isRTL ? 'أضف فاتورة لهذا المورد' : 'Add an invoice for this supplier'}</p>
                </div>
              ) : (
                <>
                  {/* ── Sales: Opportunities ── */}
                  {dept === 'sales' && (
                    <>
                      <div className="flex items-center justify-between mb-4">
                        <div className="text-sm font-bold text-content dark:text-content-dark">{isRTL ? 'الفرص' : 'Opportunities'} ({oppCount})</div>
                        <button onClick={() => setShowOppModal(true)} className="px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/25 rounded-lg text-emerald-500 text-xs font-semibold cursor-pointer flex items-center gap-1.5">
                          <Plus size={12} /> {isRTL ? 'فرصة جديدة' : 'New'}
                        </button>
                      </div>
                      {loadingData ? (
                        <div className="text-center p-8 text-content-muted dark:text-content-muted-dark text-xs">{isRTL ? 'جاري التحميل...' : 'Loading...'}</div>
                      ) : opportunities.length === 0 ? (
                        <div className="text-center p-8 text-content-muted dark:text-content-muted-dark">
                          <Target size={28} className="opacity-25 mb-2 mx-auto" />
                          <p className="m-0 text-xs">{isRTL ? 'لا توجد فرص بعد' : 'No opportunities yet'}</p>
                        </div>
                      ) : (
                        <div className="flex flex-col gap-2.5">
                          {opportunities.map(opp => (
                            <button
                              key={opp.id}
                              onClick={() => navigate(`/crm/opportunities?highlight=${opp.id}`)}
                              className="w-full text-start bg-emerald-500/[0.05] border border-emerald-500/15 rounded-xl p-3.5 cursor-pointer hover:bg-emerald-500/[0.10] transition-colors"
                            >
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-xs font-bold text-content dark:text-content-dark">{isRTL ? 'فرصة' : 'Opp'} #{String(opp.id).slice(-4)}</span>
                                <Chip label={deptStageLabel(opp.stage, dept, isRTL)} color="#10B981" bg="rgba(16,185,129,0.1)" />
                              </div>
                              {opp.projects?.name_ar && (
                                <div className="text-xs text-content-muted dark:text-content-muted-dark mb-1">{isRTL ? opp.projects.name_ar : (opp.projects.name_en || opp.projects.name_ar)}</div>
                              )}
                              {(opp.users || opp.assigned_to_name) && (
                                <div className="text-[11px] font-semibold text-brand-500 mb-1">
                                  {opp.users ? (isRTL ? (opp.users.full_name_ar || opp.users.full_name_en) : (opp.users.full_name_en || opp.users.full_name_ar)) : opp.assigned_to_name}
                                </div>
                              )}
                              <div className="flex gap-3 text-[11px] text-content-muted dark:text-content-muted-dark">
                                {opp.budget > 0 && <span>{fmtBudget(opp.budget, null, isRTL)} {isRTL ? 'ج.م' : 'EGP'}</span>}
                                {opp.temperature && <span>{isRTL ? TEMP[opp.temperature]?.labelAr : TEMP[opp.temperature]?.label}</span>}
                                <span>{opp.created_at?.slice(0, 10)}</span>
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                    </>
                  )}

                  {/* ── HR: Recruitment ── */}
                  {dept === 'hr' && (
                    <div className="text-center p-8 text-content-muted dark:text-content-muted-dark">
                      <UserCheck size={28} className="mb-2 opacity-30 mx-auto" />
                      <p className="m-0 text-xs font-semibold text-content dark:text-content-dark">{isRTL ? 'لا توجد عمليات توظيف بعد' : 'No recruitment records yet'}</p>
                      <p className="mt-1 mb-3 text-xs">{isRTL ? 'سجل عمليات التوظيف لهذا الشخص' : 'Track recruitment for this person'}</p>
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
                      <div className="text-center p-8 text-content-muted dark:text-content-muted-dark">
                        <Megaphone size={28} className="mb-2 opacity-30 mx-auto" />
                        <p className="m-0 text-xs font-semibold text-content dark:text-content-dark">{isRTL ? 'لا توجد تفاعلات بعد' : 'No campaign interactions yet'}</p>
                      </div>
                    );

                    // Group by campaign for summary
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
                        {/* Summary stats */}
                        <div className="grid grid-cols-3 gap-2">
                          <div className="p-2.5 bg-brand-500/[0.06] rounded-xl text-center">
                            <p className="m-0 text-[10px] text-content-muted dark:text-content-muted-dark">{isRTL ? 'إجمالي التفاعلات' : 'Total Interactions'}</p>
                            <p className="m-0 text-sm font-bold text-brand-500">{interactions.length}</p>
                          </div>
                          <div className="p-2.5 bg-brand-500/[0.06] rounded-xl text-center">
                            <p className="m-0 text-[10px] text-content-muted dark:text-content-muted-dark">{isRTL ? 'أول مصدر' : 'First Source'}</p>
                            <p className="m-0 text-[11px] font-bold text-content dark:text-content-dark truncate">{firstSource.campaign}</p>
                          </div>
                          <div className="p-2.5 bg-brand-500/[0.06] rounded-xl text-center">
                            <p className="m-0 text-[10px] text-content-muted dark:text-content-muted-dark">{isRTL ? 'آخر مصدر' : 'Last Source'}</p>
                            <p className="m-0 text-[11px] font-bold text-content dark:text-content-dark truncate">{lastSource.campaign}</p>
                          </div>
                        </div>

                        {/* Per-campaign breakdown */}
                        <p className="m-0 text-xs font-semibold text-content dark:text-content-dark">
                          {isRTL ? 'تفاصيل الحملات' : 'Campaign Breakdown'} <span className="text-brand-500">({uniqueCampaigns.length})</span>
                        </p>
                        {uniqueCampaigns.map(([name, data]) => (
                          <div key={name} className="p-3 bg-brand-500/[0.05] border border-brand-500/10 rounded-xl">
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

                        {/* Full interaction log */}
                        <details className="mt-1">
                          <summary className="text-[11px] text-brand-500 cursor-pointer font-semibold">{isRTL ? 'سجل التفاعلات الكامل' : 'Full Interaction Log'}</summary>
                          <div className="mt-2 space-y-1">
                            {interactions.sort((a, b) => new Date(b.date) - new Date(a.date)).map((int, idx) => (
                              <div key={idx} className="flex items-center justify-between py-1.5 border-b border-brand-500/[0.06] text-[11px]">
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
                    <div className="text-center p-8 text-content-muted dark:text-content-muted-dark">
                      <Settings size={28} className="mb-2 opacity-30 mx-auto" />
                      <p className="m-0 text-xs font-semibold text-content dark:text-content-dark">{isRTL ? 'لا توجد طلبات بعد' : 'No orders yet'}</p>
                      <p className="mt-1 mb-3 text-xs">{isRTL ? 'سجل الطلبات لهذا الشخص' : 'Track orders for this person'}</p>
                    </div>
                  )}

                  {/* ── Finance: Invoices ── */}
                  {dept === 'finance' && (
                    <div className="text-center p-8 text-content-muted dark:text-content-muted-dark">
                      <FileDown size={28} className="mb-2 opacity-30 mx-auto" />
                      <p className="m-0 text-xs font-semibold text-content dark:text-content-dark">{isRTL ? 'لا توجد فواتير بعد' : 'No invoices yet'}</p>
                      <p className="mt-1 mb-3 text-xs">{isRTL ? 'أضف فاتورة لهذا الشخص' : 'Add an invoice for this person'}</p>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* ══════ COMMENTS TAB (تعليقات) ══════ */}
          {/* ══════ RESALE UNITS TAB (وحدات للبيع) ══════ */}
          {tab === 'units' && (
            <ResaleUnitsTab contact={contact} isRTL={isRTL} />
          )}

          {tab === 'comments' && (
            <CommentsSection
              entity="contact"
              entityId={contact.id}
              entityName={contact.full_name}
            />
          )}

          {/* ══════ DOCUMENTS TAB (المستندات) ══════ */}
          {tab === 'documents' && (
            <DocumentsSection
              entity="contact"
              entityId={contact.id}
              entityName={contact.full_name}
            />
          )}

          {/* ══════ DATA TAB (البيانات) ══════ */}
          {tab === 'data' && (
            <div>
              {/* Score & Temperature */}
              <div className="grid grid-cols-2 gap-2.5 mb-4">
                <div className="bg-brand-500/[0.07] rounded-xl p-3 border border-brand-500/[0.12]">
                  <div className="text-content-muted dark:text-content-muted-dark text-xs mb-2">{isRTL ? 'نقاط التقييم' : 'Lead Score'}</div>
                  <ScorePill score={contact.lead_score} />
                </div>
                <div className="rounded-xl p-3" style={{ background: tempInfo?.bg || 'rgba(74,122,171,0.05)', border: `1px solid ${tempInfo?.color || 'transparent'}30` }}>
                  <div className="text-content-muted dark:text-content-muted-dark text-xs mb-1">{isRTL ? 'الحرارة' : 'Temperature'}</div>
                  {tempInfo?.Icon ? <div className="flex items-center gap-1.5"><tempInfo.Icon size={14} color={tempInfo.color} /><span className="font-bold text-sm" style={{ color: tempInfo?.color }}>{isRTL ? tempInfo?.labelAr : tempInfo?.label}</span></div> : <span className="text-xs text-content-muted dark:text-content-muted-dark">—</span>}
                </div>
              </div>

              {/* Grouped Sections */}
              <div className="flex flex-col gap-3 mb-3">
                {dataGroups.map(group => {
                  const GroupIcon = group.icon;
                  return (
                    <div key={group.title} className="rounded-xl border border-edge dark:border-edge-dark overflow-hidden">
                      <div className="flex items-center gap-2 px-3.5 py-2 bg-surface-input/50 dark:bg-surface-input-dark/50 border-b border-edge dark:border-edge-dark">
                        <GroupIcon size={13} style={{ color: group.color }} />
                        <span className="text-[11px] font-bold text-content dark:text-content-dark uppercase tracking-wide">{group.title}</span>
                      </div>
                      <div className="px-3.5">
                        {group.rows.map(r => (
                          <div key={r.label} className={rowCls}>
                            <span className="text-content-muted dark:text-content-muted-dark">{r.label}</span>
                            <span className="text-content dark:text-content-dark font-medium max-w-[55%] text-end whitespace-nowrap overflow-hidden text-ellipsis">{r.val}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Notes removed — shown in header */}

              {/* Blacklist reason */}
              {contact.is_blacklisted && contact.blacklist_reason && (
                <div className="mb-4 px-3.5 py-2.5 bg-red-500/[0.08] border border-red-500/20 rounded-xl text-xs text-red-500 flex gap-1.5 items-start">
                  <Ban size={13} className="shrink-0 mt-0.5" /> <span className="overflow-hidden text-ellipsis">{isRTL ? 'سبب البلاك ليست:' : 'Blacklist Reason:'} {contact.blacklist_reason}</span>
                </div>
              )}

              {/* Viewed By */}
              {(() => {
                const viewers = getEntityViewers('contact', contact.id);
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

              {/* Custom Fields */}
              <CustomFieldsRenderer entity="contact" entityId={contact.id} mode="edit" defaultCollapsed={false} />

              {/* ── Campaign History Analytics ── */}
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
                  name: c.name.length > 18 ? c.name.slice(0, 16) + '…' : c.name,
                  fullName: c.name,
                  [isRTL ? 'تفاعلات' : 'Interactions']: c.count,
                }));
                const campaignList = Object.values(campaignMap).sort((a, b) => {
                  const aLast = a.dates.length ? a.dates.sort().pop() : '';
                  const bLast = b.dates.length ? b.dates.sort().pop() : '';
                  return bLast.localeCompare(aLast);
                });

                return (
                  <div className="mt-3 rounded-xl border border-edge dark:border-edge-dark overflow-hidden">
                    <div className="flex items-center gap-2 px-3.5 py-2 bg-surface-input/50 dark:bg-surface-input-dark/50 border-b border-edge dark:border-edge-dark">
                      <Megaphone size={13} style={{ color: '#4A7AAB' }} />
                      <span className="text-[11px] font-bold text-content dark:text-content-dark uppercase tracking-wide">
                        {isRTL ? 'سجل الحملات' : 'Campaign History'}
                      </span>
                      <span className="text-[9px] text-content-muted dark:text-content-muted-dark ms-auto">
                        {interactions.length} {isRTL ? 'تفاعل' : 'interactions'}
                      </span>
                    </div>
                    <div className="px-3.5 py-3">
                      {/* Bar Chart */}
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
                      {/* Campaign List */}
                      <div className="mt-2 border-t border-edge dark:border-edge-dark pt-2">
                        {campaignList.map(c => (
                          <div key={c.name} className="flex items-center justify-between py-1.5 border-b border-brand-500/[0.06] last:border-b-0 text-[11px]">
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

    {/* ═══ New Opportunity Modal ═══ */}
    {showOppModal && (
      <div onClick={() => setShowOppModal(false)} className="fixed inset-0 z-[1100] flex items-center justify-center p-5 bg-black/50">
        <div dir={isRTL ? 'rtl' : 'ltr'} onClick={e => e.stopPropagation()} className="modal-content bg-surface-card dark:bg-surface-card-dark rounded-xl p-6 w-full max-w-[420px] border border-edge dark:border-edge-dark">
          <div className="flex justify-between items-center mb-5">
            <h3 className="m-0 text-content dark:text-content-dark text-sm font-bold">{isRTL ? 'فرصة جديدة - ' : 'New Opportunity - '}{contact.full_name}</h3>
            <button onClick={() => setShowOppModal(false)} className="bg-transparent border-none text-content-muted dark:text-content-muted-dark cursor-pointer text-lg">✕</button>
          </div>
          <div className="flex flex-col gap-3">
            {[
              { key: 'project', label_ar: 'المشروع', label_en: 'Project', type: 'text' },
              { key: 'budget', label_ar: 'الميزانية', label_en: 'Budget', type: 'number' },
              { key: 'notes', label_ar: 'ملاحظات', label_en: 'Notes', type: 'text' },
            ].map(f => (
              <div key={f.key}>
                <label className="text-xs text-content-muted dark:text-content-muted-dark block mb-1 text-start">{isRTL ? f.label_ar : f.label_en}</label>
                <input type={f.type} value={newOpp[f.key]} onChange={e => setNewOpp(p => ({ ...p, [f.key]: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-lg border border-edge dark:border-edge-dark bg-surface-card dark:bg-surface-card-dark text-content dark:text-content-dark text-xs outline-none box-border font-inherit"
                  style={{ textAlign: isRTL ? 'right' : 'left', direction: isRTL ? 'rtl' : 'ltr' }} />
              </div>
            ))}
            {/* Sales Agent Assignment */}
            <div>
              <label className="text-xs text-content-muted dark:text-content-muted-dark block mb-1 text-start">{isRTL ? 'السيلز المسؤول *' : 'Sales Agent *'}</label>
              {isSalesAgent ? (
                <Input value={newOpp.assigned_to_name} disabled className="w-full" />
              ) : (
                <Select value={newOpp.assigned_to_name} onChange={e => setNewOpp(p => ({ ...p, assigned_to_name: e.target.value }))} className="w-full">
                  <option value="">{isRTL ? '— اختر السيلز —' : '— Select Agent —'}</option>
                  {selfName && <option value={selfName}>{selfName} {isRTL ? '(أنا)' : '(Me)'}</option>}
                  {agentsList.filter(a => a !== selfName).map(a => <option key={a} value={a}>{a}</option>)}
                </Select>
              )}
            </div>
            <div>
              <label className="text-xs text-content-muted dark:text-content-muted-dark block mb-1 text-start">{isRTL ? 'المرحلة' : 'Stage'}</label>
              <Select value={newOpp.stage} onChange={e => setNewOpp(p => ({ ...p, stage: e.target.value }))} className="w-full">
                {getDeptStages(dept).map(s => <option key={s.id} value={s.id}>{isRTL ? s.label_ar : s.label_en}</option>)}
              </Select>
            </div>
            {[
              { key: 'temperature', label_ar: 'الحرارة', label_en: 'Temperature', options: [{ v: 'hot', ar: 'ساخن', en: 'Hot' }, { v: 'warm', ar: 'دافئ', en: 'Warm' }, { v: 'normal', ar: 'عادي', en: 'Normal' }, { v: 'cold', ar: 'بارد', en: 'Cold' }] },
              { key: 'priority', label_ar: 'الأولوية', label_en: 'Priority', options: [{ v: 'urgent', ar: 'عاجل', en: 'Urgent' }, { v: 'high', ar: 'عالي', en: 'High' }, { v: 'medium', ar: 'متوسط', en: 'Medium' }, { v: 'low', ar: 'منخفض', en: 'Low' }] },
            ].map(f => (
              <div key={f.key}>
                <label className="text-xs text-content-muted dark:text-content-muted-dark block mb-1 text-start">{isRTL ? f.label_ar : f.label_en}</label>
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
        title={isRTL ? 'بطاقة جهة اتصال' : 'Contact Card'}
        onClose={() => setShowPrintPreview(false)}
      />
    )}
    </>
  );
}

