import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Prisma,
  PurchaseOrderStatus,
  SupplierCategory,
  SupplierMessageAuthor,
  SupplierPaymentStatus,
  SupplierStatus,
  SupplierSubmissionKind,
  SupplierSubmissionStatus,
} from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { AuditService } from '@pssms/audit';
import {
  AuthUser,
  PrismaService,
  evaluatePasswordPolicy,
  getOrgContext,
  normalizePasswordPolicy,
  requireSupplierScope,
} from '@pssms/shared';
import {
  CreateSupplierDto,
  CreateSupplierMessageDto,
  CreateSupplierSubmissionDto,
  RegisterSupplierDto,
  RegisterSupplierResponseDto,
  RejectSupplierDto,
  RejectSupplierSubmissionDto,
  SupplierMessageResponseDto,
  SupplierResponseDto,
  SupplierSubmissionResponseDto,
  UpdateSupplierProfileDto,
} from '../presentation/dto/procurement.dto';

@Injectable()
export class SuppliersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  private async withPublicOrg<T>(fn: () => Promise<T>): Promise<T> {
    if (getOrgContext()?.organizationId) return fn();
    const org = await this.prisma.organization.findFirst({
      where: { code: 'HIGHLINK' },
    });
    if (!org) throw new NotFoundException('Demo organization not found');
    return this.prisma.runInRequestContext({ organizationId: org.id }, fn);
  }

  async register(
    dto: RegisterSupplierDto,
  ): Promise<RegisterSupplierResponseDto> {
    return this.withPublicOrg(async () => {
      const org = await this.prisma.organization.findFirst({
        where: { code: 'HIGHLINK' },
      });
      if (!org) throw new NotFoundException('Demo organization not found');

      const email = dto.email.toLowerCase().trim();
      const existingUser = await this.prisma.user.findUnique({
        where: { email },
      });
      if (existingUser) {
        throw new ConflictException({
          error: 'EMAIL_IN_USE',
          message: 'That email is already registered',
        });
      }

      const policy = normalizePasswordPolicy(org.passwordPolicy);
      const policyFailures = evaluatePasswordPolicy(dto.password, policy);
      if (policyFailures.length > 0) {
        throw new BadRequestException({
          error: 'WEAK_PASSWORD',
          message: `Password must contain ${policyFailures.join(', ')}`,
        });
      }

      const role = await this.prisma.role.findFirst({
        where: { organizationId: org.id, code: 'SUPPLIER_PORTAL' },
      });
      if (!role) {
        throw new BadRequestException({
          error: 'ROLE_MISSING',
          message: 'SUPPLIER_PORTAL role is not configured',
        });
      }

      const passwordHash = await bcrypt.hash(dto.password, 12);
      const companyName = dto.companyName.trim();
      const contactName = dto.contactName.trim();
      const phone = dto.phone?.trim() || null;

      let supplier: Awaited<
        ReturnType<typeof this.prisma.supplier.create>
      > | null = null;
      for (let attempt = 0; attempt < 6; attempt += 1) {
        const code = nextSupplierCode(companyName);
        try {
          supplier = await this.prisma.supplier.create({
            data: {
              organizationId: org.id,
              code,
              name: companyName,
              email,
              phone,
              tin: dto.tin?.trim() || null,
              vrn: dto.vrn?.trim() || null,
              address: dto.address?.trim() || null,
              category: dto.category ?? SupplierCategory.GOODS,
              contactPerson: contactName,
              contactPhone: phone,
              contactEmail: email,
              status: SupplierStatus.PENDING,
            },
          });
          break;
        } catch (err) {
          if (
            err instanceof Prisma.PrismaClientKnownRequestError &&
            err.code === 'P2002'
          ) {
            continue;
          }
          throw err;
        }
      }
      if (!supplier) {
        throw new BadRequestException({
          error: 'SUPPLIER_CODE_FAILED',
          message: 'Could not allocate a supplier code. Try again.',
        });
      }

      const user = await this.prisma.user.create({
        data: {
          email,
          passwordHash,
          fullName: contactName,
          phone,
          organizationId: org.id,
          supplierId: supplier.id,
          mustChangePassword: false,
          roles: { create: [{ roleId: role.id }] },
        },
      });

      await this.prisma.supplier.update({
        where: { id: supplier.id },
        data: { createdBy: user.id },
      });

      await this.audit.record({
        organizationId: org.id,
        actorId: user.id,
        action: 'supplier.registered',
        resourceType: 'Supplier',
        resourceId: supplier.id,
        after: {
          code: supplier.code,
          name: supplier.name,
          status: supplier.status,
          email,
        },
      });

      return {
        supplierId: supplier.id,
        code: supplier.code,
        name: supplier.name,
        status: supplier.status,
        email,
        message:
          'Registration received. Sign in with this email. HIGHLINK procurement must approve the supplier before quotes, invoices, and purchase orders are active.',
      };
    });
  }

  async create(
    dto: CreateSupplierDto,
    user: AuthUser,
  ): Promise<SupplierResponseDto> {
    this.assertStaff(user);

    const exists = await this.prisma.supplier.findFirst({
      where: { organizationId: user.organizationId, code: dto.code },
    });
    if (exists) throw new BadRequestException('Supplier code already exists');

    const supplier = await this.prisma.supplier.create({
      data: {
        organizationId: user.organizationId,
        code: dto.code.trim(),
        name: dto.name.trim(),
        email: dto.email?.trim() || null,
        phone: dto.phone?.trim() || null,
        tin: dto.tin?.trim() || null,
        vrn: dto.vrn?.trim() || null,
        address: dto.address?.trim() || null,
        category: dto.category ?? SupplierCategory.GOODS,
        bankName: dto.bankName?.trim() || null,
        bankAccountName: dto.bankAccountName?.trim() || null,
        bankAccountRef: dto.bankAccountRef?.trim() || null,
        mobileMoneyProvider: dto.mobileMoneyProvider?.trim() || null,
        mobileMoneyRef: dto.mobileMoneyRef?.trim() || null,
        contactPerson: dto.contactPerson?.trim() || null,
        contactPhone: dto.contactPhone?.trim() || null,
        contactEmail: dto.contactEmail?.trim() || null,
        createdBy: user.id,
      },
    });

    await this.audit.record({
      organizationId: user.organizationId,
      actorId: user.id,
      action: 'supplier.created',
      resourceType: 'Supplier',
      resourceId: supplier.id,
      after: supplier,
    });

    return this.toDto(supplier);
  }

  async me(user: AuthUser): Promise<SupplierResponseDto> {
    const supplierId = requireSupplierScope(user);
    const supplier = await this.prisma.supplier.findFirst({
      where: { id: supplierId, organizationId: user.organizationId },
    });
    if (!supplier) throw new NotFoundException('Supplier not found');
    return this.toDto(supplier);
  }

  async updateMe(
    dto: UpdateSupplierProfileDto,
    user: AuthUser,
  ): Promise<SupplierResponseDto> {
    const supplierId = requireSupplierScope(user);
    return this.updateProfile(supplierId, dto, user, 'portal');
  }

  async updateStaff(
    id: string,
    dto: UpdateSupplierProfileDto,
    user: AuthUser,
  ): Promise<SupplierResponseDto> {
    this.assertStaff(user);
    return this.updateProfile(id, dto, user, 'staff');
  }

  async list(
    organizationId: string,
    supplierId?: string,
  ): Promise<SupplierResponseDto[]> {
    const rows = await this.prisma.supplier.findMany({
      where: {
        organizationId,
        ...(supplierId ? { id: supplierId } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return rows.map((s) => this.toDto(s));
  }

  async approve(id: string, user: AuthUser): Promise<SupplierResponseDto> {
    this.assertStaff(user);
    const supplier = await this.findOrThrow(id, user.organizationId);
    if (supplier.status === SupplierStatus.APPROVED) {
      throw new BadRequestException('Supplier already approved');
    }
    if (supplier.status === SupplierStatus.SUSPENDED) {
      throw new BadRequestException({
        error: 'SUPPLIER_SUSPENDED',
        message: 'Reactivate a suspended supplier before approving',
      });
    }
    this.assertCreatorNotActor(supplier.createdBy, user, 'approve');

    const updated = await this.prisma.supplier.update({
      where: { id },
      data: {
        status: SupplierStatus.APPROVED,
        approvedBy: user.id,
        approvedAt: new Date(),
        rejectedReason: null,
      },
    });
    await this.audit.record({
      organizationId: user.organizationId,
      actorId: user.id,
      action: 'supplier.approved',
      resourceType: 'Supplier',
      resourceId: id,
      after: updated,
    });
    return this.toDto(updated);
  }

  async reject(
    id: string,
    dto: RejectSupplierDto,
    user: AuthUser,
  ): Promise<SupplierResponseDto> {
    this.assertStaff(user);
    const supplier = await this.findOrThrow(id, user.organizationId);
    if (supplier.status === SupplierStatus.APPROVED) {
      throw new BadRequestException({
        error: 'USE_SUSPEND',
        message: 'Approved suppliers must be suspended, not rejected',
      });
    }
    if (supplier.status === SupplierStatus.REJECTED) {
      throw new BadRequestException('Supplier already rejected');
    }
    this.assertCreatorNotActor(supplier.createdBy, user, 'reject');

    const updated = await this.prisma.supplier.update({
      where: { id },
      data: {
        status: SupplierStatus.REJECTED,
        rejectedReason: dto.reason.trim(),
      },
    });
    await this.audit.record({
      organizationId: user.organizationId,
      actorId: user.id,
      action: 'supplier.rejected',
      resourceType: 'Supplier',
      resourceId: id,
      after: { ...updated, rejectedReason: dto.reason },
    });
    return this.toDto(updated);
  }

  async suspend(id: string, user: AuthUser): Promise<SupplierResponseDto> {
    this.assertStaff(user);
    const supplier = await this.findOrThrow(id, user.organizationId);
    if (supplier.status === SupplierStatus.SUSPENDED) {
      throw new BadRequestException('Supplier already suspended');
    }
    this.assertCreatorNotActor(supplier.createdBy, user, 'suspend');
    const updated = await this.prisma.supplier.update({
      where: { id },
      data: { status: SupplierStatus.SUSPENDED },
    });
    await this.audit.record({
      organizationId: user.organizationId,
      actorId: user.id,
      action: 'supplier.suspended',
      resourceType: 'Supplier',
      resourceId: id,
      after: updated,
    });
    return this.toDto(updated);
  }

  async createSubmission(
    dto: CreateSupplierSubmissionDto,
    user: AuthUser,
  ): Promise<SupplierSubmissionResponseDto> {
    const supplierId = requireSupplierScope(user);
    const supplier = await this.findOrThrow(supplierId, user.organizationId);
    if (supplier.status !== SupplierStatus.APPROVED) {
      throw new ForbiddenException({
        error: 'SUPPLIER_NOT_APPROVED',
        message:
          'HIGHLINK must approve your registration before you can submit quotes, invoices, delivery notes, or payment requests',
      });
    }

    let purchaseOrderId: string | null = null;
    let poNumber: string | null = null;
    if (dto.purchaseOrderId) {
      const po = await this.prisma.purchaseOrder.findFirst({
        where: {
          id: dto.purchaseOrderId,
          organizationId: user.organizationId,
          supplierId,
        },
        select: { id: true, poNumber: true, status: true },
      });
      if (!po) {
        throw new BadRequestException({
          error: 'INVALID_PURCHASE_ORDER',
          message: 'Purchase order not found for this supplier',
        });
      }
      const issued: PurchaseOrderStatus[] = [
        PurchaseOrderStatus.ORDERED,
        PurchaseOrderStatus.PARTIALLY_RECEIVED,
        PurchaseOrderStatus.RECEIVED,
        PurchaseOrderStatus.CANCELLED,
      ];
      if (user.supplierId && !issued.includes(po.status)) {
        throw new BadRequestException({
          error: 'INVALID_PURCHASE_ORDER',
          message: 'Purchase order not found for this supplier',
        });
      }
      purchaseOrderId = po.id;
      poNumber = po.poNumber;
    }

    const paymentStatus =
      dto.kind === SupplierSubmissionKind.INVOICE ||
      dto.kind === SupplierSubmissionKind.PAYMENT_REQUEST
        ? SupplierPaymentStatus.UNPAID
        : SupplierPaymentStatus.NONE;

    const referenceNumber = await this.nextSubmissionNumber(
      user.organizationId,
      dto.kind,
    );
    const row = await this.prisma.supplierSubmission.create({
      data: {
        organizationId: user.organizationId,
        supplierId,
        purchaseOrderId,
        referenceNumber,
        kind: dto.kind,
        title: dto.title.trim(),
        description: dto.description?.trim() || null,
        amount: dto.amount != null ? new Prisma.Decimal(dto.amount) : null,
        currency: dto.currency?.trim() || 'TZS',
        paymentStatus,
        createdBy: user.id,
      },
    });

    await this.audit.record({
      organizationId: user.organizationId,
      actorId: user.id,
      action: 'supplier.submission.created',
      resourceType: 'SupplierSubmission',
      resourceId: row.id,
      after: { ...row, via: 'supplier_portal' },
    });

    return this.toSubmissionDto(row, {
      supplierCode: supplier.code,
      supplierName: supplier.name,
      poNumber,
    });
  }

  async listMySubmissions(
    user: AuthUser,
  ): Promise<SupplierSubmissionResponseDto[]> {
    const supplierId = requireSupplierScope(user);
    return this.listSubmissions(user.organizationId, supplierId);
  }

  async listMyMessages(user: AuthUser): Promise<SupplierMessageResponseDto[]> {
    const supplierId = requireSupplierScope(user);
    return this.listMessages(user.organizationId, supplierId);
  }

  async createMyMessage(
    dto: CreateSupplierMessageDto,
    user: AuthUser,
  ): Promise<SupplierMessageResponseDto> {
    const supplierId = requireSupplierScope(user);
    return this.createMessage(
      supplierId,
      dto,
      user,
      SupplierMessageAuthor.SUPPLIER,
    );
  }

  async listStaffMessages(
    supplierId: string,
    user: AuthUser,
  ): Promise<SupplierMessageResponseDto[]> {
    this.assertStaff(user);
    await this.findOrThrow(supplierId, user.organizationId);
    return this.listMessages(user.organizationId, supplierId);
  }

  async createStaffMessage(
    supplierId: string,
    dto: CreateSupplierMessageDto,
    user: AuthUser,
  ): Promise<SupplierMessageResponseDto> {
    this.assertStaff(user);
    return this.createMessage(
      supplierId,
      dto,
      user,
      SupplierMessageAuthor.PROCUREMENT,
    );
  }

  private async createMessage(
    supplierId: string,
    dto: CreateSupplierMessageDto,
    user: AuthUser,
    authorType: SupplierMessageAuthor,
  ): Promise<SupplierMessageResponseDto> {
    const supplier = await this.findOrThrow(supplierId, user.organizationId);
    if (authorType === SupplierMessageAuthor.SUPPLIER) {
      if (
        supplier.status === SupplierStatus.REJECTED ||
        supplier.status === SupplierStatus.SUSPENDED
      ) {
        throw new ForbiddenException({
          error: 'SUPPLIER_NOT_APPROVED',
          message:
            'Suspended or rejected suppliers cannot message procurement',
        });
      }
    }
    const body = dto.body.trim();
    if (!body) {
      throw new BadRequestException('Message body is required');
    }

    const row = await this.prisma.supplierMessage.create({
      data: {
        organizationId: user.organizationId,
        supplierId,
        authorType,
        body,
        createdBy: user.id,
      },
    });

    await this.audit.record({
      organizationId: user.organizationId,
      actorId: user.id,
      action: 'supplier.message.created',
      resourceType: 'Supplier',
      resourceId: supplierId,
      after: { messageId: row.id, authorType },
    });

    const [dtoRow] = await this.enrichMessages([row]);
    return dtoRow!;
  }

  private async listMessages(
    organizationId: string,
    supplierId: string,
  ): Promise<SupplierMessageResponseDto[]> {
    const rows = await this.prisma.supplierMessage.findMany({
      where: { organizationId, supplierId },
      orderBy: { createdAt: 'asc' },
      take: 200,
    });
    return this.enrichMessages(rows);
  }

  private async enrichMessages(
    rows: {
      id: string;
      organizationId: string;
      supplierId: string;
      authorType: SupplierMessageAuthor;
      body: string;
      createdBy: string;
      createdAt: Date;
    }[],
  ): Promise<SupplierMessageResponseDto[]> {
    if (rows.length === 0) return [];
    const ids = [...new Set(rows.map((r) => r.createdBy))];
    const users = await this.prisma.user.findMany({
      where: { id: { in: ids }, organizationId: rows[0]!.organizationId },
      select: { id: true, fullName: true },
    });
    const nameById = new Map(users.map((u) => [u.id, u.fullName]));
    return rows.map((r) => ({
      id: r.id,
      organizationId: r.organizationId,
      supplierId: r.supplierId,
      authorType: r.authorType,
      body: r.body,
      createdBy: r.createdBy,
      authorName: nameById.get(r.createdBy) ?? null,
      createdAt: r.createdAt,
    }));
  }

  async listSubmissions(
    organizationId: string,
    supplierId?: string,
  ): Promise<SupplierSubmissionResponseDto[]> {
    const rows = await this.prisma.supplierSubmission.findMany({
      where: {
        organizationId,
        ...(supplierId ? { supplierId } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    return this.toSubmissionDtos(rows);
  }

  async approveSubmission(
    id: string,
    user: AuthUser,
  ): Promise<SupplierSubmissionResponseDto> {
    this.assertStaff(user);
    const row = await this.findSubmissionOrThrow(id, user.organizationId);
    if (row.status === SupplierSubmissionStatus.APPROVED) {
      throw new BadRequestException('Submission already approved');
    }
    this.assertCreatorNotActor(row.createdBy, user, 'approve');
    const updated = await this.prisma.supplierSubmission.update({
      where: { id },
      data: {
        status: SupplierSubmissionStatus.APPROVED,
        approvedBy: user.id,
        approvedAt: new Date(),
        rejectedReason: null,
      },
    });
    await this.audit.record({
      organizationId: user.organizationId,
      actorId: user.id,
      action: 'supplier.submission.approved',
      resourceType: 'SupplierSubmission',
      resourceId: id,
      after: updated,
    });
    return (await this.toSubmissionDtos([updated]))[0]!;
  }

  async rejectSubmission(
    id: string,
    dto: RejectSupplierSubmissionDto,
    user: AuthUser,
  ): Promise<SupplierSubmissionResponseDto> {
    this.assertStaff(user);
    const row = await this.findSubmissionOrThrow(id, user.organizationId);
    if (row.status === SupplierSubmissionStatus.REJECTED) {
      throw new BadRequestException('Submission already rejected');
    }
    this.assertCreatorNotActor(row.createdBy, user, 'reject');
    const updated = await this.prisma.supplierSubmission.update({
      where: { id },
      data: {
        status: SupplierSubmissionStatus.REJECTED,
        rejectedReason: dto.reason.trim(),
      },
    });
    await this.audit.record({
      organizationId: user.organizationId,
      actorId: user.id,
      action: 'supplier.submission.rejected',
      resourceType: 'SupplierSubmission',
      resourceId: id,
      after: { ...updated, rejectedReason: dto.reason },
    });
    return (await this.toSubmissionDtos([updated]))[0]!;
  }

  async markSubmissionPaid(
    id: string,
    user: AuthUser,
  ): Promise<SupplierSubmissionResponseDto> {
    this.assertStaff(user);
    const row = await this.findSubmissionOrThrow(id, user.organizationId);
    if (row.status !== SupplierSubmissionStatus.APPROVED) {
      throw new BadRequestException({
        error: 'NOT_APPROVED',
        message: 'Approve the invoice or payment request before marking paid',
      });
    }
    if (
      row.kind !== SupplierSubmissionKind.INVOICE &&
      row.kind !== SupplierSubmissionKind.PAYMENT_REQUEST
    ) {
      throw new BadRequestException({
        error: 'NOT_PAYABLE',
        message: 'Only invoices and payment requests can be marked paid',
      });
    }
    if (row.paymentStatus === SupplierPaymentStatus.PAID) {
      throw new BadRequestException('Already marked paid');
    }
    const updated = await this.prisma.supplierSubmission.update({
      where: { id },
      data: {
        paymentStatus: SupplierPaymentStatus.PAID,
        paidAt: new Date(),
      },
    });
    await this.audit.record({
      organizationId: user.organizationId,
      actorId: user.id,
      action: 'supplier.submission.paid',
      resourceType: 'SupplierSubmission',
      resourceId: id,
      after: updated,
    });
    return (await this.toSubmissionDtos([updated]))[0]!;
  }

  private async updateProfile(
    id: string,
    dto: UpdateSupplierProfileDto,
    user: AuthUser,
    via: 'portal' | 'staff',
  ): Promise<SupplierResponseDto> {
    const supplier = await this.findOrThrow(id, user.organizationId);
    const updated = await this.prisma.supplier.update({
      where: { id: supplier.id },
      data: {
        ...(dto.name != null ? { name: dto.name.trim() } : {}),
        ...(dto.email !== undefined ? { email: dto.email?.trim() || null } : {}),
        ...(dto.phone !== undefined ? { phone: dto.phone?.trim() || null } : {}),
        ...(dto.tin !== undefined ? { tin: dto.tin?.trim() || null } : {}),
        ...(dto.vrn !== undefined ? { vrn: dto.vrn?.trim() || null } : {}),
        ...(dto.address !== undefined
          ? { address: dto.address?.trim() || null }
          : {}),
        ...(dto.category != null ? { category: dto.category } : {}),
        ...(dto.bankName !== undefined
          ? { bankName: dto.bankName?.trim() || null }
          : {}),
        ...(dto.bankAccountName !== undefined
          ? { bankAccountName: dto.bankAccountName?.trim() || null }
          : {}),
        ...(dto.bankAccountRef !== undefined
          ? { bankAccountRef: dto.bankAccountRef?.trim() || null }
          : {}),
        ...(dto.mobileMoneyProvider !== undefined
          ? { mobileMoneyProvider: dto.mobileMoneyProvider?.trim() || null }
          : {}),
        ...(dto.mobileMoneyRef !== undefined
          ? { mobileMoneyRef: dto.mobileMoneyRef?.trim() || null }
          : {}),
        ...(dto.contactPerson !== undefined
          ? { contactPerson: dto.contactPerson?.trim() || null }
          : {}),
        ...(dto.contactPhone !== undefined
          ? { contactPhone: dto.contactPhone?.trim() || null }
          : {}),
        ...(dto.contactEmail !== undefined
          ? { contactEmail: dto.contactEmail?.trim() || null }
          : {}),
      },
    });
    await this.audit.record({
      organizationId: user.organizationId,
      actorId: user.id,
      action: 'supplier.updated',
      resourceType: 'Supplier',
      resourceId: supplier.id,
      after: { ...updated, via },
    });
    return this.toDto(updated);
  }

  private assertStaff(user: AuthUser) {
    if (user.supplierId) {
      throw new ForbiddenException({
        error: 'SUPPLIER_SCOPE_DENIED',
        message: 'Supplier portal users cannot perform this staff action',
      });
    }
  }

  private assertCreatorNotActor(
    createdBy: string | null,
    user: AuthUser,
    verb: string,
  ) {
    if (
      createdBy &&
      createdBy === user.id &&
      !user.roles.includes('SUPER_ADMIN')
    ) {
      throw new ForbiddenException({
        error: 'CREATOR_CANNOT_APPROVE',
        message: `The officer who created this record cannot ${verb} it`,
      });
    }
  }

  private async findOrThrow(id: string, organizationId: string) {
    const supplier = await this.prisma.supplier.findFirst({
      where: { id, organizationId },
    });
    if (!supplier) throw new NotFoundException('Supplier not found');
    return supplier;
  }

  private async findSubmissionOrThrow(id: string, organizationId: string) {
    const row = await this.prisma.supplierSubmission.findFirst({
      where: { id, organizationId },
    });
    if (!row) throw new NotFoundException('Submission not found');
    return row;
  }

  private async nextSubmissionNumber(
    organizationId: string,
    kind: SupplierSubmissionKind,
  ): Promise<string> {
    const prefix =
      kind === SupplierSubmissionKind.QUOTATION
        ? 'QT'
        : kind === SupplierSubmissionKind.INVOICE
          ? 'SINV'
          : kind === SupplierSubmissionKind.DELIVERY_NOTE
            ? 'DN'
            : 'PRQ';
    const count = await this.prisma.supplierSubmission.count({
      where: { organizationId, kind },
    });
    return `${prefix}-${String(count + 1).padStart(5, '0')}`;
  }

  private async toSubmissionDtos(
    rows: Array<{
      id: string;
      organizationId: string;
      supplierId: string;
      purchaseOrderId: string | null;
      referenceNumber: string;
      kind: SupplierSubmissionKind;
      status: SupplierSubmissionStatus;
      title: string;
      description: string | null;
      amount: Prisma.Decimal | null;
      currency: string;
      paymentStatus: SupplierPaymentStatus;
      rejectedReason: string | null;
      approvedBy: string | null;
      approvedAt: Date | null;
      paidAt: Date | null;
      createdBy: string;
      createdAt: Date;
    }>,
  ): Promise<SupplierSubmissionResponseDto[]> {
    if (rows.length === 0) return [];
    const supplierIds = [...new Set(rows.map((r) => r.supplierId))];
    const poIds = [
      ...new Set(
        rows.map((r) => r.purchaseOrderId).filter((id): id is string => !!id),
      ),
    ];
    const [suppliers, pos] = await Promise.all([
      this.prisma.supplier.findMany({
        where: { id: { in: supplierIds } },
        select: { id: true, code: true, name: true },
      }),
      poIds.length
        ? this.prisma.purchaseOrder.findMany({
            where: { id: { in: poIds } },
            select: { id: true, poNumber: true },
          })
        : Promise.resolve([]),
    ]);
    const supplierById = new Map(suppliers.map((s) => [s.id, s]));
    const poById = new Map(pos.map((p) => [p.id, p]));
    return rows.map((r) => {
      const s = supplierById.get(r.supplierId);
      const po = r.purchaseOrderId ? poById.get(r.purchaseOrderId) : undefined;
      return this.toSubmissionDto(r, {
        supplierCode: s?.code ?? null,
        supplierName: s?.name ?? null,
        poNumber: po?.poNumber ?? null,
      });
    });
  }

  private toSubmissionDto(
    r: {
      id: string;
      organizationId: string;
      supplierId: string;
      purchaseOrderId: string | null;
      referenceNumber: string;
      kind: SupplierSubmissionKind;
      status: SupplierSubmissionStatus;
      title: string;
      description: string | null;
      amount: Prisma.Decimal | null;
      currency: string;
      paymentStatus: SupplierPaymentStatus;
      rejectedReason: string | null;
      approvedBy: string | null;
      approvedAt: Date | null;
      paidAt: Date | null;
      createdBy: string;
      createdAt: Date;
    },
    enrich?: {
      supplierCode?: string | null;
      supplierName?: string | null;
      poNumber?: string | null;
    },
  ): SupplierSubmissionResponseDto {
    return {
      id: r.id,
      organizationId: r.organizationId,
      supplierId: r.supplierId,
      supplierCode: enrich?.supplierCode ?? null,
      supplierName: enrich?.supplierName ?? null,
      purchaseOrderId: r.purchaseOrderId,
      poNumber: enrich?.poNumber ?? null,
      referenceNumber: r.referenceNumber,
      kind: r.kind,
      status: r.status,
      title: r.title,
      description: r.description,
      amount: r.amount != null ? Number(r.amount) : null,
      currency: r.currency,
      paymentStatus: r.paymentStatus,
      rejectedReason: r.rejectedReason,
      approvedBy: r.approvedBy,
      approvedAt: r.approvedAt,
      paidAt: r.paidAt,
      createdBy: r.createdBy,
      createdAt: r.createdAt,
    };
  }

  private toDto(s: {
    id: string;
    organizationId: string;
    code: string;
    name: string;
    email: string | null;
    phone: string | null;
    tin: string | null;
    vrn?: string | null;
    address: string | null;
    category?: SupplierCategory;
    bankName?: string | null;
    bankAccountName?: string | null;
    bankAccountRef?: string | null;
    mobileMoneyProvider?: string | null;
    mobileMoneyRef?: string | null;
    contactPerson?: string | null;
    contactPhone?: string | null;
    contactEmail?: string | null;
    status: SupplierStatus;
    rejectedReason?: string | null;
    approvedBy?: string | null;
    approvedAt?: Date | null;
    createdBy?: string | null;
    createdAt: Date;
  }): SupplierResponseDto {
    return {
      id: s.id,
      organizationId: s.organizationId,
      code: s.code,
      name: s.name,
      email: s.email,
      phone: s.phone,
      tin: s.tin,
      vrn: s.vrn ?? null,
      address: s.address,
      category: s.category ?? SupplierCategory.GOODS,
      bankName: s.bankName ?? null,
      bankAccountName: s.bankAccountName ?? null,
      bankAccountRef: s.bankAccountRef ?? null,
      mobileMoneyProvider: s.mobileMoneyProvider ?? null,
      mobileMoneyRef: s.mobileMoneyRef ?? null,
      contactPerson: s.contactPerson ?? null,
      contactPhone: s.contactPhone ?? null,
      contactEmail: s.contactEmail ?? null,
      status: s.status,
      rejectedReason: s.rejectedReason ?? null,
      approvedBy: s.approvedBy ?? null,
      approvedAt: s.approvedAt ?? null,
      createdBy: s.createdBy ?? null,
      createdAt: s.createdAt,
    };
  }
}

function nextSupplierCode(companyName: string): string {
  const slug = companyName
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '')
    .slice(0, 6);
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `SUP-${slug || 'NEW'}-${rand}`;
}
