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

export const MOCK_JOURNAL_ENTRIES = [
  {
    id: 'je-001', entry_number: 'JE-2026-001', date: '2026-03-01', status: 'posted',
    description_ar: 'تسجيل عمولة من طلعت مصطفى — صفقة D-2026-009',
    description_en: 'Developer commission — Talaat Moustafa — Deal D-2026-009',
    reference: 'INV-2026-001',
    lines: [
      { account_id: 'acc-1210', code: '1210', name_ar: 'ذمم مدينة - مطورين', name_en: 'AR - Developers', debit: 114000, credit: 0 },
      { account_id: 'acc-4100', code: '4100', name_ar: 'إيرادات عمولات المطورين', name_en: 'Developer Commission Rev', debit: 0, credit: 114000 },
    ],
    total: 114000, created_by_ar: 'محمد المحاسب', created_by_en: 'Mohamed Accountant',
  },
  {
    id: 'je-002', entry_number: 'JE-2026-002', date: '2026-03-02', status: 'posted',
    description_ar: 'استحقاق عمولة أحمد محمود — صفقة D-2026-009',
    description_en: 'Agent commission accrual — Ahmed Mahmoud — Deal D-2026-009',
    reference: null,
    lines: [
      { account_id: 'acc-5700', code: '5700', name_ar: 'عمولات سيلز', name_en: 'Agent Commissions Exp', debit: 19000, credit: 0 },
      { account_id: 'acc-2200', code: '2200', name_ar: 'عمولات سيلز مستحقة', name_en: 'Agent Commissions Payable', debit: 0, credit: 19000 },
    ],
    total: 19000, created_by_ar: 'محمد المحاسب', created_by_en: 'Mohamed Accountant',
  },
  {
    id: 'je-003', entry_number: 'JE-2026-003', date: '2026-03-01', status: 'posted',
    description_ar: 'سداد إيجار مارس 2026',
    description_en: 'March 2026 rent payment',
    reference: 'EXP-2026-002',
    lines: [
      { account_id: 'acc-5200', code: '5200', name_ar: 'إيجار', name_en: 'Rent', debit: 45000, credit: 0 },
      { account_id: 'acc-1120', code: '1120', name_ar: 'بنك CIB', name_en: 'CIB Bank', debit: 0, credit: 45000 },
    ],
    total: 45000, created_by_ar: 'محمد المحاسب', created_by_en: 'Mohamed Accountant',
  },
  {
    id: 'je-004', entry_number: 'JE-2026-004', date: '2026-03-01', status: 'posted',
    description_ar: 'مصروف حملة فيسبوك — مشروع سيليا',
    description_en: 'Facebook campaign — Celia project',
    reference: 'EXP-2026-001',
    lines: [
      { account_id: 'acc-5310', code: '5310', name_ar: 'تسويق - فيسبوك', name_en: 'Marketing - Facebook', debit: 85000, credit: 0 },
      { account_id: 'acc-1120', code: '1120', name_ar: 'بنك CIB', name_en: 'CIB Bank', debit: 0, credit: 85000 },
    ],
    total: 85000, created_by_ar: 'محمد المحاسب', created_by_en: 'Mohamed Accountant',
  },
  {
    id: 'je-005', entry_number: 'JE-2026-005', date: '2026-03-03', status: 'posted',
    description_ar: 'مصروف حملة جوجل',
    description_en: 'Google Ads campaign',
    reference: 'EXP-2026-006',
    lines: [
      { account_id: 'acc-5320', code: '5320', name_ar: 'تسويق - جوجل', name_en: 'Marketing - Google', debit: 62000, credit: 0 },
      { account_id: 'acc-1120', code: '1120', name_ar: 'بنك CIB', name_en: 'CIB Bank', debit: 0, credit: 62000 },
    ],
    total: 62000, created_by_ar: 'محمد المحاسب', created_by_en: 'Mohamed Accountant',
  },
  {
    id: 'je-006', entry_number: 'JE-2026-006', date: '2026-03-05', status: 'posted',
    description_ar: 'تحصيل عمولة من ريبورتاج — صفقة D-2026-010',
    description_en: 'Commission collected — Reportage — Deal D-2026-010',
    reference: 'INV-2026-002',
    lines: [
      { account_id: 'acc-1120', code: '1120', name_ar: 'بنك CIB', name_en: 'CIB Bank', debit: 63000, credit: 0 },
      { account_id: 'acc-1210', code: '1210', name_ar: 'ذمم مدينة - مطورين', name_en: 'AR - Developers', debit: 0, credit: 63000 },
    ],
    total: 63000, created_by_ar: 'محمد المحاسب', created_by_en: 'Mohamed Accountant',
  },
  {
    id: 'je-007', entry_number: 'JE-2026-007', date: '2026-03-07', status: 'posted',
    description_ar: 'سداد رواتب مارس 2026',
    description_en: 'March 2026 salary payment',
    reference: null,
    lines: [
      { account_id: 'acc-5100', code: '5100', name_ar: 'رواتب وأجور', name_en: 'Salaries & Wages', debit: 387000, credit: 0 },
      { account_id: 'acc-1120', code: '1120', name_ar: 'بنك CIB', name_en: 'CIB Bank', debit: 0, credit: 387000 },
    ],
    total: 387000, created_by_ar: 'محمد المحاسب', created_by_en: 'Mohamed Accountant',
  },
  {
    id: 'je-008', entry_number: 'JE-2026-008', date: '2026-03-08', status: 'posted',
    description_ar: 'تسجيل عمولة من اورا — صفقة D-2025-045',
    description_en: 'Developer commission — ORA — Deal D-2025-045',
    reference: 'INV-2026-003',
    lines: [
      { account_id: 'acc-1210', code: '1210', name_ar: 'ذمم مدينة - مطورين', name_en: 'AR - Developers', debit: 82000, credit: 0 },
      { account_id: 'acc-4100', code: '4100', name_ar: 'إيرادات عمولات المطورين', name_en: 'Developer Commission Rev', debit: 0, credit: 82000 },
    ],
    total: 82000, created_by_ar: 'محمد المحاسب', created_by_en: 'Mohamed Accountant',
  },
  {
    id: 'je-009', entry_number: 'JE-2026-009', date: '2026-03-09', status: 'draft',
    description_ar: 'مصروفات مكتبية ومواصلات',
    description_en: 'Office supplies & transport',
    reference: null,
    lines: [
      { account_id: 'acc-5600', code: '5600', name_ar: 'أدوات مكتبية', name_en: 'Office Supplies', debit: 8500, credit: 0 },
      { account_id: 'acc-5400', code: '5400', name_ar: 'مواصلات ومعاينات', name_en: 'Transport & Visits', debit: 12000, credit: 0 },
      { account_id: 'acc-1110', code: '1110', name_ar: 'الصندوق (كاش)', name_en: 'Cash on Hand', debit: 0, credit: 20500 },
    ],
    total: 20500, created_by_ar: 'محمد المحاسب', created_by_en: 'Mohamed Accountant',
  },
  {
    id: 'je-010', entry_number: 'JE-2026-010', date: '2026-03-10', status: 'draft',
    description_ar: 'كهرباء ومياه مارس + اتصالات',
    description_en: 'March utilities + telecom',
    reference: null,
    lines: [
      { account_id: 'acc-5500', code: '5500', name_ar: 'كهرباء ومياه', name_en: 'Utilities', debit: 6800, credit: 0 },
      { account_id: 'acc-5800', code: '5800', name_ar: 'اتصالات وانترنت', name_en: 'Telecom & Internet', debit: 4500, credit: 0 },
      { account_id: 'acc-1110', code: '1110', name_ar: 'الصندوق (كاش)', name_en: 'Cash on Hand', debit: 0, credit: 11300 },
    ],
    total: 11300, created_by_ar: 'محمد المحاسب', created_by_en: 'Mohamed Accountant',
  },
];

