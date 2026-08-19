import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  BreachSeverity,
  BreachStatus,
  ConsentChannel,
  ConsentLawfulBasis,
  ConsentStatus,
  ConsentSubjectType,
  ContractStatus,
  IncidentSeverity,
  IncidentStatus,
  PolicyStatus,
  Prisma,
  RiskSeverity,
  RiskStatus,
} from '@prisma/client';
import { PrismaService, AuthUser } from '@pssms/shared';
import { AuditService } from '@pssms/audit';
import { ApprovalsService } from '@pssms/approvals';
import {
  CatalogOptionDto,
  CONSENT_PURPOSE_LABELS,
  CONSENT_PURPOSES,
  ConsentRecordResponseDto,
  CreateBreachDto,
  CreateConsentDto,
  CreatePolicyDto,
  CreateRiskDto,
  DataBreachCaseResponseDto,
  POLICY_CATEGORIES,
  POLICY_CATEGORY_LABELS,
  PolicyDocumentResponseDto,
  REGULATORY_FRAMEWORKS,
  REGULATORY_FRAMEWORK_LABELS,
  RISK_CATEGORIES,
  RISK_CATEGORY_LABELS,
  RejectPolicyDto,
  RiskRegisterItemResponseDto,
  UpdateBreachDto,
  UpdatePolicyDto,
  UpdateRiskDto,
  WithdrawConsentDto,
} from '../presentation/dto/compliance.dto';

const BREACH_NEXT: Record<BreachStatus, BreachStatus | null> = {
  [BreachStatus.REPORTED]: BreachStatus.INVESTIGATING,
  [BreachStatus.INVESTIGATING]: BreachStatus.CONTAINED,
  [BreachStatus.CONTAINED]: BreachStatus.CLOSED,
  [BreachStatus.CLOSED]: null,
};

const RISK_NEXT: Record<RiskStatus, RiskStatus[]> = {
  [RiskStatus.OPEN]: [RiskStatus.MITIGATING, RiskStatus.ACCEPTED, RiskStatus.CLOSED],
  [RiskStatus.MITIGATING]: [RiskStatus.ACCEPTED, RiskStatus.CLOSED, RiskStatus.OPEN],
  [RiskStatus.ACCEPTED]: [RiskStatus.MITIGATING, RiskStatus.CLOSED],
  [RiskStatus.CLOSED]: [],
};

const GOVERNANCE_ROLES = new Set([
  'INTERNAL_AUDITOR',
  'LEGAL',
  'CISO',
  'DPO',
  'COMPLIANCE_OFFICER',
  'SUPER_ADMIN',
  'GENERAL_MANAGER',
  'CEO',
  'CMD',
  'DEPARTMENT_HEAD',
]);

