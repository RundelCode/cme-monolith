import { Injectable, Inject } from '@nestjs/common';
import { Pool } from 'pg';
import { PG_POOL } from '../../common/db/pg.constants';

@Injectable()
export class SanityService {
    constructor(@Inject(PG_POOL) private readonly db: Pool) { }

    async whoami() {
        const r = await this.db.query(
            `select current_user, current_database(), inet_server_addr() as server, now() as ts`,
        );
        return r.rows[0];
    }
}
