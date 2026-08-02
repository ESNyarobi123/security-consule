import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ContractStatus,
  DeploymentStatus,
  GuardStatus,
  Prisma,
} from '@prisma/client';
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

/** Same billable set as invoices (finance). */
const BILLABLE_CONTRACT_STATUSES: ContractStatus[] = [
  ContractStatus.APPROVED,
  ContractStatus.ACTIVE,
  ContractStatus.EXPIRING,
];

type DbClient = Prisma.TransactionClient | PrismaService;

type DeploymentRow = {
  id: string;
  organizationId: string;
  guardId: string;
  siteId: string;
  contractId?: string | null;
  status: string;
  startDate: Date;
  endDate?: Date | null;
};

type ContractEnrichment = {
  contractNumber: string;
  customerId: string;
};

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

    if (!dto.contractId?.trim()) {
      throw new BadRequestException('contractId is required');
    }

    const contract = await this.prisma.contract.findFirst({
      where: {
        id: dto.contractId,
        organizationId: user.organizationId,
      },
      select: {
        id: true,
        customerId: true,
        contractNumber: true,
        status: true,
      },
    });
    if (!contract) {
      throw new NotFoundException('Contract not found in organization');
    }
    if (!BILLABLE_CONTRACT_STATUSES.includes(contract.status)) {
      throw new BadRequestException(
        `Contract ${contract.contractNumber} must be APPROVED, ACTIVE, or EXPIRING to deploy (now ${contract.status})`,
      );
    }

    const boundSiteCount = await this.prisma.contractSite.count({
      where: {
        organizationId: user.organizationId,
        contractId: contract.id,
      },
    });
    if (boundSiteCount === 0) {
      throw new BadRequestException(
        'Contract has no sites; bind sites first',
      );
    }

    const siteLink = await this.prisma.contractSite.findFirst({
      where: {
        organizationId: user.organizationId,
        contractId: contract.id,
        siteId: dto.siteId,
      },
    });
    if (!siteLink) {
      throw new BadRequestException(
        `Site is not covered by contract ${contract.contractNumber}; bind the site on the contract first`,
      );
    }

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
        contractId: contract.id,
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
      after: {
        ...deployment,
        contractNumber: contract.contractNumber,
        customerId: contract.customerId,
      },
    });

    return this.toDto(deployment, {
      contractNumber: contract.contractNumber,
      customerId: contract.customerId,
    });
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
    deployment: DeploymentRow,
    user: AuthUser,
    meta?: { reason?: string; sourceMovementId?: string },
    db: DbClient = this.prisma,
  ): Promise<DeploymentResponseDto> {
    if (deployment.status === DeploymentStatus.ENDED) {
      return this.enrichOne(deployment);
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

    return this.enrichOne(updated);
  }

  async list(organizationId: string): Promise<DeploymentResponseDto[]> {
    const rows = await this.prisma.guardDeployment.findMany({
      where: { organizationId },
      orderBy: { startDate: 'desc' },
      take: 100,
    });
    return this.enrichMany(rows);
  }

  private async enrichOne(d: DeploymentRow): Promise<DeploymentResponseDto> {
    const [enriched] = await this.enrichMany([d]);
    return enriched!;
  }

  private async enrichMany(
    rows: DeploymentRow[],
  ): Promise<DeploymentResponseDto[]> {
    const contractIds = [
      ...new Set(
        rows
          .map((r) => r.contractId)
          .filter((id): id is string => Boolean(id)),
      ),
    ];
    const enrichById = new Map<string, ContractEnrichment>();
    if (contractIds.length > 0) {
      const contracts = await this.prisma.contract.findMany({
        where: { id: { in: contractIds } },
        select: { id: true, contractNumber: true, customerId: true },
      });
      for (const c of contracts) {
        enrichById.set(c.id, {
          contractNumber: c.contractNumber,
          customerId: c.customerId,
        });
      }
    }
    return rows.map((d) =>
      this.toDto(
        d,
        d.contractId ? enrichById.get(d.contractId) : undefined,
      ),
    );
  }

  private toDto(
    d: DeploymentRow,
    enrich?: ContractEnrichment,
  ): DeploymentResponseDto {
    return {
      id: d.id,
      guardId: d.guardId,
      siteId: d.siteId,
      contractId: d.contractId ?? null,
      contractNumber: enrich?.contractNumber ?? null,
      customerId: enrich?.customerId ?? null,
      status: d.status,
      startDate: d.startDate,
      endDate: d.endDate ?? null,
    };
  }
}
