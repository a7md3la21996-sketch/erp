import { useState, useMemo, useEffect } from 'react';
import { applySmartFilters } from '../components/ui';
import { SOURCE_LABELS, SOURCE_EN, COUNTRY_CODES } from '../pages/crm/contacts/constants';
import { useGlobalFilter } from '../contexts/GlobalFilterContext';

const detectCountry = (phone) => {
  if (!phone) return '';
  const p = phone.replace(/\s+/g, '');
  if (p.startsWith('+20') || (p.startsWith('01') && ['0','1','2','5'].includes(p[2]))) return 'EG';
  if (p.startsWith('+966') || p.startsWith('05')) return 'SA';
  if (p.startsWith('+971')) return 'AE';
  if (p.startsWith('+965')) return 'KW';
  if (p.startsWith('+974')) return 'QA';
  if (p.startsWith('+968')) return 'OM';
  if (p.startsWith('+973')) return 'BH';
  if (p.startsWith('+962') || p.startsWith('07')) return 'JO';
  if (p.startsWith('+964') || p.startsWith('09')) return 'IQ';
  if (p.startsWith('+961')) return 'LB';
  if (p.startsWith('+218')) return 'LY';
  if (p.startsWith('+212')) return 'MA';
  if (p.startsWith('+216')) return 'TN';
  if (p.startsWith('+249')) return 'SD';
  return '';
};

const COUNTRY_OPTIONS = COUNTRY_CODES
  .filter(c => ['EG','SA','AE','KW','QA','OM','BH','JO','IQ','LB','LY','MA','TN','SD'].includes(c.country))
  .map(c => ({ value: c.country, label: c.labelAr, labelEn: c.label }));

