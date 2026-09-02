'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { 
  FileSpreadsheet, 
  Download, 
  CheckCircle2, 
  AlertTriangle, 
  AlertCircle, 
  Settings, 
  ArrowRight,
  ExternalLink,
  ShieldCheck,
  RefreshCw,
  SlidersHorizontal,
  Calendar,
  Plane
} from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { 
  Package, 
  ManifestTemplate, 
  ManifestValidationSummary, 
  ManifestParticipantValidation 
} from '@/types/database.types';

function ManifestContent() {
  const searchParams = useSearchParams();
  const initialPackageId = searchParams.get('package_id') || '';

  const [packages, setPackages] = useState<Package[]>([]);
  const [templates, setTemplates] = useState<ManifestTemplate[]>([]);
  const [selectedPackageId, setSelectedPackageId] = useState(initialPackageId);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [sorting, setSorting] = useState<'DEFAULT' | 'NAME' | 'PASSPORT_NAME' | 'PIC'>('DEFAULT');

  const [validation, setValidation] = useState<ManifestValidationSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [validating, setValidating] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [activeTab, setActiveTab] = useState<'PREVIEW' | 'ISSUES'>('PREVIEW');
  const [searchFilter, setSearchFilter] = useState('');

  // Load Packages and Templates
  useEffect(() => {
    async function loadMeta() {
      try {
        setLoading(true);
        const [pkgRes, tmplRes] = await Promise.all([
          fetch('/api/packages'),
          fetch('/api/manifest/templates'),
        ]);

        if (pkgRes.ok && tmplRes.ok) {
          const pkgData: Package[] = await pkgRes.json();
          const tmplData: ManifestTemplate[] = await tmplRes.json();

          setPackages(pkgData);
          setTemplates(tmplData);

          if (pkgData.length > 0) {
            const targetPkg = initialPackageId && pkgData.some(p => p.id === initialPackageId)
              ? initialPackageId
              : pkgData[0].id;
            setSelectedPackageId(targetPkg);
          }

          if (tmplData.length > 0) {
            const defTmpl = tmplData.find(t => t.is_default) || tmplData[0];
            setSelectedTemplateId(defTmpl.id);
          }
        }
      } catch (err) {
        console.error('Failed to load manifest meta:', err);
      } finally {
        setLoading(false);
      }
    }
    loadMeta();
  }, [initialPackageId]);

  // Run validation whenever Package, Template, or Sorting changes
  useEffect(() => {
    if (!selectedPackageId) return;

    async function runValidation() {
      try {
        setValidating(true);
        const res = await fetch('/api/manifest/validate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            package_id: selectedPackageId,
            template_id: selectedTemplateId || undefined,
            sorting,
          }),
        });

        if (res.ok) {
          const data: ManifestValidationSummary = await res.json();
          setValidation(data);
          if (data.error_count > 0) {
            setActiveTab('ISSUES');
          }
        } else {
          setValidation(null);
        }
      } catch (err) {
        console.error('Validation error:', err);
        setValidation(null);
      } finally {
        setValidating(false);
      }
    }

    runValidation();
  }, [selectedPackageId, selectedTemplateId, sorting]);

  const handleExport = async (override = false) => {
    if (!selectedPackageId) return;
    setExporting(true);

    try {
      const res = await fetch('/api/manifest/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          package_id: selectedPackageId,
          template_id: selectedTemplateId || undefined,
          sorting,
          override_errors: override,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Gagal mengekspor manifest');
      }

      // Trigger file download
      const blob = await res.blob();
      const disposition = res.headers.get('Content-Disposition');
      let filename = 'MANIFEST_EXPORT.xlsx';
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
      alert(err.message || 'Terjadi kesalahan saat download manifest');
    } finally {
      setExporting(false);
    }
  };

  if (loading) {
    return <LoadingSpinner label="Memuat modul manifest penerbangan..." />;
  }

  const selectedPkg = packages.find(p => p.id === selectedPackageId);
  const selectedTmpl = templates.find(t => t.id === selectedTemplateId);

  // Filtered rows for preview table
  let displayParticipants = validation?.participants || [];
  if (searchFilter) {
    const q = searchFilter.toLowerCase();
    displayParticipants = displayParticipants.filter(p => 
      p.jamaah_name.toLowerCase().includes(q) ||
      (p.passport_number && p.passport_number.toLowerCase().includes(q))
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
            <FileSpreadsheet className="w-7 h-7 text-emerald-600" />
            Manifest Penerbangan Jamaah
          </h1>
          <p className="text-slate-500 text-sm mt-0.5">
            Ekspor manifest maskapai resmi terintegrasi langsung dari master database dan paspor jamaah.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Link
            href="/pengaturan/template-manifest"
            className="px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded-xl text-xs font-bold shadow-2xs flex items-center gap-2 transition-all"
          >
            <Settings className="w-4 h-4 text-slate-500" />
            Kelola Template
          </Link>
          <button
            type="button"
            onClick={() => handleExport(false)}
            disabled={exporting || validating || !validation || validation.total_participants === 0}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-900/20 flex items-center gap-2 transition-all"
          >
            {exporting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            <span>Export Manifest XLSX</span>
          </button>
        </div>
      </div>

      {/* Package & Template Selector Bar */}
      <div className="p-4 bg-white border border-slate-200/80 rounded-2xl shadow-2xs grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-xs font-bold text-slate-600 mb-1.5">Pilih Paket Keberangkatan:</label>
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
          <label className="block text-xs font-bold text-slate-600 mb-1.5">Template Format Manifest:</label>
          <select
            value={selectedTemplateId}
            onChange={(e) => setSelectedTemplateId(e.target.value)}
            className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
          >
            {templates.map(t => (
              <option key={t.id} value={t.id}>
                {t.name} {t.is_default ? '(Default)' : ''}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-600 mb-1.5">Urutan Baris (Row Order):</label>
          <select
            value={sorting}
            onChange={(e) => setSorting(e.target.value as any)}
            className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
          >
            <option value="DEFAULT">Urutan Registrasi Peserta</option>
            <option value="NAME">Nama Jamaah (A - Z)</option>
            <option value="PASSPORT_NAME">Nama Sesuai Paspor (A - Z)</option>
            <option value="PIC">Kelompok PIC / Tour Leader</option>
          </select>
        </div>
      </div>

      {/* Validation Summary Cards */}
      {validation && (
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-2xs">
            <span className="text-[11px] text-slate-400 font-semibold block uppercase">Total Jamaah</span>
            <div className="flex items-center justify-between mt-1">
              <span className="text-2xl font-black text-slate-900 font-mono">{validation.total_participants} Pax</span>
              <Plane className="w-5 h-5 text-slate-400" />
            </div>
          </div>

          <div className="p-4 bg-emerald-50/70 border border-emerald-200 rounded-2xl shadow-2xs">
            <span className="text-[11px] text-emerald-700 font-semibold block uppercase">Data Lengkap (Ready)</span>
            <div className="flex items-center justify-between mt-1">
              <span className="text-2xl font-black text-emerald-800 font-mono">{validation.ready_count} Pax</span>
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            </div>
          </div>

          <div className="p-4 bg-amber-50/70 border border-amber-200 rounded-2xl shadow-2xs">
            <span className="text-[11px] text-amber-700 font-semibold block uppercase">Peringatan (Warning)</span>
            <div className="flex items-center justify-between mt-1">
              <span className="text-2xl font-black text-amber-800 font-mono">{validation.warning_count} Pax</span>
              <AlertTriangle className="w-5 h-5 text-amber-600" />
            </div>
          </div>

          <div className={`p-4 rounded-2xl shadow-2xs border ${validation.error_count > 0 ? 'bg-rose-50 border-rose-300' : 'bg-white border-slate-200'}`}>
            <span className={`text-[11px] font-semibold block uppercase ${validation.error_count > 0 ? 'text-rose-700' : 'text-slate-400'}`}>
              Error Kritis (Block)
            </span>
            <div className="flex items-center justify-between mt-1">
              <span className={`text-2xl font-black font-mono ${validation.error_count > 0 ? 'text-rose-800' : 'text-slate-900'}`}>
                {validation.error_count} Pax
              </span>
              <AlertCircle className={`w-5 h-5 ${validation.error_count > 0 ? 'text-rose-600' : 'text-slate-400'}`} />
            </div>
          </div>
        </div>
      )}

      {/* Actionable Error Alert if any errors exist */}
      {validation && validation.error_count > 0 && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
            <div>
              <p className="text-xs font-bold text-rose-900">
                Terdapat {validation.error_count} jamaah dengan data paspor yang belum valid atau kadaluarsa.
              </p>
              <p className="text-[11px] text-rose-700 mt-0.5">
                Perbaiki nomor paspor, nama, atau masa berlaku paspor pada profil jamaah sebelum finalisasi manifest.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => handleExport(true)}
            className="px-3 py-1.5 bg-white hover:bg-rose-100 text-rose-800 border border-rose-300 rounded-xl text-xs font-bold shrink-0 transition-all shadow-2xs"
          >
            Override & Export Saja
          </button>
        </div>
      )}

      {/* Tabs & Table Preview */}
      <div className="bg-white border border-slate-200/80 rounded-2xl shadow-2xs overflow-hidden">
        {/* Tab Controls & Search */}
        <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('PREVIEW')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'PREVIEW'
                  ? 'bg-slate-900 text-white shadow-2xs'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              Preview Manifest ({displayParticipants.length} Baris)
            </button>
            <button
              onClick={() => setActiveTab('ISSUES')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeTab === 'ISSUES'
                  ? 'bg-slate-900 text-white shadow-2xs'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              <span>Daftar Isu / Validasi</span>
              {(validation?.warning_count || 0) + (validation?.error_count || 0) > 0 && (
                <span className="px-1.5 py-0.2 bg-amber-500 text-white rounded-full text-[10px]">
                  {(validation?.warning_count || 0) + (validation?.error_count || 0)}
                </span>
              )}
            </button>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder="Cari nama jamaah / paspor..."
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none w-64"
            />
          </div>
        </div>

        {validating ? (
          <div className="p-12 text-center">
            <LoadingSpinner label="Memvalidasi kelengkapan paspor dan memetakan kolom template..." />
          </div>
        ) : displayParticipants.length === 0 ? (
          <div className="p-12 text-center">
            <EmptyState
              title="Belum Ada Peserta Terdaftar"
              description="Paket ini belum memiliki peserta jamaah. Daftarkan peserta di menu Paket Peserta."
            />
          </div>
        ) : activeTab === 'PREVIEW' ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 uppercase font-bold text-[10px] border-b border-slate-200">
                <tr>
                  <th className="py-3 px-3 text-center">No</th>
                  <th className="py-3 px-4">Nama Sesuai Paspor</th>
                  <th className="py-3 px-3">No. Paspor</th>
                  <th className="py-3 px-2 text-center">Gender</th>
                  <th className="py-3 px-3">Tempat Lahir</th>
                  <th className="py-3 px-3">Tgl Lahir</th>
                  <th className="py-3 px-3">Tgl Terbit</th>
                  <th className="py-3 px-3">Tgl Expire</th>
                  <th className="py-3 px-3">PIC / TL</th>
                  <th className="py-3 px-3 text-center">Validasi</th>
                  <th className="py-3 px-3 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {displayParticipants.map((p, idx) => {
                  const m = p.mapped_values;
                  return (
                    <tr key={p.participant_id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-3 text-center font-mono text-slate-400">{m.no || idx + 1}</td>
                      <td className="py-3 px-4 font-bold text-slate-900">
                        <Link href={`/jamaah/${p.jamaah_id}`} className="hover:text-emerald-700 transition-colors">
                          {m.passport_name}
                        </Link>
                      </td>
                      <td className="py-3 px-3 font-mono font-bold text-slate-800">{m.passport_number}</td>
                      <td className="py-3 px-2 text-center font-medium text-slate-600">{m.gender}</td>
                      <td className="py-3 px-3 text-slate-700">{m.birth_place}</td>
                      <td className="py-3 px-3 font-mono text-slate-600">{m.birth_date}</td>
                      <td className="py-3 px-3 font-mono text-slate-600">{m.passport_issue_date}</td>
                      <td className="py-3 px-3 font-mono text-slate-600">{m.passport_expiry_date}</td>
                      <td className="py-3 px-3 text-slate-700">{m.pic_name}</td>
                      <td className="py-3 px-3 text-center">
                        {p.status === 'READY' && <Badge variant="success">Ready</Badge>}
                        {p.status === 'WARNING' && <Badge variant="warning">Warning</Badge>}
                        {p.status === 'ERROR' && <Badge variant="danger">Error</Badge>}
                      </td>
                      <td className="py-3 px-3 text-center">
                        <Link
                          href={`/jamaah/${p.jamaah_id}`}
                          className="px-2 py-1 text-slate-600 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg text-xs font-semibold inline-flex items-center gap-1 transition-all"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          <span>Profil</span>
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          /* ISSUES TAB */
          <div className="divide-y divide-slate-100">
            {displayParticipants.filter(p => p.issues.length > 0).length === 0 ? (
              <div className="p-8 text-center text-slate-400">
                <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                <p className="font-bold text-slate-700 text-sm">Semua data jamaah valid dan siap diekspor!</p>
              </div>
            ) : (
              displayParticipants
                .filter(p => p.issues.length > 0)
                .map(p => (
                  <div key={p.participant_id} className="p-4 hover:bg-slate-50/60 flex items-start justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2.5">
                        <span className="font-bold text-slate-900 text-sm">{p.jamaah_name}</span>
                        {p.passport_number && (
                          <span className="text-xs font-mono text-slate-400">({p.passport_number})</span>
                        )}
                        {p.status === 'ERROR' ? (
                          <Badge variant="danger">Perlu Perbaikan</Badge>
                        ) : (
                          <Badge variant="warning">Perhatian</Badge>
                        )}
                      </div>
                      <ul className="space-y-1 mt-1.5">
                        {p.issues.map((issue, iIdx) => (
                          <li key={iIdx} className="text-xs flex items-center gap-2 text-slate-600">
                            <span className={`w-1.5 h-1.5 rounded-full ${issue.severity === 'ERROR' ? 'bg-rose-500' : 'bg-amber-500'}`} />
                            <span>{issue.message}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <Link
                      href={`/jamaah/${p.jamaah_id}`}
                      className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded-xl text-xs font-bold flex items-center gap-1.5 shrink-0 transition-all"
                    >
                      <span>Perbaiki Data</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function ManifestPage() {
  return (
    <Suspense fallback={<LoadingSpinner label="Memuat modul manifest penerbangan..." />}>
      <ManifestContent />
    </Suspense>
  );
}
