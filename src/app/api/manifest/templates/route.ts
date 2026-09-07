import { NextRequest, NextResponse } from 'next/server';
import { DbRepository } from '@/lib/repository/db';
import { verifyAdminAuth } from '@/lib/auth/guard';

export async function GET(req: NextRequest) {
  const auth = await verifyAdminAuth(req);
  if (!auth.authorized) return auth.response!;

  try {
    const templates = await DbRepository.getManifestTemplates();
    return NextResponse.json(templates);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Gagal memuat daftar template manifest' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const auth = await verifyAdminAuth(req);
  if (!auth.authorized) return auth.response!;

  try {
    const body = await req.json();
    const { name, worksheet_name, header_row, data_start_row, field_mapping, column_headers, date_formats, value_transformations, is_default } = body;

    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'Nama template wajib diisi.' }, { status: 400 });
    }

    const created = await DbRepository.createManifestTemplate({
      name: name.trim(),
      worksheet_name: worksheet_name || 'Manifest',
      header_row: Number(header_row) || 1,
      data_start_row: Number(data_start_row) || 2,
      field_mapping: field_mapping || {},
      column_headers: column_headers || {},
      date_formats,
      value_transformations,
      is_default: !!is_default,
      created_by: auth.session?.userId,
    });

    return NextResponse.json(created, { status: 201 });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Gagal membuat template manifest' },
      { status: 400 }
    );
  }
}
