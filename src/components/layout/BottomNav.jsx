import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { LayoutGrid, BookUser, Target, ClipboardList, MoreHorizontal } from 'lucide-react';
import { NAV_ITEMS as NAV_CONFIG, findModuleId } from '../../config/navigation';
import { useAuth } from '../../contexts/AuthContext';

const REST_ITEMS = [
  { id: 'contacts', path: '/leads', icon: BookUser, label_ar: 'الليدز', label_en: 'Leads' },
  { id: 'deals', path: '/sales/deals', icon: Target, label_ar: 'الصفقات', label_en: 'Deals' },
  { id: 'tasks', path: '/tasks', icon: ClipboardList, label_ar: 'المهام', label_en: 'Tasks' },
];

export default function BottomNav({ onMoreClick }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { i18n } = useTranslation();
  const { profile } = useAuth();
  const lang = i18n.language === 'ar' ? 'ar' : 'en';

  // First tab is context-aware: inside a module it opens THAT module's home
  // (e.g. CRM dashboard) instead of the admin-only launcher. Falls back to the
  // workspaces launcher for admin, or the Leads home for everyone else.
  const modId = findModuleId(location.pathname);
  const modItem = modId ? NAV_CONFIG.find(i => i.id === modId && i.path) : null;
  const firstTab = modItem
    ? { id: modItem.id, path: modItem.path, icon: modItem.icon, label_ar: modItem.label.ar, label_en: modItem.label.en }
    : (profile?.role === 'admin'
        ? { id: 'home', path: '/home', icon: LayoutGrid, label_ar: 'المساحات', label_en: 'Workspaces' }
        : { id: 'home', path: '/leads', icon: LayoutGrid, label_ar: 'الرئيسية', label_en: 'Home' });
  const NAV_ITEMS = [firstTab, ...REST_ITEMS.filter(r => r.path !== firstTab.path)];

  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 md:hidden bg-surface-card dark:bg-surface-card-dark border-t border-edge dark:border-edge-dark" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
      <div className="flex items-stretch justify-around h-[60px]" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
        {NAV_ITEMS.map(item => {
          const Icon = item.icon;
          const active = location.pathname === item.path || location.pathname.startsWith(item.path + '/');
          return (
            <button
              key={item.id}
              onClick={() => navigate(item.path)}
              className={`flex-1 flex flex-col items-center justify-center gap-0.5 bg-transparent border-none cursor-pointer transition-colors ${
                active ? 'text-brand-500' : 'text-content-muted dark:text-content-muted-dark'
              }`}
            >
              <Icon size={20} strokeWidth={active ? 2.5 : 1.8} />
              <span className="text-[10px] font-semibold">{lang === 'ar' ? item.label_ar : item.label_en}</span>
            </button>
          );
        })}
        <button
          onClick={onMoreClick}
          className="flex-1 flex flex-col items-center justify-center gap-0.5 bg-transparent border-none cursor-pointer text-content-muted dark:text-content-muted-dark"
        >
          <MoreHorizontal size={20} strokeWidth={1.8} />
          <span className="text-[10px] font-semibold">{lang === 'ar' ? 'المزيد' : 'More'}</span>
        </button>
      </div>
    </nav>
  );
}
