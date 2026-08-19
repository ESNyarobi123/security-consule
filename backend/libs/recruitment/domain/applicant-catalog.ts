/** Portal 35.13 — posting audience (not IAM roles). */
export const APPLICANT_TRACKS = ['GUARD', 'OFFICE', 'GENERAL'] as const;
export type ApplicantTrack = (typeof APPLICANT_TRACKS)[number];

export const APPLICANT_TRACK_OPTIONS = [
  {
    value: 'GUARD',
    label: 'Guard applicant',
    hint: 'Security guard and field operations roles',
  },
  {
    value: 'OFFICE',
    label: 'Office staff applicant',
    hint: 'HQ / branch office, HR, finance, ICT, and similar',
  },
  {
    value: 'GENERAL',
    label: 'General job applicant',
    hint: 'Open roles not tagged guard or office',
  },
] as const;

export function isApplicantTrack(value: string): value is ApplicantTrack {
  return (APPLICANT_TRACKS as readonly string[]).includes(value);
}

export function normalizeApplicantTrack(value?: string | null): ApplicantTrack {
  if (value && isApplicantTrack(value)) return value;
  return 'GENERAL';
}

export type OnboardingStepDef = { code: string; label: string };

const BASE_STEPS: OnboardingStepDef[] = [
  { code: 'CONTRACT', label: 'Employment contract / terms' },
  { code: 'MEDICAL', label: 'Medical fitness' },
  { code: 'POLICE_CLEARANCE', label: 'Police / background clearance' },
  { code: 'ESS_ACCESS', label: 'ESS access / staff file' },
  { code: 'INDUCTION', label: 'Company induction' },
];

export function onboardingStepDefs(track: ApplicantTrack): OnboardingStepDef[] {
  if (track === 'GUARD') {
    return [
      ...BASE_STEPS.slice(0, 3),
      { code: 'UNIFORM_KIT', label: 'Uniform / equipment issued' },
      { code: 'TRAINING', label: 'Guard induction training' },
      ...BASE_STEPS.slice(3),
    ];
  }
  if (track === 'OFFICE') {
    return [
      ...BASE_STEPS.slice(0, 3),
      { code: 'WORKSTATION', label: 'Workstation / office access' },
      ...BASE_STEPS.slice(3),
    ];
  }
  return BASE_STEPS;
}

export type OnboardingStepState = OnboardingStepDef & {
  done: boolean;
  completedAt?: string | null;
};

export function initialOnboarding(track: ApplicantTrack): OnboardingStepState[] {
  return onboardingStepDefs(track).map((s) => ({
    ...s,
    done: false,
    completedAt: null,
  }));
}

export function parseOnboardingProgress(
  raw: unknown,
  track: ApplicantTrack,
): OnboardingStepState[] {
  const fallback = initialOnboarding(track);
  if (!Array.isArray(raw) || raw.length === 0) return fallback;
  const byCode = new Map<string, OnboardingStepState>();
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const rec = item as Record<string, unknown>;
    const code = typeof rec.code === 'string' ? rec.code : '';
    if (!code) continue;
    byCode.set(code, {
      code,
      label: typeof rec.label === 'string' ? rec.label : code,
      done: rec.done === true,
      completedAt:
        typeof rec.completedAt === 'string' ? rec.completedAt : null,
    });
  }
  return fallback.map((step) => byCode.get(step.code) ?? step);
}
