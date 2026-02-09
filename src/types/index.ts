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
  growthRate: number | null;
}

export interface ProgramRecord {
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
  earn1yrCount: number | null;
  costAttendance: number | null;
  selectivityTier: string;
  ownership: number | null;
  ownershipLabel: string | null;
  admissionRate: number | null;
  satMath75: number | null;
  satRead75: number | null;
  size: number | null;
  completionRate: number | null;
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

export interface SchoolRanking {
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
  completionRate: number | null;
  selectivityTier: string;
  programCount: number;
  medianEarn1yr: number | null;
  maxEarn1yr: number | null;
  topProgram: string | null;
}

export type ViewTab = 'explorer' | 'majors' | 'colleges';

export type SortDir = 'asc' | 'desc';
