import { Controller, Get, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiProperty,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { AuthUser, CurrentUser } from '@pssms/shared';
import { AuditService } from '../application/audit.service';

class AuditLogResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() action!: string;
  @ApiProperty() resourceType!: string;
  @ApiProperty({ required: false }) resourceId?: string | null;
  @ApiProperty() createdAt!: Date;
}

@ApiTags('Audit')
@ApiBearerAuth()
@Controller('audit')
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @Get('logs')
  @ApiOperation({
    summary: 'List recent audit logs (append-only)',
    description: 'Returns newest audit entries for the current organization.',
  })
  @ApiQuery({ name: 'take', required: false, example: 50 })
  @ApiOkResponse({ type: [AuditLogResponseDto] })
  list(@CurrentUser() user: AuthUser, @Query('take') take?: string) {
    return this.audit.list(user.organizationId, take ? Number(take) : 50);
  }
}
