import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthUser, CurrentUser } from '@pssms/shared';
import { OrganizationService } from '../application/organization.service';
import { OrganizationResponseDto } from './dto/enterprise.dto';

@ApiTags('Enterprise')
@ApiBearerAuth()
@Controller('enterprise/organization')
export class OrganizationController {
  constructor(private readonly service: OrganizationService) {}

  @Get()
  @ApiOperation({ summary: 'Get current organization (company) profile' })
  @ApiOkResponse({ type: OrganizationResponseDto })
  getMine(@CurrentUser() user: AuthUser) {
    return this.service.getMine(user);
  }
}
