import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Megaphone, Plus, TrendingUp, Users, DollarSign,
  BarChart3, Calendar, Filter, Search, Eye
} from 'lucide-react';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import Modal, { ModalFooter } from '../components/ui/Modal';
import Input, { Select } from '../components/ui/Input';
import KpiCard from '../components/ui/KpiCard';
import ExportButton from '../components/ui/ExportButton';
import { Table, Th, Td, Tr } from '../components/ui/Table';

// ── Mock campaigns data ──────────────────────────────────────────

const INITIAL_CAMPAIGNS = [
  { id: 1, name: 'Spring Sale 2026', name_ar: 'تخفيضات الربيع 2026', platform: 'facebook', status: 'active', budget: 25000, leads: 142, cpl: 176, start_date: '2026-02-01', end_date: '2026-03-31' },
  { id: 2, name: 'Brand Awareness Q1', name_ar: 'بناء الوعي Q1', platform: 'google', status: 'active', budget: 40000, leads: 98, cpl: 408, start_date: '2026-01-15', end_date: '2026-03-15' },
  { id: 3, name: 'Product Launch Video', name_ar: 'فيديو إطلاق المنتج', platform: 'instagram', status: 'active', budget: 15000, leads: 67, cpl: 224, start_date: '2026-02-10', end_date: '2026-04-10' },
  { id: 4, name: 'Retargeting Warm Leads', name_ar: 'إعادة استهداف العملاء', platform: 'facebook', status: 'paused', budget: 12000, leads: 45, cpl: 267, start_date: '2026-01-01', end_date: '2026-02-28' },
  { id: 5, name: 'Google Search - CRM', name_ar: 'بحث جوجل - CRM', platform: 'google', status: 'completed', budget: 30000, leads: 112, cpl: 268, start_date: '2025-11-01', end_date: '2026-01-31' },
  { id: 6, name: 'Instagram Reels Campaign', name_ar: 'حملة ريلز انستغرام', platform: 'instagram', status: 'active', budget: 8000, leads: 34, cpl: 235, start_date: '2026-03-01', end_date: '2026-04-30' },
  { id: 7, name: 'LinkedIn B2B Outreach', name_ar: 'تواصل B2B لينكدإن', platform: 'google', status: 'paused', budget: 20000, leads: 28, cpl: 714, start_date: '2026-01-10', end_date: '2026-03-10' },
  { id: 8, name: 'Summer Pre-Sale', name_ar: 'ما قبل تخفيضات الصيف', platform: 'facebook', status: 'active', budget: 18000, leads: 56, cpl: 321, start_date: '2026-03-05', end_date: '2026-05-31' },
  { id: 9, name: 'App Install Campaign', name_ar: 'حملة تحميل التطبيق', platform: 'google', status: 'completed', budget: 35000, leads: 189, cpl: 185, start_date: '2025-10-01', end_date: '2025-12-31' },
  { id: 10, name: 'Eid Offers', name_ar: 'عروض العيد', platform: 'instagram', status: 'completed', budget: 22000, leads: 134, cpl: 164, start_date: '2026-01-20', end_date: '2026-02-15' },
];

const PLATFORMS = [
  { id: 'facebook', ar: 'فيسبوك', en: 'Facebook', color: '#1877F2' },
  { id: 'google', ar: 'جوجل', en: 'Google', color: '#4285F4' },
  { id: 'instagram', ar: 'انستغرام', en: 'Instagram', color: '#E4405F' },
];

const STATUSES = [
  { id: 'active', ar: 'نشط', en: 'Active', color: '#22C55E' },
  { id: 'paused', ar: 'متوقف', en: 'Paused', color: '#F59E0B' },
  { id: 'completed', ar: 'مكتمل', en: 'Completed', color: '#6B7280' },
];

function getPlatform(id) { return PLATFORMS.find(p => p.id === id); }
function getStatus(id) { return STATUSES.find(s => s.id === id); }

// ── Main Component ───────────────────────────────────────────────

