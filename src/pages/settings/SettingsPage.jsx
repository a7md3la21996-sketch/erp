import { useState, useRef, lazy, Suspense } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { useSystemConfig } from '../../contexts/SystemConfigContext';
import {
  Save, Settings, Palette, Globe, User, Building2, Phone, Mail, MapPin,
  DollarSign, Clock, Image, Upload, Users, Shield, FileText, Zap, SlidersHorizontal,
  Briefcase, GitBranch, ThumbsDown, Lock, Database, Activity, BarChart2, Megaphone,
  Eye, Printer,
} from 'lucide-react';
import { Button, Card, Input } from '../../components/ui';
import { PageSkeleton } from '../../components/ui/PageSkeletons';

// Lazy load sub-pages
const SystemConfigPage = lazy(() => import('./SystemConfigPage'));
const UsersPage = lazy(() => import('./UsersPage'));
const TeamHierarchyPage = lazy(() => import('./TeamHierarchyPage'));
const ImportExportLogPage = lazy(() => import('./ImportExportLogPage'));
const RolesPage = lazy(() => import('./RolesPage'));
const AuditLogPage = lazy(() => import('./AuditLogPage'));
const TriggersPage = lazy(() => import('./TriggersPage'));
const CustomFieldsPage = lazy(() => import('./CustomFieldsPage'));
const WorkflowBuilderPage = lazy(() => import('./WorkflowBuilderPage'));
const SMSTemplatesPage = lazy(() => import('./SMSTemplatesPage'));
const PrintSettingsPage = lazy(() => import('./PrintSettingsPage'));
const ScheduledReportsPage = lazy(() => import('./ScheduledReportsPage'));
const SecurityPage = lazy(() => import('./SecurityPage'));
const BackupPage = lazy(() => import('./BackupPage'));
const UserTrackingPage = lazy(() => import('./UserTrackingPage'));
const SystemHealthPage = lazy(() => import('./SystemHealthPage'));
const APIDocsPage = lazy(() => import('./APIDocsPage'));
const SLAManagementPage = lazy(() => import('./SLAManagementPage'));
const AdsIntegrationPage = lazy(() => import('./AdsIntegrationPage'));

const CURRENCIES = [
  { value: 'EGP', label_ar: 'جنيه مصري (EGP)', label_en: 'Egyptian Pound (EGP)' },
  { value: 'SAR', label_ar: 'ريال سعودي (SAR)', label_en: 'Saudi Riyal (SAR)' },
  { value: 'AED', label_ar: 'درهم إماراتي (AED)', label_en: 'UAE Dirham (AED)' },
  { value: 'USD', label_ar: 'دولار أمريكي (USD)', label_en: 'US Dollar (USD)' },
  { value: 'EUR', label_ar: 'يورو (EUR)', label_en: 'Euro (EUR)' },
  { value: 'GBP', label_ar: 'جنيه إسترليني (GBP)', label_en: 'British Pound (GBP)' },
];

const TIMEZONES = [
  { value: 'Africa/Cairo', label: 'Cairo (UTC+2)' },
  { value: 'Asia/Riyadh', label: 'Riyadh (UTC+3)' },
  { value: 'Asia/Dubai', label: 'Dubai (UTC+4)' },
  { value: 'Europe/London', label: 'London (UTC+0)' },
];

