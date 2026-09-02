import { NextRequest, NextResponse } from 'next/server';
import { DbRepository } from '@/lib/repository/db';

export async function GET() {
  try {
    const list = await DbRepository.getPicList();
    return NextResponse.json(list);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (!body.name) {
      return NextResponse.json({ error: 'Nama PIC wajib diisi.' }, { status: 400 });
    }

    const created = await DbRepository.createPic(body.name, body.phone, body.notes);
    return NextResponse.json(created, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
