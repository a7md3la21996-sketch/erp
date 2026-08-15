import { forwardRef } from 'react';
import { Loader2 } from 'lucide-react';

const base = 'inline-flex items-center justify-center gap-2 font-semibold rounded-lg cursor-pointer transition-all duration-200 font-cairo disabled:opacity-50 disabled:cursor-not-allowed select-none active:scale-[0.97]';

const sizes = {
  sm: 'text-xs px-3 py-1.5',
  md: 'text-sm px-4 py-2.5',
  lg: 'text-sm px-5 py-3',
};

const variants = {
  primary:   'bg-gradient-to-br from-brand-900 to-brand-800 text-white shadow-md hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0',
  secondary: 'border border-edge dark:border-edge-dark bg-surface-card dark:bg-surface-card-dark text-content-muted dark:text-content-muted-dark hover:bg-gray-50 dark:hover:bg-brand-500/10',
  danger:    'bg-red-500/10 text-red-500 border border-red-500/20 hover:bg-red-500/20',
  ghost:     'text-content-muted dark:text-content-muted-dark hover:bg-gray-100 dark:hover:bg-brand-500/10',
  success:   'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 hover:bg-emerald-500/20',
  call:      'bg-gradient-to-br from-[#065F46] to-emerald-500 text-white shadow-md hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0',
};

// `loading` shows an inline spinner and disables the button so a slow save can't
// be double-submitted and the user gets immediate "it's working" feedback (an
// app tell — before this, buttons looked inert while an async action ran). The
// label stays rendered so the button keeps its width and doesn't jump. Opt-in:
// buttons that don't pass `loading` are unchanged.
const Button = forwardRef(({ variant = 'primary', size = 'md', className = '', children, loading = false, disabled, ...props }, ref) => (
  <button
    ref={ref}
    disabled={loading || disabled}
    aria-busy={loading || undefined}
    className={`${base} ${sizes[size]} ${variants[variant]} ${className}`}
    {...props}
  >
    {loading && <Loader2 className="animate-spin shrink-0" size={size === 'sm' ? 14 : 16} aria-hidden="true" />}
    {children}
  </button>
));

Button.displayName = 'Button';
export default Button;
