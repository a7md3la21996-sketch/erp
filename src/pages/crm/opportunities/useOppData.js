import { useMemo } from 'react';
import {
  TEMP_CONFIG, PRIORITY_CONFIG, SORT_OPTIONS, TEMP_ORDER, STAGE_WIN_RATES,
  calcLeadScore, fmtBudget, daysSince,
  getContactName, getAgentName, getProjectName,
} from './constants';
import { getDeptStages, deptStageLabel } from '../contacts/constants';
import { applySmartFilters } from '../../../components/ui';
import { useGlobalFilter } from '../../../contexts/GlobalFilterContext';

export default function useOppData({
  opps, normalizedOpps, smartFilters, SMART_FIELDS, activeStage, search, lang, isRTL,
  sortBy, scoreMap, applyAuditFilters,
  configStageWinRates, sourceLabelsMap, lostReasonsMap,
  filterDept,
}) {
  const globalFilter = useGlobalFilter();

  const filtered = useMemo(() => {
    let result = applySmartFilters(normalizedOpps, smartFilters, SMART_FIELDS);
    result = applyAuditFilters(result, smartFilters);
    if (activeStage !== 'all') result = result.filter(o => o.stage === activeStage);
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
    // Global filter
    if (globalFilter?.department && globalFilter.department !== 'all') {
      result = result.filter(o => o.department === globalFilter.department);
    }
    if (globalFilter?.agentName && globalFilter.agentName !== 'all') {
      result = result.filter(o => {
        const name = getAgentName(o, 'en');
        const nameAr = getAgentName(o, 'ar');
        return name === globalFilter.agentName || nameAr === globalFilter.agentName;
      });
    }
    return result;
  }, [normalizedOpps, smartFilters, SMART_FIELDS, activeStage, search, lang, globalFilter?.department, globalFilter?.agentName]);

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

  // KPI values
  const totalBudget = filtered.reduce((s, o) => s + (o.budget || 0), 0);
  const wonCount = filtered.filter(o => o.stage === 'closed_won').length;
  const hotCount = filtered.filter(o => o.temperature === 'hot').length;
  const conversionRate = opps.length > 0 ? Math.round((opps.filter(o => o.stage === 'closed_won').length / opps.length) * 100) : 0;
  const avgDealSize = wonCount > 0 ? Math.round(filtered.filter(o => o.stage === 'closed_won').reduce((s, o) => s + (o.budget || 0), 0) / wonCount) : 0;

  const avgCloseTime = useMemo(() => {
    const wonOpps = opps.filter(o => o.stage === 'closed_won' && o.created_at);
    if (!wonOpps.length) return 0;
    const totalDays = wonOpps.reduce((s, o) => s + Math.max(0, Math.floor((new Date(o.stage_changed_at || o.updated_at || o.created_at) - new Date(o.created_at)) / 86400000)), 0);
    return Math.round(totalDays / wonOpps.length);
  }, [opps]);

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

  const winRateLookup = useMemo(() => {
    const flat = {};
    if (configStageWinRates) {
      Object.entries(configStageWinRates).forEach(([, stages]) => {
        Object.entries(stages).forEach(([stageId, pct]) => {
          if (flat[stageId] === undefined) flat[stageId] = pct / 100;
        });
      });
    }
    Object.entries(STAGE_WIN_RATES).forEach(([k, v]) => {
      if (flat[k] === undefined) flat[k] = v;
    });
    return flat;
  }, [configStageWinRates]);

  const weightedForecast = useMemo(() => {
    return filtered.reduce((sum, o) => {
      if (o.stage === 'closed_won' || o.stage === 'closed_lost') return sum;
      const dept = o.contacts?.department || 'sales';
      const deptRates = configStageWinRates?.[dept] || {};
      const rate = deptRates[o.stage] !== undefined ? deptRates[o.stage] / 100 : (winRateLookup[o.stage] || 0.1);
      return sum + (o.budget || 0) * rate;
    }, 0);
  }, [filtered, configStageWinRates, winRateLookup]);

  const currentStages = filterDept === 'all' ? getDeptStages('sales') : getDeptStages(filterDept);

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

  // Duplicate detection
  const duplicateContactIds = useMemo(() => {
    const counts = {};
    opps.forEach(o => { if (o.contact_id) counts[o.contact_id] = (counts[o.contact_id] || 0) + 1; });
    return new Set(Object.keys(counts).filter(k => counts[k] > 1));
  }, [opps]);
  const isDuplicate = (contactId) => duplicateContactIds.has(String(contactId));

  // Stage tab counts
  const stageCounts = useMemo(() => {
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

  return {
    filtered, sortedFiltered, currentStages,
    totalBudget, wonCount, hotCount, conversionRate, avgDealSize, avgCloseTime,
    quickWins, weightedForecast, funnelData,
    lostReasonCounts, topLostReason,
    exportData, isDuplicate, stageCounts,
  };
}
