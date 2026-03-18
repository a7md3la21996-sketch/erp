// ── Finance Module — Mock Data & Config ──────────────────────────────────

// ── Status Configs ──────────────────────────────────────────────────────

export const JOURNAL_STATUS = {
  draft:  { ar: 'مسودة', en: 'Draft',  color: '#6B8DB5' },
  posted: { ar: 'مرحّل', en: 'Posted', color: '#2B4C6F' },
  voided: { ar: 'ملغي',  en: 'Voided', color: '#EF4444' },
};

export const INVOICE_STATUS = {
  draft:          { ar: 'مسودة',     en: 'Draft',          color: '#8BA8C8' },
  sent:           { ar: 'مرسلة',     en: 'Sent',           color: '#6B8DB5' },
  partially_paid: { ar: 'مدفوع جزئي', en: 'Partially Paid', color: '#4A7AAB' },
  paid:           { ar: 'مدفوعة',    en: 'Paid',           color: '#2B4C6F' },
  overdue:        { ar: 'متأخرة',    en: 'Overdue',        color: '#EF4444' },
  cancelled:      { ar: 'ملغاة',     en: 'Cancelled',      color: '#EF4444' },
};

export const COMMISSION_STATUS = {
  pending:  { ar: 'معلق',   en: 'Pending',  color: '#6B8DB5' },
  approved: { ar: 'معتمد',  en: 'Approved', color: '#4A7AAB' },
  paid:     { ar: 'مصروف',  en: 'Paid',     color: '#2B4C6F' },
  rejected: { ar: 'مرفوض',  en: 'Rejected', color: '#EF4444' },
};

export const EXPENSE_STATUS = {
  pending:  { ar: 'معلق',   en: 'Pending',  color: '#6B8DB5' },
  approved: { ar: 'معتمد',  en: 'Approved', color: '#4A7AAB' },
  rejected: { ar: 'مرفوض',  en: 'Rejected', color: '#EF4444' },
  paid:     { ar: 'مدفوع',  en: 'Paid',     color: '#2B4C6F' },
};

export const ACCOUNT_TYPES = {
  asset:     { ar: 'أصول',          en: 'Assets',      color: '#4A7AAB', normal: 'debit'  },
  liability: { ar: 'خصوم',          en: 'Liabilities', color: '#6B8DB5', normal: 'credit' },
  equity:    { ar: 'حقوق ملكية',    en: 'Equity',      color: '#2B4C6F', normal: 'credit' },
  revenue:   { ar: 'إيرادات',       en: 'Revenue',     color: '#1B3347', normal: 'credit' },
  expense:   { ar: 'مصروفات',       en: 'Expenses',    color: '#EF4444', normal: 'debit'  },
};

export const EXPENSE_CATEGORIES = {
  marketing_fb:   { ar: 'تسويق - فيسبوك',  en: 'Marketing - Facebook' },
  marketing_ggl:  { ar: 'تسويق - جوجل',     en: 'Marketing - Google' },
  marketing_other:{ ar: 'تسويق - أخرى',     en: 'Marketing - Other' },
  rent:           { ar: 'إيجار',             en: 'Rent' },
  salaries:       { ar: 'رواتب',             en: 'Salaries' },
  transport:      { ar: 'مواصلات ومعاينات',  en: 'Transport & Visits' },
  utilities:      { ar: 'كهرباء ومياه',      en: 'Utilities' },
  office:         { ar: 'أدوات مكتب',        en: 'Office Supplies' },
  telecom:        { ar: 'اتصالات وانترنت',   en: 'Telecom & Internet' },
  other:          { ar: 'أخرى',              en: 'Other' },
};

export const PAYMENT_METHODS = {
  cash:          { ar: 'نقدي',        en: 'Cash' },
  bank_transfer: { ar: 'تحويل بنكي',  en: 'Bank Transfer' },
  check:         { ar: 'شيك',         en: 'Check' },
  card:          { ar: 'بطاقة',       en: 'Card' },
};

// ── Chart of Accounts ────────────────────────────────────────────────────

