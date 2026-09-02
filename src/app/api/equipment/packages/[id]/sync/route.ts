import { NextRequest, NextResponse } from 'next/server';
import { DbRepository } from '@/lib/repository/db';
import { verifyAdminAuth } from '@/lib/auth/guard';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await verifyAdminAuth(req);
  if (!auth.authorized) return auth.response!;

  try {
    const result = await DbRepository.syncPackageParticipantEquipment(params.id);
    return NextResponse.json({
      success: true,
      message: `Sinkronisasi selesai: ${result.created_count} dibuat, ${result.updated_count} diperbarui. Total aktif: ${result.total_active_requirements}.`,
      result,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Gagal melakukan sinkronisasi perlengkapan' }, { status: 500 });
  }
}
