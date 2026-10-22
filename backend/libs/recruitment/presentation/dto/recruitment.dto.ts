import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ApplicationStatus,
  EmploymentType,
  JobOfferStatus,
  JobPostingStatus,
} from '@prisma/client';
import {
  IsBoolean,
  IsDateString,
  IsEmail,
  IsEnum,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import {
  APPLICANT_TRACKS,
  type ApplicantTrack,
} from '../../domain/applicant-catalog';

export class CreateJobPostingDto {
  @ApiProperty()
  @IsString()
  title!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  department?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  location?: string;

  @ApiProperty()
  @IsString()
  @MinLength(10)
  description!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  requirements?: string;

  @ApiPropertyOptional({ enum: APPLICANT_TRACKS })
  @IsOptional()
  @IsIn([...APPLICANT_TRACKS], { message: 'INVALID_APPLICANT_TRACK' })
  applicantTrack?: ApplicantTrack;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  publish?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  closesAt?: string;
}

export class JobPostingResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() organizationId!: string;
  @ApiProperty() title!: string;
  @ApiPropertyOptional() department?: string | null;
  @ApiPropertyOptional() location?: string | null;
  @ApiProperty() description!: string;
  @ApiPropertyOptional() requirements?: string | null;
  @ApiProperty({ enum: APPLICANT_TRACKS }) applicantTrack!: string;
  @ApiProperty({ enum: JobPostingStatus }) status!: JobPostingStatus;
  @ApiPropertyOptional() publishedAt?: Date | null;
  @ApiPropertyOptional() closesAt?: Date | null;
  @ApiProperty() createdAt!: Date;
}

/** Public careers card — no org internals / createdBy */
export class JobPostingPublicDto {
  @ApiProperty() id!: string;
  @ApiProperty() title!: string;
  @ApiPropertyOptional() department?: string | null;
  @ApiPropertyOptional() location?: string | null;
  @ApiProperty() description!: string;
  @ApiPropertyOptional() requirements?: string | null;
  @ApiProperty({ enum: APPLICANT_TRACKS }) applicantTrack!: string;
  @ApiPropertyOptional() publishedAt?: Date | null;
  @ApiPropertyOptional() closesAt?: Date | null;
}

export class ApplicantTrackOptionDto {
  @ApiProperty() value!: string;
  @ApiProperty() label!: string;
  @ApiProperty() hint!: string;
}

export class RecruitmentPublicConfigDto {
  @ApiProperty() organizationId!: string;
  @ApiPropertyOptional() seedPostingId?: string | null;
  @ApiProperty({ type: [ApplicantTrackOptionDto] })
  applicantTracks!: ApplicantTrackOptionDto[];
}

export class CreateJobApplicationDto {
  @ApiProperty()
  @IsUUID()
  postingId!: string;

  @ApiPropertyOptional({
    description: 'Ignored for public apply — org comes from posting',
  })
  @IsOptional()
  @IsUUID()
  organizationId?: string;

  @ApiProperty()
  @IsString()
  applicantName!: string;

  @ApiProperty()
  @IsEmail()
  email!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(3_500_000)
  resumeUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  coverLetter?: string;
}

export class JobApplicationReceiptDto {
  @ApiProperty() id!: string;
  @ApiProperty() postingId!: string;
  @ApiProperty() referenceNumber!: string;
  @ApiProperty({ enum: ApplicationStatus }) status!: ApplicationStatus;
}

