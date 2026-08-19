import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ApplicationStatus,
  EmploymentType,
  JobPostingStatus,
  Prisma,
} from '@prisma/client';
import { AuthUser, getOrgContext, PrismaService } from '@pssms/shared';
import { AuditService } from '@pssms/audit';
import { NotificationsService } from '@pssms/notifications';
import { EmployeesService } from '@pssms/workforce';
import {
  APPLICANT_TRACK_OPTIONS,
  initialOnboarding,
  normalizeApplicantTrack,
  parseOnboardingProgress,
  type OnboardingStepState,
} from '../domain/applicant-catalog';
import {
  CreateJobApplicationDto,
  CreateJobPostingDto,
  HireApplicantDto,
  JobApplicationReceiptDto,
  JobApplicationPublicStatusDto,
  JobApplicationResponseDto,
  JobPostingPublicDto,
  JobPostingResponseDto,
  RecruitmentPublicConfigDto,
} from '../presentation/dto/recruitment.dto';

const STATUS_TRANSITIONS: Record<ApplicationStatus, ApplicationStatus[]> = {
  SUBMITTED: [
    ApplicationStatus.SCREENING,
    ApplicationStatus.REJECTED,
    ApplicationStatus.WITHDRAWN,
  ],
  SCREENING: [
    ApplicationStatus.INTERVIEW,
    ApplicationStatus.REJECTED,
    ApplicationStatus.WITHDRAWN,
  ],
  INTERVIEW: [
    ApplicationStatus.OFFERED,
    ApplicationStatus.REJECTED,
    ApplicationStatus.WITHDRAWN,
  ],
  OFFERED: [
    ApplicationStatus.REJECTED,
    ApplicationStatus.WITHDRAWN,
  ],
  HIRED: [],
  REJECTED: [],
  WITHDRAWN: [],
};

function defaultEmploymentType(track: string): EmploymentType {
  if (track === 'GUARD') return EmploymentType.GUARD;
  if (track === 'OFFICE') return EmploymentType.ADMIN;
  return EmploymentType.OTHER;
}

