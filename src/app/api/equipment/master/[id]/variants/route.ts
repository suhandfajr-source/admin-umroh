import { NextRequest, NextResponse } from 'next/server';
import { DbRepository } from '@/lib/repository/db';
import { verifyAdminAuth } from '@/lib/auth/guard';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await verifyAdminAuth(req);
  if (!auth.authorized) return auth.response!;

  try {
    const variants = await DbRepository.getEquipmentVariants(params.id);
    return NextResponse.json({ success: true, variants });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Gagal memuat varian perlengkapan' }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await verifyAdminAuth(req);
  if (!auth.authorized) return auth.response!;

  try {
    const body = await req.json();
    if (!body.label) {
      return NextResponse.json({ error: 'Label ukuran/varian wajib diisi.' }, { status: 400 });
    }

    const variant = await DbRepository.createEquipmentVariant({
      equipment_item_id: params.id,
      label: body.label,
      sort_order: body.sort_order || 0,
    });

    return NextResponse.json({ success: true, variant });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Gagal membuat varian perlengkapan' }, { status: 500 });
  }
}
