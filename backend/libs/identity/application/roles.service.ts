import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AuthUser,
  PrismaService,
  assertActorMayGrantPermissions,
} from '@pssms/shared';
import { AuditService } from '@pssms/audit';
import {
  CreateRoleDto,
  PermissionResponseDto,
  PortalCatalogResponseDto,
  RoleResponseDto,
} from '../presentation/dto/role.dto';
import {
  DESIGN_ACCOUNT_TYPES,
  DESIGN_PORTALS,
} from '../domain/portal-account-catalog';

@Injectable()
export class RolesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async listRoles(organizationId: string): Promise<RoleResponseDto[]> {
    const roles = await this.prisma.role.findMany({
      where: { organizationId },
      include: { permissions: { include: { permission: true } } },
      orderBy: { code: 'asc' },
    });
    return roles.map((r) => this.toDto(r));
  }

  async listPermissions(): Promise<PermissionResponseDto[]> {
    const permissions = await this.prisma.permission.findMany({
      orderBy: [{ module: 'asc' }, { code: 'asc' }],
    });
    return permissions.map((p) => ({
      code: p.code,
      name: p.name,
      module: p.module,
    }));
  }

  async portalCatalog(organizationId: string): Promise<PortalCatalogResponseDto> {
    const roles = await this.prisma.role.findMany({
      where: { organizationId },
      include: {
        _count: { select: { users: true } },
        permissions: { include: { permission: { select: { code: true } } } },
      },
    });
    const byCode = new Map(
      roles.map((r) => [
        r.code,
        {
          code: r.code,
          present: true as const,
          isSystem: r.isSystem,
          userCount: r._count.users,
          permissionSet: new Set(
            r.permissions.map((p) => p.permission.code),
          ),
        },
      ]),
    );

    const liveFor = (
      roleCode: string,
      gatePermissions: readonly string[],
      publicAccess: boolean,
    ) => {
      const live = byCode.get(roleCode);
      if (!live) {
        return {
          code: roleCode,
          present: false,
          isSystem: false,
          userCount: 0,
          canEnter: false,
        };
      }
      const canEnter =
        publicAccess && gatePermissions.length === 0
          ? live.present
          : gatePermissions.length === 0
            ? live.present
            : gatePermissions.some((g) => live.permissionSet.has(g));
      return {
        code: live.code,
        present: true,
        isSystem: live.isSystem,
        userCount: live.userCount,
        canEnter,
      };
    };

    const portals = DESIGN_PORTALS.map((p) => {
      const publicAccess =
        'publicAccess' in p && p.publicAccess === true;
      const liveRoles = p.roleCodes.map((code) =>
        liveFor(code, p.gatePermissions, publicAccess),
      );
      return {
        id: p.id,
        name: p.name,
        primaryUsers: p.primaryUsers,
        job: p.job,
        entry: p.entry,
        gatePermissions: [...p.gatePermissions],
        accountTypeCodes: [...p.accountTypeCodes],
        roleCodes: [...p.roleCodes],
        security: p.security,
        publicAccess,
        roles: liveRoles,
        liveUserCount: liveRoles.reduce((n, r) => n + r.userCount, 0),
      };
    });

    const accountTypes = DESIGN_ACCOUNT_TYPES.map((a) => {
      const portalIds = DESIGN_PORTALS.filter((p) =>
        (p.accountTypeCodes as readonly string[]).includes(a.code),
      ).map((p) => p.id);
      const liveUserCount = a.roleCodes.reduce(
        (n, code) => n + (byCode.get(code)?.userCount ?? 0),
        0,
      );
      return {
        code: a.code,
        name: a.name,
        roleCodes: [...a.roleCodes],
        portalIds,
        liveUserCount,
        publicOrUnbound: a.roleCodes.length === 0,
      };
    });

    const mapped = new Set<string>();
    for (const a of DESIGN_ACCOUNT_TYPES) {
      for (const c of a.roleCodes) mapped.add(c);
    }
    for (const p of DESIGN_PORTALS) {
      for (const c of p.roleCodes) mapped.add(c);
    }
    const unmappedRoleCodes = roles
      .map((r) => r.code)
      .filter((c) => !mapped.has(c))
      .sort();

    return { organizationId, portals, accountTypes, unmappedRoleCodes };
  }

  async createRole(
    dto: CreateRoleDto,
    actor: AuthUser,
  ): Promise<RoleResponseDto> {
    const existing = await this.prisma.role.findUnique({
      where: {
        organizationId_code: {
          organizationId: actor.organizationId,
          code: dto.code,
        },
      },
    });
    if (existing) {
      throw new ConflictException({
        error: 'CONFLICT',
        message: 'Role code already exists in this organization',
      });
    }

    assertActorMayGrantPermissions(actor, dto.permissionCodes ?? []);
    const permissionIds = await this.resolvePermissionIds(dto.permissionCodes);

    const role = await this.prisma.role.create({
      data: {
        organizationId: actor.organizationId,
        code: dto.code,
        name: dto.name,
        description: dto.description,
        permissions: {
          create: permissionIds.map((permissionId) => ({ permissionId })),
        },
      },
      include: { permissions: { include: { permission: true } } },
    });

    await this.audit.record({
      organizationId: actor.organizationId,
      actorId: actor.id,
      action: 'IDENTITY_ROLE_CREATED',
      resourceType: 'Role',
      resourceId: role.id,
      after: { code: dto.code, permissions: dto.permissionCodes ?? [] },
    });

    return this.toDto(role);
  }

  async setRolePermissions(
    roleId: string,
    permissionCodes: string[],
    actor: AuthUser,
  ): Promise<RoleResponseDto> {
    const role = await this.prisma.role.findUnique({
      where: { id: roleId },
      include: { permissions: { include: { permission: true } } },
    });
    if (!role || role.organizationId !== actor.organizationId) {
      throw new NotFoundException({
        error: 'NOT_FOUND',
        message: 'Role not found',
      });
    }
    if (role.isSystem) {
      throw new ConflictException({
        error: 'SYSTEM_ROLE_LOCKED',
        message: 'System roles cannot be modified',
      });
    }

    assertActorMayGrantPermissions(actor, permissionCodes);
    const permissionIds = await this.resolvePermissionIds(permissionCodes);
    const before = role.permissions.map((p) => p.permission.code);

    await this.prisma.$transaction([
      this.prisma.rolePermission.deleteMany({ where: { roleId } }),
      this.prisma.rolePermission.createMany({
        data: permissionIds.map((permissionId) => ({ roleId, permissionId })),
      }),
    ]);

    await this.audit.record({
      organizationId: actor.organizationId,
      actorId: actor.id,
      action: 'IDENTITY_ROLE_PERMISSIONS_CHANGED',
      resourceType: 'Role',
      resourceId: roleId,
      before: { permissions: before },
      after: { permissions: permissionCodes },
    });

    const updated = await this.prisma.role.findUniqueOrThrow({
      where: { id: roleId },
      include: { permissions: { include: { permission: true } } },
    });
    return this.toDto(updated);
  }

  private async resolvePermissionIds(codes?: string[]): Promise<string[]> {
    if (!codes || codes.length === 0) {
      return [];
    }
    const permissions = await this.prisma.permission.findMany({
      where: { code: { in: codes } },
    });
    if (permissions.length !== new Set(codes).size) {
      throw new NotFoundException({
        error: 'NOT_FOUND',
        message: 'One or more permissions not found',
      });
    }
    return permissions.map((p) => p.id);
  }

  private toDto(role: {
    id: string;
    code: string;
    name: string;
    description: string | null;
    isSystem: boolean;
    permissions: Array<{ permission: { code: string } }>;
  }): RoleResponseDto {
    return {
      id: role.id,
      code: role.code,
      name: role.name,
      description: role.description,
      isSystem: role.isSystem,
      permissions: role.permissions.map((p) => p.permission.code),
    };
  }
}
