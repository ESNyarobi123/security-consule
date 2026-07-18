import { Body, Controller, Get, Post } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { AuthUser, CurrentUser } from '@pssms/shared';
import { DeploymentsService } from '../application/deployments.service';
import {
  CreateDeploymentDto,
  DeploymentResponseDto,
} from './dto/operations.dto';

@ApiTags('Operations')
@ApiBearerAuth()
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
}
