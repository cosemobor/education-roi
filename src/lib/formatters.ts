export function formatCurrency(value: number | null): string {
  if (value == null) return '\u2014';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatPercent(value: number | null): string {
  if (value == null) return '\u2014';
  return `${value > 0 ? '+' : ''}${value}%`;
}

export function formatRate(value: number | null): string {
  if (value == null) return '\u2014';
  return `${(value * 100).toFixed(0)}%`;
}

export function formatNumber(value: number | null): string {
  if (value == null) return '\u2014';
  return value.toLocaleString();
}

export function formatPayback(value: number | null): string {
  if (value == null) return '\u2014';
  return value.toFixed(1) + ' yrs';
}

export function formatCompact(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return `$${value}`;
}

export function earningsColor(
  actual: number | null,
  median: number | null,
): string {
  if (actual == null || median == null) return 'text-earn-neutral';
  if (actual > median) return 'text-earn-above';
  if (actual < median) return 'text-earn-below';
  return 'text-earn-neutral';
}
