import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AssignmentStatus, DeploymentStatus, GuardStatus } from '@prisma/client';
import {
  PrismaService,
  AuthUser,
  assertSiteAccess,
  siteScopeWhere,
} from '@pssms/shared';
import { AuditService } from '@pssms/audit';
import {
  CreateShiftDto,
  ReplaceShiftAssignmentDto,
  ShiftResponseDto,
} from '../presentation/dto/operations.dto';

@Injectable()
export class ShiftsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async create(dto: CreateShiftDto, user: AuthUser): Promise<ShiftResponseDto> {
    const site = await this.prisma.site.findFirst({
      where: { id: dto.siteId, organizationId: user.organizationId },
    });
    if (!site) throw new NotFoundException('Site not found');
    assertSiteAccess(user, dto.siteId);

    const uniqueGuardIds = [...new Set(dto.guardIds)];
    if (uniqueGuardIds.length === 0) {
      throw new BadRequestException('At least one guard is required');
    }
    const orgGuards = await this.prisma.guardProfile.findMany({
      where: {
        id: { in: uniqueGuardIds },
        organizationId: user.organizationId,
      },
      select: { id: true },
    });
    if (orgGuards.length !== uniqueGuardIds.length) {
      throw new BadRequestException(
        'One or more guards are not in your organization',
      );
    }
    if (dto.supervisorId) {
      const supervisor = await this.prisma.guardProfile.findFirst({
        where: {
          id: dto.supervisorId,
          organizationId: user.organizationId,
        },
        select: { id: true },
      });
      if (!supervisor) {
        throw new BadRequestException(
          'Supervisor is not in your organization',
        );
      }
    }

    const shift = await this.prisma.shift.create({
      data: {
        organizationId: user.organizationId,
        siteId: dto.siteId,
        name: dto.name,
        startAt: new Date(dto.startAt),
        endAt: new Date(dto.endAt),
        instructions: dto.instructions,
        createdBy: user.id,
        assignments: {
          create: uniqueGuardIds.map((guardId) => ({
            guardId,
            supervisorId: dto.supervisorId,
          })),
        },
      },
    });

    await this.audit.record({
      organizationId: user.organizationId,
      actorId: user.id,
      action: 'shift.created',
      resourceType: 'Shift',
      resourceId: shift.id,
      after: shift,
    });