// ── Invoices ─────────────────────────────────────────────────────────────

export const MOCK_INVOICES = [
  { id: 'inv-001', number: 'INV-2026-001', type: 'sales', date: '2026-03-01', due_date: '2026-03-31',
    counterparty_ar: 'طلعت مصطفى', counterparty_en: 'Talaat Moustafa', deal_ref: 'D-2026-009',
    items: [{ desc_ar: 'عمولة صفقة A-712 — سيليا', desc_en: 'Commission Deal A-712 — Celia', qty: 1, price: 114000, tax_rate: 0 }],
    subtotal: 114000, tax: 0, total: 114000, paid: 0, status: 'sent' },
  { id: 'inv-002', number: 'INV-2026-002', type: 'sales', date: '2026-03-03', due_date: '2026-04-03',
    counterparty_ar: 'ريبورتاج', counterparty_en: 'Reportage', deal_ref: 'D-2026-010',
    items: [{ desc_ar: 'عمولة صفقة B-108 — ريفان', desc_en: 'Commission Deal B-108 — Rivan', qty: 1, price: 63000, tax_rate: 0 }],
    subtotal: 63000, tax: 0, total: 63000, paid: 63000, status: 'paid' },
  { id: 'inv-003', number: 'INV-2026-003', type: 'sales', date: '2026-03-08', due_date: '2026-04-08',
    counterparty_ar: 'اورا', counterparty_en: 'ORA', deal_ref: 'D-2025-045',
    items: [{ desc_ar: 'عمولة صفقة TH-03 — تاون جيت', desc_en: 'Commission Deal TH-03 — Town Gate', qty: 1, price: 82000, tax_rate: 0 }],
    subtotal: 82000, tax: 0, total: 82000, paid: 0, status: 'sent' },
  { id: 'inv-004', number: 'INV-2026-004', type: 'sales', date: '2026-02-15', due_date: '2026-03-15',
    counterparty_ar: 'سيتي إيدج', counterparty_en: 'City Edge', deal_ref: 'D-2026-006',
    items: [{ desc_ar: 'عمولة صفقة D-105 — بلو تري', desc_en: 'Commission Deal D-105 — Blue Tree', qty: 1, price: 40500, tax_rate: 0 }],
    subtotal: 40500, tax: 0, total: 40500, paid: 0, status: 'overdue' },
  { id: 'inv-005', number: 'BILL-2026-001', type: 'purchase', date: '2026-03-01', due_date: '2026-03-15',
    counterparty_ar: 'Meta Ads', counterparty_en: 'Meta Ads', deal_ref: null,
    items: [{ desc_ar: 'حملة فيسبوك — مارس', desc_en: 'Facebook campaign — March', qty: 1, price: 85000, tax_rate: 0.14 }],
    subtotal: 85000, tax: 11900, total: 96900, paid: 96900, status: 'paid' },
  { id: 'inv-006', number: 'BILL-2026-002', type: 'purchase', date: '2026-03-05', due_date: '2026-03-20',
    counterparty_ar: 'Google Ads', counterparty_en: 'Google Ads', deal_ref: null,
    items: [{ desc_ar: 'حملة جوجل — مارس', desc_en: 'Google campaign — March', qty: 1, price: 62000, tax_rate: 0.14 }],
    subtotal: 62000, tax: 8680, total: 70680, paid: 0, status: 'sent' },
];