export class JobApplicationResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() organizationId!: string;
  @ApiProperty() postingId!: string;
  @ApiProperty() referenceNumber!: string;
  @ApiProperty() applicantName!: string;
  @ApiProperty() email!: string;
  @ApiPropertyOptional() phone?: string | null;
  @ApiPropertyOptional() resumeUrl?: string | null;
  @ApiPropertyOptional() coverLetter?: string | null;
  @ApiProperty({ enum: ApplicationStatus }) status!: ApplicationStatus;
  @ApiPropertyOptional() notes?: string | null;
  @ApiPropertyOptional() employeeId?: string | null;
  @ApiProperty() createdAt!: Date;

  /** Module 14-A — posting title for HR inbox */
  @ApiPropertyOptional() postingTitle?: string | null;

  @ApiPropertyOptional({
    enum: ApplicationStatus,
    isArray: true,
    description: 'Allowed PATCH status transitions (HIRED via /hire only)',
  })
  allowedNextStatuses?: ApplicationStatus[];

  @ApiPropertyOptional({
    description:
      'True only when status is OFFERED and the applicant ACCEPTED the offer',
  })
  canHire?: boolean;

  @ApiPropertyOptional({ enum: APPLICANT_TRACKS })
  applicantTrack?: string | null;

  /** Module 14 — formal offer terms + applicant decision. */
  @ApiPropertyOptional({ type: () => JobApplicationOfferDto })
  offer?: JobApplicationOfferDto | null;

  @ApiPropertyOptional({ type: 'array' })
  onboardingSteps?: Array<{
    code: string;
    label: string;
    done: boolean;
    completedAt?: string | null;
  }>;

  @ApiPropertyOptional({
    description: 'Set when advancing to INTERVIEW',
  })
  interviewNotification?: { email: boolean } | null;

  @ApiPropertyOptional({
    description: 'Set when an offer email is queued to the applicant',
  })
  offerNotification?: { email: boolean } | null;
}

/** Staff view of the offer (includes officer ids). */
export class JobApplicationOfferDto {
  @ApiProperty({ enum: JobOfferStatus }) status!: JobOfferStatus;
  @ApiPropertyOptional() position?: string | null;
  @ApiPropertyOptional() department?: string | null;
  @ApiPropertyOptional({ enum: EmploymentType })
  employmentType?: EmploymentType | null;
  @ApiPropertyOptional({ description: 'Decimal serialised as string' })
  salaryAmount?: string | null;
  @ApiPropertyOptional() currency?: string | null;
  @ApiPropertyOptional() startDate?: Date | null;
  @ApiPropertyOptional() message?: string | null;
  @ApiPropertyOptional() issuedAt?: Date | null;
  @ApiPropertyOptional() issuedBy?: string | null;
  @ApiPropertyOptional() expiresAt?: Date | null;
  @ApiPropertyOptional() respondedAt?: Date | null;
  @ApiPropertyOptional() responseReason?: string | null;
  @ApiPropertyOptional({
    description: 'True when the applicant can still accept/decline',
  })
  awaitingResponse?: boolean;
}

/**
 * Public applicant-facing offer — no officer ids, no internal notes.
 */
export class PublicJobOfferDto {
  @ApiProperty({ enum: JobOfferStatus }) status!: JobOfferStatus;
  @ApiPropertyOptional() position?: string | null;
  @ApiPropertyOptional() department?: string | null;
  @ApiPropertyOptional({ enum: EmploymentType })
  employmentType?: EmploymentType | null;
  @ApiPropertyOptional() salaryAmount?: string | null;
  @ApiPropertyOptional() currency?: string | null;
  @ApiPropertyOptional() startDate?: Date | null;
  @ApiPropertyOptional() message?: string | null;
  @ApiPropertyOptional() issuedAt?: Date | null;
  @ApiPropertyOptional() expiresAt?: Date | null;
  @ApiPropertyOptional() respondedAt?: Date | null;
  @ApiPropertyOptional({
    description: 'True when accept / decline buttons should be shown',
  })
  canRespond?: boolean;

  /** @deprecated alias kept for older clients */
  @ApiPropertyOptional() awaitingResponse?: boolean;
}

export class IssueJobOfferDto {
  @ApiProperty({ example: 'Security Guard — Site A' })
  @IsString()
  @MinLength(2)
  position!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  department?: string;

  @ApiPropertyOptional({ enum: EmploymentType })
  @IsOptional()
  @IsEnum(EmploymentType)
  employmentType?: EmploymentType;