// ── Settings sidebar items ──
const SETTINGS_TABS = [
  { key: 'general',      icon: Settings,          ar: 'إعدادات عامة',        en: 'General',              adminOnly: false },
  { key: 'system',       icon: SlidersHorizontal, ar: 'إعدادات النظام',      en: 'System Config',        adminOnly: true },
  { key: 'users',        icon: Users,             ar: 'المستخدمين',          en: 'Users',                adminOnly: false, perm: 'users.manage' },
  { key: 'hierarchy',    icon: Users,             ar: 'هيكل الفرق',          en: 'Team Hierarchy',       adminOnly: false, perm: 'users.manage' },
  { key: 'import-export', icon: Upload,           ar: 'سجل الاستيراد',       en: 'Import/Export Log',    adminOnly: false },
  { key: 'roles',        icon: Shield,            ar: 'الأدوار والصلاحيات',   en: 'Roles & Permissions',  adminOnly: true },
  { key: 'audit',        icon: Eye,               ar: 'سجل التدقيق',         en: 'Audit Log',            adminOnly: true },
  { key: 'tracking',     icon: Activity,          ar: 'تتبع المستخدمين',     en: 'User Tracking',        adminOnly: true },
  { key: 'triggers',     icon: Zap,               ar: 'المشغلات التلقائية',   en: 'Triggers',             adminOnly: true },
  { key: 'workflows',    icon: GitBranch,         ar: 'سير العمل',           en: 'Workflows',            adminOnly: true },
  { key: 'custom-fields',icon: FileText,          ar: 'حقول مخصصة',          en: 'Custom Fields',        adminOnly: true },
  { key: 'sms-templates',icon: Mail,              ar: 'قوالب الرسائل',       en: 'SMS Templates',        adminOnly: true },
  { key: 'print',        icon: Printer,           ar: 'إعدادات الطباعة',     en: 'Print Settings',       adminOnly: true },
  { key: 'scheduled',    icon: Clock,             ar: 'تقارير مجدولة',       en: 'Scheduled Reports',    adminOnly: true },
  { key: 'security',     icon: Lock,              ar: 'الأمان',              en: 'Security',             adminOnly: true },
  { key: 'backup',       icon: Database,          ar: 'النسخ الاحتياطي',     en: 'Backup',               adminOnly: true },
  { key: 'health',       icon: BarChart2,         ar: 'حالة النظام',         en: 'System Health',        adminOnly: true },
  { key: 'sla',          icon: ThumbsDown,        ar: 'اتفاقيات SLA',        en: 'SLA Management',       adminOnly: true },
  { key: 'ads',          icon: Megaphone,         ar: 'ربط الإعلانات',       en: 'Ads Integration',      adminOnly: false },
  { key: 'api-docs',     icon: FileText,          ar: 'توثيق API',           en: 'API Docs',             adminOnly: true },
];

