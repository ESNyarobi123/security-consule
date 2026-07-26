import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  BreachSeverity,
  BreachStatus,
  PolicyStatus,
  Prisma,
} from '@prisma/client';
import { PrismaService, AuthUser } from '@pssms/shared';
import { AuditService } from '@pssms/audit';
import { ApprovalsService } from '@pssms/approvals';
import {
  CreateBreachDto,
  CreatePolicyDto,
  DataBreachCaseResponseDto,
  PolicyDocumentResponseDto,
  RejectPolicyDto,
  UpdateBreachDto,
  UpdatePolicyDto,
} from '../presentation/dto/compliance.dto';

const BREACH_NEXT: Record<BreachStatus, BreachStatus | null> = {
  [BreachStatus.REPORTED]: BreachStatus.INVESTIGATING,
  [BreachStatus.INVESTIGATING]: BreachStatus.CONTAINED,
  [BreachStatus.CONTAINED]: BreachStatus.CLOSED,
  [BreachStatus.CLOSED]: null,
};

@Injectable()
export class ComplianceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly approvals: ApprovalsService,
  ) {}

  // ── Policies ──────────────────────────────────────────────

  async listPolicies(
    organizationId: string,
  ): Promise<PolicyDocumentResponseDto[]> {
    const rows = await this.prisma.policyDocument.findMany({
      where: { organizationId },
      orderBy: { updatedAt: 'desc' },
    });
    return rows.map((r) => this.toPolicyDto(r));
  }

  async getPolicy(
    id: string,
    organizationId: string,
  ): Promise<PolicyDocumentResponseDto> {
    return this.toPolicyDto(await this.findPolicyOrThrow(id, organizationId));
  }

  async createPolicy(
    dto: CreatePolicyDto,
    user: AuthUser,
  ): Promise<PolicyDocumentResponseDto> {
    try {
      const row = await this.prisma.policyDocument.create({
        data: {
          organizationId: user.organizationId,
          code: dto.code.trim().toUpperCase(),
          title: dto.title.trim(),
          category: dto.category.trim(),
          summary: dto.summary?.trim() || null,
          body: dto.body,
          status: PolicyStatus.DRAFT,
          createdBy: user.id,
        },
      });

      await this.audit.record({
        organizationId: user.organizationId,
        actorId: user.id,
        action: 'policy.created',
        resourceType: 'PolicyDocument',
        resourceId: row.id,
        after: row,
      });

      return this.toPolicyDto(row);
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        throw new BadRequestException('Policy code already exists');
      }
      throw err;
    }
  }

  async updatePolicy(
    id: string,
    dto: UpdatePolicyDto,
    user: AuthUser,
  ): Promise<PolicyDocumentResponseDto> {
    const existing = await this.findPolicyOrThrow(id, user.organizationId);
    if (
      existing.status !== PolicyStatus.DRAFT &&
      existing.status !== PolicyStatus.REJECTED
    ) {
      throw new BadRequestException(
        'Only DRAFT or REJECTED policies can be edited',
      );
    }

    const updated = await this.prisma.policyDocument.update({
      where: { id },
      data: {
        ...(dto.title !== undefined ? { title: dto.title.trim() } : {}),
        ...(dto.category !== undefined
          ? { category: dto.category.trim() }
          : {}),
        ...(dto.summary !== undefined
          ? { summary: dto.summary?.trim() || null }
          : {}),
        ...(dto.body !== undefined ? { body: dto.body } : {}),
      },
    });

    await this.audit.record({
      organizationId: user.organizationId,
      actorId: user.id,
      action: 'policy.updated',
      resourceType: 'PolicyDocument',
      resourceId: id,
      before: existing,
      after: updated,
    });

    return this.toPolicyDto(updated);
  }

  async submitPolicy(
    id: string,
    user: AuthUser,
  ): Promise<PolicyDocumentResponseDto> {
    const existing = await this.findPolicyOrThrow(id, user.organizationId);
    if (
      existing.status !== PolicyStatus.DRAFT &&
      existing.status !== PolicyStatus.REJECTED
    ) {
      throw new BadRequestException(
        'Only DRAFT or REJECTED policies can be submitted',
      );
    }

    const approval = await this.approvals.start(
      {
        workflowCode: 'policy-change-approval',
        resourceType: 'PolicyDocument',
        resourceId: existing.id,
      },
      user,
    );

    const updated = await this.prisma.policyDocument.update({
      where: { id },
      data: {
        status: PolicyStatus.PENDING_APPROVAL,
        approvalInstanceId: approval.id,
      },
    });

    await this.audit.record({
      organizationId: user.organizationId,
      actorId: user.id,
      action: 'policy.submitted',
      resourceType: 'PolicyDocument',
      resourceId: id,
      after: updated,
    });

    return this.toPolicyDto(updated);
  }

  async approvePolicy(
    id: string,
    user: AuthUser,
  ): Promise<PolicyDocumentResponseDto> {
    const policy = await this.findPolicyOrThrow(id, user.organizationId);
    if (policy.status !== PolicyStatus.PENDING_APPROVAL) {
      throw new BadRequestException(
        'Only policies pending approval can be acted on',
      );
    }
    if (!policy.approvalInstanceId) {
      throw new BadRequestException('No approval instance');
    }

    const approval = await this.approvals.act(
      policy.approvalInstanceId,
      { decision: 'APPROVE' },
      user,
    );

    // Multi-step safe: publish only when workflow is fully APPROVED
    if (approval.status !== 'APPROVED') {
      await this.audit.record({
        organizationId: user.organizationId,
        actorId: user.id,
        action: 'policy.approval_step',
        resourceType: 'PolicyDocument',
        resourceId: id,
        after: {
          approvalStatus: approval.status,
          currentStepOrder: approval.currentStepOrder,
        },
      });
      return this.toPolicyDto(policy);
    }

    const updated = await this.prisma.policyDocument.update({
      where: { id },
      data: {
        status: PolicyStatus.PUBLISHED,
        publishedAt: new Date(),
        publishedBy: user.id,
      },
    });

    await this.audit.record({
      organizationId: user.organizationId,
      actorId: user.id,
      action: 'policy.published',
      resourceType: 'PolicyDocument',
      resourceId: id,
      after: updated,
    });

    return this.toPolicyDto(updated);
  }

  async rejectPolicy(
    id: string,
    dto: RejectPolicyDto,
    user: AuthUser,
  ): Promise<PolicyDocumentResponseDto> {
    const policy = await this.findPolicyOrThrow(id, user.organizationId);
    if (policy.status !== PolicyStatus.PENDING_APPROVAL) {
      throw new BadRequestException(
        'Only policies pending approval can be rejected',
      );
    }

    if (policy.approvalInstanceId) {
      await this.approvals.act(
        policy.approvalInstanceId,
        { decision: 'REJECT', remarks: dto.reason },
        user,
      );
    }

    const updated = await this.prisma.policyDocument.update({
      where: { id },
      data: { status: PolicyStatus.REJECTED },
    });

    await this.audit.record({
      organizationId: user.organizationId,
      actorId: user.id,
      action: 'policy.rejected',
      resourceType: 'PolicyDocument',
      resourceId: id,
      after: { ...updated, rejectedReason: dto.reason },
    });

    return this.toPolicyDto(updated);
  }

  async archivePolicy(
    id: string,
    user: AuthUser,
  ): Promise<PolicyDocumentResponseDto> {
    const policy = await this.findPolicyOrThrow(id, user.organizationId);
    if (policy.status !== PolicyStatus.PUBLISHED) {
      throw new BadRequestException('Only PUBLISHED policies can be archived');
    }

    const updated = await this.prisma.policyDocument.update({
      where: { id },
      data: { status: PolicyStatus.ARCHIVED },
    });

    await this.audit.record({
      organizationId: user.organizationId,
      actorId: user.id,
      action: 'policy.archived',
      resourceType: 'PolicyDocument',
      resourceId: id,
      after: updated,
    });

    return this.toPolicyDto(updated);
  }

  // ── Data breaches (DPO register — not ops SECURITY_BREACH) ─

  async listBreaches(
    organizationId: string,
  ): Promise<DataBreachCaseResponseDto[]> {
    const rows = await this.prisma.dataBreachCase.findMany({
      where: { organizationId },
      orderBy: { reportedAt: 'desc' },
    });
    return rows.map((r) => this.toBreachDto(r));
  }

  async getBreach(
    id: string,
    organizationId: string,
  ): Promise<DataBreachCaseResponseDto> {
    return this.toBreachDto(await this.findBreachOrThrow(id, organizationId));
  }

  async createBreach(
    dto: CreateBreachDto,
    user: AuthUser,
  ): Promise<DataBreachCaseResponseDto> {
    const referenceCode = await this.nextBreachRef(user.organizationId);

    const row = await this.prisma.dataBreachCase.create({
      data: {
        organizationId: user.organizationId,
        referenceCode,
        title: dto.title.trim(),
        description: dto.description,
        severity: dto.severity,
        status: BreachStatus.REPORTED,
        discoveredAt: new Date(dto.discoveredAt),
        affectedDataCategories: dto.affectedDataCategories?.trim() || null,
        estimatedRecords: dto.estimatedRecords ?? null,
        createdBy: user.id,
      },
    });

    await this.audit.record({
      organizationId: user.organizationId,
      actorId: user.id,
      action: 'breach.reported',
      resourceType: 'DataBreachCase',
      resourceId: row.id,
      after: row,
    });

    return this.toBreachDto(row);
  }

  async updateBreach(
    id: string,
    dto: UpdateBreachDto,
    user: AuthUser,
  ): Promise<DataBreachCaseResponseDto> {
    const existing = await this.findBreachOrThrow(id, user.organizationId);

    if (existing.status === BreachStatus.CLOSED) {
      throw new BadRequestException('Closed breach cases cannot be updated');
    }

    if (dto.status !== undefined && dto.status !== existing.status) {
      const expected = BREACH_NEXT[existing.status];
      if (!expected || dto.status !== expected) {
        throw new BadRequestException(
          `Invalid status transition: ${existing.status} → ${dto.status}. ` +
            `Allowed next: ${expected ?? 'none'}`,
        );
      }
    }

    const nextStatus = dto.status ?? existing.status;
    const closing = nextStatus === BreachStatus.CLOSED;
    if (
      closing &&
      existing.createdBy === user.id &&
      !user.roles.includes('SUPER_ADMIN')
    ) {
      throw new ForbiddenException(
        'Reporter cannot close their own breach case (creator ≠ closer)',
      );
    }

    const updated = await this.prisma.dataBreachCase.update({
      where: { id },
      data: {
        ...(dto.status !== undefined ? { status: dto.status } : {}),
        ...(dto.containmentNotes !== undefined
          ? { containmentNotes: dto.containmentNotes }
          : {}),
        ...(dto.affectedDataCategories !== undefined
          ? {
              affectedDataCategories:
                dto.affectedDataCategories?.trim() || null,
            }
          : {}),
        ...(dto.estimatedRecords !== undefined
          ? { estimatedRecords: dto.estimatedRecords }
          : {}),
        ...(dto.title !== undefined ? { title: dto.title.trim() } : {}),
        ...(dto.description !== undefined
          ? { description: dto.description }
          : {}),
        ...(dto.severity !== undefined ? { severity: dto.severity } : {}),
        ...(closing
          ? { closedAt: new Date(), closedBy: user.id }
          : {}),
      },
    });

    await this.audit.record({
      organizationId: user.organizationId,
      actorId: user.id,
      action: closing ? 'breach.closed' : 'breach.updated',
      resourceType: 'DataBreachCase',
      resourceId: id,
      before: existing,
      after: updated,
    });

    return this.toBreachDto(updated);
  }

  // ── Helpers ───────────────────────────────────────────────

  private async findPolicyOrThrow(id: string, organizationId: string) {
    const row = await this.prisma.policyDocument.findFirst({
      where: { id, organizationId },
    });
    if (!row) throw new NotFoundException('Policy not found');
    return row;
  }

  private async findBreachOrThrow(id: string, organizationId: string) {
    const row = await this.prisma.dataBreachCase.findFirst({
      where: { id, organizationId },
    });
    if (!row) throw new NotFoundException('Breach case not found');
    return row;
  }

  private async nextBreachRef(organizationId: string): Promise<string> {
    const last = await this.prisma.dataBreachCase.findFirst({
      where: { organizationId },
      orderBy: { referenceCode: 'desc' },
      select: { referenceCode: true },
    });
    const match = last?.referenceCode?.match(/(\d+)$/);
    const next = match ? Number(match[1]) + 1 : 1;
    return `BRCH-${String(Number.isFinite(next) ? next : 1).padStart(5, '0')}`;
  }

  private toPolicyDto(r: {
    id: string;
    organizationId: string;
    code: string;
    title: string;
    category: string;
    summary: string | null;
    body: string;
    version: number;
    status: PolicyStatus;
    approvalInstanceId: string | null;
    createdBy: string;
    publishedAt: Date | null;
    publishedBy: string | null;
    createdAt: Date;
    updatedAt: Date;
  }): PolicyDocumentResponseDto {
    return {
      id: r.id,
      organizationId: r.organizationId,
      code: r.code,
      title: r.title,
      category: r.category,
      summary: r.summary,
      body: r.body,
      version: r.version,
      status: r.status,
      approvalInstanceId: r.approvalInstanceId,
      createdBy: r.createdBy,
      publishedAt: r.publishedAt,
      publishedBy: r.publishedBy,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    };
  }

  private toBreachDto(r: {
    id: string;
    organizationId: string;
    referenceCode: string;
    title: string;
    description: string;
    severity: BreachSeverity;
    status: BreachStatus;
    discoveredAt: Date;
    reportedAt: Date;
    affectedDataCategories: string | null;
    estimatedRecords: number | null;
    containmentNotes: string | null;
    closedAt: Date | null;
    closedBy: string | null;
    createdBy: string;
    createdAt: Date;
    updatedAt: Date;
  }): DataBreachCaseResponseDto {
    return {
      id: r.id,
      organizationId: r.organizationId,
      referenceCode: r.referenceCode,
      title: r.title,
      description: r.description,
      severity: r.severity,
      status: r.status,
      discoveredAt: r.discoveredAt,
      reportedAt: r.reportedAt,
      affectedDataCategories: r.affectedDataCategories,
      estimatedRecords: r.estimatedRecords,
      containmentNotes: r.containmentNotes,
      closedAt: r.closedAt,
      closedBy: r.closedBy,
      createdBy: r.createdBy,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    };
  }
}
