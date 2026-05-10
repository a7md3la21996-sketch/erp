import { lazy, Suspense } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useLocation } from 'react-router-dom';
import { FileText, Briefcase, Package, Shield, BookMarked, TrendingUp } from 'lucide-react';
import { PageSkeleton } from '../../components/ui';

const AdminHubOverview = lazy(() => import('./AdminHubOverview'));
const DocumentsPage    = lazy(() => import('./DocumentsPage'));
const ContractsPage    = lazy(() => import('./ContractsPage'));
const AssetsPage       = lazy(() => import('./AssetsPage'));
const HRPoliciesPage   = lazy(() => import('./HRPoliciesPage'));
const DisciplinaryPage = lazy(() => import('./DisciplinaryPage'));

const TABS = [
  { key: 'overview',     icon: TrendingUp,  label_ar: 'نظرة عامة',   label_en: 'Overview' },
  { key: 'documents',    icon: FileText,    label_ar: 'المستندات',   label_en: 'Documents' },
  { key: 'contracts',    icon: Briefcase,   label_ar: 'العقود',      label_en: 'Contracts' },
  { key: 'assets',       icon: Package,     label_ar: 'الأصول',       label_en: 'Assets' },
  { key: 'policies',     icon: BookMarked,  label_ar: 'السياسات',    label_en: 'Policies' },
  { key: 'disciplinary', icon: Shield,      label_ar: 'التأديبية',  label_en: 'Disciplinary' },
];

export default function AdminHubPage() {
  const { i18n } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const isRTL = i18n.language === 'ar';
  const lang = i18n.language;

  const params = new URLSearchParams(location.search);
  const activeKey = TABS.find(t => t.key === params.get('tab'))?.key || 'overview';

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} className="px-4 py-4 md:px-7 md:py-6 bg-surface-bg dark:bg-surface-bg-dark min-h-screen">
      <div className={`flex items-center gap-3.5 mb-5 ${isRTL ? 'flex-row-reverse' : ''}`}>
        <div className="w-10 h-10 rounded-xl bg-brand-500/[0.12] flex items-center justify-center">
          <FileText size={22} className="text-brand-500" />
        </div>
        <div className={isRTL ? 'text-right' : 'text-left'}>
          <h1 className="m-0 text-xl font-bold text-content dark:text-content-dark">{isRTL ? 'الإدارة والملفات' : 'Records & Admin'}</h1>
          <p className="m-0 text-xs text-content-muted dark:text-content-muted-dark">
            {isRTL ? 'المستندات، العقود، الأصول، السياسات، والتأديبية' : 'Documents, contracts, assets, policies & disciplinary'}
          </p>
        </div>
      </div>

      <div className={`flex gap-1 mb-5 p-1 rounded-xl bg-surface-card dark:bg-surface-card-dark border border-edge dark:border-edge-dark overflow-x-auto ${isRTL ? 'flex-row-reverse' : ''}`}>
        {TABS.map(tab => {
          const Icon = tab.icon;
          const active = activeKey === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => navigate(tab.key === 'overview' ? '/hr/admin' : `/hr/admin?tab=${tab.key}`)}
              className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg text-xs md:text-sm font-semibold whitespace-nowrap transition-colors ${
                active ? 'bg-brand-500 text-white' : 'text-content-muted dark:text-content-muted-dark hover:bg-brand-500/10 hover:text-brand-500'
              }`}
            >
              <Icon size={14} />
              {isRTL ? tab.label_ar : tab.label_en}
            </button>
          );
        })}
      </div>

      <Suspense fallback={<div className="px-4 py-4"><PageSkeleton hasKpis tableRows={6} /></div>}>
        {activeKey === 'overview'     && <AdminHubOverview isRTL={isRTL} lang={lang} />}
        {activeKey === 'documents'    && <div className="-mx-4 -my-4 md:-mx-7 md:-my-6"><DocumentsPage /></div>}
        {activeKey === 'contracts'    && <div className="-mx-4 -my-4 md:-mx-7 md:-my-6"><ContractsPage /></div>}
        {activeKey === 'assets'       && <div className="-mx-4 -my-4 md:-mx-7 md:-my-6"><AssetsPage /></div>}
        {activeKey === 'policies'     && <div className="-mx-4 -my-4 md:-mx-7 md:-my-6"><HRPoliciesPage /></div>}
        {activeKey === 'disciplinary' && <div className="-mx-4 -my-4 md:-mx-7 md:-my-6"><DisciplinaryPage /></div>}
      </Suspense>
    </div>
  );
}
