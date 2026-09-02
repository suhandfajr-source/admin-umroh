import { NextResponse } from 'next/server';
import { testTiDBConnection } from '@/lib/db/tidb';

export const dynamic = 'force-dynamic';

export async function GET() {
  const status = await testTiDBConnection();
  return NextResponse.json({
    status: status.ok ? 'CONNECTED' : 'DISCONNECTED',
    ...status,
    database_type: 'TiDB Cloud (Serverless MySQL)',
  });
}
