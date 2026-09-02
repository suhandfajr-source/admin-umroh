'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  Users, 
  Package, 
  UserCheck, 
  Plane, 
  Wallet, 
  Receipt, 
  CreditCard, 
  Search, 
  Filter, 
  UploadCloud, 
  UserPlus, 
  Eye, 
  CheckCircle2, 
  Clock, 
  AlertTriangle,
  ArrowRight,
  ExternalLink,
  ChevronRight,
  ChevronDown,
  Building2,
  Calendar,
  Layers,
  ShieldCheck,
  FileSpreadsheet
} from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { formatRupiah } from '@/lib/currency';
import { UnifiedJamaahDetailModal } from '@/components/jamaah/UnifiedJamaahDetailModal';

export default function DashboardPage() {
  const [activeTab, setActiveTab] = useState<'jamaah' | 'keberangkatan' | 'pic'>('jamaah');
  const [loading, setLoading] = useState(true);

  // Data States
  const [summary, setSummary] = useState<any>(null);
  const [rows, setRows] = useState<any[]>([]);
  const [packages, setPackages] = useState<any[]>([]);
  const [pics, setPics] = useState<any[]>([]);
  const [packagesDashboard, setPackagesDashboard] = useState<any[]>([]);
  const [picsDashboard, setPicsDashboard] = useState<any[]>([]);

  // Filters for Jamaah Tab
  const [search, setSearch] = useState('');
  const [selectedPackageId, setSelectedPackageId] = useState('');
  const [selectedPicId, setSelectedPicId] = useState('');
  const [selectedPayStatus, setSelectedPayStatus] = useState('');
  const [selectedDocStatus, setSelectedDocStatus] = useState('');

  // Selected Jamaah for Detail Modal
  const [selectedJamaahId, setSelectedJamaahId] = useState<string | null>(null);

  // Expanded PIC details on PIC tab
  const [expandedPicId, setExpandedPicId] = useState<string | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (selectedPackageId) params.set('package_id', selectedPackageId);
      if (selectedPicId) params.set('pic_id', selectedPicId);
      if (selectedPayStatus) params.set('payment_status', selectedPayStatus);
      if (selectedDocStatus) params.set('doc_status', selectedDocStatus);

      const res = await fetch(`/api/dashboard/jamaah?${params.toString()}`);
      if (!res.ok) throw new Error('Gagal memuat data dashboard');
      const json = await res.json();
      setSummary(json.summary || null);
      setRows(json.data || []);
      setPackages(json.packages || []);
      setPics(json.pics || []);
      setPackagesDashboard(json.packages_dashboard || []);
      setPicsDashboard(json.pics_dashboard || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedPackageId, selectedPicId, selectedPayStatus, selectedDocStatus]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadData();
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      {/* Header & Primary Action Buttons */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Dashboard Operasional</h1>
          <p className="text-xs text-slate-500 mt-1">
            Monitoring menyeluruh operasional jamaah, kesiapan paket keberangkatan, dan performa PIC.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Link
            href="/jamaah/new"
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-900/20 flex items-center gap-2 transition-all"
          >
            <UserPlus className="w-4 h-4" />
            <span>+ Tambah Jamaah</span>
          </Link>
          <Link
            href="/jamaah/upload"
            className="px-4 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded-xl text-xs font-bold shadow-2xs flex items-center gap-2 transition-all"
          >
            <UploadCloud className="w-4 h-4 text-slate-500" />
            <span>Upload Dokumen</span>
          </Link>
        </div>
      </div>

      {/* Executive Metric KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Jamaah */}
        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-2xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total Jamaah Aktif</p>
            <p className="text-2xl font-black text-slate-900 mt-1">{summary?.total_jamaah || 0} <span className="text-xs font-semibold text-slate-400">Pax</span></p>
            <p className="text-[11px] text-emerald-600 font-semibold mt-0.5">
              {summary?.lunas_count || 0} Lunas • {summary?.belum_lunas_count || 0} Belum Lunas
            </p>
          </div>
          <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <Users className="w-5 h-5" />
          </div>
        </div>

        {/* Paket Keberangkatan */}
        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-2xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Paket Keberangkatan</p>
            <p className="text-2xl font-black text-slate-900 mt-1">{summary?.total_packages || 0} <span className="text-xs font-semibold text-slate-400">Program</span></p>
            <p className="text-[11px] text-sky-600 font-semibold mt-0.5">
              {packagesDashboard.filter(p => (p.days_to_departure || 0) >= 0).length} Keberangkatan Aktif
            </p>
          </div>
          <div className="w-11 h-11 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center">
            <Plane className="w-5 h-5" />
          </div>
        </div>

        {/* Total Terbayar */}
        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-2xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total Dana Masuk</p>
            <p className="text-lg font-black text-emerald-600 mt-1 font-mono">{formatRupiah(summary?.total_pembayaran || 0)}</p>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Dari Omset {formatRupiah(summary?.total_tagihan || 0)}
            </p>
          </div>
          <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <Wallet className="w-5 h-5" />
          </div>
        </div>

        {/* Sisa Piutang */}
        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-2xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Sisa Piutang Jamaah</p>
            <p className="text-lg font-black text-rose-600 mt-1 font-mono">{formatRupiah(summary?.total_kekurangan || 0)}</p>
            <p className="text-[11px] text-slate-500 mt-0.5">
              {summary?.total_tagihan > 0 ? Math.round(((summary.total_tagihan - summary.total_pembayaran) / summary.total_tagihan) * 100) : 0}% belum terbayar
            </p>
          </div>
          <div className="w-11 h-11 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
            <Receipt className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Tab Switcher */}
      <div className="flex items-center gap-1.5 p-1.5 bg-slate-200/80 rounded-2xl w-fit">
        <button
          type="button"
          onClick={() => setActiveTab('jamaah')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'jamaah'
              ? 'bg-white text-slate-900 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Users className="w-4 h-4 text-emerald-600" />
          <span>Ringkasan Jamaah ({rows.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('keberangkatan')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'keberangkatan'
              ? 'bg-white text-slate-900 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Plane className="w-4 h-4 text-sky-600" />
          <span>Per Keberangkatan ({packagesDashboard.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('pic')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'pic'
              ? 'bg-white text-slate-900 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <UserCheck className="w-4 h-4 text-indigo-600" />
          <span>Per PIC / Agen ({picsDashboard.length})</span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: RINGKASAN OPERASIONAL JAMAAH */}
      {/* ========================================================================= */}
      {activeTab === 'jamaah' && (
        <div className="space-y-4">
          {/* Filters Bar */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
              {/* Search Box */}
              <form onSubmit={handleSearchSubmit} className="sm:col-span-4 relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Cari nama, ID, NIK, Paspor, PIC, atau Paket..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                />
              </form>

              {/* Keberangkatan Filter */}
              <div className="sm:col-span-3">
                <select
                  value={selectedPackageId}
                  onChange={(e) => setSelectedPackageId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 font-semibold focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-none"
                >
                  <option value="">Semua Keberangkatan</option>
                  {packages.map((pkg) => (
                    <option key={pkg.id} value={pkg.id}>
                      {pkg.package_name || (pkg as any).name || 'Paket Umrah'} ({pkg.departure_date || 'Tanggal TBD'})
                    </option>
                  ))}
                </select>
              </div>

              {/* Filter PIC */}
              <div className="sm:col-span-2">
                <select
                  value={selectedPicId}
                  onChange={(e) => setSelectedPicId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 font-semibold focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-none"
                >
                  <option value="">Semua PIC</option>
                  {pics.map((pic) => (
                    <option key={pic.id} value={pic.id}>
                      {pic.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Status Pembayaran Filter */}
              <div className="sm:col-span-2">
                <select
                  value={selectedPayStatus}
                  onChange={(e) => setSelectedPayStatus(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 font-semibold focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-none"
                >
                  <option value="">Semua Status Bayar</option>
                  <option value="LUNAS">LUNAS</option>
                  <option value="BELUM_LUNAS">BELUM LUNAS</option>
                  <option value="BELUM_BAYAR">BELUM BAYAR</option>
                </select>
              </div>

              {/* Kelengkapan Dokumen Filter */}
              <div className="sm:col-span-1">
                <select
                  value={selectedDocStatus}
                  onChange={(e) => setSelectedDocStatus(e.target.value)}
                  className="w-full px-2 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 font-semibold focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-none"
                >
                  <option value="">Dokumen</option>
                  <option value="LENGKAP">5/5</option>
                  <option value="BELUM_LENGKAP">&lt;5</option>
                </select>
              </div>
            </div>
          </div>

          {/* Operational Jamaah Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
            {loading ? (
              <div className="py-16">
                <LoadingSpinner label="Memuat daftar operasional jamaah..." />
              </div>
            ) : rows.length === 0 ? (
              <div className="p-12 text-center text-slate-500 space-y-2">
                <p className="font-bold text-slate-800 text-sm">Tidak Ada Data Jamaah Operasional</p>
                <p className="text-xs text-slate-400">
                  {search || selectedPackageId || selectedPicId || selectedPayStatus || selectedDocStatus
                    ? 'Tidak ada peserta yang cocok dengan filter yang dipilih.'
                    : 'Belum ada peserta yang didaftarkan ke paket keberangkatan.'}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="sticky top-0 bg-slate-50 border-b border-slate-200 text-slate-600 font-bold z-10">
                    <tr>
                      <th className="py-3 px-3.5 text-center w-12">No</th>
                      <th className="py-3 px-3.5">Nama Jamaah</th>
                      <th className="py-3 px-3.5">ID Jamaah</th>
                      <th className="py-3 px-3.5">PIC / Agen</th>
                      <th className="py-3 px-3.5">Keberangkatan</th>
                      <th className="py-3 px-3.5 text-right">Total Tagihan</th>
                      <th className="py-3 px-3.5 text-right">Total Pembayaran</th>
                      <th className="py-3 px-3.5 text-right">Kekurangan</th>
                      <th className="py-3 px-3.5 text-center">Status</th>
                      <th className="py-3 px-3.5 text-center">Dokumen</th>
                      <th className="py-3 px-3.5 text-center w-24">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-normal">
                    {rows.map((row, idx) => (
                      <tr 
                        key={row.id} 
                        className="hover:bg-slate-50/80 transition-colors group cursor-pointer"
                        onClick={() => setSelectedJamaahId(row.jamaah_id)}
                      >
                        <td className="py-3 px-3.5 text-center font-mono text-slate-400">
                          {idx + 1}
                        </td>
                        <td className="py-3 px-3.5 font-bold text-slate-900 group-hover:text-emerald-700">
                          {row.nama_jamaah}
                        </td>
                        <td className="py-3 px-3.5 font-mono text-slate-500">
                          {row.id_jamaah}
                        </td>
                        <td className="py-3 px-3.5 text-slate-600">
                          {row.pic_name}
                        </td>
                        <td className="py-3 px-3.5 text-slate-700 font-medium truncate max-w-[180px]" title={row.keberangkatan}>
                          {row.keberangkatan}
                        </td>
                        <td className="py-3 px-3.5 text-right font-mono font-bold text-slate-800">
                          {formatRupiah(row.total_tagihan)}
                        </td>
                        <td className="py-3 px-3.5 text-right font-mono font-bold text-emerald-600">
                          {formatRupiah(row.total_pembayaran)}
                        </td>
                        <td className="py-3 px-3.5 text-right font-mono font-bold text-rose-600">
                          {formatRupiah(row.kekurangan)}
                        </td>
                        <td className="py-3 px-3.5 text-center">
                          {row.status_pembayaran === 'LUNAS' && (
                            <Badge variant="success">LUNAS</Badge>
                          )}
                          {row.status_pembayaran === 'BELUM_LUNAS' && (
                            <Badge variant="warning">BELUM LUNAS</Badge>
                          )}
                          {row.status_pembayaran === 'BELUM_BAYAR' && (
                            <Badge variant="danger">BELUM BAYAR</Badge>
                          )}
                        </td>
                        <td className="py-3 px-3.5 text-center">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold ${
                            row.dokumen_lengkap 
                              ? 'bg-emerald-100 text-emerald-800' 
                              : 'bg-amber-100 text-amber-800'
                          }`}>
                            {row.dokumen_label}
                          </span>
                        </td>
                        <td className="py-3 px-3.5 text-center" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => setSelectedJamaahId(row.jamaah_id)}
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

            {/* Table Footer */}
            {!loading && rows.length > 0 && (
              <div className="p-3.5 bg-slate-50 border-t border-slate-200 text-xs text-slate-500 flex flex-col sm:flex-row items-center justify-between gap-2">
                <span>Menampilkan {rows.length} jamaah operasional</span>
                <div className="flex items-center gap-4 font-mono font-bold text-slate-700">
                  <span>Total Tagihan: {formatRupiah(rows.reduce((acc, r) => acc + (r.total_tagihan || 0), 0))}</span>
                  <span>Total Terbayar: {formatRupiah(rows.reduce((acc, r) => acc + (r.total_pembayaran || 0), 0))}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: DASHBOARD PER KEBERANGKATAN (PAKET) */}
      {/* ========================================================================= */}
      {activeTab === 'keberangkatan' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900">Monitoring Paket Keberangkatan</h2>
              <p className="text-xs text-slate-500">Kesiapan okupansi, dokumen, dan finansial per program umroh.</p>
            </div>
            <Link
              href="/paket"
              className="text-xs font-bold text-emerald-600 hover:text-emerald-700 flex items-center gap-1"
            >
              <span>Kelola Semua Paket</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {loading ? (
            <div className="py-16 bg-white rounded-2xl border border-slate-200 shadow-2xs">
              <LoadingSpinner label="Memuat dashboard keberangkatan..." />
            </div>
          ) : packagesDashboard.length === 0 ? (
            <div className="p-12 text-center text-slate-500 bg-white rounded-2xl border border-slate-200 shadow-2xs space-y-2">
              <p className="font-bold text-slate-800 text-sm">Belum Ada Paket Keberangkatan</p>
              <p className="text-xs text-slate-400">Silakan buat paket umroh baru terlebih dahulu.</p>
              <Link
                href="/paket"
                className="inline-block mt-2 px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold"
              >
                + Buat Paket Umroh
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {packagesDashboard.map((pkg) => {
                const days = pkg.days_to_departure;
                const isDeparted = days !== null && days < 0;
                const isUrgent = days !== null && days >= 0 && days <= 14;

                return (
                  <div 
                    key={pkg.id} 
                    className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-5 space-y-4 hover:border-slate-300 transition-all flex flex-col justify-between"
                  >
                    {/* Header Card */}
                    <div className="space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-bold text-slate-900 text-base">{pkg.package_name}</h3>
                            <Badge variant={pkg.status === 'OPEN' ? 'success' : 'neutral'}>
                              {pkg.status}
                            </Badge>
                          </div>
                          <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1.5">
                            <span>✈️ {pkg.airline}</span>
                            <span>•</span>
                            <span>🏨 Makkah: {pkg.makkah_hotel}</span>
                          </p>
                        </div>

                        {/* Countdown Badge */}
                        <div className="shrink-0 text-right">
                          {isDeparted ? (
                            <span className="px-2.5 py-1 bg-slate-100 text-slate-600 rounded-lg text-[11px] font-bold">
                              Sudah Berangkat
                            </span>
                          ) : isUrgent ? (
                            <span className="px-2.5 py-1 bg-rose-100 text-rose-700 rounded-lg text-[11px] font-bold flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              <span>{days} Hari Lagi!</span>
                            </span>
                          ) : days !== null ? (
                            <span className="px-2.5 py-1 bg-sky-100 text-sky-700 rounded-lg text-[11px] font-bold">
                              {days} Hari Lagi
                            </span>
                          ) : null}
                        </div>
                      </div>

                      {/* Dates Box */}
                      <div className="flex items-center gap-4 text-xs text-slate-600 bg-slate-50 p-2.5 rounded-xl">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          <span>Berangkat: <strong>{pkg.departure_date}</strong></span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span>Pulang: <strong>{pkg.return_date}</strong></span>
                        </div>
                      </div>
                    </div>

                    {/* Occupancy & Sizing Progress */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-500 font-medium">Okupansi Kuota Peserta:</span>
                        <span className="font-bold text-slate-900">
                          {pkg.registered_pax} / {pkg.quota} Pax ({pkg.occupancy_pct}%)
                        </span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                        <div 
                          className={`h-full rounded-full transition-all duration-300 ${
                            pkg.occupancy_pct >= 90 ? 'bg-emerald-500' : 'bg-sky-500'
                          }`}
                          style={{ width: `${pkg.occupancy_pct}%` }}
                        />
                      </div>
                    </div>

                    {/* Financial Matrix */}
                    <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-100 space-y-2">
                      <div className="grid grid-cols-3 gap-2 text-center text-xs">
                        <div className="bg-white p-2 rounded-lg border border-slate-200">
                          <p className="text-[10px] text-slate-400 font-bold uppercase">Total Omset</p>
                          <p className="font-mono font-bold text-slate-900 mt-0.5">{formatRupiah(pkg.total_tagihan)}</p>
                        </div>
                        <div className="bg-white p-2 rounded-lg border border-slate-200">
                          <p className="text-[10px] text-slate-400 font-bold uppercase">Terbayar</p>
                          <p className="font-mono font-bold text-emerald-600 mt-0.5">{formatRupiah(pkg.total_pembayaran)}</p>
                        </div>
                        <div className="bg-white p-2 rounded-lg border border-slate-200">
                          <p className="text-[10px] text-slate-400 font-bold uppercase">Sisa Piutang</p>
                          <p className="font-mono font-bold text-rose-600 mt-0.5">{formatRupiah(pkg.total_kekurangan)}</p>
                        </div>
                      </div>

                      {/* Payment Progress Bar */}
                      <div className="space-y-1 pt-1">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-slate-500">Progress Pelunasan:</span>
                          <span className="font-bold text-slate-700">{pkg.paid_pct}% Terbayar ({pkg.lunas_count} Lunas / {pkg.belum_lunas_count} Belum)</span>
                        </div>
                        <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                          <div 
                            className="bg-emerald-600 h-full rounded-full transition-all duration-300"
                            style={{ width: `${pkg.paid_pct}%` }}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Action Buttons Footer */}
                    <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100">
                      <Link
                        href={`/paket/${pkg.id}`}
                        className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all"
                      >
                        Daftar Peserta
                      </Link>

                      <div className="flex items-center gap-2">
                        <Link
                          href={`/manifest?packageId=${pkg.id}`}
                          className="px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded-xl text-xs font-bold shadow-2xs flex items-center gap-1.5 transition-all"
                        >
                          <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Manifest</span>
                        </Link>
                        <Link
                          href={`/paket/${pkg.id}/command-center`}
                          className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-1.5 transition-all"
                        >
                          <ShieldCheck className="w-3.5 h-3.5" />
                          <span>Command Center</span>
                        </Link>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: DASHBOARD PER PIC / AGEN */}
      {/* ========================================================================= */}
      {activeTab === 'pic' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900">Monitoring PIC & Koordinator Rombongan</h2>
              <p className="text-xs text-slate-500">Performa setoran, rekapitulasi jamaah, dan piutang per PIC/Agen.</p>
            </div>
            <Link
              href="/pic"
              className="text-xs font-bold text-emerald-600 hover:text-emerald-700 flex items-center gap-1"
            >
              <span>Kelola Master PIC</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {loading ? (
            <div className="py-16 bg-white rounded-2xl border border-slate-200 shadow-2xs">
              <LoadingSpinner label="Memuat dashboard PIC..." />
            </div>
          ) : picsDashboard.length === 0 ? (
            <div className="p-12 text-center text-slate-500 bg-white rounded-2xl border border-slate-200 shadow-2xs space-y-2">
              <p className="font-bold text-slate-800 text-sm">Belum Ada Data PIC / Agen</p>
              <p className="text-xs text-slate-400">Silakan buat master PIC terlebih dahulu.</p>
              <Link
                href="/pic"
                className="inline-block mt-2 px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold"
              >
                + Tambah PIC / Agen
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {picsDashboard.map((pic) => {
                const isExpanded = expandedPicId === pic.id;

                return (
                  <div 
                    key={pic.id} 
                    className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-5 space-y-4 hover:border-slate-300 transition-all flex flex-col justify-between"
                  >
                    {/* Header PIC */}
                    <div className="space-y-2">
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="font-bold text-slate-900 text-base">{pic.name}</h3>
                          <p className="text-xs text-slate-500 mt-0.5">
                            📱 {pic.phone} • {pic.notes}
                          </p>
                        </div>
                        <div className="text-right">
                          <span className="px-2.5 py-1 bg-indigo-50 text-indigo-700 rounded-lg text-xs font-bold">
                            {pic.total_jamaah} Jamaah Binaan
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Financial Matrix */}
                    <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-100 space-y-2">
                      <div className="grid grid-cols-3 gap-2 text-center text-xs">
                        <div className="bg-white p-2 rounded-lg border border-slate-200">
                          <p className="text-[10px] text-slate-400 font-bold uppercase">Total Tagihan</p>
                          <p className="font-mono font-bold text-slate-900 mt-0.5">{formatRupiah(pic.total_tagihan)}</p>
                        </div>
                        <div className="bg-white p-2 rounded-lg border border-slate-200">
                          <p className="text-[10px] text-slate-400 font-bold uppercase">Sudah Disetor</p>
                          <p className="font-mono font-bold text-emerald-600 mt-0.5">{formatRupiah(pic.total_pembayaran)}</p>
                        </div>
                        <div className="bg-white p-2 rounded-lg border border-slate-200">
                          <p className="text-[10px] text-slate-400 font-bold uppercase">Sisa Piutang</p>
                          <p className="font-mono font-bold text-rose-600 mt-0.5">{formatRupiah(pic.total_kekurangan)}</p>
                        </div>
                      </div>

                      {/* Progress Bar */}
                      <div className="space-y-1 pt-1">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-slate-500">Progress Setoran PIC:</span>
                          <span className="font-bold text-slate-700">{pic.paid_pct}% ({pic.lunas_count} Lunas / {pic.belum_lunas_count} Belum)</span>
                        </div>
                        <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                          <div 
                            className="bg-indigo-600 h-full rounded-full transition-all duration-300"
                            style={{ width: `${pic.paid_pct}%` }}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Participants List Preview */}
                    {pic.participants && pic.participants.length > 0 && (
                      <div className="border border-slate-200 rounded-xl overflow-hidden">
                        <button
                          type="button"
                          onClick={() => setExpandedPicId(isExpanded ? null : pic.id)}
                          className="w-full px-3 py-2 bg-slate-50 text-left text-xs font-bold text-slate-700 flex items-center justify-between hover:bg-slate-100 transition-colors"
                        >
                          <span>Rombongan Jamaah ({pic.participants.length})</span>
                          <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                        </button>

                        {isExpanded && (
                          <div className="divide-y divide-slate-100 max-h-48 overflow-y-auto">
                            {pic.participants.map((pax: any) => (
                              <div key={pax.id} className="p-2.5 text-xs flex items-center justify-between hover:bg-slate-50">
                                <div>
                                  <p className="font-bold text-slate-900">{pax.nama}</p>
                                  <p className="text-[11px] text-slate-400">{pax.package_name}</p>
                                </div>
                                <div className="text-right">
                                  <p className="font-mono font-bold text-slate-700">{formatRupiah(pax.total_tagihan)}</p>
                                  <p className="text-[10px] font-semibold text-emerald-600">
                                    {pax.status === 'PAID' ? 'LUNAS' : `Sisa ${formatRupiah(pax.outstanding)}`}
                                  </p>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Action Buttons Footer */}
                    <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100">
                      <Link
                        href={`/finance/pembayaran`}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs transition-all flex items-center gap-1.5"
                      >
                        <CreditCard className="w-3.5 h-3.5" />
                        <span>Input Pembayaran</span>
                      </Link>

                      <Link
                        href={`/pic`}
                        className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5"
                      >
                        <span>Kelola PIC</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

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
