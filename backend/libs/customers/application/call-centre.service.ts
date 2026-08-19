import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ComplaintStatus,
  IncidentSeverity,
  ServiceRequestCategory,
  ServiceRequestStatus,
} from '@prisma/client';
import { AuditService } from '@pssms/audit';
import { IncidentsService } from '@pssms/incidents';
import { AuthUser, PrismaService } from '@pssms/shared';
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

  async customerOptions(user: AuthUser) {
    this.assertStaff(user);
    return this.prisma.customer.findMany({
      where: { organizationId: user.organizationId, isActive: true },
      select: { id: true, code: true, name: true },
      orderBy: { code: 'asc' },
      take: 200,
    });
  }

  async reports(user: AuthUser) {
    this.assertStaff(user);
    const org = user.organizationId;
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const [tickets, complaints, pendingVisits, gateToday] = await Promise.all([
      this.prisma.customerServiceRequest.groupBy({
        by: ['category', 'status'],
        where: { organizationId: org },
        _count: { _all: true },
      }),
      this.prisma.customerComplaint.count({
        where: { organizationId: org, status: { in: OPEN_CMP } },
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
    let openTickets = 0;
    for (const row of tickets) {
      byCategory[row.category] += row._count._all;
      if (OPEN_SR.includes(row.status)) openTickets += row._count._all;
    }

    const pack = {
      openTickets,
      openComplaints: complaints,
      pendingVisitorAppointments: pendingVisits,
      gateEntriesToday: gateToday,
      ticketsByCategory: byCategory,
      parkingInquiries: byCategory.PARKING,
      supplierInquiries: byCategory.SUPPLIER,
      payrollInquiries: byCategory.PAYROLL,
      generatedAt: new Date().toISOString(),
      notes: [
        'Live counts — visitor KPIs from appointments/entries; parking/supplier/payroll are ticket categories (not those portals’ ledgers).',
        'Helpdesk Officers stay IT_SUPPORT (users.manage). Supervisors stay Branch Ops for field incidents.',
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
