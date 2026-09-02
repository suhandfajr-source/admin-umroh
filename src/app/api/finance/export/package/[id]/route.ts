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
    const { searchParams } = new URL(req.url);
    const picId = searchParams.get('picId') || undefined;
    const status = searchParams.get('status') || undefined;

    const { buffer, fileName, mimeType } = await DbRepository.exportPackageFinanceExcel(params.id, {
      picId,
      status,
    });

    // Record Export Job
    await DbRepository.createExportJob({
      export_type: 'PACKAGE_FINANCE',
      package_id: params.id,
      filters: { picId, status },
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
      { error: error.message || 'Gagal mengekspor laporan keuangan paket ke Excel' },
      { status: 500 }
    );
  }
}
