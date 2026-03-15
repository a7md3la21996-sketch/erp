import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../contexts/ThemeContext';
import { WifiOff, Wifi } from 'lucide-react';

export default function ConnectionStatus() {
  const { i18n } = useTranslation();
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const isRTL = i18n.language === 'ar';

  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [showRestored, setShowRestored] = useState(false);
  const [wasOffline, setWasOffline] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      if (wasOffline) {
        setShowRestored(true);
        setTimeout(() => setShowRestored(false), 3000);
      }
    };
    const handleOffline = () => {
      setIsOnline(false);
      setWasOffline(true);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [wasOffline]);

  // Nothing to show when online and no restoration banner
  if (isOnline && !showRestored) return null;

  const bannerStyle = {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10000,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: '6px 16px',
    fontSize: 13,
    fontWeight: 600,
    fontFamily: 'inherit',
    direction: isRTL ? 'rtl' : 'ltr',
    transition: 'all 0.3s ease',
  };

  if (!isOnline) {
    return (
      <div style={{
        ...bannerStyle,
        background: isDark ? '#78350f' : '#fbbf24',
        color: isDark ? '#fef3c7' : '#78350f',
      }}>
        <WifiOff size={14} />
        <span>
          {isRTL
            ? 'أنت شغال offline — البيانات بتتحفظ محلياً'
            : "You're offline — data is saved locally"}
        </span>
      </div>
    );
  }

  if (showRestored) {
    return (
      <div style={{
        ...bannerStyle,
        background: isDark ? '#064e3b' : '#34d399',
        color: isDark ? '#d1fae5' : '#064e3b',
      }}>
        <Wifi size={14} />
        <span>
          {isRTL ? 'الاتصال رجع' : 'Connection restored'}
        </span>
      </div>
    );
  }

  return null;
}
