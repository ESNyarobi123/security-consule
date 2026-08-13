import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  InvoiceStatus,
  NotificationChannel,
  PayrollCycleStatus,
  PayrollDueAlertStatus,
  PayrollTenantType,
  Prisma,
} from '@prisma/client';
import { AuditService } from '@pssms/audit';
import { NotificationsService } from '@pssms/notifications';
import { AuthUser, PrismaService } from '@pssms/shared';
import {
  GrantPayrollPayExceptionDto,
  PayrollDueAlertResponseDto,
  PayrollDueScanResultDto,
  PayrollInvoiceGateDto,
} from '../presentation/dto/payroll-due.dto';

const BLOCKING_INVOICE_STATUSES: InvoiceStatus[] = [
  InvoiceStatus.SENT,
  InvoiceStatus.PARTIALLY_PAID,
  InvoiceStatus.OVERDUE,
  InvoiceStatus.DISPUTED,
];

const PAYROLL_RESOURCE = 'PayrollCycle';

@Injectable()
export class PayrollDueService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
  ) {}

  /**
   * Module 20-A — customer payroll disbursement is blocked unless the related
   * billing invoice is fully paid, or a GM/CEO/CMD/SUPER_ADMIN exception is recorded.
   */
  async assertCustomerPayrollPayAllowed(
    cycle: {
      id: string;
      tenantType: PayrollTenantType;
      customerId: string | null;
      billingInvoiceId: string | null;
      organizationId: string;
    },
    user: AuthUser,
  ): Promise<PayrollInvoiceGateDto> {
    if (cycle.tenantType !== PayrollTenantType.CUSTOMER_MANAGED_PAYROLL) {
      return { eligible: true };
    }
    if (!cycle.customerId) {
      throw new BadRequestException('CUSTOMER_REQUIRED_FOR_CUSTOMER_PAYROLL');
    }

    const gate = await this.evaluateInvoiceGate(
      cycle.customerId,
      cycle.organizationId,
      cycle.billingInvoiceId,
    );

    if (gate.eligible) return gate;

    const exception = await this.findActiveException(cycle.id, user.organizationId);
    if (exception) {
      return { ...gate, eligible: true, exceptionApproved: true };
    }

    throw new ForbiddenException({
      error: gate.blockedCode ?? 'INVOICE_NOT_FULLY_PAID',
      message:
        gate.blockedReason ??
        'Customer payroll cannot be paid until the related invoice is fully paid',
      invoiceNumber: gate.invoiceNumber,
      invoiceStatus: gate.invoiceStatus,
    });
  }

  async getGateForCycle(
    cycleId: string,
    user: AuthUser,
  ): Promise<PayrollInvoiceGateDto> {
    const cycle = await this.prisma.payrollCycle.findFirst({
      where: { id: cycleId, organizationId: user.organizationId },
    });
    if (!cycle) throw new NotFoundException('Payroll cycle not found');
    if (cycle.tenantType !== PayrollTenantType.CUSTOMER_MANAGED_PAYROLL) {
      return { eligible: true };
    }
    const gate = await this.evaluateInvoiceGate(
      cycle.customerId!,
      user.organizationId,
      cycle.billingInvoiceId,
    );
    if (gate.eligible) return gate;
    const exception = await this.findActiveException(cycle.id, user.organizationId);
    if (exception) {
      return { ...gate, eligible: true, exceptionApproved: true };
    }
    return gate;
  }

  async grantPayException(
    cycleId: string,
    dto: GrantPayrollPayExceptionDto,
    user: AuthUser,
  ) {
    this.assertExceptionAuthority(user);
    const cycle = await this.prisma.payrollCycle.findFirst({
      where: { id: cycleId, organizationId: user.organizationId },
    });
    if (!cycle) throw new NotFoundException('Payroll cycle not found');
    if (cycle.tenantType !== PayrollTenantType.CUSTOMER_MANAGED_PAYROLL) {
      throw new BadRequestException('EXCEPTION_ONLY_FOR_CUSTOMER_PAYROLL');
    }
    if (cycle.status === PayrollCycleStatus.PAID) {
      throw new BadRequestException('CYCLE_ALREADY_PAID');
    }

    await this.audit.record({
      organizationId: user.organizationId,
      actorId: user.id,
      action: 'payroll.pay_exception.granted',
      resourceType: PAYROLL_RESOURCE,
      resourceId: cycleId,
      after: {
        reason: dto.reason ?? 'Management exception — unpaid invoice',
        grantedBy: user.fullName,
      },
    });

    return this.getGateForCycle(cycleId, user);
  }

  async listAlerts(
    organizationId: string,
    filters?: { customerId?: string; status?: PayrollDueAlertStatus },
  ): Promise<PayrollDueAlertResponseDto[]> {
    const rows = await this.prisma.payrollDueAlert.findMany({
      where: {
        organizationId,
        ...(filters?.customerId ? { customerId: filters.customerId } : {}),
        ...(filters?.status ? { status: filters.status } : {}),
      },
      orderBy: { dueDate: 'desc' },
      take: 100,
    });
    return this.enrichAlerts(rows);
  }

  async listAlertsForCustomerPortal(user: AuthUser) {
    if (!user.customerId) {
      throw new ForbiddenException('Customer portal scope required');
    }
    return this.listAlerts(user.organizationId, { customerId: user.customerId });
  }

  /**
   * Due on the 1st of the month following the payroll period, only if the
   * related invoice is fully paid. Idempotent per cycle + due date.
   */
  async scanDueAlerts(
    organizationId: string,
    actor: AuthUser,
    opts?: { asOf?: Date; force?: boolean },
  ): Promise<PayrollDueScanResultDto> {
    const asOf = opts?.asOf ?? new Date();
    const today = startOfDay(asOf);

    const cycles = await this.prisma.payrollCycle.findMany({
      where: {
        organizationId,
        tenantType: PayrollTenantType.CUSTOMER_MANAGED_PAYROLL,
        status: {
          in: [
            PayrollCycleStatus.CALCULATED,
            PayrollCycleStatus.PENDING_APPROVAL,
            PayrollCycleStatus.APPROVED,
          ],
        },
      },
    });

    let alertsCreated = 0;
    let notificationsQueued = 0;
    let skippedUnpaid = 0;
    let skippedAlreadyPaid = 0;

    for (const cycle of cycles) {
      if (!cycle.customerId) continue;
      const dueDate = firstOfNextMonth(cycle.periodEnd);
      if (!opts?.force && dueDate.getTime() > today.getTime()) continue;

      const gate = await this.evaluateInvoiceGate(
        cycle.customerId,
        organizationId,
        cycle.billingInvoiceId,
      );
      if (!gate.eligible) {
        skippedUnpaid += 1;
        continue;
      }

      const payslips = await this.prisma.payslipSnapshot.findMany({
        where: { cycleId: cycle.id },
        select: { netPay: true, employeeName: true },
      });
      if (payslips.length === 0) continue;

      const payrollMonth = cycle.periodStart.toISOString().slice(0, 7);
      const idempotencyKey = `epayroll-due-${cycle.id}-${dueDate.toISOString().slice(0, 10)}`;
      const existing = await this.prisma.payrollDueAlert.findUnique({
        where: { idempotencyKey },
      });
      if (existing) {
        skippedAlreadyPaid += 1;
        continue;
      }

      const customer = await this.prisma.customer.findFirst({
        where: { id: cycle.customerId, organizationId },
        select: {
          id: true,
          name: true,
          code: true,
          billingEmail: true,
          opsEmail: true,
          email: true,
          accountManagerName: true,
        },
      });
      if (!customer) continue;

      const officer = cycle.reviewedBy
        ? await this.prisma.user.findFirst({
            where: { id: cycle.reviewedBy },
            select: { id: true, fullName: true, email: true },
          })
        : await this.prisma.user.findFirst({
            where: { organizationId, email: 'payroll1@highlink.co.tz' },
            select: { id: true, fullName: true, email: true },
          });

      const portionDue = payslips.reduce((s, p) => s + Number(p.netPay), 0);
      const employeeNames = payslips.map((p) => p.employeeName).join(', ');

      const alert = await this.prisma.payrollDueAlert.create({
        data: {
          organizationId,
          customerId: cycle.customerId,
          payrollCycleId: cycle.id,
          invoiceId: gate.invoiceId,
          invoiceNumber: gate.invoiceNumber,
          payrollMonth,
          invoiceAmountPaid: new Prisma.Decimal(gate.amountPaid ?? 0),
          employeesCovered: payslips.length,
          payrollPortionDue: new Prisma.Decimal(portionDue),
          currency: 'TZS',
          dueDate,
          invoicePaymentStatus: gate.invoiceStatus ?? 'PAID',
          payrollApprovalStatus: cycle.status,
          payrollPaymentStatus: cycle.status === PayrollCycleStatus.PAID ? 'PAID' : 'UNPAID',
          responsibleOfficerId: officer?.id,
          responsibleOfficerName:
            officer?.fullName ?? customer.accountManagerName ?? 'Payroll officer',
          status: PayrollDueAlertStatus.DUE,
          notifiedAt: new Date(),
          idempotencyKey,
          createdBy: actor.id,
        },
      });
      alertsCreated += 1;

      const recipients = [
        officer?.email,
        customer.billingEmail,
        customer.opsEmail,
        'payroll1@highlink.co.tz',
      ].filter((e): e is string => Boolean(e?.trim()));
      const uniqueRecipients = [...new Set(recipients.map((e) => e.trim().toLowerCase()))];

      const body = [
        `Customer: ${customer.name} (${customer.code})`,
        `Invoice: ${gate.invoiceNumber ?? '—'}`,
        `Payroll month: ${payrollMonth}`,
        `Amount paid (invoice): ${gate.amountPaid ?? 0} TZS`,
        `Employees covered (${payslips.length}): ${employeeNames}`,
        `Payroll portion due: ${portionDue} TZS`,
        `Due date: ${dueDate.toISOString().slice(0, 10)}`,
        `Invoice payment status: ${gate.invoiceStatus ?? 'PAID'}`,
        `Responsible officer: ${officer?.fullName ?? 'Payroll officer'}`,
        `Payroll approval status: ${cycle.status}`,
        '',
        'Process disbursement for this customer payroll cycle. Payment remains blocked until the invoice is fully paid unless a management exception is granted.',
      ].join('\n');

      for (const recipient of uniqueRecipients) {
        try {
          await this.notifications.enqueue(
            {
              channel: NotificationChannel.EMAIL,
              templateCode: 'EPAYROLL_DUE',
              recipient,
              subject: `E-payroll due — ${customer.code} ${payrollMonth} (${gate.invoiceNumber ?? cycle.cycleCode})`,
              body,
              resourceType: 'PayrollDueAlert',
              resourceId: alert.id,
              idempotencyKey: `${idempotencyKey}-${recipient}`,
            },
            actor,
          );
          notificationsQueued += 1;
        } catch (err) {
          const code =
            err && typeof err === 'object' && 'code' in err
              ? String((err as { code?: string }).code)
              : '';
          if (code !== 'P2002') throw err;
        }
      }

      await this.audit.record({
        organizationId,
        actorId: actor.id,
        action: 'payroll.due_alert.created',
        resourceType: 'PayrollDueAlert',
        resourceId: alert.id,
        after: {
          cycleId: cycle.id,
          customerId: cycle.customerId,
          invoiceNumber: gate.invoiceNumber,
          payrollMonth,
        },
      });
    }

    return {
      scanned: cycles.length,
      alertsCreated,
      notificationsQueued,
      skippedUnpaid,
      skippedAlreadyPaid,
    };
  }

  async evaluateInvoiceGate(
    customerId: string,
    organizationId: string,
    billingInvoiceId?: string | null,
  ): Promise<PayrollInvoiceGateDto> {
    const invoice = billingInvoiceId
      ? await this.prisma.invoice.findFirst({
          where: { id: billingInvoiceId, organizationId, customerId },
        })
      : await this.findRelatedPayrollInvoice(customerId, organizationId);

    if (!invoice) {
      return {
        eligible: false,
        blockedCode: 'PAYROLL_INVOICE_MISSING',
        blockedReason:
          'No related payroll service invoice found for this customer. Link a billing invoice or issue one before paying customer payroll.',
      };
    }

    const amountPaid = Number(invoice.amountPaid);
    const totalAmount = Number(invoice.totalAmount);
    const fullyPaid =
      invoice.status === InvoiceStatus.PAID && amountPaid >= totalAmount;

    if (invoice.status === InvoiceStatus.DISPUTED) {
      return {
        eligible: false,
        blockedCode: 'INVOICE_DISPUTED',
        blockedReason: `Invoice ${invoice.invoiceNumber} is disputed — payroll payment blocked unless management approves an exception`,
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        invoiceStatus: invoice.status,
        amountPaid,
        totalAmount,
      };
    }

    if (
      !fullyPaid ||
      BLOCKING_INVOICE_STATUSES.includes(invoice.status)
    ) {
      return {
        eligible: false,
        blockedCode: 'INVOICE_NOT_FULLY_PAID',
        blockedReason: `Invoice ${invoice.invoiceNumber} is ${invoice.status} (paid ${amountPaid} of ${totalAmount}). Customer payroll is due only when the invoice is fully paid.`,
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        invoiceStatus: invoice.status,
        amountPaid,
        totalAmount,
      };
    }

    return {
      eligible: true,
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      invoiceStatus: invoice.status,
      amountPaid,
      totalAmount,
    };
  }

  private async findRelatedPayrollInvoice(
    customerId: string,
    organizationId: string,
  ) {
    const contracts = await this.prisma.contract.findMany({
      where: {
        organizationId,
        customerId,
        OR: [
          { serviceType: 'CUSTOMER_PAYROLL' },
          { serviceTypes: { has: 'CUSTOMER_PAYROLL' } },
        ],
      },
      select: { id: true },
    });
    const contractIds = contracts.map((c) => c.id);

    if (contractIds.length > 0) {
      const linked = await this.prisma.invoice.findFirst({
        where: {
          organizationId,
          customerId,
          contractId: { in: contractIds },
          status: { not: InvoiceStatus.VOIDED },
        },
        orderBy: { issueDate: 'desc' },
      });
      if (linked) return linked;
    }

    return this.prisma.invoice.findFirst({
      where: {
        organizationId,
        customerId,
        notes: { contains: 'PAYROLL', mode: 'insensitive' },
        status: { not: InvoiceStatus.VOIDED },
      },
      orderBy: { issueDate: 'desc' },
    });
  }

  private async findActiveException(cycleId: string, organizationId: string) {
    return this.prisma.auditLog.findFirst({
      where: {
        organizationId,
        resourceType: PAYROLL_RESOURCE,
        resourceId: cycleId,
        action: 'payroll.pay_exception.granted',
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  private assertExceptionAuthority(user: AuthUser) {
    const allowed = ['SUPER_ADMIN', 'GENERAL_MANAGER', 'CEO', 'CMD'];
    if (!user.roles.some((r) => allowed.includes(r))) {
      throw new ForbiddenException({
        error: 'PAYROLL_EXCEPTION_DENIED',
        message:
          'Only GM, CEO, CMD or Super Admin may grant an unpaid-invoice payroll exception',
      });
    }
  }

  private async enrichAlerts(
    rows: Array<{
      id: string;
      organizationId: string;
      customerId: string;
      payrollCycleId: string;
      invoiceId: string | null;
      invoiceNumber: string | null;
      payrollMonth: string;
      invoiceAmountPaid: Prisma.Decimal;
      employeesCovered: number;
      payrollPortionDue: Prisma.Decimal;
      currency: string;
      dueDate: Date;
      invoicePaymentStatus: string;
      payrollApprovalStatus: string;
      payrollPaymentStatus: string;
      responsibleOfficerId: string | null;
      responsibleOfficerName: string | null;
      status: PayrollDueAlertStatus;
      notifiedAt: Date | null;
      createdAt: Date;
    }>,
  ): Promise<PayrollDueAlertResponseDto[]> {
    const customerIds = [...new Set(rows.map((r) => r.customerId))];
    const cycleIds = [...new Set(rows.map((r) => r.payrollCycleId))];
    const [customers, cycles] = await Promise.all([
      this.prisma.customer.findMany({
        where: { id: { in: customerIds } },
        select: { id: true, name: true, code: true },
      }),
      this.prisma.payrollCycle.findMany({
        where: { id: { in: cycleIds } },
        select: { id: true, cycleCode: true },
      }),
    ]);
    const customerMap = new Map(customers.map((c) => [c.id, c]));
    const cycleMap = new Map(cycles.map((c) => [c.id, c]));

    return rows.map((r) => ({
      id: r.id,
      organizationId: r.organizationId,
      customerId: r.customerId,
      customerName: customerMap.get(r.customerId)?.name,
      customerCode: customerMap.get(r.customerId)?.code,
      payrollCycleId: r.payrollCycleId,
      cycleCode: cycleMap.get(r.payrollCycleId)?.cycleCode,
      invoiceId: r.invoiceId,
      invoiceNumber: r.invoiceNumber,
      payrollMonth: r.payrollMonth,
      invoiceAmountPaid: Number(r.invoiceAmountPaid),
      employeesCovered: r.employeesCovered,
      payrollPortionDue: Number(r.payrollPortionDue),
      currency: r.currency,
      dueDate: r.dueDate,
      invoicePaymentStatus: r.invoicePaymentStatus,
      payrollApprovalStatus: r.payrollApprovalStatus,
      payrollPaymentStatus: r.payrollPaymentStatus,
      responsibleOfficerId: r.responsibleOfficerId,
      responsibleOfficerName: r.responsibleOfficerName,
      status: r.status,
      notifiedAt: r.notifiedAt,
      createdAt: r.createdAt,
    }));
  }
}

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function firstOfNextMonth(periodEnd: Date) {
  const d = new Date(periodEnd);
  d.setDate(1);
  d.setMonth(d.getMonth() + 1);
  d.setHours(0, 0, 0, 0);
  return d;
}
