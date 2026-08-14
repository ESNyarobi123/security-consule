import {
  Body,
  Controller,
  Get,
  Param,
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
  RequireAnyPermissions,
} from '@pssms/shared';
import { GatesService } from '../application/gates.service';
import {
  CreateGateDto,
  GateResponseDto,
  UpdateGateDto,
} from './dto/enterprise.dto';

@ApiTags('Enterprise')
@ApiBearerAuth()
@UseGuards(PermissionsGuard)
@RequireAnyPermissions('enterprise.manage', 'operations.manage')
@Controller('enterprise/gates')
export class GatesController {
  constructor(private readonly service: GatesService) {}

  @Post()
  @ApiOperation({ summary: 'Create site gate (access point)' })
  @ApiCreatedResponse({ type: GateResponseDto })
  create(@Body() dto: CreateGateDto, @CurrentUser() user: AuthUser) {
    return this.service.create(dto, user);
  }

  @Get()
  @ApiOperation({ summary: 'List site gates (access points)' })
  @ApiQuery({ name: 'siteId', required: false })
  @ApiQuery({
    name: 'active',
    required: false,
    description: 'true|false — omit for all statuses',
  })
  @ApiOkResponse({ type: [GateResponseDto] })
  list(
    @CurrentUser() user: AuthUser,
    @Query('siteId') siteId?: string,
    @Query('active') active?: string,
  ) {
    let activeFilter: boolean | undefined;
    if (active === 'true') activeFilter = true;
    else if (active === 'false') activeFilter = false;
    return this.service.list(
      user.organizationId,
      user,
      siteId,
      activeFilter,
    );
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update gate name/type/active' })
  @ApiOkResponse({ type: GateResponseDto })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateGateDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.update(id, dto, user);
  }
}
