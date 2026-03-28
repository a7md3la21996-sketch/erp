import { useState, useMemo, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuditFilter } from '../../hooks/useAuditFilter';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { supabase } from '../../lib/supabase';
import {
  Users, Shield, UserCheck, UserX, Clock,
  ToggleLeft, ToggleRight, Plus, Pencil, KeyRound, Trash2, Eye, EyeOff,
} from 'lucide-react';
import {
  Button, Badge, KpiCard, Table, Th, Td, Tr,
  PageSkeleton, SmartFilter, applySmartFilters, Pagination,
  Modal, ModalFooter,
} from '../../components/ui';
import Input, { Select } from '../../components/ui/Input';

/* ─── Constants ─── */
const ROLE_OPTIONS = [
  { value: 'admin',          ar: 'مدير نظام',      en: 'Admin' },
  { value: 'sales_director', ar: 'مدير مبيعات',     en: 'Sales Director' },
  { value: 'sales_manager',  ar: 'سيلز مانجر',     en: 'Sales Manager' },
  { value: 'team_leader',    ar: 'تيم ليدر',       en: 'Team Leader' },
  { value: 'sales_agent',    ar: 'سيلز',           en: 'Sales Agent' },
  { value: 'marketing',      ar: 'تسويق',          en: 'Marketing' },
  { value: 'hr',             ar: 'موارد بشرية',     en: 'HR' },
  { value: 'finance',        ar: 'مالية',           en: 'Finance' },
  { value: 'operations',     ar: 'عمليات',          en: 'Operations' },
];

const DEPARTMENT_OPTIONS = [
  { value: 'sales',      ar: 'المبيعات',      en: 'Sales' },
  { value: 'hr',         ar: 'الموارد البشرية', en: 'HR' },
  { value: 'finance',    ar: 'المالية',        en: 'Finance' },
  { value: 'marketing',  ar: 'التسويق',       en: 'Marketing' },
  { value: 'operations', ar: 'العمليات',       en: 'Operations' },
];

const EMPTY_FORM = {
  email: '', password: '', full_name_ar: '', full_name_en: '',
  role: 'sales_agent', department: 'sales', team_id: '', phone: '',
};

/* ─── Mock Data (DEV only — empty in production) ─── */
const MOCK_USERS = import.meta.env.DEV ? [
  {
    id: '1', name_ar: 'أحمد محمد', name_en: 'Ahmed Mohamed',
    email: 'ahmed@company.com', role: 'admin', status: 'active',
    last_login: '2026-03-14T09:30:00', created_at: '2025-01-15T10:00:00',
  },
  {
    id: '2', name_ar: 'سارة علي', name_en: 'Sara Ali',
    email: 'sara@company.com', role: 'manager', status: 'active',
    last_login: '2026-03-13T14:20:00', created_at: '2025-02-20T08:00:00',
  },
  {
    id: '3', name_ar: 'محمد حسن', name_en: 'Mohamed Hassan',
    email: 'mohamed@company.com', role: 'user', status: 'active',
    last_login: '2026-03-12T11:45:00', created_at: '2025-03-10T12:00:00',
  },
  {
    id: '4', name_ar: 'فاطمة أحمد', name_en: 'Fatma Ahmed',
    email: 'fatma@company.com', role: 'user', status: 'inactive',
    last_login: '2026-02-28T16:00:00', created_at: '2025-04-05T09:00:00',
  },
  {
    id: '5', name_ar: 'عمر خالد', name_en: 'Omar Khaled',
    email: 'omar@company.com', role: 'manager', status: 'active',
    last_login: '2026-03-14T08:10:00', created_at: '2025-05-18T14:00:00',
  },
  {
    id: '6', name_ar: 'نور الدين', name_en: 'Nour Eldin',
    email: 'nour@company.com', role: 'user', status: 'inactive',
    last_login: '2026-01-10T10:30:00', created_at: '2025-06-22T11:00:00',
  },
] : [];

/* ─── Status Badge ─── */
function StatusBadge({ status, lang }) {
  const isActive = status === 'active';
  const color = isActive ? '#22c55e' : '#94a3b8';
  const label = isActive
    ? (lang === 'ar' ? 'نشط' : 'Active')
    : (lang === 'ar' ? 'غير نشط' : 'Inactive');
  return (
    <span
      className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold"
      style={{ background: color + '18', color, border: `1px solid ${color}35` }}
    >
      {label}
    </span>
  );
}