@Injectable()
export class RecruitmentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly employees: EmployeesService,
    private readonly notifications: NotificationsService,
  ) {}

  /** Public careers routes have no JWT — bind HIGHLINK RLS org (never bypass). */
  private async withPublicOrg<T>(fn: () => Promise<T>): Promise<T> {
    if (getOrgContext()?.organizationId) return fn();
    const org = await this.prisma.organization.findFirst({
      where: { code: 'HIGHLINK' },
    });
    if (!org) throw new NotFoundException('Demo organization not found');
    return this.prisma.runInRequestContext({ organizationId: org.id }, fn);
  }

  async publicConfig(): Promise<RecruitmentPublicConfigDto> {
    return this.withPublicOrg(async () => {
      const org = await this.prisma.organization.findFirst({
        where: { code: 'HIGHLINK' },
      });
      if (!org) throw new NotFoundException('Demo organization not found');

      const posting = await this.prisma.jobPosting.findFirst({
        where: {
          organizationId: org.id,
          id: '00000000-0000-4000-8000-000000000101',
          status: JobPostingStatus.OPEN,
        },
      });

      return {
        organizationId: org.id,
        seedPostingId: posting?.id ?? null,
        applicantTracks: [...APPLICANT_TRACK_OPTIONS],
      };
    });
  }

  async listOpenPostings(track?: string): Promise<JobPostingPublicDto[]> {
    const raw = track?.trim().toUpperCase();
    const applicantTrack = raw
      ? normalizeApplicantTrack(raw)
      : undefined;
    if (raw && raw !== applicantTrack) {
      throw new BadRequestException({
        error: 'INVALID_APPLICANT_TRACK',
        message: 'Applicant track must be GUARD, OFFICE, or GENERAL',
      });
    }
    return this.withPublicOrg(async () => {
      const now = new Date();
      const rows = await this.prisma.jobPosting.findMany({
        where: {
          status: JobPostingStatus.OPEN,
          OR: [{ closesAt: null }, { closesAt: { gt: now } }],
          ...(applicantTrack ? { applicantTrack } : {}),
        },
        orderBy: { publishedAt: 'desc' },
        take: 100,
      });
      return rows.map((p) => this.toPublicPostingDto(p));
    });
  }

  async getOpenPosting(id: string): Promise<JobPostingPublicDto> {
    return this.withPublicOrg(async () => {
      const now = new Date();
      const posting = await this.prisma.jobPosting.findFirst({
        where: {
          id,
          status: JobPostingStatus.OPEN,
          OR: [{ closesAt: null }, { closesAt: { gt: now } }],
        },
      });
      if (!posting) throw new NotFoundException('Job posting not found');
      return this.toPublicPostingDto(posting);
    });
  }

  async createPosting(
    dto: CreateJobPostingDto,
    user: AuthUser,
  ): Promise<JobPostingResponseDto> {
    const posting = await this.prisma.jobPosting.create({
      data: {
        organizationId: user.organizationId,
        title: dto.title,
        department: dto.department,
        location: dto.location,
        description: dto.description,
        requirements: dto.requirements,
        applicantTrack: normalizeApplicantTrack(dto.applicantTrack),
        status: dto.publish ? JobPostingStatus.OPEN : JobPostingStatus.DRAFT,
        publishedAt: dto.publish ? new Date() : undefined,
        closesAt: dto.closesAt ? new Date(dto.closesAt) : undefined,
        createdBy: user.id,
      },
    });

    await this.audit.record({
      organizationId: user.organizationId,
      actorId: user.id,
      action: 'recruitment.posting.created',
      resourceType: 'JobPosting',
      resourceId: posting.id,
      after: posting,
    });

    return this.toPostingDto(posting);
  }

  async listPostings(
    organizationId: string,
    status?: JobPostingStatus,
  ): Promise<JobPostingResponseDto[]> {
    const rows = await this.prisma.jobPosting.findMany({
      where: {
        organizationId,
        ...(status ? { status } : {}),
      },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((p) => this.toPostingDto(p));
  }

  async apply(
    dto: CreateJobApplicationDto,
    actorOrganizationId?: string,
  ): Promise<JobApplicationReceiptDto> {
    const run = async () => {
      const now = new Date();
      const posting = await this.prisma.jobPosting.findFirst({
        where: {
          id: dto.postingId,
          status: JobPostingStatus.OPEN,
          OR: [{ closesAt: null }, { closesAt: { gt: now } }],
          ...(actorOrganizationId
            ? { organizationId: actorOrganizationId }
            : {}),
        },
      });
      if (!posting) throw new NotFoundException('Job posting not open');

      // Public apply: trust posting org, ignore spoofed body organizationId
      const organizationId = posting.organizationId;
      const referenceNumber = await this.nextReferenceNumber(organizationId);

      const app = await this.prisma.jobApplication.create({
        data: {
          organizationId,
          postingId: dto.postingId,
          referenceNumber,
          applicantName: dto.applicantName,
          email: dto.email.toLowerCase().trim(),
          phone: dto.phone,
          resumeUrl: dto.resumeUrl,
          coverLetter: dto.coverLetter,
        },
      });

      await this.audit.record({
        organizationId,
        actorId: actorOrganizationId ? 'staff' : 'public',
        action: 'recruitment.application.submitted',
        resourceType: 'JobApplication',
        resourceId: app.id,
        after: {
          id: app.id,
          referenceNumber: app.referenceNumber,
          postingId: app.postingId,
          status: app.status,
        },
      });

      return {
        id: app.id,
        postingId: app.postingId,
        referenceNumber: app.referenceNumber,
        status: app.status,
      };
    };

    return actorOrganizationId || getOrgContext()?.organizationId
      ? run()
      : this.withPublicOrg(run);
  }

  async applicationStatus(
    reference: string,
    email: string,
  ): Promise<JobApplicationPublicStatusDto> {
    const ref = reference?.trim() ?? '';
    const mail = email?.trim() ?? '';
    if (!ref || !mail) {
      throw new BadRequestException({
        error: 'APPLICATION_LOOKUP_INVALID',
        message:
          'Enter both the reference number and the email used to apply.',
      });
    }

    return this.withPublicOrg(async () => {
      const app = await this.prisma.jobApplication.findFirst({
        where: {
          referenceNumber: ref.toUpperCase(),
          email: mail.toLowerCase(),
        },
        include: { posting: true },
      });
      if (!app) {
        throw new NotFoundException({
          error: 'APPLICATION_NOT_FOUND',
          message:
            'No application matches that reference number and email. Check both and try again.',
        });
      }

      const view = publicApplicationStatusView(app.status);
      const track = normalizeApplicantTrack(app.posting.applicantTrack);
      const onboarding =
        app.status === ApplicationStatus.HIRED
          ? parseOnboardingProgress(app.onboardingProgress, track).map(
              (s) => ({
                code: s.code,
                label: s.label,
                done: s.done,
              }),
            )
          : undefined;
      return {
        referenceNumber: app.referenceNumber,
        status: app.status,
        statusLabel: view.label,
        statusHint: view.hint,
        postingTitle: app.posting.title,
        department: app.posting.department,
        location: app.posting.location,
        submittedAt: app.createdAt,
        stages: view.stages,
        applicantTrack: track,
        onboardingSteps: onboarding,
      };
    });
  }

  async updateApplicationStatus(
    id: string,
    status: ApplicationStatus,
    user: AuthUser,
    notes?: string,
  ): Promise<JobApplicationResponseDto> {
    const app = await this.prisma.jobApplication.findFirst({
      where: { id, organizationId: user.organizationId },
      include: { posting: { select: { title: true } } },
    });
    if (!app) throw new NotFoundException('Application not found');

    if (status === ApplicationStatus.HIRED) {
      throw new BadRequestException({
        error: 'USE_HIRE_ENDPOINT',
        message: 'Use POST /recruitment/applications/:id/hire to hire',
      });
    }

    const allowed = STATUS_TRANSITIONS[app.status] ?? [];
    if (!allowed.includes(status)) {
      throw new BadRequestException({
        error: 'INVALID_APPLICATION_STATUS_TRANSITION',
        message: `Cannot move from ${app.status} to ${status}`,
        allowedNextStatuses: allowed,
      });
    }

    if (
      (status === ApplicationStatus.REJECTED ||
        status === ApplicationStatus.WITHDRAWN) &&
      !notes?.trim()
    ) {
      throw new BadRequestException({
        error: 'NOTES_REQUIRED',
        message: 'notes are required when rejecting or withdrawing',
      });
    }

    const updated = await this.prisma.jobApplication.update({
      where: { id },
      data: {
        status,
        notes: notes !== undefined ? notes : app.notes,
        screenedBy: user.id,
      },
      include: { posting: { select: { title: true, applicantTrack: true } } },
    });

    await this.audit.record({
      organizationId: user.organizationId,
      actorId: user.id,
      action: `recruitment.application.${status.toLowerCase()}`,
      resourceType: 'JobApplication',
      resourceId: id,
      after: updated,
    });

    let interviewNotification: { email: boolean } | null = null;
    if (status === ApplicationStatus.INTERVIEW) {
      interviewNotification = await this.notifications.enqueueRecruitmentInterview(
        {
          organizationId: user.organizationId,
          applicationId: updated.id,
          applicantEmail: updated.email,
          applicantName: updated.applicantName,
          postingTitle: updated.posting.title,
          actorId: user.id,
        },
      );
      await this.audit.record({
        organizationId: user.organizationId,
        actorId: user.id,
        action: 'recruitment.application.interview_notified',
        resourceType: 'JobApplication',
        resourceId: id,
        after: interviewNotification,
      });
    }

    return this.toApplicationDto(
      updated,
      updated.posting.title,
      updated.posting.applicantTrack,
      interviewNotification,
    );
  }

  async hireApplicant(
    id: string,
    dto: HireApplicantDto,
    user: AuthUser,
  ): Promise<JobApplicationResponseDto> {
    const app = await this.prisma.jobApplication.findFirst({
      where: { id, organizationId: user.organizationId },
      include: { posting: { select: { title: true, applicantTrack: true } } },
    });
    if (!app) throw new NotFoundException('Application not found');
    if (app.status === ApplicationStatus.HIRED) {
      throw new BadRequestException({
        error: 'ALREADY_HIRED',
        message: 'Application is already hired',
      });
    }
    if (app.status !== ApplicationStatus.OFFERED) {
      throw new BadRequestException({
        error: 'NOT_OFFERED',
        message: 'Only OFFERED applications can be hired',
      });
    }

    const track = normalizeApplicantTrack(app.posting.applicantTrack);
    const employee = await this.employees.create(
      {
        employeeNumber: dto.employeeNumber,
        fullName: app.applicantName,
        email: app.email,
        phone: app.phone ?? undefined,
        department: dto.department,
        employmentType:
          dto.employmentType ?? defaultEmploymentType(track),
        hireDate: new Date().toISOString(),
      },
      user,
    );

    const onboarding = initialOnboarding(track);
    const updated = await this.prisma.jobApplication.update({
      where: { id },
      data: {
        status: ApplicationStatus.HIRED,
        employeeId: employee.id,
        screenedBy: user.id,
        onboardingProgress: onboarding as unknown as Prisma.InputJsonValue,
      },
      include: { posting: { select: { title: true, applicantTrack: true } } },
    });

    await this.audit.record({
      organizationId: user.organizationId,
      actorId: user.id,
      action: 'recruitment.applicant.hired',
      resourceType: 'JobApplication',
      resourceId: id,
      after: { application: updated, employeeId: employee.id },
    });

    return this.toApplicationDto(
      updated,
      updated.posting.title,
      updated.posting.applicantTrack,
    );
  }

  async updateOnboardingStep(
    id: string,
    stepCode: string,
    done: boolean,
    user: AuthUser,
  ): Promise<JobApplicationResponseDto> {
    const app = await this.prisma.jobApplication.findFirst({
      where: { id, organizationId: user.organizationId },
      include: { posting: { select: { title: true, applicantTrack: true } } },
    });
    if (!app) throw new NotFoundException('Application not found');
    if (app.status !== ApplicationStatus.HIRED) {
      throw new BadRequestException({
        error: 'ONBOARDING_NOT_HIRED',
        message: 'Onboarding steps apply only after hire',
      });
    }

    const track = normalizeApplicantTrack(app.posting.applicantTrack);
    const steps = parseOnboardingProgress(app.onboardingProgress, track);
    const idx = steps.findIndex((s) => s.code === stepCode.trim());
    if (idx < 0) {
      throw new BadRequestException({
        error: 'INVALID_ONBOARDING_STEP',
        message: 'Unknown onboarding step for this applicant track',
      });
    }
    const next: OnboardingStepState[] = steps.map((s, i) =>
      i === idx
        ? {
            ...s,
            done,
            completedAt: done ? new Date().toISOString() : null,
          }
        : s,
    );

    const updated = await this.prisma.jobApplication.update({
      where: { id },
      data: {
        onboardingProgress: next as unknown as Prisma.InputJsonValue,
        screenedBy: user.id,
      },
      include: { posting: { select: { title: true, applicantTrack: true } } },
    });

    await this.audit.record({
      organizationId: user.organizationId,
      actorId: user.id,
      action: 'recruitment.application.onboarding_updated',
      resourceType: 'JobApplication',
      resourceId: id,
      after: { stepCode, done },
    });

    return this.toApplicationDto(
      updated,
      updated.posting.title,
      updated.posting.applicantTrack,
    );
  }

  async listApplications(
    organizationId: string,
    postingId?: string,
    status?: ApplicationStatus,
  ): Promise<JobApplicationResponseDto[]> {
    const rows = await this.prisma.jobApplication.findMany({
      where: {
        organizationId,
        ...(postingId ? { postingId } : {}),
        ...(status ? { status } : {}),
      },
      include: { posting: { select: { title: true, applicantTrack: true } } },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    return rows.map((a) =>
      this.toApplicationDto(a, a.posting.title, a.posting.applicantTrack),
    );
  }

  private async nextReferenceNumber(organizationId: string): Promise<string> {
    const year = new Date().getUTCFullYear();
    const prefix = `APP-${year}-`;
    const latest = await this.prisma.jobApplication.findFirst({
      where: {
        organizationId,
        referenceNumber: { startsWith: prefix },
      },
      orderBy: { referenceNumber: 'desc' },
    });
    let seq = 1;
    if (latest?.referenceNumber) {
      const part = latest.referenceNumber.slice(prefix.length);
      const n = Number.parseInt(part, 10);
      if (!Number.isNaN(n)) seq = n + 1;
    }
    return `${prefix}${String(seq).padStart(6, '0')}`;
  }

  private toPublicPostingDto(p: {
    id: string;
    title: string;
    department: string | null;
    location: string | null;
    description: string;
    requirements: string | null;
    applicantTrack?: string | null;
    publishedAt: Date | null;
    closesAt: Date | null;
  }): JobPostingPublicDto {
    return {
      id: p.id,
      title: p.title,
      department: p.department,
      location: p.location,
      description: p.description,
      requirements: p.requirements,
      applicantTrack: normalizeApplicantTrack(p.applicantTrack),
      publishedAt: p.publishedAt,
      closesAt: p.closesAt,
    };
  }

  private toPostingDto(p: {
    id: string;
    organizationId: string;
    title: string;
    department: string | null;
    location: string | null;
    description: string;
    requirements: string | null;
    applicantTrack?: string | null;
    status: JobPostingStatus;
    publishedAt: Date | null;
    closesAt: Date | null;
    createdAt: Date;
  }): JobPostingResponseDto {
    return {
      id: p.id,
      organizationId: p.organizationId,
      title: p.title,
      department: p.department,
      location: p.location,
      description: p.description,
      requirements: p.requirements,
      applicantTrack: normalizeApplicantTrack(p.applicantTrack),
      status: p.status,
      publishedAt: p.publishedAt,
      closesAt: p.closesAt,
      createdAt: p.createdAt,
    };
  }

  private toApplicationDto(
    a: {
      id: string;
      organizationId: string;
      postingId: string;
      referenceNumber: string;
      applicantName: string;
      email: string;
      phone: string | null;
      resumeUrl: string | null;
      coverLetter: string | null;
      status: ApplicationStatus;
      notes: string | null;
      employeeId: string | null;
      createdAt: Date;
      onboardingProgress?: unknown;
    },
    postingTitle?: string | null,
    applicantTrack?: string | null,
    interviewNotification?: { email: boolean } | null,
  ): JobApplicationResponseDto {
    const track = normalizeApplicantTrack(applicantTrack);
    const onboardingSteps =
      a.status === ApplicationStatus.HIRED
        ? parseOnboardingProgress(a.onboardingProgress, track)
        : undefined;
    return {
      id: a.id,
      organizationId: a.organizationId,
      postingId: a.postingId,
      referenceNumber: a.referenceNumber,
      applicantName: a.applicantName,
      email: a.email,
      phone: a.phone,
      resumeUrl: a.resumeUrl,
      coverLetter: a.coverLetter,
      status: a.status,
      notes: a.notes,
      employeeId: a.employeeId,
      createdAt: a.createdAt,
      postingTitle: postingTitle ?? null,
      allowedNextStatuses: STATUS_TRANSITIONS[a.status] ?? [],
      canHire: a.status === ApplicationStatus.OFFERED,
      applicantTrack: track,
      onboardingSteps,
      interviewNotification: interviewNotification ?? null,
    };
  }
}

const PIPELINE: Array<{ key: ApplicationStatus; label: string }> = [
  { key: ApplicationStatus.SUBMITTED, label: 'Received' },
  { key: ApplicationStatus.SCREENING, label: 'Screening' },
  { key: ApplicationStatus.INTERVIEW, label: 'Interview' },
  { key: ApplicationStatus.OFFERED, label: 'Offer' },
  { key: ApplicationStatus.HIRED, label: 'Hired' },
];

const STATUS_COPY: Record<
  ApplicationStatus,
  { label: string; hint: string }
> = {
  SUBMITTED: {
    label: 'Received',
    hint: 'HIGHLINK has received your application. Screening has not started yet.',
  },
  SCREENING: {
    label: 'In screening',
    hint: 'Recruitment is reviewing your application. Keep this email available.',
  },
  INTERVIEW: {
    label: 'Interview',
    hint: 'You have been shortlisted. An interview notice was queued to this email — HIGHLINK will follow up with time and location.',
  },
  OFFERED: {
    label: 'Offer',
    hint: 'An offer is in progress. Watch this email for next steps.',
  },
  HIRED: {
    label: 'Hired',
    hint: 'You have been hired. Complete the onboarding steps shown below with HIGHLINK HR.',
  },
  REJECTED: {
    label: 'Not taken forward',
    hint: 'This application was not taken forward. You may apply for other open roles.',
  },
  WITHDRAWN: {
    label: 'Withdrawn',
    hint: 'This application was withdrawn and is no longer in the hiring pipeline.',
  },
};

function publicApplicationStatusView(status: ApplicationStatus): {
  label: string;
  hint: string;
  stages: Array<{
    key: string;
    label: string;
    state: 'done' | 'current' | 'upcoming' | 'skipped';
  }>;
} {
  const copy = STATUS_COPY[status];
  const idx = PIPELINE.findIndex((step) => step.key === status);
  const terminalOffPath =
    status === ApplicationStatus.REJECTED ||
    status === ApplicationStatus.WITHDRAWN;

  const stages = PIPELINE.map((step, i) => {
    if (terminalOffPath) {
      return {
        key: step.key,
        label: step.label,
        state: i === 0 ? ('done' as const) : ('skipped' as const),
      };
    }
    return {
      key: step.key,
      label: step.label,
      state:
        i < idx
          ? ('done' as const)
          : i === idx
            ? ('current' as const)
            : ('upcoming' as const),
    };
  });

  return { label: copy.label, hint: copy.hint, stages };
}
