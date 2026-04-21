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

/**
 * Trap keyboard focus inside the modal while it's open. Tab/Shift+Tab cycle
 * through focusable descendants; initial focus moves to the first focusable
 * element. On unmount, focus returns to whatever element was focused before.
 *
 * Usage:
 *   const dialogRef = useRef(null);
 *   useFocusTrap(dialogRef);
 *   return <div ref={dialogRef} role="dialog" aria-modal="true">...</div>;
 */
export function useFocusTrap(ref) {
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const previouslyFocused = document.activeElement;
    const focusableSelector = 'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';
    const getFocusable = () => Array.from(node.querySelectorAll(focusableSelector)).filter(el => !el.hasAttribute('aria-hidden') && el.offsetParent !== null);
    // Move focus to first focusable element
    const first = getFocusable()[0];
    if (first) first.focus();
    const handler = (e) => {
      if (e.key !== 'Tab') return;
      const focusables = getFocusable();
      if (focusables.length === 0) { e.preventDefault(); return; }
      const firstEl = focusables[0];
      const lastEl = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === firstEl) { e.preventDefault(); lastEl.focus(); }
      else if (!e.shiftKey && document.activeElement === lastEl) { e.preventDefault(); firstEl.focus(); }
    };
    node.addEventListener('keydown', handler);
    return () => {
      node.removeEventListener('keydown', handler);
      if (previouslyFocused && typeof previouslyFocused.focus === 'function') previouslyFocused.focus();
    };
  }, [ref]);
}
