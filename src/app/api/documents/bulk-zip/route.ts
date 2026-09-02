import { NextRequest, NextResponse } from 'next/server';
import { DbRepository } from '@/lib/repository/db';
import { verifyAdminAuth } from '@/lib/auth/guard';
import { DocumentType } from '@/types/database.types';

export async function POST(req: NextRequest) {
  const auth = await verifyAdminAuth(req);
  if (!auth.authorized) return auth.response!;

  try {
    const body = await req.json();
    const { package_id, pic_id, document_types, current_only, action } = body;

    if (!package_id) {
      return NextResponse.json({ error: 'package_id wajib disertakan' }, { status: 400 });
    }

    const options = {
      picId: pic_id || undefined,
      documentTypes: (document_types as DocumentType[]) || ['PASSPORT'],
      currentOnly: current_only !== false,
    };

    if (action === 'preview') {
      const preview = await DbRepository.previewPackageDocuments(package_id, options);
      return NextResponse.json(preview);
    }

    // Action = 'download' -> Generate ZIP
    const { buffer, fileName, mimeType } = await DbRepository.generatePackageDocumentZip(package_id, options);

    // Record Export Job
    await DbRepository.createExportJob({
      export_type: 'DOCUMENT_ZIP',
      package_id,
      filters: options,
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
      { error: error.message || 'Gagal memproses download dokumen massal' },
      { status: 500 }
    );
  }
}
