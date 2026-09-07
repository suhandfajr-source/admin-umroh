import mysql from 'mysql2/promise';
import fs from 'fs';
import path from 'path';

const DATABASE_URL = "mysql://4Yw4GkRotBX9KTA.root:SalWY1s1Nymm5Joj@gateway01.ap-southeast-1.prod.aws.tidbcloud.com:4000/test?ssl={\"rejectUnauthorized\":true}";

async function patchDb() {
  const connection = await mysql.createConnection({
    uri: DATABASE_URL,
    ssl: { minVersion: 'TLSv1.2', rejectUnauthorized: true },
  });

  console.log('Patching TiDB schema...');
  try {
    await connection.query('ALTER TABLE jamaah MODIFY COLUMN gender VARCHAR(20) NULL');
    console.log('✓ Modified jamaah.gender to VARCHAR(20)');
  } catch (e: any) {
    console.log('Note on gender:', e.message);
  }

  try {
    await connection.query('ALTER TABLE jamaah ADD COLUMN IF NOT EXISTS member_id VARCHAR(50) NULL AFTER id');
    console.log('✓ Added member_id column to jamaah');
  } catch (e: any) {
    console.log('Note on member_id:', e.message);
  }

  // Check rows
  const [rows] = await connection.query('SELECT * FROM jamaah');
  console.log('Current Jamaah in TiDB:', rows);

  await connection.end();
}

patchDb().catch(console.error);