export const CHART_OF_ACCOUNTS = [
  // Assets
  { id: 'acc-1000', code: '1000', name_ar: 'الأصول',                    name_en: 'Assets',                   type: 'asset',     parent_id: null,       is_group: true  },
  { id: 'acc-1100', code: '1100', name_ar: 'النقدية والبنوك',           name_en: 'Cash & Banks',             type: 'asset',     parent_id: 'acc-1000', is_group: true  },
  { id: 'acc-1110', code: '1110', name_ar: 'الصندوق (كاش)',             name_en: 'Cash on Hand',             type: 'asset',     parent_id: 'acc-1100', is_group: false },
  { id: 'acc-1120', code: '1120', name_ar: 'بنك CIB',                   name_en: 'CIB Bank',                 type: 'asset',     parent_id: 'acc-1100', is_group: false },
  { id: 'acc-1130', code: '1130', name_ar: 'بنك NBE',                   name_en: 'NBE Bank',                 type: 'asset',     parent_id: 'acc-1100', is_group: false },
  { id: 'acc-1200', code: '1200', name_ar: 'ذمم مدينة',                 name_en: 'Accounts Receivable',      type: 'asset',     parent_id: 'acc-1000', is_group: true  },
  { id: 'acc-1210', code: '1210', name_ar: 'ذمم مدينة - مطورين',       name_en: 'AR - Developers',          type: 'asset',     parent_id: 'acc-1200', is_group: false },
  { id: 'acc-1300', code: '1300', name_ar: 'مصروفات مقدمة',             name_en: 'Prepaid Expenses',         type: 'asset',     parent_id: 'acc-1000', is_group: false },
  // Liabilities
  { id: 'acc-2000', code: '2000', name_ar: 'الخصوم',                    name_en: 'Liabilities',              type: 'liability', parent_id: null,       is_group: true  },
  { id: 'acc-2100', code: '2100', name_ar: 'ذمم دائنة',                 name_en: 'Accounts Payable',         type: 'liability', parent_id: 'acc-2000', is_group: false },
  { id: 'acc-2200', code: '2200', name_ar: 'عمولات سيلز مستحقة',       name_en: 'Agent Commissions Payable',type: 'liability', parent_id: 'acc-2000', is_group: false },
  { id: 'acc-2300', code: '2300', name_ar: 'ضرائب مستحقة',              name_en: 'Tax Payable',              type: 'liability', parent_id: 'acc-2000', is_group: false },
  { id: 'acc-2400', code: '2400', name_ar: 'مصروفات مستحقة',            name_en: 'Accrued Expenses',         type: 'liability', parent_id: 'acc-2000', is_group: false },
  // Equity
  { id: 'acc-3000', code: '3000', name_ar: 'حقوق الملكية',              name_en: 'Equity',                   type: 'equity',    parent_id: null,       is_group: true  },
  { id: 'acc-3100', code: '3100', name_ar: 'رأس المال',                 name_en: "Owner's Equity",           type: 'equity',    parent_id: 'acc-3000', is_group: false },
  { id: 'acc-3200', code: '3200', name_ar: 'أرباح محتجزة',              name_en: 'Retained Earnings',        type: 'equity',    parent_id: 'acc-3000', is_group: false },
  // Revenue
  { id: 'acc-4000', code: '4000', name_ar: 'الإيرادات',                  name_en: 'Revenue',                  type: 'revenue',   parent_id: null,       is_group: true  },
  { id: 'acc-4100', code: '4100', name_ar: 'إيرادات عمولات المطورين',    name_en: 'Developer Commission Rev', type: 'revenue',   parent_id: 'acc-4000', is_group: false },
  { id: 'acc-4200', code: '4200', name_ar: 'إيرادات أخرى',              name_en: 'Other Revenue',            type: 'revenue',   parent_id: 'acc-4000', is_group: false },
  // Expenses
  { id: 'acc-5000', code: '5000', name_ar: 'المصروفات',                  name_en: 'Expenses',                 type: 'expense',   parent_id: null,       is_group: true  },
  { id: 'acc-5100', code: '5100', name_ar: 'رواتب وأجور',               name_en: 'Salaries & Wages',         type: 'expense',   parent_id: 'acc-5000', is_group: false },
  { id: 'acc-5200', code: '5200', name_ar: 'إيجار',                     name_en: 'Rent',                     type: 'expense',   parent_id: 'acc-5000', is_group: false },
  { id: 'acc-5300', code: '5300', name_ar: 'تسويق وإعلانات',            name_en: 'Marketing & Advertising',  type: 'expense',   parent_id: 'acc-5000', is_group: true  },
  { id: 'acc-5310', code: '5310', name_ar: 'تسويق - فيسبوك',            name_en: 'Marketing - Facebook',     type: 'expense',   parent_id: 'acc-5300', is_group: false },
  { id: 'acc-5320', code: '5320', name_ar: 'تسويق - جوجل',              name_en: 'Marketing - Google',       type: 'expense',   parent_id: 'acc-5300', is_group: false },
  { id: 'acc-5330', code: '5330', name_ar: 'تسويق - أخرى',              name_en: 'Marketing - Other',        type: 'expense',   parent_id: 'acc-5300', is_group: false },
  { id: 'acc-5400', code: '5400', name_ar: 'مواصلات ومعاينات',           name_en: 'Transport & Visits',       type: 'expense',   parent_id: 'acc-5000', is_group: false },
  { id: 'acc-5500', code: '5500', name_ar: 'كهرباء ومياه',              name_en: 'Utilities',                type: 'expense',   parent_id: 'acc-5000', is_group: false },
  { id: 'acc-5600', code: '5600', name_ar: 'أدوات مكتبية',              name_en: 'Office Supplies',          type: 'expense',   parent_id: 'acc-5000', is_group: false },
  { id: 'acc-5700', code: '5700', name_ar: 'عمولات سيلز',               name_en: 'Agent Commissions Exp',    type: 'expense',   parent_id: 'acc-5000', is_group: false },
  { id: 'acc-5800', code: '5800', name_ar: 'اتصالات وانترنت',           name_en: 'Telecom & Internet',       type: 'expense',   parent_id: 'acc-5000', is_group: false },
  { id: 'acc-5900', code: '5900', name_ar: 'مصروفات عمومية',            name_en: 'General Expenses',         type: 'expense',   parent_id: 'acc-5000', is_group: false },
];

