import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ApplicationStatus,
  EmploymentType,
  JobPostingStatus,
} from '@prisma/client';
import { PrismaService, AuthUser } from '@pssms/shared';
import { AuditService } from '@pssms/audit';
import { EmployeesService } from '@pssms/workforce';
import {
  CreateJobApplicationDto,
  CreateJobPostingDto,
  HireApplicantDto,
  JobApplicationPublicStatusDto,
  JobApplicationResponseDto,
  JobPostingPublicDto,
  JobPostingResponseDto,
  RecruitmentPublicConfigDto,
} from '../presentation/dto/recruitment.dto';

@Injectable()
export class RecruitmentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly employees: EmployeesService,
  ) {}

  async publicConfig(): Promise<RecruitmentPublicConfigDto> {
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
    };
  }

  async listOpenPostings(): Promise<JobPostingPublicDto[]> {
    const now = new Date();
    const rows = await this.prisma.jobPosting.findMany({
      where: {
        status: JobPostingStatus.OPEN,
        OR: [{ closesAt: null }, { closesAt: { gt: now } }],
      },
      orderBy: { publishedAt: 'desc' },
      take: 100,
    });
    return rows.map((p) => this.toPublicPostingDto(p));
  }

  async getOpenPosting(id: string): Promise<JobPostingPublicDto> {
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
  ): Promise<JobApplicationResponseDto> {
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

    return this.toApplicationDto(app);
  }

  async applicationStatus(
    reference: string,
    email: string,
  ): Promise<JobApplicationPublicStatusDto> {
    const app = await this.prisma.jobApplication.findFirst({
      where: {
        referenceNumber: reference.trim().toUpperCase(),
        email: email.toLowerCase().trim(),
      },
      include: { posting: true },
    });
    if (!app) throw new NotFoundException('Application not found');

    return {
      referenceNumber: app.referenceNumber,
      status: app.status,
      postingTitle: app.posting.title,
      submittedAt: app.createdAt,
    };
  }

  async updateApplicationStatus(
    id: string,
    status: ApplicationStatus,
    user: AuthUser,
    notes?: string,
  ): Promise<JobApplicationResponseDto> {
    const app = await this.prisma.jobApplication.findFirst({
      where: { id, organizationId: user.organizationId },
    });
    if (!app) throw new NotFoundException('Application not found');

    const updated = await this.prisma.jobApplication.update({
      where: { id },
      data: { status, notes, screenedBy: user.id },
    });

    await this.audit.record({
      organizationId: user.organizationId,
      actorId: user.id,
      action: `recruitment.application.${status.toLowerCase()}`,
      resourceType: 'JobApplication',
      resourceId: id,
      after: updated,
    });

    return this.toApplicationDto(updated);
  }

  async hireApplicant(
    id: string,
    dto: HireApplicantDto,
    user: AuthUser,
  ): Promise<JobApplicationResponseDto> {
    const app = await this.prisma.jobApplication.findFirst({
      where: { id, organizationId: user.organizationId },
    });
    if (!app) throw new NotFoundException('Application not found');
    if (app.status === ApplicationStatus.HIRED) {
      throw new BadRequestException('Already hired');
    }

    const employee = await this.employees.create(
      {
        employeeNumber: dto.employeeNumber,
        fullName: app.applicantName,
        email: app.email,
        phone: app.phone ?? undefined,
        department: dto.department,
        employmentType: dto.employmentType ?? EmploymentType.GUARD,
        hireDate: new Date().toISOString(),
      },
      user,
    );

    const updated = await this.prisma.jobApplication.update({
      where: { id },
      data: {
        status: ApplicationStatus.HIRED,
        employeeId: employee.id,
        screenedBy: user.id,
      },
    });

    await this.audit.record({
      organizationId: user.organizationId,
      actorId: user.id,
      action: 'recruitment.applicant.hired',
      resourceType: 'JobApplication',
      resourceId: id,
      after: { application: updated, employeeId: employee.id },
    });

    return this.toApplicationDto(updated);
  }

  async listApplications(
    organizationId: string,
    postingId?: string,
  ): Promise<JobApplicationResponseDto[]> {
    const rows = await this.prisma.jobApplication.findMany({
      where: {
        organizationId,
        ...(postingId ? { postingId } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return rows.map((a) => this.toApplicationDto(a));
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
      status: p.status,
      publishedAt: p.publishedAt,
      closesAt: p.closesAt,
      createdAt: p.createdAt,
    };
  }

  private toApplicationDto(a: {
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
  }): JobApplicationResponseDto {
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
    };
  }
}
