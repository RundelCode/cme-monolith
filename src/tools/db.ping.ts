// src/tools/db.ping.ts
import 'dotenv/config';
import { Client } from 'pg';
import dns from 'node:dns';
import { parse } from 'pg-connection-string';

(async () => {
    if (typeof dns.setDefaultResultOrder === 'function') dns.setDefaultResultOrder('ipv4first');

    const raw = (process.env.DATABASE_URL || '').trim();
    if (!raw) throw new Error('DATABASE_URL missing');

    const c = parse(raw);
    const host = c.host ?? undefined;
    const port = c.port ? Number(c.port) : undefined;
    const database = c.database ?? undefined;
    const user = c.user ?? undefined;
    const password = c.password ?? undefined;

    const client = new Client({
        host, port, database, user, password,
        ssl: { rejectUnauthorized: false, servername: host },
        connectionTimeoutMillis: 20000,
    });

    try {
        await client.connect();
        const r = await client.query('select current_user, current_database(), inet_server_addr(), inet_client_addr(), now() as ts');
        console.log('DB OK =>', r.rows[0]);
    } finally {
        try { await client.end(); } catch (_) { }
    }
})();
