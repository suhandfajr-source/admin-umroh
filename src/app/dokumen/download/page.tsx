'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { 
  Download, 
  Package as PackageIcon, 
  FileText, 
  CheckCircle2, 
  AlertTriangle, 
  AlertCircle, 
  Users, 
  FolderArchive, 
  RefreshCw,
  ArrowLeft
} from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { Package, PIC, DocumentType } from '@/types/database.types';
import { DocumentZipPreviewResult } from '@/lib/export/document-zip';

function DocumentDownloadContent() {
  const searchParams = useSearchParams();
  const initialPackageId = searchParams.get('package_id') || '';

  const [packages, setPackages] = useState<Package[]>([]);
  const [pics, setPics] = useState<PIC[]>([]);
  const [selectedPackageId, setSelectedPackageId] = useState(initialPackageId);
  const [selectedPicId, setSelectedPicId] = useState('');

  // Selected Doc Types
  const [selectedTypes, setSelectedTypes] = useState<DocumentType[]>(['PASSPORT']);
  const [preview, setPreview] = useState<DocumentZipPreviewResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    async function loadMeta() {
      try {
        setLoading(true);
        const [pkgRes, picRes] = await Promise.all([
          fetch('/api/packages'),
          fetch('/api/pics'),
        ]);

        if (pkgRes.ok && picRes.ok) {
          const pkgData = await pkgRes.json();
          const picData = await picRes.json();
          setPackages(pkgData);
          setPics(picData);

          if (pkgData.length > 0) {
            const targetPkg = initialPackageId && pkgData.some((p: any) => p.id === initialPackageId)
              ? initialPackageId
              : pkgData[0].id;
            setSelectedPackageId(targetPkg);
          }
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    loadMeta();
  }, [initialPackageId]);

  // Load Preview whenever Package, PIC, or Types change
  useEffect(() => {
    if (!selectedPackageId) return;

    async function loadPreview() {
      try {
        setLoadingPreview(true);
        const res = await fetch('/api/documents/bulk-zip', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            package_id: selectedPackageId,
            pic_id: selectedPicId || undefined,
            document_types: selectedTypes,
            action: 'preview',
          }),
        });

        if (res.ok) {
          const data: DocumentZipPreviewResult = await res.json();
          setPreview(data);
        } else {
          setPreview(null);
        }
      } catch (err) {
        console.error(err);
        setPreview(null);
      } finally {
        setLoadingPreview(false);
      }
    }

    loadPreview();
  }, [selectedPackageId, selectedPicId, selectedTypes]);

  const toggleType = (type: DocumentType) => {
    if (selectedTypes.includes(type)) {
      if (selectedTypes.length === 1) return; // Keep at least one
      setSelectedTypes(selectedTypes.filter(t => t !== type));
    } else {
      setSelectedTypes([...selectedTypes, type]);
    }
  };

  const handleDownloadZip = async () => {
    if (!selectedPackageId) return;
    setDownloading(true);

    try {
      const res = await fetch('/api/documents/bulk-zip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          package_id: selectedPackageId,
          pic_id: selectedPicId || undefined,
          document_types: selectedTypes,
          action: 'download',
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Gagal membuat file ZIP');
      }

      const blob = await res.blob();
      const disposition = res.headers.get('Content-Disposition');
      let filename = 'DOKUMEN_PAKET.zip';
      if (disposition && disposition.includes('filename=')) {
        filename = disposition.split('filename=')[1].replace(/"/g, '');
      }

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      alert(err.message || 'Terjadi kesalahan saat mendownload ZIP dokumen');
    } finally {
      setDownloading(false);
    }
  };

  if (loading) {
    return <LoadingSpinner label="Memuat modul download dokumen..." />;
  }

  const DOC_TYPE_OPTIONS: { key: DocumentType; label: string }[] = [
    { key: 'PASSPORT', label: 'Paspor Asli (Travel Passport)' },
    { key: 'KTP', label: 'KTP Elektronik' },
    { key: 'KK', label: 'Kartu Keluarga (KK)' },
    { key: 'VAKSIN', label: 'Sertifikat Vaksin Meningitis / Polio' },
    { key: 'BUKU_NIKAH', label: 'Buku Nikah / Akta Lahir' },
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
            <FolderArchive className="w-7 h-7 text-emerald-600" />
            Download Dokumen Massal (ZIP)
          </h1>
          <p className="text-slate-500 text-sm mt-0.5">
            Unduh paket berkas jamaah per paket atau per koordinator PIC dengan penamaan file rapi secara otomatis.
          </p>
        </div>

        <button
          type="button"
          onClick={handleDownloadZip}
          disabled={downloading || loadingPreview || !preview || preview.available_files_count === 0}
          className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-900/20 flex items-center gap-2 transition-all"
        >
          {downloading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
          <span>Download Dokumen ZIP ({preview?.available_files_count || 0} File)</span>
        </button>
      </div>

      {/* Package & Filter Selection */}
      <div className="p-5 bg-white border border-slate-200/80 rounded-2xl shadow-2xs space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1.5">Pilih Paket Umrah:</label>
            <select
              value={selectedPackageId}
              onChange={(e) => setSelectedPackageId(e.target.value)}
              className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            >
              {packages.map(pkg => (
                <option key={pkg.id} value={pkg.id}>
                  {pkg.package_name} ({pkg.departure_date})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1.5">Filter PIC / Tour Leader:</label>
            <select
              value={selectedPicId}
              onChange={(e) => setSelectedPicId(e.target.value)}
              className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            >
              <option value="">Semua PIC & Rombongan Paket</option>
              <option value="DIRECT">Hanya Jamaah Direct (Tanpa PIC)</option>
              {pics.map(pic => (
                <option key={pic.id} value={pic.id}>
                  {pic.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Document Types Checklist */}
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-2">
            Pilih Jenis Dokumen yang Akan Dimasukkan ke File ZIP:
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
            {DOC_TYPE_OPTIONS.map(opt => {
              const isChecked = selectedTypes.includes(opt.key);
              return (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => toggleType(opt.key)}
                  className={`p-3 rounded-xl border text-left text-xs font-bold transition-all flex items-center justify-between ${
                    isChecked
                      ? 'bg-emerald-50 border-emerald-300 text-emerald-900 shadow-2xs'
                      : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <span>{opt.label}</span>
                  {isChecked ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 ml-2" />
                  ) : (
                    <span className="w-4 h-4 rounded-full border border-slate-300 shrink-0 ml-2" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Availability Preview Summary */}
      {preview && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-2xs">
            <span className="text-[11px] text-slate-400 font-semibold block uppercase">Total Jamaah Terpilih</span>
            <div className="flex items-center justify-between mt-1">
              <span className="text-2xl font-black text-slate-900 font-mono">{preview.total_participants} Pax</span>
              <Users className="w-5 h-5 text-slate-400" />
            </div>
          </div>

          <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl shadow-2xs">
            <span className="text-[11px] text-emerald-700 font-semibold block uppercase">Berkas Tersedia (Siap ZIP)</span>
            <div className="flex items-center justify-between mt-1">
              <span className="text-2xl font-black text-emerald-800 font-mono">{preview.available_files_count} File</span>
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            </div>
          </div>

          <div className={`p-4 rounded-2xl shadow-2xs border ${preview.missing_files_count > 0 ? 'bg-amber-50 border-amber-200' : 'bg-white border-slate-200'}`}>
            <span className={`text-[11px] font-semibold block uppercase ${preview.missing_files_count > 0 ? 'text-amber-700' : 'text-slate-400'}`}>
              Jamaah Belum Lengkap
            </span>
            <div className="flex items-center justify-between mt-1">
              <span className={`text-2xl font-black font-mono ${preview.missing_files_count > 0 ? 'text-amber-800' : 'text-slate-900'}`}>
                {preview.missing_files_count} Pax
              </span>
              <AlertTriangle className={`w-5 h-5 ${preview.missing_files_count > 0 ? 'text-amber-600' : 'text-slate-400'}`} />
            </div>
          </div>
        </div>
      )}

      {/* Missing Jamaah Warning Banner if any */}
      {preview && preview.missing_jamaah.length > 0 && (
        <div className="p-4 bg-amber-50/80 border border-amber-200 rounded-2xl space-y-2">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
            <h3 className="font-bold text-amber-950 text-xs">
              Daftar Jamaah dengan Dokumen Belum Terunggah ({preview.missing_jamaah.length} Jamaah):
            </h3>
          </div>
          <div className="flex flex-wrap gap-2 pt-1">
            {preview.missing_jamaah.map(m => (
              <span key={m.jamaah_id} className="px-2.5 py-1 bg-white border border-amber-200 rounded-lg text-xs text-amber-900 font-medium flex items-center gap-1.5">
                <Link href={`/jamaah/${m.jamaah_id}`} className="hover:underline font-bold">
                  {m.jamaah_name}
                </Link>
                <span className="text-[10px] text-amber-700">({m.missing_types.join(', ')})</span>
              </span>
            ))}
          </div>
          <p className="text-[11px] text-amber-700 pt-1">
            * Anda tetap dapat mendownload seluruh berkas yang tersedia saat ini.
          </p>
        </div>
      )}

      {/* File Structure Preview Table */}
      <div className="bg-white border border-slate-200/80 rounded-2xl shadow-2xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div>
            <h3 className="font-bold text-slate-900 text-sm">Struktur Penamaan File Dalam ZIP</h3>
            <p className="text-xs text-slate-400 mt-0.5">Format nama file otomatis rapi dan terstandarisasi maskapai</p>
          </div>
          <span className="text-xs font-mono text-slate-500 font-semibold">
            {preview?.files_to_download.length || 0} Berkas
          </span>
        </div>

        {loadingPreview ? (
          <div className="p-12 text-center">
            <LoadingSpinner label="Memeriksa ketersediaan berkas di storage..." />
          </div>
        ) : !preview || preview.files_to_download.length === 0 ? (
          <div className="p-12 text-center">
            <EmptyState
              title="Belum Ada Berkas Dokumen"
              description="Tidak ada dokumen dengan jenis yang dipilih pada paket ini."
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 uppercase font-bold text-[10px] border-b border-slate-200">
                <tr>
                  <th className="py-3 px-3 text-center">No</th>
                  <th className="py-3 px-4">Nama Jamaah</th>
                  <th className="py-3 px-3">Jenis Dokumen</th>
                  <th className="py-3 px-4 font-mono">Nama File Dalam ZIP</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {preview.files_to_download.map((f) => (
                  <tr key={f.sequence} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-2.5 px-3 text-center font-mono text-slate-400">{f.sequence}</td>
                    <td className="py-2.5 px-4 font-bold text-slate-900">{f.jamaah_name}</td>
                    <td className="py-2.5 px-3 font-semibold text-emerald-700">{f.document_type}</td>
                    <td className="py-2.5 px-4 font-mono font-bold text-slate-700 bg-slate-50/60">
                      {f.clean_file_name}
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

export default function DocumentDownloadPage() {
  return (
    <Suspense fallback={<LoadingSpinner label="Memuat modul download dokumen..." />}>
      <DocumentDownloadContent />
    </Suspense>
  );
}
