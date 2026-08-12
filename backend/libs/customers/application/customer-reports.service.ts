import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AccessEntryType,
  ComplaintStatus,
  DeploymentStatus,
  IncidentStatus,
  InvoiceStatus,
  ParkingDecision,
  ParkingEntryDirection,
  PayrollCycleStatus,
  PayrollTenantType,
  PermitStatus,
  Prisma,
} from '@prisma/client';
import { AuthUser, PrismaService, requireCustomerScope } from '@pssms/shared';
import { CustomerReportResponseDto } from '../presentation/dto/customer-report.dto';

const OPEN_COMPLAINT: ComplaintStatus[] = [
  ComplaintStatus.OPEN,
  ComplaintStatus.ACKNOWLEDGED,
  ComplaintStatus.UNDER_REVIEW,
];

const OPEN_INCIDENT: IncidentStatus[] = [
  IncidentStatus.OPEN,
  IncidentStatus.INVESTIGATING,
  IncidentStatus.RESOLVED,
];

const OPEN_INVOICE: InvoiceStatus[] = [
  InvoiceStatus.DRAFT,
  InvoiceStatus.SENT,
  InvoiceStatus.PARTIALLY_PAID,
  InvoiceStatus.OVERDUE,
];

function money(value: Prisma.Decimal | number | null | undefined): number {
  if (value == null) return 0;
  return Number(value);
}

function startOfUtcDay(d: Date): Date {
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0),
  );
}

/**
 * Module 6-C — thin customer report pack (live counts for a date window).
 * No fake KPIs / sparklines — period aggregates only.
 */
