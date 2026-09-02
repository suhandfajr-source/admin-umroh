import { NextRequest, NextResponse } from 'next/server';
import { DbRepository } from '@/lib/repository/db';
import { verifyAdminAuth } from '@/lib/auth/guard';

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await verifyAdminAuth(req);
  if (!auth.authorized) return auth.response!;

  try {
    const body = await req.json();
    const { reversal_reason } = body;

    if (!reversal_reason || !reversal_reason.trim()) {
      return NextResponse.json({ error: 'Alasan koreksi/pembatalan alokasi wajib diisi' }, { status: 400 });
    }

    const success = await DbRepository.reverseAllocation(
      params.id,
      reversal_reason.trim(),
      auth.session?.userId
    );

    if (!success) {
      return NextResponse.json({ error: 'Alokasi tidak ditemukan' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Gagal membatalkan alokasi' }, { status: 400 });
  }
}
