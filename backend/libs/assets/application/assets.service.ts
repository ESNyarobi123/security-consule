import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AssetLifecycleEventType,
  AssetStatus,
  Prisma,
} from '@prisma/client';
import { PrismaService, AuthUser } from '@pssms/shared';
import { AuditService } from '@pssms/audit';
import {
  AssetAssigneeOptionsDto,
  AssetAssignmentResponseDto,
  AssetLifecycleEventResponseDto,
  AssetResponseDto,
  ASSET_CATEGORIES,
  AssignAssetDto,
  CategoryOptionDto,
  ConfirmReturnDto,
  CreateAssetDto,
  DamageAssetDto,
  DisposeAssetDto,
  MaintenanceDto,
  ReplacementDto,
  TransferAssetDto,
  WalkInReturnDto,
} from '../presentation/dto/assets.dto';

@Injectable()
export class AssetsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async create(dto: CreateAssetDto, user: AuthUser): Promise<AssetResponseDto> {
    if (
      dto.category &&
      !ASSET_CATEGORIES.includes(dto.category)
    ) {
      throw new BadRequestException('Invalid asset category');
    }
    const exists = await this.prisma.asset.findFirst({
      where: { organizationId: user.organizationId, assetTag: dto.assetTag },
    });
    if (exists) throw new BadRequestException('Asset tag already exists');

    const asset = await this.prisma.asset.create({
      data: {
        organizationId: user.organizationId,
        assetTag: dto.assetTag,
        name: dto.name,
        category: dto.category,
        purchaseDate: dto.purchaseDate ? new Date(dto.purchaseDate) : undefined,
        purchaseCost: dto.purchaseCost
          ? new Prisma.Decimal(dto.purchaseCost)
          : undefined,
        serialNumber: dto.serialNumber,
        createdBy: user.id,
      },
    });

    await this.audit.record({
      organizationId: user.organizationId,
      actorId: user.id,
      action: 'asset.created',
      resourceType: 'Asset',
      resourceId: asset.id,
      after: asset,
    });

