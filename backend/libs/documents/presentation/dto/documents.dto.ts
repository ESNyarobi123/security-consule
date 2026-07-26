import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID, MinLength } from 'class-validator';

export class ListDocumentsQueryDto {
  @ApiProperty({ example: 'OccurrenceEntry' })
  @IsString()
  @MinLength(2)
  resourceType!: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  resourceId!: string;
}

export class DocumentObjectResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  organizationId!: string;

  @ApiProperty()
  bucket!: string;

  @ApiProperty()
  objectKey!: string;

  @ApiProperty()
  fileName!: string;

  @ApiProperty()
  contentType!: string;

  @ApiProperty()
  sizeBytes!: number;

  @ApiProperty({ example: 'OccurrenceEntry' })
  resourceType!: string;

  @ApiProperty()
  resourceId!: string;

  @ApiProperty()
  uploadedBy!: string;

  @ApiPropertyOptional()
  checksum?: string | null;

  @ApiProperty()
  createdAt!: Date;
}

export class DocumentDownloadUrlResponseDto {
  @ApiProperty({ description: 'Short-lived presigned GET URL' })
  url!: string;

  @ApiProperty({ description: 'Seconds until URL expires' })
  expiresInSeconds!: number;

  @ApiProperty()
  fileName!: string;

  @ApiProperty()
  contentType!: string;
}
