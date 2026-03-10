// LoadingAndEmpty.jsx — Skeleton + Empty State components

export function SkeletonBox({ width = '100%', height = 16, radius = 6, style = {} }) {
  return (
    <div style={{ width, height, borderRadius: radius, background: 'rgba(74,122,171,0.15)', opacity: 0.6, ...style }} />
  );
}

export function SkeletonRow({ cols = 5 }) {
  return (
    <tr>
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} style={{ padding: '12px 16px' }}>
          <div style={{ height: 12, borderRadius: 6, background: 'rgba(74,122,171,0.15)', opacity: 0.6, width: i === 0 ? '60%' : '80%' }} />
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
    <div style={{ borderRadius: 12, border: '1px solid rgba(74,122,171,0.15)', padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ height: 14, borderRadius: 6, background: 'rgba(74,122,171,0.15)', width: '60%' }} />
      <div style={{ height: 10, borderRadius: 6, background: 'rgba(74,122,171,0.15)', width: '80%', opacity: 0.7 }} />
      <div style={{ height: 10, borderRadius: 6, background: 'rgba(74,122,171,0.15)', width: '40%', opacity: 0.5 }} />
    </div>
  );
}

export function SkeletonKpiGrid({ count = 4 }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${count}, 1fr)`, gap: 16 }}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} style={{ borderRadius: 12, border: '1px solid rgba(74,122,171,0.15)', padding: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ height: 12, borderRadius: 6, background: 'rgba(74,122,171,0.15)', width: '50%' }} />
          <div style={{ height: 28, borderRadius: 6, background: 'rgba(74,122,171,0.15)', width: '70%' }} />
        </div>
      ))}
    </div>
  );
}

export function SkeletonPage({ rows = 5 }) {
  return (
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <SkeletonKpiGrid count={4} />
      <div style={{ borderRadius: 12, border: '1px solid rgba(74,122,171,0.15)', overflow: 'hidden' }}>
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} style={{ padding: '14px 16px', borderBottom: '1px solid rgba(74,122,171,0.1)', display: 'flex', gap: 12, alignItems: 'center' }}>
            <div style={{ width: 36, height: 36, borderRadius: 8, background: 'rgba(74,122,171,0.15)', flexShrink: 0 }} />
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ height: 12, borderRadius: 6, background: 'rgba(74,122,171,0.15)', width: '40%' }} />
              <div style={{ height: 10, borderRadius: 6, background: 'rgba(74,122,171,0.15)', width: '60%', opacity: 0.7 }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function SmartEmpty({ icon, titleAr, titleEn, subAr, subEn, lang = 'ar', action, isDark }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 24px', textAlign: 'center' }}>
      <div style={{ width: 64, height: 64, borderRadius: 18, background: 'linear-gradient(135deg, rgba(27,51,71,0.08), rgba(74,122,171,0.12))', border: '1.5px dashed rgba(74,122,171,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
        {icon}
      </div>
      <p style={{ margin: '0 0 6px', fontWeight: 700, fontSize: 15, color: isDark ? '#E2EAF4' : '#1A2B3C' }}>{lang === 'ar' ? titleAr : titleEn}</p>
      {(subAr || subEn) && <p style={{ margin: '0 0 16px', fontSize: 13, color: isDark ? '#8BA8C8' : '#64748B' }}>{lang === 'ar' ? subAr : subEn}</p>}
      {action}
    </div>
  );
}

export function SmartEmptyTable({ colSpan = 6, icon, titleAr, titleEn, subAr, subEn, lang = 'ar' }) {
  return (
    <tr>
      <td colSpan={colSpan} style={{ padding: 0, border: 'none' }}>
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
