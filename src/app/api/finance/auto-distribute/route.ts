import { NextRequest, NextResponse } from 'next/server';
import { DbRepository } from '@/lib/repository/db';
import { verifyAdminAuth } from '@/lib/auth/guard';

export async function POST(req: NextRequest) {
  const auth = await verifyAdminAuth(req);
  if (!auth.authorized) return auth.response!;

  try {
    const body = await req.json();
    const { payment_id, target_invoice_ids } = body;

    if (!payment_id) {
      return NextResponse.json({ error: 'payment_id wajib disertakan' }, { status: 400 });
    }

    const preview = await DbRepository.autoDistributePayment(payment_id, target_invoice_ids);
    return NextResponse.json(preview);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Gagal menghitung auto-distribute' }, { status: 400 });
  }
}
