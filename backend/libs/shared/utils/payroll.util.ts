export interface PayrollRules {
  nssfEmployeeRate: number;
  payeRate: number;
  currency: string;
  /** Standard hours covered by basic salary (default 176 = 22×8). */
  standardHoursPerMonth?: number;
  /** Overtime multiplier on hourly rate (default 1.5). */
  otMultiplier?: number;
  /** TZS bonus per confirmed alertness check. */
  alertnessConfirmBonus?: number;
  /** TZS penalty per missed alertness check. */
  alertnessMissPenalty?: number;
  /** TZS penalty per late alertness check. */
  alertnessLatePenalty?: number;
  /** Divisor for daily rate when deducting unpaid leave (default 22). */
  dailyRateDivisor?: number;
  /** Default site allowance when deployed (TZS) if not on salary assignment. */
  defaultSiteAllowance?: number;
}

export interface PayslipLineItem {
  code: string;
  label: string;
  amount: number;
  type: 'EARNING' | 'DEDUCTION';
}

export interface PayslipCalculationInput {
  basicSalary: number;
  hoursWorked: number;
  hourlyRate?: number;
  allowances: PayslipLineItem[];
  loanDeductions: PayslipLineItem[];
  otherEarnings?: PayslipLineItem[];
  otherDeductions?: PayslipLineItem[];
  rules: PayrollRules;
}

export interface PayslipCalculationResult {
  lines: PayslipLineItem[];
  grossPay: number;
  totalDeductions: number;
  netPay: number;
  meta?: {
    regularHours: number;
    overtimeHours: number;
    standardHours: number;
  };
}

const DEFAULT_RULES: PayrollRules = {
  nssfEmployeeRate: 0.1,
  payeRate: 0.1,
  currency: 'TZS',
  standardHoursPerMonth: 176,
  otMultiplier: 1.5,
  alertnessConfirmBonus: 500,
  alertnessMissPenalty: 2000,
  alertnessLatePenalty: 500,
  dailyRateDivisor: 22,
  defaultSiteAllowance: 0,
};

export function resolvePayrollRules(rules?: PayrollRules): PayrollRules {
  return { ...DEFAULT_RULES, ...rules };
}

export function calculatePayslip(
  input: PayslipCalculationInput,
): PayslipCalculationResult {
  const rules = resolvePayrollRules(input.rules);
  const lines: PayslipLineItem[] = [];
  const standardHours = rules.standardHoursPerMonth ?? 176;
  const otMultiplier = rules.otMultiplier ?? 1.5;

  lines.push({
    code: 'BASIC',
    label: 'Basic Salary',
    amount: round2(input.basicSalary),
    type: 'EARNING',
  });

  let overtimeHours = 0;
  if (input.hourlyRate && input.hoursWorked > standardHours) {
    overtimeHours = round2(input.hoursWorked - standardHours);
    const overtimeAmount = round2(
      overtimeHours * input.hourlyRate * otMultiplier,
    );
    if (overtimeAmount > 0) {
      lines.push({
        code: 'OT',
        label: `Overtime (${overtimeHours}h × ${otMultiplier}×)`,
        amount: overtimeAmount,
        type: 'EARNING',
      });
    }
  }

  for (const a of input.allowances) {
    lines.push({ ...a, type: 'EARNING', amount: round2(a.amount) });
  }

  for (const e of input.otherEarnings ?? []) {
    lines.push({ ...e, type: 'EARNING', amount: round2(e.amount) });
  }

  const grossPay = round2(
    lines.filter((l) => l.type === 'EARNING').reduce((s, l) => s + l.amount, 0),
  );

  const nssf = round2(grossPay * rules.nssfEmployeeRate);
  lines.push({
    code: 'NSSF',
    label: 'NSSF (employee)',
    amount: nssf,
    type: 'DEDUCTION',
  });

  const taxableBase = round2(Math.max(0, grossPay - nssf));
  const paye = round2(taxableBase * rules.payeRate);
  lines.push({
    code: 'PAYE',
    label: 'PAYE',
    amount: paye,
    type: 'DEDUCTION',
  });

  for (const d of input.loanDeductions) {
    lines.push({ ...d, type: 'DEDUCTION', amount: round2(d.amount) });
  }

  for (const d of input.otherDeductions ?? []) {
    lines.push({ ...d, type: 'DEDUCTION', amount: round2(d.amount) });
  }

  const totalDeductions = round2(
    lines
      .filter((l) => l.type === 'DEDUCTION')
      .reduce((s, l) => s + l.amount, 0),
  );

  return {
    lines,
    grossPay,
    totalDeductions,
    netPay: round2(grossPay - totalDeductions),
    meta: {
      regularHours: round2(Math.min(input.hoursWorked, standardHours)),
      overtimeHours,
      standardHours,
    },
  };
}

export function attendanceHours(
  clockInAt: Date,
  clockOutAt: Date | null,
): number {
  if (!clockOutAt) return 0;
  const ms = clockOutAt.getTime() - clockInAt.getTime();
  return round2(Math.max(0, ms / (1000 * 60 * 60)));
}

export function unpaidLeaveDeduction(
  basicSalary: number,
  unpaidDays: number,
  rules: PayrollRules,
): number {
  if (unpaidDays <= 0) return 0;
  const divisor = rules.dailyRateDivisor ?? 22;
  const dailyRate = basicSalary / divisor;
  return round2(dailyRate * unpaidDays);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
