/**
 * PDF Processing Service
 * Supports TYPE A (Text-Based Digital PDF) and TYPE B (Scanned / Image-Based PDF)
 * Pure server-side Node.js execution with privacy preservation
 */

import { DocumentType } from '@/types/database.types';
import { DocumentExtractionResult, PdfProcessingMode, FieldSource } from '@/types/document.types';
import { DocumentProcessingService } from './service';
import { PreprocessingService, MAX_PDF_PAGES, PDF_PROCESSING_TIMEOUT_MS } from './preprocessing';


export interface PdfExtractionResult extends DocumentExtractionResult {
  pdf_mode: PdfProcessingMode;
  page_count: number;
}

export class PdfProcessingService {
  /**
   * Main entry point for PDF document extraction
   */
  public static async processPdf(
    buffer: Buffer,
    filename?: string,
    forcedType?: DocumentType,
    options?: { timeoutMs?: number }
  ): Promise<PdfExtractionResult> {
    const timeoutMs = options?.timeoutMs || PDF_PROCESSING_TIMEOUT_MS;

    // 1. Validate Buffer & PDF Header
    const validation = PreprocessingService.validateBuffer(buffer, 'application/pdf');
    if (!validation.valid) {
      return {
        document_type: forcedType || 'OTHER',
        confidence: 0,
        raw_text: '',
        fields: {},
        quality_warnings: [validation.errorMessage || validation.warnings[0] || 'PDF tidak valid.'],
        pdf_mode: 'PDF_IMAGE_BASED',
        page_count: 0,
      };
    }

    // 2. Parse PDF with pdf-parse (handling PDFParse class and function versions)
    let rawPdfText = '';
    let pageCount = 1;

    try {
      let pdfModule: any = null;
      try {
        pdfModule = await import('pdf-parse');
      } catch {
        try {
          pdfModule = require('pdf-parse');
        } catch {
          pdfModule = null;
        }
      }

      if (pdfModule?.PDFParse) {
        const parser = new pdfModule.PDFParse({ data: buffer, verbosity: 0 });
        const res = await parser.getText();
        rawPdfText = (res?.text || '').replace(/\t/g, '\n').replace(/--\s*\d+\s*of\s*\d+\s*--/gi, '');
        pageCount = res?.total || res?.pages?.length || 1;
        await parser.destroy();
      } else if (typeof pdfModule === 'function') {
        const res = await pdfModule(buffer, { max: MAX_PDF_PAGES });
        rawPdfText = (res?.text || '').replace(/\t/g, '\n');
        pageCount = res?.numpages || 1;
      } else if (typeof pdfModule?.default === 'function') {
        const res = await pdfModule.default(buffer, { max: MAX_PDF_PAGES });
        rawPdfText = (res?.text || '').replace(/\t/g, '\n');
        pageCount = res?.numpages || 1;
      } else {
        rawPdfText = buffer.toString('utf-8');
      }
    } catch (parseErr: any) {
      const errMsg = parseErr?.message || '';
      if (errMsg.includes('password') || errMsg.includes('encrypted') || errMsg.includes('PasswordException')) {
        return {
          document_type: forcedType || 'OTHER',
          confidence: 0,
          raw_text: '',
          fields: {},
          quality_warnings: ['PDF dilindungi kata sandi dan tidak dapat diproses. Silakan unggah PDF tanpa password atau gunakan gambar.'],
          pdf_mode: 'PDF_IMAGE_BASED',
          page_count: 0,
        };
      }
      return {
        document_type: forcedType || 'OTHER',
        confidence: 0,
        raw_text: '',
        fields: {},
        quality_warnings: ['File PDF tidak dapat dibaca atau rusak. Silakan unggah ulang atau gunakan versi lain.'],
        pdf_mode: 'PDF_IMAGE_BASED',
        page_count: 0,
      };
    }

    if (pageCount > MAX_PDF_PAGES) {
      return {
        document_type: forcedType || 'OTHER',
        confidence: 0,
        raw_text: '',
        fields: {},
        quality_warnings: [`Jumlah halaman PDF (${pageCount}) melebihi batas maksimal (${MAX_PDF_PAGES} halaman).`],
        pdf_mode: 'PDF_IMAGE_BASED',
        page_count: pageCount,
      };
    }

    rawPdfText = rawPdfText.trim();
    const meaningfulCharCount = rawPdfText.replace(/[\s\r\n\t]/g, '').length;

    // 3. Content Detection: TYPE A (Text-Based PDF) vs TYPE B (Scanned PDF)
    const isTextBased = meaningfulCharCount >= 30;
    const pdfMode: PdfProcessingMode = isTextBased ? 'PDF_TEXT_BASED' : 'PDF_IMAGE_BASED';

    if (isTextBased) {
      // -------------------------------------------------------------
      // TYPE A: Direct Native Text Extraction (Fast & High Precision)
      // -------------------------------------------------------------
      const extraction = await DocumentProcessingService.processText(rawPdfText, filename, forcedType);

      // Re-map field sources to PDF_TEXT
      const updatedSources: Record<string, FieldSource> = {};
      if (extraction.fields && typeof extraction.fields === 'object') {
        Object.keys(extraction.fields).forEach((k) => {
          if (k !== 'field_sources' && k !== 'field_confidences' && k !== 'conflicts' && k !== 'mrz_lines' && k !== 'mrz_parsed') {
            updatedSources[k] = 'PDF_TEXT';
          }
        });
        extraction.fields.field_sources = updatedSources;
        extraction.fields.page_number = 1;
      }

      return {
        ...extraction,
        field_sources: updatedSources,
        pdf_mode: 'PDF_TEXT_BASED',
        page_count: pageCount,
        page_number: 1,
      };
    } else {
      // -------------------------------------------------------------
      // TYPE B: Scanned / Image-Based PDF
      // -------------------------------------------------------------
      // Search for embedded JPEG/PNG image streams in PDF buffer
      const extractedImages = this.extractEmbeddedImagesFromPdf(buffer);

      if (extractedImages.length > 0) {
        // Run OCR on the first/primary scanned page
        const primaryImage = extractedImages[0];
        const ocrRes = await DocumentProcessingService.runOcr(primaryImage.buffer, {
          timeoutMs,
          mimeType: primaryImage.mimeType,
        });

        if (ocrRes.error || !ocrRes.text) {
          return {
            document_type: forcedType || 'OTHER',
            confidence: 20,
            raw_text: '',
            fields: {
              notes: 'Halaman scan PDF tidak dapat dibaca OCR dengan jelas.',
            },
            quality_warnings: [ocrRes.error === 'OCR_TIMEOUT' ? 'Batas waktu pemrosesan PDF terlampaui.' : 'Teks OCR dari PDF kosong atau tidak terbaca.'],
            pdf_mode: 'PDF_IMAGE_BASED',
            page_count: pageCount,
            page_number: 1,
          };
        }

        const extraction = await DocumentProcessingService.processText(ocrRes.text, filename, forcedType);

        // Re-map field sources to PDF_OCR
        const updatedSources: Record<string, FieldSource> = {};
        if (extraction.fields && typeof extraction.fields === 'object') {
          Object.keys(extraction.fields).forEach((k) => {
            if (k !== 'field_sources' && k !== 'field_confidences' && k !== 'conflicts' && k !== 'mrz_lines' && k !== 'mrz_parsed') {
              updatedSources[k] = 'PDF_OCR';
            }
          });
          extraction.fields.field_sources = updatedSources;
          extraction.fields.page_number = 1;
        }

        return {
          ...extraction,
          field_sources: updatedSources,
          pdf_mode: 'PDF_IMAGE_BASED',
          page_count: pageCount,
          page_number: 1,
        };
      } else {
        // Fallback if no raw stream found: Return for manual review
        return {
          document_type: forcedType || 'OTHER',
          confidence: 30,
          raw_text: rawPdfText,
          fields: {
            notes: 'PDF berisi gambar scan yang memerlukan review manual.',
          },
          quality_warnings: ['PDF scan terdeteksi. Silakan periksa atau lengkapi data melalui form review.'],
          pdf_mode: 'PDF_IMAGE_BASED',
          page_count: pageCount,
          page_number: 1,
        };
      }
    }
  }

