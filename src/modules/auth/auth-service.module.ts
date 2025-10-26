import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DbModule } from './db/db.module';
import { AuthModule } from '@app/common/auth/auth.module';
import { AuthController } from './auth-service.controller';
import { AuthService } from './auth-service.service';
import { ProfilesController } from './profiles/profiles.controller';
import { ProfilesService } from './profiles/profiles.service';
import { DebugController } from './debug.controller';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', 'apps/auth-service/.env'],
    }),
    AuthModule,
    DbModule,
  ],
  controllers: [AuthController, ProfilesController, DebugController],
  providers: [AuthService, ProfilesService],
})
export class AuthServiceModule { }
