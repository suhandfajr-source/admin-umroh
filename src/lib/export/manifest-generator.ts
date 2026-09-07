import ExcelJS from 'exceljs';
import { 
  Package, 
  PackageParticipant, 
  Jamaah, 
  ManifestTemplate, 
  ManifestSystemField 
} from '@/types/database.types';

export interface ManifestExportOptions {
  sorting?: 'DEFAULT' | 'NAME' | 'PASSPORT_NAME' | 'PIC';
  overrideErrors?: boolean;
}

export class ManifestGenerator {
  /**
   * Sanitizes string for safe filenames
   */
  public static sanitizeFilename(str: string): string {
    return str
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9_-]/g, '_')
      .replace(/_+/g, '_');
  }

  /**
   * Generates Manifest Excel workbook buffer
   */
  public static async generateManifestExcel(
    pkg: Package,
    participants: (PackageParticipant & { jamaah?: Jamaah; pic?: any })[],
    template?: ManifestTemplate | null,
    templateBuffer?: Buffer | null,
    options?: ManifestExportOptions
  ): Promise<{ buffer: Buffer; fileName: string; mimeType: string }> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Admin Umroh Operations';
    workbook.created = new Date();

    const activeParticipants = participants.filter(p => !p.deleted_at);

    // Apply Sorting
    const sortedParticipants = [...activeParticipants];
    if (options?.sorting === 'NAME') {
      sortedParticipants.sort((a, b) => 
        (a.jamaah?.identity_name || '').localeCompare(b.jamaah?.identity_name || '')
      );
    } else if (options?.sorting === 'PASSPORT_NAME') {
      sortedParticipants.sort((a, b) => 
        (a.jamaah?.passport_name || a.jamaah?.identity_name || '').localeCompare(
          b.jamaah?.passport_name || b.jamaah?.identity_name || ''
        )
      );
    } else if (options?.sorting === 'PIC') {
      sortedParticipants.sort((a, b) => 
        (a.pic?.name || 'Direct').localeCompare(b.pic?.name || 'Direct')
      );
    }

    const mapping = template?.field_mapping || {
      A: 'no',
      B: 'passport_name',
      C: 'passport_number',
      D: 'gender',
      E: 'birth_place',
      F: 'birth_date',
      G: 'passport_issue_place',
      H: 'passport_issue_date',
      I: 'passport_expiry_date',
      J: 'nik',
      K: 'phone',
      L: 'pic_name',
    };

    let worksheet: ExcelJS.Worksheet;

    if (templateBuffer) {
      // 1. Preserve existing company template workbook
      await workbook.xlsx.load(templateBuffer as any);
      worksheet = template?.worksheet_name 
        ? workbook.getWorksheet(template.worksheet_name) || workbook.worksheets[0]
        : workbook.worksheets[0];
    } else {
      // 2. Standard Clean Professional Manifest Layout
      worksheet = workbook.addWorksheet(template?.worksheet_name || 'Manifest Jamaah');

      // Top Title & Header Meta
      worksheet.mergeCells('A1:L1');
      const titleCell = worksheet.getCell('A1');
      titleCell.value = `MANIFEST PENERBANGAN UMRAH — ${pkg.package_name.toUpperCase()}`;
      titleCell.font = { name: 'Arial', size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
      titleCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF0F766E' }, // Emerald Teal
      };
      titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
      worksheet.getRow(1).height = 32;

      // Meta info rows
      worksheet.mergeCells('A2:F2');
      worksheet.getCell('A2').value = `Jadwal: ${pkg.departure_date} s/d ${pkg.return_date} | Maskapai: ${pkg.airline || '-'}`;
      worksheet.getCell('A2').font = { name: 'Arial', size: 10, italic: true };

      worksheet.mergeCells('G2:L2');
      worksheet.getCell('G2').value = `Total Peserta: ${activeParticipants.length} Pax | Hotel: Makkah (${pkg.makkah_hotel || '-'}), Madinah (${pkg.madinah_hotel || '-'})`;
      worksheet.getCell('G2').font = { name: 'Arial', size: 10, italic: true };
      worksheet.getCell('G2').alignment = { horizontal: 'right' };
      worksheet.getRow(2).height = 20;

      // Column Headers
      const headerRowIndex = template?.header_row || 4;
      const headerRow = worksheet.getRow(headerRowIndex);
      headerRow.height = 26;

      const columnLabels: Record<string, string> = {
        no: 'NO',
        passport_name: 'NAMA PASPOR (SESUAI PASPOR)',
        passport_number: 'NO. PASPOR',
        gender: 'GENDER',
        birth_place: 'TEMPAT LAHIR',
        birth_date: 'TGL LAHIR',
        passport_issue_place: 'KANTOR PENERBIT',
        passport_issue_date: 'TGL TERBIT',
        passport_expiry_date: 'TGL EXPIRY',
        nik: 'NIK / KTP',
        phone: 'NO. TELEPON / HP',
        pic_name: 'PIC / MITRA',
        relationship: 'HUBUNGAN / MAHRAM',
        marital_status: 'STATUS PERNIKAHAN',
        selling_price: 'HARGA JUAL',
        b2b_price: 'HARGA B2B',
        participant_status: 'STATUS PESERTA',
        address: 'ALAMAT LENGKAP',
      };

      for (const [colLetter, fieldKey] of Object.entries(mapping)) {
        const cell = worksheet.getCell(`${colLetter}${headerRowIndex}`);
        cell.value = columnLabels[fieldKey] || fieldKey.toUpperCase();
        cell.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FF1E293B' } };
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFF1F5F9' },
        };
        cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
          left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
          bottom: { style: 'medium', color: { argb: 'FF94A3B8' } },
          right: { style: 'thin', color: { argb: 'FFCBD5E1' } },
        };
      }
    }

    const startRowIndex = template?.data_start_row || (templateBuffer ? 2 : 5);
    let currentRowIndex = startRowIndex;
    let seq = 1;

    for (const part of sortedParticipants) {
      const j = part.jamaah;

      // Extract system values
      // Rule: Manifest name STRICTLY uses passport_name. No fallback to identity_name.
      const pName = j?.passport_name || '';
      const pNumber = j?.passport_number || '';
      const bPlace = j?.birth_place || '';
      const bDate = j?.birth_date || '';
      let genderVal = j?.gender || '';
      const pIssuePlace = j?.passport_issue_place || '';
      const pIssueDate = j?.passport_issue_date || '';
      const pExpiryDate = j?.passport_expiry_date || '';
      const nik = j?.nik || '';
      const kk = j?.kk_number || '';
      const phone = j?.phone || '';
      const addr = j?.address || '';
      const picName = part.pic?.name || 'Direct';
      const relationshipVal = (part as any).relationship || j?.relationship || (j?.notes?.match(/Hubungan:\s*([^,\n]+)/i)?.[1]?.trim()) || '';
      const maritalStatusVal = (part as any).marital_status || j?.marital_status || (j?.notes?.match(/Status Pernikahan:\s*([^,\n]+)/i)?.[1]?.trim()) || '';

      // Value Transformations (e.g. Gender M/F)
      if (template?.value_transformations?.gender && genderVal) {
        genderVal = template.value_transformations.gender[genderVal] || genderVal;
      }

      const rowValuesMap: Record<ManifestSystemField, any> = {
        no: seq,
        passport_name: pName,
        passport_number: pNumber,
        gender: genderVal,
        birth_place: bPlace,
        birth_date: bDate,
        passport_issue_place: pIssuePlace,
        passport_issue_date: pIssueDate,
        passport_expiry_date: pExpiryDate,
        ktp_name: j?.ktp_name || '',
        identity_name: j?.identity_name || '',
        nik: nik,
        kk_number: kk,
        phone: phone,
        address: addr,
        relationship: relationshipVal,
        marital_status: maritalStatusVal,
        package_name: pkg.package_name,
        departure_date: pkg.departure_date,
        return_date: pkg.return_date,
        airline: pkg.airline || '',
        makkah_hotel: pkg.makkah_hotel || '',
        madinah_hotel: pkg.madinah_hotel || '',
        pic_name: picName,
        selling_price: part.selling_price || 0,
        b2b_price: part.b2b_price || 0,
        participant_status: part.participant_status,
      };

      const row = worksheet.getRow(currentRowIndex);
      row.height = 22;

      for (const [colLetter, fieldKey] of Object.entries(mapping)) {
        const cell = worksheet.getCell(`${colLetter}${currentRowIndex}`);
        const val = rowValuesMap[fieldKey];

        // Format dates as real date-compatible Excel cells
        if (fieldKey.includes('date') && val) {
          if (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}/.test(val)) {
            const [y, m, d] = val.split('-').map(Number);
            cell.value = new Date(Date.UTC(y, m - 1, d));
            cell.numFmt = 'yyyy-mm-dd';
          } else if (val instanceof Date) {
            cell.value = val;
            cell.numFmt = 'yyyy-mm-dd';
          } else {
            cell.value = val;
          }
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
        } else if (fieldKey === 'no') {
          cell.value = Number(val);
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
        } else if (fieldKey === 'passport_number') {
          cell.value = String(val);
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
          cell.font = { name: 'Arial', size: 9.5, bold: true };
        } else if (fieldKey === 'selling_price' || fieldKey === 'b2b_price') {
          cell.value = Number(val);
          cell.numFmt = '"Rp "#,##0';
          cell.alignment = { vertical: 'middle', horizontal: 'right' };
        } else {
          cell.value = val !== undefined && val !== null ? val : '';
          cell.alignment = { vertical: 'middle', horizontal: fieldKey === 'gender' ? 'center' : 'left' };
        }

        if (!templateBuffer) {
          cell.font = cell.font || { name: 'Arial', size: 9.5 };
          cell.border = {
            top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          };

          // Alternate zebra striping
          if (seq % 2 === 0) {
            cell.fill = {
              type: 'pattern',
              pattern: 'solid',
              fgColor: { argb: 'FFF8FAFC' },
            };
          }
        }
      }

      seq++;
      currentRowIndex++;
    }

    // Auto-adjust column widths if standard template
    if (!templateBuffer) {
      worksheet.columns.forEach(column => {
        let maxLen = 12;
        column.eachCell?.({ includeEmpty: false }, cell => {
          const valStr = cell.value ? cell.value.toString() : '';
          if (valStr.length > maxLen) {
            maxLen = Math.min(valStr.length + 3, 40);
          }
        });
        column.width = maxLen;
      });
    }

    const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
    const safePkgName = this.sanitizeFilename(pkg.package_name);
    const fileName = `MANIFEST_${safePkgName}_${pkg.departure_date || 'DATE'}.xlsx`;

    try {
      const { AuditService } = await import('@/lib/audit/audit-service');
      await AuditService.logMutation({
        action: 'MANIFEST_EXPORTED',
        entityType: 'PACKAGE_MANIFEST',
        entityId: pkg.id,
        packageId: pkg.id,
        packageName: pkg.package_name,
        metadata: { file_name: fileName, total_pax: activeParticipants.length },
      });
    } catch {}

    return {
      buffer,
      fileName,
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    };
  }
}
