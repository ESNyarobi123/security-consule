import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { GuardSupplyRequestStatus } from '@prisma/client';
import {
  AuthUser,
  CurrentUser,
  Public,
  RequireAnyPermissions,
  RequirePermissions,
} from '@pssms/shared';
import { RecruitmentB2bService } from '../application/recruitment-b2b.service';
import {
  B2bPartnerProfileDto,
  CreateGuardSupplyRequestDto,
  GuardSupplyRequestResponseDto,
  RegisterB2bPartnerDto,
  RegisterB2bPartnerResponseDto,
  UpdateB2bPartnerStatusDto,
  UpdateGuardSupplyRequestStatusDto,
} from './dto/recruitment-b2b.dto';

@ApiTags('Recruitment B2B')
@ApiBearerAuth()
@Controller('recruitment/b2b')
export class RecruitmentB2bController {
  constructor(private readonly service: RecruitmentB2bService) {}

  @Public()
  @Post('partners/register')
  @ApiOperation({
    summary:
      'Public self-register for other security companies (PENDING until HR approves)',
  })
  @ApiCreatedResponse({ type: RegisterB2bPartnerResponseDto })
  register(@Body() dto: RegisterB2bPartnerDto) {
    return this.service.registerPartner(dto);
  }

  @Get('partners')
  @RequirePermissions('recruitment.manage')
  @ApiOperation({ summary: 'HR — list B2B security partners' })
  @ApiOkResponse({ type: [B2bPartnerProfileDto] })
  listPartners(@CurrentUser() user: AuthUser) {
    return this.service.listPartners(user);
  }

  @Patch('partners/:id/status')
  @RequirePermissions('recruitment.manage')
  @ApiOperation({ summary: 'HR — approve or suspend a B2B partner' })
  @ApiOkResponse({ type: B2bPartnerProfileDto })
  updatePartnerStatus(
    @Param('id') id: string,
    @Body() dto: UpdateB2bPartnerStatusDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.updatePartnerStatus(id, dto.status, user);
  }

  @Get('partners/me')
  @RequirePermissions('recruitment.b2b')
  @ApiOperation({ summary: 'Other security company — own partner profile' })
  @ApiOkResponse({ type: B2bPartnerProfileDto })
  partnerMe(@CurrentUser() user: AuthUser) {
    return this.service.getPartnerMe(user);
  }

  @Post('requests')
  @RequirePermissions('recruitment.b2b')
  @ApiOperation({ summary: 'Partner — submit guard supply request' })
  @ApiCreatedResponse({ type: GuardSupplyRequestResponseDto })
  create(
    @Body() dto: CreateGuardSupplyRequestDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.createRequest(dto, user);
  }

  @Get('requests')
  @RequireAnyPermissions('recruitment.b2b', 'recruitment.manage')
  @ApiOperation({
    summary:
      'List guard supply requests (partner: own; staff: org with recruitment.manage)',
  })
  @ApiQuery({ name: 'status', required: false, enum: GuardSupplyRequestStatus })
  @ApiOkResponse({ type: [GuardSupplyRequestResponseDto] })
  list(
    @CurrentUser() user: AuthUser,
    @Query('status') status?: GuardSupplyRequestStatus,
  ) {
    return this.service.listRequests(user, status);
  }

  @Get('requests/:id')
  @RequireAnyPermissions('recruitment.b2b', 'recruitment.manage')
  @ApiOperation({ summary: 'Get one guard supply request (scoped)' })
  @ApiOkResponse({ type: GuardSupplyRequestResponseDto })
  get(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.getRequest(id, user);
  }

  @Patch('requests/:id/status')
  @RequirePermissions('recruitment.manage')
  @ApiOperation({ summary: 'HR triage — update request status' })
  @ApiOkResponse({ type: GuardSupplyRequestResponseDto })
  updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateGuardSupplyRequestStatusDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.updateStatus(id, dto, user);
  }
}
