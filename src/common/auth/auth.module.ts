import { Global, Module } from '@nestjs/common';
import { SupabaseServer } from './supabase.server';
import { HttpAuthGuard } from './http-auth.guard';

@Global()
@Module({
  providers: [SupabaseServer, HttpAuthGuard],
  exports:   [SupabaseServer, HttpAuthGuard],
})
export class AuthModule {}
