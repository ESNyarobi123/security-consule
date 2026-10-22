import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ComplaintCategory,
  ComplaintSeverity,
  ComplaintStatus,
  IncidentSeverity,
  ServiceRequestCategory,
  ServiceRequestStatus,
} from '@prisma/client';
import { AuditService } from '@pssms/audit';
import { IncidentsService } from '@pssms/incidents';
import {
  AuthUser,
  PrismaService,
  resolveSiteIdFilter,
  siteScopeWhere,
} from '@pssms/shared';
import { CustomerServiceRequestsService } from './customer-service-requests.service';
import { CreateStaffServiceRequestDto } from '../presentation/dto/service-request.dto';

const OPEN_SR: ServiceRequestStatus[] = [
  ServiceRequestStatus.OPEN,
  ServiceRequestStatus.ACKNOWLEDGED,
  ServiceRequestStatus.IN_PROGRESS,
];

const OPEN_CMP: ComplaintStatus[] = [
  ComplaintStatus.OPEN,
  ComplaintStatus.ACKNOWLEDGED,
  ComplaintStatus.UNDER_REVIEW,
];

const TICKET_CATEGORIES: ServiceRequestCategory[] = [
  ServiceRequestCategory.EXTRA_GUARDS,
  ServiceRequestCategory.COVERAGE,
  ServiceRequestCategory.ACCESS,
  ServiceRequestCategory.VISITOR,
  ServiceRequestCategory.BILLING,
  ServiceRequestCategory.PARKING,
  ServiceRequestCategory.SUPPLIER,
  ServiceRequestCategory.PAYROLL,
  ServiceRequestCategory.INCIDENT,
  ServiceRequestCategory.OTHER,
];

const CATEGORY_TO_INCIDENT: Partial<Record<ServiceRequestCategory, string>> = {
  [ServiceRequestCategory.PARKING]: 'PARKING_INCIDENT',
  [ServiceRequestCategory.SUPPLIER]: 'SUPPLIER_DISPUTE',
  [ServiceRequestCategory.PAYROLL]: 'PAYROLL_DISPUTE',
  [ServiceRequestCategory.VISITOR]: 'VISITOR_ISSUE',
  [ServiceRequestCategory.INCIDENT]: 'CUSTOMER_COMPLAINT',
  [ServiceRequestCategory.ACCESS]: 'ACCESS_BREACH',
  [ServiceRequestCategory.BILLING]: 'PAYROLL_DISPUTE',
};

