'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { 
  ArrowLeft, 
  Package as PackageIcon, 
  Users, 
  UserPlus, 
  Plane, 
  Calendar, 
  Hotel, 
  AlertTriangle, 
  CheckCircle2, 
  ShieldAlert, 
  DollarSign, 
  ExternalLink,
  FileSpreadsheet,
  ShieldCheck,
  Download,
  Boxes
} from 'lucide-react';
import { Package, PackageParticipant, Jamaah, PIC } from '@/types/database.types';
import { Badge } from '@/components/ui/Badge';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { Modal } from '@/components/ui/Modal';
import { evaluatePassportHealth } from '@/lib/passport-health';

export default function PackageDetailPage() {
  const params = useParams();
  const pkgId = params.id as string;

  const [pkg, setPkg] = useState<Package | null>(null);
  const [participants, setParticipants] = useState<PackageParticipant[]>([]);
  const [allJamaah, setAllJamaah] = useState<Jamaah[]>([]);
  const [pics, setPics] = useState<PIC[]>([]);
  const [loading, setLoading] = useState(true);

  // Add Participant Modal State
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [selectedJamaahId, setSelectedJamaahId] = useState('');
  const [selectedPicId, setSelectedPicId] = useState('');
  const [b2bPrice, setB2bPrice] = useState<number>(0);
  const [sellingPrice, setSellingPrice] = useState<number>(0);
  const [participantNotes, setParticipantNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchPackageData = async () => {
    setLoading(true);
    try {
      const [resPkg, resJamaah, resPics] = await Promise.all([
        fetch(`/api/packages/${pkgId}`).then(r => r.json()),
        fetch('/api/jamaah').then(r => r.json()),
        fetch('/api/pics').then(r => r.json()),
      ]);

      setPkg(resPkg);
      setParticipants(resPkg?.participants || []);
      setAllJamaah(resJamaah || []);
      setPics(resPics || []);
      if (resPkg) {
        setB2bPrice(resPkg.b2b_price);
        setSellingPrice(resPkg.reference_price);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (pkgId) fetchPackageData();
  }, [pkgId]);

  const handleAddParticipant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedJamaahId) return;

    setSubmitting(true);
    try {
      const res = await fetch('/api/participants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          package_id: pkgId,
          jamaah_id: selectedJamaahId,
          pic_id: selectedPicId || null,
          b2b_price: b2bPrice,
          selling_price: sellingPrice,
          notes: participantNotes,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menambahkan peserta');

      setAddModalOpen(false);
      setSelectedJamaahId('');
      fetchPackageData();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <LoadingSpinner label="Memuat data paket dan peserta..." fullScreen />;
  if (!pkg) return <EmptyState title="Paket Tidak Ditemukan" description="Paket keberangkatan tidak ada di database." />;

  const formatRupiah = (num: number) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(num);
  };

  // Filter out jamaah who are already in this package
  const existingJamaahIds = participants.map(p => p.jamaah_id);
  const availableJamaah = allJamaah.filter(j => !existingJamaahIds.includes(j.id));

  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/paket"
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-white rounded-xl border border-slate-200 shadow-2xs transition-all"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">{pkg.package_name}</h1>
              <Badge variant={pkg.status === 'OPEN' ? 'success' : 'neutral'}>{pkg.status}</Badge>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Jadwal: {pkg.departure_date} s/d {pkg.return_date} • Kuota: {participants.length} / {pkg.quota} Jamaah
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/perlengkapan/penyerahan"
            className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all"
          >
            <Boxes className="w-4 h-4 text-emerald-600" />
            <span>Perlengkapan</span>
          </Link>
          <Link
            href={`/finance/laporan-paket?package_id=${pkgId}`}
            className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            <span>Laporan Keuangan</span>
          </Link>
          <button
            type="button"
            onClick={() => setAddModalOpen(true)}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-900/20 flex items-center gap-2 transition-all"
          >
            <UserPlus className="w-4 h-4" />
            <span>Tambah Peserta ke Paket</span>
          </button>
        </div>
      </div>

      {/* Package Specs Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-[11px] text-slate-400 font-semibold block">Maskapai & Rute</span>
          <span className="text-xs font-bold text-slate-900 mt-1 block">{pkg.airline || '-'}</span>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-[11px] text-slate-400 font-semibold block">Hotel Makkah / Madinah</span>
          <span className="text-xs font-bold text-slate-900 mt-1 block truncate">{pkg.makkah_hotel || '-'}</span>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-[11px] text-slate-400 font-semibold block">Harga Acuan B2B</span>
          <span className="text-xs font-mono font-bold text-slate-800 mt-1 block">{formatRupiah(pkg.b2b_price)}</span>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-[11px] text-slate-400 font-semibold block">Harga Referensi Jual</span>
          <span className="text-xs font-mono font-bold text-emerald-800 mt-1 block">{formatRupiah(pkg.reference_price)}</span>
        </div>
      </div>

      {/* Package Finance Summary Cards */}
      {(() => {
        const totalInvoice = participants.reduce((sum, p) => sum + (p.invoice?.total_amount || p.selling_price || 0), 0);
        const totalPaid = participants.reduce((sum, p) => sum + (p.invoice?.total_paid || 0), 0);
        const totalOutstanding = participants.reduce((sum, p) => sum + (p.invoice?.outstanding || p.selling_price || 0), 0);
        const lunasCount = participants.filter(p => p.invoice?.status === 'PAID').length;
        const unpaidCount = participants.filter(p => p.invoice?.status === 'UNPAID' || p.invoice?.status === 'PARTIAL').length;

        return (
          <div className="p-4 bg-gradient-to-r from-emerald-50 via-teal-50/40 to-slate-50 border border-emerald-200/80 rounded-2xl shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
              <div className="flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-emerald-700" />
                <h3 className="font-bold text-emerald-950 text-sm">Ringkasan Keuangan Paket</h3>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs font-semibold text-emerald-800">
                  {lunasCount} Lunas • {unpaidCount} Belum Lunas
                </span>
                <Link
                  href={`/finance/laporan-paket?package_id=${pkgId}`}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-sm flex items-center gap-1.5 transition-all"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  <span>Buka Laporan Keuangan Lengkap</span>
                </Link>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div className="p-3 bg-white border border-emerald-200/60 rounded-xl">
                <span className="text-slate-500 font-medium block">Total Tagihan Paket</span>
                <span className="text-base font-bold text-slate-900 mt-0.5 block font-mono">
                  {formatRupiah(totalInvoice)}
                </span>
              </div>
              <div className="p-3 bg-white border border-emerald-200/60 rounded-xl">
                <span className="text-slate-500 font-medium block">Total Pembayaran Masuk</span>
                <span className="text-base font-bold text-emerald-700 mt-0.5 block font-mono">
                  {formatRupiah(totalPaid)}
                </span>
              </div>
              <div className="p-3 bg-white border border-emerald-200/60 rounded-xl">
                <span className="text-slate-500 font-medium block">Sisa Piutang (Outstanding)</span>
                <span className="text-base font-bold text-rose-700 mt-0.5 block font-mono">
                  {formatRupiah(totalOutstanding)}
                </span>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Package Document Completeness Widget */}
      {(() => {
        const total = participants.length;
        const passportCount = participants.filter(p => p.jamaah?.documents?.some(d => d.document_type === 'PASSPORT' && d.is_current)).length;
        const ktpCount = participants.filter(p => p.jamaah?.documents?.some(d => d.document_type === 'KTP' && d.is_current)).length;
        const kkCount = participants.filter(p => p.jamaah?.documents?.some(d => d.document_type === 'KK' && d.is_current)).length;
        const vaksinCount = participants.filter(p => p.jamaah?.documents?.some(d => d.document_type === 'VAKSIN' && d.is_current)).length;
        const bukuNikahCount = participants.filter(p => p.jamaah?.documents?.some(d => d.document_type === 'BUKU_NIKAH' && d.is_current)).length;

        return (
          <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-2xs space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-600" />
                <h3 className="font-bold text-slate-900 text-sm">Status Kelengkapan Dokumen Paket</h3>
              </div>
              <div className="flex items-center gap-2">
                <Link
                  href={`/manifest?package_id=${pkgId}`}
                  className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold shadow-2xs flex items-center gap-1.5 transition-all"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  <span>Export Manifest XLSX</span>
                </Link>
                <Link
                  href={`/dokumen/download?package_id=${pkgId}`}
                  className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download ZIP Dokumen</span>
                </Link>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs">
              <Link href={`/dokumen/arsip?packageId=${pkgId}&documentType=PASSPORT`} className="p-2.5 bg-slate-50 hover:bg-emerald-50/60 border border-slate-200 rounded-xl transition-all block group">
                <span className="text-slate-500 text-[11px] block font-medium">Paspor Asli</span>
                <span className="text-sm font-bold text-slate-900 font-mono mt-0.5 block group-hover:text-emerald-700">
                  {passportCount} / {total} Pax
                </span>
              </Link>
              <Link href={`/dokumen/arsip?packageId=${pkgId}&documentType=KTP`} className="p-2.5 bg-slate-50 hover:bg-emerald-50/60 border border-slate-200 rounded-xl transition-all block group">
                <span className="text-slate-500 text-[11px] block font-medium">KTP Elektronik</span>
                <span className="text-sm font-bold text-slate-900 font-mono mt-0.5 block group-hover:text-emerald-700">
                  {ktpCount} / {total} Pax
                </span>
              </Link>
              <Link href={`/dokumen/arsip?packageId=${pkgId}&documentType=KK`} className="p-2.5 bg-slate-50 hover:bg-emerald-50/60 border border-slate-200 rounded-xl transition-all block group">
                <span className="text-slate-500 text-[11px] block font-medium">Kartu Keluarga</span>
                <span className="text-sm font-bold text-slate-900 font-mono mt-0.5 block group-hover:text-emerald-700">
                  {kkCount} / {total} Pax
                </span>
              </Link>
              <Link href={`/dokumen/arsip?packageId=${pkgId}&documentType=VAKSIN`} className="p-2.5 bg-slate-50 hover:bg-emerald-50/60 border border-slate-200 rounded-xl transition-all block group">
                <span className="text-slate-500 text-[11px] block font-medium">Sertifikat Vaksin</span>
                <span className="text-sm font-bold text-slate-900 font-mono mt-0.5 block group-hover:text-emerald-700">
                  {vaksinCount} / {total} Pax
                </span>
              </Link>
              <Link href={`/dokumen/arsip?packageId=${pkgId}&documentType=BUKU_NIKAH`} className="p-2.5 bg-slate-50 hover:bg-emerald-50/60 border border-slate-200 rounded-xl transition-all block group">
                <span className="text-slate-500 text-[11px] block font-medium">Buku Nikah / Akta</span>
                <span className="text-sm font-bold text-slate-900 font-mono mt-0.5 block group-hover:text-emerald-700">
                  {bukuNikahCount} / {total} Pax
                </span>
              </Link>
            </div>
          </div>
        );
      })()}

      {/* Participant Roster Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden space-y-3">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-emerald-600" />
            <h3 className="font-bold text-slate-900 text-sm">Daftar Peserta Manifest Paket ({participants.length})</h3>
          </div>
          <span className="text-xs text-slate-400">Harga jual jamaah dapat berbeda antar peserta</span>
        </div>

        {participants.length === 0 ? (
          <EmptyState
            title="Belum Ada Peserta Terdaftar"
            description="Paket ini belum memiliki peserta jamaah. Tambahkan peserta dari database master jamaah."
            action={
              <button
                onClick={() => setAddModalOpen(true)}
                className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-semibold"
              >
                Tambah Peserta Sekarang
              </button>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px]">
                <tr>
                  <th className="p-3.5">Nama Jamaah (Manifest)</th>
                  <th className="p-3.5">Validitas Paspor</th>
                  <th className="p-3.5">PIC / Mitra</th>
                  <th className="p-3.5 text-right">Harga Jual</th>
                  <th className="p-3.5 text-right">Total Tagihan</th>
                  <th className="p-3.5 text-right">Terbayar</th>
                  <th className="p-3.5 text-right">Sisa Tagihan</th>
                  <th className="p-3.5 text-center">Status Keuangan</th>
                  <th className="p-3.5 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {participants.map((part) => {
                  const j = part.jamaah;
                  const passportHealth = j ? evaluatePassportHealth(j, pkg.departure_date) : null;
                  const inv = part.invoice;

                  return (
                    <tr key={part.id} className="hover:bg-slate-50/70">
                      <td className="p-3.5 font-bold text-slate-900">
                        <Link href={`/jamaah/${part.jamaah_id}`} className="hover:text-emerald-700">
                          {j?.passport_name || j?.identity_name || 'Jamaah'}
                        </Link>
                        {j?.passport_number && (
                          <span className="text-[11px] text-slate-400 font-mono block">{j.passport_number}</span>
                        )}
                      </td>
                      <td className="p-3.5">
                        {passportHealth?.status === 'VALID' && (
                          <Badge variant="success">Valid</Badge>
                        )}
                        {passportHealth?.status === 'MISSING' && (
                          <Badge variant="warning">Missing</Badge>
                        )}
                        {passportHealth?.status === 'EXPIRING_SOON' && (
                          <Badge variant="danger" title={passportHealth.message}>
                            &lt;6 Bln
                          </Badge>
                        )}
                        {passportHealth?.status === 'EXPIRED' && (
                          <Badge variant="danger">Expired</Badge>
                        )}
                      </td>
                      <td className="p-3.5 text-slate-700">
                        {part.pic?.name || <span className="text-slate-400 italic">Langsung</span>}
                      </td>
                      <td className="p-3.5 text-right font-mono font-medium text-slate-700">
                        {formatRupiah(part.selling_price)}
                      </td>
                      <td className="p-3.5 text-right font-mono font-bold text-slate-900">
                        {formatRupiah(inv?.total_amount || part.selling_price)}
                      </td>
                      <td className="p-3.5 text-right font-mono font-semibold text-emerald-700">
                        {formatRupiah(inv?.total_paid || 0)}
                      </td>
                      <td className="p-3.5 text-right font-mono font-bold text-rose-700">
                        {formatRupiah(inv?.outstanding || part.selling_price)}
                      </td>
                      <td className="p-3.5 text-center">
                        {inv?.status === 'PAID' && <Badge variant="success">Lunas</Badge>}
                        {inv?.status === 'PARTIAL' && <Badge variant="warning">Cicilan</Badge>}
                        {inv?.status === 'UNPAID' && <Badge variant="danger">Belum Bayar</Badge>}
                        {inv?.status === 'OVERPAID' && <Badge variant="brand">Lebih Bayar</Badge>}
                        {!inv?.status && <Badge variant="neutral">UNPAID</Badge>}
                      </td>
                      <td className="p-3.5 text-center">
                        <Link
                          href={`/jamaah/${part.jamaah_id}`}
                          className="px-2.5 py-1 text-slate-600 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg text-xs font-semibold inline-flex items-center gap-1"
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
        )}
      </div>

      {/* Add Participant Modal */}
      <Modal
        isOpen={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        title="Daftarkan Peserta ke Paket Ini"
        subtitle={`Pilih jamaah dari Master Database untuk dimasukkan ke dalam paket ${pkg.package_name}`}
        maxWidth="lg"
      >
        <form onSubmit={handleAddParticipant} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Pilih Master Jamaah <span className="text-rose-500">*</span>
            </label>
            <select
              value={selectedJamaahId}
              onChange={(e) => setSelectedJamaahId(e.target.value)}
              required
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:outline-hidden focus:border-emerald-500"
            >
              <option value="">-- Pilih Jamaah dari Master Database --</option>
              {availableJamaah.map((j) => (
                <option key={j.id} value={j.id}>
                  {j.identity_name || j.passport_name} {j.passport_number ? `(Paspor: ${j.passport_number})` : '(Tanpa Paspor)'}
                </option>
              ))}
            </select>
            {availableJamaah.length === 0 && (
              <p className="text-[11px] text-amber-600 mt-1">
                Semua jamaah di database sudah terdaftar pada paket ini, atau belum ada jamaah master.
              </p>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Pilih PIC / Penanggung Jawab (Opsional)
            </label>
            <select
              value={selectedPicId}
              onChange={(e) => setSelectedPicId(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-hidden focus:border-emerald-500"
            >
              <option value="">-- Tanpa PIC / Langsung Travel --</option>
              {pics.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Harga B2B Peserta (Rp)</label>
              <input
                type="number"
                value={b2bPrice}
                onChange={(e) => setB2bPrice(Number(e.target.value))}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-800"
              />
              <span className="text-[10px] text-slate-400 mt-0.5 block">{formatRupiah(b2bPrice)}</span>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Harga Jual Jamaah (Rp) <span className="text-rose-500">*</span></label>
              <input
                type="number"
                required
                value={sellingPrice}
                onChange={(e) => setSellingPrice(Number(e.target.value))}
                className="w-full px-3 py-2 bg-emerald-50/50 border border-emerald-300 rounded-xl text-xs font-mono font-bold text-emerald-950"
              />
              <span className="text-[10px] text-emerald-600 mt-0.5 block font-semibold">{formatRupiah(sellingPrice)}</span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Catatan</label>
            <textarea
              value={participantNotes}
              onChange={(e) => setParticipantNotes(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800"
            />
          </div>

          <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setAddModalOpen(false)}
              className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-xl"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={submitting || !selectedJamaahId}
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-md shadow-emerald-900/20 disabled:opacity-50"
            >
              {submitting ? 'Menyimpan...' : 'Simpan Peserta'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
