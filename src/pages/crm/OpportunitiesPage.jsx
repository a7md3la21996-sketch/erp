import { useState, useEffect, useCallback, useMemo } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import { fetchOpportunities, updateOpportunity, deleteOpportunity, fetchSalesAgents, fetchProjects } from '../../services/opportunitiesService';
import { createDealFromOpportunity, dealExistsForOpportunity } from '../../services/dealsService';
import { useLocation, useSearchParams } from 'react-router-dom';
import { useSystemConfig } from '../../contexts/SystemConfigContext';
import { TrendingUp, Plus, Search, X, Grid3X3, Phone, MessageCircle, Mail, Users as UsersIcon, Clock, Star, CheckSquare, AlertTriangle, RefreshCw, Printer } from 'lucide-react';
import { Button, Card, Input, PageSkeleton, ExportButton } from '../../components/ui';
import { getDeptStages } from './contacts/constants';
import { logView } from '../../services/viewTrackingService';
import { addRecentItem } from '../../services/recentItemsService';
import { logAction } from '../../services/auditService';
import { useAuditFilter } from '../../hooks/useAuditFilter';
import { exportToPrintableHTML, generateOpportunitiesReport } from '../../services/reportExportService';
import { notifyDealWon } from '../../services/notificationsService';
import { evaluateTriggers } from '../../services/triggerService';
import { createApproval as createApprovalRequest, getApprovalByEntity, getAutoApproveThreshold } from '../../services/approvalService';
import {
  TEMP_CONFIG, PRIORITY_CONFIG, SORT_OPTIONS,
  calcLeadScore, getContactName,
  getSavedFilters, addStageHistory,
} from './opportunities/constants';
import AddModal from './opportunities/AddModal';
import OpportunityDrawer from './opportunities/OpportunityDrawer';
import OppKPIs from './opportunities/OppKPIs';
import ConversionFunnel from './opportunities/ConversionFunnel';
import OppTable from './opportunities/OppTable';
import OppKanban from './opportunities/OppKanban';
import OppToolbar from './opportunities/OppToolbar';
import BulkActionsBar from './opportunities/BulkActionsBar';
import useBulkOps from './opportunities/useBulkOps';
import useOppData from './opportunities/useOppData';
import { useResponsive } from '../../hooks/useMediaQuery';
import { useToast } from '../../contexts/ToastContext';

