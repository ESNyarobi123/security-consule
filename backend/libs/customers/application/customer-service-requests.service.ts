import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Prisma,
  ServiceRequestCategory,
  ServiceRequestStatus,
  ServiceRequestUrgency,
} from '@prisma/client';
import { AuditService } from '@pssms/audit';
import { AuthUser, PrismaService, requireCustomerScope } from '@pssms/shared';
import {
  CreateServiceRequestDto,
  CreateStaffServiceRequestDto,
  ServiceRequestResponseDto,
  UpdateServiceRequestStatusDto,
} from '../presentation/dto/service-request.dto';

const STAFF_TRANSITIONS: Record<ServiceRequestStatus, ServiceRequestStatus[]> =
  {
    [ServiceRequestStatus.OPEN]: [
      ServiceRequestStatus.ACKNOWLEDGED,
      ServiceRequestStatus.CANCELLED,
    ],
    [ServiceRequestStatus.ACKNOWLEDGED]: [
      ServiceRequestStatus.IN_PROGRESS,
      ServiceRequestStatus.RESOLVED,
      ServiceRequestStatus.CLOSED,
    ],
    [ServiceRequestStatus.IN_PROGRESS]: [
      ServiceRequestStatus.RESOLVED,
      ServiceRequestStatus.CLOSED,
    ],
    [ServiceRequestStatus.RESOLVED]: [ServiceRequestStatus.CLOSED],
    [ServiceRequestStatus.CLOSED]: [],
    [ServiceRequestStatus.CANCELLED]: [],
  };

