'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { 
  Wallet, 
  Receipt, 
  CreditCard, 
  Inbox, 
  Split, 
  AlertCircle, 
  ArrowRight, 
  Plus, 
  TrendingUp, 
  AlertTriangle,
  CheckCircle2,
  Clock,
  ExternalLink,
  FileSpreadsheet
} from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { formatRupiah } from '@/lib/currency';
import { FinanceOverviewMetrics, Payment } from '@/types/database.types';

export default function FinanceOverviewPage() {
  const [metrics, setMetrics] = useState<FinanceOverviewMetrics | null>(null);
  const [inboxPayments, setInboxPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadFinanceData() {
      try {
        setLoading(true);
        const [overviewRes, inboxRes] = await Promise.all([
          fetch('/api/finance/overview'),
          fetch('/api/finance/inbox')
        ]);

        if (overviewRes.ok) {
          const data = await overviewRes.json();
          setMetrics(data);
        }
        if (inboxRes.ok) {
          const inboxData = await inboxRes.json();
          setInboxPayments(inboxData.slice(0, 5));
        }
      } catch (err) {
        console.error('Failed to load finance overview:', err);
      } finally {
        setLoading(false);
      }
    }
    loadFinanceData();
  }, []);

  if (loading) {
    return <LoadingSpinner label="Memuat ringkasan keuangan jamaah..." />;
  }

  const hasActionRequired = (metrics?.unallocated_payments_count || 0) > 0 || 
    (metrics?.partially_allocated_payments_count || 0) > 0 || 
    (metrics?.overpaid_jamaah_count || 0) > 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
            <Wallet className="w-7 h-7 text-emerald-600" />
            Finance Jamaah — Overview
          </h1>
          <p className="text-slate-500 text-sm mt-0.5">
            Monitoring piutang tagihan jamaah, transaksi pembayaran masuk, dan status alokasi dana per paket.
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <Link
            href="/finance/inbox"
            className="px-4 py-2.5 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200/80 rounded-xl text-sm font-semibold flex items-center gap-2 transition-all shadow-sm"
          >
            <Inbox className="w-4 h-4 text-amber-600" />
            Payment Inbox
            {metrics?.unallocated_payments_count ? (
              <span className="px-1.5 py-0.5 bg-amber-600 text-white rounded-full text-xs font-bold">
                {metrics.unallocated_payments_count}
              </span>
            ) : null}
          </Link>
          <Link
            href="/finance/pembayaran"
            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-semibold flex items-center gap-2 transition-all shadow-md shadow-emerald-900/20 hover:shadow-lg hover:shadow-emerald-900/30"
          >
            <Plus className="w-4 h-4" />
            Catat Pembayaran Masuk
          </Link>
        </div>
      </div>

      {/* Action Required Box */}
      {hasActionRequired && (
        <div className="p-4 bg-gradient-to-r from-amber-500/10 via-amber-50 to-orange-50/50 border border-amber-200 rounded-2xl space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-600" />
              <h2 className="font-bold text-amber-950 text-sm">Tindakan Diperlukan (Action Required)</h2>
            </div>
            <span className="text-xs text-amber-800 font-medium">Perlu perhatian admin</span>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {metrics && metrics.unallocated_payments_count > 0 && (
              <Link 
                href="/finance/inbox"
                className="p-3 bg-white border border-amber-200/80 rounded-xl flex items-center justify-between hover:border-amber-400 hover:shadow-sm transition-all group"
              >
                <div>
                  <p className="text-xs text-slate-500 font-medium">Dana Belum Dialokasikan</p>
                  <p className="text-sm font-bold text-slate-900 mt-0.5">
                    {metrics.unallocated_payments_count} Transfer ({formatRupiah(metrics.total_unallocated_amount)})
                  </p>
                </div>
                <ArrowRight className="w-4 h-4 text-amber-600 group-hover:translate-x-1 transition-transform" />
              </Link>
            )}

            {metrics && metrics.partially_allocated_payments_count > 0 && (
              <Link 
                href="/finance/alokasi"
                className="p-3 bg-white border border-amber-200/80 rounded-xl flex items-center justify-between hover:border-amber-400 hover:shadow-sm transition-all group"
              >
                <div>
                  <p className="text-xs text-slate-500 font-medium">Alokasi Sebagian</p>
                  <p className="text-sm font-bold text-slate-900 mt-0.5">
                    {metrics.partially_allocated_payments_count} Pembayaran ada sisa
                  </p>
                </div>
                <ArrowRight className="w-4 h-4 text-amber-600 group-hover:translate-x-1 transition-transform" />
              </Link>
            )}

            {metrics && metrics.overpaid_jamaah_count > 0 && (
              <Link 
                href="/finance/tagihan?status=OVERPAID"
                className="p-3 bg-white border border-purple-200/80 rounded-xl flex items-center justify-between hover:border-purple-400 hover:shadow-sm transition-all group"
              >
                <div>
                  <p className="text-xs text-slate-500 font-medium">Lebih Bayar (Overpaid)</p>
                  <p className="text-sm font-bold text-purple-950 mt-0.5">
                    {metrics.overpaid_jamaah_count} Jamaah lebih bayar
                  </p>
                </div>
                <ArrowRight className="w-4 h-4 text-purple-600 group-hover:translate-x-1 transition-transform" />
              </Link>
            )}
          </div>
        </div>
      )}

      {/* KPI Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Tagihan */}
        <div className="p-5 bg-white border border-slate-200/80 rounded-2xl shadow-sm space-y-2">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase tracking-wider">
            <span>Total Tagihan</span>
            <Receipt className="w-4 h-4 text-slate-400" />
          </div>
          <p className="text-2xl font-bold text-slate-900 tracking-tight">
            {formatRupiah(metrics?.total_invoices_amount)}
          </p>
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <span className="text-slate-700 font-medium">Seluruh paket aktif</span>
          </div>
        </div>

        {/* Total Pembayaran Masuk */}
        <div className="p-5 bg-white border border-slate-200/80 rounded-2xl shadow-sm space-y-2">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase tracking-wider">
            <span>Total Dibayar</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <p className="text-2xl font-bold text-emerald-700 tracking-tight">
            {formatRupiah(metrics?.total_paid_amount)}
          </p>
          <div className="flex items-center gap-1.5 text-xs text-emerald-600 font-medium">
            <span>Telah dialokasikan ke jamaah</span>
          </div>
        </div>

        {/* Total Sisa Tagihan (Outstanding) */}
        <div className="p-5 bg-white border border-slate-200/80 rounded-2xl shadow-sm space-y-2">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase tracking-wider">
            <span>Total Sisa (Outstanding)</span>
            <Clock className="w-4 h-4 text-rose-500" />
          </div>
          <p className="text-2xl font-bold text-rose-700 tracking-tight">
            {formatRupiah(metrics?.total_outstanding_amount)}
          </p>
          <div className="flex items-center gap-1.5 text-xs text-rose-600 font-medium">
            <span>{metrics?.unpaid_jamaah_count || 0} jamaah belum lunas</span>
          </div>
        </div>

        {/* Dana Belum Dialokasikan */}
        <div className="p-5 bg-white border border-amber-200 rounded-2xl shadow-sm bg-gradient-to-br from-amber-50/50 to-white space-y-2">
          <div className="flex items-center justify-between text-amber-900 text-xs font-semibold uppercase tracking-wider">
            <span>Dana Belum Dialokasi</span>
            <Inbox className="w-4 h-4 text-amber-600" />
          </div>
          <p className="text-2xl font-bold text-amber-950 tracking-tight">
            {formatRupiah(metrics?.total_unallocated_amount)}
          </p>
          <div className="flex items-center gap-1.5 text-xs text-amber-800 font-medium">
            <span>Di Payment Inbox ({metrics?.unallocated_payments_count || 0} transfer)</span>
          </div>
        </div>
      </div>

      {/* Quick Navigation Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <Link
          href="/finance/tagihan"
          className="p-4 bg-white border border-slate-200 rounded-2xl hover:border-emerald-500 hover:shadow-md transition-all group flex items-start justify-between"
        >
          <div>
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center mb-3">
              <Receipt className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-slate-900 text-base">Daftar Tagihan</h3>
            <p className="text-xs text-slate-500 mt-1">Lihat status lunas, cicilan, dan rincian biaya per jamaah.</p>
          </div>
          <ChevronRightIcon className="w-4 h-4 text-slate-400 group-hover:text-emerald-600 group-hover:translate-x-1 transition-transform shrink-0" />
        </Link>

        <Link
          href="/finance/pembayaran"
          className="p-4 bg-white border border-slate-200 rounded-2xl hover:border-emerald-500 hover:shadow-md transition-all group flex items-start justify-between"
        >
          <div>
            <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center mb-3">
              <CreditCard className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-slate-900 text-base">Riwayat Pembayaran</h3>
            <p className="text-xs text-slate-500 mt-1">Daftar transfer masuk bank, bukti transfer, dan audit pembatalan.</p>
          </div>
          <ChevronRightIcon className="w-4 h-4 text-slate-400 group-hover:text-emerald-600 group-hover:translate-x-1 transition-transform shrink-0" />
        </Link>

        <Link
          href="/finance/inbox"
          className="p-4 bg-white border border-slate-200 rounded-2xl hover:border-amber-500 hover:shadow-md transition-all group flex items-start justify-between"
        >
          <div>
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center mb-3">
              <Inbox className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-slate-900 text-base">Payment Inbox</h3>
            <p className="text-xs text-slate-500 mt-1">Antrean transfer masuk yang belum ditentukan pemilik jamaahnya.</p>
          </div>
          <ChevronRightIcon className="w-4 h-4 text-slate-400 group-hover:text-amber-600 group-hover:translate-x-1 transition-transform shrink-0" />
        </Link>

        <Link
          href="/finance/alokasi"
          className="p-4 bg-white border border-slate-200 rounded-2xl hover:border-emerald-500 hover:shadow-md transition-all group flex items-start justify-between"
        >
          <div>
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center mb-3">
              <Split className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-slate-900 text-base">Alokasi Pembayaran</h3>
            <p className="text-xs text-slate-500 mt-1">Distribusi transfer 1 ke N jamaah, transfer PIC, & auto-distribute.</p>
          </div>
          <ChevronRightIcon className="w-4 h-4 text-slate-400 group-hover:text-emerald-600 group-hover:translate-x-1 transition-transform shrink-0" />
        </Link>

        <Link
          href="/finance/laporan-paket"
          className="p-4 bg-gradient-to-br from-emerald-900 to-slate-900 text-white border border-emerald-800 rounded-2xl hover:border-emerald-400 hover:shadow-md transition-all group flex items-start justify-between shadow-sm"
        >
          <div>
            <div className="w-10 h-10 rounded-xl bg-emerald-800/80 text-emerald-300 flex items-center justify-center mb-3 border border-emerald-700">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-white text-base">Laporan Paket</h3>
            <p className="text-xs text-emerald-200/70 mt-1">Laporan 3 tingkat: Ringkasan Paket, Rincian Jamaah, & Rekap PIC/TL.</p>
          </div>
          <ChevronRightIcon className="w-4 h-4 text-emerald-400 group-hover:translate-x-1 transition-transform shrink-0" />
        </Link>
      </div>

      {/* Payment Inbox Preview Table */}
      <div className="bg-white border border-slate-200/80 rounded-2xl shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-200/80 flex items-center justify-between bg-slate-50/50">
          <div>
            <h2 className="font-bold text-slate-900 text-sm">Payment Inbox (Perlu Alokasi Segera)</h2>
            <p className="text-xs text-slate-500 mt-0.5">Transfer yang belum dialokasikan ke tagihan jamaah</p>
          </div>
          <Link
            href="/finance/inbox"
            className="text-xs text-emerald-600 hover:text-emerald-700 font-semibold flex items-center gap-1"
          >
            Lihat Semua Inbox ({metrics?.unallocated_payments_count || 0})
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {inboxPayments.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-sm flex flex-col items-center">
            <CheckCircle2 className="w-8 h-8 text-emerald-500 mb-2" />
            <p className="font-medium text-slate-700">Semua pembayaran masuk telah dialokasikan!</p>
            <p className="text-xs text-slate-400 mt-1">Tidak ada transfer tertahan di Payment Inbox.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase font-semibold">
                <tr>
                  <th className="py-3 px-4">Tanggal</th>
                  <th className="py-3 px-4">Pengirim</th>
                  <th className="py-3 px-4">Nominal</th>
                  <th className="py-3 px-4">Paket / PIC</th>
                  <th className="py-3 px-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {inboxPayments.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4 font-medium text-slate-700 whitespace-nowrap">{p.payment_date}</td>
                    <td className="py-3 px-4">
                      <p className="font-bold text-slate-900">{p.sender_name}</p>
                      {p.sender_bank && <p className="text-slate-400 text-[11px]">{p.sender_bank}</p>}
                    </td>
                    <td className="py-3 px-4 font-bold text-slate-900 whitespace-nowrap">
                      {formatRupiah(p.amount)}
                    </td>
                    <td className="py-3 px-4 text-slate-600">
                      {p.package?.package_name || p.pic?.name || <span className="text-slate-400 italic">Belum ditentukan</span>}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <Link
                        href={`/finance/alokasi?payment_id=${p.id}`}
                        className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-semibold rounded-lg text-xs transition-colors inline-flex items-center gap-1"
                      >
                        <Split className="w-3.5 h-3.5" />
                        Alokasikan
                      </Link>
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

function ChevronRightIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
    </svg>
  );
}