    return this.toAssetDto(asset);
  }

  async list(organizationId: string): Promise<AssetResponseDto[]> {
    const rows = await this.prisma.asset.findMany({
      where: { organizationId },
      include: {
        assignments: {
          where: { returnedAt: null },
          orderBy: { assignedAt: 'desc' },
          take: 1,
          select: {
            id: true,
            assignedToEmployeeId: true,
            assignedToGuardId: true,
            assignedAt: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return rows.map((a) => {
      const active = a.assignments[0] ?? null;
      return this.toAssetDto(a, active);
    });
  }

  listCategoryOptions(): CategoryOptionDto[] {
    return ASSET_CATEGORIES.map((code) => ({
      code,
      label: code
        .toLowerCase()
        .split('_')
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' '),
    }));
  }

  /** Minimal employee + guard directory for assign UI (assets.manage). */
  async listAssigneeOptions(
    organizationId: string,
  ): Promise<AssetAssigneeOptionsDto> {
    const [employees, guards] = await Promise.all([
      this.prisma.employee.findMany({
        where: {
          organizationId,
          status: { not: 'TERMINATED' },
        },
        select: {
          id: true,
          employeeNumber: true,
          fullName: true,
        },
        orderBy: { fullName: 'asc' },
        take: 300,
      }),
      this.prisma.guardProfile.findMany({
        where: {
          organizationId,
          status: { not: 'TERMINATED' },
        },
        select: {
          id: true,
          employeeNumber: true,
          employee: { select: { fullName: true } },
        },
        orderBy: { employeeNumber: 'asc' },
        take: 300,
      }),
    ]);

    return {
      employees,
      guards: guards.map((g) => ({
        id: g.id,
        employeeNumber: g.employeeNumber,
        fullName: g.employee?.fullName ?? g.employeeNumber,
      })),
    };
  }

  async assign(
    id: string,
    dto: AssignAssetDto,
    user: AuthUser,
  ): Promise<AssetAssignmentResponseDto> {
    await this.validateAssignee(dto, user.organizationId);

    const asset = await this.findOrThrow(id, user.organizationId);
    if (asset.status !== AssetStatus.AVAILABLE) {
      throw new BadRequestException('Asset is not available');
    }

    const assignment = await this.prisma.$transaction(async (tx) => {
      const row = await tx.assetAssignment.create({
        data: {
          organizationId: user.organizationId,
          assetId: id,
          assignedToEmployeeId: dto.assignedToEmployeeId,
          assignedToGuardId: dto.assignedToGuardId,
          notes: dto.notes,
          createdBy: user.id,
        },
      });
      await tx.asset.update({
        where: { id },
        data: { status: AssetStatus.ASSIGNED },
      });
      return row;
    });

    await this.audit.record({
      organizationId: user.organizationId,
      actorId: user.id,
      action: 'asset.assigned',
      resourceType: 'Asset',
      resourceId: id,
      after: assignment,
    });

    return this.toAssignmentDto(assignment);
  }

  async transfer(
    id: string,
    dto: TransferAssetDto,
    user: AuthUser,
  ): Promise<AssetAssignmentResponseDto> {
    await this.validateAssignee(dto, user.organizationId);
    const asset = await this.findOrThrow(id, user.organizationId);
    // Block RETURN_PENDING — confirm/walk-in first so ESS return SoD cannot be
    // bypassed by self-transfer (storekeeper may also have ess.access).
    if (asset.status === AssetStatus.RETURN_PENDING) {
      throw new BadRequestException(
        'Confirm or cancel the pending return before transferring',
      );
    }
    if (asset.status !== AssetStatus.ASSIGNED) {
      throw new BadRequestException('Asset must be ASSIGNED to transfer');
    }

    const active = await this.prisma.assetAssignment.findFirst({
      where: {
        assetId: id,
        organizationId: user.organizationId,
        returnedAt: null,
      },
      orderBy: { assignedAt: 'desc' },
    });
    if (!active) throw new NotFoundException('No active assignment');

    const now = new Date();
    const assignment = await this.prisma.$transaction(async (tx) => {
      const closed = await tx.assetAssignment.updateMany({
        where: {
          id: active.id,
          organizationId: user.organizationId,
          returnedAt: null,
        },
        data: {
          returnedAt: now,
          returnCondition: 'TRANSFER',
          returnConfirmedBy: user.id,
          returnConfirmedAt: now,
        },
      });
      if (closed.count !== 1) {
        throw new BadRequestException('Assignment already closed');
      }
      const row = await tx.assetAssignment.create({
        data: {
          organizationId: user.organizationId,
          assetId: id,
          assignedToEmployeeId: dto.assignedToEmployeeId,
          assignedToGuardId: dto.assignedToGuardId,
          notes: dto.notes,
          createdBy: user.id,
        },
      });
      await tx.asset.update({
        where: { id },
        data: { status: AssetStatus.ASSIGNED },
      });
      await this.writeEvent(tx, {
        organizationId: user.organizationId,
        assetId: id,
        eventType: AssetLifecycleEventType.TRANSFER,
        fromStatus: asset.status,
        toStatus: AssetStatus.ASSIGNED,
        notes: dto.notes,
        fromEmployeeId: active.assignedToEmployeeId,
        fromGuardId: active.assignedToGuardId,
        toEmployeeId: dto.assignedToEmployeeId,
        toGuardId: dto.assignedToGuardId,
        createdBy: user.id,
      });
      return row;
    });

    await this.audit.record({
      organizationId: user.organizationId,
      actorId: user.id,
      action: 'asset.transferred',
      resourceType: 'Asset',
      resourceId: id,
      before: active,
      after: assignment,
    });
    return this.toAssignmentDto(assignment);
  }

  async dispose(
    id: string,
    dto: DisposeAssetDto,
    user: AuthUser,
  ): Promise<AssetResponseDto> {
    const asset = await this.findOrThrow(id, user.organizationId);
    if (
      asset.status !== AssetStatus.AVAILABLE &&
      asset.status !== AssetStatus.MAINTENANCE
    ) {
      throw new BadRequestException(
        'Only AVAILABLE or MAINTENANCE assets can be disposed',
      );
    }
    const now = new Date();
    const updated = await this.prisma.$transaction(async (tx) => {
      const row = await tx.asset.update({
        where: { id },
        data: {
          status: AssetStatus.DISPOSED,
          disposedAt: now,
          disposedBy: user.id,
          disposalReason: dto.reason,
        },
      });
      await this.writeEvent(tx, {
        organizationId: user.organizationId,
        assetId: id,
        eventType: AssetLifecycleEventType.DISPOSE,
        fromStatus: asset.status,
        toStatus: AssetStatus.DISPOSED,
        notes: dto.reason,
        createdBy: user.id,
      });
      return row;
    });
    await this.recordAudit('asset.disposed', asset, updated, user);
    return this.toAssetDto(updated);
  }

  async startMaintenance(
    id: string,
    dto: MaintenanceDto,
    user: AuthUser,
  ): Promise<AssetResponseDto> {
    const asset = await this.findOrThrow(id, user.organizationId);
    if (asset.status !== AssetStatus.AVAILABLE) {
      throw new BadRequestException(
        'Only AVAILABLE assets can start maintenance',
      );
    }
    const updated = await this.prisma.$transaction(async (tx) => {
      const row = await tx.asset.update({
        where: { id },
        data: {
          status: AssetStatus.MAINTENANCE,
          maintenanceNotes: dto.notes ?? null,
        },
      });
      await this.writeEvent(tx, {
        organizationId: user.organizationId,
        assetId: id,
        eventType: AssetLifecycleEventType.MAINTENANCE_START,
        fromStatus: asset.status,
        toStatus: AssetStatus.MAINTENANCE,
        notes: dto.notes,
        createdBy: user.id,
      });
      return row;
    });
    await this.recordAudit('asset.maintenance_started', asset, updated, user);
    return this.toAssetDto(updated);
  }

  async completeMaintenance(
    id: string,
    dto: MaintenanceDto,
    user: AuthUser,
  ): Promise<AssetResponseDto> {
    const asset = await this.findOrThrow(id, user.organizationId);
    if (asset.status !== AssetStatus.MAINTENANCE) {
      throw new BadRequestException('Asset is not in MAINTENANCE');
    }
    const updated = await this.prisma.$transaction(async (tx) => {
      const row = await tx.asset.update({
        where: { id },
        data: {
          status: AssetStatus.AVAILABLE,
          maintenanceNotes: dto.notes ?? null,
        },
      });
      await this.writeEvent(tx, {
        organizationId: user.organizationId,
        assetId: id,
        eventType: AssetLifecycleEventType.MAINTENANCE_COMPLETE,
        fromStatus: asset.status,
        toStatus: AssetStatus.AVAILABLE,
        notes: dto.notes,
        createdBy: user.id,
      });
      return row;
    });
    await this.recordAudit('asset.maintenance_completed', asset, updated, user);
    return this.toAssetDto(updated);
  }

  async recordDamage(
    id: string,
    dto: DamageAssetDto,
    user: AuthUser,
  ): Promise<AssetLifecycleEventResponseDto> {
    const asset = await this.findOrThrow(id, user.organizationId);
    if (asset.status === AssetStatus.DISPOSED) {
      throw new BadRequestException('Cannot record damage on a disposed asset');
    }
    const nextStatus =
      asset.status === AssetStatus.AVAILABLE && dto.condition === 'DAMAGED'
        ? AssetStatus.MAINTENANCE
        : asset.status;
    const event = await this.prisma.$transaction(async (tx) => {
      if (nextStatus !== asset.status) {
        await tx.asset.update({
          where: { id },
          data: {
            status: nextStatus,
            maintenanceNotes: dto.notes,
          },
        });
      }
      return this.writeEvent(tx, {
        organizationId: user.organizationId,
        assetId: id,
        eventType: AssetLifecycleEventType.DAMAGE,
        fromStatus: asset.status,
        toStatus: nextStatus,
        notes: dto.notes,
        condition: dto.condition,
        createdBy: user.id,
      });
    });
    await this.audit.record({
      organizationId: user.organizationId,
      actorId: user.id,
      action: 'asset.damage_recorded',
      resourceType: 'Asset',
      resourceId: id,
      before: asset,
      after: event,
    });
    return event;
  }

  async recordReplacement(
    id: string,
    dto: ReplacementDto,
    user: AuthUser,
  ): Promise<AssetLifecycleEventResponseDto> {
    const asset = await this.findOrThrow(id, user.organizationId);
    if (dto.replacementAssetId === id) {
      throw new BadRequestException('Asset cannot replace itself');
    }
    const replacement = await this.findOrThrow(
      dto.replacementAssetId,
      user.organizationId,
    );
    if (replacement.status === AssetStatus.DISPOSED) {
      throw new BadRequestException('Replacement asset is disposed');
    }
    const event = await this.prisma.$transaction((tx) =>
      this.writeEvent(tx, {
        organizationId: user.organizationId,
        assetId: id,
        eventType: AssetLifecycleEventType.REPLACEMENT,
        fromStatus: asset.status,
        toStatus: asset.status,
        notes: dto.notes,
        replacementAssetId: replacement.id,
        createdBy: user.id,
      }),
    );
    await this.audit.record({
      organizationId: user.organizationId,
      actorId: user.id,
      action: 'asset.replacement_recorded',
      resourceType: 'Asset',
      resourceId: id,
      before: asset,
      after: event,
    });
    return event;
  }

  async listHistory(
    id: string,
    user: AuthUser,
  ): Promise<AssetLifecycleEventResponseDto[]> {
    await this.findOrThrow(id, user.organizationId);
    return this.prisma.assetLifecycleEvent.findMany({
      where: { assetId: id, organizationId: user.organizationId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  /**
   * ESS return request — marks assignment pending; does not close stock.
   * Ownership must already be verified by the caller (EssService).
   */
  async requestReturn(
    assignmentId: string,
    user: AuthUser,
  ): Promise<{
    assignment: {
      id: string;
      assetId: string;
      assignedAt: Date;
      notes: string | null;
      returnRequestedAt: Date | null;
    };
    asset: {
      assetTag: string;
      name: string;
      category: string | null;
      status: AssetStatus;
    };
    alreadyRequested: boolean;
  }> {
    const active = await this.prisma.assetAssignment.findFirst({
      where: {
        id: assignmentId,
        organizationId: user.organizationId,
        returnedAt: null,
      },
      include: { asset: true },
    });
    if (!active) throw new NotFoundException('Assignment not found');
    if (
      active.asset.status !== AssetStatus.ASSIGNED &&
      active.asset.status !== AssetStatus.RETURN_PENDING
    ) {
      throw new BadRequestException(
        'Asset is not in ASSIGNED or RETURN_PENDING status',
      );
    }
    if (active.returnRequestedAt) {
      return {
        assignment: active,
        asset: active.asset,
        alreadyRequested: true,
      };
    }

    const now = new Date();
    const updated = await this.prisma.$transaction(async (tx) => {
      const row = await tx.assetAssignment.update({
        where: { id: active.id },
        data: {
          returnRequestedAt: now,
          returnRequestedBy: user.id,
        },
      });
      await tx.asset.update({
        where: { id: active.assetId },
        data: { status: AssetStatus.RETURN_PENDING },
      });
      return row;
    });

    await this.audit.record({
      organizationId: user.organizationId,
      actorId: user.id,
      action: 'asset.return_requested',
      resourceType: 'AssetAssignment',
      resourceId: updated.id,
      after: updated,
    });

    return {
      assignment: updated,
      asset: { ...active.asset, status: AssetStatus.RETURN_PENDING },
      alreadyRequested: false,
    };
  }

  /**
   * Walk-in / storekeeper override — closes active assignment immediately.
   * Prefer ESS request + confirmReturn for the thin two-step flow.
   * If ESS already requested, creator ≠ confirmer still applies.
   */
  async returnAsset(
    id: string,
    user: AuthUser,
    dto?: WalkInReturnDto,
  ): Promise<AssetAssignmentResponseDto> {
    const asset = await this.findOrThrow(id, user.organizationId);
    if (
      asset.status !== AssetStatus.ASSIGNED &&
      asset.status !== AssetStatus.RETURN_PENDING
    ) {
      throw new BadRequestException('Asset is not assigned');
    }

    const active = await this.prisma.assetAssignment.findFirst({
      where: { assetId: id, organizationId: user.organizationId, returnedAt: null },
      orderBy: { assignedAt: 'desc' },
    });
    if (!active) throw new NotFoundException('No active assignment');
    if (active.returnRequestedBy && active.returnRequestedBy === user.id) {
      throw new ForbiddenException(
        'Creator cannot confirm their own return request',
      );
    }

    const now = new Date();
    const condition = dto?.condition ?? 'GOOD';
    const nextStatus = this.statusAfterReturn(condition);

    const updated = await this.prisma.$transaction(async (tx) => {
      const closed = await tx.assetAssignment.updateMany({
        where: {
          id: active.id,
          organizationId: user.organizationId,
          returnedAt: null,
        },
        data: {
          returnedAt: now,
          returnCondition: condition,
          returnReceiptNote: dto?.receiptNote,
          returnConfirmedBy: user.id,
          returnConfirmedAt: now,
        },
      });
      if (closed.count !== 1) {
        throw new BadRequestException('Assignment already returned');
      }
      const row = await tx.assetAssignment.findUniqueOrThrow({
        where: { id: active.id },
      });
      await tx.asset.update({
        where: { id },
        data: { status: nextStatus },
      });
      if (condition === 'DAMAGED' || condition === 'LOST') {
        await this.writeEvent(tx, {
          organizationId: user.organizationId,
          assetId: id,
          eventType: AssetLifecycleEventType.DAMAGE,
          fromStatus: asset.status,
          toStatus: nextStatus,
          notes: dto?.receiptNote,
          condition,
          createdBy: user.id,
        });
      }
      return row;
    });

    await this.audit.record({
      organizationId: user.organizationId,
      actorId: user.id,
      action: 'asset.returned',
      resourceType: 'Asset',
      resourceId: id,
      after: updated,
    });

    return this.toAssignmentDto(updated);
  }

  async listPendingReturns(
    organizationId: string,
  ): Promise<AssetAssignmentResponseDto[]> {
    const rows = await this.prisma.assetAssignment.findMany({
      where: {
        organizationId,
        returnedAt: null,
        returnRequestedAt: { not: null },
      },
      include: { asset: true },
      orderBy: { returnRequestedAt: 'asc' },
      take: 100,
    });
    return rows.map((a) =>
      this.toAssignmentDto(a, {
        assetTag: a.asset.assetTag,
        assetName: a.asset.name,
        assetCategory: a.asset.category,
        assetStatus: a.asset.status,
      }),
    );
  }

  async confirmReturn(
    assignmentId: string,
    dto: ConfirmReturnDto,
    user: AuthUser,
  ): Promise<AssetAssignmentResponseDto> {
    const active = await this.prisma.assetAssignment.findFirst({
      where: {
        id: assignmentId,
        organizationId: user.organizationId,
        returnedAt: null,
      },
      include: { asset: true },
    });
    if (!active) throw new NotFoundException('Assignment not found');
    if (!active.returnRequestedAt) {
      throw new BadRequestException(
        'Return has not been requested; use walk-in return or wait for ESS request',
      );
    }
    if (active.returnRequestedBy && active.returnRequestedBy === user.id) {
      throw new ForbiddenException(
        'Creator cannot confirm their own return request',
      );
    }

    const now = new Date();
    const nextStatus = this.statusAfterReturn(dto.condition);

    const updated = await this.prisma.$transaction(async (tx) => {
      const closed = await tx.assetAssignment.updateMany({
        where: {
          id: active.id,
          organizationId: user.organizationId,
          returnedAt: null,
          returnRequestedAt: { not: null },
        },
        data: {
          returnedAt: now,
          returnCondition: dto.condition,
          returnReceiptNote: dto.receiptNote,
          returnConfirmedBy: user.id,
          returnConfirmedAt: now,
        },
      });
      if (closed.count !== 1) {
        throw new BadRequestException('Assignment already returned');
      }
      const row = await tx.assetAssignment.findUniqueOrThrow({
        where: { id: active.id },
      });
      await tx.asset.update({
        where: { id: active.assetId },
        data: { status: nextStatus },
      });
      if (dto.condition === 'DAMAGED' || dto.condition === 'LOST') {
        await this.writeEvent(tx, {
          organizationId: user.organizationId,
          assetId: active.assetId,
          eventType: AssetLifecycleEventType.DAMAGE,
          fromStatus: active.asset.status,
          toStatus: nextStatus,
          notes: dto.receiptNote,
          condition: dto.condition,
          createdBy: user.id,
        });
      }
      return row;
    });

    await this.audit.record({
      organizationId: user.organizationId,
      actorId: user.id,
      action: 'asset.return_confirmed',
      resourceType: 'AssetAssignment',
      resourceId: updated.id,
      after: updated,
    });

    return this.toAssignmentDto(updated, {
      assetTag: active.asset.assetTag,
      assetName: active.asset.name,
      assetCategory: active.asset.category,
      assetStatus: nextStatus,
    });
  }

  private statusAfterReturn(condition: string): AssetStatus {
    if (condition === 'DAMAGED') return AssetStatus.MAINTENANCE;
    if (condition === 'LOST') return AssetStatus.DISPOSED;
    return AssetStatus.AVAILABLE;
  }

  private async findOrThrow(id: string, organizationId: string) {
    const asset = await this.prisma.asset.findFirst({
      where: { id, organizationId },
    });
    if (!asset) throw new NotFoundException('Asset not found');
    return asset;
  }

  private async validateAssignee(
    dto: AssignAssetDto,
    organizationId: string,
  ): Promise<void> {
    if (!dto.assignedToEmployeeId && !dto.assignedToGuardId) {
      throw new BadRequestException('Must assign to employee or guard');
    }
    if (dto.assignedToEmployeeId) {
      const employee = await this.prisma.employee.findFirst({
        where: {
          id: dto.assignedToEmployeeId,
          organizationId,
          status: { not: 'TERMINATED' },
        },
        select: { id: true },
      });
      if (!employee) {
        throw new BadRequestException('Employee not found in organization');
      }
    }
    if (dto.assignedToGuardId) {
      const guard = await this.prisma.guardProfile.findFirst({
        where: {
          id: dto.assignedToGuardId,
          organizationId,
          status: { not: 'TERMINATED' },
        },
        select: { id: true },
      });
      if (!guard) {
        throw new BadRequestException('Guard not found in organization');
      }
    }
  }

  private writeEvent(
    tx: Prisma.TransactionClient,
    data: Prisma.AssetLifecycleEventUncheckedCreateInput,
  ) {
    return tx.assetLifecycleEvent.create({ data });
  }

  private recordAudit(
    action: string,
    before: object,
    after: object,
    user: AuthUser,
  ) {
    const resourceId =
      'id' in after && typeof after.id === 'string'
        ? after.id
        : 'id' in before && typeof before.id === 'string'
          ? before.id
          : undefined;
    return this.audit.record({
      organizationId: user.organizationId,
      actorId: user.id,
      action,
      resourceType: 'Asset',
      resourceId,
      before,
      after,
    });
  }

  private toAssetDto(
    a: {
      id: string;
      organizationId: string;
      assetTag: string;
      name: string;
      category: string | null;
      purchaseDate: Date | null;
      purchaseCost: Prisma.Decimal | null;
      serialNumber: string | null;
      status: AssetStatus;
      disposedAt: Date | null;
      disposedBy: string | null;
      disposalReason: string | null;
      maintenanceNotes: string | null;
      createdAt: Date;
    },
    activeAssignment?: {
      id: string;
      assignedToEmployeeId: string | null;
      assignedToGuardId: string | null;
      assignedAt: Date;
    } | null,
  ): AssetResponseDto {
    return {
      id: a.id,
      organizationId: a.organizationId,
      assetTag: a.assetTag,
      name: a.name,
      category: a.category,
      purchaseDate: a.purchaseDate,
      purchaseCost: a.purchaseCost ? Number(a.purchaseCost) : null,
      serialNumber: a.serialNumber,
      status: a.status,
      disposedAt: a.disposedAt,
      disposedBy: a.disposedBy,
      disposalReason: a.disposalReason,
      maintenanceNotes: a.maintenanceNotes,
      createdAt: a.createdAt,
      activeAssignment: activeAssignment
        ? {
            id: activeAssignment.id,
            assignedToEmployeeId: activeAssignment.assignedToEmployeeId,
            assignedToGuardId: activeAssignment.assignedToGuardId,
            assignedAt: activeAssignment.assignedAt,
          }
        : null,
    };
  }

  private toAssignmentDto(
    a: {
      id: string;
      organizationId: string;
      assetId: string;
      assignedToEmployeeId: string | null;
      assignedToGuardId: string | null;
      assignedAt: Date;
      returnedAt: Date | null;
      notes: string | null;
      returnRequestedAt?: Date | null;
      returnRequestedBy?: string | null;
      returnCondition?: string | null;
      returnReceiptNote?: string | null;
      returnConfirmedBy?: string | null;
      returnConfirmedAt?: Date | null;
    },
    assetMeta?: {
      assetTag?: string | null;
      assetName?: string | null;
      assetCategory?: string | null;
      assetStatus?: AssetStatus | null;
    },
  ): AssetAssignmentResponseDto {
    return {
      id: a.id,
      organizationId: a.organizationId,
      assetId: a.assetId,
      assignedToEmployeeId: a.assignedToEmployeeId,
      assignedToGuardId: a.assignedToGuardId,
      assignedAt: a.assignedAt,
      returnedAt: a.returnedAt,
      notes: a.notes,
      returnRequestedAt: a.returnRequestedAt ?? null,
      returnRequestedBy: a.returnRequestedBy ?? null,
      returnCondition: a.returnCondition ?? null,
      returnReceiptNote: a.returnReceiptNote ?? null,
      returnConfirmedBy: a.returnConfirmedBy ?? null,
      returnConfirmedAt: a.returnConfirmedAt ?? null,
      assetTag: assetMeta?.assetTag ?? null,
      assetName: assetMeta?.assetName ?? null,
      assetCategory: assetMeta?.assetCategory ?? null,
      assetStatus: assetMeta?.assetStatus ?? null,
    };
  }
}
