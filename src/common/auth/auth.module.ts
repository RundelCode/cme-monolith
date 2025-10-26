import { Global, Module } from '@nestjs/common';
import { SupabaseServer } from './supabase.server';
import { HttpAuthGuard } from './http-auth.guard';
import { GqlAuthGuard } from './gql-auth.guard';

@Global()
@Module({
  providers: [SupabaseServer, HttpAuthGuard, GqlAuthGuard],
  exports:   [SupabaseServer, HttpAuthGuard, GqlAuthGuard],
})
export class AuthModule {}
