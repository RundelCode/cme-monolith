import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Pool } from 'pg';
import { PG_POOL } from './pg.constants';

@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: PG_POOL,
      inject: [ConfigService],
      useFactory: async (config: ConfigService) => {
        const connectionString = (config.get<string>('DATABASE_URL') ?? '').trim();
        if (!connectionString) throw new Error('DATABASE_URL is missing');

        const ssl =
          /localhost|127\.0\.0\.1/.test(connectionString) ? false : { rejectUnauthorized: false };

        const pool = new Pool({ connectionString, ssl: ssl as any });
        await pool.query('select 1');
        return pool;
      },
    },
  ],
  exports: [PG_POOL],
})
export class DbModule { }
