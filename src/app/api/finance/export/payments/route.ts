import { NextRequest, NextResponse } from 'next/server';
import { DbRepository } from '@/lib/repository/db';
import { verifyAdminAuth } from '@/lib/auth/guard';

export async function GET(req: NextRequest) {
  const auth = await verifyAdminAuth(req);
  if (!auth.authorized) return auth.response!;

  try {
    const { searchParams } = new URL(req.url);
    const packageId = searchParams.get('packageId') || undefined;
    const picId = searchParams.get('picId') || undefined;

    const { buffer, fileName, mimeType } = await DbRepository.exportPaymentsExcel({
      packageId,
      picId,
    });

    // Record Export Job
    await DbRepository.createExportJob({
      export_type: 'PAYMENT_REPORT',
      package_id: packageId,
      filters: { picId },
      file_name: fileName,
      mime_type: mimeType,
      file_size: buffer.length,
      created_by: auth.session?.userId,
    });

    return new NextResponse(buffer as any, {
      status: 200,
      headers: {
        'Content-Type': mimeType,
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'Content-Length': buffer.length.toString(),
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Gagal mengekspor riwayat pembayaran ke Excel' },
      { status: 500 }
    );
  }
}
