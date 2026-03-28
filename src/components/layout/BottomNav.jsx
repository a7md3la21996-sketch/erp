import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { LayoutDashboard, BookUser, Target, ClipboardList, MoreHorizontal } from 'lucide-react';

const NAV_ITEMS = [
  { id: 'dashboard', path: '/dashboard', icon: LayoutDashboard, label_ar: 'الرئيسية', label_en: 'Home' },
  { id: 'contacts', path: '/contacts', icon: BookUser, label_ar: 'الليدز', label_en: 'Leads' },
  { id: 'opportunities', path: '/crm/opportunities', icon: Target, label_ar: 'الفرص', label_en: 'Opps' },
  { id: 'tasks', path: '/tasks', icon: ClipboardList, label_ar: 'المهام', label_en: 'Tasks' },
];

export default function BottomNav({ onMoreClick }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { i18n } = useTranslation();
  const lang = i18n.language === 'ar' ? 'ar' : 'en';

  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 md:hidden bg-surface-card dark:bg-surface-card-dark border-t border-edge dark:border-edge-dark">
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
