import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { AuthUser, CurrentUser } from '@pssms/shared';
import { AssetsService } from '../application/assets.service';
import {
  AssetAssignmentResponseDto,
  AssetResponseDto,
  AssignAssetDto,
  CreateAssetDto,
} from './dto/assets.dto';

@ApiTags('Assets')
@ApiBearerAuth()
@Controller('assets')
export class AssetsController {
  constructor(private readonly service: AssetsService) {}

  @Post()
  @ApiOperation({ summary: 'Register asset' })
  @ApiCreatedResponse({ type: AssetResponseDto })
  create(@Body() dto: CreateAssetDto, @CurrentUser() user: AuthUser) {
    return this.service.create(dto, user);
  }

  @Get()
  @ApiOperation({ summary: 'List assets' })
  @ApiOkResponse({ type: [AssetResponseDto] })
  list(@CurrentUser() user: AuthUser) {
    return this.service.list(user.organizationId);
  }

  @Post(':id/assign')
  @ApiOperation({ summary: 'Assign asset to employee or guard' })
  @ApiCreatedResponse({ type: AssetAssignmentResponseDto })
  assign(
    @Param('id') id: string,
    @Body() dto: AssignAssetDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.assign(id, dto, user);
  }

  @Post(':id/return')
  @ApiOperation({ summary: 'Return assigned asset' })
  @ApiOkResponse({ type: AssetAssignmentResponseDto })
  returnAsset(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.returnAsset(id, user);
  }
}
