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
    <div style={{ minHeight: '100vh', background: '#F0F4F8', direction: isRTL ? 'rtl' : 'ltr' }}>
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)} />
      <div style={{
        transition: 'margin 0.3s',
        [isRTL ? 'marginRight' : 'marginLeft']: collapsed ? 72 : 260,
      }}>
        <Header />
        <main>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
