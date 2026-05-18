import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useToast } from '../../contexts/ToastContext';
import { Users, Crown, UserCheck, User, Plus, Pencil, Trash2, ChevronDown, ChevronRight, Building2, X } from 'lucide-react';
import { Button, Card, PageSkeleton, Modal, ModalFooter } from '../../components/ui';
import Input, { Select } from '../../components/ui/Input';
import supabase from '../../lib/supabase';

const ROLE_ICONS = {
  admin: Crown,
  sales_director: Crown,
  sales_manager: Crown,
  team_leader: UserCheck,
  sales_agent: User,
  operations: User,
  hr: User,
  marketing: User,
  finance: User,
};

const ROLE_COLORS = {
  admin: '#EF4444',
  sales_director: '#8B5CF6',
  sales_manager: '#4A7AAB',
  team_leader: '#F59E0B',
  sales_agent: '#6B8DB5',
  operations: '#6366F1',
  hr: '#14B8A6',
  marketing: '#EC4899',
  finance: '#F97316',
};

const ROLE_LABELS = {
  admin: { ar: 'مدير', en: 'Admin' },
  sales_director: { ar: 'مدير مبيعات', en: 'Director' },
  sales_manager: { ar: 'سيلز مانجر', en: 'Manager' },
  team_leader: { ar: 'تيم ليدر', en: 'TL' },
  sales_agent: { ar: 'سيلز', en: 'Agent' },
  operations: { ar: 'عمليات', en: 'Ops' },
  hr: { ar: 'HR', en: 'HR' },
  marketing: { ar: 'تسويق', en: 'Marketing' },
  finance: { ar: 'مالية', en: 'Finance' },
};

