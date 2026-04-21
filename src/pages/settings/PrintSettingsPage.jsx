import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../contexts/ThemeContext';
import { Printer, Save, Eye, FileText, Users, BarChart3 } from 'lucide-react';
import {
  getCompanyInfo, saveCompanyInfo,
  generateInvoiceHTML, generateQuotationHTML,
  generateContactCardHTML, generateReportHTML,
} from '../../services/printService';
import PrintPreview from '../../components/ui/PrintPreview';

// ── Sample data for previews ──
const SAMPLE_INVOICE = {
  invoice_number: 'INV-2026-001',
  date: '2026-03-15',
  client_ar: 'أحمد محمد',
  client_en: 'Ahmed Mohamed',
  phone: '+201234567890',
  status: 'Paid',
  tax_rate: 14,
};
const SAMPLE_ITEMS = [
  { description: 'Unit A-101 — Down Payment', qty: 1, price: 250000 },
  { description: 'Processing Fee', qty: 1, price: 5000 },
  { description: 'Legal Documentation', qty: 1, price: 3000 },
];
const SAMPLE_QUOTATION = {
  quotation_number: 'QT-2026-042',
  date: '2026-03-15',
  client_ar: 'شركة النيل للتطوير',
  client_en: 'Nile Development Co.',
  valid_until: '2026-04-15',
  tax_rate: 14,
};
const SAMPLE_CONTACT = {
  name_ar: 'محمد أحمد',
  name_en: 'Mohamed Ahmed',
  phone: '+201234567890',
  email: 'mohamed@example.com',
  company: 'ABC Corp',
  job_title: 'CEO',
  source: 'Facebook',
  contact_type: 'client',
  contact_status: 'following',
  budget: '500,000 EGP',
  created_at: '2026-01-15',
};
const SAMPLE_REPORT_DATA = [
  { name: 'Ahmed Ali', deals: 12, value: '1,200,000', rate: '85%' },
  { name: 'Sara Hassan', deals: 9, value: '980,000', rate: '72%' },
  { name: 'Omar Khaled', deals: 7, value: '750,000', rate: '68%' },
  { name: 'Mona Saeed', deals: 15, value: '1,800,000', rate: '91%' },
];
const SAMPLE_REPORT_COLS = [
  { key: 'name', header: 'Agent' },
  { key: 'deals', header: 'Deals' },
  { key: 'value', header: 'Value (EGP)' },
  { key: 'rate', header: 'Close Rate' },
];

