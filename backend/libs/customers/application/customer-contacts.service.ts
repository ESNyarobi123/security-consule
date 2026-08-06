import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CustomerContact, CustomerContactRole, Prisma } from '@prisma/client';
import { AuditService } from '@pssms/audit';
import { AuthUser, PrismaService, requireCustomerScope } from '@pssms/shared';
import {
  CreateCustomerContactDto,
  CustomerContactResponseDto,
  UpdateCustomerContactDto,
} from '../presentation/dto/customer-contact.dto';

function blankToNull(value?: string | null): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const t = value.trim();
  return t.length === 0 ? null : t;
}

@Injectable()
export class CustomerContactsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async listForStaff(
    customerId: string,
    user: AuthUser,
  ): Promise<CustomerContactResponseDto[]> {
    await this.assertStaffCustomer(customerId, user);
    const rows = await this.prisma.customerContact.findMany({
      where: { organizationId: user.organizationId, customerId },
      orderBy: [{ isPrimary: 'desc' }, { fullName: 'asc' }],
    });
    return rows.map((r) => this.toDto(r));
  }

  async listForPortal(user: AuthUser): Promise<CustomerContactResponseDto[]> {
    const customerId = requireCustomerScope(user);
    const rows = await this.prisma.customerContact.findMany({
      where: {
        organizationId: user.organizationId,
        customerId,
        isActive: true,
      },
      orderBy: [{ isPrimary: 'desc' }, { fullName: 'asc' }],
    });
    return rows.map((r) => this.toDto(r));
  }

  async create(
    customerId: string,
    dto: CreateCustomerContactDto,
    user: AuthUser,
  ): Promise<CustomerContactResponseDto> {
    await this.assertStaffCustomer(customerId, user);

    const isPrimary = Boolean(dto.isPrimary);
    const created = await this.prisma.$transaction(async (tx) => {
      if (isPrimary) {
        await tx.customerContact.updateMany({
          where: {
            organizationId: user.organizationId,
            customerId,
            isPrimary: true,
          },
          data: { isPrimary: false },
        });
      }

      const row = await tx.customerContact.create({
        data: {
          organizationId: user.organizationId,
          customerId,
          fullName: dto.fullName.trim(),
          designation: blankToNull(dto.designation) ?? null,
          role: dto.role ?? CustomerContactRole.GENERAL,
          email: blankToNull(dto.email) ?? null,
          phone: blankToNull(dto.phone) ?? null,
          altPhone: blankToNull(dto.altPhone) ?? null,
          isPrimary,
          notes: blankToNull(dto.notes) ?? null,
          createdBy: user.id,
        },
      });

      if (isPrimary) {
        await this.syncPrimaryScalars(tx, customerId, row);
      }

      return row;
    });

    await this.audit.record({
      organizationId: user.organizationId,
      actorId: user.id,
      action: 'customer.contact.created',
      resourceType: 'CustomerContact',
      resourceId: created.id,
      after: {
        customerId,
        fullName: created.fullName,
        role: created.role,
        isPrimary: created.isPrimary,
      },
    });

    return this.toDto(created);
  }

  async update(
    customerId: string,
    contactId: string,
    dto: UpdateCustomerContactDto,
    user: AuthUser,
  ): Promise<CustomerContactResponseDto> {
    await this.assertStaffCustomer(customerId, user);

    const existing = await this.prisma.customerContact.findFirst({
      where: {
        id: contactId,
        organizationId: user.organizationId,
        customerId,
      },
    });
    if (!existing) {
      throw new NotFoundException({
        error: 'NOT_FOUND',
        message: 'Contact not found',
      });
    }

    const data: Prisma.CustomerContactUpdateInput = {};
    if (dto.fullName !== undefined) data.fullName = dto.fullName.trim();
    if (dto.designation !== undefined)
      data.designation = blankToNull(dto.designation) ?? null;
    if (dto.role !== undefined) data.role = dto.role;
    if (dto.email !== undefined) data.email = blankToNull(dto.email) ?? null;
    if (dto.phone !== undefined) data.phone = blankToNull(dto.phone) ?? null;
    if (dto.altPhone !== undefined)
      data.altPhone = blankToNull(dto.altPhone) ?? null;
    if (dto.notes !== undefined) data.notes = blankToNull(dto.notes) ?? null;
    if (dto.isActive !== undefined) data.isActive = dto.isActive;
    if (dto.isPrimary !== undefined) data.isPrimary = dto.isPrimary;

    const updated = await this.prisma.$transaction(async (tx) => {
      const becomingPrimary =
        dto.isPrimary === true ||
        (dto.isPrimary === undefined && existing.isPrimary);

      if (dto.isPrimary === true) {
        await tx.customerContact.updateMany({
          where: {
            organizationId: user.organizationId,
            customerId,
            isPrimary: true,
            NOT: { id: contactId },
          },
          data: { isPrimary: false },
        });
      }

      const row = await tx.customerContact.update({
        where: { id: contactId },
        data,
      });

      if (becomingPrimary && row.isPrimary && row.isActive) {
        await this.syncPrimaryScalars(tx, customerId, row);
      }

      return row;
    });

    await this.audit.record({
      organizationId: user.organizationId,
      actorId: user.id,
      action: 'customer.contact.updated',
      resourceType: 'CustomerContact',
      resourceId: updated.id,
      before: {
        fullName: existing.fullName,
        role: existing.role,
        isPrimary: existing.isPrimary,
        isActive: existing.isActive,
      },
      after: {
        fullName: updated.fullName,
        role: updated.role,
        isPrimary: updated.isPrimary,
        isActive: updated.isActive,
      },
    });

    return this.toDto(updated);
  }

  private async assertStaffCustomer(
    customerId: string,
    user: AuthUser,
  ): Promise<void> {
    if (user.customerId) {
      throw new ForbiddenException({
        error: 'CUSTOMER_SCOPE_DENIED',
        message: 'Customer portal users cannot manage staff contact directory',
      });
    }
    const customer = await this.prisma.customer.findFirst({
      where: { id: customerId, organizationId: user.organizationId },
      select: { id: true },
    });
    if (!customer) {
      throw new NotFoundException('Customer not found');
    }
  }

  private async syncPrimaryScalars(
    tx: Prisma.TransactionClient,
    customerId: string,
    contact: CustomerContact,
  ): Promise<void> {
    await tx.customer.update({
      where: { id: customerId },
      data: {
        contactPerson: contact.fullName,
        contactDesignation: contact.designation,
        ...(contact.phone ? { phone: contact.phone } : {}),
        ...(contact.email ? { email: contact.email } : {}),
      },
    });
  }

  private toDto(row: CustomerContact): CustomerContactResponseDto {
    return {
      id: row.id,
      organizationId: row.organizationId,
      customerId: row.customerId,
      fullName: row.fullName,
      designation: row.designation,
      role: row.role,
      email: row.email,
      phone: row.phone,
      altPhone: row.altPhone,
      isPrimary: row.isPrimary,
      isActive: row.isActive,
      notes: row.notes,
      createdAt: row.createdAt,
    };
  }
}
