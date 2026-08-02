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
