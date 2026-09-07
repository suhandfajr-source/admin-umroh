import mysql from 'mysql2/promise';

const DATABASE_URL = "mysql://4Yw4GkRotBX9KTA.root:SalWY1s1Nymm5Joj@gateway01.ap-southeast-1.prod.aws.tidbcloud.com:4000/test?ssl={\"rejectUnauthorized\":true}";

async function restore() {
  const connection = await mysql.createConnection({
    uri: DATABASE_URL,
    ssl: { minVersion: 'TLSv1.2', rejectUnauthorized: true },
  });

  const jamaahId = `jam_${Date.now()}_cucu`;
  const memberId = 'WKU-0001';
  const identityName = 'CUCU';
  const nik = '3203144207580005';
  const birthDate = '1958-07-14'; // parsed from NIK 42 (14-07-1958, 42-40=2 wanita)
  const gender = 'FEMALE';

  await connection.execute(
    `INSERT INTO jamaah (id, member_id, identity_name, ktp_name, nik, birth_date, gender, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
     ON DUPLICATE KEY UPDATE identity_name = VALUES(identity_name), nik = VALUES(nik), updated_at = NOW()`,
    [jamaahId, memberId, identityName, identityName, nik, birthDate, gender]
  );

  console.log('✓ Jamaah CUCU successfully restored to TiDB Cloud!');

  const [rows] = await connection.execute('SELECT * FROM jamaah');
  console.log('Current Jamaah in Database:', rows);

  await connection.end();
}

restore().catch(console.error);