// ── General Tab (Company Info + Appearance) ──
function GeneralTab({ isRTL, isDark, toggleTheme, lang, handleLangToggle, profile }) {
  const { companyInfo, updateSection } = useSystemConfig();
  const [form, setForm] = useState({ ...companyInfo });
  const [saved, setSaved] = useState(false);
  const fileRef = useRef(null);
  const handleChange = (key, value) => setForm(prev => ({ ...prev, [key]: value }));
  const handleSave = () => { updateSection('companyInfo', form); setSaved(true); setTimeout(() => setSaved(false), 2000); };
  const handleLogoUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { alert(isRTL ? 'حجم الصورة أقل من 2MB' : 'Max 2MB'); return; }
    const reader = new FileReader();
    reader.onload = (ev) => handleChange('logo_url', ev.target.result);
    reader.readAsDataURL(file);
  };
  const selectStyle = 'w-full px-3 py-2 text-sm rounded-lg border border-edge dark:border-edge-dark bg-surface-input dark:bg-surface-input-dark text-content dark:text-content-dark focus:outline-none focus:ring-2 focus:ring-brand-500/30';

  return (
    <div className="space-y-5">
      {/* Company Info */}
      <Card className="p-5">
        <div className="flex justify-between items-center mb-4">
          <h3 className="m-0 text-sm font-bold text-content dark:text-content-dark flex items-center gap-2">
            <Building2 size={16} className="text-brand-500" />{isRTL ? 'معلومات الشركة' : 'Company Info'}
          </h3>
          <Button variant={saved ? 'success' : 'primary'} size="sm" onClick={handleSave}>
            <Save size={13} /> {saved ? '✓' : (isRTL ? 'حفظ' : 'Save')}
          </Button>
        </div>
        <div className="mb-4 flex items-center gap-4">
          <div className="w-16 h-16 rounded-xl border-2 border-dashed border-edge dark:border-edge-dark flex items-center justify-center overflow-hidden cursor-pointer bg-surface-input dark:bg-surface-input-dark hover:border-brand-500 transition-colors" onClick={() => fileRef.current?.click()}>
            {form.logo_url ? <img src={form.logo_url} alt="Logo" className="w-full h-full object-cover" /> : <Image size={24} className="text-content-muted" />}
          </div>
          <div>
            <button onClick={() => fileRef.current?.click()} className="text-xs font-semibold text-brand-500 cursor-pointer bg-transparent border-none flex items-center gap-1"><Upload size={12} /> {isRTL ? 'رفع شعار' : 'Upload Logo'}</button>
            {form.logo_url && <button onClick={() => handleChange('logo_url', '')} className="text-[10px] text-red-500 cursor-pointer bg-transparent border-none mt-0.5 block">{isRTL ? 'إزالة' : 'Remove'}</button>}
          </div>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
          <div><label className="text-xs text-content-muted dark:text-content-muted-dark mb-1 block">{isRTL ? 'اسم الشركة (عربي)' : 'Company Name (Arabic)'}</label><Input value={form.name_ar} onChange={e => handleChange('name_ar', e.target.value)} dir="rtl" /></div>
          <div><label className="text-xs text-content-muted dark:text-content-muted-dark mb-1 block">{isRTL ? 'اسم الشركة (إنجليزي)' : 'Company Name (English)'}</label><Input value={form.name_en} onChange={e => handleChange('name_en', e.target.value)} /></div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
          <div><label className="text-xs text-content-muted dark:text-content-muted-dark mb-1 block flex items-center gap-1"><Phone size={11} />{isRTL ? 'الهاتف' : 'Phone'}</label><Input value={form.phone} onChange={e => handleChange('phone', e.target.value)} dir="ltr" /></div>
          <div><label className="text-xs text-content-muted dark:text-content-muted-dark mb-1 block flex items-center gap-1"><Mail size={11} />{isRTL ? 'البريد' : 'Email'}</label><Input value={form.email} onChange={e => handleChange('email', e.target.value)} dir="ltr" /></div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
          <div><label className="text-xs text-content-muted dark:text-content-muted-dark mb-1 block">{isRTL ? 'العنوان (عربي)' : 'Address (Arabic)'}</label><Input value={form.address_ar} onChange={e => handleChange('address_ar', e.target.value)} dir="rtl" /></div>
          <div><label className="text-xs text-content-muted dark:text-content-muted-dark mb-1 block">{isRTL ? 'العنوان (إنجليزي)' : 'Address (English)'}</label><Input value={form.address_en} onChange={e => handleChange('address_en', e.target.value)} /></div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div><label className="text-xs text-content-muted dark:text-content-muted-dark mb-1 block flex items-center gap-1"><DollarSign size={11} />{isRTL ? 'العملة' : 'Currency'}</label><select value={form.currency} onChange={e => handleChange('currency', e.target.value)} className={selectStyle}>{CURRENCIES.map(c => <option key={c.value} value={c.value}>{isRTL ? c.label_ar : c.label_en}</option>)}</select></div>
          <div><label className="text-xs text-content-muted dark:text-content-muted-dark mb-1 block flex items-center gap-1"><Clock size={11} />{isRTL ? 'المنطقة الزمنية' : 'Timezone'}</label><select value={form.timezone} onChange={e => handleChange('timezone', e.target.value)} className={selectStyle}>{TIMEZONES.map(tz => <option key={tz.value} value={tz.value}>{tz.label}</option>)}</select></div>
        </div>
      </Card>

      {/* Appearance */}
      <Card className="p-5">
        <h3 className="m-0 mb-4 text-sm font-bold text-content dark:text-content-dark flex items-center gap-2">
          <Palette size={16} className="text-brand-500" />{isRTL ? 'المظهر' : 'Appearance'}
        </h3>
        <div className="flex gap-3 mb-4">
          <button onClick={toggleTheme} className={`flex-1 p-4 rounded-xl cursor-pointer text-center border-2 transition-all ${isDark ? 'border-brand-500 bg-brand-500/[0.08]' : 'border-edge dark:border-edge-dark bg-transparent'}`}>
            <div className="text-2xl mb-1">🌙</div><div className="text-xs font-semibold text-content dark:text-content-dark">{isRTL ? 'داكن' : 'Dark'}</div>
          </button>
          <button onClick={toggleTheme} className={`flex-1 p-4 rounded-xl cursor-pointer text-center border-2 transition-all ${!isDark ? 'border-brand-500 bg-brand-500/[0.08]' : 'border-edge dark:border-edge-dark bg-transparent'}`}>
            <div className="text-2xl mb-1">☀️</div><div className="text-xs font-semibold text-content dark:text-content-dark">{isRTL ? 'فاتح' : 'Light'}</div>
          </button>
        </div>
        <div className="px-4 py-3 rounded-xl bg-surface-input dark:bg-surface-input-dark border border-edge dark:border-edge-dark flex justify-between items-center">
          <div className="flex items-center gap-2"><Globe size={16} className="text-brand-500" /><span className="text-xs text-content dark:text-content-dark">{isRTL ? 'اللغة' : 'Language'}</span></div>
          <Button variant="secondary" size="sm" onClick={handleLangToggle}>{lang === 'ar' ? 'English' : 'عربي'}</Button>
        </div>
      </Card>

      {/* Profile */}
      <Card className="p-5">
        <h3 className="m-0 mb-4 text-sm font-bold text-content dark:text-content-dark flex items-center gap-2">
          <User size={16} className="text-brand-500" />{isRTL ? 'الملف الشخصي' : 'Profile'}
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div><label className="text-xs text-content-muted dark:text-content-muted-dark mb-1 block">{isRTL ? 'الاسم بالعربي' : 'Arabic Name'}</label><Input value={profile?.full_name_ar || ''} readOnly /></div>
          <div><label className="text-xs text-content-muted dark:text-content-muted-dark mb-1 block">{isRTL ? 'الاسم بالإنجليزي' : 'English Name'}</label><Input value={profile?.full_name_en || ''} readOnly /></div>
          <div><label className="text-xs text-content-muted dark:text-content-muted-dark mb-1 block">{isRTL ? 'البريد' : 'Email'}</label><Input value={profile?.email || ''} readOnly /></div>
          <div><label className="text-xs text-content-muted dark:text-content-muted-dark mb-1 block">{isRTL ? 'الدور' : 'Role'}</label><Input value={profile?.role || ''} readOnly /></div>
        </div>
      </Card>
    </div>
  );
}

