import { Body, Controller, Get, Post } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { AuthUser, CurrentUser } from '@pssms/shared';
import { SitesService } from '../application/sites.service';
import { CreateSiteDto, SiteResponseDto } from './dto/enterprise.dto';

@ApiTags('Enterprise')
@ApiBearerAuth()
@Controller('enterprise/sites')
export class SitesController {
  constructor(private readonly service: SitesService) {}

  @Post()
  @ApiOperation({ summary: 'Create site (customer location / facility)' })
  @ApiCreatedResponse({ type: SiteResponseDto })
  create(@Body() dto: CreateSiteDto, @CurrentUser() user: AuthUser) {
    return this.service.create(dto, user);
  }

  @Get()
  @ApiOperation({ summary: 'List sites' })
  @ApiOkResponse({ type: [SiteResponseDto] })
  list(@CurrentUser() user: AuthUser) {
    return this.service.list(user.organizationId);
  }
}
