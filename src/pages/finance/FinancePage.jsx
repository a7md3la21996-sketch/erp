import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../contexts/ThemeContext';
import {
  BarChart2, DollarSign, Receipt, FileText, BookOpen, Wallet,
  Plus, Search, X, ChevronDown, ChevronRight,
  TrendingUp, TrendingDown, Target,
  Download, AlertTriangle, Clock, CheckCircle,
  Building2, PieChart, FolderTree, ClipboardList,
  ArrowUpRight, ArrowDownRight, Layers, Minus,
} from 'lucide-react';
import {
  JOURNAL_STATUS, INVOICE_STATUS, COMMISSION_STATUS, EXPENSE_STATUS,
  ACCOUNT_TYPES, EXPENSE_CATEGORIES, PAYMENT_METHODS,
  MOCK_COMPANY_COMMISSIONS, MOCK_AGENT_COMMISSIONS,
  MONTHLY_REVENUE, MOCK_BUDGET,
  fmtMoney, fmtShort, calcAccountBalance,
} from '../../data/finance_mock_data';
import {
  fetchJournalEntries as svcFetchJournalEntries,
  createJournalEntry as svcCreateJournalEntry,
  fetchInvoices as svcFetchInvoices,
  createInvoice as svcCreateInvoice,
  updateInvoiceStatus as svcUpdateInvoiceStatus,
  fetchExpenses as svcFetchExpenses,
  createExpense as svcCreateExpense,
  fetchChartOfAccounts as svcFetchChartOfAccounts,
} from '../../services/financeService';
import { Button, Card, CardHeader, CardBody, Input, Select, Badge, Modal, ModalFooter, Table, Th, Td, Tr, KpiCard, ExportButton, FilterPill } from '../../components/ui';


/* ── Shared sub-components ──────────────────────────────────────────────── */

function StatusBadge({ label, color }) {
  return <Badge color={color} size="sm" className="rounded-full" style={{ border: `1px solid ${color}35` }}>{label}</Badge>;
}

function AddBtn({ label, onClick }) {
  return (
    <Button variant="primary" size="sm" onClick={onClick}>
      <Plus size={14} />{label}
    </Button>
  );
}

function SearchBox({ value, onChange, placeholder }) {
  return (
    <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-edge dark:border-edge-dark bg-surface-input dark:bg-surface-input-dark">
      <Search size={13} className="text-content-muted dark:text-content-muted-dark" />
      <input
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="border-none outline-none bg-transparent text-xs text-content dark:text-content-dark w-[140px]"
      />
    </div>
  );
}

function Empty({ icon: Icon, title, sub }) {
  return (
    <tr>
      <td colSpan={99} className="text-center py-16 px-5">
        <div className="w-16 h-16 rounded-2xl bg-brand-500/10 flex items-center justify-center mx-auto mb-4">
          <Icon size={24} className="text-brand-500" />
        </div>
        <p className="m-0 mb-1.5 text-sm font-bold text-content dark:text-content-dark">{title}</p>
        <p className="m-0 text-xs text-content-muted dark:text-content-muted-dark">{sub}</p>
      </td>
    </tr>
  );
}

