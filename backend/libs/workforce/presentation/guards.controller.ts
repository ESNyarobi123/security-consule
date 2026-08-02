import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import {
  AuthUser,
  CurrentUser,
  PermissionsGuard,
  RequirePermissions,
} from '@pssms/shared';
import { GuardsService } from '../application/guards.service';
import {
  CreateGuardDto,
  GuardResponseDto,
  LinkableGuardUserDto,
  UpdateGuardReadinessDto,
  UpdateGuardStatusDto,
} from './dto/guard.dto';

@ApiTags('Guards')
@ApiBearerAuth()
@UseGuards(PermissionsGuard)
@RequirePermissions('operations.manage')
@Controller('guards')
export class GuardsController {
  constructor(private readonly service: GuardsService) {}

  @Post()
  @ApiOperation({ summary: 'Create guard profile (links IAM user)' })
  @ApiCreatedResponse({ type: GuardResponseDto })
  create(@Body() dto: CreateGuardDto, @CurrentUser() user: AuthUser) {
    return this.service.create(dto, user);
  }

  @Get()
  @ApiOperation({ summary: 'List guard profiles (ops-enriched)' })
  @ApiOkResponse({ type: [GuardResponseDto] })
  list(@CurrentUser() user: AuthUser) {
    return this.service.list(user.organizationId);
  }

  @Get('linkable-users')
  @ApiOperation({
    summary: 'Active org users without a GuardProfile (create picker)',
  })
  @ApiOkResponse({ type: [LinkableGuardUserDto] })
  listLinkableUsers(@CurrentUser() user: AuthUser) {
    return this.service.listLinkableUsers(user.organizationId, user);
  }

  @Patch(':id/status')
  @ApiOperation({
    summary:
      'Update guard status / deployment eligibility (G3: readiness incomplete does not hard-block)',
  })
  @ApiOkResponse({ type: GuardResponseDto })
  updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateGuardStatusDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.updateStatus(
      id,
      dto.status,
      dto.deploymentEligible,
      user,
    );
  }

  @Patch(':id/readiness')
  @ApiOperation({
    summary:
      'Thin G3 readiness checklist (training / clearance / firearm flags)',
  })
  @ApiOkResponse({ type: GuardResponseDto })
  updateReadiness(
    @Param('id') id: string,
    @Body() dto: UpdateGuardReadinessDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.updateReadiness(id, dto, user);
  }
}