/* ─── Role Badge ─── */
function RoleBadge({ role, lang }) {
  const colors = {
    admin: '#EF4444', sales_director: '#8B5CF6', sales_manager: '#4A7AAB',
    team_leader: '#F59E0B', sales_agent: '#6B8DB5', marketing: '#EC4899',
    hr: '#14B8A6', finance: '#F97316', operations: '#6366F1',
    manager: '#4A7AAB', user: '#6B8DB5',
  };
  const entry = ROLE_OPTIONS.find(r => r.value === role);
  const label = entry ? (lang === 'ar' ? entry.ar : entry.en) : role;
  const c = colors[role] || '#6B8DB5';
  return (
    <span
      className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold"
      style={{ background: c + '18', color: c, border: `1px solid ${c}35` }}
    >
      {label}
    </span>
  );
}

/* ─── Form Field wrapper ─── */
function Field({ label, required, children }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-content dark:text-content-dark mb-1">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      {children}
    </div>
  );
}

/* ══════════════════════════════════════════════
   MAIN PAGE
══════════════════════════════════════════════ */
export default function UsersPage() {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const lang = i18n.language;
  const toast = useToast();

  const { register } = useAuth();

  const [search, setSearch] = useState('');
  const [smartFilters, setSmartFilters] = useState([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null); // null = add mode, object = edit mode
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [formErrors, setFormErrors] = useState({});

  const { auditFields, applyAuditFilters } = useAuditFilter('user');

  const USE_SUPABASE = !!import.meta.env.VITE_SUPABASE_URL;

  /* ── Fetch users ── */
  const loadUsers = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .order('created_at', { ascending: false });

      if (error || !data || data.length === 0) {
        // In mock mode also load any locally-created users
        const local = JSON.parse(localStorage.getItem('platform_users') || '[]');
        setUsers([...local, ...MOCK_USERS]);
      } else {
        setUsers(data);
      }
    } catch {
      const local = JSON.parse(localStorage.getItem('platform_users') || '[]');
      setUsers([...local, ...MOCK_USERS]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadUsers(); }, [loadUsers]);

  /* ── Stats ── */
  const activeCount = users.filter(u => u.status === 'active').length;
  const inactiveCount = users.filter(u => u.status === 'inactive').length;
  const adminCount = users.filter(u => u.role === 'admin').length;

  /* ── Smart Filter Fields ── */
  const SMART_FIELDS = useMemo(() => [
    { id: 'name', label: 'الاسم', labelEn: 'Name', type: 'text' },
    { id: 'email', label: 'البريد الإلكتروني', labelEn: 'Email', type: 'text' },
    {
      id: 'role', label: 'الدور', labelEn: 'Role', type: 'select',
      options: ROLE_OPTIONS.map(r => ({ value: r.value, label: r.ar, labelEn: r.en })),
    },
    {
      id: 'status', label: 'الحالة', labelEn: 'Status', type: 'select',
      options: [
        { value: 'active', label: 'نشط', labelEn: 'Active' },
        { value: 'inactive', label: 'غير نشط', labelEn: 'Inactive' },
      ],
    },
    ...auditFields,
  ], [auditFields]);

  /* ── Filtering ── */
  const filtered = useMemo(() => {
    let result = users;

    // Apply smart filters
    result = applySmartFilters(result, smartFilters, SMART_FIELDS);
    result = applyAuditFilters(result, smartFilters);

    // Apply search
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(u => {
        const name = (isRTL ? (u.name_ar || u.full_name_ar) : (u.name_en || u.full_name_en)) || u.name_ar || u.full_name_ar || '';
        return (
          name.toLowerCase().includes(q) ||
          (u.email || '').toLowerCase().includes(q)
        );
      });
    }

    return result;
  }, [users, smartFilters, SMART_FIELDS, search, isRTL, applyAuditFilters]);

  /* ── Pagination ── */
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const paged = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);
  useEffect(() => { if (page > totalPages) setPage(totalPages); }, [page, totalPages]);
  useEffect(() => { setPage(1); }, [search, smartFilters]);

  /* ── Toggle Status ── */
  const resetUserPassword = async (userId, userEmail) => {
    const newPass = prompt(lang === 'ar' ? 'أدخل كلمة المرور الجديدة (6 أحرف على الأقل):' : 'Enter new password (min 6 characters):');
    if (!newPass || newPass.length < 6) {
      if (newPass) toast.error(lang === 'ar' ? 'كلمة المرور لازم 6 أحرف على الأقل' : 'Password must be at least 6 characters');
      return;
    }
    try {
      const { error } = await supabase.auth.admin.updateUserById(userId, { password: newPass });
      if (error) throw error;
      toast.success(lang === 'ar' ? `تم تغيير كلمة المرور لـ ${userEmail}` : `Password reset for ${userEmail}`);
    } catch {
      // If admin API not available, try via service role or show manual instructions
      toast.warning(lang === 'ar' ? 'غيّر الباسورد من Supabase Dashboard → Authentication → Users' : 'Change password from Supabase Dashboard → Authentication → Users');
    }
  };

  const toggleStatus = async (userId) => {
    setUsers(prev => prev.map(u => {
      if (u.id === userId) {
        const newStatus = u.status === 'active' ? 'inactive' : 'active';
        // Try to update in Supabase (will silently fail for mock data)
        supabase.from('users').update({ status: newStatus }).eq('id', userId).then();
        return { ...u, status: newStatus };
      }
      return u;
    }));
  };

  /* ── Format date ── */
  const formatDate = (dateStr) => {
    if (!dateStr) return '\u2014';
    try {
      return new Date(dateStr).toLocaleDateString(isRTL ? 'ar-EG' : 'en-US', {
        year: 'numeric', month: 'short', day: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  const formatDateTime = (dateStr) => {
    if (!dateStr) return '\u2014';
    try {
      return new Date(dateStr).toLocaleDateString(isRTL ? 'ar-EG' : 'en-US', {
        year: 'numeric', month: 'short', day: 'numeric',
        hour: '2-digit', minute: '2-digit',
      });
    } catch {
      return dateStr;
    }
  };

  /* ── Open Add Modal ── */
  const openAddModal = () => {
    setEditingUser(null);
    setForm({ ...EMPTY_FORM });
    setFormErrors({});
    setShowModal(true);
  };

  /* ── Open Edit Modal ── */
  const openEditModal = (user) => {
    setEditingUser(user);
    setForm({
      email: user.email || '',
      password: '',
      full_name_ar: user.full_name_ar || user.name_ar || '',
      full_name_en: user.full_name_en || user.name_en || '',
      role: user.role || 'sales_agent',
      department: user.department || 'sales',
      team_id: user.team_id || '',
      phone: user.phone || '',
    });
    setFormErrors({});
    setShowModal(true);
  };

  /* ── Validate Form ── */
  const validate = () => {
    const errs = {};
    const isEdit = !!editingUser;

    if (!isEdit && !form.email.trim()) errs.email = true;
    if (!isEdit && (!form.password || form.password.length < 6)) errs.password = true;
    if (!form.full_name_ar.trim()) errs.full_name_ar = true;
    if (!form.full_name_en.trim()) errs.full_name_en = true;
    if (!form.role) errs.role = true;
    if (!form.department) errs.department = true;

    setFormErrors(errs);
    return Object.keys(errs).length === 0;
  };

  /* ── Save Handler ── */
  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    const isEdit = !!editingUser;

    try {
      if (isEdit) {
        // ── Edit user ──
        const updates = {
          full_name_ar: form.full_name_ar,
          full_name_en: form.full_name_en,
          name_ar: form.full_name_ar,
          name_en: form.full_name_en,
          role: form.role,
          department: form.department,
          team_id: form.team_id || null,
          phone: form.phone || null,
        };

        if (USE_SUPABASE) {
          const { error } = await supabase
            .from('users')
            .update(updates)
            .eq('id', editingUser.id);
          if (error) throw error;
        }

        // Update local state
        setUsers(prev => prev.map(u =>
          u.id === editingUser.id ? { ...u, ...updates } : u
        ));

        // Also update localStorage users if present
        const local = JSON.parse(localStorage.getItem('platform_users') || '[]');
        const idx = local.findIndex(u => u.id === editingUser.id);
        if (idx >= 0) {
          local[idx] = { ...local[idx], ...updates };
          localStorage.setItem('platform_users', JSON.stringify(local));
        }

        toast.success(lang === 'ar' ? 'تم تحديث المستخدم بنجاح' : 'User updated successfully');
      } else {
        // ── Create user ──
        if (USE_SUPABASE) {
          try {
            await register(form.email, form.password, {
              full_name_ar: form.full_name_ar,
              full_name_en: form.full_name_en,
              role: form.role,
              department: form.department,
              team_id: form.team_id || null,
              phone: form.phone || null,
            });
            toast.success(lang === 'ar' ? 'تم إنشاء المستخدم بنجاح' : 'User created successfully');
          } catch (err) {
            // If register throws (e.g. mock mode), fallback to localStorage
            if (err?.message?.includes('only available with Supabase')) {
              saveToLocalStorage();
              toast.success(lang === 'ar' ? 'تم إنشاء المستخدم محليا' : 'User created locally');
            } else {
              throw err;
            }
          }
        } else {
          saveToLocalStorage();
          toast.success(lang === 'ar' ? 'تم إنشاء المستخدم محليا' : 'User created locally');
        }

        await loadUsers();
      }

      setShowModal(false);
      setEditingUser(null);
      setForm({ ...EMPTY_FORM });
    } catch (err) {
      toast.error(err?.message || (lang === 'ar' ? 'حدث خطأ' : 'An error occurred'));
    } finally {
      setSaving(false);
    }
  };

  /* ── Save to localStorage (mock mode) ── */
  const saveToLocalStorage = () => {
    const local = JSON.parse(localStorage.getItem('platform_users') || '[]');
    const newUser = {
      id: crypto.randomUUID ? crypto.randomUUID() : `local_${Date.now()}`,
      email: form.email,
      name_ar: form.full_name_ar,
      name_en: form.full_name_en,
      full_name_ar: form.full_name_ar,
      full_name_en: form.full_name_en,
      role: form.role,
      department: form.department,
      team_id: form.team_id || null,
      phone: form.phone || null,
      status: 'active',
      created_at: new Date().toISOString(),
      last_login: null,
    };
    local.unshift(newUser);
    localStorage.setItem('platform_users', JSON.stringify(local));
  };

  /* ── Update form field ── */
  const setField = (key, value) => {
    setForm(prev => ({ ...prev, [key]: value }));
    if (formErrors[key]) setFormErrors(prev => ({ ...prev, [key]: false }));
  };

  const errClass = (key) => formErrors[key] ? 'border-red-500 focus:border-red-500 focus:ring-red-500/30' : '';

  if (loading) return (
    <div className="px-4 py-4 md:px-7 md:py-6">
      <PageSkeleton hasKpis tableRows={6} tableCols={6} />
    </div>
  );

  const isEdit = !!editingUser;

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} className="px-4 py-4 md:px-7 md:py-6 bg-surface-bg dark:bg-surface-bg-dark min-h-screen">

      {/* ── Page Header ── */}
      <div className={`flex flex-wrap justify-between items-center gap-3 mb-5 ${isRTL ? 'flex-row-reverse' : ''}`}>
        <div className={`flex items-center gap-3.5 ${isRTL ? 'flex-row-reverse' : ''}`}>
          <div className="w-10 h-10 rounded-xl bg-brand-500/[0.12] flex items-center justify-center">
            <Users size={20} className="text-brand-500" />
          </div>
          <div className="text-start">
            <h1 className="m-0 text-xl font-bold text-content dark:text-content-dark">
              {lang === 'ar' ? 'إدارة المستخدمين' : 'Users Management'}
            </h1>
            <p className="m-0 text-xs text-content-muted dark:text-content-muted-dark">
              {users.length} {lang === 'ar' ? 'مستخدم' : 'users'}
            </p>
          </div>
        </div>
        <Button size="sm" onClick={openAddModal}>
          <Plus size={14} /> {lang === 'ar' ? 'إضافة مستخدم' : 'Add User'}
        </Button>
      </div>

      {/* ── KPI Strip ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5 mb-5">
        <KpiCard icon={Users}     label={lang === 'ar' ? 'إجمالي المستخدمين' : 'Total Users'}  value={users.length}   color="#1B3347" />
        <KpiCard icon={UserCheck} label={lang === 'ar' ? 'نشط'               : 'Active'}        value={activeCount}    color="#22c55e" />
        <KpiCard icon={UserX}     label={lang === 'ar' ? 'غير نشط'           : 'Inactive'}      value={inactiveCount}  color="#94a3b8" />
        <KpiCard icon={Shield}    label={lang === 'ar' ? 'مديرين نظام'       : 'Admins'}        value={adminCount}     color="#EF4444" />
      </div>

      {/* ── SmartFilter ── */}
      <SmartFilter
        fields={SMART_FIELDS}
        filters={smartFilters}
        onFiltersChange={setSmartFilters}
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder={lang === 'ar' ? 'ابحث عن مستخدم...' : 'Search users...'}
        resultsCount={filtered.length}
      />

      {/* ── Table ── */}
      <Table>
        <thead>
          <tr>
            {[
              lang === 'ar' ? 'المستخدم'       : 'User',
              lang === 'ar' ? 'البريد الإلكتروني' : 'Email',
              lang === 'ar' ? 'الدور'           : 'Role',
              lang === 'ar' ? 'الحالة'          : 'Status',
              lang === 'ar' ? 'آخر تسجيل دخول'  : 'Last Login',
              lang === 'ar' ? 'تاريخ الإنشاء'   : 'Created At',
              '',
            ].map((h, i) => (
              <Th key={i} className="whitespace-nowrap">{h}</Th>
            ))}
          </tr>
        </thead>
        <tbody>
          {paged.map(user => {
            const name = (isRTL ? (user.name_ar || user.full_name_ar) : (user.name_en || user.full_name_en)) || user.name_ar || user.full_name_ar || user.email;
            const initials = name?.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase() || '??';
            const avatarColors = ['#1B3347', '#2B4C6F', '#4A7AAB', '#6B8DB5', '#8BA8C8'];
            const avatarBg = avatarColors[name?.charCodeAt(0) % avatarColors.length] || '#4A7AAB';

            return (
              <Tr key={user.id} className="cursor-pointer hover:bg-brand-500/[0.04]" onClick={() => openEditModal(user)}>
                <Td>
                  <div className={`flex items-center gap-2.5 ${isRTL ? 'flex-row-reverse' : ''}`}>
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: avatarBg }}>
                      <span className="text-xs font-bold text-white">{initials}</span>
                    </div>
                    <div className="text-start">
                      <p className="m-0 text-xs font-bold text-content dark:text-content-dark">{name}</p>
                    </div>
                  </div>
                </Td>
                <Td>
                  <span className="text-xs text-content-muted dark:text-content-muted-dark">{user.email}</span>
                </Td>
                <Td>
                  <RoleBadge role={user.role} lang={lang} />
                </Td>
                <Td>
                  <StatusBadge status={user.status} lang={lang} />
                </Td>
                <Td>
                  <div className={`flex items-center gap-1.5 ${isRTL ? 'flex-row-reverse' : ''}`}>
                    <Clock size={13} className="text-content-muted dark:text-content-muted-dark" />
                    <span className="text-xs text-content-muted dark:text-content-muted-dark">
                      {formatDateTime(user.last_login)}
                    </span>
                  </div>
                </Td>
                <Td>
                  <span className="text-xs text-content-muted dark:text-content-muted-dark">
                    {formatDate(user.created_at)}
                  </span>
                </Td>
                <Td>
                  <div className={`flex gap-1.5 justify-end ${isRTL ? 'flex-row-reverse' : ''}`}>
                    <button
                      title={lang === 'ar' ? 'تعديل' : 'Edit'}
                      onClick={(e) => { e.stopPropagation(); openEditModal(user); }}
                      className="w-8 h-8 rounded-lg border border-edge dark:border-edge-dark bg-transparent hover:scale-105 cursor-pointer flex items-center justify-center transition-all duration-150"
                    >
                      <Pencil size={14} className="text-content-muted dark:text-content-muted-dark" />
                    </button>
                    <button
                      title={user.status === 'active'
                        ? (lang === 'ar' ? 'تعطيل' : 'Deactivate')
                        : (lang === 'ar' ? 'تفعيل' : 'Activate')
                      }
                      onClick={(e) => { e.stopPropagation(); toggleStatus(user.id); }}
                      className="w-8 h-8 rounded-lg border border-edge dark:border-edge-dark bg-transparent hover:scale-105 cursor-pointer flex items-center justify-center transition-all duration-150"
                    >
                      {user.status === 'active'
                        ? <ToggleRight size={16} className="text-green-500" />
                        : <ToggleLeft size={16} className="text-content-muted dark:text-content-muted-dark" />
                      }
                    </button>
                    <button
                      title={lang === 'ar' ? 'تغيير كلمة المرور' : 'Reset Password'}
                      onClick={(e) => { e.stopPropagation(); resetUserPassword(user.id, user.email); }}
                      className="w-8 h-8 rounded-lg border border-edge dark:border-edge-dark bg-transparent hover:scale-105 cursor-pointer flex items-center justify-center transition-all duration-150"
                    >
                      <KeyRound size={14} className="text-amber-500" />
                    </button>
                    <button
                      title={lang === 'ar' ? 'حذف المستخدم' : 'Delete User'}
                      onClick={async (e) => {
                        e.stopPropagation();
                        const confirmMsg = lang === 'ar' ? `حذف ${user.full_name_ar || user.email}؟` : `Delete ${user.full_name_en || user.email}?`;
                        if (!confirm(confirmMsg)) return;
                        try {
                          await supabase.from('users').delete().eq('id', user.id);
                          await supabase.rpc('delete_auth_user', { user_id: user.id });
                          setUsers(prev => prev.filter(u => u.id !== user.id));
                          toast.success(lang === 'ar' ? 'تم حذف المستخدم' : 'User deleted');
                        } catch { toast.error(lang === 'ar' ? 'فشل الحذف' : 'Delete failed'); }
                      }}
                      className="w-8 h-8 rounded-lg border border-red-500/30 bg-transparent hover:bg-red-500/10 hover:scale-105 cursor-pointer flex items-center justify-center transition-all duration-150"
                    >
                      <Trash2 size={14} className="text-red-500" />
                    </button>
                  </div>
                </Td>
              </Tr>
            );
          })}
        </tbody>
      </Table>

      {filtered.length > 0 && (
        <Pagination
          currentPage={safePage}
          totalPages={totalPages}
          onPageChange={setPage}
          pageSize={pageSize}
          onPageSizeChange={(val) => { setPageSize(val); setPage(1); }}
          totalItems={filtered.length}
        />
      )}

      {filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-brand-900/[0.08] to-brand-500/[0.12] border border-dashed border-brand-500/30 flex items-center justify-center mb-4">
            <Users size={28} color="#4A7AAB" strokeWidth={1.5} />
          </div>
          <p className="text-sm font-bold text-content dark:text-content-dark mb-1.5">
            {lang === 'ar' ? 'لا توجد نتائج' : 'No results found'}
          </p>
          <p className="text-xs text-content-muted dark:text-content-muted-dark m-0">
            {lang === 'ar' ? 'جرّب البحث بكلمات مختلفة' : 'Try different search terms'}
          </p>
        </div>
      )}

      {/* ══════════════════════════════════════════════
          ADD / EDIT USER MODAL
      ══════════════════════════════════════════════ */}
      <Modal
        open={showModal}
        onClose={() => { setShowModal(false); setEditingUser(null); }}
        title={isEdit
          ? (lang === 'ar' ? 'تعديل المستخدم' : 'Edit User')
          : (lang === 'ar' ? 'إضافة مستخدم جديد' : 'Add New User')
        }
        width="max-w-xl"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Email */}
          {!isEdit && (
            <Field label={lang === 'ar' ? 'البريد الإلكتروني' : 'Email'} required>
              <Input
                type="email"
                placeholder="user@company.com"
                value={form.email}
                onChange={(e) => setField('email', e.target.value)}
                className={errClass('email')}
              />
            </Field>
          )}

          {/* Password - only for add */}
          {!isEdit && (
            <Field label={lang === 'ar' ? 'كلمة المرور' : 'Password'} required>
              <div className="flex gap-2">
                <Input
                  type={showPass ? 'text' : 'password'}
                  placeholder={lang === 'ar' ? '٦ أحرف على الأقل' : 'Min 6 characters'}
                  value={form.password}
                  onChange={(e) => setField('password', e.target.value)}
                  className={`flex-1 ${errClass('password')}`}
                />
                <button type="button" onClick={() => setShowPass(p => !p)}
                  className="px-3 py-1.5 rounded-lg border border-edge dark:border-edge-dark bg-surface-card dark:bg-surface-card-dark text-content-muted dark:text-content-muted-dark text-xs cursor-pointer hover:bg-brand-500/10 shrink-0">
                  {showPass ? '🙈' : '👁'}
                </button>
              </div>
            </Field>
          )}

          {/* Full Name Arabic */}
          <Field label={lang === 'ar' ? 'الاسم بالعربي' : 'Full Name (Arabic)'} required>
            <Input
              type="text"
              dir="rtl"
              placeholder="الاسم الكامل"
              value={form.full_name_ar}
              onChange={(e) => setField('full_name_ar', e.target.value)}
              className={errClass('full_name_ar')}
            />
          </Field>

          {/* Full Name English */}
          <Field label={lang === 'ar' ? 'الاسم بالإنجليزي' : 'Full Name (English)'} required>
            <Input
              type="text"
              dir="ltr"
              placeholder="Full Name"
              value={form.full_name_en}
              onChange={(e) => setField('full_name_en', e.target.value)}
              className={errClass('full_name_en')}
            />
          </Field>

          {/* Role */}
          <Field label={lang === 'ar' ? 'الدور' : 'Role'} required>
            <Select
              value={form.role}
              onChange={(e) => setField('role', e.target.value)}
              className={errClass('role')}
            >
              {ROLE_OPTIONS.map(r => (
                <option key={r.value} value={r.value}>
                  {lang === 'ar' ? r.ar : r.en}
                </option>
              ))}
            </Select>
          </Field>

          {/* Department */}
          <Field label={lang === 'ar' ? 'القسم' : 'Department'} required>
            <Select
              value={form.department}
              onChange={(e) => setField('department', e.target.value)}
              className={errClass('department')}
            >
              {DEPARTMENT_OPTIONS.map(d => (
                <option key={d.value} value={d.value}>
                  {lang === 'ar' ? d.ar : d.en}
                </option>
              ))}
            </Select>
          </Field>

          {/* Team ID */}
          <Field label={lang === 'ar' ? 'الفريق' : 'Team ID'}>
            <Input
              type="text"
              placeholder={lang === 'ar' ? 'اختياري' : 'Optional'}
              value={form.team_id}
              onChange={(e) => setField('team_id', e.target.value)}
            />
          </Field>

          {/* Phone */}
          <Field label={lang === 'ar' ? 'رقم الهاتف' : 'Phone'}>
            <Input
              type="tel"
              dir="ltr"
              placeholder="+20 1xx xxx xxxx"
              value={form.phone}
              onChange={(e) => setField('phone', e.target.value)}
            />
          </Field>
        </div>

        {/* Show email (read-only) in edit mode */}
        {isEdit && (
          <div className="mt-3 text-xs text-content-muted dark:text-content-muted-dark">
            {lang === 'ar' ? 'البريد الإلكتروني:' : 'Email:'} {editingUser.email}
          </div>
        )}

        <ModalFooter className={isRTL ? 'flex-row-reverse' : ''}>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => { setShowModal(false); setEditingUser(null); }}
          >
            {lang === 'ar' ? 'إلغاء' : 'Cancel'}
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={saving}
          >
            {saving
              ? (lang === 'ar' ? 'جاري الحفظ...' : 'Saving...')
              : isEdit
                ? (lang === 'ar' ? 'حفظ التعديلات' : 'Save Changes')
                : (lang === 'ar' ? 'إنشاء المستخدم' : 'Create User')
            }
          </Button>
        </ModalFooter>
      </Modal>
    </div>
  );
}
