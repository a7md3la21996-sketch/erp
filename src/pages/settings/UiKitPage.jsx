import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Button, Card, CardHeader, CardBody, Input, Select, Textarea, Badge, Modal, ModalFooter,
  KpiCard, MetricCard, FilterPill, EmptyState, Pagination, confirm,
} from '../../components/ui';
import SearchableSelect from '../../components/ui/SearchableSelect';
import { TableSkeleton } from '../../components/ui/PageSkeletons';
import { ResultBadge, OutcomeBadge } from '../crm/contacts/constants';
import { useToast } from '../../contexts/ToastContext';
import { Palette, Phone, TrendingUp, Users, DollarSign, Inbox } from 'lucide-react';

// ── UI Kit — a live catalogue of the shared design-system components + tokens.
// The single reference so every screen (and every new build) stays consistent.
// Admin-only (route-guarded in App.jsx).

function Section({ title, desc, children }) {
  return (
    <section className="bg-surface-card dark:bg-surface-card-dark border border-edge dark:border-edge-dark rounded-2xl overflow-hidden mb-5">
      <div className="px-4 py-3 border-b border-edge dark:border-edge-dark">
        <h2 className="m-0 text-sm font-bold text-content dark:text-content-dark">{title}</h2>
        {desc && <p className="m-0 mt-0.5 text-xs text-content-muted dark:text-content-muted-dark">{desc}</p>}
      </div>
      <div className="p-4 flex flex-wrap items-start gap-3">{children}</div>
    </section>
  );
}
function Swatch({ name, cls }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <div className={`w-14 h-14 rounded-xl border border-black/5 dark:border-white/10 ${cls}`} />
      <span className="text-[10px] text-content-muted dark:text-content-muted-dark">{name}</span>
    </div>
  );
}

