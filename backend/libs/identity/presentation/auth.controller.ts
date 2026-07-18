import { Body, Controller, Get, Post, Req } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { FastifyRequest } from 'fastify';
import { CurrentUser, Public } from '@pssms/shared';
import { AuthUser } from '@pssms/shared';
import { AuthService } from '../application/auth.service';
import { MfaService } from '../application/mfa.service';
import { OidcConfigService } from '../application/oidc-config.service';
import {
  AuthUserProfileDto,
  LoginDto,
  LoginResponseDto,
  RefreshTokenDto,
  AuthTokensDto,
} from './dto/login.dto';
import {
  MfaCodeDto,
  MfaSetupResponseDto,
  MfaStatusDto,
} from './dto/mfa.dto';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly mfaService: MfaService,
    private readonly oidcConfig: OidcConfigService,
  ) {}

  @Public()
  @Get('oidc/config')
  @ApiOperation({
    summary: 'OIDC / auth mode discovery',
    description:
      'Public helper for portals: AUTH_MODE, Keycloak issuer/JWKS/endpoints, and client ids. ' +
      'Authorization is never taken from Keycloak realm roles — only identity mapping (email/sub). ' +
      'POST /auth/login remains available for break-glass/E2E even when AUTH_MODE=keycloak; ' +
      'in that mode local HS256 tokens are rejected by the API (prefer AUTH_MODE=dual).',
  })
  getOidcConfig() {
    return this.oidcConfig.getPublicConfig();
  }

  @Public()
  @Post('login')
  @ApiOperation({
    summary: 'Login with email and password',
    description:
      'Returns JWT access + refresh tokens (HS256) and authenticated user profile with roles, permissions, and ABAC site/branch scope. ' +
      'Unchanged in dual/Keycloak rollout; kept as break-glass when AUTH_MODE=keycloak (local tokens only accepted when AUTH_MODE is local or dual).',
  })
  @ApiOkResponse({ type: LoginResponseDto, description: 'Login successful' })
  @ApiUnauthorizedResponse({ description: 'Invalid credentials' })
  login(@Body() dto: LoginDto, @Req() req: FastifyRequest) {
    return this.authService.login(dto, {
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  @Public()
  @Post('refresh')
  @ApiOperation({
    summary: 'Refresh access token',
    description: 'Exchange a valid refresh token for a new token pair.',
  })
  @ApiOkResponse({ type: AuthTokensDto })
  refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refresh(dto.refreshToken);
  }

  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current authenticated user profile' })
  @ApiOkResponse({ type: AuthUserProfileDto })
  me(@CurrentUser() user: AuthUser) {
    return this.authService.me(user.id);
  }

  @Post('mfa/setup')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Begin MFA enrollment',
    description:
      'Generates a TOTP secret and otpauth URI. Scan the QR code in an authenticator app, then confirm with /auth/mfa/enable.',
  })
  @ApiOkResponse({ type: MfaSetupResponseDto })
  mfaSetup(@CurrentUser() user: AuthUser) {
    return this.mfaService.setup(user);
  }

  @Post('mfa/enable')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Confirm and enable MFA with the first TOTP code' })
  @ApiOkResponse({ type: MfaStatusDto })
  mfaEnable(@CurrentUser() user: AuthUser, @Body() dto: MfaCodeDto) {
    return this.mfaService.enable(user, dto.code);
  }

  @Post('mfa/disable')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Disable MFA (requires a valid current TOTP code)' })
  @ApiOkResponse({ type: MfaStatusDto })
  mfaDisable(@CurrentUser() user: AuthUser, @Body() dto: MfaCodeDto) {
    return this.mfaService.disable(user, dto.code);
  }
}
