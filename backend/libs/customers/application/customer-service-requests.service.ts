import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ServiceRequestCategory,
  ServiceRequestStatus,
  ServiceRequestUrgency,
} from '@prisma/client';
import { AuditService } from '@pssms/audit';
import { AuthUser, PrismaService, requireCustomerScope } from '@pssms/shared';
import {
  CreateServiceRequestDto,
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

    const referenceNumber = await this.nextReference(user.organizationId);
    const row = await this.prisma.customerServiceRequest.create({
      data: {
        organizationId: user.organizationId,
        customerId,
        referenceNumber,
        category: dto.category,
        urgency: dto.urgency ?? ServiceRequestUrgency.THIS_WEEK,
        title,
        description,
        siteId: dto.siteId ?? null,
        callbackPhone: dto.callbackPhone?.trim() || null,
        createdBy: user.id,
      },
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
    return this.enrichMany(rows);
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

    return this.toDto(updated);
  }

  private async nextReference(organizationId: string): Promise<string> {
    const latest = await this.prisma.customerServiceRequest.findFirst({
      where: {
        organizationId,
        referenceNumber: { startsWith: 'SR-' },
      },
      orderBy: { referenceNumber: 'desc' },
      select: { referenceNumber: true },
    });
    let n = 1;
    if (latest?.referenceNumber) {
      const part = latest.referenceNumber.slice(3);
      const parsed = Number.parseInt(part, 10);
      if (!Number.isNaN(parsed)) n = parsed + 1;
    }
    return `SR-${String(n).padStart(5, '0')}`;
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
      customer?: { code: string; name: string };
    }>,
  ): Promise<ServiceRequestResponseDto[]> {
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

    return rows.map((r) => {
      const site = r.siteId ? siteMap.get(r.siteId) : undefined;
      return {
        ...this.toDto(r),
        siteCode: site?.code ?? null,
        siteName: site?.name ?? null,
        customerCode: r.customer?.code ?? null,
        customerName: r.customer?.name ?? null,
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
