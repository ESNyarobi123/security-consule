import { Injectable, Logger } from '@nestjs/common';
import {
  AlertnessStatus,
  ApplicationStatus,
  ContractStatus,
  DeploymentStatus,
  EmployeeStatus,
  GuardStatus,
  IncidentStatus,
  InvoiceStatus,
  KpiPeriodGranularity,
  KpiSnapshotStatus,
  PayrollCycleStatus,
  Prisma,
  VerificationResult,
} from '@prisma/client';
import { createHash } from 'crypto';
import { PrismaService, AuthUser } from '@pssms/shared';
import { AuditService } from '@pssms/audit';
import { KpiItemDto } from '../presentation/dto/reporting.dto';

export interface KpiCatalogEntry {
  code: string;
  name: string;
  category: string;
  unit: string;
  description?: string;
}

export const KPI_CATALOG: KpiCatalogEntry[] = [
  { code: 'GUARD_HEADCOUNT_ACTIVE', name: 'Active guards', category: 'OPS', unit: 'COUNT' },
  { code: 'GUARD_ON_DUTY', name: 'Guards on duty', category: 'OPS', unit: 'COUNT' },
  { code: 'ATTENDANCE_CLOCK_INS', name: 'Clock-ins', category: 'OPS', unit: 'COUNT' },
  { code: 'ATTENDANCE_APPROVAL_RATE', name: 'Attendance approval rate', category: 'OPS', unit: 'PERCENT' },
  { code: 'ALERTNESS_CONFIRM_RATE', name: 'Alertness confirm rate', category: 'OPS', unit: 'PERCENT' },
  { code: 'FIELD_ALERTS_OPEN', name: 'Open field alerts', category: 'OPS', unit: 'COUNT' },
  { code: 'DEPLOYMENTS_ACTIVE', name: 'Active deployments', category: 'OPS', unit: 'COUNT' },
  { code: 'OPEN_INCIDENTS', name: 'Open incidents', category: 'SAFETY', unit: 'COUNT' },
  { code: 'INCIDENTS_BY_SEVERITY', name: 'Incidents by severity', category: 'SAFETY', unit: 'JSON' },
  { code: 'INCIDENTS_RESOLVED', name: 'Resolved incidents', category: 'SAFETY', unit: 'COUNT' },
  { code: 'VISITOR_APPOINTMENTS', name: 'Visitor appointments', category: 'ACCESS', unit: 'COUNT' },
  { code: 'VISITOR_ENTRIES_ALLOWED', name: 'Visitor entries allowed', category: 'ACCESS', unit: 'COUNT' },
  { code: 'PARKING_ENTRIES', name: 'Parking entries', category: 'ACCESS', unit: 'COUNT' },
  { code: 'PARKING_VIOLATIONS', name: 'Parking violations', category: 'ACCESS', unit: 'COUNT' },
  { code: 'CONTRACTS_ACTIVE', name: 'Active contracts', category: 'COMMERCIAL', unit: 'COUNT' },
  { code: 'CONTRACTS_MRR', name: 'Contract MRR', category: 'COMMERCIAL', unit: 'TZS' },
  { code: 'CUSTOMERS_ACTIVE', name: 'Active customers', category: 'COMMERCIAL', unit: 'COUNT' },
  { code: 'INVOICE_OUTSTANDING', name: 'Invoice outstanding', category: 'FINANCE', unit: 'TZS' },
  { code: 'INVOICE_COLLECTED', name: 'Payments collected', category: 'FINANCE', unit: 'TZS' },
  { code: 'PAYROLL_NET_TOTAL', name: 'Payroll net total', category: 'PAYROLL', unit: 'TZS' },
  { code: 'PAYROLL_GROSS_TOTAL', name: 'Payroll gross total', category: 'PAYROLL', unit: 'TZS' },
  { code: 'PAYROLL_CYCLES_PAID', name: 'Paid payroll cycles', category: 'PAYROLL', unit: 'COUNT' },
  { code: 'EMPLOYEES_ACTIVE', name: 'Active employees', category: 'HR', unit: 'COUNT' },
  { code: 'RECRUITMENT_PIPELINE', name: 'Recruitment pipeline', category: 'HR', unit: 'COUNT' },
];

