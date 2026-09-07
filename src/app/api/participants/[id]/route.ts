import { NextRequest, NextResponse } from 'next/server';
import { DbRepository } from '@/lib/repository/db';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const list = await DbRepository.getParticipants();
    const participant = list.find(p => p.id === params.id);
    if (!participant) {
      return NextResponse.json({ error: 'Peserta tidak ditemukan' }, { status: 404 });
    }
    return NextResponse.json(participant);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await req.json();
    const updated = await DbRepository.updateParticipant(params.id, {
      pic_id: body.pic_id,
      b2b_price: body.b2b_price,
      selling_price: body.selling_price,
      notes: body.notes,
      participant_status: body.participant_status,
    });

    if (!updated) {
      return NextResponse.json({ error: 'Peserta tidak ditemukan' }, { status: 404 });
    }

    return NextResponse.json(updated);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const deleted = await DbRepository.softDeleteParticipant(params.id);
    if (!deleted) {
      return NextResponse.json({ error: 'Peserta tidak ditemukan' }, { status: 404 });
    }
    return NextResponse.json({ success: true, message: 'Peserta berhasil dikeluarkan dari paket' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
