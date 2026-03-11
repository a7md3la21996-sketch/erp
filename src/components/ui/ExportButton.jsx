import { useState, useRef, useEffect } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import { useTranslation } from 'react-i18next';
import { Download, FileSpreadsheet, FileText, Printer, ChevronDown } from 'lucide-react';
import { exportToExcel, exportToCSV, printTable } from '../../utils/exportUtils';

export default function ExportButton({ data, filename = 'export', title = '', columns }) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
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

  const border = isDark ? 'rgba(74,122,171,0.2)' : '#e5e7eb';
  const items = [
    { icon: FileSpreadsheet, label: isRTL ? 'تصدير Excel' : 'Export Excel', action: () => exportToExcel(data, filename) },
    { icon: FileText, label: isRTL ? 'تصدير CSV' : 'Export CSV', action: () => exportToCSV(data, filename) },
    { icon: Printer, label: isRTL ? 'طباعة' : 'Print', action: () => printTable(data, title, columns) },
  ];

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button onClick={() => setOpen(!open)} style={{
        display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px',
        borderRadius: 8, border: `1px solid ${border}`,
        background: isDark ? '#1a2234' : '#ffffff', color: isDark ? '#8BA8C8' : '#6b7280',
        fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
      }}>
        <Download size={14} />
        {isRTL ? 'تصدير' : 'Export'}
        <ChevronDown size={12} />
      </button>
      {open && (
        <div style={{
          position: 'absolute', top: '100%', marginTop: 4,
          [isRTL ? 'right' : 'left']: 0, minWidth: 170,
          borderRadius: 10, background: isDark ? '#1a2234' : '#ffffff',
          border: `1px solid ${border}`,
          boxShadow: isDark ? '0 8px 24px rgba(0,0,0,0.4)' : '0 8px 24px rgba(0,0,0,0.1)',
          zIndex: 50, overflow: 'hidden',
        }}>
          {items.map((item, i) => {
            const Icon = item.icon;
            return (
              <button key={i} onClick={() => { item.action(); setOpen(false); }} style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 8,
                padding: '9px 14px', border: 'none', cursor: 'pointer',
                background: 'transparent', color: isDark ? '#E2EAF4' : '#1f2937',
                fontSize: 13, fontFamily: 'inherit', textAlign: isRTL ? 'right' : 'left',
              }}
                onMouseEnter={e => e.currentTarget.style.background = isDark ? 'rgba(74,122,171,0.1)' : '#f3f4f6'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <Icon size={14} color={isDark ? '#6B8DB5' : '#9ca3af'} />
                {item.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
