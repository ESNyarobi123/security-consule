import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService, AuthUser } from '@pssms/shared';
import { AuditService } from '@pssms/audit';
import {
  CreateShiftDto,
  ShiftResponseDto,
} from '../presentation/dto/operations.dto';

@Injectable()
export class ShiftsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async create(dto: CreateShiftDto, user: AuthUser): Promise<ShiftResponseDto> {
    const site = await this.prisma.site.findFirst({
      where: { id: dto.siteId, organizationId: user.organizationId },
    });
    if (!site) throw new NotFoundException('Site not found');

    const shift = await this.prisma.shift.create({
      data: {
        organizationId: user.organizationId,
        siteId: dto.siteId,
        name: dto.name,
        startAt: new Date(dto.startAt),
        endAt: new Date(dto.endAt),
        instructions: dto.instructions,
        createdBy: user.id,
        assignments: {
          create: dto.guardIds.map((guardId) => ({
            guardId,
            supervisorId: dto.supervisorId,
          })),
        },
      },
    });

    await this.audit.record({
      organizationId: user.organizationId,
      actorId: user.id,
      action: 'shift.created',
      resourceType: 'Shift',
      resourceId: shift.id,
      after: shift,
    });

    return {
      id: shift.id,
      siteId: shift.siteId,
      name: shift.name,
      startAt: shift.startAt,
      endAt: shift.endAt,
      status: shift.status,
    };
  }

  async list(organizationId: string, siteId?: string): Promise<ShiftResponseDto[]> {
    const rows = await this.prisma.shift.findMany({
      where: {
        organizationId,
        ...(siteId ? { siteId } : {}),
      },
      orderBy: { startAt: 'desc' },
      take: 100,
    });
    return rows.map((s) => ({
      id: s.id,
      siteId: s.siteId,
      name: s.name,
      startAt: s.startAt,
      endAt: s.endAt,
      status: s.status,
    }));
  }
}
