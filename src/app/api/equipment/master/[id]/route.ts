import { NextRequest, NextResponse } from 'next/server';
import { DbRepository } from '@/lib/repository/db';
import { verifyAdminAuth } from '@/lib/auth/guard';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await verifyAdminAuth(req);
  if (!auth.authorized) return auth.response!;

  try {
    const item = await DbRepository.getEquipmentItemById(params.id);
    if (!item) {
      return NextResponse.json({ error: 'Item perlengkapan tidak ditemukan.' }, { status: 404 });
    }
    return NextResponse.json({ success: true, item });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Gagal memuat detail perlengkapan' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await verifyAdminAuth(req);
  if (!auth.authorized) return auth.response!;

  try {
    const body = await req.json();
    const item = await DbRepository.updateEquipmentItem(params.id, body);
    return NextResponse.json({ success: true, item });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Gagal memperbarui perlengkapan' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await verifyAdminAuth(req);
  if (!auth.authorized) return auth.response!;

  try {
    const item = await DbRepository.archiveEquipmentItem(params.id);
    return NextResponse.json({ success: true, message: 'Item berhasil diarsipkan.', item });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Gagal mengarsipkan perlengkapan' }, { status: 500 });
  }
}
