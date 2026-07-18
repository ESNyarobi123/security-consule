import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AccessEntryType } from '@prisma/client';
import { PrismaService, AuthUser } from '@pssms/shared';
import { AuditService } from '@pssms/audit';
import {
  CreateAccessEntryDto,
  CreateCustomerEmployeeDto,
  CustomerEmployeeResponseDto,
  AccessEntryResponseDto,
} from '../presentation/dto/access.dto';

@Injectable()
export class AccessControlService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async createEmployee(
    dto: CreateCustomerEmployeeDto,
    user: AuthUser,
  ): Promise<CustomerEmployeeResponseDto> {
    await this.assertCustomerInOrg(dto.customerId, user.organizationId);

    if (dto.email) {
      const dup = await this.prisma.customerEmployee.findFirst({
        where: { customerId: dto.customerId, email: dto.email },
      });
      if (dup) throw new ConflictException('Employee email already registered');
    }

    const employee = await this.prisma.customerEmployee.create({
      data: {
        organizationId: user.organizationId,
        customerId: dto.customerId,
        employeeNumber: dto.employeeNumber,
        fullName: dto.fullName,
        email: dto.email,
        phone: dto.phone,
        department: dto.department,
        accessCardRef: dto.accessCardRef,
        biometricRef: dto.biometricRef,
        createdBy: user.id,
      },
    });

    await this.audit.record({
      organizationId: user.organizationId,
      actorId: user.id,
      action: 'access.employee.created',
      resourceType: 'CustomerEmployee',
      resourceId: employee.id,
      after: employee,
    });

    return this.toEmployeeDto(employee);
  }

  async listEmployees(
    customerId: string,
    user: AuthUser,
  ): Promise<CustomerEmployeeResponseDto[]> {
    await this.assertCustomerInOrg(customerId, user.organizationId);
    const rows = await this.prisma.customerEmployee.findMany({
      where: { organizationId: user.organizationId, customerId },
      orderBy: { fullName: 'asc' },
    });
    return rows.map((e) => this.toEmployeeDto(e));
  }

  async recordEntry(
    dto: CreateAccessEntryDto,
    user: AuthUser,
  ): Promise<AccessEntryResponseDto> {
    await this.assertCustomerInOrg(dto.customerId, user.organizationId);

    const employee = await this.prisma.customerEmployee.findFirst({
      where: {
        id: dto.employeeId,
        organizationId: user.organizationId,
        customerId: dto.customerId,
        isActive: true,
      },
    });
    if (!employee) throw new NotFoundException('Customer employee not found');

    if (dto.clientEventId) {
      const existing = await this.prisma.accessEntry.findUnique({
        where: { clientEventId: dto.clientEventId },
      });
      if (existing) return this.toEntryDto(existing);
    }

    const entry = await this.prisma.accessEntry.create({
      data: {
        organizationId: user.organizationId,
        customerId: dto.customerId,
        employeeId: dto.employeeId,
        siteId: dto.siteId,
        gateId: dto.gateId,
        entryType: dto.entryType,
        accessMethod: dto.accessMethod,
        recordedBy: user.id,
        clientEventId: dto.clientEventId,
        recordedAt: dto.recordedAt ? new Date(dto.recordedAt) : new Date(),
      },
    });

    await this.audit.record({
      organizationId: user.organizationId,
      actorId: user.id,
      action: `access.entry.${dto.entryType.toLowerCase()}`,
      resourceType: 'AccessEntry',
      resourceId: entry.id,
      after: entry,
    });

    return this.toEntryDto(entry);
  }

  async listEntries(
    user: AuthUser,
    customerId?: string,
    siteId?: string,
  ): Promise<AccessEntryResponseDto[]> {
    const rows = await this.prisma.accessEntry.findMany({
      where: {
        organizationId: user.organizationId,
        ...(customerId ? { customerId } : {}),
        ...(siteId ? { siteId } : {}),
      },
      orderBy: { recordedAt: 'desc' },
      take: 100,
    });
    return rows.map((e) => this.toEntryDto(e));
  }

  private async assertCustomerInOrg(
    customerId: string,
    organizationId: string,
  ): Promise<void> {
    const customer = await this.prisma.customer.findFirst({
      where: { id: customerId, organizationId },
    });
    if (!customer) {
      throw new ForbiddenException('Customer not found in your organization');
    }
  }

  private toEmployeeDto(e: {
    id: string;
    organizationId: string;
    customerId: string;
    employeeNumber: string | null;
    fullName: string;
    email: string | null;
    phone: string | null;
    department: string | null;
    accessCardRef: string | null;
    biometricRef: string | null;
    isActive: boolean;
    createdAt: Date;
  }): CustomerEmployeeResponseDto {
    return {
      id: e.id,
      organizationId: e.organizationId,
      customerId: e.customerId,
      employeeNumber: e.employeeNumber,
      fullName: e.fullName,
      email: e.email,
      phone: e.phone,
      department: e.department,
      accessCardRef: e.accessCardRef,
      biometricRef: e.biometricRef,
      isActive: e.isActive,
      createdAt: e.createdAt,
    };
  }

  private toEntryDto(e: {
    id: string;
    organizationId: string;
    customerId: string;
    employeeId: string;
    siteId: string;
    gateId: string | null;
    entryType: AccessEntryType;
    accessMethod: string;
    recordedBy: string | null;
    recordedAt: Date;
    createdAt: Date;
  }): AccessEntryResponseDto {
    return {
      id: e.id,
      organizationId: e.organizationId,
      customerId: e.customerId,
      employeeId: e.employeeId,
      siteId: e.siteId,
      gateId: e.gateId,
      entryType: e.entryType,
      accessMethod: e.accessMethod,
      recordedBy: e.recordedBy,
      recordedAt: e.recordedAt,
      createdAt: e.createdAt,
    };
  }
}
