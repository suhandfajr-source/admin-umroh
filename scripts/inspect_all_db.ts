import mysql from 'mysql2/promise';

const DATABASE_URL = "mysql://4Yw4GkRotBX9KTA.root:SalWY1s1Nymm5Joj@gateway01.ap-southeast-1.prod.aws.tidbcloud.com:4000/test?ssl={\"rejectUnauthorized\":true}";

async function inspect() {
  const connection = await mysql.createConnection({
    uri: DATABASE_URL,
    ssl: { minVersion: 'TLSv1.2', rejectUnauthorized: true },
  });

  const [jamaahRows] = await connection.execute('SELECT * FROM jamaah');
  console.log('=== JAMAAH === (Total:', (jamaahRows as any[]).length, ')');
  console.log(jamaahRows);

  const [docRows] = await connection.execute('SELECT * FROM documents');
  console.log('=== DOCUMENTS === (Total:', (docRows as any[]).length, ')');
  console.log(docRows);

  const [extRows] = await connection.execute('SELECT * FROM document_extractions');
  console.log('=== EXTRACTIONS === (Total:', (extRows as any[]).length, ')');
  console.log(extRows);

  await connection.end();
}

inspect().catch(console.error);
