import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ApprovalStatus,
  ContractStatus,
  DeploymentStatus,
  EmployeeStatus,
  GuardStatus,
  IamChangeRequestStatus,
  LeaveRequestStatus,
  MovementStatus,
  MovementType,
  PayrollCycleStatus,
  PurchaseRequestStatus,
} from '@prisma/client';
import { PrismaService, AuthUser } from '@pssms/shared';
import { AuditService } from '@pssms/audit';
import {
  ApprovalActionDto,
  ApprovalInstanceResponseDto,
  StartApprovalDto,
  WorkflowCatalogDto,
} from '../presentation/dto/approval.dto';

/** Resource types whose domain status is synced when the instance reaches a terminal state via raw Approvals API. */
const CONTRACT_RESOURCE = 'Contract';
const LEAVE_RESOURCE = 'LeaveRequest';
const IAM_CHANGE_RESOURCE = 'IamChangeRequest';
const PAYROLL_RESOURCE = 'PayrollCycle';
const PURCHASE_REQUEST_RESOURCE = 'PurchaseRequest';
const MOVEMENT_RESOURCE = 'EmployeeMovement';

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

    // Keep domain rows in sync when raw POST /approvals/instances/:id/actions
    // finishes the matrix (domain approve routes also update — idempotent).
    if (
      status === ApprovalStatus.APPROVED ||
      status === ApprovalStatus.REJECTED
    ) {
      if (instance.resourceType === CONTRACT_RESOURCE) {
        await this.syncContractOnTerminal(
          instance.organizationId,
          instance.resourceId,
          status,
          user.id,
        );
      } else if (instance.resourceType === LEAVE_RESOURCE) {
        await this.syncLeaveOnTerminal(
          instance.organizationId,
          instance.resourceId,
          status,
          user.id,
          dto.remarks,
        );
      } else if (instance.resourceType === IAM_CHANGE_RESOURCE) {
        await this.syncIamChangeOnTerminal(
          instance.organizationId,
          instance.resourceId,
          status,
          user.id,
          dto.remarks,
        );
      } else if (instance.resourceType === PAYROLL_RESOURCE) {
        await this.syncPayrollOnTerminal(
          instance.organizationId,
          instance.resourceId,
          status,
          user.id,
        );
      } else if (instance.resourceType === PURCHASE_REQUEST_RESOURCE) {
        await this.syncPurchaseRequestOnTerminal(
          instance.organizationId,
          instance.resourceId,
          status,
          user.id,
        );
      } else if (instance.resourceType === MOVEMENT_RESOURCE) {
        await this.syncEmployeeMovementOnTerminal(
          instance.organizationId,
          instance.resourceId,
          status,
          user.id,
          dto.remarks,
        );
      }
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
   * M5-E — apply proposed roles (or reject) when IAM change completes via
   * generic POST /approvals/instances/:id/actions.
   */
  private async syncIamChangeOnTerminal(
    organizationId: string,
    requestId: string,
    approvalStatus: ApprovalStatus,
    actorId: string,
    remarks?: string,
  ): Promise<void> {
    const request = await this.prisma.iamChangeRequest.findFirst({
      where: {
        id: requestId,
        organizationId,
        status: IamChangeRequestStatus.PENDING,
      },
    });
    if (!request) return;

    if (approvalStatus === ApprovalStatus.APPROVED) {
      if (request.changeType === 'SUSPEND') {
        const target = await this.prisma.user.findFirst({
          where: { id: request.targetUserId, organizationId },
          select: { id: true, isActive: true },
        });
        if (!target || !target.isActive) {
          await this.prisma.iamChangeRequest.update({
            where: { id: request.id },
            data: {
              status: IamChangeRequestStatus.CANCELLED,
              decidedBy: actorId,
              decidedAt: new Date(),
              rejectReason:
                'STALE_SUSPEND — user already inactive or missing at approve',
            },
          });
          await this.audit.record({
            organizationId,
            actorId,
            action: 'IDENTITY_SUSPEND_STALE',
            resourceType: IAM_CHANGE_RESOURCE,
            resourceId: requestId,
            after: { via: 'approvals.act' },
          });
          return;
        }
        await this.prisma.$transaction([
          this.prisma.user.update({
            where: { id: request.targetUserId },
            data: {
              isActive: false,
              suspendedAt: new Date(),
              suspendedReason: request.reason ?? null,
            },
          }),
          this.prisma.iamChangeRequest.update({
            where: { id: request.id },
            data: {
              status: IamChangeRequestStatus.APPROVED,
              decidedBy: actorId,
              decidedAt: new Date(),
            },
          }),
        ]);
        await this.audit.record({
          organizationId,
          actorId,
          action: 'IDENTITY_SUSPEND_APPROVED',
          resourceType: IAM_CHANGE_RESOURCE,
          resourceId: requestId,
          after: {
            targetUserId: request.targetUserId,
            reason: request.reason,
            via: 'approvals.act',
          },
        });
        await this.audit.record({
          organizationId,
          actorId,
          action: 'IDENTITY_USER_SUSPENDED',
          resourceType: 'User',
          resourceId: request.targetUserId,
          after: { reason: request.reason, mode: 'approval' },
        });
        return;
      }

      if (request.changeType === 'REACTIVATE') {
        const target = await this.prisma.user.findFirst({
          where: { id: request.targetUserId, organizationId },
          select: { id: true, isActive: true },
        });
        if (!target || target.isActive) {
          await this.prisma.iamChangeRequest.update({
            where: { id: request.id },
            data: {
              status: IamChangeRequestStatus.CANCELLED,
              decidedBy: actorId,
              decidedAt: new Date(),
              rejectReason:
                'STALE_REACTIVATE — user already active or missing at approve',
            },
          });
          await this.audit.record({
            organizationId,
            actorId,
            action: 'IDENTITY_REACTIVATE_STALE',
            resourceType: IAM_CHANGE_RESOURCE,
            resourceId: requestId,
            after: { via: 'approvals.act' },
          });
          return;
        }
        await this.prisma.$transaction([
          this.prisma.user.update({
            where: { id: request.targetUserId },
            data: {
              isActive: true,
              suspendedAt: null,
              suspendedReason: null,
            },
          }),
          this.prisma.iamChangeRequest.update({
            where: { id: request.id },
            data: {
              status: IamChangeRequestStatus.APPROVED,
              decidedBy: actorId,
              decidedAt: new Date(),
            },
          }),
        ]);
        await this.audit.record({
          organizationId,
          actorId,
          action: 'IDENTITY_REACTIVATE_APPROVED',
          resourceType: IAM_CHANGE_RESOURCE,
          resourceId: requestId,
          after: {
            targetUserId: request.targetUserId,
            reason: request.reason,
            via: 'approvals.act',
          },
        });
        await this.audit.record({
          organizationId,
          actorId,
          action: 'IDENTITY_USER_REACTIVATED',
          resourceType: 'User',
          resourceId: request.targetUserId,
          after: { mode: 'approval', via: 'approvals.act' },
        });
        return;
      }

      const live = await this.prisma.userRole.findMany({
        where: { userId: request.targetUserId },
        include: { role: { select: { code: true } } },
      });
      const liveCodes = live.map((r) => r.role.code).sort();
      const expected = [...request.previousRoleCodes].sort();
      const stale =
        liveCodes.length !== expected.length ||
        liveCodes.some((c, i) => c !== expected[i]);
      if (stale) {
        await this.prisma.iamChangeRequest.update({
          where: { id: request.id },
          data: {
            status: IamChangeRequestStatus.CANCELLED,
            decidedBy: actorId,
            decidedAt: new Date(),
            rejectReason:
              'STALE_ROLE_CHANGE — live roles no longer match snapshot at submit',
          },
        });
        await this.audit.record({
          organizationId,
          actorId,
          action: 'IDENTITY_ROLE_CHANGE_STALE',
          resourceType: IAM_CHANGE_RESOURCE,
          resourceId: requestId,
          after: {
            liveCodes,
            previousRoleCodes: request.previousRoleCodes,
            via: 'approvals.act',
          },
        });
        return;
      }

      // Re-check party bindings at terminal approval. This also cancels legacy
      // pending requests created before IAM submission validation was hardened.
      const target = await this.prisma.user.findFirst({
        where: { id: request.targetUserId, organizationId },
        select: {
          id: true,
          customerId: true,
          supplierId: true,
          b2bPartnerId: true,
        },
      });
      const proposed = request.proposedRoleCodes;
      let bindingError: string | null = null;
      if (!target) {
        bindingError = 'TARGET_USER_MISSING';
      } else if (
        (proposed.includes('CUSTOMER_PORTAL') ||
          proposed.includes('CUSTOMER_EMPLOYEE')) &&
        !target.customerId
      ) {
        bindingError = 'CUSTOMER_ROLE_REQUIRES_CUSTOMER';
      } else if (
        proposed.includes('SUPPLIER_PORTAL') &&
        !target.supplierId
      ) {
        bindingError = 'SUPPLIER_PORTAL_REQUIRES_SUPPLIER';
      } else if (
        proposed.includes('OTHER_SECURITY_COMPANY') &&
        !target.b2bPartnerId
      ) {
        bindingError = 'OTHER_SECURITY_REQUIRES_PARTNER';
      }
      if (bindingError) {
        await this.prisma.iamChangeRequest.update({
          where: { id: request.id },
          data: {
            status: IamChangeRequestStatus.CANCELLED,
            decidedBy: actorId,
            decidedAt: new Date(),
            rejectReason: `${bindingError} — party binding missing at approve`,
          },
        });
        await this.audit.record({
          organizationId,
          actorId,
          action: 'IDENTITY_ROLE_CHANGE_BINDING_INVALID',
          resourceType: IAM_CHANGE_RESOURCE,
          resourceId: requestId,
          after: {
            targetUserId: request.targetUserId,
            proposedRoleCodes: proposed,
            bindingError,
            via: 'approvals.act',
          },
        });
        return;
      }

      const roles = await this.prisma.role.findMany({
        where: {
          organizationId,
          code: { in: request.proposedRoleCodes },
        },
      });
      if (roles.length !== request.proposedRoleCodes.length) {
        await this.prisma.iamChangeRequest.update({
          where: { id: request.id },
          data: {
            status: IamChangeRequestStatus.CANCELLED,
            decidedBy: actorId,
            decidedAt: new Date(),
            rejectReason: 'Proposed roles no longer exist in organization',
          },
        });
        return;
      }

      await this.prisma.$transaction([
        this.prisma.userRole.deleteMany({
          where: { userId: request.targetUserId },
        }),
        this.prisma.userRole.createMany({
          data: roles.map((r) => ({
            userId: request.targetUserId,
            roleId: r.id,
          })),
        }),
        this.prisma.iamChangeRequest.update({
          where: { id: request.id },
          data: {
            status: IamChangeRequestStatus.APPROVED,
            decidedBy: actorId,
            decidedAt: new Date(),
          },
        }),
      ]);
      await this.audit.record({
        organizationId,
        actorId,
        action: 'IDENTITY_ROLE_CHANGE_APPROVED',
        resourceType: IAM_CHANGE_RESOURCE,
        resourceId: requestId,
        after: {
          targetUserId: request.targetUserId,
          proposedRoleCodes: request.proposedRoleCodes,
          via: 'approvals.act',
        },
      });
      await this.audit.record({
        organizationId,
        actorId,
        action: 'IDENTITY_USER_ROLES_CHANGED',
        resourceType: 'User',
        resourceId: request.targetUserId,
        before: { roles: request.previousRoleCodes },
        after: { roles: request.proposedRoleCodes, mode: 'approval' },
      });
      return;
    }

    if (approvalStatus === ApprovalStatus.REJECTED) {
      await this.prisma.iamChangeRequest.update({
        where: { id: request.id },
        data: {
          status: IamChangeRequestStatus.REJECTED,
          decidedBy: actorId,
          decidedAt: new Date(),
          rejectReason: remarks?.trim() || 'Rejected via approvals queue',
        },
      });
      await this.audit.record({
        organizationId,
        actorId,
        action:
          request.changeType === 'SUSPEND'
            ? 'IDENTITY_SUSPEND_REJECTED'
            : request.changeType === 'REACTIVATE'
              ? 'IDENTITY_REACTIVATE_REJECTED'
              : 'IDENTITY_ROLE_CHANGE_REJECTED',
        resourceType: IAM_CHANGE_RESOURCE,
        resourceId: requestId,
        after: { via: 'approvals.act', changeType: request.changeType },
      });
    }
  }

  /**
   * Thin sync so LeaveRequest does not stay PENDING after the approval
   * instance is already APPROVED/REJECTED via the generic Approvals API.
   */
  private async syncLeaveOnTerminal(
    organizationId: string,
    leaveRequestId: string,
    approvalStatus: ApprovalStatus,
    actorId: string,
    remarks?: string,
  ): Promise<void> {
    if (approvalStatus === ApprovalStatus.APPROVED) {
      const result = await this.prisma.leaveRequest.updateMany({
        where: {
          id: leaveRequestId,
          organizationId,
          status: LeaveRequestStatus.PENDING,
        },
        data: {
          status: LeaveRequestStatus.APPROVED,
          approvedBy: actorId,
          approvedAt: new Date(),
        },
      });
      if (result.count > 0) {
        await this.audit.record({
          organizationId,
          actorId,
          action: 'leave.approved',
          resourceType: LEAVE_RESOURCE,
          resourceId: leaveRequestId,
          after: { status: LeaveRequestStatus.APPROVED, via: 'approvals.act' },
        });
      }
      return;
    }

    if (approvalStatus === ApprovalStatus.REJECTED) {
      const result = await this.prisma.leaveRequest.updateMany({
        where: {
          id: leaveRequestId,
          organizationId,
          status: LeaveRequestStatus.PENDING,
        },
        data: {
          status: LeaveRequestStatus.REJECTED,
          rejectedReason: remarks?.trim() || 'Rejected via approvals queue',
        },
      });
      if (result.count > 0) {
        await this.audit.record({
          organizationId,
          actorId,
          action: 'leave.rejected',
          resourceType: LEAVE_RESOURCE,
          resourceId: leaveRequestId,
          after: {
            status: LeaveRequestStatus.REJECTED,
            via: 'approvals.act',
          },
        });
      }
    }
  }

  /**
   * Keep EmployeeMovement + employment/guard side-effects in sync when the
   * instance finishes via generic POST /approvals/instances/:id/actions
   * (same outcome as POST /hr/movements/:id/approve|reject).
   */
  private async syncEmployeeMovementOnTerminal(
    organizationId: string,
    movementId: string,
    approvalStatus: ApprovalStatus,
    actorId: string,
    remarks?: string,
  ): Promise<void> {
    const movement = await this.prisma.employeeMovement.findFirst({
      where: {
        id: movementId,
        organizationId,
        status: MovementStatus.PENDING,
      },
    });
    if (!movement) return;

    if (approvalStatus === ApprovalStatus.REJECTED) {
      await this.prisma.employeeMovement.update({
        where: { id: movement.id },
        data: {
          status: MovementStatus.REJECTED,
          rejectedReason: remarks?.trim() || 'Rejected via approvals queue',
        },
      });
      await this.audit.record({
        organizationId,
        actorId,
        action: 'movement.rejected',
        resourceType: MOVEMENT_RESOURCE,
        resourceId: movement.id,
        after: { status: MovementStatus.REJECTED, via: 'approvals.act' },
      });
      return;
    }

    if (approvalStatus !== ApprovalStatus.APPROVED) return;

    await this.prisma.$transaction(async (tx) => {
      await tx.employeeMovement.update({
        where: { id: movement.id },
        data: {
          status: MovementStatus.APPROVED,
          approvedBy: actorId,
          approvedAt: new Date(),
        },
      });

      if (
        movement.type === MovementType.EXIT ||
        movement.type === MovementType.REDUNDANCY
      ) {
        const employee = await tx.employee.update({
          where: { id: movement.employeeId },
          data: { status: EmployeeStatus.TERMINATED },
        });
        if (employee.guardProfileId) {
          await tx.guardProfile.update({
            where: { id: employee.guardProfileId },
            data: {
              status: GuardStatus.TERMINATED,
              deploymentEligible: false,
            },
          });
          const active = await tx.guardDeployment.findMany({
            where: {
              organizationId,
              guardId: employee.guardProfileId,
              status: DeploymentStatus.ACTIVE,
            },
          });
          const today = new Date();
          today.setUTCHours(0, 0, 0, 0);
          for (const row of active) {
            await tx.guardDeployment.update({
              where: { id: row.id },
              data: {
                status: DeploymentStatus.ENDED,
                endDate: row.endDate ?? today,
              },
            });
          }
        }
      } else if (
        (movement.type === MovementType.TRANSFER ||
          movement.type === MovementType.PROMOTION) &&
        movement.toDepartment
      ) {
        await tx.employee.update({
          where: { id: movement.employeeId },
          data: { department: movement.toDepartment },
        });
      }
    });

    await this.audit.record({
      organizationId,
      actorId,
      action: 'movement.approved',
      resourceType: MOVEMENT_RESOURCE,
      resourceId: movement.id,
      after: {
        status: MovementStatus.APPROVED,
        type: movement.type,
        via: 'approvals.act',
      },
    });
  }

  /** Sync PayrollCycle when approval completes via /approvals queue. */
  private async syncPayrollOnTerminal(
    organizationId: string,
    cycleId: string,
    approvalStatus: ApprovalStatus,
    actorId: string,
  ): Promise<void> {
    if (approvalStatus === ApprovalStatus.APPROVED) {
      const result = await this.prisma.payrollCycle.updateMany({
        where: {
          id: cycleId,
          organizationId,
          status: PayrollCycleStatus.PENDING_APPROVAL,
        },
        data: {
          status: PayrollCycleStatus.APPROVED,
          approvedBy: actorId,
        },
      });
      if (result.count > 0) {
        await this.audit.record({
          organizationId,
          actorId,
          action: 'payroll.approved',
          resourceType: PAYROLL_RESOURCE,
          resourceId: cycleId,
          after: { status: PayrollCycleStatus.APPROVED, via: 'approvals.act' },
        });
      }
      return;
    }

    if (approvalStatus === ApprovalStatus.REJECTED) {
      const result = await this.prisma.payrollCycle.updateMany({
        where: {
          id: cycleId,
          organizationId,
          status: PayrollCycleStatus.PENDING_APPROVAL,
        },
        data: {
          status: PayrollCycleStatus.CALCULATED,
          approvalInstanceId: null,
        },
      });
      if (result.count > 0) {
        await this.audit.record({
          organizationId,
          actorId,
          action: 'payroll.approval_rejected',
          resourceType: PAYROLL_RESOURCE,
          resourceId: cycleId,
          after: { status: PayrollCycleStatus.CALCULATED, via: 'approvals.act' },
        });
      }
    }
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

  private async syncPurchaseRequestOnTerminal(
    organizationId: string,
    requestId: string,
    approvalStatus: ApprovalStatus,
    actorId: string,
  ): Promise<void> {
    if (approvalStatus === ApprovalStatus.APPROVED) {
      const result = await this.prisma.purchaseRequest.updateMany({
        where: {
          id: requestId,
          organizationId,
          status: PurchaseRequestStatus.PENDING_APPROVAL,
        },
        data: { status: PurchaseRequestStatus.APPROVED },
      });
      if (result.count > 0) {
        await this.audit.record({
          organizationId,
          actorId,
          action: 'purchase_request.approved',
          resourceType: PURCHASE_REQUEST_RESOURCE,
          resourceId: requestId,
          after: { status: PurchaseRequestStatus.APPROVED, via: 'approvals.act' },
        });
      }
      return;
    }
    if (approvalStatus === ApprovalStatus.REJECTED) {
      const result = await this.prisma.purchaseRequest.updateMany({
        where: {
          id: requestId,
          organizationId,
          status: PurchaseRequestStatus.PENDING_APPROVAL,
        },
        data: { status: PurchaseRequestStatus.REJECTED },
      });
      if (result.count > 0) {
        await this.audit.record({
          organizationId,
          actorId,
          action: 'purchase_request.rejected',
          resourceType: PURCHASE_REQUEST_RESOURCE,
          resourceId: requestId,
          after: { status: PurchaseRequestStatus.REJECTED, via: 'approvals.act' },
        });
      }
    }
  }

  async listWorkflows(organizationId: string): Promise<WorkflowCatalogDto[]> {
    const rows = await this.prisma.workflowDefinition.findMany({
      where: { organizationId },
      include: {
        versions: {
          where: { isCurrent: true },
          include: { steps: { orderBy: { stepOrder: 'asc' } } },
        },
      },
      orderBy: { code: 'asc' },
    });
    return rows.map((def) => {
      const version = def.versions[0];
      return {
        id: def.id,
        code: def.code,
        name: def.name,
        description: def.description,
        isActive: def.isActive,
        version: version?.version ?? 0,
        steps: (version?.steps ?? []).map((s) => ({
          stepOrder: s.stepOrder,
          name: s.name,
          requiredRole: s.requiredRole,
          minApprovers: s.minApprovers,
          amountThreshold:
            s.amountThreshold == null ? null : Number(s.amountThreshold),
        })),
      };
    });
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
