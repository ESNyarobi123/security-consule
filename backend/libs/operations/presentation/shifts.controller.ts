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
import { ShiftsService } from '../application/shifts.service';
import { CreateShiftDto, ShiftResponseDto } from './dto/operations.dto';

@ApiTags('Operations')
@ApiBearerAuth()
@Controller('operations/shifts')
export class ShiftsController {
  constructor(private readonly service: ShiftsService) {}

  @Post()
  @ApiOperation({ summary: 'Create shift with guard assignments' })
  @ApiCreatedResponse({ type: ShiftResponseDto })
  create(@Body() dto: CreateShiftDto, @CurrentUser() user: AuthUser) {
    return this.service.create(dto, user);
  }

  @Get()
  @ApiOperation({ summary: 'List shifts' })
  @ApiQuery({ name: 'siteId', required: false })
  @ApiOkResponse({ type: [ShiftResponseDto] })
  list(@CurrentUser() user: AuthUser, @Query('siteId') siteId?: string) {
    return this.service.list(user.organizationId, siteId);
  }
}
