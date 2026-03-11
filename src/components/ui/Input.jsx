import { forwardRef } from 'react';

const base = 'w-full rounded-lg border border-edge dark:border-edge-dark bg-surface-input dark:bg-surface-input-dark text-content dark:text-content-dark text-sm font-cairo outline-none transition-colors duration-200 focus:border-brand-500 focus:ring-1 focus:ring-brand-500/30';

const sizes = {
  sm: 'px-2.5 py-1.5 text-xs',
  md: 'px-3 py-2 text-sm',
  lg: 'px-4 py-2.5 text-sm',
};

const Input = forwardRef(({ size = 'md', className = '', ...props }, ref) => (
  <input ref={ref} className={`${base} ${sizes[size]} ${className}`} {...props} />
));
Input.displayName = 'Input';

export const Select = forwardRef(({ size = 'md', className = '', children, ...props }, ref) => (
  <select ref={ref} className={`${base} ${sizes[size]} cursor-pointer ${className}`} {...props}>
    {children}
  </select>
));
Select.displayName = 'Select';

export const Textarea = forwardRef(({ size = 'md', className = '', ...props }, ref) => (
  <textarea ref={ref} className={`${base} ${sizes[size]} resize-y min-h-[70px] ${className}`} {...props} />
));
Textarea.displayName = 'Textarea';

export default Input;
