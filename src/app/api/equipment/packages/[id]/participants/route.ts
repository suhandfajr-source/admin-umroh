import { NextRequest, NextResponse } from 'next/server';
import { DbRepository } from '@/lib/repository/db';
import { verifyAdminAuth } from '@/lib/auth/guard';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await verifyAdminAuth(req);
  if (!auth.authorized) return auth.response!;

  const { searchParams } = new URL(req.url);
  const picId = searchParams.get('picId') || undefined;
  const status = searchParams.get('status') || undefined;
  const search = searchParams.get('search') || undefined;
  const missingVariant = searchParams.get('missingVariant') === 'true';

  try {
    const participants = await DbRepository.getParticipantEquipmentList(params.id, {
      picId,
      status,
      search,
      missingVariant,
    });
    return NextResponse.json({ success: true, participants });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Gagal memuat data perlengkapan jamaah' }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await verifyAdminAuth(req);
  if (!auth.authorized) return auth.response!;

  try {
    const body = await req.json();
    const { participant_equipment_id, variant_id } = body;

    if (!participant_equipment_id) {
      return NextResponse.json({ error: 'participant_equipment_id wajib diisi.' }, { status: 400 });
    }

    const updated = await DbRepository.updateParticipantEquipmentVariant(
      participant_equipment_id,
      variant_id || null,
      auth.session?.userId
    );

    return NextResponse.json({ success: true, participant_equipment: updated });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Gagal memperbarui varian perlengkapan' }, { status: 500 });
  }
}
