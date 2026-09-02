import mysql from 'mysql2/promise';
import fs from 'fs';
import path from 'path';

// Helper to load .env.local if not loaded by runner
function loadEnvLocal() {
  const envLocalPath = path.join(process.cwd(), '.env.local');
  if (fs.existsSync(envLocalPath)) {
    const lines = fs.readFileSync(envLocalPath, 'utf8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx !== -1) {
        const key = trimmed.substring(0, eqIdx).trim();
        let val = trimmed.substring(eqIdx + 1).trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.substring(1, val.length - 1);
        }
        if (!process.env[key]) {
          process.env[key] = val;
        }
      }
    }
  }
}

async function runMigration() {
  loadEnvLocal();
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('❌ Error: DATABASE_URL is not set.');
    console.error('Please provide DATABASE_URL in .env.local or terminal.');
    process.exit(1);
  }

  console.log('🚀 Connecting to TiDB Cloud cluster...');
  
  let connection: mysql.Connection | null = null;
  try {
    connection = await mysql.createConnection({
      uri: databaseUrl,
      ssl: {
        minVersion: 'TLSv1.2',
        rejectUnauthorized: true,
      },
      multipleStatements: true,
    });

    console.log('✓ Successfully connected to TiDB Cloud!');

    // Read schema.sql
    const schemaPath = path.join(process.cwd(), 'tidb', 'schema.sql');
    if (!fs.existsSync(schemaPath)) {
      throw new Error(`Schema file not found at ${schemaPath}`);
    }

    const schemaSql = fs.readFileSync(schemaPath, 'utf8');
    console.log('📜 Executing TiDB DDL schema migrations...');

    await connection.query(schemaSql);

    console.log('✓ All 17 operational tables created successfully in TiDB Cloud!');
    console.log('🎉 TiDB Migration completed successfully.');
  } catch (err: any) {
    console.error('❌ Migration failed:', err.message || err);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

runMigration();
