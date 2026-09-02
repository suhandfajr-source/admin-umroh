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
    const invoice = await DbRepository.getInvoiceById(params.id);
    if (!invoice) {
      return NextResponse.json({ error: 'Invoice tidak ditemukan' }, { status: 404 });
    }
    return NextResponse.json(invoice);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Gagal memuat invoice' }, { status: 500 });
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
    const { base_amount, reason } = body;
    if (base_amount === undefined || isNaN(Number(base_amount))) {
      return NextResponse.json({ error: 'Nominal base_amount tidak valid' }, { status: 400 });
    }

    const updated = await DbRepository.updateInvoiceBaseAmount(params.id, Number(base_amount), reason);
    return NextResponse.json(updated);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Gagal mengupdate invoice' }, { status: 400 });
  }
}
