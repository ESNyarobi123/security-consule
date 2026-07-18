import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { NotificationStatus, OutboxStatus } from '@prisma/client';
import { PrismaService } from '@pssms/shared';
import { ConsoleSmsProvider } from '../adapters/messaging/console-sms.provider';
import { VisionAiAnprAdapter } from '../adapters/anpr/vision-ai-anpr.adapter';

@Injectable()
export class DispatchService {
  private readonly logger = new Logger(DispatchService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly sms: ConsoleSmsProvider,
    private readonly anpr: VisionAiAnprAdapter,
  ) {}

  async dispatch(body: { type: string; id: string }) {
    if (body.type === 'notification' || body.type === 'outbox') {
      const outbox = await this.prisma.integrationOutbox.findFirst({
        where: {
          OR: [{ id: body.id }, { aggregateId: body.id }],
          status: OutboxStatus.PENDING,
        },
      });
      if (!outbox) throw new NotFoundException('Outbox entry not found');

      if (outbox.eventType === 'notification.requested') {
        const notification = await this.prisma.notification.findUnique({
          where: { id: outbox.aggregateId },
        });
        if (!notification) throw new NotFoundException('Notification not found');

        const start = Date.now();
        await this.prisma.notification.update({
          where: { id: notification.id },
          data: { status: NotificationStatus.DISPATCHING },
        });

        const result = await this.sms.send({
          recipient: notification.recipient,
          body: notification.body,
          correlationId: notification.correlationId ?? undefined,
        });

        const attemptNumber =
          (await this.prisma.notificationDeliveryAttempt.count({
            where: { notificationId: notification.id },
          })) + 1;

        await this.prisma.$transaction([
          this.prisma.notificationDeliveryAttempt.create({
            data: {
              notificationId: notification.id,
              attemptNumber,
              provider: 'console-sms',
              providerMessageId: result.messageId,
              status: result.status,
              durationMs: Date.now() - start,
            },
          }),
          this.prisma.notification.update({
            where: { id: notification.id },
            data: {
              status: NotificationStatus.SENT,
              sentAt: new Date(),
            },
          }),
          this.prisma.integrationOutbox.update({
            where: { id: outbox.id },
            data: { status: OutboxStatus.PUBLISHED, publishedAt: new Date() },
          }),
          this.prisma.integrationRequestLog.create({
            data: {
              organizationId: notification.organizationId,
              provider: 'console-sms',
              direction: 'OUTBOUND',
              correlationId: notification.correlationId,
              statusCode: 200,
              durationMs: Date.now() - start,
              summary: `SMS to ${notification.recipient}`,
            },
          }),
        ]);

        return { dispatched: true, notificationId: notification.id };
      }

      await this.prisma.integrationOutbox.update({
        where: { id: outbox.id },
        data: { status: OutboxStatus.PUBLISHED, publishedAt: new Date() },
      });
      return { dispatched: true, eventType: outbox.eventType };
    }

    throw new NotFoundException('Unknown dispatch type');
  }

  async recognizeAnpr(body: Record<string, unknown>) {
    return this.anpr.recognize({
      imageUrl: typeof body.image_url === 'string' ? body.image_url : undefined,
      cameraId: typeof body.camera_id === 'string' ? body.camera_id : undefined,
      siteId: typeof body.site_id === 'string' ? body.site_id : undefined,
      plateHint: typeof body.plate_hint === 'string' ? body.plate_hint : undefined,
    });
  }
}
