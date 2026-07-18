import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { ShiftStatus } from '@prisma/client';
import {
  PrismaService,
  AuthUser,
  distanceMeters,
  DEFAULT_GEOFENCE_RADIUS_M,
} from '@pssms/shared';
import { AuditService } from '@pssms/audit';
import { GuardsService } from '@pssms/workforce';
import {
  AttendanceListItemDto,
  AttendanceResponseDto,
  ClockInDto,
  ClockOutDto,
} from '../presentation/dto/attendance.dto';

@Injectable()
export class AttendanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly guards: GuardsService,
  ) {}

  async clockIn(dto: ClockInDto, user: AuthUser): Promise<AttendanceResponseDto> {
    if (dto.clientEventId) {
      const dup = await this.prisma.guardAttendance.findUnique({
        where: { clientEventId: dto.clientEventId },
      });
      if (dup) return this.toDto(dup, true);
    }

    const guard = await this.guards.getByUserId(user.id, user.organizationId);
    if (!guard) throw new BadRequestException('User is not a registered guard');

    const site = await this.prisma.site.findFirst({
      where: { id: dto.siteId, organizationId: user.organizationId },
    });
    if (!site) throw new NotFoundException('Site not found');

    const geofenceOk = this.verifyGeofence(
      dto.gps.latitude,
      dto.gps.longitude,
      site.latitude,
      site.longitude,
    );

    const serverNow = new Date();
    const deviceTime = dto.deviceTime ? new Date(dto.deviceTime) : serverNow;

    const attendance = await this.prisma.guardAttendance.create({
      data: {
        organizationId: user.organizationId,
        guardId: guard.id,
        siteId: dto.siteId,
        shiftId: dto.shiftId,
        clockInAt: serverNow,
        clockInMethod: dto.method,
        clockInLatitude: dto.gps.latitude,
        clockInLongitude: dto.gps.longitude,
        deviceClockInAt: deviceTime,
        serverReceivedAt: serverNow,
        clientEventId: dto.clientEventId,
        remarks: geofenceOk ? undefined : 'GEOFENCE_WARNING',
      },
    });

    if (dto.shiftId) {
      await this.prisma.shift.updateMany({
        where: { id: dto.shiftId, status: ShiftStatus.SCHEDULED },
        data: { status: ShiftStatus.ACTIVE },
      });
    }

    await this.audit.record({
      organizationId: user.organizationId,
      actorId: user.id,
      action: 'guard.clocked-in',
      resourceType: 'GuardAttendance',
      resourceId: attendance.id,
      after: { ...attendance, geofenceVerified: geofenceOk },
    });

    return this.toDto(attendance, geofenceOk);
  }

  async clockOut(dto: ClockOutDto, user: AuthUser): Promise<AttendanceResponseDto> {
    if (dto.clientEventId) {
      const dup = await this.prisma.guardAttendance.findUnique({
        where: { clockOutClientEventId: dto.clientEventId },
      });
      if (dup) return this.toDto(dup, true);
    }

    const guard = await this.guards.getByUserId(user.id, user.organizationId);
    if (!guard) throw new BadRequestException('User is not a registered guard');

    const attendance = await this.prisma.guardAttendance.findFirst({
      where: {
        id: dto.attendanceId,
        organizationId: user.organizationId,
        guardId: guard.id,
      },
    });
    if (!attendance) throw new NotFoundException('Attendance not found');
    if (attendance.clockOutAt) throw new BadRequestException('Already clocked out');

    const serverNow = new Date();
    const updated = await this.prisma.guardAttendance.update({
      where: { id: attendance.id },
      data: {
        clockOutAt: serverNow,
        clockOutMethod: dto.method,
        clockOutLatitude: dto.gps.latitude,
        clockOutLongitude: dto.gps.longitude,
        deviceClockOutAt: dto.deviceTime ? new Date(dto.deviceTime) : serverNow,
        clockOutClientEventId: dto.clientEventId,
      },
    });

    await this.audit.record({
      organizationId: user.organizationId,
      actorId: user.id,
      action: 'guard.clocked-out',
      resourceType: 'GuardAttendance',
      resourceId: updated.id,
      after: updated,
    });

    // Event stub: attendance.period-closed → payroll snapshot (Phase 4)

    return this.toDto(updated, true);
  }

  async list(
    organizationId: string,
    siteId?: string,
    supervisorApproved?: boolean,
  ): Promise<AttendanceListItemDto[]> {
    const rows = await this.prisma.guardAttendance.findMany({
      where: {
        organizationId,
        ...(siteId ? { siteId } : {}),
        ...(typeof supervisorApproved === 'boolean'
          ? { supervisorApproved }
          : {}),
      },
      orderBy: { clockInAt: 'desc' },
      take: 100,
    });
    return rows.map((a) => this.toListItemDto(a));
  }

  async approve(id: string, user: AuthUser): Promise<AttendanceListItemDto> {
    const attendance = await this.prisma.guardAttendance.findFirst({
      where: { id, organizationId: user.organizationId },
    });
    if (!attendance) throw new NotFoundException('Attendance not found');

    if (attendance.supervisorApproved) {
      return this.toListItemDto(attendance);
    }

    const guard = await this.prisma.guardProfile.findFirst({
      where: {
        id: attendance.guardId,
        organizationId: user.organizationId,
      },
    });
    if (!guard) throw new NotFoundException('Guard profile not found');
    if (guard.userId === user.id) {
      throw new ForbiddenException({
        error: 'CREATOR_CANNOT_APPROVE',
        message: 'Supervisor cannot approve their own guard attendance',
      });
    }

    const updated = await this.prisma.guardAttendance.update({
      where: { id: attendance.id },
      data: { supervisorApproved: true },
    });

    await this.audit.record({
      organizationId: user.organizationId,
      actorId: user.id,
      action: 'attendance.supervisor-approved',
      resourceType: 'GuardAttendance',
      resourceId: updated.id,
      after: updated,
    });

    return this.toListItemDto(updated);
  }

  private verifyGeofence(
    lat: number,
    lon: number,
    siteLat: number | null,
    siteLon: number | null,
  ): boolean {
    if (siteLat == null || siteLon == null) return true;
    return (
      distanceMeters(lat, lon, siteLat, siteLon) <= DEFAULT_GEOFENCE_RADIUS_M
    );
  }

  private toDto(
    a: {
      id: string;
      guardId: string;
      siteId: string;
      clockInAt: Date;
      clockOutAt: Date | null;
      syncStatus: string;
      remarks?: string | null;
    },
    geofenceVerified: boolean,
  ): AttendanceResponseDto {
    return {
      id: a.id,
      guardId: a.guardId,
      siteId: a.siteId,
      clockInAt: a.clockInAt,
      clockOutAt: a.clockOutAt,
      syncStatus: a.syncStatus,
      geofenceVerified,
    };
  }

  private toListItemDto(a: {
    id: string;
    guardId: string;
    siteId: string;
    shiftId: string | null;
    clockInAt: Date;
    clockOutAt: Date | null;
    supervisorApproved: boolean;
    remarks: string | null;
    syncStatus: string;
  }): AttendanceListItemDto {
    return {
      id: a.id,
      guardId: a.guardId,
      siteId: a.siteId,
      shiftId: a.shiftId,
      clockInAt: a.clockInAt,
      clockOutAt: a.clockOutAt,
      supervisorApproved: a.supervisorApproved,
      remarks: a.remarks,
      syncStatus: a.syncStatus,
    };
  }
}
