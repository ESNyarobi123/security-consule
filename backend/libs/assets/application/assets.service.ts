import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AssetStatus, Prisma } from '@prisma/client';
import { PrismaService, AuthUser } from '@pssms/shared';
import { AuditService } from '@pssms/audit';
import {
  AssetAssignmentResponseDto,
  AssetResponseDto,
  AssignAssetDto,
  CreateAssetDto,
} from '../presentation/dto/assets.dto';

@Injectable()
export class AssetsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async create(dto: CreateAssetDto, user: AuthUser): Promise<AssetResponseDto> {
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
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return rows.map((a) => this.toAssetDto(a));
  }

  async assign(
    id: string,
    dto: AssignAssetDto,
    user: AuthUser,
  ): Promise<AssetAssignmentResponseDto> {
    if (!dto.assignedToEmployeeId && !dto.assignedToGuardId) {
      throw new BadRequestException(
        'Must assign to employee or guard',
      );
    }

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

  async returnAsset(
    id: string,
    user: AuthUser,
  ): Promise<AssetAssignmentResponseDto> {
    const asset = await this.findOrThrow(id, user.organizationId);
    if (asset.status !== AssetStatus.ASSIGNED) {
      throw new BadRequestException('Asset is not assigned');
    }

    const active = await this.prisma.assetAssignment.findFirst({
      where: { assetId: id, organizationId: user.organizationId, returnedAt: null },
      orderBy: { assignedAt: 'desc' },
    });
    if (!active) throw new NotFoundException('No active assignment');

    const updated = await this.prisma.$transaction(async (tx) => {
      const row = await tx.assetAssignment.update({
        where: { id: active.id },
        data: { returnedAt: new Date() },
      });
      await tx.asset.update({
        where: { id },
        data: { status: AssetStatus.AVAILABLE },
      });
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

  private async findOrThrow(id: string, organizationId: string) {
    const asset = await this.prisma.asset.findFirst({
      where: { id, organizationId },
    });
    if (!asset) throw new NotFoundException('Asset not found');
    return asset;
  }

  private toAssetDto(a: {
    id: string;
    organizationId: string;
    assetTag: string;
    name: string;
    category: string | null;
    purchaseDate: Date | null;
    purchaseCost: Prisma.Decimal | null;
    serialNumber: string | null;
    status: AssetStatus;
    createdAt: Date;
  }): AssetResponseDto {
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
      createdAt: a.createdAt,
    };
  }

  private toAssignmentDto(a: {
    id: string;
    organizationId: string;
    assetId: string;
    assignedToEmployeeId: string | null;
    assignedToGuardId: string | null;
    assignedAt: Date;
    returnedAt: Date | null;
    notes: string | null;
  }): AssetAssignmentResponseDto {
    return {
      id: a.id,
      organizationId: a.organizationId,
      assetId: a.assetId,
      assignedToEmployeeId: a.assignedToEmployeeId,
      assignedToGuardId: a.assignedToGuardId,
      assignedAt: a.assignedAt,
      returnedAt: a.returnedAt,
      notes: a.notes,
    };
  }
}
