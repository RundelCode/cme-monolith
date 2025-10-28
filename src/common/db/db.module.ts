import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Pool } from 'pg';
import { PG_POOL } from './pg.constants';

function isLocal(url: string) {
  return /localhost|127\.0\.0\.1/i.test(url);
}

function normalizeUrl(url: string) {
  try {
    const u = new URL(url);
    if (!isLocal(url)) {
      if (!u.searchParams.get('sslmode')) u.searchParams.set('sslmode', 'require');
    }
    return u.toString();
  } catch {
    return url;
  }
}

function purgePgEnv() {
  const keys = ['PGHOST', 'PGPORT', 'PGUSER', 'PGPASSWORD', 'PGDATABASE', 'PGSSLMODE', 'PGSSLROOTCERT'];
  for (const k of keys) {
    if (process.env[k]) delete process.env[k];
  }
}

@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: PG_POOL,
      inject: [ConfigService],
      useFactory: async (config: ConfigService) => {
        purgePgEnv();
        let cs = (config.get<string>('DATABASE_URL') ?? '').trim();
        if (!cs) throw new Error('DATABASE_URL is missing');
        cs = normalizeUrl(cs);
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
export class DbModule {}
