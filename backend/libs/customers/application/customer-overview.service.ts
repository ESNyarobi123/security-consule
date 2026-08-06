import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AppointmentStatus,
  ComplaintStatus,
  DeploymentStatus,
  IncidentStatus,
  InvoiceStatus,
  PermitStatus,
  Prisma,
  ServiceRequestStatus,
} from '@prisma/client';
import { AuthUser, PrismaService } from '@pssms/shared';
import { CustomerOverviewResponseDto } from '../presentation/dto/customer-overview.dto';
import { CustomerAssignedGuardResponseDto } from '../presentation/dto/customer-guards.dto';

const OPEN_INVOICE: InvoiceStatus[] = [
  InvoiceStatus.DRAFT,
  InvoiceStatus.SENT,
  InvoiceStatus.PARTIALLY_PAID,
  InvoiceStatus.OVERDUE,
];

const OPEN_SR: ServiceRequestStatus[] = [
  ServiceRequestStatus.OPEN,
  ServiceRequestStatus.ACKNOWLEDGED,
  ServiceRequestStatus.IN_PROGRESS,
];

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

function money(value: Prisma.Decimal | number | null | undefined): number {
  if (value == null) return 0;
  return Number(value);
}

/**
 * Module 6-A — staff customer 360 read model (org-scoped aggregation).
 * Uses Prisma only (no cross-lib repository calls); samples capped for UI.
 */
@Injectable()
export class CustomerOverviewService {
  constructor(private readonly prisma: PrismaService) {}

