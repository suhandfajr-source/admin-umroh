import ExcelJS from 'exceljs';
import { DbRepository } from '@/lib/repository/db';
import { PackageEquipmentRecap, ParticipantEquipmentRow } from '@/types/database.types';

export class EquipmentExportService {
  /**
   * Generates a comprehensive 3-sheet operational Excel report for Package Equipment
   * Sheet 1: Ringkasan Per Item
   * Sheet 2: Rekap Varian
   * Sheet 3: Detail Per Pax
   * All quantity cells are strictly NUMERIC integers for Excel formulas/pivot compatibility.
   */
  public static async generatePackageEquipmentExcel(packageId: string): Promise<{
    buffer: ArrayBuffer;
    filename: string;
    mimeType: string;
  }> {
    const recap = await DbRepository.getPackageEquipmentRecap(packageId);
    const participantRows = await DbRepository.getParticipantEquipmentList(packageId);
    const pkg = await DbRepository.getPackageById(packageId);

    const safePkgName = (recap.package_name || 'PAKET').toUpperCase().replace(/[^A-Z0-9]/g, '_');
    const filename = `LAPORAN_PERLENGKAPAN_${safePkgName}.xlsx`;

    const wb = new ExcelJS.Workbook();
    wb.creator = 'Sistem Manajemen Umroh';
    wb.created = new Date();

    // =========================================================================
    // SHEET 1: RINGKASAN PER ITEM
    // =========================================================================
    const wsSummary = wb.addWorksheet('Ringkasan Per Item');
    wsSummary.views = [{ showGridLines: true }];

    // Header Title
    wsSummary.mergeCells('A1:I1');
    const titleCell1 = wsSummary.getCell('A1');
    titleCell1.value = `LAPORAN RINGKASAN PERLENGKAPAN — ${recap.package_name.toUpperCase()}`;
    titleCell1.font = { bold: true, size: 14, color: { argb: 'FF1E293B' } };
    titleCell1.alignment = { vertical: 'middle' };

    wsSummary.mergeCells('A2:I2');
    const metaCell1 = wsSummary.getCell('A2');
    metaCell1.value = `Total Jamaah: ${recap.total_active_participants} Pax (Pria: ${recap.male_count}, Wanita: ${recap.female_count}) | Generated: ${new Date().toLocaleString('id-ID')}`;
    metaCell1.font = { italic: true, size: 10, color: { argb: 'FF64748B' } };

    // Table Headers
    const headers1 = [
      'No',
      'Nama Perlengkapan',
      'Kategori',
      'Aturan Gender',
      'Butuh Ukuran',
      'Kebutuhan',
      'Disiapkan',
      'Diserahkan',
      'Sisa Belum Serah',
    ];
    const headerRow1 = wsSummary.addRow(headers1);
    headerRow1.height = 24;
    headerRow1.eachCell(cell => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F766E' } };
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
      cell.border = {
        top: { style: 'thin' },
        bottom: { style: 'thin' },
        left: { style: 'thin' },
        right: { style: 'thin' },
      };
    });

