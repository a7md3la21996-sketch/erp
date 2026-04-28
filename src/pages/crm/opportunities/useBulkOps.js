import { useState, useEffect, useCallback, useMemo } from 'react';
import { updateOpportunity, deleteOpportunity } from '../../../services/opportunitiesService';
import { logAction } from '../../../services/auditService';
import { rollbackManyById } from '../../../utils/safeRollback';
import {
  TEMP_CONFIG, PRIORITY_CONFIG,
  calcLeadScore, getContactName, getAgentName, getProjectName,
  addStageHistory,
} from './constants';
import { deptStageLabel } from '../contacts/constants';

// Run a per-id mutation across ids and resolve with the failed-id list and
// the snapshots needed to roll those rows back. Failed/successful rows are
// kept distinct so a partial failure doesn't blow away the rows that
// actually succeeded (or any realtime updates that landed on them).
async function settleAndCollectFailures(ids, prevOpps, work) {
  const previousById = new Map();
  prevOpps.forEach(o => { if (ids.includes(o.id)) previousById.set(o.id, o); });
  const results = await Promise.allSettled(ids.map(id => work(id)));
  const failedIds = results
    .map((r, i) => r.status === 'rejected' ? ids[i] : null)
    .filter(Boolean);
  return { failedIds, previousById };
}

function pluralFailureMessage(failedIds, total, isRTL, getNameById) {
  const names = failedIds.map(getNameById).filter(Boolean);
  const preview = names.slice(0, 3).join(', ');
  const more = names.length > 3 ? (isRTL ? ` و${names.length - 3} آخرين` : ` and ${names.length - 3} more`) : '';
  return isRTL
    ? `فشل تحديث ${failedIds.length} من ${total}${preview ? `: ${preview}${more}` : ''}`
    : `${failedIds.length} of ${total} failed${preview ? `: ${preview}${more}` : ''}`;
}

