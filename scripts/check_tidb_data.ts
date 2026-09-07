import mysql from 'mysql2/promise';
import fs from 'fs';
import path from 'path';

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

async function check() {
  loadEnvLocal();
  const databaseUrl = process.env.DATABASE_URL;
  const connection = await mysql.createConnection({
    uri: databaseUrl,
    ssl: { minVersion: 'TLSv1.2', rejectUnauthorized: true },
  });

  const [jamaahRows] = await connection.query('SELECT * FROM jamaah');
  console.log('--- JAMAAH TABLE ---', jamaahRows);

  const [docRows] = await connection.query('SELECT * FROM documents');
  console.log('--- DOCUMENTS TABLE ---', docRows);

  const [extRows] = await connection.query('SELECT * FROM document_extractions');
  console.log('--- EXTRACTIONS TABLE ---', extRows);

  await connection.end();
}

check().catch(console.error);
