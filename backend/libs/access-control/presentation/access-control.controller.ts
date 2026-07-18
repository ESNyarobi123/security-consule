import { Body, Controller, Get, Post, Query } from '@nestjs/common';
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
  requireCustomerScope,
  resolveCustomerScope,
} from '@pssms/shared';
import { AccessControlService } from '../application/access-control.service';
import {
  CreateAccessEntryDto,
  CreateCustomerEmployeeDto,
  CustomerEmployeeResponseDto,
  AccessEntryResponseDto,
} from './dto/access.dto';

@ApiTags('Access Control')
@ApiBearerAuth()
@Controller('access')
export class AccessControlController {
  constructor(private readonly service: AccessControlService) {}

  @Post('employees')
  @ApiOperation({ summary: 'Register customer employee for site access' })
  @ApiCreatedResponse({ type: CustomerEmployeeResponseDto })
  createEmployee(
    @Body() dto: CreateCustomerEmployeeDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.createEmployee(dto, user);
  }

  @Get('employees')
  @ApiOperation({
    summary: 'List customer employees (customer-scoped; portal users force-scoped)',
  })
  @ApiQuery({ name: 'customerId', required: false })
  @ApiOkResponse({ type: [CustomerEmployeeResponseDto] })
  listEmployees(
    @CurrentUser() user: AuthUser,
    @Query('customerId') customerId?: string,
  ) {
    const scoped = requireCustomerScope(user, customerId);
    return this.service.listEmployees(scoped, user);
  }

  @Post('entries')
  @ApiOperation({ summary: 'Record customer employee check-in/out' })
  @ApiCreatedResponse({ type: AccessEntryResponseDto })
  recordEntry(
    @Body() dto: CreateAccessEntryDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.recordEntry(dto, user);
  }

  @Get('entries')
  @ApiOperation({ summary: 'List access entries' })
  @ApiQuery({ name: 'customerId', required: false })
  @ApiQuery({ name: 'siteId', required: false })
  @ApiOkResponse({ type: [AccessEntryResponseDto] })
  listEntries(
    @CurrentUser() user: AuthUser,
    @Query('customerId') customerId?: string,
    @Query('siteId') siteId?: string,
  ) {
    const scoped = resolveCustomerScope(user, customerId);
    return this.service.listEntries(user, scoped, siteId);
  }
}