export default function useBulkOps({
  opps, setOpps, agents, profile, isRTL, lang, scoreMap,
  sortedFiltered, setBulkMode,
  setLostReasonModal, setLostReason, setLostReasonCustom,
  toast,
}) {
  const [bulkSelected, setBulkSelected] = useState(new Set());
  const [bulkToast, setBulkToast] = useState(null);
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);
  const [bulkBarVisible, setBulkBarVisible] = useState(false);

  const toggleBulk = (id) => setBulkSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const showBulkToastMsg = (msg) => { setBulkToast(msg); setTimeout(() => setBulkToast(null), 3000); };

  // Helper to map an id back to a display name for failure toasts.
  const nameById = (id) => getContactName((opps || []).find(o => o.id === id) || {});

  const bulkMoveAll = async (toStage) => {
    if (toStage === 'closed_lost') {
      setLostReasonModal({ id: '__bulk__', toStage, bulkIds: [...bulkSelected] });
      setLostReason('');
      setLostReasonCustom('');
      return;
    }
    const ids = [...bulkSelected];
    const prevOpps = opps;
    ids.forEach(id => { const opp = (opps || []).find(o => o.id === id); if (opp && opp.stage !== toStage) addStageHistory(id, opp.stage, toStage); });
    setOpps(p => p.map(o => ids.includes(o.id) ? { ...o, stage: toStage, stage_changed_at: new Date().toISOString() } : o));
    showBulkToastMsg(isRTL ? `تم نقل ${ids.length} فرصة` : `${ids.length} opportunities moved`);
    setBulkSelected(new Set()); setBulkMode(false);
    const { failedIds, previousById } = await settleAndCollectFailures(ids, prevOpps,
      id => updateOpportunity(id, { stage: toStage, stage_changed_at: new Date().toISOString() })
    );
    if (failedIds.length) {
      setOpps(p => rollbackManyById(p, previousById, failedIds));
      toast?.error(pluralFailureMessage(failedIds, ids.length, isRTL, nameById));
    }
  };

  const bulkAssign = async (agentId) => {
    const ids = [...bulkSelected];
    const agent = agents.find(a => a.id === agentId);
    const prevOpps = opps;
    logAction({ action: 'bulk_reassign', entity: 'opportunity', entityId: ids.join(','), entityName: `${ids.length} opportunities`, description: isRTL ? 'إعادة تعيين جماعي' : 'Bulk reassign', newValue: agent?.full_name_ar || agent?.full_name_en || agentId, userName: profile?.full_name_ar || profile?.full_name_en || '' });
    setOpps(p => p.map(o => ids.includes(o.id) ? { ...o, assigned_to: agentId, assigned_by: profile?.id || null, users: agent || o.users } : o));
    showBulkToastMsg(isRTL ? `تم تعيين ${ids.length} فرصة` : `${ids.length} opportunities assigned`);
    setBulkSelected(new Set()); setBulkMode(false);
    const { failedIds, previousById } = await settleAndCollectFailures(ids, prevOpps,
      id => updateOpportunity(id, { assigned_to: agentId, assigned_by: profile?.id || null })
    );
    if (failedIds.length) {
      setOpps(p => rollbackManyById(p, previousById, failedIds));
      toast?.error(pluralFailureMessage(failedIds, ids.length, isRTL, nameById));
    }
  };

  const bulkDeleteAll = async () => {
    const ids = [...bulkSelected];
    const prevOpps = opps;
    const previousById = new Map();
    prevOpps.forEach(o => { if (ids.includes(o.id)) previousById.set(o.id, o); });
    logAction({ action: 'bulk_delete', entity: 'opportunity', entityId: ids.join(','), entityName: `${ids.length} opportunities`, description: isRTL ? 'حذف جماعي' : 'Bulk delete', userName: profile?.full_name_ar || profile?.full_name_en || '' });
    setOpps(p => p.filter(o => !ids.includes(o.id)));
    showBulkToastMsg(isRTL ? `تم حذف ${ids.length} فرصة` : `${ids.length} opportunities deleted`);
    setBulkSelected(new Set()); setBulkMode(false);
    const results = await Promise.allSettled(ids.map(id => deleteOpportunity(id)));
    const failedIds = results.map((r, i) => r.status === 'rejected' ? ids[i] : null).filter(Boolean);
    if (failedIds.length) {
      // Re-add the rows we couldn't actually delete from the server.
      const rowsToRestore = failedIds.map(id => previousById.get(id)).filter(Boolean);
      setOpps(p => {
        const have = new Set(p.map(o => o.id));
        const newOnes = rowsToRestore.filter(o => !have.has(o.id));
        return [...newOnes, ...p];
      });
      toast?.error(pluralFailureMessage(failedIds, ids.length, isRTL, id => getContactName(previousById.get(id) || {})));
    }
  };

  const bulkChangeTemp = async (temp) => {
    const ids = [...bulkSelected];
    const prevOpps = opps;
    setOpps(p => p.map(o => ids.includes(o.id) ? { ...o, temperature: temp } : o));
    showBulkToastMsg(isRTL ? `تم تحديث ${ids.length} فرصة` : `${ids.length} opportunities updated`);
    setBulkSelected(new Set()); setBulkMode(false);
    const { failedIds, previousById } = await settleAndCollectFailures(ids, prevOpps,
      id => updateOpportunity(id, { temperature: temp })
    );
    if (failedIds.length) {
      setOpps(p => rollbackManyById(p, previousById, failedIds));
      toast?.error(pluralFailureMessage(failedIds, ids.length, isRTL, nameById));
    }
  };

  const bulkChangePriority = async (priority) => {
    const ids = [...bulkSelected];
    const prevOpps = opps;
    setOpps(p => p.map(o => ids.includes(o.id) ? { ...o, priority } : o));
    showBulkToastMsg(isRTL ? `تم تحديث ${ids.length} فرصة` : `${ids.length} opportunities updated`);
    setBulkSelected(new Set()); setBulkMode(false);
    const { failedIds, previousById } = await settleAndCollectFailures(ids, prevOpps,
      id => updateOpportunity(id, { priority })
    );
    if (failedIds.length) {
      setOpps(p => rollbackManyById(p, previousById, failedIds));
      toast?.error(pluralFailureMessage(failedIds, ids.length, isRTL, nameById));
    }
  };

  // Animate floating bulk bar
  useEffect(() => {
    if (bulkSelected.size > 0) {
      const t = setTimeout(() => setBulkBarVisible(true), 10);
      return () => clearTimeout(t);
    } else {
      setBulkBarVisible(false);
    }
  }, [bulkSelected.size]);

  // Bulk CSV export
  const bulkExportCSV = useCallback(() => {
    const selectedOpps = sortedFiltered.filter(o => bulkSelected.has(o.id));
    if (!selectedOpps.length) return;
    const headers = [
      isRTL ? 'الاسم' : 'Name', isRTL ? 'المشروع' : 'Project', isRTL ? 'المرحلة' : 'Stage',
      isRTL ? 'الميزانية' : 'Budget', isRTL ? 'الحرارة' : 'Temperature', isRTL ? 'الأولوية' : 'Priority',
      isRTL ? 'المسؤول' : 'Agent', isRTL ? 'النقاط' : 'Score', isRTL ? 'التاريخ' : 'Created',
    ];
    const rows = selectedOpps.map(o => [
      getContactName(o), getProjectName(o, lang),
      deptStageLabel(o.stage, o.contacts?.department || 'sales', isRTL),
      o.budget || 0,
      isRTL ? (TEMP_CONFIG[o.temperature]?.label_ar || '') : (TEMP_CONFIG[o.temperature]?.label_en || ''),
      isRTL ? (PRIORITY_CONFIG[o.priority]?.label_ar || '') : (PRIORITY_CONFIG[o.priority]?.label_en || ''),
      getAgentName(o, lang), scoreMap[o.id] ?? calcLeadScore(o), o.created_at?.slice(0, 10) || '',
    ]);
    const csvContent = '\uFEFF' + [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `opportunities_export_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showBulkToastMsg(isRTL ? `تم تصدير ${selectedOpps.length} فرصة` : `${selectedOpps.length} opportunities exported`);
  }, [bulkSelected, sortedFiltered, isRTL, lang, scoreMap]);

  return {
    bulkSelected, setBulkSelected,
    bulkToast, bulkBarVisible,
    confirmBulkDelete, setConfirmBulkDelete,
    toggleBulk,
    bulkMoveAll, bulkAssign, bulkDeleteAll, bulkChangeTemp, bulkChangePriority,
    bulkExportCSV,
    showBulkToast: showBulkToastMsg,
  };
}
