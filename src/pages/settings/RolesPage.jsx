import { useState, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../contexts/ThemeContext';
import {
  Shield, Plus, Trash2, Copy, Edit3, Users, Check, X,
  ChevronDown, ChevronUp, Lock, Save, AlertTriangle,
} from 'lucide-react';
import {
  getRoles, getRole, createRole, updateRole, deleteRole,
  getModules, getActions, getActionLabels, getUserRole, setUserRole,
} from '../../services/rbacService';

/* ─── Mock Users for Assignment ─── */
const MOCK_USERS = [
  { id: '1', name_ar: 'أحمد محمد', name_en: 'Ahmed Mohamed', email: 'ahmed@company.com' },
  { id: '2', name_ar: 'سارة علي', name_en: 'Sara Ali', email: 'sara@company.com' },
  { id: '3', name_ar: 'محمد حسن', name_en: 'Mohamed Hassan', email: 'mohamed@company.com' },
  { id: '4', name_ar: 'فاطمة أحمد', name_en: 'Fatma Ahmed', email: 'fatma@company.com' },
  { id: '5', name_ar: 'عمر خالد', name_en: 'Omar Khaled', email: 'omar@company.com' },
];

/* ══════════════════════════════════════════════
   PERMISSION MATRIX
══════════════════════════════════════════════ */
function PermissionMatrix({ permissions, onChange, disabled, isDark, isRTL, lang }) {
  const modules = getModules();
  const actions = getActions();
  const actionLabels = getActionLabels();

  const toggleAll = (moduleId, checked) => {
    if (disabled) return;
    const updated = { ...permissions };
    updated[moduleId] = {};
    actions.forEach(a => { updated[moduleId][a] = checked; });
    onChange(updated);
  };

  const toggleAction = (moduleId, action) => {
    if (disabled) return;
    const updated = { ...permissions };
    if (!updated[moduleId]) updated[moduleId] = {};
    updated[moduleId][action] = !updated[moduleId]?.[action];
    onChange(updated);
  };

  const isAllChecked = (moduleId) =>
    actions.every(a => permissions?.[moduleId]?.[a] === true);

  return (
    <div style={{ overflowX: 'auto', borderRadius: 10, border: `1px solid ${isDark ? '#2a2f3a' : '#e5e7eb'}` }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 700 }}>
        <thead>
          <tr style={{ background: isDark ? '#1a1f2e' : '#f9fafb' }}>
            <th style={{
              padding: '10px 14px', textAlign: isRTL ? 'right' : 'left',
              fontSize: 13, fontWeight: 600,
              color: isDark ? '#94a3b8' : '#6b7280',
              borderBottom: `1px solid ${isDark ? '#2a2f3a' : '#e5e7eb'}`,
            }}>
              {lang === 'ar' ? 'القسم' : 'Module'}
            </th>
            <th style={{
              padding: '10px 8px', textAlign: 'center',
              fontSize: 11, fontWeight: 600,
              color: isDark ? '#94a3b8' : '#6b7280',
              borderBottom: `1px solid ${isDark ? '#2a2f3a' : '#e5e7eb'}`,
              width: 50,
            }}>
              {lang === 'ar' ? 'الكل' : 'All'}
            </th>
            {actions.map(action => (
              <th key={action} style={{
                padding: '10px 8px', textAlign: 'center',
                fontSize: 11, fontWeight: 600,
                color: isDark ? '#94a3b8' : '#6b7280',
                borderBottom: `1px solid ${isDark ? '#2a2f3a' : '#e5e7eb'}`,
                width: 70,
              }}>
                {lang === 'ar' ? actionLabels[action].ar : actionLabels[action].en}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {modules.map((mod, idx) => (
            <tr key={mod.id} style={{
              background: idx % 2 === 0
                ? (isDark ? '#111827' : '#fff')
                : (isDark ? '#161b2e' : '#f9fafb'),
            }}>
              <td style={{
                padding: '10px 14px', fontSize: 13, fontWeight: 500,
                color: isDark ? '#e2e8f0' : '#1f2937',
                borderBottom: `1px solid ${isDark ? '#1e2433' : '#f3f4f6'}`,
              }}>
                {lang === 'ar' ? mod.name : mod.nameEn}
              </td>
              <td style={{
                padding: '10px 8px', textAlign: 'center',
                borderBottom: `1px solid ${isDark ? '#1e2433' : '#f3f4f6'}`,
              }}>
                <ToggleSwitch
                  checked={isAllChecked(mod.id)}
                  onChange={(checked) => toggleAll(mod.id, checked)}
                  disabled={disabled}
                  isDark={isDark}
                  small
                />
              </td>
              {actions.map(action => (
                <td key={action} style={{
                  padding: '10px 8px', textAlign: 'center',
                  borderBottom: `1px solid ${isDark ? '#1e2433' : '#f3f4f6'}`,
                }}>
                  <ToggleSwitch
                    checked={permissions?.[mod.id]?.[action] === true}
                    onChange={() => toggleAction(mod.id, action)}
                    disabled={disabled}
                    isDark={isDark}
                    small
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ─── Toggle Switch ─── */
function ToggleSwitch({ checked, onChange, disabled, isDark, small }) {
  const w = small ? 34 : 40;
  const h = small ? 18 : 22;
  const dot = small ? 14 : 18;

  return (
    <button
      type="button"
      onClick={() => !disabled && onChange(!checked)}
      disabled={disabled}
      style={{
        width: w, height: h, borderRadius: h,
        background: checked
          ? (disabled ? (isDark ? '#1e3a5f' : '#93c5fd') : '#3b82f6')
          : (isDark ? '#374151' : '#d1d5db'),
        border: 'none', cursor: disabled ? 'not-allowed' : 'pointer',
        position: 'relative', transition: 'background 0.2s',
        display: 'inline-flex', alignItems: 'center',
        opacity: disabled ? 0.5 : 1,
        padding: 0,
      }}
    >
      <span style={{
        position: 'absolute',
        width: dot, height: dot, borderRadius: '50%',
        background: '#fff',
        top: (h - dot) / 2,
        left: checked ? w - dot - (h - dot) / 2 : (h - dot) / 2,
        transition: 'left 0.2s',
        boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
      }} />
    </button>
  );
}

/* ─── Create/Edit Role Modal ─── */
function RoleModal({ role, onSave, onClose, isDark, isRTL, lang }) {
  const existingRoles = getRoles();
  const [name, setName] = useState(role?.name || '');
  const [nameEn, setNameEn] = useState(role?.nameEn || '');
  const [description, setDescription] = useState(role?.description || '');
  const [descriptionEn, setDescriptionEn] = useState(role?.descriptionEn || '');
  const [permissions, setPermissions] = useState(role?.permissions || (() => {
    const p = {};
    getModules().forEach(m => { p[m.id] = {}; getActions().forEach(a => { p[m.id][a] = false; }); });
    return p;
  })());
  const [copyFrom, setCopyFrom] = useState('');

  const handleCopyFrom = (roleId) => {
    setCopyFrom(roleId);
    if (roleId) {
      const src = getRole(roleId);
      if (src) setPermissions(JSON.parse(JSON.stringify(src.permissions)));
    }
  };

  const handleSave = () => {
    if (!name && !nameEn) return;
    onSave({ name, nameEn, description, descriptionEn, permissions });
  };

  const inputStyle = {
    width: '100%', padding: '8px 12px', borderRadius: 8, fontSize: 13,
    border: `1px solid ${isDark ? '#374151' : '#d1d5db'}`,
    background: isDark ? '#1a1f2e' : '#fff',
    color: isDark ? '#e2e8f0' : '#1f2937',
    outline: 'none', boxSizing: 'border-box',
  };

  const labelStyle = {
    fontSize: 12, fontWeight: 600, marginBottom: 4, display: 'block',
    color: isDark ? '#94a3b8' : '#6b7280',
  };

  return (
    <div
      dir={isRTL ? 'rtl' : 'ltr'}
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 20,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: isDark ? '#111827' : '#fff',
          borderRadius: 14, width: '100%', maxWidth: 820,
          maxHeight: '90vh', overflow: 'auto',
          boxShadow: '0 25px 50px rgba(0,0,0,0.25)',
          border: `1px solid ${isDark ? '#1e293b' : '#e5e7eb'}`,
        }}
      >
        {/* Header */}
        <div style={{
          padding: '16px 20px', borderBottom: `1px solid ${isDark ? '#1e293b' : '#e5e7eb'}`,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: isDark ? '#f1f5f9' : '#111827' }}>
            {role ? (lang === 'ar' ? 'تعديل الدور' : 'Edit Role') : (lang === 'ar' ? 'إنشاء دور جديد' : 'Create New Role')}
          </h3>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: isDark ? '#94a3b8' : '#6b7280', padding: 4,
          }}>
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: 20 }}>
          {/* Name Fields */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
            <div>
              <label style={labelStyle}>{lang === 'ar' ? 'اسم الدور (عربي)' : 'Role Name (Arabic)'}</label>
              <input
                value={name} onChange={e => setName(e.target.value)}
                placeholder={lang === 'ar' ? 'مثال: مدير المبيعات' : 'e.g. Sales Manager'}
                style={inputStyle} dir="rtl"
              />
            </div>
            <div>
              <label style={labelStyle}>{lang === 'ar' ? 'اسم الدور (إنجليزي)' : 'Role Name (English)'}</label>
              <input
                value={nameEn} onChange={e => setNameEn(e.target.value)}
                placeholder="e.g. Sales Manager"
                style={inputStyle} dir="ltr"
              />
            </div>
          </div>

          {/* Description Fields */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
            <div>
              <label style={labelStyle}>{lang === 'ar' ? 'الوصف (عربي)' : 'Description (Arabic)'}</label>
              <input
                value={description} onChange={e => setDescription(e.target.value)}
                style={inputStyle} dir="rtl"
              />
            </div>
            <div>
              <label style={labelStyle}>{lang === 'ar' ? 'الوصف (إنجليزي)' : 'Description (English)'}</label>
              <input
                value={descriptionEn} onChange={e => setDescriptionEn(e.target.value)}
                style={inputStyle} dir="ltr"
              />
            </div>
          </div>

          {/* Copy from existing */}
          {!role && (
            <div style={{ marginBottom: 18 }}>
              <label style={labelStyle}>{lang === 'ar' ? 'نسخ الصلاحيات من دور موجود' : 'Copy permissions from existing role'}</label>
              <select
                value={copyFrom} onChange={e => handleCopyFrom(e.target.value)}
                style={{ ...inputStyle, cursor: 'pointer' }}
              >
                <option value="">{lang === 'ar' ? '— اختر دور —' : '— Select role —'}</option>
                {existingRoles.map(r => (
                  <option key={r.id} value={r.id}>{lang === 'ar' ? r.name : r.nameEn}</option>
                ))}
              </select>
            </div>
          )}

          {/* Permission Matrix */}
          <div style={{ marginBottom: 8 }}>
            <label style={{ ...labelStyle, marginBottom: 10 }}>
              {lang === 'ar' ? 'مصفوفة الصلاحيات' : 'Permission Matrix'}
            </label>
            <PermissionMatrix
              permissions={permissions}
              onChange={setPermissions}
              disabled={false}
              isDark={isDark}
              isRTL={isRTL}
              lang={lang}
            />
          </div>
        </div>

        {/* Footer */}
        <div style={{
          padding: '14px 20px', borderTop: `1px solid ${isDark ? '#1e293b' : '#e5e7eb'}`,
          display: 'flex', justifyContent: 'flex-end', gap: 10,
        }}>
          <button onClick={onClose} style={{
            padding: '8px 18px', borderRadius: 8, fontSize: 13, fontWeight: 500,
            background: isDark ? '#1e293b' : '#f3f4f6',
            color: isDark ? '#94a3b8' : '#6b7280',
            border: `1px solid ${isDark ? '#374151' : '#d1d5db'}`,
            cursor: 'pointer',
          }}>
            {lang === 'ar' ? 'إلغاء' : 'Cancel'}
          </button>
          <button onClick={handleSave} style={{
            padding: '8px 18px', borderRadius: 8, fontSize: 13, fontWeight: 500,
            background: '#3b82f6', color: '#fff', border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 6,
          }}>
            <Save size={14} />
            {lang === 'ar' ? 'حفظ' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Delete Confirmation Modal ─── */
function DeleteModal({ role, onConfirm, onClose, isDark, isRTL, lang }) {
  return (
    <div
      dir={isRTL ? 'rtl' : 'ltr'}
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: isDark ? '#111827' : '#fff',
          borderRadius: 14, width: 400, padding: 24,
          boxShadow: '0 25px 50px rgba(0,0,0,0.25)',
          border: `1px solid ${isDark ? '#1e293b' : '#e5e7eb'}`,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          <div style={{
            width: 36, height: 36, borderRadius: '50%',
            background: '#ef444418', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <AlertTriangle size={18} color="#ef4444" />
          </div>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: isDark ? '#f1f5f9' : '#111827' }}>
            {lang === 'ar' ? 'حذف الدور' : 'Delete Role'}
          </h3>
        </div>
        <p style={{ fontSize: 13, color: isDark ? '#94a3b8' : '#6b7280', margin: '0 0 18px', lineHeight: 1.6 }}>
          {lang === 'ar'
            ? `هل أنت متأكد من حذف دور "${role.name}"؟ سيتم نقل المستخدمين المرتبطين إلى دور "مشاهد فقط".`
            : `Are you sure you want to delete the role "${role.nameEn}"? Associated users will be moved to "Viewer" role.`}
        </p>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button onClick={onClose} style={{
            padding: '8px 18px', borderRadius: 8, fontSize: 13,
            background: isDark ? '#1e293b' : '#f3f4f6',
            color: isDark ? '#94a3b8' : '#6b7280',
            border: `1px solid ${isDark ? '#374151' : '#d1d5db'}`,
            cursor: 'pointer',
          }}>
            {lang === 'ar' ? 'إلغاء' : 'Cancel'}
          </button>
          <button onClick={() => { onConfirm(role.id); onClose(); }} style={{
            padding: '8px 18px', borderRadius: 8, fontSize: 13,
            background: '#ef4444', color: '#fff', border: 'none', cursor: 'pointer',
          }}>
            {lang === 'ar' ? 'حذف' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════
   MAIN PAGE
══════════════════════════════════════════════ */
export default function RolesPage() {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const { i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const lang = i18n.language;

  const [roles, setRoles] = useState(() => getRoles());
  const [selectedRole, setSelectedRole] = useState(null);
  const [expandedRole, setExpandedRole] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingRole, setEditingRole] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [assignSection, setAssignSection] = useState(false);

  const refreshRoles = useCallback(() => setRoles(getRoles()), []);

  /* ── Handlers ── */
  const handleCreateRole = (data) => {
    createRole(data);
    refreshRoles();
    setShowCreateModal(false);
  };

  const handleUpdateRole = (data) => {
    if (!editingRole) return;
    updateRole(editingRole.id, data);
    refreshRoles();
    setEditingRole(null);
  };

  const handleDeleteRole = (roleId) => {
    deleteRole(roleId);
    refreshRoles();
    if (expandedRole === roleId) setExpandedRole(null);
  };

  const handleAssignRole = (userId, roleId) => {
    setUserRole(userId, roleId);
    refreshRoles();
  };

  /* ── Permission Count ── */
  const getPermCount = (perms) => {
    let total = 0;
    let granted = 0;
    const modules = getModules();
    const actions = getActions();
    modules.forEach(m => {
      actions.forEach(a => {
        total++;
        if (perms?.[m.id]?.[a] === true) granted++;
      });
    });
    return { granted, total };
  };

  /* ── User count per role ── */
  const getUserCount = (roleId) => {
    return MOCK_USERS.filter(u => getUserRole(u.id) === roleId).length;
  };

  /* ── Role Colors ── */
  const roleColors = {
    admin: '#ef4444',
    manager: '#3b82f6',
    sales: '#f59e0b',
    hr: '#8b5cf6',
    finance: '#10b981',
    viewer: '#6b7280',
  };

  const getRoleColor = (id) => roleColors[id] || '#3b82f6';

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} style={{ padding: '24px 28px', maxWidth: 1200, margin: '0 auto' }}>
      {/* ── Header ── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 24, flexWrap: 'wrap', gap: 12,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 38, height: 38, borderRadius: 10,
            background: isDark ? '#1e3a5f' : '#dbeafe',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Shield size={20} color="#3b82f6" />
          </div>
          <div>
            <h1 style={{
              margin: 0, fontSize: 20, fontWeight: 700,
              color: isDark ? '#f1f5f9' : '#111827',
            }}>
              {lang === 'ar' ? 'الأدوار والصلاحيات' : 'Roles & Permissions'}
            </h1>
            <p style={{ margin: 0, fontSize: 13, color: isDark ? '#64748b' : '#6b7280' }}>
              {lang === 'ar' ? 'إدارة أدوار المستخدمين وصلاحياتهم' : 'Manage user roles and their permissions'}
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={() => setAssignSection(!assignSection)}
            style={{
              padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 500,
              background: isDark ? '#1e293b' : '#f3f4f6',
              color: isDark ? '#e2e8f0' : '#374151',
              border: `1px solid ${isDark ? '#374151' : '#d1d5db'}`,
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
            }}
          >
            <Users size={14} />
            {lang === 'ar' ? 'تعيين المستخدمين' : 'Assign Users'}
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            style={{
              padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 500,
              background: '#3b82f6', color: '#fff', border: 'none',
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
            }}
          >
            <Plus size={14} />
            {lang === 'ar' ? 'دور جديد' : 'New Role'}
          </button>
        </div>
      </div>

      {/* ── Assign Users Section ── */}
      {assignSection && (
        <div style={{
          marginBottom: 20, padding: 18, borderRadius: 12,
          background: isDark ? '#111827' : '#fff',
          border: `1px solid ${isDark ? '#1e293b' : '#e5e7eb'}`,
        }}>
          <h3 style={{
            margin: '0 0 14px', fontSize: 14, fontWeight: 600,
            color: isDark ? '#e2e8f0' : '#1f2937',
          }}>
            {lang === 'ar' ? 'تعيين الأدوار للمستخدمين' : 'Assign Roles to Users'}
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {MOCK_USERS.map(user => {
              const currentRole = getUserRole(user.id);
              return (
                <div key={user.id} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '10px 14px', borderRadius: 8,
                  background: isDark ? '#1a1f2e' : '#f9fafb',
                  border: `1px solid ${isDark ? '#2a2f3a' : '#f3f4f6'}`,
                }}>
                  <div>
                    <span style={{ fontSize: 13, fontWeight: 500, color: isDark ? '#e2e8f0' : '#1f2937' }}>
                      {lang === 'ar' ? user.name_ar : user.name_en}
                    </span>
                    <span style={{
                      fontSize: 12, color: isDark ? '#64748b' : '#9ca3af',
                      marginInlineStart: 8,
                    }}>
                      {user.email}
                    </span>
                  </div>
                  <select
                    value={currentRole}
                    onChange={e => handleAssignRole(user.id, e.target.value)}
                    style={{
                      padding: '6px 10px', borderRadius: 6, fontSize: 12,
                      border: `1px solid ${isDark ? '#374151' : '#d1d5db'}`,
                      background: isDark ? '#111827' : '#fff',
                      color: isDark ? '#e2e8f0' : '#1f2937',
                      cursor: 'pointer', minWidth: 130,
                    }}
                  >
                    {roles.map(r => (
                      <option key={r.id} value={r.id}>{lang === 'ar' ? r.name : r.nameEn}</option>
                    ))}
                  </select>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Role Cards Grid ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340, 1fr))', gap: 16 }}>
        {roles.map(role => {
          const { granted, total } = getPermCount(role.permissions);
          const pct = Math.round((granted / total) * 100);
          const color = getRoleColor(role.id);
          const isExpanded = expandedRole === role.id;
          const userCount = getUserCount(role.id);

          return (
            <div key={role.id} style={{
              borderRadius: 12, overflow: 'hidden',
              background: isDark ? '#111827' : '#fff',
              border: `1px solid ${isDark ? '#1e293b' : '#e5e7eb'}`,
              transition: 'box-shadow 0.2s',
            }}>
              {/* Card Header */}
              <div style={{
                padding: '16px 18px',
                borderBottom: isExpanded ? `1px solid ${isDark ? '#1e293b' : '#e5e7eb'}` : 'none',
              }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1 }}>
                    <div style={{
                      width: 34, height: 34, borderRadius: 8,
                      background: color + '18',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      flexShrink: 0,
                    }}>
                      <Shield size={16} color={color} />
                    </div>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{
                          fontSize: 14, fontWeight: 600,
                          color: isDark ? '#f1f5f9' : '#111827',
                        }}>
                          {lang === 'ar' ? role.name : role.nameEn}
                        </span>
                        {role.builtIn && (
                          <span style={{
                            fontSize: 10, padding: '2px 7px', borderRadius: 4,
                            background: isDark ? '#1e293b' : '#f3f4f6',
                            color: isDark ? '#64748b' : '#9ca3af',
                            fontWeight: 600, display: 'flex', alignItems: 'center', gap: 3,
                          }}>
                            <Lock size={9} />
                            {lang === 'ar' ? 'أساسي' : 'Built-in'}
                          </span>
                        )}
                      </div>
                      <p style={{
                        margin: '2px 0 0', fontSize: 12,
                        color: isDark ? '#64748b' : '#9ca3af',
                      }}>
                        {lang === 'ar' ? role.description : role.descriptionEn}
                      </p>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                    {!role.builtIn && (
                      <>
                        <button
                          onClick={() => setEditingRole(role)}
                          title={lang === 'ar' ? 'تعديل' : 'Edit'}
                          style={{
                            width: 30, height: 30, borderRadius: 6,
                            background: 'none', border: `1px solid ${isDark ? '#374151' : '#e5e7eb'}`,
                            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                            color: isDark ? '#94a3b8' : '#6b7280',
                          }}
                        >
                          <Edit3 size={13} />
                        </button>
                        <button
                          onClick={() => setDeleteTarget(role)}
                          title={lang === 'ar' ? 'حذف' : 'Delete'}
                          style={{
                            width: 30, height: 30, borderRadius: 6,
                            background: 'none', border: `1px solid ${isDark ? '#374151' : '#e5e7eb'}`,
                            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                            color: '#ef4444',
                          }}
                        >
                          <Trash2 size={13} />
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Stats Row */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Users size={12} color={isDark ? '#64748b' : '#9ca3af'} />
                    <span style={{ fontSize: 12, color: isDark ? '#64748b' : '#9ca3af' }}>
                      {userCount} {lang === 'ar' ? 'مستخدم' : 'users'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Check size={12} color={isDark ? '#64748b' : '#9ca3af'} />
                    <span style={{ fontSize: 12, color: isDark ? '#64748b' : '#9ca3af' }}>
                      {granted}/{total} {lang === 'ar' ? 'صلاحية' : 'permissions'}
                    </span>
                  </div>
                </div>

                {/* Progress Bar */}
                <div style={{
                  height: 5, borderRadius: 3, background: isDark ? '#1e293b' : '#f3f4f6',
                  overflow: 'hidden', marginBottom: 10,
                }}>
                  <div style={{
                    height: '100%', borderRadius: 3, width: `${pct}%`,
                    background: color, transition: 'width 0.3s',
                  }} />
                </div>

                {/* Expand/Collapse */}
                <button
                  onClick={() => setExpandedRole(isExpanded ? null : role.id)}
                  style={{
                    width: '100%', padding: '6px 0', borderRadius: 6,
                    background: 'none', border: 'none', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                    fontSize: 12, color: isDark ? '#64748b' : '#9ca3af',
                  }}
                >
                  {isExpanded
                    ? (lang === 'ar' ? 'إخفاء الصلاحيات' : 'Hide Permissions')
                    : (lang === 'ar' ? 'عرض الصلاحيات' : 'View Permissions')}
                  {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                </button>
              </div>

              {/* Expanded Permission Matrix */}
              {isExpanded && (
                <div style={{ padding: 18 }}>
                  <PermissionMatrix
                    permissions={role.permissions}
                    onChange={(perms) => {
                      if (role.builtIn) return;
                      updateRole(role.id, { permissions: perms });
                      refreshRoles();
                    }}
                    disabled={role.builtIn}
                    isDark={isDark}
                    isRTL={isRTL}
                    lang={lang}
                  />
                  {role.builtIn && (
                    <p style={{
                      margin: '10px 0 0', fontSize: 11, color: isDark ? '#475569' : '#9ca3af',
                      display: 'flex', alignItems: 'center', gap: 4,
                    }}>
                      <Lock size={10} />
                      {lang === 'ar'
                        ? 'لا يمكن تعديل صلاحيات الأدوار الأساسية'
                        : 'Built-in role permissions cannot be modified'}
                    </p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Modals ── */}
      {showCreateModal && (
        <RoleModal
          role={null}
          onSave={handleCreateRole}
          onClose={() => setShowCreateModal(false)}
          isDark={isDark}
          isRTL={isRTL}
          lang={lang}
        />
      )}

      {editingRole && (
        <RoleModal
          role={editingRole}
          onSave={handleUpdateRole}
          onClose={() => setEditingRole(null)}
          isDark={isDark}
          isRTL={isRTL}
          lang={lang}
        />
      )}

      {deleteTarget && (
        <DeleteModal
          role={deleteTarget}
          onConfirm={handleDeleteRole}
          onClose={() => setDeleteTarget(null)}
          isDark={isDark}
          isRTL={isRTL}
          lang={lang}
        />
      )}
    </div>
  );
}
