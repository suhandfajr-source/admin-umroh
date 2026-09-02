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
    const { cancellation_reason } = body;

    if (!cancellation_reason || !cancellation_reason.trim()) {
      return NextResponse.json({ error: 'Alasan pembatalan wajib diisi' }, { status: 400 });
    }

    const cancelledPayment = await DbRepository.cancelPayment(
      params.id,
      cancellation_reason.trim(),
      auth.session?.userId
    );

    return NextResponse.json(cancelledPayment);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Gagal membatalkan pembayaran' }, { status: 400 });
  }
}
