import { NextRequest, NextResponse } from 'next/server';
import { DbRepository } from '@/lib/repository/db';
import { verifyAdminAuth } from '@/lib/auth/guard';
import { InvoiceItemType } from '@/types/database.types';

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await verifyAdminAuth(req);
  if (!auth.authorized) return auth.response!;

  try {
    const body = await req.json();
    const { type, category, description, amount } = body;

    if (!type || !['CHARGE', 'DISCOUNT', 'ADJUSTMENT'].includes(type)) {
      return NextResponse.json({ error: 'Tipe item harus CHARGE, DISCOUNT, atau ADJUSTMENT' }, { status: 400 });
    }
    if (!description || !description.trim()) {
      return NextResponse.json({ error: 'Deskripsi rincian biaya/diskon wajib diisi' }, { status: 400 });
    }
    if (amount === undefined || isNaN(Number(amount))) {
      return NextResponse.json({ error: 'Nominal amount tidak valid' }, { status: 400 });
    }

    const updatedInvoice = await DbRepository.addInvoiceItem(params.id, {
      type: type as InvoiceItemType,
      category,
      description: description.trim(),
      amount: Number(amount),
      created_by: auth.session?.userId,
    });

    return NextResponse.json(updatedInvoice);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Gagal menambahkan item tagihan' }, { status: 400 });
  }
}
