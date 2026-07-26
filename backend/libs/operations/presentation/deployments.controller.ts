import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
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
import { DeploymentsService } from '../application/deployments.service';
import {
  CreateDeploymentDto,
  DeploymentResponseDto,
} from './dto/operations.dto';

@ApiTags('Operations')
@ApiBearerAuth()
@UseGuards(PermissionsGuard)
@RequirePermissions('operations.manage')
@Controller('operations/deployments')
export class DeploymentsController {
  constructor(private readonly service: DeploymentsService) {}

  @Post()
  @ApiOperation({ summary: 'Deploy guard to customer site' })
  @ApiCreatedResponse({ type: DeploymentResponseDto })
  create(@Body() dto: CreateDeploymentDto, @CurrentUser() user: AuthUser) {
    return this.service.create(dto, user);
  }

  @Get()
  @ApiOperation({ summary: 'List guard deployments' })
  @ApiOkResponse({ type: [DeploymentResponseDto] })
  list(@CurrentUser() user: AuthUser) {
    return this.service.list(user.organizationId);
  }

  @Post(':id/end')
  @ApiOperation({
    summary: 'End an active deployment (idempotent if already ENDED)',
  })
  @ApiOkResponse({ type: DeploymentResponseDto })
  end(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.end(id, user);
  }
}
