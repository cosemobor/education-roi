export const IVY_LEAGUE = new Set([
  'Harvard University',
  'Yale University',
  'Princeton University',
  'Columbia University in the City of New York',
  'University of Pennsylvania',
  'Brown University',
  'Dartmouth College',
  'Cornell University',
]);

export const IVY_ADJACENT = new Set([
  'Stanford University',
  'Massachusetts Institute of Technology',
  'Duke University',
  'University of Chicago',
  'California Institute of Technology',
  'Johns Hopkins University',
  'Northwestern University',
  'Georgetown University',
  'University of Notre Dame',
  'Vanderbilt University',
]);

export function getDisplayTier(schoolName: string, dbTier: string): string {
  if (IVY_LEAGUE.has(schoolName)) return 'Ivy League';
  if (IVY_ADJACENT.has(schoolName)) return 'Ivy Adjacent';
  if (dbTier === 'Most Selective') return 'Top 40';
  if (dbTier === 'Highly Selective' || dbTier === 'Selective') return 'Competitive';
  return 'Standard';
}

export const TIER_COLORS: Record<string, string> = {
  'Ivy League': '#7c3aed',
  'Ivy Adjacent': '#2563eb',
  'Top 40': '#0891b2',
  Competitive: '#16a34a',
  Standard: '#9ca3af',
};

export const TIER_ORDER = ['Ivy League', 'Ivy Adjacent', 'Top 40', 'Competitive', 'Standard'];
