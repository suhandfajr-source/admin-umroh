'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, CheckCircle2, ArrowRight, SkipForward, Layers, Users } from 'lucide-react';
import { DocumentRecord, DocumentExtraction } from '@/types/database.types';
import { DocumentViewer } from '@/components/documents/DocumentViewer';
import { ExtractionReviewForm } from '@/components/documents/ExtractionReviewForm';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { Badge } from '@/components/ui/Badge';

function DocumentReviewWorkspaceContent() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const docId = params.id as string;

  const queueParam = searchParams.get('queue') || '';
  const queueList = queueParam ? queueParam.split(',').filter(Boolean) : [];
  const currentIndex = queueList.indexOf(docId);

  const [document, setDocument] = useState<DocumentRecord | null>(null);
  const [extraction, setExtraction] = useState<DocumentExtraction | null>(null);
  const [signedUrl, setSignedUrl] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [transitioning, setTransitioning] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    async function fetchReviewTarget() {
      setLoading(true);
      try {
        const res = await fetch(`/api/documents/${docId}/review`);
        if (res.ok) {
          const target = await res.json();
          if (target && target.id) {
            setDocument(target);
            setExtraction(target.extraction || null);
            if (target.signed_url) {
              setSignedUrl(target.signed_url);
            }
          }
        } else {
          // Fallback check review list
          const resList = await fetch(`/api/documents/review-list`).then(r => r.json());
          const target = (resList || []).find((d: any) => d.id === docId);
          if (target) {
            setDocument(target);
            setExtraction(target.extraction || null);
            if (target.signed_url) setSignedUrl(target.signed_url);
          }
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

  const handleNextInQueue = async (remainingQueueOverride?: string[]) => {
    const listToUse = remainingQueueOverride || queueList.filter(id => id !== docId);

    if (listToUse.length > 0) {
      const nextId = listToUse[0];
      router.push(`/jamaah/review/${nextId}?queue=${listToUse.join(',')}`);
      return;
    }

    // If no queue in query param, check if there are other pending documents in database
    try {
      const res = await fetch('/api/documents/review-list');
      const pending = await res.json();
      const others = (pending || []).filter((d: any) => d.id !== docId);
      if (others.length > 0) {
        const nextDoc = others[0];
        const newQueue = others.map((d: any) => d.id);
        router.push(`/jamaah/review/${nextDoc.id}?queue=${newQueue.join(',')}`);
        return;
      }
    } catch {
      // safe fallback
    }

    // No remaining docs -> go to master jamaah list
    router.push('/jamaah');
  };

  const handleConfirmDecision = async (payload: {
    action: 'CREATE_NEW' | 'UPDATE_EXISTING' | 'REJECT';
    targetJamaahId?: string;
    fields: Record<string, any>;
    selectedKkMembers?: any[];
  }) => {
    setTransitioning(true);
    const res = await fetch(`/api/documents/${docId}/review`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    if (!res.ok) {
      setTransitioning(false);
      alert(data.error || 'Gagal mengonfirmasi');
      return;
    }

    const remainingQueue = queueList.filter(id => id !== docId);
    const hasMore = remainingQueue.length > 0;

    if (hasMore) {
      setToastMessage(`✓ Berhasil disimpan! Membuka dokumen berikutnya (${remainingQueue.length} tersisa)...`);
      setTimeout(() => {
        handleNextInQueue(remainingQueue);
      }, 700);
    } else {
      // Check if there are other pending in DB
      try {
        const resList = await fetch('/api/documents/review-list');
        const pending = await resList.json();
        const otherPending = (pending || []).filter((d: any) => d.id !== docId);

        if (otherPending.length > 0) {
          setToastMessage(`✓ Berhasil disimpan! Membuka dokumen berikutnya (${otherPending.length} tersisa)...`);
          setTimeout(() => {
            const nextDoc = otherPending[0];
            router.push(`/jamaah/review/${nextDoc.id}?queue=${otherPending.map((d: any) => d.id).join(',')}`);
          }, 700);
          return;
        }
      } catch {}

      // Batch finished completely
      setToastMessage('🎉 Seluruh dokumen telah selesai diverifikasi!');
      setTimeout(() => {
        if (payload.action === 'CREATE_NEW' && data.jamaah?.id) {
          router.push(`/jamaah/${data.jamaah.id}`);
        } else {
          router.push('/jamaah');
        }
      }, 800);
    }
  };

  const handleReject = async () => {
    await handleConfirmDecision({
      action: 'REJECT',
      fields: {},
    });
  };

  const remainingCount = queueList.length > 0 ? queueList.length : 1;
  const currentStep = currentIndex !== -1 ? currentIndex + 1 : 1;

  return (
    <div className="space-y-4 animate-in fade-in duration-150 relative">
      {/* Toast Notification for smooth transitions */}
      {toastMessage && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 bg-slate-900 text-white px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-3 animate-in slide-in-from-top-4 duration-200">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <span className="text-xs font-bold">{toastMessage}</span>
        </div>
      )}

      {/* Top Header & Batch Stepper */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
        <div className="flex items-center gap-3">
          <Link
            href="/jamaah/review"
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl border border-slate-200 shadow-2xs transition-all"
            title="Kembali ke Antrean Review"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-black text-slate-900 tracking-tight">
                Ruang Review & Verifikasi Dokumen
              </h1>
              {queueList.length > 1 && (
                <span className="text-[11px] font-bold bg-emerald-100 text-emerald-800 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                  <Layers className="w-3 h-3" />
                  <span>Dokumen {currentStep} dari {queueList.length}</span>
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500">
              Berkas: <span className="font-mono text-slate-800 font-semibold">{document.original_file_name}</span>
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          {queueList.length > 1 && currentIndex < queueList.length - 1 && (
            <button
              type="button"
              onClick={() => handleNextInQueue()}
              className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all"
            >
              <span>Lewati Dokumen Ini</span>
              <SkipForward className="w-3.5 h-3.5" />
            </button>
          )}

          <Link
            href="/jamaah"
            className="px-3.5 py-1.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-2xs transition-all"
          >
            <Users className="w-3.5 h-3.5 text-slate-500" />
            <span>Database Jamaah</span>
          </Link>
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

        {/* Right: Interactive Extraction Review Form (7 cols) */}
        <div className="lg:col-span-7 flex flex-col">
          <ExtractionReviewForm
            documentId={document.id}
            initialType={document.document_type}
            initialFields={extraction?.extracted_fields || {}}
            confidenceScore={extraction?.confidence_score || 0}
            qualityWarnings={[]}
            onConfirm={handleConfirmDecision}
            onReject={handleReject}
          />
        </div>
      </div>
    </div>
  );
}

export default function DocumentReviewWorkspacePage() {
  return (
    <Suspense fallback={<LoadingSpinner label="Menyiapkan ruang kerja review dokumen..." fullScreen />}>
      <DocumentReviewWorkspaceContent />
    </Suspense>
  );
}
