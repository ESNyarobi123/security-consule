import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { AuthUser, CurrentUser, resolveCustomerScope } from '@pssms/shared';
import { ContractsService } from '../application/contracts.service';
import {
  ContractResponseDto,
  CreateContractDto,
  UpdateContractStatusDto,
} from './dto/contract.dto';

@ApiTags('Contracts')
@ApiBearerAuth()
@Controller('contracts')
export class ContractsController {
  constructor(private readonly service: ContractsService) {}

  @Post()
  @ApiOperation({ summary: 'Create contract (starts as DRAFT)' })
  @ApiCreatedResponse({ type: ContractResponseDto })
  create(@Body() dto: CreateContractDto, @CurrentUser() user: AuthUser) {
    return this.service.create(dto, user);
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

  @Patch(':id/status')
  @ApiOperation({
    summary: 'Update contract status',
    description:
      'Transitions contract status and writes audit. Events: contract.approved / activated / terminated (wired to RabbitMQ in later phase).',
  })
  @ApiOkResponse({ type: ContractResponseDto })
  updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateContractStatusDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.updateStatus(id, dto.status, user);
  }
}
