import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { IclockService } from './iclock.service';

/**
 * Raw ZKTeco iClock endpoints served at the ROOT (excluded from the /api/v1
 * global prefix in main.ts) because terminals hard-code `/iclock/...` paths.
 * All responses are plain text per the protocol.
 */
@ApiExcludeController()
@Controller('iclock')
export class IclockController {
  constructor(private readonly iclock: IclockService) {}

  // Handshake (GET ?options=all) OR data upload (POST ?table=ATTLOG).
  @Get('cdata')
  cdataHandshake(@Query('SN') sn: string): string {
    return this.iclock.buildOptions(sn ?? 'UNKNOWN');
  }

  @Post('cdata')
  async cdataUpload(
    @Query('SN') sn: string,
    @Query('table') table: string,
    @Body() body: unknown,
  ): Promise<string> {
    const raw = typeof body === 'string' ? body : '';
    if ((table ?? '').toUpperCase() === 'ATTLOG') {
      return this.iclock.ingestAttlog(sn, raw);
    }
    // OPERLOG / BIODATA / options POST etc. — acknowledged, not yet routed.
    return 'OK';
  }

  @Get('getrequest')
  getRequest(@Query('SN') sn: string): Promise<string> {
    return this.iclock.getRequest(sn);
  }

  @Post('devicecmd')
  deviceCmd(@Query('SN') sn: string, @Body() body: unknown): Promise<string> {
    return this.iclock.deviceCmdResult(sn, body);
  }

  // Some firmwares call registry first; acknowledge with a minimal payload.
  @Get('registry')
  registryGet(@Query('SN') sn: string): string {
    return `RegistryCode=${sn ?? 'OK'}`;
  }

  @Post('registry')
  registryPost(@Query('SN') sn: string): string {
    return `RegistryCode=${sn ?? 'OK'}`;
  }
}
