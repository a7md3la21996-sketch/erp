import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../contexts/ThemeContext';
import { useLocation } from 'react-router-dom';
import {
  isOnboardingComplete,
  completeOnboarding,
  getCurrentStep,
  setCurrentStep,
} from '../../services/onboardingService';
import {
  Rocket, Layout, BarChart3, Search, Bell, Star, Moon, Keyboard, PartyPopper,
  ChevronLeft, ChevronRight, X,
} from 'lucide-react';

const STEPS = [
  {
    id: 'welcome',
    type: 'center',
    icon: Rocket,
    title: { ar: 'مرحباً بك في Platform ERP!', en: 'Welcome to Platform ERP!' },
    desc: {
      ar: 'دعنا نأخذك في جولة سريعة للتعرف على أهم ميزات النظام. لن يستغرق الأمر أكثر من دقيقة واحدة.',
      en: 'Let us take you on a quick tour of the key features. It will only take about a minute.',
    },
    buttonLabel: { ar: 'ابدأ الجولة', en: 'Start Tour' },
  },
  {
    id: 'sidebar',
    type: 'highlight',
    selector: 'aside',
    position: 'right',
    icon: Layout,
    title: { ar: 'القائمة الجانبية', en: 'Sidebar Navigation' },
    desc: {
      ar: 'تنقل بسهولة بين أقسام النظام: إدارة العلاقات (CRM)، الموارد البشرية (HR)، المالية، المبيعات، والمزيد.',
      en: 'Easily navigate between modules: CRM, HR, Finance, Sales, Operations, and more.',
    },
  },
  {
    id: 'dashboard',
    type: 'highlight',
    selector: 'main',
    position: 'bottom',
    icon: BarChart3,
    title: { ar: 'لوحة التحكم', en: 'Dashboard' },
    desc: {
      ar: 'عرض مؤشرات الأداء (KPIs)، الرسوم البيانية، وتخصيص الويدجت حسب احتياجاتك.',
      en: 'View KPI cards, charts, and customize widgets to fit your workflow.',
    },
  },
  {
    id: 'search',
    type: 'highlight',
    selector: '[aria-label="Open menu"] ~ button, button:has(.lucide-search)',
    fallbackSelector: 'header button',
    position: 'bottom',
    icon: Search,
    title: { ar: 'البحث السريع', en: 'Global Search' },
    desc: {
      ar: 'اضغط ⌘K (أو Ctrl+K) للبحث السريع في جهات الاتصال، الفرص، المهام، وكل شيء.',
      en: 'Press ⌘K (or Ctrl+K) to quickly search contacts, opportunities, tasks, and everything.',
    },
  },
  {
    id: 'notifications',
    type: 'highlight',
    selector: 'button[aria-label="Notifications"], button[aria-label="الإشعارات"]',
    position: 'bottom',
    icon: Bell,
    title: { ar: 'الإشعارات', en: 'Notifications' },
    desc: {
      ar: 'تابع التحديثات المهمة والتنبيهات في الوقت الفعلي.',
      en: 'Stay updated with real-time alerts and important notifications.',
    },
  },
  {
    id: 'favorites',
    type: 'highlight',
    selector: 'button[title="Favorites"], button[title="المفضلة"]',
    position: 'bottom',
    icon: Star,
    title: { ar: 'المفضلة', en: 'Favorites' },
    desc: {
      ar: 'أضف الصفحات والعناصر المهمة إلى المفضلة للوصول السريع.',
      en: 'Bookmark important pages and items for quick access.',
    },
  },
  {
    id: 'theme',
    type: 'highlight',
    selector: 'button[title="Theme Mode"], button[title="وضع المظهر"]',
    position: 'bottom',
    icon: Moon,
    title: { ar: 'المظهر', en: 'Theme' },
    desc: {
      ar: 'بدّل بين الوضع الفاتح والداكن، أو فعّل الجدول الزمني التلقائي.',
      en: 'Switch between light and dark mode, or set an automatic schedule.',
    },
  },
  {
    id: 'shortcuts',
    type: 'highlight',
    selector: 'button[title="Keyboard Shortcuts"], button[title="اختصارات لوحة المفاتيح"]',
    position: 'bottom',
    icon: Keyboard,
    title: { ar: 'اختصارات لوحة المفاتيح', en: 'Keyboard Shortcuts' },
    desc: {
      ar: 'اضغط ? في أي وقت لعرض جميع الاختصارات المتاحة للتنقل السريع.',
      en: 'Press ? anytime to see all available shortcuts for fast navigation.',
    },
  },
  {
    id: 'done',
    type: 'center',
    icon: PartyPopper,
    title: { ar: 'أنت جاهز!', en: "You're all set!" },
    desc: {
      ar: 'أنت الآن مستعد لاستخدام النظام بكفاءة. يمكنك إعادة الجولة في أي وقت من اختصارات لوحة المفاتيح.',
      en: "You're ready to use the platform efficiently. You can restart this tour anytime from the keyboard shortcuts menu.",
    },
    buttonLabel: { ar: 'ابدأ العمل', en: 'Get Started' },
  },
];

