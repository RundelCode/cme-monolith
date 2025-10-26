import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CompaniesController } from './company-service.controller';
import { CompaniesService } from './company-service.service';
import { DbModule } from 'src/common/db/db.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['apps/company-service/.env', '.env'],
    }),
    DbModule,
  ],
  controllers: [CompaniesController],
  providers: [CompaniesService],
})
export class CompanyServiceModule {}
