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
  PermitType,
  Prisma,
  ViolationType,
  ParkingViolationStatus,
  AppointmentStatus,
  ParkingCategory,
  ParkingSpaceType,
  ParkingSpaceStatus,
  ParkingAllocationMode,
  ParkingVerificationMethod,
  ParkingPatrolObservationType,
  ParkingBillingPeriod,
} from '@prisma/client';
import {
  PrismaService,
  AuthUser,
  assertSiteAccess,
  isGuardSelfScoped,
  siteScopeWhere,
} from '@pssms/shared';
import { AuditService } from '@pssms/audit';
import { InvoicesService } from '@pssms/finance';
import { OutboxWriterService } from '@pssms/notifications';
import {
  AllocateParkingSpaceDto,
  AnprResultResponseDto,
  CreateAnprResultDto,
  CreateParkingEntryDto,
  CreateParkingPermitDto,
  CreateParkingPatrolObservationDto,
  CreateParkingSpaceDto,
  CreateParkingViolationDto,
  ApproveParkingViolationClosureDto,
  UpdateParkingViolationDto,
  CreateVehicleBlacklistDto,
  CreateVehicleDto,
  DecideAnprResultDto,
  ParkingEntryResponseDto,
  ParkingPermitResponseDto,
  ParkingPatrolObservationResponseDto,
  ParkingSpaceResponseDto,
  ParkingViolationResponseDto,
  ResolveParkingViolationDto,
  UpdateParkingPermitDto,
  UpdateParkingSpaceDto,
  UpdatePermitStatusDto,
  UpdateVehicleDto,
  VehicleBlacklistResponseDto,
  VehicleResponseDto,
} from '../presentation/dto/parking.dto';

/** Module 13-K — FieldAlert types for parking entry/exit (ops / supervisor ladder). */
const PARKING_BLACKLISTED_ALERT = 'PARKING_BLACKLISTED';
const PARKING_UNAUTHORIZED_ALERT = 'PARKING_UNAUTHORIZED';
const PARKING_EXPIRED_PERMIT_ALERT = 'PARKING_EXPIRED_PERMIT';
const PARKING_FORCED_ENTRY_ALERT = 'PARKING_FORCED_ENTRY';
const PARKING_DUPLICATE_ENTRY_ALERT = 'PARKING_DUPLICATE_ENTRY';
/** Module 13-M */
const PARKING_PATROL_ALERT = 'PARKING_PATROL_OBSERVATION';

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

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Module 13-O — derive net fee from rate × period + penalty − discount */
function resolvePermitChargeInputs(input: {
  billingPeriod?: ParkingBillingPeriod | string | null;
  unitRate?: number | null;
  quantity?: number | null;
  discountAmount?: number | null;
  penaltyAmount?: number | null;
  feeAmount?: number | null;
  validFrom: Date;
  validUntil: Date;
  preferExplicitFee?: boolean;
}): {
  billingPeriod: ParkingBillingPeriod;
  unitRate: number | null;
  quantity: number | null;
  discountAmount: number | null;
  penaltyAmount: number | null;
  feeAmount: number | null;
} {
  const discount =
    input.discountAmount != null && input.discountAmount > 0
      ? roundMoney(input.discountAmount)
      : null;
  const penalty =
    input.penaltyAmount != null && input.penaltyAmount > 0
      ? roundMoney(input.penaltyAmount)
      : null;

  // Legacy: only feeAmount set → ONE_TIME flat
  if (input.preferExplicitFee && input.feeAmount != null) {
    const fee = roundMoney(Math.max(0, input.feeAmount));
    return {
      billingPeriod: ParkingBillingPeriod.ONE_TIME,
      unitRate: fee,
      quantity: 1,
      discountAmount: discount,
      penaltyAmount: penalty,
      feeAmount: roundMoney(Math.max(0, fee - (discount ?? 0) + (penalty ?? 0))),
    };
  }

  let period = (input.billingPeriod as ParkingBillingPeriod | undefined) ??
    ParkingBillingPeriod.ONE_TIME;
  if (
    period !== ParkingBillingPeriod.ONE_TIME &&
    period !== ParkingBillingPeriod.DAILY &&
    period !== ParkingBillingPeriod.MONTHLY
  ) {
    period = ParkingBillingPeriod.ONE_TIME;
  }

  let quantity = input.quantity != null ? roundMoney(input.quantity) : null;
  let unitRate = input.unitRate != null ? roundMoney(input.unitRate) : null;

  if (quantity == null || quantity <= 0) {
    if (period === ParkingBillingPeriod.DAILY) {
      const ms = input.validUntil.getTime() - input.validFrom.getTime();
      quantity = Math.max(1, Math.ceil(ms / (24 * 60 * 60 * 1000)));
    } else if (period === ParkingBillingPeriod.MONTHLY) {
      const months =
        (input.validUntil.getFullYear() - input.validFrom.getFullYear()) * 12 +
        (input.validUntil.getMonth() - input.validFrom.getMonth());
      quantity = Math.max(1, months || 1);
    } else if (unitRate != null || input.feeAmount != null) {
      quantity = 1;
    }
  }

  if (unitRate == null && input.feeAmount != null && period === ParkingBillingPeriod.ONE_TIME) {
    unitRate = roundMoney(input.feeAmount);
    quantity = quantity ?? 1;
  }

  if (unitRate == null && input.feeAmount == null) {
    return {
      billingPeriod: period,
      unitRate: null,
      quantity,
      discountAmount: discount,
      penaltyAmount: penalty,
      feeAmount: null,
    };
  }

  if (unitRate == null) {
    throw new BadRequestException({
      error: 'UNIT_RATE_REQUIRED',
      message: 'unitRate is required for DAILY/MONTHLY charge calculation',
    });
  }

  const qty = quantity ?? 1;
  const gross = roundMoney(unitRate * qty);
  const fee = roundMoney(Math.max(0, gross - (discount ?? 0) + (penalty ?? 0)));

  return {
    billingPeriod: period,
    unitRate,
    quantity: qty,
    discountAmount: discount,
    penaltyAmount: penalty,
    feeAmount: fee,
  };
}

