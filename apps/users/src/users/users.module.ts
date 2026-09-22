import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InternalKeyGuard, JwtAuthGuard, RolesGuard } from '@salescart/common';
import { User } from './entities/user.entity';
import { Address } from './entities/address.entity';
import { AuthController } from './auth.controller';
import { MeController } from './me.controller';
import { UsersService } from './users.service';
import { AddressesService } from './addresses.service';
import { AuthService } from './auth.service';
import { AdminSeederService } from './admin-seeder.service';

@Module({
  imports: [TypeOrmModule.forFeature([User, Address])],
  controllers: [AuthController, MeController],
  providers: [
    UsersService,
    AddressesService,
    AuthService,
    AdminSeederService,
    // Every route needs the internal key (E6-1) — even @Public() ones
    // like register/login, since "public" here means "no JWT required",
    // not "reachable directly, bypassing the gateway". JWT is required
    // unless marked @Public(); RolesGuard is a no-op until a route adds
    // @Roles(...).
    { provide: APP_GUARD, useClass: InternalKeyGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class UsersModule {}
