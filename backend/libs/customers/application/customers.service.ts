import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CustomerLifecycleStatus, Prisma } from '@prisma/client';
import { PrismaService, AuthUser, requireCustomerScope } from '@pssms/shared';
import { AuditService } from '@pssms/audit';
import {
  CreateCustomerDto,
  CustomerResponseDto,
  CustomerSiteSummaryDto,
  UpdateCustomerDto,
} from '../presentation/dto/customer.dto';

type CustomerRow = Prisma.CustomerGetPayload<object>;

function blankToNull(value?: string | null): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const t = value.trim();
  return t.length === 0 ? null : t;
}

function requireField(label: string, value?: string | null) {
  if (!value || !String(value).trim()) {
    throw new BadRequestException(`${label} is required`);
  }
}

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

    const draft = Boolean(dto.saveAsDraft);
    const name = dto.name.trim();
    if (name.length < 2) {
      throw new BadRequestException('Company name is required');
    }

    if (!draft) {
      requireField('TIN', dto.tin);
      requireField('Customer category', dto.category);
      requireField('Industry / sector', dto.industry);
      requireField('Physical address', dto.address);
      requireField('City / region', dto.city);
      requireField('Primary contact person', dto.contactPerson);
      requireField('Contact designation', dto.contactDesignation);
      requireField('Primary phone', dto.phone);
      requireField(
        'Billing email',
        dto.billingEmail || dto.email,
      );
      requireField('SLA level', dto.slaLevel);
      requireField('Payment terms', dto.paymentTerms);
      requireField('Invoice frequency', dto.invoiceFrequency);
      if (!dto.serviceTypes?.length) {
        throw new BadRequestException('Select at least one service type');
      }
    }

    const code = await this.resolveCode(
      user.organizationId,
      dto.code,
      name,
    );

    await this.assertNoDuplicate(user.organizationId, {
      name,
      tin: blankToNull(dto.tin) ?? null,
    });

    if (dto.branchId) {
      const branch = await this.prisma.branch.findFirst({
        where: { id: dto.branchId, organizationId: user.organizationId },
      });
      if (!branch) throw new NotFoundException('Branch not found');
    }

    const billingEmail =
      blankToNull(dto.billingEmail) ?? blankToNull(dto.email) ?? null;
    const status: CustomerLifecycleStatus = draft
      ? CustomerLifecycleStatus.PROSPECT
      : (dto.status ?? CustomerLifecycleStatus.ACTIVE);

    const customer = await this.prisma.customer.create({
      data: {
        organizationId: user.organizationId,
        code,
        name,
        tradingName: blankToNull(dto.tradingName) ?? null,
        category: blankToNull(dto.category) ?? null,
        industry: blankToNull(dto.industry) ?? null,
        ranking: blankToNull(dto.ranking) ?? 'NORMAL',
        status,
        tin: blankToNull(dto.tin) ?? null,
        vrn: blankToNull(dto.vrn) ?? null,
        businessLicense: blankToNull(dto.businessLicense) ?? null,
        address: blankToNull(dto.address) ?? null,
        postalAddress: blankToNull(dto.postalAddress) ?? null,
        city: blankToNull(dto.city) ?? null,
        region: blankToNull(dto.region) ?? null,
        country: blankToNull(dto.country) ?? 'Tanzania',
        contactPerson: blankToNull(dto.contactPerson) ?? null,
        contactDesignation: blankToNull(dto.contactDesignation) ?? null,
        phone: blankToNull(dto.phone) ?? null,
        altPhone: blankToNull(dto.altPhone) ?? null,
        email: billingEmail,
        billingEmail,
        opsEmail: blankToNull(dto.opsEmail) ?? null,
        website: blankToNull(dto.website) ?? null,
        serviceTypes: dto.serviceTypes?.map((s) => s.trim()).filter(Boolean) ?? [],
        preferredStartDate: dto.preferredStartDate
          ? new Date(dto.preferredStartDate)
          : null,
        estimatedGuards: dto.estimatedGuards ?? null,
        specialRequirements: blankToNull(dto.specialRequirements) ?? null,
        slaLevel: blankToNull(dto.slaLevel) ?? null,
        paymentTerms: blankToNull(dto.paymentTerms) ?? null,
        paymentMethod: blankToNull(dto.paymentMethod) ?? null,
        bankName: blankToNull(dto.bankName) ?? null,
        accountNumber: blankToNull(dto.accountNumber) ?? null,
        creditLimit:
          dto.creditLimit !== undefined && dto.creditLimit !== null
            ? new Prisma.Decimal(dto.creditLimit)
            : null,
        currency: blankToNull(dto.currency) ?? 'TZS',
        invoiceFrequency: blankToNull(dto.invoiceFrequency) ?? null,
        taxExempt: Boolean(dto.taxExempt),
        accountManagerName: blankToNull(dto.accountManagerName) ?? null,
        branchId: blankToNull(dto.branchId) ?? null,
        isActive: status !== CustomerLifecycleStatus.SUSPENDED &&
          status !== CustomerLifecycleStatus.TERMINATED,
        createdBy: user.id,
      },
    });

    await this.audit.record({
      organizationId: user.organizationId,
      actorId: user.id,
      action: draft ? 'customer.draft_created' : 'customer.created',
      resourceType: 'Customer',
      resourceId: customer.id,
      after: customer,
    });

    return this.toDto(customer, { siteCount: 0, contractCount: 0, sites: [] });
  }

  async update(
    id: string,
    dto: UpdateCustomerDto,
    user: AuthUser,
  ): Promise<CustomerResponseDto> {
    if (user.customerId) {
      throw new ForbiddenException({
        error: 'CUSTOMER_SCOPE_DENIED',
        message: 'Customer portal users cannot update customers',
      });
    }

    const existing = await this.prisma.customer.findFirst({
      where: { id, organizationId: user.organizationId },
    });
    if (!existing) throw new NotFoundException('Customer not found');

    if (dto.name !== undefined || dto.tin !== undefined) {
      await this.assertNoDuplicate(
        user.organizationId,
        {
          name: dto.name?.trim() ?? existing.name,
          tin:
            dto.tin !== undefined
              ? (blankToNull(dto.tin) ?? null)
              : existing.tin,
        },
        existing.id,
      );
    }

    if (dto.branchId) {
      const branch = await this.prisma.branch.findFirst({
        where: { id: dto.branchId, organizationId: user.organizationId },
      });
      if (!branch) throw new NotFoundException('Branch not found');
    }

    const nextStatus = dto.status ?? existing.status;
    const customer = await this.prisma.customer.update({
      where: { id: existing.id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.tradingName !== undefined
          ? { tradingName: blankToNull(dto.tradingName) }
          : {}),
        ...(dto.category !== undefined
          ? { category: blankToNull(dto.category) }
          : {}),
        ...(dto.industry !== undefined
          ? { industry: blankToNull(dto.industry) }
          : {}),
        ...(dto.ranking !== undefined
          ? { ranking: blankToNull(dto.ranking) ?? 'NORMAL' }
          : {}),
        ...(dto.status !== undefined ? { status: dto.status } : {}),
        ...(dto.tin !== undefined ? { tin: blankToNull(dto.tin) } : {}),
        ...(dto.vrn !== undefined ? { vrn: blankToNull(dto.vrn) } : {}),
        ...(dto.businessLicense !== undefined
          ? { businessLicense: blankToNull(dto.businessLicense) }
          : {}),
        ...(dto.email !== undefined ? { email: blankToNull(dto.email) } : {}),
        ...(dto.billingEmail !== undefined
          ? {
              billingEmail: blankToNull(dto.billingEmail),
              email:
                blankToNull(dto.billingEmail) ??
                blankToNull(dto.email) ??
                existing.email,
            }
          : {}),
        ...(dto.phone !== undefined ? { phone: blankToNull(dto.phone) } : {}),
        ...(dto.altPhone !== undefined
          ? { altPhone: blankToNull(dto.altPhone) }
          : {}),
        ...(dto.address !== undefined
          ? { address: blankToNull(dto.address) }
          : {}),
        ...(dto.postalAddress !== undefined
          ? { postalAddress: blankToNull(dto.postalAddress) }
          : {}),
        ...(dto.city !== undefined ? { city: blankToNull(dto.city) } : {}),
        ...(dto.region !== undefined ? { region: blankToNull(dto.region) } : {}),
        ...(dto.country !== undefined
          ? { country: blankToNull(dto.country) }
          : {}),
        ...(dto.contactPerson !== undefined
          ? { contactPerson: blankToNull(dto.contactPerson) }
          : {}),
        ...(dto.contactDesignation !== undefined
          ? { contactDesignation: blankToNull(dto.contactDesignation) }
          : {}),
        ...(dto.opsEmail !== undefined
          ? { opsEmail: blankToNull(dto.opsEmail) }
          : {}),
        ...(dto.website !== undefined
          ? { website: blankToNull(dto.website) }
          : {}),
        ...(dto.serviceTypes !== undefined
          ? {
              serviceTypes: dto.serviceTypes
                .map((s) => s.trim())
                .filter(Boolean),
            }
          : {}),
        ...(dto.preferredStartDate !== undefined
          ? {
              preferredStartDate: dto.preferredStartDate
                ? new Date(dto.preferredStartDate)
                : null,
            }
          : {}),
        ...(dto.estimatedGuards !== undefined
          ? { estimatedGuards: dto.estimatedGuards }
          : {}),
        ...(dto.specialRequirements !== undefined
          ? { specialRequirements: blankToNull(dto.specialRequirements) }
          : {}),
        ...(dto.slaLevel !== undefined
          ? { slaLevel: blankToNull(dto.slaLevel) }
          : {}),
        ...(dto.paymentTerms !== undefined
          ? { paymentTerms: blankToNull(dto.paymentTerms) }
          : {}),
        ...(dto.paymentMethod !== undefined
          ? { paymentMethod: blankToNull(dto.paymentMethod) }
          : {}),
        ...(dto.bankName !== undefined
          ? { bankName: blankToNull(dto.bankName) }
          : {}),
        ...(dto.accountNumber !== undefined
          ? { accountNumber: blankToNull(dto.accountNumber) }
          : {}),
        ...(dto.creditLimit !== undefined
          ? {
              creditLimit:
                dto.creditLimit === null
                  ? null
                  : new Prisma.Decimal(dto.creditLimit),
            }
          : {}),
        ...(dto.currency !== undefined
          ? { currency: blankToNull(dto.currency) ?? 'TZS' }
          : {}),
        ...(dto.invoiceFrequency !== undefined
          ? { invoiceFrequency: blankToNull(dto.invoiceFrequency) }
          : {}),
        ...(dto.taxExempt !== undefined ? { taxExempt: dto.taxExempt } : {}),
        ...(dto.accountManagerName !== undefined
          ? { accountManagerName: blankToNull(dto.accountManagerName) }
          : {}),
        ...(dto.branchId !== undefined
          ? { branchId: blankToNull(dto.branchId) }
          : {}),
        ...(dto.isActive !== undefined
          ? { isActive: dto.isActive }
          : {
              isActive:
                nextStatus !== CustomerLifecycleStatus.SUSPENDED &&
                nextStatus !== CustomerLifecycleStatus.TERMINATED,
            }),
        version: { increment: 1 },
      },
    });

    await this.audit.record({
      organizationId: user.organizationId,
      actorId: user.id,
      action: 'customer.updated',
      resourceType: 'Customer',
      resourceId: customer.id,
      before: existing,
      after: customer,
    });

    return this.enrichOne(customer);
  }

  async me(user: AuthUser): Promise<CustomerResponseDto> {
    const customerId = requireCustomerScope(user);
    const customer = await this.prisma.customer.findFirst({
      where: { id: customerId, organizationId: user.organizationId },
    });
    if (!customer) throw new NotFoundException('Customer not found');
    return this.enrichOne(customer);
  }

  async getById(
    id: string,
    organizationId: string,
    scopedCustomerId?: string,
  ): Promise<CustomerResponseDto> {
    if (scopedCustomerId && scopedCustomerId !== id) {
      throw new ForbiddenException({
        error: 'CUSTOMER_SCOPE_DENIED',
        message: 'Cannot access another customer',
      });
    }
    const customer = await this.prisma.customer.findFirst({
      where: {
        id,
        organizationId,
        ...(scopedCustomerId ? { id: scopedCustomerId } : {}),
      },
    });
    if (!customer) throw new NotFoundException('Customer not found');
    return this.enrichOne(customer, true);
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
    if (rows.length === 0) return [];

    const ids = rows.map((r) => r.id);
    const [siteGroups, contractGroups] = await Promise.all([
      this.prisma.site.groupBy({
        by: ['customerId'],
        where: {
          organizationId,
          customerId: { in: ids },
        },
        _count: { _all: true },
      }),
      this.prisma.contract.groupBy({
        by: ['customerId'],
        where: {
          organizationId,
          customerId: { in: ids },
        },
        _count: { _all: true },
      }),
    ]);

    const siteMap = new Map(
      siteGroups
        .filter((g) => g.customerId)
        .map((g) => [g.customerId as string, g._count._all]),
    );
    const contractMap = new Map(
      contractGroups.map((g) => [g.customerId, g._count._all]),
    );

    return rows.map((c) =>
      this.toDto(c, {
        siteCount: siteMap.get(c.id) ?? 0,
        contractCount: contractMap.get(c.id) ?? 0,
      }),
    );
  }

  private async resolveCode(
    organizationId: string,
    requested: string | undefined,
    companyName: string,
  ): Promise<string> {
    const manual = blankToNull(requested);
    if (manual) {
      const code = manual.toUpperCase();
      const exists = await this.prisma.customer.findFirst({
        where: { organizationId, code },
      });
      if (exists) throw new ConflictException('Customer code already exists');
      return code;
    }

    const slug = companyName
      .replace(/[^a-zA-Z0-9]+/g, '')
      .slice(0, 6)
      .toUpperCase() || 'CUST';
    for (let i = 0; i < 20; i += 1) {
      const n = String(Math.floor(Math.random() * 900) + 100);
      const code = `CUST-${slug}-${n}`;
      const exists = await this.prisma.customer.findFirst({
        where: { organizationId, code },
      });
      if (!exists) return code;
    }
    return `CUST-${Date.now().toString(36).toUpperCase()}`;
  }

  private async assertNoDuplicate(
    organizationId: string,
    input: { name: string; tin: string | null },
    excludeId?: string,
  ) {
    const byName = await this.prisma.customer.findFirst({
      where: {
        organizationId,
        name: { equals: input.name, mode: 'insensitive' },
        ...(excludeId ? { NOT: { id: excludeId } } : {}),
      },
    });
    if (byName) {
      throw new ConflictException(
        `A customer named "${byName.name}" already exists (${byName.code})`,
      );
    }
    if (input.tin) {
      const byTin = await this.prisma.customer.findFirst({
        where: {
          organizationId,
          tin: input.tin,
          ...(excludeId ? { NOT: { id: excludeId } } : {}),
        },
      });
      if (byTin) {
        throw new ConflictException(
          `TIN ${input.tin} is already registered to ${byTin.code}`,
        );
      }
    }
  }

  private async enrichOne(
    customer: CustomerRow,
    includeSites = false,
  ): Promise<CustomerResponseDto> {
    const [siteCount, contractCount, sites] = await Promise.all([
      this.prisma.site.count({
        where: {
          organizationId: customer.organizationId,
          customerId: customer.id,
        },
      }),
      this.prisma.contract.count({
        where: {
          organizationId: customer.organizationId,
          customerId: customer.id,
        },
      }),
      includeSites
        ? this.prisma.site.findMany({
            where: {
              organizationId: customer.organizationId,
              customerId: customer.id,
            },
            orderBy: { name: 'asc' },
            select: {
              id: true,
              code: true,
              name: true,
              address: true,
              isActive: true,
            },
          })
        : Promise.resolve(undefined as CustomerSiteSummaryDto[] | undefined),
    ]);

    return this.toDto(customer, {
      siteCount,
      contractCount,
      sites: sites ?? undefined,
    });
  }

  private toDto(
    c: CustomerRow,
    extra?: {
      siteCount?: number;
      contractCount?: number;
      sites?: CustomerSiteSummaryDto[];
    },
  ): CustomerResponseDto {
    return {
      id: c.id,
      organizationId: c.organizationId,
      code: c.code,
      name: c.name,
      tradingName: c.tradingName,
      tin: c.tin,
      vrn: c.vrn,
      businessLicense: c.businessLicense,
      email: c.email,
      phone: c.phone,
      altPhone: c.altPhone,
      address: c.address,
      postalAddress: c.postalAddress,
      city: c.city,
      region: c.region,
      country: c.country,
      contactPerson: c.contactPerson,
      contactDesignation: c.contactDesignation,
      billingEmail: c.billingEmail,
      opsEmail: c.opsEmail,
      website: c.website,
      category: c.category,
      industry: c.industry,
      ranking: c.ranking,
      status: c.status,
      serviceTypes: c.serviceTypes ?? [],
      preferredStartDate: c.preferredStartDate,
      estimatedGuards: c.estimatedGuards,
      specialRequirements: c.specialRequirements,
      slaLevel: c.slaLevel,
      paymentTerms: c.paymentTerms,
      paymentMethod: c.paymentMethod,
      bankName: c.bankName,
      accountNumber: c.accountNumber,
      creditLimit:
        c.creditLimit !== null && c.creditLimit !== undefined
          ? String(c.creditLimit)
          : null,
      currency: c.currency,
      invoiceFrequency: c.invoiceFrequency,
      taxExempt: c.taxExempt,
      accountManagerName: c.accountManagerName,
      branchId: c.branchId,
      isActive: c.isActive,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
      siteCount: extra?.siteCount,
      contractCount: extra?.contractCount,
      ...(extra?.sites ? { sites: extra.sites } : {}),
    };
  }
}
