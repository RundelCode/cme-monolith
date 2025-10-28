import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Pool } from 'pg';
import { PG_POOL } from './pg.constants';

function isLocal(url: string) {
  return /localhost|127\.0\.0\.1/i.test(url);
}

@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: PG_POOL,
      inject: [ConfigService],
      useFactory: async (config: ConfigService) => {
        const cs = (config.get<string>('DATABASE_URL') ?? '').trim();
        if (!cs) throw new Error('DATABASE_URL is missing');
        const pool = new Pool({
          connectionString: cs,
          ssl: isLocal(cs) ? false : { rejectUnauthorized: false },
          max: Number(process.env.DB_MAX || 10),
          idleTimeoutMillis: 30000,
          connectionTimeoutMillis: 10000,
          statement_timeout: 30000,
          query_timeout: 30000,
          keepAlive: true,
        });
        return pool;
      },
    },
  ],
  exports: [PG_POOL],
})
export class DbModule { }
