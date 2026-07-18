import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AuthUser,
  PrismaService,
  buildOtpAuthUri,
  generateTotpSecret,
  verifyTotp,
} from '@pssms/shared';
import { AuditService } from '@pssms/audit';
import {
  MfaSetupResponseDto,
  MfaStatusDto,
} from '../presentation/dto/mfa.dto';

@Injectable()
export class MfaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly audit: AuditService,
  ) {}

  /** Step 1: generate a secret and return the provisioning URI. Not yet enabled. */
  async setup(actor: AuthUser): Promise<MfaSetupResponseDto> {
    const secret = generateTotpSecret();
    await this.prisma.user.update({
      where: { id: actor.id },
      data: { mfaSecret: secret },
    });
    const issuer = this.config.get<string>('MFA_ISSUER', 'HIGHLINK PSSMS');
    return {
      secret,
      otpauthUri: buildOtpAuthUri({
        secret,
        accountName: actor.email,
        issuer,
      }),
    };
  }

  /** Step 2: confirm the first code to activate MFA for the account. */
  async enable(actor: AuthUser, code: string): Promise<MfaStatusDto> {
    const user = await this.prisma.user.findUnique({
      where: { id: actor.id },
    });
    if (!user) {
      throw new NotFoundException({ error: 'NOT_FOUND', message: 'User not found' });
    }
    if (!user.mfaSecret) {
      throw new BadRequestException({
        error: 'MFA_NOT_INITIALIZED',
        message: 'Call /auth/mfa/setup before enabling MFA',
      });
    }
    if (!verifyTotp(user.mfaSecret, code)) {
      throw new BadRequestException({
        error: 'MFA_INVALID_CODE',
        message: 'Invalid authentication code',
      });
    }
    await this.prisma.user.update({
      where: { id: user.id },
      data: { mfaEnabled: true, mfaVerifiedAt: new Date() },
    });
    await this.audit.record({
      organizationId: actor.organizationId,
      actorId: actor.id,
      action: 'IDENTITY_MFA_ENABLED',
      resourceType: 'User',
      resourceId: user.id,
    });
    return { mfaEnabled: true };
  }

  /** Disable MFA — requires a valid current code to prove possession. */
  async disable(actor: AuthUser, code: string): Promise<MfaStatusDto> {
    const user = await this.prisma.user.findUnique({
      where: { id: actor.id },
    });
    if (!user || !user.mfaEnabled || !user.mfaSecret) {
      throw new BadRequestException({
        error: 'MFA_NOT_ENABLED',
        message: 'MFA is not enabled for this account',
      });
    }
    if (!verifyTotp(user.mfaSecret, code)) {
      throw new BadRequestException({
        error: 'MFA_INVALID_CODE',
        message: 'Invalid authentication code',
      });
    }
    await this.prisma.user.update({
      where: { id: user.id },
      data: { mfaEnabled: false, mfaSecret: null, mfaVerifiedAt: null },
    });
    await this.audit.record({
      organizationId: actor.organizationId,
      actorId: actor.id,
      action: 'IDENTITY_MFA_DISABLED',
      resourceType: 'User',
      resourceId: user.id,
    });
    return { mfaEnabled: false };
  }
}
