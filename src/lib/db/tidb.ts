import mysql from 'mysql2/promise';

let pool: mysql.Pool | null = null;

const FALLBACK_DATABASE_URL = "mysql://4Yw4GkRotBX9KTA.root:SalWY1s1Nymm5Joj@gateway01.ap-southeast-1.prod.aws.tidbcloud.com:4000/test?ssl={\"rejectUnauthorized\":true}";

let lastFailureTime = 0;
const CIRCUIT_BREAKER_COOLDOWN_MS = 30000; // 30s cooldown before retrying TiDB if unreachable

export function getTiDBPool(): mysql.Pool | null {
  // If circuit breaker is active (recent network timeout), skip remote connection to keep app fast
  if (Date.now() - lastFailureTime < CIRCUIT_BREAKER_COOLDOWN_MS) {
    return null;
  }

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
        connectionLimit: 5,
        queueLimit: 0,
        enableKeepAlive: true,
        keepAliveInitialDelay: 10000,
        connectTimeout: 2000, // 2s maximum connection timeout
      });
    } catch (err) {
      console.error('[TiDB] Failed to initialize connection pool:', err);
      lastFailureTime = Date.now();
      return null;
    }
  }

  return pool;
}

export async function queryTiDB<T = any>(sql: string, params: any[] = []): Promise<T[]> {
  const db = getTiDBPool();
  if (!db) {
    throw new Error('TiDB connection pool is currently unavailable or in fallback mode.');
  }

  try {
    const [rows] = await db.execute(sql, params);
    return rows as T[];
  } catch (err: any) {
    if (err.code === 'ETIMEDOUT' || err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND') {
      lastFailureTime = Date.now();
      console.warn('[TiDB] Network timeout detected. Activating 30s circuit breaker fallback.');
    }
    throw err;
  }
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
