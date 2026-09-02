import { NextRequest, NextResponse } from 'next/server';
import { DbRepository } from '@/lib/repository/db';
import { verifyAdminAuth } from '@/lib/auth/guard';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await verifyAdminAuth(req);
  if (!auth.authorized) return auth.response!;

  try {
    const items = await DbRepository.getPackageEquipment(params.id);
    return NextResponse.json({ success: true, items });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Gagal memuat perlengkapan paket' }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await verifyAdminAuth(req);
  if (!auth.authorized) return auth.response!;

  try {
    const body = await req.json();
    if (Array.isArray(body.items)) {
      // Bulk update/set package equipment configuration
      const items = await DbRepository.setPackageEquipment(params.id, body.items);
      return NextResponse.json({ success: true, items });
    } else if (body.equipment_item_id) {
      // Add single item
      const item = await DbRepository.addPackageEquipmentItem(params.id, body);
      return NextResponse.json({ success: true, item });
    } else {
      return NextResponse.json({ error: 'Data konfigurasi perlengkapan tidak valid.' }, { status: 400 });
    }
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Gagal mengonfigurasi perlengkapan paket' }, { status: 500 });
  }
}
