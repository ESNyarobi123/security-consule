import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AccessEntryType, AccessLevel, AccessMethod } from '@prisma/client';
import {
  PrismaService,
  AuthUser,
  isCustomerEmployeeSelfScoped,
  mustSelfScopeAccessEntries,
} from '@pssms/shared';
import { AuditService } from '@pssms/audit';
import {
  CreateAccessEntryDto,
  CreateSelfAccessEntryDto,
  CreateCustomerEmployeeDto,
  CustomerEmployeeResponseDto,
  AccessEntryResponseDto,
  SelfAccessSitesResponseDto,
  UpdateCustomerEmployeeDto,
} from '../presentation/dto/access.dto';

/** Device-normalized access event resolved inside the access domain. */
export interface DeviceAccessEntryInput {
  cardRef?: string;
  biometricRef?: string;
  siteId?: string;
  gateId?: string;
  direction?: 'IN' | 'OUT';
  accessMethod?: AccessMethod;
  capturedAt?: string;
  clientEventId?: string;
}

@Injectable()
export class AccessControlService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async getMyEmployee(user: AuthUser): Promise<CustomerEmployeeResponseDto> {
    if (!user.customerId) {
      throw new ForbiddenException({
        error: 'FORBIDDEN',
        message: 'Not a customer-scoped account',
      });
    }
    const employee = await this.prisma.customerEmployee.findFirst({
      where: {
        organizationId: user.organizationId,
        customerId: user.customerId,
        userId: user.id,
        isActive: true,
      },
    });
    if (!employee) {
      throw new NotFoundException({
        error: 'NOT_FOUND',
        message: 'No customer employee profile linked to this login',
      });
    }
    return this.toEmployeeDto(employee);
  }

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
        accessLevel: dto.accessLevel,
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
    if (isCustomerEmployeeSelfScoped(user)) {
      throw new ForbiddenException({
        error: 'FORBIDDEN',
        message: 'Customer employees cannot list the staff roster',
      });
    }
    await this.assertCustomerInOrg(customerId, user.organizationId);
    const rows = await this.prisma.customerEmployee.findMany({
      where: { organizationId: user.organizationId, customerId },
      orderBy: { fullName: 'asc' },
    });
    return rows.map((e) => this.toEmployeeDto(e));
  }

  /**
   * Module 6-H — update name/contact/isActive.
   * When `requiredCustomerId` is set, employee must belong to that customer (CRM).
   */
  async updateEmployee(
    employeeId: string,
    dto: UpdateCustomerEmployeeDto,
    user: AuthUser,
    opts?: { requiredCustomerId?: string },
  ): Promise<CustomerEmployeeResponseDto> {
    if (isCustomerEmployeeSelfScoped(user)) {
      throw new ForbiddenException({
        error: 'FORBIDDEN',
        message: 'Customer employees cannot update the staff roster',
      });
    }

    const existing = await this.prisma.customerEmployee.findFirst({
      where: { id: employeeId, organizationId: user.organizationId },
    });
    if (!existing) throw new NotFoundException('Customer employee not found');

    if (
      opts?.requiredCustomerId &&
      existing.customerId !== opts.requiredCustomerId
    ) {
      throw new NotFoundException('Customer employee not found for this customer');
    }

    await this.assertCustomerInOrg(existing.customerId, user.organizationId);

    const fullName =
      dto.fullName !== undefined ? dto.fullName.trim() : undefined;
    if (fullName !== undefined && fullName.length < 2) {
      throw new BadRequestException({
        error: 'INVALID_EMPLOYEE_NAME',
        message: 'Full name must be at least 2 characters',
      });
    }

    const blankToNull = (v: string | null | undefined) => {
      if (v === undefined) return undefined;
      if (v === null) return null;
      const t = v.trim();
      return t.length ? t : null;
    };

    const email = blankToNull(dto.email);
    if (email) {
      const dup = await this.prisma.customerEmployee.findFirst({
        where: {
          customerId: existing.customerId,
          email,
          NOT: { id: existing.id },
        },
      });
      if (dup) throw new ConflictException('Employee email already registered');
    }

    const nextActive =
      dto.isActive !== undefined ? dto.isActive : existing.isActive;
    const activeChanged =
      dto.isActive !== undefined && dto.isActive !== existing.isActive;

    const employee = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.customerEmployee.update({
        where: { id: existing.id },
        data: {
          ...(fullName !== undefined ? { fullName } : {}),
          ...(dto.employeeNumber !== undefined
            ? { employeeNumber: blankToNull(dto.employeeNumber) }
            : {}),
          ...(email !== undefined ? { email } : {}),
          ...(dto.phone !== undefined ? { phone: blankToNull(dto.phone) } : {}),
          ...(dto.department !== undefined
            ? { department: blankToNull(dto.department) }
            : {}),
          ...(dto.accessLevel !== undefined
            ? { accessLevel: dto.accessLevel }
            : {}),
          ...(dto.accessCardRef !== undefined
            ? { accessCardRef: blankToNull(dto.accessCardRef) }
            : {}),
          ...(dto.biometricRef !== undefined
            ? { biometricRef: blankToNull(dto.biometricRef) }
            : {}),
          ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
        },
      });

      // Module 6-J — sync linked CUSTOMER_EMPLOYEE login with roster active flag
      if (activeChanged && existing.userId) {
        const linked = await tx.user.findFirst({
          where: {
            id: existing.userId,
            organizationId: user.organizationId,
            customerId: existing.customerId,
          },
          include: { roles: { include: { role: true } } },
        });
        const isEmployeeLogin = linked?.roles.some(
          (r) => r.role.code === 'CUSTOMER_EMPLOYEE',
        );
        if (linked && isEmployeeLogin) {
          await tx.user.update({
            where: { id: linked.id },
            data: nextActive
              ? {
                  isActive: true,
                  suspendedAt: null,
                  suspendedReason: null,
                }
              : {
                  isActive: false,
                  suspendedAt: new Date(),
                  suspendedReason: 'Customer employee deactivated',
                },
          });
        }
      }

      return updated;
    });

    await this.audit.record({
      organizationId: user.organizationId,
      actorId: user.id,
      action: 'access.employee.updated',
      resourceType: 'CustomerEmployee',
      resourceId: employee.id,
      before: existing,
      after: {
        ...employee,
        ...(activeChanged && existing.userId
          ? {
              portalLoginSynced: true,
              portalLoginActive: nextActive,
            }
          : {}),
      },
    });

    return this.toEmployeeDto(employee);
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

  /**
   * Module 11-A — customer employee self check-in/out (Portal 35.9).
   * Forces employeeId + customerId from JWT-bound profile; never accepts another employee.
   */
  async recordSelfEntry(
    dto: CreateSelfAccessEntryDto,
    user: AuthUser,
  ): Promise<AccessEntryResponseDto> {
    if (!user.customerId || !isCustomerEmployeeSelfScoped(user)) {
      throw new ForbiddenException({
        error: 'ACCESS_SELF_REQUIRED',
        message: 'Self check-in requires a linked customer employee login',
      });
    }

    const employee = await this.prisma.customerEmployee.findFirst({
      where: {
        organizationId: user.organizationId,
        customerId: user.customerId,
        userId: user.id,
        isActive: true,
      },
    });
    if (!employee) {
      throw new NotFoundException({
        error: 'NOT_FOUND',
        message: 'No customer employee profile linked to this login',
      });
    }

    const site = await this.prisma.site.findFirst({
      where: {
        id: dto.siteId,
        organizationId: user.organizationId,
        customerId: employee.customerId,
        isActive: true,
      },
      select: { id: true, code: true, name: true },
    });
    if (!site) {
      throw new BadRequestException({
        error: 'INVALID_SITE',
        message: 'Site not found for your organisation',
      });
    }

    await this.assertEmployeeSiteGranted(employee.id, site.id, user.organizationId);

    let gateLabel: { code: string; name: string } | null = null;
    if (dto.gateId) {
      const gate = await this.prisma.gate.findFirst({
        where: {
          id: dto.gateId,
          organizationId: user.organizationId,
          siteId: site.id,
          isActive: true,
        },
        select: { id: true, code: true, name: true },
      });
      if (!gate) {
        throw new BadRequestException({
          error: 'INVALID_GATE',
          message: 'Gate not found at this site',
        });
      }
      gateLabel = { code: gate.code, name: gate.name };
    }

    if (dto.clientEventId) {
      const existing = await this.prisma.accessEntry.findUnique({
        where: { clientEventId: dto.clientEventId },
      });
      if (existing) {
        if (
          existing.employeeId !== employee.id ||
          existing.organizationId !== user.organizationId
        ) {
          throw new ConflictException({
            error: 'CLIENT_EVENT_CONFLICT',
            message: 'clientEventId already used',
          });
        }
        return this.toEntryDto(existing, {
          employeeName: employee.fullName,
          employeeNumber: employee.employeeNumber,
          siteCode: site.code,
          siteName: site.name,
          gateCode: gateLabel?.code ?? null,
          gateName: gateLabel?.name ?? null,
        });
      }
    }

    let entryType = dto.entryType;
    if (!entryType) {
      const last = await this.prisma.accessEntry.findFirst({
        where: {
          organizationId: user.organizationId,
          employeeId: employee.id,
        },
        orderBy: { recordedAt: 'desc' },
        select: { entryType: true },
      });
      entryType =
        last?.entryType === AccessEntryType.CHECK_IN
          ? AccessEntryType.CHECK_OUT
          : AccessEntryType.CHECK_IN;
    }

    const accessMethod = dto.accessMethod ?? AccessMethod.QR;

    const entry = await this.prisma.accessEntry.create({
      data: {
        organizationId: user.organizationId,
        customerId: employee.customerId,
        employeeId: employee.id,
        siteId: site.id,
        gateId: dto.gateId,
        entryType,
        accessMethod,
        recordedBy: user.id,
        clientEventId: dto.clientEventId,
        recordedAt: new Date(),
      },
    });

    await this.audit.record({
      organizationId: user.organizationId,
      actorId: user.id,
      action: `access.entry.${entryType.toLowerCase()}`,
      resourceType: 'AccessEntry',
      resourceId: entry.id,
      after: { ...entry, via: 'self', gateCode: gateLabel?.code ?? null },
    });

    return this.toEntryDto(entry, {
      employeeName: employee.fullName,
      employeeNumber: employee.employeeNumber,
      siteCode: site.code,
      siteName: site.name,
      gateCode: gateLabel?.code ?? null,
      gateName: gateLabel?.name ?? null,
    });
  }

  /**
   * Module 11-C — sites for Portal 35.9 self check-in picker.
   * Empty grants = all active customer sites (unrestricted).
   */
  async listMySites(user: AuthUser): Promise<SelfAccessSitesResponseDto> {
    if (!user.customerId || !isCustomerEmployeeSelfScoped(user)) {
      throw new ForbiddenException({
        error: 'ACCESS_SELF_REQUIRED',
        message: 'Self site list requires a linked customer employee login',
      });
    }
    const employee = await this.prisma.customerEmployee.findFirst({
      where: {
        organizationId: user.organizationId,
        customerId: user.customerId,
        userId: user.id,
        isActive: true,
      },
      select: { id: true, customerId: true },
    });
    if (!employee) {
      throw new NotFoundException({
        error: 'NOT_FOUND',
        message: 'No customer employee profile linked to this login',
      });
    }
    return this.resolveEmployeeSites(
      employee.id,
      employee.customerId,
      user.organizationId,
    );
  }

  async getEmployeeSites(
    customerId: string,
    employeeId: string,
    user: AuthUser,
  ): Promise<SelfAccessSitesResponseDto> {
    if (isCustomerEmployeeSelfScoped(user)) {
      throw new ForbiddenException({
        error: 'FORBIDDEN',
        message: 'Customer employees cannot manage site grants',
      });
    }
    await this.assertCustomerInOrg(customerId, user.organizationId);
    const employee = await this.prisma.customerEmployee.findFirst({
      where: {
        id: employeeId,
        organizationId: user.organizationId,
        customerId,
      },
      select: { id: true, customerId: true },
    });
    if (!employee) {
      throw new NotFoundException('Customer employee not found for this customer');
    }
    return this.resolveEmployeeSites(
      employee.id,
      employee.customerId,
      user.organizationId,
    );
  }

  async setEmployeeSites(
    customerId: string,
    employeeId: string,
    siteIds: string[],
    user: AuthUser,
  ): Promise<SelfAccessSitesResponseDto> {
    if (isCustomerEmployeeSelfScoped(user)) {
      throw new ForbiddenException({
        error: 'FORBIDDEN',
        message: 'Customer employees cannot manage site grants',
      });
    }
    await this.assertCustomerInOrg(customerId, user.organizationId);
    const employee = await this.prisma.customerEmployee.findFirst({
      where: {
        id: employeeId,
        organizationId: user.organizationId,
        customerId,
      },
    });
    if (!employee) {
      throw new NotFoundException('Customer employee not found for this customer');
    }

    const unique = [...new Set(siteIds)];
    if (unique.length > 0) {
      const sites = await this.prisma.site.findMany({
        where: {
          id: { in: unique },
          organizationId: user.organizationId,
          customerId,
        },
        select: { id: true },
      });
      if (sites.length !== unique.length) {
        throw new BadRequestException({
          error: 'INVALID_SITE_IDS',
          message: 'One or more sites are not valid for this customer',
        });
      }
    }

    const before = await this.prisma.customerEmployeeSiteAccess.findMany({
      where: { employeeId: employee.id, organizationId: user.organizationId },
      select: { siteId: true },
    });

    await this.prisma.$transaction(async (tx) => {
      await tx.customerEmployeeSiteAccess.deleteMany({
        where: {
          employeeId: employee.id,
          organizationId: user.organizationId,
        },
      });
      if (unique.length > 0) {
        await tx.customerEmployeeSiteAccess.createMany({
          data: unique.map((siteId) => ({
            organizationId: user.organizationId,
            customerId,
            employeeId: employee.id,
            siteId,
            createdBy: user.id,
          })),
        });
      }
    });

    const after = await this.resolveEmployeeSites(
      employee.id,
      customerId,
      user.organizationId,
    );

    await this.audit.record({
      organizationId: user.organizationId,
      actorId: user.id,
      action: 'access.employee.sites_updated',
      resourceType: 'CustomerEmployee',
      resourceId: employee.id,
      before: {
        siteIds: before.map((b) => b.siteId),
        unrestricted: before.length === 0,
      },
      after: {
        siteIds: after.siteIds,
        unrestricted: after.unrestricted,
      },
    });

    return after;
  }

  async listEntries(
    user: AuthUser,
    customerId?: string,
    siteId?: string,
  ): Promise<AccessEntryResponseDto[]> {
    let selfEmployeeId: string | undefined;
    if (mustSelfScopeAccessEntries(user) || isCustomerEmployeeSelfScoped(user)) {
      const me = await this.prisma.customerEmployee.findFirst({
        where: {
          organizationId: user.organizationId,
          userId: user.id,
          isActive: true,
          ...(user.customerId ? { customerId: user.customerId } : {}),
        },
        select: { id: true },
      });
      if (!me) {
        throw new ForbiddenException({
          error: 'FORBIDDEN',
          message: 'No customer employee profile linked to this login',
        });
      }
      selfEmployeeId = me.id;
    }

    const rows = await this.prisma.accessEntry.findMany({
      where: {
        organizationId: user.organizationId,
        ...(customerId ? { customerId } : {}),
        ...(siteId ? { siteId } : {}),
        ...(selfEmployeeId ? { employeeId: selfEmployeeId } : {}),
      },
      orderBy: { recordedAt: 'desc' },
      take: 100,
    });
    if (rows.length === 0) return [];

    const employeeIds = [...new Set(rows.map((r) => r.employeeId))];
    const siteIds = [...new Set(rows.map((r) => r.siteId))];
    const gateIds = [
      ...new Set(rows.map((r) => r.gateId).filter((id): id is string => !!id)),
    ];
    const [employees, sites, gateRows] = await Promise.all([
      this.prisma.customerEmployee.findMany({
        where: { id: { in: employeeIds } },
        select: { id: true, fullName: true, employeeNumber: true },
      }),
      this.prisma.site.findMany({
        where: { id: { in: siteIds } },
        select: { id: true, code: true, name: true },
      }),
      gateIds.length
        ? this.prisma.gate.findMany({
            where: { id: { in: gateIds } },
            select: { id: true, code: true, name: true },
          })
        : Promise.resolve([]),
    ]);
    const empById = new Map(employees.map((e) => [e.id, e]));
    const siteById = new Map(sites.map((s) => [s.id, s]));
    const gateById = new Map(gateRows.map((g) => [g.id, g]));

    return rows.map((e) => {
      const emp = empById.get(e.employeeId);
      const site = siteById.get(e.siteId);
      const gate = e.gateId ? gateById.get(e.gateId) : undefined;
      return this.toEntryDto(e, {
        employeeName: emp?.fullName ?? null,
        employeeNumber: emp?.employeeNumber ?? null,
        siteCode: site?.code ?? null,
        siteName: site?.name ?? null,
        gateCode: gate?.code ?? null,
        gateName: gate?.name ?? null,
      });
    });
  }

  /**
   * Ingest a customer-employee access event from a device (card tap / biometric
   * match). The device only knows a physical identifier, so employee resolution
   * (card/biometric ref → customer employee) is owned here, inside the access
   * domain. Returns null when the ref cannot be resolved so the caller can keep
   * the raw event store-only (still auditable) rather than failing ingestion.
   */
  async ingestDeviceEntry(
    dto: DeviceAccessEntryInput,
    user: AuthUser,
  ): Promise<AccessEntryResponseDto | null> {
    const or: { accessCardRef?: string; biometricRef?: string }[] = [];
    if (dto.cardRef) or.push({ accessCardRef: dto.cardRef });
    if (dto.biometricRef) or.push({ biometricRef: dto.biometricRef });
    if (or.length === 0 || !dto.siteId) return null;

    const employee = await this.prisma.customerEmployee.findFirst({
      where: { organizationId: user.organizationId, isActive: true, OR: or },
    });
    if (!employee) return null;

    if (dto.clientEventId) {
      const existing = await this.prisma.accessEntry.findUnique({
        where: { clientEventId: dto.clientEventId },
      });
      if (existing) return this.toEntryDto(existing);
    }

    // Determine direction: explicit hint wins, else toggle from the last entry.
    let entryType: AccessEntryType;
    if (dto.direction === 'IN') entryType = AccessEntryType.CHECK_IN;
    else if (dto.direction === 'OUT') entryType = AccessEntryType.CHECK_OUT;
    else {
      const last = await this.prisma.accessEntry.findFirst({
        where: { organizationId: user.organizationId, employeeId: employee.id },
        orderBy: { recordedAt: 'desc' },
      });
      entryType =
        last?.entryType === AccessEntryType.CHECK_IN
          ? AccessEntryType.CHECK_OUT
          : AccessEntryType.CHECK_IN;
    }

    const entry = await this.prisma.accessEntry.create({
      data: {
        organizationId: user.organizationId,
        customerId: employee.customerId,
        employeeId: employee.id,
        siteId: dto.siteId,
        gateId: dto.gateId,
        entryType,
        accessMethod: dto.accessMethod ?? AccessMethod.CARD,
        recordedBy: user.id,
        clientEventId: dto.clientEventId,
        recordedAt: dto.capturedAt ? new Date(dto.capturedAt) : new Date(),
      },
    });

    await this.audit.record({
      organizationId: user.organizationId,
      actorId: user.id,
      action: `access.entry.${entryType.toLowerCase()}`,
      resourceType: 'AccessEntry',
      resourceId: entry.id,
      after: { ...entry, via: 'device' },
    });

    return this.toEntryDto(entry);
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

  /** Empty grant rows = unrestricted (all active customer sites). */
  private async assertEmployeeSiteGranted(
    employeeId: string,
    siteId: string,
    organizationId: string,
  ): Promise<void> {
    const grantCount = await this.prisma.customerEmployeeSiteAccess.count({
      where: { employeeId, organizationId },
    });
    if (grantCount === 0) return;
    const allowed = await this.prisma.customerEmployeeSiteAccess.findFirst({
      where: { employeeId, organizationId, siteId },
      select: { id: true },
    });
    if (!allowed) {
      throw new ForbiddenException({
        error: 'SITE_NOT_GRANTED',
        message: 'You are not granted access to this site',
      });
    }
  }

  private async resolveEmployeeSites(
    employeeId: string,
    customerId: string,
    organizationId: string,
  ): Promise<SelfAccessSitesResponseDto> {
    const grants = await this.prisma.customerEmployeeSiteAccess.findMany({
      where: { employeeId, organizationId, customerId },
      select: { siteId: true },
    });
    const unrestricted = grants.length === 0;
    const sites = await this.prisma.site.findMany({
      where: {
        organizationId,
        customerId,
        isActive: true,
        ...(unrestricted
          ? {}
          : { id: { in: grants.map((g) => g.siteId) } }),
      },
      orderBy: { name: 'asc' },
      select: { id: true, code: true, name: true, isActive: true },
    });

    // Module 11-D — active gates per site for self check-in picker
    const siteIds = sites.map((s) => s.id);
    const gates =
      siteIds.length === 0
        ? []
        : await this.prisma.gate.findMany({
            where: {
              organizationId,
              siteId: { in: siteIds },
              isActive: true,
            },
            orderBy: { code: 'asc' },
            select: { id: true, siteId: true, code: true, name: true },
          });
    const gatesBySite = new Map<string, { id: string; code: string; name: string }[]>();
    for (const g of gates) {
      const list = gatesBySite.get(g.siteId) ?? [];
      list.push({ id: g.id, code: g.code, name: g.name });
      gatesBySite.set(g.siteId, list);
    }

    return {
      employeeId,
      customerId,
      unrestricted,
      siteIds,
      sites: sites.map((s) => ({
        ...s,
        gates: gatesBySite.get(s.id) ?? [],
      })),
    };
  }

  private toEmployeeDto(e: {
    id: string;
    organizationId: string;
    customerId: string;
    userId?: string | null;
    employeeNumber: string | null;
    fullName: string;
    email: string | null;
    phone: string | null;
    department: string | null;
    accessLevel: AccessLevel;
    accessCardRef: string | null;
    biometricRef: string | null;
    isActive: boolean;
    createdAt: Date;
  }): CustomerEmployeeResponseDto {
    return {
      id: e.id,
      organizationId: e.organizationId,
      customerId: e.customerId,
      userId: e.userId ?? null,
      employeeNumber: e.employeeNumber,
      fullName: e.fullName,
      email: e.email,
      phone: e.phone,
      department: e.department,
      accessLevel: e.accessLevel,
      accessCardRef: e.accessCardRef,
      biometricRef: e.biometricRef,
      isActive: e.isActive,
      createdAt: e.createdAt,
    };
  }

  private toEntryDto(
    e: {
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
    },
    labels?: {
      employeeName?: string | null;
      employeeNumber?: string | null;
      siteCode?: string | null;
      siteName?: string | null;
      gateCode?: string | null;
      gateName?: string | null;
    },
  ): AccessEntryResponseDto {
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
      employeeName: labels?.employeeName ?? null,
      employeeNumber: labels?.employeeNumber ?? null,
      siteCode: labels?.siteCode ?? null,
      siteName: labels?.siteName ?? null,
      gateCode: labels?.gateCode ?? null,
      gateName: labels?.gateName ?? null,
    };
  }
}
