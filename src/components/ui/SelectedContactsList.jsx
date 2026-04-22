import PropTypes from 'prop-types';
import { TEMP } from '../../pages/crm/contacts/constants';

// Sort priority: hot → warm → cool → cold → unknown. Pushes "surprise" hot/warm
// leads to the top of the list so a manager doing a bulk destructive action
// notices them before confirming.
const TEMP_ORDER = { hot: 0, warm: 1, cool: 2, cold: 3 };

/**
 * Scrollable list of selected contacts shown inside bulk-action confirmation
 * modals. Each row: index + name + phone + temperature badge.
 *
 * Usage:
 *   <SelectedContactsList contacts={selected} isRTL={isRTL} />
 */
export default function SelectedContactsList({ contacts, isRTL, maxHeight = 300 }) {
  if (!Array.isArray(contacts) || contacts.length === 0) return null;

  const sorted = [...contacts].sort((a, b) => {
    const aT = TEMP_ORDER[a.temperature] ?? 4;
    const bT = TEMP_ORDER[b.temperature] ?? 4;
    if (aT !== bT) return aT - bT;
    return (a.full_name || '').localeCompare(b.full_name || '', 'ar');
  });

  return (
    <div
      role="list"
      aria-label={isRTL ? 'قائمة العملاء المختارين' : 'Selected contacts'}
      className="border border-edge dark:border-edge-dark rounded-lg overflow-y-auto bg-surface-bg/50 dark:bg-black/10"
      style={{ maxHeight }}
    >
      {sorted.map((c, i) => {
        const temp = TEMP[c.temperature] || null;
        return (
          <div
            key={c.id || i}
            role="listitem"
            className={`flex items-center gap-2.5 px-3 py-2 text-xs ${i > 0 ? 'border-t border-edge/40 dark:border-edge-dark/40' : ''}`}
          >
            <span className="text-content-muted dark:text-content-muted-dark shrink-0 min-w-[20px] text-[11px]">{i + 1}.</span>
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-content dark:text-content-dark truncate leading-tight">
                {c.full_name || (isRTL ? 'بدون اسم' : 'No name')}
              </div>
              <div className="text-content-muted dark:text-content-muted-dark text-[10px] truncate" dir="ltr">
                {c.phone || '—'}
              </div>
            </div>
            {temp && (
              <span
                className="shrink-0 px-2 py-0.5 rounded text-[10px] font-semibold"
                style={{ background: temp.bg, color: temp.color }}
              >
                {isRTL ? temp.labelAr : temp.label}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

SelectedContactsList.propTypes = {
  contacts: PropTypes.array.isRequired,
  isRTL: PropTypes.bool,
  maxHeight: PropTypes.number,
};