@Injectable()
export class ParkingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly invoices: InvoicesService,
    private readonly outbox: OutboxWriterService,
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

    // Module 13-C — portal hosts: force customerId from JWT (ignore body).
    const portalCustomerId = user.customerId ?? undefined;
    let customerId = portalCustomerId ?? dto.customerId;

    // Module 13-I — portal forced to CUSTOMER; ops default COMPANY when no customer.
    const parkingCategory = portalCustomerId
      ? ParkingCategory.CUSTOMER
      : (dto.parkingCategory ??
        (customerId ? ParkingCategory.CUSTOMER : ParkingCategory.COMPANY));

    customerId = this.resolveCustomerForCategory({
      parkingCategory,
      customerId,
      portalForced: Boolean(portalCustomerId),
    });

    // Module 13-E — ops may attach an org customer; reject cross-tenant / inactive.
    if (customerId && !portalCustomerId) {
      const customer = await this.prisma.customer.findFirst({
        where: {
          id: customerId,
          organizationId: user.organizationId,
          isActive: true,
        },
        select: { id: true },
      });
      if (!customer) {
        throw new BadRequestException({
          code: 'INVALID_CUSTOMER',
          message: 'customerId must be an active customer in this organization',
        });
      }
    } else if (!customerId) {
      customerId = undefined;
    }

    // RFID remains ops-only (Module 13-A) — portal cannot set tags.
    const rfidTagRef = portalCustomerId
      ? null
      : normalizeRfidTag(dto.rfidTagRef);
    if (rfidTagRef) {
      await this.assertRfidAvailable(user.organizationId, rfidTagRef);
    }

    const driverPhone = this.normalizeDriverPhone(dto.driverPhone);

    const vehicle = await this.prisma.vehicle.create({
      data: {
        organizationId: user.organizationId,
        customerId,
        plateNumber: dto.plateNumber.toUpperCase(),
        vehicleType: dto.vehicleType ?? 'CAR',
        parkingCategory,
        make: blankToNull(dto.make) ?? undefined,
        model: blankToNull(dto.model) ?? undefined,
        color: blankToNull(dto.color) ?? undefined,
        ownerName: blankToNull(dto.ownerName) ?? undefined,
        ownerPhone: blankToNull(dto.ownerPhone) ?? undefined,
        driverName: blankToNull(dto.driverName) ?? undefined,
        driverPhone: driverPhone ?? undefined,
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
      after: {
        ...vehicle,
        ...(portalCustomerId ? { via: 'customer_portal' } : {}),
      },
    });

    return this.toVehicleDto(vehicle);
  }

  async updateVehicle(
    id: string,
    dto: UpdateVehicleDto,
    user: AuthUser,
  ): Promise<VehicleResponseDto> {
    const portalCustomerId = user.customerId ?? undefined;
    const existing = await this.prisma.vehicle.findFirst({
      where: {
        id,
        organizationId: user.organizationId,
        ...(portalCustomerId ? { customerId: portalCustomerId } : {}),
      },
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
    if (dto.driverName !== undefined) {
      data.driverName = blankToNull(dto.driverName);
    }
    if (dto.driverPhone !== undefined) {
      data.driverPhone = this.normalizeDriverPhone(dto.driverPhone);
    }
    if (dto.isActive !== undefined) data.isActive = dto.isActive;

    // Module 13-I — portal cannot change category away from CUSTOMER.
    if (dto.parkingCategory !== undefined) {
      if (portalCustomerId) {
        if (dto.parkingCategory !== ParkingCategory.CUSTOMER) {
          throw new BadRequestException({
            error: 'PORTAL_CATEGORY_LOCKED',
            message: 'Customer portal vehicles must remain CUSTOMER category',
          });
        }
        data.parkingCategory = ParkingCategory.CUSTOMER;
      } else {
        const nextCategory = dto.parkingCategory;
        const fleetOnly =
          nextCategory === ParkingCategory.COMPANY ||
          nextCategory === ParkingCategory.PATROL ||
          nextCategory === ParkingCategory.EMERGENCY;
        const requiresCustomer =
          nextCategory === ParkingCategory.CUSTOMER ||
          nextCategory === ParkingCategory.CUSTOMER_EMPLOYEE;

        this.resolveCustomerForCategory({
          parkingCategory: nextCategory,
          customerId: existing.customerId ?? undefined,
          portalForced: false,
          allowMissingCustomer: !requiresCustomer,
        });
        data.parkingCategory = nextCategory;
        if (fleetOnly && existing.customerId) {
          data.customerId = null;
        }
      }
    }

    // RFID ops-only — ignore portal attempts to set/clear tags.
    if (!portalCustomerId && dto.rfidTagRef !== undefined) {
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
      after: {
        ...updated,
        ...(portalCustomerId ? { via: 'customer_portal' } : {}),
      },
    });

    return this.toVehicleDto(updated);
  }

  async listVehicles(
    user: AuthUser,
    customerId?: string,
  ): Promise<VehicleResponseDto[]> {
    // Module 13-E — ops + portal include inactive for deactivate/reactivate UX.
    const rows = await this.prisma.vehicle.findMany({
      where: {
        organizationId: user.organizationId,
        ...(customerId ? { customerId } : {}),
      },
      orderBy: { plateNumber: 'asc' },
    });
    return rows.map((v) => this.toVehicleDto(v));
  }

  /** Module 13-E — thin customer picker (id/code/name only; no CRM PII dump). */
  async listCustomerOptions(
    user: AuthUser,
  ): Promise<
    Array<{ id: string; code: string; name: string; isActive: boolean }>
  > {
    return this.prisma.customer.findMany({
      where: { organizationId: user.organizationId, isActive: true },
      select: { id: true, code: true, name: true, isActive: true },
      orderBy: { code: 'asc' },
      take: 500,
    });
  }

  /** Module 13-F — thin active sites + gates for manual gate punch. */
  async listSiteOptions(user: AuthUser): Promise<
    Array<{
      id: string;
      code: string;
      name: string;
      gates: Array<{ id: string; code: string; name: string }>;
    }>
  > {
    const sites = await this.prisma.site.findMany({
      where: { organizationId: user.organizationId, isActive: true },
      select: {
        id: true,
        code: true,
        name: true,
        gates: {
          where: { isActive: true },
          select: { id: true, code: true, name: true },
          orderBy: { code: 'asc' },
        },
      },
      orderBy: { code: 'asc' },
      take: 200,
    });
    return sites;
  }

  /** Module 13-H — thin APPROVED/COMPLETED appointments for permit link. */
  async listVisitorAppointmentOptions(user: AuthUser): Promise<
    Array<{
      id: string;
      referenceNumber: string;
      visitorName: string;
      siteId: string;
      customerId: string;
      status: string;
      vehiclePlate: string | null;
      validFrom: Date;
      validUntil: Date;
    }>
  > {
    const portalCustomerId = user.customerId ?? undefined;
    return this.prisma.visitorAppointment.findMany({
      where: {
        organizationId: user.organizationId,
        status: {
          in: [AppointmentStatus.APPROVED, AppointmentStatus.COMPLETED],
        },
        ...(portalCustomerId ? { customerId: portalCustomerId } : {}),
      },
      select: {
        id: true,
        referenceNumber: true,
        visitorName: true,
        siteId: true,
        customerId: true,
        status: true,
        vehiclePlate: true,
        validFrom: true,
        validUntil: true,
      },
      orderBy: { validFrom: 'desc' },
      take: 100,
    });
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
    const payMap = await this.invoices.paymentSummaries(
      user.organizationId,
      rows.map((r) => r.invoiceId),
    );
    const visitorLabels = await this.visitorAppointmentLabelMap(
      user.organizationId,
      rows.map((r) => r.visitorAppointmentId),
    );

    return rows.map((p) => {
      const site = siteById.get(p.siteId);
      const visit = p.visitorAppointmentId
        ? visitorLabels.get(p.visitorAppointmentId)
        : undefined;
      const pay = p.invoiceId ? payMap.get(p.invoiceId) : undefined;
      return this.toPermitDto(p, {
        plateNumber: p.vehicle.plateNumber,
        siteCode: site?.code ?? null,
        siteName: site?.name ?? null,
        invoiceNumber: pay?.invoiceNumber ?? null,
        invoiceStatus: pay?.status ?? null,
        amountPaid: pay?.amountPaid ?? null,
        balanceDue: pay?.balanceDue ?? null,
        visitorReferenceNumber: visit?.referenceNumber ?? null,
        visitorName: visit?.visitorName ?? null,
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
    const enriched = await this.enrichParkingEntryDtos(
      rows,
      user.organizationId,
    );
    // E3 owner self-view — redact ops/PII visit fields.
    return enriched.map((e) => ({
      ...e,
      driverIdRef: null,
      recordedBy: null,
      recordedByName: null,
      visitorAppointmentId: null,
      visitorReferenceNumber: null,
      visitorName: null,
      purposeOfVisit: null,
      fieldAlertId: null,
      fieldAlertIds: [],
    }));
  }

  async createPermit(
    dto: CreateParkingPermitDto,
    user: AuthUser,
  ): Promise<ParkingPermitResponseDto> {
    // Module 13-D — portal hosts: own vehicles/sites only; always PENDING; no fee self-set.
    const portalCustomerId = user.customerId ?? undefined;

    const vehicle = await this.prisma.vehicle.findFirst({
      where: {
        id: dto.vehicleId,
        organizationId: user.organizationId,
        ...(portalCustomerId ? { customerId: portalCustomerId } : {}),
      },
    });
    if (!vehicle) throw new NotFoundException('Vehicle not found');
    if (!vehicle.isActive) {
      throw new BadRequestException({
        error: 'VEHICLE_INACTIVE',
        message: 'Cannot issue a permit for an inactive vehicle',
      });
    }

    const site = await this.prisma.site.findFirst({
      where: {
        id: dto.siteId,
        organizationId: user.organizationId,
        ...(portalCustomerId
          ? { customerId: portalCustomerId, isActive: true }
          : {}),
      },
      select: { id: true, code: true, name: true },
    });
    if (!site) throw new NotFoundException('Site not found');

    // Module 13-H — optional visitor appointment soft-link.
    let visitorAppointmentId: string | undefined;
    let visitorLabels: {
      visitorReferenceNumber?: string | null;
      visitorName?: string | null;
    } = {};
    if (dto.visitorAppointmentId) {
      const link = await this.resolveVisitorAppointmentLink({
        appointmentId: dto.visitorAppointmentId,
        organizationId: user.organizationId,
        siteId: site.id,
        vehicleCustomerId: vehicle.customerId,
        permitType: dto.permitType,
        portalCustomerId,
      });
      visitorAppointmentId = link.id;
      visitorLabels = {
        visitorReferenceNumber: link.referenceNumber,
        visitorName: link.visitorName,
      };
    }

    const now = new Date();
    const validFrom = dto.validFrom ? new Date(dto.validFrom) : now;
    const validUntil = dto.validUntil
      ? new Date(dto.validUntil)
      : new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);
    if (
      Number.isNaN(validFrom.getTime()) ||
      Number.isNaN(validUntil.getTime())
    ) {
      throw new BadRequestException('Invalid permit dates');
    }
    if (validUntil <= validFrom) {
      throw new BadRequestException({
        error: 'INVALID_PERMIT_DATES',
        message: 'validUntil must be after validFrom',
      });
    }

    let permitNumber = dto.permitNumber?.trim();
    if (portalCustomerId || !permitNumber) {
      permitNumber = await this.nextPortalPermitNumber(user.organizationId);
    }

    const charge = portalCustomerId
      ? {
          billingPeriod: ParkingBillingPeriod.ONE_TIME,
          unitRate: null as number | null,
          quantity: null as number | null,
          discountAmount: null as number | null,
          penaltyAmount: null as number | null,
          feeAmount: null as number | null,
        }
      : resolvePermitChargeInputs({
          billingPeriod: dto.billingPeriod,
          unitRate: dto.unitRate,
          quantity: dto.quantity,
          discountAmount: dto.discountAmount,
          penaltyAmount: dto.penaltyAmount,
          feeAmount: dto.feeAmount,
          validFrom,
          validUntil,
        });

    const currency = portalCustomerId
      ? 'TZS'
      : dto.currency?.trim() ||
        (charge.feeAmount != null ? 'TZS' : undefined);

    const permit = await this.prisma.parkingPermit.create({
      data: {
        organizationId: user.organizationId,
        vehicleId: dto.vehicleId,
        siteId: dto.siteId,
        permitNumber,
        permitType: dto.permitType,
        status: PermitStatus.PENDING,
        validFrom,
        validUntil,
        feeAmount:
          charge.feeAmount != null
            ? new Prisma.Decimal(charge.feeAmount)
            : null,
        currency: currency ?? 'TZS',
        billingPeriod: charge.billingPeriod,
        unitRate:
          charge.unitRate != null
            ? new Prisma.Decimal(charge.unitRate)
            : null,
        quantity:
          charge.quantity != null
            ? new Prisma.Decimal(charge.quantity)
            : null,
        discountAmount:
          charge.discountAmount != null
            ? new Prisma.Decimal(charge.discountAmount)
            : null,
        penaltyAmount:
          charge.penaltyAmount != null
            ? new Prisma.Decimal(charge.penaltyAmount)
            : null,
        visitorAppointmentId: visitorAppointmentId ?? null,
        createdBy: user.id,
      },
    });

    await this.audit.record({
      organizationId: user.organizationId,
      actorId: user.id,
      action: 'parking.permit.created',
      resourceType: 'ParkingPermit',
      resourceId: permit.id,
      after: {
        ...permit,
        ...(portalCustomerId ? { via: 'customer_portal' } : {}),
        ...(visitorAppointmentId
          ? { visitorAppointmentId, ...visitorLabels }
          : {}),
      },
    });

    return this.toPermitDto(permit, {
      plateNumber: vehicle.plateNumber,
      siteCode: site.code,
      siteName: site.name,
      ...visitorLabels,
    });
  }

  /** Org-unique request numbers for portal (and ops when number omitted). */
  private async nextPortalPermitNumber(
    organizationId: string,
  ): Promise<string> {
    for (let i = 0; i < 8; i++) {
      const suffix = Math.random().toString(36).slice(2, 8).toUpperCase();
      const ymd = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const permitNumber = `PRM-REQ-${ymd}-${suffix}`;
      const exists = await this.prisma.parkingPermit.findFirst({
        where: { organizationId, permitNumber },
        select: { id: true },
      });
      if (!exists) return permitNumber;
    }
    throw new ConflictException('Could not allocate permit number');
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

    const chargeTouched =
      dto.billingPeriod !== undefined ||
      dto.unitRate !== undefined ||
      dto.quantity !== undefined ||
      dto.discountAmount !== undefined ||
      dto.penaltyAmount !== undefined ||
      dto.feeAmount !== undefined;

    const data: Prisma.ParkingPermitUpdateInput = {};
    if (dto.currency !== undefined) {
      const c = dto.currency.trim();
      data.currency = c.length ? c.toUpperCase() : 'TZS';
    }

    if (chargeTouched) {
      const charge = resolvePermitChargeInputs({
        billingPeriod:
          dto.billingPeriod ??
          (permit.billingPeriod as ParkingBillingPeriod | undefined),
        unitRate:
          dto.unitRate !== undefined
            ? dto.unitRate
            : decimalToNumber(permit.unitRate),
        quantity:
          dto.quantity !== undefined
            ? dto.quantity
            : decimalToNumber(permit.quantity),
        discountAmount:
          dto.discountAmount !== undefined
            ? dto.discountAmount
            : decimalToNumber(permit.discountAmount),
        penaltyAmount:
          dto.penaltyAmount !== undefined
            ? dto.penaltyAmount
            : decimalToNumber(permit.penaltyAmount),
        feeAmount:
          dto.feeAmount !== undefined
            ? dto.feeAmount
            : decimalToNumber(permit.feeAmount),
        validFrom: permit.validFrom,
        validUntil: permit.validUntil,
        preferExplicitFee:
          dto.feeAmount !== undefined &&
          dto.unitRate === undefined &&
          dto.quantity === undefined &&
          dto.billingPeriod === undefined,
      });
      data.billingPeriod = charge.billingPeriod;
      data.unitRate =
        charge.unitRate != null
          ? new Prisma.Decimal(charge.unitRate)
          : null;
      data.quantity =
        charge.quantity != null
          ? new Prisma.Decimal(charge.quantity)
          : null;
      data.discountAmount =
        charge.discountAmount != null
          ? new Prisma.Decimal(charge.discountAmount)
          : null;
      data.penaltyAmount =
        charge.penaltyAmount != null
          ? new Prisma.Decimal(charge.penaltyAmount)
          : null;
      data.feeAmount =
        charge.feeAmount != null
          ? new Prisma.Decimal(charge.feeAmount)
          : null;
    }

    if (Object.keys(data).length === 0) {
      return this.enrichPermitDto(permit);
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
        billingPeriod: updated.billingPeriod,
        unitRate: decimalToNumber(updated.unitRate),
        quantity: decimalToNumber(updated.quantity),
        discountAmount: decimalToNumber(updated.discountAmount),
        penaltyAmount: decimalToNumber(updated.penaltyAmount),
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
    const payMap = await this.invoices.paymentSummaries(
      user.organizationId,
      rows.map((r) => r.invoiceId),
    );
    const visitorLabels = await this.visitorAppointmentLabelMap(
      user.organizationId,
      rows.map((r) => r.visitorAppointmentId),
    );

    return rows.map((p) => {
      const site = siteById.get(p.siteId);
      const visit = p.visitorAppointmentId
        ? visitorLabels.get(p.visitorAppointmentId)
        : undefined;
      const pay = p.invoiceId ? payMap.get(p.invoiceId) : undefined;
      return this.toPermitDto(p, {
        plateNumber: p.vehicle?.plateNumber ?? null,
        siteCode: site?.code ?? null,
        siteName: site?.name ?? null,
        invoiceNumber: pay?.invoiceNumber ?? null,
        invoiceStatus: pay?.status ?? null,
        amountPaid: pay?.amountPaid ?? null,
        balanceDue: pay?.balanceDue ?? null,
        visitorReferenceNumber: visit?.referenceNumber ?? null,
        visitorName: visit?.visitorName ?? null,
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

    const vehicle = await this.prisma.vehicle.findFirst({
      where: { id: permit.vehicleId, organizationId: user.organizationId },
      select: { id: true, isActive: true },
    });
    if (!vehicle?.isActive) {
      throw new BadRequestException({
        error: 'VEHICLE_INACTIVE',
        message: 'Cannot approve a permit for an inactive vehicle',
      });
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
   * Module 13-O — create invoice for calculated charges via Finance InvoicesService.
   * Optional sendInvoice → SENT for electronic invoicing. Approve does not auto-bill.
   */
  async billPermit(
    id: string,
    user: AuthUser,
    opts?: { sendInvoice?: boolean },
  ): Promise<ParkingPermitResponseDto> {
    const permit = await this.findPermitOrThrow(id, user.organizationId);

    if (permit.invoiceId) {
      throw new ConflictException({
        error: 'ALREADY_BILLED',
        message: 'Permit already has a linked invoice',
      });
    }

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

    const unitRate = decimalToNumber(permit.unitRate) ?? fee;
    const quantity = decimalToNumber(permit.quantity) ?? 1;
    const discount = decimalToNumber(permit.discountAmount) ?? 0;
    const penalty = decimalToNumber(permit.penaltyAmount) ?? 0;
    const period = permit.billingPeriod ?? ParkingBillingPeriod.ONE_TIME;
    const periodLabel =
      period === ParkingBillingPeriod.DAILY
        ? 'daily'
        : period === ParkingBillingPeriod.MONTHLY
          ? 'monthly'
          : 'one-time';

    let baseQty = quantity;
    let baseUnit = unitRate;
    const gross = roundMoney(unitRate * quantity);
    const afterDiscount = Math.max(0, gross - discount);
    if (discount > 0 && baseQty > 0) {
      baseUnit = roundMoney(afterDiscount / baseQty);
    }
    const lines: Array<{
      description: string;
      quantity: number;
      unitPrice: number;
    }> = [
      {
        description: `${permit.permitType} parking · ${periodLabel} · ${permit.permitNumber}`,
        quantity: baseQty,
        unitPrice: baseUnit,
      },
    ];
    if (penalty > 0) {
      lines.push({
        description: `Parking penalty · ${permit.permitNumber}`,
        quantity: 1,
        unitPrice: penalty,
      });
    }

    let invoice = await this.invoices.create(
      {
        customerId: vehicle.customerId,
        invoiceNumber,
        issueDate: issue.toISOString().slice(0, 10),
        dueDate: due.toISOString().slice(0, 10),
        currency,
        serviceType: 'PARKING',
        notes: [
          `Parking permit ${permit.permitNumber} · ${vehicle.plateNumber}`,
          `Period ${periodLabel}`,
          discount > 0 ? `Discount ${discount}` : null,
          penalty > 0 ? `Penalty ${penalty}` : null,
        ]
          .filter(Boolean)
          .join(' · '),
        lines,
      },
      user,
    );

    if (opts?.sendInvoice) {
      invoice = await this.invoices.send(invoice.id, user);
    }

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
        billingPeriod: period,
        unitRate,
        quantity,
        discountAmount: discount,
        penaltyAmount: penalty,
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        invoiceStatus: invoice.status,
        sendInvoice: !!opts?.sendInvoice,
        customerId: vehicle.customerId,
        billedAt,
      },
    });

    return this.enrichPermitDto(updated);
  }

  async listViolations(
    user: AuthUser,
    siteId?: string,
    status?: ParkingViolationStatus,
  ): Promise<ParkingViolationResponseDto[]> {
    const rows = await this.prisma.parkingViolation.findMany({
      where: {
        organizationId: user.organizationId,
        ...(siteId ? { siteId } : {}),
        ...(status ? { status } : {}),
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

    const payMap = await this.invoices.paymentSummaries(
      user.organizationId,
      rows.map((r) => r.invoiceId),
    );

    return rows.map((v) => {
      const site = siteById.get(v.siteId);
      const pay = v.invoiceId ? payMap.get(v.invoiceId) : undefined;
      return this.toViolationDto(v, {
        siteCode: site?.code ?? null,
        siteName: site?.name ?? null,
        invoiceNumber: pay?.invoiceNumber ?? null,
        invoiceStatus: pay?.status ?? null,
        amountPaid: pay?.amountPaid ?? null,
        balanceDue: pay?.balanceDue ?? null,
      });
    });
  }

  async createViolation(
    dto: CreateParkingViolationDto,
    user: AuthUser,
  ): Promise<ParkingViolationResponseDto> {
    const site = await this.prisma.site.findFirst({
      where: {
        id: dto.siteId,
        organizationId: user.organizationId,
        isActive: true,
      },
      select: { id: true, code: true, name: true },
    });
    if (!site) {
      throw new BadRequestException({
        error: 'INVALID_SITE',
        message: 'siteId must be an active site in this organization',
      });
    }

    const plate = dto.plateNumber.trim().toUpperCase();
    if (plate.length < 3) {
      throw new BadRequestException({
        error: 'INVALID_PLATE',
        message: 'plateNumber must be at least 3 characters',
      });
    }

    let vehicleId = dto.vehicleId;
    if (vehicleId) {
      const vehicle = await this.prisma.vehicle.findFirst({
        where: {
          id: vehicleId,
          organizationId: user.organizationId,
        },
        select: { id: true, plateNumber: true },
      });
      if (!vehicle) {
        throw new BadRequestException({
          error: 'INVALID_VEHICLE',
          message: 'vehicleId must belong to this organization',
        });
      }
      if (vehicle.plateNumber !== plate) {
        throw new BadRequestException({
          error: 'VEHICLE_PLATE_MISMATCH',
          message: 'vehicleId does not match plateNumber',
        });
      }
    } else {
      const vehicle = await this.prisma.vehicle.findFirst({
        where: { organizationId: user.organizationId, plateNumber: plate },
        select: { id: true },
      });
      vehicleId = vehicle?.id;
    }

    const fine =
      dto.fineAmount != null ? roundMoney(Math.max(0, dto.fineAmount)) : null;
    const discount =
      dto.discountAmount != null
        ? roundMoney(Math.max(0, dto.discountAmount))
        : null;
    if (fine != null && discount != null && discount > fine) {
      throw new BadRequestException({
        error: 'INVALID_DISCOUNT',
        message: 'discountAmount cannot exceed fineAmount',
      });
    }

    const violation = await this.prisma.parkingViolation.create({
      data: {
        organizationId: user.organizationId,
        siteId: site.id,
        plateNumber: plate,
        vehicleId,
        violationType: dto.violationType,
        description: blankToNull(dto.description) ?? undefined,
        officerRemarks: blankToNull(dto.officerRemarks) ?? undefined,
        fineAmount: fine != null ? new Prisma.Decimal(fine) : undefined,
        currency: (dto.currency?.trim() || 'TZS').toUpperCase(),
        discountAmount:
          discount != null ? new Prisma.Decimal(discount) : undefined,
        status: ParkingViolationStatus.OPEN,
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

    return this.toViolationDto(violation, {
      siteCode: site.code,
      siteName: site.name,
    });
  }

  async updateViolation(
    id: string,
    dto: UpdateParkingViolationDto,
    user: AuthUser,
  ): Promise<ParkingViolationResponseDto> {
    const existing = await this.prisma.parkingViolation.findFirst({
      where: { id, organizationId: user.organizationId },
    });
    if (!existing) throw new NotFoundException('Parking violation not found');

    if (this.isViolationTerminal(existing.status)) {
      throw new BadRequestException({
        error: 'VIOLATION_CLOSED',
        message: 'Cannot update a closed violation',
      });
    }

    if (
      existing.status !== ParkingViolationStatus.OPEN &&
      existing.status !== ParkingViolationStatus.CORRECTIVE_ACTION
    ) {
      throw new BadRequestException({
        error: 'INVALID_VIOLATION_STATUS',
        message: 'Violation is pending closure approval',
      });
    }

    const data: Prisma.ParkingViolationUpdateInput = {};
    if (dto.officerRemarks !== undefined) {
      data.officerRemarks = blankToNull(dto.officerRemarks) ?? null;
    }
    if (dto.correctiveAction !== undefined) {
      const action = blankToNull(dto.correctiveAction);
      if (!action) {
        throw new BadRequestException({
          error: 'CORRECTIVE_ACTION_REQUIRED',
          message: 'correctiveAction must be at least 3 characters when set',
        });
      }
      data.correctiveAction = action;
      data.correctiveActionAt = new Date();
      data.correctiveActionBy = user.id;
      data.status = ParkingViolationStatus.CORRECTIVE_ACTION;
    }

    const touchingFine =
      dto.fineAmount !== undefined ||
      dto.discountAmount !== undefined ||
      dto.currency !== undefined;
    if (touchingFine) {
      if (existing.invoiceId) {
        throw new BadRequestException({
          error: 'ALREADY_BILLED',
          message: 'Cannot change fine after invoice is linked',
        });
      }
      if (dto.currency !== undefined) {
        data.currency = (dto.currency.trim() || 'TZS').toUpperCase();
      }
      const fine =
        dto.fineAmount === undefined
          ? decimalToNumber(existing.fineAmount)
          : dto.fineAmount === null
            ? null
            : roundMoney(Math.max(0, dto.fineAmount));
      const discount =
        dto.discountAmount === undefined
          ? decimalToNumber(existing.discountAmount)
          : dto.discountAmount === null
            ? null
            : roundMoney(Math.max(0, dto.discountAmount));
      if (fine != null && discount != null && discount > fine) {
        throw new BadRequestException({
          error: 'INVALID_DISCOUNT',
          message: 'discountAmount cannot exceed fineAmount',
        });
      }
      if (dto.fineAmount !== undefined) {
        data.fineAmount = fine != null ? new Prisma.Decimal(fine) : null;
      }
      if (dto.discountAmount !== undefined) {
        data.discountAmount =
          discount != null ? new Prisma.Decimal(discount) : null;
      }
    }

    if (!Object.keys(data).length) {
      throw new BadRequestException({
        error: 'NO_CHANGES',
        message: 'No updatable fields provided',
      });
    }

    const updated = await this.prisma.parkingViolation.update({
      where: { id },
      data,
    });

    await this.audit.record({
      organizationId: user.organizationId,
      actorId: user.id,
      action: 'parking.violation.updated',
      resourceType: 'ParkingViolation',
      resourceId: id,
      before: existing,
      after: updated,
    });

    return this.violationWithSiteLabels(updated, user.organizationId);
  }

  /**
   * Module 13-P — create finance invoice for violation fine (optional send).
   * Requires vehicle with customerId; does not auto-bill on create/close.
   */
  async billViolation(
    id: string,
    user: AuthUser,
    opts?: { sendInvoice?: boolean },
  ): Promise<ParkingViolationResponseDto> {
    const violation = await this.prisma.parkingViolation.findFirst({
      where: { id, organizationId: user.organizationId },
    });
    if (!violation) throw new NotFoundException('Parking violation not found');

    if (violation.invoiceId) {
      throw new ConflictException({
        error: 'ALREADY_BILLED',
        message: 'Violation already has a linked invoice',
      });
    }

    const fine = decimalToNumber(violation.fineAmount);
    if (fine == null || fine <= 0) {
      throw new BadRequestException({
        error: 'FINE_REQUIRED',
        message: 'fineAmount must be greater than zero to bill',
      });
    }

    const discount = decimalToNumber(violation.discountAmount) ?? 0;
    const net = roundMoney(Math.max(0, fine - discount));
    if (net <= 0) {
      throw new BadRequestException({
        error: 'NET_FINE_ZERO',
        message: 'Net fine after discount must be greater than zero',
      });
    }

    if (!violation.vehicleId) {
      throw new BadRequestException({
        error: 'VEHICLE_REQUIRED_FOR_BILLING',
        message: 'Violation must be linked to a registered vehicle to bill',
      });
    }

    const vehicle = await this.prisma.vehicle.findFirst({
      where: {
        id: violation.vehicleId,
        organizationId: user.organizationId,
      },
      select: { id: true, customerId: true, plateNumber: true },
    });
    if (!vehicle) throw new NotFoundException('Vehicle not found');
    if (!vehicle.customerId) {
      throw new BadRequestException({
        error: 'CUSTOMER_REQUIRED_FOR_BILLING',
        message:
          'Vehicle must have customerId to create a parking fine invoice',
      });
    }

    const currency = (violation.currency?.trim() || 'TZS').toUpperCase();
    const issue = new Date();
    const due = new Date(issue);
    due.setDate(due.getDate() + 14);
    const ymd = issue.toISOString().slice(0, 10).replace(/-/g, '');
    const shortId = violation.id.replace(/-/g, '').slice(0, 8).toUpperCase();
    const invoiceNumber = `INV-VIO-${vehicle.plateNumber}-${shortId}-${ymd}`;

    let invoice = await this.invoices.create(
      {
        customerId: vehicle.customerId,
        invoiceNumber,
        issueDate: issue.toISOString().slice(0, 10),
        dueDate: due.toISOString().slice(0, 10),
        currency,
        serviceType: 'PARKING',
        notes: [
          `Parking violation fine · ${vehicle.plateNumber}`,
          violation.violationType,
          discount > 0 ? `Discount ${discount}` : null,
        ]
          .filter(Boolean)
          .join(' · '),
        lines: [
          {
            description: `Parking fine · ${violation.violationType} · ${vehicle.plateNumber}`,
            quantity: 1,
            unitPrice: net,
          },
        ],
      },
      user,
    );

    if (opts?.sendInvoice) {
      invoice = await this.invoices.send(invoice.id, user);
    }

    const billedAt = new Date();
    const updated = await this.prisma.parkingViolation.update({
      where: { id },
      data: {
        invoiceId: invoice.id,
        billedAt,
      },
    });

    await this.audit.record({
      organizationId: user.organizationId,
      actorId: user.id,
      action: 'parking.violation.billed',
      resourceType: 'ParkingViolation',
      resourceId: id,
      after: {
        plateNumber: violation.plateNumber,
        violationType: violation.violationType,
        fineAmount: fine,
        discountAmount: discount,
        netFineAmount: net,
        currency,
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        invoiceStatus: invoice.status,
        sendInvoice: !!opts?.sendInvoice,
        customerId: vehicle.customerId,
        billedAt,
      },
    });

    return this.violationWithSiteLabels(updated, user.organizationId);
  }

  async submitViolationClosure(
    id: string,
    user: AuthUser,
  ): Promise<ParkingViolationResponseDto> {
    const existing = await this.prisma.parkingViolation.findFirst({
      where: { id, organizationId: user.organizationId },
    });
    if (!existing) throw new NotFoundException('Parking violation not found');

    if (this.isViolationTerminal(existing.status)) {
      throw new BadRequestException({
        error: 'ALREADY_CLOSED',
        message: 'Violation is already closed',
      });
    }

    if (existing.status === ParkingViolationStatus.PENDING_CLOSURE) {
      throw new BadRequestException({
        error: 'ALREADY_PENDING_CLOSURE',
        message: 'Violation is already pending closure approval',
      });
    }

    if (!existing.correctiveAction?.trim()) {
      throw new BadRequestException({
        error: 'CORRECTIVE_ACTION_REQUIRED',
        message: 'Record corrective action before submitting for closure',
      });
    }

    const updated = await this.prisma.parkingViolation.update({
      where: { id },
      data: {
        status: ParkingViolationStatus.PENDING_CLOSURE,
        submittedForClosureAt: new Date(),
        submittedForClosureBy: user.id,
      },
    });

    await this.audit.record({
      organizationId: user.organizationId,
      actorId: user.id,
      action: 'parking.violation.submitted_for_closure',
      resourceType: 'ParkingViolation',
      resourceId: id,
      before: existing,
      after: updated,
    });

    return this.violationWithSiteLabels(updated, user.organizationId);
  }

  async approveViolationClosure(
    id: string,
    dto: ApproveParkingViolationClosureDto,
    user: AuthUser,
  ): Promise<ParkingViolationResponseDto> {
    const existing = await this.prisma.parkingViolation.findFirst({
      where: { id, organizationId: user.organizationId },
    });
    if (!existing) throw new NotFoundException('Parking violation not found');

    if (this.isViolationTerminal(existing.status)) {
      throw new BadRequestException({
        error: 'ALREADY_CLOSED',
        message: 'Violation is already closed',
      });
    }

    if (existing.status !== ParkingViolationStatus.PENDING_CLOSURE) {
      throw new BadRequestException({
        error: 'NOT_PENDING_CLOSURE',
        message: 'Violation must be submitted for closure before approval',
      });
    }

    this.assertViolationClosureApprover(existing, user);

    const now = new Date();
    const approvalNotes = blankToNull(dto.approvalNotes) ?? null;
    const closureNotes = blankToNull(dto.closureNotes) ?? null;

    const updated = await this.prisma.parkingViolation.update({
      where: { id },
      data: {
        status: ParkingViolationStatus.CLOSED,
        approvedBy: user.id,
        approvedAt: now,
        approvalNotes,
        closureNotes,
        closedBy: user.id,
        closedAt: now,
        resolvedBy: user.id,
        resolvedAt: now,
        resolutionNotes: closureNotes ?? approvalNotes,
      },
    });

    await this.audit.record({
      organizationId: user.organizationId,
      actorId: user.id,
      action: 'parking.violation.closure_approved',
      resourceType: 'ParkingViolation',
      resourceId: id,
      before: existing,
      after: updated,
    });

    return this.violationWithSiteLabels(updated, user.organizationId);
  }

  async resolveViolation(
    id: string,
    dto: ResolveParkingViolationDto,
    user: AuthUser,
  ): Promise<ParkingViolationResponseDto> {
    const existing = await this.prisma.parkingViolation.findFirst({
      where: { id, organizationId: user.organizationId },
    });
    if (!existing) throw new NotFoundException('Parking violation not found');

    if (this.isViolationTerminal(existing.status)) {
      throw new BadRequestException({
        error: 'ALREADY_CLOSED',
        message: 'Violation is already closed',
      });
    }

    if (existing.status !== ParkingViolationStatus.PENDING_CLOSURE) {
      throw new BadRequestException({
        error: 'NOT_PENDING_CLOSURE',
        message:
          'Use corrective action + submit-closure workflow before approve/resolve',
      });
    }

    return this.approveViolationClosure(
      id,
      { closureNotes: dto.resolutionNotes },
      user,
    );
  }

  private isViolationTerminal(status: ParkingViolationStatus | string): boolean {
    return (
      status === ParkingViolationStatus.CLOSED ||
      status === ParkingViolationStatus.RESOLVED
    );
  }

  private assertViolationClosureApprover(
    existing: {
      createdBy: string | null;
      submittedForClosureBy: string | null;
    },
    user: AuthUser,
  ): void {
    if (existing.createdBy && existing.createdBy === user.id) {
      throw new ForbiddenException({
        error: 'CREATOR_CANNOT_APPROVE',
        message: 'Recorder cannot approve closure of their own violation',
      });
    }
    if (
      existing.submittedForClosureBy &&
      existing.submittedForClosureBy === user.id
    ) {
      throw new ForbiddenException({
        error: 'SUBMITTER_CANNOT_APPROVE',
        message: 'Submitter cannot approve their own closure request',
      });
    }
  }

  private async violationWithSiteLabels(
    row: {
      id: string;
      organizationId: string;
      siteId: string;
      plateNumber: string;
      vehicleId: string | null;
      violationType: string;
      description: string | null;
      status: ParkingViolationStatus | string;
      officerRemarks?: string | null;
      correctiveAction?: string | null;
      correctiveActionAt?: Date | null;
      correctiveActionBy?: string | null;
      submittedForClosureAt?: Date | null;
      submittedForClosureBy?: string | null;
      approvalNotes?: string | null;
      approvedBy?: string | null;
      approvedAt?: Date | null;
      closureNotes?: string | null;
      closedAt?: Date | null;
      closedBy?: string | null;
      resolvedAt?: Date | null;
      resolvedBy?: string | null;
      resolutionNotes?: string | null;
      fineAmount?: Prisma.Decimal | number | null;
      currency?: string | null;
      discountAmount?: Prisma.Decimal | number | null;
      invoiceId?: string | null;
      billedAt?: Date | null;
      recordedAt: Date;
      createdAt: Date;
      createdBy?: string | null;
    },
    organizationId: string,
  ): Promise<ParkingViolationResponseDto> {
    const site = await this.prisma.site.findFirst({
      where: { id: row.siteId, organizationId },
      select: { code: true, name: true },
    });
    const pay = row.invoiceId
      ? (
          await this.invoices.paymentSummaries(organizationId, [row.invoiceId])
        ).get(row.invoiceId)
      : undefined;
    return this.toViolationDto(row, {
      siteCode: site?.code ?? null,
      siteName: site?.name ?? null,
      invoiceNumber: pay?.invoiceNumber ?? null,
      invoiceStatus: pay?.status ?? null,
      amountPaid: pay?.amountPaid ?? null,
      balanceDue: pay?.balanceDue ?? null,
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

  // ── Module 13-J — parking spaces + allocation ──────────────────────────

  async createParkingSpace(
    dto: CreateParkingSpaceDto,
    user: AuthUser,
  ): Promise<ParkingSpaceResponseDto> {
    const site = await this.prisma.site.findFirst({
      where: {
        id: dto.siteId,
        organizationId: user.organizationId,
        isActive: true,
      },
      select: { id: true, code: true, name: true, customerId: true },
    });
    if (!site) {
      throw new BadRequestException({
        error: 'INVALID_SITE',
        message: 'siteId must be an active site in this organization',
      });
    }

    let customerId = dto.customerId;
    if (customerId) {
      const customer = await this.prisma.customer.findFirst({
        where: {
          id: customerId,
          organizationId: user.organizationId,
          isActive: true,
        },
        select: { id: true },
      });
      if (!customer) {
        throw new BadRequestException({
          error: 'INVALID_CUSTOMER',
          message: 'customerId must be an active customer in this organization',
        });
      }
    } else if (site.customerId) {
      // Prefer site's customer when bay is created under a customer site.
      customerId = site.customerId;
    }

    const code = dto.code.trim().toUpperCase();
    const clash = await this.prisma.parkingSpace.findFirst({
      where: {
        organizationId: user.organizationId,
        siteId: site.id,
        code,
      },
      select: { id: true },
    });
    if (clash) {
      throw new ConflictException({
        error: 'SPACE_CODE_IN_USE',
        message: `Space code ${code} already exists at this site`,
      });
    }

    const row = await this.prisma.parkingSpace.create({
      data: {
        organizationId: user.organizationId,
        siteId: site.id,
        customerId: customerId ?? null,
        code,
        label: blankToNull(dto.label) ?? undefined,
        spaceType: dto.spaceType,
        allocationMode: dto.allocationMode ?? ParkingAllocationMode.MANUAL,
        notes: blankToNull(dto.notes) ?? undefined,
        createdBy: user.id,
      },
    });

    await this.audit.record({
      organizationId: user.organizationId,
      actorId: user.id,
      action: 'parking.space.created',
      resourceType: 'ParkingSpace',
      resourceId: row.id,
      after: row,
    });

    return this.enrichSpaceDto(row, user.organizationId);
  }

  async listParkingSpaces(
    user: AuthUser,
    filters?: {
      siteId?: string;
      spaceType?: ParkingSpaceType;
      status?: ParkingSpaceStatus;
      customerId?: string;
    },
  ): Promise<ParkingSpaceResponseDto[]> {
    const rows = await this.prisma.parkingSpace.findMany({
      where: {
        organizationId: user.organizationId,
        ...(filters?.siteId ? { siteId: filters.siteId } : {}),
        ...(filters?.spaceType ? { spaceType: filters.spaceType } : {}),
        ...(filters?.status ? { status: filters.status } : {}),
        ...(filters?.customerId ? { customerId: filters.customerId } : {}),
      },
      orderBy: [{ siteId: 'asc' }, { code: 'asc' }],
      take: 500,
    });
    return this.enrichSpaceDtos(rows, user.organizationId);
  }

  async updateParkingSpace(
    id: string,
    dto: UpdateParkingSpaceDto,
    user: AuthUser,
  ): Promise<ParkingSpaceResponseDto> {
    const existing = await this.prisma.parkingSpace.findFirst({
      where: { id, organizationId: user.organizationId },
    });
    if (!existing) throw new NotFoundException('Parking space not found');

    const data: Prisma.ParkingSpaceUpdateInput = {};
    if (dto.spaceType !== undefined) data.spaceType = dto.spaceType;
    if (dto.allocationMode !== undefined) {
      data.allocationMode = dto.allocationMode;
    }
    if (dto.label !== undefined) data.label = blankToNull(dto.label);
    if (dto.notes !== undefined) data.notes = blankToNull(dto.notes);
    if (dto.isActive !== undefined) {
      if (
        dto.isActive === false &&
        (existing.status === ParkingSpaceStatus.OCCUPIED || existing.vehicleId)
      ) {
        throw new BadRequestException({
          error: 'SPACE_OCCUPIED',
          message: 'Release the allocated vehicle before deactivating the bay',
        });
      }
      data.isActive = dto.isActive;
    }

    if (dto.status !== undefined) {
      if (
        dto.status !== ParkingSpaceStatus.AVAILABLE &&
        dto.status !== ParkingSpaceStatus.OUT_OF_SERVICE &&
        dto.status !== ParkingSpaceStatus.RESERVED
      ) {
        throw new BadRequestException({
          error: 'INVALID_SPACE_STATUS',
          message:
            'Use allocate/release for OCCUPIED; PATCH status allows AVAILABLE, RESERVED, or OUT_OF_SERVICE',
        });
      }
      if (
        existing.status === ParkingSpaceStatus.OCCUPIED
      ) {
        throw new BadRequestException({
          error: 'SPACE_OCCUPIED',
          message: 'Release the allocated vehicle before changing status',
        });
      }
      data.status = dto.status;
    }

    const updated = await this.prisma.parkingSpace.update({
      where: { id },
      data,
    });

    await this.audit.record({
      organizationId: user.organizationId,
      actorId: user.id,
      action: 'parking.space.updated',
      resourceType: 'ParkingSpace',
      resourceId: id,
      before: existing,
      after: updated,
    });

    return this.enrichSpaceDto(updated, user.organizationId);
  }

  async allocateParkingSpace(
    dto: AllocateParkingSpaceDto,
    user: AuthUser,
  ): Promise<ParkingSpaceResponseDto> {
    const site = await this.prisma.site.findFirst({
      where: {
        id: dto.siteId,
        organizationId: user.organizationId,
        isActive: true,
      },
      select: { id: true },
    });
    if (!site) {
      throw new BadRequestException({
        error: 'INVALID_SITE',
        message: 'siteId must be an active site in this organization',
      });
    }

    const vehicle = await this.prisma.vehicle.findFirst({
      where: {
        id: dto.vehicleId,
        organizationId: user.organizationId,
        isActive: true,
      },
    });
    if (!vehicle) {
      throw new BadRequestException({
        error: 'INVALID_VEHICLE',
        message: 'vehicleId must be an active vehicle in this organization',
      });
    }

    const existingAlloc = await this.prisma.parkingSpace.findFirst({
      where: {
        organizationId: user.organizationId,
        vehicleId: vehicle.id,
        status: ParkingSpaceStatus.OCCUPIED,
      },
      select: { id: true, code: true },
    });
    if (existingAlloc) {
      throw new ConflictException({
        error: 'VEHICLE_ALREADY_ALLOCATED',
        message: `Vehicle already allocated to space ${existingAlloc.code}; release first`,
      });
    }

    if (dto.permitId) {
      const permit = await this.prisma.parkingPermit.findFirst({
        where: {
          id: dto.permitId,
          organizationId: user.organizationId,
          vehicleId: vehicle.id,
          siteId: site.id,
          status: PermitStatus.ACTIVE,
        },
        select: { id: true },
      });
      if (!permit) {
        throw new BadRequestException({
          error: 'INVALID_PERMIT',
          message: 'permitId must be an ACTIVE permit for this vehicle and site',
        });
      }
    }

    let space;
    if (dto.mode === ParkingAllocationMode.MANUAL) {
      if (!dto.spaceId) {
        throw new BadRequestException({
          error: 'SPACE_ID_REQUIRED',
          message: 'spaceId is required for MANUAL allocation',
        });
      }
      space = await this.prisma.parkingSpace.findFirst({
        where: {
          id: dto.spaceId,
          organizationId: user.organizationId,
          siteId: site.id,
          isActive: true,
        },
      });
      if (!space) {
        throw new NotFoundException('Parking space not found at this site');
      }
      if (space.status !== ParkingSpaceStatus.AVAILABLE) {
        throw new ConflictException({
          error: 'SPACE_NOT_AVAILABLE',
          message: `Space ${space.code} is ${space.status}`,
        });
      }
      if (space.customerId) {
        if (space.customerId !== vehicle.customerId) {
          throw new BadRequestException({
            error: 'CUSTOMER_SPACE_MISMATCH',
            message:
              'Dedicated bay requires a vehicle linked to the same customer',
          });
        }
      }
    } else {
      const spaceType =
        dto.spaceType ?? this.inferSpaceTypeFromVehicle(vehicle.parkingCategory);
      space = await this.findAutoSpace({
        organizationId: user.organizationId,
        siteId: site.id,
        spaceType,
        customerId: vehicle.customerId,
      });
      if (!space) {
        throw new ConflictException({
          error: 'NO_AUTO_SPACE',
          message: `No AUTO AVAILABLE ${spaceType} bay at this site`,
        });
      }
    }

    const updatedCount = await this.prisma.parkingSpace.updateMany({
      where: {
        id: space.id,
        organizationId: user.organizationId,
        status: ParkingSpaceStatus.AVAILABLE,
        vehicleId: null,
        isActive: true,
      },
      data: {
        status: ParkingSpaceStatus.OCCUPIED,
        vehicleId: vehicle.id,
        permitId: dto.permitId ?? null,
        allocatedAt: new Date(),
        allocatedBy: user.id,
      },
    });
    if (updatedCount.count !== 1) {
      throw new ConflictException({
        error: 'SPACE_NOT_AVAILABLE',
        message: `Space ${space.code} is no longer available`,
      });
    }

    const updated = await this.prisma.parkingSpace.findFirstOrThrow({
      where: { id: space.id, organizationId: user.organizationId },
    });

    await this.audit.record({
      organizationId: user.organizationId,
      actorId: user.id,
      action: 'parking.space.allocated',
      resourceType: 'ParkingSpace',
      resourceId: updated.id,
      after: {
        ...updated,
        mode: dto.mode,
        plateNumber: vehicle.plateNumber,
      },
    });

    return this.enrichSpaceDto(updated, user.organizationId);
  }

  async releaseParkingSpace(
    id: string,
    user: AuthUser,
  ): Promise<ParkingSpaceResponseDto> {
    const existing = await this.prisma.parkingSpace.findFirst({
      where: { id, organizationId: user.organizationId },
    });
    if (!existing) throw new NotFoundException('Parking space not found');
    if (existing.status !== ParkingSpaceStatus.OCCUPIED && !existing.vehicleId) {
      throw new BadRequestException({
        error: 'SPACE_NOT_OCCUPIED',
        message: 'Space has no allocation to release',
      });
    }

    const updated = await this.prisma.parkingSpace.update({
      where: { id },
      data: {
        status: ParkingSpaceStatus.AVAILABLE,
        vehicleId: null,
        permitId: null,
        allocatedAt: null,
        allocatedBy: null,
      },
    });

    await this.audit.record({
      organizationId: user.organizationId,
      actorId: user.id,
      action: 'parking.space.released',
      resourceType: 'ParkingSpace',
      resourceId: id,
      before: existing,
      after: updated,
    });

    return this.enrichSpaceDto(updated, user.organizationId);
  }

  // ── Module 13-M — parking patrol observations ─────────────────────────

  async createParkingPatrolObservation(
    dto: CreateParkingPatrolObservationDto,
    user: AuthUser,
  ): Promise<ParkingPatrolObservationResponseDto> {
    if (dto.clientEventId) {
      const existing = await this.prisma.parkingPatrolObservation.findFirst({
        where: {
          clientEventId: dto.clientEventId,
          organizationId: user.organizationId,
        },
      });
      if (existing) {
        return this.enrichPatrolObservationDto(existing, user.organizationId);
      }
      const foreign = await this.prisma.parkingPatrolObservation.findUnique({
        where: { clientEventId: dto.clientEventId },
        select: { id: true },
      });
      if (foreign) {
        throw new ConflictException({
          error: 'CLIENT_EVENT_ID_IN_USE',
          message: 'clientEventId is already used',
        });
      }
    }

    const site = await this.prisma.site.findFirst({
      where: {
        id: dto.siteId,
        organizationId: user.organizationId,
        isActive: true,
      },
      select: { id: true, code: true, name: true },
    });
    if (!site) {
      throw new BadRequestException({
        error: 'INVALID_SITE',
        message: 'siteId must be an active site in this organization',
      });
    }

    const canOps =
      user.permissions.includes('parking.manage') ||
      user.roles.includes('SUPER_ADMIN') ||
      user.roles.includes('GENERAL_MANAGER');

    // Phase 7 site ACL for non–parking.manage actors (guards / field)
    if (!canOps) {
      assertSiteAccess(user, site.id);
    }

    const selfGuard = await this.prisma.guardProfile.findFirst({
      where: { userId: user.id, organizationId: user.organizationId },
      select: { id: true, employeeNumber: true },
    });

    let guardId: string;
    if (isGuardSelfScoped(user) || !canOps) {
      if (!selfGuard) {
        throw new BadRequestException({
          error: 'NOT_A_GUARD',
          message: 'User is not a registered guard',
        });
      }
      guardId = selfGuard.id;
    } else {
      guardId = dto.guardId ?? selfGuard?.id ?? '';
      if (!guardId) {
        throw new BadRequestException({
          error: 'GUARD_REQUIRED',
          message: 'guardId is required when the actor has no guard profile',
        });
      }
      const guard = await this.prisma.guardProfile.findFirst({
        where: { id: guardId, organizationId: user.organizationId },
        select: { id: true },
      });
      if (!guard) {
        throw new BadRequestException({
          error: 'INVALID_GUARD',
          message: 'guardId must belong to this organization',
        });
      }
    }

    let vehicleId = dto.vehicleId;
    const plate = dto.plateNumber?.trim().toUpperCase() || null;
    if (vehicleId) {
      const vehicle = await this.prisma.vehicle.findFirst({
        where: { id: vehicleId, organizationId: user.organizationId },
        select: { id: true, plateNumber: true },
      });
      if (!vehicle) {
        throw new BadRequestException({
          error: 'INVALID_VEHICLE',
          message: 'vehicleId must belong to this organization',
        });
      }
    } else if (plate) {
      const vehicle = await this.prisma.vehicle.findFirst({
        where: { organizationId: user.organizationId, plateNumber: plate },
        select: { id: true },
      });
      vehicleId = vehicle?.id;
    }

    let parkingSpaceId: string | undefined;
    if (dto.parkingSpaceId) {
      const space = await this.prisma.parkingSpace.findFirst({
        where: {
          id: dto.parkingSpaceId,
          organizationId: user.organizationId,
          siteId: site.id,
          isActive: true,
        },
        select: { id: true },
      });
      if (!space) {
        throw new BadRequestException({
          error: 'INVALID_PARKING_SPACE',
          message: 'parkingSpaceId must be an active bay at this site',
        });
      }
      parkingSpaceId = space.id;
    }

    // Guards cannot force HIGH alerts; ops may override severity
    const severity = canOps
      ? (dto.severity ?? this.defaultPatrolSeverity(dto.observationType))
      : this.defaultPatrolSeverity(dto.observationType);
    const inspectedAt = dto.inspectedAt
      ? new Date(dto.inspectedAt)
      : new Date();

    const row = await this.prisma.parkingPatrolObservation.create({
      data: {
        organizationId: user.organizationId,
        siteId: site.id,
        guardId,
        inspectedAt,
        parkingArea: dto.parkingArea.trim(),
        observationType: dto.observationType,
        plateNumber: plate,
        vehicleId: vehicleId ?? null,
        parkingSpaceId: parkingSpaceId ?? null,
        notes: blankToNull(dto.notes) ?? null,
        severity,
        latitude: dto.latitude,
        longitude: dto.longitude,
        clientEventId: dto.clientEventId,
        createdBy: user.id,
      },
    });

    let fieldAlertId: string | null = null;
    if (
      severity === 'HIGH' ||
      dto.observationType === ParkingPatrolObservationType.ACCIDENT ||
      dto.observationType ===
        ParkingPatrolObservationType.SUSPICIOUS_ACTIVITY ||
      dto.observationType === ParkingPatrolObservationType.ABANDONED_VEHICLE
    ) {
      fieldAlertId = await this.raiseParkingPatrolFieldAlert({
        organizationId: user.organizationId,
        siteId: site.id,
        observationId: row.id,
        observationType: dto.observationType,
        severity: severity === 'LOW' ? 'MEDIUM' : (severity as 'HIGH' | 'MEDIUM'),
        parkingArea: row.parkingArea,
        plateNumber: plate,
        actorId: user.id,
      });
    }

    await this.audit.record({
      organizationId: user.organizationId,
      actorId: user.id,
      action: 'parking.patrol.observation_created',
      resourceType: 'ParkingPatrolObservation',
      resourceId: row.id,
      after: { ...row, fieldAlertId },
    });

    return this.enrichPatrolObservationDto(row, user.organizationId, {
      fieldAlertId,
      siteCode: site.code,
      siteName: site.name,
    });
  }

  async listParkingPatrolObservations(
    user: AuthUser,
    filters?: {
      siteId?: string;
      observationType?: ParkingPatrolObservationType;
      guardId?: string;
    },
  ): Promise<ParkingPatrolObservationResponseDto[]> {
    const canOps =
      user.permissions.includes('parking.manage') ||
      user.roles.includes('SUPER_ADMIN') ||
      user.roles.includes('GENERAL_MANAGER');

    let selfGuardId: string | undefined;
    if (isGuardSelfScoped(user)) {
      const self = await this.prisma.guardProfile.findFirst({
        where: { userId: user.id, organizationId: user.organizationId },
        select: { id: true },
      });
      if (!self) {
        throw new ForbiddenException({
          error: 'GUARD_SCOPE_DENIED',
          message: 'No guard profile linked to this user',
        });
      }
      selfGuardId = self.id;
    }

    const siteScope = canOps
      ? filters?.siteId
        ? { siteId: filters.siteId }
        : {}
      : siteScopeWhere(user, filters?.siteId);

    const rows = await this.prisma.parkingPatrolObservation.findMany({
      where: {
        organizationId: user.organizationId,
        ...siteScope,
        ...(filters?.observationType
          ? { observationType: filters.observationType }
          : {}),
        ...(selfGuardId
          ? { guardId: selfGuardId }
          : filters?.guardId
            ? { guardId: filters.guardId }
            : {}),
      },
      orderBy: { inspectedAt: 'desc' },
      take: 100,
    });
    return this.enrichPatrolObservationDtos(rows, user.organizationId);
  }

  private defaultPatrolSeverity(
    type: ParkingPatrolObservationType,
  ): string {
    switch (type) {
      case ParkingPatrolObservationType.ACCIDENT:
      case ParkingPatrolObservationType.SUSPICIOUS_ACTIVITY:
      case ParkingPatrolObservationType.ABANDONED_VEHICLE:
        return 'HIGH';
      case ParkingPatrolObservationType.DAMAGE:
      case ParkingPatrolObservationType.ILLEGAL_PARKING:
        return 'MEDIUM';
      default:
        return 'LOW';
    }
  }

  private async raiseParkingPatrolFieldAlert(params: {
    organizationId: string;
    siteId: string;
    observationId: string;
    observationType: string;
    severity: 'HIGH' | 'MEDIUM';
    parkingArea: string;
    plateNumber: string | null;
    actorId: string;
  }): Promise<string> {
    const plateBit = params.plateNumber
      ? ` · ${params.plateNumber}`
      : '';
    const message = `Parking patrol ${params.observationType} at ${params.parkingArea}${plateBit}`;
    const alert = await this.prisma.fieldAlert.create({
      data: {
        organizationId: params.organizationId,
        siteId: params.siteId,
        alertType: PARKING_PATROL_ALERT,
        severity: params.severity,
        message,
        escalationStage: 'SUPERVISOR',
      },
    });
    await this.outbox.write({
      organizationId: params.organizationId,
      eventType: 'field.alert.created',
      aggregateType: 'ParkingPatrolObservation',
      aggregateId: params.observationId,
      payload: {
        siteId: params.siteId,
        alertType: PARKING_PATROL_ALERT,
        fieldAlertId: alert.id,
        observationType: params.observationType,
        plateNumber: params.plateNumber,
      },
      idempotencyKey: `parking-patrol-alert-${params.observationId}`,
    });
    return alert.id;
  }

  private async enrichPatrolObservationDto(
    row: {
      id: string;
      organizationId: string;
      siteId: string;
      guardId: string;
      inspectedAt: Date;
      parkingArea: string;
      observationType: string;
      plateNumber: string | null;
      vehicleId: string | null;
      parkingSpaceId: string | null;
      notes: string | null;
      severity: string;
      latitude: number | null;
      longitude: number | null;
      createdAt: Date;
    },
    organizationId: string,
    hints?: {
      fieldAlertId?: string | null;
      siteCode?: string | null;
      siteName?: string | null;
    },
  ): Promise<ParkingPatrolObservationResponseDto> {
    const [dto] = await this.enrichPatrolObservationDtos(
      [row],
      organizationId,
    );
    return {
      ...dto!,
      fieldAlertId: hints?.fieldAlertId ?? dto!.fieldAlertId ?? null,
      siteCode: hints?.siteCode ?? dto!.siteCode,
      siteName: hints?.siteName ?? dto!.siteName,
    };
  }

  private async enrichPatrolObservationDtos(
    rows: Array<{
      id: string;
      organizationId: string;
      siteId: string;
      guardId: string;
      inspectedAt: Date;
      parkingArea: string;
      observationType: string;
      plateNumber: string | null;
      vehicleId: string | null;
      parkingSpaceId: string | null;
      notes: string | null;
      severity: string;
      latitude: number | null;
      longitude: number | null;
      createdAt: Date;
    }>,
    organizationId: string,
  ): Promise<ParkingPatrolObservationResponseDto[]> {
    if (!rows.length) return [];
    const siteIds = [...new Set(rows.map((r) => r.siteId))];
    const guardIds = [...new Set(rows.map((r) => r.guardId))];
    const spaceIds = [
      ...new Set(
        rows.map((r) => r.parkingSpaceId).filter((id): id is string => !!id),
      ),
    ];
    const [sites, guards, spaces] = await Promise.all([
      this.prisma.site.findMany({
        where: { id: { in: siteIds }, organizationId },
        select: { id: true, code: true, name: true },
      }),
      this.prisma.guardProfile.findMany({
        where: { id: { in: guardIds }, organizationId },
        select: { id: true, employeeNumber: true },
      }),
      spaceIds.length
        ? this.prisma.parkingSpace.findMany({
            where: { id: { in: spaceIds }, organizationId },
            select: { id: true, code: true },
          })
        : Promise.resolve([] as Array<{ id: string; code: string }>),
    ]);
    const siteById = new Map(sites.map((s) => [s.id, s]));
    const guardById = new Map(guards.map((g) => [g.id, g]));
    const spaceById = new Map(spaces.map((s) => [s.id, s]));

    return rows.map((r) => {
      const site = siteById.get(r.siteId);
      const guard = guardById.get(r.guardId);
      const space = r.parkingSpaceId
        ? spaceById.get(r.parkingSpaceId)
        : undefined;
      return {
        id: r.id,
        organizationId: r.organizationId,
        siteId: r.siteId,
        guardId: r.guardId,
        inspectedAt: r.inspectedAt,
        parkingArea: r.parkingArea,
        observationType: r.observationType,
        plateNumber: r.plateNumber,
        vehicleId: r.vehicleId,
        parkingSpaceId: r.parkingSpaceId,
        notes: r.notes,
        severity: r.severity,
        latitude: r.latitude,
        longitude: r.longitude,
        createdAt: r.createdAt,
        fieldAlertId: null,
        siteCode: site?.code ?? null,
        siteName: site?.name ?? null,
        guardEmployeeNumber: guard?.employeeNumber ?? null,
        parkingSpaceCode: space?.code ?? null,
      };
    });
  }

  private inferSpaceTypeFromVehicle(
    category: ParkingCategory | string,
  ): ParkingSpaceType {
    switch (category) {
      case ParkingCategory.CUSTOMER_EMPLOYEE:
        return ParkingSpaceType.EMPLOYEE;
      case ParkingCategory.VISITOR:
        return ParkingSpaceType.VISITOR;
      case ParkingCategory.CONTRACTOR:
        return ParkingSpaceType.CONTRACTOR;
      case ParkingCategory.SUPPLIER:
        return ParkingSpaceType.SUPPLIER;
      case ParkingCategory.COMPANY:
      case ParkingCategory.PATROL:
        return ParkingSpaceType.FLEET;
      case ParkingCategory.TEMPORARY:
        return ParkingSpaceType.TEMPORARY;
      case ParkingCategory.EMERGENCY:
        return ParkingSpaceType.RESERVED;
      case ParkingCategory.CUSTOMER:
      default:
        return ParkingSpaceType.RESERVED;
    }
  }

  private async findAutoSpace(input: {
    organizationId: string;
    siteId: string;
    spaceType: ParkingSpaceType;
    customerId: string | null;
  }) {
    const base = {
      organizationId: input.organizationId,
      siteId: input.siteId,
      spaceType: input.spaceType,
      status: ParkingSpaceStatus.AVAILABLE,
      allocationMode: ParkingAllocationMode.AUTO,
      isActive: true,
    };

    if (input.customerId) {
      const dedicated = await this.prisma.parkingSpace.findFirst({
        where: { ...base, customerId: input.customerId },
        orderBy: { code: 'asc' },
      });
      if (dedicated) return dedicated;
    }

    const shared = await this.prisma.parkingSpace.findFirst({
      where: { ...base, customerId: null },
      orderBy: { code: 'asc' },
    });
    if (shared) return shared;

    // Overflow fallback when preferred type exhausted
    if (input.spaceType !== ParkingSpaceType.OVERFLOW) {
      return this.prisma.parkingSpace.findFirst({
        where: {
          ...base,
          spaceType: ParkingSpaceType.OVERFLOW,
          ...(input.customerId
            ? {
                OR: [{ customerId: input.customerId }, { customerId: null }],
              }
            : { customerId: null }),
        },
        orderBy: { code: 'asc' },
      });
    }
    return null;
  }

  private async enrichSpaceDto(
    row: {
      id: string;
      organizationId: string;
      siteId: string;
      customerId: string | null;
      code: string;
      label: string | null;
      spaceType: string;
      status: string;
      allocationMode: string;
      vehicleId: string | null;
      permitId: string | null;
      allocatedAt: Date | null;
      allocatedBy: string | null;
      notes: string | null;
      isActive: boolean;
      createdAt: Date;
    },
    organizationId: string,
  ): Promise<ParkingSpaceResponseDto> {
    const [dto] = await this.enrichSpaceDtos([row], organizationId);
    return dto!;
  }

  private async enrichSpaceDtos(
    rows: Array<{
      id: string;
      organizationId: string;
      siteId: string;
      customerId: string | null;
      code: string;
      label: string | null;
      spaceType: string;
      status: string;
      allocationMode: string;
      vehicleId: string | null;
      permitId: string | null;
      allocatedAt: Date | null;
      allocatedBy: string | null;
      notes: string | null;
      isActive: boolean;
      createdAt: Date;
    }>,
    organizationId: string,
  ): Promise<ParkingSpaceResponseDto[]> {
    if (!rows.length) return [];
    const siteIds = [...new Set(rows.map((r) => r.siteId))];
    const vehicleIds = [
      ...new Set(rows.map((r) => r.vehicleId).filter(Boolean) as string[]),
    ];
    const customerIds = [
      ...new Set(rows.map((r) => r.customerId).filter(Boolean) as string[]),
    ];

    const [sites, vehicles, customers] = await Promise.all([
      this.prisma.site.findMany({
        where: { organizationId, id: { in: siteIds } },
        select: { id: true, code: true, name: true },
      }),
      vehicleIds.length
        ? this.prisma.vehicle.findMany({
            where: { organizationId, id: { in: vehicleIds } },
            select: { id: true, plateNumber: true },
          })
        : Promise.resolve([]),
      customerIds.length
        ? this.prisma.customer.findMany({
            where: { organizationId, id: { in: customerIds } },
            select: { id: true, code: true, name: true },
          })
        : Promise.resolve([]),
    ]);

    const siteById = new Map(sites.map((s) => [s.id, s]));
    const vehicleById = new Map(vehicles.map((v) => [v.id, v]));
    const customerById = new Map(customers.map((c) => [c.id, c]));

    return rows.map((row) => {
      const site = siteById.get(row.siteId);
      const vehicle = row.vehicleId
        ? vehicleById.get(row.vehicleId)
        : undefined;
      const customer = row.customerId
        ? customerById.get(row.customerId)
        : undefined;
      return {
        id: row.id,
        organizationId: row.organizationId,
        siteId: row.siteId,
        customerId: row.customerId,
        code: row.code,
        label: row.label,
        spaceType: row.spaceType,
        status: row.status,
        allocationMode: row.allocationMode,
        vehicleId: row.vehicleId,
        permitId: row.permitId,
        allocatedAt: row.allocatedAt,
        allocatedBy: row.allocatedBy,
        notes: row.notes,
        isActive: row.isActive,
        createdAt: row.createdAt,
        siteCode: site?.code ?? null,
        siteName: site?.name ?? null,
        plateNumber: vehicle?.plateNumber ?? null,
        customerCode: customer?.code ?? null,
        customerName: customer?.name ?? null,
      };
    });
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
      const existing = await this.prisma.parkingEntry.findFirst({
        where: {
          clientEventId: dto.clientEventId,
          organizationId: user.organizationId,
        },
      });
      if (existing) {
        return this.enrichEntryDto(existing, user.organizationId);
      }
      // Global unique may be held by another org — do not leak that row.
      const foreign = await this.prisma.parkingEntry.findUnique({
        where: { clientEventId: dto.clientEventId },
        select: { id: true },
      });
      if (foreign) {
        throw new ConflictException({
          error: 'CLIENT_EVENT_ID_IN_USE',
          message: 'clientEventId is already used',
        });
      }
    }

    // Module 13-F — org-scoped site (+ optional gate) before punch.
    const site = await this.prisma.site.findFirst({
      where: {
        id: dto.siteId,
        organizationId: user.organizationId,
        isActive: true,
      },
      select: { id: true, code: true, name: true },
    });
    if (!site) {
      throw new BadRequestException({
        error: 'INVALID_SITE',
        message: 'siteId must be an active site in this organization',
      });
    }

    let gateLabels: { gateCode?: string | null; gateName?: string | null } = {};
    if (dto.gateId) {
      const gate = await this.prisma.gate.findFirst({
        where: {
          id: dto.gateId,
          siteId: site.id,
          organizationId: user.organizationId,
          isActive: true,
        },
        select: { id: true, code: true, name: true },
      });
      if (!gate) {
        throw new BadRequestException({
          error: 'INVALID_GATE',
          message: 'gateId must be an active gate on the selected site',
        });
      }
      gateLabels = { gateCode: gate.code, gateName: gate.name };
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

    const plate = (
      plateRaw ? plateRaw.toUpperCase() : vehicle!.plateNumber
    ).toUpperCase();

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

    // Module 13-K — compute auto decision first; officer override may be forced entry.
    let autoDecision: ParkingDecision = ParkingDecision.ALLOW;
    let permitId: string | undefined;
    let denyKind: 'BLACKLIST' | 'EXPIRED_PERMIT' | 'NO_PERMIT' | null = null;

    if (blacklisted) {
      autoDecision = ParkingDecision.DENY;
      denyKind = 'BLACKLIST';
    } else if (dto.direction === ParkingEntryDirection.ENTRY) {
      if (rfidTagRef && !vehicle?.isActive) {
        autoDecision = ParkingDecision.DENY;
        denyKind = 'NO_PERMIT';
      } else {
        const permit = await this.findActivePermit(
          user.organizationId,
          dto.siteId,
          plate,
        );
        if (permit) {
          permitId = permit.id;
          autoDecision = ParkingDecision.ALLOW;
        } else {
          autoDecision = ParkingDecision.DENY;
          const expired = await this.findExpiredPermit(
            user.organizationId,
            dto.siteId,
            plate,
          );
          denyKind = expired ? 'EXPIRED_PERMIT' : 'NO_PERMIT';
        }
      }
    }
    // EXIT: auto ALLOW unless blacklisted (already handled).

    const forcedEntry =
      dto.direction === ParkingEntryDirection.ENTRY &&
      dto.decision === ParkingDecision.ALLOW &&
      autoDecision === ParkingDecision.DENY;

    const decision = dto.decision ?? autoDecision;

    // Violations on auto-deny ENTRY (also when officer forces ALLOW — still record policy breach).
    if (
      dto.direction === ParkingEntryDirection.ENTRY &&
      autoDecision === ParkingDecision.DENY &&
      denyKind &&
      denyKind !== 'BLACKLIST'
    ) {
      await this.prisma.parkingViolation.create({
        data: {
          organizationId: user.organizationId,
          siteId: dto.siteId,
          plateNumber: plate,
          vehicleId: vehicle?.id,
          violationType:
            denyKind === 'EXPIRED_PERMIT'
              ? ViolationType.EXPIRED_PERMIT
              : ViolationType.NO_PERMIT,
          description: forcedEntry
            ? `Forced ALLOW — ${denyKind === 'EXPIRED_PERMIT' ? 'expired permit' : 'no active permit'}`
            : denyKind === 'EXPIRED_PERMIT'
              ? 'Entry — expired permit at site'
              : rfidTagRef
                ? 'RFID entry — no active permit at site'
                : 'No active permit at entry',
          createdBy: user.id,
        },
      });
    }

    if (blacklisted && decision === ParkingDecision.DENY) {
      await this.prisma.parkingViolation.create({
        data: {
          organizationId: user.organizationId,
          siteId: dto.siteId,
          plateNumber: plate,
          vehicleId: vehicle?.id,
          violationType: ViolationType.BLACKLISTED,
          description: `Blacklisted vehicle ${dto.direction.toLowerCase()}`,
          createdBy: user.id,
        },
      });
    }

    // Duplicate open ENTRY (ENTRY after ENTRY without EXIT) — alert even if ALLOW.
    let duplicateOpenEntry = false;
    if (dto.direction === ParkingEntryDirection.ENTRY) {
      const openVisit = await this.findOpenParkingEntry(
        user.organizationId,
        dto.siteId,
        plate,
      );
      if (openVisit) {
        duplicateOpenEntry = true;
      }
    }

    // Module 13-L — visit fields + soft EXIT→ENTRY pair.
    let pairedEntryId: string | undefined;
    if (
      dto.direction === ParkingEntryDirection.EXIT &&
      decision === ParkingDecision.ALLOW
    ) {
      const open = await this.findOpenParkingEntry(
        user.organizationId,
        dto.siteId,
        plate,
      );
      if (open) {
        pairedEntryId = open.id;
      }
    }

    let parkingSpaceId: string | undefined;
    if (dto.parkingSpaceId) {
      const space = await this.prisma.parkingSpace.findFirst({
        where: {
          id: dto.parkingSpaceId,
          organizationId: user.organizationId,
          siteId: dto.siteId,
          isActive: true,
        },
        select: { id: true },
      });
      if (!space) {
        throw new BadRequestException({
          error: 'INVALID_PARKING_SPACE',
          message: 'parkingSpaceId must be an active bay at this site',
        });
      }
      parkingSpaceId = space.id;
    }

    let visitorAppointmentId: string | undefined;
    if (dto.visitorAppointmentId) {
      const appt = await this.prisma.visitorAppointment.findFirst({
        where: {
          id: dto.visitorAppointmentId,
          organizationId: user.organizationId,
          siteId: dto.siteId,
          status: {
            in: [AppointmentStatus.APPROVED, AppointmentStatus.COMPLETED],
          },
        },
        select: { id: true, customerId: true },
      });
      if (!appt) {
        throw new BadRequestException({
          error: 'INVALID_VISITOR_APPOINTMENT',
          message:
            'visitorAppointmentId must be APPROVED/COMPLETED at this site',
        });
      }
      if (
        vehicle?.customerId &&
        appt.customerId &&
        vehicle.customerId !== appt.customerId
      ) {
        throw new BadRequestException({
          error: 'APPOINTMENT_CUSTOMER_MISMATCH',
          message:
            'Visitor appointment customer must match the vehicle customer',
        });
      }
      visitorAppointmentId = appt.id;
    }

    const driverName =
      blankToNull(dto.driverName) ??
      blankToNull(vehicle?.driverName) ??
      blankToNull(vehicle?.ownerName) ??
      null;
    const driverIdRef = blankToNull(dto.driverIdRef) ?? null;
    const purposeOfVisit = blankToNull(dto.purposeOfVisit) ?? null;
    const verificationMethod =
      dto.verificationMethod ??
      (rfidTagRef
        ? ParkingVerificationMethod.RFID
        : ParkingVerificationMethod.MANUAL);

    const visitData = {
      driverName,
      driverIdRef,
      verificationMethod,
      purposeOfVisit,
      visitorAppointmentId: visitorAppointmentId ?? null,
      parkingSpaceId: parkingSpaceId ?? null,
    };

    let entry;
    try {
      entry = await this.prisma.parkingEntry.create({
        data: {
          organizationId: user.organizationId,
          siteId: dto.siteId,
          gateId: dto.gateId,
          vehicleId: vehicle?.id,
          plateNumber: plate,
          direction: dto.direction,
          permitId: decision === ParkingDecision.ALLOW ? permitId : undefined,
          decision,
          recordedBy: user.id,
          clientEventId: dto.clientEventId,
          recordedAt: dto.recordedAt ? new Date(dto.recordedAt) : new Date(),
          ...visitData,
          pairedEntryId: pairedEntryId ?? null,
        },
      });
    } catch (err) {
      // Unique paired_entry_id race — retry without pair (EXIT still recorded).
      if (
        pairedEntryId &&
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        entry = await this.prisma.parkingEntry.create({
          data: {
            organizationId: user.organizationId,
            siteId: dto.siteId,
            gateId: dto.gateId,
            vehicleId: vehicle?.id,
            plateNumber: plate,
            direction: dto.direction,
            permitId: decision === ParkingDecision.ALLOW ? permitId : undefined,
            decision,
            recordedBy: user.id,
            clientEventId: dto.clientEventId,
            recordedAt: dto.recordedAt ? new Date(dto.recordedAt) : new Date(),
            ...visitData,
            pairedEntryId: null,
          },
        });
        pairedEntryId = undefined;
      } else {
        throw err;
      }
    }

    const fieldAlertIds: string[] = [];

    if (blacklisted) {
      fieldAlertIds.push(
        await this.raiseParkingEntryFieldAlert({
          organizationId: user.organizationId,
          siteId: dto.siteId,
          entryId: entry.id,
          alertType: PARKING_BLACKLISTED_ALERT,
          severity: 'HIGH',
          message: `Blacklisted vehicle ${dto.direction}: ${plate}`,
          actorId: user.id,
          plateNumber: plate,
          decision,
        }),
      );
    }

    if (
      dto.direction === ParkingEntryDirection.ENTRY &&
      autoDecision === ParkingDecision.DENY &&
      denyKind === 'EXPIRED_PERMIT' &&
      !forcedEntry
    ) {
      fieldAlertIds.push(
        await this.raiseParkingEntryFieldAlert({
          organizationId: user.organizationId,
          siteId: dto.siteId,
          entryId: entry.id,
          alertType: PARKING_EXPIRED_PERMIT_ALERT,
          severity: 'MEDIUM',
          message: `Expired parking permit at entry: ${plate}`,
          actorId: user.id,
          plateNumber: plate,
          decision,
        }),
      );
    }

    if (
      dto.direction === ParkingEntryDirection.ENTRY &&
      autoDecision === ParkingDecision.DENY &&
      denyKind === 'NO_PERMIT' &&
      !forcedEntry &&
      decision === ParkingDecision.DENY
    ) {
      fieldAlertIds.push(
        await this.raiseParkingEntryFieldAlert({
          organizationId: user.organizationId,
          siteId: dto.siteId,
          entryId: entry.id,
          alertType: PARKING_UNAUTHORIZED_ALERT,
          severity: 'MEDIUM',
          message: `Unauthorized vehicle entry denied: ${plate}`,
          actorId: user.id,
          plateNumber: plate,
          decision,
        }),
      );
    }

    if (forcedEntry) {
      fieldAlertIds.push(
        await this.raiseParkingEntryFieldAlert({
          organizationId: user.organizationId,
          siteId: dto.siteId,
          entryId: entry.id,
          alertType: PARKING_FORCED_ENTRY_ALERT,
          severity: 'HIGH',
          message: `Forced gate entry ALLOW for ${plate} (auto was DENY: ${denyKind ?? 'policy'})`,
          actorId: user.id,
          plateNumber: plate,
          decision,
        }),
      );
    }

    if (duplicateOpenEntry) {
      fieldAlertIds.push(
        await this.raiseParkingEntryFieldAlert({
          organizationId: user.organizationId,
          siteId: dto.siteId,
          entryId: entry.id,
          alertType: PARKING_DUPLICATE_ENTRY_ALERT,
          severity: 'HIGH',
          message: `Duplicate vehicle entry attempt (open visit): ${plate}`,
          actorId: user.id,
          plateNumber: plate,
          decision,
        }),
      );
    }

    await this.audit.record({
      organizationId: user.organizationId,
      actorId: user.id,
      action: `parking.entry.${dto.direction.toLowerCase()}`,
      resourceType: 'ParkingEntry',
      resourceId: entry.id,
      after: {
        ...entry,
        ...(rfidTagRef ? { via: 'rfid', rfidTagRef } : {}),
        viaManual: true,
        autoDecision,
        forcedEntry,
        denyKind,
        duplicateOpenEntry,
        fieldAlertIds,
      },
    });

    return this.enrichParkingEntryDto(entry, user.organizationId, {
      fieldAlertId: fieldAlertIds[0] ?? null,
      fieldAlertIds,
      siteCode: site.code,
      siteName: site.name,
      ...gateLabels,
    });
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
    return this.enrichParkingEntryDtos(rows, user.organizationId);
  }

  private async enrichEntryDto(
    entry: {
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
      driverName?: string | null;
      driverIdRef?: string | null;
      verificationMethod?: string;
      purposeOfVisit?: string | null;
      visitorAppointmentId?: string | null;
      parkingSpaceId?: string | null;
      pairedEntryId?: string | null;
    },
    organizationId: string,
  ): Promise<ParkingEntryResponseDto> {
    const [dto] = await this.enrichParkingEntryDtos([entry], organizationId);
    return dto!;
  }

  private async enrichParkingEntryDto(
    entry: {
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
      driverName?: string | null;
      driverIdRef?: string | null;
      verificationMethod?: string;
      purposeOfVisit?: string | null;
      visitorAppointmentId?: string | null;
      parkingSpaceId?: string | null;
      pairedEntryId?: string | null;
    },
    organizationId: string,
    hints?: {
      fieldAlertId?: string | null;
      fieldAlertIds?: string[];
      siteCode?: string | null;
      siteName?: string | null;
      gateCode?: string | null;
      gateName?: string | null;
    },
  ): Promise<ParkingEntryResponseDto> {
    const [dto] = await this.enrichParkingEntryDtos([entry], organizationId);
    return {
      ...dto!,
      fieldAlertId: hints?.fieldAlertId ?? dto!.fieldAlertId ?? null,
      fieldAlertIds: hints?.fieldAlertIds ?? dto!.fieldAlertIds ?? [],
      siteCode: hints?.siteCode ?? dto!.siteCode,
      siteName: hints?.siteName ?? dto!.siteName,
      gateCode: hints?.gateCode ?? dto!.gateCode,
      gateName: hints?.gateName ?? dto!.gateName,
    };
  }

  private async enrichParkingEntryDtos(
    rows: Array<{
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
      driverName?: string | null;
      driverIdRef?: string | null;
      verificationMethod?: string;
      purposeOfVisit?: string | null;
      visitorAppointmentId?: string | null;
      parkingSpaceId?: string | null;
      pairedEntryId?: string | null;
    }>,
    organizationId: string,
  ): Promise<ParkingEntryResponseDto[]> {
    if (!rows.length) return [];

    const siteIds = [...new Set(rows.map((r) => r.siteId))];
    const gateIds = [
      ...new Set(rows.map((r) => r.gateId).filter((id): id is string => !!id)),
    ];
    const vehicleIds = [
      ...new Set(
        rows.map((r) => r.vehicleId).filter((id): id is string => !!id),
      ),
    ];
    const officerIds = [
      ...new Set(
        rows.map((r) => r.recordedBy).filter((id): id is string => !!id),
      ),
    ];
    const spaceIds = [
      ...new Set(
        rows.map((r) => r.parkingSpaceId).filter((id): id is string => !!id),
      ),
    ];
    const apptIds = [
      ...new Set(
        rows
          .map((r) => r.visitorAppointmentId)
          .filter((id): id is string => !!id),
      ),
    ];
    const pairedIds = [
      ...new Set(
        rows.map((r) => r.pairedEntryId).filter((id): id is string => !!id),
      ),
    ];
    const entryIds = rows.map((r) => r.id);

    const [sites, gates, vehicles, officers, spaces, appts, pairedEntries, exitPairs] =
      await Promise.all([
        this.prisma.site.findMany({
          where: { id: { in: siteIds }, organizationId },
          select: { id: true, code: true, name: true },
        }),
        gateIds.length
          ? this.prisma.gate.findMany({
              where: { id: { in: gateIds }, organizationId },
              select: { id: true, code: true, name: true },
            })
          : Promise.resolve([] as Array<{ id: string; code: string; name: string }>),
        vehicleIds.length
          ? this.prisma.vehicle.findMany({
              where: { id: { in: vehicleIds }, organizationId },
              select: { id: true, customerId: true },
            })
          : Promise.resolve(
              [] as Array<{ id: string; customerId: string | null }>,
            ),
        officerIds.length
          ? this.prisma.user.findMany({
              where: { id: { in: officerIds }, organizationId },
              select: { id: true, fullName: true },
            })
          : Promise.resolve([] as Array<{ id: string; fullName: string }>),
        spaceIds.length
          ? this.prisma.parkingSpace.findMany({
              where: { id: { in: spaceIds }, organizationId },
              select: { id: true, code: true },
            })
          : Promise.resolve([] as Array<{ id: string; code: string }>),
        apptIds.length
          ? this.prisma.visitorAppointment.findMany({
              where: { id: { in: apptIds }, organizationId },
              select: {
                id: true,
                referenceNumber: true,
                visitorName: true,
              },
            })
          : Promise.resolve(
              [] as Array<{
                id: string;
                referenceNumber: string;
                visitorName: string;
              }>,
            ),
        pairedIds.length
          ? this.prisma.parkingEntry.findMany({
              where: { id: { in: pairedIds }, organizationId },
              select: {
                id: true,
                gateId: true,
                recordedAt: true,
                direction: true,
              },
            })
          : Promise.resolve(
              [] as Array<{
                id: string;
                gateId: string | null;
                recordedAt: Date;
                direction: string;
              }>,
            ),
        this.prisma.parkingEntry.findMany({
          where: {
            organizationId,
            pairedEntryId: { in: entryIds },
            direction: ParkingEntryDirection.EXIT,
          },
          select: {
            pairedEntryId: true,
            gateId: true,
            recordedAt: true,
          },
        }),
      ]);

    const customerIds = [
      ...new Set(
        vehicles
          .map((v) => v.customerId)
          .filter((id): id is string => !!id),
      ),
    ];
    const customers = customerIds.length
      ? await this.prisma.customer.findMany({
          where: { id: { in: customerIds }, organizationId },
          select: { id: true, code: true, name: true },
        })
      : [];

    const extraGateIds = [
      ...new Set(
        [
          ...pairedEntries.map((p) => p.gateId),
          ...exitPairs.map((p) => p.gateId),
        ].filter((id): id is string => !!id),
      ),
    ].filter((id) => !gateIds.includes(id));
    const extraGates = extraGateIds.length
      ? await this.prisma.gate.findMany({
          where: { id: { in: extraGateIds }, organizationId },
          select: { id: true, code: true, name: true },
        })
      : [];

    const siteById = new Map(sites.map((s) => [s.id, s]));
    const gateById = new Map(
      [...gates, ...extraGates].map((g) => [g.id, g]),
    );
    const vehicleById = new Map(vehicles.map((v) => [v.id, v]));
    const customerById = new Map(customers.map((c) => [c.id, c]));
    const officerById = new Map(officers.map((o) => [o.id, o]));
    const spaceById = new Map(spaces.map((s) => [s.id, s]));
    const apptById = new Map(appts.map((a) => [a.id, a]));
    const pairedById = new Map(pairedEntries.map((p) => [p.id, p]));
    const exitByEntryId = new Map(
      exitPairs
        .filter((p) => p.pairedEntryId)
        .map((p) => [p.pairedEntryId!, p]),
    );

    return rows.map((e) => {
      const site = siteById.get(e.siteId);
      const gate = e.gateId ? gateById.get(e.gateId) : undefined;
      const vehicle = e.vehicleId ? vehicleById.get(e.vehicleId) : undefined;
      const customer =
        vehicle?.customerId != null
          ? customerById.get(vehicle.customerId)
          : undefined;
      const officer = e.recordedBy
        ? officerById.get(e.recordedBy)
        : undefined;
      const space = e.parkingSpaceId
        ? spaceById.get(e.parkingSpaceId)
        : undefined;
      const appt = e.visitorAppointmentId
        ? apptById.get(e.visitorAppointmentId)
        : undefined;

      let entryTime: Date | null = null;
      let exitTime: Date | null = null;
      let entryGateCode: string | null = null;
      let exitGateCode: string | null = null;

      if (e.direction === ParkingEntryDirection.ENTRY) {
        entryTime = e.recordedAt;
        entryGateCode = gate?.code ?? null;
        const exit = exitByEntryId.get(e.id);
        if (exit) {
          exitTime = exit.recordedAt;
          exitGateCode = exit.gateId
            ? (gateById.get(exit.gateId)?.code ?? null)
            : null;
        }
      } else {
        exitTime = e.recordedAt;
        exitGateCode = gate?.code ?? null;
        if (e.pairedEntryId) {
          const paired = pairedById.get(e.pairedEntryId);
          if (paired) {
            entryTime = paired.recordedAt;
            entryGateCode = paired.gateId
              ? (gateById.get(paired.gateId)?.code ?? null)
              : null;
          }
        }
      }

      return this.toEntryDto(e, {
        siteCode: site?.code ?? null,
        siteName: site?.name ?? null,
        gateCode: gate?.code ?? null,
        gateName: gate?.name ?? null,
        visitorReferenceNumber: appt?.referenceNumber ?? null,
        visitorName: appt?.visitorName ?? null,
        parkingSpaceCode: space?.code ?? null,
        entryTime,
        exitTime,
        entryGateCode,
        exitGateCode,
        recordedByName: officer?.fullName ?? null,
        customerId: vehicle?.customerId ?? null,
        customerCode: customer?.code ?? null,
        customerName: customer?.name ?? null,
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

  /** Module 13-K — ACTIVE permit past validUntil (or EXPIRED status). */
  private async findExpiredPermit(
    organizationId: string,
    siteId: string,
    plateNumber: string,
  ) {
    const now = new Date();
    const vehicle = await this.prisma.vehicle.findFirst({
      where: { organizationId, plateNumber },
      select: { id: true },
    });
    if (!vehicle) return null;

    return this.prisma.parkingPermit.findFirst({
      where: {
        organizationId,
        vehicleId: vehicle.id,
        siteId,
        OR: [
          { status: PermitStatus.EXPIRED },
          {
            status: PermitStatus.ACTIVE,
            validUntil: { lt: now },
          },
        ],
      },
      orderBy: { validUntil: 'desc' },
    });
  }

  /** Module 13-L — ALLOW ENTRY at site/plate with no EXIT paired yet. */
  private async findOpenParkingEntry(
    organizationId: string,
    siteId: string,
    plateNumber: string,
  ) {
    const candidates = await this.prisma.parkingEntry.findMany({
      where: {
        organizationId,
        siteId,
        plateNumber,
        direction: ParkingEntryDirection.ENTRY,
        decision: ParkingDecision.ALLOW,
      },
      orderBy: { recordedAt: 'desc' },
      take: 20,
      select: { id: true, recordedAt: true },
    });
    if (!candidates.length) return null;

    const ids = candidates.map((c) => c.id);
    const closed = await this.prisma.parkingEntry.findMany({
      where: {
        organizationId,
        pairedEntryId: { in: ids },
        direction: ParkingEntryDirection.EXIT,
      },
      select: { pairedEntryId: true },
    });
    const closedIds = new Set(
      closed.map((c) => c.pairedEntryId).filter(Boolean) as string[],
    );
    return candidates.find((c) => !closedIds.has(c.id)) ?? null;
  }

  /**
   * Module 13-K — alert supervisors/ops on parking gate events (shared FieldAlert ladder).
   * Visible on Branch `/branch/alerts` + supervisor app; outbox for downstream notify.
   */
  private async raiseParkingEntryFieldAlert(params: {
    organizationId: string;
    siteId: string;
    entryId: string;
    alertType: string;
    severity: 'HIGH' | 'MEDIUM';
    message: string;
    actorId: string;
    plateNumber: string;
    decision: string;
  }): Promise<string> {
    const alert = await this.prisma.fieldAlert.create({
      data: {
        organizationId: params.organizationId,
        siteId: params.siteId,
        alertType: params.alertType,
        severity: params.severity,
        message: params.message,
        escalationStage: 'SUPERVISOR',
      },
    });

    await this.outbox.write({
      organizationId: params.organizationId,
      eventType: 'field.alert.created',
      aggregateType: 'ParkingEntry',
      aggregateId: params.entryId,
      payload: {
        siteId: params.siteId,
        alertType: params.alertType,
        fieldAlertId: alert.id,
        plateNumber: params.plateNumber,
        decision: params.decision,
        recordedBy: params.actorId,
      },
      idempotencyKey: `parking-entry-alert-${params.entryId}-${params.alertType}`,
    });

    await this.audit.record({
      organizationId: params.organizationId,
      actorId: params.actorId,
      action: 'parking.entry.alerted',
      resourceType: 'FieldAlert',
      resourceId: alert.id,
      after: {
        entryId: params.entryId,
        alertType: params.alertType,
        severity: params.severity,
        plateNumber: params.plateNumber,
      },
    });

    return alert.id;
  }

  private normalizeDriverPhone(
    value?: string | null,
  ): string | null | undefined {
    if (value === undefined) return undefined;
    if (value === null) return null;
    const t = value.trim();
    if (!t.length) return null;
    if (t.length < 7) {
      throw new BadRequestException({
        error: 'INVALID_DRIVER_PHONE',
        message: 'driverPhone must be at least 7 characters when set',
      });
    }
    return t;
  }

  private resolveCustomerForCategory(input: {
    parkingCategory: ParkingCategory;
    customerId?: string;
    portalForced?: boolean;
    allowMissingCustomer?: boolean;
  }): string | undefined {
    const noCustomer: ParkingCategory[] = [
      ParkingCategory.COMPANY,
      ParkingCategory.PATROL,
      ParkingCategory.EMERGENCY,
    ];
    const requireCustomer: ParkingCategory[] = [
      ParkingCategory.CUSTOMER,
      ParkingCategory.CUSTOMER_EMPLOYEE,
    ];

    if (noCustomer.includes(input.parkingCategory)) {
      if (input.customerId && !input.portalForced) {
        throw new BadRequestException({
          error: 'CUSTOMER_NOT_ALLOWED_FOR_CATEGORY',
          message:
            'COMPANY / PATROL / EMERGENCY vehicles cannot be linked to a customer',
        });
      }
      return undefined;
    }

    if (requireCustomer.includes(input.parkingCategory)) {
      if (!input.customerId && !input.allowMissingCustomer) {
        throw new BadRequestException({
          error: 'CUSTOMER_REQUIRED_FOR_CATEGORY',
          message:
            'CUSTOMER / CUSTOMER_EMPLOYEE vehicles require an active customerId',
        });
      }
      return input.customerId;
    }

    return input.customerId;
  }

  private toVehicleDto(v: {
    id: string;
    organizationId: string;
    customerId: string | null;
    plateNumber: string;
    vehicleType: string;
    parkingCategory?: string;
    make: string | null;
    model: string | null;
    color: string | null;
    ownerName: string | null;
    ownerPhone: string | null;
    driverName?: string | null;
    driverPhone?: string | null;
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
      parkingCategory: v.parkingCategory ?? ParkingCategory.CUSTOMER,
      make: v.make,
      model: v.model,
      color: v.color,
      ownerName: v.ownerName,
      ownerPhone: v.ownerPhone,
      driverName: v.driverName ?? null,
      driverPhone: v.driverPhone ?? null,
      rfidTagRef: v.rfidTagRef ?? null,
      isActive: v.isActive,
      createdAt: v.createdAt,
    };
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
    billingPeriod?: string;
    unitRate?: Prisma.Decimal | number | null;
    quantity?: Prisma.Decimal | number | null;
    discountAmount?: Prisma.Decimal | number | null;
    penaltyAmount?: Prisma.Decimal | number | null;
    invoiceId?: string | null;
    billedAt?: Date | null;
    visitorAppointmentId?: string | null;
  }): Promise<ParkingPermitResponseDto> {
    let pay:
      | {
          invoiceNumber: string;
          status: string;
          amountPaid: number;
          balanceDue: number;
        }
      | undefined;
    if (p.invoiceId) {
      const map = await this.invoices.paymentSummaries(p.organizationId, [
        p.invoiceId,
      ]);
      pay = map.get(p.invoiceId);
    }
    let visitorReferenceNumber: string | null = null;
    let visitorName: string | null = null;
    if (p.visitorAppointmentId) {
      const visit = await this.visitorAppointmentLabelMap(p.organizationId, [
        p.visitorAppointmentId,
      ]);
      const label = visit.get(p.visitorAppointmentId);
      visitorReferenceNumber = label?.referenceNumber ?? null;
      visitorName = label?.visitorName ?? null;
    }
    return this.toPermitDto(p, {
      invoiceNumber: pay?.invoiceNumber ?? null,
      invoiceStatus: pay?.status ?? null,
      amountPaid: pay?.amountPaid ?? null,
      balanceDue: pay?.balanceDue ?? null,
      visitorReferenceNumber,
      visitorName,
    });
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
      billingPeriod?: string;
      unitRate?: Prisma.Decimal | number | null;
      quantity?: Prisma.Decimal | number | null;
      discountAmount?: Prisma.Decimal | number | null;
      penaltyAmount?: Prisma.Decimal | number | null;
      invoiceId?: string | null;
      billedAt?: Date | null;
      visitorAppointmentId?: string | null;
    },
    labels?: {
      plateNumber?: string | null;
      siteCode?: string | null;
      siteName?: string | null;
      invoiceNumber?: string | null;
      invoiceStatus?: string | null;
      amountPaid?: number | null;
      balanceDue?: number | null;
      visitorReferenceNumber?: string | null;
      visitorName?: string | null;
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
      billingPeriod: p.billingPeriod ?? ParkingBillingPeriod.ONE_TIME,
      unitRate: decimalToNumber(p.unitRate),
      quantity: decimalToNumber(p.quantity),
      discountAmount: decimalToNumber(p.discountAmount),
      penaltyAmount: decimalToNumber(p.penaltyAmount),
      invoiceId: p.invoiceId ?? null,
      invoiceNumber: labels?.invoiceNumber ?? null,
      invoiceStatus: labels?.invoiceStatus ?? null,
      amountPaid: labels?.amountPaid ?? null,
      balanceDue: labels?.balanceDue ?? null,
      billedAt: p.billedAt ?? null,
      plateNumber: labels?.plateNumber ?? null,
      siteCode: labels?.siteCode ?? null,
      siteName: labels?.siteName ?? null,
      visitorAppointmentId: p.visitorAppointmentId ?? null,
      visitorReferenceNumber: labels?.visitorReferenceNumber ?? null,
      visitorName: labels?.visitorName ?? null,
    };
  }

  private async visitorAppointmentLabelMap(
    organizationId: string,
    appointmentIds: Array<string | null | undefined>,
  ): Promise<
    Map<string, { referenceNumber: string; visitorName: string }>
  > {
    const ids = [
      ...new Set(appointmentIds.filter((id): id is string => !!id)),
    ];
    if (ids.length === 0) return new Map();
    const rows = await this.prisma.visitorAppointment.findMany({
      where: { organizationId, id: { in: ids } },
      select: { id: true, referenceNumber: true, visitorName: true },
    });
    return new Map(
      rows.map((r) => [
        r.id,
        { referenceNumber: r.referenceNumber, visitorName: r.visitorName },
      ]),
    );
  }

  private async resolveVisitorAppointmentLink(input: {
    appointmentId: string;
    organizationId: string;
    siteId: string;
    vehicleCustomerId: string | null;
    permitType: PermitType;
    portalCustomerId?: string;
  }): Promise<{
    id: string;
    referenceNumber: string;
    visitorName: string;
  }> {
    if (
      input.permitType !== PermitType.VISITOR &&
      input.permitType !== PermitType.CONTRACTOR
    ) {
      throw new BadRequestException({
        error: 'APPOINTMENT_REQUIRES_VISITOR_OR_CONTRACTOR',
        message:
          'visitorAppointmentId is only allowed for VISITOR or CONTRACTOR permits',
      });
    }

    const appointment = await this.prisma.visitorAppointment.findFirst({
      where: {
        id: input.appointmentId,
        organizationId: input.organizationId,
        ...(input.portalCustomerId
          ? { customerId: input.portalCustomerId }
          : {}),
      },
      select: {
        id: true,
        referenceNumber: true,
        visitorName: true,
        siteId: true,
        customerId: true,
        status: true,
      },
    });
    if (!appointment) {
      throw new NotFoundException({
        error: 'APPOINTMENT_NOT_FOUND',
        message: 'Visitor appointment not found',
      });
    }
    if (
      appointment.status !== AppointmentStatus.APPROVED &&
      appointment.status !== AppointmentStatus.COMPLETED
    ) {
      throw new BadRequestException({
        error: 'APPOINTMENT_NOT_APPROVED',
        message: 'Appointment must be APPROVED or COMPLETED to link',
      });
    }
    if (appointment.siteId !== input.siteId) {
      throw new BadRequestException({
        error: 'APPOINTMENT_SITE_MISMATCH',
        message: 'Appointment site must match permit site',
      });
    }
    if (
      input.vehicleCustomerId &&
      input.vehicleCustomerId !== appointment.customerId
    ) {
      throw new BadRequestException({
        error: 'APPOINTMENT_CUSTOMER_MISMATCH',
        message: 'Vehicle customer must match appointment customer',
      });
    }

    return {
      id: appointment.id,
      referenceNumber: appointment.referenceNumber,
      visitorName: appointment.visitorName,
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
      driverName?: string | null;
      driverIdRef?: string | null;
      verificationMethod?: string;
      purposeOfVisit?: string | null;
      visitorAppointmentId?: string | null;
      parkingSpaceId?: string | null;
      pairedEntryId?: string | null;
    },
    labels?: {
      siteCode?: string | null;
      siteName?: string | null;
      gateCode?: string | null;
      gateName?: string | null;
      visitorReferenceNumber?: string | null;
      visitorName?: string | null;
      parkingSpaceCode?: string | null;
      entryTime?: Date | null;
      exitTime?: Date | null;
      entryGateCode?: string | null;
      exitGateCode?: string | null;
      recordedByName?: string | null;
      customerId?: string | null;
      customerCode?: string | null;
      customerName?: string | null;
    },
    alerts?: {
      fieldAlertId?: string | null;
      fieldAlertIds?: string[];
    },
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
      gateCode: labels?.gateCode ?? null,
      gateName: labels?.gateName ?? null,
      fieldAlertId: alerts?.fieldAlertId ?? null,
      fieldAlertIds: alerts?.fieldAlertIds ?? [],
      driverName: e.driverName ?? null,
      driverIdRef: e.driverIdRef ?? null,
      verificationMethod: e.verificationMethod ?? ParkingVerificationMethod.MANUAL,
      purposeOfVisit: e.purposeOfVisit ?? null,
      visitorAppointmentId: e.visitorAppointmentId ?? null,
      visitorReferenceNumber: labels?.visitorReferenceNumber ?? null,
      visitorName: labels?.visitorName ?? null,
      parkingSpaceId: e.parkingSpaceId ?? null,
      parkingSpaceCode: labels?.parkingSpaceCode ?? null,
      pairedEntryId: e.pairedEntryId ?? null,
      entryTime: labels?.entryTime ?? null,
      exitTime: labels?.exitTime ?? null,
      entryGateCode: labels?.entryGateCode ?? null,
      exitGateCode: labels?.exitGateCode ?? null,
      recordedByName: labels?.recordedByName ?? null,
      customerId: labels?.customerId ?? null,
      customerCode: labels?.customerCode ?? null,
      customerName: labels?.customerName ?? null,
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
      status?: string;
      officerRemarks?: string | null;
      correctiveAction?: string | null;
      correctiveActionAt?: Date | null;
      correctiveActionBy?: string | null;
      submittedForClosureAt?: Date | null;
      submittedForClosureBy?: string | null;
      approvalNotes?: string | null;
      approvedBy?: string | null;
      approvedAt?: Date | null;
      closureNotes?: string | null;
      closedAt?: Date | null;
      closedBy?: string | null;
      resolvedAt?: Date | null;
      resolvedBy?: string | null;
      resolutionNotes?: string | null;
      fineAmount?: Prisma.Decimal | number | null;
      currency?: string | null;
      discountAmount?: Prisma.Decimal | number | null;
      invoiceId?: string | null;
      billedAt?: Date | null;
      recordedAt: Date;
      createdAt: Date;
      createdBy?: string | null;
    },
    labels?: {
      siteCode?: string | null;
      siteName?: string | null;
      invoiceNumber?: string | null;
      invoiceStatus?: string | null;
      amountPaid?: number | null;
      balanceDue?: number | null;
    },
  ): ParkingViolationResponseDto {
    const fine = decimalToNumber(v.fineAmount as Prisma.Decimal | null);
    const discount = decimalToNumber(v.discountAmount as Prisma.Decimal | null);
    const net =
      fine != null
        ? roundMoney(Math.max(0, fine - (discount ?? 0)))
        : null;
    return {
      id: v.id,
      organizationId: v.organizationId,
      siteId: v.siteId,
      plateNumber: v.plateNumber,
      vehicleId: v.vehicleId,
      violationType: v.violationType,
      description: v.description,
      officerRemarks: v.officerRemarks ?? null,
      correctiveAction: v.correctiveAction ?? null,
      correctiveActionAt: v.correctiveActionAt ?? null,
      correctiveActionBy: v.correctiveActionBy ?? null,
      submittedForClosureAt: v.submittedForClosureAt ?? null,
      submittedForClosureBy: v.submittedForClosureBy ?? null,
      approvalNotes: v.approvalNotes ?? null,
      approvedBy: v.approvedBy ?? null,
      approvedAt: v.approvedAt ?? null,
      closureNotes: v.closureNotes ?? null,
      closedAt: v.closedAt ?? null,
      closedBy: v.closedBy ?? null,
      status: v.status ?? ParkingViolationStatus.OPEN,
      resolvedAt: v.resolvedAt ?? null,
      resolvedBy: v.resolvedBy ?? null,
      resolutionNotes: v.resolutionNotes ?? null,
      fineAmount: fine,
      currency: v.currency ?? null,
      discountAmount: discount,
      netFineAmount: net,
      invoiceId: v.invoiceId ?? null,
      invoiceNumber: labels?.invoiceNumber ?? null,
      invoiceStatus: labels?.invoiceStatus ?? null,
      amountPaid: labels?.amountPaid ?? null,
      balanceDue: labels?.balanceDue ?? null,
      billedAt: v.billedAt ?? null,
      recordedAt: v.recordedAt,
      createdAt: v.createdAt,
      createdBy: v.createdBy ?? null,
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
