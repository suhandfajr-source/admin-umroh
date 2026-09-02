import { NextRequest, NextResponse } from 'next/server';
import { DbRepository } from '@/lib/repository/db';
import { verifyAdminAuth } from '@/lib/auth/guard';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await verifyAdminAuth(req);
  if (!auth.authorized) return auth.response!;

  try {
    const history = await DbRepository.getJamaahEquipmentHistory(params.id);
    return NextResponse.json({ success: true, history });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Gagal memuat riwayat perlengkapan jamaah' }, { status: 500 });
  }
}
