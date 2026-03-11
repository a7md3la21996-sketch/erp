// LoadingAndEmpty.jsx — Skeleton + Empty State components

export function SkeletonBox({ width = '100%', height = 16, radius = 6, className = '' }) {
  return (
    <div className={`rounded-md bg-brand-500/15 opacity-60 ${className}`} style={{ width, height, borderRadius: radius }} />
  );
}

export function SkeletonRow({ cols = 5 }) {
  return (
    <tr>
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="py-3 px-4">
          <div className={`h-3 rounded-md bg-brand-500/15 opacity-60 ${i === 0 ? 'w-3/5' : 'w-4/5'}`} />
        </td>
      ))}
    </tr>
  );
}

export function SkeletonTable({ rows = 5, cols = 5 }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, i) => (
        <SkeletonRow key={i} cols={cols} />
      ))}
    </>
  );
}

export function SkeletonCard() {
  return (
    <div className="rounded-xl border border-brand-500/15 p-4 flex flex-col gap-2.5">
      <div className="h-3.5 rounded-md bg-brand-500/15 w-3/5" />
      <div className="h-2.5 rounded-md bg-brand-500/15 w-4/5 opacity-70" />
      <div className="h-2.5 rounded-md bg-brand-500/15 w-2/5 opacity-50" />
    </div>
  );
}

export function SkeletonKpiGrid({ count = 4 }) {
  return (
    <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${count}, 1fr)` }}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-xl border border-brand-500/15 p-5 flex flex-col gap-2.5">
          <div className="h-3 rounded-md bg-brand-500/15 w-1/2" />
          <div className="h-7 rounded-md bg-brand-500/15 w-[70%]" />
        </div>
      ))}
    </div>
  );
}

export function SkeletonPage({ rows = 5 }) {
  return (
    <div className="p-6 flex flex-col gap-4">
      <SkeletonKpiGrid count={4} />
      <div className="rounded-xl border border-brand-500/15 overflow-hidden">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="py-3.5 px-4 border-b border-brand-500/10 flex gap-3 items-center">
            <div className="w-9 h-9 rounded-lg bg-brand-500/15 shrink-0" />
            <div className="flex-1 flex flex-col gap-2">
              <div className="h-3 rounded-md bg-brand-500/15 w-2/5" />
              <div className="h-2.5 rounded-md bg-brand-500/15 w-3/5 opacity-70" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function SmartEmpty({ icon, titleAr, titleEn, subAr, subEn, lang = 'ar', action, isDark }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
      <div className="w-16 h-16 rounded-[18px] bg-gradient-to-br from-brand-900/[0.08] to-brand-500/[0.12] border-[1.5px] border-dashed border-brand-500/30 flex items-center justify-center mb-4">
        {icon}
      </div>
      <p className="m-0 mb-1.5 font-bold text-[15px] text-content dark:text-content-dark">{lang === 'ar' ? titleAr : titleEn}</p>
      {(subAr || subEn) && <p className="m-0 mb-4 text-[13px] text-content-muted dark:text-content-muted-dark">{lang === 'ar' ? subAr : subEn}</p>}
      {action}
    </div>
  );
}

export function SmartEmptyTable({ colSpan = 6, icon, titleAr, titleEn, subAr, subEn, lang = 'ar' }) {
  return (
    <tr>
      <td colSpan={colSpan} className="p-0 border-none">
        <SmartEmpty icon={icon} titleAr={titleAr} titleEn={titleEn} subAr={subAr} subEn={subEn} lang={lang} />
      </td>
    </tr>
  );
}

export function EmptyState({ icon, titleAr, titleEn, subAr, subEn, lang = 'ar' }) {
  return <SmartEmpty icon={icon} titleAr={titleAr} titleEn={titleEn} subAr={subAr} subEn={subEn} lang={lang} />;
}

export function EmptyTable({ colSpan, icon, titleAr, titleEn, subAr, subEn, lang }) {
  return <SmartEmptyTable colSpan={colSpan} icon={icon} titleAr={titleAr} titleEn={titleEn} subAr={subAr} subEn={subEn} lang={lang} />;
}
