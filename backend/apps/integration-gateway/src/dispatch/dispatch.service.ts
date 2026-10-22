import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { NotificationChannel, NotificationStatus, OutboxStatus } from '@prisma/client';
import { PrismaService } from '@pssms/shared';
import { VisionAiAnprAdapter } from '../adapters/anpr/vision-ai-anpr.adapter';
import { EmailSender } from '../adapters/messaging/email-sender';
import { SmsSender } from '../adapters/messaging/sms-sender';

type ChannelOutcome = {
  messageId: string;
  status: 'SENT' | 'FAILED';
  provider: string;
  error?: string;
  /** Config/permanent failure — record it but do not retry the outbox. */
  permanent?: boolean;
};

@Injectable()
export class DispatchService {
  private readonly logger = new Logger(DispatchService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly sms: SmsSender,
    private readonly email: EmailSender,
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

        // Already delivered (e.g. duplicate outbox row) — nothing to resend.
        if (
          notification.status === NotificationStatus.SENT &&
          notification.sentAt
        ) {
          await this.prisma.integrationOutbox.update({
            where: { id: outbox.id },
            data: { status: OutboxStatus.PUBLISHED, publishedAt: new Date() },
          });
          return {
            dispatched: true,
            notificationId: notification.id,
            skipped: 'already_sent',
          };
        }

        const start = Date.now();
        await this.prisma.notification.update({
          where: { id: notification.id },
          data: { status: NotificationStatus.DISPATCHING },
        });

        const result = await this.sendOnChannel(notification);
        const durationMs = Date.now() - start;
        const attemptNumber =
          (await this.prisma.notificationDeliveryAttempt.count({
            where: { notificationId: notification.id },
          })) + 1;

        await this.prisma.$transaction([
          this.prisma.notificationDeliveryAttempt.create({
            data: {
              notificationId: notification.id,
              attemptNumber,
              provider: result.provider,
              providerMessageId: result.status === 'SENT' ? result.messageId : null,
              status: result.status,
              errorMessage: result.error ?? null,
              durationMs,
            },
          }),
          this.prisma.notification.update({
            where: { id: notification.id },
            data:
              result.status === 'SENT'
                ? { status: NotificationStatus.SENT, sentAt: new Date() }
                : { status: NotificationStatus.FAILED },
          }),
          this.prisma.integrationRequestLog.create({
            data: {
              organizationId: notification.organizationId,
              provider: result.provider,
              direction: 'OUTBOUND',
              correlationId: notification.correlationId,
              statusCode: result.status === 'SENT' ? 200 : 502,
              durationMs,
              summary:
                result.status === 'SENT'
                  ? `${notification.channel} to ${notification.recipient}`
                  : `${notification.channel} to ${notification.recipient} FAILED: ${result.error ?? 'unknown'}`,
            },
          }),
        ]);

        if (result.status !== 'SENT') {
          if (result.permanent) {
            // Unsupported/misconfigured channel — mark published so the poller
            // does not retry forever, but keep the FAILED attempt visible.
            await this.prisma.integrationOutbox.update({
              where: { id: outbox.id },
              data: {
                status: OutboxStatus.PUBLISHED,
                publishedAt: new Date(),
                errorMessage: result.error ?? 'permanent failure',
              },
            });
            return {
              dispatched: false,
              notificationId: notification.id,
              provider: result.provider,
              channel: notification.channel,
              error: result.error,
            };
          }
          // Keep the outbox PENDING so the poller retries with backoff, and
          // surface the vendor error instead of silently marking it sent.
          throw new Error(
            `${result.provider} delivery failed: ${result.error ?? 'unknown error'}`,
          );
        }

        await this.prisma.integrationOutbox.update({
          where: { id: outbox.id },
          data: { status: OutboxStatus.PUBLISHED, publishedAt: new Date() },
        });

        return {
          dispatched: true,
          notificationId: notification.id,
          provider: result.provider,
          channel: notification.channel,
        };
      }

      await this.prisma.integrationOutbox.update({
        where: { id: outbox.id },
        data: { status: OutboxStatus.PUBLISHED, publishedAt: new Date() },
      });
      return { dispatched: true, eventType: outbox.eventType };
    }

    throw new NotFoundException('Unknown dispatch type');
  }

  private async sendOnChannel(notification: {
    channel: NotificationChannel;
    recipient: string;
    subject: string | null;
    body: string;
    correlationId: string | null;
  }): Promise<ChannelOutcome> {
    switch (notification.channel) {
      case NotificationChannel.SMS: {
        const result = await this.sms.send({
          recipient: notification.recipient,
          body: notification.body,
          correlationId: notification.correlationId ?? undefined,
        });
        this.logger.log(
          `${notification.channel} → ${result.provider} ${result.status}`,
        );
        return result;
      }
      case NotificationChannel.WHATSAPP: {
        if (
          !process.env.WHATSAPP_API_URL?.trim() ||
          !process.env.WHATSAPP_API_TOKEN?.trim()
        ) {
          return {
            messageId: '',
            status: 'FAILED',
            provider: 'whatsapp',
            error: 'WHATSAPP_NOT_CONFIGURED — set WHATSAPP_API_URL/TOKEN',
            permanent: true,
          };
        }
        const result = await this.sms.send({
          recipient: notification.recipient,
          body: notification.body,
          correlationId: notification.correlationId ?? undefined,
        });
        return { ...result, provider: 'whatsapp' };
      }
      case NotificationChannel.EMAIL: {
        const result = await this.email.send({
          recipient: notification.recipient,
          subject: notification.subject ?? 'HIGHLINK notification',
          body: notification.body,
          correlationId: notification.correlationId ?? undefined,
        });
        this.logger.log(`EMAIL → ${result.provider} ${result.status}`);
        return result;
      }
      default:
        return {
          messageId: '',
          status: 'FAILED',
          provider: 'unsupported',
          error: `Channel ${notification.channel} has no adapter`,
        };
    }
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
