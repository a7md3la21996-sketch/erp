export default function Card({ className = '', hover = false, children, ...props }) {
  return (
    <div
      className={`
        bg-surface-card dark:bg-surface-card-dark
        border border-edge dark:border-edge-dark
        rounded-xl
        ${hover ? 'transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg cursor-pointer' : ''}
        ${className}
      `}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({ className = '', children }) {
  return (
    <div className={`px-5 py-4 border-b border-edge dark:border-edge-dark ${className}`}>
      {children}
    </div>
  );
}

export function CardBody({ className = '', children }) {
  return <div className={`p-5 ${className}`}>{children}</div>;
}