// ── Company Commissions (from developers) ────────────────────────────────

export const MOCK_COMPANY_COMMISSIONS = [
  { id: 'cc-001', developer_ar: 'طلعت مصطفى', developer_en: 'Talaat Moustafa', project_ar: 'سيليا العاصمة الادارية', project_en: 'Celia New Capital', deal_ref: 'D-2026-009', deal_value: 3800000, rate: 0.03, amount: 114000, status: 'approved', collected: false, date: '2026-03-01' },
  { id: 'cc-002', developer_ar: 'ريبورتاج',   developer_en: 'Reportage',       project_ar: 'ريفان الشيخ زايد',       project_en: 'Rivan Sheikh Zayed', deal_ref: 'D-2026-010', deal_value: 2100000, rate: 0.03, amount: 63000,  status: 'paid',     collected: true,  date: '2026-03-03' },
  { id: 'cc-003', developer_ar: 'اورا',        developer_en: 'ORA',             project_ar: 'تاون جيت 6 اكتوبر',     project_en: 'Town Gate October',  deal_ref: 'D-2025-045', deal_value: 4100000, rate: 0.02, amount: 82000,  status: 'approved', collected: false, date: '2026-03-08' },
  { id: 'cc-004', developer_ar: 'سيتي إيدج',   developer_en: 'City Edge',       project_ar: 'بلو تري المرج',          project_en: 'Blue Tree El Marg',  deal_ref: 'D-2026-006', deal_value: 1350000, rate: 0.03, amount: 40500,  status: 'pending',  collected: false, date: '2026-02-20' },
  { id: 'cc-005', developer_ar: 'طلعت مصطفى', developer_en: 'Talaat Moustafa', project_ar: 'سيليا العاصمة الادارية', project_en: 'Celia New Capital', deal_ref: 'D-2026-005', deal_value: 5500000, rate: 0.025, amount: 137500, status: 'pending',  collected: false, date: '2026-03-10' },
];

