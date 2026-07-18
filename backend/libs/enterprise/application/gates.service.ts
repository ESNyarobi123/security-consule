import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { GateType } from '@prisma/client';
import { PrismaService, AuthUser } from '@pssms/shared';
import { AuditService } from '@pssms/audit';
import { CreateGateDto, GateResponseDto } from '../presentation/dto/enterprise.dto';

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
        code: dto.code,
        name: dto.name,
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

    return this.toDto(gate);
  }

  async list(
    organizationId: string,
    siteId?: string,
  ): Promise<GateResponseDto[]> {
    const rows = await this.prisma.gate.findMany({
      where: {
        organizationId,
        isActive: true,
        ...(siteId ? { siteId } : {}),
      },
      orderBy: { name: 'asc' },
    });
    return rows.map((g) => this.toDto(g));
  }

  private toDto(g: {
    id: string;
    organizationId: string;
    siteId: string;
    code: string;
    name: string;
    gateType: string;
    isActive: boolean;
    createdAt: Date;
  }): GateResponseDto {
    return {
      id: g.id,
      organizationId: g.organizationId,
      siteId: g.siteId,
      code: g.code,
      name: g.name,
      gateType: g.gateType,
      isActive: g.isActive,
      createdAt: g.createdAt,
    };
  }
}
