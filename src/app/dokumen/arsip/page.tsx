'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { 
  Inbox, 
  Search, 
  Filter, 
  FileText, 
  Download, 
  ExternalLink, 
  Eye, 
  ShieldCheck, 
  Calendar, 
  User, 
  RefreshCw 
} from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { DocumentArchiveItem, DocumentType, DocumentStatus } from '@/types/database.types';

function DocumentArchiveContent() {
  const [items, setItems] = useState<DocumentArchiveItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [documentType, setDocumentType] = useState<DocumentType | ''>('');
  const [status, setStatus] = useState<DocumentStatus | ''>('');
  const [isCurrent, setIsCurrent] = useState<string>('true');

  const [previewingId, setPreviewingId] = useState<string | null>(null);

  const fetchArchive = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (documentType) params.set('documentType', documentType);
      if (status) params.set('status', status);
      if (isCurrent !== 'all') params.set('isCurrent', isCurrent);

      const res = await fetch(`/api/documents/archive?${params.toString()}`);
      if (res.ok) {
        const data: DocumentArchiveItem[] = await res.json();
        setItems(data);
      }
    } catch (err) {
      console.error('Failed to load archive:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchArchive();
  }, [search, documentType, status, isCurrent]);

  const handlePreviewSignedUrl = async (docId: string) => {
    setPreviewingId(docId);
    try {
      const res = await fetch(`/api/documents/${docId}/signed-url`);
      if (res.ok) {
        const data = await res.json();
        if (data.signed_url) {
          window.open(data.signed_url, '_blank');
        } else {
          alert('Gagal membuat preview URL terotentikasi');
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setPreviewingId(null);
    }
  };

  const renderTypeBadge = (type: DocumentType) => {
    switch (type) {
      case 'PASSPORT':
        return <Badge variant="brand">PASPOR</Badge>;
      case 'KTP':
        return <Badge variant="info">KTP</Badge>;
      case 'KK':
        return <Badge variant="neutral">KARTU KELUARGA</Badge>;
      case 'VAKSIN':
        return <Badge variant="warning">VAKSIN</Badge>;
      case 'BUKU_NIKAH':
        return <Badge variant="success">BUKU NIKAH</Badge>;
      default:
        return <Badge variant="neutral">{type}</Badge>;
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
            <Inbox className="w-7 h-7 text-emerald-600" />
            Arsip Dokumen Jamaah
          </h1>
          <p className="text-slate-500 text-sm mt-0.5">
            Pusat pencarian seluruh berkas paspor, KTP, KK, dan sertifikat vaksin dengan preview aman.
          </p>
        </div>

        <Link
          href="/dokumen/download"
          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-900/20 flex items-center gap-2 transition-all"
        >
          <Download className="w-4 h-4" />
          <span>Download Dokumen Massal (ZIP)</span>
        </Link>
      </div>

      {/* Filter Bar */}
      <div className="p-4 bg-white border border-slate-200/80 rounded-2xl shadow-2xs grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div>
          <label className="block text-xs font-bold text-slate-600 mb-1">Cari Jamaah / Dokumen:</label>
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Nama, No Paspor, NIK, KK..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-600 mb-1">Jenis Dokumen:</label>
          <select
            value={documentType}
            onChange={(e) => setDocumentType(e.target.value as any)}
            className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white focus:ring-2 focus:ring-emerald-500"
          >
            <option value="">Semua Jenis Dokumen</option>
            <option value="PASSPORT">Paspor (Travel Document)</option>
            <option value="KTP">KTP Elektronik</option>
            <option value="KK">Kartu Keluarga (KK)</option>
            <option value="VAKSIN">Sertifikat Vaksin</option>
            <option value="BUKU_NIKAH">Buku Nikah / Akta</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-600 mb-1">Status Verifikasi:</label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as any)}
            className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white focus:ring-2 focus:ring-emerald-500"
          >
            <option value="">Semua Status</option>
            <option value="CONFIRMED">Terkonfirmasi (Confirmed)</option>
            <option value="NEEDS_REVIEW">Perlu Review (Needs Review)</option>
            <option value="ARCHIVED">Diarsipkan (Archived)</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-600 mb-1">Versi Dokumen:</label>
          <select
            value={isCurrent}
            onChange={(e) => setIsCurrent(e.target.value)}
            className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white focus:ring-2 focus:ring-emerald-500"
          >
            <option value="true">Hanya Dokumen Aktif (Current)</option>
            <option value="false">Hanya Dokumen Lama (Archived/Old)</option>
            <option value="all">Semua Versi Dokumen</option>
          </select>
        </div>
      </div>

      {/* Document Roster Table */}
      <div className="bg-white border border-slate-200/80 rounded-2xl shadow-2xs overflow-hidden">
        {loading ? (
          <div className="p-12 text-center">
            <LoadingSpinner label="Memuat berkas arsip dokumen..." />
          </div>
        ) : items.length === 0 ? (
          <div className="p-12 text-center">
            <EmptyState
              title="Tidak Ada Dokumen yang Ditemukan"
              description="Coba ubah kata kunci pencarian atau filter jenis dokumen."
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 uppercase font-bold text-[10px] border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Nama Jamaah</th>
                  <th className="py-3 px-3">Jenis Dokumen</th>
                  <th className="py-3 px-3">Nama File Berkas</th>
                  <th className="py-3 px-3">Nomor Identitas</th>
                  <th className="py-3 px-3">Paket Terakhir</th>
                  <th className="py-3 px-3 text-center">Versi</th>
                  <th className="py-3 px-3 text-center">Status</th>
                  <th className="py-3 px-3 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4 font-bold text-slate-900">
                      <Link href={`/jamaah/${item.jamaah_id}`} className="hover:text-emerald-700">
                        {item.jamaah_name}
                      </Link>
                    </td>
                    <td className="py-3 px-3">
                      {renderTypeBadge(item.document_type)}
                    </td>
                    <td className="py-3 px-3 font-mono text-slate-600 truncate max-w-xs" title={item.original_file_name}>
                      {item.original_file_name}
                    </td>
                    <td className="py-3 px-3 font-mono font-medium text-slate-700">
                      {item.passport_number || item.nik || '-'}
                    </td>
                    <td className="py-3 px-3 text-slate-600">
                      {item.package_name || <span className="text-slate-400 italic">Belum terdaftar</span>}
                    </td>
                    <td className="py-3 px-3 text-center">
                      {item.is_current ? (
                        <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full text-[10px] font-bold">
                          Current
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 bg-slate-100 text-slate-500 rounded-full text-[10px]">
                          Old / Replaced
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-center">
                      {item.status === 'CONFIRMED' && <Badge variant="success">Confirmed</Badge>}
                      {item.status === 'NEEDS_REVIEW' && <Badge variant="warning">Review</Badge>}
                      {item.status === 'ARCHIVED' && <Badge variant="neutral">Archived</Badge>}
                    </td>
                    <td className="py-3 px-3 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => handlePreviewSignedUrl(item.id)}
                          disabled={previewingId === item.id}
                          className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold inline-flex items-center gap-1 transition-colors"
                          title="Lihat Preview Dokumen Asli"
                        >
                          {previewingId === item.id ? (
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Eye className="w-3.5 h-3.5" />
                          )}
                          <span>Preview</span>
                        </button>
                        <Link
                          href={`/jamaah/${item.jamaah_id}`}
                          className="p-1 text-slate-400 hover:text-emerald-700 rounded-lg"
                          title="Buka Profil Master Jamaah"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default function DocumentArchivePage() {
  return (
    <Suspense fallback={<LoadingSpinner label="Memuat arsip dokumen..." />}>
      <DocumentArchiveContent />
    </Suspense>
  );
}
