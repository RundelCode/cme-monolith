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
        const useSsl = !isLocal(cs);
        const pool = new Pool({
          connectionString: cs,
          ssl: useSsl ? { rejectUnauthorized: false } : false,
          max: Number(process.env.DB_MAX || 10),
          idleTimeoutMillis: 30000,
          connectionTimeoutMillis: 15000,
        });
        await pool.query('select 1');
        return pool;
      },
    },
  ],
  exports: [PG_POOL],
})
export class DbModule { }
