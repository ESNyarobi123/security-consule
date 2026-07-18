import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ParkingDecision,
  ParkingEntryDirection,
  PermitStatus,
  Prisma,
  ViolationType,
} from '@prisma/client';
import { PrismaService, AuthUser } from '@pssms/shared';
import { AuditService } from '@pssms/audit';
import {
  AnprResultResponseDto,
  CreateAnprResultDto,
  CreateParkingEntryDto,
  CreateParkingPermitDto,
  CreateParkingViolationDto,
  CreateVehicleBlacklistDto,
  CreateVehicleDto,
  DecideAnprResultDto,
  ParkingEntryResponseDto,
  ParkingPermitResponseDto,
  ParkingViolationResponseDto,
  UpdatePermitStatusDto,
  VehicleBlacklistResponseDto,
  VehicleResponseDto,
} from '../presentation/dto/parking.dto';

@Injectable()
export class ParkingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async createVehicle(
    dto: CreateVehicleDto,
    user: AuthUser,
  ): Promise<VehicleResponseDto> {
    const exists = await this.prisma.vehicle.findFirst({
      where: {
        organizationId: user.organizationId,
        plateNumber: dto.plateNumber.toUpperCase(),
      },
    });
    if (exists) throw new ConflictException('Plate number already registered');

    const vehicle = await this.prisma.vehicle.create({
      data: {
        organizationId: user.organizationId,
        customerId: dto.customerId,
        plateNumber: dto.plateNumber.toUpperCase(),
        vehicleType: dto.vehicleType,
        make: dto.make,
        model: dto.model,
        color: dto.color,
        ownerName: dto.ownerName,
        ownerPhone: dto.ownerPhone,
        createdBy: user.id,
      },
    });

    await this.audit.record({
      organizationId: user.organizationId,
      actorId: user.id,
      action: 'parking.vehicle.created',
      resourceType: 'Vehicle',
      resourceId: vehicle.id,
      after: vehicle,
    });

    return this.toVehicleDto(vehicle);
  }

  async listVehicles(
    user: AuthUser,
    customerId?: string,
  ): Promise<VehicleResponseDto[]> {
    const rows = await this.prisma.vehicle.findMany({
      where: {
        organizationId: user.organizationId,
        isActive: true,
        ...(customerId ? { customerId } : {}),
      },
      orderBy: { plateNumber: 'asc' },
    });
    return rows.map((v) => this.toVehicleDto(v));
  }

  async createPermit(
    dto: CreateParkingPermitDto,
    user: AuthUser,
  ): Promise<ParkingPermitResponseDto> {
    const vehicle = await this.prisma.vehicle.findFirst({
      where: { id: dto.vehicleId, organizationId: user.organizationId },
    });
    if (!vehicle) throw new NotFoundException('Vehicle not found');

    const permit = await this.prisma.parkingPermit.create({
      data: {
        organizationId: user.organizationId,
        vehicleId: dto.vehicleId,
        siteId: dto.siteId,
        permitNumber: dto.permitNumber,
        permitType: dto.permitType,
        status: PermitStatus.PENDING,
        validFrom: new Date(dto.validFrom),
        validUntil: new Date(dto.validUntil),
        createdBy: user.id,
      },
    });

    await this.audit.record({
      organizationId: user.organizationId,
      actorId: user.id,
      action: 'parking.permit.created',
      resourceType: 'ParkingPermit',
      resourceId: permit.id,
      after: permit,
    });

    return this.toPermitDto(permit);
  }

  async listPermits(
    user: AuthUser,
    siteId?: string,
    customerId?: string,
    status?: PermitStatus,
  ): Promise<ParkingPermitResponseDto[]> {
    const rows = await this.prisma.parkingPermit.findMany({
      where: {
        organizationId: user.organizationId,
        ...(status ? { status } : {}),
        ...(siteId ? { siteId } : {}),
        ...(customerId ? { vehicle: { customerId } } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return rows.map((p) => this.toPermitDto(p));
  }

  async approvePermit(
    id: string,
    user: AuthUser,
  ): Promise<ParkingPermitResponseDto> {
    const permit = await this.findPermitOrThrow(id, user.organizationId);
    this.assertNotCreator(permit.createdBy, user.id);
    if (permit.status !== PermitStatus.PENDING) {
      throw new BadRequestException('Only pending permits can be approved');
    }

    const updated = await this.prisma.parkingPermit.update({
      where: { id },
      data: { status: PermitStatus.ACTIVE },
    });

    await this.audit.record({
      organizationId: user.organizationId,
      actorId: user.id,
      action: 'parking.permit.approved',
      resourceType: 'ParkingPermit',
      resourceId: id,
      after: updated,
    });

    return this.toPermitDto(updated);
  }

  async rejectPermit(
    id: string,
    user: AuthUser,
  ): Promise<ParkingPermitResponseDto> {
    const permit = await this.findPermitOrThrow(id, user.organizationId);
    this.assertNotCreator(permit.createdBy, user.id);
    if (permit.status !== PermitStatus.PENDING) {
      throw new BadRequestException('Only pending permits can be rejected');
    }

    const updated = await this.prisma.parkingPermit.update({
      where: { id },
      data: { status: PermitStatus.REVOKED },
    });

    await this.audit.record({
      organizationId: user.organizationId,
      actorId: user.id,
      action: 'parking.permit.rejected',
      resourceType: 'ParkingPermit',
      resourceId: id,
      after: updated,
    });

    return this.toPermitDto(updated);
  }

  async updatePermitStatus(
    id: string,
    dto: UpdatePermitStatusDto,
    user: AuthUser,
  ): Promise<ParkingPermitResponseDto> {
    const permit = await this.findPermitOrThrow(id, user.organizationId);
    const next = dto.status as PermitStatus;

    if (
      next === PermitStatus.ACTIVE &&
      permit.status === PermitStatus.PENDING
    ) {
      throw new BadRequestException(
        'Use POST /parking/permits/:id/approve for PENDING → ACTIVE',
      );
    }

    const updated = await this.prisma.parkingPermit.update({
      where: { id },
      data: { status: next },
    });

    await this.audit.record({
      organizationId: user.organizationId,
      actorId: user.id,
      action: 'parking.permit.status_updated',
      resourceType: 'ParkingPermit',
      resourceId: id,
      after: updated,
    });

    return this.toPermitDto(updated);
  }

  async listViolations(
    user: AuthUser,
    siteId?: string,
  ): Promise<ParkingViolationResponseDto[]> {
    const rows = await this.prisma.parkingViolation.findMany({
      where: {
        organizationId: user.organizationId,
        ...(siteId ? { siteId } : {}),
      },
      orderBy: { recordedAt: 'desc' },
      take: 100,
    });
    return rows.map((v) => this.toViolationDto(v));
  }

  async listBlacklist(
    user: AuthUser,
    active?: boolean,
  ): Promise<VehicleBlacklistResponseDto[]> {
    const rows = await this.prisma.vehicleBlacklist.findMany({
      where: {
        organizationId: user.organizationId,
        ...(active === undefined ? {} : { isActive: active }),
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return rows.map((b) => this.toBlacklistDto(b));
  }

  async addBlacklist(
    dto: CreateVehicleBlacklistDto,
    user: AuthUser,
  ): Promise<VehicleBlacklistResponseDto> {
    const plate = dto.plateNumber.toUpperCase();
    const exists = await this.prisma.vehicleBlacklist.findFirst({
      where: { organizationId: user.organizationId, plateNumber: plate },
    });
    if (exists?.isActive) {
      throw new ConflictException('Plate already blacklisted');
    }

    const row = exists
      ? await this.prisma.vehicleBlacklist.update({
          where: { id: exists.id },
          data: {
            reason: dto.reason,
            isActive: true,
            createdBy: user.id,
          },
        })
      : await this.prisma.vehicleBlacklist.create({
          data: {
            organizationId: user.organizationId,
            plateNumber: plate,
            reason: dto.reason,
            createdBy: user.id,
          },
        });

    await this.audit.record({
      organizationId: user.organizationId,
      actorId: user.id,
      action: 'parking.blacklist.added',
      resourceType: 'VehicleBlacklist',
      resourceId: row.id,
      after: row,
    });

    return this.toBlacklistDto(row);
  }

  async deactivateBlacklist(
    id: string,
    user: AuthUser,
  ): Promise<VehicleBlacklistResponseDto> {
    const row = await this.prisma.vehicleBlacklist.findFirst({
      where: { id, organizationId: user.organizationId },
    });
    if (!row) throw new NotFoundException('Blacklist entry not found');

    const updated = await this.prisma.vehicleBlacklist.update({
      where: { id },
      data: { isActive: false },
    });

    await this.audit.record({
      organizationId: user.organizationId,
      actorId: user.id,
      action: 'parking.blacklist.deactivated',
      resourceType: 'VehicleBlacklist',
      resourceId: id,
      after: updated,
    });

    return this.toBlacklistDto(updated);
  }

  async ingestAnprResult(
    dto: CreateAnprResultDto,
    user: AuthUser,
  ): Promise<AnprResultResponseDto> {
    const result = await this.prisma.anprResult.create({
      data: {
        organizationId: user.organizationId,
        siteId: dto.siteId,
        gateId: dto.gateId,
        plateNumber: dto.plateNumber.toUpperCase(),
        confidence: dto.confidence,
        cameraId: dto.cameraId,
        imageUrl: dto.imageUrl,
        rawPayload: dto.rawPayload as Prisma.InputJsonValue | undefined,
        capturedAt: new Date(dto.capturedAt),
      },
    });

    await this.audit.record({
      organizationId: user.organizationId,
      actorId: user.id,
      action: 'parking.anpr.ingested',
      resourceType: 'AnprResult',
      resourceId: result.id,
      after: result,
    });

    return this.toAnprDto(result);
  }

  async decideAnprResult(
    id: string,
    dto: DecideAnprResultDto,
    user: AuthUser,
  ): Promise<AnprResultResponseDto> {
    const anpr = await this.prisma.anprResult.findFirst({
      where: { id, organizationId: user.organizationId },
    });
    if (!anpr) throw new NotFoundException('ANPR result not found');

    const updated = await this.prisma.anprResult.update({
      where: { id },
      data: {
        decision: dto.decision,
        decidedBy: user.id,
        decidedAt: new Date(),
        denyReason: dto.denyReason,
      },
    });

    if (dto.decision === ParkingDecision.ALLOW) {
      const permit = await this.findActivePermit(
        user.organizationId,
        anpr.siteId,
        anpr.plateNumber,
      );
      await this.prisma.parkingEntry.create({
        data: {
          organizationId: user.organizationId,
          siteId: anpr.siteId,
          gateId: anpr.gateId,
          plateNumber: anpr.plateNumber,
          direction: ParkingEntryDirection.ENTRY,
          anprResultId: anpr.id,
          permitId: permit?.id,
          decision: ParkingDecision.ALLOW,
          recordedBy: user.id,
        },
      });
    } else if (dto.decision === ParkingDecision.DENY) {
      await this.prisma.parkingViolation.create({
        data: {
          organizationId: user.organizationId,
          siteId: anpr.siteId,
          plateNumber: anpr.plateNumber,
          violationType: ViolationType.NO_PERMIT,
          description: dto.denyReason ?? 'ANPR decision denied',
          createdBy: user.id,
        },
      });
    }

    await this.audit.record({
      organizationId: user.organizationId,
      actorId: user.id,
      action: 'parking.anpr.decided',
      resourceType: 'AnprResult',
      resourceId: id,
      after: updated,
    });

    return this.toAnprDto(updated);
  }

  async recordEntry(
    dto: CreateParkingEntryDto,
    user: AuthUser,
  ): Promise<ParkingEntryResponseDto> {
    if (dto.clientEventId) {
      const existing = await this.prisma.parkingEntry.findUnique({
        where: { clientEventId: dto.clientEventId },
      });
      if (existing) return this.toEntryDto(existing);
    }

    const plate = dto.plateNumber.toUpperCase();
    const blacklisted = await this.prisma.vehicleBlacklist.findFirst({
      where: {
        organizationId: user.organizationId,
        plateNumber: plate,
        isActive: true,
      },
    });

    let decision = dto.decision ?? ParkingDecision.ALLOW;
    let permitId: string | undefined;

    if (blacklisted) {
      decision = ParkingDecision.DENY;
    } else if (dto.direction === ParkingEntryDirection.ENTRY && !dto.decision) {
      const permit = await this.findActivePermit(
        user.organizationId,
        dto.siteId,
        plate,
      );
      if (permit) {
        permitId = permit.id;
        decision = ParkingDecision.ALLOW;
      } else {
        decision = ParkingDecision.DENY;
        await this.prisma.parkingViolation.create({
          data: {
            organizationId: user.organizationId,
            siteId: dto.siteId,
            plateNumber: plate,
            violationType: ViolationType.NO_PERMIT,
            description: 'No active permit at entry',
            createdBy: user.id,
          },
        });
      }
    }

    const vehicle = await this.prisma.vehicle.findFirst({
      where: { organizationId: user.organizationId, plateNumber: plate },
    });

    const entry = await this.prisma.parkingEntry.create({
      data: {
        organizationId: user.organizationId,
        siteId: dto.siteId,
        gateId: dto.gateId,
        vehicleId: vehicle?.id,
        plateNumber: plate,
        direction: dto.direction,
        permitId,
        decision,
        recordedBy: user.id,
        clientEventId: dto.clientEventId,
        recordedAt: dto.recordedAt ? new Date(dto.recordedAt) : new Date(),
      },
    });

    await this.audit.record({
      organizationId: user.organizationId,
      actorId: user.id,
      action: `parking.entry.${dto.direction.toLowerCase()}`,
      resourceType: 'ParkingEntry',
      resourceId: entry.id,
      after: entry,
    });

    return this.toEntryDto(entry);
  }

  async createViolation(
    dto: CreateParkingViolationDto,
    user: AuthUser,
  ): Promise<ParkingViolationResponseDto> {
    const violation = await this.prisma.parkingViolation.create({
      data: {
        organizationId: user.organizationId,
        siteId: dto.siteId,
        plateNumber: dto.plateNumber.toUpperCase(),
        vehicleId: dto.vehicleId,
        violationType: dto.violationType,
        description: dto.description,
        createdBy: user.id,
      },
    });

    await this.audit.record({
      organizationId: user.organizationId,
      actorId: user.id,
      action: 'parking.violation.created',
      resourceType: 'ParkingViolation',
      resourceId: violation.id,
      after: violation,
    });

    return this.toViolationDto(violation);
  }

  async listEntries(
    user: AuthUser,
    siteId?: string,
  ): Promise<ParkingEntryResponseDto[]> {
    const rows = await this.prisma.parkingEntry.findMany({
      where: {
        organizationId: user.organizationId,
        ...(siteId ? { siteId } : {}),
      },
      orderBy: { recordedAt: 'desc' },
      take: 100,
    });
    return rows.map((e) => this.toEntryDto(e));
  }

  async listAnprResults(
    user: AuthUser,
    siteId?: string,
    decision?: ParkingDecision,
  ): Promise<AnprResultResponseDto[]> {
    const rows = await this.prisma.anprResult.findMany({
      where: {
        organizationId: user.organizationId,
        ...(siteId ? { siteId } : {}),
        ...(decision ? { decision } : {}),
      },
      orderBy: { capturedAt: 'desc' },
      take: 100,
    });
    return rows.map((r) => this.toAnprDto(r));
  }

  private assertNotCreator(createdBy: string | null, actorId: string) {
    if (createdBy && createdBy === actorId) {
      throw new ForbiddenException({
        error: 'CREATOR_CANNOT_APPROVE',
        message: 'Creator cannot approve or reject their own permit',
      });
    }
  }

  private async findPermitOrThrow(id: string, organizationId: string) {
    const permit = await this.prisma.parkingPermit.findFirst({
      where: { id, organizationId },
    });
    if (!permit) throw new NotFoundException('Parking permit not found');
    return permit;
  }

  private async findActivePermit(
    organizationId: string,
    siteId: string,
    plateNumber: string,
  ) {
    const now = new Date();
    const vehicle = await this.prisma.vehicle.findFirst({
      where: { organizationId, plateNumber, isActive: true },
    });
    if (!vehicle) return null;

    return this.prisma.parkingPermit.findFirst({
      where: {
        organizationId,
        vehicleId: vehicle.id,
        siteId,
        status: PermitStatus.ACTIVE,
        validFrom: { lte: now },
        validUntil: { gte: now },
      },
    });
  }

  private toVehicleDto(v: {
    id: string;
    organizationId: string;
    customerId: string | null;
    plateNumber: string;
    vehicleType: string;
    make: string | null;
    model: string | null;
    color: string | null;
    ownerName: string | null;
    ownerPhone: string | null;
    isActive: boolean;
    createdAt: Date;
  }): VehicleResponseDto {
    return {
      id: v.id,
      organizationId: v.organizationId,
      customerId: v.customerId,
      plateNumber: v.plateNumber,
      vehicleType: v.vehicleType,
      make: v.make,
      model: v.model,
      color: v.color,
      ownerName: v.ownerName,
      ownerPhone: v.ownerPhone,
      isActive: v.isActive,
      createdAt: v.createdAt,
    };
  }

  private toPermitDto(p: {
    id: string;
    organizationId: string;
    vehicleId: string;
    siteId: string;
    permitNumber: string;
    permitType: string;
    status: string;
    validFrom: Date;
    validUntil: Date;
    createdAt: Date;
  }): ParkingPermitResponseDto {
    return {
      id: p.id,
      organizationId: p.organizationId,
      vehicleId: p.vehicleId,
      siteId: p.siteId,
      permitNumber: p.permitNumber,
      permitType: p.permitType,
      status: p.status,
      validFrom: p.validFrom,
      validUntil: p.validUntil,
      createdAt: p.createdAt,
    };
  }

  private toAnprDto(r: {
    id: string;
    organizationId: string;
    siteId: string;
    gateId: string | null;
    plateNumber: string;
    confidence: number | null;
    cameraId: string | null;
    imageUrl: string | null;
    decision: string;
    decidedBy: string | null;
    decidedAt: Date | null;
    denyReason: string | null;
    capturedAt: Date;
    createdAt: Date;
  }): AnprResultResponseDto {
    return {
      id: r.id,
      organizationId: r.organizationId,
      siteId: r.siteId,
      gateId: r.gateId,
      plateNumber: r.plateNumber,
      confidence: r.confidence,
      cameraId: r.cameraId,
      imageUrl: r.imageUrl,
      decision: r.decision,
      decidedBy: r.decidedBy,
      decidedAt: r.decidedAt,
      denyReason: r.denyReason,
      capturedAt: r.capturedAt,
      createdAt: r.createdAt,
    };
  }

  private toEntryDto(e: {
    id: string;
    organizationId: string;
    siteId: string;
    gateId: string | null;
    vehicleId: string | null;
    plateNumber: string;
    direction: string;
    permitId: string | null;
    decision: string;
    recordedBy: string | null;
    recordedAt: Date;
    createdAt: Date;
  }): ParkingEntryResponseDto {
    return {
      id: e.id,
      organizationId: e.organizationId,
      siteId: e.siteId,
      gateId: e.gateId,
      vehicleId: e.vehicleId,
      plateNumber: e.plateNumber,
      direction: e.direction,
      permitId: e.permitId,
      decision: e.decision,
      recordedBy: e.recordedBy,
      recordedAt: e.recordedAt,
      createdAt: e.createdAt,
    };
  }

  private toViolationDto(v: {
    id: string;
    organizationId: string;
    siteId: string;
    plateNumber: string;
    vehicleId: string | null;
    violationType: string;
    description: string | null;
    recordedAt: Date;
    createdAt: Date;
  }): ParkingViolationResponseDto {
    return {
      id: v.id,
      organizationId: v.organizationId,
      siteId: v.siteId,
      plateNumber: v.plateNumber,
      vehicleId: v.vehicleId,
      violationType: v.violationType,
      description: v.description,
      recordedAt: v.recordedAt,
      createdAt: v.createdAt,
    };
  }

  private toBlacklistDto(b: {
    id: string;
    organizationId: string;
    plateNumber: string;
    reason: string;
    isActive: boolean;
    createdAt: Date;
  }): VehicleBlacklistResponseDto {
    return {
      id: b.id,
      organizationId: b.organizationId,
      plateNumber: b.plateNumber,
      reason: b.reason,
      isActive: b.isActive,
      createdAt: b.createdAt,
    };
  }
}
