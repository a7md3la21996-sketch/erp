export function Table({ className = '', children }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-edge dark:border-edge-dark">
      <table className={`w-full border-collapse text-sm ${className}`}>
        {children}
      </table>
    </div>
  );
}

export function Th({ className = '', children, ...props }) {
  return (
    <th
      className={`
        px-4 py-3 text-xs font-semibold uppercase tracking-wider
        text-content-muted dark:text-content-muted-dark
        bg-surface-bg dark:bg-brand-500/[0.08]
        border-b border-edge dark:border-edge-dark
        text-start
        ${className}
      `}
      {...props}
    >
      {children}
    </th>
  );
}

export function Td({ className = '', children, ...props }) {
  return (
    <td
      className={`px-4 py-3 border-b border-edge dark:border-edge-dark text-content dark:text-content-dark ${className}`}
      {...props}
    >
      {children}
    </td>
  );
}

export function Tr({ className = '', children, ...props }) {
  return (
    <tr
      className={`transition-colors hover:bg-[#F8FAFC] dark:hover:bg-brand-500/[0.07] ${className}`}
      {...props}
    >
      {children}
    </tr>
  );
}
