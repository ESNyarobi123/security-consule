import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  PrismaService,
  AuthUser,
  assertSiteAccess,
  isGuardSelfScoped,
  siteScopeWhere,
} from '@pssms/shared';
import { AuditService } from '@pssms/audit';
import {
  CorrectOccurrenceDto,
  CreateOccurrenceDto,
  EOB_CATEGORIES,
  EOB_CATEGORY_LABELS,
  EobCategoryOptionDto,
  OccurrenceHistoryVersionDto,
  OccurrenceResponseDto,
} from '../presentation/dto/occurrence.dto';

type OccurrenceRow = {
  id: string;
  siteId: string;
  category: string;
  description: string;
  version: number;
  isCurrent: boolean;
  correctionReason: string | null;
  officerId: string | null;
  recordedAt: Date;
  createdAt: Date;
  parentEntryId?: string | null;
  approvedBy?: string | null;
};

@Injectable()
export class OccurrenceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /** Design §30 event category catalog (value + human label). */
  categoryOptions(): EobCategoryOptionDto[] {
    return EOB_CATEGORIES.map((value) => ({
      value,
      label: EOB_CATEGORY_LABELS[value],
    }));
  }

  /** Batch-resolve officer/approver full names (org-scoped). */
  private async userNames(
    organizationId: string,
    ids: Array<string | null | undefined>,
  ): Promise<Map<string, string>> {
    const unique = [...new Set(ids.filter((x): x is string => !!x))];
    if (unique.length === 0) return new Map();
    const users = await this.prisma.user.findMany({
      where: { id: { in: unique }, organizationId },
      select: { id: true, fullName: true },
    });
    return new Map(users.map((u) => [u.id, u.fullName]));
  }

  async create(
    dto: CreateOccurrenceDto,
    user: AuthUser,
  ): Promise<OccurrenceResponseDto> {
    const site = await this.prisma.site.findFirst({
      where: { id: dto.siteId, organizationId: user.organizationId },
      select: { id: true, code: true, name: true },
    });
    if (!site) throw new NotFoundException('Site not found');
    assertSiteAccess(user, dto.siteId);

    const entry = await this.prisma.occurrenceEntry.create({
      data: {
        organizationId: user.organizationId,
        siteId: dto.siteId,
        officerId: user.id,
        category: dto.category.trim(),
        description: dto.description.trim(),
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

    const names = await this.userNames(user.organizationId, [user.id]);
    return this.toDto(entry, site, names);
  }

  /**
   * Append-only correction: original stays (isCurrent=false); new version with reason.
   * approvedBy left null — creator/corrector ≠ approver (use approve()).
   */
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
    if (isGuardSelfScoped(user)) {
      if (original.officerId !== user.id) {
        throw new ForbiddenException({
          error: 'GUARD_SCOPE_DENIED',
          message: 'Guards may only correct their own occurrence entries',
        });
      }
    } else {
      assertSiteAccess(user, original.siteId);
    }

    const reason = dto.reason.trim();
    const description = dto.description.trim();

    const correction = await this.prisma.$transaction(async (tx) => {
      await tx.occurrenceEntry.update({
        where: { id: entryId },
        data: { isCurrent: false },
      });
      return tx.occurrenceEntry.create({
        data: {
          organizationId: user.organizationId,
          siteId: original.siteId,
          officerId: user.id,
          category: (dto.category ?? original.category).trim(),
          description,
          version: original.version + 1,
          parentEntryId: original.id,
          correctionReason: reason,
          // Do NOT set approvedBy = actor (false SoD). Leave null until real approver.
          recordedAt: original.recordedAt,
        },
      });
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

    const site = await this.prisma.site.findFirst({
      where: {
        id: correction.siteId,
        organizationId: user.organizationId,
      },
      select: { id: true, code: true, name: true },
    });

    const names = await this.userNames(user.organizationId, [user.id]);
    return this.toDto(correction, site ?? undefined, names);
  }

  /**
   * Second-person approve of the current entry (original or correction).
   * SoD: approver must not be the officer who recorded this version.
   */
  async approve(
    entryId: string,
    user: AuthUser,
  ): Promise<OccurrenceResponseDto> {
    const entry = await this.prisma.occurrenceEntry.findFirst({
      where: { id: entryId, organizationId: user.organizationId },
    });
    if (!entry) throw new NotFoundException('Occurrence entry not found');
    assertSiteAccess(user, entry.siteId);
    if (!entry.isCurrent) {
      throw new BadRequestException(
        'Only the current occurrence version can be approved',
      );
    }
    if (entry.approvedBy) {
      throw new BadRequestException('Occurrence entry is already approved');
    }
    if (entry.officerId && entry.officerId === user.id) {
      throw new BadRequestException(
        'Recorder cannot approve their own occurrence entry',
      );
    }

    const updated = await this.prisma.occurrenceEntry.update({
      where: { id: entry.id },
      data: { approvedBy: user.id },
    });

    await this.audit.record({
      organizationId: user.organizationId,
      actorId: user.id,
      action: 'occurrence.approved',
      resourceType: 'OccurrenceEntry',
      resourceId: updated.id,
      before: entry,
      after: updated,
    });

    const site = await this.prisma.site.findFirst({
      where: {
        id: updated.siteId,
        organizationId: user.organizationId,
      },
      select: { id: true, code: true, name: true },
    });

    const names = await this.userNames(user.organizationId, [
      updated.officerId,
      updated.approvedBy,
    ]);
    return this.toDto(updated, site ?? undefined, names);
  }

  async list(
    organizationId: string,
    user: AuthUser,
    siteId?: string,
  ): Promise<OccurrenceResponseDto[]> {
    const rows = await this.prisma.occurrenceEntry.findMany({
      where: {
        organizationId,
        isCurrent: true,
        ...(isGuardSelfScoped(user)
          ? { officerId: user.id }
          : siteScopeWhere(user, siteId)),
      },
      orderBy: { recordedAt: 'desc' },
      take: 100,
    });

    const siteIds = [...new Set(rows.map((r) => r.siteId))];
    const sites =
      siteIds.length === 0
        ? []
        : await this.prisma.site.findMany({
            where: { id: { in: siteIds }, organizationId },
            select: { id: true, code: true, name: true },
          });
    const siteMap = new Map(sites.map((s) => [s.id, s]));
    const names = await this.userNames(
      organizationId,
      rows.flatMap((r) => [r.officerId, r.approvedBy]),
    );

    return rows.map((e) => this.toDto(e, siteMap.get(e.siteId), names));
  }

  /**
   * Full append-only lineage for any id in the chain (current or superseded).
   * Walks parents to root, then children to tip; ordered by version asc.
   */
  async history(
    entryId: string,
    user: AuthUser,
  ): Promise<OccurrenceHistoryVersionDto[]> {
    const organizationId = user.organizationId;
    const start = await this.prisma.occurrenceEntry.findFirst({
      where: { id: entryId, organizationId },
    });
    if (!start) throw new NotFoundException('Occurrence entry not found');
    if (isGuardSelfScoped(user)) {
      if (start.officerId !== user.id) {
        throw new ForbiddenException({
          error: 'GUARD_SCOPE_DENIED',
          message: 'Guards may only view their own occurrence entries',
        });
      }
    } else {
      assertSiteAccess(user, start.siteId);
    }

    // Walk to root via parentEntryId
    let root = start;
    const seenUp = new Set<string>([root.id]);
    while (root.parentEntryId) {
      const parent = await this.prisma.occurrenceEntry.findFirst({
        where: { id: root.parentEntryId, organizationId },
      });
      if (!parent || seenUp.has(parent.id)) break;
      seenUp.add(parent.id);
      root = parent;
    }

    // Walk children root → current
    const chain: OccurrenceRow[] = [root];
    const seenDown = new Set<string>([root.id]);
    let cursor = root;
    for (;;) {
      const child = await this.prisma.occurrenceEntry.findFirst({
        where: {
          parentEntryId: cursor.id,
          organizationId,
        },
        orderBy: { version: 'asc' },
      });
      if (!child || seenDown.has(child.id)) break;
      seenDown.add(child.id);
      chain.push(child);
      cursor = child;
    }

    const names = await this.userNames(
      organizationId,
      chain.flatMap((c) => [c.officerId, c.approvedBy]),
    );

    return chain
      .sort((a, b) => a.version - b.version)
      .map((e) => this.toHistoryDto(e, names));
  }

  private toDto(
    e: OccurrenceRow,
    site?: { code: string; name: string },
    names?: Map<string, string>,
  ): OccurrenceResponseDto {
    return {
      id: e.id,
      siteId: e.siteId,
      siteCode: site?.code,
      siteName: site?.name,
      category: e.category,
      description: e.description,
      version: e.version,
      isCurrent: e.isCurrent,
      correctionReason: e.correctionReason,
      officerId: e.officerId,
      officerName: (e.officerId && names?.get(e.officerId)) || null,
      approvedBy: e.approvedBy ?? null,
      approvedByName: (e.approvedBy && names?.get(e.approvedBy)) || null,
      recordedAt: e.recordedAt,
      createdAt: e.createdAt,
    };
  }

  private toHistoryDto(
    e: OccurrenceRow,
    names?: Map<string, string>,
  ): OccurrenceHistoryVersionDto {
    return {
      id: e.id,
      version: e.version,
      isCurrent: e.isCurrent,
      category: e.category,
      description: e.description,
      correctionReason: e.correctionReason,
      officerId: e.officerId,
      officerName: (e.officerId && names?.get(e.officerId)) || null,
      recordedAt: e.recordedAt,
      createdAt: e.createdAt,
      parentEntryId: e.parentEntryId ?? null,
      approvedBy: e.approvedBy ?? null,
      approvedByName: (e.approvedBy && names?.get(e.approvedBy)) || null,
    };
  }
}