export default function UiKitPage() {
  const { i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const toast = useToast();
  const [modalOpen, setModalOpen] = useState(false);
  const [sel, setSel] = useState('');
  const [pill, setPill] = useState('all');
  const [page, setPage] = useState(1);

  const selOptions = [
    { value: 'hot', label: isRTL ? 'حار' : 'Hot', color: '#D6403B' },
    { value: 'warm', label: isRTL ? 'دافئ' : 'Warm', color: '#C9860A' },
    { value: 'cold', label: isRTL ? 'بارد' : 'Cold', color: '#2F6BD3' },
  ];

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} className="px-4 py-4 md:px-7 md:py-6 bg-[#F7F8FA] dark:bg-[#0A0D13] min-h-dvh">
      <div className="max-w-[1000px] mx-auto">
        <div className="flex items-center gap-2.5 mb-1">
          <Palette size={20} className="text-brand-500" aria-hidden="true" />
          <h1 className="m-0 text-xl font-bold text-content dark:text-content-dark">UI Kit</h1>
        </div>
        <p className="text-sm text-content-muted dark:text-content-muted-dark mt-0 mb-5">
          {isRTL ? 'كتالوج حيّ لمكوّنات وتوكِنز النظام — المرجع الموحّد لأي شغل جديد.' : 'Live catalogue of the design-system components and tokens — the single reference for any new work.'}
        </p>

        <Section title={isRTL ? 'الألوان (Tokens)' : 'Colors (Tokens)'} desc={isRTL ? 'لون البراند + الحالات الدلالية. اللون = معنى مش زينة.' : 'Brand + semantic states. Colour = meaning, not decoration.'}>
          <Swatch name="brand" cls="bg-brand-500" />
          <Swatch name="brand-700" cls="bg-brand-700" />
          <Swatch name="surface" cls="bg-surface-card dark:bg-surface-card-dark border" />
          <Swatch name="edge" cls="bg-edge dark:bg-edge-dark" />
          <Swatch name="success" cls="bg-emerald-500" />
          <Swatch name="warning" cls="bg-amber-500" />
          <Swatch name="danger" cls="bg-red-500" />
          <Swatch name="purple" cls="bg-[#5A63C4]" />
        </Section>

        <Section title={isRTL ? 'الأزرار — Button' : 'Buttons — Button'} desc="variant: primary · secondary · danger · ghost · success · call · size: sm/md/lg">
          <Button variant="primary">{isRTL ? 'أساسي' : 'Primary'}</Button>
          <Button variant="secondary">{isRTL ? 'ثانوي' : 'Secondary'}</Button>
          <Button variant="danger">{isRTL ? 'خطر' : 'Danger'}</Button>
          <Button variant="ghost">{isRTL ? 'شفاف' : 'Ghost'}</Button>
          <Button variant="success">{isRTL ? 'نجاح' : 'Success'}</Button>
          <Button variant="call"><Phone size={14} /> {isRTL ? 'اتصال' : 'Call'}</Button>
          <Button variant="primary" size="sm">sm</Button>
          <Button variant="primary" size="lg">lg</Button>
          <Button variant="primary" loading>{isRTL ? 'تحميل' : 'Loading'}</Button>
        </Section>

        <Section title={isRTL ? 'الشارات — Badge / ResultBadge / OutcomeBadge / FilterPill' : 'Badges — Badge / ResultBadge / OutcomeBadge / FilterPill'}>
          <Badge color="#158A57">{isRTL ? 'نشط' : 'Active'}</Badge>
          <Badge color="#C9860A">{isRTL ? 'معلّق' : 'Pending'}</Badge>
          <Badge color="#D6403B">{isRTL ? 'متأخر' : 'Overdue'}</Badge>
          <ResultBadge result="answered" isRTL={isRTL} />
          <ResultBadge result="no_answer" isRTL={isRTL} />
          <OutcomeBadge outcome="interested" isRTL={isRTL} />
          <OutcomeBadge outcome="not_interested" isRTL={isRTL} />
          <FilterPill label={isRTL ? 'الكل' : 'All'} active={pill === 'all'} onClick={() => setPill('all')} count={128} />
          <FilterPill label={isRTL ? 'اليوم' : 'Today'} active={pill === 'today'} onClick={() => setPill('today')} count={12} />
        </Section>

        <Section title={isRTL ? 'حقول الإدخال — Input / Select / Textarea / SearchableSelect' : 'Inputs — Input / Select / Textarea / SearchableSelect'}>
          <div className="w-full grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input placeholder={isRTL ? 'نص...' : 'Text...'} />
            <Select defaultValue=""><option value="" disabled>{isRTL ? 'اختر...' : 'Select...'}</option><option>A</option><option>B</option></Select>
            <Textarea placeholder={isRTL ? 'ملاحظة...' : 'Note...'} />
            <div><SearchableSelect value={sel} onChange={setSel} options={selOptions} placeholder={isRTL ? 'اختر الحرارة...' : 'Pick temperature...'} /></div>
          </div>
        </Section>

        <Section title={isRTL ? 'البطاقات — Card / KpiCard / MetricCard' : 'Cards — Card / KpiCard / MetricCard'}>
          <div className="w-full grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Card><CardHeader><span className="text-sm font-bold text-content dark:text-content-dark">Card</span></CardHeader><CardBody><span className="text-xs text-content-muted dark:text-content-muted-dark">{isRTL ? 'محتوى البطاقة' : 'Card body content'}</span></CardBody></Card>
            <KpiCard icon={Users} label={isRTL ? 'العملاء' : 'Leads'} value="4,975" sub={isRTL ? '+12 اليوم' : '+12 today'} color="#2F6BD3" />
            <MetricCard label={isRTL ? 'الصفقات' : 'Deals'} value="18" sublabel={isRTL ? 'هذا الشهر' : 'this month'} icon={DollarSign} color="brand" delta={+8} />
          </div>
        </Section>

        <Section title={isRTL ? 'حالات وعناصر أخرى' : 'States & misc'}>
          <Button variant="secondary" onClick={() => setModalOpen(true)}>{isRTL ? 'افتح Modal' : 'Open Modal'}</Button>
          <Button variant="secondary" onClick={async () => { const ok = await confirm(isRTL ? 'متأكد؟' : 'Are you sure?'); toast[ok ? 'success' : 'info']?.(ok ? (isRTL ? 'تم' : 'Confirmed') : (isRTL ? 'أُلغي' : 'Cancelled')); }}>{isRTL ? 'confirm()' : 'confirm()'}</Button>
          <Button variant="secondary" onClick={() => toast.success(isRTL ? 'تم الحفظ' : 'Saved')}>{isRTL ? 'Toast' : 'Toast'}</Button>
          <div className="w-full mt-2 rounded-xl border border-edge dark:border-edge-dark p-3">
            <EmptyState icon={Inbox} title={isRTL ? 'لا يوجد شيء' : 'Nothing here'} subtitle={isRTL ? 'ابدأ بإضافة عنصر' : 'Start by adding an item'} />
          </div>
          <div className="w-full mt-2"><TableSkeleton /></div>
          <div className="w-full mt-2">
            <Pagination page={page} totalPages={8} safePage={page} onPageChange={setPage} pageSize={25} onPageSizeChange={() => {}} totalItems={200} />
          </div>
        </Section>

        <p className="text-[11px] text-content-muted dark:text-content-muted-dark">
          {isRTL ? 'المرجع: components/ui + tailwind tokens + docs/DESIGN_CONVENTIONS.md' : 'Source: components/ui + tailwind tokens + docs/DESIGN_CONVENTIONS.md'}
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
