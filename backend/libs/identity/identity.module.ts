import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuditModule } from '@pssms/audit';
import { CustomerPortalGuard, SupplierPortalGuard } from '@pssms/shared';
import { AuthService } from './application/auth.service';
import { KeycloakUserMapperService } from './application/keycloak-user-mapper.service';
import { MfaService } from './application/mfa.service';
import { OidcConfigService } from './application/oidc-config.service';
import { RolesService } from './application/roles.service';
import { UsersService } from './application/users.service';
import { JwtStrategy } from './infrastructure/jwt.strategy';
import { JwtAuthGuard } from './infrastructure/jwt-auth.guard';
import { AuthController } from './presentation/auth.controller';
import { RolesController } from './presentation/roles.controller';
import { UsersController } from './presentation/users.controller';
import { APP_GUARD } from '@nestjs/core';

@Module({
  imports: [
    AuditModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET', 'change_me_long_random_string'),
        signOptions: {
          expiresIn: config.get('JWT_EXPIRES_IN', '15m') as `${number}m`,
        },
      }),
    }),
  ],
  controllers: [AuthController, UsersController, RolesController],
  providers: [
    AuthService,
    MfaService,
    UsersService,
    RolesService,
    OidcConfigService,
    KeycloakUserMapperService,
    JwtStrategy,
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: CustomerPortalGuard },
    { provide: APP_GUARD, useClass: SupplierPortalGuard },
  ],
  exports: [AuthService, MfaService, UsersService, RolesService, OidcConfigService, JwtModule],
})
export class IdentityModule {}
