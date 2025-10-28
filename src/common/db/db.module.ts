import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Pool } from 'pg';
import { PG_POOL } from './pg.constants';
import { parse } from 'pg-connection-string';

function isLocalHost(h?: string | null) {
  if (!h) return false;
  const s = String(h).toLowerCase();
  return s === 'localhost' || s === '127.0.0.1';
}

function purgePgEnv() {
  const keys = [
    'PGHOST',
    'PGHOSTADDR',
    'PGPORT',
    'PGUSER',
    'PGPASSWORD',
    'PGDATABASE',
    'PGAPPNAME',
    'PGCONNECT_TIMEOUT',
    'PGSSLMODE',
    'PGSSLROOTCERT',
    'PGSSLCERT',
    'PGSSLKEY',
    'PGREQUIRESSL',
    'PGSERVICE',
    'PGSERVICEFILE',
    'PGOPTIONS',
  ];
  for (const k of keys) if (process.env[k]) delete process.env[k];
}

@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: PG_POOL,
      inject: [ConfigService],
      useFactory: async (config: ConfigService) => {
        purgePgEnv();
        const url = (config.get<string>('DATABASE_URL') ?? '').trim();
        if (!url) throw new Error('DATABASE_URL is missing');
        const c = parse(url);
        const host = c.host || undefined;
        const port = c.port ? Number(c.port) : undefined;
        const database = c.database || undefined;
        const user = c.user || undefined;
        const password = c.password || undefined;
        const useSsl = false;
        const pool = new Pool({
          host,
          port,
          database,
          user,
          password,
          ssl: useSsl ? { rejectUnauthorized: false } : false,
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
