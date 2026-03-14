import { useEffect, useRef, useCallback, useState } from 'react';

/**
 * Global keyboard shortcuts hook with leader-key support.
 *
 * Shortcuts:
 *   ?  or  Shift+/        — show shortcuts help modal
 *   g then h              — go to dashboard (home)
 *   g then c              — go to contacts
 *   g then o              — go to opportunities
 *   g then d              — go to deals
 *   g then t              — go to tasks
 *   g then r              — go to reports
 *   g then s              — go to settings
 *   g then m              — go to chat (messages)
 *   Escape                — close any open modal/drawer (handled elsewhere)
 *   Cmd/Ctrl + K          — global search (handled in GlobalSearch/Header)
 */

const LEADER_TIMEOUT = 1000; // ms to wait after leader key

// Check if focus is inside an editable element
function isEditableTarget(e) {
  const tag = e.target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (e.target.isContentEditable) return true;
  // Also skip if inside a [role="textbox"]
  if (e.target.getAttribute('role') === 'textbox') return true;
  return false;
}

export function useKeyboardShortcuts(shortcuts = []) {
  const [showHelp, setShowHelp] = useState(false);
  const leaderRef = useRef(null); // stores leader key if pressed
  const leaderTimerRef = useRef(null);

  const clearLeader = useCallback(() => {
    leaderRef.current = null;
    if (leaderTimerRef.current) {
      clearTimeout(leaderTimerRef.current);
      leaderTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    const handler = (e) => {
      if (isEditableTarget(e)) return;

      // Check for "?" key (Shift+/ on most layouts, or direct ? key)
      if (e.key === '?' || (e.key === '/' && e.shiftKey)) {
        if (!e.metaKey && !e.ctrlKey && !e.altKey) {
          e.preventDefault();
          setShowHelp(prev => !prev);
          clearLeader();
          return;
        }
      }

      // If we have a pending leader key, check for second key
      if (leaderRef.current) {
        const leader = leaderRef.current;
        clearLeader();

        // Find matching shortcut with leader
        const match = shortcuts.find(s =>
          s.leader === leader &&
          s.key === e.key.toLowerCase() &&
          !s.ctrl && !s.meta && !s.shift && !s.alt
        );
        if (match) {
          e.preventDefault();
          match.action();
          return;
        }
        // No match after leader — fall through
      }

      // Check if this is a leader key press
      if (e.key === 'g' && !e.metaKey && !e.ctrlKey && !e.altKey && !e.shiftKey) {
        leaderRef.current = 'g';
        leaderTimerRef.current = setTimeout(() => {
          leaderRef.current = null;
        }, LEADER_TIMEOUT);
        return;
      }

      // Check for regular (non-leader) shortcuts
      for (const s of shortcuts) {
        if (s.leader) continue; // skip leader-based shortcuts
        const keyMatch = e.key.toLowerCase() === s.key.toLowerCase();
        const ctrlMatch = (s.ctrl || s.meta) ? (e.metaKey || e.ctrlKey) : (!e.metaKey && !e.ctrlKey);
        const shiftMatch = s.shift ? e.shiftKey : !e.shiftKey;
        const altMatch = s.alt ? e.altKey : !e.altKey;
        if (keyMatch && ctrlMatch && shiftMatch && altMatch) {
          e.preventDefault();
          s.action();
          return;
        }
      }
    };

    document.addEventListener('keydown', handler);
    return () => {
      document.removeEventListener('keydown', handler);
      clearLeader();
    };
  }, [shortcuts, clearLeader]);

  return { showHelp, setShowHelp };
}
