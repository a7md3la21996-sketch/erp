import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../contexts/ThemeContext';
import {
  Shield, Plus, Trash2, Eye, EyeOff, Check, X, AlertTriangle,
  Globe, Lock, FileDown, ToggleLeft, ToggleRight, Save,
} from 'lucide-react';
import { logAction } from '../../services/auditService';
import {
  getIPWhitelist, addIP, removeIP, isIPWhitelistEnabled, toggleIPWhitelist,
  getPasswordPolicy, savePasswordPolicy, validatePassword,
  getExportRestrictions, saveExportRestrictions,
} from '../../services/securityService';
import { ROLES, ROLE_LABELS } from '../../config/roles';

export default function SecurityPage() {
  const { i18n } = useTranslation();
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const isRTL = i18n.language === 'ar';

  // ── IP Whitelist state ──
  const [ipEnabled, setIpEnabled] = useState(false);
  const [ipList, setIpList] = useState([]);
  const [newIp, setNewIp] = useState('');
  const [newLabel, setNewLabel] = useState('');

  // ── Password Policy state ──
  const [policy, setPolicy] = useState({});
  const [testPwd, setTestPwd] = useState('');
  const [showTestPwd, setShowTestPwd] = useState(false);
  const [pwdResult, setPwdResult] = useState(null);

  // ── Export Restrictions state ──
  const [exportConfig, setExportConfig] = useState({});

  // ── Toast ──
  const [toast, setToast] = useState(null);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    setIpEnabled(isIPWhitelistEnabled());
    setIpList(getIPWhitelist());
    setPolicy(getPasswordPolicy());
    setExportConfig(getExportRestrictions());
  }, []);

  // Validate test password in real-time
  useEffect(() => {
    if (testPwd) {
      setPwdResult(validatePassword(testPwd));
    } else {
      setPwdResult(null);
    }
  }, [testPwd, policy]);

  // ── Styles ──
  const cardBg = isDark ? '#1a2332' : '#ffffff';
  const cardBorder = isDark ? 'rgba(148,163,184,0.12)' : 'rgba(0,0,0,0.08)';
  const textPrimary = isDark ? '#e2e8f0' : '#1e293b';
  const textSecondary = isDark ? '#94a3b8' : '#64748b';
  const inputBg = isDark ? '#0a1929' : '#f8fafc';
  const inputBorder = isDark ? 'rgba(148,163,184,0.2)' : 'rgba(0,0,0,0.12)';
  const accent = '#4A7AAB';

  const inputStyle = {
    background: inputBg,
    border: `1px solid ${inputBorder}`,
    borderRadius: 8,
    padding: '8px 12px',
    color: textPrimary,
    fontSize: 13,
    fontFamily: 'inherit',
    outline: 'none',
    width: '100%',
  };

  const btnPrimary = {
    background: accent,
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    padding: '8px 16px',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'inherit',
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  };

  const btnDanger = {
    background: 'transparent',
    color: '#ef4444',
    border: 'none',
    borderRadius: 6,
    padding: '6px 8px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
  };

  const sectionTitle = {
    fontSize: 16,
    fontWeight: 700,
    color: textPrimary,
    margin: 0,
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  };

  const sectionDesc = {
    fontSize: 13,
    color: textSecondary,
    margin: '4px 0 16px',
  };

  const cardStyle = {
    background: cardBg,
    border: `1px solid ${cardBorder}`,
    borderRadius: 12,
    padding: 24,
    marginBottom: 20,
  };

  const toggleBtn = (enabled) => ({
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    padding: 0,
    display: 'flex',
    alignItems: 'center',
    color: enabled ? '#22c55e' : textSecondary,
  });

  // ── Handlers ──
  const handleToggleIpWhitelist = () => {
    const newState = toggleIPWhitelist();
    setIpEnabled(newState);
    logAction({ action: 'update', entity: 'security', entityId: 'ip_whitelist', description: `IP Whitelist ${newState ? 'enabled' : 'disabled'}` });
    showToast(isRTL ? (newState ? 'تم تفعيل قائمة IP' : 'تم إلغاء قائمة IP') : (newState ? 'IP Whitelist enabled' : 'IP Whitelist disabled'));
  };

  const handleAddIp = () => {
    if (!newIp.trim()) return;
    const entry = addIP(newIp.trim(), newLabel.trim() || 'Unlabeled');
    setIpList(getIPWhitelist());
    setNewIp('');
    setNewLabel('');
    logAction({ action: 'create', entity: 'security', entityId: entry.id, description: `Added IP: ${entry.ip} (${entry.label})` });
    showToast(isRTL ? 'تم إضافة IP' : 'IP added');
  };

  const handleRemoveIp = (id, ip) => {
    removeIP(id);
    setIpList(getIPWhitelist());
    logAction({ action: 'delete', entity: 'security', entityId: id, description: `Removed IP: ${ip}` });
    showToast(isRTL ? 'تم حذف IP' : 'IP removed');
  };

  const handleSavePolicy = () => {
    savePasswordPolicy(policy);
    logAction({ action: 'update', entity: 'security', entityId: 'password_policy', description: 'Updated password policy' });
    showToast(isRTL ? 'تم حفظ سياسة كلمات المرور' : 'Password policy saved');
  };

  const handleSaveExport = () => {
    saveExportRestrictions(exportConfig);
    logAction({ action: 'update', entity: 'security', entityId: 'export_restrictions', description: 'Updated export restrictions' });
    showToast(isRTL ? 'تم حفظ قيود التصدير' : 'Export restrictions saved');
  };

  const toggleRole = (role) => {
    const roles = [...(exportConfig.restrictedRoles || [])];
    const idx = roles.indexOf(role);
    if (idx >= 0) roles.splice(idx, 1);
    else roles.push(role);
    setExportConfig({ ...exportConfig, restrictedRoles: roles });
  };

  const toggleFormat = (fmt) => {
    const fmts = [...(exportConfig.allowedFormats || [])];
    const idx = fmts.indexOf(fmt);
    if (idx >= 0) fmts.splice(idx, 1);
    else fmts.push(fmt);
    setExportConfig({ ...exportConfig, allowedFormats: fmts });
  };

  const checkboxStyle = (checked) => ({
    width: 18,
    height: 18,
    borderRadius: 4,
    border: `2px solid ${checked ? accent : inputBorder}`,
    background: checked ? accent : 'transparent',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    flexShrink: 0,
  });

  const labelRow = {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '6px 0',
    cursor: 'pointer',
    fontSize: 13,
    color: textPrimary,
  };

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} style={{ padding: '24px 24px 60px', maxWidth: 900, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: textPrimary, margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
          <Shield size={24} color={accent} />
          {isRTL ? 'إعدادات الأمان' : 'Security Settings'}
        </h1>
        <p style={{ fontSize: 14, color: textSecondary, margin: '6px 0 0' }}>
          {isRTL ? 'إدارة سياسات الأمان والحماية للنظام' : 'Manage system security policies and protections'}
        </p>
      </div>

      {/* ═══ IP WHITELIST ═══ */}
      <div style={cardStyle}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
          <h2 style={sectionTitle}>
            <Globe size={18} color={accent} />
            {isRTL ? 'قائمة IP المسموح بها' : 'IP Whitelist'}
          </h2>
          <button onClick={handleToggleIpWhitelist} style={toggleBtn(ipEnabled)}>
            {ipEnabled ? <ToggleRight size={28} /> : <ToggleLeft size={28} />}
          </button>
        </div>
        <p style={sectionDesc}>
          {isRTL ? 'تحديد عناوين IP المسموح لها بالوصول للنظام' : 'Restrict system access to specific IP addresses'}
        </p>

        {ipEnabled && (
          <div style={{ padding: '12px 16px', background: isDark ? 'rgba(234,179,8,0.08)' : 'rgba(234,179,8,0.06)', border: `1px solid rgba(234,179,8,0.2)`, borderRadius: 8, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#eab308' }}>
            <AlertTriangle size={16} />
            {isRTL ? 'تحذير: فقط عناوين IP المدرجة يمكنها الوصول للنظام' : 'Warning: Only listed IPs can access the system'}
          </div>
        )}

        {/* Add IP Form */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
          <input
            value={newIp}
            onChange={e => setNewIp(e.target.value)}
            placeholder={isRTL ? 'مثال: 192.168.1.0/24' : 'e.g. 192.168.1.0/24'}
            style={{ ...inputStyle, flex: '1 1 180px' }}
            onKeyDown={e => e.key === 'Enter' && handleAddIp()}
          />
          <input
            value={newLabel}
            onChange={e => setNewLabel(e.target.value)}
            placeholder={isRTL ? 'التسمية (مكتب، VPN...)' : 'Label (Office, VPN...)'}
            style={{ ...inputStyle, flex: '1 1 150px' }}
            onKeyDown={e => e.key === 'Enter' && handleAddIp()}
          />
          <button onClick={handleAddIp} style={btnPrimary}>
            <Plus size={16} />
            {isRTL ? 'إضافة' : 'Add'}
          </button>
        </div>

        {/* IP Table */}
        {ipList.length > 0 ? (
          <div style={{ borderRadius: 8, overflow: 'hidden', border: `1px solid ${cardBorder}` }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: isDark ? '#132337' : '#f1f5f9' }}>
                  <th style={{ padding: '10px 14px', textAlign: isRTL ? 'right' : 'left', color: textSecondary, fontWeight: 600 }}>
                    {isRTL ? 'عنوان IP' : 'IP Address'}
                  </th>
                  <th style={{ padding: '10px 14px', textAlign: isRTL ? 'right' : 'left', color: textSecondary, fontWeight: 600 }}>
                    {isRTL ? 'التسمية' : 'Label'}
                  </th>
                  <th style={{ padding: '10px 14px', textAlign: isRTL ? 'right' : 'left', color: textSecondary, fontWeight: 600 }}>
                    {isRTL ? 'تاريخ الإضافة' : 'Added'}
                  </th>
                  <th style={{ padding: '10px 14px', width: 50 }} />
                </tr>
              </thead>
              <tbody>
                {ipList.map(entry => (
                  <tr key={entry.id} style={{ borderTop: `1px solid ${cardBorder}` }}>
                    <td style={{ padding: '10px 14px', color: textPrimary, fontFamily: 'monospace' }}>{entry.ip}</td>
                    <td style={{ padding: '10px 14px', color: textSecondary }}>{entry.label}</td>
                    <td style={{ padding: '10px 14px', color: textSecondary }}>
                      {new Date(entry.added_at).toLocaleDateString(isRTL ? 'ar-EG' : 'en-US')}
                    </td>
                    <td style={{ padding: '10px 14px' }}>
                      <button onClick={() => handleRemoveIp(entry.id, entry.ip)} style={btnDanger}>
                        <Trash2 size={15} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: 20, color: textSecondary, fontSize: 13 }}>
            {isRTL ? 'لا توجد عناوين IP مضافة' : 'No IPs added yet'}
          </div>
        )}
      </div>

      {/* ═══ PASSWORD POLICY ═══ */}
      <div style={cardStyle}>
        <h2 style={sectionTitle}>
          <Lock size={18} color={accent} />
          {isRTL ? 'سياسة كلمات المرور' : 'Password Policy'}
        </h2>
        <p style={sectionDesc}>
          {isRTL ? 'تحديد متطلبات كلمات المرور للمستخدمين' : 'Define password requirements for users'}
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20 }}>
          {/* Min Length */}
          <div>
            <label style={{ fontSize: 13, fontWeight: 600, color: textPrimary, marginBottom: 6, display: 'block' }}>
              {isRTL ? 'الحد الأدنى للطول' : 'Minimum Length'}: {policy.minLength || 8}
            </label>
            <input
              type="range"
              min={8}
              max={32}
              value={policy.minLength || 8}
              onChange={e => setPolicy({ ...policy, minLength: parseInt(e.target.value) })}
              style={{ width: '100%', accentColor: accent }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: textSecondary }}>
              <span>8</span><span>32</span>
            </div>
          </div>

          {/* Toggles */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[
              { key: 'requireUppercase', en: 'Require uppercase', ar: 'حرف كبير مطلوب' },
              { key: 'requireLowercase', en: 'Require lowercase', ar: 'حرف صغير مطلوب' },
              { key: 'requireNumbers', en: 'Require numbers', ar: 'رقم مطلوب' },
              { key: 'requireSpecial', en: 'Require special characters', ar: 'رمز خاص مطلوب' },
            ].map(opt => (
              <label key={opt.key} style={labelRow} onClick={() => setPolicy({ ...policy, [opt.key]: !policy[opt.key] })}>
                <div style={checkboxStyle(policy[opt.key])}>
                  {policy[opt.key] && <Check size={12} color="#fff" />}
                </div>
                {isRTL ? opt.ar : opt.en}
              </label>
            ))}
          </div>

          {/* Dropdowns */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, color: textPrimary, marginBottom: 4, display: 'block' }}>
                {isRTL ? 'انتهاء صلاحية كلمة المرور' : 'Password Expiry'}
              </label>
              <select
                value={policy.expiryDays || 0}
                onChange={e => setPolicy({ ...policy, expiryDays: parseInt(e.target.value) })}
                style={{ ...inputStyle, cursor: 'pointer' }}
              >
                <option value={0}>{isRTL ? 'بدون انتهاء' : 'Never'}</option>
                <option value={30}>{isRTL ? '30 يوم' : '30 days'}</option>
                <option value={60}>{isRTL ? '60 يوم' : '60 days'}</option>
                <option value={90}>{isRTL ? '90 يوم' : '90 days'}</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, color: textPrimary, marginBottom: 4, display: 'block' }}>
                {isRTL ? 'منع إعادة الاستخدام' : 'Prevent Reuse'}
              </label>
              <select
                value={policy.preventReuse || 0}
                onChange={e => setPolicy({ ...policy, preventReuse: parseInt(e.target.value) })}
                style={{ ...inputStyle, cursor: 'pointer' }}
              >
                <option value={0}>{isRTL ? 'بدون' : 'None'}</option>
                <option value={3}>{isRTL ? 'آخر 3' : 'Last 3'}</option>
                <option value={5}>{isRTL ? 'آخر 5' : 'Last 5'}</option>
                <option value={10}>{isRTL ? 'آخر 10' : 'Last 10'}</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, color: textPrimary, marginBottom: 4, display: 'block' }}>
                {isRTL ? 'أقصى محاولات فاشلة' : 'Max Failed Attempts'}
              </label>
              <select
                value={policy.maxAttempts || 0}
                onChange={e => setPolicy({ ...policy, maxAttempts: parseInt(e.target.value) })}
                style={{ ...inputStyle, cursor: 'pointer' }}
              >
                <option value={0}>{isRTL ? 'غير محدود' : 'Unlimited'}</option>
                <option value={3}>3</option>
                <option value={5}>5</option>
                <option value={10}>10</option>
              </select>
            </div>
          </div>
        </div>

        {/* Test Password */}
        <div style={{ marginTop: 20, padding: 16, background: isDark ? '#132337' : '#f8fafc', borderRadius: 8, border: `1px solid ${cardBorder}` }}>
          <label style={{ fontSize: 13, fontWeight: 600, color: textPrimary, marginBottom: 8, display: 'block' }}>
            {isRTL ? 'اختبار كلمة المرور' : 'Test Password'}
          </label>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <input
                type={showTestPwd ? 'text' : 'password'}
                value={testPwd}
                onChange={e => setTestPwd(e.target.value)}
                placeholder={isRTL ? 'أدخل كلمة مرور للاختبار...' : 'Enter a password to test...'}
                style={inputStyle}
              />
              <button
                onClick={() => setShowTestPwd(!showTestPwd)}
                style={{ position: 'absolute', [isRTL ? 'left' : 'right']: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: textSecondary, padding: 4 }}
              >
                {showTestPwd ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>
          {pwdResult && (
            <div style={{ marginTop: 10 }}>
              {pwdResult.valid ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#22c55e', fontSize: 13 }}>
                  <Check size={16} />
                  {isRTL ? 'كلمة المرور مطابقة للسياسة' : 'Password meets policy requirements'}
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {pwdResult.errors.map((err, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#ef4444', fontSize: 13 }}>
                      <X size={14} />
                      {isRTL ? err.ar : err.en}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end' }}>
          <button onClick={handleSavePolicy} style={btnPrimary}>
            <Save size={16} />
            {isRTL ? 'حفظ السياسة' : 'Save Policy'}
          </button>
        </div>
      </div>

      {/* ═══ EXPORT RESTRICTIONS ═══ */}
      <div style={cardStyle}>
        <h2 style={sectionTitle}>
          <FileDown size={18} color={accent} />
          {isRTL ? 'قيود التصدير' : 'Export Restrictions'}
        </h2>
        <p style={sectionDesc}>
          {isRTL ? 'التحكم في صلاحيات وإعدادات تصدير البيانات' : 'Control data export permissions and settings'}
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 24 }}>
          {/* Restricted Roles */}
          <div>
            <h3 style={{ fontSize: 14, fontWeight: 600, color: textPrimary, margin: '0 0 10px' }}>
              {isRTL ? 'الأدوار المقيدة' : 'Restricted Roles'}
            </h3>
            <p style={{ fontSize: 12, color: textSecondary, margin: '0 0 8px' }}>
              {isRTL ? 'هذه الأدوار لا يمكنها التصدير' : 'These roles cannot export data'}
            </p>
            {Object.values(ROLES).map(role => (
              <label key={role} style={labelRow} onClick={() => toggleRole(role)}>
                <div style={checkboxStyle((exportConfig.restrictedRoles || []).includes(role))}>
                  {(exportConfig.restrictedRoles || []).includes(role) && <Check size={12} color="#fff" />}
                </div>
                {ROLE_LABELS[role]?.[isRTL ? 'ar' : 'en'] || role}
              </label>
            ))}
          </div>

          {/* Allowed Formats */}
          <div>
            <h3 style={{ fontSize: 14, fontWeight: 600, color: textPrimary, margin: '0 0 10px' }}>
              {isRTL ? 'الصيغ المسموح بها' : 'Allowed Formats'}
            </h3>
            {['csv', 'excel', 'pdf'].map(fmt => (
              <label key={fmt} style={labelRow} onClick={() => toggleFormat(fmt)}>
                <div style={checkboxStyle((exportConfig.allowedFormats || []).includes(fmt))}>
                  {(exportConfig.allowedFormats || []).includes(fmt) && <Check size={12} color="#fff" />}
                </div>
                {fmt.toUpperCase()}
              </label>
            ))}

            {/* Toggles */}
            <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 13, color: textPrimary }}>
                  {isRTL ? 'يتطلب موافقة' : 'Require Approval'}
                </span>
                <button onClick={() => setExportConfig({ ...exportConfig, requireApproval: !exportConfig.requireApproval })} style={toggleBtn(exportConfig.requireApproval)}>
                  {exportConfig.requireApproval ? <ToggleRight size={28} /> : <ToggleLeft size={28} />}
                </button>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 13, color: textPrimary }}>
                  {isRTL ? 'تسجيل جميع التصديرات' : 'Log All Exports'}
                </span>
                <button onClick={() => setExportConfig({ ...exportConfig, logExports: !exportConfig.logExports })} style={toggleBtn(exportConfig.logExports)}>
                  {exportConfig.logExports ? <ToggleRight size={28} /> : <ToggleLeft size={28} />}
                </button>
              </div>
            </div>
          </div>

          {/* Max Rows */}
          <div>
            <h3 style={{ fontSize: 14, fontWeight: 600, color: textPrimary, margin: '0 0 10px' }}>
              {isRTL ? 'أقصى عدد صفوف لكل تصدير' : 'Max Rows Per Export'}
            </h3>
            <p style={{ fontSize: 12, color: textSecondary, margin: '0 0 8px' }}>
              {isRTL ? '0 = بدون حد' : '0 = Unlimited'}
            </p>
            <input
              type="number"
              min={0}
              value={exportConfig.maxRowsPerExport || 0}
              onChange={e => setExportConfig({ ...exportConfig, maxRowsPerExport: parseInt(e.target.value) || 0 })}
              style={inputStyle}
            />
          </div>
        </div>

        <div style={{ marginTop: 20, display: 'flex', justifyContent: 'flex-end' }}>
          <button onClick={handleSaveExport} style={btnPrimary}>
            <Save size={16} />
            {isRTL ? 'حفظ القيود' : 'Save Restrictions'}
          </button>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed',
          bottom: 24,
          left: '50%',
          transform: 'translateX(-50%)',
          background: toast.type === 'error' ? '#ef4444' : '#22c55e',
          color: '#fff',
          padding: '10px 20px',
          borderRadius: 8,
          fontSize: 13,
          fontWeight: 600,
          zIndex: 9999,
          boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}>
          {toast.type === 'error' ? <X size={16} /> : <Check size={16} />}
          {toast.msg}
        </div>
      )}
    </div>
  );
}
