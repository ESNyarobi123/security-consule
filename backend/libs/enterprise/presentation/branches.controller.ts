import { Body, Controller, Get, Post } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { AuthUser, CurrentUser } from '@pssms/shared';
import { BranchesService } from '../application/branches.service';
import { BranchResponseDto, CreateBranchDto } from './dto/enterprise.dto';

@ApiTags('Enterprise')
@ApiBearerAuth()
@Controller('enterprise/branches')
export class BranchesController {
  constructor(private readonly service: BranchesService) {}

  @Post()
  @ApiOperation({ summary: 'Create branch' })
  @ApiCreatedResponse({ type: BranchResponseDto })
  create(@Body() dto: CreateBranchDto, @CurrentUser() user: AuthUser) {
    return this.service.create(dto, user);
  }

  @Get()
  @ApiOperation({ summary: 'List branches' })
  @ApiOkResponse({ type: [BranchResponseDto] })
  list(@CurrentUser() user: AuthUser) {
    return this.service.list(user.organizationId);
  }
}