@Injectable()
export class KpiService {
  private readonly logger = new Logger(KpiService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async computeAll(
    organizationId: string,
    from: Date,
    to: Date,
    codes?: string[],
    filters?: { siteId?: string; branchId?: string },
  ): Promise<KpiItemDto[]> {
    const catalog = codes?.length
      ? KPI_CATALOG.filter((k) => codes.includes(k.code))
      : KPI_CATALOG;

    const results: KpiItemDto[] = [];
    for (const def of catalog) {
      try {
        const computed = await this.computeOne(
          def.code,
          organizationId,
          from,
          to,
          filters,
        );
        results.push({
          code: def.code,
          name: def.name,
          category: def.category,
          unit: def.unit,
          value: computed.value,
          priorValue: null,
          deltaPct: null,
          asOf: new Date(),
          source: def.category === 'PAYROLL' ? 'snapshot' : 'live',
          breakdown: computed.breakdown,
        });
      } catch (err) {
        this.logger.warn(`KPI ${def.code} failed: ${String(err)}`);
        results.push({
          code: def.code,
          name: def.name,
          category: def.category,
          unit: def.unit,
          value: 0,
          asOf: new Date(),
          source: 'live',
        });
      }
    }
    return results;
  }

  async refresh(
    dto: {
      from: Date;
      to: Date;
      codes?: string[];
      granularity?: KpiPeriodGranularity;
    },
    user: AuthUser,
    options?: { scheduled?: boolean },
  ) {
    const granularity = dto.granularity ?? KpiPeriodGranularity.DAY;
    const kpis = await this.computeAll(
      user.organizationId,
      dto.from,
      dto.to,
      dto.codes,
    );

    const upserted = await this.prisma.withOrgContext(
      user.organizationId,
      async (tx) => {
        const rows = [];
        for (const kpi of kpis) {
          const sourceHash = createHash('sha256')
            .update(
              `${user.organizationId}:${kpi.code}:${kpi.value}:${dto.from.toISOString()}`,
            )
            .digest('hex')
            .slice(0, 16);

          const row = await tx.kpiSnapshot.upsert({
            where: {
              organizationId_kpiCode_granularity_periodStart_periodEnd_scopeKey:
                {
                  organizationId: user.organizationId,
                  kpiCode: kpi.code,
                  granularity,
                  periodStart: dto.from,
                  periodEnd: dto.to,
                  scopeKey: 'all',
                },
            },
            update: {
              valueNumeric: new Prisma.Decimal(kpi.value),
              valueJson: (kpi.breakdown ?? {}) as Prisma.InputJsonValue,
              status: KpiSnapshotStatus.READY,
              sourceHash,
              computedAt: new Date(),
              computedBy: user.id,
            },
            create: {
              organizationId: user.organizationId,
              kpiCode: kpi.code,
              granularity,
              periodStart: dto.from,
              periodEnd: dto.to,
              scopeKey: 'all',
              valueNumeric: new Prisma.Decimal(kpi.value),
              valueJson: (kpi.breakdown ?? {}) as Prisma.InputJsonValue,
              status: KpiSnapshotStatus.READY,
              sourceHash,
              computedBy: user.id,
            },
          });
          rows.push(row);
        }

        await tx.dashboardCache.deleteMany({
          where: {
            organizationId: user.organizationId,
            dashboardCode: 'EXECUTIVE_HOME',
          },
        });

        return rows;
      },
    );

    await this.audit.record({
      organizationId: user.organizationId,
      actorId: user.id,
      action: options?.scheduled
        ? 'reporting.kpi.refresh.scheduled'
        : 'reporting.kpi.refresh',
      resourceType: 'KpiSnapshot',
      resourceId: user.organizationId,
      after: {
        count: upserted.length,
        codes: kpis.map((k) => k.code),
        scheduled: Boolean(options?.scheduled),
      },
    });

    return {
      refreshed: upserted.length,
      snapshots: upserted.map((s) => ({
        id: s.id,
        kpiCode: s.kpiCode,
        valueNumeric: Number(s.valueNumeric),
        status: s.status,
        computedAt: s.computedAt,
      })),
    };
  }

  async listSnapshots(
    organizationId: string,
    kpiCode?: string,
  ) {
    return this.prisma.withOrgContext(organizationId, (tx) =>
      tx.kpiSnapshot.findMany({
        where: {
          organizationId,
          ...(kpiCode ? { kpiCode } : {}),
        },
        orderBy: { computedAt: 'desc' },
        take: 100,
      }),
    );
  }

  private async computeOne(
    code: string,
    organizationId: string,
    from: Date,
    to: Date,
    filters?: { siteId?: string; branchId?: string },
  ): Promise<{ value: number; breakdown?: Record<string, unknown> }> {
    const siteFilter = filters?.siteId ? { siteId: filters.siteId } : {};
    const toEnd = new Date(to);
    toEnd.setHours(23, 59, 59, 999);

    switch (code) {
      case 'GUARD_HEADCOUNT_ACTIVE':
        return {
          value: await this.prisma.guardProfile.count({
            where: { organizationId, status: GuardStatus.ACTIVE },
          }),
        };

      case 'GUARD_ON_DUTY':
        return {
          value: await this.prisma.guardAttendance.count({
            where: {
              organizationId,
              clockOutAt: null,
              ...siteFilter,
            },
          }),
        };

      case 'ATTENDANCE_CLOCK_INS':
        return {
          value: await this.prisma.guardAttendance.count({
            where: {
              organizationId,
              clockInAt: { gte: from, lte: toEnd },
              ...siteFilter,
            },
          }),
        };

      case 'ATTENDANCE_APPROVAL_RATE': {
        const total = await this.prisma.guardAttendance.count({
          where: {
            organizationId,
            clockInAt: { gte: from, lte: toEnd },
            ...siteFilter,
          },
        });
        const approved = await this.prisma.guardAttendance.count({
          where: {
            organizationId,
            clockInAt: { gte: from, lte: toEnd },
            supervisorApproved: true,
            ...siteFilter,
          },
        });
        return {
          value: total === 0 ? 0 : Math.round((approved / total) * 10000) / 100,
          breakdown: { total, approved },
        };
      }

      case 'ALERTNESS_CONFIRM_RATE': {
        const total = await this.prisma.alertnessCheck.count({
          where: {
            organizationId,
            scheduledAt: { gte: from, lte: toEnd },
            ...siteFilter,
          },
        });
        const confirmed = await this.prisma.alertnessCheck.count({
          where: {
            organizationId,
            scheduledAt: { gte: from, lte: toEnd },
            status: AlertnessStatus.CONFIRMED,
            ...siteFilter,
          },
        });
        return {
          value: total === 0 ? 0 : Math.round((confirmed / total) * 10000) / 100,
          breakdown: { total, confirmed },
        };
      }

      case 'FIELD_ALERTS_OPEN':
        return {
          value: await this.prisma.fieldAlert.count({
            where: {
              organizationId,
              acknowledged: false,
              ...siteFilter,
            },
          }),
        };

      case 'DEPLOYMENTS_ACTIVE':
        return {
          value: await this.prisma.guardDeployment.count({
            where: {
              organizationId,
              status: DeploymentStatus.ACTIVE,
              ...siteFilter,
            },
          }),
        };

      case 'OPEN_INCIDENTS':
        return {
          value: await this.prisma.incident.count({
            where: {
              organizationId,
              status: {
                in: [IncidentStatus.OPEN, IncidentStatus.INVESTIGATING],
              },
              ...siteFilter,
            },
          }),
        };

      case 'INCIDENTS_BY_SEVERITY': {
        const grouped = await this.prisma.incident.groupBy({
          by: ['severity'],
          where: {
            organizationId,
            createdAt: { gte: from, lte: toEnd },
            ...siteFilter,
          },
          _count: { _all: true },
        });
        const breakdown: Record<string, number> = {};
        let total = 0;
        for (const g of grouped) {
          breakdown[g.severity] = g._count._all;
          total += g._count._all;
        }
        return { value: total, breakdown };
      }

      case 'INCIDENTS_RESOLVED':
        return {
          value: await this.prisma.incident.count({
            where: {
              organizationId,
              status: IncidentStatus.RESOLVED,
              resolvedAt: { gte: from, lte: toEnd },
              ...siteFilter,
            },
          }),
        };

      case 'VISITOR_APPOINTMENTS':
        return {
          value: await this.prisma.visitorAppointment.count({
            where: {
              organizationId,
              createdAt: { gte: from, lte: toEnd },
              ...siteFilter,
            },
          }),
        };

      case 'VISITOR_ENTRIES_ALLOWED':
        return {
          value: await this.prisma.visitorEntry.count({
            where: {
              organizationId,
              result: VerificationResult.ALLOWED,
              recordedAt: { gte: from, lte: toEnd },
              ...siteFilter,
            },
          }),
        };

      case 'PARKING_ENTRIES':
        return {
          value: await this.prisma.parkingEntry.count({
            where: {
              organizationId,
              recordedAt: { gte: from, lte: toEnd },
              ...siteFilter,
            },
          }),
        };

      case 'PARKING_VIOLATIONS':
        return {
          value: await this.prisma.parkingViolation.count({
            where: {
              organizationId,
              createdAt: { gte: from, lte: toEnd },
              ...siteFilter,
            },
          }),
        };

      case 'CONTRACTS_ACTIVE':
        return {
          value: await this.prisma.contract.count({
            where: { organizationId, status: ContractStatus.ACTIVE },
          }),
        };

      case 'CONTRACTS_MRR': {
        const agg = await this.prisma.contract.aggregate({
          where: { organizationId, status: ContractStatus.ACTIVE },
          _sum: { monthlyFee: true },
        });
        return { value: Number(agg._sum.monthlyFee ?? 0) };
      }

      case 'CUSTOMERS_ACTIVE':
        return {
          value: await this.prisma.customer.count({
            where: { organizationId, isActive: true },
          }),
        };

      case 'INVOICE_OUTSTANDING': {
        const invoices = await this.prisma.invoice.findMany({
          where: {
            organizationId,
            status: {
              in: [
                InvoiceStatus.SENT,
                InvoiceStatus.PARTIALLY_PAID,
                InvoiceStatus.OVERDUE,
              ],
            },
          },
          select: { totalAmount: true, amountPaid: true },
        });
        const outstanding = invoices.reduce(
          (sum, i) => sum + Number(i.totalAmount) - Number(i.amountPaid),
          0,
        );
        return { value: outstanding };
      }

      case 'INVOICE_COLLECTED': {
        const agg = await this.prisma.invoicePayment.aggregate({
          where: {
            organizationId,
            recordedAt: { gte: from, lte: toEnd },
          },
          _sum: { amount: true },
        });
        return { value: Number(agg._sum.amount ?? 0) };
      }

      case 'PAYROLL_NET_TOTAL':
      case 'PAYROLL_GROSS_TOTAL': {
        // Immutable PayslipSnapshot only — never live attendance
        const cycles = await this.prisma.payrollCycle.findMany({
          where: {
            organizationId,
            status: {
              in: [PayrollCycleStatus.APPROVED, PayrollCycleStatus.PAID],
            },
            OR: [
              { periodStart: { lte: toEnd }, periodEnd: { gte: from } },
            ],
          },
          select: { id: true },
        });
        const cycleIds = cycles.map((c) => c.id);
        if (cycleIds.length === 0) return { value: 0 };

        const field = code === 'PAYROLL_NET_TOTAL' ? 'netPay' : 'grossPay';
        const agg = await this.prisma.payslipSnapshot.aggregate({
          where: {
            organizationId,
            cycleId: { in: cycleIds },
            supersededById: null,
          },
          _sum: { [field]: true },
        });
        return {
          value: Number(
            (agg._sum as { netPay?: Prisma.Decimal; grossPay?: Prisma.Decimal })[
              field
            ] ?? 0,
          ),
          breakdown: { cycleCount: cycleIds.length, source: 'PayslipSnapshot' },
        };
      }

      case 'PAYROLL_CYCLES_PAID':
        return {
          value: await this.prisma.payrollCycle.count({
            where: {
              organizationId,
              status: PayrollCycleStatus.PAID,
              periodStart: { lte: toEnd },
              periodEnd: { gte: from },
            },
          }),
        };

      case 'EMPLOYEES_ACTIVE':
        return {
          value: await this.prisma.employee.count({
            where: { organizationId, status: EmployeeStatus.ACTIVE },
          }),
        };

      case 'RECRUITMENT_PIPELINE':
        return {
          value: await this.prisma.jobApplication.count({
            where: {
              organizationId,
              status: {
                notIn: [
                  ApplicationStatus.HIRED,
                  ApplicationStatus.REJECTED,
                  ApplicationStatus.WITHDRAWN,
                ],
              },
            },
          }),
        };

      default:
        return { value: 0 };
    }
  }
}
