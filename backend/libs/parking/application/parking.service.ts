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
import { InvoicesService } from '@pssms/finance';
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
  UpdateParkingPermitDto,
  UpdatePermitStatusDto,
  UpdateVehicleDto,
  VehicleBlacklistResponseDto,
  VehicleResponseDto,
} from '../presentation/dto/parking.dto';

function blankToNull(value?: string | null): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const t = value.trim();
  return t.length ? t : null;
}

function normalizeRfidTag(value?: string | null): string | null | undefined {
  const cleared = blankToNull(value);
  if (cleared === undefined) return undefined;
  if (cleared === null) return null;
  return cleared.toUpperCase();
}

function decimalToNumber(
  value: Prisma.Decimal | number | null | undefined,
): number | null {
  if (value == null) return null;
  return typeof value === 'number' ? value : Number(value);
}

@Injectable()
export class ParkingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly invoices: InvoicesService,
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

    const rfidTagRef = normalizeRfidTag(dto.rfidTagRef);
    if (rfidTagRef) {
      await this.assertRfidAvailable(user.organizationId, rfidTagRef);
    }

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
        rfidTagRef: rfidTagRef ?? null,
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

  async updateVehicle(
    id: string,
    dto: UpdateVehicleDto,
    user: AuthUser,
  ): Promise<VehicleResponseDto> {
    const existing = await this.prisma.vehicle.findFirst({
      where: { id, organizationId: user.organizationId },
    });
    if (!existing) throw new NotFoundException('Vehicle not found');

    const data: Prisma.VehicleUpdateInput = {};

    if (dto.vehicleType !== undefined) data.vehicleType = dto.vehicleType;
    if (dto.make !== undefined) data.make = blankToNull(dto.make);
    if (dto.model !== undefined) data.model = blankToNull(dto.model);
    if (dto.color !== undefined) data.color = blankToNull(dto.color);
    if (dto.ownerName !== undefined) data.ownerName = blankToNull(dto.ownerName);
    if (dto.ownerPhone !== undefined) {
      data.ownerPhone = blankToNull(dto.ownerPhone);
    }
    if (dto.isActive !== undefined) data.isActive = dto.isActive;

    if (dto.rfidTagRef !== undefined) {
      const rfidTagRef = normalizeRfidTag(dto.rfidTagRef);
      if (rfidTagRef) {
        await this.assertRfidAvailable(
          user.organizationId,
          rfidTagRef,
          existing.id,
        );
      }
      data.rfidTagRef = rfidTagRef ?? null;
    }

    const updated = await this.prisma.vehicle.update({
      where: { id },
      data,
    });

    await this.audit.record({
      organizationId: user.organizationId,
      actorId: user.id,
      action: 'parking.vehicle.updated',
      resourceType: 'Vehicle',
      resourceId: id,
      before: existing,
      after: updated,
    });

    return this.toVehicleDto(updated);
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

  /** E3 — approved owner/driver: own vehicles + summary. */
  async getOwnerMe(user: AuthUser): Promise<{
    ownerUserId: string;
    email: string;
    fullName: string;
    vehicles: VehicleResponseDto[];
  }> {
    const vehicles = await this.listOwnerVehicles(user);
    return {
      ownerUserId: user.id,
      email: user.email,
      fullName: user.fullName,
      vehicles,
    };
  }

  async listOwnerVehicles(user: AuthUser): Promise<VehicleResponseDto[]> {
    const rows = await this.prisma.vehicle.findMany({
      where: {
        organizationId: user.organizationId,
        userId: user.id,
        isActive: true,
      },
      orderBy: { plateNumber: 'asc' },
    });
    return rows.map((v) => this.toVehicleDto(v));
  }

  async listOwnerPermits(user: AuthUser): Promise<ParkingPermitResponseDto[]> {
    const rows = await this.prisma.parkingPermit.findMany({
      where: {
        organizationId: user.organizationId,
        vehicle: { userId: user.id },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: {
        vehicle: { select: { plateNumber: true, make: true, model: true } },
      },
    });
    if (rows.length === 0) return [];

    const siteIds = [...new Set(rows.map((r) => r.siteId))];
    const sites = await this.prisma.site.findMany({
      where: { id: { in: siteIds } },
      select: { id: true, code: true, name: true },
    });
    const siteById = new Map(sites.map((s) => [s.id, s]));
    const invoiceNumbers = await this.invoiceNumberMap(
      user.organizationId,
      rows.map((r) => r.invoiceId),
    );

    return rows.map((p) => {
      const site = siteById.get(p.siteId);
      return this.toPermitDto(p, {
        plateNumber: p.vehicle.plateNumber,
        siteCode: site?.code ?? null,
        siteName: site?.name ?? null,
        invoiceNumber: p.invoiceId
          ? (invoiceNumbers.get(p.invoiceId) ?? null)
          : null,
      });
    });
  }

  async listOwnerEntries(user: AuthUser): Promise<ParkingEntryResponseDto[]> {
    const vehicles = await this.prisma.vehicle.findMany({
      where: {
        organizationId: user.organizationId,
        userId: user.id,
      },
      select: { id: true, plateNumber: true },
    });
    if (vehicles.length === 0) return [];

    const vehicleIds = vehicles.map((v) => v.id);
    const plates = vehicles.map((v) => v.plateNumber);

    const rows = await this.prisma.parkingEntry.findMany({
      where: {
        organizationId: user.organizationId,
        OR: [
          { vehicleId: { in: vehicleIds } },
          { plateNumber: { in: plates } },
        ],
      },
      orderBy: { recordedAt: 'desc' },
      take: 100,
    });
    if (rows.length === 0) return [];

    const siteIds = [...new Set(rows.map((r) => r.siteId))];
    const sites = await this.prisma.site.findMany({
      where: { id: { in: siteIds } },
      select: { id: true, code: true, name: true },
    });
    const siteById = new Map(sites.map((s) => [s.id, s]));

    return rows.map((e) => {
      const site = siteById.get(e.siteId);
      return this.toEntryDto(e, {
        siteCode: site?.code ?? null,
        siteName: site?.name ?? null,
      });
    });
  }

  async createPermit(
    dto: CreateParkingPermitDto,
    user: AuthUser,
  ): Promise<ParkingPermitResponseDto> {
    const vehicle = await this.prisma.vehicle.findFirst({
      where: { id: dto.vehicleId, organizationId: user.organizationId },
    });
    if (!vehicle) throw new NotFoundException('Vehicle not found');

    const currency =
      dto.currency?.trim() ||
      (dto.feeAmount != null ? 'TZS' : undefined);

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
        feeAmount:
          dto.feeAmount != null ? new Prisma.Decimal(dto.feeAmount) : null,
        currency: currency ?? 'TZS',
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

  async updatePermit(
    id: string,
    dto: UpdateParkingPermitDto,
    user: AuthUser,
  ): Promise<ParkingPermitResponseDto> {
    const permit = await this.findPermitOrThrow(id, user.organizationId);
    if (permit.invoiceId) {
      throw new ConflictException({
        error: 'ALREADY_BILLED',
        message: 'Cannot change fee after permit has been billed',
      });
    }

    const data: Prisma.ParkingPermitUpdateInput = {};
    if (dto.feeAmount !== undefined) {
      data.feeAmount =
        dto.feeAmount == null ? null : new Prisma.Decimal(dto.feeAmount);
    }
    if (dto.currency !== undefined) {
      const c = dto.currency.trim();
      data.currency = c.length ? c.toUpperCase() : 'TZS';
    }

    if (Object.keys(data).length === 0) {
      return this.toPermitDto(permit);
    }

    const updated = await this.prisma.parkingPermit.update({
      where: { id },
      data,
    });

    await this.audit.record({
      organizationId: user.organizationId,
      actorId: user.id,
      action: 'parking.permit.updated',
      resourceType: 'ParkingPermit',
      resourceId: id,
      after: {
        feeAmount: decimalToNumber(updated.feeAmount),
        currency: updated.currency,
      },
    });

    return this.enrichPermitDto(updated);
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
      include: {
        vehicle: { select: { plateNumber: true, make: true, model: true } },
      },
    });
    if (rows.length === 0) return [];

    const siteIds = [...new Set(rows.map((r) => r.siteId))];
    const sites = await this.prisma.site.findMany({
      where: { id: { in: siteIds } },
      select: { id: true, code: true, name: true },
    });
    const siteById = new Map(sites.map((s) => [s.id, s]));
    const invoiceNumbers = await this.invoiceNumberMap(
      user.organizationId,
      rows.map((r) => r.invoiceId),
    );

    return rows.map((p) => {
      const site = siteById.get(p.siteId);
      return this.toPermitDto(p, {
        plateNumber: p.vehicle?.plateNumber ?? null,
        siteCode: site?.code ?? null,
        siteName: site?.name ?? null,
        invoiceNumber: p.invoiceId
          ? (invoiceNumbers.get(p.invoiceId) ?? null)
          : null,
      });
    });
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

    return this.enrichPermitDto(updated);
  }

  /**
   * Module 13-B — create DRAFT invoice for permit fee via Finance InvoicesService.
   * Approve does not auto-bill. Requires ACTIVE permit + vehicle.customerId.
   */
  async billPermit(
    id: string,
    user: AuthUser,
  ): Promise<ParkingPermitResponseDto> {
    const permit = await this.findPermitOrThrow(id, user.organizationId);

    if (permit.invoiceId) {
      throw new ConflictException({
        error: 'ALREADY_BILLED',
        message: 'Permit already has a linked invoice',
      });
    }

    // Design text says ACTIVE or APPROVED — enum has ACTIVE after approve.
    if (permit.status !== PermitStatus.ACTIVE) {
      throw new BadRequestException({
        error: 'PERMIT_NOT_BILLABLE',
        message: 'Only ACTIVE permits can be billed',
      });
    }

    const fee = decimalToNumber(permit.feeAmount);
    if (fee == null || fee <= 0) {
      throw new BadRequestException({
        error: 'FEE_REQUIRED',
        message: 'Permit feeAmount must be greater than zero to bill',
      });
    }

    const vehicle = await this.prisma.vehicle.findFirst({
      where: { id: permit.vehicleId, organizationId: user.organizationId },
      select: { id: true, customerId: true, plateNumber: true },
    });
    if (!vehicle) throw new NotFoundException('Vehicle not found');
    if (!vehicle.customerId) {
      throw new BadRequestException({
        error: 'CUSTOMER_REQUIRED_FOR_BILLING',
        message: 'Vehicle must have customerId to create a parking invoice',
      });
    }

    const currency = (permit.currency?.trim() || 'TZS').toUpperCase();
    const issue = new Date();
    const due = new Date(issue);
    due.setDate(due.getDate() + 30);
    const ymd = issue.toISOString().slice(0, 10).replace(/-/g, '');
    const invoiceNumber = `INV-PRK-${permit.permitNumber}-${ymd}`;

    const invoice = await this.invoices.create(
      {
        customerId: vehicle.customerId,
        invoiceNumber,
        issueDate: issue.toISOString().slice(0, 10),
        dueDate: due.toISOString().slice(0, 10),
        currency,
        notes: `Parking permit ${permit.permitNumber} · ${vehicle.plateNumber}`,
        lines: [
          {
            description: `Parking permit ${permit.permitNumber}`,
            quantity: 1,
            unitPrice: fee,
          },
        ],
      },
      user,
    );

    const billedAt = new Date();
    const updated = await this.prisma.parkingPermit.update({
      where: { id },
      data: {
        invoiceId: invoice.id,
        billedAt,
      },
    });

    await this.audit.record({
      organizationId: user.organizationId,
      actorId: user.id,
      action: 'parking.permit.billed',
      resourceType: 'ParkingPermit',
      resourceId: id,
      after: {
        permitNumber: permit.permitNumber,
        feeAmount: fee,
        currency,
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        customerId: vehicle.customerId,
        billedAt,
      },
    });

    return this.toPermitDto(updated, {
      invoiceNumber: invoice.invoiceNumber,
    });
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
    if (rows.length === 0) return [];

    const siteIds = [...new Set(rows.map((r) => r.siteId))];
    const sites = await this.prisma.site.findMany({
      where: { id: { in: siteIds } },
      select: { id: true, code: true, name: true },
    });
    const siteById = new Map(sites.map((s) => [s.id, s]));

    return rows.map((v) => {
      const site = siteById.get(v.siteId);
      return this.toViolationDto(v, {
        siteCode: site?.code ?? null,
        siteName: site?.name ?? null,
      });
    });
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

    const rfidTagRef = normalizeRfidTag(dto.rfidTagRef) ?? undefined;
    let vehicle =
      rfidTagRef != null
        ? await this.prisma.vehicle.findFirst({
            where: {
              organizationId: user.organizationId,
              rfidTagRef,
            },
          })
        : null;

    const plateRaw = dto.plateNumber?.trim();
    if (!plateRaw && !vehicle) {
      throw new BadRequestException({
        error: rfidTagRef ? 'RFID_TAG_UNKNOWN' : 'PLATE_OR_RFID_REQUIRED',
        message: rfidTagRef
          ? 'No vehicle registered for this RFID tag'
          : 'plateNumber or rfidTagRef is required',
      });
    }

    const plate = (plateRaw ? plateRaw.toUpperCase() : vehicle!.plateNumber).toUpperCase();

    if (!vehicle) {
      vehicle = await this.prisma.vehicle.findFirst({
        where: { organizationId: user.organizationId, plateNumber: plate },
      });
    } else if (plateRaw && vehicle.plateNumber !== plate) {
      throw new BadRequestException({
        error: 'RFID_PLATE_MISMATCH',
        message: 'rfidTagRef does not match plateNumber',
      });
    }

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
      // RFID path: ALLOW only when vehicle active + ACTIVE permit at site
      if (rfidTagRef) {
        if (!vehicle?.isActive) {
          decision = ParkingDecision.DENY;
        } else {
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
                description: 'RFID entry — no active permit at site',
                createdBy: user.id,
              },
            });
          }
        }
      } else {
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
    }

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
      after: {
        ...entry,
        ...(rfidTagRef ? { via: 'rfid', rfidTagRef } : {}),
      },
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
    if (rows.length === 0) return [];

    const siteIds = [...new Set(rows.map((r) => r.siteId))];
    const sites = await this.prisma.site.findMany({
      where: { id: { in: siteIds } },
      select: { id: true, code: true, name: true },
    });
    const siteById = new Map(sites.map((s) => [s.id, s]));

    return rows.map((e) => {
      const site = siteById.get(e.siteId);
      return this.toEntryDto(e, {
        siteCode: site?.code ?? null,
        siteName: site?.name ?? null,
      });
    });
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
    if (rows.length === 0) return [];

    const siteIds = [...new Set(rows.map((r) => r.siteId))];
    const sites = await this.prisma.site.findMany({
      where: { id: { in: siteIds } },
      select: { id: true, code: true, name: true },
    });
    const siteById = new Map(sites.map((s) => [s.id, s]));

    return rows.map((r) => {
      const site = siteById.get(r.siteId);
      return this.toAnprDto(r, {
        siteCode: site?.code ?? null,
        siteName: site?.name ?? null,
      });
    });
  }

  private async assertRfidAvailable(
    organizationId: string,
    rfidTagRef: string,
    excludeVehicleId?: string,
  ) {
    const clash = await this.prisma.vehicle.findFirst({
      where: {
        organizationId,
        rfidTagRef,
        ...(excludeVehicleId ? { id: { not: excludeVehicleId } } : {}),
      },
      select: { id: true, plateNumber: true },
    });
    if (clash) {
      throw new ConflictException({
        error: 'RFID_TAG_IN_USE',
        message: `RFID tag already assigned to ${clash.plateNumber}`,
      });
    }
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
    rfidTagRef?: string | null;
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
      rfidTagRef: v.rfidTagRef ?? null,
      isActive: v.isActive,
      createdAt: v.createdAt,
    };
  }

  private async invoiceNumberMap(
    organizationId: string,
    invoiceIds: Array<string | null | undefined>,
  ): Promise<Map<string, string>> {
    const ids = [
      ...new Set(invoiceIds.filter((id): id is string => !!id)),
    ];
    if (ids.length === 0) return new Map();
    const rows = await this.prisma.invoice.findMany({
      where: { organizationId, id: { in: ids } },
      select: { id: true, invoiceNumber: true },
    });
    return new Map(rows.map((r) => [r.id, r.invoiceNumber]));
  }

  private async enrichPermitDto(p: {
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
    feeAmount?: Prisma.Decimal | number | null;
    currency?: string | null;
    invoiceId?: string | null;
    billedAt?: Date | null;
  }): Promise<ParkingPermitResponseDto> {
    let invoiceNumber: string | null = null;
    if (p.invoiceId) {
      const map = await this.invoiceNumberMap(p.organizationId, [p.invoiceId]);
      invoiceNumber = map.get(p.invoiceId) ?? null;
    }
    return this.toPermitDto(p, { invoiceNumber });
  }

  private toPermitDto(
    p: {
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
      feeAmount?: Prisma.Decimal | number | null;
      currency?: string | null;
      invoiceId?: string | null;
      billedAt?: Date | null;
    },
    labels?: {
      plateNumber?: string | null;
      siteCode?: string | null;
      siteName?: string | null;
      invoiceNumber?: string | null;
    },
  ): ParkingPermitResponseDto {
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
      feeAmount: decimalToNumber(p.feeAmount),
      currency: p.currency ?? null,
      invoiceId: p.invoiceId ?? null,
      invoiceNumber: labels?.invoiceNumber ?? null,
      billedAt: p.billedAt ?? null,
      plateNumber: labels?.plateNumber ?? null,
      siteCode: labels?.siteCode ?? null,
      siteName: labels?.siteName ?? null,
    };
  }

  private toAnprDto(
    r: {
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
    },
    labels?: { siteCode?: string | null; siteName?: string | null },
  ): AnprResultResponseDto {
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
      siteCode: labels?.siteCode ?? null,
      siteName: labels?.siteName ?? null,
    };
  }

  private toEntryDto(
    e: {
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
    },
    labels?: { siteCode?: string | null; siteName?: string | null },
  ): ParkingEntryResponseDto {
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
      siteCode: labels?.siteCode ?? null,
      siteName: labels?.siteName ?? null,
    };
  }

  private toViolationDto(
    v: {
      id: string;
      organizationId: string;
      siteId: string;
      plateNumber: string;
      vehicleId: string | null;
      violationType: string;
      description: string | null;
      recordedAt: Date;
      createdAt: Date;
    },
    labels?: { siteCode?: string | null; siteName?: string | null },
  ): ParkingViolationResponseDto {
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
      siteCode: labels?.siteCode ?? null,
      siteName: labels?.siteName ?? null,
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
