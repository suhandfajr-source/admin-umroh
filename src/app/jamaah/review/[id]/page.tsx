'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, CheckCircle2 } from 'lucide-react';
import { DocumentRecord, DocumentExtraction } from '@/types/database.types';
import { DocumentViewer } from '@/components/documents/DocumentViewer';
import { ExtractionReviewForm } from '@/components/documents/ExtractionReviewForm';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { EmptyState } from '@/components/ui/EmptyState';

export default function DocumentReviewWorkspacePage() {
  const params = useParams();
  const router = useRouter();
  const docId = params.id as string;

  const [document, setDocument] = useState<DocumentRecord | null>(null);
  const [extraction, setExtraction] = useState<DocumentExtraction | null>(null);
  const [signedUrl, setSignedUrl] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchReviewTarget() {
      try {
        const [resDoc, resUrl] = await Promise.all([
          fetch(`/api/documents/review-list`).then(r => r.json()),
          fetch(`/api/documents/${docId}/signed-url`).then(r => r.json()),
        ]);

        const target = (resDoc || []).find((d: any) => d.id === docId);
        if (target) {
          setDocument(target);
          setExtraction(target.extraction || null);
        }
        if (resUrl?.signed_url) {
          setSignedUrl(resUrl.signed_url);
        }
      } catch (err) {
        console.error('Fetch review doc error:', err);
      } finally {
        setLoading(false);
      }
    }

    if (docId) fetchReviewTarget();
  }, [docId]);

  if (loading) return <LoadingSpinner label="Menyiapkan ruang kerja review dokumen..." fullScreen />;
  if (!document) return <EmptyState title="Dokumen Tidak Ditemukan" description="Dokumen ini mungkin sudah dikonfirmasi atau tidak ada dalam database." />;

  const handleConfirmDecision = async (payload: {
    action: 'CREATE_NEW' | 'UPDATE_EXISTING' | 'REJECT';
    targetJamaahId?: string;
    fields: Record<string, any>;
    selectedKkMembers?: any[];
  }) => {
    const res = await fetch(`/api/documents/${docId}/review`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    if (!res.ok) {
      alert(data.error || 'Gagal mengonfirmasi');
      return;
    }

    if (payload.action === 'CREATE_NEW' && data.jamaah?.id) {
      router.push(`/jamaah/${data.jamaah.id}`);
    } else if (payload.action === 'UPDATE_EXISTING' && payload.targetJamaahId) {
      router.push(`/jamaah/${payload.targetJamaahId}`);
    } else {
      router.push('/jamaah/review');
    }
  };

  const handleReject = async () => {
    await handleConfirmDecision({
      action: 'REJECT',
      fields: {},
    });
  };

  return (
    <div className="space-y-4 animate-in fade-in duration-150">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/jamaah/review"
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-white rounded-xl border border-slate-200 shadow-2xs transition-all"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-xl font-black text-slate-900 tracking-tight">
              Ruang Review & Verifikasi Dokumen
            </h1>
            <p className="text-xs text-slate-500">
              Berkas: <span className="font-mono text-slate-800 font-semibold">{document.original_file_name}</span>
            </p>
          </div>
        </div>
      </div>

      {/* Side-by-Side Review Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-[75vh]">
        {/* Left: Document Viewer (5 cols) */}
        <div className="lg:col-span-5 flex flex-col">
          <DocumentViewer
            fileUrl={signedUrl || undefined}
            fileName={document.original_file_name}
            mimeType={document.mime_type}
          />
        </div>

        {/* Right: Extraction Form (7 cols) */}
        <div className="lg:col-span-7 overflow-y-auto">
          <ExtractionReviewForm
            documentId={document.id}
            initialType={document.document_type}
            initialFields={extraction?.extracted_fields || {}}
            confidenceScore={extraction?.confidence_score || 70}
            qualityWarnings={[]}
            onConfirm={handleConfirmDecision}
            onReject={handleReject}
          />
        </div>
      </div>
    </div>
  );
}
