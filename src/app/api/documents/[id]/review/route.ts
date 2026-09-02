import { NextRequest, NextResponse } from 'next/server';
import { DbRepository } from '@/lib/repository/db';
import { KkFamilyMember } from '@/types/document.types';

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const docId = params.id;
    const body = await req.json();
    const { action, targetJamaahId, fields, selectedKkMembers } = body;

    // Special Case: KK Multi-Member selective creation
    if (action === 'CREATE_NEW' && selectedKkMembers && Array.isArray(selectedKkMembers) && selectedKkMembers.length > 0) {
      const createdJamaahList = [];

      for (const member of (selectedKkMembers as KkFamilyMember[])) {
        const created = await DbRepository.createJamaah({
          identity_name: member.name,
          gender: member.gender || null,
          birth_place: member.birth_place || null,
          birth_date: member.birth_date || null,
          nik: member.nik || null,
          kk_number: fields.kk_number || null,
          address: fields.address || null,
          notes: `Anggota KK (${member.relationship || 'Anggota'}) - Dibuat via Unggah KK`,
        });
        createdJamaahList.push(created);
      }

      // Mark the KK document as confirmed and associate with first member
      if (createdJamaahList.length > 0) {
        await DbRepository.confirmDocumentReview(
          docId, 
          'UPDATE_EXISTING', 
          createdJamaahList[0].id, 
          fields
        );
      }

      return NextResponse.json({
        success: true,
        message: `${createdJamaahList.length} Anggota KK berhasil dibuat menjadi Master Jamaah.`,
        jamaah_list: createdJamaahList,
      });
    }

    // Standard Passport / KTP / Single Record Confirmation
    const result = await DbRepository.confirmDocumentReview(
      docId,
      action,
      targetJamaahId,
      fields
    );

    if (!result.success) {
      return NextResponse.json({ error: result.error || 'Gagal mengonfirmasi review' }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      jamaah: result.jamaah,
    });
  } catch (error: any) {
    console.error('Review confirmation error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