// ── Agent Commissions ────────────────────────────────────────────────────

export const MOCK_AGENT_COMMISSIONS = [
  { id: 'ac-001', agent_ar: 'أحمد محمود',  agent_en: 'Ahmed Mahmoud', deal_ref: 'D-2026-009', deal_value: 3800000, calc_method: 'per_million', rate: 5000,  amount: 19000,  status: 'pending',  date: '2026-03-02' },
  { id: 'ac-002', agent_ar: 'خالد عمر',   agent_en: 'Khaled Omar',   deal_ref: 'D-2026-010', deal_value: 2100000, calc_method: 'per_million', rate: 5000,  amount: 10500,  status: 'approved', date: '2026-03-03' },
  { id: 'ac-003', agent_ar: 'نورا احمد',  agent_en: 'Noura Ahmed',   deal_ref: 'D-2025-045', deal_value: 4100000, calc_method: 'per_million', rate: 5000,  amount: 20500,  status: 'paid',     date: '2026-02-15' },
  { id: 'ac-004', agent_ar: 'نورا احمد',  agent_en: 'Noura Ahmed',   deal_ref: 'D-2026-006', deal_value: 1350000, calc_method: 'percentage',  rate: 0.005, amount: 6750,   status: 'pending',  date: '2026-02-20' },
  { id: 'ac-005', agent_ar: 'محمود حسن',  agent_en: 'Mahmoud Hassan', deal_ref: 'D-2026-005', deal_value: 5500000, calc_method: 'per_million', rate: 5000,  amount: 27500,  status: 'pending',  date: '2026-03-10' },
  { id: 'ac-006', agent_ar: 'سارة علي',   agent_en: 'Sara Ali',      deal_ref: 'D-2026-007', deal_value: 1800000, calc_method: 'per_million', rate: 5000,  amount: 9000,   status: 'approved', date: '2026-02-18' },
];

// ── Expenses ─────────────────────────────────────────────────────────────

export const MOCK_EXPENSES = [
  { id: 'exp-001', number: 'EXP-2026-001', category: 'marketing_fb',    account_id: 'acc-5310', amount: 85000,  date: '2026-03-01', vendor_ar: 'Meta Ads',       vendor_en: 'Meta Ads',       desc_ar: 'حملة سيليا — مارس',         desc_en: 'Celia campaign — March',     status: 'paid',     method: 'bank_transfer', approved_by_ar: 'عمر المدير', approved_by_en: 'Omar Director' },
  { id: 'exp-002', number: 'EXP-2026-002', category: 'rent',            account_id: 'acc-5200', amount: 45000,  date: '2026-03-01', vendor_ar: 'مالك العقار',    vendor_en: 'Landlord',       desc_ar: 'إيجار مكتب مارس',            desc_en: 'Office rent March',          status: 'paid',     method: 'bank_transfer', approved_by_ar: 'عمر المدير', approved_by_en: 'Omar Director' },
  { id: 'exp-003', number: 'EXP-2026-003', category: 'transport',       account_id: 'acc-5400', amount: 12000,  date: '2026-03-03', vendor_ar: 'شركة الأسطول',   vendor_en: 'Fleet Co',       desc_ar: 'مواصلات معاينات أسبوع 1',    desc_en: 'Week 1 site visits',         status: 'approved', method: 'cash',          approved_by_ar: 'عمر المدير', approved_by_en: 'Omar Director' },
  { id: 'exp-004', number: 'EXP-2026-004', category: 'office',          account_id: 'acc-5600', amount: 8500,   date: '2026-03-04', vendor_ar: 'أوفيس مارت',     vendor_en: 'Office Mart',    desc_ar: 'أدوات مكتب وطباعة',          desc_en: 'Office supplies & printing', status: 'approved', method: 'cash',          approved_by_ar: 'عمر المدير', approved_by_en: 'Omar Director' },
  { id: 'exp-005', number: 'EXP-2026-005', category: 'utilities',       account_id: 'acc-5500', amount: 6800,   date: '2026-03-02', vendor_ar: 'شركة الكهرباء',  vendor_en: 'Electricity Co', desc_ar: 'فاتورة كهرباء مارس',         desc_en: 'March electricity bill',     status: 'paid',     method: 'bank_transfer', approved_by_ar: 'عمر المدير', approved_by_en: 'Omar Director' },
  { id: 'exp-006', number: 'EXP-2026-006', category: 'marketing_ggl',   account_id: 'acc-5320', amount: 62000,  date: '2026-03-05', vendor_ar: 'Google Ads',      vendor_en: 'Google Ads',     desc_ar: 'حملة جوجل — مارس',           desc_en: 'Google campaign — March',    status: 'pending',  method: 'bank_transfer', approved_by_ar: null,          approved_by_en: null },
  { id: 'exp-007', number: 'EXP-2026-007', category: 'telecom',         account_id: 'acc-5800', amount: 4500,   date: '2026-03-06', vendor_ar: 'فودافون',        vendor_en: 'Vodafone',       desc_ar: 'اتصالات وانترنت مارس',       desc_en: 'March telecom & internet',   status: 'pending',  method: 'bank_transfer', approved_by_ar: null,          approved_by_en: null },
  { id: 'exp-008', number: 'EXP-2026-008', category: 'marketing_other', account_id: 'acc-5330', amount: 15000,  date: '2026-03-08', vendor_ar: 'مطبعة النور',     vendor_en: 'Al Nour Print',  desc_ar: 'بروشورات + لافتات',           desc_en: 'Brochures + banners',        status: 'pending',  method: 'cash',          approved_by_ar: null,          approved_by_en: null },
];

