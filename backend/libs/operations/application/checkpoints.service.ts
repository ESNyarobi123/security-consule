import { ConflictException, Injectable } from '@nestjs/common';
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

  async create(
    dto: CreateCheckpointDto,
    user: AuthUser,
  ): Promise<CheckpointResponseDto> {
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

    return {
      id: cp.id,
      siteId: cp.siteId,
      code: cp.code,
      name: cp.name,
      qrCode: cp.qrCode,
      nfcTagId: cp.nfcTagId,
      isActive: cp.isActive,
    };
  }

  async list(siteId: string, organizationId: string) {
    return this.prisma.checkpoint.findMany({
      where: { siteId, organizationId, isActive: true },
      orderBy: { code: 'asc' },
    });
  }
}
