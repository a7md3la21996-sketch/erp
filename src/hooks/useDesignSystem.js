import { useTheme } from '../contexts/ThemeContext';

/**
 * Shared design system hook — single source of truth for all theme colors.
 *
 * Properties:
 *   dark      — boolean
 *   bg        — page background
 *   card      — card / panel background
 *   border    — borders & dividers
 *   text      — primary text
 *   muted     — secondary / muted text
 *   input     — input field background
 *   rowHover  — table row hover
 *   thBg      — table header background
 *   accent    — accent blue
 *   primary   — primary dark blue
 */
export function useDS() {
  const { theme } = useTheme();
  const dark = theme === 'dark';
  return {
    dark,
    bg:       dark ? '#152232'                 : '#F0F4F8',
    card:     dark ? '#1a2234'                 : '#ffffff',
    border:   dark ? 'rgba(74,122,171,0.2)'    : '#E2E8F0',
    text:     dark ? '#E2EAF4'                 : '#1A2B3C',
    muted:    dark ? '#8BA8C8'                 : '#64748B',
    input:    dark ? '#0F1E2D'                 : '#ffffff',
    rowHover: dark ? 'rgba(74,122,171,0.07)'   : '#F8FAFC',
    thBg:     dark ? 'rgba(74,122,171,0.08)'   : '#F8FAFC',
    accent:   '#4A7AAB',
    primary:  '#2B4C6F',
  };
}
