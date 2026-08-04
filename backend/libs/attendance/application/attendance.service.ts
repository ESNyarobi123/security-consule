import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { ShiftStatus, AttendanceMethod } from '@prisma/client';
import {
  PrismaService,
  AuthUser,
  distanceMeters,
  DEFAULT_GEOFENCE_RADIUS_M,
  assertSiteAccess,
  isGuardSelfScoped,
  siteScopeWhere,
} from '@pssms/shared';

/** Device-normalized guard punch resolved inside the attendance domain. */
export interface DevicePunchInput {
  employeeNumber?: string;
  siteId?: string;
  direction?: 'IN' | 'OUT';
  eventType?: string;
  capturedAt?: string;
  clientEventId?: string;
}

export interface DevicePunchResult {
  id: string;
  action: 'clock-in' | 'clock-out';
  duplicate?: boolean;
}
import { AuditService } from '@pssms/audit';
import { GuardsService } from '@pssms/workforce';
import { AlertnessService } from './alertness.service';
import {
  AttendanceListItemDto,
  AttendanceResponseDto,
  ClockInDto,
  ClockOutDto,
  SupervisorClockInDto,
} from '../presentation/dto/attendance.dto';

/** Staff roles that may approve / supervisor-punch despite also holding GUARD. */
const ATTENDANCE_SUPERVISE_ROLES = new Set([
  'SUPER_ADMIN',
  'GENERAL_MANAGER',
  'HR_OFFICER',
  'SUPERVISOR',
  'FIELD_OFFICER',
  'BRANCH_MANAGER',
  'OPERATIONS_MANAGER',
  'CONTROL_ROOM',
  'DEVELOPER',
  'CEO',
  'CMD',
  'LEGAL',
  'MARKETING',
]);

