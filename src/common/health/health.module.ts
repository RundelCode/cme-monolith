import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { SanityService } from './health.service';

@Module({
  controllers: [HealthController],
  providers: [SanityService],
})
export class HealthModule { }
