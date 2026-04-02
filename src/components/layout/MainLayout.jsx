import { useState, useEffect, useCallback } from 'react';
import { Outlet } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Sidebar from './Sidebar';
import Header from './Header';
import GlobalFilterBar from './GlobalFilterBar';
import ProductTour from '../ui/ProductTour';
import BottomNav from './BottomNav';
import { onError } from '../../utils/errorReporter';

function useIsMobile(breakpoint = 768) {
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < breakpoint);
  useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${breakpoint - 1}px)`);
    const handler = (e) => setIsMobile(e.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, [breakpoint]);
  return isMobile;
}

export default function MainLayout() {
  const [collapsed, setCollapsed] = useState(() => {
    const saved = localStorage.getItem('sidebar-collapsed');
    return saved === 'true';
  });

  const toggleCollapsed = () => {
    setCollapsed(prev => {
      localStorage.setItem('sidebar-collapsed', String(!prev));
      return !prev;
    });
  };
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const isMobile = useIsMobile();

  // Close mobile sidebar on resize to desktop
  useEffect(() => {
    if (!isMobile) setSidebarOpen(false);
  }, [isMobile]);

  // Global error banner for service failures
  const [serviceError, setServiceError] = useState(null);
  useEffect(() => {
    return onError((entry) => {
      setServiceError(entry);
      setTimeout(() => setServiceError(null), 6000);
    });
  }, []);

  return (
    <div className="min-h-screen bg-surface-bg dark:bg-surface-bg-dark" dir={isRTL ? 'rtl' : 'ltr'}>
      <Sidebar
        collapsed={collapsed}
        onToggle={toggleCollapsed}
        mobileOpen={sidebarOpen}
        onMobileClose={() => setSidebarOpen(false)}
      />
      <div
        className="transition-[margin] duration-300 overflow-x-hidden"
        style={{ marginInlineStart: isMobile ? 0 : (collapsed ? 72 : 260) }}
      >
        <Header onMenuClick={() => setSidebarOpen(true)} />
        <GlobalFilterBar />
        <main className="pb-[64px] md:pb-0">
          <Outlet />
        </main>
      </div>
      <BottomNav onMoreClick={() => setSidebarOpen(true)} />
      {/* <ProductTour /> — disabled until launch */}
      {serviceError && (
        <div className="fixed bottom-4 start-4 z-[400] bg-amber-500/95 text-white px-4 py-3 rounded-xl shadow-lg text-xs font-medium max-w-[360px] animate-[slideUp_0.3s_ease-out]">
          ⚠️ {isRTL ? 'تعذر الاتصال بالسيرفر — البيانات المعروضة قد تكون قديمة' : 'Server connection failed — displayed data may be stale'}
          <span className="block mt-1 opacity-70">{serviceError.service}: {serviceError.operation}</span>
        </div>
      )}
    </div>
  );
}
