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
import { PatrolService } from '../application/patrol.service';
import { PatrolScanDto } from './dto/attendance.dto';

@ApiTags('Patrols')
@ApiBearerAuth()
@Controller('attendance/patrols')
export class PatrolController {
  constructor(private readonly service: PatrolService) {}

  @Post('scan')
  @ApiOperation({
    summary: 'Record checkpoint scan (QR/NFC/GPS)',
    description: 'Dual verification: checkpoint code + GPS at scan time.',
  })
  @ApiCreatedResponse({ description: 'PatrolScan recorded' })
  scan(@Body() dto: PatrolScanDto, @CurrentUser() user: AuthUser) {
    return this.service.scan(dto, user);
  }

  @Get()
  @ApiOperation({ summary: 'List patrol scans' })
  @ApiQuery({ name: 'siteId', required: false })
  list(@CurrentUser() user: AuthUser, @Query('siteId') siteId?: string) {
    return this.service.list(user.organizationId, siteId);
  }
}
