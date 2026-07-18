import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { GuardStatus } from '@prisma/client';
import { PrismaService, AuthUser } from '@pssms/shared';
import { AuditService } from '@pssms/audit';
import {
  CreateGuardDto,
  GuardResponseDto,
} from '../presentation/dto/guard.dto';

@Injectable()
export class GuardsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async create(dto: CreateGuardDto, user: AuthUser): Promise<GuardResponseDto> {
    const exists = await this.prisma.guardProfile.findFirst({
      where: {
        organizationId: user.organizationId,
        OR: [
          { employeeNumber: dto.employeeNumber },
          { userId: dto.userId },
        ],
      },
    });
    if (exists) throw new ConflictException('Guard profile already exists');

    const guard = await this.prisma.guardProfile.create({
      data: {
        organizationId: user.organizationId,
        userId: dto.userId,
        employeeNumber: dto.employeeNumber,
        phone: dto.phone,
        status: GuardStatus.ACTIVE,
      },
    });

    await this.audit.record({
      organizationId: user.organizationId,
      actorId: user.id,
      action: 'guard.created',
      resourceType: 'GuardProfile',
      resourceId: guard.id,
      after: guard,
    });

    return this.toDto(guard);
  }

  async list(organizationId: string): Promise<GuardResponseDto[]> {
    const rows = await this.prisma.guardProfile.findMany({
      where: { organizationId },
      orderBy: { employeeNumber: 'asc' },
    });
    return rows.map((g) => this.toDto(g));
  }

  async updateStatus(
    id: string,
    status: GuardStatus,
    deploymentEligible: boolean | undefined,
    user: AuthUser,
  ): Promise<GuardResponseDto> {
    const existing = await this.prisma.guardProfile.findFirst({
      where: { id, organizationId: user.organizationId },
    });
    if (!existing) throw new NotFoundException('Guard not found');

    const updated = await this.prisma.guardProfile.update({
      where: { id },
      data: {
        status,
        ...(deploymentEligible !== undefined ? { deploymentEligible } : {}),
      },
    });

    await this.audit.record({
      organizationId: user.organizationId,
      actorId: user.id,
      action: 'guard.status.updated',
      resourceType: 'GuardProfile',
      resourceId: id,
      before: existing,
      after: updated,
    });

    return this.toDto(updated);
  }

  async getByUserId(userId: string, organizationId: string) {
    return this.prisma.guardProfile.findFirst({
      where: { userId, organizationId },
    });
  }

  private toDto(g: {
    id: string;
    organizationId: string;
    userId: string;
    employeeNumber: string;
    status: GuardStatus;
    deploymentEligible: boolean;
    createdAt: Date;
  }): GuardResponseDto {
    return {
      id: g.id,
      organizationId: g.organizationId,
      userId: g.userId,
      employeeNumber: g.employeeNumber,
      status: g.status,
      deploymentEligible: g.deploymentEligible,
      createdAt: g.createdAt,
    };
  }
}
