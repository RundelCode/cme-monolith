import { Controller, Get } from '@nestjs/common';
import { SanityService } from './health.service';

@Controller('healthz')
export class HealthController {
  constructor(private readonly sanityService: SanityService) { }

  @Get()
  ok() {
    return { ok: true, ts: Date.now() };
  }

  @Get('db')
  async db() {
    const info = await this.sanityService.whoami();
    return { ok: true, ...info };
  }
}
