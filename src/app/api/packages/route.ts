import { NextRequest, NextResponse } from 'next/server';
import { DbRepository } from '@/lib/repository/db';

export async function GET() {
  try {
    const list = await DbRepository.getPackageList();
    return NextResponse.json(list);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (!body.package_name || !body.departure_date) {
      return NextResponse.json({ error: 'Nama paket dan tanggal keberangkatan wajib diisi.' }, { status: 400 });
    }

    const created = await DbRepository.createPackage(body);
    return NextResponse.json(created, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
