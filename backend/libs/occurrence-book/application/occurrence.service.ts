import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService, AuthUser } from '@pssms/shared';
import { AuditService } from '@pssms/audit';
import {
  CorrectOccurrenceDto,
  CreateOccurrenceDto,
  OccurrenceResponseDto,
} from '../presentation/dto/occurrence.dto';

@Injectable()
export class OccurrenceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async create(
    dto: CreateOccurrenceDto,
    user: AuthUser,
  ): Promise<OccurrenceResponseDto> {
    const entry = await this.prisma.occurrenceEntry.create({
      data: {
        organizationId: user.organizationId,
        siteId: dto.siteId,
        officerId: user.id,
        category: dto.category,
        description: dto.description,
        recordedAt: new Date(dto.recordedAt),
      },
    });

    await this.audit.record({
      organizationId: user.organizationId,
      actorId: user.id,
      action: 'occurrence.created',
      resourceType: 'OccurrenceEntry',
      resourceId: entry.id,
      after: entry,
    });

    return this.toDto(entry);
  }

  /** Append-only correction: original stays; new version with reason + approver */
  async correct(
    entryId: string,
    dto: CorrectOccurrenceDto,
    user: AuthUser,
  ): Promise<OccurrenceResponseDto> {
    const original = await this.prisma.occurrenceEntry.findFirst({
      where: {
        id: entryId,
        organizationId: user.organizationId,
        isCurrent: true,
      },
    });
    if (!original) throw new NotFoundException('Occurrence entry not found');

    await this.prisma.occurrenceEntry.update({
      where: { id: entryId },
      data: { isCurrent: false },
    });

    const correction = await this.prisma.occurrenceEntry.create({
      data: {
        organizationId: user.organizationId,
        siteId: original.siteId,
        officerId: user.id,
        category: dto.category ?? original.category,
        description: dto.description,
        version: original.version + 1,
        parentEntryId: original.id,
        correctionReason: dto.reason,
        approvedBy: user.id,
        recordedAt: original.recordedAt,
      },
    });

    await this.audit.record({
      organizationId: user.organizationId,
      actorId: user.id,
      action: 'occurrence.corrected',
      resourceType: 'OccurrenceEntry',
      resourceId: correction.id,
      before: original,
      after: correction,
    });

    return this.toDto(correction);
  }

  async list(organizationId: string, siteId?: string) {
    return this.prisma.occurrenceEntry.findMany({
      where: {
        organizationId,
        isCurrent: true,
        ...(siteId ? { siteId } : {}),
      },
      orderBy: { recordedAt: 'desc' },
      take: 100,
    });
  }

  private toDto(e: {
    id: string;
    siteId: string;
    category: string;
    description: string;
    version: number;
    isCurrent: boolean;
    recordedAt: Date;
  }): OccurrenceResponseDto {
    return {
      id: e.id,
      siteId: e.siteId,
      category: e.category,
      description: e.description,
      version: e.version,
      isCurrent: e.isCurrent,
      recordedAt: e.recordedAt,
    };
  }
}
