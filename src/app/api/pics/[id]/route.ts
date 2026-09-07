import { NextRequest, NextResponse } from 'next/server';
import { DbRepository } from '@/lib/repository/db';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const pic = await DbRepository.getPicById(params.id);
    if (!pic) {
      return NextResponse.json({ error: 'PIC tidak ditemukan' }, { status: 404 });
    }
    return NextResponse.json(pic);
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
    if (!body.name) {
      return NextResponse.json({ error: 'Nama PIC wajib diisi.' }, { status: 400 });
    }

    const updated = await DbRepository.updatePic(params.id, {
      name: body.name,
      phone: body.phone,
      notes: body.notes,
    });

    if (!updated) {
      return NextResponse.json({ error: 'PIC tidak ditemukan' }, { status: 404 });
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
    const deleted = await DbRepository.deletePic(params.id);
    if (!deleted) {
      return NextResponse.json({ error: 'PIC tidak ditemukan' }, { status: 404 });
    }
    return NextResponse.json({ success: true, message: 'PIC berhasil dihapus' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
