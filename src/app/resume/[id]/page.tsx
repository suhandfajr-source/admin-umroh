'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { 
  ArrowLeft, 
  FileSpreadsheet, 
  Download, 
  UserPlus, 
  Eye, 
  Calendar, 
  Users,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ExternalLink
} from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { formatRupiah } from '@/lib/currency';
import { UnifiedJamaahDetailModal } from '@/components/jamaah/UnifiedJamaahDetailModal';
import { AddToPackageModal } from '@/components/jamaah/AddToPackageModal';

export default function RekapTagihanPage() {
  const params = useParams();
  const departureId = params.id as string;

  const [departure, setDeparture] = useState<any>(null);
  const [participants, setParticipants] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [exportingManifest, setExportingManifest] = useState(false);

  // Selected Jamaah for canonical detail modal
  const [selectedJamaahId, setSelectedJamaahId] = useState<string | null>(null);

  // Add Participant Modal
  const [showAddParticipant, setShowAddParticipant] = useState(false);

  const loadData = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/resume/${departureId}`);
      if (!res.ok) throw new Error('Gagal memuat rekap tagihan');
      const json = await res.json();
      setDeparture(json.departure || null);
      setParticipants(json.participants || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (departureId) loadData();
  }, [departureId]);

  const handleExportManifest = async () => {
    try {
      setExportingManifest(true);
      const res = await fetch('/api/manifest/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          package_id: departureId,
          template_id: 'tmpl_std_airline',
        }),
      });

      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson.error || 'Gagal export manifest');
      }

      const blob = await res.blob();
      const disposition = res.headers.get('Content-Disposition');
      let filename = `MANIFEST_${departure?.name?.replace(/\s+/g, '_') || 'KEBERANGKATAN'}.xlsx`;
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
      alert(err.message || 'Gagal download Excel Manifest');
    } finally {
      setExportingManifest(false);
    }
  };

  if (loading) {
    return <LoadingSpinner label="Memuat rekap tagihan keberangkatan..." fullScreen />;
  }

  if (!departure) {
    return (
      <div className="p-8 text-center text-slate-500">
        <p className="font-bold text-slate-800">Keberangkatan Tidak Ditemukan</p>
        <Link href="/resume" className="text-xs text-emerald-600 underline mt-2 inline-block">
          Kembali ke Resume
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      {/* Top Breadcrumb & Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href="/resume"
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-white rounded-xl border border-slate-200 shadow-2xs transition-all flex items-center gap-1.5 text-xs font-bold"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Kembali ke Resume</span>
          </Link>
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">
              {departure.name}
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Keberangkatan: {departure.departure_date} • Batas Pelunasan: {departure.payment_deadline} • Kapasitas: {departure.pax_count}/{departure.capacity} Jamaah
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={handleExportManifest}
            disabled={exportingManifest}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-900/20 flex items-center gap-2 disabled:opacity-50 transition-all"
          >
            <Download className="w-4 h-4" />
            <span>{exportingManifest ? 'Mengunduh...' : 'Export Manifest'}</span>
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-2xs">
          <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Total Pax</p>
          <p className="text-xl font-black text-slate-900 mt-1">{departure.pax_count} Jamaah</p>
        </div>
        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-2xs">
          <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Total Tagihan Program</p>
          <p className="text-xl font-black text-slate-900 mt-1">{formatRupiah(departure.total_tagihan)}</p>
        </div>
        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-2xs">
          <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Total Pembayaran Masuk</p>
          <p className="text-xl font-black text-emerald-600 mt-1">{formatRupiah(departure.total_pembayaran)}</p>
        </div>
        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-2xs">
          <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Sisa Kekurangan</p>
          <p className="text-xl font-black text-rose-600 mt-1">{formatRupiah(departure.total_kekurangan)}</p>
        </div>
      </div>

      {/* Participant Finance Recap Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-slate-800 text-sm">Rekap Tagihan Per Peserta ({participants.length})</h3>
            <p className="text-xs text-slate-500">Rincian status tagihan dan pembayaran masing-masing jamaah dalam keberangkatan ini.</p>
          </div>
        </div>

        {participants.length === 0 ? (
          <div className="p-12 text-center text-slate-500 space-y-2">
            <p className="font-bold text-slate-800 text-sm">Belum Ada Peserta Terdaftar</p>
            <p className="text-xs text-slate-400">Daftarkan jamaah dari database ke paket keberangkatan ini.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="sticky top-0 bg-slate-50 border-b border-slate-200 text-slate-600 font-bold z-10">
                <tr>
                  <th className="py-3 px-3.5 text-center w-12">No</th>
                  <th className="py-3 px-3.5">Nama Jamaah</th>
                  <th className="py-3 px-3.5">ID Jamaah</th>
                  <th className="py-3 px-3.5">Tipe Kamar</th>
                  <th className="py-3 px-3.5 text-right">Harga Program</th>
                  <th className="py-3 px-3.5 text-right">Diskon</th>
                  <th className="py-3 px-3.5 text-right font-bold">Total Tagihan</th>
                  <th className="py-3 px-3.5 text-right font-bold text-emerald-700">Total Pembayaran</th>
                  <th className="py-3 px-3.5 text-right font-bold text-rose-700">Kekurangan</th>
                  <th className="py-3 px-3.5 text-center">Status</th>
                  <th className="py-3 px-3.5 text-center w-24">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-normal">
                {participants.map((p, idx) => (
                  <tr 
                    key={p.id}
                    className="hover:bg-slate-50/80 transition-colors group cursor-pointer"
                    onClick={() => setSelectedJamaahId(p.jamaah_id)}
                  >
                    <td className="py-3 px-3.5 text-center font-mono text-slate-400">
                      {idx + 1}
                    </td>
                    <td className="py-3 px-3.5 font-bold text-slate-900 group-hover:text-emerald-700">
                      {p.nama_jamaah}
                    </td>
                    <td className="py-3 px-3.5 font-mono text-slate-500">
                      {p.id_jamaah}
                    </td>
                    <td className="py-3 px-3.5 text-slate-600">
                      <Badge variant="neutral">{p.room_type}</Badge>
                    </td>
                    <td className="py-3 px-3.5 text-right font-mono text-slate-700">
                      {formatRupiah(p.harga_program)}
                    </td>
                    <td className="py-3 px-3.5 text-right font-mono text-slate-400">
                      {formatRupiah(p.diskon)}
                    </td>
                    <td className="py-3 px-3.5 text-right font-mono font-bold text-slate-900">
                      {formatRupiah(p.total_tagihan)}
                    </td>
                    <td className="py-3 px-3.5 text-right font-mono font-bold text-emerald-600">
                      {formatRupiah(p.total_pembayaran)}
                    </td>
                    <td className="py-3 px-3.5 text-right font-mono font-bold text-rose-600">
                      {formatRupiah(p.kekurangan)}
                    </td>
                    <td className="py-3 px-3.5 text-center">
                      {p.status === 'LUNAS' && <Badge variant="success">LUNAS</Badge>}
                      {p.status === 'BELUM_LUNAS' && <Badge variant="warning">BELUM LUNAS</Badge>}
                      {p.status === 'BELUM_BAYAR' && <Badge variant="danger">BELUM BAYAR</Badge>}
                    </td>
                    <td className="py-3 px-3.5 text-center" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => setSelectedJamaahId(p.jamaah_id)}
                        className="px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-lg text-xs font-bold flex items-center gap-1 shadow-2xs transition-all mx-auto"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Detail</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Unified Jamaah Detail Modal */}
      <UnifiedJamaahDetailModal
        isOpen={!!selectedJamaahId}
        onClose={() => {
          setSelectedJamaahId(null);
          loadData();
        }}
        jamaahId={selectedJamaahId}
      />
    </div>
  );
}
