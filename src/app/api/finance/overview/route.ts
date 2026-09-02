import { NextRequest, NextResponse } from 'next/server';
import { DbRepository } from '@/lib/repository/db';
import { verifyAdminAuth } from '@/lib/auth/guard';

export async function GET(req: NextRequest) {
  const auth = await verifyAdminAuth(req);
  if (!auth.authorized) return auth.response!;

  try {
    const overview = await DbRepository.getFinanceOverview();
    return NextResponse.json(overview);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Gagal memuat overview keuangan' }, { status: 500 });
  }
}
