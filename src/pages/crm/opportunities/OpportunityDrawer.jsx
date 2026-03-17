import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { isFavorite as checkFavorite, toggleFavorite } from '../../../services/favoritesService';
import { fetchContactActivities, createActivity } from '../../../services/contactsService';
import FollowUpReminder from '../../../components/ui/FollowUpReminder';
import DocumentsSection from '../../../components/ui/DocumentsSection';
import CommentsSection from '../../../components/ui/CommentsSection';
import { getDeptStages, deptStageLabel } from '../contacts/constants';
import {
  TEMP_CONFIG, PRIORITY_CONFIG, ACTIVITY_ICONS,
  calcLeadScore, scoreColor, scoreLabel, fmtBudget, daysInStage,
  initials, avatarColor, getContactName, getAgentName, getProjectName,
  getStageHistory, addStageHistory, getOppNotes, addOppNote, deleteOppNote,
} from './constants';
import {
  Plus, X, Trash2, Building2, Banknote, User, Loader2, Pencil,
  Phone, MessageCircle, Mail, Users as UsersIcon, Clock, Star,
  MapPin, Briefcase, Calendar, ExternalLink, StickyNote,
  ChevronUp, ChevronDown,
} from 'lucide-react';
import { Button, Input, Select, Textarea } from '../../../components/ui';

