import ExcelJS from 'exceljs';
import { PackageFinanceReport } from '@/types/database.types';
import { ManifestGenerator } from './manifest-generator';

export interface FinanceExportFilterOptions {
  picId?: string;
  status?: string;
}

export class FinanceExportService {
  /**
   * Generates 3-sheet Package Financial Report Excel workbook (.xlsx)
   */
  public static async generatePackageFinanceExcel(
    report: PackageFinanceReport,
    filters?: FinanceExportFilterOptions
  ): Promise<{ buffer: Buffer; fileName: string; mimeType: string }> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Admin Umroh Finance System';
    workbook.created = new Date();

    // Filter pax and pic if requested
    let paxList = report.pax_details;
    if (filters?.picId) {
      paxList = paxList.filter(p => p.pic_id === filters.picId || (filters.picId === 'DIRECT' && !p.pic_id));
    }
    if (filters?.status) {
      paxList = paxList.filter(p => p.status === filters.status);
    }

    let picList = report.pic_breakdowns;
    if (filters?.picId) {
      picList = picList.filter(p => p.pic_id === filters.picId || (filters.picId === 'DIRECT' && !p.pic_id));
    }

    // =========================================================================
    // SHEET 1: RINGKASAN PAKET
    // =========================================================================
    const wsSummary = workbook.addWorksheet('Ringkasan Paket');
    wsSummary.properties.tabColor = { argb: 'FF0F766E' };

    // Title
    wsSummary.mergeCells('A1:D1');
    const s1Title = wsSummary.getCell('A1');
    s1Title.value = `RINGKASAN KEUANGAN PAKET — ${report.package_name.toUpperCase()}`;
    s1Title.font = { name: 'Arial', size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
    s1Title.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F766E' } };
    s1Title.alignment = { vertical: 'middle', horizontal: 'center' };
    wsSummary.getRow(1).height = 32;

    // Package Metadata
    const metaRows = [
      ['Nama Paket', report.package_name, 'Total Jamaah Terdaftar', `${report.registered_pax} Pax`],
      ['Tanggal Keberangkatan', report.departure_date, 'Status Kelunasan (Lunas)', `${report.paid_pax_count} Pax`],
      ['Tanggal Kepulangan', report.return_date, 'Status Kelunasan (Belum/Cicil)', `${report.unpaid_pax_count} Pax`],
    ];

    metaRows.forEach((row, idx) => {
      const r = wsSummary.getRow(idx + 3);
      r.getCell(1).value = row[0];
      r.getCell(1).font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF475569' } };

      const val = row[1];
      if (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}/.test(val)) {
        const [y, m, d] = val.split('-').map(Number);
        r.getCell(2).value = new Date(Date.UTC(y, m - 1, d));
        r.getCell(2).numFmt = 'yyyy-mm-dd';
      } else {
        r.getCell(2).value = val;
      }
      r.getCell(2).font = { name: 'Arial', size: 10, bold: true };

      r.getCell(3).value = row[2];
      r.getCell(3).font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF475569' } };
      r.getCell(4).value = row[3];
      r.getCell(4).font = { name: 'Arial', size: 10, bold: true };
      r.height = 20;
    });

    // KPI Metrics Section Header
    wsSummary.mergeCells('A7:D7');
    const s1KpiHeader = wsSummary.getCell('A7');
    s1KpiHeader.value = 'METRIK KEUANGAN UTAMA (RAW NUMERIC BIGINT)';
    s1KpiHeader.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF0F766E' } };
    s1KpiHeader.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
    s1KpiHeader.alignment = { vertical: 'middle', horizontal: 'left' };
    wsSummary.getRow(7).height = 24;

    const summaryKpis = [
      { label: 'Harga Acuan B2B / Pax', val: report.b2b_price_per_pax },
      { label: 'Total Nilai B2B Seluruh Pax', val: report.total_b2b },
      { label: 'Total Harga Jual (Kotor)', val: report.total_selling_price },
      { label: 'Total Diskon Tour Leader / PIC', val: report.total_tl_discount },
      { label: 'Total Diskon Lainnya', val: report.total_discount },
      { label: 'Total Biaya Tambahan (Charges)', val: report.total_charge },
      { label: 'Total Penyesuaian (Adjustments)', val: report.total_adjustment },
      { label: 'Total Tagihan Bersih (Net Invoice)', val: report.total_net_invoice },
      { label: 'Total Pembayaran Masuk (Paid)', val: report.total_paid },
      { label: 'Total Sisa Piutang (Outstanding)', val: report.total_outstanding },
      { label: 'Total Kelebihan Bayar (Overpayment)', val: report.total_overpayment },
    ];

