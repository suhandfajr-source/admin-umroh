import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminAuth } from '@/lib/auth/guard';
import { ReadinessService } from '@/lib/intelligence/readiness-service';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await verifyAdminAuth(req);
  if (!auth.authorized) return auth.response!;

  try {
    const readiness = await ReadinessService.getPackageReadiness(params.id);
    return NextResponse.json(readiness);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Gagal memuat data readiness paket' },
      { status: error.message?.includes('tidak ditemukan') ? 404 : 500 }
    );
  }
}