export default function MarketingPage() {
  const { i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const lang = i18n.language;

  const [campaigns, setCampaigns] = useState(INITIAL_CAMPAIGNS);
  const [platformFilter, setPlatformFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ name: '', name_ar: '', platform: 'facebook', budget: '', start_date: '', end_date: '', status: 'active' });

  // Filtered campaigns
  const filtered = useMemo(() => campaigns.filter(c => {
    const name = lang === 'ar' ? c.name_ar : c.name;
    const matchSearch = !search || name.toLowerCase().includes(search.toLowerCase());
    const matchPlatform = platformFilter === 'all' || c.platform === platformFilter;
    const matchStatus = statusFilter === 'all' || c.status === statusFilter;
    return matchSearch && matchPlatform && matchStatus;
  }), [campaigns, search, platformFilter, statusFilter, lang]);

  // KPI calculations
  const totalCampaigns = campaigns.length;
  const activeCampaigns = campaigns.filter(c => c.status === 'active').length;
  const totalLeads = campaigns.reduce((s, c) => s + c.leads, 0);
  const totalBudget = campaigns.reduce((s, c) => s + c.budget, 0);
  const avgConversion = totalBudget > 0 ? ((totalLeads / totalBudget) * 1000).toFixed(1) : 0;

  function handleAddCampaign() {
    if (!form.name.trim()) return;
    const budget = Number(form.budget) || 0;
    const newCampaign = {
      id: Date.now(),
      name: form.name,
      name_ar: form.name_ar || form.name,
      platform: form.platform,
      status: form.status,
      budget,
      leads: 0,
      cpl: 0,
      start_date: form.start_date,
      end_date: form.end_date,
    };
    setCampaigns(prev => [newCampaign, ...prev]);
    setForm({ name: '', name_ar: '', platform: 'facebook', budget: '', start_date: '', end_date: '', status: 'active' });
    setModalOpen(false);
  }

  const exportData = filtered.map(c => ({
    name: lang === 'ar' ? c.name_ar : c.name,
    platform: getPlatform(c.platform)?.[lang === 'ar' ? 'ar' : 'en'] || c.platform,
    status: getStatus(c.status)?.[lang === 'ar' ? 'ar' : 'en'] || c.status,
    budget: c.budget,
    leads: c.leads,
    cpl: c.cpl,
    start_date: c.start_date,
  }));

  return (
    <div className={`p-6 bg-surface-bg dark:bg-surface-bg-dark min-h-screen ${isRTL ? 'direction-rtl' : 'direction-ltr'}`} dir={isRTL ? 'rtl' : 'ltr'}>

      {/* Header */}
      <div className={`flex items-center justify-between mb-6 flex-wrap gap-3 ${isRTL ? 'flex-row-reverse' : 'flex-row'}`}>
        <div className={`flex items-center gap-3 ${isRTL ? 'flex-row-reverse' : 'flex-row'}`}>
          <div className="w-10 h-10 rounded-[10px] bg-brand-800 flex items-center justify-center">
            <Megaphone size={20} color="#fff" />
          </div>
          <div>
            <h1 className="m-0 text-[22px] font-bold text-content dark:text-content-dark">
              {lang === 'ar' ? 'إدارة الحملات التسويقية' : 'Marketing Campaigns'}
            </h1>
            <p className="m-0 text-[13px] text-content-muted dark:text-content-muted-dark">
              {lang === 'ar' ? 'إدارة ومتابعة أداء الحملات الإعلانية' : 'Manage and track advertising campaign performance'}
            </p>
          </div>
        </div>
        <div className={`flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : 'flex-row'}`}>
          <ExportButton
            data={exportData}
            filename={isRTL ? 'الحملات' : 'campaigns'}
            title={isRTL ? 'الحملات التسويقية' : 'Marketing Campaigns'}
            columns={[
              { header: isRTL ? 'الاسم' : 'Name', key: 'name' },
              { header: isRTL ? 'المنصة' : 'Platform', key: 'platform' },
              { header: isRTL ? 'الحالة' : 'Status', key: 'status' },
              { header: isRTL ? 'الميزانية' : 'Budget', key: 'budget' },
              { header: isRTL ? 'الليدز' : 'Leads', key: 'leads' },
              { header: isRTL ? 'تكلفة/ليد' : 'CPL', key: 'cpl' },
              { header: isRTL ? 'تاريخ البدء' : 'Start Date', key: 'start_date' },
            ]}
          />
          <Button onClick={() => setModalOpen(true)}>
            <Plus size={16} />
            {lang === 'ar' ? 'حملة جديدة' : 'Add Campaign'}
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3.5 mb-6">
        <KpiCard icon={BarChart3} label={lang === 'ar' ? 'إجمالي الحملات' : 'Total Campaigns'} value={totalCampaigns} color="#4A7AAB" />
        <KpiCard icon={TrendingUp} label={lang === 'ar' ? 'حملات نشطة' : 'Active Campaigns'} value={activeCampaigns} color="#22C55E" />
        <KpiCard icon={Users} label={lang === 'ar' ? 'إجمالي الليدز' : 'Total Leads Generated'} value={totalLeads.toLocaleString()} color="#4A7AAB" />
        <KpiCard icon={DollarSign} label={lang === 'ar' ? 'معدل التحويل (لكل 1000 EGP)' : 'Conversion Rate (per 1K EGP)'} value={avgConversion} color="#2B4C6F" />
      </div>

      {/* Filters */}
      <div className={`flex flex-wrap gap-2.5 mb-5 ${isRTL ? 'flex-row-reverse' : 'flex-row'}`}>
        <div className="relative flex-1 max-w-[280px]">
          <Search size={14} className="absolute top-1/2 -translate-y-1/2 text-content-muted dark:text-content-muted-dark start-3" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={lang === 'ar' ? 'ابحث عن حملة...' : 'Search campaign...'}
            className="ps-[38px] pe-3"
          />
        </div>
        <Select value={platformFilter} onChange={e => setPlatformFilter(e.target.value)} className="w-auto">
          <option value="all">{lang === 'ar' ? 'كل المنصات' : 'All Platforms'}</option>
          {PLATFORMS.map(p => <option key={p.id} value={p.id}>{lang === 'ar' ? p.ar : p.en}</option>)}
        </Select>
        <Select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="w-auto">
          <option value="all">{lang === 'ar' ? 'كل الحالات' : 'All Statuses'}</option>
          {STATUSES.map(s => <option key={s.id} value={s.id}>{lang === 'ar' ? s.ar : s.en}</option>)}
        </Select>
      </div>

      {/* Campaigns Table */}
      <Table>
        <thead>
          <tr>
            <Th>{lang === 'ar' ? 'اسم الحملة' : 'Campaign Name'}</Th>
            <Th>{lang === 'ar' ? 'المنصة' : 'Platform'}</Th>
            <Th>{lang === 'ar' ? 'الحالة' : 'Status'}</Th>
            <Th>{lang === 'ar' ? 'الميزانية' : 'Budget'}</Th>
            <Th>{lang === 'ar' ? 'الليدز' : 'Leads'}</Th>
            <Th>{lang === 'ar' ? 'تكلفة/ليد' : 'Cost/Lead'}</Th>
            <Th>{lang === 'ar' ? 'تاريخ البدء' : 'Start Date'}</Th>
          </tr>
        </thead>
        <tbody>
          {filtered.length === 0 ? (
            <tr>
              <Td colSpan={7} className="text-center py-8 text-content-muted dark:text-content-muted-dark">
                {lang === 'ar' ? 'لا توجد حملات مطابقة' : 'No matching campaigns'}
              </Td>
            </tr>
          ) : (
            filtered.map(campaign => {
              const platform = getPlatform(campaign.platform);
              const status = getStatus(campaign.status);
              return (
                <Tr key={campaign.id}>
                  <Td className="font-semibold">{lang === 'ar' ? campaign.name_ar : campaign.name}</Td>
                  <Td>
                    <Badge size="sm" className="rounded-full" style={{ background: (platform?.color || '#666') + '18', color: platform?.color || '#666' }}>
                      {lang === 'ar' ? platform?.ar : platform?.en}
                    </Badge>
                  </Td>
                  <Td>
                    <Badge size="sm" className="rounded-full" style={{ background: (status?.color || '#666') + '18', color: status?.color || '#666' }}>
                      {lang === 'ar' ? status?.ar : status?.en}
                    </Badge>
                  </Td>
                  <Td>{campaign.budget.toLocaleString()} EGP</Td>
                  <Td>
                    <span className="font-bold text-brand-500">{campaign.leads}</span>
                  </Td>
                  <Td>
                    <span className={campaign.cpl > 300 ? 'text-red-500' : campaign.cpl > 200 ? 'text-amber-500' : 'text-emerald-500'}>
                      {campaign.cpl > 0 ? campaign.cpl + ' EGP' : '—'}
                    </span>
                  </Td>
                  <Td className="text-content-muted dark:text-content-muted-dark text-[13px]">{campaign.start_date}</Td>
                </Tr>
              );
            })
          )}
        </tbody>
      </Table>

      {/* Summary bar */}
      <div className={`mt-4 px-4 py-3 rounded-lg bg-brand-500/[0.06] border border-brand-500/[0.15] flex flex-wrap gap-5 text-xs text-brand-800 dark:text-brand-300 ${isRTL ? 'flex-row-reverse' : 'flex-row'}`}>
        <span>{lang === 'ar' ? 'إجمالي الميزانية:' : 'Total Budget:'} <strong>{totalBudget.toLocaleString()} EGP</strong></span>
        <span>{lang === 'ar' ? 'إجمالي الليدز:' : 'Total Leads:'} <strong>{totalLeads}</strong></span>
        <span>{lang === 'ar' ? 'متوسط تكلفة/ليد:' : 'Avg CPL:'} <strong>{totalLeads > 0 ? Math.round(totalBudget / totalLeads) : 0} EGP</strong></span>
      </div>

      {/* Add Campaign Modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={lang === 'ar' ? 'إضافة حملة جديدة' : 'Add New Campaign'}>
        <div className="flex flex-col gap-4">
          <div>
            <label className="block text-xs font-medium text-content-muted dark:text-content-muted-dark mb-1">
              {lang === 'ar' ? 'اسم الحملة (EN)' : 'Campaign Name (EN)'}
            </label>
            <Input
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder={lang === 'ar' ? 'اسم الحملة بالإنجليزية' : 'Campaign name in English'}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-content-muted dark:text-content-muted-dark mb-1">
              {lang === 'ar' ? 'اسم الحملة (AR)' : 'Campaign Name (AR)'}
            </label>
            <Input
              value={form.name_ar}
              onChange={e => setForm(f => ({ ...f, name_ar: e.target.value }))}
              placeholder={lang === 'ar' ? 'اسم الحملة بالعربية' : 'Campaign name in Arabic'}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-content-muted dark:text-content-muted-dark mb-1">
                {lang === 'ar' ? 'المنصة' : 'Platform'}
              </label>
              <Select value={form.platform} onChange={e => setForm(f => ({ ...f, platform: e.target.value }))}>
                {PLATFORMS.map(p => <option key={p.id} value={p.id}>{lang === 'ar' ? p.ar : p.en}</option>)}
              </Select>
            </div>
            <div>
              <label className="block text-xs font-medium text-content-muted dark:text-content-muted-dark mb-1">
                {lang === 'ar' ? 'الميزانية (EGP)' : 'Budget (EGP)'}
              </label>
              <Input
                type="number"
                value={form.budget}
                onChange={e => setForm(f => ({ ...f, budget: e.target.value }))}
                placeholder="0"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-content-muted dark:text-content-muted-dark mb-1">
                {lang === 'ar' ? 'تاريخ البدء' : 'Start Date'}
              </label>
              <Input
                type="date"
                value={form.start_date}
                onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-content-muted dark:text-content-muted-dark mb-1">
                {lang === 'ar' ? 'تاريخ الانتهاء' : 'End Date'}
              </label>
              <Input
                type="date"
                value={form.end_date}
                onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))}
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-content-muted dark:text-content-muted-dark mb-1">
              {lang === 'ar' ? 'الحالة' : 'Status'}
            </label>
            <Select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
              {STATUSES.map(s => <option key={s.id} value={s.id}>{lang === 'ar' ? s.ar : s.en}</option>)}
            </Select>
          </div>
        </div>
        <ModalFooter className={isRTL ? 'flex-row-reverse' : 'flex-row'}>
          <Button variant="secondary" onClick={() => setModalOpen(false)}>
            {lang === 'ar' ? 'إلغاء' : 'Cancel'}
          </Button>
          <Button onClick={handleAddCampaign} disabled={!form.name.trim()}>
            <Plus size={16} />
            {lang === 'ar' ? 'إضافة' : 'Add'}
          </Button>
        </ModalFooter>
      </Modal>

    </div>
  );
}
