import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DeploymentStatus, GuardStatus, Prisma } from '@prisma/client';
import { PrismaService, AuthUser } from '@pssms/shared';
import { AuditService } from '@pssms/audit';
import {
  CreateDeploymentDto,
  DeploymentResponseDto,
} from '../presentation/dto/operations.dto';

const DEPLOYABLE_STATUSES: GuardStatus[] = [
  GuardStatus.ACTIVE,
  GuardStatus.AVAILABLE,
];

type DbClient = Prisma.TransactionClient | PrismaService;

@Injectable()
export class DeploymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async create(
    dto: CreateDeploymentDto,
    user: AuthUser,
  ): Promise<DeploymentResponseDto> {
    const guard = await this.prisma.guardProfile.findFirst({
      where: { id: dto.guardId, organizationId: user.organizationId },
    });
    if (!guard) throw new NotFoundException('Guard not found in organization');
    if (!DEPLOYABLE_STATUSES.includes(guard.status)) {
      throw new BadRequestException(
        `Guard status ${guard.status} is not deployment-eligible`,
      );
    }
    if (guard.deploymentEligible === false) {
      throw new BadRequestException('Guard is not marked deployment-eligible');
    }

    const site = await this.prisma.site.findFirst({
      where: { id: dto.siteId, organizationId: user.organizationId },
    });
    if (!site) throw new NotFoundException('Site not found in organization');

    const overlapping = await this.prisma.guardDeployment.findFirst({
      where: {
        organizationId: user.organizationId,
        guardId: dto.guardId,
        status: DeploymentStatus.ACTIVE,
      },
    });
    if (overlapping) {
      throw new ConflictException(
        'Guard already has an ACTIVE deployment; end it before creating another',
      );
    }

    const deployment = await this.prisma.guardDeployment.create({
      data: {
        organizationId: user.organizationId,
        guardId: dto.guardId,
        siteId: dto.siteId,
        contractId: dto.contractId,
        startDate: new Date(dto.startDate),
        endDate: dto.endDate ? new Date(dto.endDate) : undefined,
        status: DeploymentStatus.ACTIVE,
        createdBy: user.id,
      },
    });

    await this.prisma.guardProfile.update({
      where: { id: dto.guardId },
      data: { deploymentEligible: true },
    });

    await this.audit.record({
      organizationId: user.organizationId,
      actorId: user.id,
      action: 'deployment.created',
      resourceType: 'GuardDeployment',
      resourceId: deployment.id,
      after: deployment,
    });

    return this.toDto(deployment);
  }

  async end(
    id: string,
    user: AuthUser,
  ): Promise<DeploymentResponseDto> {
    const deployment = await this.prisma.guardDeployment.findFirst({
      where: { id, organizationId: user.organizationId },
    });
    if (!deployment) throw new NotFoundException('Deployment not found');
    return this.endRow(deployment, user);
  }

  /**
   * End every ACTIVE deployment for a guard (EXIT / heal path).
   * Idempotent when none are ACTIVE. Module port for workforce — no cross-lib Prisma.
   * Pass `tx` so EXIT can keep terminate + end atomic.
   */
  async endAllActiveForGuard(
    guardId: string,
    user: AuthUser,
    meta?: { reason?: string; sourceMovementId?: string },
    tx?: Prisma.TransactionClient,
  ): Promise<{ endedIds: string[] }> {
    const db: DbClient = tx ?? this.prisma;
    const active = await db.guardDeployment.findMany({
      where: {
        organizationId: user.organizationId,
        guardId,
        status: DeploymentStatus.ACTIVE,
      },
    });
    const endedIds: string[] = [];
    for (const row of active) {
      const updated = await this.endRow(row, user, meta, db);
      endedIds.push(updated.id);
    }
    return { endedIds };
  }

  private async endRow(
    deployment: {
      id: string;
      organizationId: string;
      guardId: string;
      siteId: string;
      status: string;
      startDate: Date;
      endDate?: Date | null;
    },
    user: AuthUser,
    meta?: { reason?: string; sourceMovementId?: string },
    db: DbClient = this.prisma,
  ): Promise<DeploymentResponseDto> {
    if (deployment.status === DeploymentStatus.ENDED) {
      return this.toDto(deployment);
    }

    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    const updated = await db.guardDeployment.update({
      where: { id: deployment.id },
      data: {
        status: DeploymentStatus.ENDED,
        endDate: deployment.endDate ?? today,
      },
    });

    await this.audit.record({
      organizationId: user.organizationId,
      actorId: user.id,
      action: 'deployment.ended',
      resourceType: 'GuardDeployment',
      resourceId: updated.id,
      before: deployment,
      after: {
        ...updated,
        ...(meta?.reason ? { reason: meta.reason } : {}),
        ...(meta?.sourceMovementId
          ? { sourceMovementId: meta.sourceMovementId }
          : {}),
      },
    });

    return this.toDto(updated);
  }

  async list(organizationId: string): Promise<DeploymentResponseDto[]> {
    const rows = await this.prisma.guardDeployment.findMany({
      where: { organizationId },
      orderBy: { startDate: 'desc' },
      take: 100,
    });
    return rows.map((d) => this.toDto(d));
  }

  private toDto(d: {
    id: string;
    guardId: string;
    siteId: string;
    status: string;
    startDate: Date;
    endDate?: Date | null;
  }): DeploymentResponseDto {
    return {
      id: d.id,
      guardId: d.guardId,
      siteId: d.siteId,
      status: d.status,
      startDate: d.startDate,
      endDate: d.endDate ?? null,
    };
  }
}
