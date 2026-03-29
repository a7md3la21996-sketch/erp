import { forwardRef } from 'react';

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

const Button = forwardRef(({ variant = 'primary', size = 'md', className = '', children, ...props }, ref) => (
  <button ref={ref} className={`${base} ${sizes[size]} ${variants[variant]} ${className}`} {...props}>
    {children}
  </button>
));

Button.displayName = 'Button';
export default Button;
