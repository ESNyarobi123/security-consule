import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { AuthUser, CurrentUser } from '@pssms/shared';
import { GatesService } from '../application/gates.service';
import { CreateGateDto, GateResponseDto } from './dto/enterprise.dto';

@ApiTags('Enterprise')
@ApiBearerAuth()
@Controller('enterprise/gates')
export class GatesController {
  constructor(private readonly service: GatesService) {}

  @Post()
  @ApiOperation({ summary: 'Create site gate' })
  @ApiCreatedResponse({ type: GateResponseDto })
  create(@Body() dto: CreateGateDto, @CurrentUser() user: AuthUser) {
    return this.service.create(dto, user);
  }

  @Get()
  @ApiOperation({ summary: 'List site gates' })
  @ApiQuery({ name: 'siteId', required: false })
  @ApiOkResponse({ type: [GateResponseDto] })
  list(@CurrentUser() user: AuthUser, @Query('siteId') siteId?: string) {
    return this.service.list(user.organizationId, siteId);
  }
}