    let summaryRowIdx = 8;
    summaryKpis.forEach(kpi => {
      const r = wsSummary.getRow(summaryRowIdx);
      r.getCell(1).value = kpi.label;
      r.getCell(1).font = { name: 'Arial', size: 10, bold: kpi.label.includes('Bersih') || kpi.label.includes('Pembayaran') };
      
      const valCell = r.getCell(2);
      valCell.value = Number(kpi.val);
      valCell.numFmt = '"Rp "#,##0';
      valCell.font = { name: 'Arial', size: 10, bold: true };
      valCell.alignment = { horizontal: 'right' };

      r.getCell(1).border = { bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } } };
      r.getCell(2).border = { bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } } };
      r.height = 22;
      summaryRowIdx++;
    });

    wsSummary.getColumn(1).width = 38;
    wsSummary.getColumn(2).width = 24;
    wsSummary.getColumn(3).width = 30;
    wsSummary.getColumn(4).width = 24;

    // =========================================================================
    // SHEET 2: DETAIL PER PAX
    // =========================================================================
    const wsDetail = workbook.addWorksheet('Detail Per Pax');
    wsDetail.properties.tabColor = { argb: 'FF2563EB' };

    // Sheet 2 Title
    wsDetail.mergeCells('A1:M1');
    const s2Title = wsDetail.getCell('A1');
    s2Title.value = `RINCIAN FINANSIAL PER JAMAAH — ${report.package_name.toUpperCase()}`;
    s2Title.font = { name: 'Arial', size: 13, bold: true, color: { argb: 'FFFFFFFF' } };
    s2Title.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
    s2Title.alignment = { vertical: 'middle', horizontal: 'center' };
    wsDetail.getRow(1).height = 30;

    // Headers
    const s2Headers = [
      'NO',
      'NAMA JAMAAH',
      'NO. PASPOR',
      'PIC / TL',
      'HARGA B2B',
      'HARGA JUAL',
      'DISKON TL',
      'DISKON LAIN',
      'TAGIHAN BERSIH',
      'TOTAL DIBAYAR',
      'KEKURANGAN',
      'LEBIH BAYAR',
      'STATUS',
    ];

    const s2HeaderRow = wsDetail.getRow(3);
    s2HeaderRow.height = 26;
    s2Headers.forEach((h, i) => {
      const cell = s2HeaderRow.getCell(i + 1);
      cell.value = h;
      cell.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FF1E293B' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
        left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
        bottom: { style: 'medium', color: { argb: 'FF64748B' } },
        right: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      };
    });

    let s2RowIdx = 4;
    const startDataRow = 4;

    paxList.forEach((pax, idx) => {
      const row = wsDetail.getRow(s2RowIdx);
      row.height = 20;

      row.getCell(1).value = idx + 1;
      row.getCell(1).alignment = { horizontal: 'center' };
      row.getCell(2).value = pax.jamaah_name;
      row.getCell(3).value = pax.passport_number || '-';
      row.getCell(3).alignment = { horizontal: 'center' };
      row.getCell(4).value = pax.pic_name || 'Direct';

      // Numeric Monetary Values
      const b2bCell = row.getCell(5);
      b2bCell.value = Number(pax.b2b_price);
      b2bCell.numFmt = '"Rp "#,##0';

      const sellingCell = row.getCell(6);
      sellingCell.value = Number(pax.selling_price);
      sellingCell.numFmt = '"Rp "#,##0';

      const tlDiscCell = row.getCell(7);
      tlDiscCell.value = Number(pax.tl_discount);
      tlDiscCell.numFmt = '"Rp "#,##0';

      const otherDiscCell = row.getCell(8);
      otherDiscCell.value = Number(pax.discount);
      otherDiscCell.numFmt = '"Rp "#,##0';

      const netInvCell = row.getCell(9);
      netInvCell.value = Number(pax.net_invoice);
      netInvCell.numFmt = '"Rp "#,##0';
      netInvCell.font = { name: 'Arial', size: 9.5, bold: true };

      const paidCell = row.getCell(10);
      paidCell.value = Number(pax.total_paid);
      paidCell.numFmt = '"Rp "#,##0';
      paidCell.font = { name: 'Arial', size: 9.5, bold: true, color: { argb: 'FF047857' } };

      const outstandingCell = row.getCell(11);
      outstandingCell.value = Number(pax.outstanding);
      outstandingCell.numFmt = '"Rp "#,##0';
      outstandingCell.font = { name: 'Arial', size: 9.5, bold: true, color: { argb: 'FFBE123C' } };

      const overpayCell = row.getCell(12);
      overpayCell.value = Number(pax.overpayment);
      overpayCell.numFmt = '"Rp "#,##0';

      const statusCell = row.getCell(13);
      statusCell.value = pax.status;
      statusCell.alignment = { horizontal: 'center' };
      statusCell.font = { name: 'Arial', size: 9, bold: true };

      for (let c = 1; c <= 13; c++) {
        const cell = row.getCell(c);
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        };
        if (idx % 2 === 1) {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
        }
      }

      s2RowIdx++;
    });

    const endDataRow = s2RowIdx - 1;

    // Excel Total Row with SUM Formulas
    const totalRow = wsDetail.getRow(s2RowIdx);
    totalRow.height = 24;
    totalRow.getCell(1).value = 'TOTAL';
    totalRow.getCell(1).font = { name: 'Arial', size: 10, bold: true };
    totalRow.getCell(1).alignment = { horizontal: 'center' };
    wsDetail.mergeCells(`A${s2RowIdx}:D${s2RowIdx}`);

    const numericCols = [
      { col: 'E', cellIdx: 5 }, // B2B
      { col: 'F', cellIdx: 6 }, // Selling
      { col: 'G', cellIdx: 7 }, // TL Discount
      { col: 'H', cellIdx: 8 }, // Other Discount
      { col: 'I', cellIdx: 9 }, // Net Invoice
      { col: 'J', cellIdx: 10 }, // Paid
      { col: 'K', cellIdx: 11 }, // Outstanding
      { col: 'L', cellIdx: 12 }, // Overpayment
    ];

    numericCols.forEach(({ col, cellIdx }) => {
      const cell = totalRow.getCell(cellIdx);
      if (paxList.length > 0) {
        cell.value = { formula: `SUM(${col}${startDataRow}:${col}${endDataRow})` };
      } else {
        cell.value = 0;
      }
      cell.numFmt = '"Rp "#,##0';
      cell.font = { name: 'Arial', size: 10, bold: true };
    });

    for (let c = 1; c <= 13; c++) {
      const cell = totalRow.getCell(c);
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
      cell.border = {
        top: { style: 'medium', color: { argb: 'FF64748B' } },
        bottom: { style: 'double', color: { argb: 'FF1E293B' } },
      };
    }

    wsDetail.columns.forEach(col => { col.width = 16; });
    wsDetail.getColumn(1).width = 6;
    wsDetail.getColumn(2).width = 28;
    wsDetail.getColumn(3).width = 16;
    wsDetail.getColumn(4).width = 18;

    // =========================================================================
    // SHEET 3: BREAKDOWN PIC / TL
    // =========================================================================
    const wsPic = workbook.addWorksheet('Breakdown PIC & TL');
    wsPic.properties.tabColor = { argb: 'FFD97706' };

    // Sheet 3 Title
    wsPic.mergeCells('A1:I1');
    const s3Title = wsPic.getCell('A1');
    s3Title.value = `REKAPITULASI FINANSIAL PER PIC / TL — ${report.package_name.toUpperCase()}`;
    s3Title.font = { name: 'Arial', size: 13, bold: true, color: { argb: 'FFFFFFFF' } };
    s3Title.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF78350F' } };
    s3Title.alignment = { vertical: 'middle', horizontal: 'center' };
    wsPic.getRow(1).height = 30;

    const s3Headers = [
      'NO',
      'NAMA PIC / TL',
      'PAX',
      'TOTAL B2B',
      'TOTAL HARGA JUAL',
      'TOTAL DISKON TL',
      'TAGIHAN BERSIH',
      'TOTAL DIBAYAR',
      'SISA PIUTANG',
    ];

    const s3HeaderRow = wsPic.getRow(3);
    s3HeaderRow.height = 26;
    s3Headers.forEach((h, i) => {
      const cell = s3HeaderRow.getCell(i + 1);
      cell.value = h;
      cell.font = { name: 'Arial', size: 9.5, bold: true, color: { argb: 'FF1E293B' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
        left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
        bottom: { style: 'medium', color: { argb: 'FF64748B' } },
        right: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      };
    });

    let s3RowIdx = 4;
    const s3StartDataRow = 4;

    picList.forEach((pic, idx) => {
      const row = wsPic.getRow(s3RowIdx);
      row.height = 22;

      row.getCell(1).value = idx + 1;
      row.getCell(1).alignment = { horizontal: 'center' };
      row.getCell(2).value = pic.pic_name;
      row.getCell(2).font = { name: 'Arial', size: 9.5, bold: true };

      row.getCell(3).value = Number(pic.pax_count);
      row.getCell(3).alignment = { horizontal: 'center' };

      const b2b = row.getCell(4);
      b2b.value = Number(pic.total_b2b);
      b2b.numFmt = '"Rp "#,##0';

      const selling = row.getCell(5);
      selling.value = Number(pic.total_selling);
      selling.numFmt = '"Rp "#,##0';

      const tlDisc = row.getCell(6);
      tlDisc.value = Number(pic.total_tl_discount);
      tlDisc.numFmt = '"Rp "#,##0';

      const netInv = row.getCell(7);
      netInv.value = Number(pic.total_invoice);
      netInv.numFmt = '"Rp "#,##0';
      netInv.font = { name: 'Arial', size: 9.5, bold: true };

      const paid = row.getCell(8);
      paid.value = Number(pic.total_paid);
      paid.numFmt = '"Rp "#,##0';
      paid.font = { name: 'Arial', size: 9.5, bold: true, color: { argb: 'FF047857' } };

      const outstanding = row.getCell(9);
      outstanding.value = Number(pic.total_outstanding);
      outstanding.numFmt = '"Rp "#,##0';
      outstanding.font = { name: 'Arial', size: 9.5, bold: true, color: { argb: 'FFBE123C' } };

      for (let c = 1; c <= 9; c++) {
        const cell = row.getCell(c);
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        };
        if (idx % 2 === 1) {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
        }
      }

      s3RowIdx++;
    });

    const s3EndDataRow = s3RowIdx - 1;

    // S3 Total Row
    const s3TotalRow = wsPic.getRow(s3RowIdx);
    s3TotalRow.height = 24;
    s3TotalRow.getCell(1).value = 'TOTAL';
    s3TotalRow.getCell(1).font = { name: 'Arial', size: 10, bold: true };
    s3TotalRow.getCell(1).alignment = { horizontal: 'center' };
    wsPic.mergeCells(`A${s3RowIdx}:B${s3RowIdx}`);

    const s3NumericCols = [
      { col: 'C', cellIdx: 3, isCount: true },
      { col: 'D', cellIdx: 4 },
      { col: 'E', cellIdx: 5 },
      { col: 'F', cellIdx: 6 },
      { col: 'G', cellIdx: 7 },
      { col: 'H', cellIdx: 8 },
      { col: 'I', cellIdx: 9 },
    ];

    s3NumericCols.forEach(({ col, cellIdx, isCount }) => {
      const cell = s3TotalRow.getCell(cellIdx);
      if (picList.length > 0) {
        cell.value = { formula: `SUM(${col}${s3StartDataRow}:${col}${s3EndDataRow})` };
      } else {
        cell.value = 0;
      }
      cell.numFmt = isCount ? '#,##0' : '"Rp "#,##0';
      cell.font = { name: 'Arial', size: 10, bold: true };
    });

    for (let c = 1; c <= 9; c++) {
      const cell = s3TotalRow.getCell(c);
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
      cell.border = {
        top: { style: 'medium', color: { argb: 'FF64748B' } },
        bottom: { style: 'double', color: { argb: 'FF1E293B' } },
      };
    }

    wsPic.columns.forEach(col => { col.width = 18; });
    wsPic.getColumn(1).width = 6;
    wsPic.getColumn(2).width = 24;
    wsPic.getColumn(3).width = 10;

    const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
    const safePkgName = ManifestGenerator.sanitizeFilename(report.package_name);
    const fileName = `LAPORAN_KEUANGAN_${safePkgName}.xlsx`;

    return {
      buffer,
      fileName,
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    };
  }
}
