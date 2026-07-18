import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ContractStatus } from '@prisma/client';
import { PrismaService, AuthUser } from '@pssms/shared';
import { AuditService } from '@pssms/audit';
import {
  ContractResponseDto,
  CreateContractDto,
} from '../presentation/dto/contract.dto';

@Injectable()
export class ContractsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async create(
    dto: CreateContractDto,
    user: AuthUser,
  ): Promise<ContractResponseDto> {
    const customer = await this.prisma.customer.findFirst({
      where: { id: dto.customerId, organizationId: user.organizationId },
    });
    if (!customer) throw new NotFoundException('Customer not found');

    const exists = await this.prisma.contract.findFirst({
      where: {
        organizationId: user.organizationId,
        contractNumber: dto.contractNumber,
      },
    });
    if (exists) throw new ConflictException('Contract number already exists');

    const contract = await this.prisma.contract.create({
      data: {
        organizationId: user.organizationId,
        customerId: dto.customerId,
        contractNumber: dto.contractNumber,
        title: dto.title,
        serviceType: dto.serviceType,
        startDate: new Date(dto.startDate),
        endDate: new Date(dto.endDate),
        monthlyFee: dto.monthlyFee,
        guardCount: dto.guardCount,
        slaTerms: dto.slaTerms,
        status: ContractStatus.DRAFT,
        createdBy: user.id,
      },
    });

    await this.audit.record({
      organizationId: user.organizationId,
      actorId: user.id,
      action: 'contract.created',
      resourceType: 'Contract',
      resourceId: contract.id,
      after: contract,
    });

    return this.toDto(contract);
  }

  async list(
    organizationId: string,
    customerId?: string,
  ): Promise<ContractResponseDto[]> {
    const rows = await this.prisma.contract.findMany({
      where: {
        organizationId,
        ...(customerId ? { customerId } : {}),
      },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((c) => this.toDto(c));
  }

  async updateStatus(
    id: string,
    status: ContractStatus,
    user: AuthUser,
  ): Promise<ContractResponseDto> {
    const existing = await this.prisma.contract.findFirst({
      where: { id, organizationId: user.organizationId },
    });
    if (!existing) throw new NotFoundException('Contract not found');

    const updated = await this.prisma.contract.update({
      where: { id },
      data: { status, version: { increment: 1 } },
    });

    await this.audit.record({
      organizationId: user.organizationId,
      actorId: user.id,
      action: `contract.status.${status.toLowerCase()}`,
      resourceType: 'Contract',
      resourceId: id,
      before: existing,
      after: updated,
    });

    // Domain events (in-process for Phase 1; RabbitMQ in later phase)
    // contract.approved | contract.activated | contract.terminated

    return this.toDto(updated);
  }

  private toDto(c: {
    id: string;
    organizationId: string;
    customerId: string;
    contractNumber: string;
    title: string;
    serviceType: string;
    status: ContractStatus;
    startDate: Date;
    endDate: Date;
    monthlyFee: { toString(): string };
    currency: string;
    guardCount: number | null;
    createdAt: Date;
  }): ContractResponseDto {
    return {
      id: c.id,
      organizationId: c.organizationId,
      customerId: c.customerId,
      contractNumber: c.contractNumber,
      title: c.title,
      serviceType: c.serviceType,
      status: c.status,
      startDate: c.startDate,
      endDate: c.endDate,
      monthlyFee: c.monthlyFee.toString(),
      currency: c.currency,
      guardCount: c.guardCount,
      createdAt: c.createdAt,
    };
  }
}