// ── Journal Entries ──────────────────────────────────────────────────────

export const MOCK_JOURNAL_ENTRIES = [];

// ── Invoices ─────────────────────────────────────────────────────────────

export const MOCK_INVOICES = [];

// ── Company Commissions (from developers) ────────────────────────────────

export const MOCK_COMPANY_COMMISSIONS = [];

// ── Agent Commissions ────────────────────────────────────────────────────

export const MOCK_AGENT_COMMISSIONS = [];

// ── Expenses ─────────────────────────────────────────────────────────────

export const MOCK_EXPENSES = [];

// ── Monthly Revenue ──────────────────────────────────────────────────────

export const MONTHLY_REVENUE = [];

// ── Budget ───────────────────────────────────────────────────────────────

export const MOCK_BUDGET = [];

// ── Helpers ──────────────────────────────────────────────────────────────

export const fmtMoney = (n) => {
  if (n == null) return '—';
  return n.toLocaleString('en-US') + ' EGP';
};

export const fmtShort = (n) => {
  if (!n && n !== 0) return '—';
  if (Math.abs(n) >= 1000000) return (n / 1000000).toFixed(1) + 'M';
  if (Math.abs(n) >= 1000) return (n / 1000).toFixed(0) + 'K';
  return n.toLocaleString('en-US');
};

export const calcAccountBalance = (entries, accountId) => {
  let balance = 0;
  entries.filter(e => e.status === 'posted').forEach(e => {
    e.lines.forEach(l => {
      if (l.account_id === accountId) {
        balance += l.debit - l.credit;
      }
    });
  });
  return balance;
};
