import { Injectable, NotFoundException } from '@nestjs/common';
import { TrainingStatus } from '@prisma/client';
import { PrismaService, AuthUser } from '@pssms/shared';
import { AuditService } from '@pssms/audit';
import { EmployeesService } from './employees.service';
import {
  CreateTrainingRecordDto,
  TrainingRecordResponseDto,
  UpdateTrainingRecordDto,
} from '../presentation/dto/training.dto';

@Injectable()
export class TrainingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly employees: EmployeesService,
  ) {}

  async create(
    dto: CreateTrainingRecordDto,
    user: AuthUser,
  ): Promise<TrainingRecordResponseDto> {
    await this.employees.getById(dto.employeeId, user.organizationId);

    const row = await this.prisma.trainingRecord.create({
      data: {
        organizationId: user.organizationId,
        employeeId: dto.employeeId,
        title: dto.title,
        provider: dto.provider,
        startDate: dto.startDate ? new Date(dto.startDate) : undefined,
        endDate: dto.endDate ? new Date(dto.endDate) : undefined,
        status: dto.status ?? TrainingStatus.PLANNED,
        notes: dto.notes,
        createdBy: user.id,
      },
    });

    await this.audit.record({
      organizationId: user.organizationId,
      actorId: user.id,
      action: 'training.created',
      resourceType: 'TrainingRecord',
      resourceId: row.id,
      after: row,
    });

    return this.toDto(row);
  }

  async update(
    id: string,
    dto: UpdateTrainingRecordDto,
    user: AuthUser,
  ): Promise<TrainingRecordResponseDto> {
    const existing = await this.findOrThrow(id, user.organizationId);

    const row = await this.prisma.trainingRecord.update({
      where: { id },
      data: {
        ...(dto.title !== undefined ? { title: dto.title } : {}),
        ...(dto.provider !== undefined ? { provider: dto.provider } : {}),
        ...(dto.startDate !== undefined
          ? { startDate: new Date(dto.startDate) }
          : {}),
        ...(dto.endDate !== undefined ? { endDate: new Date(dto.endDate) } : {}),
        ...(dto.status !== undefined ? { status: dto.status } : {}),
        ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
      },
    });

    await this.audit.record({
      organizationId: user.organizationId,
      actorId: user.id,
      action: 'training.updated',
      resourceType: 'TrainingRecord',
      resourceId: id,
      before: existing,
      after: row,
    });

    return this.toDto(row);
  }

  async list(
    organizationId: string,
    employeeId?: string,
  ): Promise<TrainingRecordResponseDto[]> {
    const rows = await this.prisma.trainingRecord.findMany({
      where: {
        organizationId,
        ...(employeeId ? { employeeId } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return rows.map((r) => this.toDto(r));
  }

  private async findOrThrow(id: string, organizationId: string) {
    const row = await this.prisma.trainingRecord.findFirst({
      where: { id, organizationId },
    });
    if (!row) throw new NotFoundException('Training record not found');
    return row;
  }

  private toDto(r: {
    id: string;
    organizationId: string;
    employeeId: string;
    title: string;
    provider: string | null;
    startDate: Date | null;
    endDate: Date | null;
    status: TrainingStatus;
    notes: string | null;
    createdBy: string | null;
    createdAt: Date;
  }): TrainingRecordResponseDto {
    return {
      id: r.id,
      organizationId: r.organizationId,
      employeeId: r.employeeId,
      title: r.title,
      provider: r.provider,
      startDate: r.startDate,
      endDate: r.endDate,
      status: r.status,
      notes: r.notes,
      createdBy: r.createdBy,
      createdAt: r.createdAt,
    };
  }
}
