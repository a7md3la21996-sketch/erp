import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import { fetchOpportunities, updateOpportunity, deleteOpportunity, fetchSalesAgents, fetchProjects } from '../../services/opportunitiesService';
import { createDealFromOpportunity, dealExistsForOpportunity } from '../../services/dealsService';
import { useNavigate, useLocation } from 'react-router-dom';
import { useSystemConfig } from '../../contexts/SystemConfigContext';
import { TrendingUp, Plus, Search, X, MoreHorizontal, Trash2, Building2, Banknote, User, Grid3X3, Flame, Loader2, Pencil, Phone, MessageCircle, Mail, Users as UsersIcon, Clock, Star, List, Columns, MapPin, Briefcase, Calendar, ExternalLink, CheckSquare, Square, AlertTriangle, Timer, Bookmark, StickyNote, Zap, RefreshCw, ChevronUp, ChevronDown, Download, Thermometer, Flag, ArrowRight, Printer } from 'lucide-react';
import { Button, Card, Input, Select, Textarea, Modal, ModalFooter, KpiCard, PageSkeleton, ExportButton, SmartFilter, applySmartFilters, Pagination } from '../../components/ui';
import { DEPT_STAGES, getDeptStages, deptStageLabel } from './contacts/constants';
import { logView } from '../../services/viewTrackingService';
import { addRecentItem } from '../../services/recentItemsService';
import { logAction } from '../../services/auditService';
import { useAuditFilter } from '../../hooks/useAuditFilter';
import { exportToCSV as exportReportCSV, exportToPrintableHTML, generateOpportunitiesReport } from '../../services/reportExportService';
import { notifyDealWon } from '../../services/notificationsService';
import { evaluateTriggers } from '../../services/triggerService';
import { createApproval as createApprovalRequest, getApprovalByEntity, getAutoApproveThreshold } from '../../services/approvalService';
import {
  TEMP_CONFIG, PRIORITY_CONFIG, ACTIVITY_ICONS, SORT_OPTIONS, TEMP_ORDER, STAGE_WIN_RATES,
  calcLeadScore, scoreColor, scoreLabel, fmtBudget, daysSince, daysInStage, actLabel,
  initials, ACOLORS, avatarColor, getContactName, getAgentName, getProjectName,
  getSavedFilters, saveSavedFilters, getStageHistory, addStageHistory,
  getOppNotes, addOppNote, deleteOppNote,
} from './opportunities/constants';
import OppCard from './opportunities/OppCard';
import ContactSearch from './opportunities/ContactSearch';
import AddModal from './opportunities/AddModal';
import OpportunityDrawer from './opportunities/OpportunityDrawer';
import { useResponsive } from '../../hooks/useMediaQuery';

