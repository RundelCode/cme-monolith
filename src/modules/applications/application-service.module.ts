import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PG_POOL } from 'src/common/db/pg.constants';
import { ApplicationsController } from './application-service.controller';
import { ApplicationsService } from './application-service.service';
import { DbModule } from 'src/common/db/db.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['apps/application-service/.env', '.env'],
    }),
    DbModule,
  ],
  controllers: [ApplicationsController],
  providers: [ApplicationsService],
})
export class ApplicationServiceModule {}
