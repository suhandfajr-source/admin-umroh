import { NextRequest, NextResponse } from 'next/server';
import { StorageService } from '@/lib/repository/storage.service';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const storagePath = searchParams.get('path');

    if (!storagePath) {
      return new NextResponse('Parameter path diperlukan', { status: 400 });
    }

    const fileData = await StorageService.getFileBuffer(storagePath);
    if (!fileData) {
      return new NextResponse('File tidak ditemukan', { status: 404 });
    }

    return new NextResponse(new Uint8Array(fileData.buffer), {
      headers: {
        'Content-Type': fileData.mimeType,
        'Content-Length': fileData.buffer.length.toString(),
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch (err: any) {
    return new NextResponse(err?.message || 'Gagal memuat berkas', { status: 500 });
  }
}
