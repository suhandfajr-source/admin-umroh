import { NextRequest, NextResponse } from 'next/server';
import { DbRepository } from '@/lib/repository/db';
import { verifyAdminAuth } from '@/lib/auth/guard';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await verifyAdminAuth(req);
  if (!auth.authorized) return auth.response!;

  try {
    const template = await DbRepository.getManifestTemplateById(params.id);
    if (!template) {
      return NextResponse.json({ error: 'Template manifest tidak ditemukan' }, { status: 404 });
    }
    return NextResponse.json(template);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Gagal memuat template manifest' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await verifyAdminAuth(req);
  if (!auth.authorized) return auth.response!;

  try {
    const body = await req.json();
    const updated = await DbRepository.updateManifestTemplate(params.id, body);
    if (!updated) {
      return NextResponse.json({ error: 'Template manifest tidak ditemukan' }, { status: 404 });
    }
    return NextResponse.json(updated);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Gagal mengupdate template manifest' },
      { status: 400 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await verifyAdminAuth(req);
  if (!auth.authorized) return auth.response!;

  try {
    const success = await DbRepository.deleteManifestTemplate(params.id);
    return NextResponse.json({ success });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Gagal menghapus template manifest' },
      { status: 400 }
    );
  }
}
