const variants = {
  default:  'bg-brand-500/10 text-brand-500',
  success:  'bg-emerald-500/12 text-emerald-600',
  warning:  'bg-orange-500/10 text-orange-500',
  danger:   'bg-red-500/10 text-red-500',
  info:     'bg-blue-500/10 text-blue-500',
  muted:    'bg-gray-100 dark:bg-brand-500/10 text-content-muted dark:text-content-muted-dark',
};

const sizes = {
  sm: 'text-[10px] px-1.5 py-0.5',
  md: 'text-xs px-2.5 py-1',
  lg: 'text-sm px-3 py-1.5',
};

export default function Badge({ variant = 'default', size = 'md', className = '', style, children }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md font-semibold whitespace-nowrap ${variants[variant] || ''} ${sizes[size]} ${className}`}
      style={style}
    >
      {children}
    </span>
  );
}
