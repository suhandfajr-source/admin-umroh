'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { 
  FileSpreadsheet, 
  Package as PackageIcon, 
  Users, 
  DollarSign, 
  TrendingUp, 
  TrendingDown, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  Filter, 
  ArrowLeft,
  ChevronDown,
  Building2,
  Calendar,
  Download,
  RefreshCw
} from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { formatRupiah } from '@/lib/currency';
import { Package, PackageFinanceReport, PaxFinanceDetail, PicFinanceBreakdown, InvoiceStatus } from '@/types/database.types';

function PackageReportContent() {
  const searchParams = useSearchParams();
  const initialPackageId = searchParams.get('package_id') || '';

  const [packages, setPackages] = useState<Package[]>([]);
  const [selectedPackageId, setSelectedPackageId] = useState(initialPackageId);
  const [report, setReport] = useState<PackageFinanceReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingReport, setLoadingReport] = useState(false);
  const [exporting, setExporting] = useState(false);

  // Filters
  const [picFilter, setPicFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<InvoiceStatus | ''>('');
  const [searchQuery, setSearchQuery] = useState('');

  // Load Package List
  useEffect(() => {
    async function loadPackages() {
      try {
        setLoading(true);
        const res = await fetch('/api/packages');
        if (res.ok) {
          const data: Package[] = await res.json();
          setPackages(data);
          if (data.length > 0) {
            const targetId = initialPackageId && data.some(p => p.id === initialPackageId) 
              ? initialPackageId 
              : data[0].id;
            setSelectedPackageId(targetId);
          }
        }
      } catch (err) {
        console.error('Error fetching packages:', err);
      } finally {
        setLoading(false);
      }
    }
    loadPackages();
  }, [initialPackageId]);

  // Load Report for Selected Package
  useEffect(() => {
    if (!selectedPackageId) return;

    async function loadReport() {
      try {
        setLoadingReport(true);
        const res = await fetch(`/api/finance/reports/package/${selectedPackageId}`);
        if (res.ok) {
          const data: PackageFinanceReport = await res.json();
          setReport(data);
        } else {
          setReport(null);
        }
      } catch (err) {
        console.error('Error fetching package report:', err);
        setReport(null);
      } finally {
        setLoadingReport(false);
      }
    }
    loadReport();
  }, [selectedPackageId]);

  // Filtered Pax Rows
  let filteredPax = report?.pax_details || [];
  if (picFilter) {
    filteredPax = filteredPax.filter(p => p.pic_id === picFilter || (picFilter === 'DIRECT' && !p.pic_id));
  }
  if (statusFilter) {
    filteredPax = filteredPax.filter(p => p.status === statusFilter);
  }
  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    filteredPax = filteredPax.filter(p => 
      p.jamaah_name.toLowerCase().includes(q) || 
      (p.passport_number && p.passport_number.toLowerCase().includes(q))
    );
  }

  // Filtered PIC Breakdowns
  let filteredPics = report?.pic_breakdowns || [];
  if (picFilter) {
    filteredPics = filteredPics.filter(p => p.pic_id === picFilter || (picFilter === 'DIRECT' && !p.pic_id));
  }

  const handleExportFinanceExcel = async () => {
    if (!selectedPackageId) return;
    setExporting(true);
    try {
      const params = new URLSearchParams();
      if (picFilter) params.set('picId', picFilter);
      if (statusFilter) params.set('status', statusFilter);

      const res = await fetch(`/api/finance/export/package/${selectedPackageId}?${params.toString()}`);
      if (!res.ok) throw new Error('Gagal mengekspor laporan keuangan paket');

      const blob = await res.blob();
      const disposition = res.headers.get('Content-Disposition');
      let filename = 'LAPORAN_KEUANGAN_PAKET.xlsx';
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
      alert(err.message || 'Terjadi kesalahan saat download laporan keuangan');
    } finally {
      setExporting(false);
    }
  };

  const renderStatusBadge = (status: InvoiceStatus) => {
    switch (status) {
      case 'PAID':
        return <Badge variant="success">Lunas</Badge>;
      case 'PARTIAL':
        return <Badge variant="warning">Cicilan</Badge>;
      case 'UNPAID':
        return <Badge variant="danger">Belum Bayar</Badge>;
      case 'OVERPAID':
        return <Badge variant="brand">Lebih Bayar</Badge>;
      default:
        return <Badge variant="neutral">{status}</Badge>;
    }
  };

  if (loading) {
    return <LoadingSpinner label="Memuat modul laporan keuangan paket..." />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
            <FileSpreadsheet className="w-7 h-7 text-emerald-600" />
            Laporan Keuangan Per Paket
          </h1>
          <p className="text-slate-500 text-sm mt-0.5">
            Laporan komprehensif 3 tingkat: Ringkasan Paket, Rincian Per Jamaah, dan Rekapitulasi per PIC / TL.
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={handleExportFinanceExcel}
            disabled={exporting || !report}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-900/20 flex items-center gap-2 transition-all"
          >
            {exporting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            <span>Export Excel (.xlsx)</span>
          </button>

          <div className="flex items-center gap-2">
            <select
              value={selectedPackageId}
              onChange={(e) => {
                setSelectedPackageId(e.target.value);
                setPicFilter('');
                setStatusFilter('');
              }}
              className="px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900 shadow-2xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            >
              {packages.map((pkg) => (
                <option key={pkg.id} value={pkg.id}>
                  {pkg.package_name} ({pkg.departure_date})
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {loadingReport ? (
        <div className="p-12 bg-white border border-slate-200 rounded-2xl text-center">
          <LoadingSpinner label="Menghitung laporan finansial paket..." />
        </div>
      ) : !report ? (
        <div className="p-12 bg-white border border-slate-200 rounded-2xl text-center text-slate-400">
          <AlertCircle className="w-10 h-10 mx-auto text-slate-300 mb-2" />
          <p className="font-bold text-slate-700">Tidak ada data untuk paket ini</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* LEVEL 1: PACKAGE SUMMARY DASHBOARD */}
          <div className="p-6 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white rounded-3xl shadow-xl space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-700/80 gap-3">
              <div>
                <span className="text-xs uppercase tracking-wider text-emerald-400 font-bold">Ringkasan Eksekutif Paket</span>
                <h2 className="text-xl font-black mt-0.5">{report.package_name}</h2>
                <p className="text-xs text-slate-400 flex items-center gap-2 mt-1">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  Jadwal: {report.departure_date} s/d {report.return_date}
                </p>
              </div>

              <div className="flex items-center gap-3">
                <div className="px-3.5 py-1.5 bg-slate-800/80 border border-slate-700 rounded-xl text-xs">
                  <span className="text-slate-400 block text-[10px]">Total Jamaah Terdaftar</span>
                  <span className="text-base font-bold text-emerald-400 font-mono">{report.registered_pax} Pax</span>
                </div>
                <div className="px-3.5 py-1.5 bg-slate-800/80 border border-slate-700 rounded-xl text-xs">
                  <span className="text-slate-400 block text-[10px]">Status Kelunasan</span>
                  <span className="text-xs font-semibold text-slate-200">
                    <strong className="text-emerald-400">{report.paid_pax_count} Lunas</strong> • <strong className="text-rose-400">{report.unpaid_pax_count} Belum</strong>
                  </span>
                </div>
              </div>
            </div>

            {/* Financial KPI Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5 text-xs">
              <div className="p-3.5 bg-slate-800/60 border border-slate-700/60 rounded-2xl">
                <span className="text-slate-400 block text-[11px]">Total Nilai B2B</span>
                <span className="text-base font-bold text-slate-100 font-mono mt-1 block">
                  {formatRupiah(report.total_b2b)}
                </span>
                <span className="text-[10px] text-slate-400 mt-0.5 block">
                  Acuan: {formatRupiah(report.b2b_price_per_pax)} / pax
                </span>
              </div>

              <div className="p-3.5 bg-slate-800/60 border border-slate-700/60 rounded-2xl">
                <span className="text-slate-400 block text-[11px]">Total Harga Jual (Kotor)</span>
                <span className="text-base font-bold text-slate-100 font-mono mt-1 block">
                  {formatRupiah(report.total_selling_price)}
                </span>
                <span className="text-[10px] text-slate-400 mt-0.5 block">
                  Sebelum diskon & penyesuaian
                </span>
              </div>

              <div className="p-3.5 bg-slate-800/60 border border-slate-700/60 rounded-2xl">
                <span className="text-slate-400 block text-[11px]">Total Diskon TL / PIC</span>
                <span className="text-base font-bold text-amber-400 font-mono mt-1 block">
                  {formatRupiah(report.total_tl_discount)}
                </span>
                <span className="text-[10px] text-slate-400 mt-0.5 block">
                  Diskon lain: {formatRupiah(report.total_discount)}
                </span>
              </div>

              <div className="p-3.5 bg-slate-800/60 border border-slate-700/60 rounded-2xl">
                <span className="text-slate-400 block text-[11px]">Total Tagihan Bersih</span>
                <span className="text-base font-bold text-emerald-400 font-mono mt-1 block">
                  {formatRupiah(report.total_net_invoice)}
                </span>
                <span className="text-[10px] text-slate-400 mt-0.5 block">
                  Kewajiban riil jamaah
                </span>
              </div>
            </div>

            {/* Bottom Balance Strip */}
            <div className="p-4 bg-slate-800/90 border border-slate-700 rounded-2xl grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
              <div>
                <span className="text-slate-400 block text-[11px] font-medium">Total Pembayaran Masuk</span>
                <span className="text-lg font-black text-emerald-400 font-mono mt-0.5 block">
                  {formatRupiah(report.total_paid)}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px] font-medium">Sisa Kekurangan (Piutang)</span>
                <span className="text-lg font-black text-rose-400 font-mono mt-0.5 block">
                  {formatRupiah(report.total_outstanding)}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px] font-medium">Total Kelebihan Bayar</span>
                <span className="text-lg font-black text-purple-400 font-mono mt-0.5 block">
                  {formatRupiah(report.total_overpayment)}
                </span>
              </div>
            </div>
          </div>

          {/* LEVEL 2: REKAPITULASI PER PIC / TL */}
          <div className="bg-white border border-slate-200/80 rounded-2xl shadow-sm overflow-hidden space-y-3">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-emerald-600" />
                <h3 className="font-bold text-slate-900 text-sm">Rekapitulasi Keuangan Per PIC / TL</h3>
              </div>
              <span className="text-xs text-slate-400">Total {report.pic_breakdowns.length} Kelompok Rombongan</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 uppercase font-semibold border-b border-slate-200/80">
                  <tr>
                    <th className="py-3 px-4">Nama PIC / Koordinator</th>
                    <th className="py-3 px-4 text-center">Jumlah Pax</th>
                    <th className="py-3 px-4 text-right">Total Nilai B2B</th>
                    <th className="py-3 px-4 text-right">Total Harga Jual</th>
                    <th className="py-3 px-4 text-right">Diskon TL / PIC</th>
                    <th className="py-3 px-4 text-right">Tagihan Bersih</th>
                    <th className="py-3 px-4 text-right">Total Dibayar</th>
                    <th className="py-3 px-4 text-right">Sisa Piutang</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredPics.map((pic, idx) => (
                    <tr key={pic.pic_id || idx} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4 font-bold text-slate-900">
                        {pic.pic_name}
                      </td>
                      <td className="py-3 px-4 text-center font-semibold">
                        <span className="px-2.5 py-0.5 bg-slate-100 text-slate-800 rounded-full font-mono">
                          {pic.pax_count} Pax
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-slate-600">
                        {formatRupiah(pic.total_b2b)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-slate-700">
                        {formatRupiah(pic.total_selling)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-semibold text-amber-700">
                        {formatRupiah(pic.total_tl_discount)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">
                        {formatRupiah(pic.total_invoice)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-semibold text-emerald-700">
                        {formatRupiah(pic.total_paid)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-rose-700">
                        {formatRupiah(pic.total_outstanding)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* LEVEL 3: DETAIL PER PAX (TABEL RINCIAN JAMA'AH) */}
          <div className="bg-white border border-slate-200/80 rounded-2xl shadow-sm overflow-hidden space-y-4">
            <div className="p-4 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-emerald-600" />
                <h3 className="font-bold text-slate-900 text-sm">Rincian Finansial Per Jamaah ({filteredPax.length} Peserta)</h3>
              </div>

              {/* Interactive Report Filters */}
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="text"
                  placeholder="Cari Nama Jamaah / Paspor..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:ring-2 focus:ring-emerald-500"
                />

                <select
                  value={picFilter}
                  onChange={(e) => setPicFilter(e.target.value)}
                  className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="">Semua PIC / TL</option>
                  <option value="DIRECT">Direct (Tanpa PIC)</option>
                  {report.pic_breakdowns.filter(p => p.pic_id).map(p => (
                    <option key={p.pic_id} value={p.pic_id!}>{p.pic_name}</option>
                  ))}
                </select>

                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as any)}
                  className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="">Semua Status</option>
                  <option value="PAID">Lunas</option>
                  <option value="PARTIAL">Cicilan</option>
                  <option value="UNPAID">Belum Bayar</option>
                  <option value="OVERPAID">Lebih Bayar</option>
                </select>
              </div>
            </div>

            {filteredPax.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs">
                Tidak ada jamaah yang cocok dengan filter pencarian laporan.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-500 uppercase font-semibold border-b border-slate-200/80">
                    <tr>
                      <th className="py-3 px-3 text-center">No</th>
                      <th className="py-3 px-4">Nama Jamaah</th>
                      <th className="py-3 px-3">PIC / TL</th>
                      <th className="py-3 px-3 text-right">Harga B2B</th>
                      <th className="py-3 px-3 text-right">Harga Jual</th>
                      <th className="py-3 px-3 text-right">Diskon TL</th>
                      <th className="py-3 px-3 text-right">Diskon Lain</th>
                      <th className="py-3 px-3 text-right">Tagihan Bersih</th>
                      <th className="py-3 px-3 text-right">Total Dibayar</th>
                      <th className="py-3 px-3 text-right">Sisa Kekurangan</th>
                      <th className="py-3 px-3 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredPax.map((pax) => (
                      <tr key={pax.participant_id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3 px-3 text-center font-mono text-slate-400">{pax.no}</td>
                        <td className="py-3 px-4 font-bold text-slate-900">
                          <Link href={`/jamaah/${pax.jamaah_id}`} className="hover:text-emerald-600 transition-colors">
                            {pax.jamaah_name}
                          </Link>
                          {pax.passport_number && (
                            <span className="text-[10px] font-mono text-slate-400 block">{pax.passport_number}</span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-slate-600 font-medium">
                          {pax.pic_name}
                        </td>
                        <td className="py-3 px-3 text-right font-mono text-slate-500">
                          {formatRupiah(pax.b2b_price)}
                        </td>
                        <td className="py-3 px-3 text-right font-mono font-medium text-slate-700">
                          {formatRupiah(pax.selling_price)}
                        </td>
                        <td className="py-3 px-3 text-right font-mono font-semibold text-amber-700">
                          {pax.tl_discount > 0 ? `-${formatRupiah(pax.tl_discount)}` : '-'}
                        </td>
                        <td className="py-3 px-3 text-right font-mono text-slate-500">
                          {pax.discount > 0 ? `-${formatRupiah(pax.discount)}` : '-'}
                        </td>
                        <td className="py-3 px-3 text-right font-mono font-bold text-slate-900">
                          {formatRupiah(pax.net_invoice)}
                        </td>
                        <td className="py-3 px-3 text-right font-mono font-semibold text-emerald-700">
                          {formatRupiah(pax.total_paid)}
                        </td>
                        <td className="py-3 px-3 text-right font-mono font-bold text-rose-700">
                          {pax.outstanding > 0 ? formatRupiah(pax.outstanding) : (
                            pax.overpayment > 0 ? <span className="text-purple-700">+{formatRupiah(pax.overpayment)}</span> : 'Rp 0'
                          )}
                        </td>
                        <td className="py-3 px-3 text-center">
                          {renderStatusBadge(pax.status)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-slate-50 font-bold border-t border-slate-200 text-slate-900 text-xs">
                    <tr>
                      <td colSpan={3} className="py-3 px-4">TOTAL PER RINCIAN</td>
                      <td className="py-3 px-3 text-right font-mono text-slate-600">{formatRupiah(report.total_b2b)}</td>
                      <td className="py-3 px-3 text-right font-mono">{formatRupiah(report.total_selling_price)}</td>
                      <td className="py-3 px-3 text-right font-mono text-amber-700">{formatRupiah(report.total_tl_discount)}</td>
                      <td className="py-3 px-3 text-right font-mono text-slate-600">{formatRupiah(report.total_discount)}</td>
                      <td className="py-3 px-3 text-right font-mono text-emerald-800">{formatRupiah(report.total_net_invoice)}</td>
                      <td className="py-3 px-3 text-right font-mono text-emerald-700">{formatRupiah(report.total_paid)}</td>
                      <td className="py-3 px-3 text-right font-mono text-rose-700">{formatRupiah(report.total_outstanding)}</td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function PackageFinanceReportPage() {
  return (
    <Suspense fallback={<LoadingSpinner label="Memuat halaman laporan keuangan paket..." />}>
      <PackageReportContent />
    </Suspense>
  );
}
