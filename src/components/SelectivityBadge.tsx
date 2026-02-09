const TIER_COLORS: Record<string, string> = {
  'Most Selective': 'bg-purple-100 text-purple-700',
  'Highly Selective': 'bg-blue-100 text-blue-700',
  Selective: 'bg-green-100 text-green-700',
  Moderate: 'bg-yellow-100 text-yellow-700',
  Open: 'bg-gray-100 text-gray-700',
  Unknown: 'bg-gray-100 text-gray-500',
};

export default function SelectivityBadge({ tier }: { tier: string }) {
  const cls = TIER_COLORS[tier] ?? TIER_COLORS['Unknown'];
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>
      {tier}
    </span>
  );
}
