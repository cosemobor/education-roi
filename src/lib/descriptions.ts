import type { MajorSummary, School } from '@/types';
import { formatCurrency, formatRate, formatNumber, formatPercent } from './formatters';

export function generateMajorDescription(major: MajorSummary): string {
  const parts: string[] = [];

  parts.push(
    `${major.cipTitle.replace(/\.+$/, '')} is offered at ${formatNumber(major.schoolCount)} school${major.schoolCount === 1 ? '' : 's'}.`,
  );

  if (major.medianEarn1yr != null) {
    let earnings = `Graduates report median first-year earnings of ${formatCurrency(major.medianEarn1yr)}`;
    if (major.medianEarn5yr != null) {
      earnings += `, growing to ${formatCurrency(major.medianEarn5yr)} by year five`;
      if (major.growthRate != null) {
        earnings += ` (${formatPercent(major.growthRate)})`;
      }
    }
    parts.push(earnings + '.');
  }

  if (major.p25Earn1yr != null && major.p75Earn1yr != null) {
    parts.push(
      `The 25th percentile earns ${formatCurrency(major.p25Earn1yr)} while the 75th percentile earns ${formatCurrency(major.p75Earn1yr)}.`,
    );
  }

  parts.push(
    'Earnings data is sourced from the U.S. Department of Education College Scorecard, reflecting median earnings of graduates one and five years after completion.',
  );

  return parts.join(' ');
}

export function generateSchoolDescription(
  school: School,
  programCount: number,
): string {
  const parts: string[] = [];

  const type = school.ownershipLabel
    ? school.ownershipLabel.toLowerCase()
    : 'unknown type';
  parts.push(
    `${school.name} is a ${type} institution in ${school.city}, ${school.state}.`,
  );

  const details: string[] = [];
  if (school.admissionRate != null) {
    details.push(`a ${formatRate(school.admissionRate)} admission rate`);
  }
  if (school.satMath75 != null && school.satRead75 != null) {
    const combined = school.satMath75 + school.satRead75;
    details.push(`${formatNumber(combined)} combined SAT (75th percentile)`);
  }
  if (details.length > 0) {
    parts.push(`With ${details.join(' and ')}.`);
  }

  const stats: string[] = [];
  if (school.size != null) {
    stats.push(`enrolls ${formatNumber(school.size)} students`);
  }
  if (programCount > 0) {
    stats.push(
      `offers ${formatNumber(programCount)} program${programCount === 1 ? '' : 's'} with earnings data`,
    );
  }
  if (school.completionRate != null) {
    stats.push(`has a ${formatRate(school.completionRate)} completion rate`);
  }
  if (stats.length > 0) {
    const sentence = stats[0].charAt(0).toUpperCase() + stats[0].slice(1);
    if (stats.length === 1) {
      parts.push(`${sentence}.`);
    } else {
      parts.push(
        `${sentence}, ${stats.slice(1, -1).join(', ')}${stats.length > 2 ? ', and ' : ' and '}${stats[stats.length - 1]}.`,
      );
    }
  }

  parts.push(
    'Earnings are weighted by the number of graduates reporting in each program to reflect the typical student outcome. Payback period estimates how many years of earnings it takes to recoup total degree cost using net price after financial aid.',
  );

  return parts.join(' ');
}
