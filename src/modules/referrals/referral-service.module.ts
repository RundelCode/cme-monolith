import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DbModule } from './db/db.module';
import { ReferralsController } from './referral-service.controller';
import { ReferralsService } from './referral-service.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['apps/referral-service/.env', '.env'],
    }),
    DbModule,
  ],
  controllers: [ReferralsController],
  providers: [ReferralsService],
})
export class ReferralServiceModule {}
