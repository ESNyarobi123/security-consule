import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ApiMetaDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  requestId!: string;

  @ApiProperty({ example: '2026-07-14T17:00:00.000Z' })
  timestamp!: string;
}

export class ApiSuccessResponseDto<T = unknown> {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty()
  data!: T;

  @ApiProperty({ type: ApiMetaDto })
  meta!: ApiMetaDto;
}

export class ApiErrorBodyDto {
  @ApiProperty({ example: 'VALIDATION_ERROR' })
  code!: string;

  @ApiProperty({ example: 'Validation failed' })
  message!: string;

  @ApiPropertyOptional({ type: [Object] })
  details?: unknown[];
}

export class ApiErrorResponseDto {
  @ApiProperty({ example: false })
  success!: false;

  @ApiProperty({ type: ApiErrorBodyDto })
  error!: ApiErrorBodyDto;

  @ApiProperty({ type: ApiMetaDto })
  meta!: ApiMetaDto;
}
