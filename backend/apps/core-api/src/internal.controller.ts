import { Body, Controller, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { PaymentMethod } from '@prisma/client';
import { ServiceTokenGuard, AuthUser, PrismaService, Public } from '@pssms/shared';
import { AlertnessService } from '@pssms/attendance';
import { ContractsService } from '@pssms/contracts';
import { InvoicesService } from '@pssms/finance';
import { ParkingService } from '@pssms/parking';
import { PatrolRoutesService } from '@pssms/operations';

@ApiTags('Internal')
@Controller('internal/v1')
@Public()
@UseGuards(ServiceTokenGuard)
export class InternalController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly invoices: InvoicesService,
    private readonly parking: ParkingService,
    private readonly contracts: ContractsService,
    private readonly alertness: AlertnessService,
    private readonly patrolRoutes: PatrolRoutesService,
  ) {}

  @Post('contracts/scan-expiring')
  @ApiOperation({
    summary: 'Scan org contracts nearing end date (background-worker)',
  })
  async scanExpiring(
    @Body() body: { organizationId: string; daysAhead?: number },
    @Query('daysAhead') daysAheadQuery?: string,
  ) {
    const user = await this.systemUser(body.organizationId);
    const days = body.daysAhead ?? (daysAheadQuery ? Number(daysAheadQuery) : 90);
    return this.contracts.scanExpiring(
      body.organizationId,
      user,
      Number.isFinite(days) && days > 0 ? days : 90,
    );
  }

  @Post('finance/invoices/scan-overdue')
  @ApiOperation({
    summary: 'Mark past-due invoices OVERDUE (background-worker)',
  })
  async scanOverdueInvoices(@Body() body: { organizationId: string }) {
    const user = await this.systemUser(body.organizationId);
    return this.invoices.scanOverdue(body.organizationId, user);
  }

  @Post('attendance/alertness/scan-missed')
  @ApiOperation({
    summary: 'Mark past-due alertness MISSED + FieldAlert (background-worker)',
  })
  async scanMissedAlertness(
    @Body() body: { organizationId: string; graceMinutes?: number },
    @Query('graceMinutes') graceQuery?: string,
  ) {
    const user = await this.systemUser(body.organizationId);
    const grace =
      body.graceMinutes ?? (graceQuery ? Number(graceQuery) : 0);
    return this.alertness.scanMissed(
      body.organizationId,
      user,
      Number.isFinite(grace) && grace >= 0 ? grace : 0,
    );
  }

  @Post('operations/patrol-routes/scan-missed')
  @ApiOperation({
    summary:
      'Mark past-due incomplete patrol routes MISSED + FieldAlert (background-worker)',
  })
  async scanMissedPatrolRoutes(
    @Body() body: { organizationId: string; graceMinutes?: number },
    @Query('graceMinutes') graceQuery?: string,
  ) {
    const user = await this.systemUser(body.organizationId);
    const grace =
      body.graceMinutes ?? (graceQuery ? Number(graceQuery) : 0);
    return this.patrolRoutes.scanMissed(
      body.organizationId,
      user,
      Number.isFinite(grace) && grace >= 0 ? grace : 0,
    );
  }

  @Post('finance/invoices/:id/payments')
  @ApiOperation({ summary: 'Record invoice payment (integration worker)' })
  async recordPayment(
    @Param('id') id: string,
    @Body()
    body: { organizationId: string; amount: number; paymentReference: string },
  ) {
    const user = await this.systemUser(body.organizationId);
    return this.invoices.recordPayment(
      id,
      {
        amount: body.amount,
        paymentReference: body.paymentReference,
        paymentMethod: PaymentMethod.BANK_TRANSFER,
      },
      user,
    );
  }

  @Post('parking/anpr-results')
  @ApiOperation({ summary: 'Ingest ANPR result (integration worker)' })
  async ingestAnpr(
    @Body()
    body: {
      organizationId: string;
      siteId: string;
      gateId?: string;
      plateNumber: string;
      confidence: number;
      cameraId?: string;
      imageUrl?: string;
      capturedAt: string;
      rawPayload?: Record<string, unknown>;
    },
  ) {
    const user = await this.systemUser(body.organizationId);
    return this.parking.ingestAnprResult(
      {
        siteId: body.siteId,
        gateId: body.gateId,
        plateNumber: body.plateNumber,
        confidence: body.confidence,
        cameraId: body.cameraId,
        imageUrl: body.imageUrl,
        capturedAt: body.capturedAt,
        rawPayload: body.rawPayload,
      },
      user,
    );
  }

  private async systemUser(organizationId: string): Promise<AuthUser> {
    const admin = await this.prisma.user.findFirst({
      where: { organizationId, email: 'admin@highlink.co.tz' },
      include: { roles: { include: { role: true } } },
    });
    if (!admin) throw new Error('System admin not found for org');
    return {
      id: admin.id,
      email: admin.email,
      organizationId: admin.organizationId,
      fullName: admin.fullName,
      roles: admin.roles.map((r) => r.role.code),
      permissions: [],
      allowedBranchIds: [],
      allowedSiteIds: [],
    };
  }
}