/* OppCard, ContactSearch, AddModal, OpportunityDrawer extracted to ./opportunities/ */
// ═══════════════════════════════════════════════
// Main Page
// ═══════════════════════════════════════════════
export default function OpportunitiesPage() {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const { i18n } = useTranslation();
  const { profile } = useAuth();
  const { isMobile } = useResponsive();
  const navigate = useNavigate();
  const location = useLocation();
  const { lostReasons: configLostReasons, sources: configSources, sourceLabels: configSourceLabels, contactTypes: configContactTypes, typeMap: configTypeMap, departments: configDepartments, activityTypes: configActivityTypes, activityResults: configActivityResults, stageWinRates: configStageWinRates } = useSystemConfig();
  const lostReasonsMap = useMemo(() => {
    const m = {};
    (configLostReasons || []).forEach(r => { m[r.key] = r; });
    return m;
  }, [configLostReasons]);
  // Build source labels map from config: { facebook: { ar, en }, ... }
  const sourceLabelsMap = useMemo(() => {
    const m = {};
    (configSources || []).forEach(s => { m[s.key] = { ar: s.label_ar, en: s.label_en }; });
    return m;
  }, [configSources]);
  // Build department labels map from config: { sales: { ar, en }, all: { ar, en }, ... }
  const deptLabelsMap = useMemo(() => {
    const m = { all: { ar: 'كل الأقسام', en: 'All Departments' } };
    (configDepartments || []).forEach(d => { m[d.key] = { ar: d.label_ar, en: d.label_en }; });
    return m;
  }, [configDepartments]);
  // Build activity icon map from config
  const ACTIVITY_ICON_MAP = useMemo(() => {
    const iconLookup = { Phone, MessageCircle, Mail, Users: UsersIcon, Star, Clock };
    const m = {};
    (configActivityTypes || []).forEach(t => { m[t.key] = iconLookup[t.icon] || Clock; });
    return m;
  }, [configActivityTypes]);
  const rawLang = i18n.language || 'ar';
  const lang = rawLang.startsWith('ar') ? 'ar' : 'en';
  const isRTL = lang === 'ar';
  const { auditFields, applyAuditFilters } = useAuditFilter('opportunity');

  const [opps, setOpps] = useState([]);
  const [agents, setAgents] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [activeStage, setActiveStage] = useState(location.state?.initialStage || 'all');
  const [smartFilters, setSmartFilters] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [selectedOpp, setSelectedOpp] = useState(null);
  const [dealCreatedToast, setDealCreatedToast] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [viewMode, setViewMode] = useState('table');
  const [sortBy, setSortBy] = useState('newest');
  const [bulkMode, setBulkMode] = useState(false);
  const [bulkSelected, setBulkSelected] = useState(new Set());
  const [savedFilters, setSavedFilters] = useState(() => getSavedFilters());
  const [showSaveFilter, setShowSaveFilter] = useState(false);
  const [filterName, setFilterName] = useState('');
  const [draggingOpp, setDraggingOpp] = useState(null);
  const [dragOverStage, setDragOverStage] = useState(null);
  const [lostReasonModal, setLostReasonModal] = useState(null); // { id, toStage }
  const [lostReason, setLostReason] = useState('');
  const [lostReasonCustom, setLostReasonCustom] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [showFunnel, setShowFunnel] = useState(false);
  const [bulkToast, setBulkToast] = useState(null);
  const [moveWarningToast, setMoveWarningToast] = useState(null);
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);
  const [bulkBarVisible, setBulkBarVisible] = useState(false);
  const isAdmin = profile?.role === 'admin';
  const [gridPage, setGridPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const savedFilterRef = useRef(null);

  // Click-outside for saved filters dropdown
  useEffect(() => {
    if (!showSaveFilter) return;
    const h = (e) => { if (savedFilterRef.current && !savedFilterRef.current.contains(e.target)) setShowSaveFilter(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [showSaveFilter]);

  // Debounce search input
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput), 250);
    return () => clearTimeout(t);
  }, [searchInput]);

  // ─── SmartFilter field definitions ───
  const SMART_FIELDS = useMemo(() => [
    { id: 'department', label: 'القسم', labelEn: 'Department', type: 'select',
      options: Object.entries(deptLabelsMap).filter(([k]) => k !== 'all').map(([k, v]) => ({ value: k, label: v.ar, labelEn: v.en })) },
    { id: 'assigned_to', label: 'المسؤول', labelEn: 'Agent', type: 'select',
      options: agents.map(a => ({ value: a.id, label: a.full_name_ar || a.full_name_en, labelEn: a.full_name_en || a.full_name_ar })) },
    { id: 'temperature', label: 'الحرارة', labelEn: 'Temperature', type: 'select',
      options: Object.entries(TEMP_CONFIG).map(([k, v]) => ({ value: k, label: v.label_ar, labelEn: v.label_en })) },
    { id: 'priority', label: 'الأولوية', labelEn: 'Priority', type: 'select',
      options: Object.entries(PRIORITY_CONFIG).map(([k, v]) => ({ value: k, label: v.label_ar, labelEn: v.label_en })) },
    { id: 'source', label: 'المصدر', labelEn: 'Source', type: 'select',
      options: Object.entries(sourceLabelsMap).map(([k, v]) => ({ value: k, label: v.ar, labelEn: v.en })) },
    { id: 'lead_score', label: 'درجة العميل', labelEn: 'Lead Score', type: 'select',
      options: [
        { value: 'hot', label: 'ساخن (70+)', labelEn: 'Hot (70+)' },
        { value: 'warm', label: 'دافئ (40-69)', labelEn: 'Warm (40-69)' },
        { value: 'cold', label: 'بارد (<40)', labelEn: 'Cold (<40)' },
      ] },
    { id: 'stage', label: 'المرحلة', labelEn: 'Stage', type: 'select',
      options: (() => {
        const seen = new Set();
        const opts = [];
        ['sales','hr','marketing','operations','finance'].forEach(d => {
          getDeptStages(d).forEach(s => {
            if (!seen.has(s.id)) { seen.add(s.id); opts.push({ value: s.id, label: s.label_ar, labelEn: s.label_en }); }
          });
        });
        return opts;
      })() },
    { id: 'budget', label: 'الميزانية', labelEn: 'Budget', type: 'number' },
    { id: 'created_at', label: 'تاريخ الإنشاء', labelEn: 'Created Date', type: 'date' },
    { id: 'expected_close_date', label: 'تاريخ الإغلاق المتوقع', labelEn: 'Expected Close', type: 'date' },
    ...auditFields,
  ], [agents, auditFields, sourceLabelsMap, deptLabelsMap]);

  const SMART_SORT_OPTIONS = useMemo(() =>
    Object.entries(SORT_OPTIONS).map(([k, v]) => ({ value: k, label: v.ar, labelEn: v.en })),
  []);

  // Derive filterDept from smartFilters for stage config
  const filterDept = useMemo(() => {
    const deptFilter = smartFilters.find(f => f.field === 'department' && f.operator === 'is');
    return deptFilter ? deptFilter.value : 'all';
  }, [smartFilters]);

  const closeDrawer = useCallback(() => {
    setSelectedOpp(null);
  }, []);

  // ESC to close modals/drawer (priority: lost reason > confirm delete > add modal > drawer)
  // Ctrl+N / ⌘+N to open add modal
  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape') {
        if (confirmBulkDelete) { setConfirmBulkDelete(false); return; }
        if (lostReasonModal) { setLostReasonModal(null); return; }
        if (confirmDelete) { setConfirmDelete(null); return; }
        if (showModal) { setShowModal(false); return; }
        if (selectedOpp) closeDrawer();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
        e.preventDefault();
        if (!showModal && !selectedOpp) setShowModal(true);
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [selectedOpp, lostReasonModal, confirmDelete, confirmBulkDelete, showModal, closeDrawer]);

  // Dynamic stage config based on department filter
  const currentStages = filterDept === 'all' ? getDeptStages('sales') : getDeptStages(filterDept);
  const stageConfigWithAll = [{ id: 'all', label_ar: 'الكل', label_en: 'All', color: '#4A7AAB' }, ...currentStages];

  // Load data
  const loadData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    const [oppsData, agentsData, projectsData] = await Promise.all([
      fetchOpportunities({ role: profile?.role, userId: profile?.id, teamId: profile?.team_id }),
      fetchSalesAgents(),
      fetchProjects(),
    ]);
    const agentMap = {};
    agentsData.forEach(a => { agentMap[a.id] = a; });
    const projMap = {};
    projectsData.forEach(p => { projMap[p.id] = p; });
    let localContacts = [];
    try { localContacts = JSON.parse(localStorage.getItem('platform_contacts') || '[]'); } catch {}
    const contactMap = {};
    localContacts.forEach(c => { contactMap[c.id] = c; });

    const enriched = oppsData.map(o => ({
      ...o,
      contacts: o.contacts || contactMap[o.contact_id] || null,
      users: o.users || agentMap[o.assigned_to] || null,
      projects: o.projects || projMap[o.project_id] || null,
    }));
    setOpps(enriched);
    setAgents(agentsData);
    setProjects(projectsData);
    setLoading(false);
    setRefreshing(false);
  }, [profile?.role, profile?.id, profile?.team_id]);

  useEffect(() => { loadData(); }, [loadData]);

  // Pre-compute lead scores (memoized)
  const scoreMap = useMemo(() => {
    const m = {};
    opps.forEach(o => { m[o.id] = calcLeadScore(o); });
    return m;
  }, [opps]);

  // Normalize data for SmartFilter (flatten nested fields + computed lead_score)
  const normalizedOpps = useMemo(() => opps.map(o => ({
    ...o,
    department: o.contacts?.department || 'sales',
    source: o.contacts?.source || o.source || '',
    lead_score: (() => { const s = scoreMap[o.id] || 0; return s >= 70 ? 'hot' : s >= 40 ? 'warm' : 'cold'; })(),
  })), [opps, scoreMap]);

  const filtered = useMemo(() => {
    // Apply smart filters
    let result = applySmartFilters(normalizedOpps, smartFilters, SMART_FIELDS);
    result = applyAuditFilters(result, smartFilters);
    // Apply stage tab filter
    if (activeStage !== 'all') result = result.filter(o => o.stage === activeStage);
    // Apply search
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(o => {
        const name = getContactName(o).toLowerCase();
        const project = getProjectName(o, lang).toLowerCase();
        const phone = (o.contacts?.phone || '').toLowerCase();
        const email = (o.contacts?.email || '').toLowerCase();
        return name.includes(q) || project.includes(q) || phone.includes(q) || email.includes(q);
      });
    }
    return result;
  }, [normalizedOpps, smartFilters, SMART_FIELDS, activeStage, search, lang]);

  // Apply sorting
  const sortedFiltered = useMemo(() => {
    const arr = [...filtered];
    arr.sort((a, b) => {
      switch (sortBy) {
        case 'oldest': return new Date(a.created_at || 0) - new Date(b.created_at || 0);
        case 'budget_high': return (b.budget || 0) - (a.budget || 0);
        case 'budget_low': return (a.budget || 0) - (b.budget || 0);
        case 'temp_hot': return (TEMP_ORDER[a.temperature] ?? 4) - (TEMP_ORDER[b.temperature] ?? 4);
        case 'lead_score': return (scoreMap[b.id] || 0) - (scoreMap[a.id] || 0);
        case 'stale': return daysSince(b.contacts?.last_activity_at || b.updated_at) - daysSince(a.contacts?.last_activity_at || a.updated_at);
        default: return new Date(b.created_at || 0) - new Date(a.created_at || 0);
      }
    });
    return arr;
  }, [filtered, sortBy, scoreMap]);

  // Select opp with view tracking
  const selectOpp = useCallback((opp) => {
    setSelectedOpp(opp);
    if (opp) {
      logView({ entityType: 'opportunity', entityId: opp.id, entityName: opp.project || opp.contacts?.full_name, viewer: profile });
      addRecentItem({ type: 'opportunity', id: opp.id, name: opp.contacts?.full_name || opp.project || 'Opportunity', path: '/opportunities?highlight=' + opp.id, extra: { stage: opp.stage, budget: opp.budget } });
    }
  }, [profile]);

  // Drawer prev/next navigation
  const selectedOppIdx = selectedOpp ? sortedFiltered.findIndex(o => o.id === selectedOpp.id) : -1;
  const handleOppPrev = selectedOppIdx > 0 ? () => { selectOpp(sortedFiltered[selectedOppIdx - 1]); } : null;
  const handleOppNext = selectedOppIdx >= 0 && selectedOppIdx < sortedFiltered.length - 1 ? () => { selectOpp(sortedFiltered[selectedOppIdx + 1]); } : null;

  // Grid pagination
  const gridTotalPages = Math.max(1, Math.ceil(sortedFiltered.length / pageSize));
  const gridSafePage = Math.min(gridPage, gridTotalPages);
  const gridPaged = viewMode === 'table' ? sortedFiltered.slice((gridSafePage - 1) * pageSize, gridSafePage * pageSize) : sortedFiltered;
  useEffect(() => { setGridPage(1); }, [search, smartFilters, activeStage, sortBy, pageSize]);

  // Export data
  const exportData = sortedFiltered.map(o => ({
    [isRTL ? 'الاسم' : 'Name']: getContactName(o),
    [isRTL ? 'الهاتف' : 'Phone']: o.contacts?.phone || '',
    [isRTL ? 'المشروع' : 'Project']: getProjectName(o, lang),
    [isRTL ? 'الميزانية' : 'Budget']: o.budget || 0,
    [isRTL ? 'المرحلة' : 'Stage']: deptStageLabel(o.stage, o.contacts?.department || 'sales', isRTL),
    [isRTL ? 'الحرارة' : 'Temp']: isRTL ? (TEMP_CONFIG[o.temperature]?.label_ar || '') : (TEMP_CONFIG[o.temperature]?.label_en || ''),
    [isRTL ? 'المسؤول' : 'Agent']: getAgentName(o, lang),
    [isRTL ? 'الأولوية' : 'Priority']: isRTL ? (PRIORITY_CONFIG[o.priority]?.label_ar || '') : (PRIORITY_CONFIG[o.priority]?.label_en || ''),
    [isRTL ? 'درجة العميل' : 'Lead Score']: scoreMap[o.id] ?? calcLeadScore(o),
    [isRTL ? 'المصدر' : 'Source']: (() => { const src = o.contacts?.source || o.source; return src ? (isRTL ? (sourceLabelsMap[src]?.ar || src) : (sourceLabelsMap[src]?.en || src)) : ''; })(),
    [isRTL ? 'سبب الخسارة' : 'Lost Reason']: o.lost_reason ? (lostReasonsMap[o.lost_reason] ? (isRTL ? lostReasonsMap[o.lost_reason].label_ar : lostReasonsMap[o.lost_reason].label_en) : o.lost_reason) : '',
    [isRTL ? 'الإغلاق المتوقع' : 'Expected Close']: o.expected_close_date || '',
    [isRTL ? 'التاريخ' : 'Date']: o.created_at?.slice(0, 10) || '',
  }));

  const totalBudget = filtered.reduce((s, o) => s + (o.budget || 0), 0);
  const wonCount = filtered.filter(o => o.stage === 'closed_won').length;
  const hotCount = filtered.filter(o => o.temperature === 'hot').length;
  const newThisWeek = opps.filter(o => { const d = new Date(o.created_at); const w = new Date(); w.setDate(w.getDate() - 7); return d >= w; }).length;
  const conversionRate = opps.length > 0 ? Math.round((opps.filter(o => o.stage === 'closed_won').length / opps.length) * 100) : 0;

  // Avg Deal Size (closed_won only)
  const avgDealSize = wonCount > 0 ? Math.round(filtered.filter(o => o.stage === 'closed_won').reduce((s, o) => s + (o.budget || 0), 0) / wonCount) : 0;

  // Avg Time to Close (days from created_at to stage_changed_at for closed_won)
  const avgCloseTime = useMemo(() => {
    const wonOpps = opps.filter(o => o.stage === 'closed_won' && o.created_at && o.stage_changed_at);
    if (!wonOpps.length) return 0;
    const totalDays = wonOpps.reduce((s, o) => s + Math.max(0, Math.floor((new Date(o.stage_changed_at) - new Date(o.created_at)) / 86400000)), 0);
    return Math.round(totalDays / wonOpps.length);
  }, [opps]);

  // Quick Wins: hot + score >= 60 + not closed + expected close within 14 days or in advanced stage
  const quickWins = useMemo(() => {
    const advancedStages = ['negotiation', 'proposal', 'reserved', 'contracted', 'offer', 'agreement'];
    return filtered.filter(o => {
      if (o.stage === 'closed_won' || o.stage === 'closed_lost') return false;
      const score = scoreMap[o.id] || 0;
      const isHotOrWarm = o.temperature === 'hot' || o.temperature === 'warm';
      const isAdvanced = advancedStages.includes(o.stage);
      const closesSoon = o.expected_close_date && Math.ceil((new Date(o.expected_close_date) - Date.now()) / 86400000) <= 14;
      return isHotOrWarm && score >= 60 && (isAdvanced || closesSoon);
    });
  }, [filtered, scoreMap]);

  // Build flat win-rate lookup from config (dept-based → flat, using opp's department)
  const winRateLookup = useMemo(() => {
    const flat = {};
    if (configStageWinRates) {
      Object.entries(configStageWinRates).forEach(([, stages]) => {
        Object.entries(stages).forEach(([stageId, pct]) => {
          // First dept wins; later depts don't overwrite (sales takes priority)
          if (flat[stageId] === undefined) flat[stageId] = pct / 100;
        });
      });
    }
    // Fallback to hardcoded STAGE_WIN_RATES for any missing
    Object.entries(STAGE_WIN_RATES).forEach(([k, v]) => {
      if (flat[k] === undefined) flat[k] = v;
    });
    return flat;
  }, [configStageWinRates]);

  // Weighted Pipeline Forecast
  const weightedForecast = useMemo(() => {
    return filtered.reduce((sum, o) => {
      if (o.stage === 'closed_won' || o.stage === 'closed_lost') return sum;
      const dept = o.contacts?.department || 'sales';
      const deptRates = configStageWinRates?.[dept] || {};
      const rate = deptRates[o.stage] !== undefined ? deptRates[o.stage] / 100 : (winRateLookup[o.stage] || 0.1);
      return sum + (o.budget || 0) * rate;
    }, 0);
  }, [filtered, configStageWinRates, winRateLookup]);

  // Conversion Funnel data
  const funnelData = useMemo(() => {
    const stages = currentStages.filter(s => s.id !== 'closed_lost');
    const counts = {};
    sortedFiltered.forEach(o => { counts[o.stage] = (counts[o.stage] || 0) + 1; });
    const maxCount = Math.max(1, ...stages.map(s => counts[s.id] || 0));
    return stages.map((s, i) => {
      const count = counts[s.id] || 0;
      const prevCount = i > 0 ? (counts[stages[i - 1].id] || 0) : null;
      const dropOff = prevCount !== null && prevCount > 0 ? Math.round(((prevCount - count) / prevCount) * -100) : null;
      return { ...s, count, width: Math.max(8, (count / maxCount) * 100), dropOff };
    });
  }, [currentStages, sortedFiltered]);

  // Win/Loss Analysis
  const lostReasonCounts = useMemo(() => {
    const counts = {};
    opps.forEach(o => {
      if (o.stage === 'closed_lost' && o.lost_reason) {
        counts[o.lost_reason] = (counts[o.lost_reason] || 0) + 1;
      }
    });
    return counts;
  }, [opps]);
  const topLostReason = useMemo(() => {
    const entries = Object.entries(lostReasonCounts);
    if (!entries.length) return null;
    entries.sort((a, b) => b[1] - a[1]);
    return entries[0];
  }, [lostReasonCounts]);

  const handleMove = async (id, toStage, extraUpdates = {}) => {
    // Prevent non-admin users from moving backwards in the pipeline
    if (!isAdmin) {
      const opp = opps.find(o => o.id === id);
      if (opp) {
        const dept = opp.contacts?.department || 'sales';
        const stages = getDeptStages(dept);
        const fromIdx = stages.findIndex(s => s.id === opp.stage);
        const toIdx = stages.findIndex(s => s.id === toStage);
        if (fromIdx !== -1 && toIdx !== -1 && toIdx < fromIdx) {
          setMoveWarningToast(isRTL ? 'لا يمكن نقل الفرصة لمرحلة سابقة' : 'Cannot move opportunity to a previous stage');
          setTimeout(() => setMoveWarningToast(null), 3500);
          return;
        }
      }
    }

    // Intercept closed_lost to ask for reason
    if (toStage === 'closed_lost' && !extraUpdates.lost_reason) {
      setLostReasonModal({ id, toStage });
      setLostReason('');
      setLostReasonCustom('');
      return;
    }

    const fromStage = opps.find(o => o.id === id)?.stage;
    if (fromStage && fromStage !== toStage) addStageHistory(id, fromStage, toStage);
    setOpps(p => p.map(o => o.id === id ? { ...o, stage: toStage, stage_changed_at: new Date().toISOString(), ...extraUpdates } : o));
    if (selectedOpp?.id === id) {
      setSelectedOpp(p => ({ ...p, stage: toStage, stage_changed_at: new Date().toISOString(), ...extraUpdates }));
    }
    await updateOpportunity(id, { stage: toStage, stage_changed_at: new Date().toISOString(), ...extraUpdates }).catch(() => {});
    logAction({ action: 'stage_change', entity: 'opportunity', entityId: id, entityName: getContactName(opps.find(o => o.id === id) || {}), description: isRTL ? 'تغيير مرحلة' : 'Stage changed', oldValue: fromStage, newValue: toStage, userName: profile?.full_name_ar || profile?.full_name_en || '' });
    evaluateTriggers('opportunity', 'stage_changed', { ...(opps.find(o => o.id === id) || {}), stage: toStage, previous_stage: fromStage });

    // Auto-create deal in Operations when closed_won (sales only)
    if (toStage === 'closed_won') {
      const opp = opps.find(o => o.id === id);
      // Notify deal won
      if (opp) {
        notifyDealWon({
          dealNumber: opp.id?.slice(0, 8) || '—',
          clientName: getContactName(opp),
          value: opp.budget ? `${Number(opp.budget).toLocaleString()} EGP` : '—',
          agentId: opp.assigned_to || 'all',
        });
        // Auto-create approval request if budget exceeds threshold
        const approvalThreshold = getAutoApproveThreshold();
        if ((opp.budget || 0) >= approvalThreshold && !getApprovalByEntity('deal', opp.id)) {
          createApprovalRequest({
            type: 'deal',
            entity_id: opp.id,
            entity_name: getContactName(opp),
            requesterId: profile?.id || profile?.email || '',
            requesterName: profile?.full_name_ar || profile?.full_name_en || '',
            amount: opp.budget,
            priority: (opp.budget || 0) >= approvalThreshold * 3 ? 'urgent' : 'normal',
            approverId: 'admin',
            approverName: 'Admin',
            notes: `${isRTL ? 'صفقة مغلقة بقيمة' : 'Deal won with value'} ${Number(opp.budget).toLocaleString()} EGP`,
          });
        }
      }
      if (opp && (opp.contacts?.department || 'sales') === 'sales' && !dealExistsForOpportunity(opp.id)) {
        const deal = await createDealFromOpportunity({ ...opp, stage: toStage });
        setDealCreatedToast(deal.deal_number);
        setTimeout(() => setDealCreatedToast(null), 4000);
      }
    }
  };

  const confirmLostReason = async () => {
    if (!lostReasonModal) return;
    const reason = lostReason === 'other' ? lostReasonCustom : lostReason;
    if (!reason) return;

    // Handle bulk lost
    if (lostReasonModal.bulkIds) {
      const ids = lostReasonModal.bulkIds;
      ids.forEach(id => { const opp = opps.find(o => o.id === id); if (opp && opp.stage !== 'closed_lost') addStageHistory(id, opp.stage, 'closed_lost'); });
      setOpps(p => p.map(o => ids.includes(o.id) ? { ...o, stage: 'closed_lost', lost_reason: reason, stage_changed_at: new Date().toISOString() } : o));
      showBulkToast(isRTL ? `تم نقل ${ids.length} فرصة` : `${ids.length} opportunities moved`);
      setBulkSelected(new Set()); setBulkMode(false);
      setLostReasonModal(null);
      await Promise.all(ids.map(id => updateOpportunity(id, { stage: 'closed_lost', lost_reason: reason, stage_changed_at: new Date().toISOString() }).catch(() => {})));
      return;
    }

    // If triggered from edit form, complete the full edit save with lost_reason
    if (lostReasonModal.fromEdit) {
      const ef = lostReasonModal.editForm;
      addStageHistory(selectedOpp.id, selectedOpp.stage, 'closed_lost');
      const updates = {
        budget: Number(ef.budget) || 0,
        temperature: ef.temperature,
        priority: ef.priority,
        assigned_to: ef.assigned_to || null,
        project_id: ef.project_id || null,
        notes: ef.notes,
        expected_close_date: ef.expected_close_date || null,
        stage: 'closed_lost',
        stage_changed_at: new Date().toISOString(),
        lost_reason: reason,
      };
      setLostReasonModal(null);
      await handleDrawerUpdate(selectedOpp.id, updates);
      return;
    }

    handleMove(lostReasonModal.id, lostReasonModal.toStage, { lost_reason: reason });
    setLostReasonModal(null);
  };

  const handleDelete = (id) => {
    setConfirmDelete(id);
  };

  const confirmDeleteOpp = async () => {
    if (!confirmDelete) return;
    const deletedOpp = opps.find(o => o.id === confirmDelete);
    logAction({ action: 'delete', entity: 'opportunity', entityId: confirmDelete, entityName: getContactName(deletedOpp || {}), description: isRTL ? 'حذف فرصة' : 'Opportunity deleted', userName: profile?.full_name_ar || profile?.full_name_en || '' });
    setOpps(p => p.filter(o => o.id !== confirmDelete));
    if (selectedOpp?.id === confirmDelete) setSelectedOpp(null);
    await deleteOpportunity(confirmDelete).catch(() => {});
    setConfirmDelete(null);
  };

  const handleSave = (opp) => {
    setOpps(p => [opp, ...p]);
    setShowModal(false);
  };

  // Handle drawer edit save — called by OpportunityDrawer's onUpdate
  const handleDrawerUpdate = async (oppId, updates) => {
    const result = await updateOpportunity(oppId, updates);
    setOpps(p => p.map(o => o.id === oppId ? { ...o, ...result } : o));
    setSelectedOpp(prev => prev?.id === oppId ? { ...prev, ...result } : prev);
    logAction({ action: 'update', entity: 'opportunity', entityId: oppId, entityName: getContactName(opps.find(o => o.id === oppId) || selectedOpp || {}), description: isRTL ? 'تحديث فرصة' : 'Opportunity updated', userName: profile?.full_name_ar || profile?.full_name_en || '' });

    // Auto-create deal if moved to closed_won
    if (updates.stage === 'closed_won') {
      notifyDealWon({
        dealNumber: oppId?.slice(0, 8) || '—',
        clientName: getContactName(opps.find(o => o.id === oppId) || selectedOpp || {}),
        value: updates.budget ? `${Number(updates.budget).toLocaleString()} EGP` : '—',
        agentId: updates.assigned_to || selectedOpp?.assigned_to || 'all',
      });
      // Auto-create approval request if budget exceeds threshold
      const budgetVal2 = Number(updates.budget) || Number(selectedOpp?.budget) || 0;
      const approvalThreshold2 = getAutoApproveThreshold();
      if (budgetVal2 >= approvalThreshold2 && !getApprovalByEntity('deal', oppId)) {
        createApprovalRequest({
          type: 'deal',
          entity_id: oppId,
          entity_name: getContactName(opps.find(o => o.id === oppId) || selectedOpp || {}),
          requesterId: profile?.id || profile?.email || '',
          requesterName: profile?.full_name_ar || profile?.full_name_en || '',
          amount: budgetVal2,
          priority: budgetVal2 >= approvalThreshold2 * 3 ? 'urgent' : 'normal',
          approverId: 'admin',
          approverName: 'Admin',
          notes: `${isRTL ? 'صفقة مغلقة بقيمة' : 'Deal won with value'} ${budgetVal2.toLocaleString()} EGP`,
        });
      }
      const opp = opps.find(o => o.id === oppId);
      if (opp && (opp.contacts?.department || 'sales') === 'sales' && !dealExistsForOpportunity(opp.id)) {
        const deal = await createDealFromOpportunity({ ...opp, ...result });
        setDealCreatedToast(deal.deal_number);
        setTimeout(() => setDealCreatedToast(null), 4000);
      }
    }
  };

  // Handle edit-triggered stage change to closed_lost (drawer delegates to parent for lost reason modal)
  const handleEditStageLost = (oppId, editForm) => {
    setLostReasonModal({ id: oppId, toStage: 'closed_lost', fromEdit: true, editForm });
    setLostReason('');
    setLostReasonCustom('');
  };

  // Bulk operations
  const toggleBulk = (id) => setBulkSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const bulkMoveAll = async (toStage) => {
    // Intercept closed_lost for bulk too
    if (toStage === 'closed_lost') {
      setLostReasonModal({ id: '__bulk__', toStage, bulkIds: [...bulkSelected] });
      setLostReason('');
      setLostReasonCustom('');
      return;
    }
    const ids = [...bulkSelected];
    ids.forEach(id => { const opp = opps.find(o => o.id === id); if (opp && opp.stage !== toStage) addStageHistory(id, opp.stage, toStage); });
    setOpps(p => p.map(o => ids.includes(o.id) ? { ...o, stage: toStage, stage_changed_at: new Date().toISOString() } : o));
    showBulkToast(isRTL ? `تم نقل ${ids.length} فرصة` : `${ids.length} opportunities moved`);
    setBulkSelected(new Set()); setBulkMode(false);
    await Promise.all(ids.map(id => updateOpportunity(id, { stage: toStage, stage_changed_at: new Date().toISOString() }).catch(() => {})));
  };
  const bulkAssign = async (agentId) => {
    const ids = [...bulkSelected];
    const agent = agents.find(a => a.id === agentId);
    logAction({ action: 'bulk_reassign', entity: 'opportunity', entityId: ids.join(','), entityName: `${ids.length} opportunities`, description: isRTL ? 'إعادة تعيين جماعي' : 'Bulk reassign', newValue: agent?.full_name_ar || agent?.full_name_en || agentId, userName: profile?.full_name_ar || profile?.full_name_en || '' });
    setOpps(p => p.map(o => ids.includes(o.id) ? { ...o, assigned_to: agentId, assigned_by: profile?.id || null, users: agent || o.users } : o));
    showBulkToast(isRTL ? `تم تعيين ${ids.length} فرصة` : `${ids.length} opportunities assigned`);
    setBulkSelected(new Set()); setBulkMode(false);
    await Promise.all(ids.map(id => updateOpportunity(id, { assigned_to: agentId, assigned_by: profile?.id || null }).catch(() => {})));
  };
  const bulkDeleteAll = async () => {
    const ids = [...bulkSelected];
    logAction({ action: 'bulk_delete', entity: 'opportunity', entityId: ids.join(','), entityName: `${ids.length} opportunities`, description: isRTL ? 'حذف جماعي' : 'Bulk delete', userName: profile?.full_name_ar || profile?.full_name_en || '' });
    setOpps(p => p.filter(o => !ids.includes(o.id)));
    showBulkToast(isRTL ? `تم حذف ${ids.length} فرصة` : `${ids.length} opportunities deleted`);
    setBulkSelected(new Set()); setBulkMode(false);
    await Promise.all(ids.map(id => deleteOpportunity(id).catch(() => {})));
  };
  const bulkChangeTemp = async (temp) => {
    const ids = [...bulkSelected];
    setOpps(p => p.map(o => ids.includes(o.id) ? { ...o, temperature: temp } : o));
    showBulkToast(isRTL ? `تم تحديث ${ids.length} فرصة` : `${ids.length} opportunities updated`);
    setBulkSelected(new Set()); setBulkMode(false);
    await Promise.all(ids.map(id => updateOpportunity(id, { temperature: temp }).catch(() => {})));
  };
  const bulkChangePriority = async (priority) => {
    const ids = [...bulkSelected];
    setOpps(p => p.map(o => ids.includes(o.id) ? { ...o, priority } : o));
    showBulkToast(isRTL ? `تم تحديث ${ids.length} فرصة` : `${ids.length} opportunities updated`);
    setBulkSelected(new Set()); setBulkMode(false);
    await Promise.all(ids.map(id => updateOpportunity(id, { priority }).catch(() => {})));
  };
  const bulkSetCloseDate = async (date) => {
    const ids = [...bulkSelected];
    setOpps(p => p.map(o => ids.includes(o.id) ? { ...o, expected_close_date: date } : o));
    showBulkToast(isRTL ? `تم تحديث ${ids.length} فرصة` : `${ids.length} opportunities updated`);
    setBulkSelected(new Set()); setBulkMode(false);
    await Promise.all(ids.map(id => updateOpportunity(id, { expected_close_date: date || null }).catch(() => {})));
  };

  const showBulkToast = (msg) => { setBulkToast(msg); setTimeout(() => setBulkToast(null), 3000); };

  // Animate floating bulk bar
  useEffect(() => {
    if (bulkSelected.size > 0 && viewMode === 'table') {
      const t = setTimeout(() => setBulkBarVisible(true), 10);
      return () => clearTimeout(t);
    } else {
      setBulkBarVisible(false);
    }
  }, [bulkSelected.size, viewMode]);

  // Bulk CSV export
  const bulkExportCSV = useCallback(() => {
    const selectedOpps = sortedFiltered.filter(o => bulkSelected.has(o.id));
    if (!selectedOpps.length) return;
    const headers = [
      isRTL ? 'الاسم' : 'Name',
      isRTL ? 'المشروع' : 'Project',
      isRTL ? 'المرحلة' : 'Stage',
      isRTL ? 'الميزانية' : 'Budget',
      isRTL ? 'الحرارة' : 'Temperature',
      isRTL ? 'الأولوية' : 'Priority',
      isRTL ? 'المسؤول' : 'Agent',
      isRTL ? 'النقاط' : 'Score',
      isRTL ? 'التاريخ' : 'Created',
    ];
    const rows = selectedOpps.map(o => [
      getContactName(o),
      getProjectName(o, lang),
      deptStageLabel(o.stage, o.contacts?.department || 'sales', isRTL),
      o.budget || 0,
      isRTL ? (TEMP_CONFIG[o.temperature]?.label_ar || '') : (TEMP_CONFIG[o.temperature]?.label_en || ''),
      isRTL ? (PRIORITY_CONFIG[o.priority]?.label_ar || '') : (PRIORITY_CONFIG[o.priority]?.label_en || ''),
      getAgentName(o, lang),
      scoreMap[o.id] ?? calcLeadScore(o),
      o.created_at?.slice(0, 10) || '',
    ]);
    const csvContent = '\uFEFF' + [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `opportunities_export_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showBulkToast(isRTL ? `تم تصدير ${selectedOpps.length} فرصة` : `${selectedOpps.length} opportunities exported`);
  }, [bulkSelected, sortedFiltered, isRTL, lang, scoreMap]);

  // Duplicate detection (memoized Set)
  const duplicateContactIds = useMemo(() => {
    const counts = {};
    opps.forEach(o => { if (o.contact_id) counts[o.contact_id] = (counts[o.contact_id] || 0) + 1; });
    return new Set(Object.keys(counts).filter(k => counts[k] > 1));
  }, [opps]);
  const isDuplicate = (contactId) => duplicateContactIds.has(String(contactId));

  // Memoize stage tab counts — uses filtered (before stage tab filter) excluding activeStage
  const stageCounts = useMemo(() => {
    // Re-apply smartFilters + search but NOT activeStage to get per-stage counts
    let base = applySmartFilters(normalizedOpps, smartFilters, SMART_FIELDS);
    base = applyAuditFilters(base, smartFilters);
    if (search) {
      const q = search.toLowerCase();
      base = base.filter(o => {
        const name = getContactName(o).toLowerCase();
        const project = getProjectName(o, lang).toLowerCase();
        const phone = (o.contacts?.phone || '').toLowerCase();
        const email = (o.contacts?.email || '').toLowerCase();
        return name.includes(q) || project.includes(q) || phone.includes(q) || email.includes(q);
      });
    }
    const counts = { _total: base.length };
    base.forEach(o => { counts[o.stage] = (counts[o.stage] || 0) + 1; });
    return counts;
  }, [normalizedOpps, smartFilters, SMART_FIELDS, search, lang]);

  if (loading) return <PageSkeleton hasKpis kpiCount={6} tableRows={6} tableCols={5} />;

  return (<>
    <div dir={isRTL ? 'rtl' : 'ltr'} className="min-h-screen bg-surface-bg dark:bg-surface-bg-dark font-cairo px-4 py-4 md:px-7 md:py-6 pb-10">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <div className="w-10 h-10 rounded-xl bg-brand-500/[0.12] flex items-center justify-center">
              <Grid3X3 size={20} className="text-brand-500" />
            </div>
            <h1 className="m-0 text-xl font-bold text-content dark:text-content-dark">
              {isRTL ? 'الفرص' : 'Opportunities'}
            </h1>
          </div>
          <p className="m-0 text-xs text-content-muted dark:text-content-muted-dark">
            {isRTL ? 'إدارة وتتبع الفرص لكل الأقسام' : 'Manage and track opportunities across departments'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => loadData(true)} disabled={refreshing} title={isRTL ? 'تحديث' : 'Refresh'}>
            <RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} />
          </Button>
          <ExportButton data={exportData} filename="opportunities" title={isRTL ? 'الفرص' : 'Opportunities'} />
          <Button variant="ghost" size="sm" onClick={() => {
            const report = generateOpportunitiesReport(sortedFiltered, {
              stage: activeStage !== 'all' ? activeStage : null,
            }, isRTL);
            exportToPrintableHTML(report.title, report.sections, report.options);
          }} title={isRTL ? 'طباعة / PDF' : 'Print / PDF'}>
            <Printer size={15} />
          </Button>
          <Button size="sm" onClick={() => setShowModal(true)}>
            <Plus size={15} />{isRTL ? 'إضافة فرصة' : 'Add Opportunity'}
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="flex gap-3 mb-5 flex-wrap">
        {[
          { label: isRTL ? 'إجمالي الفرص' : 'Total', value: filtered.length, color: '#4A7AAB', icon: Grid3X3, onClick: () => { setSmartFilters([]); setActiveStage('all'); } },
          { label: isRTL ? 'الميزانيات' : 'Budget', value: fmtBudget(totalBudget) + (isRTL ? ' ج' : ' EGP'), color: '#4A7AAB', icon: Banknote },
          { label: isRTL ? 'صفقات مغلقة' : 'Won', value: wonCount, color: '#10B981', icon: Building2, onClick: () => setActiveStage('closed_won') },
          { label: isRTL ? 'فرص ساخنة' : 'Hot', value: hotCount, color: '#EF4444', icon: Flame, onClick: () => setSmartFilters([{ field: 'temperature', operator: 'is', value: 'hot' }]) },
          { label: isRTL ? 'التوقع المرجح' : 'Forecast', value: fmtBudget(weightedForecast) + (isRTL ? ' ج' : ' EGP'), color: '#8B5CF6', icon: TrendingUp, title: isRTL ? 'الإيراد المتوقع (الميزانية × نسبة الفوز)' : 'Weighted revenue (budget × win rate)' },
          { label: isRTL ? 'متوسط الصفقة' : 'Avg Deal', value: fmtBudget(avgDealSize) + (isRTL ? ' ج' : ' EGP'), color: '#6B8DB5', icon: Banknote, title: isRTL ? 'متوسط حجم الصفقة المغلقة' : 'Average closed deal size' },
          { label: isRTL ? 'وقت الإغلاق' : 'Close Time', value: avgCloseTime + (isRTL ? ' يوم' : 'd'), color: avgCloseTime > 30 ? '#EF4444' : avgCloseTime > 14 ? '#F59E0B' : '#10B981', icon: Timer, title: isRTL ? 'متوسط أيام الإغلاق' : 'Avg days to close' },
          { label: isRTL ? 'التحويل' : 'Conv.', value: conversionRate + '%', color: '#6B8DB5', icon: Zap },
          { label: isRTL ? 'فرص قريبة' : 'Quick Wins', value: quickWins.length, color: '#8B5CF6', icon: Star, onClick: quickWins.length > 0 ? () => setSmartFilters([{ field: 'temperature', operator: 'is', value: 'hot' }]) : undefined, title: isRTL ? 'فرص ساخنة قريبة من الإغلاق' : 'Hot opps near closing' },
        ].map((s, i) => (
          <div key={i} className={`${isMobile ? 'flex-[1_1_calc(50%-6px)]' : 'flex-[1_1_120px]'} ${s.onClick ? 'cursor-pointer' : ''}`} onClick={s.onClick} title={s.title || ''}>
            <KpiCard icon={s.icon} label={s.label} value={s.value} color={s.color} />
          </div>
        ))}
      </div>

      {/* Win/Loss Analysis */}
      {Object.keys(lostReasonCounts).length > 0 && (
        <div className="mb-4 p-3 px-4 rounded-xl bg-red-500/[0.05] dark:bg-red-500/[0.08] border border-red-500/10 flex items-center gap-4 flex-wrap text-xs">
          <span className="font-bold text-red-500 flex items-center gap-1.5">
            <AlertTriangle size={13} />
            {isRTL ? 'تحليل الخسائر' : 'Loss Analysis'}
          </span>
          {Object.entries(lostReasonCounts).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([reason, count]) => (
            <span key={reason} className="px-2 py-1 rounded-md bg-white dark:bg-surface-card-dark text-content-muted dark:text-content-muted-dark font-semibold">
              {lostReasonsMap[reason] ? (isRTL ? lostReasonsMap[reason].label_ar : lostReasonsMap[reason].label_en) : reason} <span className="text-red-500">({count})</span>
            </span>
          ))}
          <span className="text-content-muted dark:text-content-muted-dark ms-auto">
            {isRTL ? `الأكثر: ${topLostReason ? (lostReasonsMap[topLostReason[0]]?.label_ar || topLostReason[0]) : ''}` : `Top: ${topLostReason ? (lostReasonsMap[topLostReason[0]]?.label_en || topLostReason[0]) : ''}`}
          </span>
        </div>
      )}

      {/* Conversion Funnel */}
      <div className="mb-4">
        <button
          onClick={() => setShowFunnel(f => !f)}
          className="flex items-center gap-2 px-3.5 py-2 rounded-xl border border-edge dark:border-edge-dark bg-surface-card dark:bg-surface-card-dark cursor-pointer font-cairo text-xs font-semibold text-content dark:text-content-dark w-full"
          style={{ direction: isRTL ? 'rtl' : 'ltr' }}
        >
          <TrendingUp size={14} className="text-brand-500" />
          {isRTL ? 'قمع التحويل' : 'Conversion Funnel'}
          {showFunnel ? <ChevronUp size={14} className="ms-auto text-content-muted dark:text-content-muted-dark" /> : <ChevronDown size={14} className="ms-auto text-content-muted dark:text-content-muted-dark" />}
          <span className="text-[10px] font-normal text-content-muted dark:text-content-muted-dark">
            {isRTL ? `${sortedFiltered.length} فرصة` : `${sortedFiltered.length} opps`}
          </span>
        </button>
        {showFunnel && (
          <Card className="mt-2 p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[11px] font-bold text-content-muted dark:text-content-muted-dark">
                {isRTL ? `الإجمالي: ${sortedFiltered.length}` : `Total: ${sortedFiltered.length}`}
              </span>
              <span className="text-[11px] font-bold" style={{ color: '#10B981' }}>
                {isRTL ? `مغلق: ${sortedFiltered.filter(o => o.stage === 'closed_won').length}` : `Won: ${sortedFiltered.filter(o => o.stage === 'closed_won').length}`}
              </span>
            </div>
            <div className="space-y-1.5">
              {funnelData.map((stage, i) => (
                <div key={stage.id} className="flex items-center gap-2" style={{ direction: isRTL ? 'rtl' : 'ltr' }}>
                  <span className="text-[10px] font-semibold text-content dark:text-content-dark w-[90px] truncate" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                    {isRTL ? stage.label_ar : stage.label_en}
                  </span>
                  <div className="flex-1 h-[22px] rounded-md overflow-hidden" style={{ background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)' }}>
                    <div
                      className="h-full rounded-md flex items-center justify-end px-2 transition-all duration-300"
                      style={{ width: `${stage.width}%`, background: stage.color, minWidth: stage.count > 0 ? 32 : 0 }}
                    >
                      {stage.count > 0 && (
                        <span className="text-[10px] font-bold text-white">{stage.count}</span>
                      )}
                    </div>
                  </div>
                  <span className="text-[10px] w-[48px] text-content-muted dark:text-content-muted-dark" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                    {stage.count > 0 ? stage.count : '—'}
                  </span>
                  {stage.dropOff !== null && (
                    <span className={`text-[9px] font-bold w-[40px] ${stage.dropOff < 0 ? 'text-red-500' : stage.dropOff > 0 ? 'text-green-500' : 'text-content-muted dark:text-content-muted-dark'}`} style={{ textAlign: isRTL ? 'right' : 'left' }}>
                      {stage.dropOff > 0 ? '+' : ''}{stage.dropOff}%
                    </span>
                  )}
                  {stage.dropOff === null && <span className="w-[40px]" />}
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>

      {/* Stage Tabs */}
      <Card className="p-2.5 px-3.5 mb-4 flex gap-1.5 overflow-x-auto scrollbar-hide">
        {stageConfigWithAll.map(s => {
          const count = s.id === 'all' ? stageCounts._total : (stageCounts[s.id] || 0);
          const active = activeStage === s.id;
          return (
            <button
              key={s.id}
              onClick={() => setActiveStage(s.id)}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg border-none cursor-pointer font-cairo text-xs whitespace-nowrap transition-all duration-150 ${
                active ? 'font-bold text-white' : 'font-medium text-content-muted dark:text-content-muted-dark bg-transparent'
              }`}
              style={active ? { background: s.color } : {}}
            >
              {isRTL ? s.label_ar : s.label_en}
              <span
                className={`text-[10px] font-bold rounded-full px-1.5 py-px ${
                  active ? 'bg-white/25 text-white' : 'bg-gray-100 dark:bg-brand-500/15 text-content-muted dark:text-content-muted-dark'
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </Card>

      {/* Filters */}
      <SmartFilter
        fields={SMART_FIELDS}
        filters={smartFilters}
        onFiltersChange={(f) => { setSmartFilters(f); setActiveStage('all'); }}
        search={searchInput}
        onSearchChange={setSearchInput}
        searchPlaceholder={isRTL ? 'بحث بالاسم، المشروع، الهاتف...' : 'Search name, project, phone...'}
        sortOptions={SMART_SORT_OPTIONS}
        sortBy={sortBy}
        onSortChange={setSortBy}
        resultsCount={filtered.length}
        extraActions={<>
          {/* Save / Load Filters */}
          <div className="relative" ref={savedFilterRef}>
            <Button variant="ghost" size="sm" onClick={() => setShowSaveFilter(s => !s)} title={isRTL ? 'حفظ / تحميل فلتر' : 'Save / Load Filter'}>
              <Bookmark size={14} />
            </Button>
            {showSaveFilter && (
              <div className="absolute top-full mt-1 bg-surface-card dark:bg-surface-input-dark border border-edge dark:border-edge-dark rounded-xl shadow-lg z-50 p-3 w-[220px]" style={{ [isRTL ? 'right' : 'left']: 0 }}>
                <div className="flex gap-1.5 mb-2">
                  <Input value={filterName} onChange={e => setFilterName(e.target.value)} placeholder={isRTL ? 'اسم الفلتر...' : 'Filter name...'} className="text-xs flex-1" />
                  <Button size="sm" onClick={() => {
                    if (!filterName.trim()) return;
                    const f = { name: filterName, search: searchInput, smartFilters, sortBy, activeStage };
                    const all = [...savedFilters, f];
                    saveSavedFilters(all); setSavedFilters(all); setFilterName('');
                  }}>{isRTL ? 'حفظ' : 'Save'}</Button>
                </div>
                {savedFilters.length > 0 && (
                  <div className="border-t border-edge dark:border-edge-dark pt-2 max-h-[150px] overflow-y-auto">
                    {savedFilters.map((f, i) => (
                      <div key={i} className="flex items-center justify-between py-1.5 hover:bg-gray-50 dark:hover:bg-white/5 px-1.5 rounded-md transition-colors">
                        <button onClick={() => {
                          setSearchInput(f.search || ''); setSearch(f.search || '');
                          setSmartFilters(f.smartFilters || []); setSortBy(f.sortBy || 'newest');
                          setActiveStage(f.activeStage || 'all'); setShowSaveFilter(false);
                        }} className="bg-transparent border-none cursor-pointer text-xs text-content dark:text-content-dark font-semibold font-cairo truncate flex-1 text-start">{f.name}</button>
                        <button onClick={() => {
                          const all = savedFilters.filter((_, j) => j !== i);
                          saveSavedFilters(all); setSavedFilters(all);
                        }} className="bg-transparent border-none cursor-pointer text-red-400 p-0.5 shrink-0"><X size={11} /></button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
          <Button
            variant={bulkMode ? 'primary' : 'ghost'}
            size="sm"
            onClick={() => { setBulkMode(m => !m); setBulkSelected(new Set()); }}
            title={isRTL ? 'تحديد متعدد' : 'Bulk Select'}
          >
            <CheckSquare size={14} />
          </Button>
          <div className="flex rounded-lg border border-edge dark:border-edge-dark overflow-hidden">
            <button onClick={() => setViewMode('table')} className={`p-1.5 border-none cursor-pointer transition-colors ${viewMode === 'table' ? 'bg-brand-500 text-white' : 'bg-surface-card dark:bg-surface-card-dark text-content-muted dark:text-content-muted-dark'}`}><List size={14} /></button>
            <button onClick={() => { setViewMode('kanban'); setActiveStage('all'); }} className={`p-1.5 border-none cursor-pointer transition-colors ${viewMode === 'kanban' ? 'bg-brand-500 text-white' : 'bg-surface-card dark:bg-surface-card-dark text-content-muted dark:text-content-muted-dark'}`}><Columns size={14} /></button>
          </div>
        </>}
      />

      {/* Old bulk bar removed — replaced by floating action bar below */}

      {/* Content */}
      {loading ? (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="p-4 h-[180px]">
              <div className="flex gap-2.5 mb-3">
                <div className="w-[38px] h-[38px] rounded-full bg-gray-100 dark:bg-white/5 animate-pulse" />
                <div className="flex-1">
                  <div className="h-3.5 rounded-md w-[70%] mb-1.5 bg-gray-100 dark:bg-white/5 animate-pulse" />
                  <div className="h-2.5 rounded-md w-[40%] bg-gray-100 dark:bg-white/5" />
                </div>
              </div>
              <div className="h-3 rounded-md w-1/2 mb-2.5 bg-gray-100 dark:bg-white/5" />
              <div className="flex gap-1.5">
                {[1, 2, 3].map(j => <div key={j} className="h-6 rounded-md flex-1 bg-gray-100 dark:bg-white/5" />)}
              </div>
            </Card>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 px-5">
          <div className="w-16 h-16 rounded-2xl bg-brand-500/10 flex items-center justify-center mx-auto mb-4">
            {opps.length > 0 ? <Search size={24} className="text-brand-500" /> : <TrendingUp size={24} className="text-brand-500" />}
          </div>
          <p className="m-0 mb-1.5 text-sm font-bold text-content dark:text-content-dark">
            {opps.length > 0
              ? (isRTL ? 'لا توجد نتائج للفلاتر الحالية' : 'No results match your filters')
              : (isRTL ? 'لا توجد فرص بيع' : 'No Opportunities Found')}
          </p>
          <p className="m-0 mb-4 text-sm text-content-muted dark:text-content-muted-dark">
            {opps.length > 0
              ? (isRTL ? 'جرب تعديل البحث أو الفلاتر' : 'Try adjusting your search or filters')
              : (isRTL ? 'لم يتم إضافة أي فرص بيع بعد' : 'No sales opportunities have been added yet')}
          </p>
          {opps.length > 0 ? (
            <Button variant="secondary" size="sm" onClick={() => { setSearchInput(''); setSearch(''); setSmartFilters([]); setActiveStage('all'); setSortBy('newest'); }}>
              <X size={14} /> {isRTL ? 'مسح كل الفلاتر' : 'Clear All Filters'}
            </Button>
          ) : (
            <Button size="sm" onClick={() => setShowModal(true)}>
              <Plus size={14} /> {isRTL ? 'إضافة فرصة' : 'Add Opportunity'}
            </Button>
          )}
        </div>
      ) : viewMode === 'kanban' ? (<>
        <div className="flex items-center gap-3 mb-3 px-1 text-xs text-content-muted dark:text-content-muted-dark">
          <span className="font-semibold">{sortedFiltered.length} {isRTL ? 'فرصة' : 'opportunities'}</span>
          <span>•</span>
          <span className="font-bold text-brand-500">{fmtBudget(totalBudget)} {isRTL ? 'ج' : 'EGP'}</span>
        </div>
        <div className={isMobile ? "flex flex-col gap-4 pb-4" : "flex gap-4 overflow-x-auto pb-4"}>
          {currentStages.map(stage => {
            const stageOpps = sortedFiltered.filter(o => o.stage === stage.id);
            const isOver = dragOverStage === stage.id;
            return (
              <div key={stage.id} className={isMobile ? "w-full" : "flex-shrink-0 w-[300px]"}
                onDragOver={e => { e.preventDefault(); setDragOverStage(stage.id); }}
                onDragLeave={() => setDragOverStage(null)}
                onDrop={e => {
                  e.preventDefault();
                  setDragOverStage(null);
                  if (draggingOpp && draggingOpp.stage !== stage.id) {
                    handleMove(draggingOpp.id, stage.id);
                  }
                  setDraggingOpp(null);
                }}
              >
                <div className="flex items-center gap-2 mb-3 px-1">
                  <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: stage.color }} />
                  <span className="text-sm font-bold text-content dark:text-content-dark">{isRTL ? stage.label_ar : stage.label_en}</span>
                  <span className="text-xs text-content-muted dark:text-content-muted-dark bg-gray-100 dark:bg-brand-500/15 rounded-full px-1.5 py-px">{stageOpps.length}</span>
                  {stageOpps.length > 0 && (<>
                    {(() => { const staleCount = stageOpps.filter(o => daysSince(o.contacts?.last_activity_at || o.updated_at || o.created_at) >= 7).length; return staleCount > 0 ? <span className="text-[10px] font-semibold text-amber-500" title={isRTL ? 'فرص راكدة' : 'Stale opps'}>⚠ {staleCount}</span> : null; })()}
                    <span className="text-[10px] font-bold text-brand-500 ms-auto">{fmtBudget(stageOpps.reduce((s, o) => s + (o.budget || 0), 0))}</span>
                  </>)}
                </div>
                <div className={`flex flex-col gap-3 min-h-[200px] rounded-xl p-2.5 border border-dashed transition-colors duration-200 ${
                  isOver ? 'bg-brand-500/10 border-brand-500' : 'bg-brand-500/[0.03] dark:bg-brand-500/[0.04] border-edge dark:border-edge-dark'
                }`}>
                  {stageOpps.length === 0 ? (
                    <div className="text-center py-8">
                      <div className="w-10 h-10 rounded-xl bg-brand-500/[0.08] flex items-center justify-center mx-auto mb-2">
                        <Grid3X3 size={16} className="text-brand-500 opacity-40" />
                      </div>
                      <p className="text-xs text-content-muted dark:text-content-muted-dark opacity-50 mb-2">{isRTL ? 'اسحب فرصة هنا' : 'Drop here'}</p>
                      <button onClick={() => setShowModal(true)} className="text-[10px] text-brand-500 bg-brand-500/10 border-none rounded-md px-2.5 py-1.5 cursor-pointer hover:bg-brand-500/20 transition-colors font-cairo">
                        <Plus size={10} className="inline -mt-px" /> {isRTL ? 'إضافة' : 'Add'}
                      </button>
                    </div>
                  ) : stageOpps.map(opp => (
                    <div key={opp.id} className="relative"
                      draggable
                      onDragStart={() => setDraggingOpp(opp)}
                      onDragEnd={() => { setDraggingOpp(null); setDragOverStage(null); }}
                    >
                      {bulkMode && (
                        <button
                          onClick={e => { e.stopPropagation(); toggleBulk(opp.id); }}
                          className={`absolute top-2 ${isRTL ? 'left-2' : 'right-2'} z-10 w-5 h-5 rounded border-2 flex items-center justify-center text-[10px] cursor-pointer transition-colors ${
                            bulkSelected.has(opp.id)
                              ? 'bg-brand-500 border-brand-500 text-white'
                              : 'bg-white dark:bg-surface-card-dark border-gray-300 dark:border-gray-600'
                          }`}
                        >
                          {bulkSelected.has(opp.id) && '✓'}
                        </button>
                      )}
                      <OppCard opp={opp} isRTL={isRTL} lang={lang} onDelete={handleDelete} onMove={handleMove} onSelect={bulkMode ? () => toggleBulk(opp.id) : selectOpp} stageConfig={currentStages} score={scoreMap[opp.id]} isAdmin={isAdmin} sourceLabelsMap={sourceLabelsMap} />
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </>) : (<>
        {/* Table View - Mobile Card Layout */}
        {isMobile && (
          <div className="flex flex-col gap-3 md:hidden">
            {gridPaged.length === 0 ? (
              <Card className="text-center py-10 text-xs text-content-muted dark:text-content-muted-dark">
                {isRTL ? 'لا توجد نتائج' : 'No results'}
              </Card>
            ) : gridPaged.map(opp => {
              const contactName = getContactName(opp);
              const projectName = getProjectName(opp, lang);
              const stageConfig = getDeptStages(opp.contacts?.department || 'sales');
              const stage = stageConfig.find(s => s.id === opp.stage) || stageConfig[0] || { id: opp.stage, label_ar: opp.stage, label_en: opp.stage, color: '#4A7AAB' };
              const temp = TEMP_CONFIG[opp.temperature] || TEMP_CONFIG.cold;
              const score = scoreMap[opp.id] ?? calcLeadScore(opp);
              return (
                <Card key={opp.id} className="p-3.5 cursor-pointer active:bg-brand-500/[0.04]" onClick={() => selectOpp(opp)}>
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-9 h-9 rounded-full shrink-0 flex items-center justify-center text-[10px] font-bold text-white" style={{ background: avatarColor(opp.contact_id || opp.id) }}>
                      {initials(contactName)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-content dark:text-content-dark truncate">{contactName}</div>
                      {projectName && <div className="text-[11px] text-content-muted dark:text-content-muted-dark truncate">{projectName}</div>}
                    </div>
                    {bulkMode && (
                      <button onClick={e => { e.stopPropagation(); toggleBulk(opp.id); }} className={`w-5 h-5 rounded border-2 flex items-center justify-center text-[10px] cursor-pointer shrink-0 ${bulkSelected.has(opp.id) ? 'bg-brand-500 border-brand-500 text-white' : 'bg-white dark:bg-surface-card-dark border-gray-300 dark:border-gray-600'}`}>
                        {bulkSelected.has(opp.id) && '✓'}
                      </button>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full text-white" style={{ background: stage.color }}>{isRTL ? stage.label_ar : stage.label_en}</span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: temp.bg, color: temp.color }}>{isRTL ? temp.label_ar : temp.label_en}</span>
                    {opp.budget > 0 && <span className="text-[11px] font-bold text-brand-500">{fmtBudget(opp.budget)} {isRTL ? 'ج' : 'EGP'}</span>}
                    <span className="text-[10px] ms-auto" style={{ color: scoreColor(score) }}>{score} pts</span>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
        {/* Table View - Desktop */}
        <Card className={`overflow-hidden ${isMobile ? 'hidden' : ''}`}>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm" style={{ minWidth: 1100 }}>
              <thead>
                <tr className="border-b border-edge dark:border-edge-dark bg-[#F8FAFC] dark:bg-surface-bg-dark">
                  <th className="px-3 py-3 text-start w-10">
                    <button
                      onClick={() => {
                        const allIds = new Set(gridPaged.map(o => o.id));
                        const allSelected = gridPaged.length > 0 && gridPaged.every(o => bulkSelected.has(o.id));
                        setBulkSelected(allSelected ? new Set([...bulkSelected].filter(id => !allIds.has(id))) : new Set([...bulkSelected, ...allIds]));
                      }}
                      className="bg-transparent border-none cursor-pointer p-0 flex items-center justify-center"
                    >
                      {gridPaged.length > 0 && gridPaged.every(o => bulkSelected.has(o.id))
                        ? <CheckSquare size={18} style={{ color: '#4A7AAB' }} />
                        : <Square size={18} className="text-content-muted dark:text-content-muted-dark" />
                      }
                    </button>
                  </th>
                  {[
                    { key: 'name', label: isRTL ? 'الاسم' : 'Name', width: 'min-w-[180px]' },
                    { key: 'project', label: isRTL ? 'المشروع' : 'Project', width: 'min-w-[120px]' },
                    { key: 'stage', label: isRTL ? 'المرحلة' : 'Stage', width: 'min-w-[110px]' },
                    { key: 'budget', label: isRTL ? 'الميزانية' : 'Budget', width: 'min-w-[90px]' },
                    { key: 'temp', label: isRTL ? 'الحرارة' : 'Temp', width: 'min-w-[70px]' },
                    { key: 'priority', label: isRTL ? 'الأولوية' : 'Priority', width: 'min-w-[80px]' },
                    { key: 'agent', label: isRTL ? 'المسؤول' : 'Agent', width: 'min-w-[110px]' },
                    { key: 'score', label: isRTL ? 'النقاط' : 'Score', width: 'min-w-[60px]' },
                    { key: 'days', label: isRTL ? 'أيام' : 'Days', width: 'min-w-[55px]' },
                    { key: 'close', label: isRTL ? 'الإغلاق' : 'Close', width: 'min-w-[85px]' },
                    { key: 'actions', label: '', width: 'w-10' },
                  ].map(col => (
                    <th key={col.key} className={`px-3 py-3 text-start text-xs font-semibold text-content-muted dark:text-content-muted-dark ${col.width}`}>
                      {col.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {gridPaged.map((opp, idx) => {
                  const contactName = getContactName(opp);
                  const projectName = getProjectName(opp, lang);
                  const agentName = getAgentName(opp, lang);
                  const stageConfig = getDeptStages(opp.contacts?.department || 'sales');
                  const stage = stageConfig.find(s => s.id === opp.stage) || stageConfig[0] || { id: opp.stage, label_ar: opp.stage, label_en: opp.stage, color: '#4A7AAB' };
                  const temp = TEMP_CONFIG[opp.temperature] || TEMP_CONFIG.cold;
                  const prio = PRIORITY_CONFIG[opp.priority] || PRIORITY_CONFIG.medium;
                  const score = scoreMap[opp.id] ?? calcLeadScore(opp);
                  const days = daysInStage(opp);
                  const closeDate = opp.expected_close_date;
                  const closeDiff = closeDate ? Math.ceil((new Date(closeDate) - Date.now()) / 86400000) : null;
                  const duplicate = isDuplicate(opp.contact_id);
                  const staledays = daysSince(opp.contacts?.last_activity_at || opp.updated_at || opp.created_at);
                  const isQuickWin = quickWins.some(q => q.id === opp.id);

                  return (
                    <tr
                      key={opp.id}
                      onClick={() => selectOpp(opp)}
                      className={`border-b border-edge dark:border-edge-dark cursor-pointer transition-colors hover:bg-brand-500/[0.04] dark:hover:bg-brand-500/[0.06] ${
                        bulkSelected.has(opp.id) ? 'bg-brand-500/[0.06] dark:bg-brand-500/[0.08]' : ''
                      } ${idx % 2 === 0 ? '' : 'bg-gray-50/50 dark:bg-white/[0.015]'}`}
                    >
                      <td className="px-3 py-2.5">
                        <button
                          onClick={e => { e.stopPropagation(); toggleBulk(opp.id); }}
                          className="bg-transparent border-none cursor-pointer p-0 flex items-center justify-center"
                        >
                          {bulkSelected.has(opp.id)
                            ? <CheckSquare size={18} style={{ color: '#4A7AAB' }} />
                            : <Square size={18} className="text-content-muted dark:text-content-muted-dark" />
                          }
                        </button>
                      </td>
                      {/* Name */}
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-2.5">
                          <div
                            className="w-8 h-8 rounded-full shrink-0 flex items-center justify-center text-[10px] font-bold text-white"
                            style={{ background: avatarColor(opp.contact_id || opp.id) }}
                          >
                            {initials(contactName)}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="text-sm font-semibold text-content dark:text-content-dark truncate">{contactName}</span>
                              {duplicate && <AlertTriangle size={11} className="text-amber-500 shrink-0" title={isRTL ? 'مكرر' : 'Duplicate'} />}
                              {isQuickWin && (
                                <span className="text-[9px] px-1 py-px rounded bg-purple-500/10 text-purple-500 font-bold shrink-0" title={isRTL ? 'فرصة قريبة من الإغلاق' : 'Quick Win'}>
                                  <Star size={8} className="inline -mt-px" /> {isRTL ? 'قريبة' : 'Win'}
                                </span>
                              )}
                              {staledays >= 7 && opp.stage !== 'closed_won' && opp.stage !== 'closed_lost' && (
                                <span className={`text-[9px] px-1 py-px rounded ${staledays >= 14 ? 'bg-red-500/10 text-red-500' : 'bg-amber-500/10 text-amber-500'}`} title={isRTL ? `${staledays} يوم بدون نشاط` : `${staledays}d inactive`}>
                                  {staledays}{isRTL ? 'ي' : 'd'}
                                </span>
                              )}
                              {(() => { const apr = getApprovalByEntity('deal', opp.id); return apr && apr.status === 'pending' ? (
                                <span className="text-[9px] px-1.5 py-px rounded bg-amber-500/10 text-amber-600 font-bold shrink-0" title={isRTL ? 'بانتظار الموافقة' : 'Pending Approval'}>
                                  {isRTL ? 'موافقة' : 'Approval'}
                                </span>
                              ) : null; })()}
                            </div>
                            {opp.contacts?.phone && (
                              <div className="text-[11px] text-content-muted dark:text-content-muted-dark" dir="ltr">{opp.contacts.phone}</div>
                            )}
                          </div>
                        </div>
                      </td>
                      {/* Project */}
                      <td className="px-3 py-2.5">
                        {projectName ? (
                          <span className="text-xs text-content dark:text-content-dark truncate block max-w-[140px]">{projectName}</span>
                        ) : (
                          <span className="text-xs text-content-muted dark:text-content-muted-dark">—</span>
                        )}
                      </td>
                      {/* Stage */}
                      <td className="px-3 py-2.5">
                        <span
                          className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-md"
                          style={{ background: `${stage.color}18`, color: stage.color }}
                        >
                          <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: stage.color }} />
                          {isRTL ? stage.label_ar : stage.label_en}
                        </span>
                      </td>
                      {/* Budget */}
                      <td className="px-3 py-2.5">
                        <span className="text-xs font-bold text-content dark:text-content-dark">
                          {fmtBudget(opp.budget)}
                        </span>
                      </td>
                      {/* Temperature */}
                      <td className="px-3 py-2.5">
                        <span
                          className="text-[11px] font-semibold px-2 py-0.5 rounded-md"
                          style={{ background: temp.bg, color: temp.color }}
                        >
                          {isRTL ? temp.label_ar : temp.label_en}
                        </span>
                      </td>
                      {/* Priority */}
                      <td className="px-3 py-2.5">
                        <span
                          className="text-[11px] font-semibold px-2 py-0.5 rounded-md"
                          style={{ background: `${prio.color}18`, color: prio.color }}
                        >
                          {isRTL ? prio.label_ar : prio.label_en}
                        </span>
                      </td>
                      {/* Agent */}
                      <td className="px-3 py-2.5">
                        <span className="text-xs text-content dark:text-content-dark truncate block max-w-[120px]">{agentName}</span>
                      </td>
                      {/* Lead Score */}
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-1.5">
                          <div className="w-8 h-1.5 bg-gray-200 dark:bg-white/10 rounded-full overflow-hidden">
                            <div className="h-full rounded-full" style={{ width: `${score}%`, background: scoreColor(score) }} />
                          </div>
                          <span className="text-[11px] font-bold" style={{ color: scoreColor(score) }}>{score}</span>
                        </div>
                      </td>
                      {/* Days in stage */}
                      <td className="px-3 py-2.5">
                        <span className={`text-[11px] font-semibold ${days > 7 ? 'text-red-500' : days > 3 ? 'text-amber-500' : 'text-content-muted dark:text-content-muted-dark'}`}>
                          {days}{isRTL ? 'ي' : 'd'}
                        </span>
                      </td>
                      {/* Expected Close */}
                      <td className="px-3 py-2.5">
                        {closeDate ? (
                          <span className={`text-[11px] font-semibold ${closeDiff !== null && closeDiff < 0 ? 'text-red-500' : closeDiff !== null && closeDiff <= 7 ? 'text-amber-500' : 'text-content-muted dark:text-content-muted-dark'}`}>
                            {new Date(closeDate).toLocaleDateString(isRTL ? 'ar-EG' : 'en-US', { month: 'short', day: 'numeric' })}
                          </span>
                        ) : (
                          <span className="text-xs text-content-muted dark:text-content-muted-dark">—</span>
                        )}
                      </td>
                      {/* Actions */}
                      <td className="px-3 py-2.5">
                        <button
                          onClick={e => { e.stopPropagation(); handleDelete(opp.id); }}
                          className="bg-transparent border-none cursor-pointer text-content-muted dark:text-content-muted-dark p-1 rounded-md hover:bg-red-500/10 hover:text-red-500 transition-colors"
                        >
                          <Trash2 size={13} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {gridPaged.length === 0 && (
            <div className="text-center py-10 text-xs text-content-muted dark:text-content-muted-dark">
              {isRTL ? 'لا توجد نتائج' : 'No results'}
            </div>
          )}
        </Card>
        {/* Table Pagination */}
        <Pagination
          page={gridSafePage}
          totalPages={gridTotalPages}
          onPageChange={setGridPage}
          pageSize={pageSize}
          onPageSizeChange={(s) => { setPageSize(s); setGridPage(1); }}
          totalItems={sortedFiltered.length}
          safePage={gridSafePage}
        />
      </>)}

      {showModal && <AddModal isRTL={isRTL} lang={lang} onClose={() => setShowModal(false)} onSave={handleSave} agents={agents} projects={projects} existingOpps={opps} currentUserId={profile?.id} />}

      {/* Delete Confirmation */}
      {confirmDelete && (
        <div dir={isRTL ? 'rtl' : 'ltr'} className="fixed inset-0 bg-black/50 z-[1100] flex items-center justify-center p-5" onClick={() => setConfirmDelete(null)}>
          <div className="bg-surface-card dark:bg-surface-card-dark border border-red-500/30 rounded-2xl p-7 w-full max-w-[400px] text-center" onClick={e => e.stopPropagation()}>
            <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-4">
              <Trash2 size={20} className="text-red-500" />
            </div>
            <h3 className="m-0 mb-2 text-content dark:text-content-dark text-base font-bold">
              {isRTL ? 'حذف فرصة' : 'Delete Opportunity'} {(() => { const o = opps.find(x => x.id === confirmDelete); return o ? `"${getContactName(o)}"` : ''; })()}?
            </h3>
            <p className="m-0 mb-5 text-content-muted dark:text-content-muted-dark text-xs">{isRTL ? 'هل أنت متأكد؟ لا يمكن التراجع عن هذا الإجراء.' : 'Are you sure? This action cannot be undone.'}</p>
            <div className="flex gap-2.5 justify-center">
              <Button variant="secondary" size="sm" onClick={() => setConfirmDelete(null)}>{isRTL ? 'إلغاء' : 'Cancel'}</Button>
              <Button variant="danger" size="sm" onClick={confirmDeleteOpp}>{isRTL ? 'تأكيد الحذف' : 'Confirm Delete'}</Button>
            </div>
          </div>
        </div>
      )}
    </div>

    {/* Floating Bulk Action Bar */}
    {bulkSelected.size > 0 && viewMode === 'table' && (
      <div
        dir={isRTL ? 'rtl' : 'ltr'}
        style={{
          position: 'fixed',
          bottom: bulkBarVisible ? 24 : -80,
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 1200,
          background: 'rgba(30,30,30,0.95)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          borderRadius: 12,
          padding: '12px 20px',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          boxShadow: '0 8px 32px rgba(0,0,0,0.35)',
          transition: 'bottom 0.3s cubic-bezier(0.4,0,0.2,1)',
          flexWrap: 'wrap',
          maxWidth: 'calc(100vw - 48px)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#fff', fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap' }}>
          <CheckSquare size={16} style={{ color: '#60A5FA' }} />
          <span>{bulkSelected.size} {isRTL ? 'محدد' : 'selected'}</span>
        </div>
        <div style={{ width: 1, height: 24, background: 'rgba(255,255,255,0.15)', flexShrink: 0 }} />
        {[
          { label: isRTL ? 'نقل مرحلة' : 'Move Stage', handler: bulkMoveAll, options: currentStages.map(s => ({ value: s.id, label: isRTL ? s.label_ar : s.label_en })) },
          { label: isRTL ? 'تعيين مسؤول' : 'Assign Agent', handler: bulkAssign, options: agents.map(a => ({ value: a.id, label: lang === 'ar' ? a.full_name_ar : (a.full_name_en || a.full_name_ar) })) },
          { label: isRTL ? 'الأولوية' : 'Priority', handler: bulkChangePriority, options: Object.entries(PRIORITY_CONFIG).map(([k, v]) => ({ value: k, label: isRTL ? v.label_ar : v.label_en })) },
          { label: isRTL ? 'الحرارة' : 'Temp', handler: bulkChangeTemp, options: Object.entries(TEMP_CONFIG).map(([k, v]) => ({ value: k, label: isRTL ? v.label_ar : v.label_en })) },
        ].map((action, i) => (
          <select
            key={i}
            onChange={e => { if (e.target.value) action.handler(e.target.value); e.target.value = ''; }}
            style={{
              background: 'rgba(255,255,255,0.1)',
              border: '1px solid rgba(255,255,255,0.15)',
              borderRadius: 8,
              color: '#fff',
              fontSize: 12,
              padding: '6px 10px',
              cursor: 'pointer',
              fontFamily: 'inherit',
              minWidth: 110,
              appearance: 'none',
              WebkitAppearance: 'none',
              paddingRight: isRTL ? 10 : 24,
              paddingLeft: isRTL ? 24 : 10,
              backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='white' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`,
              backgroundRepeat: 'no-repeat',
              backgroundPosition: isRTL ? '8px center' : 'calc(100% - 8px) center',
            }}
          >
            <option value="" style={{ background: '#1e1e1e' }}>{action.label}</option>
            {action.options.map(o => <option key={o.value} value={o.value} style={{ background: '#1e1e1e' }}>{o.label}</option>)}
          </select>
        ))}
        <button
          onClick={bulkExportCSV}
          style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8, color: '#fff', fontSize: 12, padding: '6px 12px', cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.18)'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; }}
        >
          <Download size={14} />
          {isRTL ? 'تصدير' : 'Export'}
        </button>
        <button
          onClick={() => setConfirmBulkDelete(true)}
          style={{ background: 'rgba(239,68,68,0.2)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, color: '#FCA5A5', fontSize: 12, padding: '6px 12px', cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.35)'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.2)'; }}
        >
          <Trash2 size={14} />
          {isRTL ? 'حذف' : 'Delete'}
        </button>
        <button
          onClick={() => { setBulkSelected(new Set()); setBulkMode(false); }}
          style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center' }}
          onMouseEnter={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.9)'; }}
          onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.5)'; }}
        >
          <X size={16} />
        </button>
      </div>
    )}

    {/* Bulk Delete Confirmation Modal */}
    {confirmBulkDelete && (
      <div dir={isRTL ? 'rtl' : 'ltr'} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }} onClick={() => setConfirmBulkDelete(false)}>
        <div
          style={{ background: isDark ? '#1E293B' : '#fff', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 16, padding: 28, width: '100%', maxWidth: 420, textAlign: 'center' }}
          onClick={e => e.stopPropagation()}
        >
          <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'rgba(239,68,68,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <Trash2 size={20} style={{ color: '#EF4444' }} />
          </div>
          <h3 style={{ margin: '0 0 8px', color: isDark ? '#F1F5F9' : '#1E293B', fontSize: 16, fontWeight: 700 }}>
            {isRTL ? 'حذف فرص' : 'Delete Opportunities'}
          </h3>
          <p style={{ margin: '0 0 20px', color: isDark ? '#94A3B8' : '#64748B', fontSize: 13 }}>
            {isRTL
              ? `هل أنت متأكد من حذف ${bulkSelected.size} فرصة؟ لا يمكن التراجع عن هذا الإجراء.`
              : `Are you sure you want to delete ${bulkSelected.size} opportunities? This action cannot be undone.`}
          </p>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
            <Button variant="secondary" size="sm" onClick={() => setConfirmBulkDelete(false)}>
              {isRTL ? 'إلغاء' : 'Cancel'}
            </Button>
            <Button variant="danger" size="sm" onClick={() => { setConfirmBulkDelete(false); bulkDeleteAll(); }}>
              <Trash2 size={13} /> {isRTL ? 'تأكيد الحذف' : 'Confirm Delete'}
            </Button>
          </div>
        </div>
      </div>
    )}

    {/* Deal Created Toast */}
    {dealCreatedToast && (
      <div
        className="fixed bottom-6 z-[300] bg-gradient-to-br from-emerald-500 to-emerald-600 text-white px-5 py-3.5 rounded-xl shadow-lg flex items-center gap-2.5 text-sm font-semibold animate-[slideUp_0.3s_ease-out]"
        style={{ [isRTL ? 'left' : 'right']: 24 }}
      >
        <div className="w-7 h-7 rounded-lg bg-white/20 flex items-center justify-center text-sm">🎉</div>
        <div>
          <div>{isRTL ? 'تم إنشاء صفقة جديدة!' : 'Deal created!'}</div>
          <div className="text-xs opacity-85 mt-0.5">{dealCreatedToast} → {isRTL ? 'العمليات' : 'Operations'}</div>
        </div>
        <button
          onClick={() => setDealCreatedToast(null)}
          className="bg-transparent border-none text-white cursor-pointer opacity-70 p-0.5 ms-2 hover:opacity-100 transition-opacity"
        >
          ✕
        </button>
      </div>
    )}
    {/* Bulk Operation Toast */}
    {bulkToast && (
      <div
        className="fixed bottom-6 z-[300] bg-gradient-to-br from-brand-500 to-brand-600 text-white px-5 py-3 rounded-xl shadow-lg flex items-center gap-2 text-sm font-semibold animate-[slideUp_0.3s_ease-out]"
        style={{ [isRTL ? 'right' : 'left']: 24 }}
      >
        <CheckSquare size={16} />
        {bulkToast}
      </div>
    )}
    {/* Move Warning Toast */}
    {moveWarningToast && (
      <div
        className="fixed bottom-6 z-[300] bg-gradient-to-br from-amber-500 to-amber-600 text-white px-5 py-3 rounded-xl shadow-lg flex items-center gap-2 text-sm font-semibold animate-[slideUp_0.3s_ease-out]"
        style={{ [isRTL ? 'right' : 'left']: 24 }}
      >
        <AlertTriangle size={16} />
        {moveWarningToast}
      </div>
    )}


    {/* Lost Reason Modal */}
    {lostReasonModal && (
      <div dir={isRTL ? 'rtl' : 'ltr'} className="fixed inset-0 bg-black/50 z-[1100] flex items-center justify-center p-5" onClick={() => setLostReasonModal(null)}>
        <div className="bg-surface-card dark:bg-surface-card-dark border border-edge dark:border-edge-dark rounded-2xl p-7 w-full max-w-[420px]" onClick={e => e.stopPropagation()}>
          <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-4">
            <AlertTriangle size={20} className="text-red-500" />
          </div>
          <h3 className="m-0 mb-2 text-content dark:text-content-dark text-base font-bold text-center">
            {isRTL ? 'سبب الخسارة' : 'Lost Reason'}
          </h3>
          <p className="m-0 mb-4 text-content-muted dark:text-content-muted-dark text-xs text-center">
            {isRTL ? 'لماذا تم خسارة هذه الفرصة؟' : 'Why was this opportunity lost?'}
          </p>
          <div className="flex flex-wrap gap-1.5 mb-3">
            {configLostReasons.map(r => (
              <button
                key={r.key}
                onClick={() => setLostReason(r.key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold font-cairo cursor-pointer border-2 transition-all ${
                  lostReason === r.key
                    ? 'border-red-500 bg-red-500/10 text-red-500'
                    : 'border-transparent bg-surface-input dark:bg-surface-input-dark text-content-muted dark:text-content-muted-dark'
                }`}
              >
                {isRTL ? r.label_ar : r.label_en}
              </button>
            ))}
            <button
              onClick={() => setLostReason('other')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold font-cairo cursor-pointer border-2 transition-all ${
                lostReason === 'other'
                  ? 'border-red-500 bg-red-500/10 text-red-500'
                  : 'border-transparent bg-surface-input dark:bg-surface-input-dark text-content-muted dark:text-content-muted-dark'
              }`}
            >
              {isRTL ? 'أخرى' : 'Other'}
            </button>
          </div>
          {lostReason === 'other' && (
            <Input
              value={lostReasonCustom}
              onChange={e => setLostReasonCustom(e.target.value)}
              placeholder={isRTL ? 'اكتب السبب...' : 'Enter reason...'}
              className="mb-3"
            />
          )}
          <div className="flex gap-2.5 justify-center">
            <Button variant="secondary" size="sm" onClick={() => setLostReasonModal(null)}>{isRTL ? 'إلغاء' : 'Cancel'}</Button>
            <Button variant="danger" size="sm" onClick={confirmLostReason} disabled={!lostReason || (lostReason === 'other' && !lostReasonCustom.trim())}>
              {isRTL ? 'تأكيد' : 'Confirm'}
            </Button>
          </div>
        </div>
      </div>
    )}

    {/* Drawer */}
    {selectedOpp && (
      <OpportunityDrawer
        selectedOpp={selectedOpp}
        onClose={closeDrawer}
        onMove={handleMove}
        onDelete={handleDelete}
        onUpdate={handleDrawerUpdate}
        agents={agents}
        projects={projects}
        opps={opps}
        isAdmin={isAdmin}
        isRTL={isRTL}
        lang={lang}
        isDark={isDark}
        profile={profile}
        scoreMap={scoreMap}
        configActivityResults={configActivityResults}
        configActivityTypes={configActivityTypes}
        ACTIVITY_ICON_MAP={ACTIVITY_ICON_MAP}
        sourceLabelsMap={sourceLabelsMap}
        configTypeMap={configTypeMap}
        deptLabelsMap={deptLabelsMap}
        lostReasonsMap={lostReasonsMap}
        configLostReasons={configLostReasons}
        onPrev={handleOppPrev}
        onNext={handleOppNext}
        onEditStageLost={handleEditStageLost}
      />
    )}
  </>);
}
