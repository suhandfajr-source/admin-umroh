import { NextResponse } from 'next/server';
import { DbRepository } from '@/lib/repository/db';
import { StorageService } from '@/lib/repository/storage.service';

export async function GET() {
  try {
    const list = await DbRepository.getPendingReviewDocuments();
    const enriched = await Promise.all(
      list.map(async (doc) => {
        const signedUrl = await StorageService.getSignedUrl(doc.storage_path);
        return {
          ...doc,
          signed_url: signedUrl,
        };
      })
    );

    return NextResponse.json(enriched);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
