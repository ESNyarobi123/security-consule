import { ApiProperty } from '@nestjs/swagger';
import { CustomerEmployeeStaffResponseDto } from './customer-employee.dto';

/** Module 6-I — one-time password response for CUSTOMER_EMPLOYEE invite. */
export class InviteCustomerEmployeePortalResponseDto {
  @ApiProperty({ type: CustomerEmployeeStaffResponseDto })
  employee!: CustomerEmployeeStaffResponseDto;

  @ApiProperty()
  userId!: string;

  @ApiProperty()
  email!: string;

  @ApiProperty({
    description:
      'Plain temporary password — shown once; also emailed when outbox is up',
  })
  temporaryPassword!: string;

  @ApiProperty({
    description:
      'True when CUSTOMER_EMPLOYEE_INVITE was queued to the notification outbox',
  })
  notificationQueued!: boolean;
}
