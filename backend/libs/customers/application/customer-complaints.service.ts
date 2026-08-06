import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ComplaintCategory,
  ComplaintSeverity,
  ComplaintStatus,
} from '@prisma/client';
import { AuditService } from '@pssms/audit';
import { AuthUser, PrismaService, requireCustomerScope } from '@pssms/shared';
import {
  ComplaintResponseDto,
  CreateComplaintDto,
  CreateStaffComplaintDto,
  UpdateComplaintStatusDto,
} from '../presentation/dto/complaint.dto';

const STAFF_TRANSITIONS: Record<ComplaintStatus, ComplaintStatus[]> = {
  [ComplaintStatus.OPEN]: [
    ComplaintStatus.ACKNOWLEDGED,
    ComplaintStatus.CANCELLED,
  ],
  [ComplaintStatus.ACKNOWLEDGED]: [
    ComplaintStatus.UNDER_REVIEW,
    ComplaintStatus.RESOLVED,
    ComplaintStatus.CLOSED,
  ],
  [ComplaintStatus.UNDER_REVIEW]: [
    ComplaintStatus.RESOLVED,
    ComplaintStatus.CLOSED,
  ],
  [ComplaintStatus.RESOLVED]: [ComplaintStatus.CLOSED],
  [ComplaintStatus.CLOSED]: [],
  [ComplaintStatus.CANCELLED]: [],
};

const OPEN_STATUSES: ComplaintStatus[] = [
  ComplaintStatus.OPEN,
  ComplaintStatus.ACKNOWLEDGED,
  ComplaintStatus.UNDER_REVIEW,
];

