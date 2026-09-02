'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { FileCheck, UploadCloud, Eye, CheckCircle2, Clock, ArrowRight } from 'lucide-react';
import { DocumentRecord, DocumentExtraction } from '@/types/database.types';
import { Badge } from '@/components/ui/Badge';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { EmptyState } from '@/components/ui/EmptyState';

export default function DocumentReviewQueuePage() {
  const [pendingDocs, setPendingDocs] = useState<(DocumentRecord & { extraction?: DocumentExtraction })[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchQueue = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/documents/review-list');
      const data = await res.json();
      setPendingDocs(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQueue();
  }, []);

  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Antrean Review Dokumen</h1>
          <p className="text-xs text-slate-500 mt-1">
            Verifikasi dan periksa hasil OCR dokumen sebelum data disimpan menjadi Master Jamaah final.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {pendingDocs.length > 0 && (
            <Link
              href={`/jamaah/review/${pendingDocs[0].id}?queue=${pendingDocs.map(d => d.id).join(',')}`}
              className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-900/20 flex items-center gap-2 transition-all"
            >
              <span>Mulai Review Berurutan ({pendingDocs.length} Dokumen)</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          )}

          <Link
            href="/jamaah/upload"
            className="px-4 py-2.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold shadow-2xs flex items-center gap-2 transition-all"
          >
            <UploadCloud className="w-4 h-4 text-slate-500" />
            <span>Upload Dokumen Baru</span>
          </Link>
        </div>
      </div>

      {/* Queue Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
        {loading ? (
          <LoadingSpinner label="Memuat antrean dokumen..." />
        ) : pendingDocs.length === 0 ? (
          <EmptyState
            title="Tidak Ada Dokumen Menunggu Review"
            description="Semua dokumen telah diverifikasi dan dikonfirmasi. Unggah dokumen baru untuk memulai proses ekstraksi."
            action={
              <Link
                href="/jamaah/upload"
                className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-semibold"
              >
                Upload Dokumen Sekarang
              </Link>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="p-4">Dokumen</th>
                  <th className="p-4">Jenis Terdeteksi</th>
                  <th className="p-4">Calon Nama / Identitas</th>
                  <th className="p-4">Akurasi / Confidence</th>
                  <th className="p-4">Waktu Unggah</th>
                  <th className="p-4 text-center">Aksi Review</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pendingDocs.map((doc) => {
                  const ext = doc.extraction;
                  const candidateName = ext?.extracted_fields?.passport_name || ext?.extracted_fields?.ktp_name || ext?.extracted_fields?.head_of_family || '-';
                  const conf = ext?.confidence_score || 0;

                  return (
                    <tr key={doc.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="p-4 font-mono font-medium text-slate-800">
                        {doc.original_file_name}
                      </td>
                      <td className="p-4">
                        <Badge variant="brand">
                          {doc.document_type}
                        </Badge>
                      </td>
                      <td className="p-4 font-semibold text-slate-900">
                        {candidateName}
                      </td>
                      <td className="p-4">
                        <Badge variant={conf >= 80 ? 'success' : conf >= 50 ? 'warning' : 'danger'}>
                          {conf}% Akurat
                        </Badge>
                      </td>
                      <td className="p-4 text-slate-500">
                        {doc.uploaded_at ? new Date(doc.uploaded_at).toLocaleString('id-ID') : '-'}
                      </td>
                      <td className="p-4 text-center">
                        <Link
                          href={`/jamaah/review/${doc.id}?queue=${pendingDocs.map(d => d.id).join(',')}`}
                          className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold inline-flex items-center gap-1.5 shadow-xs transition-all"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Review & Konfirmasi</span>
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
