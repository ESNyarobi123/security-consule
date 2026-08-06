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
import { InviteCustomerEmployeePortalResponseDto } from '../presentation/dto/customer-employee-portal.dto';
import { CustomerEmployeeStaffResponseDto } from '../presentation/dto/customer-employee.dto';

const EMPLOYEE_ROLE = 'CUSTOMER_EMPLOYEE';

function generateTempPassword(): string {
  const chunk = randomBytes(6).toString('base64url');
  return `Hl-${chunk}!9A`;
}

/** Module 6-I — invite CUSTOMER_EMPLOYEE login + bind CustomerEmployee.userId. */
@Injectable()
export class CustomerEmployeePortalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
  ) {}

  async invite(
    customerId: string,
    employeeId: string,
    actor: AuthUser,
  ): Promise<InviteCustomerEmployeePortalResponseDto> {
    const customer = await this.prisma.customer.findFirst({
      where: { id: customerId, organizationId: actor.organizationId },
    });
    if (!customer) {
      throw new NotFoundException({
        error: 'NOT_FOUND',
        message: 'Customer not found',
      });
    }
    if (customer.status === 'SUSPENDED' || customer.status === 'TERMINATED') {
      throw new BadRequestException({
        error: 'CUSTOMER_NOT_ACTIVE',
        message:
          'Cannot invite employee portal logins for suspended/terminated customers',
      });
    }

    const employee = await this.prisma.customerEmployee.findFirst({
      where: {
        id: employeeId,
        customerId,
        organizationId: actor.organizationId,
      },
    });
    if (!employee) {
      throw new NotFoundException({
        error: 'NOT_FOUND',
        message: 'Customer employee not found',
      });
    }
    if (employee.userId) {
      throw new ConflictException({
        error: 'ALREADY_LINKED',
        message: 'This employee already has a portal login',
      });
    }
    if (!employee.isActive) {
      throw new BadRequestException({
        error: 'EMPLOYEE_INACTIVE',
        message: 'Reactivate the employee before inviting a portal login',
      });
    }
    const email = employee.email?.toLowerCase().trim();
    if (!email) {
      throw new BadRequestException({
        error: 'EMPLOYEE_EMAIL_REQUIRED',
        message: 'Employee email is required before inviting a portal login',
      });
    }

    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new ConflictException({
        error: 'CONFLICT',
        message:
          existing.customerId === customerId
            ? 'This email already has a login for this customer'
            : 'Email already registered in the organisation',
      });
    }

    const role = await this.prisma.role.findFirst({
      where: {
        organizationId: actor.organizationId,
        code: EMPLOYEE_ROLE,
      },
    });
    if (!role) {
      throw new NotFoundException({
        error: 'NOT_FOUND',
        message: 'CUSTOMER_EMPLOYEE role is not configured for this organisation',
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

    const { user, updatedEmployee } = await this.prisma.$transaction(
      async (tx) => {
        const user = await tx.user.create({
          data: {
            email,
            fullName: employee.fullName,
            phone: employee.phone,
            passwordHash,
            organizationId: actor.organizationId,
            customerId,
            mustChangePassword: true,
            createdBy: actor.id,
            roles: { create: [{ roleId: role.id }] },
          },
        });
        const updatedEmployee = await tx.customerEmployee.update({
          where: { id: employee.id },
          data: { userId: user.id },
        });
        return { user, updatedEmployee };
      },
    );

    await this.audit.record({
      organizationId: actor.organizationId,
      actorId: actor.id,
      action: 'access.employee.portal_invited',
      resourceType: 'CustomerEmployee',
      resourceId: employee.id,
      after: {
        employeeId: employee.id,
        userId: user.id,
        email,
        customerId,
        customerCode: customer.code,
        roles: [EMPLOYEE_ROLE],
      },
    });

    let notificationQueued = false;
    try {
      await this.notifications.enqueue(
        {
          channel: NotificationChannel.EMAIL,
          templateCode: 'CUSTOMER_EMPLOYEE_INVITE',
          recipient: email,
          subject: `HIGHLINK employee access — ${customer.name}`,
          body: [
            `Hello ${employee.fullName},`,
            '',
            `You have been invited to HIGHLINK employee self-access for ${customer.name} (${customer.code}).`,
            '',
            `Sign in: ${process.env.CUSTOMER_WEB_URL ?? 'http://localhost:3002'}/login`,
            `Email: ${email}`,
            `Temporary password: ${temporaryPassword}`,
            '',
            'Change this password after first sign-in. Do not share credentials.',
          ].join('\n'),
          resourceType: 'CustomerEmployee',
          resourceId: employee.id,
        },
        actor,
      );
      notificationQueued = true;
    } catch {
      // Invite must succeed even if notification outbox is down
    }

    return {
      employee: this.toEmployeeDto(updatedEmployee),
      userId: user.id,
      email: user.email,
      temporaryPassword,
      notificationQueued,
    };
  }

  private toEmployeeDto(e: {
    id: string;
    organizationId: string;
    customerId: string;
    userId: string | null;
    employeeNumber: string | null;
    fullName: string;
    email: string | null;
    phone: string | null;
    department: string | null;
    accessLevel: import('@prisma/client').AccessLevel;
    accessCardRef: string | null;
    biometricRef: string | null;
    isActive: boolean;
    createdAt: Date;
  }): CustomerEmployeeStaffResponseDto {
    return {
      id: e.id,
      organizationId: e.organizationId,
      customerId: e.customerId,
      userId: e.userId,
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
}
