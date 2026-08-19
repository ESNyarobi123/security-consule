/** Portal 35.14 / §15 — required request criteria (not IAM). */
export const GUARD_SUPPLY_URGENCIES = [
  'STANDARD',
  'HIGH',
  'CRITICAL',
] as const;

export type GuardSupplyUrgencyCode = (typeof GUARD_SUPPLY_URGENCIES)[number];

export const GUARD_SUPPLY_URGENCY_OPTIONS = [
  {
    value: 'STANDARD',
    label: 'Standard',
    hint: 'Normal recruitment timeline',
  },
  {
    value: 'HIGH',
    label: 'High',
    hint: 'Needed sooner than usual',
  },
  {
    value: 'CRITICAL',
    label: 'Critical',
    hint: 'Immediate cover required',
  },
] as const;

/** Design §35.14 — partner must specify these on each request. */
export const GUARD_SUPPLY_REQUIRED_FIELDS = [
  'guardCount',
  'siteLocation',
  'qualifications',
  'trainingNeeds',
  'urgency',
  'serviceTerms',
] as const;
