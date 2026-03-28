import { useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';

/**
 * Virtual scrolling table for large datasets (1000+ rows).
 * Only renders visible rows in the DOM.
 *
 * Usage:
 *   <VirtualTable
 *     rows={filteredData}
 *     rowHeight={52}
 *     maxHeight={600}
 *     renderHeader={() => <tr>...</tr>}
 *     renderRow={(row, index) => <tr key={row.id}>...</tr>}
 *   />
 */
export default function VirtualTable({
  rows,
  rowHeight = 52,
  maxHeight = 600,
  renderHeader,
  renderRow,
  className = '',
}) {
  const parentRef = useRef(null);

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => rowHeight,
    overscan: 10,
  });

  return (
    <div className={`overflow-x-auto rounded-xl border border-edge dark:border-edge-dark ${className}`}>
      <div
        ref={parentRef}
        style={{ maxHeight, overflow: 'auto' }}
      >
        <table className="w-full border-collapse text-sm">
          {renderHeader && (
            <thead className="sticky top-0 z-10">
              {renderHeader()}
            </thead>
          )}
          <tbody>
            <tr style={{ height: virtualizer.getTotalSize() }}>
              <td colSpan={999} style={{ padding: 0, border: 'none', position: 'relative' }}>
                {virtualizer.getVirtualItems().map(virtualRow => {
                  const row = rows[virtualRow.index];
                  return (
                    <div
                      key={virtualRow.key}
                      style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: `${virtualRow.size}px`,
                        transform: `translateY(${virtualRow.start}px)`,
                      }}
                    >
                      <table className="w-full border-collapse text-sm">
                        <tbody>
                          {renderRow(row, virtualRow.index)}
                        </tbody>
                      </table>
                    </div>
                  );
                })}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
