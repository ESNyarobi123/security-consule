/** AL1 miss escalation ladder — final stage is CONTROL. */
export const FIELD_ALERT_ESCALATION_STAGES = [
  'SUPERVISOR',
  'FIELD',
  'BOM',
  'CONTROL',
] as const;

export type FieldAlertEscalationStage =
  (typeof FIELD_ALERT_ESCALATION_STAGES)[number];

export const FIELD_ALERT_ESCALATION_INITIAL: FieldAlertEscalationStage =
  'SUPERVISOR';

export function nextFieldAlertEscalationStage(
  current: string,
): FieldAlertEscalationStage | null {
  const idx = FIELD_ALERT_ESCALATION_STAGES.indexOf(
    current as FieldAlertEscalationStage,
  );
  if (idx < 0 || idx >= FIELD_ALERT_ESCALATION_STAGES.length - 1) {
    return null;
  }
  return FIELD_ALERT_ESCALATION_STAGES[idx + 1];
}

/**
 * Who may advance AL1 from the current stage (§4 ops hierarchy).
 * Higher roles may escalate lower stages; CONTROL is terminal (no escalate).
 */
const FIELD_ALERT_STAGE_ESCALATE_ROLES: Record<
  Exclude<FieldAlertEscalationStage, 'CONTROL'>,
  ReadonlySet<string>
> = {
  SUPERVISOR: new Set([
    'SUPERVISOR',
    'FIELD_OFFICER',
    'BRANCH_MANAGER',
    'OPERATIONS_MANAGER',
    'CONTROL_ROOM',
    'SUPER_ADMIN',
    'GENERAL_MANAGER',
    'CEO',
    'CMD',
    'DEVELOPER',
  ]),
  FIELD: new Set([
    'FIELD_OFFICER',
    'BRANCH_MANAGER',
    'OPERATIONS_MANAGER',
    'CONTROL_ROOM',
    'SUPER_ADMIN',
    'GENERAL_MANAGER',
    'CEO',
    'CMD',
    'DEVELOPER',
  ]),
  BOM: new Set([
    'BRANCH_MANAGER',
    'OPERATIONS_MANAGER',
    'CONTROL_ROOM',
    'SUPER_ADMIN',
    'GENERAL_MANAGER',
    'CEO',
    'CMD',
    'DEVELOPER',
  ]),
};

export function canEscalateFieldAlertStage(
  currentStage: string,
  roles: string[],
): boolean {
  if (currentStage === 'CONTROL') return false;
  const allowed =
    FIELD_ALERT_STAGE_ESCALATE_ROLES[
      currentStage as Exclude<FieldAlertEscalationStage, 'CONTROL'>
    ];
  if (!allowed) return false;
  return roles.some((r) => allowed.has(r));
}
