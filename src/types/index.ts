export interface MajorSummary {
  cipCode: string;
  cipTitle: string;
  schoolCount: number;
  medianEarn1yr: number | null;
  medianEarn4yr: number | null;
  medianEarn5yr: number | null;
  p25Earn1yr: number | null;
  p75Earn1yr: number | null;
  p25Earn5yr: number | null;
  p75Earn5yr: number | null;
  medianEarn7yr: number | null;
  p25Earn7yr: number | null;
  p75Earn7yr: number | null;
  nationalMedianEarn7yr: number | null;
  growthRate: number | null;
  growthRate1to7: number | null;
}

/**
 * Degree ROI (src/lib/roi.ts), real 2024 dollars. "7" = the 7 measured
 * years after graduation; "career" = through age 45, years 8–23 estimated
 * from Census earnings-by-age curves. NPV/ROI are discounted at the S&P 500
 * real return; *Undiscounted = inflation-adjusted only.
 */
export interface RoiFields {
  npv7: number | null;
  roi7: number | null;
  npv7Undiscounted: number | null;
  roi7Undiscounted: number | null;
  paybackYear: number | null;
  expectedNpv7: number | null;
  expectedRoi7: number | null;
  careerNpv: number | null;
  careerRoi: number | null;
  careerNpvUndiscounted: number | null;
  careerPaybackYear: number | null;
  careerExpectedRoi: number | null;
}

export interface ProgramRecord extends RoiFields {
  unitId: number;
  schoolName: string;
  state: string;
  cipCode: string;
  cipTitle: string;
  credLevel: number;
  credTitle: string;
  earn1yr: number | null;
  earn4yr: number | null;
  earn5yr: number | null;
  earn7yr: number | null;
  earn1yrCount: number | null;
  earn5yrCount: number | null;
  earn7yrCount: number | null;
  costAttendance: number | null;
  selectivityTier: string;
  ownership: number | null;
  ownershipLabel: string | null;
  admissionRate: number | null;
  satMath75: number | null;
  satRead75: number | null;
  size: number | null;
  completionRate: number | null;
  /** Which Census age curve extended the career view: the major's own, or all bachelor's. */
  careerCurve: 'major' | 'all' | null;
}

export interface School {
  unitId: number;
  name: string;
  city: string;
  state: string;
  ownership: number;
  ownershipLabel: string;
  admissionRate: number | null;
  satRead75: number | null;
  satMath75: number | null;
  size: number | null;
  costAttendance: number | null;
  tuitionInState: number | null;
  tuitionOutState: number | null;
  netPricePublic: number | null;
  netPricePrivate: number | null;
  completionRate: number | null;
  selectivityTier: string;
  lat: number | null;
  lon: number | null;
}

export interface SchoolRanking extends RoiFields {
  unitId: number;
  name: string;
  city: string;
  state: string;
  ownership: number;
  ownershipLabel: string;
  admissionRate: number | null;
  satCombined: number | null;
  size: number | null;
  costAttendance: number | null;
  netPrice: number | null;
  completionRate: number | null;
  selectivityTier: string;
  programCount: number;
  medianEarn1yr: number | null;
  weightedEarn1yr: number | null;
  weightedEarn5yr: number | null;
  weightedEarn7yr: number | null;
  /** Median earnings of HS graduates 25–34 in the school's state (ROI benchmark). */
  hsEarnings: number | null;
  maxEarn1yr: number | null;
  topProgram: string | null;
}

export type ViewTab = 'majors' | 'colleges';

export type SortDir = 'asc' | 'desc';

