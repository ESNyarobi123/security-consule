import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuthUser, PrismaService } from '@pssms/shared';
import { AuditService } from '@pssms/audit';
import {
  CreateRoleDto,
  PermissionResponseDto,
  RoleResponseDto,
} from '../presentation/dto/role.dto';

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
