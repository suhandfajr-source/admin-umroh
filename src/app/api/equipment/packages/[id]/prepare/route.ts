import { NextRequest, NextResponse } from 'next/server';
import { DbRepository } from '@/lib/repository/db';
import { verifyAdminAuth } from '@/lib/auth/guard';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await verifyAdminAuth(req);
  if (!auth.authorized) return auth.response!;

  try {
    const body = await req.json();

    if (body.participant_equipment_id) {
      // Single prepare
      const updated = await DbRepository.prepareParticipantEquipment({
        id: body.participant_equipment_id,
        quantity: body.quantity,
        adminId: auth.session?.userId,
      });
      return NextResponse.json({ success: true, participant_equipment: updated });
    } else {
      // Bulk prepare
      const result = await DbRepository.bulkPrepareEquipment({
        package_id: params.id,
        participant_ids: body.participant_ids,
        participant_equipment_ids: body.participant_equipment_ids,
        equipment_item_id: body.equipment_item_id,
        adminId: auth.session?.userId,
      });
      return NextResponse.json({
        success: true,
        message: `Berhasil menandai siap ${result.updated_count} item perlengkapan.`,
        result,
      });
    }
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Gagal menandai penyiapan perlengkapan' }, { status: 400 });
  }
}
