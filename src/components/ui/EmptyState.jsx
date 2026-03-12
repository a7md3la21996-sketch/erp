import { Button } from './index';

export default function EmptyState({ icon: Icon, title, subtitle, action }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      {Icon && (
        <div className="w-16 h-16 rounded-2xl bg-brand-500/10 flex items-center justify-center mb-4">
          <Icon className="w-7 h-7 text-brand-500" />
        </div>
      )}
      {title && (
        <h3 className="m-0 text-base font-bold text-content dark:text-content-dark mb-1">
          {title}
        </h3>
      )}
      {subtitle && (
        <p className="m-0 text-sm text-content-muted dark:text-content-muted-dark max-w-xs">
          {subtitle}
        </p>
      )}
      {action && (
        <div className="mt-4">
          {action}
        </div>
      )}
    </div>
  );
}