  async getOverview(
    customerId: string,
    user: AuthUser,
  ): Promise<CustomerOverviewResponseDto> {
    if (user.customerId && user.customerId !== customerId) {
      throw new ForbiddenException({
        error: 'CUSTOMER_SCOPE_DENIED',
        message: 'Cannot access another customer',
      });
    }

    const orgId = user.organizationId;
    const customer = await this.prisma.customer.findFirst({
      where: { id: customerId, organizationId: orgId },
      select: {
        id: true,
        code: true,
        name: true,
        currency: true,
      },
    });
    if (!customer) throw new NotFoundException('Customer not found');

    const sites = await this.prisma.site.findMany({
      where: { organizationId: orgId, customerId },
      select: { id: true, code: true, name: true },
    });
    const siteIds = sites.map((s) => s.id);
    const siteById = new Map(sites.map((s) => [s.id, s]));
    const since30d = new Date();
    since30d.setDate(since30d.getDate() - 30);

    const [
      contractCount,
      employeeCount,
      invoiceCount,
      openInvoiceCount,
      overdueInvoiceCount,
      openSrCount,
      openComplaintCount,
      openIncidentCount,
      vehicleCount,
      activePermitCount,
      accessEntries30d,
      pendingAppointments,
      activeGuardCount,
      contractRows,
      deploymentRows,
      invoiceRows,
      incidentRows,
      srRows,
      complaintRows,
      employeeRows,
      vehicleRows,
      invoiceMoney,
    ] = await Promise.all([
      this.prisma.contract.count({
        where: { organizationId: orgId, customerId },
      }),
      this.prisma.customerEmployee.count({
        where: { organizationId: orgId, customerId },
      }),
      this.prisma.invoice.count({
        where: { organizationId: orgId, customerId },
      }),
      this.prisma.invoice.count({
        where: {
          organizationId: orgId,
          customerId,
          status: { in: OPEN_INVOICE },
        },
      }),
      this.prisma.invoice.count({
        where: {
          organizationId: orgId,
          customerId,
          status: InvoiceStatus.OVERDUE,
        },
      }),
      this.prisma.customerServiceRequest.count({
        where: {
          organizationId: orgId,
          customerId,
          status: { in: OPEN_SR },
        },
      }),
      this.prisma.customerComplaint.count({
        where: {
          organizationId: orgId,
          customerId,
          status: { in: OPEN_COMPLAINT },
        },
      }),
      siteIds.length
        ? this.prisma.incident.count({
            where: {
              organizationId: orgId,
              siteId: { in: siteIds },
              status: { in: OPEN_INCIDENT },
            },
          })
        : Promise.resolve(0),
      this.prisma.vehicle.count({
        where: { organizationId: orgId, customerId },
      }),
      siteIds.length
        ? this.prisma.parkingPermit.count({
            where: {
              organizationId: orgId,
              siteId: { in: siteIds },
              status: PermitStatus.ACTIVE,
            },
          })
        : Promise.resolve(0),
      this.prisma.accessEntry.count({
        where: {
          organizationId: orgId,
          customerId,
          recordedAt: { gte: since30d },
        },
      }),
      this.prisma.visitorAppointment.count({
        where: {
          organizationId: orgId,
          customerId,
          status: AppointmentStatus.PENDING,
        },
      }),
      siteIds.length
        ? this.prisma.guardDeployment.count({
            where: {
              organizationId: orgId,
              siteId: { in: siteIds },
              status: DeploymentStatus.ACTIVE,
            },
          })
        : Promise.resolve(0),
      this.prisma.contract.findMany({
        where: { organizationId: orgId, customerId },
        orderBy: { updatedAt: 'desc' },
        take: 8,
        select: {
          id: true,
          contractNumber: true,
          title: true,
          status: true,
          serviceType: true,
          monthlyFee: true,
          currency: true,
        },
      }),
      siteIds.length
        ? this.prisma.guardDeployment.findMany({
            where: {
              organizationId: orgId,
              siteId: { in: siteIds },
              status: DeploymentStatus.ACTIVE,
            },
            orderBy: { startDate: 'desc' },
            take: 12,
            include: {
              guard: {
                select: {
                  id: true,
                  employeeNumber: true,
                  employee: { select: { fullName: true } },
                },
              },
            },
          })
        : Promise.resolve([]),
      this.prisma.invoice.findMany({
        where: { organizationId: orgId, customerId },
        orderBy: { issueDate: 'desc' },
        take: 8,
        select: {
          id: true,
          invoiceNumber: true,
          status: true,
          totalAmount: true,
          amountPaid: true,
          currency: true,
          dueDate: true,
        },
      }),
      siteIds.length
        ? this.prisma.incident.findMany({
            where: { organizationId: orgId, siteId: { in: siteIds } },
            orderBy: { createdAt: 'desc' },
            take: 8,
            select: {
              id: true,
              incidentNumber: true,
              title: true,
              severity: true,
              status: true,
              siteId: true,
              createdAt: true,
            },
          })
        : Promise.resolve([]),
      this.prisma.customerServiceRequest.findMany({
        where: { organizationId: orgId, customerId },
        orderBy: { createdAt: 'desc' },
        take: 8,
        select: {
          id: true,
          referenceNumber: true,
          title: true,
          category: true,
          status: true,
          urgency: true,
          createdAt: true,
        },
      }),
      this.prisma.customerComplaint.findMany({
        where: { organizationId: orgId, customerId },
        orderBy: { createdAt: 'desc' },
        take: 8,
        select: {
          id: true,
          referenceNumber: true,
          title: true,
          category: true,
          severity: true,
          status: true,
          createdAt: true,
        },
      }),
      this.prisma.customerEmployee.findMany({
        where: { organizationId: orgId, customerId },
        orderBy: { fullName: 'asc' },
        take: 12,
        select: {
          id: true,
          employeeNumber: true,
          fullName: true,
          department: true,
          isActive: true,
        },
      }),
      this.prisma.vehicle.findMany({
        where: { organizationId: orgId, customerId },
        orderBy: { plateNumber: 'asc' },
        take: 10,
        select: {
          id: true,
          plateNumber: true,
          vehicleType: true,
          ownerName: true,
          isActive: true,
        },
      }),
      this.prisma.invoice.findMany({
        where: {
          organizationId: orgId,
          customerId,
          status: { not: InvoiceStatus.VOIDED },
        },
        select: { totalAmount: true, amountPaid: true, status: true },
      }),
    ]);

    let outstanding = 0;
    let paid = 0;
    for (const inv of invoiceMoney) {
      paid += money(inv.amountPaid);
      if (OPEN_INVOICE.includes(inv.status)) {
        outstanding += Math.max(0, money(inv.totalAmount) - money(inv.amountPaid));
      }
    }

    return {
      customerId: customer.id,
      code: customer.code,
      name: customer.name,
      counts: {
        sites: sites.length,
        contracts: contractCount,
        employees: employeeCount,
        activeGuards: activeGuardCount,
        invoices: invoiceCount,
        openInvoices: openInvoiceCount,
        overdueInvoices: overdueInvoiceCount,
        openServiceRequests: openSrCount,
        openComplaints: openComplaintCount,
        openIncidents: openIncidentCount,
        vehicles: vehicleCount,
        activePermits: activePermitCount,
        accessEntries30d,
        pendingAppointments,
      },
      billing: {
        currency: customer.currency ?? 'TZS',
        outstandingAmount: Math.round(outstanding * 100) / 100,
        paidAmount: Math.round(paid * 100) / 100,
      },
      contracts: contractRows.map((c) => ({
        id: c.id,
        contractNumber: c.contractNumber,
        title: c.title,
        status: c.status,
        serviceType: c.serviceType,
        monthlyFee: money(c.monthlyFee),
        currency: c.currency,
      })),
      guards: deploymentRows.map((d) => {
        const site = siteById.get(d.siteId);
        return {
          deploymentId: d.id,
          guardId: d.guard.id,
          guardNumber: d.guard.employeeNumber,
          fullName: d.guard.employee?.fullName ?? null,
          siteCode: site?.code ?? '—',
          siteName: site?.name ?? '—',
          status: d.status,
        };
      }),
      invoices: invoiceRows.map((i) => {
        const total = money(i.totalAmount);
        const paidAmt = money(i.amountPaid);
        return {
          id: i.id,
          invoiceNumber: i.invoiceNumber,
          status: i.status,
          totalAmount: total,
          amountPaid: paidAmt,
          balance: Math.max(0, total - paidAmt),
          currency: i.currency,
          dueDate: i.dueDate.toISOString().slice(0, 10),
        };
      }),
      incidents: incidentRows.map((r) => ({
        id: r.id,
        incidentNumber: r.incidentNumber,
        title: r.title,
        severity: r.severity,
        status: r.status,
        siteCode: siteById.get(r.siteId)?.code ?? null,
        createdAt: r.createdAt.toISOString(),
      })),
      serviceRequests: srRows.map((r) => ({
        id: r.id,
        referenceNumber: r.referenceNumber,
        title: r.title,
        category: r.category,
        status: r.status,
        urgency: r.urgency,
        createdAt: r.createdAt.toISOString(),
      })),
      complaints: complaintRows.map((r) => ({
        id: r.id,
        referenceNumber: r.referenceNumber,
        title: r.title,
        category: r.category,
        severity: r.severity,
        status: r.status,
        createdAt: r.createdAt.toISOString(),
      })),
      employees: employeeRows,
      vehicles: vehicleRows.map((v) => ({
        id: v.id,
        plateNumber: v.plateNumber,
        vehicleType: v.vehicleType,
        ownerName: v.ownerName,
        isActive: v.isActive,
      })),
    };
  }

