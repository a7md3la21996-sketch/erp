import { useState, useRef, useEffect } from 'react';
import { X, Printer, Download, Globe } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';
import { useTranslation } from 'react-i18next';

export default function PrintPreview({ html, title, onClose }) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const { i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const iframeRef = useRef(null);
  const [previewLang, setPreviewLang] = useState(i18n.language);

  // Write HTML to iframe
  useEffect(() => {
    if (iframeRef.current && html) {
      const doc = iframeRef.current.contentDocument || iframeRef.current.contentWindow.document;
      doc.open();
      doc.write(html);
      doc.close();
    }
  }, [html]);

  const handlePrint = () => {
    if (iframeRef.current) {
      iframeRef.current.contentWindow.focus();
      iframeRef.current.contentWindow.print();
    }
  };

  // ESC to close
  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape') {
        e.stopImmediatePropagation();
        onClose();
      }
    };
    document.addEventListener('keydown', handler, true);
    return () => document.removeEventListener('keydown', handler, true);
  }, [onClose]);

  return (
    <div
      dir={isRTL ? 'rtl' : 'ltr'}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1100,
        display: 'flex',
        flexDirection: 'column',
        background: isDark ? '#0a1929' : '#f1f5f9',
      }}
    >
      {/* Toolbar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 20px',
          background: isDark ? '#1a2332' : '#ffffff',
          borderBottom: `1px solid ${isDark ? '#2a3a4a' : '#e2e8f0'}`,
          gap: 12,
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Printer size={18} style={{ color: '#4A7AAB' }} />
          <span style={{ fontSize: 14, fontWeight: 700, color: isDark ? '#e2e8f0' : '#1e293b' }}>
            {title || (isRTL ? 'معاينة الطباعة' : 'Print Preview')}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* Language Toggle */}
          <button
            onClick={() => setPreviewLang(p => p === 'ar' ? 'en' : 'ar')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 14px',
              borderRadius: 8,
              border: `1px solid ${isDark ? '#2a3a4a' : '#e2e8f0'}`,
              background: isDark ? '#132337' : '#f8fafc',
              color: isDark ? '#e2e8f0' : '#1e293b',
              cursor: 'pointer',
              fontSize: 12,
              fontWeight: 600,
              fontFamily: 'inherit',
            }}
          >
            <Globe size={14} />
            {previewLang === 'ar' ? 'EN' : 'AR'}
          </button>
          {/* Print Button */}
          <button
            onClick={handlePrint}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 16px',
              borderRadius: 8,
              border: 'none',
              background: '#4A7AAB',
              color: 'white',
              cursor: 'pointer',
              fontSize: 12,
              fontWeight: 600,
              fontFamily: 'inherit',
            }}
          >
            <Printer size={14} />
            {isRTL ? 'طباعة' : 'Print'}
          </button>
          {/* Download / Print as PDF */}
          <button
            onClick={handlePrint}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 14px',
              borderRadius: 8,
              border: `1px solid ${isDark ? '#2a3a4a' : '#e2e8f0'}`,
              background: isDark ? '#132337' : '#f8fafc',
              color: isDark ? '#e2e8f0' : '#1e293b',
              cursor: 'pointer',
              fontSize: 12,
              fontWeight: 600,
              fontFamily: 'inherit',
            }}
          >
            <Download size={14} />
            PDF
          </button>
          {/* Close */}
          <button
            onClick={onClose}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 34,
              height: 34,
              borderRadius: 8,
              border: `1px solid ${isDark ? '#2a3a4a' : '#e2e8f0'}`,
              background: isDark ? '#132337' : '#f8fafc',
              color: isDark ? '#94a3b8' : '#64748b',
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Paper Preview Area */}
      <div
        style={{
          flex: 1,
          overflow: 'auto',
          display: 'flex',
          justifyContent: 'center',
          padding: '30px 20px',
        }}
      >
        <div
          style={{
            width: '210mm',
            minHeight: '297mm',
            background: '#ffffff',
            boxShadow: '0 4px 40px rgba(0,0,0,0.15)',
            borderRadius: 4,
            overflow: 'hidden',
            flexShrink: 0,
          }}
        >
          <iframe
            ref={iframeRef}
            title="Print Preview"
            style={{
              width: '100%',
              height: '100%',
              minHeight: '297mm',
              border: 'none',
            }}
          />
        </div>
      </div>
    </div>
  );
}