@Injectable()
export class AttendanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly guards: GuardsService,
    private readonly alertness: AlertnessService,
  ) {}

  /**
   * Approve + supervisor punch require a positive supervise role allowlist
   * (not merely operations.manage — CCTV_OPERATOR must not approve punches).
   */
  private assertCanSuperviseAttendance(user: AuthUser): void {
    if (!user.roles.some((r) => ATTENDANCE_SUPERVISE_ROLES.has(r))) {
      throw new ForbiddenException({
        error: 'FORBIDDEN',
        message: 'Role cannot approve or supervisor-punch attendance',
      });
    }
  }

  async clockIn(dto: ClockInDto, user: AuthUser): Promise<AttendanceResponseDto> {
    if (dto.clientEventId) {
      const dup = await this.prisma.guardAttendance.findUnique({
        where: { clientEventId: dto.clientEventId },
      });
      if (dup) return this.toDto(dup, true);
    }

    const guard = await this.guards.getByUserId(user.id, user.organizationId);
    if (!guard) throw new BadRequestException('User is not a registered guard');
    if (guard.status === 'TERMINATED' || guard.status === 'SUSPENDED') {
      throw new BadRequestException(
        `Guard status ${guard.status} cannot clock in`,
      );
    }

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

    const auto = await this.alertness.scheduleForDuty({
      organizationId: user.organizationId,
      actorId: user.id,
      guardId: guard.id,
      siteId: dto.siteId,
      shiftId: dto.shiftId,
      clockInAt: serverNow,
    });

    await this.audit.record({
      organizationId: user.organizationId,
      actorId: user.id,
      action: 'guard.clocked-in',
      resourceType: 'GuardAttendance',
      resourceId: attendance.id,
      after: {
        ...attendance,
        geofenceVerified: geofenceOk,
        alertnessChecksScheduled: auto.scheduled,
      },
    });

    return this.toDto(attendance, geofenceOk, auto.scheduled);
  }

  /** Supervisor manual clock-in when guard mobile punch fails (method SUPERVISOR). */
  async supervisorClockIn(
    dto: SupervisorClockInDto,
    user: AuthUser,
  ): Promise<AttendanceResponseDto> {
    this.assertCanSuperviseAttendance(user);

    const guard = await this.prisma.guardProfile.findFirst({
      where: { id: dto.guardId, organizationId: user.organizationId },
    });
    if (!guard) throw new NotFoundException('Guard not found');
    if (guard.status === 'TERMINATED' || guard.status === 'SUSPENDED') {
      throw new BadRequestException(
        `Guard status ${guard.status} cannot clock in`,
      );
    }

    const site = await this.prisma.site.findFirst({
      where: { id: dto.siteId, organizationId: user.organizationId },
    });
    if (!site) throw new NotFoundException('Site not found');
    assertSiteAccess(user, dto.siteId);

    if (dto.shiftId) {
      const shift = await this.prisma.shift.findFirst({
        where: {
          id: dto.shiftId,
          organizationId: user.organizationId,
          siteId: dto.siteId,
        },
        select: { id: true },
      });
      if (!shift) throw new NotFoundException('Shift not found');
    }

    const open = await this.prisma.guardAttendance.findFirst({
      where: {
        organizationId: user.organizationId,
        guardId: guard.id,
        clockOutAt: null,
      },
    });
    if (open) {
      throw new ConflictException({
        error: 'OPEN_ATTENDANCE_EXISTS',
        message: 'Guard already has an open attendance record',
        attendanceId: open.id,
      });
    }

    const noGps = !dto.gps;
    const latitude = dto.gps?.latitude ?? site.latitude ?? 0;
    const longitude = dto.gps?.longitude ?? site.longitude ?? 0;

    let geofenceOk = true;
    if (dto.gps) {
      geofenceOk = this.verifyGeofence(
        latitude,
        longitude,
        site.latitude,
        site.longitude,
      );
    }

    const remarkParts: string[] = [];
    if (dto.remarks?.trim()) remarkParts.push(dto.remarks.trim());
    if (noGps) remarkParts.push('NO_GPS');
    else if (!geofenceOk) remarkParts.push('GEOFENCE_WARNING');

    const serverNow = new Date();
    const attendance = await this.prisma.guardAttendance.create({
      data: {
        organizationId: user.organizationId,
        guardId: guard.id,
        siteId: dto.siteId,
        shiftId: dto.shiftId,
        clockInAt: serverNow,
        clockInMethod: AttendanceMethod.SUPERVISOR,
        clockInLatitude: latitude,
        clockInLongitude: longitude,
        deviceClockInAt: serverNow,
        serverReceivedAt: serverNow,
        remarks: remarkParts.length ? remarkParts.join('; ') : undefined,
      },
    });

    if (dto.shiftId) {
      await this.prisma.shift.updateMany({
        where: {
          id: dto.shiftId,
          organizationId: user.organizationId,
          status: ShiftStatus.SCHEDULED,
        },
        data: { status: ShiftStatus.ACTIVE },
      });
    }

    const auto = await this.alertness.scheduleForDuty({
      organizationId: user.organizationId,
      actorId: user.id,
      guardId: guard.id,
      siteId: dto.siteId,
      shiftId: dto.shiftId,
      clockInAt: serverNow,
    });

    await this.audit.record({
      organizationId: user.organizationId,
      actorId: user.id,
      action: 'attendance.supervisor-clock-in',
      resourceType: 'GuardAttendance',
      resourceId: attendance.id,
      after: {
        ...attendance,
        geofenceVerified: geofenceOk,
        alertnessChecksScheduled: auto.scheduled,
        supervisorActorId: user.id,
      },
    });

    return this.toDto(attendance, geofenceOk, auto.scheduled);
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

  /**
   * Ingest a guard attendance punch from a biometric/card terminal. The device
   * identifies the guard by employee number (not a logged-in user) and has no
   * GPS, so this bypasses the geofence path. It toggles clock-in ↔ clock-out
   * based on the guard's open attendance (explicit `direction` overrides).
   *
   * Returns null when the guard cannot be resolved (event kept store-only) so a
   * misconfigured device never rejects the whole ingest batch.
   */
  async ingestDevicePunch(
    dto: DevicePunchInput,
    user: AuthUser,
  ): Promise<DevicePunchResult | null> {
    if (!dto.employeeNumber || !dto.siteId) return null;

    const guard = await this.prisma.guardProfile.findFirst({
      where: {
        organizationId: user.organizationId,
        employeeNumber: dto.employeeNumber,
      },
    });
    if (!guard) return null;

    if (dto.clientEventId) {
      const dupIn = await this.prisma.guardAttendance.findUnique({
        where: { clientEventId: dto.clientEventId },
      });
      if (dupIn) return { id: dupIn.id, action: 'clock-in', duplicate: true };
      const dupOut = await this.prisma.guardAttendance.findUnique({
        where: { clockOutClientEventId: dto.clientEventId },
      });
      if (dupOut) return { id: dupOut.id, action: 'clock-out', duplicate: true };
    }

    const method = this.mapPunchMethod(dto.eventType);
    const capturedAt = dto.capturedAt ? new Date(dto.capturedAt) : new Date();
    const serverNow = new Date();

    const open = await this.prisma.guardAttendance.findFirst({
      where: {
        organizationId: user.organizationId,
        guardId: guard.id,
        clockOutAt: null,
      },
      orderBy: { clockInAt: 'desc' },
    });

    if (open && dto.direction !== 'IN') {
      const updated = await this.prisma.guardAttendance.update({
        where: { id: open.id },
        data: {
          clockOutAt: serverNow,
          clockOutMethod: method,
          deviceClockOutAt: capturedAt,
          clockOutClientEventId: dto.clientEventId,
        },
      });
      await this.audit.record({
        organizationId: user.organizationId,
        actorId: user.id,
        action: 'guard.clocked-out',
        resourceType: 'GuardAttendance',
        resourceId: updated.id,
        after: { ...updated, via: 'device' },
      });
      return { id: updated.id, action: 'clock-out' };
    }

    const created = await this.prisma.guardAttendance.create({
      data: {
        organizationId: user.organizationId,
        guardId: guard.id,
        siteId: dto.siteId,
        clockInAt: serverNow,
        clockInMethod: method,
        deviceClockInAt: capturedAt,
        serverReceivedAt: serverNow,
        clientEventId: dto.clientEventId,
      },
    });
    const auto = await this.alertness.scheduleForDuty({
      organizationId: user.organizationId,
      actorId: user.id,
      guardId: guard.id,
      siteId: dto.siteId,
      clockInAt: serverNow,
    });
    await this.audit.record({
      organizationId: user.organizationId,
      actorId: user.id,
      action: 'guard.clocked-in',
      resourceType: 'GuardAttendance',
      resourceId: created.id,
      after: {
        ...created,
        via: 'device',
        alertnessChecksScheduled: auto.scheduled,
      },
    });
    return { id: created.id, action: 'clock-in' };
  }

  private mapPunchMethod(eventType?: string): AttendanceMethod {
    switch (eventType) {
      case 'FACE_RECOGNITION':
        return AttendanceMethod.FACE;
      case 'CARD_TAP':
        return AttendanceMethod.NFC;
      case 'QR_SCAN':
        return AttendanceMethod.QR;
      case 'FINGERPRINT_SCAN':
      case 'ATTENDANCE_PUNCH':
      default:
        return AttendanceMethod.FINGERPRINT;
    }
  }

  async list(
    organizationId: string,
    user: AuthUser,
    siteId?: string,
    supervisorApproved?: boolean,
    from?: Date,
    to?: Date,
  ): Promise<AttendanceListItemDto[]> {
    const fromOk = from && !Number.isNaN(from.getTime()) ? from : undefined;
    const toOk = to && !Number.isNaN(to.getTime()) ? to : undefined;

    let selfGuardId: string | undefined;
    if (isGuardSelfScoped(user)) {
      const self = await this.guards.getByUserId(user.id, organizationId);
      if (!self) {
        throw new ForbiddenException({
          error: 'GUARD_SCOPE_DENIED',
          message: 'No guard profile linked to this user',
        });
      }
      selfGuardId = self.id;
    }

    const rows = await this.prisma.guardAttendance.findMany({
      where: {
        organizationId,
        ...(selfGuardId
          ? { guardId: selfGuardId }
          : siteScopeWhere(user, siteId)),
        ...(typeof supervisorApproved === 'boolean'
          ? { supervisorApproved }
          : {}),
        ...(fromOk || toOk
          ? {
              clockInAt: {
                ...(fromOk ? { gte: fromOk } : {}),
                ...(toOk ? { lt: toOk } : {}),
              },
            }
          : {}),
      },
      orderBy: { clockInAt: 'desc' },
      take: 100,
    });
    const shiftIds = [
      ...new Set(
        rows.map((r) => r.shiftId).filter((id): id is string => id != null),
      ),
    ];
    const shifts =
      shiftIds.length > 0
        ? await this.prisma.shift.findMany({
            where: { organizationId, id: { in: shiftIds } },
            select: { id: true, startAt: true, endAt: true },
          })
        : [];
    const shiftById = new Map(shifts.map((s) => [s.id, s]));

    return rows.map((a) =>
      this.enrichListItem(
        a,
        a.shiftId ? shiftById.get(a.shiftId) : undefined,
      ),
    );
  }

  async approve(id: string, user: AuthUser): Promise<AttendanceListItemDto> {
    this.assertCanSuperviseAttendance(user);

    const attendance = await this.prisma.guardAttendance.findFirst({
      where: { id, organizationId: user.organizationId },
    });
    if (!attendance) throw new NotFoundException('Attendance not found');
    assertSiteAccess(user, attendance.siteId);

    if (attendance.supervisorApproved) {
      const shift = await this.loadShiftTiming(
        user.organizationId,
        attendance.shiftId,
      );
      return this.enrichListItem(attendance, shift);
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

    const shift = await this.loadShiftTiming(
      user.organizationId,
      updated.shiftId,
    );
    return this.enrichListItem(updated, shift);
  }

  private async loadShiftTiming(
    organizationId: string,
    shiftId: string | null | undefined,
  ): Promise<{ id: string; startAt: Date; endAt: Date } | undefined> {
    if (!shiftId) return undefined;
    return (
      (await this.prisma.shift.findFirst({
        where: { id: shiftId, organizationId },
        select: { id: true, startAt: true, endAt: true },
      })) ?? undefined
    );
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
    alertnessChecksScheduled = 0,
  ): AttendanceResponseDto {
    return {
      id: a.id,
      guardId: a.guardId,
      siteId: a.siteId,
      clockInAt: a.clockInAt,
      clockOutAt: a.clockOutAt,
      syncStatus: a.syncStatus,
      geofenceVerified,
      alertnessChecksScheduled,
    };
  }

  private enrichListItem(
    a: {
      id: string;
      guardId: string;
      siteId: string;
      shiftId: string | null;
      clockInAt: Date;
      clockOutAt: Date | null;
      clockInMethod: AttendanceMethod;
      clockOutMethod: AttendanceMethod | null;
      supervisorApproved: boolean;
      remarks: string | null;
      syncStatus: string;
    },
    shift?: { startAt: Date; endAt: Date },
  ): AttendanceListItemDto {
    const remarks = a.remarks ?? '';
    const geofenceWarning = remarks.includes('GEOFENCE_WARNING');

    let isLate = false;
    let lateMinutes = 0;
    let isOvertime = false;
    let overtimeMinutes = 0;

    if (shift) {
      if (a.clockInAt > shift.startAt) {
        lateMinutes = Math.ceil(
          (a.clockInAt.getTime() - shift.startAt.getTime()) / 60000,
        );
        isLate = lateMinutes > 0;
      }
      if (a.clockOutAt && a.clockOutAt > shift.endAt) {
        overtimeMinutes = Math.ceil(
          (a.clockOutAt.getTime() - shift.endAt.getTime()) / 60000,
        );
        isOvertime = overtimeMinutes > 0;
      }
    }

    return {
      id: a.id,
      guardId: a.guardId,
      siteId: a.siteId,
      shiftId: a.shiftId,
      clockInAt: a.clockInAt,
      clockOutAt: a.clockOutAt,
      clockInMethod: a.clockInMethod,
      clockOutMethod: a.clockOutMethod,
      geofenceWarning,
      isLate,
      lateMinutes,
      isOvertime,
      overtimeMinutes,
      supervisorApproved: a.supervisorApproved,
      remarks: a.remarks,
      syncStatus: a.syncStatus,
    };
  }
}
