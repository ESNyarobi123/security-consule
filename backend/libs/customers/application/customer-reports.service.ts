import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ComplaintStatus,
  DeploymentStatus,
  IncidentStatus,
  InvoiceStatus,
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
      bySite,
      generatedAt: new Date().toISOString(),
      notes: [
        'Live period counts from operational tables — not snapshot KPIs.',
        'incidentsStillOpen / complaintsStillOpen are current status (not period-limited).',
        'invoiceOutstandingAmount is open AR balance (all open invoices), not period revenue.',
        'Charts, PDF export suite, and SLA analytics beyond contract terms are deferred.',
      ],
    };
  }
}