export default function OpportunityDrawer({
  selectedOpp, onClose, onMove, onDelete, onUpdate,
  agents, projects, opps,
  isAdmin, isRTL, lang, isDark, profile,
  scoreMap, configActivityResults, configActivityTypes, ACTIVITY_ICON_MAP,
  sourceLabelsMap, configTypeMap, deptLabelsMap, lostReasonsMap, configLostReasons,
  onPrev, onNext,
  onEditStageLost,
}) {
  const navigate = useNavigate();

  // ─── Drawer-local state ───
  const [editingOpp, setEditingOpp] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [editSaving, setEditSaving] = useState(false);
  const [showAddActivity, setShowAddActivity] = useState(false);
  const [activityForm, setActivityForm] = useState({ type: 'call', description: '', result: '' });
  const [drawerActivities, setDrawerActivities] = useState([]);
  const [loadingActivities, setLoadingActivities] = useState(false);
  const [drawerNotes, setDrawerNotes] = useState([]);
  const [newNote, setNewNote] = useState('');
  const [stageHistory, setStageHistory] = useState([]);
  const [showNotes, setShowNotes] = useState(false);
  // Used for copy-phone toast inside drawer
  const [copyToast, setCopyToast] = useState(null);

  // Check if edit form has unsaved changes
  const isEditDirty = editingOpp && selectedOpp && (
    String(editForm.budget) !== String(selectedOpp.budget || '') ||
    editForm.temperature !== (selectedOpp.temperature || 'cold') ||
    editForm.priority !== (selectedOpp.priority || 'medium') ||
    editForm.assigned_to !== (selectedOpp.assigned_to || '') ||
    editForm.project_id !== (selectedOpp.project_id || '') ||
    editForm.notes !== (selectedOpp.notes || '') ||
    editForm.stage !== (selectedOpp.stage || 'qualification') ||
    editForm.expected_close_date !== (selectedOpp.expected_close_date || '')
  );

  const closeDrawer = useCallback(() => {
    if (isEditDirty) {
      if (!window.confirm(isRTL ? 'يوجد تغييرات لم يتم حفظها. هل تريد الإغلاق؟' : 'You have unsaved changes. Close anyway?')) return;
    }
    setEditingOpp(false);
    onClose();
  }, [isEditDirty, isRTL, onClose]);

  // Fetch activities for drawer
  useEffect(() => {
    if (!selectedOpp?.contact_id) { setDrawerActivities([]); return; }
    let cancelled = false;
    setLoadingActivities(true);
    fetchContactActivities(selectedOpp.contact_id)
      .then(data => { if (!cancelled) setDrawerActivities(data?.slice(0, 5) || []); })
      .catch(() => { if (!cancelled) setDrawerActivities([]); })
      .finally(() => { if (!cancelled) setLoadingActivities(false); });
    return () => { cancelled = true; };
  }, [selectedOpp?.contact_id]);

  // Load notes & stage history for drawer
  useEffect(() => {
    if (!selectedOpp?.id) { setDrawerNotes([]); setStageHistory([]); return; }
    setDrawerNotes(getOppNotes(selectedOpp.id));
    setStageHistory(getStageHistory(selectedOpp.id));
  }, [selectedOpp?.id]);

  // Reset edit mode when selectedOpp changes (e.g. prev/next navigation)
  useEffect(() => {
    setEditingOpp(false);
  }, [selectedOpp?.id]);

  const startEdit = () => {
    setEditForm({
      budget: selectedOpp.budget || '',
      temperature: selectedOpp.temperature || 'cold',
      priority: selectedOpp.priority || 'medium',
      assigned_to: selectedOpp.assigned_to || '',
      project_id: selectedOpp.project_id || '',
      notes: selectedOpp.notes || '',
      stage: selectedOpp.stage || 'qualification',
      expected_close_date: selectedOpp.expected_close_date || '',
    });
    setEditingOpp(true);
  };

  const saveEdit = async () => {
    setEditSaving(true);
    const stageChanged = editForm.stage !== selectedOpp.stage;
    if (stageChanged) {
      // If changing to closed_lost, need reason — delegate to parent
      if (editForm.stage === 'closed_lost') {
        setEditSaving(false);
        onEditStageLost(selectedOpp.id, editForm);
        return;
      }
      addStageHistory(selectedOpp.id, selectedOpp.stage, editForm.stage);
    }
    const assignmentChanged = editForm.assigned_to !== (selectedOpp.assigned_to || '');
    const updates = {
      budget: Number(editForm.budget) || 0,
      temperature: editForm.temperature,
      priority: editForm.priority,
      assigned_to: editForm.assigned_to || null,
      ...(assignmentChanged ? { assigned_by: profile?.id || null } : {}),
      project_id: editForm.project_id || null,
      notes: editForm.notes,
      expected_close_date: editForm.expected_close_date || null,
      ...(stageChanged ? { stage: editForm.stage, stage_changed_at: new Date().toISOString() } : {}),
    };
    await onUpdate(selectedOpp.id, updates);
    if (stageChanged) setStageHistory(getStageHistory(selectedOpp.id));
    setEditingOpp(false);
    setEditSaving(false);
  };

  const handlePrev = onPrev ? () => { setEditingOpp(false); onPrev(); } : null;
  const handleNext = onNext ? () => { setEditingOpp(false); onNext(); } : null;

  if (!selectedOpp) return null;

  return (
    <div
      role="dialog"
      dir={isRTL ? 'rtl' : 'ltr'}
      className={`fixed inset-0 z-[200] bg-black/40 flex ${isRTL ? 'flex-row' : 'flex-row-reverse'}`}
      onClick={e => { if (e.target === e.currentTarget) closeDrawer(); }}
    >
      <div className="w-full max-w-[100vw] sm:max-w-[460px] h-full bg-surface-card dark:bg-surface-card-dark shadow-[-8px_0_40px_rgba(0,0,0,0.2)] flex flex-col overflow-y-auto">
        {/* Drawer Header */}
        <div className="px-6 py-5 border-b border-edge dark:border-edge-dark flex items-center justify-between bg-[#F8FAFC] dark:bg-surface-bg-dark">
          <div className="flex items-center gap-3">
            <div
              className="w-11 h-11 rounded-full flex items-center justify-center text-sm font-bold text-white"
              style={{ background: avatarColor(selectedOpp.contact_id || selectedOpp.id) }}
            >
              {initials(getContactName(selectedOpp))}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <p className="m-0 text-base font-bold text-content dark:text-content-dark">{selectedOpp.contacts?.prefix ? selectedOpp.contacts.prefix + ' ' : ''}{getContactName(selectedOpp)}</p>
                {selectedOpp.contacts?.contact_type && (
                  <span className="text-[10px] px-1.5 py-px rounded-full bg-brand-500/15 text-brand-600 dark:text-brand-400 font-semibold">
                    {isRTL ? (configTypeMap[selectedOpp.contacts.contact_type]?.label || selectedOpp.contacts.contact_type) : (configTypeMap[selectedOpp.contacts.contact_type]?.labelEn || selectedOpp.contacts.contact_type)}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                {selectedOpp.contacts?.company && (
                  <span className="text-[10px] px-1.5 py-px rounded bg-brand-500/10 text-brand-500 flex items-center gap-0.5"><Building2 size={9} /> {selectedOpp.contacts.company}</span>
                )}
                {selectedOpp.contacts?.job_title && (
                  <span className="text-[10px] px-1.5 py-px rounded bg-brand-500/10 text-brand-500 flex items-center gap-0.5"><Briefcase size={9} /> {selectedOpp.contacts.job_title}</span>
                )}
                {selectedOpp.contacts?.department && (
                  <span className="text-[10px] px-1.5 py-px rounded bg-brand-500/10 text-brand-500">
                    {isRTL ? (deptLabelsMap[selectedOpp.contacts.department]?.ar || selectedOpp.contacts.department) : (deptLabelsMap[selectedOpp.contacts.department]?.en || selectedOpp.contacts.department)}
                  </span>
                )}
              </div>
              {selectedOpp.created_at && (
                <span className="text-[10px] text-content-muted dark:text-content-muted-dark mt-0.5 block">
                  {new Date(selectedOpp.created_at).toLocaleDateString(isRTL ? 'ar-EG' : 'en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {(() => {
              const oppFavId = `opp_${selectedOpp.id}`;
              const oppIsFav = checkFavorite(oppFavId);
              const contactName = selectedOpp.contacts ? (isRTL ? (selectedOpp.contacts.full_name_ar || selectedOpp.contacts.full_name_en) : (selectedOpp.contacts.full_name_en || selectedOpp.contacts.full_name_ar)) : '';
              return (
                <button
                  onClick={() => {
                    toggleFavorite({
                      id: oppFavId,
                      type: 'opportunity',
                      name: contactName || `Opportunity #${selectedOpp.id}`,
                      nameAr: (selectedOpp.contacts?.full_name_ar || selectedOpp.contacts?.full_name_en || `فرصة #${selectedOpp.id}`),
                      path: `/crm/opportunities?highlight=${selectedOpp.id}`,
                    });
                  }}
                  className="bg-transparent border-none cursor-pointer p-1 rounded-md hover:bg-brand-500/10 transition-colors"
                  style={{ color: oppIsFav ? '#F59E0B' : undefined }}
                  title={oppIsFav ? (isRTL ? 'إزالة من المفضلة' : 'Remove from Favorites') : (isRTL ? 'إضافة للمفضلة' : 'Add to Favorites')}
                >
                  <Star size={15} fill={oppIsFav ? '#F59E0B' : 'none'} />
                </button>
              );
            })()}
            {selectedOpp.contact_id && (
              <button
                onClick={() => navigate(`/crm/contacts?highlight=${selectedOpp.contact_id}`)}
                className="bg-transparent border-none cursor-pointer text-brand-500 p-1 rounded-md hover:bg-brand-500/10 transition-colors"
                title={isRTL ? 'عرض بيانات العميل' : 'View Contact'}
              >
                <ExternalLink size={15} />
              </button>
            )}
            <button
              onClick={() => editingOpp ? setEditingOpp(false) : startEdit()}
              className="bg-transparent border-none cursor-pointer text-brand-500 p-1 rounded-md hover:bg-brand-500/10 transition-colors"
              title={isRTL ? 'تعديل' : 'Edit'}
            >
              <Pencil size={16} />
            </button>
            <button
              onClick={() => { onDelete(selectedOpp.id); }}
              className="bg-transparent border-none cursor-pointer text-red-400 p-1 rounded-md hover:bg-red-500/10 transition-colors"
              title={isRTL ? 'حذف' : 'Delete'}
            >
              <Trash2 size={15} />
            </button>
            {handlePrev && (
              <button onClick={handlePrev} title={isRTL ? 'السابق' : 'Previous'}
                className="bg-transparent border-none cursor-pointer text-content-muted dark:text-content-muted-dark p-1 rounded-md hover:bg-brand-500/10 transition-colors">
                <ChevronUp size={16} />
              </button>
            )}
            {handleNext && (
              <button onClick={handleNext} title={isRTL ? 'التالي' : 'Next'}
                className="bg-transparent border-none cursor-pointer text-content-muted dark:text-content-muted-dark p-1 rounded-md hover:bg-brand-500/10 transition-colors">
                <ChevronDown size={16} />
              </button>
            )}
            <button
              onClick={closeDrawer}
              className="bg-transparent border-none cursor-pointer text-content-muted dark:text-content-muted-dark text-xl leading-none p-1 hover:text-content dark:hover:text-content-dark transition-colors"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Contact Quick Actions */}
        {!editingOpp && selectedOpp.contacts && (
          <div className="px-6 py-3 border-b border-edge dark:border-edge-dark">
            <div className="flex gap-2 flex-wrap">
              {selectedOpp.contacts.phone && (
                <a href={`tel:${selectedOpp.contacts.phone}`} dir="ltr" className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg bg-brand-500/10 text-brand-600 dark:text-brand-400 no-underline hover:bg-brand-500/20 transition-colors font-semibold">
                  <Phone size={13} /> {selectedOpp.contacts.phone}
                </a>
              )}
              {selectedOpp.contacts.phone2 && (
                <a href={`tel:${selectedOpp.contacts.phone2}`} dir="ltr" className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg bg-brand-500/10 text-brand-600 dark:text-brand-400 no-underline hover:bg-brand-500/20 transition-colors font-semibold">
                  <Phone size={13} /> {selectedOpp.contacts.phone2}
                </a>
              )}
              {selectedOpp.contacts.phone && (<>
                <button
                  onClick={() => { navigator.clipboard.writeText(selectedOpp.contacts.phone); setCopyToast(isRTL ? 'تم نسخ الرقم' : 'Phone copied'); setTimeout(() => setCopyToast(null), 2000); }}
                  className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg bg-gray-100 dark:bg-white/10 text-content-muted dark:text-content-muted-dark border-none cursor-pointer hover:bg-gray-200 dark:hover:bg-white/15 transition-colors font-semibold font-cairo"
                  title={isRTL ? 'نسخ الرقم' : 'Copy phone'}
                >
                  📋
                </button>
                <a href={`https://wa.me/${(selectedOpp.contacts.phone || '').replace(/[^0-9]/g, '')}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 no-underline hover:bg-emerald-500/20 transition-colors font-semibold">
                  <MessageCircle size={13} /> WhatsApp
                </a>
              </>)}
              {selectedOpp.contacts.email && (
                <a href={`mailto:${selectedOpp.contacts.email}`} className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 no-underline hover:bg-blue-500/20 transition-colors font-semibold">
                  <Mail size={13} /> {selectedOpp.contacts.email}
                </a>
              )}
            </div>
            {/* Extra info row */}
            <div className="flex gap-2 flex-wrap mt-2">
              {selectedOpp.contacts.source && (
                <span className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-md bg-gray-100 dark:bg-white/5 text-content-muted dark:text-content-muted-dark">
                  <ExternalLink size={9} /> {isRTL ? (sourceLabelsMap[selectedOpp.contacts.source]?.ar || selectedOpp.contacts.source) : (sourceLabelsMap[selectedOpp.contacts.source]?.en || selectedOpp.contacts.source)}
                </span>
              )}
              {selectedOpp.contacts.preferred_location && (
                <span className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-md bg-gray-100 dark:bg-white/5 text-content-muted dark:text-content-muted-dark">
                  <MapPin size={9} /> {selectedOpp.contacts.preferred_location}
                </span>
              )}
              {selectedOpp.contacts.nationality && (
                <span className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-md bg-gray-100 dark:bg-white/5 text-content-muted dark:text-content-muted-dark">
                  {isRTL ? ({egyptian:'مصري',saudi:'سعودي',emirati:'إماراتي',kuwaiti:'كويتي',qatari:'قطري',libyan:'ليبي',other:'أخرى'}[selectedOpp.contacts.nationality] || selectedOpp.contacts.nationality) : selectedOpp.contacts.nationality}
                </span>
              )}
              {selectedOpp.contacts.gender && (
                <span className="text-[10px] px-2 py-1 rounded-md bg-gray-100 dark:bg-white/5 text-content-muted dark:text-content-muted-dark">
                  {isRTL ? (selectedOpp.contacts.gender === 'male' ? 'ذكر' : 'أنثى') : selectedOpp.contacts.gender}
                </span>
              )}
              {selectedOpp.contacts.birth_date && (
                <span className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-md bg-gray-100 dark:bg-white/5 text-content-muted dark:text-content-muted-dark">
                  <Calendar size={9} /> {new Date(selectedOpp.contacts.birth_date).toLocaleDateString(isRTL ? 'ar-EG' : 'en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                </span>
              )}
              {selectedOpp.contacts.budget_min && (
                <span className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-md bg-gray-100 dark:bg-white/5 text-content-muted dark:text-content-muted-dark">
                  <Banknote size={9} /> {fmtBudget(selectedOpp.contacts.budget_min)} - {fmtBudget(selectedOpp.contacts.budget_max)}
                </span>
              )}
              {selectedOpp.contacts.interested_in_type && (
                <span className="text-[10px] px-2 py-1 rounded-md bg-gray-100 dark:bg-white/5 text-content-muted dark:text-content-muted-dark">
                  {isRTL ? ({residential:'سكني',commercial:'تجاري',administrative:'إداري'}[selectedOpp.contacts.interested_in_type] || selectedOpp.contacts.interested_in_type) : selectedOpp.contacts.interested_in_type}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Drawer Details */}
        <div className="px-6 py-5 flex flex-col gap-4">
          {editingOpp ? (<>
            {/* Edit Mode */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-content-muted dark:text-content-muted-dark mb-1 block">{isRTL ? 'الميزانية' : 'Budget'}</label>
                <Input type="number" min="0" value={editForm.budget} onChange={e => setEditForm(f => ({ ...f, budget: Math.max(0, e.target.value) }))} />
              </div>
              <div>
                <label className="text-xs font-semibold text-content-muted dark:text-content-muted-dark mb-1 block">{isRTL ? 'المسؤول' : 'Agent'}</label>
                <Select value={editForm.assigned_to} onChange={e => setEditForm(f => ({ ...f, assigned_to: e.target.value }))}>
                  <option value="">{isRTL ? 'اختر...' : 'Select...'}</option>
                  {agents.map(a => <option key={a.id} value={a.id}>{lang === 'ar' ? a.full_name_ar : (a.full_name_en || a.full_name_ar)}</option>)}
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-content-muted dark:text-content-muted-dark mb-1 block">{isRTL ? 'المرحلة' : 'Stage'}</label>
                <Select value={editForm.stage} onChange={e => setEditForm(f => ({ ...f, stage: e.target.value }))}>
                  {getDeptStages(selectedOpp.contacts?.department || 'sales').map(s => <option key={s.id} value={s.id}>{isRTL ? s.label_ar : s.label_en}</option>)}
                </Select>
              </div>
              <div>
                <label className="text-xs font-semibold text-content-muted dark:text-content-muted-dark mb-1 block">{isRTL ? 'الإغلاق المتوقع' : 'Expected Close'}</label>
                <Input type="date" value={editForm.expected_close_date} onChange={e => setEditForm(f => ({ ...f, expected_close_date: e.target.value }))} />
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-content-muted dark:text-content-muted-dark mb-1 block">{isRTL ? 'المشروع' : 'Project'}</label>
              <Select value={editForm.project_id} onChange={e => setEditForm(f => ({ ...f, project_id: e.target.value }))}>
                <option value="">{isRTL ? 'بدون مشروع' : 'No Project'}</option>
                {projects.map(p => <option key={p.id} value={p.id}>{lang === 'ar' ? p.name_ar : (p.name_en || p.name_ar)}</option>)}
              </Select>
            </div>
            <div>
              <label className="text-xs font-semibold text-content-muted dark:text-content-muted-dark mb-1 block">{isRTL ? 'الحرارة' : 'Temperature'}</label>
              <div className="flex gap-1.5">
                {Object.entries(TEMP_CONFIG).map(([k, v]) => {
                  const isActive = editForm.temperature === k;
                  return (
                    <button key={k} onClick={() => setEditForm(f => ({ ...f, temperature: k }))}
                      className={`flex-1 py-[6px] rounded-[7px] cursor-pointer text-xs font-semibold font-cairo transition-all duration-150 border-2 ${isActive ? '' : 'bg-surface-input dark:bg-surface-input-dark text-content-muted dark:text-content-muted-dark border-transparent'}`}
                      style={isActive ? { borderColor: v.color, background: v.bg, color: v.color } : {}}
                    >{isRTL ? v.label_ar : v.label_en}</button>
                  );
                })}
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-content-muted dark:text-content-muted-dark mb-1 block">{isRTL ? 'الأولوية' : 'Priority'}</label>
              <div className="flex gap-1.5">
                {Object.entries(PRIORITY_CONFIG).map(([k, v]) => {
                  const isActive = editForm.priority === k;
                  return (
                    <button key={k} onClick={() => setEditForm(f => ({ ...f, priority: k }))}
                      className={`flex-1 py-[6px] rounded-[7px] cursor-pointer text-xs font-semibold font-cairo transition-all duration-150 border-2 ${isActive ? '' : 'bg-surface-input dark:bg-surface-input-dark text-content-muted dark:text-content-muted-dark border-transparent'}`}
                      style={isActive ? { borderColor: v.color, background: `${v.color}18`, color: v.color } : {}}
                    >{isRTL ? v.label_ar : v.label_en}</button>
                  );
                })}
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-content-muted dark:text-content-muted-dark mb-1 block">{isRTL ? 'ملاحظات' : 'Notes'}</label>
              <Textarea value={editForm.notes} onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))} />
            </div>
            <div className="flex gap-2">
              <Button variant="primary" size="sm" onClick={saveEdit} disabled={editSaving} className="flex-1 gap-1.5">
                {editSaving && <Loader2 size={13} className="animate-spin" />}
                {isRTL ? 'حفظ' : 'Save'}
              </Button>
              <Button variant="secondary" size="sm" onClick={() => setEditingOpp(false)} className="flex-1">
                {isRTL ? 'إلغاء' : 'Cancel'}
              </Button>
            </div>
          </>) : (<>
            {/* View Mode */}
            <div className="grid grid-cols-2 gap-2.5">
              {[
                { label: isRTL ? 'المرحلة' : 'Stage', value: deptStageLabel(selectedOpp.stage, selectedOpp.contacts?.department || 'sales', isRTL), color: (getDeptStages(selectedOpp.contacts?.department || 'sales').find(s => s.id === selectedOpp.stage)?.color || '#4A7AAB') },
                { label: isRTL ? 'الميزانية' : 'Budget', value: fmtBudget(selectedOpp.budget) + ' ' + (isRTL ? 'ج' : 'EGP'), color: '#4A7AAB' },
                { label: isRTL ? 'الحرارة' : 'Temperature', value: isRTL ? (TEMP_CONFIG[selectedOpp.temperature] || TEMP_CONFIG.cold).label_ar : (TEMP_CONFIG[selectedOpp.temperature] || TEMP_CONFIG.cold).label_en, color: (TEMP_CONFIG[selectedOpp.temperature] || TEMP_CONFIG.cold).color },
                { label: isRTL ? 'الأولوية' : 'Priority', value: isRTL ? (PRIORITY_CONFIG[selectedOpp.priority] || PRIORITY_CONFIG.medium).label_ar : (PRIORITY_CONFIG[selectedOpp.priority] || PRIORITY_CONFIG.medium).label_en, color: (PRIORITY_CONFIG[selectedOpp.priority] || PRIORITY_CONFIG.medium).color },
                { label: isRTL ? 'المسؤول' : 'Agent', value: getAgentName(selectedOpp, lang), color: isDark ? '#E2EAF4' : '#1B3347' },
                { label: isRTL ? 'تم التعيين بواسطة' : 'Assigned By', value: (() => { if (!selectedOpp.assigned_by) return '—'; const a = agents.find(ag => ag.id === selectedOpp.assigned_by); return a ? (lang === 'ar' ? a.full_name_ar : (a.full_name_en || a.full_name_ar)) : '—'; })(), color: '#6B8DB5' },
                { label: isRTL ? 'في المرحلة منذ' : 'In Stage', value: daysInStage(selectedOpp) + (isRTL ? ' يوم' : ' days'), color: daysInStage(selectedOpp) > 7 ? '#EF4444' : daysInStage(selectedOpp) > 3 ? '#F59E0B' : '#6B8DB5' },
                ...(selectedOpp.expected_close_date ? [{ label: isRTL ? 'الإغلاق المتوقع' : 'Expected Close', value: new Date(selectedOpp.expected_close_date).toLocaleDateString(isRTL ? 'ar-EG' : 'en-US', { month: 'short', day: 'numeric', year: 'numeric' }), color: new Date(selectedOpp.expected_close_date) < new Date() ? '#EF4444' : '#6B8DB5' }] : []),
                ...((selectedOpp.contacts?.source || selectedOpp.source) ? [{ label: isRTL ? 'المصدر' : 'Source', value: (() => { const src = selectedOpp.contacts?.source || selectedOpp.source; return isRTL ? (sourceLabelsMap[src]?.ar || src) : (sourceLabelsMap[src]?.en || src); })(), color: '#6B8DB5' }] : []),
                { label: isRTL ? 'عدد فرص العميل' : 'Client Opps', value: opps.filter(o => o.contact_id === selectedOpp.contact_id).length, color: '#6B8DB5' },
              ].map((item, i) => (
                <div key={i} className="bg-brand-500/[0.08] dark:bg-brand-500/[0.08] rounded-xl px-3.5 py-3">
                  <p className="m-0 mb-1 text-xs text-content-muted dark:text-content-muted-dark">{item.label}</p>
                  <p className="m-0 text-sm font-bold" style={{ color: item.color }}>{item.value}</p>
                </div>
              ))}
            </div>

            {/* Project */}
            {getProjectName(selectedOpp, lang) && (
              <div className="bg-brand-500/[0.08] dark:bg-brand-500/[0.08] rounded-xl px-3.5 py-3">
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

            {/* Notes */}
            {selectedOpp.notes && (
              <div className="bg-brand-500/[0.08] dark:bg-brand-500/[0.08] rounded-xl px-3.5 py-3">
                <p className="m-0 mb-1 text-xs text-content-muted dark:text-content-muted-dark">{isRTL ? 'ملاحظات' : 'Notes'}</p>
                <p className="m-0 text-xs text-content dark:text-content-dark leading-relaxed">{selectedOpp.notes}</p>
              </div>
            )}
          </>)}

          {/* Pipeline Stepper */}
          <div>
            {(() => {
              const stages = getDeptStages(selectedOpp.contacts?.department || 'sales');
              const currentIdx = stages.findIndex(st => st.id === selectedOpp.stage);
              const progressPct = stages.length > 1 ? Math.round((Math.max(0, currentIdx) / (stages.length - 1)) * 100) : 0;
              const isLost = selectedOpp.stage === 'closed_lost';
              return (<>
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
                    const isBackward = !isAdmin && i < currentIdx;
                    return (
                      <div key={s.id} className="flex items-start flex-1 min-w-0">
                        <button
                          onClick={() => !isBackward && onMove(selectedOpp.id, s.id)}
                          className={`flex flex-col items-center gap-1 bg-transparent border-none w-full group p-0 ${isBackward ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
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
              </>);
            })()}
          </div>

          {/* Activities Timeline */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="m-0 text-xs font-semibold text-content-muted dark:text-content-muted-dark">
                {isRTL ? 'آخر الأنشطة' : 'Recent Activities'}
              </p>
              <button
                onClick={() => setShowAddActivity(a => !a)}
                className="text-[10px] text-brand-500 bg-brand-500/10 border-none rounded-md px-2 py-1 cursor-pointer hover:bg-brand-500/20 transition-colors font-cairo font-semibold"
              >
                <Plus size={10} className="inline -mt-px" /> {isRTL ? 'سجّل نشاط' : 'Log Activity'}
              </button>
            </div>
            {showAddActivity && (
              <div className="bg-brand-500/[0.06] rounded-xl p-3 mb-3 border border-brand-500/10">
                {/* Activity Type Buttons (from config) */}
                <div className="flex gap-1.5 mb-2 flex-wrap">
                  {(configActivityTypes || []).map(at => {
                    const Icon = ACTIVITY_ICON_MAP[at.key] || ACTIVITY_ICONS[at.key] || Clock;
                    return (
                      <button
                        key={at.key}
                        onClick={() => setActivityForm(f => ({ ...f, type: at.key, result: '' }))}
                        className={`flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-semibold font-cairo border-none cursor-pointer transition-colors ${
                          activityForm.type === at.key
                            ? 'bg-brand-500 text-white'
                            : 'bg-white dark:bg-surface-input-dark text-content-muted dark:text-content-muted-dark'
                        }`}
                      >
                        <Icon size={10} />{isRTL ? at.label_ar : at.label_en}
                      </button>
                    );
                  })}
                </div>
                {/* Activity Result Buttons (from config) */}
                {configActivityResults[activityForm.type] && configActivityResults[activityForm.type].length > 0 && (
                  <div className="mb-2">
                    <p className="m-0 mb-1 text-[10px] font-semibold text-content-muted dark:text-content-muted-dark">{isRTL ? 'النتيجة' : 'Result'}</p>
                    <div className="flex gap-1 flex-wrap">
                      {configActivityResults[activityForm.type].map(r => (
                        <button
                          key={r.value}
                          onClick={() => setActivityForm(f => ({ ...f, result: f.result === r.value ? '' : r.value }))}
                          className={`px-2 py-1 rounded-md text-[10px] font-semibold font-cairo border-2 cursor-pointer transition-all ${
                            activityForm.result === r.value
                              ? ''
                              : 'border-transparent bg-white dark:bg-surface-input-dark text-content-muted dark:text-content-muted-dark'
                          }`}
                          style={activityForm.result === r.value ? { borderColor: r.color, background: `${r.color}18`, color: r.color } : {}}
                        >
                          {isRTL ? r.label_ar : r.label_en}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                <Input
                  value={activityForm.description}
                  onChange={e => setActivityForm(f => ({ ...f, description: e.target.value }))}
                  placeholder={isRTL ? 'وصف النشاط...' : 'Activity description...'}
                  className="mb-2 text-xs"
                />
                <div className="flex gap-2">
                  <Button size="sm" onClick={async () => {
                    if (!activityForm.description.trim()) return;
                    const act = await createActivity({
                      type: activityForm.type,
                      description: activityForm.description,
                      result: activityForm.result || null,
                      contact_id: selectedOpp.contact_id,
                      entity_type: 'opportunity',
                      entity_id: selectedOpp.id,
                    });
                    setDrawerActivities(prev => [act, ...prev].slice(0, 5));
                    setActivityForm({ type: 'call', description: '', result: '' });
                    setShowAddActivity(false);
                  }}>
                    {isRTL ? 'حفظ' : 'Save'}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setShowAddActivity(false)}>
                    {isRTL ? 'إلغاء' : 'Cancel'}
                  </Button>
                </div>
              </div>
            )}
            {loadingActivities ? (
              <div className="text-center py-4 text-xs text-content-muted dark:text-content-muted-dark"><Loader2 size={16} className="animate-spin inline-block" /></div>
            ) : drawerActivities.length === 0 ? (
              <div className="text-center py-4 text-xs text-content-muted dark:text-content-muted-dark opacity-60">
                <Clock size={20} className="opacity-30 mb-1 mx-auto" />
                <p className="m-0">{isRTL ? 'لا توجد أنشطة' : 'No activities'}</p>
              </div>
            ) : drawerActivities.map(act => {
              const ActIcon = ACTIVITY_ICON_MAP[act.type] || ACTIVITY_ICONS[act.type] || Clock;
              const resultConfig = act.result && configActivityResults[act.type]?.find(r => r.value === act.result);
              return (
                <div key={act.id} className="bg-brand-500/[0.06] border border-brand-500/[0.12] rounded-xl p-3 mb-2">
                  <div className="flex items-start gap-2 mb-1">
                    <div className="w-[24px] h-[24px] rounded-[6px] bg-brand-500/10 flex items-center justify-center shrink-0 mt-px">
                      <ActIcon size={12} color="#4A7AAB" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-content dark:text-content-dark text-xs font-semibold">{act.description}</span>
                        {resultConfig && (
                          <span className="text-[9px] font-bold px-1.5 py-px rounded-md" style={{ background: `${resultConfig.color}18`, color: resultConfig.color }}>
                            {isRTL ? resultConfig.label_ar : resultConfig.label_en}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex justify-between text-[10px] text-content-muted dark:text-content-muted-dark ps-8">
                    <span>{isRTL ? (act.users?.full_name_ar || '—') : (act.users?.full_name_en || act.users?.full_name_ar || '—')}</span>
                    <span>{act.created_at?.slice(0, 10)}</span>
                  </div>
                </div>
              );
            })}
            {drawerActivities.length > 0 && selectedOpp.contact_id && (
              <button
                onClick={() => navigate(`/crm/contacts?highlight=${selectedOpp.contact_id}`)}
                className="text-[10px] text-brand-500 bg-transparent border-none cursor-pointer hover:underline font-cairo font-semibold mt-1 p-0"
              >
                {isRTL ? 'عرض كل الأنشطة →' : 'View all activities →'}
              </button>
            )}
          </div>

          {/* Notes Timeline */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="m-0 text-xs font-semibold text-content-muted dark:text-content-muted-dark">
                <StickyNote size={12} className="inline -mt-px" /> {isRTL ? 'الملاحظات' : 'Notes'}
              </p>
              <button
                onClick={() => setShowNotes(n => !n)}
                className="text-[10px] text-brand-500 bg-brand-500/10 border-none rounded-md px-2 py-1 cursor-pointer hover:bg-brand-500/20 transition-colors font-cairo font-semibold"
              >
                {showNotes ? (isRTL ? 'إخفاء' : 'Hide') : (isRTL ? 'عرض' : 'Show')} ({drawerNotes.length})
              </button>
            </div>
            {showNotes && (
              <>
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
                    <div className="flex items-start justify-between gap-2">
                      <p className="m-0 text-xs text-content dark:text-content-dark leading-relaxed flex-1">{n.text}</p>
                      <button onClick={() => { deleteOppNote(selectedOpp.id, n.id); setDrawerNotes(prev => prev.filter(x => x.id !== n.id)); }} className="bg-transparent border-none cursor-pointer text-red-400 p-0 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"><X size={11} /></button>
                    </div>
                    <p className="m-0 mt-1 text-[10px] text-content-muted dark:text-content-muted-dark">{new Date(n.at).toLocaleDateString(isRTL ? 'ar-EG' : 'en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                  </div>
                ))}
              </>
            )}
          </div>

          {/* Stage History */}
          {stageHistory.length > 0 && (
            <div>
              <p className="m-0 mb-2 text-xs font-semibold text-content-muted dark:text-content-muted-dark">
                {isRTL ? 'سجل المراحل' : 'Stage History'}
              </p>
              <div className="space-y-1">
                {stageHistory.slice(0, 5).map((h, i) => {
                  const stages = getDeptStages(selectedOpp.contacts?.department || 'sales');
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

          {/* Lead Score */}
          {!editingOpp && (
            <div className="bg-brand-500/[0.08] rounded-xl px-3.5 py-3">
              <p className="m-0 mb-1.5 text-xs text-content-muted dark:text-content-muted-dark">{isRTL ? 'درجة العميل' : 'Lead Score'}</p>
              {(() => {
                const score = scoreMap[selectedOpp.id] ?? calcLeadScore(selectedOpp);
                return (
                  <div className="flex items-center gap-3">
                    <div className="flex-1 h-2 bg-gray-200 dark:bg-white/10 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-500" style={{ width: `${score}%`, background: scoreColor(score) }} />
                    </div>
                    <span className="text-sm font-bold" style={{ color: scoreColor(score) }}>{score}</span>
                    <span className="text-[10px] font-semibold" style={{ color: scoreColor(score) }}>{scoreLabel(score, isRTL)}</span>
                  </div>
                );
              })()}
            </div>
          )}

          {/* Documents */}
          <DocumentsSection
            entity="opportunity"
            entityId={selectedOpp.id}
            entityName={getContactName(selectedOpp)}
          />

          {/* Comments */}
          <CommentsSection
            entity="opportunity"
            entityId={selectedOpp.id}
            entityName={getContactName(selectedOpp)}
          />

          {/* Follow Up Reminder */}
          <FollowUpReminder entityType="opportunity" entityId={String(selectedOpp.id)} entityName={getContactName(selectedOpp)} />
        </div>
      </div>
      <div className="flex-1" onClick={closeDrawer} />

      {/* Copy Toast */}
      {copyToast && (
        <div className="fixed bottom-6 z-[300] bg-gradient-to-br from-brand-500 to-brand-600 text-white px-5 py-3 rounded-xl shadow-lg flex items-center gap-2 text-sm font-semibold animate-[slideUp_0.3s_ease-out]"
          style={{ [isRTL ? 'right' : 'left']: 24 }}>
          {copyToast}
        </div>
      )}
    </div>
  );
}