    return {
      id: shift.id,
      siteId: shift.siteId,
      name: shift.name,
      startAt: shift.startAt,
      endAt: shift.endAt,
      status: shift.status,
    };
  }

  async list(
    organizationId: string,
    user: AuthUser,
    siteId?: string,
  ): Promise<ShiftResponseDto[]> {
    const rows = await this.prisma.shift.findMany({
      where: {
        organizationId,
        ...siteScopeWhere(user, siteId),
      },
      include: {
        assignments: {
          include: {
            guard: { select: { id: true, employeeNumber: true, userId: true } },
          },
        },
      },
      orderBy: { startAt: 'desc' },
      take: 100,
    });
    return rows.map((s) => this.toDto(s));
  }

  async confirmAssignment(
    shiftId: string,
    assignmentId: string,
    user: AuthUser,
  ): Promise<ShiftResponseDto> {
    const { shift, assignment } = await this.loadAssignment(
      shiftId,
      assignmentId,
      user,
    );
    if (assignment.guard.userId === user.id) {
      throw new ForbiddenException({
        error: 'CREATOR_CANNOT_CONFIRM',
        message: 'You cannot confirm your own shift assignment',
      });
    }
    if (assignment.status === AssignmentStatus.REPLACED) {
      throw new BadRequestException('Replaced assignment cannot be confirmed');
    }
    if (assignment.status === AssignmentStatus.CONFIRMED) {
      return this.toDto(shift);
    }
    if (assignment.status !== AssignmentStatus.ASSIGNED) {
      throw new BadRequestException(
        `Cannot confirm assignment in status ${assignment.status}`,
      );
    }

    await this.prisma.shiftAssignment.update({
      where: { id: assignment.id },
      data: { status: AssignmentStatus.CONFIRMED },
    });

    await this.audit.record({
      organizationId: user.organizationId,
      actorId: user.id,
      action: 'shift.assignment.confirmed',
      resourceType: 'ShiftAssignment',
      resourceId: assignment.id,
      after: { shiftId: shift.id, guardId: assignment.guardId },
    });

    return this.reload(shift.id, user);
  }

  async replaceAssignment(
    shiftId: string,
    assignmentId: string,
    dto: ReplaceShiftAssignmentDto,
    user: AuthUser,
  ): Promise<ShiftResponseDto> {
    const { shift, assignment } = await this.loadAssignment(
      shiftId,
      assignmentId,
      user,
    );
    if (assignment.guard.userId === user.id) {
      throw new ForbiddenException({
        error: 'CREATOR_CANNOT_REPLACE',
        message: 'You cannot process replacement of your own assignment',
      });
    }
    if (
      assignment.status === AssignmentStatus.REPLACED ||
      assignment.status === AssignmentStatus.NO_SHOW
    ) {
      throw new BadRequestException(
        `Cannot replace assignment in status ${assignment.status}`,
      );
    }
    if (dto.replacementGuardId === assignment.guardId) {
      throw new BadRequestException('Replacement must be a different guard');
    }

    const replacement = await this.prisma.guardProfile.findFirst({
      where: {
        id: dto.replacementGuardId,
        organizationId: user.organizationId,
      },
      select: { id: true, status: true },
    });
    if (!replacement) {
      throw new BadRequestException(
        'Replacement guard is not in your organization',
      );
    }
    if (
      replacement.status === GuardStatus.ABSENT ||
      replacement.status === GuardStatus.SUSPENDED ||
      replacement.status === GuardStatus.TERMINATED
    ) {
      throw new BadRequestException({
        error: 'GUARD_STATUS_BLOCKS_DUTY',
        message: `Guard status ${replacement.status} cannot take this shift`,
      });
    }

    const activeAtSite = await this.prisma.guardDeployment.findFirst({
      where: {
        organizationId: user.organizationId,
        guardId: replacement.id,
        siteId: shift.siteId,
        status: DeploymentStatus.ACTIVE,
      },
      select: { id: true },
    });
    if (!activeAtSite) {
      throw new BadRequestException({
        error: 'REPLACEMENT_NOT_DEPLOYED_AT_SITE',
        message:
          'Replacement must have an ACTIVE deployment at this shift site',
      });
    }

    const already = await this.prisma.shiftAssignment.findFirst({
      where: { shiftId: shift.id, guardId: replacement.id },
    });
    if (
      already &&
      (already.status === AssignmentStatus.ASSIGNED ||
        already.status === AssignmentStatus.CONFIRMED)
    ) {
      throw new BadRequestException(
        'Replacement guard is already on this shift',
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.shiftAssignment.update({
        where: { id: assignment.id },
        data: { status: AssignmentStatus.REPLACED },
      });
      if (already) {
        await tx.shiftAssignment.update({
          where: { id: already.id },
          data: {
            status: AssignmentStatus.ASSIGNED,
            supervisorId: user.id,
            assignedAt: new Date(),
          },
        });
      } else {
        await tx.shiftAssignment.create({
          data: {
            shiftId: shift.id,
            guardId: replacement.id,
            supervisorId: user.id,
            status: AssignmentStatus.ASSIGNED,
          },
        });
      }
    });

    await this.audit.record({
      organizationId: user.organizationId,
      actorId: user.id,
      action: 'shift.assignment.replaced',
      resourceType: 'ShiftAssignment',
      resourceId: assignment.id,
      after: {
        shiftId: shift.id,
        fromGuardId: assignment.guardId,
        toGuardId: replacement.id,
      },
    });

    return this.reload(shift.id, user);
  }

  private async loadAssignment(
    shiftId: string,
    assignmentId: string,
    user: AuthUser,
  ) {
    const shift = await this.prisma.shift.findFirst({
      where: { id: shiftId, organizationId: user.organizationId },
      include: {
        assignments: {
          include: {
            guard: { select: { id: true, employeeNumber: true, userId: true } },
          },
        },
      },
    });
    if (!shift) throw new NotFoundException('Shift not found');
    assertSiteAccess(user, shift.siteId);
    const assignment = shift.assignments.find((a) => a.id === assignmentId);
    if (!assignment) throw new NotFoundException('Assignment not found');
    return { shift, assignment };
  }

  private async reload(shiftId: string, user: AuthUser): Promise<ShiftResponseDto> {
    const shift = await this.prisma.shift.findFirst({
      where: { id: shiftId, organizationId: user.organizationId },
      include: {
        assignments: {
          include: {
            guard: { select: { id: true, employeeNumber: true, userId: true } },
          },
        },
      },
    });
    if (!shift) throw new NotFoundException('Shift not found');
    return this.toDto(shift);
  }

  private toDto(s: {
    id: string;
    siteId: string;
    name: string;
    startAt: Date;
    endAt: Date;
    status: ShiftResponseDto['status'];
    assignments?: Array<{
      id: string;
      guardId: string;
      supervisorId: string | null;
      status: string;
      assignedAt: Date;
      guard?: { employeeNumber: string } | null;
    }>;
  }): ShiftResponseDto {
    return {
      id: s.id,
      siteId: s.siteId,
      name: s.name,
      startAt: s.startAt,
      endAt: s.endAt,
      status: s.status,
      assignments: (s.assignments ?? []).map((a) => ({
        id: a.id,
        guardId: a.guardId,
        employeeNumber: a.guard?.employeeNumber ?? null,
        status: a.status,
        supervisorId: a.supervisorId,
        assignedAt: a.assignedAt,
      })),
    };
  }
}
