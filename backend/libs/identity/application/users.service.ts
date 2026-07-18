import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import {
  AuthUser,
  PrismaService,
  evaluatePasswordPolicy,
} from '@pssms/shared';
import { AuditService } from '@pssms/audit';
import { CreateUserDto, UserResponseDto } from '../presentation/dto/user.dto';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async create(
    dto: CreateUserDto,
    actor: AuthUser,
  ): Promise<UserResponseDto> {
    const email = dto.email.toLowerCase();
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new ConflictException({
        error: 'CONFLICT',
        message: 'Email already registered',
      });
    }

    const policyFailures = evaluatePasswordPolicy(dto.password);
    if (policyFailures.length > 0) {
      throw new BadRequestException({
        error: 'WEAK_PASSWORD',
        message: `Password must contain ${policyFailures.join(', ')}`,
      });
    }

    const roles = await this.prisma.role.findMany({
      where: {
        organizationId: actor.organizationId,
        code: { in: dto.roleCodes },
      },
    });
    if (roles.length !== dto.roleCodes.length) {
      throw new NotFoundException({
        error: 'NOT_FOUND',
        message: 'One or more roles not found',
      });
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);
    const user = await this.prisma.user.create({
      data: {
        email,
        passwordHash,
        fullName: dto.fullName,
        phone: dto.phone,
        organizationId: actor.organizationId,
        createdBy: actor.id,
        roles: {
          create: roles.map((r) => ({ roleId: r.id })),
        },
      },
      include: { roles: { include: { role: true } } },
    });

    await this.audit.record({
      organizationId: actor.organizationId,
      actorId: actor.id,
      action: 'IDENTITY_USER_CREATED',
      resourceType: 'User',
      resourceId: user.id,
      after: { email: user.email, roles: dto.roleCodes },
    });

    return this.toDto(user);
  }

  async list(organizationId: string): Promise<UserResponseDto[]> {
    const users = await this.prisma.user.findMany({
      where: { organizationId },
      include: { roles: { include: { role: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return users.map((u) => this.toDto(u));
  }

  /** Load an org-scoped user or fail. Prevents cross-tenant management. */
  private async requireOrgUser(userId: string, actor: AuthUser) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { roles: { include: { role: true } } },
    });
    if (!user || user.organizationId !== actor.organizationId) {
      throw new NotFoundException({
        error: 'NOT_FOUND',
        message: 'User not found',
      });
    }
    return user;
  }

  async suspend(
    userId: string,
    reason: string | undefined,
    actor: AuthUser,
  ): Promise<UserResponseDto> {
    if (userId === actor.id) {
      throw new ForbiddenException({
        error: 'CANNOT_SUSPEND_SELF',
        message: 'You cannot suspend your own account',
      });
    }
    await this.requireOrgUser(userId, actor);
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        isActive: false,
        suspendedAt: new Date(),
        suspendedReason: reason ?? null,
      },
      include: { roles: { include: { role: true } } },
    });
    await this.audit.record({
      organizationId: actor.organizationId,
      actorId: actor.id,
      action: 'IDENTITY_USER_SUSPENDED',
      resourceType: 'User',
      resourceId: userId,
      after: { reason: reason ?? null },
    });
    return this.toDto(user);
  }

  async reactivate(userId: string, actor: AuthUser): Promise<UserResponseDto> {
    await this.requireOrgUser(userId, actor);
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { isActive: true, suspendedAt: null, suspendedReason: null },
      include: { roles: { include: { role: true } } },
    });
    await this.audit.record({
      organizationId: actor.organizationId,
      actorId: actor.id,
      action: 'IDENTITY_USER_REACTIVATED',
      resourceType: 'User',
      resourceId: userId,
    });
    return this.toDto(user);
  }

  async setRoles(
    userId: string,
    roleCodes: string[],
    actor: AuthUser,
  ): Promise<UserResponseDto> {
    const target = await this.requireOrgUser(userId, actor);
    const roles = await this.prisma.role.findMany({
      where: { organizationId: actor.organizationId, code: { in: roleCodes } },
    });
    if (roles.length !== roleCodes.length) {
      throw new NotFoundException({
        error: 'NOT_FOUND',
        message: 'One or more roles not found',
      });
    }
    const before = target.roles.map((r) => r.role.code);
    await this.prisma.$transaction([
      this.prisma.userRole.deleteMany({ where: { userId } }),
      this.prisma.userRole.createMany({
        data: roles.map((r) => ({ userId, roleId: r.id })),
      }),
    ]);
    await this.audit.record({
      organizationId: actor.organizationId,
      actorId: actor.id,
      action: 'IDENTITY_USER_ROLES_CHANGED',
      resourceType: 'User',
      resourceId: userId,
      before: { roles: before },
      after: { roles: roleCodes },
    });
    const updated = await this.requireOrgUser(userId, actor);
    return this.toDto(updated);
  }

  private toDto(user: {
    id: string;
    email: string;
    fullName: string;
    organizationId: string;
    isActive: boolean;
    createdAt: Date;
    roles: Array<{ role: { code: string } }>;
  }): UserResponseDto {
    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      organizationId: user.organizationId,
      isActive: user.isActive,
      roles: user.roles.map((r) => r.role.code),
      createdAt: user.createdAt,
    };
  }
}
