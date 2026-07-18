import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService, AuthUser, requireCustomerScope } from '@pssms/shared';
import { AuditService } from '@pssms/audit';
import {
  CreateCustomerDto,
  CustomerResponseDto,
} from '../presentation/dto/customer.dto';

@Injectable()
export class CustomersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async create(
    dto: CreateCustomerDto,
    user: AuthUser,
  ): Promise<CustomerResponseDto> {
    if (user.customerId) {
      throw new ForbiddenException({
        error: 'CUSTOMER_SCOPE_DENIED',
        message: 'Customer portal users cannot create customers',
      });
    }

    const exists = await this.prisma.customer.findFirst({
      where: { organizationId: user.organizationId, code: dto.code },
    });
    if (exists) throw new ConflictException('Customer code already exists');

    const customer = await this.prisma.customer.create({
      data: {
        ...dto,
        organizationId: user.organizationId,
        createdBy: user.id,
      },
    });

    await this.audit.record({
      organizationId: user.organizationId,
      actorId: user.id,
      action: 'customer.created',
      resourceType: 'Customer',
      resourceId: customer.id,
      after: customer,
    });

    return this.toDto(customer);
  }

  async me(user: AuthUser): Promise<CustomerResponseDto> {
    const customerId = requireCustomerScope(user);
    const customer = await this.prisma.customer.findFirst({
      where: { id: customerId, organizationId: user.organizationId },
    });
    if (!customer) throw new NotFoundException('Customer not found');
    return this.toDto(customer);
  }

  async list(
    organizationId: string,
    customerId?: string,
  ): Promise<CustomerResponseDto[]> {
    const rows = await this.prisma.customer.findMany({
      where: {
        organizationId,
        ...(customerId ? { id: customerId } : {}),
      },
      orderBy: { name: 'asc' },
    });
    return rows.map((c) => this.toDto(c));
  }

  private toDto(c: {
    id: string;
    organizationId: string;
    code: string;
    name: string;
    email: string | null;
    phone: string | null;
    isActive: boolean;
    createdAt: Date;
  }): CustomerResponseDto {
    return {
      id: c.id,
      organizationId: c.organizationId,
      code: c.code,
      name: c.name,
      email: c.email,
      phone: c.phone,
      isActive: c.isActive,
      createdAt: c.createdAt,
    };
  }
}
