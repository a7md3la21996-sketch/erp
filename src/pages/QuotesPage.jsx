import { useState, useEffect, useMemo, useCallback } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { useSystemConfig } from '../contexts/SystemConfigContext';
import { useAuth } from '../contexts/AuthContext';
import {
  getQuotes, createQuote, updateQuote, deleteQuote, duplicateQuote,
  getQuoteStats, generateQuoteNumber, calculateTotals,
} from '../services/quotesService';
import { getCompanyInfo } from '../services/printService';
import {
  FileText, Plus, Search, X, Copy, Trash2, Eye, Pencil, Printer,
  Send, ChevronDown, DollarSign, CheckCircle2, Clock, XCircle,
} from 'lucide-react';
import { Button, Card, Input, Select, Modal, ModalFooter, KpiCard, Pagination, PageSkeleton } from '../components/ui';

// ═══════════════════════════════════════════════════════════════════
// Status config
// ═══════════════════════════════════════════════════════════════════
const STATUS_CONFIG = {
  draft:    { color: '#64748b', bg: '#64748b20', label: { ar: 'مسودة',    en: 'Draft' } },
  sent:     { color: '#3b82f6', bg: '#3b82f620', label: { ar: 'مرسل',     en: 'Sent' } },
  accepted: { color: '#22c55e', bg: '#22c55e20', label: { ar: 'مقبول',    en: 'Accepted' } },
  rejected: { color: '#ef4444', bg: '#ef444420', label: { ar: 'مرفوض',    en: 'Rejected' } },
  expired:  { color: '#f97316', bg: '#f9731620', label: { ar: 'منتهي',    en: 'Expired' } },
};

