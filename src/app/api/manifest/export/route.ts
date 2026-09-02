import { NextRequest, NextResponse } from 'next/server';
import { DbRepository } from '@/lib/repository/db';
import { verifyAdminAuth } from '@/lib/auth/guard';

export async function POST(req: NextRequest) {
  const auth = await verifyAdminAuth(req);
  if (!auth.authorized) return auth.response!;

  try {
    const body = await req.json();
    const { package_id, template_id, sorting, override_errors } = body;

    if (!package_id) {
      return NextResponse.json({ error: 'package_id wajib disertakan' }, { status: 400 });
    }

    // Check validation first unless overridden
    const validation = await DbRepository.validateManifest(package_id, template_id, sorting);
    if (validation.error_count > 0 && !override_errors) {
      return NextResponse.json({
        error: `Terdapat ${validation.error_count} jamaah dengan error validasi data. Perbaiki data sebelum export atau gunakan override.`,
        validation,
      }, { status: 422 });
    }

    const { buffer, fileName, mimeType } = await DbRepository.exportManifestExcel(
      package_id,
      template_id,
      null,
      { sorting, overrideErrors: override_errors }
    );

    // Record Export Job Audit
    await DbRepository.createExportJob({
      export_type: 'MANIFEST',
      package_id,
      filters: { template_id, sorting, override_errors },
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
      { error: error.message || 'Gagal mengekspor manifest Excel' },
      { status: 500 }
    );
  }
}
