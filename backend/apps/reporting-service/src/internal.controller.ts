import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { KpiPeriodGranularity } from '@prisma/client';
import {
  AuthUser,
  PrismaService,
  Public,
  ServiceTokenGuard,
} from '@pssms/shared';
import { KpiService } from '@pssms/reporting';

@ApiTags('Internal')
@Controller('internal/v1')
@Public()
@UseGuards(ServiceTokenGuard)
export class InternalController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly kpis: KpiService,
  ) {}

  @Post('reporting/kpi-refresh')
  @ApiOperation({ summary: 'Scheduled KPI refresh (background-worker)' })
  async refreshKpis(
    @Body()
    body: {
      organizationId: string;
      from?: string;
      to?: string;
      codes?: string[];
    },
  ) {
    const user = await this.systemUser(body.organizationId);
    const to = body.to ? new Date(body.to) : new Date();
    const from = body.from
      ? new Date(body.from)
      : new Date(to.getFullYear(), to.getMonth(), 1);
    return this.kpis.refresh(
      {
        from,
        to,
        codes: body.codes,
        granularity: KpiPeriodGranularity.DAY,
      },
      user,
      { scheduled: true },
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
