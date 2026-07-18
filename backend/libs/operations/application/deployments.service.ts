import { ConflictException, Injectable } from '@nestjs/common';
import { DeploymentStatus } from '@prisma/client';
import { PrismaService, AuthUser } from '@pssms/shared';
import { AuditService } from '@pssms/audit';
import {
  CreateDeploymentDto,
  DeploymentResponseDto,
} from '../presentation/dto/operations.dto';

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

    return {
      id: deployment.id,
      guardId: deployment.guardId,
      siteId: deployment.siteId,
      status: deployment.status,
      startDate: deployment.startDate,
    };
  }

  async list(organizationId: string): Promise<DeploymentResponseDto[]> {
    const rows = await this.prisma.guardDeployment.findMany({
      where: { organizationId },
      orderBy: { startDate: 'desc' },
      take: 100,
    });
    return rows.map((d) => ({
      id: d.id,
      guardId: d.guardId,
      siteId: d.siteId,
      status: d.status,
      startDate: d.startDate,
    }));
  }
}
