import { NextRequest, NextResponse } from 'next/server';
import { DbRepository } from '@/lib/repository/db';
import { verifyAdminAuth } from '@/lib/auth/guard';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await verifyAdminAuth(req);
  if (!auth.authorized) return auth.response!;

  try {
    const body = await req.json();
    const { participant_equipment_id, target_prepared, target_handed_over, reason } = body;

    if (!participant_equipment_id || !reason) {
      return NextResponse.json({ error: 'participant_equipment_id dan alasan koreksi wajib diisi.' }, { status: 400 });
    }

    const corrected = await DbRepository.correctParticipantEquipment({
      id: participant_equipment_id,
      target_prepared,
      target_handed_over,
      reason,
      adminId: auth.session?.userId,
    });

    return NextResponse.json({
      success: true,
      message: 'Koreksi perlengkapan berhasil dicatat.',
      participant_equipment: corrected,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Gagal melakukan koreksi perlengkapan' }, { status: 400 });
  }
}
