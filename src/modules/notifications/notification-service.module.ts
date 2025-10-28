import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { NotificationsController } from './notification-service.controller';
import { NotificationsService } from './notification-service.service';
import { DbModule } from 'src/common/db/db.module';

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
  providers: [NotificationsService],
})
export class NotificationServiceModule {}