export default function OnboardingTour({ forceShow, onClose }) {
  const { i18n } = useTranslation();
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const isRTL = i18n.language === 'ar';
  const location = useLocation();

  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState(0);
  const [highlightRect, setHighlightRect] = useState(null);
  const [animating, setAnimating] = useState(false);
  const resizeTimer = useRef(null);

  // Determine visibility
  useEffect(() => {
    if (forceShow) {
      setVisible(true);
      setStep(0);
      setCurrentStep(0);
      return;
    }
    // Only auto-show on dashboard for first-time users
    if (!isOnboardingComplete() && location.pathname === '/dashboard') {
      const saved = getCurrentStep();
      setStep(saved);
      setVisible(true);
    }
  }, [forceShow, location.pathname]);

  // Listen for restart event from ShortcutsHelpModal
  useEffect(() => {
    const handler = () => {
      setStep(0);
      setCurrentStep(0);
      setVisible(true);
    };
    window.addEventListener('platform_restart_tour', handler);
    return () => window.removeEventListener('platform_restart_tour', handler);
  }, []);

  // Find and measure the highlighted element
  const measureTarget = useCallback(() => {
    const currentStep = STEPS[step];
    if (!currentStep || currentStep.type !== 'highlight') {
      setHighlightRect(null);
      return;
    }
    let el = document.querySelector(currentStep.selector);
    if (!el && currentStep.fallbackSelector) {
      el = document.querySelector(currentStep.fallbackSelector);
    }
    if (el) {
      const rect = el.getBoundingClientRect();
      setHighlightRect({
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height,
      });
    } else {
      setHighlightRect(null);
    }
  }, [step]);

  useEffect(() => {
    if (!visible) return;
    // Small delay to let DOM settle
    const timer = setTimeout(measureTarget, 100);
    const handleResize = () => {
      clearTimeout(resizeTimer.current);
      resizeTimer.current = setTimeout(measureTarget, 150);
    };
    window.addEventListener('resize', handleResize);
    window.addEventListener('scroll', measureTarget, true);
    return () => {
      clearTimeout(timer);
      clearTimeout(resizeTimer.current);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('scroll', measureTarget, true);
    };
  }, [visible, step, measureTarget]);

  // ESC to close
  useEffect(() => {
    if (!visible) return;
    const handler = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopImmediatePropagation();
        handleComplete();
      }
    };
    document.addEventListener('keydown', handler, true);
    return () => document.removeEventListener('keydown', handler, true);
  }, [visible]);

  const handleComplete = useCallback(() => {
    completeOnboarding();
    setVisible(false);
    setStep(0);
    if (onClose) onClose();
  }, [onClose]);

  const goNext = () => {
    if (step >= STEPS.length - 1) {
      handleComplete();
      return;
    }
    setAnimating(true);
    setTimeout(() => setAnimating(false), 300);
    const next = step + 1;
    setStep(next);
    setCurrentStep(next);
  };

  const goPrev = () => {
    if (step <= 0) return;
    setAnimating(true);
    setTimeout(() => setAnimating(false), 300);
    const prev = step - 1;
    setStep(prev);
    setCurrentStep(prev);
  };

  if (!visible) return null;

  const current = STEPS[step];
  const isCenter = current.type === 'center';
  const Icon = current.icon;
  const totalSteps = STEPS.length;

  // Tooltip position calculation
  const getTooltipStyle = () => {
    if (isCenter || !highlightRect) return {};
    const padding = 16;
    const tooltipW = 360;
    const pos = current.position || 'bottom';
    const style = { position: 'fixed', width: tooltipW, maxWidth: 'calc(100vw - 32px)' };

    if (pos === 'bottom') {
      style.top = highlightRect.top + highlightRect.height + padding;
      style.left = Math.max(16, Math.min(
        highlightRect.left + highlightRect.width / 2 - tooltipW / 2,
        window.innerWidth - tooltipW - 16
      ));
    } else if (pos === 'top') {
      style.bottom = window.innerHeight - highlightRect.top + padding;
      style.left = Math.max(16, Math.min(
        highlightRect.left + highlightRect.width / 2 - tooltipW / 2,
        window.innerWidth - tooltipW - 16
      ));
    } else if (pos === 'right') {
      style.top = Math.max(16, highlightRect.top + highlightRect.height / 2 - 80);
      style.left = highlightRect.left + highlightRect.width + padding;
      if (style.left + tooltipW > window.innerWidth - 16) {
        // Fallback to bottom if no room on right
        style.left = Math.max(16, highlightRect.left);
        style.top = highlightRect.top + highlightRect.height + padding;
      }
    } else if (pos === 'left') {
      style.top = Math.max(16, highlightRect.top + highlightRect.height / 2 - 80);
      style.right = window.innerWidth - highlightRect.left + padding;
    }

    return style;
  };

  // Colors
  const cardBg = isDark ? '#1a2332' : '#ffffff';
  const cardBorder = isDark ? 'rgba(74,122,171,0.2)' : 'rgba(74,122,171,0.15)';
  const textPrimary = isDark ? '#e2e8f0' : '#1e293b';
  const textSecondary = isDark ? '#94a3b8' : '#64748b';
  const accent = '#4A7AAB';

  // Confetti dots for the done step
  const confettiDots = current.id === 'done' ? (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none', borderRadius: 20 }}>
      {Array.from({ length: 24 }).map((_, i) => {
        const colors = ['#4A7AAB', '#F59E0B', '#10B981', '#EF4444', '#8B5CF6', '#EC4899'];
        const color = colors[i % colors.length];
        const size = 4 + Math.random() * 6;
        const left = Math.random() * 100;
        const top = Math.random() * 100;
        const delay = Math.random() * 2;
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: `${left}%`,
              top: `${top}%`,
              width: size,
              height: size,
              borderRadius: Math.random() > 0.5 ? '50%' : 2,
              backgroundColor: color,
              opacity: 0.3 + Math.random() * 0.4,
              transform: `rotate(${Math.random() * 360}deg)`,
              animation: `onboarding-float ${2 + Math.random() * 3}s ease-in-out ${delay}s infinite alternate`,
            }}
          />
        );
      })}
    </div>
  ) : null;

  // Inject keyframes for confetti animation
  const keyframesStyle = (
    <style>{`
      @keyframes onboarding-float {
        0% { transform: translateY(0) rotate(0deg); opacity: 0.3; }
        100% { transform: translateY(-20px) rotate(180deg); opacity: 0.7; }
      }
      @keyframes onboarding-pulse {
        0%, 100% { box-shadow: 0 0 0 0 rgba(74,122,171,0.3); }
        50% { box-shadow: 0 0 0 8px rgba(74,122,171,0); }
      }
    `}</style>
  );

  return (
    <>
      {keyframesStyle}
      <div
        dir={isRTL ? 'rtl' : 'ltr'}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 9999,
          pointerEvents: 'auto',
        }}
      >
        {/* Semi-transparent overlay with spotlight cutout */}
        {!isCenter && highlightRect ? (
          <svg
            style={{ position: 'fixed', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
            onClick={handleComplete}
          >
            <defs>
              <mask id="onboarding-spotlight">
                <rect x="0" y="0" width="100%" height="100%" fill="white" />
                <rect
                  x={highlightRect.left - 8}
                  y={highlightRect.top - 8}
                  width={highlightRect.width + 16}
                  height={highlightRect.height + 16}
                  rx="12"
                  fill="black"
                />
              </mask>
            </defs>
            <rect
              x="0" y="0" width="100%" height="100%"
              fill="rgba(0,0,0,0.55)"
              mask="url(#onboarding-spotlight)"
              style={{ pointerEvents: 'auto', cursor: 'default' }}
              onClick={(e) => e.stopPropagation()}
            />
          </svg>
        ) : (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              backgroundColor: 'rgba(0,0,0,0.6)',
              backdropFilter: 'blur(2px)',
            }}
            onClick={(e) => e.stopPropagation()}
          />
        )}

        {/* Spotlight border ring */}
        {!isCenter && highlightRect && (
          <div
            style={{
              position: 'fixed',
              top: highlightRect.top - 8,
              left: highlightRect.left - 8,
              width: highlightRect.width + 16,
              height: highlightRect.height + 16,
              borderRadius: 12,
              border: `2px solid ${accent}`,
              pointerEvents: 'none',
              animation: 'onboarding-pulse 2s ease-in-out infinite',
            }}
          />
        )}

        {/* Center card or tooltip */}
        {isCenter ? (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 16,
            }}
          >
            <div
              style={{
                position: 'relative',
                width: '100%',
                maxWidth: 440,
                borderRadius: 20,
                backgroundColor: cardBg,
                border: `1px solid ${cardBorder}`,
                boxShadow: isDark
                  ? '0 32px 64px rgba(0,0,0,0.5)'
                  : '0 32px 64px rgba(0,0,0,0.15)',
                padding: '48px 36px 36px',
                textAlign: 'center',
                overflow: 'hidden',
                opacity: animating ? 0.7 : 1,
                transform: animating ? 'scale(0.97)' : 'scale(1)',
                transition: 'opacity 0.3s, transform 0.3s',
              }}
            >
              {confettiDots}

              {/* Icon */}
              <div
                style={{
                  width: 72,
                  height: 72,
                  borderRadius: '50%',
                  background: isDark ? 'rgba(74,122,171,0.15)' : 'rgba(74,122,171,0.1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 20px',
                }}
              >
                <Icon size={36} style={{ color: accent }} />
              </div>

              {/* Title */}
              <h2
                style={{
                  fontSize: 24,
                  fontWeight: 700,
                  color: textPrimary,
                  margin: '0 0 12px',
                  lineHeight: 1.3,
                }}
              >
                {isRTL ? current.title.ar : current.title.en}
              </h2>

              {/* Description */}
              <p
                style={{
                  fontSize: 14,
                  color: textSecondary,
                  margin: '0 0 32px',
                  lineHeight: 1.7,
                }}
              >
                {isRTL ? current.desc.ar : current.desc.en}
              </p>

              {/* Actions */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 12,
                  flexWrap: 'wrap',
                }}
              >
                {current.id === 'welcome' && (
                  <button
                    onClick={handleComplete}
                    style={{
                      border: 'none',
                      background: 'none',
                      cursor: 'pointer',
                      fontSize: 13,
                      color: textSecondary,
                      padding: '10px 20px',
                      fontFamily: 'inherit',
                    }}
                  >
                    {isRTL ? 'تخطي' : 'Skip'}
                  </button>
                )}
                {current.id === 'done' && step > 0 && (
                  <button
                    onClick={goPrev}
                    style={{
                      border: `1px solid ${cardBorder}`,
                      background: 'none',
                      cursor: 'pointer',
                      fontSize: 13,
                      color: textSecondary,
                      padding: '10px 20px',
                      borderRadius: 10,
                      fontFamily: 'inherit',
                    }}
                  >
                    {isRTL ? 'السابق' : 'Previous'}
                  </button>
                )}
                <button
                  onClick={current.id === 'done' ? handleComplete : goNext}
                  style={{
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: 14,
                    fontWeight: 600,
                    color: '#ffffff',
                    backgroundColor: accent,
                    padding: '12px 32px',
                    borderRadius: 12,
                    fontFamily: 'inherit',
                    boxShadow: `0 4px 12px rgba(74,122,171,0.3)`,
                    transition: 'transform 0.15s',
                  }}
                  onMouseEnter={(e) => { e.target.style.transform = 'scale(1.03)'; }}
                  onMouseLeave={(e) => { e.target.style.transform = 'scale(1)'; }}
                >
                  {isRTL ? current.buttonLabel.ar : current.buttonLabel.en}
                </button>
              </div>

              {/* Step indicator */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  marginTop: 28,
                }}
              >
                {STEPS.map((_, i) => (
                  <div
                    key={i}
                    style={{
                      width: i === step ? 20 : 6,
                      height: 6,
                      borderRadius: 3,
                      backgroundColor: i === step ? accent : (isDark ? 'rgba(148,163,184,0.2)' : 'rgba(0,0,0,0.1)'),
                      transition: 'width 0.3s, background-color 0.3s',
                    }}
                  />
                ))}
              </div>
            </div>
          </div>
        ) : (
          /* Tooltip card for highlight steps */
          <div
            style={{
              ...getTooltipStyle(),
              borderRadius: 16,
              backgroundColor: cardBg,
              border: `1px solid ${cardBorder}`,
              boxShadow: isDark
                ? '0 20px 40px rgba(0,0,0,0.4)'
                : '0 20px 40px rgba(0,0,0,0.12)',
              padding: '20px 24px',
              zIndex: 10000,
              opacity: animating ? 0.7 : 1,
              transform: animating ? 'translateY(4px)' : 'translateY(0)',
              transition: 'opacity 0.3s, transform 0.3s',
            }}
          >
            {/* Step count */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 12,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: '50%',
                    background: isDark ? 'rgba(74,122,171,0.15)' : 'rgba(74,122,171,0.1)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Icon size={16} style={{ color: accent }} />
                </div>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    color: accent,
                    letterSpacing: 0.5,
                  }}
                >
                  {step + 1} / {totalSteps}
                </span>
              </div>
              <button
                onClick={handleComplete}
                style={{
                  border: 'none',
                  background: 'none',
                  cursor: 'pointer',
                  padding: 4,
                  borderRadius: 6,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: textSecondary,
                }}
                title={isRTL ? 'تخطي' : 'Skip'}
              >
                <X size={16} />
              </button>
            </div>

            {/* Title */}
            <h3
              style={{
                fontSize: 16,
                fontWeight: 700,
                color: textPrimary,
                margin: '0 0 6px',
              }}
            >
              {isRTL ? current.title.ar : current.title.en}
            </h3>

            {/* Description */}
            <p
              style={{
                fontSize: 13,
                color: textSecondary,
                margin: '0 0 18px',
                lineHeight: 1.65,
              }}
            >
              {isRTL ? current.desc.ar : current.desc.en}
            </p>

            {/* Navigation */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <button
                onClick={handleComplete}
                style={{
                  border: 'none',
                  background: 'none',
                  cursor: 'pointer',
                  fontSize: 12,
                  color: textSecondary,
                  padding: '6px 0',
                  fontFamily: 'inherit',
                }}
              >
                {isRTL ? 'تخطي' : 'Skip'}
              </button>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {step > 0 && (
                  <button
                    onClick={goPrev}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                      border: `1px solid ${cardBorder}`,
                      background: 'none',
                      cursor: 'pointer',
                      fontSize: 12,
                      fontWeight: 500,
                      color: textSecondary,
                      padding: '7px 14px',
                      borderRadius: 8,
                      fontFamily: 'inherit',
                    }}
                  >
                    {!isRTL && <ChevronLeft size={14} />}
                    {isRTL ? 'السابق' : 'Previous'}
                    {isRTL && <ChevronRight size={14} />}
                  </button>
                )}
                <button
                  onClick={goNext}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: 12,
                    fontWeight: 600,
                    color: '#ffffff',
                    backgroundColor: accent,
                    padding: '7px 18px',
                    borderRadius: 8,
                    fontFamily: 'inherit',
                  }}
                >
                  {isRTL ? 'التالي' : 'Next'}
                  {!isRTL && <ChevronRight size={14} />}
                  {isRTL && <ChevronLeft size={14} />}
                </button>
              </div>
            </div>

            {/* Progress dots */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 4,
                marginTop: 16,
              }}
            >
              {STEPS.map((_, i) => (
                <div
                  key={i}
                  style={{
                    width: i === step ? 16 : 5,
                    height: 5,
                    borderRadius: 3,
                    backgroundColor: i === step ? accent : (isDark ? 'rgba(148,163,184,0.2)' : 'rgba(0,0,0,0.1)'),
                    transition: 'width 0.3s, background-color 0.3s',
                  }}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
