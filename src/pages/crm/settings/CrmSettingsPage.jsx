import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSystemConfig } from '../../../contexts/SystemConfigContext';
import { useToast } from '../../../contexts/ToastContext';
import { Card, Button, FilterPill } from '../../../components/ui';
import { Settings, Users, Tag, GitBranch, Zap, XCircle, ThumbsDown, Target, SlidersHorizontal, Save, Clock } from 'lucide-react';
import {
  ContactTypesTab, LeadCategoriesTab, SourcesTab, PipelineStagesTab,
  ActivityTypesTab, CloseReasonsTab, DQReasonsTab, StageWinRatesTab,
} from '../../settings/SystemConfigPage';

// ── CRM Settings — CRM-domain configuration living INSIDE the CRM module,
// instead of being buried in the global System Config page. It reuses the same
// editable sections (they read/write through useSystemConfig/updateSection, the
// system_config key/value store) plus one CRM-specific threshold.

// Thresholds tab: CRM-domain numeric knobs (currently the responsive window).
function ThresholdsTab({ config, updateSection, isRTL, toast }) {
  const cur = config.crmThresholds || { responsive_window_days: 7 };
  const [days, setDays] = useState(cur.responsive_window_days ?? 7);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const v = parseInt(days, 10);
    if (isNaN(v) || v < 1) { toast.error(isRTL ? 'أدخل عدد أيام صحيح' : 'Enter a valid number of days'); return; }
    setSaving(true);
    try {
      await updateSection('crmThresholds', { ...cur, responsive_window_days: v });
      toast.success(isRTL ? 'تم الحفظ' : 'Saved');
    } catch {
      toast.error(isRTL ? 'فشل الحفظ' : 'Save failed');
    } finally { setSaving(false); }
  };

  return (
    <Card className="p-4 max-w-[560px]">
      <div className="flex items-start gap-3 py-3">
        <Clock size={18} className="text-brand-500 shrink-0 mt-1" aria-hidden="true" />
        <div className="flex-1 min-w-0">
          <div className="text-sm font-bold text-content dark:text-content-dark">{isRTL ? 'نافذة التجاوب (Responsive window)' : 'Responsive window'}</div>
          <div className="text-xs text-content-muted dark:text-content-muted-dark mt-0.5 leading-relaxed">
            {isRTL
              ? 'الليد يعتبر «متجاوب» لو رد خلال المدة دي — أكتر منها يبقى «توقّف عن الرد مؤخراً». بتظهر في Full Lead Profile.'
              : 'A lead counts as "Responsive" if it replied within this window — older means "Unresponsive lately". Shown in the Full Lead Profile.'}
          </div>
          <div className="flex items-center gap-2 mt-3">
            <input type="number" min="1" max="90" value={days} onChange={e => setDays(e.target.value)}
              className="w-20 px-3 py-2 rounded-lg text-sm bg-surface-input dark:bg-surface-input-dark border border-edge dark:border-edge-dark text-content dark:text-content-dark" />
            <span className="text-sm text-content-muted dark:text-content-muted-dark">{isRTL ? 'يوم' : 'days'}</span>
          </div>
        </div>
      </div>
      <div className="mt-2">
        <Button onClick={save} disabled={saving} variant="primary" className="inline-flex items-center gap-1.5">
          <Save size={15} /> {isRTL ? 'حفظ' : 'Save'}
        </Button>
      </div>
    </Card>
  );
}

const TABS = [
  { key: 'contactTypes',   icon: Users,            ar: 'أنواع العملاء',   en: 'Contact types',   Comp: ContactTypesTab },
  { key: 'leadCategories', icon: Tag,              ar: 'فئات الليدز',      en: 'Lead categories', Comp: LeadCategoriesTab },
  { key: 'sources',        icon: Tag,              ar: 'المصادر',          en: 'Sources',         Comp: SourcesTab },
  { key: 'pipeline',       icon: GitBranch,        ar: 'مراحل البايبلاين', en: 'Pipeline stages', Comp: PipelineStagesTab },
  { key: 'activityTypes',  icon: Zap,              ar: 'الأنشطة والنتائج', en: 'Activity types',  Comp: ActivityTypesTab },
  { key: 'dqReasons',      icon: ThumbsDown,       ar: 'أسباب الاستبعاد',  en: 'Disqualify reasons', Comp: DQReasonsTab },
  { key: 'closeReasons',   icon: XCircle,          ar: 'أسباب الإغلاق',    en: 'Close reasons',   Comp: CloseReasonsTab },
  { key: 'stageWinRates',  icon: Target,           ar: 'نسب الإغلاق',      en: 'Stage win rates', Comp: StageWinRatesTab },
  { key: 'thresholds',     icon: SlidersHorizontal,ar: 'المعايير',         en: 'Thresholds',      Comp: ThresholdsTab },
];

export default function CrmSettingsPage() {
  const { i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const toast = useToast();
  const { config, updateSection } = useSystemConfig();
  const [active, setActive] = useState('contactTypes');

  const ActiveComp = (TABS.find(t => t.key === active) || TABS[0]).Comp;

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} className="px-4 py-4 md:px-7 md:py-6 bg-[#F7F8FA] dark:bg-[#0A0D13] min-h-dvh">
      <div className="max-w-[960px] mx-auto">
        <div className="flex items-center gap-2.5 mb-1">
          <Settings size={20} className="text-brand-500" aria-hidden="true" />
          <h1 className="m-0 text-xl font-bold text-content dark:text-content-dark">{isRTL ? 'إعدادات CRM' : 'CRM Settings'}</h1>
        </div>
        <p className="text-sm text-content-muted dark:text-content-muted-dark mt-0 mb-4">
          {isRTL ? 'كل تصنيفات ومعايير الـCRM في مكان واحد داخل الموديول.' : 'All CRM classifications and thresholds in one place, inside the module.'}
        </p>

        <div className="flex gap-2 flex-wrap mb-5">
          {TABS.map(t => (
            <FilterPill key={t.key} label={isRTL ? t.ar : t.en} active={active === t.key} onClick={() => setActive(t.key)} />
          ))}
        </div>

        <div className="max-w-[900px]">
          <ActiveComp config={config} updateSection={updateSection} isRTL={isRTL} toast={toast} />
        </div>
      </div>
    </div>
  );
}
