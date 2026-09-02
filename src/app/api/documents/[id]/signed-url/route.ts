import { NextRequest, NextResponse } from 'next/server';
import { StorageService } from '@/lib/repository/storage.service';
import { DbRepository } from '@/lib/repository/db';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const doc = await DbRepository.getDocumentWithExtraction(params.id);
    if (!doc) {
      return NextResponse.json({ error: 'Dokumen tidak ditemukan' }, { status: 404 });
    }

    const signedUrl = await StorageService.getSignedUrl(doc.storage_path);
    return NextResponse.json({ signed_url: signedUrl });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
