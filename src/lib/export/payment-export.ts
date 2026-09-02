import ExcelJS from 'exceljs';
import { Payment } from '@/types/database.types';

export class PaymentExportService {
  /**
   * Generates Payment History Excel workbook (.xlsx)
   */
  public static async generatePaymentsExcel(
    payments: Payment[]
  ): Promise<{ buffer: Buffer; fileName: string; mimeType: string }> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Admin Umroh Finance System';
    workbook.created = new Date();

    const ws = workbook.addWorksheet('Riwayat Pembayaran');
    ws.properties.tabColor = { argb: 'FF0D9488' };

    // Title
    ws.mergeCells('A1:K1');
    const titleCell = ws.getCell('A1');
    titleCell.value = 'LAPORAN REKAPITULASI TRANSAKSI PEMBAYARAN MASUK (FINANCE)';
    titleCell.font = { name: 'Arial', size: 13, bold: true, color: { argb: 'FFFFFFFF' } };
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0D9488' } };
    titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
    ws.getRow(1).height = 30;

    // Headers
    const headers = [
      'NO',
      'TGL PEMBAYARAN',
      'NAMA PENGIRIM',
      'BANK PENGIRIM',
      'NOMINAL TRANSFER',
      'TERALOKASI',
      'SISA DANA',
      'PIC / MITRA',
      'PAKET TERIKAT',
      'STATUS ALOKASI',
      'STATUS TRANSAKSI',
    ];

    const headerRow = ws.getRow(3);
    headerRow.height = 24;
    headers.forEach((h, idx) => {
      const cell = headerRow.getCell(idx + 1);
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

    let rowIdx = 4;
    const startDataRow = 4;

    payments.forEach((p, idx) => {
      const r = ws.getRow(rowIdx);
      r.height = 20;

      r.getCell(1).value = idx + 1;
      r.getCell(1).alignment = { horizontal: 'center' };

      // Real Excel Date Cell
      if (p.payment_date && /^\d{4}-\d{2}-\d{2}/.test(p.payment_date)) {
        const [y, m, d] = p.payment_date.split('-').map(Number);
        const dCell = r.getCell(2);
        dCell.value = new Date(Date.UTC(y, m - 1, d));
        dCell.numFmt = 'yyyy-mm-dd';
      } else {
        r.getCell(2).value = p.payment_date;
      }
      r.getCell(2).alignment = { horizontal: 'center' };

      r.getCell(3).value = p.sender_name;
      r.getCell(4).value = p.sender_bank || '-';
      r.getCell(4).alignment = { horizontal: 'center' };

      // Numeric Amounts
      const amtCell = r.getCell(5);
      amtCell.value = Number(p.amount);
      amtCell.numFmt = '"Rp "#,##0';
      amtCell.font = { name: 'Arial', size: 9.5, bold: true };

      const allocCell = r.getCell(6);
      allocCell.value = Number(p.total_allocated);
      allocCell.numFmt = '"Rp "#,##0';
      allocCell.font = { name: 'Arial', size: 9.5, color: { argb: 'FF047857' } };

      const remCell = r.getCell(7);
      remCell.value = Number(p.remaining_unallocated);
      remCell.numFmt = '"Rp "#,##0';
      remCell.font = { name: 'Arial', size: 9.5, color: { argb: 'FFB45309' } };

      r.getCell(8).value = p.pic?.name || '-';
      r.getCell(9).value = p.package?.package_name || '-';
      r.getCell(10).value = p.allocation_status;
      r.getCell(10).alignment = { horizontal: 'center' };
      r.getCell(11).value = p.status;
      r.getCell(11).alignment = { horizontal: 'center' };
      r.getCell(11).font = { 
        name: 'Arial', 
        size: 9, 
        bold: true,
        color: { argb: p.status === 'CANCELLED' ? 'FFBE123C' : 'FF047857' } 
      };

      for (let c = 1; c <= 11; c++) {
        const cell = r.getCell(c);
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

      rowIdx++;
    });

    const endDataRow = rowIdx - 1;

    // Bottom Total Row with SUM Formulas
    const totalRow = ws.getRow(rowIdx);
    totalRow.height = 24;
    totalRow.getCell(1).value = 'TOTAL';
    totalRow.getCell(1).font = { name: 'Arial', size: 10, bold: true };
    totalRow.getCell(1).alignment = { horizontal: 'center' };
    ws.mergeCells(`A${rowIdx}:D${rowIdx}`);

    ['E', 'F', 'G'].forEach((col, cIdx) => {
      const cell = totalRow.getCell(cIdx + 5);
      if (payments.length > 0) {
        cell.value = { formula: `SUM(${col}${startDataRow}:${col}${endDataRow})` };
      } else {
        cell.value = 0;
      }
      cell.numFmt = '"Rp "#,##0';
      cell.font = { name: 'Arial', size: 10, bold: true };
    });

    for (let c = 1; c <= 11; c++) {
      const cell = totalRow.getCell(c);
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
      cell.border = {
        top: { style: 'medium', color: { argb: 'FF64748B' } },
        bottom: { style: 'double', color: { argb: 'FF1E293B' } },
      };
    }

    ws.columns.forEach(col => { col.width = 16; });
    ws.getColumn(1).width = 6;
    ws.getColumn(2).width = 16;
    ws.getColumn(3).width = 24;
    ws.getColumn(4).width = 14;
    ws.getColumn(8).width = 20;
    ws.getColumn(9).width = 24;

    const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
    const dateStr = new Date().toISOString().split('T')[0];
    const fileName = `LAPORAN_PEMBAYARAN_${dateStr}.xlsx`;

    return {
      buffer,
      fileName,
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    };
  }
}
