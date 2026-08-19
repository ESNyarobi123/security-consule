import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  MarketingCommissionStatus,
  MarketingLeadStage,
  MarketingLeadSource,
  MarketingQuoteKind,
  MarketingQuoteStatus,
  MarketingSurveyStatus,
  Prisma,
} from '@prisma/client';
import { AuditService } from '@pssms/audit';
import { ContractsService } from '@pssms/contracts';
import { AuthUser, PrismaService } from '@pssms/shared';
import { CustomersService } from './customers.service';
import {
  CompleteMarketingSurveyDto,
  ConvertLeadContractDto,
  ConvertLeadCustomerDto,
  CreateMarketingCampaignDto,
  CreateMarketingLeadDto,
  CreateMarketingQuoteDto,
  CreateMarketingSurveyDto,
  LoseMarketingLeadDto,
  MARKETING_CHANNELS,
  MARKETING_QUOTE_KINDS,
  MARKETING_REFERRER_TYPES,
  MARKETING_SOURCES,
  MARKETING_STAGES,
  PatchMarketingLeadDto,
  PatchMarketingQuoteStatusDto,
  UpdateMarketingCampaignDto,
  WinMarketingLeadDto,
} from '../presentation/dto/marketing.dto';

const STAGE_NEXT: Record<MarketingLeadStage, MarketingLeadStage[]> = {
  [MarketingLeadStage.LEAD]: [
    MarketingLeadStage.QUALIFIED,
    MarketingLeadStage.SURVEY_SCHEDULED,
    MarketingLeadStage.QUOTED,
    MarketingLeadStage.LOST,
  ],
  [MarketingLeadStage.QUALIFIED]: [
    MarketingLeadStage.SURVEY_SCHEDULED,
    MarketingLeadStage.QUOTED,
    MarketingLeadStage.PROPOSAL,
    MarketingLeadStage.LOST,
  ],
  [MarketingLeadStage.SURVEY_SCHEDULED]: [
    MarketingLeadStage.SURVEY_DONE,
    MarketingLeadStage.QUOTED,
    MarketingLeadStage.LOST,
  ],
  [MarketingLeadStage.SURVEY_DONE]: [
    MarketingLeadStage.QUOTED,
    MarketingLeadStage.PROPOSAL,
    MarketingLeadStage.LOST,
  ],
  [MarketingLeadStage.QUOTED]: [
    MarketingLeadStage.PROPOSAL,
    MarketingLeadStage.WON,
    MarketingLeadStage.LOST,
  ],
  [MarketingLeadStage.PROPOSAL]: [
    MarketingLeadStage.WON,
    MarketingLeadStage.LOST,
  ],
  [MarketingLeadStage.WON]: [],
  [MarketingLeadStage.LOST]: [],
};

const STAGE_RANK: Record<MarketingLeadStage, number> = {
  [MarketingLeadStage.LEAD]: 0,
  [MarketingLeadStage.QUALIFIED]: 1,
  [MarketingLeadStage.SURVEY_SCHEDULED]: 2,
  [MarketingLeadStage.SURVEY_DONE]: 3,
  [MarketingLeadStage.QUOTED]: 4,
  [MarketingLeadStage.PROPOSAL]: 5,
  [MarketingLeadStage.WON]: 6,
  [MarketingLeadStage.LOST]: -1,
};

const QUOTE_NEXT: Partial<
  Record<MarketingQuoteStatus, MarketingQuoteStatus[]>
> = {
  [MarketingQuoteStatus.DRAFT]: [MarketingQuoteStatus.SENT],
  [MarketingQuoteStatus.SENT]: [
    MarketingQuoteStatus.ACCEPTED,
    MarketingQuoteStatus.REJECTED,
    MarketingQuoteStatus.EXPIRED,
  ],
};

function money(v: Prisma.Decimal | null | undefined): number | null {
  if (v == null) return null;
  return Number(v);
}

function ymd() {
  return new Date().toISOString().slice(0, 10).replace(/-/g, '');
}

function rand4() {
  return Math.random().toString(36).slice(2, 6).toUpperCase();
}

