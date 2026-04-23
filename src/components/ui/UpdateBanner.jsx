import { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import { RefreshCw } from 'lucide-react';

/**
 * Fixed-bottom banner shown when a newer build is detected on the server.
 * One click reloads. Stays put otherwise — we never force a reload on the
 * user (they might be mid-edit).
 */
export default function UpdateBanner({ onUpdate }) {
  const { i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const [countdown, setCountdown] = useState(null);

  // If the user ignores the banner for a long time and then goes idle, we
  // auto-reload after 10 minutes of no interaction. This keeps the tab
  // current without interrupting anyone who's actively working.
  useEffect(() => {
    let idleTimer = null;
    const scheduleAutoReload = () => {
      if (idleTimer) clearTimeout(idleTimer);
      idleTimer = setTimeout(() => {
        setCountdown(10);
        let remaining = 10;
        const tick = setInterval(() => {
          remaining -= 1;
          setCountdown(remaining);
          if (remaining <= 0) {
            clearInterval(tick);
            onUpdate();
          }
        }, 1000);
      }, 10 * 60 * 1000);
    };

    const bumpIdle = () => {
      if (countdown !== null) return; // user is already counting down — don't reset
      scheduleAutoReload();
    };

    scheduleAutoReload();
    const events = ['mousedown', 'keydown', 'touchstart', 'scroll'];
    events.forEach(e => window.addEventListener(e, bumpIdle, { passive: true }));
    return () => {
      if (idleTimer) clearTimeout(idleTimer);
      events.forEach(e => window.removeEventListener(e, bumpIdle));
    };
  }, [countdown, onUpdate]);

  return (
    <div
      dir={isRTL ? 'rtl' : 'ltr'}
      role="status"
      aria-live="polite"
      style={{
        position: 'fixed',
        bottom: 16,
        insetInlineStart: 16,
        zIndex: 9998,
        background: '#4A7AAB',
        color: '#fff',
        padding: '10px 14px',
        borderRadius: 12,
        boxShadow: '0 10px 30px rgba(27,51,71,0.25)',
        fontSize: 13,
        fontWeight: 600,
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        maxWidth: 380,
      }}
    >
      <RefreshCw size={16} />
      <span style={{ flex: 1 }}>
        {countdown !== null
          ? (isRTL ? `تحديث تلقائي خلال ${countdown}...` : `Auto-updating in ${countdown}s…`)
          : (isRTL ? 'نسخة أحدث متاحة' : 'A newer version is available')}
      </span>
      <button
        onClick={onUpdate}
        style={{
          background: '#fff',
          color: '#4A7AAB',
          border: 'none',
          borderRadius: 8,
          padding: '6px 12px',
          fontSize: 12,
          fontWeight: 700,
          cursor: 'pointer',
        }}
      >
        {isRTL ? 'حدّث الآن' : 'Update now'}
      </button>
    </div>
  );
}

UpdateBanner.propTypes = {
  onUpdate: PropTypes.func.isRequired,
};
