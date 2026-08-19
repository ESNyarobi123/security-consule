import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ApplicationStatus,
  EmploymentType,
  JobPostingStatus,
} from '@prisma/client';
import {
  IsBoolean,
  IsDateString,
  IsEmail,
  IsEnum,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
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

  @ApiPropertyOptional({ description: 'True when status is OFFERED' })
  canHire?: boolean;

  @ApiPropertyOptional({ enum: APPLICANT_TRACKS })
  applicantTrack?: string | null;

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
  @ApiProperty({ example: 'GRD-0002' })
  @IsString()
  employeeNumber!: string;

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
