import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { DbModule } from './db/db.module';
import { NotificationsController } from './notification-service.controller';
import { NotificationsService } from './notification-service.service';
import { EmailAdapter } from './email.adapter';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['apps/notification-service/.env', '.env'],
    }),
    ScheduleModule.forRoot(),
    DbModule,
  ],
  controllers: [NotificationsController],
  providers: [NotificationsService, EmailAdapter],
})
export class NotificationServiceModule {}
