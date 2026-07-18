import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { LeaveRequestStatus } from '@prisma/client';
import { PrismaService, AuthUser } from '@pssms/shared';
import { AuditService } from '@pssms/audit';
import { ApprovalsService } from '@pssms/approvals';
import { EmployeesService } from './employees.service';
import {
  CreateLeaveRequestDto,
  CreateLeaveTypeDto,
  LeaveRequestResponseDto,
  LeaveTypeResponseDto,
} from '../presentation/dto/leave.dto';

@Injectable()
export class LeaveService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly approvals: ApprovalsService,
    private readonly employees: EmployeesService,
  ) {}

  async createLeaveType(
    dto: CreateLeaveTypeDto,
    user: AuthUser,
  ): Promise<LeaveTypeResponseDto> {
    const row = await this.prisma.leaveType.create({
      data: {
        organizationId: user.organizationId,
        code: dto.code,
        name: dto.name,
        annualQuotaDays: dto.annualQuotaDays ?? 21,
      },
    });
    await this.audit.record({
      organizationId: user.organizationId,
      actorId: user.id,
      action: 'leave_type.created',
      resourceType: 'LeaveType',
      resourceId: row.id,
      after: row,
    });
    return this.toTypeDto(row);
  }

  async listLeaveTypes(organizationId: string): Promise<LeaveTypeResponseDto[]> {
    const rows = await this.prisma.leaveType.findMany({
      where: { organizationId, isActive: true },
      orderBy: { name: 'asc' },
    });
    return rows.map((r) => this.toTypeDto(r));
  }

  async applyLeave(
    dto: CreateLeaveRequestDto,
    user: AuthUser,
  ): Promise<LeaveRequestResponseDto> {
    await this.employees.getById(dto.employeeId, user.organizationId);

    const leaveType = await this.prisma.leaveType.findFirst({
      where: { id: dto.leaveTypeId, organizationId: user.organizationId },
    });
    if (!leaveType) throw new NotFoundException('Leave type not found');

    const year = new Date(dto.startDate).getFullYear();
    const used = await this.prisma.leaveRequest.aggregate({
      where: {
        employeeId: dto.employeeId,
        leaveTypeId: dto.leaveTypeId,
        status: LeaveRequestStatus.APPROVED,
        startDate: {
          gte: new Date(`${year}-01-01`),
          lte: new Date(`${year}-12-31`),
        },
      },
      _sum: { days: true },
    });
    const usedDays = used._sum.days ?? 0;
    if (usedDays + dto.days > leaveType.annualQuotaDays) {
      throw new BadRequestException('Insufficient leave balance');
    }

    const request = await this.prisma.leaveRequest.create({
      data: {
        organizationId: user.organizationId,
        employeeId: dto.employeeId,
        leaveTypeId: dto.leaveTypeId,
        startDate: new Date(dto.startDate),
        endDate: new Date(dto.endDate),
        days: dto.days,
        reason: dto.reason,
        createdBy: user.id,
      },
    });

    const approval = await this.approvals.start(
      {
        workflowCode: 'leave-approval',
        resourceType: 'LeaveRequest',
        resourceId: request.id,
      },
      user,
    );

    const updated = await this.prisma.leaveRequest.update({
      where: { id: request.id },
      data: { approvalInstanceId: approval.id },
    });

    await this.audit.record({
      organizationId: user.organizationId,
      actorId: user.id,
      action: 'leave.applied',
      resourceType: 'LeaveRequest',
      resourceId: request.id,
      after: updated,
    });

    return this.toRequestDto(updated);
  }

  async approveLeave(id: string, user: AuthUser): Promise<LeaveRequestResponseDto> {
    const request = await this.prisma.leaveRequest.findFirst({
      where: { id, organizationId: user.organizationId },
    });
    if (!request) throw new NotFoundException('Leave request not found');
    if (!request.approvalInstanceId) {
      throw new BadRequestException('No approval instance');
    }

    await this.approvals.act(
      request.approvalInstanceId,
      { decision: 'APPROVE' },
      user,
    );

    const updated = await this.prisma.leaveRequest.update({
      where: { id },
      data: {
        status: LeaveRequestStatus.APPROVED,
        approvedBy: user.id,
        approvedAt: new Date(),
      },
    });

    await this.audit.record({
      organizationId: user.organizationId,
      actorId: user.id,
      action: 'leave.approved',
      resourceType: 'LeaveRequest',
      resourceId: id,
      after: updated,
    });

    return this.toRequestDto(updated);
  }

  async listLeaveRequests(
    organizationId: string,
    employeeId?: string,
  ): Promise<LeaveRequestResponseDto[]> {
    const rows = await this.prisma.leaveRequest.findMany({
      where: {
        organizationId,
        ...(employeeId ? { employeeId } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return rows.map((r) => this.toRequestDto(r));
  }

  private toTypeDto(t: {
    id: string;
    organizationId: string;
    code: string;
    name: string;
    annualQuotaDays: number;
    isActive: boolean;
  }): LeaveTypeResponseDto {
    return {
      id: t.id,
      organizationId: t.organizationId,
      code: t.code,
      name: t.name,
      annualQuotaDays: t.annualQuotaDays,
      isActive: t.isActive,
    };
  }

  private toRequestDto(r: {
    id: string;
    organizationId: string;
    employeeId: string;
    leaveTypeId: string;
    startDate: Date;
    endDate: Date;
    days: number;
    reason: string;
    status: LeaveRequestStatus;
    approvalInstanceId: string | null;
    approvedBy: string | null;
    approvedAt: Date | null;
    rejectedReason: string | null;
    createdAt: Date;
  }): LeaveRequestResponseDto {
    return {
      id: r.id,
      organizationId: r.organizationId,
      employeeId: r.employeeId,
      leaveTypeId: r.leaveTypeId,
      startDate: r.startDate,
      endDate: r.endDate,
      days: r.days,
      reason: r.reason,
      status: r.status,
      approvalInstanceId: r.approvalInstanceId,
      approvedBy: r.approvedBy,
      approvedAt: r.approvedAt,
      rejectedReason: r.rejectedReason,
      createdAt: r.createdAt,
    };
  }
}
