import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DbModule } from './db/db.module';
import { JobServiceController } from './job-service.controller';
import { JobServiceService } from './job-service.service';
import { AuthModule } from '@app/common/auth/auth.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['apps/job-service/.env', '.env'],
    }),
    AuthModule,
    DbModule,         
  ],
  controllers: [JobServiceController],
  providers: [JobServiceService],
})
export class JobServiceModule {}
