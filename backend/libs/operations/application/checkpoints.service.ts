import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { PrismaService, AuthUser } from '@pssms/shared';
import { AuditService } from '@pssms/audit';
import {
  CheckpointResponseDto,
  CreateCheckpointDto,
} from '../presentation/dto/operations.dto';

@Injectable()
export class CheckpointsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  private toDto(
    cp: {
      id: string;
      siteId: string;
      code: string;
      name: string;
      zone: string | null;
      qrCode: string | null;
      nfcTagId: string | null;
      latitude: number | null;
      longitude: number | null;
      isActive: boolean;
      createdAt: Date;
    },
    site?: { code: string; name: string } | null,
  ): CheckpointResponseDto {
    return {
      id: cp.id,
      siteId: cp.siteId,
      siteCode: site?.code,
      siteName: site?.name,
      code: cp.code,
      name: cp.name,
      zone: cp.zone,
      qrCode: cp.qrCode,
      nfcTagId: cp.nfcTagId,
      latitude: cp.latitude,
      longitude: cp.longitude,
      isActive: cp.isActive,
      createdAt: cp.createdAt,
    };
  }

  async create(
    dto: CreateCheckpointDto,
    user: AuthUser,
  ): Promise<CheckpointResponseDto> {
    const site = await this.prisma.site.findFirst({
      where: { id: dto.siteId, organizationId: user.organizationId },
      select: { id: true, code: true, name: true },
    });
    if (!site) throw new BadRequestException('Site not found in organization');

    const exists = await this.prisma.checkpoint.findFirst({
      where: {
        organizationId: user.organizationId,
        siteId: dto.siteId,
        code: dto.code,
      },
    });
    if (exists) throw new ConflictException('Checkpoint code exists');

    const cp = await this.prisma.checkpoint.create({
      data: {
        organizationId: user.organizationId,
        siteId: dto.siteId,
        code: dto.code,
        name: dto.name,
        zone: dto.zone,
        qrCode: dto.qrCode ?? dto.code,
        nfcTagId: dto.nfcTagId,
        latitude: dto.latitude,
        longitude: dto.longitude,
      },
    });

    await this.audit.record({
      organizationId: user.organizationId,
      actorId: user.id,
      action: 'checkpoint.created',
      resourceType: 'Checkpoint',
      resourceId: cp.id,
      after: cp,
    });

    return this.toDto(cp, site);
  }

  async list(organizationId: string, siteId?: string) {
    if (siteId) {
      const site = await this.prisma.site.findFirst({
        where: { id: siteId, organizationId },
        select: { id: true },
      });
      if (!site) throw new BadRequestException('Site not found in organization');
    }

    const rows = await this.prisma.checkpoint.findMany({
      where: {
        organizationId,
        isActive: true,
        ...(siteId ? { siteId } : {}),
      },
      orderBy: [{ siteId: 'asc' }, { code: 'asc' }],
    });

    const siteIds = [...new Set(rows.map((r) => r.siteId))];
    const sites = siteIds.length
      ? await this.prisma.site.findMany({
          where: { organizationId, id: { in: siteIds } },
          select: { id: true, code: true, name: true },
        })
      : [];
    const siteMap = new Map(sites.map((s) => [s.id, s]));

    return rows.map((r) => this.toDto(r, siteMap.get(r.siteId)));
  }
}
