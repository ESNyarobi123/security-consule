import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@pssms/shared';
import { v4 as uuidv4 } from 'uuid';

export interface OutboxWriteInput {
  organizationId: string;
  eventType: string;
  aggregateType: string;
  aggregateId: string;
  payload: Record<string, unknown>;
  idempotencyKey?: string;
}

@Injectable()
export class OutboxWriterService {
  constructor(private readonly prisma: PrismaService) {}

  async write(
    input: OutboxWriteInput,
    tx?: Prisma.TransactionClient,
  ): Promise<void> {
    const client = tx ?? this.prisma;
    await client.integrationOutbox.create({
      data: {
        organizationId: input.organizationId,
        eventType: input.eventType,
        aggregateType: input.aggregateType,
        aggregateId: input.aggregateId,
        payload: input.payload as Prisma.InputJsonValue,
        idempotencyKey: input.idempotencyKey ?? uuidv4(),
      },
    });
  }
}
