import { Injectable, NotFoundException } from '@nestjs/common';
import {
  NotificationChannel,
  NotificationStatus,
  Prisma,
} from '@prisma/client';
import {
  PrismaService,
  AuthUser,
  normalisePhone,
  resolveSmsTransport,
  SmsProviderCode,
} from '@pssms/shared';
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
    // Phone channels must be E.164 before they reach a vendor adapter.
    const recipient =
      dto.channel === NotificationChannel.SMS ||
      dto.channel === NotificationChannel.WHATSAPP
        ? (normalisePhone(dto.recipient) ?? dto.recipient)
        : dto.recipient;

    try {
      const notification = await this.prisma.$transaction(async (tx) => {
        const row = await tx.notification.create({
          data: {
            organizationId: user.organizationId,
            templateCode: dto.templateCode,
            channel: dto.channel,
            recipient,
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
    } catch (err) {
      // Re-approve / retry after a transient failure must be idempotent, not a
      // silent "channel skipped". Return the notification already queued.
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        const existing = await this.prisma.notification.findUnique({
          where: { idempotencyKey },
        });
        if (existing) return this.toDto(existing);
      }
      throw err;
    }
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
   * Portal 35.13 — EMAIL the formal offer (term sheet) to the applicant.
   * Idempotency is per offer issue (`offerVersion`) so re-issuing an amended
   * offer is delivered again while retries do not double-send.
   */
  async enqueueRecruitmentOffer(params: {
    organizationId: string;
    applicationId: string;
    applicantEmail?: string | null;
    applicantName: string;
    postingTitle: string;
    position: string;
    department?: string | null;
    employmentType?: string | null;
    salaryAmount?: string | null;
    currency?: string | null;
    startDate?: Date | null;
    expiresAt?: Date | null;
    message?: string | null;
    offerVersion: string;
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
    const money =
      params.salaryAmount && params.currency
        ? `${params.currency} ${params.salaryAmount}`
        : params.salaryAmount
          ? params.salaryAmount
          : 'To be confirmed';
    const body = [
      `Dear ${params.applicantName},`,
      '',
      `HIGHLINK is pleased to offer you the position of ${params.position}${
        params.department ? ` (${params.department})` : ''
      } for: ${params.postingTitle}.`,
      '',
      `Employment type: ${params.employmentType ?? 'To be confirmed'}`,
      `Monthly gross: ${money}`,
      `Proposed start date: ${
        params.startDate
          ? params.startDate.toISOString().slice(0, 10)
          : 'To be agreed'
      }`,
      `Respond by: ${
        params.expiresAt
          ? params.expiresAt.toISOString().slice(0, 10)
          : 'As soon as possible'
      }`,
      ...(params.message ? ['', params.message] : []),
      '',
      'ACCEPT or DECLINE on the careers portal using your reference number and this email address.',
      '',
      '— HIGHLINK Investigation and Security Guard Company',
    ].join('\n');
    try {
      await this.enqueue(
        {
          channel: NotificationChannel.EMAIL,
          recipient: email,
          templateCode: 'RECRUITMENT_OFFER',
          subject: `HIGHLINK offer — ${params.position}`,
          body,
          resourceType: 'JobApplication',
          resourceId: params.applicationId,
          idempotencyKey: `recruitment-offer-email-${params.applicationId}-${params.offerVersion}`,
        },
        actor,
      );
      return { email: true };
    } catch {
      return { email: false };
    }
  }

  /**
   * Portal 35.13 — tell the issuing officer the applicant answered the offer.
   */
  async enqueueRecruitmentOfferResponse(params: {
    organizationId: string;
    applicationId: string;
    recipientEmail?: string | null;
    applicantName: string;
    referenceNumber: string;
    postingTitle: string;
    position: string;
    decision: 'ACCEPT' | 'DECLINE';
    reason?: string | null;
    respondedAt: Date;
    actorId: string;
  }): Promise<{ email: boolean }> {
    const email = params.recipientEmail?.trim();
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
    const accepted = params.decision === 'ACCEPT';
    const body = [
      'Recruitment offer response',
      '',
      `Applicant: ${params.applicantName} (${params.referenceNumber})`,
      `Position: ${params.position} — ${params.postingTitle}`,
      `Decision: ${accepted ? 'ACCEPTED' : 'DECLINED'}`,
      `Responded at: ${params.respondedAt.toISOString()}`,
      params.reason ? `Reason: ${params.reason}` : '',
      '',
      accepted
        ? 'You can now complete the hire step in the HR applications inbox.'
        : 'The application has been withdrawn. No hire action is needed.',
      '',
      '— HIGHLINK Recruitment',
    ]
      .filter(Boolean)
      .join('\n');
    try {
      await this.enqueue(
        {
          channel: NotificationChannel.EMAIL,
          recipient: email,
          templateCode: 'RECRUITMENT_OFFER_RESPONSE',
          subject: `Offer ${accepted ? 'accepted' : 'declined'} — ${params.applicantName}`,
          body,
          resourceType: 'JobApplication',
          resourceId: params.applicationId,
          idempotencyKey: `recruitment-offer-response-email-${params.applicationId}-${params.respondedAt.toISOString()}`,
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
    /**
     * Resend adds a unique suffix (e.g. `r2`) so the per-channel idempotency
     * key stays appointment-scoped for the first approval yet a deliberate
     * resend is not swallowed as a duplicate.
     */
    idempotencySuffix?: string;
  }): Promise<{
    email: boolean;
    sms: boolean;
    whatsapp: boolean;
    smsRecipient: string | null;
    /** Transport that the integration gateway will use for this SMS. */
    smsProvider: SmsProviderCode;
    /** False when the transport is `console` / credentials are missing. */
    smsLive: boolean;
  }> {
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
    const suffix = params.idempotencySuffix ? `-${params.idempotencySuffix}` : '';
    const key = (channel: string) =>
      `visitor-code-${channel}-${params.appointmentId}${suffix}`;
    // WhatsApp has no adapter yet — queueing it would be delivered twice over
    // SMS by the dispatch fallback, so only queue when a real gateway is set.
    const whatsappEnabled = Boolean(
      process.env.WHATSAPP_API_URL?.trim() &&
        process.env.WHATSAPP_API_TOKEN?.trim(),
    );
    const smsTransport = resolveSmsTransport();
    const delivery = {
      email: false,
      sms: false,
      whatsapp: false,
      smsRecipient: normalisePhone(params.visitorPhone),
      smsProvider: smsTransport.provider,
      smsLive: smsTransport.live,
    };
    const email = params.visitorEmail?.trim();
    const phone = delivery.smsRecipient;

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
            idempotencyKey: key('email'),
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
            idempotencyKey: key('sms'),
          },
          actor,
        );
        delivery.sms = true;
      } catch {
        // keep going
      }

      if (!whatsappEnabled) return delivery;
      try {
        await this.enqueue(
          {
            channel: NotificationChannel.WHATSAPP,
            recipient: phone,
            templateCode: 'VISITOR_GATE_CODE',
            body,
            resourceType: 'VisitorAppointment',
            resourceId: params.appointmentId,
            idempotencyKey: key('whatsapp'),
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
