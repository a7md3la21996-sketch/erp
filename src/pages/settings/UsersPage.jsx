import { useState, useMemo, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuditFilter } from '../../hooks/useAuditFilter';
import { supabase } from '../../lib/supabase';
import {
  Users, Shield, UserCheck, UserX, Clock,
  ToggleLeft, ToggleRight,
} from 'lucide-react';
import {
  Button, Badge, KpiCard, Table, Th, Td, Tr,
  PageSkeleton, SmartFilter, applySmartFilters, Pagination,
} from '../../components/ui';

/* ─── Mock Data ─── */
const MOCK_USERS = [
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
];

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
  const colors = { admin: '#EF4444', manager: '#4A7AAB', user: '#6B8DB5' };
  const labels = {
    admin: lang === 'ar' ? 'مدير نظام' : 'Admin',
    manager: lang === 'ar' ? 'مدير' : 'Manager',
    user: lang === 'ar' ? 'مستخدم' : 'User',
  };
  const c = colors[role] || '#6B8DB5';
  return (
    <span
      className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold"
      style={{ background: c + '18', color: c, border: `1px solid ${c}35` }}
    >
      {labels[role] || role}
    </span>
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

  const [search, setSearch] = useState('');
  const [smartFilters, setSmartFilters] = useState([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  const { auditFields, applyAuditFilters } = useAuditFilter('user');

  /* ── Fetch users ── */
  useEffect(() => {
    async function loadUsers() {
      try {
        const { data, error } = await supabase
          .from('users')
          .select('*')
          .order('created_at', { ascending: false });

        if (error || !data || data.length === 0) {
          setUsers(MOCK_USERS);
        } else {
          setUsers(data);
        }
      } catch {
        setUsers(MOCK_USERS);
      } finally {
        setLoading(false);
      }
    }
    loadUsers();
  }, []);

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
      options: [
        { value: 'admin', label: 'مدير نظام', labelEn: 'Admin' },
        { value: 'manager', label: 'مدير', labelEn: 'Manager' },
        { value: 'user', label: 'مستخدم', labelEn: 'User' },
      ],
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
        const name = (isRTL ? u.name_ar : u.name_en) || u.name_ar || '';
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
    if (!dateStr) return '—';
    try {
      return new Date(dateStr).toLocaleDateString(isRTL ? 'ar-EG' : 'en-US', {
        year: 'numeric', month: 'short', day: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  const formatDateTime = (dateStr) => {
    if (!dateStr) return '—';
    try {
      return new Date(dateStr).toLocaleDateString(isRTL ? 'ar-EG' : 'en-US', {
        year: 'numeric', month: 'short', day: 'numeric',
        hour: '2-digit', minute: '2-digit',
      });
    } catch {
      return dateStr;
    }
  };

  if (loading) return (
    <div className="px-4 py-4 md:px-7 md:py-6">
      <PageSkeleton hasKpis tableRows={6} tableCols={6} />
    </div>
  );

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
            const name = (isRTL ? user.name_ar : user.name_en) || user.name_ar || user.email;
            const initials = name?.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase() || '??';
            const avatarColors = ['#1B3347', '#2B4C6F', '#4A7AAB', '#6B8DB5', '#8BA8C8'];
            const avatarBg = avatarColors[name?.charCodeAt(0) % avatarColors.length] || '#4A7AAB';

            return (
              <Tr key={user.id}>
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
                      title={user.status === 'active'
                        ? (lang === 'ar' ? 'تعطيل' : 'Deactivate')
                        : (lang === 'ar' ? 'تفعيل' : 'Activate')
                      }
                      onClick={() => toggleStatus(user.id)}
                      className="w-8 h-8 rounded-lg border border-edge dark:border-edge-dark bg-transparent hover:scale-105 cursor-pointer flex items-center justify-center transition-all duration-150"
                    >
                      {user.status === 'active'
                        ? <ToggleRight size={16} className="text-green-500" />
                        : <ToggleLeft size={16} className="text-content-muted dark:text-content-muted-dark" />
                      }
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
    </div>
  );
}
