import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { InternalKeyGuard, JwtAuthGuard, RolesGuard } from '@salescart/common';
import { MediaModule } from './media/media.module';

@Module({
  imports: [MediaModule],
  providers: [
    { provide: APP_GUARD, useClass: InternalKeyGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