/* Components extracted to ./opportunities/: OppCard, ContactSearch, AddModal, OpportunityDrawer, OppKPIs, ConversionFunnel, OppTable, OppKanban, OppToolbar, BulkActionsBar */
// ═══════════════════════════════════════════════
// Main Page
// ═══════════════════════════════════════════════
export default function OpportunitiesPage() {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const { i18n } = useTranslation();
  const { profile } = useAuth();
  const { isMobile } = useResponsive();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const toast = useToast();
  const { lostReasons: configLostReasons, sources: configSources, typeMap: configTypeMap, departments: configDepartments, activityTypes: configActivityTypes, activityResults: configActivityResults, stageWinRates: configStageWinRates } = useSystemConfig();
  const lostReasonsMap = useMemo(() => {
    const m = {};
    (configLostReasons || []).forEach(r => { m[r.key] = r; });
    return m;
  }, [configLostReasons]);
  const sourceLabelsMap = useMemo(() => {
    const m = {};
    (configSources || []).forEach(s => { m[s.key] = { ar: s.label_ar, en: s.label_en }; });
    return m;
  }, [configSources]);
  const deptLabelsMap = useMemo(() => {
    const m = { all: { ar: 'كل الأقسام', en: 'All Departments' } };
    (configDepartments || []).forEach(d => { m[d.key] = { ar: d.label_ar, en: d.label_en }; });
    return m;
  }, [configDepartments]);
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
  const [searchInput, setSearchInput] = useState(searchParams.get('q') || '');
  const [search, setSearch] = useState(searchParams.get('q') || '');
  const [activeStage, setActiveStage] = useState(location.state?.initialStage || searchParams.get('stage') || 'all');
  const [smartFilters, setSmartFilters] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [selectedOpp, setSelectedOpp] = useState(null);
  const [dealCreatedToast, setDealCreatedToast] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [viewMode, setViewMode] = useState(searchParams.get('view') || 'table');
  const [sortBy, setSortBy] = useState(searchParams.get('sort') || 'newest');
  const [actionLoading, setActionLoading] = useState(false);
  const [bulkMode, setBulkMode] = useState(false);
  const [savedFilters, setSavedFilters] = useState(() => getSavedFilters());
  const [filterName, setFilterName] = useState('');
  const [draggingOpp, setDraggingOpp] = useState(null);
  const [dragOverStage, setDragOverStage] = useState(null);
  const [lostReasonModal, setLostReasonModal] = useState(null);
  const [lostReason, setLostReason] = useState('');
  const [lostReasonCustom, setLostReasonCustom] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [showFunnel, setShowFunnel] = useState(false);
  const [moveWarningToast, setMoveWarningToast] = useState(null);
  const isAdmin = profile?.role === 'admin';
  const [gridPage, setGridPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // Debounce search input
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput), 250);
    return () => clearTimeout(t);
  }, [searchInput]);

  // Sync filters to URL params
  useEffect(() => {
    const params = new URLSearchParams();
    if (search) params.set('q', search);
    if (activeStage !== 'all') params.set('stage', activeStage);
    if (sortBy !== 'newest') params.set('sort', sortBy);
    if (viewMode !== 'table') params.set('view', viewMode);
    setSearchParams(params, { replace: true });
  }, [search, activeStage, sortBy, viewMode, setSearchParams]);

  // SmartFilter field definitions
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

  const filterDept = useMemo(() => {
    const deptFilter = smartFilters.find(f => f.field === 'department' && f.operator === 'is');
    return deptFilter ? deptFilter.value : 'all';
  }, [smartFilters]);

  const closeDrawer = useCallback(() => {
    setSelectedOpp(null);
  }, []);

  // currentStages comes from useOppData hook

  // Load data
  const loadData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    let oppsData, agentsData, projectsData;
    try {
      [oppsData, agentsData, projectsData] = await Promise.all([
        fetchOpportunities({ role: profile?.role, userId: profile?.id, teamId: profile?.team_id }),
        fetchSalesAgents(),
        fetchProjects(),
      ]);
    } catch {
      toast.error(isRTL ? 'فشل تحميل البيانات' : 'Failed to load data');
      setLoading(false);
      setRefreshing(false);
      return;
    }
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

  const scoreMap = useMemo(() => {
    const m = {};
    opps.forEach(o => { m[o.id] = calcLeadScore(o); });
    return m;
  }, [opps]);

  const normalizedOpps = useMemo(() => opps.map(o => ({
    ...o,
    department: o.contacts?.department || 'sales',
    source: o.contacts?.source || o.source || '',
    lead_score: (() => { const s = scoreMap[o.id] || 0; return s >= 70 ? 'hot' : s >= 40 ? 'warm' : 'cold'; })(),
  })), [opps, scoreMap]);

  // Data computations hook
  const {
    filtered, sortedFiltered, currentStages,
    totalBudget, wonCount, hotCount, conversionRate, avgDealSize, avgCloseTime,
    quickWins, weightedForecast, funnelData,
    lostReasonCounts, topLostReason,
    exportData, isDuplicate, stageCounts,
  } = useOppData({
    opps, normalizedOpps, smartFilters, SMART_FIELDS, activeStage, search, lang, isRTL,
    sortBy, scoreMap, applyAuditFilters,
    configStageWinRates, sourceLabelsMap, lostReasonsMap,
    filterDept,
  });
  const stageConfigWithAll = [{ id: 'all', label_ar: 'الكل', label_en: 'All', color: '#4A7AAB' }, ...currentStages];

  // Bulk operations hook
  const {
    bulkSelected, setBulkSelected,
    bulkToast, bulkBarVisible,
    confirmBulkDelete, setConfirmBulkDelete,
    toggleBulk,
    bulkMoveAll, bulkAssign, bulkDeleteAll, bulkChangeTemp, bulkChangePriority,
    bulkExportCSV,
    showBulkToast,
  } = useBulkOps({
    opps, setOpps, agents, profile, isRTL, lang, scoreMap,
    sortedFiltered, setBulkMode,
    setLostReasonModal, setLostReason, setLostReasonCustom,
    toast,
  });

  // ESC to close modals/drawer; Ctrl+N / ⌘+N to open add modal
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

  const selectOpp = useCallback((opp) => {
    setSelectedOpp(opp);
    if (opp) {
      logView({ entityType: 'opportunity', entityId: opp.id, entityName: opp.project || opp.contacts?.full_name, viewer: profile });
      addRecentItem({ type: 'opportunity', id: opp.id, name: opp.contacts?.full_name || opp.project || 'Opportunity', path: '/opportunities?highlight=' + opp.id, extra: { stage: opp.stage, budget: opp.budget } });
    }
  }, [profile]);

  const selectedOppIdx = selectedOpp ? sortedFiltered.findIndex(o => o.id === selectedOpp.id) : -1;
  const handleOppPrev = selectedOppIdx > 0 ? () => { selectOpp(sortedFiltered[selectedOppIdx - 1]); } : null;
  const handleOppNext = selectedOppIdx >= 0 && selectedOppIdx < sortedFiltered.length - 1 ? () => { selectOpp(sortedFiltered[selectedOppIdx + 1]); } : null;

  const gridTotalPages = Math.max(1, Math.ceil(sortedFiltered.length / pageSize));
  const gridSafePage = Math.min(gridPage, gridTotalPages);
  const gridPaged = viewMode === 'table' ? sortedFiltered.slice((gridSafePage - 1) * pageSize, gridSafePage * pageSize) : sortedFiltered;
  useEffect(() => { setGridPage(1); }, [search, smartFilters, activeStage, sortBy, pageSize]);

  const handleMove = async (id, toStage, extraUpdates = {}) => {
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
    if (toStage === 'closed_lost' && !extraUpdates.lost_reason) {
      setLostReasonModal({ id, toStage });
      setLostReason('');
      setLostReasonCustom('');
      return;
    }
    const opp_ = opps.find(o => o.id === id);
    const fromStage = opp_?.stage;
    if (fromStage && fromStage !== toStage) addStageHistory(id, fromStage, toStage);
    // Optimistic update
    setOpps(p => p.map(o => o.id === id ? { ...o, stage: toStage, stage_changed_at: new Date().toISOString(), ...extraUpdates } : o));
    if (selectedOpp?.id === id) {
      setSelectedOpp(p => ({ ...p, stage: toStage, stage_changed_at: new Date().toISOString(), ...extraUpdates }));
    }
    setActionLoading(true);
    try {
      await updateOpportunity(id, { stage: toStage, stage_changed_at: new Date().toISOString(), ...extraUpdates });
      logAction({ action: 'stage_change', entity: 'opportunity', entityId: id, entityName: getContactName(opp_ || {}), description: isRTL ? 'تغيير مرحلة' : 'Stage changed', oldValue: fromStage, newValue: toStage, userName: profile?.full_name_ar || profile?.full_name_en || '' });
      evaluateTriggers('opportunity', 'stage_changed', { ...(opp_ || {}), stage: toStage, previous_stage: fromStage });
    } catch {
      // Rollback on failure
      setOpps(p => p.map(o => o.id === id ? { ...o, stage: fromStage, ...Object.fromEntries(Object.keys(extraUpdates).map(k => [k, opp_?.[k]])) } : o));
      if (selectedOpp?.id === id) setSelectedOpp(p => ({ ...p, stage: fromStage }));
      toast.error(isRTL ? 'فشل تحديث المرحلة' : 'Failed to update stage');
      setActionLoading(false);
      return;
    }
    setActionLoading(false);

    if (toStage === 'closed_won') {
      const opp = opps.find(o => o.id === id);
      if (opp) {
        notifyDealWon({
          dealNumber: opp.id?.slice(0, 8) || '—',
          clientName: getContactName(opp),
          value: opp.budget ? `${Number(opp.budget).toLocaleString()} EGP` : '—',
          agentId: opp.assigned_to || 'all',
        });
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

    if (lostReasonModal.bulkIds) {
      const ids = lostReasonModal.bulkIds;
      ids.forEach(id => { const opp = opps.find(o => o.id === id); if (opp && opp.stage !== 'closed_lost') addStageHistory(id, opp.stage, 'closed_lost'); });
      setOpps(p => p.map(o => ids.includes(o.id) ? { ...o, stage: 'closed_lost', lost_reason: reason, stage_changed_at: new Date().toISOString() } : o));
      const prevOpps = opps;
      showBulkToast(isRTL ? `تم نقل ${ids.length} فرصة` : `${ids.length} opportunities moved`);
      setBulkSelected(new Set()); setBulkMode(false);
      setLostReasonModal(null);
      try {
        await Promise.all(ids.map(id => updateOpportunity(id, { stage: 'closed_lost', lost_reason: reason, stage_changed_at: new Date().toISOString() })));
      } catch {
        setOpps(prevOpps);
        toast.error(isRTL ? 'فشل نقل بعض الفرص' : 'Failed to move some opportunities');
      }
      return;
    }

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

  const handleDelete = (id) => { setConfirmDelete(id); };

  const confirmDeleteOpp = async () => {
    if (!confirmDelete) return;
    const deletedOpp = opps.find(o => o.id === confirmDelete);
    const prevOpps = opps;
    setOpps(p => p.filter(o => o.id !== confirmDelete));
    if (selectedOpp?.id === confirmDelete) setSelectedOpp(null);
    setConfirmDelete(null);
    setActionLoading(true);
    try {
      await deleteOpportunity(confirmDelete);
      logAction({ action: 'delete', entity: 'opportunity', entityId: confirmDelete, entityName: getContactName(deletedOpp || {}), description: isRTL ? 'حذف فرصة' : 'Opportunity deleted', userName: profile?.full_name_ar || profile?.full_name_en || '' });
      toast.success(isRTL ? 'تم حذف الفرصة' : 'Opportunity deleted');
    } catch {
      setOpps(prevOpps);
      toast.error(isRTL ? 'فشل حذف الفرصة' : 'Failed to delete opportunity');
    }
    setActionLoading(false);
  };

  const handleSave = (opp) => {
    setOpps(p => [opp, ...p]);
    setShowModal(false);
  };

  const handleDrawerUpdate = async (oppId, updates) => {
    setActionLoading(true);
    let result;
    try {
      result = await updateOpportunity(oppId, updates);
    } catch {
      toast.error(isRTL ? 'فشل تحديث الفرصة' : 'Failed to update opportunity');
      setActionLoading(false);
      return;
    }
    setOpps(p => p.map(o => o.id === oppId ? { ...o, ...result } : o));
    setSelectedOpp(prev => prev?.id === oppId ? { ...prev, ...result } : prev);
    toast.success(isRTL ? 'تم تحديث الفرصة' : 'Opportunity updated');
    logAction({ action: 'update', entity: 'opportunity', entityId: oppId, entityName: getContactName(opps.find(o => o.id === oppId) || selectedOpp || {}), description: isRTL ? 'تحديث فرصة' : 'Opportunity updated', userName: profile?.full_name_ar || profile?.full_name_en || '' });

    if (updates.stage === 'closed_won') {
      notifyDealWon({
        dealNumber: oppId?.slice(0, 8) || '—',
        clientName: getContactName(opps.find(o => o.id === oppId) || selectedOpp || {}),
        value: updates.budget ? `${Number(updates.budget).toLocaleString()} EGP` : '—',
        agentId: updates.assigned_to || selectedOpp?.assigned_to || 'all',
      });
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
    setActionLoading(false);
  };

  const handleEditStageLost = (oppId, editForm) => {
    setLostReasonModal({ id: oppId, toStage: 'closed_lost', fromEdit: true, editForm });
    setLostReason('');
    setLostReasonCustom('');
  };

  if (loading) return <PageSkeleton hasKpis kpiCount={6} tableRows={6} tableCols={5} />;

  return (<>
    {/* Action loading bar */}
    {actionLoading && (
      <div className="fixed top-0 left-0 right-0 z-[2000] h-1 bg-brand-500/20 overflow-hidden">
        <div className="h-full bg-brand-500 animate-[indeterminate_1.5s_ease-in-out_infinite]" style={{ width: '30%', animation: 'indeterminate 1.5s ease-in-out infinite' }} />
        <style>{`@keyframes indeterminate { 0% { transform: translateX(-100%); } 100% { transform: translateX(400%); } }`}</style>
      </div>
    )}
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

      {/* KPIs + Loss Analysis */}
      <OppKPIs
        isRTL={isRTL} isMobile={isMobile} filtered={filtered}
        totalBudget={totalBudget} wonCount={wonCount} hotCount={hotCount}
        weightedForecast={weightedForecast} avgDealSize={avgDealSize}
        avgCloseTime={avgCloseTime} conversionRate={conversionRate} quickWins={quickWins}
        setSmartFilters={setSmartFilters} setActiveStage={setActiveStage}
        lostReasonCounts={lostReasonCounts} topLostReason={topLostReason} lostReasonsMap={lostReasonsMap}
      />

      {/* Conversion Funnel */}
      <ConversionFunnel
        isRTL={isRTL} isDark={isDark} showFunnel={showFunnel} setShowFunnel={setShowFunnel}
        sortedFiltered={sortedFiltered} funnelData={funnelData}
      />

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

      {/* Filters + Toolbar */}
      <OppToolbar
        isRTL={isRTL} SMART_FIELDS={SMART_FIELDS} smartFilters={smartFilters} setSmartFilters={setSmartFilters}
        setActiveStage={setActiveStage} searchInput={searchInput} setSearchInput={setSearchInput}
        SMART_SORT_OPTIONS={SMART_SORT_OPTIONS} sortBy={sortBy} setSortBy={setSortBy}
        filteredCount={filtered.length}
        savedFilters={savedFilters} setSavedFilters={setSavedFilters} filterName={filterName} setFilterName={setFilterName}
        setSearch={setSearch} activeStage={activeStage}
        bulkMode={bulkMode} setBulkMode={setBulkMode} setBulkSelected={setBulkSelected}
        viewMode={viewMode} setViewMode={setViewMode}
      />

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
      ) : viewMode === 'kanban' ? (
        <OppKanban
          isRTL={isRTL} lang={lang} isMobile={isMobile}
          sortedFiltered={sortedFiltered} totalBudget={totalBudget} currentStages={currentStages}
          dragOverStage={dragOverStage} setDragOverStage={setDragOverStage}
          draggingOpp={draggingOpp} setDraggingOpp={setDraggingOpp}
          handleMove={handleMove} handleDelete={handleDelete} selectOpp={selectOpp}
          bulkMode={bulkMode} bulkSelected={bulkSelected} toggleBulk={toggleBulk}
          scoreMap={scoreMap} isAdmin={isAdmin} sourceLabelsMap={sourceLabelsMap}
          setShowModal={setShowModal}
        />
      ) : (<>
        <OppTable
          isRTL={isRTL} lang={lang} isMobile={isMobile}
          gridPaged={gridPaged} sortedFiltered={sortedFiltered}
          gridSafePage={gridSafePage} gridTotalPages={gridTotalPages}
          setGridPage={setGridPage} pageSize={pageSize} setPageSize={setPageSize}
          scoreMap={scoreMap} quickWins={quickWins}
          bulkMode={bulkMode} bulkSelected={bulkSelected} toggleBulk={toggleBulk} setBulkSelected={setBulkSelected}
          selectOpp={selectOpp} handleDelete={handleDelete} isDuplicate={isDuplicate}
        />
      </>)}

      {showModal && <AddModal isRTL={isRTL} lang={lang} onClose={() => setShowModal(false)} onSave={handleSave} agents={agents} projects={projects} existingOpps={opps} currentUserId={profile?.id} />}

      {/* Delete Confirmation */}
      {confirmDelete && (
        <div dir={isRTL ? 'rtl' : 'ltr'} className="fixed inset-0 bg-black/50 z-[1100] flex items-center justify-center p-5" onClick={() => setConfirmDelete(null)}>
          <div className="bg-surface-card dark:bg-surface-card-dark border border-red-500/30 rounded-2xl p-7 w-full max-w-[400px] text-center" onClick={e => e.stopPropagation()}>
            <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-4">
              <AlertTriangle size={20} className="text-red-500" />
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

    {/* Floating Bulk Action Bar + Bulk Delete Confirmation */}
    {/* Bulk Actions Bar — works in both table and kanban */}
    {(
      <BulkActionsBar
        isRTL={isRTL} isDark={isDark} lang={lang}
        bulkSelected={bulkSelected} bulkBarVisible={bulkBarVisible}
        setBulkSelected={setBulkSelected} setBulkMode={setBulkMode}
        bulkMoveAll={bulkMoveAll} bulkAssign={bulkAssign}
        bulkChangePriority={bulkChangePriority} bulkChangeTemp={bulkChangeTemp}
        bulkExportCSV={bulkExportCSV}
        setConfirmBulkDelete={setConfirmBulkDelete} confirmBulkDelete={confirmBulkDelete}
        bulkDeleteAll={bulkDeleteAll}
        currentStages={currentStages} agents={agents}
      />
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
