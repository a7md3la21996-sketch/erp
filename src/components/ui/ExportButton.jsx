import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Download, FileSpreadsheet, FileText, Printer, ChevronDown } from 'lucide-react';
import { exportToExcel, exportToCSV, printTable } from '../../utils/exportUtils';

export default function ExportButton({ data, filename = 'export', title = '', columns }) {
  const { i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const items = [
    { icon: FileSpreadsheet, label: isRTL ? 'تصدير Excel' : 'Export Excel', action: () => exportToExcel(data, filename) },
    { icon: FileText, label: isRTL ? 'تصدير CSV' : 'Export CSV', action: () => exportToCSV(data, filename) },
    { icon: Printer, label: isRTL ? 'طباعة' : 'Print', action: () => printTable(data, title, columns) },
  ];

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 py-[7px] px-3.5 rounded-lg border border-edge dark:border-edge-dark bg-surface-card dark:bg-surface-card-dark text-content-muted dark:text-content-muted-dark text-[13px] cursor-pointer font-[inherit]"
      >
        <Download size={14} />
        {isRTL ? 'تصدير' : 'Export'}
        <ChevronDown size={12} />
      </button>
      {open && (
        <div className={`absolute top-full mt-1 ${isRTL ? 'right-0' : 'left-0'} min-w-[170px] rounded-[10px] bg-surface-card dark:bg-surface-card-dark border border-edge dark:border-edge-dark shadow-lg dark:shadow-[0_8px_24px_rgba(0,0,0,0.4)] z-50 overflow-hidden`}>
          {items.map((item, i) => {
            const Icon = item.icon;
            return (
              <button
                key={i}
                onClick={() => { item.action(); setOpen(false); }}
                className={`w-full flex items-center gap-2 py-2.5 px-3.5 border-none cursor-pointer bg-transparent text-content dark:text-content-dark text-[13px] font-[inherit] ${isRTL ? 'text-right' : 'text-left'} hover:bg-gray-100 dark:hover:bg-brand-500/10`}
              >
                <Icon size={14} className="text-brand-400 dark:text-brand-400" />
                {item.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
