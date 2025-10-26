
import { Controller, Get } from '@nestjs/common';

@Controller('debug')
export class DebugController {
  @Get('supabase-health')
  async health() {
    const url = process.env.SUPABASE_URL + '/auth/v1/health';
    const res = await fetch(url);
    return { url, status: res.status, ok: res.ok };
  }
}
