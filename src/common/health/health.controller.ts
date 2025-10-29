import { Controller, Get } from '@nestjs/common';

@Controller('healthz')
export class HealthController {
  constructor(  ) { }

  @Get()
  ok() {
    return { ok: true, ts: Date.now() };
  }

}
