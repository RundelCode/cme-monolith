import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class SupabaseServer {
  public admin: SupabaseClient;
  public pub: SupabaseClient;

  constructor(private readonly config: ConfigService) {
    const raw = (this.config.get<string>('SUPABASE_URL') ?? '').trim();
    const anon = (this.config.get<string>('SUPABASE_ANON_KEY') ?? '').trim();
    const service = (this.config.get<string>('SUPABASE_SERVICE_ROLE_KEY') ?? '').trim();

    let base = raw;
    if (!/^https?:\/\//i.test(base)) base = `https://${base}`;
    this.pub   = createClient(base, anon);
    this.admin = createClient(base, service);
  }

  async getUserFromToken(token: string) {
    const { data, error } = await this.pub.auth.getUser(token);
    if (error) throw error;
    return data;
  }
}