export default function PrintSettingsPage() {
  const { i18n } = useTranslation();
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const isRTL = i18n.language === 'ar';
  const lang = i18n.language;

  const [form, setForm] = useState(getCompanyInfo());
  const [saved, setSaved] = useState(false);
  const [previewHTML, setPreviewHTML] = useState(null);
  const [previewTitle, setPreviewTitle] = useState('');

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }));

  const handleSave = () => {
    saveCompanyInfo(form);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const inputStyle = {
    width: '100%',
    padding: '10px 14px',
    borderRadius: 8,
    border: `1px solid ${isDark ? '#2a3a4a' : '#e2e8f0'}`,
    background: isDark ? '#0a1929' : '#ffffff',
    color: isDark ? '#e2e8f0' : '#1e293b',
    fontSize: 13,
    fontFamily: 'inherit',
    outline: 'none',
    boxSizing: 'border-box',
  };

  const labelStyle = {
    display: 'block',
    fontSize: 12,
    fontWeight: 600,
    color: isDark ? '#94a3b8' : '#64748b',
    marginBottom: 6,
  };

  const cardStyle = {
    background: isDark ? '#1a2332' : '#ffffff',
    border: `1px solid ${isDark ? '#2a3a4a' : '#e2e8f0'}`,
    borderRadius: 12,
    padding: 24,
    marginBottom: 20,
  };

  const previewBtnStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '10px 18px',
    borderRadius: 8,
    border: `1px solid ${isDark ? '#2a3a4a' : '#e2e8f0'}`,
    background: isDark ? '#132337' : '#f8fafc',
    color: isDark ? '#e2e8f0' : '#1e293b',
    cursor: 'pointer',
    fontSize: 13,
    fontWeight: 600,
    fontFamily: 'inherit',
    transition: 'all 0.15s',
  };

  const fields = [
    { key: 'name_ar', label: isRTL ? 'اسم الشركة (عربي)' : 'Company Name (AR)', dir: 'rtl' },
    { key: 'name_en', label: isRTL ? 'اسم الشركة (إنجليزي)' : 'Company Name (EN)', dir: 'ltr' },
    { key: 'phone', label: isRTL ? 'الهاتف' : 'Phone', dir: 'ltr' },
    { key: 'email', label: isRTL ? 'البريد الإلكتروني' : 'Email', dir: 'ltr' },
    { key: 'address_ar', label: isRTL ? 'العنوان (عربي)' : 'Address (AR)', dir: 'rtl' },
    { key: 'address_en', label: isRTL ? 'العنوان (إنجليزي)' : 'Address (EN)', dir: 'ltr' },
    { key: 'tax_id', label: isRTL ? 'الرقم الضريبي' : 'Tax ID', dir: 'ltr' },
    { key: 'website', label: isRTL ? 'الموقع الإلكتروني' : 'Website', dir: 'ltr' },
    { key: 'logo_url', label: isRTL ? 'رابط الشعار' : 'Logo URL', dir: 'ltr' },
  ];

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} style={{ padding: '24px 28px', minHeight: '100vh' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <div style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(74,122,171,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Printer size={20} style={{ color: '#4A7AAB' }} />
        </div>
        <div>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: isDark ? '#e2e8f0' : '#1e293b' }}>
            {isRTL ? 'إعدادات الطباعة' : 'Print Settings'}
          </h1>
          <p style={{ margin: 0, fontSize: 12, color: isDark ? '#94a3b8' : '#64748b' }}>
            {isRTL ? 'إعداد بيانات الشركة وقوالب الطباعة' : 'Configure company info and print templates'}
          </p>
        </div>
      </div>

      {/* Company Info Form */}
      <div style={cardStyle}>
        <h2 style={{ margin: '0 0 20px', fontSize: 16, fontWeight: 700, color: isDark ? '#e2e8f0' : '#1e293b' }}>
          {isRTL ? 'بيانات الشركة' : 'Company Information'}
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
          {fields.map(f => (
            <div key={f.key}>
              <label style={labelStyle}>{f.label}</label>
              <input
                style={{ ...inputStyle, direction: f.dir }}
                value={form[f.key] || ''}
                onChange={e => set(f.key, e.target.value)}
              />
            </div>
          ))}
        </div>
        <div style={{ marginTop: 20, display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            onClick={handleSave}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '10px 24px', borderRadius: 8, border: 'none',
              background: '#4A7AAB', color: 'white', cursor: 'pointer',
              fontSize: 13, fontWeight: 600, fontFamily: 'inherit',
            }}
          >
            <Save size={14} />
            {isRTL ? 'حفظ' : 'Save'}
          </button>
          {saved && (
            <span style={{ fontSize: 12, color: '#22C55E', fontWeight: 600 }}>
              {isRTL ? 'تم الحفظ' : 'Saved!'}
            </span>
          )}
        </div>
      </div>

      {/* Preview Templates */}
      <div style={cardStyle}>
        <h2 style={{ margin: '0 0 20px', fontSize: 16, fontWeight: 700, color: isDark ? '#e2e8f0' : '#1e293b' }}>
          {isRTL ? 'معاينة القوالب' : 'Template Previews'}
        </h2>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
          <button
            style={previewBtnStyle}
            onClick={() => {
              setPreviewTitle(isRTL ? 'فاتورة' : 'Invoice');
              setPreviewHTML(generateInvoiceHTML(SAMPLE_INVOICE, SAMPLE_ITEMS, form, lang));
            }}
          >
            <FileText size={16} style={{ color: '#4A7AAB' }} />
            {isRTL ? 'معاينة فاتورة' : 'Preview Invoice'}
          </button>
          <button
            style={previewBtnStyle}
            onClick={() => {
              setPreviewTitle(isRTL ? 'عرض سعر' : 'Quotation');
              setPreviewHTML(generateQuotationHTML(SAMPLE_QUOTATION, SAMPLE_ITEMS, form, lang));
            }}
          >
            <Eye size={16} style={{ color: '#8B5CF6' }} />
            {isRTL ? 'معاينة عرض سعر' : 'Preview Quotation'}
          </button>
          <button
            style={previewBtnStyle}
            onClick={() => {
              setPreviewTitle(isRTL ? 'بطاقة جهة اتصال' : 'Contact Card');
              setPreviewHTML(generateContactCardHTML(SAMPLE_CONTACT, form, lang));
            }}
          >
            <Users size={16} style={{ color: '#10B981' }} />
            {isRTL ? 'معاينة بطاقة جهة اتصال' : 'Preview Contact Card'}
          </button>
          <button
            style={previewBtnStyle}
            onClick={() => {
              setPreviewTitle(isRTL ? 'تقرير' : 'Report');
              setPreviewHTML(generateReportHTML(
                isRTL ? 'تقرير أداء المبيعات' : 'Sales Performance Report',
                SAMPLE_REPORT_DATA,
                SAMPLE_REPORT_COLS,
                form,
                lang,
              ));
            }}
          >
            <BarChart3 size={16} style={{ color: '#F59E0B' }} />
            {isRTL ? 'معاينة تقرير' : 'Preview Report'}
          </button>
        </div>
      </div>

      {/* Print Preview Modal */}
      {previewHTML && (
        <PrintPreview
          html={previewHTML}
          title={previewTitle}
          onClose={() => setPreviewHTML(null)}
        />
      )}
    </div>
  );
}
