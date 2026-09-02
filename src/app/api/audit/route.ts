import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminAuth } from '@/lib/auth/guard';
import { DbRepository } from '@/lib/repository/db';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const auth = await verifyAdminAuth(req);
  if (!auth.authorized) return auth.response!;

  const { searchParams } = new URL(req.url);
  const packageId = searchParams.get('packageId') || undefined;
  const jamaahId = searchParams.get('jamaahId') || undefined;
  const entityType = searchParams.get('entityType') || undefined;
  const action = searchParams.get('action') || undefined;
  const limit = searchParams.get('limit') ? Number(searchParams.get('limit')) : 50;

  try {
    const logs = await DbRepository.getAuditLogs({
      packageId,
      jamaahId,
      entityType,
      action,
      limit,
    });

    return NextResponse.json({ logs, total: logs.length });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Gagal memuat audit log' }, { status: 500 });
  }
}
