import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsString } from 'class-validator';

export class CreateOccurrenceDto {
  @ApiProperty() @IsString() siteId!: string;
  @ApiProperty({ example: 'VISITOR_ISSUE' }) @IsString() category!: string;
  @ApiProperty() @IsString() description!: string;
  @ApiProperty() @IsDateString() recordedAt!: string;
}

export class CorrectOccurrenceDto {
  @ApiProperty() @IsString() reason!: string;
  @ApiProperty() @IsString() description!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() category?: string;
}

export class OccurrenceResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() siteId!: string;
  @ApiProperty() category!: string;
  @ApiProperty() description!: string;
  @ApiProperty() version!: number;
  @ApiProperty() isCurrent!: boolean;
  @ApiProperty() recordedAt!: Date;
}
