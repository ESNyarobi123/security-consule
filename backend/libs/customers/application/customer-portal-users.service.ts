import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { NotificationChannel } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';
import { AuditService } from '@pssms/audit';
import { NotificationsService } from '@pssms/notifications';
import {
  AuthUser,
  PrismaService,
  evaluatePasswordPolicy,
  normalizePasswordPolicy,
} from '@pssms/shared';
import {
  InviteCustomerPortalUserDto,
  InviteCustomerPortalUserResponseDto,
  PortalUserResponseDto,
} from '../presentation/dto/customer-portal-user.dto';

const PORTAL_ROLE = 'CUSTOMER_PORTAL';

/** Temp password that always satisfies enterprise policy (shown once). */
function generateTempPassword(): string {
  const chunk = randomBytes(6).toString('base64url');
  return `Hl-${chunk}!9A`;
}

@Injectable()
export class CustomerPortalUsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
  ) {}

  async list(
    customerId: string,
    organizationId: string,
  ): Promise<PortalUserResponseDto[]> {
    await this.requireCustomer(customerId, organizationId);
    const users = await this.prisma.user.findMany({
      where: { organizationId, customerId },
      include: { roles: { include: { role: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return users.map((u) => this.toPortalUserDto(u));
  }

  async invite(
    customerId: string,
    dto: InviteCustomerPortalUserDto,
    actor: AuthUser,
  ): Promise<InviteCustomerPortalUserResponseDto> {
    const customer = await this.requireCustomer(
      customerId,
      actor.organizationId,
    );
    if (customer.status === 'SUSPENDED' || customer.status === 'TERMINATED') {
      throw new BadRequestException({
        error: 'CUSTOMER_NOT_ACTIVE',
        message: 'Cannot invite portal users for suspended/terminated customers',
      });
    }

    const email = dto.email.toLowerCase().trim();
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new ConflictException({
        error: 'CONFLICT',
        message:
          existing.customerId === customerId
            ? 'This email already has portal access for this customer'
            : 'Email already registered in the organisation',
      });
    }

    const role = await this.prisma.role.findFirst({
      where: {
        organizationId: actor.organizationId,
        code: PORTAL_ROLE,
      },
    });
    if (!role) {
      throw new NotFoundException({
        error: 'NOT_FOUND',
        message: 'CUSTOMER_PORTAL role is not configured for this organisation',
      });
    }

    const temporaryPassword = generateTempPassword();
    const org = await this.prisma.organization.findUnique({
      where: { id: actor.organizationId },
      select: { passwordPolicy: true },
    });
    const policy = normalizePasswordPolicy(org?.passwordPolicy);
    const policyFailures = evaluatePasswordPolicy(temporaryPassword, policy);
    if (policyFailures.length > 0) {
      throw new BadRequestException({
        error: 'WEAK_PASSWORD',
        message: `Generated password failed policy: ${policyFailures.join(', ')}`,
      });
    }

    const passwordHash = await bcrypt.hash(temporaryPassword, 12);
    const fullName =
      dto.fullName.trim() ||
      customer.contactPerson ||
      `${customer.name} Portal`;

    const user = await this.prisma.user.create({
      data: {
        email,
        fullName,
        phone: dto.phone?.trim() || null,
        passwordHash,
        organizationId: actor.organizationId,
        customerId,
        mustChangePassword: true,
        createdBy: actor.id,
        roles: { create: [{ roleId: role.id }] },
      },
      include: { roles: { include: { role: true } } },
    });

    await this.audit.record({
      organizationId: actor.organizationId,
      actorId: actor.id,
      action: 'customer.portal_user.invited',
      resourceType: 'User',
      resourceId: user.id,
      after: {
        email: user.email,
        customerId,
        customerCode: customer.code,
        roles: [PORTAL_ROLE],
      },
    });

    let notificationQueued = false;
    try {
      await this.notifications.enqueue(
        {
          channel: NotificationChannel.EMAIL,
          templateCode: 'CUSTOMER_PORTAL_INVITE',
          recipient: email,
          subject: `HIGHLINK customer portal access — ${customer.name}`,
          body: [
            `Hello ${fullName},`,
            '',
            `You have been invited to the HIGHLINK customer portal for ${customer.name} (${customer.code}).`,
            '',
            `Sign in: ${process.env.CUSTOMER_WEB_URL ?? 'http://localhost:3002'}/login`,
            `Email: ${email}`,
            `Temporary password: ${temporaryPassword}`,
            '',
            'Change this password after first sign-in. Do not share credentials.',
          ].join('\n'),
          resourceType: 'Customer',
          resourceId: customerId,
        },
        actor,
      );
      notificationQueued = true;
    } catch {
      // Invite must succeed even if notification outbox is down
    }

    return {
      ...this.toPortalUserDto(user),
      temporaryPassword,
      notificationQueued,
    };
  }

  private async requireCustomer(customerId: string, organizationId: string) {
    const customer = await this.prisma.customer.findFirst({
      where: { id: customerId, organizationId },
    });
    if (!customer) {
      throw new NotFoundException({
        error: 'NOT_FOUND',
        message: 'Customer not found',
      });
    }
    return customer;
  }

  private toPortalUserDto(user: {
    id: string;
    email: string;
    fullName: string;
    phone: string | null;
    organizationId: string;
    customerId: string | null;
    isActive: boolean;
    createdAt: Date;
    roles: Array<{ role: { code: string } }>;
  }): PortalUserResponseDto {
    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      phone: user.phone,
      organizationId: user.organizationId,
      customerId: user.customerId,
      isActive: user.isActive,
      roles: user.roles.map((r) => r.role.code),
      createdAt: user.createdAt,
    };
  }
}
