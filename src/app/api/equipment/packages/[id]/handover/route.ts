import { NextRequest, NextResponse } from 'next/server';
import { DbRepository } from '@/lib/repository/db';
import { verifyAdminAuth } from '@/lib/auth/guard';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await verifyAdminAuth(req);
  if (!auth.authorized) return auth.response!;

  try {
    const body = await req.json();

    if (body.participant_equipment_id) {
      // Single handover
      const updated = await DbRepository.handoverParticipantEquipment({
        id: body.participant_equipment_id,
        quantity: body.quantity,
        adminId: auth.session?.userId,
        notes: body.notes,
      });
      return NextResponse.json({ success: true, participant_equipment: updated });
    } else {
      // Bulk handover
      const result = await DbRepository.bulkHandoverEquipment({
        package_id: params.id,
        participant_ids: body.participant_ids,
        participant_equipment_ids: body.participant_equipment_ids,
        equipment_item_id: body.equipment_item_id,
        adminId: auth.session?.userId,
        notes: body.notes,
      });
      return NextResponse.json({
        success: true,
        message: `Berhasil menyerahkan ${result.updated_count} item perlengkapan.`,
        result,
      });
    }
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Gagal menandai penyerahan perlengkapan' }, { status: 400 });
  }
}
