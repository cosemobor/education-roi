import { sqliteTable, text, integer, real, index } from 'drizzle-orm/sqlite-core';

export const schools = sqliteTable('schools', {
  unitId: integer('unit_id').primaryKey(),
  name: text('name').notNull(),
  city: text('city'),
  state: text('state'),
  ownership: integer('ownership'),
  ownershipLabel: text('ownership_label'),
  admissionRate: real('admission_rate'),
  satRead75: real('sat_read_75'),
  satMath75: real('sat_math_75'),
  size: integer('size'),
  costAttendance: real('cost_attendance'),
  tuitionInState: real('tuition_in_state'),
  tuitionOutState: real('tuition_out_state'),
  netPricePublic: real('net_price_public'),
  netPricePrivate: real('net_price_private'),
  completionRate: real('completion_rate'),
  selectivityTier: text('selectivity_tier'),
  lat: real('lat'),
  lon: real('lon'),
}, (table) => [
  index('idx_schools_name').on(table.name),
  index('idx_schools_state').on(table.state),
]);

export const programs = sqliteTable('programs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  unitId: integer('unit_id').notNull().references(() => schools.unitId),
  schoolName: text('school_name'),
  state: text('state'),
  cipCode: text('cip_code').notNull(),
  cipTitle: text('cip_title'),
  credLevel: integer('cred_level'),
  credTitle: text('cred_title'),
  earn1yr: real('earn_1yr'),
  earn4yr: real('earn_4yr'),
  earn5yr: real('earn_5yr'),
  earn1yrCount: integer('earn_1yr_count'),
  earn5yrCount: integer('earn_5yr_count'),
  costAttendance: real('cost_attendance'),
  selectivityTier: text('selectivity_tier'),
}, (table) => [
  index('idx_programs_cip').on(table.cipCode),
  index('idx_programs_unit').on(table.unitId),
]);

export const majorsSummary = sqliteTable('majors_summary', {
  cipCode: text('cip_code').primaryKey(),
  cipTitle: text('cip_title').notNull(),
  schoolCount: integer('school_count'),
  medianEarn1yr: real('median_earn_1yr'),
  medianEarn4yr: real('median_earn_4yr'),
  medianEarn5yr: real('median_earn_5yr'),
  p25Earn1yr: real('p25_earn_1yr'),
  p75Earn1yr: real('p75_earn_1yr'),
  p25Earn5yr: real('p25_earn_5yr'),
  p75Earn5yr: real('p75_earn_5yr'),
  growthRate: real('growth_rate'),
});