@Injectable()
export class CustomerReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async reportForStaff(
    customerId: string,
    user: AuthUser,
    from?: string,
    to?: string,
  ): Promise<CustomerReportResponseDto> {
    if (user.customerId && user.customerId !== customerId) {
      throw new ForbiddenException({
        error: 'CUSTOMER_SCOPE_DENIED',
        message: 'Cannot access another customer',
      });
    }
    return this.build(customerId, user.organizationId, from, to);
  }

  async reportForPortal(
    user: AuthUser,
    from?: string,
    to?: string,
  ): Promise<CustomerReportResponseDto> {
    const customerId = requireCustomerScope(user);
    return this.build(customerId, user.organizationId, from, to);
  }

  private resolvePeriod(from?: string, to?: string): { from: Date; to: Date } {
    const end = to ? new Date(to) : new Date();
    const start = from
      ? new Date(from)
      : startOfUtcDay(new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000));
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      throw new BadRequestException({
        error: 'INVALID_PERIOD',
        message: 'from/to must be valid dates',
      });
    }
    if (start > end) {
      throw new BadRequestException({
        error: 'INVALID_PERIOD',
        message: 'from must be before to',
      });
    }
    return { from: start, to: end };
  }

  private async build(
    customerId: string,
    organizationId: string,
    from?: string,
    to?: string,
  ): Promise<CustomerReportResponseDto> {
    const period = this.resolvePeriod(from, to);

    const customer = await this.prisma.customer.findFirst({
      where: { id: customerId, organizationId },
      select: { id: true, code: true, name: true, currency: true },
    });
    if (!customer) throw new NotFoundException('Customer not found');

    const sites = await this.prisma.site.findMany({
      where: { organizationId, customerId },
      select: { id: true, code: true, name: true },
      orderBy: { name: 'asc' },
    });
    const siteIds = sites.map((s) => s.id);
    const customerVehicles = await this.prisma.vehicle.findMany({
      where: { organizationId, customerId },
      select: { id: true, plateNumber: true },
    });
    const vehicleIds = customerVehicles.map((v) => v.id);
    const customerPlates = customerVehicles.map((v) => v.plateNumber);

    const range = { gte: period.from, lte: period.to };

    const [
      activeGuards,
      incidentsOpened,
      incidentsStillOpen,
      attendanceClockIns,
      accessEntries,
      visitorAppointments,
      visitorGateEntries,
      parkingEntries,
      complaintsOpened,
      complaintsStillOpen,
      serviceRequestsOpened,
      invoicesIssued,
      invoiceMoney,
      incidentsBySite,
      attendanceBySite,
      accessBySite,
      visitorEntriesBySite,
      parkingBySite,
      customerEmployees,
      activeCustomerEmployees,
      accessCheckIns,
      accessCheckOuts,
      uniqueAccessEmployees,
      activePermits,
      pendingPermits,
      customerParkingEntries,
      customerParkingExits,
      deniedParkingEntries,
      parkingViolations,
      blacklistedVehicles,
      payrollCyclesInPeriod,
      payrollPaidCycles,
      payrollPendingCycles,
      latestPayrollCycle,
    ] = await Promise.all([
      siteIds.length
        ? this.prisma.guardDeployment.count({
            where: {
              organizationId,
              siteId: { in: siteIds },
              status: DeploymentStatus.ACTIVE,
            },
          })
        : Promise.resolve(0),
      siteIds.length
        ? this.prisma.incident.count({
            where: {
              organizationId,
              siteId: { in: siteIds },
              createdAt: range,
            },
          })
        : Promise.resolve(0),
      siteIds.length
        ? this.prisma.incident.count({
            where: {
              organizationId,
              siteId: { in: siteIds },
              status: { in: OPEN_INCIDENT },
            },
          })
        : Promise.resolve(0),
      siteIds.length
        ? this.prisma.guardAttendance.count({
            where: {
              organizationId,
              siteId: { in: siteIds },
              clockInAt: range,
            },
          })
        : Promise.resolve(0),
      this.prisma.accessEntry.count({
        where: {
          organizationId,
          customerId,
          recordedAt: range,
        },
      }),
      this.prisma.visitorAppointment.count({
        where: {
          organizationId,
          customerId,
          createdAt: range,
        },
      }),
      siteIds.length
        ? this.prisma.visitorEntry.count({
            where: {
              organizationId,
              siteId: { in: siteIds },
              recordedAt: range,
            },
          })
        : Promise.resolve(0),
      siteIds.length
        ? this.prisma.parkingEntry.count({
            where: {
              organizationId,
              siteId: { in: siteIds },
              recordedAt: range,
            },
          })
        : Promise.resolve(0),
      this.prisma.customerComplaint.count({
        where: {
          organizationId,
          customerId,
          createdAt: range,
        },
      }),
      this.prisma.customerComplaint.count({
        where: {
          organizationId,
          customerId,
          status: { in: OPEN_COMPLAINT },
        },
      }),
      this.prisma.customerServiceRequest.count({
        where: {
          organizationId,
          customerId,
          createdAt: range,
        },
      }),
      this.prisma.invoice.count({
        where: {
          organizationId,
          customerId,
          issueDate: {
            gte: period.from,
            lte: period.to,
          },
        },
      }),
      this.prisma.invoice.findMany({
        where: {
          organizationId,
          customerId,
          status: { in: OPEN_INVOICE },
        },
        select: { totalAmount: true, amountPaid: true },
      }),
      siteIds.length
        ? this.prisma.incident.groupBy({
            by: ['siteId'],
            where: {
              organizationId,
              siteId: { in: siteIds },
              createdAt: range,
            },
            _count: { _all: true },
          })
        : Promise.resolve([]),
      siteIds.length
        ? this.prisma.guardAttendance.groupBy({
            by: ['siteId'],
            where: {
              organizationId,
              siteId: { in: siteIds },
              clockInAt: range,
            },
            _count: { _all: true },
          })
        : Promise.resolve([]),
      this.prisma.accessEntry.groupBy({
        by: ['siteId'],
        where: {
          organizationId,
          customerId,
          recordedAt: range,
        },
        _count: { _all: true },
      }),
      siteIds.length
        ? this.prisma.visitorEntry.groupBy({
            by: ['siteId'],
            where: {
              organizationId,
              siteId: { in: siteIds },
              recordedAt: range,
            },
            _count: { _all: true },
          })
        : Promise.resolve([]),
      siteIds.length
        ? this.prisma.parkingEntry.groupBy({
            by: ['siteId'],
            where: {
              organizationId,
              siteId: { in: siteIds },
              recordedAt: range,
            },
            _count: { _all: true },
          })
        : Promise.resolve([]),
      this.prisma.customerEmployee.count({
        where: {
          organizationId,
          customerId,
        },
      }),
      this.prisma.customerEmployee.count({
        where: {
          organizationId,
          customerId,
          isActive: true,
        },
      }),
      this.prisma.accessEntry.count({
        where: {
          organizationId,
          customerId,
          recordedAt: range,
          entryType: AccessEntryType.CHECK_IN,
        },
      }),
      this.prisma.accessEntry.count({
        where: {
          organizationId,
          customerId,
          recordedAt: range,
          entryType: AccessEntryType.CHECK_OUT,
        },
      }),
      this.prisma.accessEntry.groupBy({
        by: ['employeeId'],
        where: {
          organizationId,
          customerId,
          recordedAt: range,
        },
      }),
      vehicleIds.length
        ? this.prisma.parkingPermit.count({
            where: {
              organizationId,
              vehicleId: { in: vehicleIds },
              status: PermitStatus.ACTIVE,
            },
          })
        : Promise.resolve(0),
      vehicleIds.length
        ? this.prisma.parkingPermit.count({
            where: {
              organizationId,
              vehicleId: { in: vehicleIds },
              status: PermitStatus.PENDING,
            },
          })
        : Promise.resolve(0),
      vehicleIds.length
        ? this.prisma.parkingEntry.count({
            where: {
              organizationId,
              vehicleId: { in: vehicleIds },
              direction: ParkingEntryDirection.ENTRY,
              recordedAt: range,
            },
          })
        : Promise.resolve(0),
      vehicleIds.length
        ? this.prisma.parkingEntry.count({
            where: {
              organizationId,
              vehicleId: { in: vehicleIds },
              direction: ParkingEntryDirection.EXIT,
              recordedAt: range,
            },
          })
        : Promise.resolve(0),
      vehicleIds.length
        ? this.prisma.parkingEntry.count({
            where: {
              organizationId,
              vehicleId: { in: vehicleIds },
              decision: ParkingDecision.DENY,
              recordedAt: range,
            },
          })
        : Promise.resolve(0),
      vehicleIds.length || customerPlates.length
        ? this.prisma.parkingViolation.count({
            where: {
              organizationId,
              recordedAt: range,
              OR: [
                ...(vehicleIds.length ? [{ vehicleId: { in: vehicleIds } }] : []),
                ...(customerPlates.length
                  ? [{ plateNumber: { in: customerPlates } }]
                  : []),
              ],
            },
          })
        : Promise.resolve(0),
      customerPlates.length
        ? this.prisma.vehicleBlacklist.count({
            where: {
              organizationId,
              isActive: true,
              plateNumber: { in: customerPlates },
            },
          })
        : Promise.resolve(0),
      this.prisma.payrollCycle.count({
        where: {
          organizationId,
          customerId,
          tenantType: PayrollTenantType.CUSTOMER_MANAGED_PAYROLL,
          periodStart: { lte: period.to },
          periodEnd: { gte: period.from },
        },
      }),
      this.prisma.payrollCycle.count({
        where: {
          organizationId,
          customerId,
          tenantType: PayrollTenantType.CUSTOMER_MANAGED_PAYROLL,
          status: PayrollCycleStatus.PAID,
          periodStart: { lte: period.to },
          periodEnd: { gte: period.from },
        },
      }),
      this.prisma.payrollCycle.count({
        where: {
          organizationId,
          customerId,
          tenantType: PayrollTenantType.CUSTOMER_MANAGED_PAYROLL,
          status: {
            in: [
              PayrollCycleStatus.CALCULATED,
              PayrollCycleStatus.PENDING_APPROVAL,
              PayrollCycleStatus.APPROVED,
            ],
          },
          periodStart: { lte: period.to },
          periodEnd: { gte: period.from },
        },
      }),
      this.prisma.payrollCycle.findFirst({
        where: {
          organizationId,
          customerId,
          tenantType: PayrollTenantType.CUSTOMER_MANAGED_PAYROLL,
        },
        orderBy: [{ periodEnd: 'desc' }, { createdAt: 'desc' }],
        select: {
          cycleCode: true,
          status: true,
          periodStart: true,
          periodEnd: true,
          payslips: {
            select: {
              grossPay: true,
              netPay: true,
            },
          },
        },
      }),
    ]);

    let outstanding = 0;
    for (const inv of invoiceMoney) {
      outstanding += Math.max(0, money(inv.totalAmount) - money(inv.amountPaid));
    }

    const countMap = (
      rows: Array<{ siteId: string; _count: { _all: number } }>,
    ) => new Map(rows.map((r) => [r.siteId, r._count._all]));

    const incMap = countMap(incidentsBySite);
    const attMap = countMap(attendanceBySite);
    const accMap = countMap(accessBySite);
    const visMap = countMap(visitorEntriesBySite);
    const parkMap = countMap(parkingBySite);
    const latestPayrollGross = (latestPayrollCycle?.payslips ?? []).reduce(
      (sum, slip) => sum + money(slip.grossPay),
      0,
    );
    const latestPayrollNet = (latestPayrollCycle?.payslips ?? []).reduce(
      (sum, slip) => sum + money(slip.netPay),
      0,
    );

    const bySite = sites.map((s) => ({
      siteId: s.id,
      siteCode: s.code,
      siteName: s.name,
      incidentsOpened: incMap.get(s.id) ?? 0,
      attendanceClockIns: attMap.get(s.id) ?? 0,
      accessEntries: accMap.get(s.id) ?? 0,
      visitorGateEntries: visMap.get(s.id) ?? 0,
      parkingEntries: parkMap.get(s.id) ?? 0,
    }));

    return {
      customerId: customer.id,
      code: customer.code,
      name: customer.name,
      period: {
        from: period.from.toISOString(),
        to: period.to.toISOString(),
      },
      summary: {
        sites: sites.length,
        activeGuards,
        incidentsOpened,
        incidentsStillOpen,
        attendanceClockIns,
        accessEntries,
        visitorAppointments,
        visitorGateEntries,
        parkingEntries,
        complaintsOpened,
        complaintsStillOpen,
        serviceRequestsOpened,
        invoicesIssued,
        invoiceOutstandingAmount: Math.round(outstanding * 100) / 100,
        currency: customer.currency ?? 'TZS',
      },
      customerEmployeeAttendance: {
        totalEmployees: customerEmployees,
        activeEmployees: activeCustomerEmployees,
        checkIns: accessCheckIns,
        checkOuts: accessCheckOuts,
        uniqueEmployeesSeen: uniqueAccessEmployees.length,
      },
      parkingReport: {
        registeredVehicles: vehicleIds.length,
        activePermits,
        pendingPermits,
        entries: customerParkingEntries,
        exits: customerParkingExits,
        deniedEntries: deniedParkingEntries,
        violations: parkingViolations,
        blacklistedVehicles,
      },
      payrollReport: {
        available: payrollCyclesInPeriod > 0 || !!latestPayrollCycle,
        cyclesInPeriod: payrollCyclesInPeriod,
        paidCycles: payrollPaidCycles,
        pendingCycles: payrollPendingCycles,
        payslipsInLatestCycle: latestPayrollCycle?.payslips.length ?? 0,
        grossPayInLatestCycle: Math.round(latestPayrollGross * 100) / 100,
        netPayInLatestCycle: Math.round(latestPayrollNet * 100) / 100,
        latestCycleCode: latestPayrollCycle?.cycleCode ?? null,
        latestCycleStatus: latestPayrollCycle?.status ?? null,
        latestPeriodStart: latestPayrollCycle?.periodStart.toISOString() ?? null,
        latestPeriodEnd: latestPayrollCycle?.periodEnd.toISOString() ?? null,
      },
      bySite,
      generatedAt: new Date().toISOString(),
      notes: [
        'Live period counts from operational tables — not snapshot KPIs.',
        'incidentsStillOpen / complaintsStillOpen are current status (not period-limited).',
        'invoiceOutstandingAmount is open AR balance (all open invoices), not period revenue.',
        'customerEmployeeAttendance is derived from access-control entry logs for customer employees.',
        'parkingReport is scoped to this customer vehicles / permits where the current parking model allows.',
        'payrollReport reflects CUSTOMER_MANAGED_PAYROLL cycles linked to this customer only.',
        'Charts, PDF export suite, and SLA analytics beyond contract terms are deferred.',
      ],
    };
  }
}
