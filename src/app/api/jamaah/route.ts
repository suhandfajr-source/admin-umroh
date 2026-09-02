import { NextRequest, NextResponse } from 'next/server';
import { DbRepository } from '@/lib/repository/db';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search') || undefined;
    const packageId = searchParams.get('package_id') || undefined;
    const picId = searchParams.get('pic_id') || undefined;

    const list = await DbRepository.getJamaahList({ search, packageId, picId });
    return NextResponse.json(list);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (!body.identity_name && !body.passport_name && !body.ktp_name) {
      return NextResponse.json({ error: 'Nama Jamaah wajib diisi.' }, { status: 400 });
    }

    const created = await DbRepository.createJamaah(body);
    return NextResponse.json(created, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
