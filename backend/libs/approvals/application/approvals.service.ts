import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ApprovalStatus } from '@prisma/client';
import { PrismaService, AuthUser } from '@pssms/shared';
import { AuditService } from '@pssms/audit';
import {
  ApprovalActionDto,
  ApprovalInstanceResponseDto,
  StartApprovalDto,
} from '../presentation/dto/approval.dto';

@Injectable()
export class ApprovalsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async start(
    dto: StartApprovalDto,
    user: AuthUser,
  ): Promise<ApprovalInstanceResponseDto> {
    const definition = await this.prisma.workflowDefinition.findFirst({
      where: {
        organizationId: user.organizationId,
        code: dto.workflowCode,
        isActive: true,
      },
      include: {
        versions: {
          where: { isCurrent: true },
          include: { steps: { orderBy: { stepOrder: 'asc' } } },
        },
      },
    });
    if (!definition || definition.versions.length === 0) {
      throw new NotFoundException('Workflow definition not found');
    }

    const version = definition.versions[0];
    const instance = await this.prisma.approvalInstance.create({
      data: {
        versionId: version.id,
        organizationId: user.organizationId,
        resourceType: dto.resourceType,
        resourceId: dto.resourceId,
        amount: dto.amount,
        createdBy: user.id,
        currentStepOrder: version.steps[0]?.stepOrder ?? 1,
      },
    });

    await this.audit.record({
      organizationId: user.organizationId,
      actorId: user.id,
      action: 'approval.started',
      resourceType: 'ApprovalInstance',
      resourceId: instance.id,
      after: instance,
    });

    return this.toDto(instance);
  }

  async act(
    instanceId: string,
    dto: ApprovalActionDto,
    user: AuthUser,
  ): Promise<ApprovalInstanceResponseDto> {
    const instance = await this.prisma.approvalInstance.findFirst({
      where: { id: instanceId, organizationId: user.organizationId },
      include: {
        version: { include: { steps: { orderBy: { stepOrder: 'asc' } } } },
        actions: true,
      },
    });
    if (!instance) throw new NotFoundException('Approval instance not found');
    if (instance.status !== ApprovalStatus.PENDING) {
      throw new BadRequestException('Approval is not pending');
    }

    // Governance: creator cannot approve own request
    if (instance.createdBy === user.id) {
      throw new ForbiddenException({
        error: 'CREATOR_CANNOT_APPROVE',
        message: 'Creator cannot approve or reject their own request',
      });
    }

    const step = instance.version.steps.find(
      (s) => s.stepOrder === instance.currentStepOrder,
    );
    if (!step) throw new BadRequestException('Workflow step missing');

    if (
      step.requiredRole !== '*' &&
      !user.roles.includes(step.requiredRole) &&
      !user.roles.includes('SUPER_ADMIN')
    ) {
      throw new ForbiddenException({
        error: 'FORBIDDEN',
        message: `Role ${step.requiredRole} required for this step`,
      });
    }

    await this.prisma.approvalAction.create({
      data: {
        instanceId: instance.id,
        stepOrder: instance.currentStepOrder,
        actorId: user.id,
        decision: dto.decision,
        remarks: dto.remarks,
      },
    });

    let status: ApprovalStatus = instance.status;
    let currentStepOrder = instance.currentStepOrder;

    if (dto.decision === 'REJECT') {
      status = ApprovalStatus.REJECTED;
    } else {
      const next = instance.version.steps.find(
        (s) => s.stepOrder > instance.currentStepOrder,
      );
      if (next) {
        currentStepOrder = next.stepOrder;
      } else {
        status = ApprovalStatus.APPROVED;
      }
    }

    const updated = await this.prisma.approvalInstance.update({
      where: { id: instance.id },
      data: { status, currentStepOrder },
    });

    await this.audit.record({
      organizationId: user.organizationId,
      actorId: user.id,
      action: `approval.${dto.decision.toLowerCase()}`,
      resourceType: 'ApprovalInstance',
      resourceId: instance.id,
      before: instance,
      after: updated,
    });

    return this.toDto(updated);
  }

  async list(organizationId: string): Promise<ApprovalInstanceResponseDto[]> {
    const rows = await this.prisma.approvalInstance.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return rows.map((r) => this.toDto(r));
  }

  private toDto(i: {
    id: string;
    resourceType: string;
    resourceId: string;
    status: ApprovalStatus;
    currentStepOrder: number;
    createdBy: string;
    createdAt: Date;
  }): ApprovalInstanceResponseDto {
    return {
      id: i.id,
      resourceType: i.resourceType,
      resourceId: i.resourceId,
      status: i.status,
      currentStepOrder: i.currentStepOrder,
      createdBy: i.createdBy,
      createdAt: i.createdAt,
    };
  }
}
