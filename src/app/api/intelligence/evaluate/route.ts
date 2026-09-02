import { NextRequest, NextResponse } from 'next/server';
import { verifyCronOrAdminAuth } from '@/lib/auth/guard';
import { OperationalAlertEngine } from '@/lib/intelligence/alert-engine';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const auth = await verifyCronOrAdminAuth(req);
  if (!auth.authorized) return auth.response!;

  try {
    const result = await OperationalAlertEngine.evaluate();

    return NextResponse.json({
      success: true,
      message: 'Evaluasi operasional intelligence berhasil dijalankan.',
      source: auth.source,
      result,
    });
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message || 'Gagal menjalankan evaluasi operasional',
    }, { status: 500 });
  }
}

// Allow GET for Vercel Cron scheduled invocations
export async function GET(req: NextRequest) {
  return POST(req);
}
