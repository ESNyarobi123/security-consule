import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ApprovalStatus, ContractStatus } from '@prisma/client';
import { PrismaService, AuthUser } from '@pssms/shared';
import { AuditService } from '@pssms/audit';
import {
  ApprovalActionDto,
  ApprovalInstanceResponseDto,
  StartApprovalDto,
} from '../presentation/dto/approval.dto';

/** Resource types whose domain status is synced when the instance reaches a terminal state via raw Approvals API. */
const CONTRACT_RESOURCE = 'Contract';

type StepLike = {
  stepOrder: number;
  name: string;
  requiredRole: string;
  amountThreshold?: { toString(): string } | number | null;
};

@Injectable()
export class ApprovalsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /** Step applies when threshold is unset, or instance amount meets/exceeds it. */
  private stepApplies(
    step: StepLike,
    amount: { toString(): string } | number | null | undefined,
  ): boolean {
    if (step.amountThreshold == null) return true;
    return Number(amount ?? 0) >= Number(step.amountThreshold);
  }

  private firstApplicableStep(
    steps: StepLike[],
    amount: { toString(): string } | number | null | undefined,
  ): StepLike | undefined {
    return steps.find((s) => this.stepApplies(s, amount));
  }

  private nextApplicableStep(
    steps: StepLike[],
    afterOrder: number,
    amount: { toString(): string } | number | null | undefined,
  ): StepLike | undefined {
    return steps.find(
      (s) => s.stepOrder > afterOrder && this.stepApplies(s, amount),
    );
  }

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
    const first = this.firstApplicableStep(version.steps, dto.amount);
    if (!first) {
      throw new BadRequestException(
        'No applicable approval steps for this amount',
      );
    }

    const instance = await this.prisma.approvalInstance.create({
      data: {
        versionId: version.id,
        organizationId: user.organizationId,
        resourceType: dto.resourceType,
        resourceId: dto.resourceId,
        amount: dto.amount,
        createdBy: user.id,
        currentStepOrder: first.stepOrder,
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

    return this.toDto(instance, version.steps);
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

    // Governance: creator cannot approve own request (SUPER_ADMIN exception)
    if (
      instance.createdBy === user.id &&
      !user.roles.includes('SUPER_ADMIN')
    ) {
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
      const next = this.nextApplicableStep(
        instance.version.steps,
        instance.currentStepOrder,
        instance.amount,
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

    // Keep Contract in sync when raw POST /approvals/instances/:id/actions finishes the matrix
    // (domain route /contracts/:id/approve also updates — idempotent).
    if (
      instance.resourceType === CONTRACT_RESOURCE &&
      (status === ApprovalStatus.APPROVED || status === ApprovalStatus.REJECTED)
    ) {
      await this.syncContractOnTerminal(
        instance.organizationId,
        instance.resourceId,
        status,
        user.id,
      );
    }

    await this.audit.record({
      organizationId: user.organizationId,
      actorId: user.id,
      action: `approval.${dto.decision.toLowerCase()}`,
      resourceType: 'ApprovalInstance',
      resourceId: instance.id,
      before: instance,
      after: updated,
    });

    return this.toDto(updated, instance.version.steps);
  }

  /**
   * Thin sync so Contract does not stay PENDING_APPROVAL after the approval
   * instance is already APPROVED/REJECTED via the generic Approvals API.
   */
  private async syncContractOnTerminal(
    organizationId: string,
    contractId: string,
    approvalStatus: ApprovalStatus,
    actorId: string,
  ): Promise<void> {
    if (approvalStatus === ApprovalStatus.APPROVED) {
      const result = await this.prisma.contract.updateMany({
        where: {
          id: contractId,
          organizationId,
          status: ContractStatus.PENDING_APPROVAL,
        },
        data: {
          status: ContractStatus.APPROVED,
          version: { increment: 1 },
        },
      });
      if (result.count > 0) {
        await this.audit.record({
          organizationId,
          actorId,
          action: 'contract.approved',
          resourceType: CONTRACT_RESOURCE,
          resourceId: contractId,
          after: { status: ContractStatus.APPROVED, via: 'approvals.act' },
        });
      }
      return;
    }

    if (approvalStatus === ApprovalStatus.REJECTED) {
      const result = await this.prisma.contract.updateMany({
        where: {
          id: contractId,
          organizationId,
          status: ContractStatus.PENDING_APPROVAL,
        },
        data: {
          status: ContractStatus.DRAFT,
          approvalInstanceId: null,
          version: { increment: 1 },
        },
      });
      if (result.count > 0) {
        await this.audit.record({
          organizationId,
          actorId,
          action: 'contract.rejected',
          resourceType: CONTRACT_RESOURCE,
          resourceId: contractId,
          after: {
            status: ContractStatus.DRAFT,
            via: 'approvals.act',
          },
        });
      }
    }
  }

  async list(organizationId: string): Promise<ApprovalInstanceResponseDto[]> {
    const rows = await this.prisma.approvalInstance.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: {
        version: { include: { steps: { orderBy: { stepOrder: 'asc' } } } },
      },
    });
    return rows.map((r) => this.toDto(r, r.version.steps));
  }

  private toDto(
    i: {
      id: string;
      resourceType: string;
      resourceId: string;
      status: ApprovalStatus;
      currentStepOrder: number;
      createdBy: string;
      createdAt: Date;
    },
    steps?: StepLike[],
  ): ApprovalInstanceResponseDto {
    const current =
      i.status === ApprovalStatus.PENDING && steps
        ? steps.find((s) => s.stepOrder === i.currentStepOrder)
        : undefined;
    return {
      id: i.id,
      resourceType: i.resourceType,
      resourceId: i.resourceId,
      status: i.status,
      currentStepOrder: i.currentStepOrder,
      createdBy: i.createdBy,
      createdAt: i.createdAt,
      currentStepName: current?.name ?? null,
      requiredRole: current?.requiredRole ?? null,
    };
  }
}