@Injectable()
export class ComplianceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly approvals: ApprovalsService,
  ) {}

  private assertGovernanceMonitor(user: AuthUser): void {
    if (
      user.permissions.includes('dpo.manage') ||
      user.permissions.includes('compliance.manage')
    ) {
      return;
    }
    if (user.roles.some((r) => GOVERNANCE_ROLES.has(r))) {
      return;
    }
    throw new ForbiddenException({
      error: 'GOVERNANCE_DESK_DENIED',
      message: 'IT helpdesk is not the Compliance / DPO / Audit desk',
    });
  }

  private assertCanMutateRisk(user: AuthUser): void {
    if (
      user.permissions.includes('compliance.manage') ||
      user.permissions.includes('dpo.manage')
    ) {
      return;
    }
    throw new ForbiddenException({
      error: 'RISK_MUTATE_DENIED',
      message: 'Only Compliance Officer / DPO / CISO may mutate the risk register',
    });
  }

  riskCatalogOptions(): {
    categories: CatalogOptionDto[];
    frameworks: CatalogOptionDto[];
    severities: CatalogOptionDto[];
    statuses: CatalogOptionDto[];
  } {
    const labelize = (value: string) =>
      value
        .split('_')
        .map((p) => p.charAt(0) + p.slice(1).toLowerCase())
        .join(' ');
    return {
      categories: RISK_CATEGORIES.map((value) => ({
        value,
        label: RISK_CATEGORY_LABELS[value],
      })),
      frameworks: REGULATORY_FRAMEWORKS.map((value) => ({
        value,
        label: REGULATORY_FRAMEWORK_LABELS[value],
      })),
      severities: Object.values(RiskSeverity).map((value) => ({
        value,
        label: labelize(value),
      })),
      statuses: Object.values(RiskStatus).map((value) => ({
        value,
        label: labelize(value),
      })),
    };
  }

  async reports(user: AuthUser) {
    this.assertGovernanceMonitor(user);
    const org = user.organizationId;
    const since = new Date();
    since.setDate(since.getDate() - 30);

    const [
      policies,
      openBreaches,
      consents,
      risks,
      auditEvents30d,
      loginRows,
      openIncidents,
      criticalIncidents,
      contracts,
    ] = await Promise.all([
      this.prisma.policyDocument.groupBy({
        by: ['status'],
        where: { organizationId: org },
        _count: { _all: true },
      }),
      this.prisma.dataBreachCase.count({
        where: { organizationId: org, status: { not: BreachStatus.CLOSED } },
      }),
      this.prisma.consentRecord.groupBy({
        by: ['status'],
        where: { organizationId: org },
        _count: { _all: true },
      }),
      this.prisma.riskRegisterItem.groupBy({
        by: ['status'],
        where: { organizationId: org },
        _count: { _all: true },
      }),
      this.prisma.auditLog.count({
        where: { organizationId: org, createdAt: { gte: since } },
      }),
      this.prisma.loginHistory.findMany({
        where: {
          createdAt: { gte: since },
          user: { organizationId: org },
        },
        select: { success: true },
      }),
      this.prisma.incident.count({
        where: {
          organizationId: org,
          status: { in: [IncidentStatus.OPEN, IncidentStatus.INVESTIGATING] },
        },
      }),
      this.prisma.incident.count({
        where: {
          organizationId: org,
          severity: IncidentSeverity.CRITICAL,
          status: { not: IncidentStatus.CLOSED },
        },
      }),
      this.prisma.contract.groupBy({
        by: ['status'],
        where: { organizationId: org },
        _count: { _all: true },
      }),
    ]);

    const policiesByStatus = Object.fromEntries(
      Object.values(PolicyStatus).map((s) => [s, 0]),
    ) as Record<string, number>;
    for (const row of policies) policiesByStatus[row.status] = row._count._all;

    const consentsByStatus = Object.fromEntries(
      Object.values(ConsentStatus).map((s) => [s, 0]),
    ) as Record<string, number>;
    for (const row of consents) consentsByStatus[row.status] = row._count._all;

    const risksByStatus = Object.fromEntries(
      Object.values(RiskStatus).map((s) => [s, 0]),
    ) as Record<string, number>;
    for (const row of risks) risksByStatus[row.status] = row._count._all;

    const contractsByStatus = Object.fromEntries(
      Object.values(ContractStatus).map((s) => [s, 0]),
    ) as Record<string, number>;
    for (const row of contracts) contractsByStatus[row.status] = row._count._all;

    const pack = {
      publishedPolicies: policiesByStatus.PUBLISHED ?? 0,
      policiesByStatus,
      openBreaches,
      activeConsents: consentsByStatus.ACTIVE ?? 0,
      consentsByStatus,
      openRisks: (risksByStatus.OPEN ?? 0) + (risksByStatus.MITIGATING ?? 0),
      risksByStatus,
      auditEvents30d,
      loginSuccess30d: loginRows.filter((r) => r.success).length,
      loginFailed30d: loginRows.filter((r) => !r.success).length,
      openIncidents,
      criticalIncidentsOpen: criticalIncidents,
      contractsByStatus,
      activeContracts:
        (contractsByStatus.ACTIVE ?? 0) + (contractsByStatus.EXPIRING ?? 0),
      generatedAt: new Date().toISOString(),
      notes: [
        'Live org-scoped counts. Incident mutate stays Branch Ops; IAM mutate stays Super Admin; contract edit stays CRM/Legal.',
        'IT_SUPPORT (it1@) is helpdesk — not this desk. DPIA / backup-DR evidence pack deferred.',
      ],
    };

    await this.audit.record({
      organizationId: org,
      actorId: user.id,
      action: 'compliance.reports.generated',
      resourceType: 'ComplianceReport',
      after: {
        openBreaches,
        openRisks: pack.openRisks,
        openIncidents,
      },
    });
    return pack;
  }

  async accessReview(user: AuthUser) {
    this.assertGovernanceMonitor(user);
    const rows = await this.prisma.loginHistory.findMany({
      where: { user: { organizationId: user.organizationId } },
      orderBy: { createdAt: 'desc' },
      take: 80,
      select: {
        id: true,
        success: true,
        ipAddress: true,
        userAgent: true,
        createdAt: true,
        user: { select: { email: true, fullName: true, isActive: true } },
      },
    });
    return {
      rows: rows.map((r) => ({
        id: r.id,
        email: r.user.email,
        fullName: r.user.fullName,
        isActive: r.user.isActive,
        success: r.success,
        ipAddress: r.ipAddress,
        userAgent: r.userAgent,
        createdAt: r.createdAt,
      })),
      notes: [
        'Read-only login history for this organization. Suspend / roles / MFA reset stay Super Admin (/superadmin/users).',
      ],
    };
  }

  async incidentMonitor(user: AuthUser) {
    this.assertGovernanceMonitor(user);
    const rows = await this.prisma.incident.findMany({
      where: { organizationId: user.organizationId },
      orderBy: { createdAt: 'desc' },
      take: 40,
      select: {
        id: true,
        incidentNumber: true,
        category: true,
        severity: true,
        status: true,
        title: true,
        occurredAt: true,
        createdAt: true,
      },
    });
    return {
      rows,
      notes: [
        'Read-only security incident reports. Investigate/close stays Branch Ops (/branch/incidents) — this portal does not grant incidents.manage.',
      ],
    };
  }

  // ── Policies ──────────────────────────────────────────────

  async listPolicies(
    organizationId: string,
  ): Promise<PolicyDocumentResponseDto[]> {
    const rows = await this.prisma.policyDocument.findMany({
      where: { organizationId },
      orderBy: { updatedAt: 'desc' },
    });
    return rows.map((r) => this.toPolicyDto(r));
  }

  async getPolicy(
    id: string,
    organizationId: string,
  ): Promise<PolicyDocumentResponseDto> {
    return this.toPolicyDto(await this.findPolicyOrThrow(id, organizationId));
  }

  async createPolicy(
    dto: CreatePolicyDto,
    user: AuthUser,
  ): Promise<PolicyDocumentResponseDto> {
    try {
      const row = await this.prisma.policyDocument.create({
        data: {
          organizationId: user.organizationId,
          code: dto.code.trim().toUpperCase(),
          title: dto.title.trim(),
          category: dto.category.trim(),
          summary: dto.summary?.trim() || null,
          body: dto.body,
          status: PolicyStatus.DRAFT,
          createdBy: user.id,
        },
      });

      await this.audit.record({
        organizationId: user.organizationId,
        actorId: user.id,
        action: 'policy.created',
        resourceType: 'PolicyDocument',
        resourceId: row.id,
        after: row,
      });

      return this.toPolicyDto(row);
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        throw new BadRequestException('Policy code already exists');
      }
      throw err;
    }
  }

  async updatePolicy(
    id: string,
    dto: UpdatePolicyDto,
    user: AuthUser,
  ): Promise<PolicyDocumentResponseDto> {
    const existing = await this.findPolicyOrThrow(id, user.organizationId);
    if (
      existing.status !== PolicyStatus.DRAFT &&
      existing.status !== PolicyStatus.REJECTED
    ) {
      throw new BadRequestException(
        'Only DRAFT or REJECTED policies can be edited',
      );
    }

    const updated = await this.prisma.policyDocument.update({
      where: { id },
      data: {
        ...(dto.title !== undefined ? { title: dto.title.trim() } : {}),
        ...(dto.category !== undefined
          ? { category: dto.category.trim() }
          : {}),
        ...(dto.summary !== undefined
          ? { summary: dto.summary?.trim() || null }
          : {}),
        ...(dto.body !== undefined ? { body: dto.body } : {}),
      },
    });

    await this.audit.record({
      organizationId: user.organizationId,
      actorId: user.id,
      action: 'policy.updated',
      resourceType: 'PolicyDocument',
      resourceId: id,
      before: existing,
      after: updated,
    });

    return this.toPolicyDto(updated);
  }

  async submitPolicy(
    id: string,
    user: AuthUser,
  ): Promise<PolicyDocumentResponseDto> {
    const existing = await this.findPolicyOrThrow(id, user.organizationId);
    if (
      existing.status !== PolicyStatus.DRAFT &&
      existing.status !== PolicyStatus.REJECTED
    ) {
      throw new BadRequestException(
        'Only DRAFT or REJECTED policies can be submitted',
      );
    }

    const approval = await this.approvals.start(
      {
        workflowCode: 'policy-change-approval',
        resourceType: 'PolicyDocument',
        resourceId: existing.id,
      },
      user,
    );

    const updated = await this.prisma.policyDocument.update({
      where: { id },
      data: {
        status: PolicyStatus.PENDING_APPROVAL,
        approvalInstanceId: approval.id,
      },
    });

    await this.audit.record({
      organizationId: user.organizationId,
      actorId: user.id,
      action: 'policy.submitted',
      resourceType: 'PolicyDocument',
      resourceId: id,
      after: updated,
    });

    return this.toPolicyDto(updated);
  }

  async approvePolicy(
    id: string,
    user: AuthUser,
  ): Promise<PolicyDocumentResponseDto> {
    const policy = await this.findPolicyOrThrow(id, user.organizationId);
    if (policy.status !== PolicyStatus.PENDING_APPROVAL) {
      throw new BadRequestException(
        'Only policies pending approval can be acted on',
      );
    }
    if (!policy.approvalInstanceId) {
      throw new BadRequestException('No approval instance');
    }

    const approval = await this.approvals.act(
      policy.approvalInstanceId,
      { decision: 'APPROVE' },
      user,
    );

    // Multi-step safe: publish only when workflow is fully APPROVED
    if (approval.status !== 'APPROVED') {
      await this.audit.record({
        organizationId: user.organizationId,
        actorId: user.id,
        action: 'policy.approval_step',
        resourceType: 'PolicyDocument',
        resourceId: id,
        after: {
          approvalStatus: approval.status,
          currentStepOrder: approval.currentStepOrder,
        },
      });
      return this.toPolicyDto(policy);
    }

    const updated = await this.prisma.policyDocument.update({
      where: { id },
      data: {
        status: PolicyStatus.PUBLISHED,
        publishedAt: new Date(),
        publishedBy: user.id,
      },
    });

    await this.audit.record({
      organizationId: user.organizationId,
      actorId: user.id,
      action: 'policy.published',
      resourceType: 'PolicyDocument',
      resourceId: id,
      after: updated,
    });

    return this.toPolicyDto(updated);
  }

  async rejectPolicy(
    id: string,
    dto: RejectPolicyDto,
    user: AuthUser,
  ): Promise<PolicyDocumentResponseDto> {
    const policy = await this.findPolicyOrThrow(id, user.organizationId);
    if (policy.status !== PolicyStatus.PENDING_APPROVAL) {
      throw new BadRequestException(
        'Only policies pending approval can be rejected',
      );
    }

    if (policy.approvalInstanceId) {
      await this.approvals.act(
        policy.approvalInstanceId,
        { decision: 'REJECT', remarks: dto.reason },
        user,
      );
    }

    const updated = await this.prisma.policyDocument.update({
      where: { id },
      data: { status: PolicyStatus.REJECTED },
    });

    await this.audit.record({
      organizationId: user.organizationId,
      actorId: user.id,
      action: 'policy.rejected',
      resourceType: 'PolicyDocument',
      resourceId: id,
      after: { ...updated, rejectedReason: dto.reason },
    });

    return this.toPolicyDto(updated);
  }

  async archivePolicy(
    id: string,
    user: AuthUser,
  ): Promise<PolicyDocumentResponseDto> {
    const policy = await this.findPolicyOrThrow(id, user.organizationId);
    if (policy.status !== PolicyStatus.PUBLISHED) {
      throw new BadRequestException('Only PUBLISHED policies can be archived');
    }

    const updated = await this.prisma.policyDocument.update({
      where: { id },
      data: { status: PolicyStatus.ARCHIVED },
    });

    await this.audit.record({
      organizationId: user.organizationId,
      actorId: user.id,
      action: 'policy.archived',
      resourceType: 'PolicyDocument',
      resourceId: id,
      after: updated,
    });

    return this.toPolicyDto(updated);
  }

  // ── Data breaches (DPO register — not ops SECURITY_BREACH) ─

  /**
   * PII-sensitive: not every audit.read holder (e.g. IT_SUPPORT).
   * Allowed: dpo.manage / compliance.manage / CISO / GM / Super Admin /
   * Internal Auditor (audit.read + role).
   */
  private assertCanReadPiiRegister(
    user: AuthUser,
    error: string,
    message: string,
  ): void {
    if (
      user.permissions.includes('dpo.manage') ||
      user.permissions.includes('compliance.manage')
    ) {
      return;
    }
    if (
      user.roles.includes('INTERNAL_AUDITOR') &&
      user.permissions.includes('audit.read')
    ) {
      return;
    }
    if (
      user.roles.includes('LEGAL') ||
      user.roles.includes('CEO') ||
      user.roles.includes('CMD') ||
      user.roles.includes('CISO')
    ) {
      return;
    }
    if (
      user.roles.includes('SUPER_ADMIN') ||
      user.roles.includes('GENERAL_MANAGER')
    ) {
      return;
    }
    throw new ForbiddenException({ error, message });
  }

  private assertCanReadBreachRegister(user: AuthUser): void {
    this.assertCanReadPiiRegister(
      user,
      'BREACH_REGISTER_DENIED',
      'Not authorized to view the DPO data-breach register',
    );
  }

  async listBreaches(user: AuthUser): Promise<DataBreachCaseResponseDto[]> {
    this.assertCanReadBreachRegister(user);
    const rows = await this.prisma.dataBreachCase.findMany({
      where: { organizationId: user.organizationId },
      orderBy: { reportedAt: 'desc' },
    });
    return rows.map((r) => this.toBreachDto(r));
  }

  async getBreach(
    id: string,
    user: AuthUser,
  ): Promise<DataBreachCaseResponseDto> {
    this.assertCanReadBreachRegister(user);
    return this.toBreachDto(
      await this.findBreachOrThrow(id, user.organizationId),
    );
  }

  async createBreach(
    dto: CreateBreachDto,
    user: AuthUser,
  ): Promise<DataBreachCaseResponseDto> {
    const referenceCode = await this.nextBreachRef(user.organizationId);

    const row = await this.prisma.dataBreachCase.create({
      data: {
        organizationId: user.organizationId,
        referenceCode,
        title: dto.title.trim(),
        description: dto.description,
        severity: dto.severity,
        status: BreachStatus.REPORTED,
        discoveredAt: new Date(dto.discoveredAt),
        affectedDataCategories: dto.affectedDataCategories?.trim() || null,
        estimatedRecords: dto.estimatedRecords ?? null,
        createdBy: user.id,
      },
    });

    await this.audit.record({
      organizationId: user.organizationId,
      actorId: user.id,
      action: 'breach.reported',
      resourceType: 'DataBreachCase',
      resourceId: row.id,
      after: row,
    });

    return this.toBreachDto(row);
  }

  async updateBreach(
    id: string,
    dto: UpdateBreachDto,
    user: AuthUser,
  ): Promise<DataBreachCaseResponseDto> {
    const existing = await this.findBreachOrThrow(id, user.organizationId);

    if (existing.status === BreachStatus.CLOSED) {
      throw new BadRequestException('Closed breach cases cannot be updated');
    }

    if (dto.status !== undefined && dto.status !== existing.status) {
      const expected = BREACH_NEXT[existing.status];
      if (!expected || dto.status !== expected) {
        throw new BadRequestException(
          `Invalid status transition: ${existing.status} → ${dto.status}. ` +
            `Allowed next: ${expected ?? 'none'}`,
        );
      }
    }

    const nextStatus = dto.status ?? existing.status;
    const closing = nextStatus === BreachStatus.CLOSED;
    if (
      closing &&
      existing.createdBy === user.id &&
      !user.roles.includes('SUPER_ADMIN')
    ) {
      throw new ForbiddenException(
        'Reporter cannot close their own breach case (creator ≠ closer)',
      );
    }

    const updated = await this.prisma.dataBreachCase.update({
      where: { id },
      data: {
        ...(dto.status !== undefined ? { status: dto.status } : {}),
        ...(dto.containmentNotes !== undefined
          ? { containmentNotes: dto.containmentNotes }
          : {}),
        ...(dto.affectedDataCategories !== undefined
          ? {
              affectedDataCategories:
                dto.affectedDataCategories?.trim() || null,
            }
          : {}),
        ...(dto.estimatedRecords !== undefined
          ? { estimatedRecords: dto.estimatedRecords }
          : {}),
        ...(dto.title !== undefined ? { title: dto.title.trim() } : {}),
        ...(dto.description !== undefined
          ? { description: dto.description }
          : {}),
        ...(dto.severity !== undefined ? { severity: dto.severity } : {}),
        ...(closing
          ? { closedAt: new Date(), closedBy: user.id }
          : {}),
      },
    });

    await this.audit.record({
      organizationId: user.organizationId,
      actorId: user.id,
      action: closing ? 'breach.closed' : 'breach.updated',
      resourceType: 'DataBreachCase',
      resourceId: id,
      before: existing,
      after: updated,
    });

    return this.toBreachDto(updated);
  }

  // ── Consent records (Module 32-A) ─────────────────────────

  /**
   * Consent register is PII-sensitive — same role gate as breach register,
   * distinct error code for smoke/clients.
   */
  private assertCanReadConsentRegister(user: AuthUser): void {
    this.assertCanReadPiiRegister(
      user,
      'CONSENT_REGISTER_DENIED',
      'Not authorized to view the DPO consent register',
    );
  }

  policyCategoryOptions(): CatalogOptionDto[] {
    return POLICY_CATEGORIES.map((value) => ({
      value,
      label: POLICY_CATEGORY_LABELS[value],
    }));
  }

  consentCatalogOptions(): {
    purposes: CatalogOptionDto[];
    subjectTypes: CatalogOptionDto[];
    lawfulBases: CatalogOptionDto[];
    channels: CatalogOptionDto[];
  } {
    const labelize = (value: string) =>
      value
        .split('_')
        .map((p) => p.charAt(0) + p.slice(1).toLowerCase())
        .join(' ');
    return {
      purposes: CONSENT_PURPOSES.map((value) => ({
        value,
        label: CONSENT_PURPOSE_LABELS[value],
      })),
      subjectTypes: Object.values(ConsentSubjectType).map((value) => ({
        value,
        label: labelize(value),
      })),
      lawfulBases: Object.values(ConsentLawfulBasis).map((value) => ({
        value,
        label: labelize(value),
      })),
      channels: Object.values(ConsentChannel).map((value) => ({
        value,
        label: labelize(value),
      })),
    };
  }

  async listConsents(user: AuthUser): Promise<ConsentRecordResponseDto[]> {
    this.assertCanReadConsentRegister(user);
    const rows = await this.prisma.consentRecord.findMany({
      where: { organizationId: user.organizationId },
      orderBy: { grantedAt: 'desc' },
      take: 200,
    });
    const refreshed = await this.refreshExpiredConsents(rows, user.organizationId);
    const names = await this.userNames(
      user.organizationId,
      refreshed.flatMap((r) => [r.createdBy, r.withdrawnBy]),
    );
    return refreshed.map((r) => this.toConsentDto(r, names));
  }

  async createConsent(
    dto: CreateConsentDto,
    user: AuthUser,
  ): Promise<ConsentRecordResponseDto> {
    const grantedAt = new Date(dto.grantedAt);
    const expiresAt = dto.expiresAt ? new Date(dto.expiresAt) : null;
    if (expiresAt && expiresAt.getTime() <= grantedAt.getTime()) {
      throw new BadRequestException({
        error: 'INVALID_CONSENT_EXPIRY',
        message: 'expiresAt must be after grantedAt',
      });
    }

    const referenceCode = await this.nextConsentRef(user.organizationId);
    const row = await this.prisma.consentRecord.create({
      data: {
        organizationId: user.organizationId,
        referenceCode,
        subjectType: dto.subjectType,
        subjectName: dto.subjectName.trim(),
        subjectEmail: dto.subjectEmail?.trim().toLowerCase() || null,
        subjectRef: dto.subjectRef?.trim() || null,
        purpose: dto.purpose.trim(),
        lawfulBasis: dto.lawfulBasis,
        channel: dto.channel,
        status: ConsentStatus.ACTIVE,
        grantedAt,
        expiresAt,
        notes: dto.notes?.trim() || null,
        createdBy: user.id,
      },
    });

    await this.audit.record({
      organizationId: user.organizationId,
      actorId: user.id,
      action: 'consent.recorded',
      resourceType: 'ConsentRecord',
      resourceId: row.id,
      after: row,
    });

    const names = await this.userNames(user.organizationId, [user.id]);
    return this.toConsentDto(row, names);
  }

  async withdrawConsent(
    id: string,
    dto: WithdrawConsentDto,
    user: AuthUser,
  ): Promise<ConsentRecordResponseDto> {
    const existing = await this.findConsentOrThrow(id, user.organizationId);
    if (existing.status === ConsentStatus.WITHDRAWN) {
      throw new BadRequestException({
        error: 'CONSENT_ALREADY_WITHDRAWN',
        message: 'Consent record is already withdrawn',
      });
    }
    if (
      existing.status === ConsentStatus.EXPIRED ||
      (existing.expiresAt && existing.expiresAt.getTime() <= Date.now())
    ) {
      if (existing.status === ConsentStatus.ACTIVE && existing.expiresAt) {
        await this.prisma.consentRecord.update({
          where: { id },
          data: { status: ConsentStatus.EXPIRED },
        });
      }
      throw new BadRequestException({
        error: 'CONSENT_EXPIRED',
        message: 'Expired consent cannot be withdrawn — record a new consent if needed',
      });
    }

    const updated = await this.prisma.consentRecord.update({
      where: { id },
      data: {
        status: ConsentStatus.WITHDRAWN,
        withdrawnAt: new Date(),
        withdrawnBy: user.id,
        withdrawReason: dto.reason.trim(),
      },
    });

    await this.audit.record({
      organizationId: user.organizationId,
      actorId: user.id,
      action: 'consent.withdrawn',
      resourceType: 'ConsentRecord',
      resourceId: id,
      before: existing,
      after: updated,
    });

    const names = await this.userNames(user.organizationId, [
      updated.createdBy,
      updated.withdrawnBy,
    ]);
    return this.toConsentDto(updated, names);
  }

  // ── Risk register (Portal 35.21) ──────────────────────────

  async listRisks(user: AuthUser): Promise<RiskRegisterItemResponseDto[]> {
    this.assertGovernanceMonitor(user);
    const rows = await this.prisma.riskRegisterItem.findMany({
      where: { organizationId: user.organizationId },
      orderBy: { updatedAt: 'desc' },
      take: 200,
    });
    const names = await this.userNames(
      user.organizationId,
      rows.flatMap((r) => [r.createdBy, r.closedBy]),
    );
    return rows.map((r) => this.toRiskDto(r, names));
  }

  async createRisk(
    dto: CreateRiskDto,
    user: AuthUser,
  ): Promise<RiskRegisterItemResponseDto> {
    this.assertCanMutateRisk(user);
    const referenceCode = await this.nextRiskRef(user.organizationId);
    const row = await this.prisma.riskRegisterItem.create({
      data: {
        organizationId: user.organizationId,
        referenceCode,
        title: dto.title.trim(),
        description: dto.description.trim(),
        category: dto.category,
        severity: dto.severity as RiskSeverity,
        status: RiskStatus.OPEN,
        regulatoryRef: dto.regulatoryRef ?? null,
        mitigation: dto.mitigation?.trim() || null,
        createdBy: user.id,
      },
    });
    await this.audit.record({
      organizationId: user.organizationId,
      actorId: user.id,
      action: 'risk.recorded',
      resourceType: 'RiskRegisterItem',
      resourceId: row.id,
      after: row,
    });
    const names = await this.userNames(user.organizationId, [user.id]);
    return this.toRiskDto(row, names);
  }

  async updateRisk(
    id: string,
    dto: UpdateRiskDto,
    user: AuthUser,
  ): Promise<RiskRegisterItemResponseDto> {
    this.assertCanMutateRisk(user);
    const existing = await this.prisma.riskRegisterItem.findFirst({
      where: { id, organizationId: user.organizationId },
    });
    if (!existing) throw new NotFoundException('Risk not found');
    if (existing.status === RiskStatus.CLOSED) {
      throw new BadRequestException({ error: 'RISK_CLOSED_IMMUTABLE' });
    }
    if (dto.status && dto.status !== existing.status) {
      const allowed = RISK_NEXT[existing.status];
      if (!allowed.includes(dto.status as RiskStatus)) {
        throw new BadRequestException({
          error: 'INVALID_RISK_TRANSITION',
          message: `Allowed next: ${allowed.join(', ') || 'none'}`,
        });
      }
    }
    const closing = dto.status === RiskStatus.CLOSED;
    if (
      closing &&
      existing.createdBy === user.id &&
      !user.roles.includes('SUPER_ADMIN')
    ) {
      throw new ForbiddenException({
        error: 'CREATOR_CANNOT_CLOSE',
        message: 'Recorder cannot close their own risk (creator ≠ closer)',
      });
    }

    const updated = await this.prisma.riskRegisterItem.update({
      where: { id },
      data: {
        ...(dto.title !== undefined ? { title: dto.title.trim() } : {}),
        ...(dto.description !== undefined
          ? { description: dto.description.trim() }
          : {}),
        ...(dto.category !== undefined ? { category: dto.category } : {}),
        ...(dto.severity !== undefined
          ? { severity: dto.severity as RiskSeverity }
          : {}),
        ...(dto.regulatoryRef !== undefined
          ? { regulatoryRef: dto.regulatoryRef }
          : {}),
        ...(dto.mitigation !== undefined
          ? { mitigation: dto.mitigation?.trim() || null }
          : {}),
        ...(dto.residualNotes !== undefined
          ? { residualNotes: dto.residualNotes?.trim() || null }
          : {}),
        ...(dto.status !== undefined
          ? { status: dto.status as RiskStatus }
          : {}),
        ...(closing ? { closedAt: new Date(), closedBy: user.id } : {}),
      },
    });
    await this.audit.record({
      organizationId: user.organizationId,
      actorId: user.id,
      action: closing ? 'risk.closed' : 'risk.updated',
      resourceType: 'RiskRegisterItem',
      resourceId: id,
      before: existing,
      after: updated,
    });
    const names = await this.userNames(user.organizationId, [
      updated.createdBy,
      updated.closedBy,
    ]);
    return this.toRiskDto(updated, names);
  }

  private async refreshExpiredConsents<
    T extends {
      id: string;
      status: ConsentStatus;
      expiresAt: Date | null;
    },
  >(rows: T[], organizationId: string): Promise<T[]> {
    const now = Date.now();
    const expiredIds = rows
      .filter(
        (r) =>
          r.status === ConsentStatus.ACTIVE &&
          r.expiresAt &&
          r.expiresAt.getTime() <= now,
      )
      .map((r) => r.id);
    if (expiredIds.length === 0) return rows;

    await this.prisma.consentRecord.updateMany({
      where: {
        organizationId,
        id: { in: expiredIds },
        status: ConsentStatus.ACTIVE,
      },
      data: { status: ConsentStatus.EXPIRED },
    });

    return rows.map((r) =>
      expiredIds.includes(r.id)
        ? { ...r, status: ConsentStatus.EXPIRED }
        : r,
    );
  }

  private async userNames(
    organizationId: string,
    ids: Array<string | null | undefined>,
  ): Promise<Map<string, string>> {
    const unique = [...new Set(ids.filter((id): id is string => !!id))];
    if (unique.length === 0) return new Map();
    const users = await this.prisma.user.findMany({
      where: { organizationId, id: { in: unique } },
      select: { id: true, fullName: true },
    });
    return new Map(users.map((u) => [u.id, u.fullName]));
  }

  // ── Helpers ───────────────────────────────────────────────

  private async findPolicyOrThrow(id: string, organizationId: string) {
    const row = await this.prisma.policyDocument.findFirst({
      where: { id, organizationId },
    });
    if (!row) throw new NotFoundException('Policy not found');
    return row;
  }

  private async findBreachOrThrow(id: string, organizationId: string) {
    const row = await this.prisma.dataBreachCase.findFirst({
      where: { id, organizationId },
    });
    if (!row) throw new NotFoundException('Breach case not found');
    return row;
  }

  private async findConsentOrThrow(id: string, organizationId: string) {
    const row = await this.prisma.consentRecord.findFirst({
      where: { id, organizationId },
    });
    if (!row) throw new NotFoundException('Consent record not found');
    return row;
  }

  private async nextBreachRef(organizationId: string): Promise<string> {
    const last = await this.prisma.dataBreachCase.findFirst({
      where: { organizationId },
      orderBy: { referenceCode: 'desc' },
      select: { referenceCode: true },
    });
    const match = last?.referenceCode?.match(/(\d+)$/);
    const next = match ? Number(match[1]) + 1 : 1;
    return `BRCH-${String(Number.isFinite(next) ? next : 1).padStart(5, '0')}`;
  }

  private async nextConsentRef(organizationId: string): Promise<string> {
    const last = await this.prisma.consentRecord.findFirst({
      where: { organizationId },
      orderBy: { referenceCode: 'desc' },
      select: { referenceCode: true },
    });
    const match = last?.referenceCode?.match(/(\d+)$/);
    const next = match ? Number(match[1]) + 1 : 1;
    return `CNS-${String(Number.isFinite(next) ? next : 1).padStart(5, '0')}`;
  }

  private async nextRiskRef(organizationId: string): Promise<string> {
    const last = await this.prisma.riskRegisterItem.findFirst({
      where: { organizationId },
      orderBy: { referenceCode: 'desc' },
      select: { referenceCode: true },
    });
    const match = last?.referenceCode?.match(/(\d+)$/);
    const next = match ? Number(match[1]) + 1 : 1;
    return `RISK-${String(Number.isFinite(next) ? next : 1).padStart(5, '0')}`;
  }

  private toRiskDto(
    r: {
      id: string;
      organizationId: string;
      referenceCode: string;
      title: string;
      description: string;
      category: string;
      severity: RiskSeverity;
      status: RiskStatus;
      regulatoryRef: string | null;
      mitigation: string | null;
      residualNotes: string | null;
      ownerUserId: string | null;
      createdBy: string;
      closedBy: string | null;
      closedAt: Date | null;
      createdAt: Date;
      updatedAt: Date;
    },
    names?: Map<string, string>,
  ): RiskRegisterItemResponseDto {
    return {
      id: r.id,
      organizationId: r.organizationId,
      referenceCode: r.referenceCode,
      title: r.title,
      description: r.description,
      category: r.category,
      severity: r.severity,
      status: r.status,
      regulatoryRef: r.regulatoryRef,
      mitigation: r.mitigation,
      residualNotes: r.residualNotes,
      ownerUserId: r.ownerUserId,
      createdBy: r.createdBy,
      createdByName: names?.get(r.createdBy) ?? null,
      closedBy: r.closedBy,
      closedByName: r.closedBy ? names?.get(r.closedBy) ?? null : null,
      closedAt: r.closedAt,
      allowedNextStatuses: RISK_NEXT[r.status],
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    };
  }

  private toPolicyDto(r: {
    id: string;
    organizationId: string;
    code: string;
    title: string;
    category: string;
    summary: string | null;
    body: string;
    version: number;
    status: PolicyStatus;
    approvalInstanceId: string | null;
    createdBy: string;
    publishedAt: Date | null;
    publishedBy: string | null;
    createdAt: Date;
    updatedAt: Date;
  }): PolicyDocumentResponseDto {
    return {
      id: r.id,
      organizationId: r.organizationId,
      code: r.code,
      title: r.title,
      category: r.category,
      summary: r.summary,
      body: r.body,
      version: r.version,
      status: r.status,
      approvalInstanceId: r.approvalInstanceId,
      createdBy: r.createdBy,
      publishedAt: r.publishedAt,
      publishedBy: r.publishedBy,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    };
  }

  private toBreachDto(r: {
    id: string;
    organizationId: string;
    referenceCode: string;
    title: string;
    description: string;
    severity: BreachSeverity;
    status: BreachStatus;
    discoveredAt: Date;
    reportedAt: Date;
    affectedDataCategories: string | null;
    estimatedRecords: number | null;
    containmentNotes: string | null;
    closedAt: Date | null;
    closedBy: string | null;
    createdBy: string;
    createdAt: Date;
    updatedAt: Date;
  }): DataBreachCaseResponseDto {
    return {
      id: r.id,
      organizationId: r.organizationId,
      referenceCode: r.referenceCode,
      title: r.title,
      description: r.description,
      severity: r.severity,
      status: r.status,
      discoveredAt: r.discoveredAt,
      reportedAt: r.reportedAt,
      affectedDataCategories: r.affectedDataCategories,
      estimatedRecords: r.estimatedRecords,
      containmentNotes: r.containmentNotes,
      closedAt: r.closedAt,
      closedBy: r.closedBy,
      createdBy: r.createdBy,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    };
  }

  private toConsentDto(
    r: {
      id: string;
      organizationId: string;
      referenceCode: string;
      subjectType: ConsentSubjectType;
      subjectName: string;
      subjectEmail: string | null;
      subjectRef: string | null;
      purpose: string;
      lawfulBasis: ConsentLawfulBasis;
      channel: ConsentChannel;
      status: ConsentStatus;
      grantedAt: Date;
      expiresAt: Date | null;
      withdrawnAt: Date | null;
      withdrawnBy: string | null;
      withdrawReason: string | null;
      notes: string | null;
      createdBy: string;
      createdAt: Date;
      updatedAt: Date;
    },
    names?: Map<string, string>,
  ): ConsentRecordResponseDto {
    return {
      id: r.id,
      organizationId: r.organizationId,
      referenceCode: r.referenceCode,
      subjectType: r.subjectType,
      subjectName: r.subjectName,
      subjectEmail: r.subjectEmail,
      subjectRef: r.subjectRef,
      purpose: r.purpose,
      lawfulBasis: r.lawfulBasis,
      channel: r.channel,
      status: r.status,
      grantedAt: r.grantedAt,
      expiresAt: r.expiresAt,
      withdrawnAt: r.withdrawnAt,
      withdrawnBy: r.withdrawnBy,
      withdrawnByName: r.withdrawnBy
        ? names?.get(r.withdrawnBy) ?? null
        : null,
      withdrawReason: r.withdrawReason,
      notes: r.notes,
      createdBy: r.createdBy,
      createdByName: names?.get(r.createdBy) ?? null,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    };
  }
}
