import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import {
  AuthUser,
  CurrentUser,
  PermissionsGuard,
  RequirePermissions,
  resolveCustomerScope,
} from '@pssms/shared';
import { ContractsService } from '../application/contracts.service';
import {
  ContractResponseDto,
  CreateContractDto,
  RejectContractDto,
  ReplaceContractSitesDto,
  UpdateContractStatusDto,
} from './dto/contract.dto';

function assertStaff(user: AuthUser) {
  if (user.customerId) {
    throw new ForbiddenException({
      error: 'CUSTOMER_PORTAL_DENIED',
      message: 'Staff-only contracts operation',
    });
  }
}

@ApiTags('Contracts')
@ApiBearerAuth()
@Controller('contracts')
export class ContractsController {
  constructor(private readonly service: ContractsService) {}

  @Post()
  @UseGuards(PermissionsGuard)
  @RequirePermissions('contracts.manage')
  @ApiOperation({ summary: 'Create contract (starts as DRAFT)' })
  @ApiCreatedResponse({ type: ContractResponseDto })
  create(@Body() dto: CreateContractDto, @CurrentUser() user: AuthUser) {
    assertStaff(user);
    return this.service.create(dto, user);
  }

  @Get('commercial-alerts')
  @UseGuards(PermissionsGuard)
  @RequirePermissions('contracts.manage')
  @ApiOperation({
    summary: 'Expiring contracts + customers with open invoice balances',
  })
  commercialAlerts(@CurrentUser() user: AuthUser) {
    assertStaff(user);
    return this.service.commercialAlerts(user.organizationId);
  }

  @Post('scan-expiring')
  @UseGuards(PermissionsGuard)
  @RequirePermissions('contracts.manage')
  @ApiOperation({
    summary: 'Mark ACTIVE contracts within N days as EXPIRING + queue EMAIL',
    description:
      'Default horizon 90 days. Idempotent EMAIL per contract end date. Also callable by background-worker via internal route.',
  })
  @ApiQuery({ name: 'daysAhead', required: false, type: Number })
  scanExpiring(
    @CurrentUser() user: AuthUser,
    @Query('daysAhead') daysAhead?: string,
  ) {
    assertStaff(user);
    const days = daysAhead ? Number(daysAhead) : 90;
    return this.service.scanExpiring(
      user.organizationId,
      user,
      Number.isFinite(days) && days > 0 ? days : 90,
    );
  }

  @Get()
  @ApiOperation({ summary: 'List contracts (customer-portal users are force-scoped)' })
  @ApiQuery({ name: 'customerId', required: false })
  @ApiOkResponse({ type: [ContractResponseDto] })
  list(
    @CurrentUser() user: AuthUser,
    @Query('customerId') customerId?: string,
  ) {
    const scoped = resolveCustomerScope(user, customerId);
    return this.service.list(user.organizationId, scoped);
  }

  @Put(':id/sites')
  @UseGuards(PermissionsGuard)
  @RequirePermissions('contracts.manage')
  @ApiOperation({
    summary: 'Replace bound sites (DRAFT only)',
    description:
      'Full replace of ContractSite rows. Sites must belong to the contract customer + org.',
  })
  @ApiOkResponse({ type: ContractResponseDto })
  setSites(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReplaceContractSitesDto,
    @CurrentUser() user: AuthUser,
  ) {
    assertStaff(user);
    return this.service.setSites(id, dto.siteIds, user);
  }

  @Post(':id/submit')
  @UseGuards(PermissionsGuard)
  @RequirePermissions('contracts.manage')
  @ApiOperation({
    summary:
      'Submit DRAFT contract for multi-step contract-approval (Legal → GM → CEO → CMD@threshold)',
  })
  @ApiOkResponse({ type: ContractResponseDto })
  submit(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    assertStaff(user);
    return this.service.submit(id, user);
  }

  @Post(':id/approve')
  @UseGuards(PermissionsGuard)
  @RequirePermissions('contracts.manage')
  @ApiOperation({
    summary:
      'Approve current contract-approval step (role-gated; creator ≠ approver)',
  })
  @ApiOkResponse({ type: ContractResponseDto })
  approve(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    assertStaff(user);
    return this.service.approve(id, user);
  }

  @Post(':id/reject')
  @UseGuards(PermissionsGuard)
  @RequirePermissions('contracts.manage')
  @ApiOperation({
    summary: 'Reject pending contract → back to DRAFT for rework',
  })
  @ApiOkResponse({ type: ContractResponseDto })
  reject(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RejectContractDto,
    @CurrentUser() user: AuthUser,
  ) {
    assertStaff(user);
    return this.service.reject(id, dto.reason, user);
  }

  @Patch(':id/status')
  @UseGuards(PermissionsGuard)
  @RequirePermissions('contracts.manage')
  @ApiOperation({
    summary: 'Operational status change (APPROVED→ACTIVE, ACTIVE→TERMINATED, …)',
    description:
      'Does not replace submit/approve. DRAFT→ACTIVE is blocked — use approval workflow.',
  })
  @ApiOkResponse({ type: ContractResponseDto })
  updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateContractStatusDto,
    @CurrentUser() user: AuthUser,
  ) {
    assertStaff(user);
    return this.service.updateStatus(id, dto.status, user);
  }
}
