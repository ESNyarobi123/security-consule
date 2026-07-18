import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '@pssms/shared';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  @Get()
  @Public()
  @ApiOperation({ summary: 'Reporting service health' })
  health() {
    return {
      status: 'ok',
      service: 'reporting-service',
      timestamp: new Date().toISOString(),
    };
  }
}
