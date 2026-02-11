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

export const IVY_PLUS = new Set([
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
  'Washington University in St Louis',
]);

export const NESCAC = new Set([
  'Williams College',
  'Amherst College',
  'Middlebury College',
  'Bowdoin College',
  'Wesleyan University',
  'Tufts University',
  'Bates College',
  'Colby College',
  'Hamilton College',
  'Connecticut College',
  'Trinity College',
]);

export const PUBLIC_FLAGSHIP = new Set([
  'University of Michigan-Ann Arbor',
  'University of California-Berkeley',
  'University of California-Los Angeles',
  'University of Virginia-Main Campus',
  'University of North Carolina at Chapel Hill',
  'Georgia Institute of Technology-Main Campus',
  'The University of Texas at Austin',
  'Ohio State University-Main Campus',
  'Pennsylvania State University-Main Campus',
  'University of Florida',
  'University of Wisconsin-Madison',
  'University of Washington-Seattle Campus',
  'Purdue University-Main Campus',
  'University of Maryland-College Park',
  'University of Minnesota-Twin Cities',
  'University of Illinois Urbana-Champaign',
  'Indiana University-Bloomington',
  'Rutgers University-New Brunswick',
  'University of Georgia',
  'University of Colorado Boulder',
  'University of Iowa',
  'University of Oregon',
  'University of Arizona',
  'University of Connecticut',
  'University of Massachusetts-Amherst',
  'The University of Alabama',
  'University of Kentucky',
  'University of Kansas',
  'Louisiana State University and Agricultural & Mechanical College',
  'University of South Carolina-Columbia',
  'The University of Tennessee-Knoxville',
  'University of Oklahoma-Norman Campus',
  'University of Utah',
  'University of Nebraska-Lincoln',
  'Texas A&M University-College Station',
  'North Carolina State University at Raleigh',
  'Virginia Polytechnic Institute and State University',
  'Michigan State University',
  'Clemson University',
  'University of Pittsburgh-Pittsburgh Campus',
]);

const ELITE_EXCLUSIONS = new Map<string, string>([
  ['Northeastern University', 'Selective'],
  ['Minerva University', 'General'],
  ['Stanbridge University', 'General'],
]);

export function getDisplayTier(
  schoolName: string,
  dbTier: string,
  admissionRate?: number | null,
  size?: number | null,
): string {
  if (IVY_LEAGUE.has(schoolName)) return 'Ivy League';
  if (IVY_PLUS.has(schoolName)) return 'Ivy Plus';
  if (NESCAC.has(schoolName)) return 'NESCAC';
  if (PUBLIC_FLAGSHIP.has(schoolName)) return 'Public Flagship';

  const exclusion = ELITE_EXCLUSIONS.get(schoolName);
  if (exclusion) return exclusion;

  if (admissionRate != null && admissionRate < 0.15 && size != null && size >= 400)
    return 'Elite';
  if (admissionRate != null && admissionRate < 0.30) return 'Selective';
  return 'General';
}

export const TIER_COLORS: Record<string, string> = {
  'Ivy League': '#16a34a',
  'Ivy Plus': '#2563eb',
  NESCAC: '#7c3aed',
  'Public Flagship': '#ea580c',
  Elite: '#0891b2',
  Selective: '#db2777',
  General: '#475569',
};

export const TIER_ORDER = [
  'Ivy League',
  'Ivy Plus',
  'NESCAC',
  'Public Flagship',
  'Elite',
  'Selective',
  'General',
];
