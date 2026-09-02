import { NextRequest, NextResponse } from 'next/server';
import { DbRepository } from '@/lib/repository/db';
import { verifyAdminAuth } from '@/lib/auth/guard';

export async function GET(req: NextRequest) {
  const auth = await verifyAdminAuth(req);
  if (!auth.authorized) return auth.response!;

  try {
    const items = await DbRepository.getEquipmentItems();
    return NextResponse.json({ success: true, items });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Gagal memuat master perlengkapan' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await verifyAdminAuth(req);
  if (!auth.authorized) return auth.response!;

  try {
    const body = await req.json();
    if (!body.name || !body.category) {
      return NextResponse.json({ error: 'Nama dan kategori perlengkapan wajib diisi.' }, { status: 400 });
    }

    const item = await DbRepository.createEquipmentItem({
      ...body,
      created_by: auth.session?.userId,
    });

    return NextResponse.json({ success: true, item });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Gagal membuat master perlengkapan' }, { status: 500 });
  }
}