  /**
   * Helper to extract raw image streams (JPEG / PNG) embedded in PDF dictionary
   */
  public static extractEmbeddedImagesFromPdf(buffer: Buffer): Array<{ buffer: Buffer; mimeType: string }> {
    const images: Array<{ buffer: Buffer; mimeType: string }> = [];

    // Search for standard JPEG SOI marker (0xFF, 0xD8) and EOI marker (0xFF, 0xD9)
    let searchPos = 0;
    while (searchPos < buffer.length - 4 && images.length < 5) {
      const soiIndex = buffer.indexOf(Buffer.from([0xFF, 0xD8, 0xFF]), searchPos);
      if (soiIndex === -1) break;

      const eoiIndex = buffer.indexOf(Buffer.from([0xFF, 0xD9]), soiIndex + 3);
      if (eoiIndex === -1) break;

      const imageBuf = buffer.subarray(soiIndex, eoiIndex + 2);
      if (imageBuf.length > 200) {
        images.push({
          buffer: imageBuf,
          mimeType: 'image/jpeg',
        });
      }
      searchPos = eoiIndex + 2;
    }

    // Search for standard PNG magic bytes
    if (images.length === 0) {
      let pngPos = 0;
      while (pngPos < buffer.length - 8 && images.length < 5) {
        const pngHeader = buffer.indexOf(Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]), pngPos);
        if (pngHeader === -1) break;

        const iendIndex = buffer.indexOf(Buffer.from('IEND'), pngHeader);
        if (iendIndex === -1) break;

        const imageBuf = buffer.subarray(pngHeader, iendIndex + 8);
        if (imageBuf.length > 200) {
          images.push({
            buffer: imageBuf,
            mimeType: 'image/png',
          });
        }
        pngPos = iendIndex + 8;
      }
    }

    return images;
  }
}
