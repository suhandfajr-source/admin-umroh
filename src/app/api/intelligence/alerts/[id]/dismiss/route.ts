import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminAuth } from '@/lib/auth/guard';
import { OperationalAlertEngine } from '@/lib/intelligence/alert-engine';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await verifyAdminAuth(req);
  if (!auth.authorized) return auth.response!;

  try {
    const body = await req.json().catch(() => ({}));
    const reason = body.reason;

    if (!reason || typeof reason !== 'string' || reason.trim().length === 0) {
      return NextResponse.json({ error: 'Alasan dismissal wajib diisi.' }, { status: 400 });
    }

    const updated = await OperationalAlertEngine.dismissAlert(
      params.id,
      reason,
      auth.session?.userId || 'admin-1'
    );

    return NextResponse.json({
      success: true,
      message: 'Alert berhasil di-dismiss.',
      alert: updated,
    });
  } catch (error: any) {
    const isClientError = error.message?.includes('Aksi ditolak') || error.message?.includes('wajib diisi');
    return NextResponse.json(
      { error: error.message || 'Gagal memproses dismissal alert' },
      { status: isClientError ? 400 : 500 }
    );
  }
}