// ── Monthly Revenue ──────────────────────────────────────────────────────

export const MONTHLY_REVENUE = [
  { month_ar: 'أكتوبر', month_en: 'Oct', revenue: 320000,  expenses: 280000 },
  { month_ar: 'نوفمبر', month_en: 'Nov', revenue: 410000,  expenses: 295000 },
  { month_ar: 'ديسمبر', month_en: 'Dec', revenue: 285000,  expenses: 310000 },
  { month_ar: 'يناير',  month_en: 'Jan', revenue: 520000,  expenses: 290000 },
  { month_ar: 'فبراير', month_en: 'Feb', revenue: 380000,  expenses: 305000 },
  { month_ar: 'مارس',   month_en: 'Mar', revenue: 437000,  expenses: 238800 },
];

// ── Budget ───────────────────────────────────────────────────────────────

export const MOCK_BUDGET = [
  { id: 'bud-01', account_id: 'acc-5100', cat_ar: 'رواتب',           cat_en: 'Salaries',    monthly: 390000, actual_ytd: 1124000, budget_ytd: 1170000 },
  { id: 'bud-02', account_id: 'acc-5200', cat_ar: 'إيجار',           cat_en: 'Rent',        monthly: 45000,  actual_ytd: 135000,  budget_ytd: 135000  },
  { id: 'bud-03', account_id: 'acc-5310', cat_ar: 'تسويق فيسبوك',    cat_en: 'FB Ads',      monthly: 80000,  actual_ytd: 255000,  budget_ytd: 240000  },
  { id: 'bud-04', account_id: 'acc-5320', cat_ar: 'تسويق جوجل',      cat_en: 'Google Ads',  monthly: 60000,  actual_ytd: 186000,  budget_ytd: 180000  },
  { id: 'bud-05', account_id: 'acc-5400', cat_ar: 'مواصلات',          cat_en: 'Transport',   monthly: 15000,  actual_ytd: 38000,   budget_ytd: 45000   },
  { id: 'bud-06', account_id: 'acc-5500', cat_ar: 'كهرباء ومياه',     cat_en: 'Utilities',   monthly: 7000,   actual_ytd: 20400,   budget_ytd: 21000   },
  { id: 'bud-07', account_id: 'acc-5700', cat_ar: 'عمولات سيلز',      cat_en: 'Agent Comm',  monthly: 50000,  actual_ytd: 93250,   budget_ytd: 150000  },
];

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
