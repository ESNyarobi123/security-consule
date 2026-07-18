import { Injectable } from '@nestjs/common';
import { PrismaService, AuthUser } from '@pssms/shared';
import { OrganizationResponseDto } from '../presentation/dto/enterprise.dto';

@Injectable()
export class OrganizationService {
  constructor(private readonly prisma: PrismaService) {}

  async getMine(user: AuthUser): Promise<OrganizationResponseDto> {
    const org = await this.prisma.organization.findUniqueOrThrow({
      where: { id: user.organizationId },
    });
    return {
      id: org.id,
      name: org.name,
      code: org.code,
      tin: org.tin,
      isActive: org.isActive,
    };
  }
}
