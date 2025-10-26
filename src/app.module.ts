import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CommonAuthModule } from './common/auth/auth.module';
import { DbModule } from './common/db/db.module';

import { AuthModule } from './modules/auth/auth.module';
import { ProfilesModule } from './modules/profiles/profiles.module';
import { CompaniesModule } from './modules/companies/companies.module';
import { JobsModule } from './modules/jobs/jobs.module';
import { ApplicationsModule } from './modules/applications/applications.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { ReferralsModule } from './modules/referrals/referrals.module';
import { UploadsModule } from './modules/uploads/uploads.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DbModule,
    CommonAuthModule,
    AuthModule,
    ProfilesModule,
    CompaniesModule,
    JobsModule,
    ApplicationsModule,
    PaymentsModule,
    NotificationsModule,
    ReferralsModule,
    UploadsModule,
  ],
})
export class AppModule { }
