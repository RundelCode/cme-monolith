import { Pool } from 'pg';
import dns from 'node:dns';
import { parse } from 'pg-connection-string';

(async () => {
    if (typeof dns.setDefaultResultOrder === 'function') {
        dns.setDefaultResultOrder('ipv4first');
    }

    const raw = (process.env.DATABASE_URL || '').trim();
    if (!raw) throw new Error('DATABASE_URL missing');

    const c = parse(raw);
    const host = c.host ?? undefined;
    const port = c.port ? Number(c.port) : undefined;
    const database = c.database ?? undefined;
    const user = c.user ?? undefined;
    const password = c.password ?? undefined;

    const pool = new Pool({
        host, // hostname
        port,
        database,
        user,
        password,
        ssl: { rejectUnauthorized: false, servername: host },
        connectionTimeoutMillis: 20000,
        query_timeout: 30000,
        keepAlive: true,
    });

    try {
        const r = await pool.query('select current_user, current_database(), inet_server_addr()');
        console.log('DB OK =>', r.rows[0]);
    } finally {
        await pool.end();
    }
})().catch((e) => {
    console.error('DB FAIL =>', e);
    process.exit(1);
});
