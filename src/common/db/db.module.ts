import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool } from 'pg';

export const PG_POOL = 'PG_POOL';

@Module({
  providers: [
    {
      provide: PG_POOL,
      inject: [ConfigService],
      useFactory: async (config: ConfigService) => {
        const connectionString = config.get<string>('DATABASE_URL');
        if (!connectionString) throw new Error('DATABASE_URL is missing');

        const pool = new Pool({
          connectionString,
          ssl: { rejectUnauthorized: false },
        });

        await pool.query('select 1');
        return pool;
      },
    },
  ],
  exports: [PG_POOL],
})
export class DbModule {}
