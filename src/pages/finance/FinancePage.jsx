import { useState, useMemo } from 'react';
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
  CHART_OF_ACCOUNTS, MOCK_JOURNAL_ENTRIES, MOCK_INVOICES,
  MOCK_COMPANY_COMMISSIONS, MOCK_AGENT_COMMISSIONS,
  MOCK_EXPENSES as MOCK_EXPENSES_DATA, MONTHLY_REVENUE, MOCK_BUDGET,
  fmtMoney, fmtShort, calcAccountBalance,
} from '../../data/finance_mock_data';

/* ═══════════════════════════════════════════════════════════════════════════
   Design System (matches HR pages canonical pattern)
   ═══════════════════════════════════════════════════════════════════════════ */

function useDS() {
  const { theme } = useTheme();
  const dark = theme === 'dark';
  return {
    dark,
    bg:       dark ? '#152232' : '#F0F4F8',
    card:     dark ? '#1a2234' : '#ffffff',
    border:   dark ? 'rgba(74,122,171,0.2)' : '#E2E8F0',
    text:     dark ? '#E2EAF4' : '#1A2B3C',
    muted:    dark ? '#8BA8C8' : '#64748B',
    input:    dark ? '#0F1E2D' : '#ffffff',
    rowHover: dark ? 'rgba(74,122,171,0.07)' : '#F8FAFC',
    thBg:     dark ? 'rgba(74,122,171,0.08)' : '#F8FAFC',
    accent:   '#4A7AAB',
    primary:  '#2B4C6F',
    deep:     '#1B3347',
  };
}

/* ── Shared sub-components ──────────────────────────────────────────────── */

function TR({ children, onClick, style = {} }) {
  const ds = useDS();
  const [hov, setHov] = useState(false);
  return (
    <tr
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      onClick={onClick}
      style={{ borderBottom: `1px solid ${ds.border}`, background: hov ? ds.rowHover : 'transparent', transition: 'background 0.15s', cursor: onClick ? 'pointer' : 'default', ...style }}
    >{children}</tr>
  );
}

function KpiCard({ icon: Icon, label, value, sub, color = '#4A7AAB' }) {
  const ds = useDS();
  const [hov, setHov] = useState(false);
  return (
    <div onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)} style={{
      background: ds.card, borderRadius: 14, border: `1px solid ${hov ? color + '60' : ds.border}`,
      padding: '18px 20px', position: 'relative', overflow: 'hidden',
      transform: hov ? 'translateY(-2px)' : 'translateY(0)',
      boxShadow: hov ? `0 8px 24px ${color}22` : '0 1px 3px rgba(0,0,0,0.06)',
      transition: 'all 0.2s ease',
    }}>
      <div style={{ position: 'absolute', top: 0, right: 0, width: 4, height: '100%', background: `linear-gradient(180deg, ${color}, transparent)`, borderRadius: '14px 0 0 14px', opacity: hov ? 1 : 0.6, transition: 'opacity 0.2s' }} />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <p style={{ margin: '0 0 6px', fontSize: 12, color: ds.muted, fontWeight: 500 }}>{label}</p>
          <p style={{ margin: 0, fontSize: 26, fontWeight: 800, color: ds.text, lineHeight: 1 }}>{value}</p>
          {sub && <p style={{ margin: '3px 0 0', fontSize: 11, color: ds.muted }}>{sub}</p>}
        </div>
        <div style={{ width: 42, height: 42, borderRadius: 11, background: color + (hov ? '25' : '15'), display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 0.2s' }}>
          <Icon size={20} color={color} />
        </div>
      </div>
    </div>
  );
}

function Badge({ label, color }) {
  return (
    <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 20, background: color + '18', color, border: `1px solid ${color}35`, fontWeight: 600, whiteSpace: 'nowrap' }}>
      {label}
    </span>
  );
}

function AddBtn({ label, onClick }) {
  const [hov, setHov] = useState(false);
  return (
    <button onClick={onClick} onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)} style={{
      display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 8,
      border: 'none', background: hov ? '#2B4C6F' : '#1B3347', color: '#fff',
      fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: 'background 0.15s',
    }}>
      <Plus size={14} />{label}
    </button>
  );
}

function FilterPill({ label, active, onClick }) {
  const ds = useDS();
  return (
    <button onClick={onClick} style={{
      padding: '5px 12px', borderRadius: 6, border: `1px solid ${active ? ds.accent : ds.border}`,
      background: active ? ds.accent + '15' : 'transparent', color: active ? ds.accent : ds.muted,
      fontSize: 12, cursor: 'pointer', fontWeight: active ? 600 : 400, transition: 'all 0.15s',
    }}>{label}</button>
  );
}

function SearchBox({ value, onChange, placeholder }) {
  const ds = useDS();
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px', borderRadius: 8, border: `1px solid ${ds.border}`, background: ds.input }}>
      <Search size={13} color={ds.muted} />
      <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        style={{ border: 'none', outline: 'none', background: 'transparent', fontSize: 12, color: ds.text, width: 140 }} />
    </div>
  );
}

