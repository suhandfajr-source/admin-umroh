import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminAuth } from '@/lib/auth/guard';
import { DbRepository } from '@/lib/repository/db';
import { OperationalAlertEngine } from '@/lib/intelligence/alert-engine';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const auth = await verifyAdminAuth(req);
  if (!auth.authorized) return auth.response!;

  const { searchParams } = new URL(req.url);
  const status = (searchParams.get('status') as any) || undefined;
  const category = searchParams.get('category') || undefined;
  const severity = searchParams.get('severity') || undefined;
  const packageId = searchParams.get('packageId') || undefined;

  try {
    const alerts = await DbRepository.getOperationalAlerts({
      status,
      category,
      severity,
      packageId,
    });

    return NextResponse.json({ alerts, total: alerts.length });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Gagal memuat daftar action required' }, { status: 500 });
  }
}
