import mysql from 'mysql2/promise';

let pool: mysql.Pool | null = null;

const FALLBACK_DATABASE_URL = "mysql://4Yw4GkRotBX9KTA.root:SalWY1s1Nymm5Joj@gateway01.ap-southeast-1.prod.aws.tidbcloud.com:4000/test?ssl={\"rejectUnauthorized\":true}";

export function getTiDBPool(): mysql.Pool | null {
  const databaseUrl = process.env.DATABASE_URL || process.env.TIDB_DATABASE_URL || FALLBACK_DATABASE_URL;
  if (!databaseUrl) {
    return null;
  }

  if (!pool) {
    try {
      pool = mysql.createPool({
        uri: databaseUrl,
        ssl: {
          minVersion: 'TLSv1.2',
          rejectUnauthorized: true,
        },
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0,
        enableKeepAlive: true,
        keepAliveInitialDelay: 10000,
      });
    } catch (err) {
      console.error('[TiDB] Failed to initialize connection pool:', err);
      return null;
    }
  }

  return pool;
}

export async function queryTiDB<T = any>(sql: string, params: any[] = []): Promise<T[]> {
  const db = getTiDBPool();
  if (!db) {
    throw new Error('TiDB connection pool is not configured. Please set DATABASE_URL.');
  }

  const [rows] = await db.execute(sql, params);
  return rows as T[];
}

export async function testTiDBConnection(): Promise<{ ok: boolean; message: string; timestamp?: string }> {
  try {
    const db = getTiDBPool();
    if (!db) {
      return { ok: false, message: 'DATABASE_URL environment variable is missing.' };
    }

    const [rows]: any = await db.execute('SELECT NOW() AS curr_time, @@version AS tidb_ver');
    const firstRow = rows[0];
    return {
      ok: true,
      message: `Connected successfully to TiDB (Version: ${firstRow?.tidb_ver || 'TiDB Serverless'})`,
      timestamp: firstRow?.curr_time,
    };
  } catch (err: any) {
    return {
      ok: false,
      message: err.message || 'Failed to connect to TiDB cluster.',
    };
  }
}
