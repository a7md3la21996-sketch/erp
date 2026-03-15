import { useState, useMemo } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import { useTranslation } from 'react-i18next';

const MONTH_LABELS_EN = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const MONTH_LABELS_AR = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];

const DAY_LABELS_EN = ['Mon','','Wed','','Fri','',''];
const DAY_LABELS_AR = ['الإثنين','','الأربعاء','','الجمعة','',''];

function getLevel(count) {
  if (count === 0) return 0;
  if (count <= 2) return 1;
  if (count <= 5) return 2;
  if (count <= 10) return 3;
  return 4;
}

function getLevelColor(level, isDark, colorScheme) {
  const base = colorScheme || '#4A7AAB';
  if (level === 0) return isDark ? '#1a2332' : '#ebedf0';
  if (level === 1) return isDark ? base + '40' : base + '30';
  if (level === 2) return isDark ? base + '70' : base + '60';
  if (level === 3) return isDark ? base + 'aa' : base + '99';
  return isDark ? base : base;
}

/**
 * HeatmapCalendar - GitHub-style heatmap calendar
 *
 * @param {Array} data - [{date: 'YYYY-MM-DD', count: number}]
 * @param {string} title - optional title
 * @param {string} colorScheme - optional base hex color (default #4A7AAB)
 * @param {number} months - how many months to show (default 6)
 * @param {boolean} compact - smaller version for dashboard
 * @param {function} onDayClick - callback when a day is clicked
 */
