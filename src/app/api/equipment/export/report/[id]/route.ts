import { NextRequest, NextResponse } from 'next/server';
import { EquipmentExportService } from '@/lib/export/equipment-export';
import { verifyAdminAuth } from '@/lib/auth/guard';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await verifyAdminAuth(req);
  if (!auth.authorized) return auth.response!;

  try {
    const { buffer, filename, mimeType } = await EquipmentExportService.generatePackageEquipmentExcel(params.id);

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': mimeType,
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Gagal mengexport laporan perlengkapan' }, { status: 500 });
  }
}