function CardWrap({ title, icon: Icon, headerRight, children }) {
  return (
    <Card className="overflow-hidden">
      <div className="flex justify-between items-center px-5 py-3.5 border-b border-edge dark:border-edge-dark">
        <div className="flex items-center gap-2">
          {Icon && <Icon size={16} className="text-brand-500" />}
          <span className="text-sm font-bold text-content dark:text-content-dark">{title}</span>
        </div>
        {headerRight}
      </div>
      <div>{children}</div>
    </Card>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   ADD JOURNAL ENTRY MODAL (proper component — hooks safe)
   ═══════════════════════════════════════════════════════════════════════════ */

function AddJournalModal({ L, onClose, onSave, entryCount, chartOfAccounts }) {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [desc, setDesc] = useState('');
  const [ref, setRef] = useState('');
  const [lines, setLines] = useState([
    { account_id: '', debit: '', credit: '' },
    { account_id: '', debit: '', credit: '' },
  ]);

  const leafAccounts = (chartOfAccounts || []).filter(a => !a.is_group);
  const totalDebit = lines.reduce((s, l) => s + (Number(l.debit) || 0), 0);
  const totalCredit = lines.reduce((s, l) => s + (Number(l.credit) || 0), 0);
  const balanced = totalDebit > 0 && totalDebit === totalCredit;

  const addLine = () => setLines(prev => [...prev, { account_id: '', debit: '', credit: '' }]);
  const updateLine = (idx, field, val) => setLines(prev => prev.map((l, i) => i === idx ? { ...l, [field]: val } : l));
  const removeLine = (idx) => { if (lines.length <= 2) return; setLines(prev => prev.filter((_, i) => i !== idx)); };

  const handleSave = () => {
    if (!balanced || !desc) return;
    onSave({
      id: 'je-' + Date.now(),
      entry_number: 'JE-2026-' + String(entryCount + 1).padStart(3, '0'),
      date, status: 'draft', description_ar: desc, description_en: desc, reference: ref || null,
      lines: lines.filter(l => l.account_id && (Number(l.debit) > 0 || Number(l.credit) > 0)).map(l => {
        const acc = leafAccounts.find(a => a.id === l.account_id);
        return { account_id: l.account_id, code: acc?.code || '', name_ar: acc?.name_ar || '', name_en: acc?.name_en || '', debit: Number(l.debit) || 0, credit: Number(l.credit) || 0 };
      }),
      total: totalDebit, created_by_ar: 'المستخدم الحالي', created_by_en: 'Current User',
    });
  };

  return (
    <Modal open={true} onClose={onClose} title={L('قيد يومية جديد', 'New Journal Entry')} width="max-w-2xl">
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div>
          <label className="text-xs text-content-muted dark:text-content-muted-dark mb-1 block">{L('التاريخ', 'Date')}</label>
          <Input type="date" size="sm" value={date} onChange={e => setDate(e.target.value)} />
        </div>
        <div>
          <label className="text-xs text-content-muted dark:text-content-muted-dark mb-1 block">{L('المرجع', 'Reference')}</label>
          <Input size="sm" value={ref} onChange={e => setRef(e.target.value)} placeholder={L('اختياري', 'Optional')} />
        </div>
        <div className="col-span-full">
          <label className="text-xs text-content-muted dark:text-content-muted-dark mb-1 block">{L('الوصف', 'Description')} *</label>
          <Input size="sm" value={desc} onChange={e => setDesc(e.target.value)} placeholder={L('وصف القيد...', 'Entry description...')} />
        </div>
      </div>
      <div className="text-xs font-bold text-content dark:text-content-dark mb-2">{L('بنود القيد', 'Entry Lines')}</div>
      <div className="border border-edge dark:border-edge-dark rounded-xl overflow-hidden mb-3">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-surface-bg dark:bg-brand-500/[0.08]">
              <Th>{L('الحساب', 'Account')}</Th>
              <Th>{L('مدين', 'Debit')}</Th>
              <Th>{L('دائن', 'Credit')}</Th>
              <th className="w-9" />
            </tr>
          </thead>
          <tbody>
            {lines.map((l, i) => (
              <tr key={i} className="border-b border-edge dark:border-edge-dark">
                <td className="p-1.5 px-2">
                  <Select size="sm" value={l.account_id} onChange={e => updateLine(i, 'account_id', e.target.value)}>
                    <option value="">{L('اختر حساب...', 'Select account...')}</option>
                    {leafAccounts.map(a => <option key={a.id} value={a.id}>{a.code} — {L(a.name_ar, a.name_en)}</option>)}
                  </Select>
                </td>
                <td className="p-1.5 px-2">
                  <Input type="number" size="sm" value={l.debit} onChange={e => updateLine(i, 'debit', e.target.value)} placeholder="0" className="w-[100px]" />
                </td>
                <td className="p-1.5 px-2">
                  <Input type="number" size="sm" value={l.credit} onChange={e => updateLine(i, 'credit', e.target.value)} placeholder="0" className="w-[100px]" />
                </td>
                <td className="p-1.5 px-1">
                  {lines.length > 2 && (
                    <button onClick={() => removeLine(i)} className="w-7 h-7 rounded-md border-none bg-red-500/10 cursor-pointer flex items-center justify-center">
                      <X size={12} className="text-red-500" />
                    </button>
                  )}
                </td>
              </tr>
            ))}
            <tr className="bg-surface-bg dark:bg-brand-500/[0.08]">
              <td className="px-3 py-2 text-xs font-bold text-content dark:text-content-dark">{L('الإجمالي', 'Total')}</td>
              <td className="px-3 py-2 text-xs font-bold text-brand-800">{fmtMoney(totalDebit)}</td>
              <td className="px-3 py-2 text-xs font-bold text-red-500">{fmtMoney(totalCredit)}</td>
              <td />
            </tr>
          </tbody>
        </table>
      </div>
      <button onClick={addLine} className="px-3.5 py-1.5 rounded-md border border-dashed border-edge dark:border-edge-dark bg-transparent text-brand-500 text-xs cursor-pointer font-semibold mb-3">
        + {L('إضافة سطر', 'Add Line')}
      </button>
      <div className={`flex items-center gap-2 px-3 py-2 rounded-lg mb-4 ${balanced ? 'bg-brand-800/[0.08]' : totalDebit > 0 ? 'bg-red-500/[0.08]' : 'bg-transparent'}`}>
        {totalDebit > 0 && (balanced
          ? <><CheckCircle size={14} className="text-brand-800" /><span className="text-xs font-semibold text-brand-800">{L('القيد متوازن ✓', 'Balanced ✓')}</span></>
          : <><AlertTriangle size={14} className="text-red-500" /><span className="text-xs font-semibold text-red-500">{L('الفرق: ', 'Diff: ')}{fmtMoney(Math.abs(totalDebit - totalCredit))}</span></>
        )}
      </div>
      <ModalFooter className="justify-end">
        <Button variant="secondary" size="sm" onClick={onClose}>{L('إلغاء', 'Cancel')}</Button>
        <Button variant="primary" size="sm" onClick={handleSave} disabled={!balanced || !desc}>{L('حفظ كمسودة', 'Save as Draft')}</Button>
      </ModalFooter>
    </Modal>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   ADD EXPENSE MODAL (proper component — hooks safe)
   ═══════════════════════════════════════════════════════════════════════════ */

function AddExpenseModal({ L, onClose, onSave, expCount }) {
  const [cat, setCat] = useState('');
  const [vendor, setVendor] = useState('');
  const [amount, setAmount] = useState('');
  const [descVal, setDescVal] = useState('');
  const [method, setMethod] = useState('cash');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));

  const valid = cat && vendor && Number(amount) > 0;

  const handleSave = () => {
    if (!valid) return;
    onSave({
      id: 'exp-' + Date.now(),
      number: 'EXP-2026-' + String(expCount + 1).padStart(3, '0'),
      category: cat, account_id: 'acc-5900', amount: Number(amount), date,
      vendor_ar: vendor, vendor_en: vendor, desc_ar: descVal, desc_en: descVal,
      status: 'pending', method, approved_by_ar: null, approved_by_en: null,
    });
  };

  return (
    <Modal open={true} onClose={onClose} title={L('مصروف جديد', 'New Expense')} width="max-w-lg">
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div>
          <label className="text-xs text-content-muted dark:text-content-muted-dark mb-1 block">{L('الفئة', 'Category')} *</label>
          <Select size="sm" value={cat} onChange={e => setCat(e.target.value)}>
            <option value="">{L('اختر...', 'Select...')}</option>
            {Object.entries(EXPENSE_CATEGORIES).map(([k, v]) => <option key={k} value={k}>{L(v.ar, v.en)}</option>)}
          </Select>
        </div>
        <div>
          <label className="text-xs text-content-muted dark:text-content-muted-dark mb-1 block">{L('طريقة الدفع', 'Payment Method')}</label>
          <Select size="sm" value={method} onChange={e => setMethod(e.target.value)}>
            {Object.entries(PAYMENT_METHODS).map(([k, v]) => <option key={k} value={k}>{L(v.ar, v.en)}</option>)}
          </Select>
        </div>
        <div>
          <label className="text-xs text-content-muted dark:text-content-muted-dark mb-1 block">{L('المورد', 'Vendor')} *</label>
          <Input size="sm" value={vendor} onChange={e => setVendor(e.target.value)} placeholder={L('اسم المورد...', 'Vendor name...')} />
        </div>
        <div>
          <label className="text-xs text-content-muted dark:text-content-muted-dark mb-1 block">{L('المبلغ', 'Amount')} *</label>
          <Input type="number" size="sm" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0" />
        </div>
        <div>
          <label className="text-xs text-content-muted dark:text-content-muted-dark mb-1 block">{L('التاريخ', 'Date')}</label>
          <Input type="date" size="sm" value={date} onChange={e => setDate(e.target.value)} />
        </div>
        <div>
          <label className="text-xs text-content-muted dark:text-content-muted-dark mb-1 block">{L('الوصف', 'Description')}</label>
          <Input size="sm" value={descVal} onChange={e => setDescVal(e.target.value)} placeholder={L('تفاصيل...', 'Details...')} />
        </div>
      </div>
      <ModalFooter className="justify-end">
        <Button variant="secondary" size="sm" onClick={onClose}>{L('إلغاء', 'Cancel')}</Button>
        <Button variant="primary" size="sm" onClick={handleSave} disabled={!valid}>{L('حفظ', 'Save')}</Button>
      </ModalFooter>
    </Modal>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   TABS CONFIG
   ═══════════════════════════════════════════════════════════════════════════ */

const TABS = [
  { id: 'overview',  ar: 'نظرة عامة',      en: 'Overview',          Icon: BarChart2   },
  { id: 'coa',       ar: 'دليل الحسابات',   en: 'Chart of Accounts', Icon: FolderTree  },
  { id: 'journal',   ar: 'القيود اليومية',   en: 'Journal Entries',   Icon: BookOpen    },
  { id: 'invoices',  ar: 'الفواتير',         en: 'Invoices',          Icon: FileText    },
  { id: 'commissions', ar: 'العمولات',       en: 'Commissions',       Icon: DollarSign  },
  { id: 'expenses',  ar: 'المصروفات',        en: 'Expenses',          Icon: Receipt     },
  { id: 'reports',   ar: 'التقارير المالية',  en: 'Reports',           Icon: ClipboardList },
  { id: 'budget',    ar: 'الموازنة',          en: 'Budget',            Icon: Target      },
];

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN PAGE
   ═══════════════════════════════════════════════════════════════════════════ */

export default function FinancePage() {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const { i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const L = (ar, en) => isRTL ? ar : en;

  const [activeTab, setActiveTab] = useState('overview');

  // State — initialised empty, populated from Supabase (or mock fallback) on mount
  const [journalEntries, setJournalEntries] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [companyComm, setCompanyComm] = useState(MOCK_COMPANY_COMMISSIONS);
  const [agentComm, setAgentComm] = useState(MOCK_AGENT_COMMISSIONS);
  const [expenses, setExpenses] = useState([]);
  const [chartOfAccounts, setChartOfAccounts] = useState([]);

  // Fetch data on mount via service layer (falls back to mock inside services)
  useEffect(() => {
    svcFetchJournalEntries().then(setJournalEntries);
    svcFetchInvoices().then(setInvoices);
    svcFetchExpenses().then(setExpenses);
    svcFetchChartOfAccounts().then(setChartOfAccounts);
  }, []);

  // Filters
  const [journalFilter, setJournalFilter] = useState('all');
  const [journalSearch, setJournalSearch] = useState('');
  const [invoiceFilter, setInvoiceFilter] = useState('all');
  const [invoiceType, setInvoiceType] = useState('all');
  const [commTab, setCommTab] = useState('company');
  const [commFilter, setCommFilter] = useState('all');
  const [expFilter, setExpFilter] = useState('all');
  const [expSearch, setExpSearch] = useState('');

  // Modals
  const [showJournalModal, setShowJournalModal] = useState(false);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [viewJournal, setViewJournal] = useState(null);
  const [viewInvoice, setViewInvoice] = useState(null);

  // COA state
  const [coaExpanded, setCoaExpanded] = useState({ 'acc-1000': true, 'acc-2000': true, 'acc-3000': true, 'acc-4000': true, 'acc-5000': true });

  // Reports state
  const [reportView, setReportView] = useState('balance_sheet');

  // Budget state
  const [budgetData, setBudgetData] = useState(MOCK_BUDGET);

  // ── Derived data ────────────────────────────────────────────────────────

  const postedEntries = useMemo(() => journalEntries.filter(e => e.status === 'posted'), [journalEntries]);

  const totalRevenue = useMemo(() => {
    let t = 0;
    postedEntries.forEach(e => e.lines.forEach(l => { if (l.account_id === 'acc-4100' || l.account_id === 'acc-4200') t += l.credit - l.debit; }));
    return t;
  }, [postedEntries]);

  const totalExpenseAmt = useMemo(() => expenses.reduce((s, e) => s + e.amount, 0), [expenses]);
  const pendingExpenses = useMemo(() => expenses.filter(e => e.status === 'pending'), [expenses]);

  const receivable = useMemo(() => calcAccountBalance(journalEntries, 'acc-1210'), [journalEntries]);
  const payable = useMemo(() => -calcAccountBalance(journalEntries, 'acc-2200'), [journalEntries]);

  const maxRevenue = useMemo(() => Math.max(...MONTHLY_REVENUE.map(m => m.revenue)), []);

  /* ═══════════════════════════════════════════════════════════════════════
     TAB 1 — OVERVIEW
     ═══════════════════════════════════════════════════════════════════════ */

  const renderOverview = () => (
    <div className="flex flex-col gap-4">
      {/* KPI Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
        <KpiCard icon={TrendingUp} label={L('إيرادات الشهر', 'Monthly Revenue')} value={fmtShort(totalRevenue)} sub="EGP" color="#4A7AAB" />
        <KpiCard icon={TrendingDown} label={L('إجمالي المصروفات', 'Total Expenses')} value={fmtShort(totalExpenseAmt)} sub="EGP" color="#EF4444" />
        <KpiCard icon={DollarSign} label={L('ذمم مدينة (مطورين)', 'Receivable (Devs)')} value={fmtShort(receivable)} sub="EGP" color="#2B4C6F" />
        <KpiCard icon={Wallet} label={L('عمولات سيلز مستحقة', 'Agent Comm. Payable')} value={fmtShort(payable)} sub="EGP" color="#6B8DB5" />
      </div>

      {/* Revenue Chart + Expense Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-[1.6fr_1fr] gap-4">
        {/* Bar Chart */}
        <CardWrap title={L('الإيرادات مقابل المصروفات', 'Revenue vs Expenses')} icon={BarChart2}>
          <div className="px-5 py-4">
            <div className="flex items-end gap-2.5 h-[140px] pb-2">
              {MONTHLY_REVENUE.map((m, i) => {
                const revH = Math.round((m.revenue / maxRevenue) * 120);
                const expH = Math.round((m.expenses / maxRevenue) * 120);
                const isLast = i === MONTHLY_REVENUE.length - 1;
                return (
                  <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
                    <div className="flex items-end gap-0.5 h-[120px]">
                      <div
                        className="w-[40%] rounded-t-sm transition-[height] duration-[400ms]"
                        style={{ height: revH, background: isLast ? '#4A7AAB' : '#4A7AAB60' }}
                        title={fmtMoney(m.revenue)}
                      />
                      <div
                        className="w-[40%] rounded-t-sm transition-[height] duration-[400ms]"
                        style={{ height: expH, background: isLast ? '#EF4444' : '#EF444440' }}
                        title={fmtMoney(m.expenses)}
                      />
                    </div>
                    <span className="text-[10px] text-content-muted dark:text-content-muted-dark">{L(m.month_ar, m.month_en)}</span>
                  </div>
                );
              })}
            </div>
            <div className="flex gap-4 mt-2 justify-center">
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-sm bg-brand-500" />
                <span className="text-xs text-content-muted dark:text-content-muted-dark">{L('الإيرادات', 'Revenue')}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-sm bg-red-500" />
                <span className="text-xs text-content-muted dark:text-content-muted-dark">{L('المصروفات', 'Expenses')}</span>
              </div>
            </div>
          </div>
        </CardWrap>

        {/* Budget vs Actual */}
        <CardWrap title={L('الموازنة مقابل الفعلي', 'Budget vs Actual')} icon={PieChart}>
          <div className="px-5 py-3">
            {MOCK_BUDGET.slice(0, 5).map((b, i) => {
              const pct = b.budget_ytd ? Math.round((b.actual_ytd / b.budget_ytd) * 100) : 0;
              const over = pct > 100;
              return (
                <div key={b.id} className="mb-2.5">
                  <div className="flex justify-between mb-0.5">
                    <span className="text-xs text-content dark:text-content-dark">{L(b.cat_ar, b.cat_en)}</span>
                    <span className={`text-xs font-semibold ${over ? 'text-red-500' : 'text-content-muted dark:text-content-muted-dark'}`}>{pct}%</span>
                  </div>
                  <div className="h-[5px] rounded-sm bg-gray-200 dark:bg-white/[0.08]">
                    <div
                      className="h-full rounded-sm transition-[width] duration-[400ms]"
                      style={{ width: Math.min(pct, 100) + '%', background: over ? '#EF4444' : '#4A7AAB' }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </CardWrap>
      </div>

      {/* Commission + Invoice Quick Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Company Commissions Summary */}
        <CardWrap title={L('ملخص عمولات المطورين', 'Developer Commission Summary')} icon={Building2}>
          <div className="px-5 py-3">
            {[
              { label: L('معلق', 'Pending'), val: companyComm.filter(c => c.status === 'pending').reduce((s, c) => s + c.amount, 0), color: '#6B8DB5' },
              { label: L('معتمد', 'Approved'), val: companyComm.filter(c => c.status === 'approved').reduce((s, c) => s + c.amount, 0), color: '#4A7AAB' },
              { label: L('محصّل', 'Collected'), val: companyComm.filter(c => c.status === 'paid').reduce((s, c) => s + c.amount, 0), color: '#2B4C6F' },
            ].map((row, i) => (
              <div key={i} className={`flex justify-between items-center py-2 ${i < 2 ? 'border-b border-edge dark:border-edge-dark' : ''}`}>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full" style={{ background: row.color }} />
                  <span className="text-xs text-content-muted dark:text-content-muted-dark">{row.label}</span>
                </div>
                <span className="text-sm font-bold" style={{ color: row.color }}>{fmtMoney(row.val)}</span>
              </div>
            ))}
          </div>
        </CardWrap>

        {/* Overdue Invoices */}
        <CardWrap title={L('فواتير تحتاج متابعة', 'Invoices Needing Attention')} icon={AlertTriangle}>
          <div className="px-5 py-3">
            {invoices.filter(inv => inv.status === 'overdue' || inv.status === 'sent').slice(0, 4).map((inv, i) => (
              <div key={inv.id} className={`flex justify-between items-center py-2 ${i < 3 ? 'border-b border-edge dark:border-edge-dark' : ''}`}>
                <div>
                  <div className="text-xs text-content dark:text-content-dark font-medium">{L(inv.counterparty_ar, inv.counterparty_en)}</div>
                  <div className="text-xs text-content-muted dark:text-content-muted-dark">{inv.number}</div>
                </div>
                <div className="text-end">
                  <div className="text-xs font-bold text-content dark:text-content-dark">{fmtMoney(inv.total - inv.paid)}</div>
                  <StatusBadge label={L(INVOICE_STATUS[inv.status].ar, INVOICE_STATUS[inv.status].en)} color={INVOICE_STATUS[inv.status].color} />
                </div>
              </div>
            ))}
          </div>
        </CardWrap>
      </div>
    </div>
  );

  /* ═══════════════════════════════════════════════════════════════════════
     TAB 2 — CHART OF ACCOUNTS
     ═══════════════════════════════════════════════════════════════════════ */

  const renderCOA = () => {
    const toggleExpand = (id) => setCoaExpanded(prev => ({ ...prev, [id]: !prev[id] }));

    const renderRow = (acc, level) => {
      const children = chartOfAccounts.filter(a => a.parent_id === acc.id);
      const hasChildren = children.length > 0;
      const expanded = coaExpanded[acc.id];
      const typeInfo = ACCOUNT_TYPES[acc.type];
      const balance = !acc.is_group ? calcAccountBalance(journalEntries, acc.id) : null;

      return [
        <Tr key={acc.id} onClick={hasChildren ? () => toggleExpand(acc.id) : undefined} className={hasChildren ? 'cursor-pointer' : ''}>
          <Td style={{ paddingInlineStart: 12 + level * 24 }}>
            <div className="flex items-center gap-1.5">
              {hasChildren ? (
                expanded ? <ChevronDown size={14} className="text-content-muted dark:text-content-muted-dark" /> : <ChevronRight size={14} className={`text-content-muted dark:text-content-muted-dark ${isRTL ? 'rotate-180' : ''}`} />
              ) : <div className="w-3.5" />}
              <span className={acc.is_group ? 'font-bold' : ''}>
                {L(acc.name_ar, acc.name_en)}
              </span>
            </div>
          </Td>
          <Td className="font-bold text-content-muted dark:text-content-muted-dark">{acc.code}</Td>
          <Td><StatusBadge label={L(typeInfo.ar, typeInfo.en)} color={typeInfo.color} /></Td>
          <Td className={`font-bold ${balance !== null && balance !== 0 ? (balance > 0 ? 'text-brand-800' : 'text-red-500') : 'text-content-muted dark:text-content-muted-dark'}`}>
            {balance !== null ? fmtMoney(Math.abs(balance)) : '—'}
          </Td>
          <Td className="text-content-muted dark:text-content-muted-dark">{balance !== null ? L(typeInfo.normal === 'debit' ? (balance >= 0 ? 'مدين' : 'دائن') : (balance <= 0 ? 'دائن' : 'مدين'), typeInfo.normal === 'debit' ? (balance >= 0 ? 'Dr' : 'Cr') : (balance <= 0 ? 'Cr' : 'Dr')) : '—'}</Td>
        </Tr>,
        ...(hasChildren && expanded ? children.flatMap(child => renderRow(child, level + 1)) : []),
      ];
    };

    const rootAccounts = chartOfAccounts.filter(a => a.parent_id === null);

    return (
      <div className="flex flex-col gap-4">
        {/* KPIs per account type */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {Object.entries(ACCOUNT_TYPES).map(([key, info]) => {
            const count = chartOfAccounts.filter(a => a.type === key && !a.is_group).length;
            return <KpiCard key={key} icon={FolderTree} label={L(info.ar, info.en)} value={count} sub={L('حساب', 'accounts')} color={info.color} />;
          })}
        </div>

        <CardWrap title={L('شجرة الحسابات', 'Chart of Accounts')} icon={FolderTree}
          headerRight={<AddBtn label={L('حساب جديد', 'New Account')} />}>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <Th>{L('الحساب', 'Account')}</Th>
                  <Th>{L('الكود', 'Code')}</Th>
                  <Th>{L('النوع', 'Type')}</Th>
                  <Th>{L('الرصيد', 'Balance')}</Th>
                  <Th>{L('الطبيعة', 'Side')}</Th>
                </tr>
              </thead>
              <tbody>
                {rootAccounts.flatMap(acc => renderRow(acc, 0))}
              </tbody>
            </table>
          </div>
        </CardWrap>
      </div>
    );
  };

  /* ═══════════════════════════════════════════════════════════════════════
     TAB 3 — JOURNAL ENTRIES
     ═══════════════════════════════════════════════════════════════════════ */

  const renderJournal = () => {
    let filtered = journalEntries;
    if (journalFilter !== 'all') filtered = filtered.filter(e => e.status === journalFilter);
    if (journalSearch) {
      const q = journalSearch.toLowerCase();
      filtered = filtered.filter(e =>
        e.entry_number.toLowerCase().includes(q) ||
        (isRTL ? e.description_ar : e.description_en).toLowerCase().includes(q)
      );
    }

    const totalPosted = postedEntries.reduce((s, e) => s + e.total, 0);
    const draftCount = journalEntries.filter(e => e.status === 'draft').length;

    return (
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
          <KpiCard icon={BookOpen} label={L('إجمالي القيود', 'Total Entries')} value={journalEntries.length} color="#4A7AAB" />
          <KpiCard icon={CheckCircle} label={L('مرحّلة', 'Posted')} value={postedEntries.length} color="#2B4C6F" />
          <KpiCard icon={Clock} label={L('مسودات', 'Drafts')} value={draftCount} color="#6B8DB5" />
          <KpiCard icon={DollarSign} label={L('إجمالي المبالغ المرحّلة', 'Total Posted Amount')} value={fmtShort(totalPosted)} sub="EGP" color="#1B3347" />
        </div>

        <CardWrap title={L('القيود اليومية', 'Journal Entries')} icon={BookOpen}
          headerRight={
            <div className="flex gap-2 items-center">
              <SearchBox value={journalSearch} onChange={setJournalSearch} placeholder={L('بحث...', 'Search...')} />
              <AddBtn label={L('قيد جديد', 'New Entry')} onClick={() => setShowJournalModal(true)} />
            </div>
          }>
          {/* Filter pills */}
          <div className="flex gap-1.5 px-5 py-3 border-b border-edge dark:border-edge-dark">
            {[
              { id: 'all', label: L('الكل', 'All') },
              { id: 'posted', label: L('مرحّل', 'Posted') },
              { id: 'draft', label: L('مسودة', 'Draft') },
              { id: 'voided', label: L('ملغي', 'Voided') },
            ].map(f => <FilterPill key={f.id} label={f.label} active={journalFilter === f.id} onClick={() => setJournalFilter(f.id)} />)}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead><tr>
                <Th>{L('رقم القيد', 'Entry #')}</Th>
                <Th>{L('التاريخ', 'Date')}</Th>
                <Th>{L('الوصف', 'Description')}</Th>
                <Th>{L('المرجع', 'Reference')}</Th>
                <Th>{L('المبلغ', 'Amount')}</Th>
                <Th>{L('الحالة', 'Status')}</Th>
                <Th>{L('إجراء', 'Action')}</Th>
              </tr></thead>
              <tbody>
                {filtered.length === 0
                  ? <Empty icon={BookOpen} title={L('لا توجد قيود', 'No Entries')} sub={L('لم يتم تسجيل أي قيود بعد', 'No journal entries found')} />
                  : filtered.map(entry => {
                    const st = JOURNAL_STATUS[entry.status];
                    return (
                      <Tr key={entry.id} onClick={() => setViewJournal(entry)} className="cursor-pointer">
                        <Td className="font-bold text-brand-500">{entry.entry_number}</Td>
                        <Td className="text-content-muted dark:text-content-muted-dark">{entry.date}</Td>
                        <Td>{L(entry.description_ar, entry.description_en)}</Td>
                        <Td className="text-content-muted dark:text-content-muted-dark">{entry.reference || '—'}</Td>
                        <Td className="font-bold">{fmtMoney(entry.total)}</Td>
                        <Td><StatusBadge label={L(st.ar, st.en)} color={st.color} /></Td>
                        <Td>
                          {entry.status === 'draft' && (
                            <div className="flex gap-1.5">
                              <button onClick={e => { e.stopPropagation(); setJournalEntries(prev => prev.map(je => je.id === entry.id ? { ...je, status: 'posted' } : je)); }}
                                className="px-2.5 py-0.5 rounded-md border-none bg-brand-800 text-white text-xs font-semibold cursor-pointer">
                                {L('ترحيل', 'Post')}
                              </button>
                            </div>
                          )}
                        </Td>
                      </Tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </CardWrap>
      </div>
    );
  };

  /* ═══════════════════════════════════════════════════════════════════════
     TAB 4 — INVOICES
     ═══════════════════════════════════════════════════════════════════════ */

  const renderInvoices = () => {
    let filtered = invoices;
    if (invoiceType !== 'all') filtered = filtered.filter(inv => inv.type === invoiceType);
    if (invoiceFilter !== 'all') filtered = filtered.filter(inv => inv.status === invoiceFilter);

    const salesTotal = invoices.filter(i => i.type === 'sales').reduce((s, i) => s + i.total, 0);
    const purchaseTotal = invoices.filter(i => i.type === 'purchase').reduce((s, i) => s + i.total, 0);
    const overdueTotal = invoices.filter(i => i.status === 'overdue').reduce((s, i) => s + (i.total - i.paid), 0);
    const taxTotal = invoices.reduce((s, i) => s + i.tax, 0);

    return (
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
          <KpiCard icon={TrendingUp} label={L('فواتير بيع', 'Sales Invoices')} value={fmtShort(salesTotal)} sub="EGP" color="#4A7AAB" />
          <KpiCard icon={TrendingDown} label={L('فواتير شراء', 'Purchase Bills')} value={fmtShort(purchaseTotal)} sub="EGP" color="#EF4444" />
          <KpiCard icon={AlertTriangle} label={L('متأخرات', 'Overdue')} value={fmtShort(overdueTotal)} sub="EGP" color="#EF4444" />
          <KpiCard icon={Receipt} label={L('ضرائب', 'Tax')} value={fmtShort(taxTotal)} sub="EGP" color="#6B8DB5" />
        </div>

        <CardWrap title={L('الفواتير', 'Invoices')} icon={FileText}
          headerRight={<AddBtn label={L('فاتورة جديدة', 'New Invoice')} onClick={() => setShowInvoiceModal(true)} />}>
          <div className="flex gap-1.5 px-5 py-3 border-b border-edge dark:border-edge-dark flex-wrap">
            {/* Type filters */}
            {[
              { id: 'all', label: L('الكل', 'All') },
              { id: 'sales', label: L('بيع', 'Sales') },
              { id: 'purchase', label: L('شراء', 'Purchase') },
            ].map(f => <FilterPill key={f.id} label={f.label} active={invoiceType === f.id} onClick={() => setInvoiceType(f.id)} />)}
            <div className="w-px h-6 bg-edge dark:bg-edge-dark mx-1" />
            {/* Status filters */}
            {[
              { id: 'all', label: L('كل الحالات', 'All Status') },
              { id: 'sent', label: L('مرسلة', 'Sent') },
              { id: 'paid', label: L('مدفوعة', 'Paid') },
              { id: 'overdue', label: L('متأخرة', 'Overdue') },
            ].map(f => <FilterPill key={'s-' + f.id} label={f.label} active={invoiceFilter === f.id} onClick={() => setInvoiceFilter(f.id)} />)}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead><tr>
                <Th>{L('رقم الفاتورة', 'Invoice #')}</Th>
                <Th>{L('النوع', 'Type')}</Th>
                <Th>{L('الطرف', 'Counterparty')}</Th>
                <Th>{L('التاريخ', 'Date')}</Th>
                <Th>{L('الاستحقاق', 'Due Date')}</Th>
                <Th>{L('المبلغ', 'Total')}</Th>
                <Th>{L('المدفوع', 'Paid')}</Th>
                <Th>{L('الحالة', 'Status')}</Th>
              </tr></thead>
              <tbody>
                {filtered.length === 0
                  ? <Empty icon={FileText} title={L('لا توجد فواتير', 'No Invoices')} sub={L('لم يتم تسجيل أي فواتير بعد', 'No invoices found')} />
                  : filtered.map(inv => {
                    const st = INVOICE_STATUS[inv.status];
                    return (
                      <Tr key={inv.id} onClick={() => setViewInvoice(inv)} className="cursor-pointer">
                        <Td className="font-bold text-brand-500">{inv.number}</Td>
                        <Td><StatusBadge label={inv.type === 'sales' ? L('بيع', 'Sales') : L('شراء', 'Purchase')} color={inv.type === 'sales' ? '#4A7AAB' : '#6B8DB5'} /></Td>
                        <Td>{L(inv.counterparty_ar, inv.counterparty_en)}</Td>
                        <Td className="text-content-muted dark:text-content-muted-dark">{inv.date}</Td>
                        <Td className={`${inv.status === 'overdue' ? 'text-red-500 font-bold' : 'text-content-muted dark:text-content-muted-dark'}`}>{inv.due_date}</Td>
                        <Td className="font-bold">{fmtMoney(inv.total)}</Td>
                        <Td className={inv.paid > 0 ? 'text-brand-800' : 'text-content-muted dark:text-content-muted-dark'}>{fmtMoney(inv.paid)}</Td>
                        <Td><StatusBadge label={L(st.ar, st.en)} color={st.color} /></Td>
                      </Tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </CardWrap>
      </div>
    );
  };

  /* ═══════════════════════════════════════════════════════════════════════
     TAB 5 — COMMISSIONS
     ═══════════════════════════════════════════════════════════════════════ */

  const renderCommissions = () => {
    const isCompany = commTab === 'company';
    const data = isCompany ? companyComm : agentComm;
    const setData = isCompany ? setCompanyComm : setAgentComm;

    const filtered = commFilter === 'all' ? data : data.filter(c => c.status === commFilter);

    const pendingAmt = data.filter(c => c.status === 'pending').reduce((s, c) => s + c.amount, 0);
    const approvedAmt = data.filter(c => c.status === 'approved').reduce((s, c) => s + c.amount, 0);
    const paidAmt = data.filter(c => c.status === 'paid').reduce((s, c) => s + c.amount, 0);

    const handleAction = (id, newStatus) => {
      setData(prev => prev.map(c => c.id === id ? { ...c, status: newStatus } : c));
    };

    return (
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
          <KpiCard icon={Clock} label={L('معلق', 'Pending')} value={fmtShort(pendingAmt)} sub="EGP" color="#6B8DB5" />
          <KpiCard icon={CheckCircle} label={L('معتمد', 'Approved')} value={fmtShort(approvedAmt)} sub="EGP" color="#4A7AAB" />
          <KpiCard icon={DollarSign} label={L('مصروف', 'Paid')} value={fmtShort(paidAmt)} sub="EGP" color="#2B4C6F" />
        </div>

        <CardWrap
          title={L('العمولات', 'Commissions')}
          icon={DollarSign}
          headerRight={
            <div className="flex gap-2 items-center">
              {/* Company / Agent toggle */}
              <div className="flex bg-gray-100 dark:bg-brand-500/10 rounded-lg p-0.5">
                {[
                  { id: 'company', label: L('عمولات المطورين', 'Developer Comm.') },
                  { id: 'agent', label: L('عمولات السيلز', 'Agent Comm.') },
                ].map(t => (
                  <button key={t.id} onClick={() => { setCommTab(t.id); setCommFilter('all'); }}
                    className={`px-3.5 py-1 rounded-md border-none text-xs font-semibold cursor-pointer transition-all duration-150
                      ${commTab === t.id ? 'bg-brand-500 text-white' : 'bg-transparent text-content-muted dark:text-content-muted-dark'}`}
                  >{t.label}</button>
                ))}
              </div>
            </div>
          }
        >
          {/* Filters */}
          <div className="flex gap-1.5 px-5 py-3 border-b border-edge dark:border-edge-dark">
            {[
              { id: 'all', label: L('الكل', 'All') },
              { id: 'pending', label: L('معلق', 'Pending') },
              { id: 'approved', label: L('معتمد', 'Approved') },
              { id: 'paid', label: L('مصروف', 'Paid') },
            ].map(f => <FilterPill key={f.id} label={f.label} active={commFilter === f.id} onClick={() => setCommFilter(f.id)} />)}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead><tr>
                <Th>{isCompany ? L('المطوّر', 'Developer') : L('السيلز', 'Agent')}</Th>
                {isCompany && <Th>{L('المشروع', 'Project')}</Th>}
                <Th>{L('رقم الصفقة', 'Deal Ref')}</Th>
                <Th>{L('قيمة الصفقة', 'Deal Value')}</Th>
                <Th>{L('النسبة / الطريقة', 'Rate / Method')}</Th>
                <Th>{L('العمولة', 'Commission')}</Th>
                <Th>{L('الحالة', 'Status')}</Th>
                <Th>{L('إجراء', 'Action')}</Th>
              </tr></thead>
              <tbody>
                {filtered.length === 0
                  ? <Empty icon={DollarSign} title={L('لا توجد عمولات', 'No Commissions')} sub={L('لم يتم تسجيل أي عمولات بعد', 'No commission records found')} />
                  : filtered.map(row => {
                    const st = COMMISSION_STATUS[row.status];
                    return (
                      <Tr key={row.id}>
                        <Td className="font-bold">{isCompany ? L(row.developer_ar, row.developer_en) : L(row.agent_ar, row.agent_en)}</Td>
                        {isCompany && <Td className="text-content-muted dark:text-content-muted-dark">{L(row.project_ar, row.project_en)}</Td>}
                        <Td className="text-content-muted dark:text-content-muted-dark">{row.deal_ref}</Td>
                        <Td>{fmtMoney(row.deal_value)}</Td>
                        <Td className="text-content-muted dark:text-content-muted-dark">
                          {isCompany
                            ? (row.rate * 100).toFixed(1) + '%'
                            : row.calc_method === 'per_million'
                              ? fmtMoney(row.rate) + L(' / مليون', ' / M')
                              : (row.rate * 100).toFixed(1) + '%'
                          }
                        </Td>
                        <Td className="font-bold text-brand-500">{fmtMoney(row.amount)}</Td>
                        <Td><StatusBadge label={L(st.ar, st.en)} color={st.color} /></Td>
                        <Td>
                          {row.status === 'pending' && (
                            <div className="flex gap-1.5">
                              <button onClick={() => handleAction(row.id, 'approved')}
                                className="px-2.5 py-0.5 rounded-md border-none bg-brand-800 text-white text-xs font-semibold cursor-pointer">
                                {L('اعتماد', 'Approve')}
                              </button>
                              <button onClick={() => handleAction(row.id, 'rejected')}
                                className="px-2.5 py-0.5 rounded-md border border-red-500 bg-transparent text-red-500 text-xs cursor-pointer">
                                {L('رفض', 'Reject')}
                              </button>
                            </div>
                          )}
                          {row.status === 'approved' && (
                            <button onClick={() => handleAction(row.id, 'paid')}
                              className="px-2.5 py-0.5 rounded-md border-none bg-brand-900 text-white text-xs font-semibold cursor-pointer">
                              {isCompany ? L('تم التحصيل', 'Collected') : L('صرف', 'Pay')}
                            </button>
                          )}
                          {(row.status === 'paid' || row.status === 'rejected') && (
                            <span className="text-xs text-content-muted dark:text-content-muted-dark">{row.status === 'paid' ? L('مكتمل', 'Done') : L('مرفوض', 'Rejected')}</span>
                          )}
                        </Td>
                      </Tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </CardWrap>
      </div>
    );
  };

  /* ═══════════════════════════════════════════════════════════════════════
     TAB 6 — EXPENSES
     ═══════════════════════════════════════════════════════════════════════ */

  const renderExpenses = () => {
    let filtered = expenses;
    if (expFilter !== 'all') filtered = filtered.filter(e => e.status === expFilter);
    if (expSearch) {
      const q = expSearch.toLowerCase();
      filtered = filtered.filter(e =>
        L(e.vendor_ar, e.vendor_en).toLowerCase().includes(q) ||
        L(e.desc_ar, e.desc_en).toLowerCase().includes(q) ||
        e.number.toLowerCase().includes(q)
      );
    }

    const approvedAmt = expenses.filter(e => e.status === 'approved' || e.status === 'paid').reduce((s, e) => s + e.amount, 0);
    const pendingAmt = pendingExpenses.reduce((s, e) => s + e.amount, 0);

    // Expense breakdown by category
    const byCat = {};
    expenses.forEach(e => {
      const cat = EXPENSE_CATEGORIES[e.category];
      const key = cat ? L(cat.ar, cat.en) : e.category;
      byCat[key] = (byCat[key] || 0) + e.amount;
    });
    const sortedCats = Object.entries(byCat).sort((a, b) => b[1] - a[1]);

    return (
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
          <KpiCard icon={Receipt} label={L('إجمالي المصروفات', 'Total Expenses')} value={fmtShort(totalExpenseAmt)} sub="EGP" color="#EF4444" />
          <KpiCard icon={CheckCircle} label={L('معتمد + مدفوع', 'Approved + Paid')} value={fmtShort(approvedAmt)} sub="EGP" color="#4A7AAB" />
          <KpiCard icon={Clock} label={L('في الانتظار', 'Pending')} value={pendingExpenses.length} sub={fmtMoney(pendingAmt)} color="#6B8DB5" />
          <KpiCard icon={PieChart} label={L('أكبر بند', 'Largest Category')} value={sortedCats[0]?.[0] || '—'} sub={sortedCats[0] ? fmtMoney(sortedCats[0][1]) : ''} color="#2B4C6F" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-4">
          {/* Main table */}
          <CardWrap title={L('سجل المصروفات', 'Expense Log')} icon={Receipt}
            headerRight={
              <div className="flex gap-2 items-center">
                <SearchBox value={expSearch} onChange={setExpSearch} placeholder={L('بحث...', 'Search...')} />
                <AddBtn label={L('إضافة مصروف', 'Add Expense')} onClick={() => setShowExpenseModal(true)} />
              </div>
            }>
            <div className="flex gap-1.5 px-5 py-3 border-b border-edge dark:border-edge-dark">
              {[
                { id: 'all', label: L('الكل', 'All') },
                { id: 'pending', label: L('معلق', 'Pending') },
                { id: 'approved', label: L('معتمد', 'Approved') },
                { id: 'paid', label: L('مدفوع', 'Paid') },
              ].map(f => <FilterPill key={f.id} label={f.label} active={expFilter === f.id} onClick={() => setExpFilter(f.id)} />)}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead><tr>
                  <Th>{L('الرقم', '#')}</Th>
                  <Th>{L('الفئة', 'Category')}</Th>
                  <Th>{L('المورد', 'Vendor')}</Th>
                  <Th>{L('الوصف', 'Description')}</Th>
                  <Th>{L('المبلغ', 'Amount')}</Th>
                  <Th>{L('الطريقة', 'Method')}</Th>
                  <Th>{L('الحالة', 'Status')}</Th>
                  <Th>{L('إجراء', 'Action')}</Th>
                </tr></thead>
                <tbody>
                  {filtered.length === 0
                    ? <Empty icon={Receipt} title={L('لا توجد مصروفات', 'No Expenses')} sub={L('لم يتم تسجيل أي مصروفات بعد', 'No expense records found')} />
                    : filtered.map(exp => {
                      const st = EXPENSE_STATUS[exp.status];
                      const cat = EXPENSE_CATEGORIES[exp.category];
                      const method = PAYMENT_METHODS[exp.method];
                      return (
                        <Tr key={exp.id}>
                          <Td className="font-bold text-brand-500">{exp.number}</Td>
                          <Td>{cat ? L(cat.ar, cat.en) : exp.category}</Td>
                          <Td>{L(exp.vendor_ar, exp.vendor_en)}</Td>
                          <Td className="text-content-muted dark:text-content-muted-dark">{L(exp.desc_ar, exp.desc_en)}</Td>
                          <Td className="font-bold text-red-500">{fmtMoney(exp.amount)}</Td>
                          <Td className="text-content-muted dark:text-content-muted-dark">{method ? L(method.ar, method.en) : exp.method}</Td>
                          <Td><StatusBadge label={L(st.ar, st.en)} color={st.color} /></Td>
                          <Td>
                            {exp.status === 'pending' && (
                              <div className="flex gap-1.5">
                                <button onClick={() => setExpenses(prev => prev.map(e => e.id === exp.id ? { ...e, status: 'approved', approved_by_ar: 'المدير', approved_by_en: 'Manager' } : e))}
                                  className="px-2.5 py-0.5 rounded-md border-none bg-brand-800 text-white text-xs font-semibold cursor-pointer">
                                  {L('اعتماد', 'Approve')}
                                </button>
                                <button onClick={() => setExpenses(prev => prev.map(e => e.id === exp.id ? { ...e, status: 'rejected' } : e))}
                                  className="px-2.5 py-0.5 rounded-md border border-red-500 bg-transparent text-red-500 text-xs cursor-pointer">
                                  {L('رفض', 'Reject')}
                                </button>
                              </div>
                            )}
                            {exp.status === 'approved' && (
                              <button onClick={() => setExpenses(prev => prev.map(e => e.id === exp.id ? { ...e, status: 'paid' } : e))}
                                className="px-2.5 py-0.5 rounded-md border-none bg-brand-900 text-white text-xs font-semibold cursor-pointer">
                                {L('صرف', 'Pay')}
                              </button>
                            )}
                          </Td>
                        </Tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </CardWrap>

          {/* Sidebar - Category breakdown */}
          <CardWrap title={L('توزيع المصروفات', 'By Category')} icon={PieChart}>
            <div className="px-5 py-3">
              {sortedCats.map(([cat, amt], i) => {
                const pct = Math.round((amt / totalExpenseAmt) * 100);
                const barColors = ['#1B3347', '#2B4C6F', '#4A7AAB', '#6B8DB5', '#8BA8C8', '#EF4444'];
                return (
                  <div key={cat} className="mb-2.5">
                    <div className="flex justify-between mb-0.5">
                      <span className="text-xs text-content dark:text-content-dark">{cat}</span>
                      <span className="text-xs font-bold text-content dark:text-content-dark">{fmtShort(amt)}</span>
                    </div>
                    <div className="h-[5px] rounded-sm bg-gray-200 dark:bg-white/[0.08]">
                      <div className="h-full rounded-sm" style={{ width: pct + '%', background: barColors[i % barColors.length] }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </CardWrap>
        </div>
      </div>
    );
  };

  /* ═══════════════════════════════════════════════════════════════════════
     TAB 7 — FINANCIAL REPORTS
     ═══════════════════════════════════════════════════════════════════════ */

  const renderReports = () => {
    // ── Compute all balances from posted journal entries ──
    const bal = (accId) => calcAccountBalance(postedEntries, accId);

    // Helper: sum balance of all leaf accounts under a parent
    const sumGroup = (parentId) => {
      const children = chartOfAccounts.filter(a => a.parent_id === parentId);
      let total = 0;
      children.forEach(c => {
        if (c.is_group) total += sumGroup(c.id);
        else total += bal(c.id);
      });
      return total;
    };

    // ── Balance Sheet data ──
    const totalAssets = sumGroup('acc-1000');
    const totalLiabilities = -sumGroup('acc-2000');
    const totalEquity = -sumGroup('acc-3000');
    const netIncome = totalRevenue - postedEntries.reduce((s, e) => {
      let expTotal = 0;
      e.lines.forEach(l => { if (l.account_id.startsWith('acc-5')) expTotal += l.debit - l.credit; });
      return s + expTotal;
    }, 0) + postedEntries.reduce((s, e) => {
      let expTotal = 0;
      e.lines.forEach(l => { if (l.account_id.startsWith('acc-5')) expTotal += l.debit - l.credit; });
      return s + expTotal;
    }, 0);

    const totalExpPosted = (() => {
      let t = 0;
      postedEntries.forEach(e => e.lines.forEach(l => { if (l.account_id.startsWith('acc-5')) t += l.debit - l.credit; }));
      return t;
    })();
    const netIncomeCalc = totalRevenue - totalExpPosted;

    // ── Income Statement data ──
    const revAccounts = chartOfAccounts.filter(a => a.type === 'revenue' && !a.is_group);
    const expAccounts = chartOfAccounts.filter(a => a.type === 'expense' && !a.is_group);

    // ── Cash Flow data ──
    const cashBal = bal('acc-1110');
    const bankCIB = bal('acc-1120');
    const bankNBE = bal('acc-1130');
    const totalCash = cashBal + bankCIB + bankNBE;

    const cashInflows = (() => {
      let t = 0;
      postedEntries.forEach(e => e.lines.forEach(l => {
        if ((l.account_id === 'acc-1110' || l.account_id === 'acc-1120' || l.account_id === 'acc-1130') && l.debit > 0) t += l.debit;
      }));
      return t;
    })();
    const cashOutflows = (() => {
      let t = 0;
      postedEntries.forEach(e => e.lines.forEach(l => {
        if ((l.account_id === 'acc-1110' || l.account_id === 'acc-1120' || l.account_id === 'acc-1130') && l.credit > 0) t += l.credit;
      }));
      return t;
    })();

    const ReportLine = ({ label, amount, bold, indent = 0, negative, separator }) => {
      if (separator) return (
        <div className="border-t-2 border-edge dark:border-edge-dark my-2" />
      );
      return (
        <div className="flex justify-between items-center py-1.5 border-b border-edge/20 dark:border-edge-dark/20" style={{ paddingInlineStart: indent * 20 }}>
          <span className={`text-xs ${bold ? 'font-bold text-content dark:text-content-dark' : 'font-normal text-content-muted dark:text-content-muted-dark'}`}>{label}</span>
          <span className={`text-xs ${bold ? 'font-bold' : 'font-semibold'} ${negative ? 'text-red-500' : amount === 0 ? 'text-content-muted dark:text-content-muted-dark' : bold ? 'text-brand-500' : 'text-content dark:text-content-dark'}`}>
            {fmtMoney(Math.abs(amount))}
          </span>
        </div>
      );
    };

    const ReportHeader = ({ title }) => (
      <div className="pt-2.5 pb-1.5 border-b-2 border-brand-500/40 mb-1">
        <span className="text-sm font-bold text-content dark:text-content-dark uppercase tracking-wider">{title}</span>
      </div>
    );

    return (
      <div className="flex flex-col gap-4">
        {/* Report selector */}
        <div className="flex gap-2">
          {[
            { id: 'balance_sheet', label: L('الميزانية العمومية', 'Balance Sheet') },
            { id: 'income_statement', label: L('قائمة الدخل', 'Income Statement') },
            { id: 'cash_flow', label: L('التدفقات النقدية', 'Cash Flow') },
          ].map(r => <FilterPill key={r.id} label={r.label} active={reportView === r.id} onClick={() => setReportView(r.id)} />)}
        </div>

        {/* ── BALANCE SHEET ── */}
        {reportView === 'balance_sheet' && (
          <div className="grid grid-cols-2 gap-4">
            {/* Left — Assets */}
            <CardWrap title={L('الميزانية العمومية', 'Balance Sheet')} icon={Layers}>
              <div className="px-5 py-4">
                <div className="text-xs text-content-muted dark:text-content-muted-dark mb-3">{L('كما في مارس 2026', 'As of March 2026')}</div>

                <ReportHeader title={L('الأصول', 'ASSETS')} />
                {chartOfAccounts.filter(a => a.parent_id === 'acc-1000' && !a.is_group).map(a => (
                  <ReportLine key={a.id} label={L(a.name_ar, a.name_en)} amount={bal(a.id)} indent={1} />
                ))}
                {chartOfAccounts.filter(a => a.parent_id === 'acc-1000' && a.is_group).map(g => {
                  const leaves = chartOfAccounts.filter(a => a.parent_id === g.id && !a.is_group);
                  return [
                    <ReportLine key={g.id + '-h'} label={L(g.name_ar, g.name_en)} amount={sumGroup(g.id)} bold indent={1} />,
                    ...leaves.map(a => <ReportLine key={a.id} label={L(a.name_ar, a.name_en)} amount={bal(a.id)} indent={2} />),
                  ];
                })}
                <ReportLine separator />
                <ReportLine label={L('إجمالي الأصول', 'Total Assets')} amount={totalAssets} bold />

                <div className="h-5" />

                <ReportHeader title={L('الخصوم', 'LIABILITIES')} />
                {chartOfAccounts.filter(a => a.parent_id === 'acc-2000' && !a.is_group).map(a => (
                  <ReportLine key={a.id} label={L(a.name_ar, a.name_en)} amount={-bal(a.id)} indent={1} />
                ))}
                <ReportLine separator />
                <ReportLine label={L('إجمالي الخصوم', 'Total Liabilities')} amount={totalLiabilities} bold />

                <div className="h-5" />

                <ReportHeader title={L('حقوق الملكية', 'EQUITY')} />
                {chartOfAccounts.filter(a => a.parent_id === 'acc-3000' && !a.is_group).map(a => (
                  <ReportLine key={a.id} label={L(a.name_ar, a.name_en)} amount={-bal(a.id)} indent={1} />
                ))}
                <ReportLine label={L('صافي الدخل', 'Net Income')} amount={netIncomeCalc} indent={1} />
                <ReportLine separator />
                <ReportLine label={L('إجمالي حقوق الملكية', 'Total Equity')} amount={totalEquity + netIncomeCalc} bold />

                <div className="h-3" />
                <div className={`px-3.5 py-2.5 rounded-xl flex items-center gap-2 ${(Math.abs(totalAssets - (totalLiabilities + totalEquity + netIncomeCalc)) < 1) ? 'bg-brand-800/[0.08]' : 'bg-red-500/[0.08]'}`}>
                  {(Math.abs(totalAssets - (totalLiabilities + totalEquity + netIncomeCalc)) < 1)
                    ? <><CheckCircle size={14} className="text-brand-800" /><span className="text-xs font-semibold text-brand-800">{L('الميزانية متوازنة ✓', 'Balance Sheet is balanced ✓')}</span></>
                    : <><AlertTriangle size={14} className="text-red-500" /><span className="text-xs font-semibold text-red-500">{L('الميزانية غير متوازنة', 'Balance Sheet NOT balanced')}</span></>
                  }
                </div>
              </div>
            </CardWrap>

            {/* Right — KPIs */}
            <div className="flex flex-col gap-3.5">
              <KpiCard icon={Layers} label={L('إجمالي الأصول', 'Total Assets')} value={fmtShort(totalAssets)} sub="EGP" color="#4A7AAB" />
              <KpiCard icon={AlertTriangle} label={L('إجمالي الخصوم', 'Total Liabilities')} value={fmtShort(totalLiabilities)} sub="EGP" color="#EF4444" />
              <KpiCard icon={Wallet} label={L('حقوق الملكية', 'Equity')} value={fmtShort(totalEquity + netIncomeCalc)} sub="EGP" color="#2B4C6F" />
              <KpiCard icon={TrendingUp} label={L('صافي الدخل', 'Net Income')} value={fmtShort(netIncomeCalc)} sub="EGP" color="#1B3347" />

              <CardWrap title={L('ملخص', 'Summary')} icon={BarChart2}>
                <div className="px-5 py-3.5">
                  <div className="flex justify-between mb-1.5">
                    <span className="text-xs text-content-muted dark:text-content-muted-dark">{L('نسبة السيولة', 'Current Ratio')}</span>
                    <span className="text-xs font-bold text-content dark:text-content-dark">{totalLiabilities > 0 ? (totalAssets / totalLiabilities).toFixed(2) : '∞'}</span>
                  </div>
                  <div className="flex justify-between mb-1.5">
                    <span className="text-xs text-content-muted dark:text-content-muted-dark">{L('هامش الربح', 'Profit Margin')}</span>
                    <span className={`text-xs font-bold ${netIncomeCalc >= 0 ? 'text-brand-800' : 'text-red-500'}`}>{totalRevenue > 0 ? ((netIncomeCalc / totalRevenue) * 100).toFixed(1) + '%' : '—'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-xs text-content-muted dark:text-content-muted-dark">{L('نسبة المصروفات', 'Expense Ratio')}</span>
                    <span className="text-xs font-bold text-content dark:text-content-dark">{totalRevenue > 0 ? ((totalExpPosted / totalRevenue) * 100).toFixed(1) + '%' : '—'}</span>
                  </div>
                </div>
              </CardWrap>
            </div>
          </div>
        )}

        {/* ── INCOME STATEMENT ── */}
        {reportView === 'income_statement' && (
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4">
            <CardWrap title={L('قائمة الدخل', 'Income Statement')} icon={TrendingUp}>
              <div className="px-5 py-4">
                <div className="text-xs text-content-muted dark:text-content-muted-dark mb-3">{L('مارس 2026', 'March 2026')}</div>

                <ReportHeader title={L('الإيرادات', 'REVENUE')} />
                {revAccounts.map(a => {
                  let amount = 0;
                  postedEntries.forEach(e => e.lines.forEach(l => { if (l.account_id === a.id) amount += l.credit - l.debit; }));
                  return <ReportLine key={a.id} label={L(a.name_ar, a.name_en)} amount={amount} indent={1} />;
                })}
                <ReportLine separator />
                <ReportLine label={L('إجمالي الإيرادات', 'Total Revenue')} amount={totalRevenue} bold />

                <div className="h-4" />

                <ReportHeader title={L('المصروفات', 'EXPENSES')} />
                {expAccounts.map(a => {
                  let amount = 0;
                  postedEntries.forEach(e => e.lines.forEach(l => { if (l.account_id === a.id) amount += l.debit - l.credit; }));
                  if (amount === 0) return null;
                  return <ReportLine key={a.id} label={L(a.name_ar, a.name_en)} amount={amount} indent={1} negative />;
                })}
                <ReportLine separator />
                <ReportLine label={L('إجمالي المصروفات', 'Total Expenses')} amount={totalExpPosted} bold negative />

                <div className="h-4" />
                <div className={`px-3.5 py-3 rounded-xl ${netIncomeCalc >= 0 ? 'bg-brand-800/[0.08]' : 'bg-red-500/[0.08]'}`}>
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-bold text-content dark:text-content-dark">{L('صافي الدخل', 'Net Income')}</span>
                    <span className={`text-lg font-bold ${netIncomeCalc >= 0 ? 'text-brand-800' : 'text-red-500'}`}>{fmtMoney(netIncomeCalc)}</span>
                  </div>
                </div>
              </div>
            </CardWrap>

            {/* Right — Chart */}
            <div className="flex flex-col gap-3.5">
              <KpiCard icon={TrendingUp} label={L('الإيرادات', 'Revenue')} value={fmtShort(totalRevenue)} sub="EGP" color="#4A7AAB" />
              <KpiCard icon={TrendingDown} label={L('المصروفات', 'Expenses')} value={fmtShort(totalExpPosted)} sub="EGP" color="#EF4444" />
              <KpiCard icon={DollarSign} label={L('صافي الدخل', 'Net Income')} value={fmtShort(netIncomeCalc)} sub="EGP" color={netIncomeCalc >= 0 ? '#2B4C6F' : '#EF4444'} />

              {/* Expense breakdown mini */}
              <CardWrap title={L('توزيع المصروفات', 'Expense Breakdown')} icon={PieChart}>
                <div className="px-5 py-3">
                  {expAccounts.filter(a => {
                    let amt = 0;
                    postedEntries.forEach(e => e.lines.forEach(l => { if (l.account_id === a.id) amt += l.debit - l.credit; }));
                    return amt > 0;
                  }).sort((a, b) => {
                    let aAmt = 0, bAmt = 0;
                    postedEntries.forEach(e => e.lines.forEach(l => { if (l.account_id === a.id) aAmt += l.debit - l.credit; if (l.account_id === b.id) bAmt += l.debit - l.credit; }));
                    return bAmt - aAmt;
                  }).map((a, i) => {
                    let amt = 0;
                    postedEntries.forEach(e => e.lines.forEach(l => { if (l.account_id === a.id) amt += l.debit - l.credit; }));
                    const pct = totalExpPosted > 0 ? Math.round((amt / totalExpPosted) * 100) : 0;
                    const colors = ['#1B3347', '#2B4C6F', '#4A7AAB', '#6B8DB5', '#8BA8C8', '#EF4444'];
                    return (
                      <div key={a.id} className="mb-2">
                        <div className="flex justify-between mb-0.5">
                          <span className="text-xs text-content dark:text-content-dark">{L(a.name_ar, a.name_en)}</span>
                          <span className="text-xs font-bold text-content-muted dark:text-content-muted-dark">{pct}%</span>
                        </div>
                        <div className="h-1 rounded-sm bg-gray-200 dark:bg-white/[0.08]">
                          <div className="h-full rounded-sm" style={{ width: pct + '%', background: colors[i % colors.length] }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardWrap>
            </div>
          </div>
        )}

        {/* ── CASH FLOW STATEMENT ── */}
        {reportView === 'cash_flow' && (
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4">
            <CardWrap title={L('قائمة التدفقات النقدية', 'Cash Flow Statement')} icon={Wallet}>
              <div className="px-5 py-4">
                <div className="text-xs text-content-muted dark:text-content-muted-dark mb-3">{L('مارس 2026', 'March 2026')}</div>

                <ReportHeader title={L('تدفقات من الأنشطة التشغيلية', 'OPERATING ACTIVITIES')} />
                <ReportLine label={L('صافي الدخل', 'Net Income')} amount={netIncomeCalc} indent={1} />
                <ReportLine label={L('تغير في ذمم مدينة', 'Change in Receivables')} amount={-receivable} indent={1} negative={receivable > 0} />
                <ReportLine label={L('تغير في ذمم دائنة', 'Change in Payables')} amount={payable} indent={1} />
                <ReportLine separator />
                <ReportLine label={L('صافي التدفقات التشغيلية', 'Net Operating Cash Flow')} amount={netIncomeCalc - receivable + payable} bold />

                <div className="h-4" />
                <ReportHeader title={L('ملخص الحركة النقدية', 'CASH MOVEMENT SUMMARY')} />
                <ReportLine label={L('إجمالي التحصيلات', 'Total Cash Inflows')} amount={cashInflows} indent={1} />
                <ReportLine label={L('إجمالي المدفوعات', 'Total Cash Outflows')} amount={cashOutflows} indent={1} negative />
                <ReportLine separator />
                <ReportLine label={L('صافي الحركة', 'Net Movement')} amount={cashInflows - cashOutflows} bold />

                <div className="h-4" />
                <ReportHeader title={L('الأرصدة النقدية', 'CASH BALANCES')} />
                <ReportLine label={L('الصندوق (كاش)', 'Cash on Hand')} amount={cashBal} indent={1} />
                <ReportLine label={L('بنك CIB', 'CIB Bank')} amount={bankCIB} indent={1} />
                <ReportLine label={L('بنك NBE', 'NBE Bank')} amount={bankNBE} indent={1} />
                <ReportLine separator />
                <ReportLine label={L('إجمالي النقدية', 'Total Cash & Banks')} amount={totalCash} bold />
              </div>
            </CardWrap>

            <div className="flex flex-col gap-3.5">
              <KpiCard icon={ArrowUpRight} label={L('إجمالي التحصيلات', 'Total Inflows')} value={fmtShort(cashInflows)} sub="EGP" color="#4A7AAB" />
              <KpiCard icon={ArrowDownRight} label={L('إجمالي المدفوعات', 'Total Outflows')} value={fmtShort(cashOutflows)} sub="EGP" color="#EF4444" />
              <KpiCard icon={Wallet} label={L('إجمالي النقدية', 'Total Cash')} value={fmtShort(totalCash)} sub="EGP" color="#2B4C6F" />

              {/* Cash breakdown */}
              <CardWrap title={L('توزيع النقدية', 'Cash Distribution')} icon={PieChart}>
                <div className="px-5 py-3.5">
                  {[
                    { label: L('الصندوق', 'Cash on Hand'), amount: cashBal, color: '#1B3347' },
                    { label: L('بنك CIB', 'CIB Bank'), amount: bankCIB, color: '#4A7AAB' },
                    { label: L('بنك NBE', 'NBE Bank'), amount: bankNBE, color: '#8BA8C8' },
                  ].map((item, i) => {
                    const pct = totalCash !== 0 ? Math.round((Math.abs(item.amount) / Math.abs(totalCash)) * 100) : 0;
                    return (
                      <div key={i} className="mb-2.5">
                        <div className="flex justify-between mb-0.5">
                          <span className="text-xs text-content dark:text-content-dark">{item.label}</span>
                          <span className="text-xs font-bold" style={{ color: item.color }}>{fmtMoney(item.amount)}</span>
                        </div>
                        <div className="h-[5px] rounded-sm bg-gray-200 dark:bg-white/[0.08]">
                          <div className="h-full rounded-sm" style={{ width: pct + '%', background: item.color }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardWrap>
            </div>
          </div>
        )}
      </div>
    );
  };

  /* ═══════════════════════════════════════════════════════════════════════
     TAB 8 — BUDGET
     ═══════════════════════════════════════════════════════════════════════ */

  const renderBudget = () => {
    const totalBudgetYtd = budgetData.reduce((s, b) => s + b.budget_ytd, 0);
    const totalActualYtd = budgetData.reduce((s, b) => s + b.actual_ytd, 0);
    const totalMonthly = budgetData.reduce((s, b) => s + b.monthly, 0);
    const overallPct = totalBudgetYtd > 0 ? Math.round((totalActualYtd / totalBudgetYtd) * 100) : 0;
    const overBudgetCount = budgetData.filter(b => b.actual_ytd > b.budget_ytd).length;

    const handleUpdateMonthly = (id, newVal) => {
      const v = Number(newVal);
      if (isNaN(v) || v < 0) return;
      setBudgetData(prev => prev.map(b => b.id === id ? { ...b, monthly: v, budget_ytd: v * 3 } : b));
    };

    return (
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
          <KpiCard icon={Target} label={L('الموازنة الشهرية', 'Monthly Budget')} value={fmtShort(totalMonthly)} sub="EGP" color="#4A7AAB" />
          <KpiCard icon={BarChart2} label={L('الفعلي YTD', 'Actual YTD')} value={fmtShort(totalActualYtd)} sub="EGP" color="#2B4C6F" />
          <KpiCard icon={PieChart} label={L('نسبة الاستهلاك', 'Usage Rate')} value={overallPct + '%'} sub={L('من الموازنة', 'of budget')} color={overallPct > 100 ? '#EF4444' : '#4A7AAB'} />
          <KpiCard icon={AlertTriangle} label={L('بنود تجاوزت', 'Over Budget')} value={overBudgetCount} sub={L('بند', 'items')} color={overBudgetCount > 0 ? '#EF4444' : '#2B4C6F'} />
        </div>

        {/* Overall progress */}
        <CardWrap title={L('استهلاك الموازنة الكلي', 'Overall Budget Consumption')} icon={Target}>
          <div className="px-5 py-4">
            <div className="flex justify-between mb-2">
              <span className="text-xs text-content dark:text-content-dark font-semibold">{L('الفعلي', 'Actual')}: {fmtMoney(totalActualYtd)}</span>
              <span className="text-xs text-content-muted dark:text-content-muted-dark">{L('الموازنة', 'Budget')}: {fmtMoney(totalBudgetYtd)}</span>
            </div>
            <div className="h-2.5 rounded-[5px] bg-gray-200 dark:bg-white/[0.08] overflow-hidden">
              <div
                className="h-full rounded-[5px] transition-[width] duration-[400ms]"
                style={{ width: Math.min(overallPct, 100) + '%', background: overallPct > 100 ? '#EF4444' : overallPct > 85 ? '#f59e0b' : '#4A7AAB' }}
              />
            </div>
            <div className="flex justify-between mt-1">
              <span className="text-xs text-content-muted dark:text-content-muted-dark">0%</span>
              <span className={`text-xs font-bold ${overallPct > 100 ? 'text-red-500' : 'text-brand-500'}`}>{overallPct}%</span>
              <span className="text-xs text-content-muted dark:text-content-muted-dark">100%</span>
            </div>
          </div>
        </CardWrap>

        {/* Detailed table */}
        <CardWrap title={L('تفاصيل الموازنة', 'Budget Details')} icon={ClipboardList}>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead><tr>
                <Th>{L('البند', 'Category')}</Th>
                <Th>{L('شهري', 'Monthly')}</Th>
                <Th>{L('الموازنة YTD', 'Budget YTD')}</Th>
                <Th>{L('الفعلي YTD', 'Actual YTD')}</Th>
                <Th>{L('الفرق', 'Variance')}</Th>
                <Th>{L('النسبة', '%')}</Th>
                <Th>{L('التقدم', 'Progress')}</Th>
              </tr></thead>
              <tbody>
                {budgetData.map(b => {
                  const pct = b.budget_ytd > 0 ? Math.round((b.actual_ytd / b.budget_ytd) * 100) : 0;
                  const variance = b.budget_ytd - b.actual_ytd;
                  const over = variance < 0;
                  return (
                    <Tr key={b.id}>
                      <Td className="font-bold">{L(b.cat_ar, b.cat_en)}</Td>
                      <Td>
                        <Input
                          type="number"
                          size="sm"
                          value={b.monthly}
                          onChange={e => handleUpdateMonthly(b.id, e.target.value)}
                          className="w-20 text-center"
                        />
                      </Td>
                      <Td className="text-content-muted dark:text-content-muted-dark">{fmtMoney(b.budget_ytd)}</Td>
                      <Td className="font-bold">{fmtMoney(b.actual_ytd)}</Td>
                      <Td className={`font-bold ${over ? 'text-red-500' : 'text-brand-800'}`}>
                        {over ? '(' : ''}{fmtMoney(Math.abs(variance))}{over ? ')' : ''}
                      </Td>
                      <Td className={`font-bold ${over ? 'text-red-500' : pct > 85 ? 'text-amber-500' : 'text-brand-800'}`}>{pct}%</Td>
                      <Td className="min-w-[100px]">
                        <div className="h-1.5 rounded-sm bg-gray-200 dark:bg-white/[0.08]">
                          <div
                            className="h-full rounded-sm transition-[width] duration-300"
                            style={{ width: Math.min(pct, 100) + '%', background: over ? '#EF4444' : pct > 85 ? '#f59e0b' : '#4A7AAB' }}
                          />
                        </div>
                      </Td>
                    </Tr>
                  );
                })}
                {/* Totals row */}
                <tr className="bg-surface-bg dark:bg-brand-500/[0.08] border-t-2 border-edge dark:border-edge-dark">
                  <td className="px-3 py-2.5 text-xs font-bold text-content dark:text-content-dark">{L('الإجمالي', 'Total')}</td>
                  <td className="px-3 py-2.5 text-xs font-bold text-content dark:text-content-dark">{fmtMoney(totalMonthly)}</td>
                  <td className="px-3 py-2.5 text-xs font-bold text-content-muted dark:text-content-muted-dark">{fmtMoney(totalBudgetYtd)}</td>
                  <td className="px-3 py-2.5 text-xs font-bold text-content dark:text-content-dark">{fmtMoney(totalActualYtd)}</td>
                  <td className={`px-3 py-2.5 text-xs font-bold ${totalActualYtd > totalBudgetYtd ? 'text-red-500' : 'text-brand-800'}`}>
                    {totalActualYtd > totalBudgetYtd ? '(' : ''}{fmtMoney(Math.abs(totalBudgetYtd - totalActualYtd))}{totalActualYtd > totalBudgetYtd ? ')' : ''}
                  </td>
                  <td className={`px-3 py-2.5 text-xs font-bold ${overallPct > 100 ? 'text-red-500' : 'text-brand-800'}`}>{overallPct}%</td>
                  <td className="px-3 py-2.5">
                    <div className="h-1.5 rounded-sm bg-gray-200 dark:bg-white/[0.08]">
                      <div className="h-full rounded-sm" style={{ width: Math.min(overallPct, 100) + '%', background: overallPct > 100 ? '#EF4444' : '#4A7AAB' }} />
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </CardWrap>
      </div>
    );
  };

  /* ═══════════════════════════════════════════════════════════════════════
     MODALS
     ═══════════════════════════════════════════════════════════════════════ */

  // ── Journal Entry Detail Modal ──────────────────────────────────────────
  const renderJournalModal = () => {
    if (!viewJournal) return null;
    const je = viewJournal;
    const st = JOURNAL_STATUS[je.status];
    const totalDebit = je.lines.reduce((s, l) => s + l.debit, 0);
    const totalCredit = je.lines.reduce((s, l) => s + l.credit, 0);
    const balanced = totalDebit === totalCredit;

    return (
      <Modal open={true} onClose={() => setViewJournal(null)} title={je.entry_number} width="max-w-2xl">
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div>
            <div className="text-xs text-content-muted dark:text-content-muted-dark mb-0.5">{L('التاريخ', 'Date')}</div>
            <div className="text-sm font-semibold text-content dark:text-content-dark">{je.date}</div>
          </div>
          <div>
            <div className="text-xs text-content-muted dark:text-content-muted-dark mb-0.5">{L('الحالة', 'Status')}</div>
            <StatusBadge label={L(st.ar, st.en)} color={st.color} />
          </div>
          <div className="col-span-full">
            <div className="text-xs text-content-muted dark:text-content-muted-dark mb-0.5">{L('الوصف', 'Description')}</div>
            <div className="text-sm text-content dark:text-content-dark">{L(je.description_ar, je.description_en)}</div>
          </div>
          {je.reference && (
            <div>
              <div className="text-xs text-content-muted dark:text-content-muted-dark mb-0.5">{L('المرجع', 'Reference')}</div>
              <div className="text-sm text-brand-500 font-semibold">{je.reference}</div>
            </div>
          )}
        </div>

        {/* Lines table */}
        <div className="border border-edge dark:border-edge-dark rounded-xl overflow-hidden">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-surface-bg dark:bg-brand-500/[0.08]">
                <Th>{L('الحساب', 'Account')}</Th>
                <Th>{L('الكود', 'Code')}</Th>
                <Th>{L('مدين', 'Debit')}</Th>
                <Th>{L('دائن', 'Credit')}</Th>
              </tr>
            </thead>
            <tbody>
              {je.lines.map((l, i) => (
                <Tr key={i}>
                  <Td>{L(l.name_ar, l.name_en)}</Td>
                  <Td className="text-content-muted dark:text-content-muted-dark">{l.code}</Td>
                  <Td className={`font-bold ${l.debit > 0 ? 'text-brand-800' : 'text-content-muted dark:text-content-muted-dark'}`}>{l.debit > 0 ? fmtMoney(l.debit) : '—'}</Td>
                  <Td className={`font-bold ${l.credit > 0 ? 'text-red-500' : 'text-content-muted dark:text-content-muted-dark'}`}>{l.credit > 0 ? fmtMoney(l.credit) : '—'}</Td>
                </Tr>
              ))}
              {/* Totals row */}
              <tr className="bg-surface-bg dark:bg-brand-500/[0.08] border-t-2 border-edge dark:border-edge-dark">
                <td colSpan={2} className="px-3 py-2.5 text-xs font-bold text-content dark:text-content-dark">{L('الإجمالي', 'Total')}</td>
                <td className="px-3 py-2.5 text-xs font-bold text-brand-800">{fmtMoney(totalDebit)}</td>
                <td className="px-3 py-2.5 text-xs font-bold text-red-500">{fmtMoney(totalCredit)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Balance indicator */}
        <div className={`flex items-center gap-2 mt-3 px-3 py-2 rounded-lg ${balanced ? 'bg-brand-800/[0.08]' : 'bg-red-500/[0.08]'}`}>
          {balanced ? <CheckCircle size={16} className="text-brand-800" /> : <AlertTriangle size={16} className="text-red-500" />}
          <span className={`text-xs font-semibold ${balanced ? 'text-brand-800' : 'text-red-500'}`}>
            {balanced ? L('القيد متوازن ✓', 'Entry is balanced ✓') : L('القيد غير متوازن!', 'Entry is NOT balanced!')}
          </span>
        </div>

        <div className="text-xs text-content-muted dark:text-content-muted-dark mt-3">
          {L('بواسطة: ', 'By: ')}{L(je.created_by_ar, je.created_by_en)}
        </div>
      </Modal>
    );
  };

  // ── Invoice Detail Modal ───────────────────────────────────────────────
  const renderInvoiceModal = () => {
    if (!viewInvoice) return null;
    const inv = viewInvoice;
    const st = INVOICE_STATUS[inv.status];

    return (
      <Modal open={true} onClose={() => setViewInvoice(null)} title={inv.number} width="max-w-2xl">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
          <div>
            <div className="text-xs text-content-muted dark:text-content-muted-dark mb-0.5">{L('النوع', 'Type')}</div>
            <StatusBadge label={inv.type === 'sales' ? L('فاتورة بيع', 'Sales Invoice') : L('فاتورة شراء', 'Purchase Bill')} color={inv.type === 'sales' ? '#4A7AAB' : '#6B8DB5'} />
          </div>
          <div>
            <div className="text-xs text-content-muted dark:text-content-muted-dark mb-0.5">{L('التاريخ', 'Date')}</div>
            <div className="text-sm font-semibold text-content dark:text-content-dark">{inv.date}</div>
          </div>
          <div>
            <div className="text-xs text-content-muted dark:text-content-muted-dark mb-0.5">{L('الاستحقاق', 'Due')}</div>
            <div className={`text-sm font-semibold ${inv.status === 'overdue' ? 'text-red-500' : 'text-content dark:text-content-dark'}`}>{inv.due_date}</div>
          </div>
          <div className="col-span-full">
            <div className="text-xs text-content-muted dark:text-content-muted-dark mb-0.5">{L('الطرف', 'Counterparty')}</div>
            <div className="text-sm font-bold text-content dark:text-content-dark">{L(inv.counterparty_ar, inv.counterparty_en)}</div>
          </div>
        </div>

        {/* Items table */}
        <div className="border border-edge dark:border-edge-dark rounded-xl overflow-hidden mb-4">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-surface-bg dark:bg-brand-500/[0.08]">
                <Th>{L('البند', 'Item')}</Th>
                <Th>{L('الكمية', 'Qty')}</Th>
                <Th>{L('السعر', 'Price')}</Th>
                <Th>{L('الضريبة', 'Tax')}</Th>
                <Th>{L('الإجمالي', 'Total')}</Th>
              </tr>
            </thead>
            <tbody>
              {inv.items.map((item, i) => (
                <Tr key={i}>
                  <Td>{L(item.desc_ar, item.desc_en)}</Td>
                  <Td>{item.qty}</Td>
                  <Td>{fmtMoney(item.price)}</Td>
                  <Td className="text-content-muted dark:text-content-muted-dark">{item.tax_rate ? (item.tax_rate * 100) + '%' : '—'}</Td>
                  <Td className="font-bold">{fmtMoney(item.qty * item.price * (1 + item.tax_rate))}</Td>
                </Tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totals */}
        <div className="flex flex-col gap-1.5 items-end">
          <div className="flex gap-6 text-xs">
            <span className="text-content-muted dark:text-content-muted-dark">{L('المبلغ الفرعي', 'Subtotal')}</span>
            <span className="font-semibold text-content dark:text-content-dark">{fmtMoney(inv.subtotal)}</span>
          </div>
          {inv.tax > 0 && (
            <div className="flex gap-6 text-xs">
              <span className="text-content-muted dark:text-content-muted-dark">{L('الضريبة', 'Tax')}</span>
              <span className="font-semibold text-content dark:text-content-dark">{fmtMoney(inv.tax)}</span>
            </div>
          )}
          <div className="flex gap-6 text-sm border-t-2 border-edge dark:border-edge-dark pt-2 mt-1">
            <span className="font-bold text-content dark:text-content-dark">{L('الإجمالي', 'Total')}</span>
            <span className="font-bold text-brand-500">{fmtMoney(inv.total)}</span>
          </div>
          <div className="flex gap-6 text-xs">
            <span className="text-content-muted dark:text-content-muted-dark">{L('المدفوع', 'Paid')}</span>
            <span className="font-semibold text-brand-800">{fmtMoney(inv.paid)}</span>
          </div>
          <div className="flex gap-6 text-sm">
            <span className={`font-semibold ${inv.total - inv.paid > 0 ? 'text-red-500' : 'text-brand-800'}`}>
              {L('المتبقي', 'Balance')}: {fmtMoney(inv.total - inv.paid)}
            </span>
          </div>
        </div>

        {/* Actions */}
        <ModalFooter className="justify-end">
          {inv.status === 'sent' && (
            <Button variant="primary" size="sm" onClick={async () => { const updated = await svcUpdateInvoiceStatus(inv.id, 'paid'); setInvoices(prev => prev.map(i => i.id === inv.id ? { ...i, ...updated, status: 'paid', paid: i.total } : i)); setViewInvoice(null); }}>
              {L('تسجيل دفع كامل', 'Record Full Payment')}
            </Button>
          )}
          {inv.status === 'overdue' && (
            <Button variant="danger" size="sm" onClick={async () => { const updated = await svcUpdateInvoiceStatus(inv.id, 'paid'); setInvoices(prev => prev.map(i => i.id === inv.id ? { ...i, ...updated, status: 'paid', paid: i.total } : i)); setViewInvoice(null); }}>
              {L('تسجيل دفع كامل', 'Record Full Payment')}
            </Button>
          )}
        </ModalFooter>
      </Modal>
    );
  };

  /* ═══════════════════════════════════════════════════════════════════════
     MAIN RENDER
     ═══════════════════════════════════════════════════════════════════════ */

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} className="px-4 py-4 md:px-7 md:py-6 bg-surface-bg dark:bg-surface-bg-dark min-h-screen">
      {/* Page Header */}
      <div className="flex flex-wrap justify-between items-center gap-3 mb-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand-500/[0.12] flex items-center justify-center">
            <Wallet size={20} className="text-brand-500" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-content dark:text-content-dark m-0">{L('المالية', 'Finance')}</h1>
            <p className="text-xs text-content-muted dark:text-content-muted-dark mt-1 mb-0">{L('النظام المحاسبي الشامل', 'Comprehensive Accounting System')}</p>
          </div>
        </div>
        <ExportButton
          data={activeTab === 'journal' ? journalEntries : activeTab === 'invoices' ? invoices : activeTab === 'commissions' ? [...companyComm, ...agentComm] : activeTab === 'expenses' ? expenses : journalEntries}
          filename={isRTL ? 'المالية' : 'finance'}
          title={isRTL ? 'المالية' : 'Finance'}
          columns={[
            { header: isRTL ? 'التاريخ' : 'Date', key: 'date' },
            { header: isRTL ? 'الوصف' : 'Description', key: 'description' },
            { header: isRTL ? 'المبلغ' : 'Amount', key: 'amount' },
            { header: isRTL ? 'الحالة' : 'Status', key: 'status' },
          ]}
        />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-5 bg-surface-card dark:bg-surface-card-dark rounded-xl p-1 border border-edge dark:border-edge-dark w-full md:w-fit overflow-x-auto">
        {TABS.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-[7px] px-4 py-[7px] rounded-[7px] border-none cursor-pointer text-xs font-medium transition-all duration-150 whitespace-nowrap
              ${activeTab === tab.id
                ? 'bg-brand-500 text-white'
                : 'bg-transparent text-content-muted dark:text-content-muted-dark'
              }`}
          >
            <tab.Icon size={14} />
            {L(tab.ar, tab.en)}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && renderOverview()}
      {activeTab === 'coa' && renderCOA()}
      {activeTab === 'journal' && renderJournal()}
      {activeTab === 'invoices' && renderInvoices()}
      {activeTab === 'commissions' && renderCommissions()}
      {activeTab === 'expenses' && renderExpenses()}
      {activeTab === 'reports' && renderReports()}
      {activeTab === 'budget' && renderBudget()}

      {/* Modals */}
      {renderJournalModal()}
      {renderInvoiceModal()}
      {showJournalModal && <AddJournalModal L={L} onClose={() => setShowJournalModal(false)} onSave={async (entry) => { const saved = await svcCreateJournalEntry(entry); setJournalEntries(prev => [saved, ...prev]); setShowJournalModal(false); }} entryCount={journalEntries.length} chartOfAccounts={chartOfAccounts} />}
      {showExpenseModal && <AddExpenseModal L={L} onClose={() => setShowExpenseModal(false)} onSave={async (exp) => { const saved = await svcCreateExpense(exp); setExpenses(prev => [saved, ...prev]); setShowExpenseModal(false); }} expCount={expenses.length} />}
    </div>
  );
}
