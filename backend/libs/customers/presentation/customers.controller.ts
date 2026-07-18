import { Body, Controller, Get, Post } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { AuthUser, CurrentUser, resolveCustomerScope } from '@pssms/shared';
import { CustomersService } from '../application/customers.service';
import { CreateCustomerDto, CustomerResponseDto } from './dto/customer.dto';

@ApiTags('Customers')
@ApiBearerAuth()
@Controller('customers')
export class CustomersController {
  constructor(private readonly service: CustomersService) {}

  @Post()
  @ApiOperation({ summary: 'Register customer' })
  @ApiCreatedResponse({ type: CustomerResponseDto })
  create(@Body() dto: CreateCustomerDto, @CurrentUser() user: AuthUser) {
    return this.service.create(dto, user);
  }

  @Get('me')
  @ApiOperation({
    summary: 'Current customer profile (CUSTOMER_PORTAL users)',
  })
  @ApiOkResponse({ type: CustomerResponseDto })
  me(@CurrentUser() user: AuthUser) {
    return this.service.me(user);
  }

  @Get()
  @ApiOperation({ summary: 'List customers in organization' })
  @ApiOkResponse({ type: [CustomerResponseDto] })
  list(@CurrentUser() user: AuthUser) {
    const scoped = resolveCustomerScope(user);
    return this.service.list(user.organizationId, scoped);
  }
}
