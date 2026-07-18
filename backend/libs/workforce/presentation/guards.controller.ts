import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { AuthUser, CurrentUser } from '@pssms/shared';
import { GuardsService } from '../application/guards.service';
import {
  CreateGuardDto,
  GuardResponseDto,
  UpdateGuardStatusDto,
} from './dto/guard.dto';

@ApiTags('Guards')
@ApiBearerAuth()
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
  @ApiOperation({ summary: 'List guard profiles' })
  @ApiOkResponse({ type: [GuardResponseDto] })
  list(@CurrentUser() user: AuthUser) {
    return this.service.list(user.organizationId);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Update guard status / deployment eligibility' })
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
}