@Injectable()
export class CallCentreService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly tickets: CustomerServiceRequestsService,
    private readonly incidents: IncidentsService,
  ) {}

  private assertStaff(user: AuthUser) {
    if (user.customerId || user.supplierId) {
      throw new ForbiddenException({
        error: 'SUPPORT_STAFF_ONLY',
        message: 'Call Centre is staff-only',
      });
    }
  }

  ticketOptions() {
    return {
      categories: TICKET_CATEGORIES,
      notes: [
        'PARKING / SUPPLIER / PAYROLL inquiries are tickets here — owning portals stay Parking, Supplier, and Payroll.',
        'INCIDENT tickets can escalate to Branch Ops via IncidentsService (no incidents.manage on CALL_CENTRE).',
      ],
    };
  }

  /** Complaint catalog for the support desk log form. */
  complaintOptions() {
    return {
      categories: Object.values(ComplaintCategory),
      severities: Object.values(ComplaintSeverity),
      statuses: Object.values(ComplaintStatus),
      notes: [
        'Complaints are the Module 6-B register — separate from support tickets.',
        'Creator cannot acknowledge or close their own complaint (SoD).',
      ],
    };
  }

  async customerOptions(user: AuthUser) {
    this.assertStaff(user);
    return this.prisma.customer.findMany({
      where: { organizationId: user.organizationId, isActive: true },
      select: { id: true, code: true, name: true },
      orderBy: { code: 'asc' },
      take: 200,
    });
  }

  /**
   * Sites for the ticket form. Binding a site is what lets a support ticket be
   * escalated into a Branch Ops incident, so the desk needs a thin picker that
   * does not require `enterprise.manage`.
   */
  async siteOptions(user: AuthUser, customerId: string) {
    this.assertStaff(user);
    if (!customerId) {
      throw new BadRequestException({ error: 'CUSTOMER_REQUIRED' });
    }
    const customer = await this.prisma.customer.findFirst({
      where: { id: customerId, organizationId: user.organizationId },
      select: { id: true },
    });
    if (!customer) {
      throw new BadRequestException({ error: 'INVALID_CUSTOMER' });
    }
    const scope = resolveSiteIdFilter(user);
    const sites = await this.prisma.site.findMany({
      where: {
        organizationId: user.organizationId,
        customerId,
        isActive: true,
        ...(scope ? { id: { in: scope } } : {}),
      },
      select: { id: true, code: true, name: true },
      orderBy: { code: 'asc' },
      take: 200,
    });
    return { customerId, sites };
  }

  /**
   * Read-only visitor support view for support-only personas (Helpdesk / CS /
   * Supervisor). Gate codes and verification are deliberately excluded — those
   * stay with `visitors.manage` (Call Centre agents / gate officers).
   */
  async visitorDesk(user: AuthUser) {
    this.assertStaff(user);
    const scope = siteScopeWhere(user);
    const [appointments, entries] = await Promise.all([
      this.prisma.visitorAppointment.findMany({
        where: { organizationId: user.organizationId, ...scope },
        orderBy: { validFrom: 'desc' },
        take: 100,
        select: {
          id: true,
          referenceNumber: true,
          visitorName: true,
          companyName: true,
          purpose: true,
          visitKind: true,
          idType: true,
          idNumber: true,
          hostName: true,
          siteId: true,
          validFrom: true,
          validUntil: true,
          status: true,
        },
      }),
      this.prisma.visitorEntry.findMany({
        where: { organizationId: user.organizationId, ...scope },
        orderBy: { recordedAt: 'desc' },
        take: 100,
        select: {
          id: true,
          visitorName: true,
          direction: true,
          result: true,
          denyReason: true,
          recordedAt: true,
          siteId: true,
          appointmentId: true,
        },
      }),
    ]);
    const siteIds = [
      ...new Set([
        ...appointments.map((a) => a.siteId),
        ...entries.map((e) => e.siteId),
      ]),
    ];
    const appointmentIds = [
      ...new Set(
        entries
          .map((e) => e.appointmentId)
          .filter((id): id is string => Boolean(id)),
      ),
    ];
    const [sites, linkedAppointments] = await Promise.all([
      siteIds.length
        ? this.prisma.site.findMany({
            where: { organizationId: user.organizationId, id: { in: siteIds } },
            select: { id: true, code: true, name: true },
          })
        : Promise.resolve([]),
      appointmentIds.length
        ? this.prisma.visitorAppointment.findMany({
            where: {
              organizationId: user.organizationId,
              id: { in: appointmentIds },
            },
            select: { id: true, referenceNumber: true },
          })
        : Promise.resolve([]),
    ]);
    const siteById = new Map(sites.map((s) => [s.id, s]));
    const refById = new Map(
      linkedAppointments.map((a) => [a.id, a.referenceNumber]),
    );
    return {
      readOnly: true,
      appointments: appointments.map((a) => ({
        id: a.id,
        referenceNumber: a.referenceNumber,
        visitorName: a.visitorName,
        companyName: a.companyName,
        purpose: a.purpose,
        visitKind: a.visitKind,
        idType: a.idType,
        idNumber: a.idNumber,
        hostName: a.hostName,
        validFrom: a.validFrom,
        validUntil: a.validUntil,
        status: a.status,
        siteCode: siteById.get(a.siteId)?.code ?? null,
        siteName: siteById.get(a.siteId)?.name ?? null,
      })),
      entries: entries.map((e) => ({
        id: e.id,
        visitorName: e.visitorName,
        direction: e.direction,
        result: e.result,
        denyReason: e.denyReason,
        recordedAt: e.recordedAt,
        siteCode: siteById.get(e.siteId)?.code ?? null,
        siteName: siteById.get(e.siteId)?.name ?? null,
        appointmentReference: e.appointmentId
          ? refById.get(e.appointmentId) ?? null
          : null,
      })),
      notes: [
        'Read-only support view: gate codes, approvals and verification stay with visitors.manage.',
        'Denied codes still raise a Branch Ops FieldAlert (VISITOR_GATE_DENIED).',
      ],
    };
  }

  async reports(user: AuthUser) {
    this.assertStaff(user);
    const org = user.organizationId;
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const [
      tickets,
      complaints,
      complaintStatus,
      escalated,
      pendingVisits,
      gateToday,
    ] = await Promise.all([
      this.prisma.customerServiceRequest.groupBy({
        by: ['category', 'status'],
        where: { organizationId: org },
        _count: { _all: true },
      }),
      this.prisma.customerComplaint.count({
        where: { organizationId: org, status: { in: OPEN_CMP } },
      }),
      this.prisma.customerComplaint.groupBy({
        by: ['status'],
        where: { organizationId: org },
        _count: { _all: true },
      }),
      this.prisma.customerServiceRequest.count({
        where: { organizationId: org, incidentId: { not: null } },
      }),
      this.prisma.visitorAppointment.count({
        where: { organizationId: org, status: 'PENDING' },
      }),
      this.prisma.visitorEntry.count({
        where: { organizationId: org, recordedAt: { gte: startOfDay } },
      }),
    ]);

    const byCategory = Object.fromEntries(
      TICKET_CATEGORIES.map((c) => [c, 0]),
    ) as Record<string, number>;
    const byTicketStatus = Object.fromEntries(
      Object.values(ServiceRequestStatus).map((s) => [s, 0]),
    ) as Record<string, number>;
    let openTickets = 0;
    for (const row of tickets) {
      byCategory[row.category] += row._count._all;
      byTicketStatus[row.status] =
        (byTicketStatus[row.status] ?? 0) + row._count._all;
      if (OPEN_SR.includes(row.status)) openTickets += row._count._all;
    }

    const complaintsByStatus = Object.fromEntries(
      Object.values(ComplaintStatus).map((s) => [s, 0]),
    ) as Record<string, number>;
    for (const row of complaintStatus) {
      complaintsByStatus[row.status] = row._count._all;
    }

    const pack = {
      openTickets,
      openComplaints: complaints,
      pendingVisitorAppointments: pendingVisits,
      gateEntriesToday: gateToday,
      ticketsByCategory: byCategory,
      ticketsByStatus: byTicketStatus,
      complaintsByStatus,
      escalatedTickets: escalated,
      parkingInquiries: byCategory.PARKING,
      supplierInquiries: byCategory.SUPPLIER,
      payrollInquiries: byCategory.PAYROLL,
      generatedAt: new Date().toISOString(),
      notes: [
        'Live counts — visitor KPIs from appointments/entries; parking/supplier/payroll are ticket categories (not those portals’ ledgers).',
        'Portal 35.20 audience: Call Centre Agents (CALL_CENTRE), Customer Support Officers (CUSTOMER_SUPPORT), Helpdesk Officers (IT_SUPPORT) and Supervisors. Visitor gate work still needs visitors.manage.',
      ],
    };

    await this.audit.record({
      organizationId: org,
      actorId: user.id,
      action: 'callcentre.reports.generated',
      resourceType: 'CallCentreReport',
      after: { openTickets, openComplaints: complaints },
    });
    return pack;
  }

  createTicket(dto: CreateStaffServiceRequestDto, user: AuthUser) {
    this.assertStaff(user);
    return this.tickets.createForStaff(dto, user);
  }

  async escalateTicket(id: string, user: AuthUser) {
    this.assertStaff(user);
    const row = await this.prisma.customerServiceRequest.findFirst({
      where: { id, organizationId: user.organizationId },
    });
    if (!row) throw new NotFoundException('Ticket not found');
    if (row.createdBy === user.id) {
      throw new ForbiddenException({
        error: 'CREATOR_CANNOT_PROCESS',
        message: 'Creator cannot escalate their own support ticket',
      });
    }
    if (row.incidentId) {
      throw new ConflictException({ error: 'ALREADY_ESCALATED' });
    }
    if (
      row.status === ServiceRequestStatus.CLOSED ||
      row.status === ServiceRequestStatus.CANCELLED
    ) {
      throw new BadRequestException({ error: 'TICKET_CLOSED' });
    }

    let siteId = row.siteId;
    if (!siteId) {
      const site = await this.prisma.site.findFirst({
        where: {
          organizationId: user.organizationId,
          customerId: row.customerId,
          isActive: true,
        },
        select: { id: true },
        orderBy: { code: 'asc' },
      });
      siteId = site?.id ?? null;
    }
    if (!siteId) {
      throw new BadRequestException({
        error: 'SITE_REQUIRED_FOR_ESCALATION',
        message: 'Bind a customer site before escalating to an incident',
      });
    }

    const category =
      CATEGORY_TO_INCIDENT[row.category] ?? 'CUSTOMER_COMPLAINT';
    const incident = await this.incidents.create(
      {
        siteId,
        category,
        title: row.title,
        description: `${row.referenceNumber}: ${row.description}`,
        severity: IncidentSeverity.MEDIUM,
        clientEventId: `support-ticket:${row.id}`,
      },
      user,
    );

    const updated = await this.prisma.customerServiceRequest.update({
      where: { id: row.id },
      data: {
        incidentId: incident.id,
        incidentNumber: incident.incidentNumber,
      },
    });

    await this.audit.record({
      organizationId: user.organizationId,
      actorId: user.id,
      action: 'callcentre.ticket.escalated',
      resourceType: 'CustomerServiceRequest',
      resourceId: row.id,
      after: {
        incidentId: incident.id,
        incidentNumber: incident.incidentNumber,
      },
    });

    return {
      ...updated,
      incidentId: incident.id,
      incidentNumber: incident.incidentNumber,
    };
  }
}