@Injectable()
export class MarketingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly customers: CustomersService,
    private readonly contracts: ContractsService,
  ) {}

  private assertStaff(user: AuthUser) {
    if (user.customerId || user.supplierId) {
      throw new ForbiddenException({
        error: 'MARKETING_STAFF_ONLY',
        message: 'Marketing pipeline is staff-only',
      });
    }
  }

  catalogs() {
    return {
      channels: [...MARKETING_CHANNELS],
      sources: [...MARKETING_SOURCES],
      stages: [...MARKETING_STAGES],
      referrerTypes: [...MARKETING_REFERRER_TYPES],
      quoteKinds: [...MARKETING_QUOTE_KINDS],
    };
  }

  async reports(user: AuthUser) {
    this.assertStaff(user);
    const org = user.organizationId;
    const [leads, campaigns, surveys, quotes, commissions] = await Promise.all([
      this.prisma.marketingLead.groupBy({
        by: ['stage'],
        where: { organizationId: org },
        _count: { _all: true },
      }),
      this.prisma.marketingCampaign.count({
        where: { organizationId: org, isActive: true },
      }),
      this.prisma.marketingSiteSurvey.groupBy({
        by: ['status'],
        where: { organizationId: org },
        _count: { _all: true },
      }),
      this.prisma.marketingQuote.groupBy({
        by: ['status'],
        where: { organizationId: org },
        _count: { _all: true },
      }),
      this.prisma.marketingCommission.findMany({
        where: { organizationId: org },
        select: { status: true, amount: true },
      }),
    ]);

    const byStage = Object.fromEntries(
      MARKETING_STAGES.map((s) => [s, 0]),
    ) as Record<string, number>;
    for (const row of leads) byStage[row.stage] = row._count._all;

    const openPipeline =
      byStage.LEAD +
      byStage.QUALIFIED +
      byStage.SURVEY_SCHEDULED +
      byStage.SURVEY_DONE +
      byStage.QUOTED +
      byStage.PROPOSAL;

    const pendingCommissionAmount = commissions
      .filter((c) => c.status === MarketingCommissionStatus.PENDING)
      .reduce((s, c) => s + Number(c.amount), 0);

    const pack = {
      byStage,
      openPipeline,
      won: byStage.WON,
      lost: byStage.LOST,
      activeCampaigns: campaigns,
      surveysScheduled:
        surveys.find((s) => s.status === MarketingSurveyStatus.SCHEDULED)
          ?._count._all ?? 0,
      quotesSent:
        quotes.find((q) => q.status === MarketingQuoteStatus.SENT)?._count
          ._all ?? 0,
      pendingCommissions: commissions.filter(
        (c) => c.status === MarketingCommissionStatus.PENDING,
      ).length,
      pendingCommissionAmount,
      generatedAt: new Date().toISOString(),
      notes: [
        'Live Prisma counts — not KPI forecasts.',
        'Commission PAID stays on Finance (35.15); this register is accrue-only.',
        'Contract conversion creates DRAFT only; Legal→GM→CEO→CMD on /approvals (creator ≠ approver).',
      ],
    };

    await this.audit.record({
      organizationId: org,
      actorId: user.id,
      action: 'marketing.reports.generated',
      resourceType: 'MarketingReport',
      after: { openPipeline: pack.openPipeline, won: pack.won },
    });
    return pack;
  }

  async listCampaigns(user: AuthUser) {
    this.assertStaff(user);
    const rows = await this.prisma.marketingCampaign.findMany({
      where: { organizationId: user.organizationId },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    return rows.map((r) => this.campaignDto(r));
  }

  async createCampaign(dto: CreateMarketingCampaignDto, user: AuthUser) {
    this.assertStaff(user);
    const code = (dto.code?.trim() || `CMPG-${ymd()}-${rand4()}`).toUpperCase();
    try {
      const row = await this.prisma.marketingCampaign.create({
        data: {
          organizationId: user.organizationId,
          code,
          name: dto.name.trim(),
          channel: dto.channel ?? 'OTHER',
          startsAt: dto.startsAt ? new Date(dto.startsAt) : null,
          endsAt: dto.endsAt ? new Date(dto.endsAt) : null,
          notes: dto.notes?.trim() || null,
          createdBy: user.id,
        },
      });
      await this.audit.record({
        organizationId: user.organizationId,
        actorId: user.id,
        action: 'marketing.campaign.created',
        resourceType: 'MarketingCampaign',
        resourceId: row.id,
        after: { code: row.code, name: row.name },
      });
      return this.campaignDto(row);
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        throw new ConflictException({ error: 'CAMPAIGN_CODE_IN_USE' });
      }
      throw err;
    }
  }

  async updateCampaign(
    id: string,
    dto: UpdateMarketingCampaignDto,
    user: AuthUser,
  ) {
    this.assertStaff(user);
    const existing = await this.requireCampaign(id, user);
    const row = await this.prisma.marketingCampaign.update({
      where: { id: existing.id },
      data: {
        name: dto.name?.trim(),
        channel: dto.channel,
        isActive: dto.isActive,
        notes: dto.notes === undefined ? undefined : dto.notes?.trim() || null,
      },
    });
    await this.audit.record({
      organizationId: user.organizationId,
      actorId: user.id,
      action: 'marketing.campaign.updated',
      resourceType: 'MarketingCampaign',
      resourceId: row.id,
    });
    return this.campaignDto(row);
  }

  async listLeads(
    user: AuthUser,
    opts?: { stage?: string; source?: string },
  ) {
    this.assertStaff(user);
    if (opts?.stage && !MARKETING_STAGES.includes(opts.stage as never)) {
      throw new BadRequestException({ error: 'INVALID_STAGE' });
    }
    if (opts?.source && !MARKETING_SOURCES.includes(opts.source as never)) {
      throw new BadRequestException({ error: 'INVALID_SOURCE' });
    }
    const rows = await this.prisma.marketingLead.findMany({
      where: {
        organizationId: user.organizationId,
        ...(opts?.stage
          ? { stage: opts.stage as MarketingLeadStage }
          : {}),
        ...(opts?.source
          ? { source: opts.source as MarketingLeadSource }
          : {}),
      },
      include: { campaign: { select: { code: true, name: true } } },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    const ownerIds = [
      ...new Set(rows.map((r) => r.ownerUserId).filter(Boolean) as string[]),
    ];
    const owners = ownerIds.length
      ? await this.prisma.user.findMany({
          where: { id: { in: ownerIds }, organizationId: user.organizationId },
          select: { id: true, fullName: true },
        })
      : [];
    const ownerMap = new Map(owners.map((o) => [o.id, o.fullName]));
    return rows.map((r) =>
      this.leadDto(r, {
        campaignCode: r.campaign?.code ?? null,
        campaignName: r.campaign?.name ?? null,
        ownerName: r.ownerUserId ? ownerMap.get(r.ownerUserId) ?? null : null,
      }),
    );
  }

  async getLead(id: string, user: AuthUser) {
    this.assertStaff(user);
    const lead = await this.requireLead(id, user);
    const [surveys, quotes, commissions, campaign, owner] = await Promise.all([
      this.prisma.marketingSiteSurvey.findMany({
        where: { organizationId: user.organizationId, leadId: lead.id },
        orderBy: { scheduledAt: 'desc' },
      }),
      this.prisma.marketingQuote.findMany({
        where: { organizationId: user.organizationId, leadId: lead.id },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.marketingCommission.findMany({
        where: { organizationId: user.organizationId, leadId: lead.id },
        orderBy: { createdAt: 'desc' },
      }),
      lead.campaignId
        ? this.prisma.marketingCampaign.findFirst({
            where: { id: lead.campaignId, organizationId: user.organizationId },
          })
        : null,
      lead.ownerUserId
        ? this.prisma.user.findFirst({
            where: {
              id: lead.ownerUserId,
              organizationId: user.organizationId,
            },
            select: { fullName: true },
          })
        : null,
    ]);
    return {
      ...this.leadDto(lead, {
        campaignCode: campaign?.code ?? null,
        campaignName: campaign?.name ?? null,
        ownerName: owner?.fullName ?? null,
        allowedNextStages: STAGE_NEXT[lead.stage],
      }),
      surveys: surveys.map((s) => this.surveyDto(s)),
      quotes: quotes.map((q) => this.quoteDto(q)),
      commissions: commissions.map((c) => this.commissionDto(c)),
    };
  }

  async createLead(dto: CreateMarketingLeadDto, user: AuthUser) {
    this.assertStaff(user);
    if (dto.campaignId) await this.requireCampaign(dto.campaignId, user);
    const code = `LD-${ymd()}-${rand4()}`;
    const row = await this.prisma.marketingLead.create({
      data: {
        organizationId: user.organizationId,
        code,
        companyName: dto.companyName.trim(),
        contactName: dto.contactName.trim(),
        contactEmail: dto.contactEmail?.trim() || null,
        contactPhone: dto.contactPhone?.trim() || null,
        source: dto.source ?? 'OTHER',
        campaignId: dto.campaignId || null,
        referrerName: dto.referrerName?.trim() || null,
        referrerType: dto.referrerType ?? null,
        ownerUserId: user.id,
        estimatedValue:
          dto.estimatedValue != null ? dto.estimatedValue : null,
        notes: dto.notes?.trim() || null,
        createdBy: user.id,
      },
    });
    await this.audit.record({
      organizationId: user.organizationId,
      actorId: user.id,
      action: 'marketing.lead.created',
      resourceType: 'MarketingLead',
      resourceId: row.id,
      after: { code: row.code, stage: row.stage },
    });
    return this.getLead(row.id, user);
  }

  async patchLead(id: string, dto: PatchMarketingLeadDto, user: AuthUser) {
    this.assertStaff(user);
    const existing = await this.requireLead(id, user);
    if (dto.campaignId) await this.requireCampaign(dto.campaignId, user);
    let stage = existing.stage;
    if (dto.stage && dto.stage !== existing.stage) {
      this.assertStage(existing.stage, dto.stage as MarketingLeadStage);
      stage = dto.stage as MarketingLeadStage;
    }
    const row = await this.prisma.marketingLead.update({
      where: { id: existing.id },
      data: {
        stage,
        notes: dto.notes === undefined ? undefined : dto.notes?.trim() || null,
        estimatedValue:
          dto.estimatedValue === undefined
            ? undefined
            : dto.estimatedValue,
        campaignId:
          dto.campaignId === undefined ? undefined : dto.campaignId || null,
        contactPhone:
          dto.contactPhone === undefined
            ? undefined
            : dto.contactPhone?.trim() || null,
        contactEmail:
          dto.contactEmail === undefined
            ? undefined
            : dto.contactEmail?.trim() || null,
      },
    });
    await this.audit.record({
      organizationId: user.organizationId,
      actorId: user.id,
      action: 'marketing.lead.updated',
      resourceType: 'MarketingLead',
      resourceId: row.id,
      before: { stage: existing.stage },
      after: { stage: row.stage },
    });
    return this.getLead(row.id, user);
  }

  async winLead(id: string, dto: WinMarketingLeadDto, user: AuthUser) {
    this.assertStaff(user);
    const existing = await this.requireLead(id, user);
    this.assertStage(existing.stage, MarketingLeadStage.WON);
    const beneficiary =
      dto.commissionBeneficiary?.trim() ||
      existing.referrerName?.trim() ||
      null;
    const now = new Date();
    await this.prisma.$transaction(async (tx) => {
      await tx.marketingLead.update({
        where: { id: existing.id },
        data: { stage: MarketingLeadStage.WON, wonAt: now },
      });
      if (dto.commissionAmount && dto.commissionAmount > 0 && beneficiary) {
        await tx.marketingCommission.create({
          data: {
            organizationId: user.organizationId,
            leadId: existing.id,
            beneficiary,
            referrerType: existing.referrerType,
            amount: dto.commissionAmount,
            currency: existing.currency,
            status: MarketingCommissionStatus.PENDING,
            createdBy: user.id,
          },
        });
      }
    });
    await this.audit.record({
      organizationId: user.organizationId,
      actorId: user.id,
      action: 'marketing.lead.won',
      resourceType: 'MarketingLead',
      resourceId: existing.id,
      after: { commissionAmount: dto.commissionAmount ?? null },
    });
    return this.getLead(id, user);
  }

  async loseLead(id: string, dto: LoseMarketingLeadDto, user: AuthUser) {
    this.assertStaff(user);
    const existing = await this.requireLead(id, user);
    this.assertStage(existing.stage, MarketingLeadStage.LOST);
    await this.prisma.marketingLead.update({
      where: { id: existing.id },
      data: {
        stage: MarketingLeadStage.LOST,
        lostReason: dto.reason.trim(),
        lostAt: new Date(),
      },
    });
    await this.audit.record({
      organizationId: user.organizationId,
      actorId: user.id,
      action: 'marketing.lead.lost',
      resourceType: 'MarketingLead',
      resourceId: existing.id,
      after: { reason: dto.reason.trim() },
    });
    return this.getLead(id, user);
  }

  async createSurvey(
    leadId: string,
    dto: CreateMarketingSurveyDto,
    user: AuthUser,
  ) {
    this.assertStaff(user);
    const lead = await this.requireLead(leadId, user);
    this.rejectTerminal(lead.stage);
    const row = await this.prisma.marketingSiteSurvey.create({
      data: {
        organizationId: user.organizationId,
        leadId: lead.id,
        siteAddress: dto.siteAddress.trim(),
        scheduledAt: new Date(dto.scheduledAt),
        officerName: dto.officerName?.trim() || null,
        notes: dto.notes?.trim() || null,
        createdBy: user.id,
      },
    });
    await this.advanceIfAhead(lead, MarketingLeadStage.SURVEY_SCHEDULED);
    await this.audit.record({
      organizationId: user.organizationId,
      actorId: user.id,
      action: 'marketing.survey.created',
      resourceType: 'MarketingSiteSurvey',
      resourceId: row.id,
      after: { leadId: lead.id },
    });
    return this.surveyDto(row);
  }

  async completeSurvey(
    leadId: string,
    surveyId: string,
    dto: CompleteMarketingSurveyDto,
    user: AuthUser,
  ) {
    this.assertStaff(user);
    const lead = await this.requireLead(leadId, user);
    const survey = await this.prisma.marketingSiteSurvey.findFirst({
      where: {
        id: surveyId,
        leadId: lead.id,
        organizationId: user.organizationId,
      },
    });
    if (!survey) throw new NotFoundException('Survey not found');
    if (survey.status !== MarketingSurveyStatus.SCHEDULED) {
      throw new BadRequestException({ error: 'SURVEY_NOT_SCHEDULED' });
    }
    const row = await this.prisma.marketingSiteSurvey.update({
      where: { id: survey.id },
      data: {
        status: MarketingSurveyStatus.COMPLETED,
        completedAt: new Date(),
        outcome: dto.outcome.trim(),
        notes: dto.notes?.trim() || survey.notes,
      },
    });
    await this.advanceIfAhead(lead, MarketingLeadStage.SURVEY_DONE);
    await this.audit.record({
      organizationId: user.organizationId,
      actorId: user.id,
      action: 'marketing.survey.completed',
      resourceType: 'MarketingSiteSurvey',
      resourceId: row.id,
    });
    return this.surveyDto(row);
  }

  async createQuote(
    leadId: string,
    dto: CreateMarketingQuoteDto,
    user: AuthUser,
  ) {
    this.assertStaff(user);
    const lead = await this.requireLead(leadId, user);
    this.rejectTerminal(lead.stage);
    const quoteNumber = `QT-${ymd()}-${rand4()}`;
    const row = await this.prisma.marketingQuote.create({
      data: {
        organizationId: user.organizationId,
        leadId: lead.id,
        quoteNumber,
        kind: dto.kind,
        amount: dto.amount,
        validUntil: dto.validUntil ? new Date(dto.validUntil) : null,
        serviceTypes: dto.serviceTypes ?? [],
        notes: dto.notes?.trim() || null,
        createdBy: user.id,
      },
    });
    const target =
      dto.kind === MarketingQuoteKind.PROPOSAL
        ? MarketingLeadStage.PROPOSAL
        : MarketingLeadStage.QUOTED;
    await this.advanceIfAhead(lead, target);
    await this.audit.record({
      organizationId: user.organizationId,
      actorId: user.id,
      action: 'marketing.quote.created',
      resourceType: 'MarketingQuote',
      resourceId: row.id,
      after: { quoteNumber, kind: dto.kind },
    });
    return this.quoteDto(row);
  }

  async patchQuoteStatus(
    leadId: string,
    quoteId: string,
    dto: PatchMarketingQuoteStatusDto,
    user: AuthUser,
  ) {
    this.assertStaff(user);
    const lead = await this.requireLead(leadId, user);
    const quote = await this.prisma.marketingQuote.findFirst({
      where: {
        id: quoteId,
        leadId: lead.id,
        organizationId: user.organizationId,
      },
    });
    if (!quote) throw new NotFoundException('Quote not found');
    const allowed = QUOTE_NEXT[quote.status] ?? [];
    if (!allowed.includes(dto.status as MarketingQuoteStatus)) {
      throw new BadRequestException({ error: 'INVALID_QUOTE_STATUS' });
    }
    const next = dto.status as MarketingQuoteStatus;
    const row = await this.prisma.marketingQuote.update({
      where: { id: quote.id },
      data: {
        status: next,
        sentAt:
          next === MarketingQuoteStatus.SENT ? new Date() : quote.sentAt,
        decidedAt:
          next === MarketingQuoteStatus.ACCEPTED ||
          next === MarketingQuoteStatus.REJECTED ||
          next === MarketingQuoteStatus.EXPIRED
            ? new Date()
            : quote.decidedAt,
      },
    });
    await this.audit.record({
      organizationId: user.organizationId,
      actorId: user.id,
      action: 'marketing.quote.status',
      resourceType: 'MarketingQuote',
      resourceId: row.id,
      before: { status: quote.status },
      after: { status: row.status },
    });
    return this.quoteDto(row);
  }

  async convertCustomer(
    leadId: string,
    dto: ConvertLeadCustomerDto,
    user: AuthUser,
  ) {
    this.assertStaff(user);
    const lead = await this.requireLead(leadId, user);
    this.rejectTerminal(lead.stage, true);
    if (lead.customerId) {
      throw new ConflictException({ error: 'LEAD_ALREADY_CONVERTED' });
    }
    const created = await this.customers.create(
      {
        name: (dto.name ?? lead.companyName).trim(),
        contactPerson: lead.contactName,
        phone: lead.contactPhone ?? undefined,
        email: lead.contactEmail ?? undefined,
        saveAsDraft: true,
      },
      user,
    );
    await this.prisma.marketingLead.update({
      where: { id: lead.id },
      data: { customerId: created.id, customerCode: created.code },
    });
    await this.audit.record({
      organizationId: user.organizationId,
      actorId: user.id,
      action: 'marketing.lead.converted_customer',
      resourceType: 'MarketingLead',
      resourceId: lead.id,
      after: { customerId: created.id, customerCode: created.code },
    });
    return this.getLead(leadId, user);
  }

  async convertContract(
    leadId: string,
    dto: ConvertLeadContractDto,
    user: AuthUser,
  ) {
    this.assertStaff(user);
    const lead = await this.requireLead(leadId, user);
    this.rejectTerminal(lead.stage, true);
    if (!lead.customerId) {
      throw new BadRequestException({
        error: 'CUSTOMER_REQUIRED_FOR_CONTRACT',
      });
    }
    if (lead.contractId) {
      throw new ConflictException({ error: 'CONTRACT_ALREADY_LINKED' });
    }
    const contractNumber =
      dto.contractNumber?.trim() || `CTR-MKT-${lead.code}`;
    const created = await this.contracts.create(
      {
        customerId: lead.customerId,
        contractNumber,
        title:
          dto.title?.trim() ||
          `${lead.companyName} — ${dto.serviceTypes[0] ?? 'services'}`,
        serviceTypes: dto.serviceTypes,
        startDate: dto.startDate,
        endDate: dto.endDate,
        monthlyFee: dto.monthlyFee,
      },
      user,
    );
    await this.prisma.marketingLead.update({
      where: { id: lead.id },
      data: {
        contractId: created.id,
        contractNumber: created.contractNumber,
      },
    });
    await this.audit.record({
      organizationId: user.organizationId,
      actorId: user.id,
      action: 'marketing.lead.converted_contract',
      resourceType: 'MarketingLead',
      resourceId: lead.id,
      after: {
        contractId: created.id,
        contractNumber: created.contractNumber,
      },
    });
    return this.getLead(leadId, user);
  }

  async listCommissions(user: AuthUser) {
    this.assertStaff(user);
    const rows = await this.prisma.marketingCommission.findMany({
      where: { organizationId: user.organizationId },
      include: { lead: { select: { code: true, companyName: true } } },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    return rows.map((r) => ({
      ...this.commissionDto(r),
      leadCode: r.lead.code,
      companyName: r.lead.companyName,
    }));
  }

  async accrueCommission(id: string, user: AuthUser) {
    this.assertStaff(user);
    const row = await this.prisma.marketingCommission.findFirst({
      where: { id, organizationId: user.organizationId },
    });
    if (!row) throw new NotFoundException('Commission not found');
    if (row.status !== MarketingCommissionStatus.PENDING) {
      throw new BadRequestException({ error: 'COMMISSION_NOT_PENDING' });
    }
    if (row.createdBy === user.id) {
      throw new ForbiddenException({ error: 'CREATOR_CANNOT_ACCRUE' });
    }
    const updated = await this.prisma.marketingCommission.update({
      where: { id: row.id },
      data: {
        status: MarketingCommissionStatus.ACCRUED,
        accruedBy: user.id,
        accruedAt: new Date(),
      },
    });
    await this.audit.record({
      organizationId: user.organizationId,
      actorId: user.id,
      action: 'marketing.commission.accrued',
      resourceType: 'MarketingCommission',
      resourceId: updated.id,
    });
    return this.commissionDto(updated);
  }

  private async requireCampaign(id: string, user: AuthUser) {
    const row = await this.prisma.marketingCampaign.findFirst({
      where: { id, organizationId: user.organizationId },
    });
    if (!row) throw new NotFoundException('Campaign not found');
    return row;
  }

  private async requireLead(id: string, user: AuthUser) {
    const row = await this.prisma.marketingLead.findFirst({
      where: { id, organizationId: user.organizationId },
    });
    if (!row) throw new NotFoundException('Lead not found');
    return row;
  }

  private assertStage(from: MarketingLeadStage, to: MarketingLeadStage) {
    if (!STAGE_NEXT[from].includes(to)) {
      throw new BadRequestException({
        error: 'INVALID_STAGE_TRANSITION',
        message: `${from} cannot move to ${to}`,
      });
    }
  }

  private rejectTerminal(stage: MarketingLeadStage, allowWon = false) {
    if (stage === MarketingLeadStage.LOST) {
      throw new BadRequestException({ error: 'LEAD_LOST' });
    }
    if (!allowWon && stage === MarketingLeadStage.WON) {
      throw new BadRequestException({ error: 'LEAD_WON' });
    }
  }

  private async advanceIfAhead(
    lead: { id: string; stage: MarketingLeadStage },
    target: MarketingLeadStage,
  ) {
    if (
      lead.stage === MarketingLeadStage.LOST ||
      lead.stage === MarketingLeadStage.WON
    ) {
      return;
    }
    if (STAGE_RANK[target] > STAGE_RANK[lead.stage]) {
      await this.prisma.marketingLead.update({
        where: { id: lead.id },
        data: { stage: target },
      });
    }
  }

  private campaignDto(r: {
    id: string;
    code: string;
    name: string;
    channel: string;
    startsAt: Date | null;
    endsAt: Date | null;
    isActive: boolean;
    notes: string | null;
    createdAt: Date;
  }) {
    return {
      id: r.id,
      code: r.code,
      name: r.name,
      channel: r.channel,
      startsAt: r.startsAt?.toISOString() ?? null,
      endsAt: r.endsAt?.toISOString() ?? null,
      isActive: r.isActive,
      notes: r.notes,
      createdAt: r.createdAt.toISOString(),
    };
  }

  private leadDto(
    r: {
      id: string;
      code: string;
      companyName: string;
      contactName: string;
      contactEmail: string | null;
      contactPhone: string | null;
      source: string;
      stage: MarketingLeadStage;
      campaignId: string | null;
      referrerName: string | null;
      referrerType: string | null;
      ownerUserId: string | null;
      estimatedValue: Prisma.Decimal | null;
      currency: string;
      notes: string | null;
      lostReason: string | null;
      customerId: string | null;
      customerCode: string | null;
      contractId: string | null;
      contractNumber: string | null;
      wonAt: Date | null;
      lostAt: Date | null;
      createdAt: Date;
    },
    extra?: {
      campaignCode?: string | null;
      campaignName?: string | null;
      ownerName?: string | null;
      allowedNextStages?: MarketingLeadStage[];
    },
  ) {
    return {
      id: r.id,
      code: r.code,
      companyName: r.companyName,
      contactName: r.contactName,
      contactEmail: r.contactEmail,
      contactPhone: r.contactPhone,
      source: r.source,
      stage: r.stage,
      campaignId: r.campaignId,
      campaignCode: extra?.campaignCode ?? null,
      campaignName: extra?.campaignName ?? null,
      referrerName: r.referrerName,
      referrerType: r.referrerType,
      ownerUserId: r.ownerUserId,
      ownerName: extra?.ownerName ?? null,
      estimatedValue: money(r.estimatedValue),
      currency: r.currency,
      notes: r.notes,
      lostReason: r.lostReason,
      customerId: r.customerId,
      customerCode: r.customerCode,
      contractId: r.contractId,
      contractNumber: r.contractNumber,
      wonAt: r.wonAt?.toISOString() ?? null,
      lostAt: r.lostAt?.toISOString() ?? null,
      createdAt: r.createdAt.toISOString(),
      allowedNextStages: extra?.allowedNextStages ?? STAGE_NEXT[r.stage],
    };
  }

  private surveyDto(r: {
    id: string;
    leadId: string;
    siteAddress: string;
    scheduledAt: Date;
    completedAt: Date | null;
    status: string;
    outcome: string | null;
    officerName: string | null;
    notes: string | null;
  }) {
    return {
      id: r.id,
      leadId: r.leadId,
      siteAddress: r.siteAddress,
      scheduledAt: r.scheduledAt.toISOString(),
      completedAt: r.completedAt?.toISOString() ?? null,
      status: r.status,
      outcome: r.outcome,
      officerName: r.officerName,
      notes: r.notes,
    };
  }

  private quoteDto(r: {
    id: string;
    leadId: string;
    quoteNumber: string;
    kind: string;
    status: MarketingQuoteStatus;
    amount: Prisma.Decimal;
    currency: string;
    validUntil: Date | null;
    serviceTypes: string[];
    notes: string | null;
    sentAt: Date | null;
  }) {
    return {
      id: r.id,
      leadId: r.leadId,
      quoteNumber: r.quoteNumber,
      kind: r.kind,
      status: r.status,
      amount: Number(r.amount),
      currency: r.currency,
      validUntil: r.validUntil
        ? r.validUntil.toISOString().slice(0, 10)
        : null,
      serviceTypes: r.serviceTypes,
      notes: r.notes,
      sentAt: r.sentAt?.toISOString() ?? null,
      allowedNextStatuses: QUOTE_NEXT[r.status] ?? [],
    };
  }

  private commissionDto(r: {
    id: string;
    leadId: string;
    beneficiary: string;
    referrerType: string | null;
    amount: Prisma.Decimal;
    currency: string;
    status: string;
    notes: string | null;
    accruedAt: Date | null;
    createdAt: Date;
  }) {
    return {
      id: r.id,
      leadId: r.leadId,
      beneficiary: r.beneficiary,
      referrerType: r.referrerType,
      amount: Number(r.amount),
      currency: r.currency,
      status: r.status,
      notes: r.notes,
      accruedAt: r.accruedAt?.toISOString() ?? null,
      createdAt: r.createdAt.toISOString(),
    };
  }
}