export default function TeamHierarchyPage() {
  const { i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const lang = i18n.language;
  const toast = useToast();

  const [departments, setDepartments] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState({});

  // Dept modal
  const [deptModal, setDeptModal] = useState(null); // null | 'add' | dept object
  const [deptForm, setDeptForm] = useState({ name_ar: '', name_en: '', parent_id: null });
  const [saving, setSaving] = useState(false);

  // Move user
  const [moveUser, setMoveUser] = useState(null);
  const [moveTarget, setMoveTarget] = useState('');

  // ── "New team + members" wizard ─────────────────────────────────────
  // Single-modal flow that operations uses instead of: create dept →
  // edit user → set team_id (× N users). Inserts the department then
  // batch-updates every picked user in one transaction-shaped flow.
  // If the user-update step fails after the dept is created, we delete
  // the orphan dept so we never leave a half-applied wizard run.
  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardForm, setWizardForm] = useState({
    name_ar: '', name_en: '', parent_id: null,
    leader_id: '',           // single team_leader / sales_manager
    member_ids: new Set(),   // sales_agents
  });
  const [wizardSearch, setWizardSearch] = useState('');
  const [wizardSaving, setWizardSaving] = useState(false);

  const openWizard = (parentId = null) => {
    setWizardForm({
      name_ar: '', name_en: '',
      parent_id: parentId,
      leader_id: '',
      member_ids: new Set(),
    });
    setWizardSearch('');
    setWizardOpen(true);
  };

  const toggleWizardMember = (uid) => {
    setWizardForm(f => {
      const next = new Set(f.member_ids);
      if (next.has(uid)) next.delete(uid); else next.add(uid);
      return { ...f, member_ids: next };
    });
  };

  const saveWizard = async () => {
    if (!wizardForm.name_ar && !wizardForm.name_en) {
      toast.error(isRTL ? 'اكتب اسم الفريق' : 'Team name required');
      return;
    }
    setWizardSaving(true);
    let createdId = null;
    try {
      // 1. Create the department
      const { data: dept, error: deptErr } = await supabase
        .from('departments')
        .insert([{
          name_ar: wizardForm.name_ar,
          name_en: wizardForm.name_en,
          parent_id: wizardForm.parent_id || null,
          created_at: new Date().toISOString(),
        }])
        .select('*')
        .single();
      if (deptErr) throw deptErr;
      createdId = dept.id;

      // 2. Build the user-id list (leader + members, deduped)
      const toAssign = new Set(wizardForm.member_ids);
      if (wizardForm.leader_id) toAssign.add(wizardForm.leader_id);

      if (toAssign.size > 0) {
        const { error: updErr } = await supabase
          .from('users')
          .update({ team_id: createdId })
          .in('id', [...toAssign]);
        if (updErr) throw updErr;
      }

      // 3. Refresh + close
      setDepartments(prev => [...prev, dept]);
      setUsers(prev => prev.map(u => toAssign.has(u.id) ? { ...u, team_id: createdId } : u));
      // Auto-expand the new team so the user sees the assignments landed
      setExpanded(prev => ({ ...prev, [createdId]: true, ...(wizardForm.parent_id ? { [wizardForm.parent_id]: true } : {}) }));
      toast.success(isRTL
        ? `تم إنشاء الفريق وتعيين ${toAssign.size} عضو`
        : `Team created and ${toAssign.size} member(s) assigned`);
      setWizardOpen(false);
    } catch (err) {
      // Rollback the orphan dept so the next run doesn't see a half-applied state
      if (createdId) {
        try { await supabase.from('departments').delete().eq('id', createdId); } catch { /* best-effort */ }
      }
      toast.error((isRTL ? 'فشل: ' : 'Failed: ') + (err?.message || ''));
    }
    setWizardSaving(false);
  };

  // Filter for the wizard member picker — only show roles that make sense
  // on a sales team (agents + leaders), exclude inactive, exclude anyone
  // already on this team OR anywhere if we want the picker to be a
  // "move from current team" affordance. Here we surface ALL eligible users
  // (with a hint of their current team) so the operator picks freely.
  const wizardEligibleUsers = useMemo(() => {
    const list = users.filter(u =>
      ['sales_agent', 'team_leader', 'sales_manager'].includes(u.role)
      && u.status !== 'inactive'
    );
    if (!wizardSearch.trim()) return list;
    const q = wizardSearch.toLowerCase();
    return list.filter(u =>
      (u.full_name_en || '').toLowerCase().includes(q) ||
      (u.full_name_ar || '').toLowerCase().includes(q)
    );
  }, [users, wizardSearch]);
  const wizardLeaderCandidates = useMemo(
    () => wizardEligibleUsers.filter(u => u.role === 'team_leader' || u.role === 'sales_manager'),
    [wizardEligibleUsers]
  );
  const teamNameById = useMemo(() => {
    const m = {};
    departments.forEach(d => { m[d.id] = isRTL ? (d.name_ar || d.name_en) : (d.name_en || d.name_ar); });
    return m;
  }, [departments, isRTL]);

  const load = async () => {
    setLoading(true);
    try {
      const [{ data: depts }, { data: usrs }] = await Promise.all([
        supabase.from('departments').select('*').order('name_en'),
        supabase.from('users').select('id, full_name_en, full_name_ar, role, team_id, status').neq('status', 'deleted').order('full_name_en'),
      ]);
      setDepartments(depts || []);
      setUsers(usrs || []);
      // Auto-expand root departments
      const initial = {};
      (depts || []).filter(d => !d.parent_id).forEach(d => { initial[d.id] = true; });
      setExpanded(initial);
    } catch (err) {
      toast.error(isRTL ? 'فشل التحميل' : 'Failed to load');
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const tree = useMemo(() => {
    const byParent = {};
    departments.forEach(d => {
      const key = d.parent_id || 'root';
      if (!byParent[key]) byParent[key] = [];
      byParent[key].push(d);
    });
    return byParent;
  }, [departments]);

  const usersByTeam = useMemo(() => {
    const map = {};
    users.forEach(u => {
      const key = u.team_id || 'unassigned';
      if (!map[key]) map[key] = [];
      map[key].push(u);
    });
    // Sort: manager first, TL next, agents last
    const rolePriority = { admin: 0, sales_director: 1, sales_manager: 2, team_leader: 3 };
    Object.values(map).forEach(list => {
      list.sort((a, b) => (rolePriority[a.role] ?? 99) - (rolePriority[b.role] ?? 99) || a.full_name_en?.localeCompare(b.full_name_en));
    });
    return map;
  }, [users]);

  const unassignedUsers = usersByTeam.unassigned || [];

  const toggleExpand = (id) => setExpanded(prev => ({ ...prev, [id]: !prev[id] }));

  const openAddDept = (parentId = null) => {
    setDeptForm({ name_ar: '', name_en: '', parent_id: parentId });
    setDeptModal('add');
  };

  const openEditDept = (dept) => {
    setDeptForm({ name_ar: dept.name_ar || '', name_en: dept.name_en || '', parent_id: dept.parent_id });
    setDeptModal(dept);
  };

  const saveDept = async () => {
    if (!deptForm.name_ar && !deptForm.name_en) {
      toast.error(isRTL ? 'اكتب الاسم' : 'Name required');
      return;
    }
    setSaving(true);
    try {
      if (deptModal === 'add') {
        const { data, error } = await supabase.from('departments').insert([{ ...deptForm, created_at: new Date().toISOString() }]).select('*').single();
        if (error) throw error;
        setDepartments(prev => [...prev, data]);
        toast.success(isRTL ? 'تم الإضافة' : 'Added');
      } else {
        const { data, error } = await supabase.from('departments').update(deptForm).eq('id', deptModal.id).select('*').single();
        if (error) throw error;
        setDepartments(prev => prev.map(d => d.id === data.id ? data : d));
        toast.success(isRTL ? 'تم التحديث' : 'Updated');
      }
      setDeptModal(null);
    } catch (err) {
      toast.error((isRTL ? 'فشل الحفظ: ' : 'Save failed: ') + err.message);
    }
    setSaving(false);
  };

  const deleteDept = async (dept) => {
    // Check if has child teams or users
    const hasChildren = departments.some(d => d.parent_id === dept.id);
    const hasUsers = users.some(u => u.team_id === dept.id);
    if (hasChildren) {
      toast.error(isRTL ? 'احذف الفرق الفرعية أولاً' : 'Delete child teams first');
      return;
    }
    if (hasUsers) {
      toast.error(isRTL ? 'انقل المستخدمين أولاً' : 'Move users first');
      return;
    }
    if (!confirm(isRTL ? `حذف "${dept.name_ar || dept.name_en}"؟` : `Delete "${dept.name_en || dept.name_ar}"?`)) return;
    try {
      const { error } = await supabase.from('departments').delete().eq('id', dept.id);
      if (error) throw error;
      setDepartments(prev => prev.filter(d => d.id !== dept.id));
      toast.success(isRTL ? 'تم الحذف' : 'Deleted');
    } catch (err) {
      toast.error(isRTL ? 'فشل الحذف' : 'Delete failed');
    }
  };

  const handleMoveUser = async () => {
    if (!moveUser) return;
    try {
      const newTeamId = moveTarget || null;
      const { error } = await supabase.from('users').update({ team_id: newTeamId }).eq('id', moveUser.id);
      if (error) throw error;
      setUsers(prev => prev.map(u => u.id === moveUser.id ? { ...u, team_id: newTeamId } : u));
      toast.success(isRTL ? 'تم النقل' : 'Moved');
      setMoveUser(null); setMoveTarget('');
    } catch (err) {
      toast.error(isRTL ? 'فشل النقل' : 'Move failed');
    }
  };

  // Recursive department node
  const DeptNode = ({ dept, depth = 0 }) => {
    const children = tree[dept.id] || [];
    const teamUsers = usersByTeam[dept.id] || [];
    const isExpanded = expanded[dept.id];
    const hasContent = children.length > 0 || teamUsers.length > 0;
    const totalMembers = teamUsers.length + children.reduce((sum, c) => sum + (usersByTeam[c.id]?.length || 0), 0);

    return (
      <div className="mb-1">
        <div
          className="flex items-center gap-2 py-2 px-3 rounded-lg hover:bg-brand-500/[0.05] transition-colors group"
          style={{ marginInlineStart: depth * 20 }}
        >
          <button
            onClick={() => toggleExpand(dept.id)}
            disabled={!hasContent}
            className={`w-5 h-5 flex items-center justify-center bg-transparent border-none ${hasContent ? 'cursor-pointer text-content-muted dark:text-content-muted-dark' : 'opacity-30'}`}
          >
            {hasContent ? (isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />) : '·'}
          </button>
          <Building2 size={14} className="text-brand-500 shrink-0" />
          <span className="text-sm font-bold text-content dark:text-content-dark">{isRTL ? (dept.name_ar || dept.name_en) : (dept.name_en || dept.name_ar)}</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-brand-500/10 text-brand-500 font-semibold">{totalMembers}</span>
          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity ms-auto">
            <button onClick={() => openAddDept(dept.id)} title={isRTL ? 'إضافة فريق فرعي' : 'Add sub-team'}
              className="w-6 h-6 rounded flex items-center justify-center bg-transparent border border-edge dark:border-edge-dark text-content-muted dark:text-content-muted-dark cursor-pointer hover:border-brand-500 hover:text-brand-500">
              <Plus size={11} />
            </button>
            <button onClick={() => openEditDept(dept)} title={isRTL ? 'تعديل' : 'Edit'}
              className="w-6 h-6 rounded flex items-center justify-center bg-transparent border border-edge dark:border-edge-dark text-content-muted dark:text-content-muted-dark cursor-pointer hover:border-brand-500 hover:text-brand-500">
              <Pencil size={11} />
            </button>
            <button onClick={() => deleteDept(dept)} title={isRTL ? 'حذف' : 'Delete'}
              className="w-6 h-6 rounded flex items-center justify-center bg-transparent border border-edge dark:border-edge-dark text-content-muted dark:text-content-muted-dark cursor-pointer hover:border-red-500 hover:text-red-500">
              <Trash2 size={11} />
            </button>
          </div>
        </div>
        {isExpanded && (
          <>
            {/* Users in this team */}
            {teamUsers.map(u => {
              const RoleIcon = ROLE_ICONS[u.role] || User;
              const color = ROLE_COLORS[u.role] || '#6B8DB5';
              return (
                <div
                  key={u.id}
                  className="flex items-center gap-2 py-1.5 px-3 rounded-lg hover:bg-surface-bg dark:hover:bg-surface-bg-dark group"
                  style={{ marginInlineStart: (depth + 1) * 20 + 24 }}
                >
                  <RoleIcon size={12} style={{ color }} className="shrink-0" />
                  <span className="text-xs text-content dark:text-content-dark">{isRTL ? (u.full_name_ar || u.full_name_en) : (u.full_name_en || u.full_name_ar)}</span>
                  <span className="text-[9px] px-1.5 py-0.5 rounded-full font-semibold" style={{ color, background: color + '18' }}>
                    {ROLE_LABELS[u.role] ? (isRTL ? ROLE_LABELS[u.role].ar : ROLE_LABELS[u.role].en) : u.role}
                  </span>
                  <button onClick={() => { setMoveUser(u); setMoveTarget(u.team_id || ''); }}
                    className="ms-auto opacity-0 group-hover:opacity-100 transition-opacity text-[10px] text-brand-500 bg-brand-500/10 px-2 py-0.5 rounded border-none cursor-pointer hover:bg-brand-500/20">
                    {isRTL ? 'نقل' : 'Move'}
                  </button>
                </div>
              );
            })}
            {/* Child departments */}
            {children.map(c => <DeptNode key={c.id} dept={c} depth={depth + 1} />)}
          </>
        )}
      </div>
    );
  };

  if (loading) return <div className="p-5"><PageSkeleton hasKpis tableRows={6} tableCols={3} /></div>;

  const rootDepts = tree.root || [];

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} className="px-4 py-4 md:px-7 md:py-6 bg-surface-bg dark:bg-surface-bg-dark min-h-screen">
      <div className="flex justify-between items-center mb-5">
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-brand-500/[0.12] flex items-center justify-center">
            <Users size={22} className="text-brand-500" />
          </div>
          <div>
            <h1 className="m-0 text-xl font-bold text-content dark:text-content-dark">{isRTL ? 'هيكل الفرق' : 'Team Hierarchy'}</h1>
            <p className="m-0 text-xs text-content-muted dark:text-content-muted-dark">{isRTL ? 'إدارة الفرق والأعضاء' : 'Manage teams and members'}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="primary" onClick={() => openWizard(null)}>
            <Plus size={14} /> {isRTL ? 'فريق + أعضاء' : 'Team + Members'}
          </Button>
          <Button variant="secondary" onClick={() => openAddDept(null)}>
            <Plus size={14} /> {isRTL ? 'فريق فاضي' : 'Empty Team'}
          </Button>
        </div>
      </div>

      <Card className="p-4 mb-4">
        <div className="text-xs font-bold text-content dark:text-content-dark mb-3">{isRTL ? 'الهيكل التنظيمي' : 'Organization Structure'}</div>
        {rootDepts.length === 0 ? (
          <div className="text-center py-8 text-content-muted dark:text-content-muted-dark text-sm">{isRTL ? 'لا توجد فرق' : 'No teams'}</div>
        ) : (
          rootDepts.map(d => <DeptNode key={d.id} dept={d} />)
        )}
      </Card>

      {unassignedUsers.length > 0 && (
        <Card className="p-4">
          <div className="text-xs font-bold text-content dark:text-content-dark mb-3 flex items-center gap-2">
            <User size={14} className="text-amber-500" />
            {isRTL ? `بدون فريق (${unassignedUsers.length})` : `Unassigned (${unassignedUsers.length})`}
          </div>
          <div className="space-y-1">
            {unassignedUsers.map(u => {
              const RoleIcon = ROLE_ICONS[u.role] || User;
              const color = ROLE_COLORS[u.role] || '#6B8DB5';
              return (
                <div key={u.id} className="flex items-center gap-2 py-1.5 px-2 rounded-lg hover:bg-surface-bg dark:hover:bg-surface-bg-dark group">
                  <RoleIcon size={12} style={{ color }} className="shrink-0" />
                  <span className="text-xs text-content dark:text-content-dark">{isRTL ? (u.full_name_ar || u.full_name_en) : (u.full_name_en || u.full_name_ar)}</span>
                  <span className="text-[9px] px-1.5 py-0.5 rounded-full font-semibold" style={{ color, background: color + '18' }}>
                    {ROLE_LABELS[u.role] ? (isRTL ? ROLE_LABELS[u.role].ar : ROLE_LABELS[u.role].en) : u.role}
                  </span>
                  <button onClick={() => { setMoveUser(u); setMoveTarget(''); }}
                    className="ms-auto opacity-0 group-hover:opacity-100 transition-opacity text-[10px] text-brand-500 bg-brand-500/10 px-2 py-0.5 rounded border-none cursor-pointer hover:bg-brand-500/20">
                    {isRTL ? 'تعيين لفريق' : 'Assign to team'}
                  </button>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Wizard: team + members in one submit */}
      {wizardOpen && (
        <Modal isOpen={true} onClose={() => !wizardSaving && setWizardOpen(false)}
          title={isRTL ? 'فريق جديد + الأعضاء' : 'New Team + Members'}>
          <div className="space-y-3 max-h-[70vh] overflow-y-auto pr-1">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-content dark:text-content-dark mb-1">
                  {isRTL ? 'الاسم بالعربي' : 'Name (AR)'} <span className="text-red-500">*</span>
                </label>
                <Input
                  value={wizardForm.name_ar}
                  onChange={e => setWizardForm(f => ({ ...f, name_ar: e.target.value }))}
                  placeholder={isRTL ? 'مثلاً: فريق نور' : 'e.g. Nour Team'}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-content dark:text-content-dark mb-1">
                  {isRTL ? 'الاسم بالإنجليزي' : 'Name (EN)'}
                </label>
                <Input
                  value={wizardForm.name_en}
                  onChange={e => setWizardForm(f => ({ ...f, name_en: e.target.value }))}
                  placeholder="e.g. Nour Team"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-content dark:text-content-dark mb-1">
                {isRTL ? 'تحت أي فريق (parent)' : 'Parent team'}
              </label>
              <Select
                value={wizardForm.parent_id || ''}
                onChange={e => setWizardForm(f => ({ ...f, parent_id: e.target.value || null }))}
              >
                <option value="">{isRTL ? '— فريق رئيسي (مفيش parent) —' : '— Root (no parent) —'}</option>
                {departments.map(d => (
                  <option key={d.id} value={d.id}>{isRTL ? (d.name_ar || d.name_en) : (d.name_en || d.name_ar)}</option>
                ))}
              </Select>
              <p className="m-0 mt-1 text-[10px] text-content-muted dark:text-content-muted-dark">
                {isRTL
                  ? 'لو حطيت فريق أب، الـ manager بتاع الفريق الأب هيشوف اللي تحت ده تلقائياً'
                  : 'When set, the parent team\'s manager automatically inherits visibility into this team'}
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-content dark:text-content-dark mb-1">
                {isRTL ? 'ليدر الفريق (اختياري)' : 'Team leader (optional)'}
              </label>
              <Select
                value={wizardForm.leader_id}
                onChange={e => setWizardForm(f => ({ ...f, leader_id: e.target.value }))}
              >
                <option value="">{isRTL ? '— مفيش ليدر دلوقتي —' : '— No leader yet —'}</option>
                {wizardLeaderCandidates.map(u => {
                  const name = isRTL ? (u.full_name_ar || u.full_name_en) : (u.full_name_en || u.full_name_ar);
                  const current = u.team_id ? ` (${isRTL ? 'حالياً في:' : 'now in:'} ${teamNameById[u.team_id] || '—'})` : '';
                  return <option key={u.id} value={u.id}>{name}{current}</option>;
                })}
              </Select>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-content dark:text-content-dark">
                  {isRTL ? `أعضاء الفريق (${wizardForm.member_ids.size} محدد)` : `Members (${wizardForm.member_ids.size} selected)`}
                </label>
                {wizardForm.member_ids.size > 0 && (
                  <button
                    onClick={() => setWizardForm(f => ({ ...f, member_ids: new Set() }))}
                    className="text-[10px] text-red-500 bg-transparent border-none cursor-pointer hover:underline"
                  >
                    {isRTL ? 'إلغاء التحديد' : 'Clear all'}
                  </button>
                )}
              </div>
              <Input
                value={wizardSearch}
                onChange={e => setWizardSearch(e.target.value)}
                placeholder={isRTL ? 'بحث بالاسم...' : 'Search by name...'}
                className="mb-2"
              />
              <div className="border border-edge dark:border-edge-dark rounded-lg max-h-[240px] overflow-y-auto">
                {wizardEligibleUsers.length === 0 ? (
                  <div className="text-center py-6 text-xs text-content-muted dark:text-content-muted-dark">
                    {isRTL ? 'لا يوجد مستخدمين' : 'No matching users'}
                  </div>
                ) : (
                  wizardEligibleUsers.map(u => {
                    const isSel = wizardForm.member_ids.has(u.id);
                    const isLeader = u.id === wizardForm.leader_id;
                    const name = isRTL ? (u.full_name_ar || u.full_name_en) : (u.full_name_en || u.full_name_ar);
                    return (
                      <label key={u.id}
                        className={`flex items-center gap-2 px-3 py-2 border-b border-edge/40 dark:border-edge-dark/40 last:border-b-0 cursor-pointer ${isSel ? 'bg-brand-500/[0.08]' : 'hover:bg-surface-bg dark:hover:bg-surface-bg-dark'} ${isLeader ? 'opacity-60' : ''}`}>
                        <input
                          type="checkbox"
                          checked={isSel}
                          disabled={isLeader}
                          onChange={() => toggleWizardMember(u.id)}
                          className="w-4 h-4 cursor-pointer accent-brand-500"
                        />
                        <span className="text-xs text-content dark:text-content-dark flex-1">{name}</span>
                        <span className="text-[9px] px-1.5 py-0.5 rounded-full font-semibold"
                          style={{ color: ROLE_COLORS[u.role] || '#6B8DB5', background: (ROLE_COLORS[u.role] || '#6B8DB5') + '18' }}>
                          {ROLE_LABELS[u.role] ? (isRTL ? ROLE_LABELS[u.role].ar : ROLE_LABELS[u.role].en) : u.role}
                        </span>
                        {u.team_id && (
                          <span className="text-[9px] text-content-muted dark:text-content-muted-dark truncate max-w-[120px]">
                            {teamNameById[u.team_id] || '—'}
                          </span>
                        )}
                        {isLeader && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded-full font-semibold text-amber-500 bg-amber-500/15">
                            {isRTL ? 'ليدر' : 'Leader'}
                          </span>
                        )}
                      </label>
                    );
                  })
                )}
              </div>
              <p className="m-0 mt-1 text-[10px] text-content-muted dark:text-content-muted-dark">
                {isRTL
                  ? 'الأعضاء بينقلوا من فرقهم الحالية للفريق الجديد. الـ leader اللي اخترته فوق متضاف تلقائياً.'
                  : 'Members move from their current team to the new one. The leader you picked is auto-included.'}
              </p>
            </div>
          </div>

          <ModalFooter>
            <Button variant="secondary" onClick={() => setWizardOpen(false)} disabled={wizardSaving}>
              {isRTL ? 'إلغاء' : 'Cancel'}
            </Button>
            <Button onClick={saveWizard} disabled={wizardSaving}>
              {wizardSaving
                ? (isRTL ? 'جارٍ الحفظ...' : 'Saving...')
                : (isRTL ? 'إنشاء الفريق' : 'Create Team')}
            </Button>
          </ModalFooter>
        </Modal>
      )}

      {/* Department Modal */}
      {deptModal && (
        <Modal isOpen={true} onClose={() => setDeptModal(null)} title={deptModal === 'add' ? (isRTL ? 'إضافة فريق' : 'Add Team') : (isRTL ? 'تعديل فريق' : 'Edit Team')}>
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-content dark:text-content-dark mb-1">{isRTL ? 'الاسم بالعربي' : 'Name (AR)'}</label>
              <Input value={deptForm.name_ar} onChange={e => setDeptForm(f => ({ ...f, name_ar: e.target.value }))} placeholder={isRTL ? 'اسم الفريق' : 'Team name'} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-content dark:text-content-dark mb-1">{isRTL ? 'الاسم بالإنجليزي' : 'Name (EN)'}</label>
              <Input value={deptForm.name_en} onChange={e => setDeptForm(f => ({ ...f, name_en: e.target.value }))} placeholder="Team name" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-content dark:text-content-dark mb-1">{isRTL ? 'الفريق الأب (اختياري)' : 'Parent Team (optional)'}</label>
              <Select value={deptForm.parent_id || ''} onChange={e => setDeptForm(f => ({ ...f, parent_id: e.target.value || null }))}>
                <option value="">{isRTL ? '— لا يوجد (فريق رئيسي) —' : '— None (root team) —'}</option>
                {departments.filter(d => d.id !== deptModal?.id).map(d => (
                  <option key={d.id} value={d.id}>{isRTL ? (d.name_ar || d.name_en) : (d.name_en || d.name_ar)}</option>
                ))}
              </Select>
            </div>
          </div>
          <ModalFooter>
            <Button variant="secondary" onClick={() => setDeptModal(null)}>{isRTL ? 'إلغاء' : 'Cancel'}</Button>
            <Button onClick={saveDept} disabled={saving}>{saving ? (isRTL ? 'جارٍ...' : 'Saving...') : (isRTL ? 'حفظ' : 'Save')}</Button>
          </ModalFooter>
        </Modal>
      )}

      {/* Move User Modal */}
      {moveUser && (
        <Modal isOpen={true} onClose={() => setMoveUser(null)} title={isRTL ? `نقل ${moveUser.full_name_ar || moveUser.full_name_en}` : `Move ${moveUser.full_name_en || moveUser.full_name_ar}`}>
          <div>
            <label className="block text-xs font-semibold text-content dark:text-content-dark mb-1">{isRTL ? 'الفريق الجديد' : 'New Team'}</label>
            <Select value={moveTarget} onChange={e => setMoveTarget(e.target.value)}>
              <option value="">{isRTL ? '— بدون فريق —' : '— Unassigned —'}</option>
              {departments.map(d => (
                <option key={d.id} value={d.id}>{isRTL ? (d.name_ar || d.name_en) : (d.name_en || d.name_ar)}</option>
              ))}
            </Select>
          </div>
          <ModalFooter>
            <Button variant="secondary" onClick={() => setMoveUser(null)}>{isRTL ? 'إلغاء' : 'Cancel'}</Button>
            <Button onClick={handleMoveUser}>{isRTL ? 'نقل' : 'Move'}</Button>
          </ModalFooter>
        </Modal>
      )}
    </div>
  );
}