@Injectable()
export class CustomerComplaintsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async createForPortal(
    dto: CreateComplaintDto,
    user: AuthUser,
  ): Promise<ComplaintResponseDto> {
    const customerId = requireCustomerScope(user);
    return this.createInternal(dto, user, customerId);
  }

  async createForStaff(
    dto: CreateStaffComplaintDto,
    user: AuthUser,
  ): Promise<ComplaintResponseDto> {
    if (user.customerId) {
      throw new ForbiddenException({
        error: 'CUSTOMER_SCOPE_DENIED',
        message: 'Use portal create for own complaints',
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
    return this.createInternal(dto, user, customer.id);
  }

  async listForPortal(user: AuthUser): Promise<ComplaintResponseDto[]> {
    const customerId = requireCustomerScope(user);
    const rows = await this.prisma.customerComplaint.findMany({
      where: { organizationId: user.organizationId, customerId },
      orderBy: { createdAt: 'desc' },
    });
    return this.enrichMany(rows);
  }

  async cancelForPortal(
    id: string,
    user: AuthUser,
  ): Promise<ComplaintResponseDto> {
    const customerId = requireCustomerScope(user);
    const row = await this.prisma.customerComplaint.findFirst({
      where: { id, organizationId: user.organizationId, customerId },
    });
    if (!row) {
      throw new NotFoundException({
        error: 'NOT_FOUND',
        message: 'Complaint not found',
      });
    }
    if (row.createdBy !== user.id) {
      throw new ForbiddenException({
        error: 'NOT_CREATOR',
        message: 'Only the complainant can cancel this complaint',
      });
    }
    if (row.status !== ComplaintStatus.OPEN) {
      throw new BadRequestException({
        error: 'INVALID_STATUS',
        message: 'Only OPEN complaints can be cancelled',
      });
    }

    const updated = await this.prisma.customerComplaint.update({
      where: { id: row.id },
      data: {
        status: ComplaintStatus.CANCELLED,
        closedBy: user.id,
        closedAt: new Date(),
        resolutionNotes: 'Cancelled by customer portal user',
      },
    });

    await this.audit.record({
      organizationId: user.organizationId,
      actorId: user.id,
      action: 'customer.complaint.cancelled',
      resourceType: 'CustomerComplaint',
      resourceId: updated.id,
      before: { status: row.status },
      after: { status: updated.status },
    });

    return this.toDto(updated);
  }

  async listForStaff(user: AuthUser): Promise<ComplaintResponseDto[]> {
    const rows = await this.prisma.customerComplaint.findMany({
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
    dto: UpdateComplaintStatusDto,
    user: AuthUser,
  ): Promise<ComplaintResponseDto> {
    const row = await this.prisma.customerComplaint.findFirst({
      where: { id, organizationId: user.organizationId },
    });
    if (!row) {
      throw new NotFoundException({
        error: 'NOT_FOUND',
        message: 'Complaint not found',
      });
    }

    if (row.createdBy === user.id) {
      throw new ForbiddenException({
        error: 'CREATOR_CANNOT_PROCESS',
        message: 'Creator cannot acknowledge or close their own complaint',
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
      status: ComplaintStatus;
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

    if (dto.status === ComplaintStatus.ACKNOWLEDGED) {
      data.acknowledgedBy = user.id;
      data.acknowledgedAt = now;
    }
    if (
      dto.status === ComplaintStatus.UNDER_REVIEW &&
      !row.acknowledgedBy
    ) {
      data.acknowledgedBy = user.id;
      data.acknowledgedAt = now;
    }
    if (dto.status === ComplaintStatus.RESOLVED) {
      data.resolvedBy = user.id;
      data.resolvedAt = now;
      if (!row.acknowledgedBy) {
        data.acknowledgedBy = user.id;
        data.acknowledgedAt = now;
      }
    }
    if (
      dto.status === ComplaintStatus.CLOSED ||
      dto.status === ComplaintStatus.CANCELLED
    ) {
      data.closedBy = user.id;
      data.closedAt = now;
      if (
        dto.status === ComplaintStatus.CLOSED &&
        !dto.resolutionNotes?.trim() &&
        !row.resolutionNotes
      ) {
        throw new BadRequestException({
          error: 'NOTES_REQUIRED',
          message: 'Resolution notes required to close',
        });
      }
    }

    const updated = await this.prisma.customerComplaint.update({
      where: { id: row.id },
      data,
    });

    await this.audit.record({
      organizationId: user.organizationId,
      actorId: user.id,
      action: `customer.complaint.${dto.status.toLowerCase()}`,
      resourceType: 'CustomerComplaint',
      resourceId: updated.id,
      before: { status: row.status },
      after: {
        status: updated.status,
        resolutionNotes: updated.resolutionNotes,
      },
    });

    return this.toDto(updated);
  }

  /** Open complaint count for customer 360. */
  async countOpen(organizationId: string, customerId: string): Promise<number> {
    return this.prisma.customerComplaint.count({
      where: {
        organizationId,
        customerId,
        status: { in: OPEN_STATUSES },
      },
    });
  }

  private async createInternal(
    dto: CreateComplaintDto,
    user: AuthUser,
    customerId: string,
  ): Promise<ComplaintResponseDto> {
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
          message: 'Site not found for this customer',
        });
      }
    }

    const referenceNumber = await this.nextReference(user.organizationId);
    const row = await this.prisma.customerComplaint.create({
      data: {
        organizationId: user.organizationId,
        customerId,
        referenceNumber,
        category: dto.category,
        severity: dto.severity ?? ComplaintSeverity.MEDIUM,
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
      action: 'customer.complaint.created',
      resourceType: 'CustomerComplaint',
      resourceId: row.id,
      after: {
        referenceNumber: row.referenceNumber,
        category: row.category,
        severity: row.severity,
        customerId,
      },
    });

    return this.toDto(row);
  }

  private async nextReference(organizationId: string): Promise<string> {
    const latest = await this.prisma.customerComplaint.findFirst({
      where: {
        organizationId,
        referenceNumber: { startsWith: 'CMP-' },
      },
      orderBy: { referenceNumber: 'desc' },
      select: { referenceNumber: true },
    });
    let n = 1;
    if (latest?.referenceNumber) {
      const part = latest.referenceNumber.slice(4);
      const parsed = Number.parseInt(part, 10);
      if (!Number.isNaN(parsed)) n = parsed + 1;
    }
    return `CMP-${String(n).padStart(5, '0')}`;
  }

  private async enrichMany(
    rows: Array<{
      id: string;
      organizationId: string;
      customerId: string;
      referenceNumber: string;
      category: ComplaintCategory;
      severity: ComplaintSeverity;
      status: ComplaintStatus;
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
  ): Promise<ComplaintResponseDto[]> {
    if (rows.length === 0) return [];
    const siteIds = [
      ...new Set(rows.map((r) => r.siteId).filter((id): id is string => !!id)),
    ];
    const sites = siteIds.length
      ? await this.prisma.site.findMany({
          where: { id: { in: siteIds } },
          select: { id: true, code: true, name: true },
        })
      : [];
    const siteById = new Map(sites.map((s) => [s.id, s]));
    return rows.map((r) => {
      const site = r.siteId ? siteById.get(r.siteId) : undefined;
      return this.toDto(r, {
        siteCode: site?.code ?? null,
        siteName: site?.name ?? null,
        customerCode: r.customer?.code ?? null,
        customerName: r.customer?.name ?? null,
      });
    });
  }

  private toDto(
    row: {
      id: string;
      organizationId: string;
      customerId: string;
      referenceNumber: string;
      category: ComplaintCategory;
      severity: ComplaintSeverity;
      status: ComplaintStatus;
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
    },
    extra?: {
      siteCode?: string | null;
      siteName?: string | null;
      customerCode?: string | null;
      customerName?: string | null;
    },
  ): ComplaintResponseDto {
    return {
      id: row.id,
      organizationId: row.organizationId,
      customerId: row.customerId,
      referenceNumber: row.referenceNumber,
      category: row.category,
      severity: row.severity,
      status: row.status,
      title: row.title,
      description: row.description,
      siteId: row.siteId,
      siteCode: extra?.siteCode ?? null,
      siteName: extra?.siteName ?? null,
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
      customerCode: extra?.customerCode ?? null,
      customerName: extra?.customerName ?? null,
    };
  }
}
