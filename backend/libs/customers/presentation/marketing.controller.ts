import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import {
  AuthUser,
  CurrentUser,
  PermissionsGuard,
  RequirePermissions,
} from '@pssms/shared';
import { MarketingService } from '../application/marketing.service';
import {
  CompleteMarketingSurveyDto,
  ConvertLeadContractDto,
  ConvertLeadCustomerDto,
  CreateMarketingCampaignDto,
  CreateMarketingLeadDto,
  CreateMarketingQuoteDto,
  CreateMarketingSurveyDto,
  LoseMarketingLeadDto,
  PatchMarketingLeadDto,
  PatchMarketingQuoteStatusDto,
  UpdateMarketingCampaignDto,
  WinMarketingLeadDto,
} from './dto/marketing.dto';

@ApiTags('Marketing / BD')
@ApiBearerAuth()
@Controller('marketing')
@UseGuards(PermissionsGuard)
@RequirePermissions('marketing.manage')
export class MarketingController {
  constructor(private readonly marketing: MarketingService) {}

  @Get('options')
  @ApiOperation({ summary: 'Pipeline catalogs (stages, sources, channels)' })
  options() {
    return this.marketing.catalogs();
  }

  @Get('reports')
  @ApiOperation({ summary: 'Live BD pipeline counts' })
  reports(@CurrentUser() user: AuthUser) {
    return this.marketing.reports(user);
  }

  @Get('campaigns')
  @ApiOkResponse({ description: 'Campaign list' })
  listCampaigns(@CurrentUser() user: AuthUser) {
    return this.marketing.listCampaigns(user);
  }

  @Post('campaigns')
  @ApiCreatedResponse({ description: 'Campaign created' })
  createCampaign(
    @Body() dto: CreateMarketingCampaignDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.marketing.createCampaign(dto, user);
  }

  @Patch('campaigns/:id')
  updateCampaign(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateMarketingCampaignDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.marketing.updateCampaign(id, dto, user);
  }

  @Get('commissions')
  listCommissions(@CurrentUser() user: AuthUser) {
    return this.marketing.listCommissions(user);
  }

  @Post('commissions/:id/accrue')
  accrueCommission(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.marketing.accrueCommission(id, user);
  }

  @Get('leads')
  @ApiQuery({ name: 'stage', required: false })
  @ApiQuery({ name: 'source', required: false })
  listLeads(
    @CurrentUser() user: AuthUser,
    @Query('stage') stage?: string,
    @Query('source') source?: string,
  ) {
    return this.marketing.listLeads(user, { stage, source });
  }

  @Post('leads')
  createLead(
    @Body() dto: CreateMarketingLeadDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.marketing.createLead(dto, user);
  }

  @Get('leads/:id')
  getLead(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.marketing.getLead(id, user);
  }

  @Patch('leads/:id')
  patchLead(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: PatchMarketingLeadDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.marketing.patchLead(id, dto, user);
  }

  @Post('leads/:id/win')
  winLead(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: WinMarketingLeadDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.marketing.winLead(id, dto, user);
  }

  @Post('leads/:id/lose')
  loseLead(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: LoseMarketingLeadDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.marketing.loseLead(id, dto, user);
  }

  @Post('leads/:id/surveys')
  createSurvey(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateMarketingSurveyDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.marketing.createSurvey(id, dto, user);
  }

  @Post('leads/:id/surveys/:surveyId/complete')
  completeSurvey(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('surveyId', ParseUUIDPipe) surveyId: string,
    @Body() dto: CompleteMarketingSurveyDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.marketing.completeSurvey(id, surveyId, dto, user);
  }

  @Post('leads/:id/quotes')
  createQuote(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateMarketingQuoteDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.marketing.createQuote(id, dto, user);
  }

  @Patch('leads/:id/quotes/:quoteId')
  patchQuote(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('quoteId', ParseUUIDPipe) quoteId: string,
    @Body() dto: PatchMarketingQuoteStatusDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.marketing.patchQuoteStatus(id, quoteId, dto, user);
  }

  @Post('leads/:id/convert-customer')
  convertCustomer(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ConvertLeadCustomerDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.marketing.convertCustomer(id, dto, user);
  }

  @Post('leads/:id/convert-contract')
  convertContract(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ConvertLeadContractDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.marketing.convertContract(id, dto, user);
  }
}