const fmtNum = (n) => Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtDate = (d, isRTL) => d ? new Date(d).toLocaleDateString(isRTL ? 'ar-EG' : 'en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : '—';

// ═══════════════════════════════════════════════════════════════════
// Empty item template
// ═══════════════════════════════════════════════════════════════════
const emptyItem = () => ({
  id: Date.now().toString() + Math.random().toString(36).slice(2, 6),
  description: '',
  description_ar: '',
  quantity: 1,
  unit_price: 0,
  discount_percent: 0,
  tax_percent: 15,
  total: 0,
});

// ═══════════════════════════════════════════════════════════════════
// Print Quote HTML
// ═══════════════════════════════════════════════════════════════════
function printQuote(quote, isRTL) {
  const ci = getCompanyInfo();
  const companyName = isRTL ? ci.name_ar : ci.name_en;
  const companyAddress = isRTL ? ci.address_ar : ci.address_en;
  const dir = isRTL ? 'rtl' : 'ltr';
  const lang = isRTL ? 'ar' : 'en';
  const t = (ar, en) => isRTL ? ar : en;

  const itemsRows = (quote.items || []).map((item, i) => {
    const qty = Number(item.quantity) || 0;
    const price = Number(item.unit_price) || 0;
    const disc = Number(item.discount_percent) || 0;
    const tax = Number(item.tax_percent) || 0;
    const lineGross = qty * price;
    const lineDisc = lineGross * disc / 100;
    const lineAfter = lineGross - lineDisc;
    const lineTax = lineAfter * tax / 100;
    const lineTotal = lineAfter + lineTax;
    return `<tr>
      <td style="text-align:center">${i + 1}</td>
      <td>${isRTL ? (item.description_ar || item.description) : (item.description || item.description_ar)}</td>
      <td style="text-align:center">${qty}</td>
      <td style="text-align:right">${fmtNum(price)}</td>
      <td style="text-align:center">${disc}%</td>
      <td style="text-align:center">${tax}%</td>
      <td style="text-align:right">${fmtNum(lineTotal)}</td>
    </tr>`;
  }).join('');

  const html = `<!DOCTYPE html>
<html lang="${lang}" dir="${dir}">
<head>
<meta charset="UTF-8">
<title>${t('عرض سعر', 'Quotation')} - ${quote.quote_number}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', 'Cairo', Tahoma, sans-serif; color: #1e293b; line-height: 1.6; padding: 20mm; direction: ${dir}; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #4A7AAB; padding-bottom: 14px; margin-bottom: 24px; }
  .header-logo { max-height: 55px; max-width: 130px; object-fit: contain; }
  .company-name { font-size: 18px; font-weight: 700; color: #1e293b; }
  .company-detail { font-size: 10px; color: #64748b; }
  .quote-title { font-size: 22px; font-weight: 700; color: #4A7AAB; text-align: center; margin-bottom: 20px; }
  .info-grid { display: flex; gap: 24px; margin-bottom: 24px; }
  .info-box { flex: 1; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px; }
  .info-box h4 { font-size: 12px; font-weight: 600; color: #4A7AAB; margin-bottom: 8px; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px; }
  .info-row { font-size: 11px; margin-bottom: 3px; color: #334155; }
  .info-label { font-weight: 600; color: #64748b; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 11px; }
  th { background: #4A7AAB; color: white; padding: 8px 12px; font-weight: 600; }
  td { padding: 8px 12px; border-bottom: 1px solid #e2e8f0; }
  tr:nth-child(even) td { background: #f8fafc; }
  .totals { width: 280px; margin-${isRTL ? 'right' : 'left'}: auto; margin-bottom: 24px; }
  .totals-row { display: flex; justify-content: space-between; padding: 6px 0; font-size: 12px; border-bottom: 1px solid #f1f5f9; }
  .totals-row.grand { font-size: 15px; font-weight: 700; color: #4A7AAB; border-top: 2px solid #4A7AAB; border-bottom: none; padding-top: 10px; }
  .section-title { font-size: 13px; font-weight: 600; color: #1e293b; margin: 16px 0 8px; }
  .notes-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; font-size: 11px; line-height: 1.7; margin-bottom: 16px; white-space: pre-wrap; }
  .footer { margin-top: 30px; border-top: 2px solid #e2e8f0; padding-top: 12px; display: flex; justify-content: space-between; font-size: 10px; color: #94a3b8; }
  @media print { body { padding: 10mm; } @page { margin: 10mm; size: A4; } }
</style>
</head>
<body>
  <div class="header">
    <div><img src="${ci.logo_url || '/logo.png'}" alt="" class="header-logo" onerror="this.style.display='none'" /></div>
    <div style="text-align:${isRTL ? 'left' : 'right'}">
      <div class="company-name">${companyName}</div>
      ${companyAddress ? `<div class="company-detail">${companyAddress}</div>` : ''}
      ${ci.phone ? `<div class="company-detail">${ci.phone}</div>` : ''}
      ${ci.email ? `<div class="company-detail">${ci.email}</div>` : ''}
      ${ci.tax_id ? `<div class="company-detail">${t('الرقم الضريبي', 'Tax ID')}: ${ci.tax_id}</div>` : ''}
    </div>
  </div>

  <div class="quote-title">${t('عرض سعر', 'Quotation')} #${quote.quote_number}</div>

  <div class="info-grid">
    <div class="info-box">
      <h4>${t('معلومات العميل', 'Client Information')}</h4>
      <div class="info-row"><span class="info-label">${t('الاسم', 'Name')}:</span> ${quote.contact_name || '—'}</div>
      <div class="info-row"><span class="info-label">${t('الشركة', 'Company')}:</span> ${quote.company || '—'}</div>
      <div class="info-row"><span class="info-label">${t('البريد', 'Email')}:</span> ${quote.contact_email || '—'}</div>
      <div class="info-row"><span class="info-label">${t('الهاتف', 'Phone')}:</span> ${quote.contact_phone || '—'}</div>
    </div>
    <div class="info-box">
      <h4>${t('تفاصيل العرض', 'Quote Details')}</h4>
      <div class="info-row"><span class="info-label">${t('رقم العرض', 'Quote #')}:</span> ${quote.quote_number}</div>
      <div class="info-row"><span class="info-label">${t('التاريخ', 'Date')}:</span> ${fmtDate(quote.created_at, isRTL)}</div>
      <div class="info-row"><span class="info-label">${t('صالح حتى', 'Valid Until')}:</span> ${fmtDate(quote.valid_until, isRTL)}</div>
      ${quote.opportunity_name ? `<div class="info-row"><span class="info-label">${t('الفرصة', 'Opportunity')}:</span> ${quote.opportunity_name}</div>` : ''}
      ${quote.prepared_by ? `<div class="info-row"><span class="info-label">${t('إعداد', 'Prepared By')}:</span> ${quote.prepared_by}</div>` : ''}
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th style="width:40px">#</th>
        <th>${t('الوصف', 'Description')}</th>
        <th style="width:60px;text-align:center">${t('الكمية', 'Qty')}</th>
        <th style="width:100px;text-align:right">${t('السعر', 'Price')}</th>
        <th style="width:70px;text-align:center">${t('خصم%', 'Disc%')}</th>
        <th style="width:70px;text-align:center">${t('ضريبة%', 'Tax%')}</th>
        <th style="width:110px;text-align:right">${t('الإجمالي', 'Total')}</th>
      </tr>
    </thead>
    <tbody>
      ${itemsRows}
    </tbody>
  </table>

  <div class="totals">
    <div class="totals-row"><span>${t('المجموع الفرعي', 'Subtotal')}</span><span>${fmtNum(quote.subtotal)} ${quote.currency || 'SAR'}</span></div>
    <div class="totals-row"><span>${t('الخصم', 'Discount')}</span><span>-${fmtNum(quote.discount_total)} ${quote.currency || 'SAR'}</span></div>
    <div class="totals-row"><span>${t('الضريبة', 'Tax')}</span><span>${fmtNum(quote.tax_total)} ${quote.currency || 'SAR'}</span></div>
    <div class="totals-row grand"><span>${t('الإجمالي الكلي', 'Grand Total')}</span><span>${fmtNum(quote.grand_total)} ${quote.currency || 'SAR'}</span></div>
  </div>

  ${(quote.notes || quote.notes_ar) ? `
    <div class="section-title">${t('ملاحظات', 'Notes')}</div>
    <div class="notes-box">${isRTL ? (quote.notes_ar || quote.notes || '') : (quote.notes || quote.notes_ar || '')}</div>
  ` : ''}

  ${(quote.terms || quote.terms_ar) ? `
    <div class="section-title">${t('الشروط والأحكام', 'Terms & Conditions')}</div>
    <div class="notes-box">${isRTL ? (quote.terms_ar || quote.terms || '') : (quote.terms || quote.terms_ar || '')}</div>
  ` : ''}

  <div class="footer">
    <div>${companyName}${ci.phone ? ' | ' + ci.phone : ''}</div>
    <div>${new Date().toLocaleDateString(isRTL ? 'ar-EG' : 'en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</div>
  </div>
</body>
</html>`;

  const win = window.open('', '_blank');
  if (win) {
    win.document.write(html);
    win.document.close();
    win.focus();
    const timer = setTimeout(() => { if (!win.closed) win.print(); }, 400);
    win.addEventListener('beforeunload', () => clearTimeout(timer));
  }
}

// ═══════════════════════════════════════════════════════════════════
// Main Page
// ═══════════════════════════════════════════════════════════════════
export default function QuotesPage() {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const { i18n } = useTranslation();
  const { profile } = useAuth();
  const [searchParams] = useSearchParams();
  const { companyInfo } = useSystemConfig();

  const rawLang = i18n.language || 'ar';
  const isRTL = rawLang.startsWith('ar');
  const t = (ar, en) => isRTL ? ar : en;

  // ── State ──
  const [quotes, setQuotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingQuote, setEditingQuote] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [page, setPage] = useState(1);
  const perPage = 15;

  // ── Load data ──
  const loadQuotes = useCallback(() => {
    setQuotes(getQuotes());
  }, []);

  useEffect(() => { loadQuotes(); setLoading(false); }, [loadQuotes]);

  // ── Auto-open modal if navigated from opportunity ──
  useEffect(() => {
    const oppId = searchParams.get('opportunity_id');
    if (oppId && !showModal) {
      // Load opportunity data
      try {
        const opps = JSON.parse(localStorage.getItem('platform_opportunities') || '[]');
        const opp = opps.find(o => String(o.id) === String(oppId));
        if (opp) {
          const contactName = opp.contacts?.full_name || opp.contacts?.full_name_ar || opp.contacts?.full_name_en || '';
          setEditingQuote({
            opportunity_id: opp.id,
            opportunity_name: contactName + (opp.contacts?.company ? ` - ${opp.contacts?.company}` : ''),
            contact_id: opp.contact_id || '',
            contact_name: contactName,
            contact_email: opp.contacts?.email || '',
            contact_phone: opp.contacts?.phone || '',
            company: opp.contacts?.company || '',
            items: [emptyItem()],
          });
          setShowModal(true);
        }
      } catch { /* ignore */ }
    }
  }, [searchParams]);

  // ── Stats ──
  const stats = useMemo(() => getQuoteStats(), [quotes]);

  // ── Filtered quotes ──
  const filtered = useMemo(() => {
    let list = [...quotes];
    if (statusFilter !== 'all') list = list.filter(q => q.status === statusFilter);
    if (dateFrom) list = list.filter(q => q.created_at >= dateFrom);
    if (dateTo) list = list.filter(q => q.created_at <= dateTo + 'T23:59:59');
    if (search) {
      const s = search.toLowerCase();
      list = list.filter(q =>
        (q.quote_number || '').toLowerCase().includes(s) ||
        (q.contact_name || '').toLowerCase().includes(s) ||
        (q.company || '').toLowerCase().includes(s) ||
        (q.opportunity_name || '').toLowerCase().includes(s)
      );
    }
    return list;
  }, [quotes, statusFilter, dateFrom, dateTo, search]);

  const totalPages = Math.ceil(filtered.length / perPage);
  const paged = filtered.slice((page - 1) * perPage, page * perPage);

  // ── Handlers ──
  const handleSave = (data, status) => {
    if (editingQuote?.id) {
      updateQuote(editingQuote.id, { ...data, status: status || data.status });
    } else {
      createQuote({ ...data, status: status || 'draft', prepared_by: profile?.full_name_ar || profile?.full_name_en || '' });
    }
    setShowModal(false);
    setEditingQuote(null);
    loadQuotes();
  };

  const handleDelete = (id) => {
    deleteQuote(id);
    setConfirmDelete(null);
    loadQuotes();
  };

  const handleDuplicate = (id) => {
    duplicateQuote(id);
    loadQuotes();
  };

  const handleEdit = (quote) => {
    setEditingQuote(quote);
    setShowModal(true);
  };

  const openNew = () => {
    setEditingQuote(null);
    setShowModal(true);
  };

  // ═══════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════
  if (loading) return <PageSkeleton hasKpis kpiCount={4} tableRows={6} tableCols={7} />;

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} style={{ padding: '24px', minHeight: '100vh' }}>
      {/* ── Header ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <FileText size={24} style={{ color: '#4A7AAB' }} />
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: isDark ? '#f1f5f9' : '#1e293b' }}>
            {t('عروض الأسعار', 'Quotes & Proposals')}
          </h1>
        </div>
        <Button onClick={openNew} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Plus size={16} /> {t('عرض سعر جديد', 'New Quote')}
        </Button>
      </div>

      {/* ── KPI Cards ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14, marginBottom: 20 }}>
        <KpiCard
          label={t('إجمالي العروض', 'Total Quotes')}
          value={stats.total}
          icon={<FileText size={20} />}
          color="#4A7AAB"
        />
        <KpiCard
          label={t('القيمة المقبولة', 'Accepted Value')}
          value={`${fmtNum(stats.accepted_value)} ${t('ر.س', 'SAR')}`}
          icon={<CheckCircle2 size={20} />}
          color="#22c55e"
        />
        <KpiCard
          label={t('القيمة المعلقة', 'Pending Value')}
          value={`${fmtNum(stats.pending_value)} ${t('ر.س', 'SAR')}`}
          icon={<Clock size={20} />}
          color="#3b82f6"
        />
        <KpiCard
          label={t('معدل القبول', 'Acceptance Rate')}
          value={`${stats.acceptance_rate}%`}
          icon={<DollarSign size={20} />}
          color="#f97316"
        />
      </div>

      {/* ── Filters ── */}
      <Card style={{ padding: '14px 18px', marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: '1 1 220px', minWidth: 180 }}>
            <Search size={15} style={{ position: 'absolute', top: '50%', transform: 'translateY(-50%)', [isRTL ? 'right' : 'left']: 10, color: '#94a3b8' }} />
            <input
              type="text"
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
              placeholder={t('بحث بالرقم، العميل، الشركة...', 'Search by number, client, company...')}
              style={{
                width: '100%',
                padding: '8px 12px',
                [isRTL ? 'paddingRight' : 'paddingLeft']: 34,
                border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
                borderRadius: 8,
                background: isDark ? '#1e293b' : '#fff',
                color: isDark ? '#f1f5f9' : '#1e293b',
                fontSize: 13,
                outline: 'none',
              }}
            />
          </div>
          <select
            value={statusFilter}
            onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
            style={{
              padding: '8px 12px',
              border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
              borderRadius: 8,
              background: isDark ? '#1e293b' : '#fff',
              color: isDark ? '#f1f5f9' : '#1e293b',
              fontSize: 13,
              cursor: 'pointer',
            }}
          >
            <option value="all">{t('كل الحالات', 'All Statuses')}</option>
            {Object.entries(STATUS_CONFIG).map(([k, v]) => (
              <option key={k} value={k}>{v.label[isRTL ? 'ar' : 'en']}</option>
            ))}
          </select>
          <input
            type="date"
            value={dateFrom}
            onChange={e => { setDateFrom(e.target.value); setPage(1); }}
            style={{
              padding: '8px 12px',
              border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
              borderRadius: 8,
              background: isDark ? '#1e293b' : '#fff',
              color: isDark ? '#f1f5f9' : '#1e293b',
              fontSize: 13,
            }}
          />
          <input
            type="date"
            value={dateTo}
            onChange={e => { setDateTo(e.target.value); setPage(1); }}
            style={{
              padding: '8px 12px',
              border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
              borderRadius: 8,
              background: isDark ? '#1e293b' : '#fff',
              color: isDark ? '#f1f5f9' : '#1e293b',
              fontSize: 13,
            }}
          />
          {(search || statusFilter !== 'all' || dateFrom || dateTo) && (
            <button
              onClick={() => { setSearch(''); setStatusFilter('all'); setDateFrom(''); setDateTo(''); setPage(1); }}
              style={{
                background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444',
                display: 'flex', alignItems: 'center', gap: 4, fontSize: 12,
              }}
            >
              <X size={14} /> {t('مسح', 'Clear')}
            </button>
          )}
        </div>
      </Card>

      {/* ── Table ── */}
      <Card style={{ overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: isDark ? '#1e293b' : '#f8fafc' }}>
              {[
                t('رقم العرض', 'Quote #'),
                t('العميل', 'Client'),
                t('الفرصة', 'Opportunity'),
                t('المبلغ', 'Amount'),
                t('الحالة', 'Status'),
                t('التاريخ', 'Date'),
                t('صالح حتى', 'Valid Until'),
                t('إجراءات', 'Actions'),
              ].map((h, i) => (
                <th key={i} style={{
                  padding: '10px 14px',
                  textAlign: isRTL ? 'right' : 'left',
                  fontWeight: 600,
                  color: isDark ? '#94a3b8' : '#64748b',
                  borderBottom: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
                  fontSize: 12,
                  whiteSpace: 'nowrap',
                }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paged.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ textAlign: 'center', padding: '48px 20px', color: isDark ? '#64748b' : '#94a3b8' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                    <div style={{
                      width: 56, height: 56, borderRadius: 16,
                      background: isDark ? 'rgba(74,122,171,0.1)' : 'rgba(74,122,171,0.06)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 4,
                    }}>
                      <FileText size={24} style={{ color: '#4A7AAB', opacity: 0.5 }} />
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: isDark ? '#e2e8f0' : '#1e293b' }}>
                      {t('لا توجد عروض أسعار', 'No quotes found')}
                    </div>
                    <div style={{ fontSize: 12 }}>
                      {t('أنشئ أول عرض سعر الآن', 'Create your first quote now')}
                    </div>
                    <button
                      onClick={() => { setEditingQuote(null); setShowModal(true); }}
                      style={{
                        marginTop: 8, display: 'flex', alignItems: 'center', gap: 6,
                        padding: '8px 18px', borderRadius: 8, border: 'none',
                        background: 'linear-gradient(135deg, #4A7AAB, #2B4C6F)',
                        color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                      }}
                    >
                      <Plus size={15} /> {t('عرض سعر جديد', 'New Quote')}
                    </button>
                  </div>
                </td>
              </tr>
            ) : paged.map(q => {
              const sc = STATUS_CONFIG[q.status] || STATUS_CONFIG.draft;
              const isExpired = q.status === 'sent' && q.valid_until && new Date(q.valid_until) < new Date();
              const displayStatus = isExpired ? STATUS_CONFIG.expired : sc;

              return (
                <tr key={q.id} style={{
                  borderBottom: `1px solid ${isDark ? '#1e293b' : '#f1f5f9'}`,
                  transition: 'background 0.15s',
                  cursor: 'pointer',
                }}
                  onMouseEnter={e => e.currentTarget.style.background = isDark ? '#1e293b80' : '#f8fafc'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <td style={{ padding: '10px 14px', fontWeight: 600, color: '#4A7AAB' }}>{q.quote_number}</td>
                  <td style={{ padding: '10px 14px', color: isDark ? '#f1f5f9' : '#1e293b' }}>
                    <div>{q.contact_name || '—'}</div>
                    {q.company && <div style={{ fontSize: 11, color: '#94a3b8' }}>{q.company}</div>}
                  </td>
                  <td style={{ padding: '10px 14px', color: isDark ? '#cbd5e1' : '#475569', fontSize: 12 }}>
                    {q.opportunity_name || '—'}
                  </td>
                  <td style={{ padding: '10px 14px', fontWeight: 600, color: isDark ? '#f1f5f9' : '#1e293b' }}>
                    {fmtNum(q.grand_total)} <span style={{ fontSize: 11, color: '#94a3b8' }}>{q.currency || 'SAR'}</span>
                  </td>
                  <td style={{ padding: '10px 14px' }}>
                    <span style={{
                      padding: '3px 10px',
                      borderRadius: 20,
                      fontSize: 11,
                      fontWeight: 600,
                      background: displayStatus.bg,
                      color: displayStatus.color,
                    }}>
                      {displayStatus.label[isRTL ? 'ar' : 'en']}
                    </span>
                  </td>
                  <td style={{ padding: '10px 14px', color: isDark ? '#cbd5e1' : '#475569', fontSize: 12, whiteSpace: 'nowrap' }}>
                    {fmtDate(q.created_at, isRTL)}
                  </td>
                  <td style={{ padding: '10px 14px', color: isDark ? '#cbd5e1' : '#475569', fontSize: 12, whiteSpace: 'nowrap' }}>
                    {fmtDate(q.valid_until, isRTL)}
                  </td>
                  <td style={{ padding: '10px 14px' }}>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button onClick={() => printQuote(q, isRTL)} title={t('طباعة', 'Print')}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#4A7AAB', padding: 4, borderRadius: 4 }}>
                        <Printer size={15} />
                      </button>
                      <button onClick={() => handleEdit(q)} title={t('تعديل', 'Edit')}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#4A7AAB', padding: 4, borderRadius: 4 }}>
                        <Pencil size={15} />
                      </button>
                      <button onClick={() => handleDuplicate(q.id)} title={t('نسخ', 'Duplicate')}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', padding: 4, borderRadius: 4 }}>
                        <Copy size={15} />
                      </button>
                      <button onClick={() => setConfirmDelete(q)} title={t('حذف', 'Delete')}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: 4, borderRadius: 4 }}>
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {totalPages > 1 && (
          <div style={{ padding: '12px 16px', borderTop: `1px solid ${isDark ? '#334155' : '#e2e8f0'}` }}>
            <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
          </div>
        )}
      </Card>

      {/* ── Create/Edit Modal ── */}
      {showModal && (
        <QuoteModal
          quote={editingQuote}
          isRTL={isRTL}
          isDark={isDark}
          t={t}
          onSave={handleSave}
          onClose={() => { setShowModal(false); setEditingQuote(null); }}
          profile={profile}
        />
      )}

      {/* ── Delete Confirm ── */}
      {confirmDelete && (
        <Modal
          open
          onClose={() => setConfirmDelete(null)}
          title={t('تأكيد الحذف', 'Confirm Delete')}
          maxWidth="400px"
        >
          <p style={{ margin: '16px 0', color: isDark ? '#cbd5e1' : '#475569' }}>
            {t(
              `هل أنت متأكد من حذف عرض السعر ${confirmDelete.quote_number}؟`,
              `Are you sure you want to delete quote ${confirmDelete.quote_number}?`
            )}
          </p>
          <ModalFooter>
            <Button variant="ghost" onClick={() => setConfirmDelete(null)}>{t('إلغاء', 'Cancel')}</Button>
            <Button variant="danger" onClick={() => handleDelete(confirmDelete.id)}>{t('حذف', 'Delete')}</Button>
          </ModalFooter>
        </Modal>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Quote Modal (Create / Edit)
// ═══════════════════════════════════════════════════════════════════
function QuoteModal({ quote, isRTL, isDark, t, onSave, onClose, profile }) {
  const isEditing = !!quote?.id;

  // ── Contact Search ──
  const [contactSearch, setContactSearch] = useState('');
  const [contactResults, setContactResults] = useState([]);
  const [showContactDropdown, setShowContactDropdown] = useState(false);

  // ── Opportunity Search ──
  const [opportunitySearch, setOpportunitySearch] = useState('');
  const [opportunityResults, setOpportunityResults] = useState([]);
  const [showOppDropdown, setShowOppDropdown] = useState(false);

  // ── Form State ──
  const [form, setForm] = useState(() => {
    if (quote) {
      return {
        contact_id: quote.contact_id || '',
        contact_name: quote.contact_name || '',
        contact_email: quote.contact_email || '',
        contact_phone: quote.contact_phone || '',
        company: quote.company || '',
        opportunity_id: quote.opportunity_id || '',
        opportunity_name: quote.opportunity_name || '',
        items: (quote.items && quote.items.length) ? quote.items : [emptyItem()],
        notes: quote.notes || '',
        notes_ar: quote.notes_ar || '',
        terms: quote.terms || '',
        terms_ar: quote.terms_ar || '',
        valid_until: quote.valid_until || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        currency: quote.currency || 'SAR',
        status: quote.status || 'draft',
      };
    }
    return {
      contact_id: '',
      contact_name: '',
      contact_email: '',
      contact_phone: '',
      company: '',
      opportunity_id: '',
      opportunity_name: '',
      items: [emptyItem()],
      notes: '',
      notes_ar: '',
      terms: '',
      terms_ar: '',
      valid_until: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      currency: 'SAR',
      status: 'draft',
    };
  });

  // ── Search contacts ──
  useEffect(() => {
    if (contactSearch.length < 2) { setContactResults([]); return; }
    const q = contactSearch.toLowerCase();
    try {
      const contacts = JSON.parse(localStorage.getItem('platform_contacts') || '[]');
      const results = contacts.filter(c =>
        (c.full_name || '').toLowerCase().includes(q) ||
        (c.full_name_ar || '').toLowerCase().includes(q) ||
        (c.phone || '').includes(q) ||
        (c.email || '').toLowerCase().includes(q) ||
        (c.company || '').toLowerCase().includes(q)
      ).slice(0, 8);
      setContactResults(results);
      setShowContactDropdown(results.length > 0);
    } catch { setContactResults([]); }
  }, [contactSearch]);

  // ── Search opportunities ──
  useEffect(() => {
    if (opportunitySearch.length < 2) { setOpportunityResults([]); return; }
    const q = opportunitySearch.toLowerCase();
    try {
      const opps = JSON.parse(localStorage.getItem('platform_opportunities') || '[]');
      const results = opps.filter(o => {
        const name = o.contacts?.full_name || o.contacts?.full_name_ar || '';
        const company = o.contacts?.company || '';
        return name.toLowerCase().includes(q) || company.toLowerCase().includes(q);
      }).slice(0, 8);
      setOpportunityResults(results);
      setShowOppDropdown(results.length > 0);
    } catch { setOpportunityResults([]); }
  }, [opportunitySearch]);

  const selectContact = (c) => {
    setForm(prev => ({
      ...prev,
      contact_id: c.id,
      contact_name: c.full_name || c.full_name_ar || c.full_name_en || '',
      contact_email: c.email || '',
      contact_phone: c.phone || '',
      company: c.company || '',
    }));
    setContactSearch('');
    setShowContactDropdown(false);
  };

  const selectOpportunity = (opp) => {
    const name = opp.contacts?.full_name || opp.contacts?.full_name_ar || opp.contacts?.full_name_en || '';
    setForm(prev => ({
      ...prev,
      opportunity_id: opp.id,
      opportunity_name: name + (opp.contacts?.company ? ` - ${opp.contacts?.company}` : ''),
      contact_id: prev.contact_id || opp.contact_id || '',
      contact_name: prev.contact_name || name,
      contact_email: prev.contact_email || opp.contacts?.email || '',
      contact_phone: prev.contact_phone || opp.contacts?.phone || '',
      company: prev.company || opp.contacts?.company || '',
    }));
    setOpportunitySearch('');
    setShowOppDropdown(false);
  };

  // ── Items management ──
  const updateItem = (idx, field, value) => {
    setForm(prev => {
      const items = [...prev.items];
      items[idx] = { ...items[idx], [field]: value };
      return { ...prev, items };
    });
  };

  const addItem = () => {
    setForm(prev => ({ ...prev, items: [...prev.items, emptyItem()] }));
  };

  const removeItem = (idx) => {
    setForm(prev => ({
      ...prev,
      items: prev.items.length > 1 ? prev.items.filter((_, i) => i !== idx) : prev.items,
    }));
  };

  // ── Validation ──
  const [errors, setErrors] = useState({});

  // ── Computed totals ──
  const totals = useMemo(() => calculateTotals(form.items), [form.items]);

  const handleSave = (status) => {
    const errs = {};
    if (!form.contact_id && !form.contact_name.trim()) errs.contact = isRTL ? 'العميل مطلوب' : 'Contact is required';
    if (!form.items.length || form.items.every(i => !i.description && !i.description_ar)) errs.items = isRTL ? 'مطلوب بند واحد على الأقل' : 'At least 1 item required';
    form.items.forEach((item, idx) => {
      if (Number(item.quantity) <= 0) errs[`item_qty_${idx}`] = isRTL ? 'الكمية يجب أن تكون أكبر من 0' : 'Qty must be > 0';
      if (Number(item.unit_price) < 0) errs[`item_price_${idx}`] = isRTL ? 'السعر يجب أن يكون 0 أو أكثر' : 'Price must be >= 0';
    });
    if (form.valid_until) {
      const today = new Date(); today.setHours(0,0,0,0);
      if (new Date(form.valid_until) < today) errs.valid_until = isRTL ? 'يجب أن يكون التاريخ في المستقبل' : 'Date must be in the future';
    }
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setErrors({});
    onSave({ ...form, ...totals }, status);
  };

  const inputStyle = {
    width: '100%',
    padding: '8px 12px',
    border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
    borderRadius: 8,
    background: isDark ? '#1e293b' : '#fff',
    color: isDark ? '#f1f5f9' : '#1e293b',
    fontSize: 13,
    outline: 'none',
  };

  const labelStyle = {
    display: 'block',
    fontSize: 12,
    fontWeight: 600,
    color: isDark ? '#94a3b8' : '#64748b',
    marginBottom: 4,
  };

  const sectionTitle = (text) => (
    <div style={{
      fontSize: 13,
      fontWeight: 700,
      color: '#4A7AAB',
      marginTop: 20,
      marginBottom: 10,
      paddingBottom: 6,
      borderBottom: `2px solid ${isDark ? '#334155' : '#e2e8f0'}`,
    }}>
      {text}
    </div>
  );

  return (
    <div
      dir={isRTL ? 'rtl' : 'ltr'}
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex', justifyContent: 'center', alignItems: 'flex-start',
        padding: '40px 16px',
        overflowY: 'auto',
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        width: '100%', maxWidth: 780,
        background: isDark ? '#0f172a' : '#fff',
        borderRadius: 14,
        boxShadow: '0 25px 60px rgba(0,0,0,0.3)',
        padding: '24px 28px',
        maxHeight: '90vh',
        overflowY: 'auto',
      }}>
        {/* Modal Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: isDark ? '#f1f5f9' : '#1e293b' }}>
            {isEditing ? t('تعديل عرض السعر', 'Edit Quote') : t('عرض سعر جديد', 'New Quote')}
          </h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', fontSize: 18 }}>
            <X size={20} />
          </button>
        </div>

        {/* ── Client Info Section ── */}
        {sectionTitle(t('معلومات العميل', 'Client Information'))}
        <div style={{ position: 'relative', marginBottom: 12 }}>
          <label style={labelStyle}>{t('بحث عن عميل', 'Search Contact')}</label>
          <div style={{ position: 'relative' }}>
            <Search size={14} style={{ position: 'absolute', top: '50%', transform: 'translateY(-50%)', [isRTL ? 'right' : 'left']: 10, color: '#94a3b8' }} />
            <input
              type="text"
              value={contactSearch}
              onChange={e => setContactSearch(e.target.value)}
              onFocus={() => contactResults.length && setShowContactDropdown(true)}
              placeholder={t('ابحث بالاسم، الهاتف، البريد...', 'Search by name, phone, email...')}
              style={{ ...inputStyle, [isRTL ? 'paddingRight' : 'paddingLeft']: 32 }}
            />
          </div>
          {showContactDropdown && contactResults.length > 0 && (
            <div style={{
              position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50,
              background: isDark ? '#1e293b' : '#fff',
              border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
              borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
              maxHeight: 200, overflowY: 'auto',
            }}>
              {contactResults.map(c => (
                <div key={c.id} onClick={() => selectContact(c)}
                  style={{
                    padding: '8px 14px', cursor: 'pointer', fontSize: 12,
                    borderBottom: `1px solid ${isDark ? '#1e293b' : '#f1f5f9'}`,
                    color: isDark ? '#f1f5f9' : '#1e293b',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = isDark ? '#334155' : '#f8fafc'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <div style={{ fontWeight: 600 }}>{c.full_name || c.full_name_ar || c.full_name_en}</div>
                  <div style={{ color: '#94a3b8', fontSize: 11 }}>
                    {[c.company, c.phone, c.email].filter(Boolean).join(' | ')}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {errors.contact && <span style={{ color: '#ef4444', fontSize: 12, marginTop: 2, display: 'block', marginBottom: 4 }}>{errors.contact}</span>}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
          <div>
            <label style={labelStyle}>{t('اسم العميل', 'Contact Name')}</label>
            <input type="text" value={form.contact_name} onChange={e => { setForm(p => ({ ...p, contact_name: e.target.value })); setErrors(p => ({ ...p, contact: '' })); }} style={{ ...inputStyle, border: errors.contact ? '1.5px solid #ef4444' : inputStyle.border }} />
          </div>
          <div>
            <label style={labelStyle}>{t('الشركة', 'Company')}</label>
            <input type="text" value={form.company} onChange={e => setForm(p => ({ ...p, company: e.target.value }))} style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>{t('البريد الإلكتروني', 'Email')}</label>
            <input type="email" value={form.contact_email} onChange={e => setForm(p => ({ ...p, contact_email: e.target.value }))} style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>{t('الهاتف', 'Phone')}</label>
            <input type="text" value={form.contact_phone} onChange={e => setForm(p => ({ ...p, contact_phone: e.target.value }))} style={inputStyle} />
          </div>
        </div>

        {/* ── Opportunity Link ── */}
        {sectionTitle(t('ربط بفرصة (اختياري)', 'Link to Opportunity (Optional)'))}
        <div style={{ position: 'relative', marginBottom: 12 }}>
          {form.opportunity_id ? (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px',
              background: isDark ? '#1e293b' : '#f8fafc',
              border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
              borderRadius: 8,
            }}>
              <span style={{ flex: 1, fontSize: 13, color: isDark ? '#f1f5f9' : '#1e293b' }}>{form.opportunity_name}</span>
              <button onClick={() => setForm(p => ({ ...p, opportunity_id: '', opportunity_name: '' }))}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444' }}>
                <X size={14} />
              </button>
            </div>
          ) : (
            <>
              <div style={{ position: 'relative' }}>
                <Search size={14} style={{ position: 'absolute', top: '50%', transform: 'translateY(-50%)', [isRTL ? 'right' : 'left']: 10, color: '#94a3b8' }} />
                <input
                  type="text"
                  value={opportunitySearch}
                  onChange={e => setOpportunitySearch(e.target.value)}
                  onFocus={() => opportunityResults.length && setShowOppDropdown(true)}
                  placeholder={t('ابحث عن فرصة...', 'Search opportunity...')}
                  style={{ ...inputStyle, [isRTL ? 'paddingRight' : 'paddingLeft']: 32 }}
                />
              </div>
              {showOppDropdown && opportunityResults.length > 0 && (
                <div style={{
                  position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50,
                  background: isDark ? '#1e293b' : '#fff',
                  border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
                  borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
                  maxHeight: 200, overflowY: 'auto',
                }}>
                  {opportunityResults.map(o => {
                    const name = o.contacts?.full_name || o.contacts?.full_name_ar || '';
                    return (
                      <div key={o.id} onClick={() => selectOpportunity(o)}
                        style={{
                          padding: '8px 14px', cursor: 'pointer', fontSize: 12,
                          borderBottom: `1px solid ${isDark ? '#1e293b' : '#f1f5f9'}`,
                          color: isDark ? '#f1f5f9' : '#1e293b',
                        }}
                        onMouseEnter={e => e.currentTarget.style.background = isDark ? '#334155' : '#f8fafc'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                      >
                        <div style={{ fontWeight: 600 }}>{name}</div>
                        <div style={{ color: '#94a3b8', fontSize: 11 }}>
                          {o.contacts?.company || ''} {o.stage ? `| ${o.stage}` : ''}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>

        {/* ── Items Table ── */}
        {sectionTitle(t('بنود العرض', 'Quote Items'))}
        {errors.items && <span style={{ color: '#ef4444', fontSize: 12, marginBottom: 6, display: 'block' }}>{errors.items}</span>}
        <div style={{ overflowX: 'auto', marginBottom: 12 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, minWidth: 650 }}>
            <thead>
              <tr style={{ background: isDark ? '#1e293b' : '#f8fafc' }}>
                <th style={{ padding: '8px 10px', textAlign: isRTL ? 'right' : 'left', fontWeight: 600, color: '#64748b', borderBottom: `1px solid ${isDark ? '#334155' : '#e2e8f0'}` }}>
                  {t('الوصف', 'Description')}
                </th>
                <th style={{ padding: '8px 6px', textAlign: isRTL ? 'right' : 'left', fontWeight: 600, color: '#64748b', borderBottom: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`, width: 140 }}>
                  {t('الوصف (عربي)', 'Desc (AR)')}
                </th>
                <th style={{ padding: '8px 6px', textAlign: 'center', fontWeight: 600, color: '#64748b', borderBottom: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`, width: 60 }}>
                  {t('الكمية', 'Qty')}
                </th>
                <th style={{ padding: '8px 6px', textAlign: 'center', fontWeight: 600, color: '#64748b', borderBottom: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`, width: 90 }}>
                  {t('السعر', 'Price')}
                </th>
                <th style={{ padding: '8px 6px', textAlign: 'center', fontWeight: 600, color: '#64748b', borderBottom: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`, width: 60 }}>
                  {t('خصم%', 'Disc%')}
                </th>
                <th style={{ padding: '8px 6px', textAlign: 'center', fontWeight: 600, color: '#64748b', borderBottom: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`, width: 60 }}>
                  {t('ضريبة%', 'Tax%')}
                </th>
                <th style={{ padding: '8px 6px', textAlign: isRTL ? 'left' : 'right', fontWeight: 600, color: '#64748b', borderBottom: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`, width: 90 }}>
                  {t('الإجمالي', 'Total')}
                </th>
                <th style={{ width: 36, borderBottom: `1px solid ${isDark ? '#334155' : '#e2e8f0'}` }}></th>
              </tr>
            </thead>
            <tbody>
              {form.items.map((item, idx) => {
                const qty = Number(item.quantity) || 0;
                const price = Number(item.unit_price) || 0;
                const disc = Number(item.discount_percent) || 0;
                const tax = Number(item.tax_percent) ?? 15;
                const lineGross = qty * price;
                const lineDisc = lineGross * disc / 100;
                const lineAfter = lineGross - lineDisc;
                const lineTax = lineAfter * tax / 100;
                const lineTotal = lineAfter + lineTax;

                const cellInput = (field, value, opts = {}) => {
                  const errKey = field === 'quantity' ? `item_qty_${idx}` : field === 'unit_price' ? `item_price_${idx}` : null;
                  const hasErr = errKey && errors[errKey];
                  return (
                    <div>
                      <input
                        type={opts.type || 'text'}
                        value={value}
                        onChange={e => { updateItem(idx, field, opts.type === 'number' ? e.target.value : e.target.value); if (errKey) setErrors(p => ({ ...p, [errKey]: '' })); }}
                        style={{
                          ...inputStyle,
                          padding: '6px 8px',
                          textAlign: opts.align || (isRTL ? 'right' : 'left'),
                          ...(opts.style || {}),
                          ...(hasErr ? { border: '1.5px solid #ef4444' } : {}),
                        }}
                      />
                      {hasErr && <span style={{ color: '#ef4444', fontSize: 10, marginTop: 1, display: 'block' }}>{errors[errKey]}</span>}
                    </div>
                  );
                };

                return (
                  <tr key={item.id} style={{ borderBottom: `1px solid ${isDark ? '#1e293b' : '#f1f5f9'}` }}>
                    <td style={{ padding: '6px 4px' }}>
                      {cellInput('description', item.description)}
                    </td>
                    <td style={{ padding: '6px 4px' }}>
                      {cellInput('description_ar', item.description_ar)}
                    </td>
                    <td style={{ padding: '6px 4px' }}>
                      {cellInput('quantity', item.quantity, { type: 'number', align: 'center' })}
                    </td>
                    <td style={{ padding: '6px 4px' }}>
                      {cellInput('unit_price', item.unit_price, { type: 'number', align: 'center' })}
                    </td>
                    <td style={{ padding: '6px 4px' }}>
                      {cellInput('discount_percent', item.discount_percent, { type: 'number', align: 'center' })}
                    </td>
                    <td style={{ padding: '6px 4px' }}>
                      {cellInput('tax_percent', item.tax_percent, { type: 'number', align: 'center' })}
                    </td>
                    <td style={{
                      padding: '6px 10px',
                      fontWeight: 600,
                      textAlign: isRTL ? 'left' : 'right',
                      color: isDark ? '#f1f5f9' : '#1e293b',
                      fontSize: 12,
                    }}>
                      {fmtNum(lineTotal)}
                    </td>
                    <td style={{ padding: '6px 4px' }}>
                      {form.items.length > 1 && (
                        <button onClick={() => removeItem(idx)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: 2 }}>
                          <Trash2 size={14} />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <button onClick={addItem}
          style={{
            background: 'none', border: `1px dashed ${isDark ? '#334155' : '#cbd5e1'}`,
            borderRadius: 8, padding: '8px 16px', cursor: 'pointer',
            color: '#4A7AAB', fontSize: 12, fontWeight: 600,
            display: 'flex', alignItems: 'center', gap: 6,
            width: '100%', justifyContent: 'center', marginBottom: 16,
          }}>
          <Plus size={14} /> {t('إضافة بند', 'Add Item')}
        </button>

        {/* ── Totals Summary ── */}
        <div style={{
          width: 280,
          marginLeft: isRTL ? 0 : 'auto',
          marginRight: isRTL ? 'auto' : 0,
          marginBottom: 16,
          background: isDark ? '#1e293b' : '#f8fafc',
          borderRadius: 10,
          padding: 14,
          border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
        }}>
          {[
            [t('المجموع الفرعي', 'Subtotal'), fmtNum(totals.subtotal)],
            [t('الخصم', 'Discount'), `-${fmtNum(totals.discount_total)}`],
            [t('الضريبة', 'Tax (VAT)'), fmtNum(totals.tax_total)],
          ].map(([label, val], i) => (
            <div key={i} style={{
              display: 'flex', justifyContent: 'space-between', padding: '5px 0',
              fontSize: 12, color: isDark ? '#cbd5e1' : '#475569',
              borderBottom: `1px solid ${isDark ? '#334155' : '#f1f5f9'}`,
            }}>
              <span>{label}</span>
              <span>{val} {form.currency}</span>
            </div>
          ))}
          <div style={{
            display: 'flex', justifyContent: 'space-between', paddingTop: 8,
            fontSize: 15, fontWeight: 700, color: '#4A7AAB',
            borderTop: `2px solid #4A7AAB`, marginTop: 4,
          }}>
            <span>{t('الإجمالي الكلي', 'Grand Total')}</span>
            <span>{fmtNum(totals.grand_total)} {form.currency}</span>
          </div>
        </div>

        {/* ── Notes & Terms ── */}
        {sectionTitle(t('ملاحظات وشروط', 'Notes & Terms'))}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
          <div>
            <label style={labelStyle}>{t('ملاحظات (إنجليزي)', 'Notes (EN)')}</label>
            <textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
              rows={3} style={{ ...inputStyle, resize: 'vertical' }} />
          </div>
          <div>
            <label style={labelStyle}>{t('ملاحظات (عربي)', 'Notes (AR)')}</label>
            <textarea value={form.notes_ar} onChange={e => setForm(p => ({ ...p, notes_ar: e.target.value }))}
              rows={3} style={{ ...inputStyle, resize: 'vertical' }} />
          </div>
          <div>
            <label style={labelStyle}>{t('الشروط (إنجليزي)', 'Terms (EN)')}</label>
            <textarea value={form.terms} onChange={e => setForm(p => ({ ...p, terms: e.target.value }))}
              rows={3} style={{ ...inputStyle, resize: 'vertical' }} />
          </div>
          <div>
            <label style={labelStyle}>{t('الشروط (عربي)', 'Terms (AR)')}</label>
            <textarea value={form.terms_ar} onChange={e => setForm(p => ({ ...p, terms_ar: e.target.value }))}
              rows={3} style={{ ...inputStyle, resize: 'vertical' }} />
          </div>
        </div>

        {/* ── Valid Until & Currency ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
          <div>
            <label style={labelStyle}>{t('صالح حتى', 'Valid Until')}</label>
            <input type="date" value={form.valid_until} onChange={e => { setForm(p => ({ ...p, valid_until: e.target.value })); setErrors(p => ({ ...p, valid_until: '' })); }} style={{ ...inputStyle, ...(errors.valid_until ? { border: '1.5px solid #ef4444' } : {}) }} />
            {errors.valid_until && <span style={{ color: '#ef4444', fontSize: 12, marginTop: 2, display: 'block' }}>{errors.valid_until}</span>}
          </div>
          <div>
            <label style={labelStyle}>{t('العملة', 'Currency')}</label>
            <select value={form.currency} onChange={e => setForm(p => ({ ...p, currency: e.target.value }))} style={{ ...inputStyle, cursor: 'pointer' }}>
              <option value="SAR">{t('ريال سعودي', 'SAR')}</option>
              <option value="USD">{t('دولار أمريكي', 'USD')}</option>
              <option value="EUR">{t('يورو', 'EUR')}</option>
              <option value="EGP">{t('جنيه مصري', 'EGP')}</option>
              <option value="AED">{t('درهم إماراتي', 'AED')}</option>
            </select>
          </div>
        </div>

        {/* ── Actions ── */}
        <div style={{
          display: 'flex', justifyContent: 'flex-end', gap: 10,
          paddingTop: 16,
          borderTop: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
        }}>
          <Button variant="ghost" onClick={onClose}>{t('إلغاء', 'Cancel')}</Button>
          <Button
            variant="secondary"
            onClick={() => handleSave('draft')}
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <FileText size={14} /> {t('حفظ كمسودة', 'Save as Draft')}
          </Button>
          <Button
            onClick={() => handleSave('sent')}
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <Send size={14} /> {t('إرسال', 'Send')}
          </Button>
        </div>
      </div>
    </div>
  );
}
