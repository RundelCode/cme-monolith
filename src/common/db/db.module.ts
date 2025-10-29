import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Pool } from 'pg';
import { PG_POOL } from './pg.constants';
import { parse } from 'pg-connection-string';
import dns from 'node:dns';

function isLocalHost(h?: string | null) {
  if (!h) return false;
  const s = String(h).toLowerCase();
  return s === 'localhost' || s === '127.0.0.1';
}

function purgePgEnv() {
  const keys = [
    'PGHOST', 'PGHOSTADDR', 'PGPORT', 'PGUSER', 'PGPASSWORD', 'PGDATABASE',
    'PGAPPNAME', 'PGCONNECT_TIMEOUT', 'PGSSLMODE', 'PGSSLROOTCERT', 'PGSSLCERT',
    'PGSSLKEY', 'PGREQUIRESSL', 'PGSERVICE', 'PGSERVICEFILE', 'PGOPTIONS',
  ];
  for (const k of keys) if (process.env[k]) delete process.env[k];
}

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: PG_POOL,
      inject: [ConfigService],
      useFactory: async (config: ConfigService) => {
        purgePgEnv();

        if (typeof dns.setDefaultResultOrder === 'function') {
          dns.setDefaultResultOrder('ipv4first');
        }

        const raw = (config.get<string>('DATABASE_URL') ?? '').trim();
        if (!raw) throw new Error('DATABASE_URL is missing');

        const c = parse(raw);
        const host = c.host ?? undefined;
        const port = c.port ? Number(c.port) : undefined;
        const database = c.database ?? undefined;
        const user = c.user ?? undefined;
        const password = c.password ?? undefined;

        const onLocal = isLocalHost(host);
        const mustUseSSL = !onLocal;

        const pool = new Pool({
          host,
          port,
          database,
          user,
          password,
          ssl: mustUseSSL ? { rejectUnauthorized: false, servername: host } : false,
          max: Number(process.env.DB_MAX || 10),
          idleTimeoutMillis: 30000,
          connectionTimeoutMillis: 20000,
          statement_timeout: 30000,
          query_timeout: 30000,
          keepAlive: true,
          application_name: process.env.RENDER_SERVICE_NAME || 'cme-monolith',
        });

        (async () => {
          const retries = Number(process.env.DB_CONNECT_RETRIES || 10);
          const backoff = Number(process.env.DB_CONNECT_BACKOFF_MS || 1000);
          for (let i = 1; i <= retries; i++) {
            try {
              await pool.query('select 1');
              console.log(`[DB] ✅ Connected on attempt ${i}`);
              return;
            } catch (e: any) {
              console.warn(`[DB] ❌ Attempt ${i} failed: ${e?.code || e?.message}`);
              await sleep(backoff * i);
            }
          }
          console.error('[DB] ❌ All retry attempts failed (app keeps running)');
        })().catch(() => { });

        return pool;
      },
    },
  ],
  exports: [PG_POOL],
})
export class DbModule { }
