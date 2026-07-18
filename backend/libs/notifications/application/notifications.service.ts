import { Injectable, NotFoundException } from '@nestjs/common';
import {
  NotificationChannel,
  NotificationStatus,
  Prisma,
} from '@prisma/client';
import { PrismaService, AuthUser } from '@pssms/shared';
import { v4 as uuidv4 } from 'uuid';
import { OutboxWriterService } from './outbox-writer.service';
import {
  DeliveryAttemptDto,
  EnqueueNotificationDto,
  NotificationResponseDto,
} from '../presentation/dto/notifications.dto';

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly outbox: OutboxWriterService,
  ) {}

  async enqueue(
    dto: EnqueueNotificationDto,
    user: AuthUser,
  ): Promise<NotificationResponseDto> {
    const idempotencyKey =
      dto.idempotencyKey ?? `notif-${dto.templateCode}-${uuidv4()}`;

    const notification = await this.prisma.$transaction(async (tx) => {
      const row = await tx.notification.create({
        data: {
          organizationId: user.organizationId,
          templateCode: dto.templateCode,
          channel: dto.channel,
          recipient: dto.recipient,
          subject: dto.subject,
          body: dto.body,
          payload: dto as unknown as Prisma.InputJsonValue,
          resourceType: dto.resourceType,
          resourceId: dto.resourceId,
          idempotencyKey,
          correlationId: uuidv4(),
        },
      });

      await this.outbox.write(
        {
          organizationId: user.organizationId,
          eventType: 'notification.requested',
          aggregateType: 'Notification',
          aggregateId: row.id,
          payload: {
            notificationId: row.id,
            channel: row.channel,
            recipient: row.recipient,
          },
          idempotencyKey: `outbox-${idempotencyKey}`,
        },
        tx,
      );

      return row;
    });

    return this.toDto(notification);
  }

  async enqueueVisitorGateCode(params: {
    organizationId: string;
    appointmentId: string;
    visitorPhone: string;
    plainCode: string;
    siteName: string;
    validUntil: Date;
    actorId: string;
  }): Promise<NotificationResponseDto> {
    const body = `HIGHLINK gate code: ${params.plainCode}. Valid until ${params.validUntil.toISOString()}. Site: ${params.siteName}`;
    return this.enqueue(
      {
        channel: NotificationChannel.SMS,
        recipient: params.visitorPhone,
        templateCode: 'VISITOR_GATE_CODE',
        body,
        resourceType: 'VisitorAppointment',
        resourceId: params.appointmentId,
        idempotencyKey: `visitor-code-${params.appointmentId}`,
      },
      {
        id: params.actorId,
        email: 'system@pssms',
        organizationId: params.organizationId,
        fullName: 'System',
        roles: [],
        permissions: [],
        allowedBranchIds: [],
        allowedSiteIds: [],
      },
    );
  }

  async getById(
    id: string,
    organizationId: string,
  ): Promise<NotificationResponseDto> {
    const row = await this.prisma.notification.findFirst({
      where: { id, organizationId },
    });
    if (!row) throw new NotFoundException('Notification not found');
    return this.toDto(row);
  }

  async list(
    organizationId: string,
    status?: NotificationStatus,
  ): Promise<NotificationResponseDto[]> {
    const rows = await this.prisma.notification.findMany({
      where: {
        organizationId,
        ...(status ? { status } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return rows.map((r) => this.toDto(r));
  }

  async listAttempts(
    notificationId: string,
    organizationId: string,
  ): Promise<DeliveryAttemptDto[]> {
    const notification = await this.prisma.notification.findFirst({
      where: { id: notificationId, organizationId },
    });
    if (!notification) return [];

    const rows = await this.prisma.notificationDeliveryAttempt.findMany({
      where: { notificationId },
      orderBy: { attemptNumber: 'asc' },
    });
    return rows.map((a) => ({
      id: a.id,
      attemptNumber: a.attemptNumber,
      provider: a.provider,
      providerMessageId: a.providerMessageId,
      status: a.status,
      errorMessage: a.errorMessage,
      createdAt: a.createdAt,
    }));
  }

  async markDispatched(
    id: string,
    provider: string,
    providerMessageId: string,
    durationMs: number,
  ): Promise<void> {
    const notification = await this.prisma.notification.findUnique({
      where: { id },
    });
    if (!notification) return;

    const attemptNumber =
      (await this.prisma.notificationDeliveryAttempt.count({
        where: { notificationId: id },
      })) + 1;

    await this.prisma.$transaction([
      this.prisma.notificationDeliveryAttempt.create({
        data: {
          notificationId: id,
          attemptNumber,
          provider,
          providerMessageId,
          status: 'SENT',
          durationMs,
        },
      }),
      this.prisma.notification.update({
        where: { id },
        data: { status: NotificationStatus.SENT, sentAt: new Date() },
      }),
      this.prisma.integrationRequestLog.create({
        data: {
          organizationId: notification.organizationId,
          provider,
          direction: 'OUTBOUND',
          correlationId: notification.correlationId,
          statusCode: 200,
          durationMs,
          summary: `SMS to ${notification.recipient}`,
        },
      }),
    ]);
  }

  private toDto(row: {
    id: string;
    organizationId: string;
    templateCode: string;
    channel: NotificationChannel;
    recipient: string;
    subject: string | null;
    body: string;
    status: NotificationStatus;
    resourceType: string | null;
    resourceId: string | null;
    sentAt: Date | null;
    createdAt: Date;
  }): NotificationResponseDto {
    return {
      id: row.id,
      organizationId: row.organizationId,
      templateCode: row.templateCode,
      channel: row.channel,
      recipient: row.recipient,
      subject: row.subject,
      body: row.body,
      status: row.status,
      resourceType: row.resourceType,
      resourceId: row.resourceId,
      sentAt: row.sentAt,
      createdAt: row.createdAt,
    };
  }
}
