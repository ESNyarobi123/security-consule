export interface PayrollRules {
  nssfEmployeeRate: number;
  payeRate: number;
  currency: string;
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
  rules: PayrollRules;
}

export interface PayslipCalculationResult {
  lines: PayslipLineItem[];
  grossPay: number;
  totalDeductions: number;
  netPay: number;
}

const DEFAULT_RULES: PayrollRules = {
  nssfEmployeeRate: 0.1,
  payeRate: 0.1,
  currency: 'TZS',
};

export function calculatePayslip(
  input: PayslipCalculationInput,
): PayslipCalculationResult {
  const rules = input.rules ?? DEFAULT_RULES;
  const lines: PayslipLineItem[] = [];

  lines.push({
    code: 'BASIC',
    label: 'Basic Salary',
    amount: round2(input.basicSalary),
    type: 'EARNING',
  });

  if (input.hoursWorked > 0 && input.hourlyRate) {
    const overtimeAmount = round2(input.hoursWorked * input.hourlyRate);
    if (overtimeAmount > 0) {
      lines.push({
        code: 'HOURS',
        label: `Verified hours (${input.hoursWorked}h)`,
        amount: overtimeAmount,
        type: 'EARNING',
      });
    }
  }

  for (const a of input.allowances) {
    lines.push({ ...a, type: 'EARNING', amount: round2(a.amount) });
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

  const paye = round2(grossPay * rules.payeRate);
  lines.push({
    code: 'PAYE',
    label: 'PAYE',
    amount: paye,
    type: 'DEDUCTION',
  });

  for (const d of input.loanDeductions) {
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

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
