import { Body, Controller, Param, Post, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { PaymentMethod } from '@prisma/client';
import { ServiceTokenGuard, AuthUser, PrismaService, Public } from '@pssms/shared';
import { InvoicesService } from '@pssms/finance';
import { ParkingService } from '@pssms/parking';

@ApiTags('Internal')
@Controller('internal/v1')
@Public()
@UseGuards(ServiceTokenGuard)
export class InternalController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly invoices: InvoicesService,
    private readonly parking: ParkingService,
  ) {}

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
