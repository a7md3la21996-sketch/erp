import { useState, useEffect, useCallback } from 'react';
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
      ar: 'دعنا نأخذك في جولة سريعة للتعرف على أهم ميزات النظام.',
      en: 'Let us take you on a quick tour of the key features.',
    },
  },
  {
    id: 'sidebar',
    type: 'highlight',
    selector: '[data-tour="sidebar"]',
    fallbackSelector: 'aside',
    position: 'right',
    icon: Layout,
    title: { ar: 'القائمة الجانبية', en: 'Sidebar Navigation' },
    desc: {
      ar: 'تنقل بسهولة بين أقسام النظام: CRM، الموارد البشرية، المالية، والمزيد.',
      en: 'Navigate between modules: CRM, HR, Finance, Sales, and more.',
    },
  },
  {
    id: 'dashboard',
    type: 'highlight',
    selector: 'main',
    position: 'top',
    icon: BarChart3,
    title: { ar: 'لوحة التحكم', en: 'Dashboard' },
    desc: {
      ar: 'عرض مؤشرات الأداء والرسوم البيانية وتخصيص الويدجت.',
      en: 'View KPI cards, charts, and customize widgets.',
    },
  },
  {
    id: 'search',
    type: 'highlight',
    selector: '[data-tour="search"]',
    fallbackSelector: 'header button',
    position: 'bottom',
    icon: Search,
    title: { ar: 'البحث السريع', en: 'Global Search' },
    desc: {
      ar: 'اضغط ⌘K (أو Ctrl+K) للبحث السريع في كل شيء.',
      en: 'Press ⌘K (or Ctrl+K) to quickly search everything.',
    },
  },
  {
    id: 'notifications',
    type: 'highlight',
    selector: '[data-tour="notifications"]',
    position: 'bottom',
    icon: Bell,
    title: { ar: 'الإشعارات', en: 'Notifications' },
    desc: {
      ar: 'تابع التحديثات المهمة والتنبيهات.',
      en: 'Stay updated with real-time alerts.',
    },
  },
  {
    id: 'favorites',
    type: 'highlight',
    selector: '[data-tour="favorites"]',
    position: 'bottom',
    icon: Star,
    title: { ar: 'المفضلة', en: 'Favorites' },
    desc: {
      ar: 'أضف العناصر المهمة إلى المفضلة للوصول السريع.',
      en: 'Bookmark important items for quick access.',
    },
  },
  {
    id: 'theme',
    type: 'highlight',
    selector: '[data-tour="theme"]',
    position: 'bottom',
    icon: Moon,
    title: { ar: 'المظهر', en: 'Theme' },
    desc: {
      ar: 'بدّل بين الوضع الفاتح والداكن.',
      en: 'Switch between light and dark mode.',
    },
  },
  {
    id: 'shortcuts',
    type: 'highlight',
    selector: '[data-tour="shortcuts"]',
    position: 'bottom',
    icon: Keyboard,
    title: { ar: 'اختصارات لوحة المفاتيح', en: 'Keyboard Shortcuts' },
    desc: {
      ar: 'اضغط ? لعرض جميع الاختصارات المتاحة.',
      en: 'Press ? to see all available shortcuts.',
    },
  },
  {
    id: 'done',
    type: 'center',
    icon: PartyPopper,
    title: { ar: 'أنت جاهز!', en: "You're all set!" },
    desc: {
      ar: 'أنت الآن مستعد لاستخدام النظام. يمكنك إعادة الجولة من اختصارات لوحة المفاتيح.',
      en: "You're ready! Restart this tour anytime from keyboard shortcuts.",
    },
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
  const [targetRect, setTargetRect] = useState(null);

  // Determine visibility
  useEffect(() => {
    if (forceShow) {
      setVisible(true);
      setStep(0);
      setCurrentStep(0);
      return;
    }
    if (!isOnboardingComplete() && location.pathname === '/dashboard') {
      setStep(getCurrentStep());
      setVisible(true);
    }
  }, [forceShow, location.pathname]);

  // Listen for restart event
  useEffect(() => {
    const handler = () => { setStep(0); setCurrentStep(0); setVisible(true); };
    window.addEventListener('platform_restart_tour', handler);
    return () => window.removeEventListener('platform_restart_tour', handler);
  }, []);

  // Measure target element
  useEffect(() => {
    if (!visible) return;
    const current = STEPS[step];
    if (!current || current.type !== 'highlight') {
      setTargetRect(null);
      return;
    }

    const measure = () => {
      let el = document.querySelector(current.selector);
      if (!el && current.fallbackSelector) el = document.querySelector(current.fallbackSelector);
      if (el) {
        const r = el.getBoundingClientRect();
        if (r.width > 0 && r.height > 0) {
          // For very large elements (like main/aside), limit highlight to top portion
          const maxH = Math.min(r.height, 200);
          const maxW = Math.min(r.width, 400);
          setTargetRect({
            top: r.top,
            left: r.left,
            width: r.width > 400 ? maxW : r.width,
            height: r.height > 200 ? maxH : r.height,
          });
          return;
        }
      }
      setTargetRect(null);
    };

    const timer = setTimeout(measure, 150);
    window.addEventListener('resize', measure);
    return () => { clearTimeout(timer); window.removeEventListener('resize', measure); };
  }, [visible, step]);

  // ESC to close
  useEffect(() => {
    if (!visible) return;
    const handler = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); finish(); }
    };
    document.addEventListener('keydown', handler, true);
    return () => document.removeEventListener('keydown', handler, true);
  }, [visible]);

  const finish = useCallback(() => {
    completeOnboarding();
    setVisible(false);
    setStep(0);
    if (onClose) onClose();
  }, [onClose]);

  const goNext = () => {
    if (step >= STEPS.length - 1) { finish(); return; }
    const next = step + 1;
    setStep(next);
    setCurrentStep(next);
  };

  const goPrev = () => {
    if (step <= 0) return;
    const prev = step - 1;
    setStep(prev);
    setCurrentStep(prev);
  };

  if (!visible) return null;

  const current = STEPS[step];
  const showAsCenter = current.type === 'center' || !targetRect;
  const Icon = current.icon;
  const isFirst = step === 0;
  const isLast = step === STEPS.length - 1;

  // Colors
  const cardBg = isDark ? '#1a2332' : '#ffffff';
  const border = isDark ? 'rgba(74,122,171,0.25)' : 'rgba(74,122,171,0.15)';
  const text1 = isDark ? '#e2e8f0' : '#1e293b';
  const text2 = isDark ? '#94a3b8' : '#64748b';
  const accent = '#4A7AAB';

  // Calculate tooltip position clamped to viewport
  const getTooltipPos = () => {
    if (!targetRect) return null;
    const tw = 340;
    const th = 220;
    const gap = 14;
    const pos = current.position || 'bottom';
    let top, left;

    if (pos === 'right') {
      top = targetRect.top + targetRect.height / 2 - th / 2;
      left = targetRect.left + targetRect.width + gap;
      if (left + tw > window.innerWidth - 16) {
        // fallback bottom
        top = targetRect.top + targetRect.height + gap;
        left = targetRect.left;
      }
    } else if (pos === 'top') {
      top = targetRect.top - th - gap;
      left = targetRect.left + targetRect.width / 2 - tw / 2;
      if (top < 16) {
        top = targetRect.top + targetRect.height + gap;
      }
    } else {
      // bottom (default)
      top = targetRect.top + targetRect.height + gap;
      left = targetRect.left + targetRect.width / 2 - tw / 2;
    }

    // Clamp to viewport
    top = Math.max(16, Math.min(top, window.innerHeight - th - 16));
    left = Math.max(16, Math.min(left, window.innerWidth - tw - 16));

    return { top, left, width: tw };
  };

  const tooltipPos = showAsCenter ? null : getTooltipPos();

  // ── Navigation buttons (shared between center and tooltip) ──
  const NavButtons = ({ centered }) => (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: centered ? 'center' : 'space-between',
      gap: 10,
      marginTop: centered ? 28 : 16,
    }}>
      {!centered && (
        <button onClick={finish} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 12, color: text2, padding: '6px 0', fontFamily: 'inherit' }}>
          {isRTL ? 'تخطي' : 'Skip'}
        </button>
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {isFirst && (
          <button onClick={finish} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 13, color: text2, padding: '8px 16px', fontFamily: 'inherit' }}>
            {isRTL ? 'تخطي' : 'Skip'}
          </button>
        )}
        {step > 0 && !isFirst && (
          <button onClick={goPrev} style={{
            display: 'flex', alignItems: 'center', gap: 4,
            border: `1px solid ${border}`, background: 'none', cursor: 'pointer',
            fontSize: 12, fontWeight: 500, color: text2, padding: '7px 14px', borderRadius: 8, fontFamily: 'inherit',
          }}>
            {!isRTL && <ChevronLeft size={14} />}
            {isRTL ? 'السابق' : 'Prev'}
            {isRTL && <ChevronRight size={14} />}
          </button>
        )}
        <button onClick={isLast ? finish : goNext} style={{
          display: 'flex', alignItems: 'center', gap: 4,
          border: 'none', cursor: 'pointer', fontSize: centered ? 14 : 12, fontWeight: 600,
          color: '#fff', backgroundColor: accent, padding: centered ? '12px 32px' : '7px 18px',
          borderRadius: centered ? 12 : 8, fontFamily: 'inherit',
          boxShadow: centered ? '0 4px 12px rgba(74,122,171,0.3)' : 'none',
        }}>
          {isFirst ? (isRTL ? 'ابدأ الجولة' : 'Start Tour')
            : isLast ? (isRTL ? 'ابدأ العمل' : 'Get Started')
            : (isRTL ? 'التالي' : 'Next')}
          {!isFirst && !isLast && !isRTL && <ChevronRight size={14} />}
          {!isFirst && !isLast && isRTL && <ChevronLeft size={14} />}
        </button>
      </div>
    </div>
  );

  // ── Step dots ──
  const StepDots = () => (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, marginTop: 16 }}>
      {STEPS.map((_, i) => (
        <div key={i} style={{
          width: i === step ? 18 : 6, height: 6, borderRadius: 3,
          backgroundColor: i === step ? accent : (isDark ? 'rgba(148,163,184,0.2)' : 'rgba(0,0,0,0.1)'),
          transition: 'all 0.3s',
        }} />
      ))}
    </div>
  );

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} style={{ position: 'fixed', inset: 0, zIndex: 9999 }}>
      {/* Backdrop */}
      <div
        style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.55)', zIndex: 1 }}
        onClick={(e) => e.stopPropagation()}
      />

      {/* Spotlight cutout for highlight steps */}
      {!showAsCenter && targetRect && (
        <>
          {/* Clear area over target */}
          <div style={{
            position: 'fixed',
            top: targetRect.top - 8,
            left: targetRect.left - 8,
            width: targetRect.width + 16,
            height: targetRect.height + 16,
            borderRadius: 12,
            backgroundColor: isDark ? '#0f1e2d' : '#f8fafc',
            zIndex: 2,
          }} />
          {/* Border ring */}
          <div style={{
            position: 'fixed',
            top: targetRect.top - 8,
            left: targetRect.left - 8,
            width: targetRect.width + 16,
            height: targetRect.height + 16,
            borderRadius: 12,
            border: `2px solid ${accent}`,
            zIndex: 3,
            pointerEvents: 'none',
            boxShadow: `0 0 0 4px rgba(74,122,171,0.15)`,
          }} />
        </>
      )}

      {/* Center card */}
      {showAsCenter && (
        <div style={{
          position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: 16, zIndex: 10,
        }}>
          <div style={{
            position: 'relative', width: '100%', maxWidth: 420, borderRadius: 20,
            backgroundColor: cardBg, border: `1px solid ${border}`,
            boxShadow: isDark ? '0 32px 64px rgba(0,0,0,0.5)' : '0 32px 64px rgba(0,0,0,0.15)',
            padding: '40px 32px 32px', textAlign: 'center',
          }}>
            {/* Icon */}
            <div style={{
              width: 64, height: 64, borderRadius: '50%',
              background: isDark ? 'rgba(74,122,171,0.15)' : 'rgba(74,122,171,0.1)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 16px',
            }}>
              <Icon size={32} style={{ color: accent }} />
            </div>

            <h2 style={{ fontSize: 22, fontWeight: 700, color: text1, margin: '0 0 10px', lineHeight: 1.3 }}>
              {isRTL ? current.title.ar : current.title.en}
            </h2>
            <p style={{ fontSize: 14, color: text2, margin: 0, lineHeight: 1.7 }}>
              {isRTL ? current.desc.ar : current.desc.en}
            </p>

            <NavButtons centered />
            <StepDots />
          </div>
        </div>
      )}

      {/* Tooltip card for highlight steps */}
      {!showAsCenter && tooltipPos && (
        <div style={{
          position: 'fixed',
          top: tooltipPos.top,
          left: tooltipPos.left,
          width: tooltipPos.width,
          borderRadius: 14,
          backgroundColor: cardBg,
          border: `1px solid ${border}`,
          boxShadow: isDark ? '0 16px 40px rgba(0,0,0,0.4)' : '0 16px 40px rgba(0,0,0,0.12)',
          padding: '16px 20px',
          zIndex: 10,
        }}>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{
                width: 30, height: 30, borderRadius: '50%',
                background: isDark ? 'rgba(74,122,171,0.15)' : 'rgba(74,122,171,0.1)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Icon size={14} style={{ color: accent }} />
              </div>
              <span style={{ fontSize: 11, fontWeight: 600, color: accent }}>
                {step + 1} / {STEPS.length}
              </span>
            </div>
            <button onClick={finish} style={{
              border: 'none', background: 'none', cursor: 'pointer', padding: 4,
              borderRadius: 6, display: 'flex', color: text2,
            }}>
              <X size={16} />
            </button>
          </div>

          <h3 style={{ fontSize: 15, fontWeight: 700, color: text1, margin: '0 0 4px' }}>
            {isRTL ? current.title.ar : current.title.en}
          </h3>
          <p style={{ fontSize: 13, color: text2, margin: 0, lineHeight: 1.6 }}>
            {isRTL ? current.desc.ar : current.desc.en}
          </p>

          <NavButtons centered={false} />
          <StepDots />
        </div>
      )}
    </div>
  );
}
