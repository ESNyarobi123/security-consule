import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { GateType } from '@prisma/client';
import {
  PrismaService,
  AuthUser,
  assertSiteAccess,
  siteScopeWhere,
} from '@pssms/shared';
import { AuditService } from '@pssms/audit';
import {
  CreateGateDto,
  GateResponseDto,
  UpdateGateDto,
} from '../presentation/dto/enterprise.dto';

@Injectable()
export class GatesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async create(dto: CreateGateDto, user: AuthUser): Promise<GateResponseDto> {
    const site = await this.prisma.site.findFirst({
      where: { id: dto.siteId, organizationId: user.organizationId },
    });
    if (!site) throw new NotFoundException('Site not found');
    assertSiteAccess(user, dto.siteId);

    const exists = await this.prisma.gate.findFirst({
      where: {
        organizationId: user.organizationId,
        siteId: dto.siteId,
        code: dto.code,
      },
    });
    if (exists) throw new ConflictException('Gate code already exists for site');

    const gate = await this.prisma.gate.create({
      data: {
        organizationId: user.organizationId,
        siteId: dto.siteId,
        code: dto.code.trim(),
        name: dto.name.trim(),
        gateType: (dto.gateType as GateType) ?? GateType.MIXED,
        createdBy: user.id,
      },
    });

    await this.audit.record({
      organizationId: user.organizationId,
      actorId: user.id,
      action: 'gate.created',
      resourceType: 'Gate',
      resourceId: gate.id,
      after: gate,
    });

    return this.toDto(gate, {
      siteCode: site.code,
      siteName: site.name,
    });
  }

  async list(
    organizationId: string,
    user: AuthUser,
    siteId?: string,
    active?: boolean,
  ): Promise<GateResponseDto[]> {
    const rows = await this.prisma.gate.findMany({
      where: {
        organizationId,
        ...(typeof active === 'boolean' ? { isActive: active } : {}),
        ...siteScopeWhere(user, siteId),
      },
      orderBy: [{ siteId: 'asc' }, { name: 'asc' }],
    });

    const siteIds = [...new Set(rows.map((g) => g.siteId))];
    const sites =
      siteIds.length === 0
        ? []
        : await this.prisma.site.findMany({
            where: { organizationId, id: { in: siteIds } },
            select: { id: true, code: true, name: true },
          });
    const siteMap = new Map(sites.map((s) => [s.id, s]));

    return rows.map((g) => {
      const site = siteMap.get(g.siteId);
      return this.toDto(g, {
        siteCode: site?.code ?? null,
        siteName: site?.name ?? null,
      });
    });
  }

  async update(
    id: string,
    dto: UpdateGateDto,
    user: AuthUser,
  ): Promise<GateResponseDto> {
    const gate = await this.prisma.gate.findFirst({
      where: { id, organizationId: user.organizationId },
    });
    if (!gate) throw new NotFoundException('Gate not found');
    assertSiteAccess(user, gate.siteId);

    if (
      dto.name === undefined &&
      dto.gateType === undefined &&
      dto.isActive === undefined
    ) {
      throw new BadRequestException('No gate fields to update');
    }

    const updated = await this.prisma.gate.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.gateType !== undefined
          ? { gateType: dto.gateType as GateType }
          : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
    });

    await this.audit.record({
      organizationId: user.organizationId,
      actorId: user.id,
      action: 'gate.updated',
      resourceType: 'Gate',
      resourceId: id,
      before: gate,
      after: updated,
    });

    const site = await this.prisma.site.findFirst({
      where: { id: updated.siteId, organizationId: user.organizationId },
      select: { code: true, name: true },
    });

    return this.toDto(updated, {
      siteCode: site?.code ?? null,
      siteName: site?.name ?? null,
    });
  }

  private toDto(
    g: {
      id: string;
      organizationId: string;
      siteId: string;
      code: string;
      name: string;
      gateType: string;
      isActive: boolean;
      createdAt: Date;
    },
    enrich?: { siteCode?: string | null; siteName?: string | null },
  ): GateResponseDto {
    return {
      id: g.id,
      organizationId: g.organizationId,
      siteId: g.siteId,
      siteCode: enrich?.siteCode ?? null,
      siteName: enrich?.siteName ?? null,
      code: g.code,
      name: g.name,
      gateType: g.gateType,
      isActive: g.isActive,
      createdAt: g.createdAt,
    };
  }
}