    let rowIndex1 = 4;
    recap.item_summaries.forEach((item, idx) => {
      const remaining = item.total_remaining;
      const row = wsSummary.addRow([
        idx + 1,
        item.item_name,
        item.category,
        item.applicability === 'ALL' ? 'Semua (Pria & Wanita)' : item.applicability === 'MALE' ? 'Khusus Pria' : 'Khusus Wanita',
        item.requires_variant ? 'Ya (Ada Ukuran)' : 'Tidak',
        item.total_needed,    // Strictly numeric
        item.total_prepared,    // Strictly numeric
        item.total_handed_over, // Strictly numeric
        remaining,              // Strictly numeric
      ]);

      row.eachCell((cell, colNumber) => {
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        };
        if (colNumber === 1 || colNumber === 4 || colNumber === 5) {
          cell.alignment = { horizontal: 'center' };
        } else if (colNumber >= 6) {
          cell.alignment = { horizontal: 'right' };
          cell.numFmt = '#,##0';
        }
      });
      rowIndex1++;
    });

    // Totals Row with Formulas
    if (recap.item_summaries.length > 0) {
      const totalRow = wsSummary.addRow([
        '',
        'TOTAL KESELURUHAN',
        '',
        '',
        '',
        { formula: `SUM(F4:F${rowIndex1 - 1})` },
        { formula: `SUM(G4:G${rowIndex1 - 1})` },
        { formula: `SUM(H4:H${rowIndex1 - 1})` },
        { formula: `SUM(I4:I${rowIndex1 - 1})` },
      ]);
      totalRow.height = 22;
      totalRow.eachCell((cell, colNumber) => {
        cell.font = { bold: true };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
        cell.border = {
          top: { style: 'double' },
          bottom: { style: 'double' },
          left: { style: 'thin' },
          right: { style: 'thin' },
        };
        if (colNumber >= 6) {
          cell.alignment = { horizontal: 'right' };
          cell.numFmt = '#,##0';
        }
      });
    }

    wsSummary.columns = [
      { width: 6 },
      { width: 28 },
      { width: 14 },
      { width: 24 },
      { width: 16 },
      { width: 14 },
      { width: 14 },
      { width: 14 },
      { width: 18 },
    ];

    // =========================================================================
    // SHEET 2: REKAP VARIAN / UKURAN
    // =========================================================================
    const wsVariant = wb.addWorksheet('Rekap Varian');
    wsVariant.views = [{ showGridLines: true }];

    wsVariant.mergeCells('A1:F1');
    const titleCell2 = wsVariant.getCell('A1');
    titleCell2.value = `REKAP UKURAN & VARIAN PERLENGKAPAN — ${recap.package_name.toUpperCase()}`;
    titleCell2.font = { bold: true, size: 14, color: { argb: 'FF1E293B' } };

    const headers2 = ['No', 'Nama Perlengkapan', 'Ukuran / Varian', 'Kebutuhan', 'Disiapkan', 'Diserahkan'];
    const headerRow2 = wsVariant.addRow(headers2);
    headerRow2.height = 24;
    headerRow2.eachCell(cell => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0284C7' } };
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
      cell.border = {
        top: { style: 'thin' },
        bottom: { style: 'thin' },
        left: { style: 'thin' },
        right: { style: 'thin' },
      };
    });

    let vIdx = 1;
    for (const item of recap.item_summaries) {
      if (item.requires_variant && item.variant_breakdown) {
        for (const vb of item.variant_breakdown) {
          const row = wsVariant.addRow([
            vIdx++,
            item.item_name,
            vb.label,
            vb.qty_needed,      // Strictly numeric
            vb.qty_prepared,    // Strictly numeric
            vb.qty_handed_over, // Strictly numeric
          ]);
          row.eachCell((cell, colNumber) => {
            cell.border = {
              top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
              bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
              left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
              right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            };
            if (colNumber === 1 || colNumber === 3) {
              cell.alignment = { horizontal: 'center' };
            } else if (colNumber >= 4) {
              cell.alignment = { horizontal: 'right' };
              cell.numFmt = '#,##0';
            }
          });
        }
      }
    }

    wsVariant.columns = [
      { width: 6 },
      { width: 28 },
      { width: 18 },
      { width: 14 },
      { width: 14 },
      { width: 14 },
    ];

    // =========================================================================
    // SHEET 3: DETAIL PER PAX
    // =========================================================================
    const wsPax = wb.addWorksheet('Detail Per Pax');
    wsPax.views = [{ showGridLines: true }];

    wsPax.mergeCells('A1:M1');
    const titleCell3 = wsPax.getCell('A1');
    titleCell3.value = `DETAIL PENERIMAAN PERLENGKAPAN JAMAAH — ${recap.package_name.toUpperCase()}`;
    titleCell3.font = { bold: true, size: 14, color: { argb: 'FF1E293B' } };

    const headers3 = [
      'No',
      'Nama Jamaah',
      'No. Paspor',
      'Gender',
      'PIC / Rombongan',
      'Item Perlengkapan',
      'Ukuran / Varian',
      'Kebutuhan',
      'Disiapkan',
      'Diserahkan',
      'Status Item',
      'Tanggal Serah Terima',
      'Catatan',
    ];
    const headerRow3 = wsPax.addRow(headers3);
    headerRow3.height = 24;
    headerRow3.eachCell(cell => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF475569' } };
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
      cell.border = {
        top: { style: 'thin' },
        bottom: { style: 'thin' },
        left: { style: 'thin' },
        right: { style: 'thin' },
      };
    });

    let paxRowCounter = 1;
    for (const pax of participantRows) {
      for (const itm of pax.items) {
        const row = wsPax.addRow([
          paxRowCounter++,
          pax.passport_name || pax.jamaah_name,
          pax.passport_number || '-',
          pax.gender === 'MALE' ? 'L' : pax.gender === 'FEMALE' ? 'P' : '-',
          pax.pic_name || 'Direct',
          itm.item_name,
          itm.variant_label || (itm.requires_variant ? 'Belum Diisi' : '-'),
          itm.quantity_expected,    // Strictly numeric
          itm.quantity_prepared,    // Strictly numeric
          itm.quantity_handed_over, // Strictly numeric
          itm.status.replace(/_/g, ' '),
          itm.handed_over_at ? new Date(itm.handed_over_at).toLocaleDateString('id-ID') : '-',
          itm.notes || '',
        ]);

        row.eachCell((cell, colNumber) => {
          cell.border = {
            top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          };
          if (colNumber === 1 || colNumber === 4 || colNumber === 7 || colNumber === 11 || colNumber === 12) {
            cell.alignment = { horizontal: 'center' };
          } else if (colNumber >= 8 && colNumber <= 10) {
            cell.alignment = { horizontal: 'right' };
            cell.numFmt = '#,##0';
          }
        });
      }
    }

    wsPax.columns = [
      { width: 6 },
      { width: 28 },
      { width: 14 },
      { width: 8 },
      { width: 22 },
      { width: 24 },
      { width: 16 },
      { width: 12 },
      { width: 12 },
      { width: 12 },
      { width: 20 },
      { width: 20 },
      { width: 24 },
    ];

    const buffer = await wb.xlsx.writeBuffer();
    return {
      buffer: buffer as ArrayBuffer,
      filename,
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    };
  }

  /**
   * Generates a printable operational matrix checklist Excel workbook
   * Matrix format: Pax Rows x Equipment Columns with sizing/checkmarks
   */
  public static async generatePackageChecklistExcel(packageId: string): Promise<{
    buffer: ArrayBuffer;
    filename: string;
    mimeType: string;
  }> {
    const recap = await DbRepository.getPackageEquipmentRecap(packageId);
    const participantRows = await DbRepository.getParticipantEquipmentList(packageId);

    const safePkgName = (recap.package_name || 'PAKET').toUpperCase().replace(/[^A-Z0-9]/g, '_');
    const filename = `CHECKLIST_PERLENGKAPAN_${safePkgName}.xlsx`;

    const wb = new ExcelJS.Workbook();
    wb.creator = 'Sistem Manajemen Umroh';
    const ws = wb.addWorksheet('Checklist Manasik');
    ws.views = [{ showGridLines: true }];

    // Active package items
    const pkgItems = recap.item_summaries;

    // Header Title
    const totalCols = 5 + pkgItems.length + 2;
    ws.mergeCells(1, 1, 1, totalCols);
    const titleCell = ws.getCell('A1');
    titleCell.value = `CHECKLIST DISTRIBUSI PERLENGKAPAN — ${recap.package_name.toUpperCase()}`;
    titleCell.font = { bold: true, size: 14, color: { argb: 'FF1E293B' } };

    // Headers
    const headers = ['No', 'Nama Jamaah', 'No. Paspor', 'Gender', 'PIC / Rombongan'];
    for (const item of pkgItems) {
      headers.push(item.item_name);
    }
    headers.push('Status Lengkap', 'Tanda Tangan / Paraf');

    const headerRow = ws.addRow(headers);
    headerRow.height = 26;
    headerRow.eachCell(cell => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
      cell.border = {
        top: { style: 'thin' },
        bottom: { style: 'thin' },
        left: { style: 'thin' },
        right: { style: 'thin' },
      };
    });

    participantRows.forEach((pax, idx) => {
      const rowValues: any[] = [
        idx + 1,
        pax.passport_name || pax.jamaah_name,
        pax.passport_number || '-',
        pax.gender === 'MALE' ? 'L' : pax.gender === 'FEMALE' ? 'P' : '-',
        pax.pic_name || 'Direct',
      ];

      for (const eq of pkgItems) {
        const itemDetail = pax.items.find(it => it.equipment_item_id === eq.equipment_item_id);
        if (!itemDetail) {
          rowValues.push('-'); // Not applicable
        } else if (itemDetail.requires_variant) {
          const varLabel = itemDetail.variant_label || 'Belum Diisi';
          const statusMark = itemDetail.status === 'SUDAH_DISERAHKAN' ? '✓' : '';
          rowValues.push(statusMark ? `${varLabel} (${statusMark})` : varLabel);
        } else {
          rowValues.push(itemDetail.status === 'SUDAH_DISERAHKAN' ? '✓' : itemDetail.status === 'SIAP' ? 'Siap' : 'Belum');
        }
      }

      rowValues.push(pax.overall_status === 'COLLECTED' ? 'Lengkap' : 'Belum', '');

      const row = ws.addRow(rowValues);
      row.height = 20;
      row.eachCell((cell, colNumber) => {
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        };
        if (colNumber === 1 || colNumber === 4 || colNumber > 5) {
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
        }
      });
    });

    ws.columns = [
      { width: 6 },
      { width: 28 },
      { width: 14 },
      { width: 8 },
      { width: 22 },
      ...pkgItems.map(() => ({ width: 16 })),
      { width: 16 },
      { width: 20 },
    ];

    const buffer = await wb.xlsx.writeBuffer();
    return {
      buffer: buffer as ArrayBuffer,
      filename,
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    };
  }
}