  @ApiPropertyOptional({ example: 650000 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  salaryAmount?: number;

  @ApiPropertyOptional({ example: 'TZS' })
  @IsOptional()
  @IsString()
  @MaxLength(8)
  currency?: string;

  @ApiPropertyOptional({ example: '2026-11-01' })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({
    description: 'Days the applicant has to accept (default 7, max 60)',
    example: 7,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(60)
  expiresInDays?: number;

  @ApiPropertyOptional({ description: 'Message shown to the applicant' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  message?: string;
}

/** Public accept / decline — verified by reference + email. */
export class RespondToJobOfferDto {
  @ApiProperty()
  @IsString()
  reference!: string;

  @ApiProperty()
  @IsEmail()
  email!: string;

  @ApiProperty({ enum: ['ACCEPT', 'DECLINE'] })
  @IsIn(['ACCEPT', 'DECLINE'], {
    message: 'decision must be ACCEPT or DECLINE',
  })
  decision!: 'ACCEPT' | 'DECLINE';

  @ApiPropertyOptional({ description: 'Reason (encouraged when declining)' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

/** HR records a decision received by phone / in person. */
export class RecordOfferResponseDto {
  @ApiProperty({ enum: ['ACCEPT', 'DECLINE'] })
  @IsIn(['ACCEPT', 'DECLINE'], {
    message: 'decision must be ACCEPT or DECLINE',
  })
  decision!: 'ACCEPT' | 'DECLINE';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class JobOfferResponseReceiptDto {
  @ApiProperty() referenceNumber!: string;
  @ApiProperty({ enum: JobOfferStatus }) offerStatus!: JobOfferStatus;
  @ApiProperty({ enum: ApplicationStatus }) status!: ApplicationStatus;
  @ApiProperty() statusLabel!: string;
  @ApiProperty() statusHint!: string;
  @ApiPropertyOptional() respondedAt?: Date | null;
}

export class JobApplicationPublicStatusDto {
  @ApiProperty() referenceNumber!: string;
  @ApiProperty({ enum: ApplicationStatus }) status!: ApplicationStatus;
  @ApiProperty() statusLabel!: string;
  @ApiProperty() statusHint!: string;
  @ApiProperty() postingTitle!: string;
  @ApiPropertyOptional() department?: string | null;
  @ApiPropertyOptional() location?: string | null;
  @ApiProperty() submittedAt!: Date;
  @ApiProperty({
    type: 'array',
    items: {
      type: 'object',
      properties: {
        key: { type: 'string' },
        label: { type: 'string' },
        state: {
          type: 'string',
          enum: ['done', 'current', 'upcoming', 'skipped'],
        },
      },
    },
  })
  stages!: Array<{
    key: string;
    label: string;
    state: 'done' | 'current' | 'upcoming' | 'skipped';
  }>;

  @ApiProperty({ enum: APPLICANT_TRACKS })
  applicantTrack!: string;

  @ApiPropertyOptional({
    description:
      'Formal offer terms + applicant decision (OFFERED / HIRED only)',
    type: () => PublicJobOfferDto,
  })
  offer?: PublicJobOfferDto | null;

  @ApiPropertyOptional({
    description: 'Hire checklist (HIRED only; no officer names)',
    type: 'array',
  })
  onboardingSteps?: Array<{
    code: string;
    label: string;
    done: boolean;
  }>;
}

export class UpdateOnboardingStepDto {
  @ApiProperty()
  @IsString()
  stepCode!: string;

  @ApiProperty()
  @IsBoolean()
  done!: boolean;
}

export class HireApplicantDto {
  @ApiPropertyOptional({
    example: 'GRD-0002',
    description: 'Omit to auto-generate (EMP-#### / GRD-#### by track)',
  })
  @IsOptional()
  @IsString()
  employeeNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  department?: string;

  @ApiPropertyOptional({ enum: EmploymentType })
  @IsOptional()
  @IsEnum(EmploymentType)
  employmentType?: EmploymentType;
}

export class UpdateApplicationStatusDto {
  @ApiProperty({ enum: ApplicationStatus })
  @IsEnum(ApplicationStatus)
  status!: ApplicationStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}
