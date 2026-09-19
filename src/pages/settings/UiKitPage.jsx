import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Button, Card, CardHeader, CardBody, Input, Select, Textarea, Badge, Modal, ModalFooter,
  KpiCard, MetricCard, FilterPill, EmptyState, Pagination, confirm, Table, Th, Tr, Td,
  DataTable, SmartFilter, ExportButton,
} from '../../components/ui';
import SearchableSelect from '../../components/ui/SearchableSelect';
import { TableSkeleton, ListSkeleton } from '../../components/ui/PageSkeletons';
import { ResultBadge, OutcomeBadge } from '../crm/contacts/constants';
import { useToast } from '../../contexts/ToastContext';
import { Palette, Phone, Mail, Calendar, Search, Bell, Check, Plus, Trash2, Settings, User, Filter, Inbox, DollarSign, Users, MessageCircle, AlertTriangle } from 'lucide-react';

// ── Design System — the single live reference: Foundations (tokens),
// Components (the UI kit) and Patterns (the UX layer). Admin-only.

function Section({ title, desc, children }) {
  return (
    <section className="bg-surface-card dark:bg-surface-card-dark border border-edge dark:border-edge-dark rounded-2xl overflow-hidden mb-5">
      <div className="px-4 py-3 border-b border-edge dark:border-edge-dark">
        <h2 className="m-0 text-sm font-bold text-content dark:text-content-dark">{title}</h2>
        {desc && <p className="m-0 mt-0.5 text-xs text-content-muted dark:text-content-muted-dark">{desc}</p>}
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}
const Row = ({ children }) => <div className="flex flex-wrap items-start gap-3">{children}</div>;
function Swatch({ name, cls, hex }) {
  return (
    <div className="flex flex-col items-center gap-1 w-16">
      <div className={`w-14 h-14 rounded-xl border border-black/5 dark:border-white/10 ${cls}`} />
      <span className="text-[10px] text-content dark:text-content-dark font-semibold">{name}</span>
      {hex && <span className="text-[9px] text-content-muted dark:text-content-muted-dark font-mono">{hex}</span>}
    </div>
  );
}

const BRAND = [['50', '#EFF4FE'], ['100', '#DBE8FB'], ['200', '#BAD0F6'], ['300', '#8DB1EF'], ['400', '#5E90E5'], ['500', '#2F6BD3'], ['600', '#2557B4'], ['700', '#1F478F'], ['800', '#1E3E77'], ['900', '#1A3159']];

export default function UiKitPage() {
  const { i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const toast = useToast();
  const [tab, setTab] = useState('foundations');
  const [modalOpen, setModalOpen] = useState(false);
  const [sel, setSel] = useState('');
  const [pill, setPill] = useState('all');
  const [page, setPage] = useState(1);
  const [formErr, setFormErr] = useState('');
  const [sfSearch, setSfSearch] = useState('');
  const [sfFilters, setSfFilters] = useState([]);
  const [sfSort, setSfSort] = useState('name');

  const demoRows = [
    { id: 1, name: 'Ahmed Gaber', phone: '+20 100 111', status: isRTL ? 'نشط' : 'Active', _c: '#158A57' },
    { id: 2, name: 'Sara Ali', phone: '+20 101 222', status: isRTL ? 'متابعة' : 'Following', _c: '#C9860A' },
    { id: 3, name: 'Mona Adel', phone: '+20 102 333', status: isRTL ? 'غير مؤهل' : 'DQ', _c: '#D6403B' },
  ];
  const demoCols = [
    { key: 'name', header: isRTL ? 'الاسم' : 'Name', sortable: true },
    { key: 'phone', header: isRTL ? 'الهاتف' : 'Phone' },
    { key: 'status', header: isRTL ? 'الحالة' : 'Status', render: (r) => <Badge color={r._c}>{r.status}</Badge> },
  ];
  const sfFields = [
    { id: 'name', label: 'الاسم', labelEn: 'Name', type: 'text' },
    { id: 'status', label: 'الحالة', labelEn: 'Status', type: 'select', options: [{ value: 'active', label: isRTL ? 'نشط' : 'Active' }, { value: 'following', label: isRTL ? 'متابعة' : 'Following' }] },
  ];

  const selOptions = [
    { value: 'hot', label: isRTL ? 'حار' : 'Hot', color: '#D6403B' },
    { value: 'warm', label: isRTL ? 'دافئ' : 'Warm', color: '#C9860A' },
    { value: 'cold', label: isRTL ? 'بارد' : 'Cold', color: '#2F6BD3' },
  ];
  const TABS = [
    { key: 'foundations', ar: 'الأساسيات', en: 'Foundations' },
    { key: 'components', ar: 'المكوّنات', en: 'Components' },
    { key: 'patterns', ar: 'الأنماط (UX)', en: 'Patterns (UX)' },
  ];

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} className="px-4 py-4 md:px-7 md:py-6 bg-[#F7F8FA] dark:bg-[#0A0D13] min-h-dvh">
      <div className="max-w-[1000px] mx-auto">
        <div className="flex items-center gap-2.5 mb-1">
          <Palette size={20} className="text-brand-500" aria-hidden="true" />
          <h1 className="m-0 text-xl font-bold text-content dark:text-content-dark">{isRTL ? 'نظام التصميم' : 'Design System'}</h1>
        </div>
        <p className="text-sm text-content-muted dark:text-content-muted-dark mt-0 mb-4">
          {isRTL ? 'المرجع الموحّد الحيّ: الأساسيات (التوكِنز) + المكوّنات + الأنماط. أي شغل جديد يلتزم بيه.' : 'The single live reference: foundations (tokens) + components + patterns. Every new screen follows it.'}
        </p>

        <div className="flex gap-2 mb-5 flex-wrap">
          {TABS.map(t => (
            <FilterPill key={t.key} label={isRTL ? t.ar : t.en} active={tab === t.key} onClick={() => setTab(t.key)} />
          ))}
        </div>

        {tab === 'foundations' && (<>
          <Section title={isRTL ? 'لون البراند' : 'Brand colour'} desc="brand-50 → 900 (#2F6BD3 base)">
            <Row>{BRAND.map(([n, hex]) => <Swatch key={n} name={n} hex={hex} cls={`bg-brand-${n}`} />)}</Row>
          </Section>
          <Section title={isRTL ? 'الألوان الدلالية' : 'Semantic colours'} desc={isRTL ? 'محجوزة للحالات فقط — traffic-light.' : 'Reserved for states only — traffic-light.'}>
            <Row>
              <Swatch name="success" hex="#158A57" cls="bg-emerald-500" />
              <Swatch name="warning" hex="#C9860A" cls="bg-amber-500" />
              <Swatch name="danger" hex="#D6403B" cls="bg-red-500" />
              <Swatch name="purple" hex="#5A63C4" cls="bg-[#5A63C4]" />
            </Row>
          </Section>
          <Section title={isRTL ? 'المحايدة (البنية)' : 'Neutrals (structure)'}>
            <Row>
              <Swatch name="surface" cls="bg-surface-card dark:bg-surface-card-dark border" />
              <Swatch name="bg" cls="bg-[#F0F4F8] dark:bg-[#152232]" />
              <Swatch name="edge" cls="bg-edge dark:bg-edge-dark" />
              <Swatch name="content" cls="bg-content dark:bg-content-dark" />
              <Swatch name="muted" cls="bg-content-muted dark:bg-content-muted-dark" />
            </Row>
          </Section>
          <Section title={isRTL ? 'الخطوط (Typography)' : 'Typography'} desc="Cairo">
            <div className="flex flex-col gap-1.5">
              <div className="text-xl font-bold text-content dark:text-content-dark">{isRTL ? 'عنوان رئيسي — text-xl bold' : 'Heading — text-xl bold'}</div>
              <div className="text-base font-semibold text-content dark:text-content-dark">{isRTL ? 'عنوان فرعي — text-base semibold' : 'Subheading — text-base semibold'}</div>
              <div className="text-sm text-content dark:text-content-dark">{isRTL ? 'نص أساسي — text-sm' : 'Body — text-sm'}</div>
              <div className="text-xs text-content-muted dark:text-content-muted-dark">{isRTL ? 'ثانوي/تسمية — text-xs muted' : 'Caption/label — text-xs muted'}</div>
            </div>
          </Section>
          <Section title={isRTL ? 'الحواف والظلال' : 'Radii & shadows'}>
            <Row>
              <div className="flex flex-col items-center gap-1"><div className="w-14 h-14 bg-surface-card dark:bg-surface-card-dark border border-edge dark:border-edge-dark rounded-lg" /><span className="text-[10px] text-content-muted dark:text-content-muted-dark">rounded-lg</span></div>
              <div className="flex flex-col items-center gap-1"><div className="w-14 h-14 bg-surface-card dark:bg-surface-card-dark border border-edge dark:border-edge-dark rounded-2xl" /><span className="text-[10px] text-content-muted dark:text-content-muted-dark">rounded-2xl</span></div>
              <div className="flex flex-col items-center gap-1"><div className="w-14 h-14 bg-surface-card dark:bg-surface-card-dark border border-edge dark:border-edge-dark rounded-full" /><span className="text-[10px] text-content-muted dark:text-content-muted-dark">full</span></div>
              <div className="flex flex-col items-center gap-1"><div className="w-14 h-14 bg-surface-card dark:bg-surface-card-dark rounded-xl shadow-sm" /><span className="text-[10px] text-content-muted dark:text-content-muted-dark">shadow-sm</span></div>
              <div className="flex flex-col items-center gap-1"><div className="w-14 h-14 bg-surface-card dark:bg-surface-card-dark rounded-xl shadow-lg" /><span className="text-[10px] text-content-muted dark:text-content-muted-dark">shadow-lg</span></div>
            </Row>
          </Section>
          <Section title={isRTL ? 'الأيقونات' : 'Icons'} desc="lucide-react — 16-20px, تورث لون النص">
            <Row>
              {[Phone, Mail, Calendar, Search, Bell, Check, Plus, Trash2, Settings, User, Filter, MessageCircle].map((Ic, i) => <Ic key={i} size={20} className="text-content-muted dark:text-content-muted-dark" />)}
            </Row>
          </Section>
        </>)}

        {tab === 'components' && (<>
          <Section title="Button" desc="variant: primary · secondary · danger · ghost · success · call — size: sm/md/lg — loading">
            <Row>
              <Button variant="primary">{isRTL ? 'أساسي' : 'Primary'}</Button>
              <Button variant="secondary">{isRTL ? 'ثانوي' : 'Secondary'}</Button>
              <Button variant="danger">{isRTL ? 'خطر' : 'Danger'}</Button>
              <Button variant="ghost">{isRTL ? 'شفاف' : 'Ghost'}</Button>
              <Button variant="success">{isRTL ? 'نجاح' : 'Success'}</Button>
              <Button variant="call"><Phone size={14} /> {isRTL ? 'اتصال' : 'Call'}</Button>
              <Button variant="primary" size="sm">sm</Button>
              <Button variant="primary" size="lg">lg</Button>
              <Button variant="primary" loading>{isRTL ? 'تحميل' : 'Loading'}</Button>
            </Row>
          </Section>
          <Section title={isRTL ? 'حقول الإدخال' : 'Inputs'} desc="Input / Select / Textarea / SearchableSelect">
            <div className="w-full grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input placeholder={isRTL ? 'نص...' : 'Text...'} />
              <Select defaultValue=""><option value="" disabled>{isRTL ? 'اختر...' : 'Select...'}</option><option>A</option><option>B</option></Select>
              <Textarea placeholder={isRTL ? 'ملاحظة...' : 'Note...'} />
              <div><SearchableSelect value={sel} onChange={setSel} options={selOptions} placeholder={isRTL ? 'اختر الحرارة...' : 'Pick temperature...'} /></div>
            </div>
          </Section>
          <Section title="Badge / ResultBadge / OutcomeBadge / FilterPill">
            <Row>
              <Badge color="#158A57">{isRTL ? 'نشط' : 'Active'}</Badge>
              <Badge color="#C9860A">{isRTL ? 'معلّق' : 'Pending'}</Badge>
              <Badge color="#D6403B">{isRTL ? 'متأخر' : 'Overdue'}</Badge>
              <ResultBadge result="answered" isRTL={isRTL} />
              <ResultBadge result="no_answer" isRTL={isRTL} />
              <OutcomeBadge outcome="interested" isRTL={isRTL} />
              <OutcomeBadge outcome="not_interested" isRTL={isRTL} />
              <FilterPill label={isRTL ? 'الكل' : 'All'} active={pill === 'all'} onClick={() => setPill('all')} count={128} />
              <FilterPill label={isRTL ? 'اليوم' : 'Today'} active={pill === 'today'} onClick={() => setPill('today')} count={12} />
            </Row>
          </Section>
          <Section title="Card / KpiCard / MetricCard">
            <div className="w-full grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Card><CardHeader><span className="text-sm font-bold text-content dark:text-content-dark">Card</span></CardHeader><CardBody><span className="text-xs text-content-muted dark:text-content-muted-dark">{isRTL ? 'محتوى البطاقة' : 'Card body'}</span></CardBody></Card>
              <KpiCard icon={Users} label={isRTL ? 'العملاء' : 'Leads'} value="4,975" sub={isRTL ? '+12 اليوم' : '+12 today'} color="#2F6BD3" />
              <MetricCard label={isRTL ? 'الصفقات' : 'Deals'} value="18" sublabel={isRTL ? 'هذا الشهر' : 'this month'} icon={DollarSign} color="brand" delta={+8} />
            </div>
          </Section>
          <Section title="Table">
            <Table>
              <thead><Tr><Th>{isRTL ? 'الاسم' : 'Name'}</Th><Th>{isRTL ? 'الهاتف' : 'Phone'}</Th><Th>{isRTL ? 'الحالة' : 'Status'}</Th></Tr></thead>
              <tbody>
                <Tr><Td>Ahmed Gaber</Td><Td dir="ltr">+20 100…</Td><Td><Badge color="#158A57">{isRTL ? 'نشط' : 'Active'}</Badge></Td></Tr>
                <Tr><Td>Sara Ali</Td><Td dir="ltr">+20 101…</Td><Td><Badge color="#C9860A">{isRTL ? 'متابعة' : 'Following'}</Badge></Td></Tr>
              </tbody>
            </Table>
          </Section>
          <Section title={isRTL ? 'نوافذ وتنبيهات' : 'Dialogs & feedback'} desc="Modal / confirm() / Toast">
            <Row>
              <Button variant="secondary" onClick={() => setModalOpen(true)}>{isRTL ? 'افتح Modal' : 'Open Modal'}</Button>
              <Button variant="secondary" onClick={async () => { const ok = await confirm(isRTL ? 'متأكد؟' : 'Are you sure?'); toast[ok ? 'success' : 'info']?.(ok ? (isRTL ? 'تم' : 'Confirmed') : (isRTL ? 'أُلغي' : 'Cancelled')); }}>confirm()</Button>
              <Button variant="secondary" onClick={() => toast.success(isRTL ? 'تم الحفظ' : 'Saved')}>Toast success</Button>
              <Button variant="secondary" onClick={() => toast.error(isRTL ? 'حصل خطأ' : 'Something failed')}>Toast error</Button>
            </Row>
          </Section>
          <Section title={isRTL ? 'الحالات الفارغة والتحميل' : 'Empty & loading'} desc="EmptyState / TableSkeleton / ListSkeleton / Pagination">
            <div className="w-full grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="rounded-xl border border-edge dark:border-edge-dark p-3"><EmptyState icon={Inbox} title={isRTL ? 'لا يوجد شيء' : 'Nothing here'} subtitle={isRTL ? 'ابدأ بإضافة عنصر' : 'Start by adding an item'} /></div>
              <div className="rounded-xl border border-edge dark:border-edge-dark p-3"><ListSkeleton /></div>
            </div>
            <div className="w-full mt-3"><TableSkeleton /></div>
            <div className="w-full mt-3"><Pagination page={page} totalPages={8} safePage={page} onPageChange={setPage} pageSize={25} onPageSizeChange={() => {}} totalItems={200} /></div>
          </Section>
          <Section title="DataTable" desc={isRTL ? 'الجدول الموحّد config-driven (columns + rows + render + sort).' : 'The config-driven unified table (columns + rows + render + sort).'}>
            <div className="w-full">
              <DataTable columns={demoCols} rows={demoRows} sortBy={sfSort} onSort={setSfSort} />
            </div>
          </Section>
          <Section title="SmartFilter" desc={isRTL ? 'باني فلاتر + بحث + ترتيب + شريط «Filtered by».' : 'Filter builder + search + sort + Filtered-by bar.'}>
            <div className="w-full">
              <SmartFilter
                fields={sfFields}
                filters={sfFilters}
                onFiltersChange={setSfFilters}
                search={sfSearch}
                onSearchChange={setSfSearch}
                searchPlaceholder={isRTL ? 'ابحث بالاسم أو الهاتف...' : 'Search by name or phone...'}
                sortOptions={[{ value: 'name', label: isRTL ? 'الاسم' : 'Name' }, { value: 'created', label: isRTL ? 'الأحدث' : 'Newest' }]}
                sortBy={sfSort}
                onSortChange={setSfSort}
                resultsCount={demoRows.length}
              />
            </div>
          </Section>
          <Section title="ExportButton" desc={isRTL ? 'تصدير CSV/Excel لأي بيانات + أعمدة.' : 'CSV/Excel export for any data + columns.'}>
            <ExportButton data={demoRows} filename="sample" title={isRTL ? 'عيّنة' : 'Sample'} columns={demoCols.map(c => ({ key: c.key, header: c.header }))} />
          </Section>
          <Section title={isRTL ? 'كمان متاح' : 'Also available'} desc={isRTL ? 'مكوّنات محتاجة سياق/بيانات حيّة — بتتشاف في صفحاتها.' : 'Components needing live context/data — seen in their own pages.'}>
            <ul className="text-xs text-content dark:text-content-dark leading-6 m-0 ps-4 list-disc">
              <li><b>VirtualTable</b> — {isRTL ? 'جدول افتراضي للقوائم الضخمة (آلاف الصفوف).' : 'virtualised table for huge lists.'}</li>
              <li><b>DocumentsSection / CommentsSection</b> — {isRTL ? 'مرفقات وتعليقات لأي كيان.' : 'attachments & comments for any entity.'}</li>
              <li><b>ProductTour / UpdateBanner / ConnectionStatus / HeatmapCalendar</b> — {isRTL ? 'جولة، بانر تحديث، حالة الاتصال، تقويم حراري.' : 'tour, update banner, connection status, heatmap.'}</li>
            </ul>
          </Section>
        </>)}

        {tab === 'patterns' && (<>
          <Section title={isRTL ? 'اللون = معنى' : 'Colour = meaning'} desc={isRTL ? 'traffic-light للحالات، البراند للتفاعل، المحايد للبنية. 2-3 ألوان بحد أقصى.' : 'traffic-light for states, brand for interaction, neutral for structure. Max 2-3 colours.'}>
            <Row>
              <Badge color="#158A57">{isRTL ? 'كويس' : 'Good'}</Badge>
              <Badge color="#C9860A">{isRTL ? 'تحذير' : 'Warning'}</Badge>
              <Badge color="#D6403B">{isRTL ? 'خطر' : 'Danger'}</Badge>
              <Badge color="#2F6BD3">{isRTL ? 'تفاعلي' : 'Interactive'}</Badge>
            </Row>
          </Section>
          <Section title={isRTL ? 'حالة فارغة' : 'Empty state'} desc={isRTL ? 'دعوة لفعل مش اعتذار — أيقونة + عنوان + زر.' : 'An invitation, not an apology — icon + title + action.'}>
            <div className="w-full rounded-xl border border-edge dark:border-edge-dark p-3">
              <EmptyState icon={Inbox} title={isRTL ? 'ابدأ أول عميل' : 'Add your first lead'} subtitle={isRTL ? 'مفيش عملاء بعد' : 'No leads yet'} action={<Button variant="primary" size="sm"><Plus size={14} /> {isRTL ? 'إضافة' : 'Add'}</Button>} />
            </div>
          </Section>
          <Section title={isRTL ? 'تأكيد قبل الحذف' : 'Confirm before destructive'}>
            <Button variant="danger" onClick={async () => { const ok = await confirm(isRTL ? 'حذف نهائي؟ لا يمكن التراجع.' : 'Delete permanently? This cannot be undone.'); if (ok) toast.success(isRTL ? '(تجريبي) اتحذف' : '(demo) deleted'); }}><Trash2 size={14} /> {isRTL ? 'حذف' : 'Delete'}</Button>
          </Section>
          <Section title={isRTL ? 'شريط الفلاتر' : 'Filter bar'}>
            <Row>
              <FilterPill label={isRTL ? 'الكل' : 'All'} active={pill === 'all'} onClick={() => setPill('all')} />
              <FilterPill label={isRTL ? 'متأخر' : 'Overdue'} active={pill === 'over'} onClick={() => setPill('over')} count={114} />
              <FilterPill label={isRTL ? 'اليوم' : 'Today'} active={pill === 'today'} onClick={() => setPill('today')} count={50} />
            </Row>
          </Section>
          <Section title={isRTL ? 'فورم + تحقّق' : 'Form + validation'} desc={isRTL ? 'الخطأ يظهر جنب الحقل (13px أحمر) ويختفي أول ما تعدّل.' : 'Error shows next to the field (13px danger) and clears on edit.'}>
            <div className="w-full max-w-[360px]">
              <label className="block text-xs text-content-muted dark:text-content-muted-dark mb-1">{isRTL ? 'الاسم *' : 'Name *'}</label>
              <Input placeholder={isRTL ? 'الاسم...' : 'Name...'} onChange={() => setFormErr('')} className={formErr ? 'border-red-500' : ''} />
              {formErr && <p className="m-0 mt-1 text-[13px] text-red-500">{formErr}</p>}
              <div className="mt-2"><Button variant="primary" size="sm" onClick={() => setFormErr(isRTL ? 'اكتب الاسم الأول' : 'Enter a name first')}>{isRTL ? 'حفظ' : 'Save'}</Button></div>
            </div>
          </Section>
          <Section title={isRTL ? 'التسجيل السريع (Engaged / No engagement)' : 'Quick log (Engaged / No engagement)'}>
            <div className="w-full">
              <div className="text-[10px] font-extrabold uppercase tracking-wide mb-1.5" style={{ color: '#158A57' }}>● {isRTL ? 'تفاعل' : 'Engaged'}</div>
              <Row><Badge color="#158A57">{isRTL ? 'ردّ' : 'Answered'}</Badge><Badge color="#158A57">{isRTL ? 'رد واتساب' : 'Replied'}</Badge><Badge color="#158A57">{isRTL ? 'حضر' : 'Attended'}</Badge></Row>
              <div className="text-[10px] font-extrabold uppercase tracking-wide mt-3 mb-1.5" style={{ color: '#C9860A' }}>● {isRTL ? 'مفيش تفاعل' : 'No engagement'}</div>
              <Row><Badge color="#C9860A">{isRTL ? 'لم يرد' : 'No answer'}</Badge><Badge color="#C9860A">{isRTL ? 'مشغول' : 'Busy'}</Badge><Badge color="#C9860A">{isRTL ? 'لم يحضر' : 'No show'}</Badge></Row>
            </div>
          </Section>
          <Section title="Responsiveness" desc={isRTL ? 'محور مستقل من كل التاريخ — مش آخر لمسة.' : 'A separate axis from the whole history — not the last touch.'}>
            <Row>
              <Badge color="#158A57">{isRTL ? 'متجاوب' : 'Responsive'}</Badge>
              <Badge color="#C9860A">{isRTL ? 'توقّف عن الرد' : 'Unresponsive lately'}</Badge>
              <Badge color="#D6403B">{isRTL ? 'لم يرد نهائياً' : 'Never responded'}</Badge>
              <span className="inline-flex items-center text-[11px] text-content-muted dark:text-content-muted-dark">— {isRTL ? 'لم يتم التواصل' : 'Not contacted yet'}</span>
            </Row>
          </Section>
          <Section title={isRTL ? 'RTL / ثنائي اللغة' : 'RTL / bilingual'} desc={isRTL ? 'كل نص AR/EN، والاتجاه يتقلب مع اللغة، والأرقام/التواريخ تتحاذى صح.' : 'Every string AR/EN, direction flips with language, numbers/dates align correctly.'}>
            <div className="flex items-center gap-2 text-xs text-content-muted dark:text-content-muted-dark"><AlertTriangle size={14} /> {isRTL ? 'استخدم unicode-bidi:plaintext مع الأسماء العربية والأرقام (تقصيص من الجهة الصح).' : 'Use unicode-bidi:plaintext for Arabic names & numbers (correct-side truncation).'}</div>
          </Section>
        </>)}

        <p className="text-[11px] text-content-muted dark:text-content-muted-dark">
          {isRTL ? 'المصدر: components/ui + tailwind tokens + docs/DESIGN_CONVENTIONS.md + docs/SYSTEM_PRINCIPLES.md' : 'Source: components/ui + tailwind tokens + docs/DESIGN_CONVENTIONS.md + docs/SYSTEM_PRINCIPLES.md'}
        </p>
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={isRTL ? 'نموذج Modal' : 'Sample Modal'}>
        <p className="text-sm text-content dark:text-content-dark m-0">{isRTL ? 'ده الـ Modal المشترك — كل النوافذ المنبثقة تستخدمه.' : 'This is the shared Modal — every dialog uses it.'}</p>
        <ModalFooter>
          <Button variant="ghost" onClick={() => setModalOpen(false)}>{isRTL ? 'إلغاء' : 'Cancel'}</Button>
          <Button variant="primary" onClick={() => setModalOpen(false)}>{isRTL ? 'تمام' : 'OK'}</Button>
        </ModalFooter>
      </Modal>
    </div>
  );
}
