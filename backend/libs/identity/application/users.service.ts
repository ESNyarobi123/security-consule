import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { PrismaService, AuthUser } from '@pssms/shared';
import { CreateUserDto, UserResponseDto } from '../presentation/dto/user.dto';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

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