  /**
   * Module 6-L — full assigned-guards roster for a customer (site-scoped deployments).
   * Read-only; deploy/end stays on Branch Ops (`operations.manage` / guards).
   */
  async listAssignedGuards(
    customerId: string,
    user: AuthUser,
    status: 'ACTIVE' | 'ENDED' | 'ALL' = 'ACTIVE',
  ): Promise<CustomerAssignedGuardResponseDto[]> {
    if (user.customerId && user.customerId !== customerId) {
      throw new ForbiddenException({
        error: 'CUSTOMER_SCOPE_DENIED',
        message: 'Cannot access another customer',
      });
    }

    const orgId = user.organizationId;
    const customer = await this.prisma.customer.findFirst({
      where: { id: customerId, organizationId: orgId },
      select: { id: true },
    });
    if (!customer) throw new NotFoundException('Customer not found');

    const sites = await this.prisma.site.findMany({
      where: { organizationId: orgId, customerId },
      select: { id: true, code: true, name: true },
    });
    if (sites.length === 0) return [];

    const siteIds = sites.map((s) => s.id);
    const siteById = new Map(sites.map((s) => [s.id, s]));

    const statusWhere =
      status === 'ALL'
        ? {}
        : status === 'ENDED'
          ? { status: DeploymentStatus.ENDED }
          : { status: DeploymentStatus.ACTIVE };

    const rows = await this.prisma.guardDeployment.findMany({
      where: {
        organizationId: orgId,
        siteId: { in: siteIds },
        ...statusWhere,
      },
      orderBy: [{ status: 'asc' }, { startDate: 'desc' }],
      take: 200,
      include: {
        guard: {
          select: {
            id: true,
            employeeNumber: true,
            status: true,
            deploymentEligible: true,
            employee: { select: { fullName: true } },
          },
        },
      },
    });

    const contractIds = [
      ...new Set(
        rows
          .map((d) => d.contractId)
          .filter((id): id is string => typeof id === 'string' && id.length > 0),
      ),
    ];
    const contracts = contractIds.length
      ? await this.prisma.contract.findMany({
          where: {
            organizationId: orgId,
            customerId,
            id: { in: contractIds },
          },
          select: { id: true, contractNumber: true },
        })
      : [];
    const contractById = new Map(contracts.map((c) => [c.id, c.contractNumber]));

    return rows.map((d) => {
      const site = siteById.get(d.siteId);
      return {
        deploymentId: d.id,
        guardId: d.guard.id,
        guardNumber: d.guard.employeeNumber,
        fullName: d.guard.employee?.fullName ?? null,
        guardStatus: d.guard.status,
        deploymentEligible: d.guard.deploymentEligible,
        siteId: d.siteId,
        siteCode: site?.code ?? '—',
        siteName: site?.name ?? '—',
        contractId: d.contractId,
        contractNumber: d.contractId
          ? (contractById.get(d.contractId) ?? null)
          : null,
        deploymentStatus: d.status,
        startDate: d.startDate.toISOString().slice(0, 10),
        endDate: d.endDate ? d.endDate.toISOString().slice(0, 10) : null,
      };
    });
  }
}
