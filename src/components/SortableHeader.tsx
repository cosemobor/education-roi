interface SortableHeaderProps<K extends string> {
  label: string;
  sortKey: K;
  currentSortKey: K;
  currentSortDir: 'asc' | 'desc';
  onClick: (key: K) => void;
  className?: string;
}

export default function SortableHeader<K extends string>({
  label,
  sortKey,
  currentSortKey,
  currentSortDir,
  onClick,
  className = '',
}: SortableHeaderProps<K>) {
  const isActive = currentSortKey === sortKey;
  const arrow = isActive ? (currentSortDir === 'asc' ? ' \u25B2' : ' \u25BC') : '';

  return (
    <th className={`px-3 py-2 text-left ${className}`}>
      <button
        onClick={() => onClick(sortKey)}
        className={`text-xs font-medium transition-colors ${
          isActive
            ? 'text-accent'
            : 'text-text-secondary hover:text-text-primary'
        }`}
      >
        {label}
        {arrow}
      </button>
    </th>
  );
}
