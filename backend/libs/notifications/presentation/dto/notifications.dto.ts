import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { NotificationChannel, NotificationStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';

export class EnqueueNotificationDto {
  @ApiProperty({ enum: NotificationChannel })
  @IsEnum(NotificationChannel)
  channel!: NotificationChannel;

  @ApiProperty()
  @IsString()
  recipient!: string;

  @ApiProperty()
  @IsString()
  templateCode!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  subject?: string;

  @ApiProperty()
  @IsString()
  body!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  resourceType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  resourceId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  idempotencyKey?: string;
}

export class NotificationResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() organizationId!: string;
  @ApiProperty() templateCode!: string;
  @ApiProperty({ enum: NotificationChannel }) channel!: NotificationChannel;
  @ApiProperty() recipient!: string;
  @ApiPropertyOptional() subject?: string | null;
  @ApiProperty() body!: string;
  @ApiProperty({ enum: NotificationStatus }) status!: NotificationStatus;
  @ApiPropertyOptional() resourceType?: string | null;
  @ApiPropertyOptional() resourceId?: string | null;
  @ApiPropertyOptional() sentAt?: Date | null;
  @ApiProperty() createdAt!: Date;
}

export class DeliveryAttemptDto {
  @ApiProperty() id!: string;
  @ApiProperty() attemptNumber!: number;
  @ApiProperty() provider!: string;
  @ApiPropertyOptional() providerMessageId?: string | null;
  @ApiProperty() status!: string;
  @ApiPropertyOptional() errorMessage?: string | null;
  @ApiProperty() createdAt!: Date;
}
