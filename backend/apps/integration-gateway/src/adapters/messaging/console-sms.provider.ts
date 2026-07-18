import { Injectable, Logger } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';

export interface SmsSendInput {
  recipient: string;
  body: string;
  correlationId?: string;
}

export interface SmsSendResult {
  messageId: string;
  status: 'SENT' | 'FAILED';
}

@Injectable()
export class ConsoleSmsProvider {
  private readonly logger = new Logger(ConsoleSmsProvider.name);

  async send(input: SmsSendInput): Promise<SmsSendResult> {
    const messageId = uuidv4();
    this.logger.log(
      `[SMS] to=${input.recipient} correlation=${input.correlationId ?? '-'} body=${input.body}`,
    );
    return { messageId, status: 'SENT' };
  }
}