export default function HeatmapCalendar({ data = [], title, colorScheme, months = 6, compact = false, onDayClick }) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const { i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';

  const [tooltip, setTooltip] = useState(null);

  const { weeks, monthPositions } = useMemo(() => {
    const dataMap = {};
    data.forEach(d => { dataMap[d.date] = d.count; });

    const now = new Date();
    const start = new Date(now);
    start.setMonth(start.getMonth() - months);
    // Align to start of week (Sunday=0, we want Monday=1)
    const dayOfWeek = start.getDay();
    const diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    start.setDate(start.getDate() - diff);
    start.setHours(0, 0, 0, 0);

    const weeks = [];
    const monthPositions = [];
    let currentWeek = [];
    let lastMonth = -1;
    const cursor = new Date(start);

    while (cursor <= now || currentWeek.length > 0) {
      if (cursor > now && currentWeek.length === 0) break;

      const dateStr = cursor.toISOString().slice(0, 10);
      const month = cursor.getMonth();
      const isPast = cursor <= now;

      if (month !== lastMonth && isPast) {
        monthPositions.push({ month, weekIndex: weeks.length + (currentWeek.length > 0 ? 0 : 0) });
        lastMonth = month;
      }

      currentWeek.push({
        date: dateStr,
        count: isPast ? (dataMap[dateStr] || 0) : -1,
        day: cursor.getDate(),
        month: cursor.getMonth(),
        year: cursor.getFullYear(),
        dayOfWeek: cursor.getDay(),
      });

      if (currentWeek.length === 7) {
        weeks.push(currentWeek);
        currentWeek = [];
      }

      cursor.setDate(cursor.getDate() + 1);
      if (cursor > now && currentWeek.length > 0) {
        // pad remaining
        while (currentWeek.length < 7) {
          currentWeek.push({ date: '', count: -1, day: 0, month: 0, year: 0, dayOfWeek: 0 });
        }
        weeks.push(currentWeek);
        currentWeek = [];
      }
    }

    // Deduplicate month positions
    const seen = new Set();
    const uniqueMonths = [];
    monthPositions.forEach(mp => {
      const key = mp.month;
      if (!seen.has(key)) {
        seen.add(key);
        uniqueMonths.push(mp);
      }
    });

    return { weeks, monthPositions: uniqueMonths };
  }, [data, months]);

  const cellSize = compact ? 10 : 13;
  const cellGap = compact ? 2 : 3;
  const labelWidth = compact ? 0 : 32;
  const totalWidth = labelWidth + weeks.length * (cellSize + cellGap);

  const monthLabels = isRTL ? MONTH_LABELS_AR : MONTH_LABELS_EN;
  const dayLabels = isRTL ? DAY_LABELS_AR : DAY_LABELS_EN;

  return (
    <div style={{ direction: isRTL ? 'rtl' : 'ltr' }}>
      {title && !compact && (
        <div style={{
          fontSize: 14,
          fontWeight: 700,
          color: isDark ? '#e2e8f0' : '#1e293b',
          marginBottom: 12,
          textAlign: isRTL ? 'right' : 'left',
        }}>
          {title}
        </div>
      )}

      <div style={{ overflowX: 'auto', overflowY: 'visible', paddingBottom: 4 }}>
        <div style={{ position: 'relative', minWidth: totalWidth, display: 'inline-block' }}>
          {/* Month labels */}
          {!compact && (
            <div style={{
              display: 'flex',
              marginBottom: 4,
              paddingLeft: isRTL ? 0 : labelWidth,
              paddingRight: isRTL ? labelWidth : 0,
              position: 'relative',
              height: 16,
            }}>
              {monthPositions.map((mp, i) => (
                <div
                  key={i}
                  style={{
                    position: 'absolute',
                    [isRTL ? 'right' : 'left']: labelWidth + mp.weekIndex * (cellSize + cellGap),
                    fontSize: 10,
                    color: isDark ? '#94a3b8' : '#64748b',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {monthLabels[mp.month]}
                </div>
              ))}
            </div>
          )}

          {/* Grid */}
          <div style={{ display: 'flex', gap: 0 }}>
            {/* Day-of-week labels */}
            {!compact && (
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: cellGap,
                width: labelWidth,
                flexShrink: 0,
              }}>
                {dayLabels.map((label, i) => (
                  <div
                    key={i}
                    style={{
                      height: cellSize,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: isRTL ? 'flex-end' : 'flex-start',
                      fontSize: 9,
                      color: isDark ? '#94a3b8' : '#64748b',
                      paddingRight: isRTL ? 0 : 6,
                      paddingLeft: isRTL ? 6 : 0,
                    }}
                  >
                    {label}
                  </div>
                ))}
              </div>
            )}

            {/* Week columns */}
            <div style={{ display: 'flex', gap: cellGap }}>
              {weeks.map((week, wi) => (
                <div key={wi} style={{ display: 'flex', flexDirection: 'column', gap: cellGap }}>
                  {week.map((day, di) => {
                    if (day.count === -1) {
                      return (
                        <div
                          key={di}
                          style={{
                            width: cellSize,
                            height: cellSize,
                            borderRadius: 2,
                            background: 'transparent',
                          }}
                        />
                      );
                    }

                    const level = getLevel(day.count);
                    const color = getLevelColor(level, isDark, colorScheme);

                    return (
                      <div
                        key={di}
                        style={{
                          width: cellSize,
                          height: cellSize,
                          borderRadius: 2,
                          background: color,
                          cursor: 'pointer',
                          transition: 'transform 0.1s, outline 0.1s',
                          outline: tooltip?.date === day.date ? '2px solid ' + (isDark ? '#e2e8f0' : '#1e293b') : 'none',
                          outlineOffset: 1,
                        }}
                        onMouseEnter={(e) => {
                          const rect = e.target.getBoundingClientRect();
                          setTooltip({
                            date: day.date,
                            count: day.count,
                            x: rect.left + rect.width / 2,
                            y: rect.top,
                          });
                        }}
                        onMouseLeave={() => setTooltip(null)}
                        onClick={() => onDayClick?.(day)}
                      />
                    );
                  })}
                </div>
              ))}
            </div>
          </div>

          {/* Legend */}
          {!compact && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: isRTL ? 'flex-start' : 'flex-end',
              gap: 6,
              marginTop: 10,
              flexDirection: isRTL ? 'row-reverse' : 'row',
            }}>
              <span style={{ fontSize: 10, color: isDark ? '#94a3b8' : '#64748b' }}>
                {isRTL ? 'أقل' : 'Less'}
              </span>
              {[0, 1, 2, 3, 4].map(level => (
                <div
                  key={level}
                  style={{
                    width: cellSize,
                    height: cellSize,
                    borderRadius: 2,
                    background: getLevelColor(level, isDark, colorScheme),
                  }}
                />
              ))}
              <span style={{ fontSize: 10, color: isDark ? '#94a3b8' : '#64748b' }}>
                {isRTL ? 'أكثر' : 'More'}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Tooltip (fixed position) */}
      {tooltip && (
        <div
          style={{
            position: 'fixed',
            left: tooltip.x,
            top: tooltip.y - 40,
            transform: 'translateX(-50%)',
            background: isDark ? '#1a2332' : '#ffffff',
            border: '1px solid ' + (isDark ? 'rgba(74,122,171,0.3)' : '#e2e8f0'),
            borderRadius: 8,
            padding: '6px 10px',
            fontSize: 11,
            color: isDark ? '#e2e8f0' : '#1e293b',
            whiteSpace: 'nowrap',
            zIndex: 9999,
            pointerEvents: 'none',
            boxShadow: isDark ? '0 4px 12px rgba(0,0,0,0.4)' : '0 4px 12px rgba(0,0,0,0.1)',
          }}
        >
          <strong>{tooltip.count}</strong>{' '}
          {isRTL ? 'نشاط' : (tooltip.count === 1 ? 'activity' : 'activities')}{' '}
          {isRTL ? 'في' : 'on'}{' '}
          {new Date(tooltip.date + 'T00:00:00').toLocaleDateString(isRTL ? 'ar-EG' : 'en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
        </div>
      )}
    </div>
  );
}
