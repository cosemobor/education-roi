const CIP_PREFIX_MAP: Record<string, string> = {
  '11': 'STEM',
  '27': 'STEM',
  '40': 'STEM',
  '41': 'STEM',
  '26': 'STEM',
  '14': 'Engineering',
  '15': 'Engineering',
  '51': 'Health',
  '34': 'Health',
  '52': 'Business',
  '05': 'Liberal Arts',
  '16': 'Liberal Arts',
  '23': 'Liberal Arts',
  '24': 'Liberal Arts',
  '25': 'Liberal Arts',
  '38': 'Liberal Arts',
  '39': 'Liberal Arts',
  '50': 'Liberal Arts',
  '54': 'Liberal Arts',
};

export function getCipCategory(cipCode: string): string {
  const prefix = cipCode.slice(0, 2);
  return CIP_PREFIX_MAP[prefix] ?? 'Other';
}

export const CIP_CATEGORY_COLORS: Record<string, string> = {
  STEM: '#2563eb',
  Engineering: '#7c3aed',
  Health: '#059669',
  Business: '#d97706',
  'Liberal Arts': '#e11d48',
  Other: '#6b7280',
};

export const CIP_CATEGORY_ORDER = [
  'STEM',
  'Engineering',
  'Health',
  'Business',
  'Liberal Arts',
  'Other',
];
