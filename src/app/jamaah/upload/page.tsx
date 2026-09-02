'use client';

import React, { useState, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { 
  UploadCloud, 
  FileText, 
  CheckCircle2, 
  AlertCircle, 
  ArrowRight, 
  Trash2, 
  Sparkles,
  RefreshCw,
  Eye,
  AlertTriangle,
  Edit3
} from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { DocumentType } from '@/types/database.types';
import { runClientOcr } from '@/lib/document-processing/client-ocr';

export type UploadItemStatus = 
  | 'QUEUED' 
  | 'UPLOADING' 
  | 'EXTRACTING_OCR' 
  | 'PARSING_MRZ' 
  | 'PREPARING_REVIEW' 
  | 'DONE' 
  | 'NEEDS_REVIEW' 
  | 'TIMEOUT' 
  | 'ERROR';

interface UploadItem {
  id: string;
  file: File;
  previewUrl: string;
  status: UploadItemStatus;
  stageMessage?: string;
  result?: {
    document: any;
    extraction: any;
    signed_url: string;
    ocr_status?: string;
    mrz_status?: string;
    status?: string;
  };
  error?: string;
}

function DocumentUploadContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const targetJamaahId = searchParams.get('jamaah_id') || undefined;

  const [items, setItems] = useState<UploadItem[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [selectedTypeOverride, setSelectedTypeOverride] = useState<DocumentType | ''>('');
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFilesAdded = (files: FileList | null) => {
    if (!files) return;
    const newItems: UploadItem[] = Array.from(files).map(file => ({
      id: `file_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      file,
      previewUrl: URL.createObjectURL(file),
      status: 'QUEUED',
    }));
    setItems(prev => [...prev, ...newItems]);
  };

  const handleRemove = (id: string) => {
    if (isProcessing) return;
    setItems(prev => prev.filter(item => item.id !== id));
  };

  const processSingleItem = async (item: UploadItem, itemIndex: number) => {
    const abortController = new AbortController();
    const clientTimeoutId = setTimeout(() => {
      abortController.abort();
    }, 65000); // 65s client safety timeout

    try {
      const isPdf = item.file.type === 'application/pdf' || item.file.name.toLowerCase().endsWith('.pdf');
      let clientOcrText = '';

      // Stage 1: Client OCR (for images: JPG, JPEG, PNG, etc.)
      if (!isPdf) {
        setItems(prev => {
          const copy = [...prev];
          copy[itemIndex] = { 
            ...copy[itemIndex], 
            status: 'EXTRACTING_OCR', 
            stageMessage: 'Mengekstrak OCR di perangkat...' 
          };
          return copy;
        });

        try {
          clientOcrText = await runClientOcr(item.file, (percent, msg) => {
            setItems(prev => {
              const copy = [...prev];
              copy[itemIndex] = { 
                ...copy[itemIndex], 
                status: 'EXTRACTING_OCR', 
                stageMessage: `${msg} (${percent}%)` 
              };
              return copy;
            });
          });
        } catch (ocrErr) {
          console.warn('Client OCR warning, falling back to server:', ocrErr);
        }
      }

      // Stage 2: Uploading
      setItems(prev => {
        const copy = [...prev];
        copy[itemIndex] = { 
          ...copy[itemIndex], 
          status: 'UPLOADING', 
          stageMessage: 'Mengunggah dan menyimpan data...' 
        };
        return copy;
      });

      const formData = new FormData();
      formData.append('files', item.file);
      if (clientOcrText) {
        formData.append('client_ocr_text', clientOcrText);
      }
      if (selectedTypeOverride) {
        formData.append('document_type', selectedTypeOverride);
      }
      if (targetJamaahId) {
        formData.append('jamaah_id', targetJamaahId);
      }
      if (item.result?.document?.id) {
        formData.append('document_id', item.result.document.id);
      }

      const res = await fetch('/api/documents/upload', {
        method: 'POST',
        body: formData,
        signal: abortController.signal,
      });

      clearTimeout(clientTimeoutId);

      // Stage 3: Preparing review
      setItems(prev => {
        const copy = [...prev];
        copy[itemIndex] = { 
          ...copy[itemIndex], 
          status: 'PREPARING_REVIEW', 
          stageMessage: 'Menyiapkan hasil review...' 
        };
        return copy;
      });

      let data: any = {};
      try {
        data = await res.json();
      } catch {
        const textResp = await res.text().catch(() => '');
        throw new Error(textResp || `Server error (${res.status})`);
      }
      if (!res.ok) throw new Error(data?.error || 'Gagal memproses berkas');

      const uploadResult = data.data?.[0];
      if (!uploadResult) throw new Error('Tidak ada hasil ekstraksi yang diterima.');

      if (uploadResult.ocr_status === 'OCR_TIMEOUT') {
        setItems(prev => {
          const copy = [...prev];
          copy[itemIndex] = {
            ...copy[itemIndex],
            status: 'TIMEOUT',
            result: uploadResult,
            error: 'Ekstraksi gagal karena proses terlalu lama. Silakan coba lagi.',
          };
          return copy;
        });
      } else if (uploadResult.status === 'NEEDS_REVIEW' || uploadResult.mrz_status === 'NEEDS_REVIEW' || uploadResult.mrz_status === 'MRZ_FAILED') {
        setItems(prev => {
          const copy = [...prev];
          copy[itemIndex] = {
            ...copy[itemIndex],
            status: 'NEEDS_REVIEW',
            result: uploadResult,
            stageMessage: 'Perlu review manual',
          };
          return copy;
        });
      } else {
        setItems(prev => {
          const copy = [...prev];
          copy[itemIndex] = {
            ...copy[itemIndex],
            status: 'DONE',
            result: uploadResult,
            stageMessage: 'Selesai',
          };
          return copy;
        });
      }
    } catch (err: any) {
      clearTimeout(clientTimeoutId);
      const isAbort = err?.name === 'AbortError';
      setItems(prev => {
        const copy = [...prev];
        copy[itemIndex] = {
          ...copy[itemIndex],
          status: isAbort ? 'TIMEOUT' : 'ERROR',
          error: isAbort 
            ? 'Ekstraksi gagal karena proses terlalu lama. Silakan coba lagi.' 
            : (err.message || 'Gagal memproses berkas.'),
        };
        return copy;
      });
    }
  };

  const handleProcessUpload = async () => {
    if (items.length === 0 || isProcessing) return;
    setIsProcessing(true);

    try {
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.status === 'DONE') continue;
        await processSingleItem(item, i);
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRetryItem = async (itemId: string) => {
    if (isProcessing) return;
    const itemIndex = items.findIndex(i => i.id === itemId);
    if (itemIndex === -1) return;

    setIsProcessing(true);
    try {
      await processSingleItem(items[itemIndex], itemIndex);
    } finally {
      setIsProcessing(false);
    }
  };

  const doneCount = items.filter(i => i.status === 'DONE' || i.status === 'NEEDS_REVIEW').length;
  const isAllDone = items.length > 0 && items.every(i => i.status === 'DONE' || i.status === 'NEEDS_REVIEW');

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-in fade-in duration-150">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Smart Document Upload</h1>
          <p className="text-xs text-slate-500 mt-1">
            Unggah Paspor, KTP, KK, Sertifikat Vaksin, atau Buku Nikah (Mendukung JPG, PNG, PDF & Multiple Upload).
          </p>
        </div>

        {doneCount > 0 && (
          <Link
            href="/jamaah/review"
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-900/20 flex items-center gap-2 transition-all"
          >
            <span>Buka Antrean Review ({doneCount})</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        )}
      </div>

      {/* Target Jamaah Banner if linked */}
      {targetJamaahId && (
        <div className="p-3.5 bg-sky-50 border border-sky-200 rounded-xl text-xs text-sky-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-bold">Mode Lampiran Jamaah:</span>
            <span>Dokumen yang diunggah akan langsung dihubungkan ke Jamaah ID: {targetJamaahId}</span>
          </div>
          <Link href={`/jamaah/${targetJamaahId}`} className="font-semibold underline">
            Kembali ke Profil
          </Link>
        </div>
      )}

      {/* Drag & Drop Zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); if (!isProcessing) setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (!isProcessing) handleFilesAdded(e.dataTransfer.files);
        }}
        onClick={() => { if (!isProcessing) fileInputRef.current?.click(); }}
        className={`border-2 border-dashed rounded-3xl p-10 text-center transition-all ${
          isProcessing 
            ? 'opacity-60 cursor-not-allowed border-slate-200 bg-slate-50/50'
            : dragOver 
              ? 'border-emerald-500 bg-emerald-50/50 scale-[0.99] cursor-pointer' 
              : 'border-slate-300 hover:border-slate-400 bg-white shadow-xs cursor-pointer'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          disabled={isProcessing}
          accept=".jpg,.jpeg,.png,.pdf"
          className="hidden"
          onChange={(e) => handleFilesAdded(e.target.files)}
        />

        <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-2xl mx-auto flex items-center justify-center mb-4 border border-emerald-100 shadow-xs">
          <UploadCloud className="w-8 h-8" />
        </div>

        <h3 className="text-base font-bold text-slate-800 mb-1">
          Tarik & Lepaskan File Dokumen ke Sini
        </h3>
        <p className="text-xs text-slate-500 max-w-md mx-auto mb-4">
          Atau klik area ini untuk memilih file dari komputer Anda (PNG, JPG, JPEG, atau PDF hingga 15MB per file).
        </p>

        <div className="inline-flex items-center gap-2 px-3 py-1 bg-slate-100 rounded-full text-[11px] font-semibold text-slate-600">
          <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
          <span>Sistem secara otomatis mendeteksi Paspor, KTP, KK, Vaksin & Buku Nikah</span>
        </div>
      </div>

      {/* Upload Items Queue */}
      {items.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-6 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h3 className="font-bold text-slate-800 text-sm">Daftar Berkas Terpilih ({items.length})</h3>
              <p className="text-xs text-slate-500">Klik &quot;Mulai Ekstraksi & Upload&quot; untuk memproses OCR.</p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={isProcessing}
                onClick={() => setItems([])}
                className="px-3 py-1.5 text-xs text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl disabled:opacity-40"
              >
                Hapus Semua
              </button>
              <button
                type="button"
                id="btn-process-upload"
                onClick={handleProcessUpload}
                disabled={isProcessing || isAllDone}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-md shadow-emerald-900/20 flex items-center gap-2 disabled:opacity-50 transition-all"
              >
                {isProcessing ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Memproses...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>Mulai Ekstraksi & Upload</span>
                  </>
                )}
              </button>
            </div>
          </div>

          <div className="space-y-2.5">
            {items.map((item) => (
              <div
                key={item.id}
                className="p-3 rounded-xl border border-slate-200 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all"
              >
                <div className="flex items-center gap-3 truncate min-w-0">
                  <div className="w-10 h-10 rounded-lg bg-slate-200 shrink-0 overflow-hidden flex items-center justify-center border border-slate-300">
                    {item.file.type.startsWith('image/') ? (
                      <img src={item.previewUrl} alt="preview" className="w-full h-full object-cover" />
                    ) : (
                      <FileText className="w-5 h-5 text-slate-500" />
                    )}
                  </div>
                  <div className="truncate">
                    <p className="text-xs font-bold text-slate-800 truncate">{item.file.name}</p>
                    <p className="text-[10px] text-slate-400 font-mono">
                      {(item.file.size / 1024).toFixed(1)} KB • {item.file.type || 'Dokumen'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
                  {item.status === 'QUEUED' && (
                    <Badge variant="neutral">Menunggu</Badge>
                  )}
                  {item.status === 'UPLOADING' && (
                    <Badge variant="info">
                      <span className="flex items-center gap-1.5">
                        <RefreshCw className="w-3 h-3 animate-spin" />
                        <span>Mengupload berkas...</span>
                      </span>
                    </Badge>
                  )}
                  {item.status === 'EXTRACTING_OCR' && (
                    <Badge variant="warning">
                      <span className="flex items-center gap-1.5">
                        <RefreshCw className="w-3 h-3 animate-spin" />
                        <span>Mengekstrak OCR...</span>
                      </span>
                    </Badge>
                  )}
                  {item.status === 'PARSING_MRZ' && (
                    <Badge variant="warning">
                      <span className="flex items-center gap-1.5">
                        <RefreshCw className="w-3 h-3 animate-spin" />
                        <span>Membaca MRZ...</span>
                      </span>
                    </Badge>
                  )}
                  {item.status === 'PREPARING_REVIEW' && (
                    <Badge variant="info">
                      <span className="flex items-center gap-1.5">
                        <RefreshCw className="w-3 h-3 animate-spin" />
                        <span>Menyiapkan hasil review...</span>
                      </span>
                    </Badge>
                  )}
                  {item.status === 'DONE' && (
                    <div className="flex items-center gap-2">
                      <Badge variant="success">
                        Terdeteksi: {item.result?.document?.document_type || 'DOKUMEN'}
                      </Badge>
                      {item.result?.document?.id && (
                        <Link
                          href={`/jamaah/review/${item.result.document.id}`}
                          className="px-3 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-300 rounded-lg text-xs font-bold flex items-center gap-1 transition-all"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Review Data</span>
                        </Link>
                      )}
                    </div>
                  )}
                  {item.status === 'NEEDS_REVIEW' && (
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="warning">
                        <AlertTriangle className="w-3 h-3 inline mr-1" />
                        <span>Perlu Review Manual</span>
                      </Badge>
                      {item.result?.document?.id && (
                        <Link
                          href={`/jamaah/review/${item.result.document.id}`}
                          className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-300 rounded-lg text-xs font-bold flex items-center gap-1 transition-all"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          <span>Input / Review Manual</span>
                        </Link>
                      )}
                      <button
                        type="button"
                        onClick={() => handleRetryItem(item.id)}
                        disabled={isProcessing}
                        className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all disabled:opacity-40"
                      >
                        <RefreshCw className="w-3 h-3" />
                        <span>Coba Ekstraksi Lagi</span>
                      </button>
                    </div>
                  )}
                  {item.status === 'TIMEOUT' && (
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="danger">
                        <span>Ekstraksi timeout (&gt;60s)</span>
                      </Badge>
                      {item.result?.document?.id && (
                        <Link
                          href={`/jamaah/review/${item.result.document.id}`}
                          className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-300 rounded-lg text-xs font-bold flex items-center gap-1 transition-all"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          <span>Input / Review Manual</span>
                        </Link>
                      )}
                      <button
                        type="button"
                        onClick={() => handleRetryItem(item.id)}
                        disabled={isProcessing}
                        className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-300 rounded-lg text-xs font-bold flex items-center gap-1 transition-all disabled:opacity-40"
                      >
                        <RefreshCw className="w-3 h-3" />
                        <span>Coba Lagi</span>
                      </button>
                    </div>
                  )}
                  {item.status === 'ERROR' && (
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="danger">{item.error || 'Gagal'}</Badge>
                      {item.result?.document?.id && (
                        <Link
                          href={`/jamaah/review/${item.result.document.id}`}
                          className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-300 rounded-lg text-xs font-bold flex items-center gap-1 transition-all"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          <span>Input / Review Manual</span>
                        </Link>
                      )}
                      <button
                        type="button"
                        onClick={() => handleRetryItem(item.id)}
                        disabled={isProcessing}
                        className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all disabled:opacity-40"
                      >
                        <RefreshCw className="w-3 h-3" />
                        <span>Coba Lagi</span>
                      </button>
                    </div>
                  )}

                  {!isProcessing && (
                    <button
                      type="button"
                      onClick={() => handleRemove(item.id)}
                      className="p-1 text-slate-400 hover:text-rose-600 rounded transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function DocumentUploadPage() {
  return (
    <Suspense fallback={<LoadingSpinner label="Menyiapkan pengunggah dokumen..." />}>
      <DocumentUploadContent />
    </Suspense>
  );
}