@Injectable()
export class CustomerServiceRequestsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async createForPortal(
    dto: CreateServiceRequestDto,
    user: AuthUser,
  ): Promise<ServiceRequestResponseDto> {
    const customerId = requireCustomerScope(user);
    const title = dto.title.trim();
    const description = dto.description.trim();
    if (!title || !description) {
      throw new BadRequestException({
        error: 'VALIDATION',
        message: 'Title and description are required',
      });
    }

    if (dto.siteId) {
      const site = await this.prisma.site.findFirst({
        where: {
          id: dto.siteId,
          organizationId: user.organizationId,
          customerId,
        },
        select: { id: true },
      });
      if (!site) {
        throw new BadRequestException({
          error: 'INVALID_SITE',
          message: 'Site not found for your organisation',
        });
      }
    }

    const row = await this.createRow({
      organizationId: user.organizationId,
      customerId,
      category: dto.category,
      urgency: dto.urgency ?? ServiceRequestUrgency.THIS_WEEK,
      title,
      description,
      siteId: dto.siteId ?? null,
      callbackPhone: dto.callbackPhone?.trim() || null,
      createdBy: user.id,
    });

    await this.audit.record({
      organizationId: user.organizationId,
      actorId: user.id,
      action: 'customer.service_request.created',
      resourceType: 'CustomerServiceRequest',
      resourceId: row.id,
      after: {
        referenceNumber: row.referenceNumber,
        category: row.category,
        urgency: row.urgency,
        customerId,
      },
    });

    return this.toDto(row);
  }

  async createForStaff(
    dto: CreateStaffServiceRequestDto,
    user: AuthUser,
  ): Promise<ServiceRequestResponseDto> {
    if (user.customerId || user.supplierId) {
      throw new ForbiddenException({
        error: 'SUPPORT_STAFF_ONLY',
        message: 'Portal users cannot log staff tickets',
      });
    }
    const customer = await this.prisma.customer.findFirst({
      where: { id: dto.customerId, organizationId: user.organizationId },
      select: { id: true },
    });
    if (!customer) {
      throw new BadRequestException({
        error: 'INVALID_CUSTOMER',
        message: 'Customer not found',
      });
    }
    return this.createForPortal(
      {
        category: dto.category,
        urgency: dto.urgency,
        title: dto.title,
        description: dto.description,
        siteId: dto.siteId,
        callbackPhone: dto.callbackPhone,
      },
      { ...user, customerId: customer.id },
    );
  }

  async listForPortal(user: AuthUser): Promise<ServiceRequestResponseDto[]> {
    const customerId = requireCustomerScope(user);
    const rows = await this.prisma.customerServiceRequest.findMany({
      where: { organizationId: user.organizationId, customerId },
      orderBy: { createdAt: 'desc' },
    });
    return this.enrichMany(rows);
  }

  async cancelForPortal(
    id: string,
    user: AuthUser,
  ): Promise<ServiceRequestResponseDto> {
    const customerId = requireCustomerScope(user);
    const row = await this.prisma.customerServiceRequest.findFirst({
      where: { id, organizationId: user.organizationId, customerId },
    });
    if (!row) {
      throw new NotFoundException({
        error: 'NOT_FOUND',
        message: 'Service request not found',
      });
    }
    if (row.createdBy !== user.id) {
      throw new ForbiddenException({
        error: 'NOT_CREATOR',
        message: 'Only the requester can cancel this ticket',
      });
    }
    if (row.status !== ServiceRequestStatus.OPEN) {
      throw new BadRequestException({
        error: 'INVALID_STATUS',
        message: 'Only OPEN requests can be cancelled',
      });
    }

    const updated = await this.prisma.customerServiceRequest.update({
      where: { id: row.id },
      data: {
        status: ServiceRequestStatus.CANCELLED,
        closedBy: user.id,
        closedAt: new Date(),
        resolutionNotes: 'Cancelled by customer portal user',
      },
    });

    await this.audit.record({
      organizationId: user.organizationId,
      actorId: user.id,
      action: 'customer.service_request.cancelled',
      resourceType: 'CustomerServiceRequest',
      resourceId: updated.id,
      before: { status: row.status },
      after: { status: updated.status },
    });

    return this.toDto(updated);
  }

  async listForStaff(user: AuthUser): Promise<ServiceRequestResponseDto[]> {
    const rows = await this.prisma.customerServiceRequest.findMany({
      where: { organizationId: user.organizationId },
      orderBy: { createdAt: 'desc' },
      include: {
        customer: { select: { code: true, name: true } },
      },
    });
    return this.enrichMany(rows, user);
  }

  /** Single ticket for the support-desk detail drawer. */
  async getForStaff(
    id: string,
    user: AuthUser,
  ): Promise<ServiceRequestResponseDto> {
    const row = await this.prisma.customerServiceRequest.findFirst({
      where: { id, organizationId: user.organizationId },
      include: {
        customer: { select: { code: true, name: true } },
      },
    });
    if (!row) {
      throw new NotFoundException({
        error: 'NOT_FOUND',
        message: 'Service request not found',
      });
    }
    const [dto] = await this.enrichMany([row], user);
    return dto;
  }

  async updateStatusForStaff(
    id: string,
    dto: UpdateServiceRequestStatusDto,
    user: AuthUser,
  ): Promise<ServiceRequestResponseDto> {
    const row = await this.prisma.customerServiceRequest.findFirst({
      where: { id, organizationId: user.organizationId },
    });
    if (!row) {
      throw new NotFoundException({
        error: 'NOT_FOUND',
        message: 'Service request not found',
      });
    }

    if (row.createdBy === user.id) {
      throw new ForbiddenException({
        error: 'CREATOR_CANNOT_PROCESS',
        message: 'Creator cannot acknowledge or close their own request',
      });
    }

    const allowed = STAFF_TRANSITIONS[row.status] ?? [];
    if (!allowed.includes(dto.status)) {
      throw new BadRequestException({
        error: 'INVALID_TRANSITION',
        message: `Cannot move from ${row.status} to ${dto.status}`,
      });
    }

    const now = new Date();
    const data: {
      status: ServiceRequestStatus;
      resolutionNotes?: string | null;
      acknowledgedBy?: string;
      acknowledgedAt?: Date;
      resolvedBy?: string;
      resolvedAt?: Date;
      closedBy?: string;
      closedAt?: Date;
    } = { status: dto.status };

    if (dto.resolutionNotes?.trim()) {
      data.resolutionNotes = dto.resolutionNotes.trim();
    }

    if (dto.status === ServiceRequestStatus.ACKNOWLEDGED) {
      data.acknowledgedBy = user.id;
      data.acknowledgedAt = now;
    }
    if (dto.status === ServiceRequestStatus.RESOLVED) {
      data.resolvedBy = user.id;
      data.resolvedAt = now;
      if (!row.acknowledgedBy) {
        data.acknowledgedBy = user.id;
        data.acknowledgedAt = now;
      }
    }
    if (
      dto.status === ServiceRequestStatus.CLOSED ||
      dto.status === ServiceRequestStatus.CANCELLED
    ) {
      data.closedBy = user.id;
      data.closedAt = now;
      if (
        dto.status === ServiceRequestStatus.CLOSED &&
        !dto.resolutionNotes?.trim() &&
        !row.resolutionNotes
      ) {
        throw new BadRequestException({
          error: 'NOTES_REQUIRED',
          message: 'Resolution notes required to close',
        });
      }
    }

    const updated = await this.prisma.customerServiceRequest.update({
      where: { id: row.id },
      data,
    });

    await this.audit.record({
      organizationId: user.organizationId,
      actorId: user.id,
      action: `customer.service_request.${dto.status.toLowerCase()}`,
      resourceType: 'CustomerServiceRequest',
      resourceId: updated.id,
      before: { status: row.status },
      after: {
        status: updated.status,
        resolutionNotes: updated.resolutionNotes,
      },
    });

    return this.getForStaff(updated.id, user);
  }

  private async createRow(input: {
    organizationId: string;
    customerId: string;
    category: ServiceRequestCategory;
    urgency: ServiceRequestUrgency;
    title: string;
    description: string;
    siteId: string | null;
    callbackPhone: string | null;
    createdBy: string;
  }) {
    // Reference numbers must be globally unique per organisation. Seeds also
    // use non-numeric refs (SR-PARK-001, SR-SUP-001…), so always parse only
    // the numeric SR-##### family and retry if another request won the race.
    for (let attempt = 0; attempt < 6; attempt += 1) {
      try {
        return await this.prisma.customerServiceRequest.create({
          data: {
            ...input,
            referenceNumber: await this.nextReference(
              input.organizationId,
              attempt,
            ),
          },
        });
      } catch (error) {
        if (
          attempt < 5 &&
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2002'
        ) {
          continue;
        }
        throw error;
      }
    }
    throw new BadRequestException({
      error: 'REFERENCE_GENERATION_FAILED',
      message: 'Could not allocate a ticket reference, please retry',
    });
  }

  private async nextReference(
    organizationId: string,
    offset = 0,
  ): Promise<string> {
    const rows = await this.prisma.customerServiceRequest.findMany({
      where: {
        organizationId,
        referenceNumber: { startsWith: 'SR-' },
      },
      orderBy: { createdAt: 'desc' },
      take: 500,
      select: { referenceNumber: true },
    });
    let max = 0;
    for (const row of rows) {
      const match = /^SR-(\d+)$/.exec(row.referenceNumber);
      if (match) max = Math.max(max, Number.parseInt(match[1], 10));
    }
    return `SR-${String(max + 1 + offset).padStart(5, '0')}`;
  }

  private async enrichMany(
    rows: Array<{
      id: string;
      organizationId: string;
      customerId: string;
      referenceNumber: string;
      category: ServiceRequestCategory;
      urgency: ServiceRequestUrgency;
      status: ServiceRequestStatus;
      title: string;
      description: string;
      siteId: string | null;
      callbackPhone: string | null;
      createdBy: string;
      acknowledgedBy: string | null;
      acknowledgedAt: Date | null;
      resolvedBy: string | null;
      resolvedAt: Date | null;
      closedBy: string | null;
      closedAt: Date | null;
      resolutionNotes: string | null;
      createdAt: Date;
      updatedAt: Date;
      incidentId?: string | null;
      incidentNumber?: string | null;
      customer?: { code: string; name: string };
    }>,
    user?: AuthUser,
  ): Promise<ServiceRequestResponseDto[]> {
    if (rows.length === 0) return [];
    const siteIds = [
      ...new Set(rows.map((r) => r.siteId).filter((id): id is string => !!id)),
    ];
    const sites =
      siteIds.length === 0
        ? []
        : await this.prisma.site.findMany({
            where: { id: { in: siteIds } },
            select: { id: true, code: true, name: true },
          });
    const siteMap = new Map(sites.map((s) => [s.id, s]));
    const userIds = [
      ...new Set(
        rows
          .flatMap((r) => [
            r.createdBy,
            r.acknowledgedBy,
            r.resolvedBy,
            r.closedBy,
          ])
          .filter((id): id is string => !!id),
      ),
    ];
    const users =
      user && userIds.length
        ? await this.prisma.user.findMany({
            where: { id: { in: userIds }, organizationId: user.organizationId },
            select: { id: true, fullName: true },
          })
        : [];
    const nameOf = new Map(users.map((u) => [u.id, u.fullName]));

    return rows.map((r) => {
      const site = r.siteId ? siteMap.get(r.siteId) : undefined;
      const currentUserId = user?.id ?? null;
      return {
        ...this.toDto(r),
        siteCode: site?.code ?? null,
        siteName: site?.name ?? null,
        customerCode: r.customer?.code ?? null,
        customerName: r.customer?.name ?? null,
        createdByName: nameOf.get(r.createdBy) ?? null,
        acknowledgedByName: r.acknowledgedBy
          ? nameOf.get(r.acknowledgedBy) ?? null
          : null,
        resolvedByName: r.resolvedBy
          ? nameOf.get(r.resolvedBy) ?? null
          : null,
        closedByName: r.closedBy ? nameOf.get(r.closedBy) ?? null : null,
        isCreator: currentUserId ? r.createdBy === currentUserId : null,
        canProcess: currentUserId ? r.createdBy !== currentUserId : null,
        allowedNextStatuses: STAFF_TRANSITIONS[r.status] ?? [],
      };
    });
  }

  private toDto(row: {
    id: string;
    organizationId: string;
    customerId: string;
    referenceNumber: string;
    category: ServiceRequestCategory;
    urgency: ServiceRequestUrgency;
    status: ServiceRequestStatus;
    title: string;
    description: string;
    siteId: string | null;
    callbackPhone: string | null;
    incidentId?: string | null;
    incidentNumber?: string | null;
    createdBy: string;
    acknowledgedBy: string | null;
    acknowledgedAt: Date | null;
    resolvedBy: string | null;
    resolvedAt: Date | null;
    closedBy: string | null;
    closedAt: Date | null;
    resolutionNotes: string | null;
    createdAt: Date;
    updatedAt: Date;
  }): ServiceRequestResponseDto {
    return {
      id: row.id,
      organizationId: row.organizationId,
      customerId: row.customerId,
      referenceNumber: row.referenceNumber,
      category: row.category,
      urgency: row.urgency,
      status: row.status,
      title: row.title,
      description: row.description,
      siteId: row.siteId,
      callbackPhone: row.callbackPhone,
      incidentId: row.incidentId ?? null,
      incidentNumber: row.incidentNumber ?? null,
      createdBy: row.createdBy,
      acknowledgedBy: row.acknowledgedBy,
      acknowledgedAt: row.acknowledgedAt,
      resolvedBy: row.resolvedBy,
      resolvedAt: row.resolvedAt,
      closedBy: row.closedBy,
      closedAt: row.closedAt,
      resolutionNotes: row.resolutionNotes,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}
