import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/AuthContext';
import { X, ChevronLeft, ChevronRight, BookUser, Target, BarChart3, MessageCircle } from 'lucide-react';

const STORAGE_KEY = 'platform_tour_completed';

const STEPS = [
  {
    icon: BookUser,
    color: '#4A7AAB',
    title: { ar: 'جهات الاتصال', en: 'Contacts' },
    body: { ar: 'أضف ليدز جديدة، سجل مكالمات، وتابع كل عميل من مكان واحد.', en: 'Add new leads, log calls, and track every client from one place.' },
    target: 'contacts',
  },
  {
    icon: Target,
    color: '#2B4C6F',
    title: { ar: 'الفرص البيعية', en: 'Opportunities' },
    body: { ar: 'تتبع كل فرصة بيع من أول تواصل لحد إتمام الصفقة.', en: 'Track every sales opportunity from first contact to closing the deal.' },
    target: 'opportunities',
  },
  {
    icon: BarChart3,
    color: '#10B981',
    title: { ar: 'لوحة التحكم', en: 'Dashboard' },
    body: { ar: 'شوف أداءك اليومي، المتابعات، والأرقام المهمة في نظرة واحدة.', en: 'See your daily performance, follow-ups, and key numbers at a glance.' },
    target: 'dashboard',
  },
  {
    icon: MessageCircle,
    color: '#8B5CF6',
    title: { ar: 'التواصل والمهام', en: 'Communication & Tasks' },
    body: { ar: 'استخدم الشات، واتساب، والمهام لتنظيم يومك بالكامل.', en: 'Use chat, WhatsApp, and tasks to organize your entire day.' },
    target: 'workspace',
  },
];

export default function ProductTour() {
  const { i18n } = useTranslation();
  const { profile } = useAuth();
  const lang = i18n.language === 'ar' ? 'ar' : 'en';
  const isRTL = lang === 'ar';
  const [show, setShow] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (!profile?.id) return;
    const key = `${STORAGE_KEY}_${profile.id}`;
    const completed = localStorage.getItem(key);
    if (!completed) {
      const timer = setTimeout(() => setShow(true), 1500);
      return () => clearTimeout(timer);
    }
  }, [profile?.id]);

  const complete = () => {
    if (profile?.id) {
      localStorage.setItem(`${STORAGE_KEY}_${profile.id}`, 'true');
    }
    setShow(false);
  };

  if (!show) return null;

  const current = STEPS[step];
  const StepIcon = current.icon;
  const isLast = step === STEPS.length - 1;

  return (
    <div className="fixed inset-0 bg-black/60 z-[500] flex items-center justify-center p-5" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="bg-surface-card dark:bg-surface-card-dark border border-edge dark:border-edge-dark rounded-2xl w-full max-w-[440px] overflow-hidden">
        {/* Progress bar */}
        <div className="h-1 bg-brand-500/10">
          <div
            className="h-full bg-brand-500 transition-all duration-300 rounded-e-full"
            style={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
          />
        </div>

        {/* Close */}
        <div className="flex justify-end px-4 pt-3">
          <button onClick={complete} className="bg-transparent border-none cursor-pointer text-content-muted dark:text-content-muted-dark p-1 rounded-lg hover:bg-brand-500/[0.08] transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <div className="px-8 pb-2 text-center">
          <div className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center" style={{ background: current.color + '18' }}>
            <StepIcon size={32} color={current.color} />
          </div>
          <h3 className="m-0 text-lg font-bold text-content dark:text-content-dark mb-2">
            {current.title[lang]}
          </h3>
          <p className="m-0 text-sm text-content-muted dark:text-content-muted-dark leading-relaxed">
            {current.body[lang]}
          </p>
        </div>

        {/* Step dots */}
        <div className="flex justify-center gap-1.5 py-4">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className="rounded-full transition-all duration-200"
              style={{
                width: i === step ? 20 : 6,
                height: 6,
                background: i === step ? current.color : (i < step ? current.color + '60' : '#e2e8f040'),
              }}
            />
          ))}
        </div>

        {/* Actions */}
        <div className="px-6 pb-6 flex gap-2.5">
          {step > 0 && (
            <button
              onClick={() => setStep(s => s - 1)}
              className="flex-1 py-2.5 rounded-xl border border-edge dark:border-edge-dark bg-transparent text-content dark:text-content-dark text-sm font-semibold cursor-pointer flex items-center justify-center gap-1.5 hover:bg-brand-500/[0.05] transition-colors"
              style={{ flexDirection: isRTL ? 'row-reverse' : 'row' }}
            >
              {isRTL ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
              {lang === 'ar' ? 'السابق' : 'Back'}
            </button>
          )}
          <button
            onClick={isLast ? complete : () => setStep(s => s + 1)}
            className="flex-1 py-2.5 rounded-xl border-none bg-brand-500 text-white text-sm font-semibold cursor-pointer flex items-center justify-center gap-1.5 hover:bg-brand-600 transition-colors"
            style={{ flexDirection: isRTL ? 'row-reverse' : 'row' }}
          >
            {isLast ? (lang === 'ar' ? 'ابدأ الآن!' : "Let's go!") : (lang === 'ar' ? 'التالي' : 'Next')}
            {!isLast && (isRTL ? <ChevronLeft size={14} /> : <ChevronRight size={14} />)}
          </button>
        </div>
      </div>
    </div>
  );
}
