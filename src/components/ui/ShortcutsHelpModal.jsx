import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../contexts/ThemeContext';
import { X, Keyboard } from 'lucide-react';

const SHORTCUT_GROUPS = [
  {
    title: { en: 'Navigation', ar: 'التنقل' },
    shortcuts: [
      { keys: ['g', 'h'], desc: { en: 'Go to Dashboard', ar: 'الذهاب للوحة التحكم' } },
      { keys: ['g', 'c'], desc: { en: 'Go to Contacts', ar: 'الذهاب لجهات الاتصال' } },
      { keys: ['g', 'o'], desc: { en: 'Go to Opportunities', ar: 'الذهاب للفرص' } },
      { keys: ['g', 'd'], desc: { en: 'Go to Deals', ar: 'الذهاب للصفقات' } },
      { keys: ['g', 't'], desc: { en: 'Go to Tasks', ar: 'الذهاب للمهام' } },
      { keys: ['g', 'r'], desc: { en: 'Go to Reports', ar: 'الذهاب للتقارير' } },
      { keys: ['g', 's'], desc: { en: 'Go to Settings', ar: 'الذهاب للإعدادات' } },
      { keys: ['g', 'm'], desc: { en: 'Go to Chat', ar: 'الذهاب للمحادثات' } },
    ],
  },
  {
    title: { en: 'Actions', ar: 'الإجراءات' },
    shortcuts: [
      { keys: ['\u2318/Ctrl', 'K'], desc: { en: 'Open Global Search', ar: 'فتح البحث العام' } },
    ],
  },
  {
    title: { en: 'General', ar: 'عام' },
    shortcuts: [
      { keys: ['?'], desc: { en: 'Show Keyboard Shortcuts', ar: 'عرض اختصارات لوحة المفاتيح' } },
      { keys: ['Esc'], desc: { en: 'Close Modal / Drawer', ar: 'إغلاق النافذة / الدرج' } },
    ],
  },
];

export default function ShortcutsHelpModal({ onClose }) {
  const { i18n } = useTranslation();
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const isRTL = i18n.language === 'ar';
  const overlayRef = useRef(null);

  // Close on Escape
  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener('keydown', handler, true);
    return () => document.removeEventListener('keydown', handler, true);
  }, [onClose]);

  const handleOverlayClick = (e) => {
    if (e.target === overlayRef.current) onClose();
  };

  return (
    <div
      ref={overlayRef}
      onClick={handleOverlayClick}
      dir={isRTL ? 'rtl' : 'ltr'}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0,0,0,0.5)',
        backdropFilter: 'blur(4px)',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 520,
          maxHeight: '80vh',
          margin: '0 16px',
          borderRadius: 16,
          backgroundColor: isDark ? '#1a2332' : '#ffffff',
          border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
          boxShadow: isDark
            ? '0 24px 48px rgba(0,0,0,0.4)'
            : '0 24px 48px rgba(0,0,0,0.12)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px 20px',
            borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Keyboard size={20} style={{ color: '#4A7AAB' }} />
            <span
              style={{
                fontSize: 16,
                fontWeight: 700,
                color: isDark ? '#e2e8f0' : '#1e293b',
              }}
            >
              {isRTL ? 'اختصارات لوحة المفاتيح' : 'Keyboard Shortcuts'}
            </span>
          </div>
          <button
            onClick={onClose}
            style={{
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              padding: 6,
              borderRadius: 8,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: isDark ? '#94a3b8' : '#64748b',
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div style={{ overflowY: 'auto', padding: '12px 20px 20px' }}>
          {SHORTCUT_GROUPS.map((group, gi) => (
            <div key={gi} style={{ marginBottom: gi < SHORTCUT_GROUPS.length - 1 ? 20 : 0 }}>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: 0.8,
                  color: isDark ? '#94a3b8' : '#64748b',
                  marginBottom: 8,
                  paddingBottom: 6,
                  borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)'}`,
                }}
              >
                {isRTL ? group.title.ar : group.title.en}
              </div>
              {group.shortcuts.map((sc, si) => (
                <div
                  key={si}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '7px 0',
                  }}
                >
                  <span
                    style={{
                      fontSize: 13,
                      color: isDark ? '#cbd5e1' : '#334155',
                    }}
                  >
                    {isRTL ? sc.desc.ar : sc.desc.en}
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    {sc.keys.map((k, ki) => (
                      <span key={ki} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        {ki > 0 && (
                          <span
                            style={{
                              fontSize: 10,
                              color: isDark ? '#64748b' : '#94a3b8',
                              fontWeight: 500,
                            }}
                          >
                            {isRTL ? 'ثم' : 'then'}
                          </span>
                        )}
                        <kbd
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            minWidth: 24,
                            height: 24,
                            padding: '0 6px',
                            borderRadius: 6,
                            fontSize: 11,
                            fontWeight: 600,
                            fontFamily: 'inherit',
                            backgroundColor: isDark ? 'rgba(74,122,171,0.12)' : 'rgba(74,122,171,0.08)',
                            border: `1px solid ${isDark ? 'rgba(74,122,171,0.2)' : 'rgba(74,122,171,0.15)'}`,
                            color: isDark ? '#7db4d8' : '#4A7AAB',
                          }}
                        >
                          {k}
                        </kbd>
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>

        {/* Footer hint */}
        <div
          style={{
            padding: '10px 20px',
            borderTop: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
            textAlign: 'center',
            fontSize: 11,
            color: isDark ? '#64748b' : '#94a3b8',
          }}
        >
          {isRTL ? 'اضغط' : 'Press'}{' '}
          <kbd
            style={{
              padding: '1px 5px',
              borderRadius: 4,
              fontSize: 10,
              fontFamily: 'inherit',
              backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
              border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'}`,
              color: isDark ? '#94a3b8' : '#64748b',
            }}
          >
            Esc
          </kbd>{' '}
          {isRTL ? 'للإغلاق' : 'to close'}
        </div>
      </div>
    </div>
  );
}
