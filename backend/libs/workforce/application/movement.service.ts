import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  EmployeeStatus,
  GuardStatus,
  MovementStatus,
  MovementType,
} from '@prisma/client';
import { PrismaService, AuthUser } from '@pssms/shared';
import { AuditService } from '@pssms/audit';
import { ApprovalsService } from '@pssms/approvals';
import { DeploymentsService } from '@pssms/operations';
import { EmployeesService } from './employees.service';
import {
  CreateEmployeeMovementDto,
  EmployeeMovementResponseDto,
  RejectEmployeeMovementDto,
} from '../presentation/dto/movement.dto';

@Injectable()
export class MovementService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly approvals: ApprovalsService,
    private readonly employees: EmployeesService,
    private readonly deployments: DeploymentsService,
  ) {}

  async create(
    dto: CreateEmployeeMovementDto,
    user: AuthUser,
  ): Promise<EmployeeMovementResponseDto> {
    const employee = await this.employees.getById(
      dto.employeeId,
      user.organizationId,
    );

    if (dto.type === MovementType.TRANSFER && !dto.toDepartment?.trim()) {
      throw new BadRequestException('toDepartment is required for TRANSFER');
    }

    if (employee.status === EmployeeStatus.TERMINATED) {
      throw new BadRequestException('Cannot move a terminated employee');
    }

    const pending = await this.prisma.employeeMovement.findFirst({
      where: {
        employeeId: dto.employeeId,
        organizationId: user.organizationId,
        status: MovementStatus.PENDING,
      },
    });
    if (pending) {
      throw new BadRequestException(
        'Employee already has a pending transfer/exit request',
      );
    }

    const workflowCode =
      dto.type === MovementType.EXIT
        ? 'employee-exit-approval'
        : 'employee-transfer-approval';

    const movement = await this.prisma.employeeMovement.create({
      data: {
        organizationId: user.organizationId,
        employeeId: dto.employeeId,
        type: dto.type,
        fromDepartment: dto.fromDepartment ?? employee.department,
        toDepartment: dto.toDepartment,
        effectiveDate: new Date(dto.effectiveDate),
        reason: dto.reason,
        createdBy: user.id,
      },
    });

    const approval = await this.approvals.start(
      {
        workflowCode,
        resourceType: 'EmployeeMovement',
        resourceId: movement.id,
      },
      user,
    );

    const updated = await this.prisma.employeeMovement.update({
      where: { id: movement.id },
      data: { approvalInstanceId: approval.id },
    });

    await this.audit.record({
      organizationId: user.organizationId,
      actorId: user.id,
      action: 'movement.created',
      resourceType: 'EmployeeMovement',
      resourceId: movement.id,
      after: updated,
    });

    return this.toDto(updated);
  }

  async approve(
    id: string,
    user: AuthUser,
  ): Promise<EmployeeMovementResponseDto> {
    const movement = await this.findPendingOrThrow(id, user.organizationId);
    this.assertNotCreator(movement.createdBy, user);
    if (!movement.approvalInstanceId) {
      throw new BadRequestException('No approval instance');
    }

    const approval = await this.approvals.act(
      movement.approvalInstanceId,
      { decision: 'APPROVE' },
      user,
    );

    if (approval.status !== 'APPROVED') {
      await this.audit.record({
        organizationId: user.organizationId,
        actorId: user.id,
        action: 'movement.approval_step',
        resourceType: 'EmployeeMovement',
        resourceId: id,
        after: {
          approvalStatus: approval.status,
          currentStepOrder: approval.currentStepOrder,
        },
      });
      return this.toDto(movement);
    }

    const { row: updated, deploymentsEnded } =
      await this.prisma.$transaction(async (tx) => {
        const row = await tx.employeeMovement.update({
          where: { id },
          data: {
            status: MovementStatus.APPROVED,
            approvedBy: user.id,
            approvedAt: new Date(),
          },
        });

        let deploymentsEnded: string[] = [];

        if (row.type === MovementType.EXIT) {
          const employee = await tx.employee.update({
            where: { id: row.employeeId },
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
            // Same transaction as TERMINATED — avoids orphan ACTIVE deployments
            const result = await this.deployments.endAllActiveForGuard(
              employee.guardProfileId,
              user,
              { reason: 'employee.exit', sourceMovementId: row.id },
              tx,
            );
            deploymentsEnded = result.endedIds;
          }
        } else if (row.type === MovementType.TRANSFER && row.toDepartment) {
          await tx.employee.update({
            where: { id: row.employeeId },
            data: { department: row.toDepartment },
          });
        }

        return { row, deploymentsEnded };
      });

    await this.audit.record({
      organizationId: user.organizationId,
      actorId: user.id,
      action: 'movement.approved',
      resourceType: 'EmployeeMovement',
      resourceId: id,
      after: { ...updated, deploymentsEnded },
    });

    return this.toDto(updated);
  }

  async reject(
    id: string,
    dto: RejectEmployeeMovementDto,
    user: AuthUser,
  ): Promise<EmployeeMovementResponseDto> {
    const movement = await this.findPendingOrThrow(id, user.organizationId);
    this.assertNotCreator(movement.createdBy, user);

    if (movement.approvalInstanceId) {
      await this.approvals.act(
        movement.approvalInstanceId,
        { decision: 'REJECT', remarks: dto.reason },
        user,
      );
    }

    const updated = await this.prisma.employeeMovement.update({
      where: { id },
      data: {
        status: MovementStatus.REJECTED,
        rejectedReason: dto.reason,
      },
    });

    await this.audit.record({
      organizationId: user.organizationId,
      actorId: user.id,
      action: 'movement.rejected',
      resourceType: 'EmployeeMovement',
      resourceId: id,
      after: updated,
    });

    return this.toDto(updated);
  }

  async list(
    organizationId: string,
    employeeId?: string,
  ): Promise<EmployeeMovementResponseDto[]> {
    const rows = await this.prisma.employeeMovement.findMany({
      where: {
        organizationId,
        ...(employeeId ? { employeeId } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return rows.map((r) => this.toDto(r));
  }

  private async findPendingOrThrow(id: string, organizationId: string) {
    const row = await this.prisma.employeeMovement.findFirst({
      where: { id, organizationId },
    });
    if (!row) throw new NotFoundException('Employee movement not found');
    if (row.status !== MovementStatus.PENDING) {
      throw new BadRequestException('Only pending movements can be acted on');
    }
    return row;
  }

  private assertNotCreator(createdBy: string | null, user: AuthUser) {
    if (
      createdBy &&
      createdBy === user.id &&
      !user.roles.includes('SUPER_ADMIN')
    ) {
      throw new ForbiddenException({
        error: 'CREATOR_CANNOT_APPROVE',
        message: 'Creator cannot approve or reject their own request',
      });
    }
  }

  private toDto(r: {
    id: string;
    organizationId: string;
    employeeId: string;
    type: MovementType;
    fromDepartment: string | null;
    toDepartment: string | null;
    effectiveDate: Date;
    reason: string;
    status: MovementStatus;
    approvalInstanceId: string | null;
    createdBy: string | null;
    approvedBy: string | null;
    approvedAt: Date | null;
    rejectedReason: string | null;
    createdAt: Date;
  }): EmployeeMovementResponseDto {
    return {
      id: r.id,
      organizationId: r.organizationId,
      employeeId: r.employeeId,
      type: r.type,
      fromDepartment: r.fromDepartment,
      toDepartment: r.toDepartment,
      effectiveDate: r.effectiveDate,
      reason: r.reason,
      status: r.status,
      approvalInstanceId: r.approvalInstanceId,
      createdBy: r.createdBy,
      approvedBy: r.approvedBy,
      approvedAt: r.approvedAt,
      rejectedReason: r.rejectedReason,
      createdAt: r.createdAt,
    };
  }
}
