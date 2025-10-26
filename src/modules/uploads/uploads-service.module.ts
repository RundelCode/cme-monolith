import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { UploadsService } from './uploads-service.service';
import { UploadsSelfController } from './uploads-self.controller';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['apps/uploads-service/.env', '.env'],
    }),
  ],
  controllers: [UploadsSelfController],
  providers: [UploadsService],
})
export class UploadsModule {}
