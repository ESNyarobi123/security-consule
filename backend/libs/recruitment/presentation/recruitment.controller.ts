import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { JobPostingStatus } from '@prisma/client';
import { AuthUser, CurrentUser, Public } from '@pssms/shared';
import { RecruitmentService } from '../application/recruitment.service';
import {
  CreateJobApplicationDto,
  CreateJobPostingDto,
  HireApplicantDto,
  JobApplicationPublicStatusDto,
  JobApplicationResponseDto,
  JobPostingPublicDto,
  JobPostingResponseDto,
  RecruitmentPublicConfigDto,
  UpdateApplicationStatusDto,
} from './dto/recruitment.dto';

@ApiTags('Recruitment')
@Controller('recruitment')
export class RecruitmentController {
  constructor(private readonly service: RecruitmentService) {}

  @Public()
  @Get('public-config')
  @ApiOperation({ summary: 'Demo org + posting ids for recruitment-web' })
  @ApiOkResponse({ type: RecruitmentPublicConfigDto })
  publicConfig() {
    return this.service.publicConfig();
  }

  @Public()
  @Get('postings/open')
  @ApiOperation({ summary: 'List OPEN job postings (public careers)' })
  @ApiOkResponse({ type: [JobPostingPublicDto] })
  listOpen() {
    return this.service.listOpenPostings();
  }

  @Public()
  @Get('postings/open/:id')
  @ApiOperation({ summary: 'Get one OPEN job posting (public)' })
  @ApiOkResponse({ type: JobPostingPublicDto })
  getOpen(@Param('id') id: string) {
    return this.service.getOpenPosting(id);
  }

  @Post('postings')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create job posting' })
  @ApiCreatedResponse({ type: JobPostingResponseDto })
  createPosting(
    @Body() dto: CreateJobPostingDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.createPosting(dto, user);
  }

  @Get('postings')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List job postings (admin — all statuses)' })
  @ApiQuery({ name: 'status', required: false, enum: JobPostingStatus })
  @ApiOkResponse({ type: [JobPostingResponseDto] })
  listPostings(
    @CurrentUser() user: AuthUser,
    @Query('status') status?: JobPostingStatus,
  ) {
    return this.service.listPostings(user.organizationId, status);
  }

  @Public()
  @Post('applications')
  @ApiOperation({
    summary: 'Submit job application (public — org from OPEN posting)',
  })
  @ApiCreatedResponse({ type: JobApplicationResponseDto })
  apply(@Body() dto: CreateJobApplicationDto, @CurrentUser() user?: AuthUser) {
    return this.service.apply(dto, user?.organizationId);
  }

  @Public()
  @Get('applications/status')
  @ApiOperation({
    summary: 'Public status lookup by reference + email (safe fields only)',
  })
  @ApiQuery({ name: 'reference', required: true })
  @ApiQuery({ name: 'email', required: true })
  @ApiOkResponse({ type: JobApplicationPublicStatusDto })
  status(
    @Query('reference') reference: string,
    @Query('email') email: string,
  ) {
    return this.service.applicationStatus(reference, email);
  }

  @Get('applications')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List applications' })
  @ApiQuery({ name: 'postingId', required: false })
  @ApiOkResponse({ type: [JobApplicationResponseDto] })
  listApplications(
    @CurrentUser() user: AuthUser,
    @Query('postingId') postingId?: string,
  ) {
    return this.service.listApplications(user.organizationId, postingId);
  }

  @Patch('applications/:id/status')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update application status' })
  updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateApplicationStatusDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.updateApplicationStatus(
      id,
      dto.status,
      user,
      dto.notes,
    );
  }

  @Post('applications/:id/hire')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Hire applicant → create employee record' })
  @ApiOkResponse({ type: JobApplicationResponseDto })
  hire(
    @Param('id') id: string,
    @Body() dto: HireApplicantDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.hireApplicant(id, dto, user);
  }
}
