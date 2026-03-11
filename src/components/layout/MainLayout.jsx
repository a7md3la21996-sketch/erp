import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Sidebar from './Sidebar';
import Header from './Header';

export default function MainLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const { i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';

  return (
    <div className="min-h-screen bg-surface-bg dark:bg-surface-bg-dark" dir={isRTL ? 'rtl' : 'ltr'}>
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)} />
      <div className="transition-[margin] duration-300" style={{ [isRTL ? 'marginRight' : 'marginLeft']: collapsed ? 72 : 260 }}>
        <Header />
        <main>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
