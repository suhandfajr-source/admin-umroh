import { NextRequest, NextResponse } from 'next/server';
import { DbRepository } from '@/lib/repository/db';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const packageId = searchParams.get('package_id') || undefined;
    const picId = searchParams.get('pic_id') || undefined;

    const list = await DbRepository.getParticipants({ packageId, picId });
    return NextResponse.json(list);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { package_id, jamaah_id, pic_id, b2b_price, selling_price, notes } = body;

    if (!package_id || !jamaah_id) {
      return NextResponse.json({ error: 'Package ID dan Jamaah ID wajib diisi.' }, { status: 400 });
    }

    const participant = await DbRepository.addParticipant(
      package_id,
      jamaah_id,
      pic_id,
      b2b_price,
      selling_price,
      notes
    );

    return NextResponse.json(participant, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
