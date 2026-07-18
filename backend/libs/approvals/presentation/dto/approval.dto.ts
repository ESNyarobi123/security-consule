import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class StartApprovalDto {
  @ApiProperty({ example: 'contract-approval' })
  @IsString()
  workflowCode!: string;

  @ApiProperty({ example: 'Contract' })
  @IsString()
  resourceType!: string;

  @ApiProperty()
  @IsString()
  resourceId!: string;

  @ApiPropertyOptional({ example: 4500000 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  amount?: number;
}

export class ApprovalActionDto {
  @ApiProperty({ enum: ['APPROVE', 'REJECT'] })
  @IsEnum(['APPROVE', 'REJECT'] as const)
  decision!: 'APPROVE' | 'REJECT';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  remarks?: string;
}

export class ApprovalInstanceResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() resourceType!: string;
  @ApiProperty() resourceId!: string;
  @ApiProperty() status!: string;
  @ApiProperty() currentStepOrder!: number;
  @ApiProperty() createdBy!: string;
  @ApiProperty() createdAt!: Date;
}