export function useContactsFilters({ contacts, pinnedIds, auditFields, applyAuditFilters, initialSearch = '', initialFilterType = 'all', initialShowBlacklisted = false, initialSortBy = 'created', initialPage = 1 }) {
  const globalFilter = useGlobalFilter();
  const [searchInput, setSearchInput] = useState(initialSearch);
  const [search, setSearch] = useState(initialSearch);
  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput), 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const [filterType, setFilterType] = useState(initialFilterType);
  const [showBlacklisted, setShowBlacklisted] = useState(initialShowBlacklisted);
  const [sortBy, setSortBy] = useState(initialSortBy);
  const [page, setPage] = useState(initialPage);
  const [pageSize, setPageSize] = useState(25);
  const [smartFilters, setSmartFilters] = useState([]);

  const SMART_FIELDS = useMemo(() => [
    { id: 'prefix', label: 'اللقب', labelEn: 'Prefix', type: 'select', options: [
      { value: 'Mr.', label: 'Mr.', labelEn: 'Mr.' },
      { value: 'Mrs.', label: 'Mrs.', labelEn: 'Mrs.' },
      { value: 'Dr.', label: 'Dr.', labelEn: 'Dr.' },
      { value: 'Eng.', label: 'Eng.', labelEn: 'Eng.' },
      { value: 'أستاذ', label: 'أستاذ', labelEn: 'Prof.' },
    ]},
    { id: 'contact_type', label: 'النوع', labelEn: 'Type', type: 'select', options: [
      { value: 'lead', label: 'فريش ليد', labelEn: 'Fresh Lead' },
      { value: 'cold', label: 'كولد كول', labelEn: 'Cold Call' },
      { value: 'supplier', label: 'مورد', labelEn: 'Supplier' },
      { value: 'developer', label: 'مطور عقاري', labelEn: 'Developer' },
      { value: 'applicant', label: 'متقدم لوظيفة', labelEn: 'Applicant' },
      { value: 'partner', label: 'شريك', labelEn: 'Partner' },
    ]},
    { id: 'source', label: 'المصدر', labelEn: 'Source', type: 'select', options: Object.entries(SOURCE_LABELS).map(([k, v]) => ({ value: k, label: v, labelEn: SOURCE_EN[k] || v })) },
    { id: 'department', label: 'القسم', labelEn: 'Department', type: 'select', options: [
      { value: 'sales', label: 'المبيعات', labelEn: 'Sales' },
      { value: 'hr', label: 'HR', labelEn: 'HR' },
      { value: 'finance', label: 'المالية', labelEn: 'Finance' },
      { value: 'marketing', label: 'التسويق', labelEn: 'Marketing' },
      { value: 'operations', label: 'العمليات', labelEn: 'Operations' },
    ]},
    { id: 'contact_status', label: 'الحالة', labelEn: 'Status', type: 'select', options: [
      { value: 'new', label: 'جديد', labelEn: 'New' },
      { value: 'contacted', label: 'تم التواصل', labelEn: 'Contacted' },
      { value: 'no_answer', label: 'لا يرد', labelEn: 'No Answer' },
      { value: 'interested', label: 'مهتم', labelEn: 'Interested' },
      { value: 'not_interested', label: 'غير مهتم', labelEn: 'Not Interested' },
      { value: 'disqualified', label: 'غير مؤهل', labelEn: 'Disqualified' },
      { value: 'follow_up', label: 'متابعة', labelEn: 'Follow Up' },
    ]},
    { id: 'full_name', label: 'الاسم', labelEn: 'Name', type: 'text' },
    { id: 'email', label: 'الإيميل', labelEn: 'Email', type: 'text' },
    { id: 'phone', label: 'الهاتف', labelEn: 'Phone', type: 'text' },
    { id: 'created_at', label: 'تاريخ الإنشاء', labelEn: 'Created Date', type: 'date' },
    { id: 'last_activity_at', label: 'آخر نشاط', labelEn: 'Last Activity', type: 'date' },
    { id: 'lead_score', label: 'Lead Score', labelEn: 'Lead Score', type: 'number' },
    { id: 'campaign_name', label: 'الحملة', labelEn: 'Campaign', type: 'text' },
    { id: '_country', label: 'الدولة', labelEn: 'Country', type: 'select', options: COUNTRY_OPTIONS },
    { id: 'assigned_to_name', label: 'المسؤول', labelEn: 'Assigned To', type: 'select', options: [...new Set((contacts || []).map(c => c.assigned_to_name).filter(Boolean))].map(n => ({ value: n, label: n, labelEn: n })) },
    { id: 'assigned_by_name', label: 'عيّنه', labelEn: 'Assigned By', type: 'select', options: [...new Set((contacts || []).map(c => c.assigned_by_name).filter(Boolean))].map(n => ({ value: n, label: n, labelEn: n })) },
    { id: 'created_by_name', label: 'أنشأه', labelEn: 'Created By', type: 'select', options: [...new Set((contacts || []).map(c => c.created_by_name).filter(Boolean))].map(n => ({ value: n, label: n, labelEn: n })) },
    { id: '_campaign_count', label: 'عدد الحملات', labelEn: 'Campaign Count', type: 'number' },
    { id: '_opp_count', label: 'عدد الفرص', labelEn: 'Opportunities Count', type: 'number' },
    ...auditFields,
  ], [contacts, auditFields]);

  const SORT_OPTIONS = useMemo(() => [
    { value: 'created', label: 'ترتيب: الأحدث', labelEn: 'Sort: Newest' },
    { value: 'last_activity', label: 'ترتيب: آخر نشاط', labelEn: 'Sort: Last Activity' },
    { value: 'score', label: 'ترتيب: Lead Score', labelEn: 'Sort: Lead Score' },
    { value: 'name', label: 'ترتيب: الاسم', labelEn: 'Sort: Name' },
    { value: 'stale', label: 'ترتيب: يحتاج متابعة', labelEn: 'Sort: Needs Follow-up' },
  ], []);

  // Filter + Sort
  const filtered = useMemo(() => {
    let list = (contacts || []).filter(c => {
      if (!showBlacklisted && c.is_blacklisted) return false;
      if (filterType !== 'all' && c.contact_type !== filterType) return false;
      if (search) {
        const q = search.toLowerCase();
        const qDigits = q.replace(/\D/g, '');
        const phoneMatch = qDigits.length >= 4 && (c.phone?.replace(/\D/g, '').includes(qDigits) || c.phone2?.replace(/\D/g, '').includes(qDigits));
        return (c.full_name?.toLowerCase().includes(q) || phoneMatch || c.phone?.includes(q) || c.email?.toLowerCase().includes(q) || c.campaign_name?.toLowerCase().includes(q) || String(c.id).toLowerCase().includes(q));
      }
      return true;
    });
    list = list.map(c => ({
      ...c,
      _country: c._country || detectCountry(c.phone),
      _campaign_count: (c.campaign_interactions || []).length,
      _opp_count: (c.opportunities || []).length,
    }));
    list = applySmartFilters(list, smartFilters, SMART_FIELDS);
    list = applyAuditFilters(list, smartFilters);
    // Global filter
    if (globalFilter?.department && globalFilter.department !== 'all') {
      list = list.filter(c => c.department === globalFilter.department);
    }
    if (globalFilter?.agentName && globalFilter.agentName !== 'all') {
      list = list.filter(c => c.assigned_to_name === globalFilter.agentName);
    }
    if (globalFilter?.dateRange) {
      const { start, end } = globalFilter.dateRange;
      list = list.filter(c => c.created_at && c.created_at >= start && c.created_at <= end);
    }
    list.sort((a, b) => {
      const aPinned = pinnedIds.includes(a.id) ? 0 : 1;
      const bPinned = pinnedIds.includes(b.id) ? 0 : 1;
      if (aPinned !== bPinned) return aPinned - bPinned;
      if (sortBy === 'last_activity') return new Date(b.last_activity_at || 0) - new Date(a.last_activity_at || 0);
      if (sortBy === 'score') return (b.lead_score || 0) - (a.lead_score || 0);
      if (sortBy === 'name') return (a.full_name || '').localeCompare(b.full_name || '', 'ar');
      if (sortBy === 'created') return new Date(b.created_at || 0) - new Date(a.created_at || 0);
      if (sortBy === 'stale') return new Date(a.last_activity_at || 0) - new Date(b.last_activity_at || 0);
      return 0;
    });
    return list;
  }, [contacts, filterType, search, showBlacklisted, sortBy, pinnedIds, smartFilters, SMART_FIELDS, applyAuditFilters, globalFilter?.department, globalFilter?.agentName, globalFilter?.dateRange]);

  // Reset page on filter change
  useEffect(() => { setPage(1); }, [filterType, search, showBlacklisted, sortBy, smartFilters, pageSize]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const paged = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);

  return {
    filtered,
    paged,
    safePage,
    totalPages,
    SMART_FIELDS,
    SORT_OPTIONS,
    search,
    setSearch,
    searchInput,
    setSearchInput,
    filterType,
    setFilterType,
    showBlacklisted,
    setShowBlacklisted,
    sortBy,
    setSortBy,
    smartFilters,
    setSmartFilters,
    page,
    setPage,
    pageSize,
    setPageSize,
  };
}
