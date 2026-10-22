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
  AccrueMarketingCommissionDto,
  CancelMarketingSurveyDto,
  CompleteMarketingSurveyDto,
  ConvertLeadContractDto,
  ConvertLeadCustomerDto,
  CreateMarketingCampaignDto,
  CreateMarketingCommissionDto,
  CreateMarketingLeadDto,
  CreateMarketingQuoteDto,
  CreateMarketingSurveyDto,
  LoseMarketingLeadDto,
  MARKETING_CHANNELS,
  MARKETING_CONTRACT_SERVICES,
  MARKETING_QUOTE_KINDS,
  MARKETING_REFERRER_TYPES,
  MARKETING_SOURCES,
  MARKETING_STAGES,
  PatchMarketingCommissionDto,
  PatchMarketingLeadDto,
  PatchMarketingQuoteStatusDto,
  PayMarketingCommissionDto,
  UpdateMarketingCampaignDto,
  VoidMarketingCommissionDto,
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

const COMMISSION_STATUSES: MarketingCommissionStatus[] = [
  MarketingCommissionStatus.PENDING,
  MarketingCommissionStatus.ACCRUED,
  MarketingCommissionStatus.PAID,
  MarketingCommissionStatus.VOID,
];

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
      contractServices: [...MARKETING_CONTRACT_SERVICES],
      commissionStatuses: ['PENDING', 'ACCRUED', 'PAID', 'VOID'],
    };
  }

  async reports(user: AuthUser) {
    this.assertStaff(user);
    const org = user.organizationId;
    const [leads, campaigns, surveys, quotes, commissions, leadValues] =
      await Promise.all([
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
        this.prisma.marketingLead.findMany({
          where: { organizationId: org },
          select: { stage: true, estimatedValue: true },
        }),
      ]);

    const byStage = Object.fromEntries(
      MARKETING_STAGES.map((s) => [s, 0]),
    ) as Record<string, number>;
    for (const row of leads) byStage[row.stage] = row._count._all;

    const openStages = new Set<MarketingLeadStage>([
      MarketingLeadStage.LEAD,
      MarketingLeadStage.QUALIFIED,
      MarketingLeadStage.SURVEY_SCHEDULED,
      MarketingLeadStage.SURVEY_DONE,
      MarketingLeadStage.QUOTED,
      MarketingLeadStage.PROPOSAL,
    ]);
    const openPipeline =
      byStage.LEAD +
      byStage.QUALIFIED +
      byStage.SURVEY_SCHEDULED +
      byStage.SURVEY_DONE +
      byStage.QUOTED +
      byStage.PROPOSAL;

    const totalLeads = leadValues.length;
    const pipelineValue = leadValues
      .filter((l) => openStages.has(l.stage))
      .reduce((s, l) => s + Number(l.estimatedValue ?? 0), 0);
    const wonValue = leadValues
      .filter((l) => l.stage === MarketingLeadStage.WON)
      .reduce((s, l) => s + Number(l.estimatedValue ?? 0), 0);

    const sumByStatus = (status: MarketingCommissionStatus) =>
      commissions
        .filter((c) => c.status === status)
        .reduce((s, c) => s + Number(c.amount), 0);

    const pendingCommissionAmount = sumByStatus(
      MarketingCommissionStatus.PENDING,
    );
    const accruedCommissionAmount = sumByStatus(
      MarketingCommissionStatus.ACCRUED,
    );
    const paidCommissionAmount = sumByStatus(MarketingCommissionStatus.PAID);

    const pack = {
      byStage,
      openPipeline,
      totalLeads,
      won: byStage.WON,
      lost: byStage.LOST,
      pipelineValue,
      wonValue,
      conversionRate:
        totalLeads > 0 ? Number(((byStage.WON / totalLeads) * 100).toFixed(1)) : 0,
      activeCampaigns: campaigns,
      surveysScheduled:
        surveys.find((s) => s.status === MarketingSurveyStatus.SCHEDULED)
          ?._count._all ?? 0,
      surveysCompleted:
        surveys.find((s) => s.status === MarketingSurveyStatus.COMPLETED)
          ?._count._all ?? 0,
      quotesSent:
        quotes.find((q) => q.status === MarketingQuoteStatus.SENT)?._count
          ._all ?? 0,
      quotesAccepted:
        quotes.find((q) => q.status === MarketingQuoteStatus.ACCEPTED)?._count
          ._all ?? 0,
      pendingCommissions: commissions.filter(
        (c) => c.status === MarketingCommissionStatus.PENDING,
      ).length,
      pendingCommissionAmount,
      accruedCommissionAmount,
      paidCommissionAmount,
      generatedAt: new Date().toISOString(),
      notes: [
        'Live Prisma counts — not KPI forecasts.',
        'Commission register: PENDING → ACCRUED (another officer) → PAID; Finance still pays outside this portal.',
        'Contract conversion creates DRAFT only; Legal→GM→CEO→CMD on /approvals (creator ≠ approver).',
      ],
    };

    await this.audit.record({
      organizationId: org,
      actorId: user.id,
      action: 'marketing.reports.generated',
      resourceType: 'MarketingReport',
      after: {
        openPipeline: pack.openPipeline,
        won: pack.won,
        pipelineValue: pack.pipelineValue,
      },
    });
    return pack;
  }

  async listCampaigns(user: AuthUser) {
    this.assertStaff(user);
    const [rows, leadStats] = await Promise.all([
      this.prisma.marketingCampaign.findMany({
        where: { organizationId: user.organizationId },
        orderBy: { createdAt: 'desc' },
        take: 200,
      }),
      this.prisma.marketingLead.groupBy({
        by: ['campaignId', 'stage'],
        where: {
          organizationId: user.organizationId,
          campaignId: { not: null },
        },
        _count: { _all: true },
        _sum: { estimatedValue: true },
      }),
    ]);

    const stats = new Map<
      string,
      {
        leads: number;
        won: number;
        lost: number;
        open: number;
        pipelineValue: number;
        wonValue: number;
      }
    >();
    for (const row of leadStats) {
      if (!row.campaignId) continue;
      const cur =
        stats.get(row.campaignId) ??
        {
          leads: 0,
          won: 0,
          lost: 0,
          open: 0,
          pipelineValue: 0,
          wonValue: 0,
        };
      cur.leads += row._count._all;
      const value = Number(row._sum.estimatedValue ?? 0);
      if (row.stage === MarketingLeadStage.WON) {
        cur.won += row._count._all;
        cur.wonValue += value;
      } else if (row.stage === MarketingLeadStage.LOST) {
        cur.lost += row._count._all;
      } else {
        cur.open += row._count._all;
        cur.pipelineValue += value;
      }
      stats.set(row.campaignId, cur);
    }

    return rows.map((r) => this.campaignDto(r, stats.get(r.id)));
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
        startsAt: dto.startsAt ? new Date(dto.startsAt) : undefined,
        endsAt: dto.endsAt ? new Date(dto.endsAt) : undefined,
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

    const commissionUserIds = [
      ...new Set(
        commissions
          .flatMap((c) => [c.createdBy, c.accruedBy, c.paidBy])
          .filter(Boolean) as string[],
      ),
    ];
    const commissionUsers = commissionUserIds.length
      ? await this.prisma.user.findMany({
          where: {
            id: { in: commissionUserIds },
            organizationId: user.organizationId,
          },
          select: { id: true, fullName: true },
        })
      : [];
    const nameMap = new Map(commissionUsers.map((u) => [u.id, u.fullName]));

    return {
      ...this.leadDto(lead, {
        campaignCode: campaign?.code ?? null,
        campaignName: campaign?.name ?? null,
        ownerName: owner?.fullName ?? null,
        allowedNextStages: STAGE_NEXT[lead.stage],
      }),
      canConvertCustomer: lead.stage !== MarketingLeadStage.LOST,
      canConvertContract:
        lead.stage === MarketingLeadStage.WON && Boolean(lead.customerId),
      surveys: surveys.map((s) => this.surveyDto(s)),
      quotes: quotes.map((q) => this.quoteDto(q)),
      commissions: commissions.map((c) =>
        this.commissionDto(c, {
          leadCode: lead.code,
          companyName: lead.companyName,
          createdByName: nameMap.get(c.createdBy) ?? null,
          accruedByName: c.accruedBy
            ? nameMap.get(c.accruedBy) ?? null
            : null,
          paidByName: c.paidBy ? nameMap.get(c.paidBy) ?? null : null,
          currentUserId: user.id,
        }),
      ),
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
        companyName: dto.companyName?.trim(),
        contactName: dto.contactName?.trim(),
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
        referrerName:
          dto.referrerName === undefined
            ? undefined
            : dto.referrerName?.trim() || null,
        referrerType:
          dto.referrerType === undefined ? undefined : dto.referrerType,
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
    if (dto.commissionAmount && dto.commissionAmount > 0 && !beneficiary) {
      throw new BadRequestException({
        error: 'COMMISSION_BENEFICIARY_REQUIRED',
        message:
          'Add a commission beneficiary (or a referrer on the lead) before winning with a commission amount',
      });
    }
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

  async cancelSurvey(
    leadId: string,
    surveyId: string,
    dto: CancelMarketingSurveyDto,
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
        status: MarketingSurveyStatus.CANCELLED,
        notes: dto.reason?.trim() || survey.notes,
      },
    });
    await this.audit.record({
      organizationId: user.organizationId,
      actorId: user.id,
      action: 'marketing.survey.cancelled',
      resourceType: 'MarketingSiteSurvey',
      resourceId: row.id,
      after: { reason: dto.reason?.trim() || null },
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
    if (next === MarketingQuoteStatus.ACCEPTED) {
      await this.advanceIfAhead(
        lead,
        quote.kind === MarketingQuoteKind.PROPOSAL
          ? MarketingLeadStage.PROPOSAL
          : MarketingLeadStage.QUOTED,
      );
    }
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
    if (lead.stage !== MarketingLeadStage.WON) {
      throw new BadRequestException({
        error: 'LEAD_NOT_WON',
        message: 'Mark the lead won before converting a contract',
      });
    }
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

  async listCommissions(user: AuthUser, opts?: { status?: string }) {
    this.assertStaff(user);
    if (opts?.status && !COMMISSION_STATUSES.includes(opts.status as never)) {
      throw new BadRequestException({ error: 'INVALID_COMMISSION_STATUS' });
    }
    const rows = await this.prisma.marketingCommission.findMany({
      where: {
        organizationId: user.organizationId,
        ...(opts?.status
          ? { status: opts.status as MarketingCommissionStatus }
          : {}),
      },
      include: { lead: { select: { code: true, companyName: true } } },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    return this.enrichCommissions(rows, user);
  }

  async createCommission(
    leadId: string,
    dto: CreateMarketingCommissionDto,
    user: AuthUser,
  ) {
    this.assertStaff(user);
    const lead = await this.requireLead(leadId, user);
    if (lead.stage === MarketingLeadStage.LOST) {
      throw new BadRequestException({ error: 'LEAD_LOST' });
    }
    const row = await this.prisma.marketingCommission.create({
      data: {
        organizationId: user.organizationId,
        leadId: lead.id,
        beneficiary: dto.beneficiary.trim(),
        referrerType: dto.referrerType ?? lead.referrerType,
        amount: dto.amount,
        currency: lead.currency,
        notes: dto.notes?.trim() || null,
        createdBy: user.id,
      },
    });
    await this.audit.record({
      organizationId: user.organizationId,
      actorId: user.id,
      action: 'marketing.commission.created',
      resourceType: 'MarketingCommission',
      resourceId: row.id,
      after: {
        leadId: lead.id,
        beneficiary: row.beneficiary,
        amount: Number(row.amount),
      },
    });
    return this.commissionDto(row, {
      leadCode: lead.code,
      companyName: lead.companyName,
      currentUserId: user.id,
    });
  }

  async patchCommission(
    id: string,
    dto: PatchMarketingCommissionDto,
    user: AuthUser,
  ) {
    this.assertStaff(user);
    const row = await this.requireCommission(id, user);
    if (row.status !== MarketingCommissionStatus.PENDING) {
      throw new BadRequestException({ error: 'COMMISSION_NOT_PENDING' });
    }
    const updated = await this.prisma.marketingCommission.update({
      where: { id: row.id },
      data: {
        beneficiary: dto.beneficiary?.trim(),
        referrerType: dto.referrerType,
        amount: dto.amount,
        notes: dto.notes === undefined ? undefined : dto.notes?.trim() || null,
      },
    });
    await this.audit.record({
      organizationId: user.organizationId,
      actorId: user.id,
      action: 'marketing.commission.updated',
      resourceType: 'MarketingCommission',
      resourceId: updated.id,
      before: { amount: Number(row.amount), beneficiary: row.beneficiary },
      after: {
        amount: Number(updated.amount),
        beneficiary: updated.beneficiary,
      },
    });
    return this.commissionDto(updated, {
      leadCode: (await this.requireLead(updated.leadId, user)).code,
      currentUserId: user.id,
    });
  }

  async accrueCommission(
    id: string,
    dto: AccrueMarketingCommissionDto,
    user: AuthUser,
  ) {
    this.assertStaff(user);
    const row = await this.requireCommission(id, user);
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
        notes: dto.notes?.trim()
          ? [row.notes, dto.notes.trim()].filter(Boolean).join('\n')
          : undefined,
      },
    });
    await this.audit.record({
      organizationId: user.organizationId,
      actorId: user.id,
      action: 'marketing.commission.accrued',
      resourceType: 'MarketingCommission',
      resourceId: updated.id,
      after: { amount: Number(updated.amount) },
    });
    return this.commissionDto(updated, { currentUserId: user.id });
  }

  async payCommission(
    id: string,
    dto: PayMarketingCommissionDto,
    user: AuthUser,
  ) {
    this.assertStaff(user);
    const row = await this.requireCommission(id, user);
    if (row.status !== MarketingCommissionStatus.ACCRUED) {
      throw new BadRequestException({ error: 'COMMISSION_NOT_ACCRUED' });
    }
    const updated = await this.prisma.marketingCommission.update({
      where: { id: row.id },
      data: {
        status: MarketingCommissionStatus.PAID,
        paidBy: user.id,
        paidAt: new Date(),
        paymentReference: dto.paymentReference?.trim() || null,
        notes: dto.notes?.trim()
          ? [row.notes, dto.notes.trim()].filter(Boolean).join('\n')
          : undefined,
      },
    });
    await this.audit.record({
      organizationId: user.organizationId,
      actorId: user.id,
      action: 'marketing.commission.paid',
      resourceType: 'MarketingCommission',
      resourceId: updated.id,
      after: {
        amount: Number(updated.amount),
        paymentReference: updated.paymentReference,
      },
    });
    return this.commissionDto(updated, { currentUserId: user.id });
  }

  async voidCommission(
    id: string,
    dto: VoidMarketingCommissionDto,
    user: AuthUser,
  ) {
    this.assertStaff(user);
    const row = await this.requireCommission(id, user);
    if (
      row.status !== MarketingCommissionStatus.PENDING &&
      row.status !== MarketingCommissionStatus.ACCRUED
    ) {
      throw new BadRequestException({ error: 'COMMISSION_NOT_VOIDABLE' });
    }
    if (
      row.status === MarketingCommissionStatus.ACCRUED &&
      row.accruedBy === user.id
    ) {
      throw new ForbiddenException({ error: 'ACCRUER_CANNOT_VOID' });
    }
    const updated = await this.prisma.marketingCommission.update({
      where: { id: row.id },
      data: {
        status: MarketingCommissionStatus.VOID,
        voidedBy: user.id,
        voidedAt: new Date(),
        voidReason: dto.reason.trim(),
      },
    });
    await this.audit.record({
      organizationId: user.organizationId,
      actorId: user.id,
      action: 'marketing.commission.voided',
      resourceType: 'MarketingCommission',
      resourceId: updated.id,
      after: { reason: dto.reason.trim() },
    });
    return this.commissionDto(updated, { currentUserId: user.id });
  }

  private async requireCommission(id: string, user: AuthUser) {
    const row = await this.prisma.marketingCommission.findFirst({
      where: { id, organizationId: user.organizationId },
    });
    if (!row) throw new NotFoundException('Commission not found');
    return row;
  }

  private async enrichCommissions(
    rows: (Prisma.MarketingCommissionGetPayload<{
      include: { lead: { select: { code: true; companyName: true } } };
    }>)[],
    user: AuthUser,
  ) {
    const ids = [
      ...new Set(
        rows
          .flatMap((r) => [r.createdBy, r.accruedBy, r.paidBy, r.voidedBy])
          .filter(Boolean) as string[],
      ),
    ];
    const users = ids.length
      ? await this.prisma.user.findMany({
          where: { id: { in: ids }, organizationId: user.organizationId },
          select: { id: true, fullName: true },
        })
      : [];
    const names = new Map(users.map((u) => [u.id, u.fullName]));
    return rows.map((r) =>
      this.commissionDto(r, {
        leadCode: r.lead.code,
        companyName: r.lead.companyName,
        createdByName: names.get(r.createdBy) ?? null,
        accruedByName: r.accruedBy ? names.get(r.accruedBy) ?? null : null,
        paidByName: r.paidBy ? names.get(r.paidBy) ?? null : null,
        voidedByName: r.voidedBy ? names.get(r.voidedBy) ?? null : null,
        currentUserId: user.id,
      }),
    );
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

  private campaignDto(
    r: {
      id: string;
      code: string;
      name: string;
      channel: string;
      startsAt: Date | null;
      endsAt: Date | null;
      isActive: boolean;
      notes: string | null;
      createdAt: Date;
    },
    stats?: {
      leads: number;
      won: number;
      lost: number;
      open: number;
      pipelineValue: number;
      wonValue: number;
    },
  ) {
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
      totalLeads: stats?.leads ?? 0,
      openLeads: stats?.open ?? 0,
      wonLeads: stats?.won ?? 0,
      lostLeads: stats?.lost ?? 0,
      pipelineValue: stats?.pipelineValue ?? 0,
      wonValue: stats?.wonValue ?? 0,
      conversionRate:
        stats && stats.leads > 0
          ? Number(((stats.won / stats.leads) * 100).toFixed(1))
          : 0,
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

  private commissionDto(
    r: {
      id: string;
      leadId: string;
      beneficiary: string;
      referrerType: string | null;
      amount: Prisma.Decimal;
      currency: string;
      status: string;
      notes: string | null;
      createdBy: string;
      accruedBy: string | null;
      accruedAt: Date | null;
      paidBy: string | null;
      paidAt: Date | null;
      paymentReference: string | null;
      voidedBy: string | null;
      voidedAt: Date | null;
      voidReason: string | null;
      createdAt: Date;
    },
    extra?: {
      leadCode?: string | null;
      companyName?: string | null;
      createdByName?: string | null;
      accruedByName?: string | null;
      paidByName?: string | null;
      voidedByName?: string | null;
      currentUserId?: string;
    },
  ) {
    const canAccrue =
      r.status === MarketingCommissionStatus.PENDING &&
      r.createdBy !== extra?.currentUserId;
    return {
      id: r.id,
      leadId: r.leadId,
      leadCode: extra?.leadCode ?? null,
      companyName: extra?.companyName ?? null,
      beneficiary: r.beneficiary,
      referrerType: r.referrerType,
      amount: Number(r.amount),
      currency: r.currency,
      status: r.status,
      notes: r.notes,
      createdBy: r.createdBy,
      createdByName: extra?.createdByName ?? null,
      accruedBy: r.accruedBy,
      accruedByName: extra?.accruedByName ?? null,
      accruedAt: r.accruedAt?.toISOString() ?? null,
      paidBy: r.paidBy,
      paidByName: extra?.paidByName ?? null,
      paidAt: r.paidAt?.toISOString() ?? null,
      paymentReference: r.paymentReference,
      voidedAt: r.voidedAt?.toISOString() ?? null,
      voidedByName: extra?.voidedByName ?? null,
      voidReason: r.voidReason,
      createdAt: r.createdAt.toISOString(),
      canAccrue,
      canPay: r.status === MarketingCommissionStatus.ACCRUED,
      canEdit: r.status === MarketingCommissionStatus.PENDING,
      canVoid:
        r.status === MarketingCommissionStatus.PENDING ||
        (r.status === MarketingCommissionStatus.ACCRUED &&
          r.accruedBy !== extra?.currentUserId),
    };
  }
}
