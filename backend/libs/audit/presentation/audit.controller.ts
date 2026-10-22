import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiProperty,
  ApiPropertyOptional,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import {
  AuthUser,
  CurrentUser,
  PermissionsGuard,
  RequirePermissions,
} from '@pssms/shared';
import { AuditEntry, AuditService } from '../application/audit.service';

class AuditFieldChangeDto {
  @ApiProperty() field!: string;
  @ApiProperty() label!: string;
  @ApiPropertyOptional({ nullable: true }) from?: string | null;
  @ApiPropertyOptional({ nullable: true }) to?: string | null;
}

class AuditLogResponseDto {
  @ApiProperty() id!: string;
  @ApiPropertyOptional({ nullable: true }) organizationId?: string | null;
  @ApiPropertyOptional({ nullable: true }) actorId?: string | null;
  @ApiPropertyOptional({ nullable: true }) actorName?: string | null;
  @ApiPropertyOptional({ nullable: true }) actorEmail?: string | null;
  @ApiProperty({ type: [String] }) actorRoles!: string[];
  @ApiProperty() action!: string;
  @ApiProperty() actionLabel!: string;
  @ApiProperty() resourceType!: string;
  @ApiProperty() resourceLabel!: string;
  @ApiProperty({ required: false, nullable: true }) resourceId?: string | null;
  @ApiProperty({ description: 'Who did what, in one sentence' }) summary!: string;
  @ApiPropertyOptional({ nullable: true }) ipAddress?: string | null;
  @ApiPropertyOptional({ nullable: true }) requestId?: string | null;
  @ApiProperty({ type: [AuditFieldChangeDto] })
  changedFields!: AuditFieldChangeDto[];
  @ApiPropertyOptional({ nullable: true, type: Object })
  before?: unknown;
  @ApiPropertyOptional({ nullable: true, type: Object })
  after?: unknown;
  @ApiProperty() createdAt!: Date;
}

@ApiTags('Audit')
@ApiBearerAuth()
@UseGuards(PermissionsGuard)
@RequirePermissions('audit.read')
@Controller('audit')
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @Get('logs')
  @ApiOperation({
    summary: 'List recent audit logs (append-only)',
    description:
      'Newest audit entries for the current organization, enriched with the acting officer (name / email / roles) and the field-level delta between the before and after snapshots. Secrets are redacted.',
  })
  @ApiQuery({ name: 'take', required: false, example: 50 })
  @ApiQuery({ name: 'resourceType', required: false })
  @ApiQuery({ name: 'resourceId', required: false })
  @ApiQuery({ name: 'action', required: false, description: 'Substring match' })
  @ApiQuery({ name: 'actorId', required: false })
  @ApiQuery({ name: 'from', required: false, description: 'ISO date-time' })
  @ApiQuery({ name: 'to', required: false, description: 'ISO date-time' })
  @ApiOkResponse({ type: [AuditLogResponseDto] })
  list(
    @CurrentUser() user: AuthUser,
    @Query('take') take?: string,
    @Query('resourceType') resourceType?: string,
    @Query('resourceId') resourceId?: string,
    @Query('action') action?: string,
    @Query('actorId') actorId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ): Promise<AuditEntry[]> {
    return this.audit.list(user.organizationId, {
      take: take ? Number(take) : 50,
      resourceType,
      resourceId,
      action,
      actorId,
      from,
      to,
    });
  }

  @Get('logs/:id')
  @ApiOperation({
    summary: 'Single audit entry with full before/after payload',
    description:
      'Org-scoped. Used by the governance details drawer to show exactly what changed.',
  })
  @ApiOkResponse({ type: AuditLogResponseDto })
  get(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
  ): Promise<AuditEntry> {
    return this.audit.get(id, user.organizationId);
  }
}
