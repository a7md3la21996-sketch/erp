import { useEffect, useRef } from 'react';

/**
 * Close on ESC key press (capture phase, stops propagation)
 */
export function useEscClose(onClose) {
  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape') { e.stopImmediatePropagation(); onClose(); }
    };
    document.addEventListener('keydown', handler, true);
    return () => document.removeEventListener('keydown', handler, true);
  }, [onClose]);
}

/**
 * Close when clicking outside the referenced element
 */
export function useClickOutside(ref, onClose, active = true) {
  useEffect(() => {
    if (!active) return;
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [ref, onClose, active]);
}
