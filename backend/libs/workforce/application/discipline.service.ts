import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { DisciplineSeverity, DisciplineStatus } from '@prisma/client';
import { PrismaService, AuthUser } from '@pssms/shared';
import { AuditService } from '@pssms/audit';
import { EmployeesService } from './employees.service';
import {
  CreateDisciplineCaseDto,
  DisciplineCaseResponseDto,
  UpdateDisciplineCaseDto,
} from '../presentation/dto/discipline.dto';

@Injectable()
export class DisciplineService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly employees: EmployeesService,
  ) {}

  async create(
    dto: CreateDisciplineCaseDto,
    user: AuthUser,
  ): Promise<DisciplineCaseResponseDto> {
    await this.employees.getById(dto.employeeId, user.organizationId);

    const row = await this.prisma.disciplineCase.create({
      data: {
        organizationId: user.organizationId,
        employeeId: dto.employeeId,
        incidentDate: new Date(dto.incidentDate),
        category: dto.category,
        severity: dto.severity ?? DisciplineSeverity.MEDIUM,
        description: dto.description,
        createdBy: user.id,
      },
    });

    await this.audit.record({
      organizationId: user.organizationId,
      actorId: user.id,
      action: 'discipline.created',
      resourceType: 'DisciplineCase',
      resourceId: row.id,
      after: row,
    });

    return this.toDto(row);
  }

  async update(
    id: string,
    dto: UpdateDisciplineCaseDto,
    user: AuthUser,
  ): Promise<DisciplineCaseResponseDto> {
    const existing = await this.findOrThrow(id, user.organizationId);

    if (
      dto.status === DisciplineStatus.CLOSED &&
      !(dto.outcome ?? existing.outcome)?.trim()
    ) {
      throw new BadRequestException(
        'outcome is required when closing a discipline case',
      );
    }

    const row = await this.prisma.disciplineCase.update({
      where: { id },
      data: {
        ...(dto.status !== undefined ? { status: dto.status } : {}),
        ...(dto.outcome !== undefined ? { outcome: dto.outcome } : {}),
        ...(dto.severity !== undefined ? { severity: dto.severity } : {}),
        ...(dto.description !== undefined
          ? { description: dto.description }
          : {}),
      },
    });

    await this.audit.record({
      organizationId: user.organizationId,
      actorId: user.id,
      action: 'discipline.updated',
      resourceType: 'DisciplineCase',
      resourceId: id,
      before: existing,
      after: row,
    });

    return this.toDto(row);
  }

  async list(
    organizationId: string,
    employeeId?: string,
  ): Promise<DisciplineCaseResponseDto[]> {
    const rows = await this.prisma.disciplineCase.findMany({
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
    const row = await this.prisma.disciplineCase.findFirst({
      where: { id, organizationId },
    });
    if (!row) throw new NotFoundException('Discipline case not found');
    return row;
  }

  private toDto(r: {
    id: string;
    organizationId: string;
    employeeId: string;
    incidentDate: Date;
    category: string;
    severity: DisciplineSeverity;
    description: string;
    status: DisciplineStatus;
    outcome: string | null;
    createdBy: string | null;
    createdAt: Date;
  }): DisciplineCaseResponseDto {
    return {
      id: r.id,
      organizationId: r.organizationId,
      employeeId: r.employeeId,
      incidentDate: r.incidentDate,
      category: r.category,
      severity: r.severity,
      description: r.description,
      status: r.status,
      outcome: r.outcome,
      createdBy: r.createdBy,
      createdAt: r.createdAt,
    };
  }
}
