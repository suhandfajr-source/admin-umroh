import { NextRequest, NextResponse } from 'next/server';
import { DbRepository } from '@/lib/repository/db';
import { verifyAdminAuth } from '@/lib/auth/guard';
import { DocumentType, DocumentStatus } from '@/types/database.types';

export async function GET(req: NextRequest) {
  const auth = await verifyAdminAuth(req);
  if (!auth.authorized) return auth.response!;

  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search') || undefined;
    const documentType = (searchParams.get('documentType') as DocumentType) || undefined;
    const status = (searchParams.get('status') as DocumentStatus) || undefined;
    const isCurrentParam = searchParams.get('isCurrent');
    const isCurrent = isCurrentParam === 'true' ? true : isCurrentParam === 'false' ? false : undefined;
    const packageId = searchParams.get('packageId') || undefined;
    const picId = searchParams.get('picId') || undefined;

    const archive = await DbRepository.getDocumentArchive({
      search,
      documentType,
      status,
      isCurrent,
      packageId,
      picId,
    });

    return NextResponse.json(archive);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Gagal memuat arsip dokumen' },
      { status: 500 }
    );
  }
}
