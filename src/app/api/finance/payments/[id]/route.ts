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

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await verifyAdminAuth(req);
  if (!auth.authorized) return auth.response!;

  try {
    const body = await req.json();
    const updated = await DbRepository.updatePayment(params.id, {
      notes: body.notes,
      sender_bank: body.sender_bank,
      payment_type: body.payment_type,
      sender_name: body.sender_name,
    });

    if (!updated) {
      return NextResponse.json({ error: 'Pembayaran tidak ditemukan' }, { status: 404 });
    }

    return NextResponse.json(updated);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Gagal memperbarui pembayaran' }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await verifyAdminAuth(req);
  if (!auth.authorized) return auth.response!;

  try {
    let reason = 'Dihapus oleh admin';
    try {
      const body = await req.json();
      if (body?.cancellation_reason) {
        reason = body.cancellation_reason;
      }
    } catch {
      // Body may be empty in standard DELETE request
    }

    const cancelled = await DbRepository.cancelPayment(params.id, reason, auth.session?.userId);
    return NextResponse.json({ success: true, message: 'Pembayaran berhasil dibatalkan/dihapus', payment: cancelled });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Gagal menghapus pembayaran' }, { status: 400 });
  }
}
