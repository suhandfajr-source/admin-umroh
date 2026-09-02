import { NextRequest, NextResponse } from 'next/server';
import { DbRepository } from '@/lib/repository/db';
import { verifyAdminAuth } from '@/lib/auth/guard';
import { InvoiceStatus } from '@/types/database.types';

export async function GET(req: NextRequest) {
  const auth = await verifyAdminAuth(req);
  if (!auth.authorized) return auth.response!;

  try {
    const { searchParams } = new URL(req.url);
    const packageId = searchParams.get('package_id') || undefined;
    const picId = searchParams.get('pic_id') || undefined;
    const status = (searchParams.get('status') as InvoiceStatus) || undefined;
    const search = searchParams.get('search') || undefined;

    const invoices = await DbRepository.getInvoices({ packageId, picId, status, search });
    return NextResponse.json(invoices);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Gagal memuat daftar tagihan' }, { status: 500 });
  }
}