// ── Main Settings Page ──
export default function SettingsPage() {
  const { i18n } = useTranslation();
  const { profile, hasPermission } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';
  const isRTL = i18n.language === 'ar';
  const lang = i18n.language;
  const [activeTab, setActiveTab] = useState('general');

  const handleLangToggle = () => {
    const newLang = lang === 'ar' ? 'en' : 'ar';
    i18n.changeLanguage(newLang).then(() => window.location.reload());
  };

  if (!hasPermission('settings.view') && profile?.role !== 'admin') {
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <div className="text-center">
          <div className="text-5xl mb-4">🔒</div>
          <h2 className="text-content dark:text-content-dark m-0 mb-2">{isRTL ? 'غير مصرح' : 'Unauthorized'}</h2>
          <p className="text-content-muted dark:text-content-muted-dark">{isRTL ? 'هذه الصفحة للمديرين فقط' : 'Admins only'}</p>
        </div>
      </div>
    );
  }

  // Content rendered inline with display:none for persistence

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} className="flex min-h-screen bg-surface-bg dark:bg-surface-bg-dark">
      {/* Sidebar */}
      <div className="w-[220px] shrink-0 border-e border-edge dark:border-edge-dark bg-surface-card dark:bg-surface-card-dark overflow-y-auto hidden md:block">
        <div className="p-4 border-b border-edge dark:border-edge-dark">
          <h2 className="m-0 text-sm font-bold text-content dark:text-content-dark flex items-center gap-2">
            <Settings size={16} className="text-brand-500" />
            {isRTL ? 'الإعدادات' : 'Settings'}
          </h2>
        </div>
        <div className="p-2">
          {SETTINGS_TABS.filter(tab => {
            if (tab.adminOnly && profile?.role !== 'admin') return false;
            if (tab.perm && !hasPermission(tab.perm) && profile?.role !== 'admin') return false;
            return true;
          }).map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs border-none cursor-pointer transition-all mb-0.5 ${isActive ? 'bg-brand-500/10 text-brand-500 font-bold' : 'bg-transparent text-content-muted dark:text-content-muted-dark hover:bg-brand-500/5 font-normal'}`}
              >
                <Icon size={14} />
                {isRTL ? tab.ar : tab.en}
              </button>
            );
          })}
        </div>
      </div>

      {/* Mobile tab selector */}
      <div className="md:hidden fixed top-[72px] left-0 right-0 z-50 bg-surface-card dark:bg-surface-card-dark border-b border-edge dark:border-edge-dark px-3 py-2 overflow-x-auto">
        <div className="flex gap-1.5" style={{ minWidth: 'max-content' }}>
          {SETTINGS_TABS.filter(tab => {
            if (tab.adminOnly && profile?.role !== 'admin') return false;
            if (tab.perm && !hasPermission(tab.perm) && profile?.role !== 'admin') return false;
            return true;
          }).map(tab => {
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`px-3 py-1.5 rounded-full text-[11px] border-none cursor-pointer whitespace-nowrap ${isActive ? 'bg-brand-500 text-white font-bold' : 'bg-surface-bg dark:bg-surface-bg-dark text-content-muted dark:text-content-muted-dark'}`}
              >
                {isRTL ? tab.ar : tab.en}
              </button>
            );
          })}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4 md:p-6 md:pt-6 pt-16">
        <Suspense fallback={<PageSkeleton hasKpis={false} tableRows={5} tableCols={4} />}>
          <div style={{ display: activeTab === 'general' ? 'block' : 'none' }}><GeneralTab isRTL={isRTL} isDark={isDark} toggleTheme={toggleTheme} lang={lang} handleLangToggle={handleLangToggle} profile={profile} /></div>
          <div style={{ display: activeTab === 'system' ? 'block' : 'none' }}><SystemConfigPage /></div>
          <div style={{ display: activeTab === 'users' ? 'block' : 'none' }}><UsersPage /></div>
          {activeTab === 'hierarchy' && <TeamHierarchyPage />}
          {activeTab === 'import-export' && <ImportExportLogPage />}
          {activeTab === 'roles' && <RolesPage />}
          {activeTab === 'audit' && <AuditLogPage />}
          {activeTab === 'tracking' && <UserTrackingPage />}
          {activeTab === 'triggers' && <TriggersPage />}
          {activeTab === 'workflows' && <WorkflowBuilderPage />}
          {activeTab === 'custom-fields' && <CustomFieldsPage />}
          {activeTab === 'sms-templates' && <SMSTemplatesPage />}
          {activeTab === 'print' && <PrintSettingsPage />}
          {activeTab === 'scheduled' && <ScheduledReportsPage />}
          {activeTab === 'security' && <SecurityPage />}
          {activeTab === 'backup' && <BackupPage />}
          {activeTab === 'health' && <SystemHealthPage />}
          {activeTab === 'sla' && <SLAManagementPage />}
          {activeTab === 'ads' && <AdsIntegrationPage />}
          {activeTab === 'api-docs' && <APIDocsPage />}
        </Suspense>
      </div>
    </div>
  );
}
