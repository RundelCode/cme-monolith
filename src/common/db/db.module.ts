import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Pool } from 'pg';
import { PG_POOL } from './pg.constants';

function isLocalUrl(u: string) {
  return /localhost|127\.0\.0\.1/i.test(u);
}

async function wait(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
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
        const local = isLocalUrl(cs);
        const pool = new Pool({
          connectionString: cs,
          ssl: local ? false : { rejectUnauthorized: false },
          max: Number(process.env.DB_MAX || 10),
          idleTimeoutMillis: 30000,
          connectionTimeoutMillis: 10000,
        });
        const maxAttempts = 5;
        let ok = false;
        for (let i = 0; i < maxAttempts; i++) {
          try {
            await pool.query('select 1');
            ok = true;
            break;
          } catch {
            await wait(1000 * (i + 1));
          }
        }
        return pool;
      },
    },
  ],
  exports: [PG_POOL],
})
export class DbModule { }
