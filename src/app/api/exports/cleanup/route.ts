import { NextRequest, NextResponse } from 'next/server';
import { DbRepository } from '@/lib/repository/db';
import { verifyCronOrAdminAuth } from '@/lib/auth/guard';

/**
 * Common handler for cleanup execution (Supports both GET from Vercel Cron and POST from Webhooks/Admin UI)
 */
async function handleCleanupExecution(req: NextRequest) {
  const auth = await verifyCronOrAdminAuth(req);
  if (!auth.authorized) return auth.response!;

  try {
    const report = await DbRepository.cleanupExpiredExports();
    return NextResponse.json({
      success: true,
      message: `Berhasil membersihkan ${report.expired_exports_count} file export kadaluarsa dan ${report.expired_staging_files_count} file staging kadaluarsa.`,
      report,
      trigger_source: auth.source || 'ADMIN',
      executed_by: auth.session?.email || 'unknown',
    });
  } catch (error: any) {
    console.error('Error during scheduled export cleanup:', error);
    return NextResponse.json(
      { error: error.message || 'Gagal menjalankan cleanup export' },
      { status: 500 }
    );
  }
}

/**
 * GET Handler - Primary endpoint for Vercel Cron jobs and scheduled ping monitors
 */
export async function GET(req: NextRequest) {
  return handleCleanupExecution(req);
}

/**
 * POST Handler - Webhook, Cloud Scheduler, and Admin manual dashboard triggers
 */
export async function POST(req: NextRequest) {
  return handleCleanupExecution(req);
}
