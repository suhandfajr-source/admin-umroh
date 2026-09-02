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
    const { allocations } = body; // Array of { invoiceId: string, amount: number }

    if (!Array.isArray(allocations) || allocations.length === 0) {
      return NextResponse.json({ error: 'Data alokasi harus berupa array dan tidak boleh kosong' }, { status: 400 });
    }

    const result = await DbRepository.allocatePayment(
      params.id,
      allocations,
      auth.session?.userId
    );

    if (!result.success) {
      return NextResponse.json({ error: result.error || 'Alokasi gagal' }, { status: 400 });
    }

    return NextResponse.json(result.payment);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Gagal memproses alokasi pembayaran' }, { status: 400 });
  }
}
