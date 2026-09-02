import { NextRequest, NextResponse } from 'next/server';
import { DbRepository } from '@/lib/repository/db';
import { StorageService } from '@/lib/repository/storage.service';
import { verifyAdminAuth } from '@/lib/auth/guard';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await verifyAdminAuth(req);
  if (!auth.authorized) return auth.response!;

  try {
    const payment = await DbRepository.getPaymentById(params.id);
    if (!payment) {
      return NextResponse.json({ error: 'Pembayaran tidak ditemukan' }, { status: 404 });
    }

    if (payment.storage_path) {
      payment.signed_proof_url = await StorageService.getSignedUrl(payment.storage_path, 3600);
    }

    return NextResponse.json(payment);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Gagal memuat pembayaran' }, { status: 500 });
  }
}
