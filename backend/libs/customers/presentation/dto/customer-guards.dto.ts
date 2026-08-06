import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';

/** Module 6-L — staff assigned-guards roster query. */
export class CustomerGuardsQueryDto {
  @ApiPropertyOptional({
    enum: ['ACTIVE', 'ENDED', 'ALL'],
    description: 'Deployment status filter (default ACTIVE)',
  })
  @IsOptional()
  @IsIn(['ACTIVE', 'ENDED', 'ALL'])
  status?: 'ACTIVE' | 'ENDED' | 'ALL';
}

export class CustomerAssignedGuardResponseDto {
  @ApiProperty() deploymentId!: string;
  @ApiProperty() guardId!: string;
  @ApiProperty() guardNumber!: string;
  @ApiPropertyOptional() fullName!: string | null;
  @ApiProperty() guardStatus!: string;
  @ApiProperty() deploymentEligible!: boolean;
  @ApiProperty() siteId!: string;
  @ApiProperty() siteCode!: string;
  @ApiProperty() siteName!: string;
  @ApiPropertyOptional() contractId!: string | null;
  @ApiPropertyOptional() contractNumber!: string | null;
  @ApiProperty() deploymentStatus!: string;
  @ApiProperty() startDate!: string;
  @ApiPropertyOptional() endDate!: string | null;
}
