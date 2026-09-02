import { NextRequest, NextResponse } from 'next/server';
import { DocumentProcessingService } from '@/lib/document-processing/service';
import { PdfProcessingService } from '@/lib/document-processing/pdf-service';
import { PreprocessingService } from '@/lib/document-processing/preprocessing';
import { StorageService } from '@/lib/repository/storage.service';
import { DbRepository } from '@/lib/repository/db';
import { DocumentType } from '@/types/database.types';

export async function POST(req: NextRequest) {
  const reqStart = Date.now();
  try {
    const formData = await req.formData();
    const files = formData.getAll('files') as File[];
    const forcedType = formData.get('document_type') as DocumentType | null;
    const jamaahId = formData.get('jamaah_id') as string | null;
    const existingDocumentId = formData.get('document_id') as string | null;

    if (!files || files.length === 0) {
      return NextResponse.json({ error: 'Tidak ada file yang diunggah.' }, { status: 400 });
    }

    const results = [];

    for (const file of files) {
      const buffer = Buffer.from(await file.arrayBuffer());
      const originalFileName = file.name;
      const mimeType = file.type || 'application/octet-stream';
      const fileSize = file.size;

      // 1. Validate File Format & Size Limit (15 MB)
      const bufferValidation = PreprocessingService.validateBuffer(buffer, mimeType);
      if (!bufferValidation.valid) {
        return NextResponse.json({
          error: bufferValidation.errorMessage || bufferValidation.warnings[0] || 'Format file tidak didukung.',
          error_code: bufferValidation.errorCode,
        }, { status: 400 });
      }

      const isPassport = forcedType === 'PASSPORT' || originalFileName.toLowerCase().includes('passport') || originalFileName.toLowerCase().includes('paspor');
      const isPdf = mimeType.toLowerCase() === 'application/pdf' || originalFileName.toLowerCase().endsWith('.pdf');

      if (isPassport) {
        console.log(`[PASSPORT_OCR_START] file="${originalFileName}" size=${fileSize} mime="${mimeType}"`);
      }

      // 2. Generate Storage Path & Upload Original Document to Storage (Preserving original PDF/image)
      console.log(`[FILE_UPLOAD_START] target="${originalFileName}" size=${fileSize}`);
      const ext = originalFileName.split('.').pop() || 'dat';
      const fileId = `${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
      const storagePath = jamaahId 
        ? `jamaah/${jamaahId}/${forcedType || 'unclassified'}/${fileId}.${ext}`
        : `staging/${fileId}.${ext}`;

      const uploadResult = await StorageService.uploadDocument(buffer, storagePath, mimeType);
      console.log(`[FILE_UPLOAD_COMPLETE] path="${uploadResult.path}"`);

      // 3. Process Document (PDF Dual-Mode or Image OCR)
      let extraction: any;
      let ocrStatus: 'SUCCESS' | 'OCR_FAILED' | 'OCR_TIMEOUT' | 'SKIPPED' = 'SKIPPED';
      let ocrError: string | undefined = undefined;
      let ocrText = '';

      if (isPdf) {
        console.log(`[PDF_PROCESSING_START] file="${originalFileName}"`);
        const pdfResult = await PdfProcessingService.processPdf(buffer, originalFileName, forcedType || undefined);
        extraction = pdfResult;
        ocrText = pdfResult.raw_text || '';
        ocrStatus = pdfResult.confidence > 0 ? 'SUCCESS' : 'OCR_FAILED';
        console.log(`[PDF_PROCESSING_COMPLETE] mode="${pdfResult.pdf_mode}" pages=${pdfResult.page_count} confidence=${pdfResult.confidence}`);
      } else {
        console.log(`[OCR_START] mime="${mimeType}"`);
        const ocrRes = await DocumentProcessingService.runOcr(buffer, { timeoutMs: 60000, mimeType });
        ocrText = ocrRes.text || '';
        if (ocrRes.error === 'OCR_TIMEOUT') {
          ocrStatus = 'OCR_TIMEOUT';
          ocrError = 'OCR_TIMEOUT';
        } else if (ocrRes.error) {
          ocrStatus = 'OCR_FAILED';
          ocrError = ocrRes.error;
        } else {
          ocrStatus = 'SUCCESS';
        }
        console.log(`[OCR_COMPLETE] status="${ocrStatus}" textLength=${ocrText.length}`);

        extraction = await DocumentProcessingService.processText(
          ocrText, 
          originalFileName, 
          forcedType || undefined
        );
      }

      let mrzStatus: 'SUCCESS' | 'NEEDS_REVIEW' | 'MRZ_FAILED' | 'NOT_APPLICABLE' = 'NOT_APPLICABLE';
      if (extraction.document_type === 'PASSPORT') {
        if (extraction.mrz_data?.valid) {
          mrzStatus = 'SUCCESS';
        } else if (extraction.mrz_data) {
          mrzStatus = 'NEEDS_REVIEW';
        } else {
          mrzStatus = ocrText ? 'MRZ_FAILED' : 'NEEDS_REVIEW';
        }
        console.log(`[MRZ_PARSE_COMPLETE] mrz_status="${mrzStatus}" mrz_valid=${extraction.mrz_data?.valid ?? false}`);
      }

      // 4. Save Document & Extraction record in database (Idempotent update if existingDocumentId provided)
      console.log(`[STAGING_SAVE_START] existingDocId=${existingDocumentId || 'none'}`);
      const saved = await DbRepository.saveUploadedDocument(
        jamaahId || null,
        extraction.document_type,
        storagePath,
        originalFileName,
        mimeType,
        fileSize,
        {
          rawText: extraction.raw_text,
          fields: extraction.fields,
          classification: extraction.document_type,
          confidence: extraction.confidence,
          mrzData: extraction.mrz_data,
        },
        existingDocumentId || undefined
      );
      console.log(`[STAGING_SAVE_COMPLETE] docId="${saved.document.id}" status="${saved.document.status}"`);

      // 5. Generate short-lived signed URL for client preview
      const signedUrl = await StorageService.getSignedUrl(storagePath);

      // Determine overall document item status and structured diagnostics
      let itemStatus: 'READY_FOR_REVIEW' | 'NEEDS_REVIEW' | 'OCR_TIMEOUT' | 'OCR_FAILED' = 'READY_FOR_REVIEW';
      let failedStage: 'UPLOAD' | 'OCR_ENGINE_INIT' | 'OCR_TEXT_EXTRACTION' | 'MRZ_DETECTION' | 'MRZ_PARSE' | 'PASSPORT_FIELD_PARSE' | undefined = undefined;
      let errorCode: string | undefined = undefined;
      let safeErrorMessage: string | undefined = undefined;

      const hasRawOcrText = !!ocrText && ocrText.trim().length > 0;
      const hasMrzCandidate = !!extraction.mrz_data || (!!extraction.fields && !!(extraction.fields as any).mrz_lines?.length);

      if (ocrStatus === 'OCR_TIMEOUT') {
        itemStatus = 'OCR_TIMEOUT';
        failedStage = 'OCR_TEXT_EXTRACTION';
        errorCode = 'OCR_TIMEOUT';
        safeErrorMessage = 'Waktu ekstraksi dokumen melebihi batas.';
      } else if (ocrStatus === 'OCR_FAILED' && !hasRawOcrText) {
        itemStatus = 'OCR_FAILED';
        failedStage = 'OCR_TEXT_EXTRACTION';
        errorCode = 'OCR_UNREADABLE_IMAGE';
        safeErrorMessage = 'Dokumen tidak terbaca oleh modul pembaca.';
      } else if (extraction.document_type === 'PASSPORT') {
        const passportData = extraction.fields as any;
        const hasCoreFields = !!passportData.passport_name || !!passportData.passport_number;

        if (mrzStatus === 'SUCCESS' && hasCoreFields) {
          itemStatus = 'READY_FOR_REVIEW';
        } else if (hasCoreFields) {
          itemStatus = 'READY_FOR_REVIEW';
          if (mrzStatus !== 'SUCCESS') {
            failedStage = 'MRZ_PARSE';
            errorCode = 'MRZ_CHECKSUM_WARNING';
            safeErrorMessage = 'Data visual paspor berhasil dibaca. MRZ memerlukan konfirmasi review.';
          }
        } else {
          itemStatus = 'NEEDS_REVIEW';
          failedStage = 'PASSPORT_FIELD_PARSE';
          errorCode = 'PASSPORT_FIELDS_INCOMPLETE';
          safeErrorMessage = 'Field utama paspor perlu dilengkapi secara manual.';
        }
      } else if (extraction.confidence < 60) {
        itemStatus = 'NEEDS_REVIEW';
        failedStage = 'PASSPORT_FIELD_PARSE';
        errorCode = 'LOW_CONFIDENCE';
        safeErrorMessage = 'Kualitas dokumen rendah, silakan periksa hasil ekstraksi.';
      }

      results.push({
        document: saved.document,
        extraction: saved.extraction,
        signed_url: signedUrl,
        ocr_status: ocrStatus,
        mrz_status: mrzStatus,
        status: itemStatus,
        error: ocrError,
        ocr_provider: isPdf ? (extraction.pdf_mode === 'PDF_TEXT_BASED' ? 'Native PDF Text Extractor' : 'Tesseract.js (Rendered PDF)') : 'Tesseract.js (Node Server-side)',
        processing_duration_ms: Date.now() - reqStart,
        has_raw_ocr_text: hasRawOcrText,
        has_mrz_candidate: hasMrzCandidate,
        failed_stage: failedStage,
        error_code: errorCode,
        safe_error_message: safeErrorMessage,
        pdf_mode: extraction.pdf_mode,
        page_count: extraction.page_count,
      });
    }

    console.log(`[API_RESPONSE_COMPLETE] duration=${Date.now() - reqStart}ms items=${results.length}`);
    return NextResponse.json({ success: true, count: results.length, data: results });
  } catch (error: any) {
    console.error('[API_RESPONSE_ERROR]', error?.message || error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
