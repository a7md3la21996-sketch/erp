import { useEffect } from 'react';
import { X } from 'lucide-react';

export default function Modal({ open, onClose, title, width = 'max-w-lg', children }) {
  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler, true);
    return () => document.removeEventListener('keydown', handler, true);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Content */}
      <div
        dir="auto"
        className={`
          relative ${width} w-[calc(100%-1.5rem)] md:w-full mx-2 md:mx-4 max-h-[85vh] md:max-h-[90vh] overflow-y-auto
          bg-surface-card dark:bg-surface-card-dark
          rounded-2xl shadow-2xl z-[1]
          animate-in fade-in zoom-in-95 duration-200
        `}
      >
        {/* Header */}
        {title && (
          <div className="flex items-center justify-between px-6 py-4 border-b border-edge dark:border-edge-dark">
            <h3 className="m-0 text-base font-bold text-content dark:text-content-dark">{title}</h3>
            <button
              onClick={onClose}
              className="p-1 rounded-md text-content-muted dark:text-content-muted-dark hover:bg-gray-100 dark:hover:bg-brand-500/10 transition-colors cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>
        )}

        {/* Body */}
        <div className="p-6">
          {children}
        </div>
      </div>
    </div>
  );
}

export function ModalFooter({ children, className = '' }) {
  return (
    <div className={`flex gap-3 mt-5 ${className}`}>
      {children}
    </div>
  );
}