function TH({ children }) {
  const ds = useDS();
  return (
    <th style={{ padding: '10px 12px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: ds.muted, textAlign: 'inherit', borderBottom: `2px solid ${ds.border}`, background: ds.thBg }}>
      {children}
    </th>
  );
}

function TD({ children, bold, color, style = {} }) {
  const ds = useDS();
  return (
    <td style={{ padding: '10px 12px', fontSize: 13, fontWeight: bold ? 700 : 400, color: color || ds.text, ...style }}>
      {children}
    </td>
  );
}

function Empty({ icon: Icon, title, sub }) {
  const ds = useDS();
  return (
    <tr><td colSpan={99} style={{ textAlign: 'center', padding: '60px 20px' }}>
      <div style={{ width: 64, height: 64, borderRadius: 16, background: 'rgba(74,122,171,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
        <Icon size={24} color="#4A7AAB" />
      </div>
      <p style={{ margin: '0 0 6px', fontSize: 15, fontWeight: 700, color: ds.text }}>{title}</p>
      <p style={{ margin: 0, fontSize: 13, color: ds.muted }}>{sub}</p>
    </td></tr>
  );
}

function CardWrap({ title, icon: Icon, headerRight, children }) {
  const ds = useDS();
  return (
    <div style={{ background: ds.card, borderRadius: 14, border: `1px solid ${ds.border}`, overflow: 'hidden' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 18px', borderBottom: `1px solid ${ds.border}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {Icon && <Icon size={16} color={ds.accent} />}
          <span style={{ fontSize: 14, fontWeight: 700, color: ds.text }}>{title}</span>
        </div>
        {headerRight}
      </div>
      <div style={{ padding: 0 }}>{children}</div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   ADD JOURNAL ENTRY MODAL (proper component — hooks safe)
   ═══════════════════════════════════════════════════════════════════════════ */

function AddJournalModal({ ds, L, onClose, onSave, entryCount }) {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [desc, setDesc] = useState('');
  const [ref, setRef] = useState('');
  const [lines, setLines] = useState([
    { account_id: '', debit: '', credit: '' },
    { account_id: '', debit: '', credit: '' },
  ]);

  const leafAccounts = CHART_OF_ACCOUNTS.filter(a => !a.is_group);
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

  const inputStyle = { width: '100%', padding: '8px 10px', borderRadius: 8, border: `1px solid ${ds.border}`, background: ds.input, color: ds.text, fontSize: 13, outline: 'none' };

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: ds.card, borderRadius: 16, border: `1px solid ${ds.border}`, width: '100%', maxWidth: 700, maxHeight: '85vh', overflow: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: `1px solid ${ds.border}` }}>
          <span style={{ fontSize: 16, fontWeight: 700, color: ds.text }}>{L('قيد يومية جديد', 'New Journal Entry')}</span>
          <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: 8, border: `1px solid ${ds.border}`, background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={16} color={ds.muted} /></button>
        </div>
        <div style={{ padding: 20 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
            <div>
              <label style={{ fontSize: 11, color: ds.muted, marginBottom: 4, display: 'block' }}>{L('التاريخ', 'Date')}</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)} style={inputStyle} />
            </div>
            <div>
              <label style={{ fontSize: 11, color: ds.muted, marginBottom: 4, display: 'block' }}>{L('المرجع', 'Reference')}</label>
              <input value={ref} onChange={e => setRef(e.target.value)} placeholder={L('اختياري', 'Optional')} style={inputStyle} />
            </div>
            <div style={{ gridColumn: '1/-1' }}>
              <label style={{ fontSize: 11, color: ds.muted, marginBottom: 4, display: 'block' }}>{L('الوصف', 'Description')} *</label>
              <input value={desc} onChange={e => setDesc(e.target.value)} placeholder={L('وصف القيد...', 'Entry description...')} style={inputStyle} />
            </div>
          </div>
          <div style={{ fontSize: 13, fontWeight: 700, color: ds.text, marginBottom: 8 }}>{L('بنود القيد', 'Entry Lines')}</div>
          <div style={{ border: `1px solid ${ds.border}`, borderRadius: 10, overflow: 'hidden', marginBottom: 12 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr style={{ background: ds.thBg }}>
                <TH>{L('الحساب', 'Account')}</TH>
                <TH>{L('مدين', 'Debit')}</TH>
                <TH>{L('دائن', 'Credit')}</TH>
                <th style={{ width: 36 }} />
              </tr></thead>
              <tbody>
                {lines.map((l, i) => (
                  <tr key={i} style={{ borderBottom: `1px solid ${ds.border}` }}>
                    <td style={{ padding: '6px 8px' }}>
                      <select value={l.account_id} onChange={e => updateLine(i, 'account_id', e.target.value)} style={{ ...inputStyle, padding: '6px 8px' }}>
                        <option value="">{L('اختر حساب...', 'Select account...')}</option>
                        {leafAccounts.map(a => <option key={a.id} value={a.id}>{a.code} — {L(a.name_ar, a.name_en)}</option>)}
                      </select>
                    </td>
                    <td style={{ padding: '6px 8px' }}><input type="number" value={l.debit} onChange={e => updateLine(i, 'debit', e.target.value)} placeholder="0" style={{ ...inputStyle, padding: '6px 8px', width: 100 }} /></td>
                    <td style={{ padding: '6px 8px' }}><input type="number" value={l.credit} onChange={e => updateLine(i, 'credit', e.target.value)} placeholder="0" style={{ ...inputStyle, padding: '6px 8px', width: 100 }} /></td>
                    <td style={{ padding: '6px 4px' }}>
                      {lines.length > 2 && <button onClick={() => removeLine(i)} style={{ width: 28, height: 28, borderRadius: 6, border: 'none', background: 'rgba(239,68,68,0.1)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={12} color="#EF4444" /></button>}
                    </td>
                  </tr>
                ))}
                <tr style={{ background: ds.thBg }}>
                  <td style={{ padding: '8px 12px', fontSize: 13, fontWeight: 700, color: ds.text }}>{L('الإجمالي', 'Total')}</td>
                  <td style={{ padding: '8px 12px', fontSize: 13, fontWeight: 700, color: '#2B4C6F' }}>{fmtMoney(totalDebit)}</td>
                  <td style={{ padding: '8px 12px', fontSize: 13, fontWeight: 700, color: '#EF4444' }}>{fmtMoney(totalCredit)}</td>
                  <td />
                </tr>
              </tbody>
            </table>
          </div>
          <button onClick={addLine} style={{ padding: '6px 14px', borderRadius: 6, border: `1px dashed ${ds.border}`, background: 'transparent', color: ds.accent, fontSize: 12, cursor: 'pointer', fontWeight: 600, marginBottom: 12 }}>
            + {L('إضافة سطر', 'Add Line')}
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 8, background: balanced ? 'rgba(43,76,111,0.08)' : totalDebit > 0 ? 'rgba(239,68,68,0.08)' : 'transparent', marginBottom: 16 }}>
            {totalDebit > 0 && (balanced
              ? <><CheckCircle size={14} color="#2B4C6F" /><span style={{ fontSize: 12, fontWeight: 600, color: '#2B4C6F' }}>{L('القيد متوازن ✓', 'Balanced ✓')}</span></>
              : <><AlertTriangle size={14} color="#EF4444" /><span style={{ fontSize: 12, fontWeight: 600, color: '#EF4444' }}>{L('الفرق: ', 'Diff: ')}{fmtMoney(Math.abs(totalDebit - totalCredit))}</span></>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button onClick={onClose} style={{ padding: '8px 16px', borderRadius: 8, border: `1px solid ${ds.border}`, background: 'transparent', color: ds.muted, fontSize: 13, cursor: 'pointer' }}>{L('إلغاء', 'Cancel')}</button>
            <button onClick={handleSave} disabled={!balanced || !desc} style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: balanced && desc ? '#1B3347' : ds.border, color: balanced && desc ? '#fff' : ds.muted, fontSize: 13, fontWeight: 600, cursor: balanced && desc ? 'pointer' : 'not-allowed' }}>{L('حفظ كمسودة', 'Save as Draft')}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   ADD EXPENSE MODAL (proper component — hooks safe)
   ═══════════════════════════════════════════════════════════════════════════ */

function AddExpenseModal({ ds, L, onClose, onSave, expCount }) {
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

  const inputStyle = { width: '100%', padding: '8px 10px', borderRadius: 8, border: `1px solid ${ds.border}`, background: ds.input, color: ds.text, fontSize: 13, outline: 'none' };

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: ds.card, borderRadius: 16, border: `1px solid ${ds.border}`, width: '100%', maxWidth: 520, maxHeight: '85vh', overflow: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: `1px solid ${ds.border}` }}>
          <span style={{ fontSize: 16, fontWeight: 700, color: ds.text }}>{L('مصروف جديد', 'New Expense')}</span>
          <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: 8, border: `1px solid ${ds.border}`, background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={16} color={ds.muted} /></button>
        </div>
        <div style={{ padding: 20 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
            <div>
              <label style={{ fontSize: 11, color: ds.muted, marginBottom: 4, display: 'block' }}>{L('الفئة', 'Category')} *</label>
              <select value={cat} onChange={e => setCat(e.target.value)} style={inputStyle}>
                <option value="">{L('اختر...', 'Select...')}</option>
                {Object.entries(EXPENSE_CATEGORIES).map(([k, v]) => <option key={k} value={k}>{L(v.ar, v.en)}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 11, color: ds.muted, marginBottom: 4, display: 'block' }}>{L('طريقة الدفع', 'Payment Method')}</label>
              <select value={method} onChange={e => setMethod(e.target.value)} style={inputStyle}>
                {Object.entries(PAYMENT_METHODS).map(([k, v]) => <option key={k} value={k}>{L(v.ar, v.en)}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 11, color: ds.muted, marginBottom: 4, display: 'block' }}>{L('المورد', 'Vendor')} *</label>
              <input value={vendor} onChange={e => setVendor(e.target.value)} placeholder={L('اسم المورد...', 'Vendor name...')} style={inputStyle} />
            </div>
            <div>
              <label style={{ fontSize: 11, color: ds.muted, marginBottom: 4, display: 'block' }}>{L('المبلغ', 'Amount')} *</label>
              <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0" style={inputStyle} />
            </div>
            <div>
              <label style={{ fontSize: 11, color: ds.muted, marginBottom: 4, display: 'block' }}>{L('التاريخ', 'Date')}</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)} style={inputStyle} />
            </div>
            <div>
              <label style={{ fontSize: 11, color: ds.muted, marginBottom: 4, display: 'block' }}>{L('الوصف', 'Description')}</label>
              <input value={descVal} onChange={e => setDescVal(e.target.value)} placeholder={L('تفاصيل...', 'Details...')} style={inputStyle} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button onClick={onClose} style={{ padding: '8px 16px', borderRadius: 8, border: `1px solid ${ds.border}`, background: 'transparent', color: ds.muted, fontSize: 13, cursor: 'pointer' }}>{L('إلغاء', 'Cancel')}</button>
            <button onClick={handleSave} disabled={!valid} style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: valid ? '#1B3347' : ds.border, color: valid ? '#fff' : ds.muted, fontSize: 13, fontWeight: 600, cursor: valid ? 'pointer' : 'not-allowed' }}>{L('حفظ', 'Save')}</button>
          </div>
        </div>
      </div>
    </div>
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
  const ds = useDS();
  const { i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const L = (ar, en) => isRTL ? ar : en;

  const [activeTab, setActiveTab] = useState('overview');

  // State
  const [journalEntries, setJournalEntries] = useState(MOCK_JOURNAL_ENTRIES);
  const [invoices, setInvoices] = useState(MOCK_INVOICES);
  const [companyComm, setCompanyComm] = useState(MOCK_COMPANY_COMMISSIONS);
  const [agentComm, setAgentComm] = useState(MOCK_AGENT_COMMISSIONS);
  const [expenses, setExpenses] = useState(MOCK_EXPENSES_DATA);

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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* KPI Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14 }}>
        <KpiCard icon={TrendingUp} label={L('إيرادات الشهر', 'Monthly Revenue')} value={fmtShort(totalRevenue)} sub="EGP" color="#4A7AAB" />
        <KpiCard icon={TrendingDown} label={L('إجمالي المصروفات', 'Total Expenses')} value={fmtShort(totalExpenseAmt)} sub="EGP" color="#EF4444" />
        <KpiCard icon={DollarSign} label={L('ذمم مدينة (مطورين)', 'Receivable (Devs)')} value={fmtShort(receivable)} sub="EGP" color="#2B4C6F" />
        <KpiCard icon={Wallet} label={L('عمولات سيلز مستحقة', 'Agent Comm. Payable')} value={fmtShort(payable)} sub="EGP" color="#6B8DB5" />
      </div>

      {/* Revenue Chart + Expense Breakdown */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 16 }}>
        {/* Bar Chart */}
        <CardWrap title={L('الإيرادات مقابل المصروفات', 'Revenue vs Expenses')} icon={BarChart2}>
          <div style={{ padding: '16px 18px' }}>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, height: 140, paddingBottom: 8 }}>
              {MONTHLY_REVENUE.map((m, i) => {
                const revH = Math.round((m.revenue / maxRevenue) * 120);
                const expH = Math.round((m.expenses / maxRevenue) * 120);
                const isLast = i === MONTHLY_REVENUE.length - 1;
                return (
                  <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 120 }}>
                      <div style={{ width: '40%', height: revH, background: isLast ? '#4A7AAB' : '#4A7AAB60', borderRadius: '3px 3px 0 0', transition: 'height 0.4s' }} title={fmtMoney(m.revenue)} />
                      <div style={{ width: '40%', height: expH, background: isLast ? '#EF4444' : '#EF444440', borderRadius: '3px 3px 0 0', transition: 'height 0.4s' }} title={fmtMoney(m.expenses)} />
                    </div>
                    <span style={{ fontSize: 10, color: ds.muted }}>{L(m.month_ar, m.month_en)}</span>
                  </div>
                );
              })}
            </div>
            <div style={{ display: 'flex', gap: 16, marginTop: 8, justifyContent: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <div style={{ width: 10, height: 10, borderRadius: 2, background: '#4A7AAB' }} />
                <span style={{ fontSize: 11, color: ds.muted }}>{L('الإيرادات', 'Revenue')}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <div style={{ width: 10, height: 10, borderRadius: 2, background: '#EF4444' }} />
                <span style={{ fontSize: 11, color: ds.muted }}>{L('المصروفات', 'Expenses')}</span>
              </div>
            </div>
          </div>
        </CardWrap>

        {/* Budget vs Actual */}
        <CardWrap title={L('الموازنة مقابل الفعلي', 'Budget vs Actual')} icon={PieChart}>
          <div style={{ padding: '12px 18px' }}>
            {MOCK_BUDGET.slice(0, 5).map((b, i) => {
              const pct = b.budget_ytd ? Math.round((b.actual_ytd / b.budget_ytd) * 100) : 0;
              const over = pct > 100;
              return (
                <div key={b.id} style={{ marginBottom: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                    <span style={{ fontSize: 12, color: ds.text }}>{L(b.cat_ar, b.cat_en)}</span>
                    <span style={{ fontSize: 11, color: over ? '#EF4444' : ds.muted, fontWeight: 600 }}>{pct}%</span>
                  </div>
                  <div style={{ height: 5, borderRadius: 3, background: ds.dark ? 'rgba(255,255,255,0.08)' : '#E5E7EB' }}>
                    <div style={{ height: '100%', width: Math.min(pct, 100) + '%', borderRadius: 3, background: over ? '#EF4444' : '#4A7AAB', transition: 'width 0.4s' }} />
                  </div>
                </div>
              );
            })}
          </div>
        </CardWrap>
      </div>

      {/* Commission + Invoice Quick Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {/* Company Commissions Summary */}
        <CardWrap title={L('ملخص عمولات المطورين', 'Developer Commission Summary')} icon={Building2}>
          <div style={{ padding: '12px 18px' }}>
            {[
              { label: L('معلق', 'Pending'), val: companyComm.filter(c => c.status === 'pending').reduce((s, c) => s + c.amount, 0), color: '#6B8DB5' },
              { label: L('معتمد', 'Approved'), val: companyComm.filter(c => c.status === 'approved').reduce((s, c) => s + c.amount, 0), color: '#4A7AAB' },
              { label: L('محصّل', 'Collected'), val: companyComm.filter(c => c.status === 'paid').reduce((s, c) => s + c.amount, 0), color: '#2B4C6F' },
            ].map((row, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: i < 2 ? `1px solid ${ds.border}` : 'none' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: row.color }} />
                  <span style={{ fontSize: 13, color: ds.muted }}>{row.label}</span>
                </div>
                <span style={{ fontSize: 14, fontWeight: 700, color: row.color }}>{fmtMoney(row.val)}</span>
              </div>
            ))}
          </div>
        </CardWrap>

        {/* Overdue Invoices */}
        <CardWrap title={L('فواتير تحتاج متابعة', 'Invoices Needing Attention')} icon={AlertTriangle}>
          <div style={{ padding: '12px 18px' }}>
            {invoices.filter(inv => inv.status === 'overdue' || inv.status === 'sent').slice(0, 4).map((inv, i) => (
              <div key={inv.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: i < 3 ? `1px solid ${ds.border}` : 'none' }}>
                <div>
                  <div style={{ fontSize: 13, color: ds.text, fontWeight: 500 }}>{L(inv.counterparty_ar, inv.counterparty_en)}</div>
                  <div style={{ fontSize: 11, color: ds.muted }}>{inv.number}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: ds.text }}>{fmtMoney(inv.total - inv.paid)}</div>
                  <Badge label={L(INVOICE_STATUS[inv.status].ar, INVOICE_STATUS[inv.status].en)} color={INVOICE_STATUS[inv.status].color} />
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
      const children = CHART_OF_ACCOUNTS.filter(a => a.parent_id === acc.id);
      const hasChildren = children.length > 0;
      const expanded = coaExpanded[acc.id];
      const typeInfo = ACCOUNT_TYPES[acc.type];
      const balance = !acc.is_group ? calcAccountBalance(journalEntries, acc.id) : null;

      return [
        <TR key={acc.id} onClick={hasChildren ? () => toggleExpand(acc.id) : undefined}>
          <TD style={{ paddingLeft: 12 + level * 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {hasChildren ? (
                expanded ? <ChevronDown size={14} color={ds.muted} /> : <ChevronRight size={14} color={ds.muted} />
              ) : <div style={{ width: 14 }} />}
              <span style={{ fontWeight: acc.is_group ? 700 : 400, color: acc.is_group ? ds.text : ds.text }}>
                {L(acc.name_ar, acc.name_en)}
              </span>
            </div>
          </TD>
          <TD bold color={ds.muted}>{acc.code}</TD>
          <TD><Badge label={L(typeInfo.ar, typeInfo.en)} color={typeInfo.color} /></TD>
          <TD bold color={balance !== null && balance !== 0 ? (balance > 0 ? '#2B4C6F' : '#EF4444') : ds.muted}>
            {balance !== null ? fmtMoney(Math.abs(balance)) : '—'}
          </TD>
          <TD color={ds.muted}>{balance !== null ? L(typeInfo.normal === 'debit' ? (balance >= 0 ? 'مدين' : 'دائن') : (balance <= 0 ? 'دائن' : 'مدين'), typeInfo.normal === 'debit' ? (balance >= 0 ? 'Dr' : 'Cr') : (balance <= 0 ? 'Cr' : 'Dr')) : '—'}</TD>
        </TR>,
        ...(hasChildren && expanded ? children.flatMap(child => renderRow(child, level + 1)) : []),
      ];
    };

    const rootAccounts = CHART_OF_ACCOUNTS.filter(a => a.parent_id === null);

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* KPIs per account type */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 12 }}>
          {Object.entries(ACCOUNT_TYPES).map(([key, info]) => {
            const count = CHART_OF_ACCOUNTS.filter(a => a.type === key && !a.is_group).length;
            return <KpiCard key={key} icon={FolderTree} label={L(info.ar, info.en)} value={count} sub={L('حساب', 'accounts')} color={info.color} />;
          })}
        </div>

        <CardWrap title={L('شجرة الحسابات', 'Chart of Accounts')} icon={FolderTree}
          headerRight={<AddBtn label={L('حساب جديد', 'New Account')} />}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <TH>{L('الحساب', 'Account')}</TH>
                  <TH>{L('الكود', 'Code')}</TH>
                  <TH>{L('النوع', 'Type')}</TH>
                  <TH>{L('الرصيد', 'Balance')}</TH>
                  <TH>{L('الطبيعة', 'Side')}</TH>
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
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14 }}>
          <KpiCard icon={BookOpen} label={L('إجمالي القيود', 'Total Entries')} value={journalEntries.length} color="#4A7AAB" />
          <KpiCard icon={CheckCircle} label={L('مرحّلة', 'Posted')} value={postedEntries.length} color="#2B4C6F" />
          <KpiCard icon={Clock} label={L('مسودات', 'Drafts')} value={draftCount} color="#6B8DB5" />
          <KpiCard icon={DollarSign} label={L('إجمالي المبالغ المرحّلة', 'Total Posted Amount')} value={fmtShort(totalPosted)} sub="EGP" color="#1B3347" />
        </div>

        <CardWrap title={L('القيود اليومية', 'Journal Entries')} icon={BookOpen}
          headerRight={
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <SearchBox value={journalSearch} onChange={setJournalSearch} placeholder={L('بحث...', 'Search...')} />
              <AddBtn label={L('قيد جديد', 'New Entry')} onClick={() => setShowJournalModal(true)} />
            </div>
          }>
          {/* Filter pills */}
          <div style={{ display: 'flex', gap: 6, padding: '12px 18px', borderBottom: `1px solid ${ds.border}` }}>
            {[
              { id: 'all', label: L('الكل', 'All') },
              { id: 'posted', label: L('مرحّل', 'Posted') },
              { id: 'draft', label: L('مسودة', 'Draft') },
              { id: 'voided', label: L('ملغي', 'Voided') },
            ].map(f => <FilterPill key={f.id} label={f.label} active={journalFilter === f.id} onClick={() => setJournalFilter(f.id)} />)}
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr>
                <TH>{L('رقم القيد', 'Entry #')}</TH>
                <TH>{L('التاريخ', 'Date')}</TH>
                <TH>{L('الوصف', 'Description')}</TH>
                <TH>{L('المرجع', 'Reference')}</TH>
                <TH>{L('المبلغ', 'Amount')}</TH>
                <TH>{L('الحالة', 'Status')}</TH>
                <TH>{L('إجراء', 'Action')}</TH>
              </tr></thead>
              <tbody>
                {filtered.length === 0
                  ? <Empty icon={BookOpen} title={L('لا توجد قيود', 'No Entries')} sub={L('لم يتم تسجيل أي قيود بعد', 'No journal entries found')} />
                  : filtered.map(entry => {
                    const st = JOURNAL_STATUS[entry.status];
                    return (
                      <TR key={entry.id} onClick={() => setViewJournal(entry)}>
                        <TD bold color={ds.accent}>{entry.entry_number}</TD>
                        <TD color={ds.muted}>{entry.date}</TD>
                        <TD>{L(entry.description_ar, entry.description_en)}</TD>
                        <TD color={ds.muted}>{entry.reference || '—'}</TD>
                        <TD bold>{fmtMoney(entry.total)}</TD>
                        <TD><Badge label={L(st.ar, st.en)} color={st.color} /></TD>
                        <TD>
                          {entry.status === 'draft' && (
                            <div style={{ display: 'flex', gap: 6 }}>
                              <button onClick={e => { e.stopPropagation(); setJournalEntries(prev => prev.map(je => je.id === entry.id ? { ...je, status: 'posted' } : je)); }}
                                style={{ padding: '3px 10px', borderRadius: 6, border: 'none', background: '#2B4C6F', color: '#fff', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
                                {L('ترحيل', 'Post')}
                              </button>
                            </div>
                          )}
                        </TD>
                      </TR>
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
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14 }}>
          <KpiCard icon={TrendingUp} label={L('فواتير بيع', 'Sales Invoices')} value={fmtShort(salesTotal)} sub="EGP" color="#4A7AAB" />
          <KpiCard icon={TrendingDown} label={L('فواتير شراء', 'Purchase Bills')} value={fmtShort(purchaseTotal)} sub="EGP" color="#EF4444" />
          <KpiCard icon={AlertTriangle} label={L('متأخرات', 'Overdue')} value={fmtShort(overdueTotal)} sub="EGP" color="#EF4444" />
          <KpiCard icon={Receipt} label={L('ضرائب', 'Tax')} value={fmtShort(taxTotal)} sub="EGP" color="#6B8DB5" />
        </div>

        <CardWrap title={L('الفواتير', 'Invoices')} icon={FileText}
          headerRight={<AddBtn label={L('فاتورة جديدة', 'New Invoice')} onClick={() => setShowInvoiceModal(true)} />}>
          <div style={{ display: 'flex', gap: 6, padding: '12px 18px', borderBottom: `1px solid ${ds.border}`, flexWrap: 'wrap' }}>
            {/* Type filters */}
            {[
              { id: 'all', label: L('الكل', 'All') },
              { id: 'sales', label: L('بيع', 'Sales') },
              { id: 'purchase', label: L('شراء', 'Purchase') },
            ].map(f => <FilterPill key={f.id} label={f.label} active={invoiceType === f.id} onClick={() => setInvoiceType(f.id)} />)}
            <div style={{ width: 1, height: 24, background: ds.border, margin: '0 4px' }} />
            {/* Status filters */}
            {[
              { id: 'all', label: L('كل الحالات', 'All Status') },
              { id: 'sent', label: L('مرسلة', 'Sent') },
              { id: 'paid', label: L('مدفوعة', 'Paid') },
              { id: 'overdue', label: L('متأخرة', 'Overdue') },
            ].map(f => <FilterPill key={'s-' + f.id} label={f.label} active={invoiceFilter === f.id} onClick={() => setInvoiceFilter(f.id)} />)}
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr>
                <TH>{L('رقم الفاتورة', 'Invoice #')}</TH>
                <TH>{L('النوع', 'Type')}</TH>
                <TH>{L('الطرف', 'Counterparty')}</TH>
                <TH>{L('التاريخ', 'Date')}</TH>
                <TH>{L('الاستحقاق', 'Due Date')}</TH>
                <TH>{L('المبلغ', 'Total')}</TH>
                <TH>{L('المدفوع', 'Paid')}</TH>
                <TH>{L('الحالة', 'Status')}</TH>
              </tr></thead>
              <tbody>
                {filtered.length === 0
                  ? <Empty icon={FileText} title={L('لا توجد فواتير', 'No Invoices')} sub={L('لم يتم تسجيل أي فواتير بعد', 'No invoices found')} />
                  : filtered.map(inv => {
                    const st = INVOICE_STATUS[inv.status];
                    return (
                      <TR key={inv.id} onClick={() => setViewInvoice(inv)}>
                        <TD bold color={ds.accent}>{inv.number}</TD>
                        <TD><Badge label={inv.type === 'sales' ? L('بيع', 'Sales') : L('شراء', 'Purchase')} color={inv.type === 'sales' ? '#4A7AAB' : '#6B8DB5'} /></TD>
                        <TD>{L(inv.counterparty_ar, inv.counterparty_en)}</TD>
                        <TD color={ds.muted}>{inv.date}</TD>
                        <TD color={inv.status === 'overdue' ? '#EF4444' : ds.muted} bold={inv.status === 'overdue'}>{inv.due_date}</TD>
                        <TD bold>{fmtMoney(inv.total)}</TD>
                        <TD color={inv.paid > 0 ? '#2B4C6F' : ds.muted}>{fmtMoney(inv.paid)}</TD>
                        <TD><Badge label={L(st.ar, st.en)} color={st.color} /></TD>
                      </TR>
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
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14 }}>
          <KpiCard icon={Clock} label={L('معلق', 'Pending')} value={fmtShort(pendingAmt)} sub="EGP" color="#6B8DB5" />
          <KpiCard icon={CheckCircle} label={L('معتمد', 'Approved')} value={fmtShort(approvedAmt)} sub="EGP" color="#4A7AAB" />
          <KpiCard icon={DollarSign} label={L('مصروف', 'Paid')} value={fmtShort(paidAmt)} sub="EGP" color="#2B4C6F" />
        </div>

        <CardWrap
          title={L('العمولات', 'Commissions')}
          icon={DollarSign}
          headerRight={
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              {/* Company / Agent toggle */}
              <div style={{ display: 'flex', background: ds.dark ? 'rgba(74,122,171,0.1)' : '#F1F5F9', borderRadius: 8, padding: 3 }}>
                {[
                  { id: 'company', label: L('عمولات المطورين', 'Developer Comm.') },
                  { id: 'agent', label: L('عمولات السيلز', 'Agent Comm.') },
                ].map(t => (
                  <button key={t.id} onClick={() => { setCommTab(t.id); setCommFilter('all'); }}
                    style={{
                      padding: '5px 14px', borderRadius: 6, border: 'none', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                      background: commTab === t.id ? ds.accent : 'transparent',
                      color: commTab === t.id ? '#fff' : ds.muted,
                      transition: 'all 0.15s',
                    }}>{t.label}</button>
                ))}
              </div>
            </div>
          }
        >
          {/* Filters */}
          <div style={{ display: 'flex', gap: 6, padding: '12px 18px', borderBottom: `1px solid ${ds.border}` }}>
            {[
              { id: 'all', label: L('الكل', 'All') },
              { id: 'pending', label: L('معلق', 'Pending') },
              { id: 'approved', label: L('معتمد', 'Approved') },
              { id: 'paid', label: L('مصروف', 'Paid') },
            ].map(f => <FilterPill key={f.id} label={f.label} active={commFilter === f.id} onClick={() => setCommFilter(f.id)} />)}
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr>
                <TH>{isCompany ? L('المطوّر', 'Developer') : L('السيلز', 'Agent')}</TH>
                {isCompany && <TH>{L('المشروع', 'Project')}</TH>}
                <TH>{L('رقم الصفقة', 'Deal Ref')}</TH>
                <TH>{L('قيمة الصفقة', 'Deal Value')}</TH>
                <TH>{L('النسبة / الطريقة', 'Rate / Method')}</TH>
                <TH>{L('العمولة', 'Commission')}</TH>
                <TH>{L('الحالة', 'Status')}</TH>
                <TH>{L('إجراء', 'Action')}</TH>
              </tr></thead>
              <tbody>
                {filtered.length === 0
                  ? <Empty icon={DollarSign} title={L('لا توجد عمولات', 'No Commissions')} sub={L('لم يتم تسجيل أي عمولات بعد', 'No commission records found')} />
                  : filtered.map(row => {
                    const st = COMMISSION_STATUS[row.status];
                    return (
                      <TR key={row.id}>
                        <TD bold>{isCompany ? L(row.developer_ar, row.developer_en) : L(row.agent_ar, row.agent_en)}</TD>
                        {isCompany && <TD color={ds.muted}>{L(row.project_ar, row.project_en)}</TD>}
                        <TD color={ds.muted}>{row.deal_ref}</TD>
                        <TD>{fmtMoney(row.deal_value)}</TD>
                        <TD color={ds.muted}>
                          {isCompany
                            ? (row.rate * 100).toFixed(1) + '%'
                            : row.calc_method === 'per_million'
                              ? fmtMoney(row.rate) + L(' / مليون', ' / M')
                              : (row.rate * 100).toFixed(1) + '%'
                          }
                        </TD>
                        <TD bold color={ds.accent}>{fmtMoney(row.amount)}</TD>
                        <TD><Badge label={L(st.ar, st.en)} color={st.color} /></TD>
                        <TD>
                          {row.status === 'pending' && (
                            <div style={{ display: 'flex', gap: 6 }}>
                              <button onClick={() => handleAction(row.id, 'approved')}
                                style={{ padding: '3px 10px', borderRadius: 6, border: 'none', background: '#2B4C6F', color: '#fff', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
                                {L('اعتماد', 'Approve')}
                              </button>
                              <button onClick={() => handleAction(row.id, 'rejected')}
                                style={{ padding: '3px 10px', borderRadius: 6, border: `1px solid #EF4444`, background: 'transparent', color: '#EF4444', fontSize: 11, cursor: 'pointer' }}>
                                {L('رفض', 'Reject')}
                              </button>
                            </div>
                          )}
                          {row.status === 'approved' && (
                            <button onClick={() => handleAction(row.id, 'paid')}
                              style={{ padding: '3px 10px', borderRadius: 6, border: 'none', background: '#1B3347', color: '#fff', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
                              {isCompany ? L('تم التحصيل', 'Collected') : L('صرف', 'Pay')}
                            </button>
                          )}
                          {(row.status === 'paid' || row.status === 'rejected') && (
                            <span style={{ fontSize: 11, color: ds.muted }}>{row.status === 'paid' ? L('مكتمل', 'Done') : L('مرفوض', 'Rejected')}</span>
                          )}
                        </TD>
                      </TR>
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
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14 }}>
          <KpiCard icon={Receipt} label={L('إجمالي المصروفات', 'Total Expenses')} value={fmtShort(totalExpenseAmt)} sub="EGP" color="#EF4444" />
          <KpiCard icon={CheckCircle} label={L('معتمد + مدفوع', 'Approved + Paid')} value={fmtShort(approvedAmt)} sub="EGP" color="#4A7AAB" />
          <KpiCard icon={Clock} label={L('في الانتظار', 'Pending')} value={pendingExpenses.length} sub={fmtMoney(pendingAmt)} color="#6B8DB5" />
          <KpiCard icon={PieChart} label={L('أكبر بند', 'Largest Category')} value={sortedCats[0]?.[0] || '—'} sub={sortedCats[0] ? fmtMoney(sortedCats[0][1]) : ''} color="#2B4C6F" />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: 16 }}>
          {/* Main table */}
          <CardWrap title={L('سجل المصروفات', 'Expense Log')} icon={Receipt}
            headerRight={
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <SearchBox value={expSearch} onChange={setExpSearch} placeholder={L('بحث...', 'Search...')} />
                <AddBtn label={L('إضافة مصروف', 'Add Expense')} onClick={() => setShowExpenseModal(true)} />
              </div>
            }>
            <div style={{ display: 'flex', gap: 6, padding: '12px 18px', borderBottom: `1px solid ${ds.border}` }}>
              {[
                { id: 'all', label: L('الكل', 'All') },
                { id: 'pending', label: L('معلق', 'Pending') },
                { id: 'approved', label: L('معتمد', 'Approved') },
                { id: 'paid', label: L('مدفوع', 'Paid') },
              ].map(f => <FilterPill key={f.id} label={f.label} active={expFilter === f.id} onClick={() => setExpFilter(f.id)} />)}
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead><tr>
                  <TH>{L('الرقم', '#')}</TH>
                  <TH>{L('الفئة', 'Category')}</TH>
                  <TH>{L('المورد', 'Vendor')}</TH>
                  <TH>{L('الوصف', 'Description')}</TH>
                  <TH>{L('المبلغ', 'Amount')}</TH>
                  <TH>{L('الطريقة', 'Method')}</TH>
                  <TH>{L('الحالة', 'Status')}</TH>
                  <TH>{L('إجراء', 'Action')}</TH>
                </tr></thead>
                <tbody>
                  {filtered.length === 0
                    ? <Empty icon={Receipt} title={L('لا توجد مصروفات', 'No Expenses')} sub={L('لم يتم تسجيل أي مصروفات بعد', 'No expense records found')} />
                    : filtered.map(exp => {
                      const st = EXPENSE_STATUS[exp.status];
                      const cat = EXPENSE_CATEGORIES[exp.category];
                      const method = PAYMENT_METHODS[exp.method];
                      return (
                        <TR key={exp.id}>
                          <TD bold color={ds.accent}>{exp.number}</TD>
                          <TD>{cat ? L(cat.ar, cat.en) : exp.category}</TD>
                          <TD>{L(exp.vendor_ar, exp.vendor_en)}</TD>
                          <TD color={ds.muted}>{L(exp.desc_ar, exp.desc_en)}</TD>
                          <TD bold color="#EF4444">{fmtMoney(exp.amount)}</TD>
                          <TD color={ds.muted}>{method ? L(method.ar, method.en) : exp.method}</TD>
                          <TD><Badge label={L(st.ar, st.en)} color={st.color} /></TD>
                          <TD>
                            {exp.status === 'pending' && (
                              <div style={{ display: 'flex', gap: 6 }}>
                                <button onClick={() => setExpenses(prev => prev.map(e => e.id === exp.id ? { ...e, status: 'approved', approved_by_ar: 'المدير', approved_by_en: 'Manager' } : e))}
                                  style={{ padding: '3px 10px', borderRadius: 6, border: 'none', background: '#2B4C6F', color: '#fff', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
                                  {L('اعتماد', 'Approve')}
                                </button>
                                <button onClick={() => setExpenses(prev => prev.map(e => e.id === exp.id ? { ...e, status: 'rejected' } : e))}
                                  style={{ padding: '3px 10px', borderRadius: 6, border: '1px solid #EF4444', background: 'transparent', color: '#EF4444', fontSize: 11, cursor: 'pointer' }}>
                                  {L('رفض', 'Reject')}
                                </button>
                              </div>
                            )}
                            {exp.status === 'approved' && (
                              <button onClick={() => setExpenses(prev => prev.map(e => e.id === exp.id ? { ...e, status: 'paid' } : e))}
                                style={{ padding: '3px 10px', borderRadius: 6, border: 'none', background: '#1B3347', color: '#fff', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
                                {L('صرف', 'Pay')}
                              </button>
                            )}
                          </TD>
                        </TR>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </CardWrap>

          {/* Sidebar - Category breakdown */}
          <CardWrap title={L('توزيع المصروفات', 'By Category')} icon={PieChart}>
            <div style={{ padding: '12px 18px' }}>
              {sortedCats.map(([cat, amt], i) => {
                const pct = Math.round((amt / totalExpenseAmt) * 100);
                const barColors = ['#1B3347', '#2B4C6F', '#4A7AAB', '#6B8DB5', '#8BA8C8', '#EF4444'];
                return (
                  <div key={cat} style={{ marginBottom: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                      <span style={{ fontSize: 11, color: ds.text }}>{cat}</span>
                      <span style={{ fontSize: 11, fontWeight: 700, color: ds.text }}>{fmtShort(amt)}</span>
                    </div>
                    <div style={{ height: 5, borderRadius: 3, background: ds.dark ? 'rgba(255,255,255,0.08)' : '#E5E7EB' }}>
                      <div style={{ height: '100%', width: pct + '%', borderRadius: 3, background: barColors[i % barColors.length] }} />
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
      const children = CHART_OF_ACCOUNTS.filter(a => a.parent_id === parentId);
      let total = 0;
      children.forEach(c => {
        if (c.is_group) total += sumGroup(c.id);
        else total += bal(c.id);
      });
      return total;
    };

    // ── Balance Sheet data ──
    const totalAssets = sumGroup('acc-1000');
    const totalLiabilities = -sumGroup('acc-2000'); // liabilities have credit-normal, so negate
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

    // Actually compute properly
    const totalExpPosted = (() => {
      let t = 0;
      postedEntries.forEach(e => e.lines.forEach(l => { if (l.account_id.startsWith('acc-5')) t += l.debit - l.credit; }));
      return t;
    })();
    const netIncomeCalc = totalRevenue - totalExpPosted;

    // ── Income Statement data ──
    const revAccounts = CHART_OF_ACCOUNTS.filter(a => a.type === 'revenue' && !a.is_group);
    const expAccounts = CHART_OF_ACCOUNTS.filter(a => a.type === 'expense' && !a.is_group);

    // ── Cash Flow data ──
    const cashBal = bal('acc-1110');
    const bankCIB = bal('acc-1120');
    const bankNBE = bal('acc-1130');
    const totalCash = cashBal + bankCIB + bankNBE;

    // Cash inflows from revenue collections
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
        <div style={{ borderTop: `2px solid ${ds.border}`, margin: '8px 0' }} />
      );
      return (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: `6px 0 6px ${indent * 20}px`, borderBottom: `1px solid ${ds.border}20` }}>
          <span style={{ fontSize: 13, fontWeight: bold ? 700 : 400, color: bold ? ds.text : ds.muted }}>{label}</span>
          <span style={{ fontSize: 13, fontWeight: bold ? 800 : 600, color: negative ? '#EF4444' : amount === 0 ? ds.muted : bold ? ds.accent : ds.text }}>
            {fmtMoney(Math.abs(amount))}
          </span>
        </div>
      );
    };

    const ReportHeader = ({ title }) => (
      <div style={{ padding: '10px 0 6px', borderBottom: `2px solid ${ds.accent}40`, marginBottom: 4 }}>
        <span style={{ fontSize: 14, fontWeight: 800, color: ds.text, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{title}</span>
      </div>
    );

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Report selector */}
        <div style={{ display: 'flex', gap: 8 }}>
          {[
            { id: 'balance_sheet', label: L('الميزانية العمومية', 'Balance Sheet') },
            { id: 'income_statement', label: L('قائمة الدخل', 'Income Statement') },
            { id: 'cash_flow', label: L('التدفقات النقدية', 'Cash Flow') },
          ].map(r => <FilterPill key={r.id} label={r.label} active={reportView === r.id} onClick={() => setReportView(r.id)} />)}
        </div>

        {/* ── BALANCE SHEET ── */}
        {reportView === 'balance_sheet' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            {/* Left — Assets */}
            <CardWrap title={L('الميزانية العمومية', 'Balance Sheet')} icon={Layers}>
              <div style={{ padding: '16px 18px' }}>
                <div style={{ fontSize: 11, color: ds.muted, marginBottom: 12 }}>{L('كما في مارس 2026', 'As of March 2026')}</div>

                <ReportHeader title={L('الأصول', 'ASSETS')} />
                {CHART_OF_ACCOUNTS.filter(a => a.parent_id === 'acc-1000' && !a.is_group).map(a => (
                  <ReportLine key={a.id} label={L(a.name_ar, a.name_en)} amount={bal(a.id)} indent={1} />
                ))}
                {/* Sub-groups */}
                {CHART_OF_ACCOUNTS.filter(a => a.parent_id === 'acc-1000' && a.is_group).map(g => {
                  const leaves = CHART_OF_ACCOUNTS.filter(a => a.parent_id === g.id && !a.is_group);
                  return [
                    <ReportLine key={g.id + '-h'} label={L(g.name_ar, g.name_en)} amount={sumGroup(g.id)} bold indent={1} />,
                    ...leaves.map(a => <ReportLine key={a.id} label={L(a.name_ar, a.name_en)} amount={bal(a.id)} indent={2} />),
                  ];
                })}
                <ReportLine separator />
                <ReportLine label={L('إجمالي الأصول', 'Total Assets')} amount={totalAssets} bold />

                <div style={{ height: 20 }} />

                <ReportHeader title={L('الخصوم', 'LIABILITIES')} />
                {CHART_OF_ACCOUNTS.filter(a => a.parent_id === 'acc-2000' && !a.is_group).map(a => (
                  <ReportLine key={a.id} label={L(a.name_ar, a.name_en)} amount={-bal(a.id)} indent={1} />
                ))}
                <ReportLine separator />
                <ReportLine label={L('إجمالي الخصوم', 'Total Liabilities')} amount={totalLiabilities} bold />

                <div style={{ height: 20 }} />

                <ReportHeader title={L('حقوق الملكية', 'EQUITY')} />
                {CHART_OF_ACCOUNTS.filter(a => a.parent_id === 'acc-3000' && !a.is_group).map(a => (
                  <ReportLine key={a.id} label={L(a.name_ar, a.name_en)} amount={-bal(a.id)} indent={1} />
                ))}
                <ReportLine label={L('صافي الدخل', 'Net Income')} amount={netIncomeCalc} indent={1} />
                <ReportLine separator />
                <ReportLine label={L('إجمالي حقوق الملكية', 'Total Equity')} amount={totalEquity + netIncomeCalc} bold />

                <div style={{ height: 12 }} />
                <div style={{ padding: '10px 14px', borderRadius: 10, background: (totalAssets === totalLiabilities + totalEquity + netIncomeCalc) ? 'rgba(43,76,111,0.08)' : 'rgba(239,68,68,0.08)', display: 'flex', alignItems: 'center', gap: 8 }}>
                  {(Math.abs(totalAssets - (totalLiabilities + totalEquity + netIncomeCalc)) < 1)
                    ? <><CheckCircle size={14} color="#2B4C6F" /><span style={{ fontSize: 12, fontWeight: 600, color: '#2B4C6F' }}>{L('الميزانية متوازنة ✓', 'Balance Sheet is balanced ✓')}</span></>
                    : <><AlertTriangle size={14} color="#EF4444" /><span style={{ fontSize: 12, fontWeight: 600, color: '#EF4444' }}>{L('الميزانية غير متوازنة', 'Balance Sheet NOT balanced')}</span></>
                  }
                </div>
              </div>
            </CardWrap>

            {/* Right — KPIs */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <KpiCard icon={Layers} label={L('إجمالي الأصول', 'Total Assets')} value={fmtShort(totalAssets)} sub="EGP" color="#4A7AAB" />
              <KpiCard icon={AlertTriangle} label={L('إجمالي الخصوم', 'Total Liabilities')} value={fmtShort(totalLiabilities)} sub="EGP" color="#EF4444" />
              <KpiCard icon={Wallet} label={L('حقوق الملكية', 'Equity')} value={fmtShort(totalEquity + netIncomeCalc)} sub="EGP" color="#2B4C6F" />
              <KpiCard icon={TrendingUp} label={L('صافي الدخل', 'Net Income')} value={fmtShort(netIncomeCalc)} sub="EGP" color="#1B3347" />

              <CardWrap title={L('ملخص', 'Summary')} icon={BarChart2}>
                <div style={{ padding: '14px 18px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ fontSize: 12, color: ds.muted }}>{L('نسبة السيولة', 'Current Ratio')}</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: ds.text }}>{totalLiabilities > 0 ? (totalAssets / totalLiabilities).toFixed(2) : '∞'}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ fontSize: 12, color: ds.muted }}>{L('هامش الربح', 'Profit Margin')}</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: netIncomeCalc >= 0 ? '#2B4C6F' : '#EF4444' }}>{totalRevenue > 0 ? ((netIncomeCalc / totalRevenue) * 100).toFixed(1) + '%' : '—'}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 12, color: ds.muted }}>{L('نسبة المصروفات', 'Expense Ratio')}</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: ds.text }}>{totalRevenue > 0 ? ((totalExpPosted / totalRevenue) * 100).toFixed(1) + '%' : '—'}</span>
                  </div>
                </div>
              </CardWrap>
            </div>
          </div>
        )}

        {/* ── INCOME STATEMENT ── */}
        {reportView === 'income_statement' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 16 }}>
            <CardWrap title={L('قائمة الدخل', 'Income Statement')} icon={TrendingUp}>
              <div style={{ padding: '16px 18px' }}>
                <div style={{ fontSize: 11, color: ds.muted, marginBottom: 12 }}>{L('مارس 2026', 'March 2026')}</div>

                <ReportHeader title={L('الإيرادات', 'REVENUE')} />
                {revAccounts.map(a => {
                  let amount = 0;
                  postedEntries.forEach(e => e.lines.forEach(l => { if (l.account_id === a.id) amount += l.credit - l.debit; }));
                  return <ReportLine key={a.id} label={L(a.name_ar, a.name_en)} amount={amount} indent={1} />;
                })}
                <ReportLine separator />
                <ReportLine label={L('إجمالي الإيرادات', 'Total Revenue')} amount={totalRevenue} bold />

                <div style={{ height: 16 }} />

                <ReportHeader title={L('المصروفات', 'EXPENSES')} />
                {expAccounts.map(a => {
                  let amount = 0;
                  postedEntries.forEach(e => e.lines.forEach(l => { if (l.account_id === a.id) amount += l.debit - l.credit; }));
                  if (amount === 0) return null;
                  return <ReportLine key={a.id} label={L(a.name_ar, a.name_en)} amount={amount} indent={1} negative />;
                })}
                <ReportLine separator />
                <ReportLine label={L('إجمالي المصروفات', 'Total Expenses')} amount={totalExpPosted} bold negative />

                <div style={{ height: 16 }} />
                <div style={{ padding: '12px 14px', borderRadius: 10, background: netIncomeCalc >= 0 ? 'rgba(43,76,111,0.08)' : 'rgba(239,68,68,0.08)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 15, fontWeight: 800, color: ds.text }}>{L('صافي الدخل', 'Net Income')}</span>
                    <span style={{ fontSize: 18, fontWeight: 800, color: netIncomeCalc >= 0 ? '#2B4C6F' : '#EF4444' }}>{fmtMoney(netIncomeCalc)}</span>
                  </div>
                </div>
              </div>
            </CardWrap>

            {/* Right — Chart */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <KpiCard icon={TrendingUp} label={L('الإيرادات', 'Revenue')} value={fmtShort(totalRevenue)} sub="EGP" color="#4A7AAB" />
              <KpiCard icon={TrendingDown} label={L('المصروفات', 'Expenses')} value={fmtShort(totalExpPosted)} sub="EGP" color="#EF4444" />
              <KpiCard icon={DollarSign} label={L('صافي الدخل', 'Net Income')} value={fmtShort(netIncomeCalc)} sub="EGP" color={netIncomeCalc >= 0 ? '#2B4C6F' : '#EF4444'} />

              {/* Expense breakdown mini */}
              <CardWrap title={L('توزيع المصروفات', 'Expense Breakdown')} icon={PieChart}>
                <div style={{ padding: '12px 18px' }}>
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
                      <div key={a.id} style={{ marginBottom: 8 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                          <span style={{ fontSize: 11, color: ds.text }}>{L(a.name_ar, a.name_en)}</span>
                          <span style={{ fontSize: 11, fontWeight: 700, color: ds.muted }}>{pct}%</span>
                        </div>
                        <div style={{ height: 4, borderRadius: 2, background: ds.dark ? 'rgba(255,255,255,0.08)' : '#E5E7EB' }}>
                          <div style={{ height: '100%', width: pct + '%', borderRadius: 2, background: colors[i % colors.length] }} />
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
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 16 }}>
            <CardWrap title={L('قائمة التدفقات النقدية', 'Cash Flow Statement')} icon={Wallet}>
              <div style={{ padding: '16px 18px' }}>
                <div style={{ fontSize: 11, color: ds.muted, marginBottom: 12 }}>{L('مارس 2026', 'March 2026')}</div>

                <ReportHeader title={L('تدفقات من الأنشطة التشغيلية', 'OPERATING ACTIVITIES')} />
                <ReportLine label={L('صافي الدخل', 'Net Income')} amount={netIncomeCalc} indent={1} />
                <ReportLine label={L('تغير في ذمم مدينة', 'Change in Receivables')} amount={-receivable} indent={1} negative={receivable > 0} />
                <ReportLine label={L('تغير في ذمم دائنة', 'Change in Payables')} amount={payable} indent={1} />
                <ReportLine separator />
                <ReportLine label={L('صافي التدفقات التشغيلية', 'Net Operating Cash Flow')} amount={netIncomeCalc - receivable + payable} bold />

                <div style={{ height: 16 }} />
                <ReportHeader title={L('ملخص الحركة النقدية', 'CASH MOVEMENT SUMMARY')} />
                <ReportLine label={L('إجمالي التحصيلات', 'Total Cash Inflows')} amount={cashInflows} indent={1} />
                <ReportLine label={L('إجمالي المدفوعات', 'Total Cash Outflows')} amount={cashOutflows} indent={1} negative />
                <ReportLine separator />
                <ReportLine label={L('صافي الحركة', 'Net Movement')} amount={cashInflows - cashOutflows} bold />

                <div style={{ height: 16 }} />
                <ReportHeader title={L('الأرصدة النقدية', 'CASH BALANCES')} />
                <ReportLine label={L('الصندوق (كاش)', 'Cash on Hand')} amount={cashBal} indent={1} />
                <ReportLine label={L('بنك CIB', 'CIB Bank')} amount={bankCIB} indent={1} />
                <ReportLine label={L('بنك NBE', 'NBE Bank')} amount={bankNBE} indent={1} />
                <ReportLine separator />
                <ReportLine label={L('إجمالي النقدية', 'Total Cash & Banks')} amount={totalCash} bold />
              </div>
            </CardWrap>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <KpiCard icon={ArrowUpRight} label={L('إجمالي التحصيلات', 'Total Inflows')} value={fmtShort(cashInflows)} sub="EGP" color="#4A7AAB" />
              <KpiCard icon={ArrowDownRight} label={L('إجمالي المدفوعات', 'Total Outflows')} value={fmtShort(cashOutflows)} sub="EGP" color="#EF4444" />
              <KpiCard icon={Wallet} label={L('إجمالي النقدية', 'Total Cash')} value={fmtShort(totalCash)} sub="EGP" color="#2B4C6F" />

              {/* Cash breakdown */}
              <CardWrap title={L('توزيع النقدية', 'Cash Distribution')} icon={PieChart}>
                <div style={{ padding: '14px 18px' }}>
                  {[
                    { label: L('الصندوق', 'Cash on Hand'), amount: cashBal, color: '#1B3347' },
                    { label: L('بنك CIB', 'CIB Bank'), amount: bankCIB, color: '#4A7AAB' },
                    { label: L('بنك NBE', 'NBE Bank'), amount: bankNBE, color: '#8BA8C8' },
                  ].map((item, i) => {
                    const pct = totalCash !== 0 ? Math.round((Math.abs(item.amount) / Math.abs(totalCash)) * 100) : 0;
                    return (
                      <div key={i} style={{ marginBottom: 10 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                          <span style={{ fontSize: 12, color: ds.text }}>{item.label}</span>
                          <span style={{ fontSize: 12, fontWeight: 700, color: item.color }}>{fmtMoney(item.amount)}</span>
                        </div>
                        <div style={{ height: 5, borderRadius: 3, background: ds.dark ? 'rgba(255,255,255,0.08)' : '#E5E7EB' }}>
                          <div style={{ height: '100%', width: pct + '%', borderRadius: 3, background: item.color }} />
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
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14 }}>
          <KpiCard icon={Target} label={L('الموازنة الشهرية', 'Monthly Budget')} value={fmtShort(totalMonthly)} sub="EGP" color="#4A7AAB" />
          <KpiCard icon={BarChart2} label={L('الفعلي YTD', 'Actual YTD')} value={fmtShort(totalActualYtd)} sub="EGP" color="#2B4C6F" />
          <KpiCard icon={PieChart} label={L('نسبة الاستهلاك', 'Usage Rate')} value={overallPct + '%'} sub={L('من الموازنة', 'of budget')} color={overallPct > 100 ? '#EF4444' : '#4A7AAB'} />
          <KpiCard icon={AlertTriangle} label={L('بنود تجاوزت', 'Over Budget')} value={overBudgetCount} sub={L('بند', 'items')} color={overBudgetCount > 0 ? '#EF4444' : '#2B4C6F'} />
        </div>

        {/* Overall progress */}
        <CardWrap title={L('استهلاك الموازنة الكلي', 'Overall Budget Consumption')} icon={Target}>
          <div style={{ padding: '16px 18px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontSize: 13, color: ds.text, fontWeight: 600 }}>{L('الفعلي', 'Actual')}: {fmtMoney(totalActualYtd)}</span>
              <span style={{ fontSize: 13, color: ds.muted }}>{L('الموازنة', 'Budget')}: {fmtMoney(totalBudgetYtd)}</span>
            </div>
            <div style={{ height: 10, borderRadius: 5, background: ds.dark ? 'rgba(255,255,255,0.08)' : '#E5E7EB', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: Math.min(overallPct, 100) + '%', borderRadius: 5, background: overallPct > 100 ? '#EF4444' : overallPct > 85 ? '#f59e0b' : '#4A7AAB', transition: 'width 0.4s' }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
              <span style={{ fontSize: 11, color: ds.muted }}>0%</span>
              <span style={{ fontSize: 11, fontWeight: 700, color: overallPct > 100 ? '#EF4444' : ds.accent }}>{overallPct}%</span>
              <span style={{ fontSize: 11, color: ds.muted }}>100%</span>
            </div>
          </div>
        </CardWrap>

        {/* Detailed table */}
        <CardWrap title={L('تفاصيل الموازنة', 'Budget Details')} icon={ClipboardList}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr>
                <TH>{L('البند', 'Category')}</TH>
                <TH>{L('شهري', 'Monthly')}</TH>
                <TH>{L('الموازنة YTD', 'Budget YTD')}</TH>
                <TH>{L('الفعلي YTD', 'Actual YTD')}</TH>
                <TH>{L('الفرق', 'Variance')}</TH>
                <TH>{L('النسبة', '%')}</TH>
                <TH>{L('التقدم', 'Progress')}</TH>
              </tr></thead>
              <tbody>
                {budgetData.map(b => {
                  const pct = b.budget_ytd > 0 ? Math.round((b.actual_ytd / b.budget_ytd) * 100) : 0;
                  const variance = b.budget_ytd - b.actual_ytd;
                  const over = variance < 0;
                  return (
                    <TR key={b.id}>
                      <TD bold>{L(b.cat_ar, b.cat_en)}</TD>
                      <TD>
                        <input
                          type="number"
                          value={b.monthly}
                          onChange={e => handleUpdateMonthly(b.id, e.target.value)}
                          style={{ width: 80, padding: '4px 6px', borderRadius: 6, border: `1px solid ${ds.border}`, background: ds.input, color: ds.text, fontSize: 12, outline: 'none', textAlign: 'center' }}
                        />
                      </TD>
                      <TD color={ds.muted}>{fmtMoney(b.budget_ytd)}</TD>
                      <TD bold>{fmtMoney(b.actual_ytd)}</TD>
                      <TD bold color={over ? '#EF4444' : '#2B4C6F'}>
                        {over ? '(' : ''}{fmtMoney(Math.abs(variance))}{over ? ')' : ''}
                      </TD>
                      <TD bold color={over ? '#EF4444' : pct > 85 ? '#f59e0b' : '#2B4C6F'}>{pct}%</TD>
                      <TD style={{ minWidth: 100 }}>
                        <div style={{ height: 6, borderRadius: 3, background: ds.dark ? 'rgba(255,255,255,0.08)' : '#E5E7EB' }}>
                          <div style={{ height: '100%', width: Math.min(pct, 100) + '%', borderRadius: 3, background: over ? '#EF4444' : pct > 85 ? '#f59e0b' : '#4A7AAB', transition: 'width 0.3s' }} />
                        </div>
                      </TD>
                    </TR>
                  );
                })}
                {/* Totals row */}
                <tr style={{ background: ds.thBg, borderTop: `2px solid ${ds.border}` }}>
                  <td style={{ padding: '10px 12px', fontSize: 13, fontWeight: 800, color: ds.text }}>{L('الإجمالي', 'Total')}</td>
                  <td style={{ padding: '10px 12px', fontSize: 13, fontWeight: 700, color: ds.text }}>{fmtMoney(totalMonthly)}</td>
                  <td style={{ padding: '10px 12px', fontSize: 13, fontWeight: 700, color: ds.muted }}>{fmtMoney(totalBudgetYtd)}</td>
                  <td style={{ padding: '10px 12px', fontSize: 13, fontWeight: 700, color: ds.text }}>{fmtMoney(totalActualYtd)}</td>
                  <td style={{ padding: '10px 12px', fontSize: 13, fontWeight: 700, color: totalActualYtd > totalBudgetYtd ? '#EF4444' : '#2B4C6F' }}>
                    {totalActualYtd > totalBudgetYtd ? '(' : ''}{fmtMoney(Math.abs(totalBudgetYtd - totalActualYtd))}{totalActualYtd > totalBudgetYtd ? ')' : ''}
                  </td>
                  <td style={{ padding: '10px 12px', fontSize: 13, fontWeight: 800, color: overallPct > 100 ? '#EF4444' : '#2B4C6F' }}>{overallPct}%</td>
                  <td style={{ padding: '10px 12px' }}>
                    <div style={{ height: 6, borderRadius: 3, background: ds.dark ? 'rgba(255,255,255,0.08)' : '#E5E7EB' }}>
                      <div style={{ height: '100%', width: Math.min(overallPct, 100) + '%', borderRadius: 3, background: overallPct > 100 ? '#EF4444' : '#4A7AAB' }} />
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

  const Overlay = ({ children, onClose }) => (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: ds.card, borderRadius: 16, border: `1px solid ${ds.border}`, width: '100%', maxWidth: 700, maxHeight: '85vh', overflow: 'auto' }}>
        {children}
      </div>
    </div>
  );

  const ModalHeader = ({ title, onClose }) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: `1px solid ${ds.border}` }}>
      <span style={{ fontSize: 16, fontWeight: 700, color: ds.text }}>{title}</span>
      <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: 8, border: `1px solid ${ds.border}`, background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <X size={16} color={ds.muted} />
      </button>
    </div>
  );

  // ── Journal Entry Detail Modal ──────────────────────────────────────────
  const renderJournalModal = () => {
    if (!viewJournal) return null;
    const je = viewJournal;
    const st = JOURNAL_STATUS[je.status];
    const totalDebit = je.lines.reduce((s, l) => s + l.debit, 0);
    const totalCredit = je.lines.reduce((s, l) => s + l.credit, 0);
    const balanced = totalDebit === totalCredit;

    return (
      <Overlay onClose={() => setViewJournal(null)}>
        <ModalHeader title={je.entry_number} onClose={() => setViewJournal(null)} />
        <div style={{ padding: 20 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: 11, color: ds.muted, marginBottom: 2 }}>{L('التاريخ', 'Date')}</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: ds.text }}>{je.date}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: ds.muted, marginBottom: 2 }}>{L('الحالة', 'Status')}</div>
              <Badge label={L(st.ar, st.en)} color={st.color} />
            </div>
            <div style={{ gridColumn: '1/-1' }}>
              <div style={{ fontSize: 11, color: ds.muted, marginBottom: 2 }}>{L('الوصف', 'Description')}</div>
              <div style={{ fontSize: 14, color: ds.text }}>{L(je.description_ar, je.description_en)}</div>
            </div>
            {je.reference && (
              <div>
                <div style={{ fontSize: 11, color: ds.muted, marginBottom: 2 }}>{L('المرجع', 'Reference')}</div>
                <div style={{ fontSize: 14, color: ds.accent, fontWeight: 600 }}>{je.reference}</div>
              </div>
            )}
          </div>

          {/* Lines table */}
          <div style={{ border: `1px solid ${ds.border}`, borderRadius: 10, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr style={{ background: ds.thBg }}>
                <TH>{L('الحساب', 'Account')}</TH>
                <TH>{L('الكود', 'Code')}</TH>
                <TH>{L('مدين', 'Debit')}</TH>
                <TH>{L('دائن', 'Credit')}</TH>
              </tr></thead>
              <tbody>
                {je.lines.map((l, i) => (
                  <TR key={i}>
                    <TD>{L(l.name_ar, l.name_en)}</TD>
                    <TD color={ds.muted}>{l.code}</TD>
                    <TD bold color={l.debit > 0 ? '#2B4C6F' : ds.muted}>{l.debit > 0 ? fmtMoney(l.debit) : '—'}</TD>
                    <TD bold color={l.credit > 0 ? '#EF4444' : ds.muted}>{l.credit > 0 ? fmtMoney(l.credit) : '—'}</TD>
                  </TR>
                ))}
                {/* Totals row */}
                <tr style={{ background: ds.thBg, borderTop: `2px solid ${ds.border}` }}>
                  <td colSpan={2} style={{ padding: '10px 12px', fontSize: 13, fontWeight: 700, color: ds.text }}>{L('الإجمالي', 'Total')}</td>
                  <td style={{ padding: '10px 12px', fontSize: 13, fontWeight: 700, color: '#2B4C6F' }}>{fmtMoney(totalDebit)}</td>
                  <td style={{ padding: '10px 12px', fontSize: 13, fontWeight: 700, color: '#EF4444' }}>{fmtMoney(totalCredit)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Balance indicator */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, padding: '8px 12px', borderRadius: 8, background: balanced ? 'rgba(43,76,111,0.08)' : 'rgba(239,68,68,0.08)' }}>
            {balanced ? <CheckCircle size={16} color="#2B4C6F" /> : <AlertTriangle size={16} color="#EF4444" />}
            <span style={{ fontSize: 12, fontWeight: 600, color: balanced ? '#2B4C6F' : '#EF4444' }}>
              {balanced ? L('القيد متوازن ✓', 'Entry is balanced ✓') : L('القيد غير متوازن!', 'Entry is NOT balanced!')}
            </span>
          </div>

          <div style={{ fontSize: 11, color: ds.muted, marginTop: 12 }}>
            {L('بواسطة: ', 'By: ')}{L(je.created_by_ar, je.created_by_en)}
          </div>
        </div>
      </Overlay>
    );
  };

  // ── Invoice Detail Modal ───────────────────────────────────────────────
  const renderInvoiceModal = () => {
    if (!viewInvoice) return null;
    const inv = viewInvoice;
    const st = INVOICE_STATUS[inv.status];

    return (
      <Overlay onClose={() => setViewInvoice(null)}>
        <ModalHeader title={inv.number} onClose={() => setViewInvoice(null)} />
        <div style={{ padding: 20 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: 11, color: ds.muted, marginBottom: 2 }}>{L('النوع', 'Type')}</div>
              <Badge label={inv.type === 'sales' ? L('فاتورة بيع', 'Sales Invoice') : L('فاتورة شراء', 'Purchase Bill')} color={inv.type === 'sales' ? '#4A7AAB' : '#6B8DB5'} />
            </div>
            <div>
              <div style={{ fontSize: 11, color: ds.muted, marginBottom: 2 }}>{L('التاريخ', 'Date')}</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: ds.text }}>{inv.date}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: ds.muted, marginBottom: 2 }}>{L('الاستحقاق', 'Due')}</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: inv.status === 'overdue' ? '#EF4444' : ds.text }}>{inv.due_date}</div>
            </div>
            <div style={{ gridColumn: '1/-1' }}>
              <div style={{ fontSize: 11, color: ds.muted, marginBottom: 2 }}>{L('الطرف', 'Counterparty')}</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: ds.text }}>{L(inv.counterparty_ar, inv.counterparty_en)}</div>
            </div>
          </div>

          {/* Items table */}
          <div style={{ border: `1px solid ${ds.border}`, borderRadius: 10, overflow: 'hidden', marginBottom: 16 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr style={{ background: ds.thBg }}>
                <TH>{L('البند', 'Item')}</TH>
                <TH>{L('الكمية', 'Qty')}</TH>
                <TH>{L('السعر', 'Price')}</TH>
                <TH>{L('الضريبة', 'Tax')}</TH>
                <TH>{L('الإجمالي', 'Total')}</TH>
              </tr></thead>
              <tbody>
                {inv.items.map((item, i) => (
                  <TR key={i}>
                    <TD>{L(item.desc_ar, item.desc_en)}</TD>
                    <TD>{item.qty}</TD>
                    <TD>{fmtMoney(item.price)}</TD>
                    <TD color={ds.muted}>{item.tax_rate ? (item.tax_rate * 100) + '%' : '—'}</TD>
                    <TD bold>{fmtMoney(item.qty * item.price * (1 + item.tax_rate))}</TD>
                  </TR>
                ))}
              </tbody>
            </table>
          </div>

          {/* Totals */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end' }}>
            <div style={{ display: 'flex', gap: 24, fontSize: 13 }}>
              <span style={{ color: ds.muted }}>{L('المبلغ الفرعي', 'Subtotal')}</span>
              <span style={{ fontWeight: 600, color: ds.text }}>{fmtMoney(inv.subtotal)}</span>
            </div>
            {inv.tax > 0 && (
              <div style={{ display: 'flex', gap: 24, fontSize: 13 }}>
                <span style={{ color: ds.muted }}>{L('الضريبة', 'Tax')}</span>
                <span style={{ fontWeight: 600, color: ds.text }}>{fmtMoney(inv.tax)}</span>
              </div>
            )}
            <div style={{ display: 'flex', gap: 24, fontSize: 15, borderTop: `2px solid ${ds.border}`, paddingTop: 8, marginTop: 4 }}>
              <span style={{ fontWeight: 700, color: ds.text }}>{L('الإجمالي', 'Total')}</span>
              <span style={{ fontWeight: 800, color: ds.accent }}>{fmtMoney(inv.total)}</span>
            </div>
            <div style={{ display: 'flex', gap: 24, fontSize: 13 }}>
              <span style={{ color: ds.muted }}>{L('المدفوع', 'Paid')}</span>
              <span style={{ fontWeight: 600, color: '#2B4C6F' }}>{fmtMoney(inv.paid)}</span>
            </div>
            <div style={{ display: 'flex', gap: 24, fontSize: 14 }}>
              <span style={{ fontWeight: 600, color: inv.total - inv.paid > 0 ? '#EF4444' : '#2B4C6F' }}>
                {L('المتبقي', 'Balance')}: {fmtMoney(inv.total - inv.paid)}
              </span>
            </div>
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: 8, marginTop: 16, justifyContent: 'flex-end' }}>
            {inv.status === 'sent' && (
              <button onClick={() => { setInvoices(prev => prev.map(i => i.id === inv.id ? { ...i, status: 'paid', paid: i.total } : i)); setViewInvoice(null); }}
                style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: '#2B4C6F', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                {L('تسجيل دفع كامل', 'Record Full Payment')}
              </button>
            )}
            {inv.status === 'overdue' && (
              <button onClick={() => { setInvoices(prev => prev.map(i => i.id === inv.id ? { ...i, status: 'paid', paid: i.total } : i)); setViewInvoice(null); }}
                style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: '#EF4444', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                {L('تسجيل دفع كامل', 'Record Full Payment')}
              </button>
            )}
          </div>
        </div>
      </Overlay>
    );
  };

  /* ═══════════════════════════════════════════════════════════════════════
     ADD JOURNAL ENTRY MODAL
     ═══════════════════════════════════════════════════════════════════════ */


  /* ═══════════════════════════════════════════════════════════════════════
     ADD EXPENSE MODAL
     ═══════════════════════════════════════════════════════════════════════ */


  /* ═══════════════════════════════════════════════════════════════════════
     MAIN RENDER
     ═══════════════════════════════════════════════════════════════════════ */

  return (
    <div style={{ padding: 24, background: ds.bg, minHeight: '100vh', direction: isRTL ? 'rtl' : 'ltr' }}>
      {/* Page Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: ds.text, margin: 0 }}>{L('المالية', 'Finance')}</h1>
          <p style={{ fontSize: 12, color: ds.muted, margin: '4px 0 0' }}>{L('النظام المحاسبي الشامل', 'Comprehensive Accounting System')}</p>
        </div>
        <button
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 8, border: `1px solid ${ds.border}`, background: ds.card, color: ds.muted, fontSize: 12, cursor: 'pointer' }}>
          <Download size={14} />
          {L('تصدير التقرير', 'Export Report')}
        </button>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, background: ds.card, borderRadius: 10, padding: 4, border: `1px solid ${ds.border}`, width: 'fit-content', overflowX: 'auto' }}>
        {TABS.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
            display: 'flex', alignItems: 'center', gap: 7, padding: '7px 16px', borderRadius: 7,
            border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 500, transition: 'all 0.15s',
            background: activeTab === tab.id ? ds.accent : 'transparent',
            color: activeTab === tab.id ? '#fff' : ds.muted, whiteSpace: 'nowrap',
          }}>
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
      {showJournalModal && <AddJournalModal ds={ds} L={L} onClose={() => setShowJournalModal(false)} onSave={(entry) => { setJournalEntries(prev => [entry, ...prev]); setShowJournalModal(false); }} entryCount={journalEntries.length} />}
      {showExpenseModal && <AddExpenseModal ds={ds} L={L} onClose={() => setShowExpenseModal(false)} onSave={(exp) => { setExpenses(prev => [exp, ...prev]); setShowExpenseModal(false); }} expCount={expenses.length} />}

      {/* Responsive grid fix */}
      <style>{`
        @media (max-width: 900px) {
          .kpi-grid { grid-template-columns: repeat(2, 1fr) !important; }
        }
      `}</style>
    </div>
  );
}
