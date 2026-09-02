'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { 
  Compass, 
  ArrowLeft, 
  Clock, 
  ShieldAlert, 
  CheckCircle2, 
  AlertTriangle, 
  FileSpreadsheet, 
  Receipt, 
  Luggage, 
  Users, 
  ArrowUpRight,
  ExternalLink,
  Package as PackageIcon
} from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { PackageReadiness, ParticipantReadiness, Package } from '@/types/database.types';

export default function PackageCommandCenterPage() {
  const params = useParams();
  const packageId = params.id as string;

  const [readiness, setReadiness] = useState<PackageReadiness | null>(null);
  const [pkg, setPkg] = useState<Package | null>(null);
  const [participantsReadiness, setParticipantsReadiness] = useState<ParticipantReadiness[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCommandCenterData = async () => {
      try {
        setLoading(true);
        const [resReadiness, resPkg, resParts] = await Promise.all([
          fetch(`/api/intelligence/readiness/package/${packageId}`),
          fetch(`/api/packages/${packageId}`),
          fetch(`/api/participants?packageId=${packageId}`),
        ]);

        if (resReadiness.ok) {
          const jsonR = await resReadiness.json();
          setReadiness(jsonR);
        }
        if (resPkg.ok) {
          const jsonP = await resPkg.json();
          setPkg(jsonP?.package || jsonP);
        }
        if (resParts.ok) {
          const jsonParts = await resParts.json();
          const pList = Array.isArray(jsonParts) ? jsonParts : (jsonParts?.participants || []);

          // Load per-participant readiness
          const pReadiness = await Promise.all(
            pList.map(async (part: any) => {
              const rRes = await fetch(`/api/intelligence/readiness/participant/${part.id}`);
              if (rRes.ok) return rRes.json();
              return null;
            })
          );
          setParticipantsReadiness(pReadiness.filter(Boolean));
        }
      } catch (err) {
        console.error('Error fetching command center:', err);
      } finally {
        setLoading(false);
      }
    };

    if (packageId) fetchCommandCenterData();
  }, [packageId]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-3">
        <LoadingSpinner size="lg" />
        <p className="text-sm font-medium text-slate-500">Memuat Package Command Center...</p>
      </div>
    );
  }

  if (!pkg || !readiness) {
    return (
      <div className="p-12 text-center text-slate-500 bg-white rounded-3xl border border-slate-200 shadow-sm space-y-3">
        <p className="font-bold text-slate-800 text-base">Gagal Memuat Package Command Center</p>
        <p className="text-xs text-slate-400">Data paket atau kesiapan operasional tidak ditemukan.</p>
        <Link
          href="/paket"
          className="inline-block px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all"
        >
          Kembali ke Daftar Paket
        </Link>
      </div>
    );
  }

  const isUrgent = readiness.days_to_departure <= 14;
  const hasBlockers = readiness.critical_blockers_count > 0;

  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      {/* Back Link */}
      <div className="flex items-center gap-3">
        <Link
          href={`/paket/${packageId}`}
          className="p-2 rounded-xl bg-white border border-slate-200 text-slate-600 hover:text-slate-900 transition-all"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Package Command Center</span>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">{pkg.package_name}</h1>
        </div>
      </div>

      {/* Package Header Card */}
      <div className="bg-slate-900 text-white p-6 rounded-3xl border border-slate-800 shadow-xl space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                isUrgent ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30' : 'bg-slate-800 text-slate-300'
              }`}>
                <Clock className="w-3 h-3 inline mr-1" />
                {readiness.days_to_departure} Hari Menuju Keberangkatan ({pkg.departure_date})
              </span>
              <Badge variant={pkg.status === 'OPEN' ? 'success' : 'neutral'}>
                {pkg.status}
              </Badge>
            </div>
            <h2 className="text-xl font-bold text-white tracking-tight">{pkg.package_name}</h2>
            <p className="text-xs text-slate-400">
              Total Jamaah Terdaftar: {readiness.total_active_participants} / {pkg.quota} Kuota Pax
            </p>
          </div>

          {/* Overall Readiness Gauge */}
          <div className="bg-slate-800/80 p-4 rounded-2xl border border-slate-700/60 text-right shrink-0">
            <div className="text-3xl font-black text-white">
              {readiness.overall_readiness_percentage}%
            </div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              Tingkat Kesiapan Keberangkatan
            </span>
          </div>
        </div>

        {/* Quick Action Navigation Buttons */}
        <div className="pt-3 border-t border-slate-800 flex flex-wrap items-center gap-2 text-xs">
          <Link
            href={`/manifest?packageId=${packageId}`}
            className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl font-semibold flex items-center gap-1.5 transition-all"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
            <span>Manifest Penerbangan</span>
          </Link>
          <Link
            href={`/finance/tagihan?packageId=${packageId}`}
            className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl font-semibold flex items-center gap-1.5 transition-all"
          >
            <Receipt className="w-3.5 h-3.5 text-amber-400" />
            <span>Keuangan & Tagihan</span>
          </Link>
          <Link
            href={`/perlengkapan/penyerahan?packageId=${packageId}`}
            className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl font-semibold flex items-center gap-1.5 transition-all"
          >
            <Luggage className="w-3.5 h-3.5 text-sky-400" />
            <span>Perlengkapan Jamaah</span>
          </Link>
          <Link
            href={`/dokumen/download?packageId=${packageId}`}
            className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl font-semibold flex items-center gap-1.5 transition-all"
          >
            <Users className="w-3.5 h-3.5 text-purple-400" />
            <span>Download Bulk Dokumen</span>
          </Link>
        </div>
      </div>

      {/* 4 Dimension Readiness Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Document */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">DOKUMEN & PASPOR</span>
            <Badge variant={readiness.dimensions.document.status === 'READY' ? 'success' : readiness.dimensions.document.status === 'ERROR' ? 'danger' : 'warning'}>
              {readiness.dimensions.document.percentage}%
            </Badge>
          </div>
          <div className="text-xl font-black text-slate-900">
            {readiness.dimensions.document.ready_pax} / {readiness.dimensions.document.total_pax} Pax Siap
          </div>
          <p className="text-[11px] text-slate-500">
            {readiness.dimensions.document.blockers_count} kendala paspor/dokumen
          </p>
        </div>

        {/* Finance */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">KEUANGAN & TAGIHAN</span>
            <Badge variant={readiness.dimensions.finance.status === 'READY' ? 'success' : 'warning'}>
              {readiness.dimensions.finance.percentage}%
            </Badge>
          </div>
          <div className="text-xl font-black text-slate-900">
            {readiness.dimensions.finance.ready_pax} / {readiness.dimensions.finance.total_pax} Lunas
          </div>
          <p className="text-[11px] text-slate-500">
            {readiness.dimensions.finance.warnings_count} jamaah belum lunas
          </p>
        </div>

        {/* Manifest */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">MANIFEST AIRLINE</span>
            <Badge variant={readiness.dimensions.manifest.status === 'READY' ? 'success' : readiness.dimensions.manifest.status === 'NOT_CONFIGURED' ? 'neutral' : 'warning'}>
              {readiness.dimensions.manifest.is_applicable ? `${readiness.dimensions.manifest.percentage}%` : 'N/A'}
            </Badge>
          </div>
          <div className="text-xl font-black text-slate-900">
            {readiness.dimensions.manifest.is_applicable ? `${readiness.dimensions.manifest.ready_pax} / ${readiness.dimensions.manifest.total_pax} Valid` : 'Template N/A'}
          </div>
          <p className="text-[11px] text-slate-500">
            {readiness.dimensions.manifest.blockers_count} error validasi
          </p>
        </div>

        {/* Equipment */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">PERLENGKAPAN</span>
            <Badge variant={readiness.dimensions.equipment.status === 'READY' ? 'success' : readiness.dimensions.equipment.status === 'NOT_APPLICABLE' ? 'neutral' : 'warning'}>
              {readiness.dimensions.equipment.is_applicable ? `${readiness.dimensions.equipment.percentage}%` : 'N/A'}
            </Badge>
          </div>
          <div className="text-xl font-black text-slate-900">
            {readiness.dimensions.equipment.is_applicable ? `${readiness.dimensions.equipment.ready_pax} / ${readiness.dimensions.equipment.total_pax} Selesai` : 'Belum Diatur'}
          </div>
          <p className="text-[11px] text-slate-500">
            {readiness.dimensions.equipment.warnings_count} ukuran/serah pending
          </p>
        </div>
      </div>

      {/* Critical Blockers Alert Box */}
      {hasBlockers && (
        <div className="p-5 bg-rose-50 border border-rose-200 rounded-3xl space-y-2 text-xs">
          <div className="flex items-center gap-2 text-rose-800 font-bold text-sm">
            <ShieldAlert className="w-5 h-5" />
            <span>{readiness.critical_blockers_count} Kendala Kritis Membutuhkan Penanganan</span>
          </div>
          <ul className="list-disc list-inside text-rose-700 space-y-1">
            {readiness.critical_blockers_summary.map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Participant Readiness Matrix Desk */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div>
            <h3 className="text-base font-black text-slate-900">Matriks Kesiapan Peserta Jamaah</h3>
            <p className="text-xs text-slate-500">Status kesiapan individual per jamaah untuk paket ini.</p>
          </div>
          <span className="text-xs font-bold text-slate-400">{participantsReadiness.length} Jamaah</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/70 text-slate-500 font-bold">
                <th className="py-3 px-3">No</th>
                <th className="py-3 px-3">Nama Jamaah</th>
                <th className="py-3 px-3">Dokumen</th>
                <th className="py-3 px-3">Finance</th>
                <th className="py-3 px-3">Manifest</th>
                <th className="py-3 px-3">Perlengkapan</th>
                <th className="py-3 px-3">Overall Status</th>
                <th className="py-3 px-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {participantsReadiness.map((p, idx) => (
                <tr key={p.participant_id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-3 px-3 text-slate-400">{idx + 1}</td>
                  <td className="py-3 px-3">
                    <span className="font-bold text-slate-900 block">{p.jamaah_name}</span>
                    {p.passport_name && <span className="text-[11px] text-slate-400">{p.passport_name}</span>}
                  </td>
                  <td className="py-3 px-3">
                    <Badge variant={p.document_status === 'READY' ? 'success' : p.document_status === 'ERROR' ? 'danger' : 'warning'}>
                      {p.document_status}
                    </Badge>
                  </td>
                  <td className="py-3 px-3">
                    <Badge variant={p.finance_status === 'READY' ? 'success' : 'warning'}>
                      {p.finance_status}
                    </Badge>
                  </td>
                  <td className="py-3 px-3">
                    <Badge variant={p.manifest_status === 'READY' ? 'success' : p.manifest_status === 'ERROR' ? 'danger' : 'warning'}>
                      {p.manifest_status}
                    </Badge>
                  </td>
                  <td className="py-3 px-3">
                    <Badge variant={p.equipment_status === 'READY' ? 'success' : p.equipment_status === 'NOT_APPLICABLE' ? 'neutral' : 'warning'}>
                      {p.equipment_status}
                    </Badge>
                  </td>
                  <td className="py-3 px-3">
                    <Badge variant={p.overall_status === 'READY' ? 'success' : p.overall_status === 'ACTION_REQUIRED' ? 'danger' : 'warning'}>
                      {p.overall_status}
                    </Badge>
                  </td>
                  <td className="py-3 px-3 text-right">
                    <Link
                      href={`/jamaah/${p.jamaah_id}`}
                      className="text-xs font-bold text-emerald-700 hover:text-emerald-800 inline-flex items-center gap-1"
                    >
                      <span>Profil</span>
                      <ArrowUpRight className="w-3.5 h-3.5" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
