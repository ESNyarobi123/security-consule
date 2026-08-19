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

  /**
   * Portal 35.13 — EMAIL interview notice when HR shortlists (console adapter OK).
   */
  async enqueueRecruitmentInterview(params: {
    organizationId: string;
    applicationId: string;
    applicantEmail?: string | null;
    applicantName: string;
    postingTitle: string;
    actorId: string;
  }): Promise<{ email: boolean }> {
    const email = params.applicantEmail?.trim();
    if (!email) return { email: false };
    const actor = {
      id: params.actorId,
      email: 'system@pssms',
      organizationId: params.organizationId,
      fullName: 'System',
      roles: [] as string[],
      permissions: [] as string[],
      allowedBranchIds: [] as string[],
      allowedSiteIds: [] as string[],
    };
    const body = [
      `Dear ${params.applicantName},`,
      '',
      `You have been shortlisted for interview for: ${params.postingTitle}.`,
      '',
      'HIGHLINK Recruitment will contact you on this email with the interview time and location.',
      'Track your application with your reference number on the careers portal.',
      '',
      '— HIGHLINK Investigation and Security Guard Company',
    ].join('\n');
    try {
      await this.enqueue(
        {
          channel: NotificationChannel.EMAIL,
          recipient: email,
          templateCode: 'RECRUITMENT_INTERVIEW',
          subject: `HIGHLINK interview — ${params.postingTitle}`,
          body,
          resourceType: 'JobApplication',
          resourceId: params.applicationId,
          idempotencyKey: `recruitment-interview-email-${params.applicationId}`,
        },
        actor,
      );
      return { email: true };
    } catch {
      return { email: false };
    }
  }

  /**
   * Module 12-C — enqueue gate code once per channel on host approve.
   * Idempotency keys are appointment+channel so approve never double-queues.
   */
  async enqueueVisitorGateCode(params: {
    organizationId: string;
    appointmentId: string;
    visitorPhone?: string | null;
    visitorEmail?: string | null;
    plainCode: string;
    siteName: string;
    validUntil: Date;
    actorId: string;
  }): Promise<{ email: boolean; sms: boolean; whatsapp: boolean }> {
    const body = `HIGHLINK gate code: ${params.plainCode}. Valid until ${params.validUntil.toISOString()}. Site: ${params.siteName}`;
    const emailBody = [
      'Your HIGHLINK visitor gate verification code has been issued.',
      '',
      `Code: ${params.plainCode}`,
      `Site: ${params.siteName}`,
      `Valid until: ${params.validUntil.toISOString()}`,
      '',
      'Present this code once at the gate. Do not share it.',
    ].join('\n');
    const actor = {
      id: params.actorId,
      email: 'system@pssms',
      organizationId: params.organizationId,
      fullName: 'System',
      roles: [] as string[],
      permissions: [] as string[],
      allowedBranchIds: [] as string[],
      allowedSiteIds: [] as string[],
    };
    const delivery = { email: false, sms: false, whatsapp: false };
    const email = params.visitorEmail?.trim();
    const phone = params.visitorPhone?.trim();

    if (email) {
      try {
        await this.enqueue(
          {
            channel: NotificationChannel.EMAIL,
            recipient: email,
            templateCode: 'VISITOR_GATE_CODE',
            subject: `HIGHLINK gate code — ${params.siteName}`,
            body: emailBody,
            resourceType: 'VisitorAppointment',
            resourceId: params.appointmentId,
            idempotencyKey: `visitor-code-email-${params.appointmentId}`,
          },
          actor,
        );
        delivery.email = true;
      } catch {
        // Channel enqueue must not block other channels
      }
    }

    if (phone) {
      try {
        await this.enqueue(
          {
            channel: NotificationChannel.SMS,
            recipient: phone,
            templateCode: 'VISITOR_GATE_CODE',
            body,
            resourceType: 'VisitorAppointment',
            resourceId: params.appointmentId,
            idempotencyKey: `visitor-code-sms-${params.appointmentId}`,
          },
          actor,
        );
        delivery.sms = true;
      } catch {
        // keep going
      }

      try {
        await this.enqueue(
          {
            channel: NotificationChannel.WHATSAPP,
            recipient: phone,
            templateCode: 'VISITOR_GATE_CODE',
            body,
            resourceType: 'VisitorAppointment',
            resourceId: params.appointmentId,
            idempotencyKey: `visitor-code-whatsapp-${params.appointmentId}`,
          },
          actor,
        );
        delivery.whatsapp = true;
      } catch {
        // keep going
      }
    }

    return delivery;
  }

  /**
   * Module 12-E — notify appointment host when gate verify denies a known code.
   * Idempotency keys are entry+channel so retries never double-queue.
   */
  async enqueueVisitorGateDeniedHost(params: {
    organizationId: string;
    entryId: string;
    appointmentId: string;
    hostPhone?: string | null;
    hostEmail?: string | null;
    visitorName: string;
    result: string;
    denyReason?: string | null;
    siteName: string;
    referenceNumber: string;
    actorId: string;
  }): Promise<{ email: boolean; sms: boolean }> {
    const reason = params.denyReason?.trim() || params.result;
    const smsBody = `HIGHLINK: visitor ${params.visitorName} denied at ${params.siteName} (${params.result}: ${reason}). Ref ${params.referenceNumber}.`;
    const emailBody = [
      'A visitor gate verification was denied at your site.',
      '',
      `Visitor: ${params.visitorName}`,
      `Result: ${params.result}`,
      `Reason: ${reason}`,
      `Site: ${params.siteName}`,
      `Reference: ${params.referenceNumber}`,
      '',
      'Contact Branch Ops if this was unexpected.',
    ].join('\n');
    const actor = {
      id: params.actorId,
      email: 'system@pssms',
      organizationId: params.organizationId,
      fullName: 'System',
      roles: [] as string[],
      permissions: [] as string[],
      allowedBranchIds: [] as string[],
      allowedSiteIds: [] as string[],
    };
    const delivery = { email: false, sms: false };
    const email = params.hostEmail?.trim();
    const phone = params.hostPhone?.trim();

    if (email) {
      try {
        await this.enqueue(
          {
            channel: NotificationChannel.EMAIL,
            recipient: email,
            templateCode: 'VISITOR_GATE_DENIED_HOST',
            subject: `HIGHLINK visitor denied — ${params.siteName}`,
            body: emailBody,
            resourceType: 'VisitorEntry',
            resourceId: params.entryId,
            idempotencyKey: `visitor-deny-host-email-${params.entryId}`,
          },
          actor,
        );
        delivery.email = true;
      } catch {
        // Channel enqueue must not block other channels
      }
    }

    if (phone) {
      try {
        await this.enqueue(
          {
            channel: NotificationChannel.SMS,
            recipient: phone,
            templateCode: 'VISITOR_GATE_DENIED_HOST',
            body: smsBody,
            resourceType: 'VisitorEntry',
            resourceId: params.entryId,
            idempotencyKey: `visitor-deny-host-sms-${params.entryId}`,
          },
          actor,
        );
        delivery.sms = true;
      } catch {
        // keep going
      }
    }

    return delivery;
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
