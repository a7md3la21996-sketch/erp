import { Suspense } from 'react';
import lazyRetry from '../../utils/lazyRetry';
import { useTranslation } from 'react-i18next';
import { useNavigate, useLocation } from 'react-router-dom';
import { Award, TrendingUp, Target, BookOpen, Star } from 'lucide-react';
import { PageSkeleton } from '../../components/ui';

const DevelopmentHubOverview = lazyRetry(() => import('./DevelopmentHubOverview'));
const PerformanceReviewPage  = lazyRetry(() => import('./PerformanceReviewPage'));
const CompetenciesPage       = lazyRetry(() => import('./CompetenciesPage'));
const TrainingPage           = lazyRetry(() => import('./TrainingPage'));

const TABS = [
  { key: 'overview',     icon: TrendingUp, label_ar: 'نظرة عامة',     label_en: 'Overview' },
  { key: 'reviews',      icon: Award,      label_ar: 'تقييم الأداء',  label_en: 'Reviews' },
  { key: 'competencies', icon: Star,       label_ar: 'الكفاءات',       label_en: 'Competencies' },
  { key: 'training',     icon: BookOpen,   label_ar: 'التدريب',        label_en: 'Training' },
];

export default function DevelopmentHubPage() {
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
          <Award size={22} className="text-brand-500" />
        </div>
        <div className={isRTL ? 'text-right' : 'text-left'}>
          <h1 className="m-0 text-xl font-bold text-content dark:text-content-dark">{isRTL ? 'التطوير والأداء' : 'Performance & Development'}</h1>
          <p className="m-0 text-xs text-content-muted dark:text-content-muted-dark">
            {isRTL ? 'التقييمات والكفاءات والتدريب' : 'Reviews, competencies, and training programs'}
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
              onClick={() => navigate(tab.key === 'overview' ? '/hr/development' : `/hr/development?tab=${tab.key}`)}
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
        {activeKey === 'overview'     && <DevelopmentHubOverview isRTL={isRTL} lang={lang} />}
        {activeKey === 'reviews'      && <div className="-mx-4 -my-4 md:-mx-7 md:-my-6"><PerformanceReviewPage /></div>}
        {activeKey === 'competencies' && <div className="-mx-4 -my-4 md:-mx-7 md:-my-6"><CompetenciesPage /></div>}
        {activeKey === 'training'     && <div className="-mx-4 -my-4 md:-mx-7 md:-my-6"><TrainingPage /></div>}
      </Suspense>
    </div>
  );
}
