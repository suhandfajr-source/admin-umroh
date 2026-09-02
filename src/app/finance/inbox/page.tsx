'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { 
  Inbox, 
  Split, 
  Search, 
  FileText, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  ArrowRight,
  Plus
} from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { formatRupiah } from '@/lib/currency';
import { Payment } from '@/types/database.types';

export default function PaymentInboxPage() {
  const [inboxPayments, setInboxPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [proofTarget, setProofTarget] = useState<Payment | null>(null);

  const loadInbox = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/finance/inbox');
      if (res.ok) {
        const data = await res.json();
        setInboxPayments(data);
      }
    } catch (err) {
      console.error('Error fetching payment inbox:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInbox();
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
            <Inbox className="w-7 h-7 text-amber-600" />
            Payment Inbox — Dana Belum Dialokasi
          </h1>
          <p className="text-slate-500 text-sm mt-0.5">
            Antrean transfer bank masuk yang belum dihubungkan ke tagihan jamaah atau PIC rombongan.
          </p>
        </div>
        <Link
          href="/finance/pembayaran"
          className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-semibold flex items-center gap-2 transition-all shadow-md shadow-emerald-900/20"
        >
          <Plus className="w-4 h-4" />
          Catat Transfer Masuk
        </Link>
      </div>

      {/* Info Banner */}
      <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-start gap-3.5 text-xs text-amber-900">
        <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="font-bold text-amber-950">Tentang Payment Inbox</p>
          <p className="leading-relaxed text-amber-800">
            Pembayaran dapat dicatat terlebih dahulu saat mutasi bank diterima meskipun nama jamaah belum diketahui. Dana di dalam inbox tidak akan hangus dan dapat dialokasikan sewaktu-waktu tanpa perlu membuat transaksi ulang.
          </p>
        </div>
      </div>

      {/* Inbox Table */}
      <div className="bg-white border border-slate-200/80 rounded-2xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center">
            <LoadingSpinner label="Memuat antrean Payment Inbox..." />
          </div>
        ) : inboxPayments.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-2" />
            <p className="font-bold text-slate-800 text-base">Payment Inbox Bersih</p>
            <p className="text-xs text-slate-400 mt-1">Seluruh transfer masuk telah berhasil dialokasikan ke tagihan jamaah.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase font-semibold border-b border-slate-200/80">
                <tr>
                  <th className="py-3.5 px-4">Tanggal Masuk</th>
                  <th className="py-3.5 px-4">Nama Pengirim</th>
                  <th className="py-3.5 px-4">Bank</th>
                  <th className="py-3.5 px-4 text-right">Nominal Dana</th>
                  <th className="py-3.5 px-4">Catatan / Referensi</th>
                  <th className="py-3.5 px-4 text-center">Bukti</th>
                  <th className="py-3.5 px-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {inboxPayments.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3.5 px-4 font-medium text-slate-700 whitespace-nowrap">{p.payment_date}</td>
                    <td className="py-3.5 px-4 font-bold text-slate-900">{p.sender_name}</td>
                    <td className="py-3.5 px-4 text-slate-600">{p.sender_bank || '-'}</td>
                    <td className="py-3.5 px-4 text-right font-bold text-emerald-700 text-sm whitespace-nowrap">
                      {formatRupiah(p.amount)}
                    </td>
                    <td className="py-3.5 px-4 text-slate-500 max-w-xs truncate">
                      {p.notes || <span className="italic text-slate-400">Tidak ada catatan</span>}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      {p.signed_proof_url ? (
                        <button
                          onClick={() => setProofTarget(p)}
                          className="p-1 text-slate-500 hover:text-emerald-600 rounded"
                          title="Lihat Bukti Transfer"
                        >
                          <FileText className="w-4 h-4" />
                        </button>
                      ) : (
                        <span className="text-slate-300">-</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-right whitespace-nowrap">
                      <Link
                        href={`/finance/alokasi?payment_id=${p.id}`}
                        className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl text-xs transition-all inline-flex items-center gap-1.5 shadow-sm"
                      >
                        <Split className="w-3.5 h-3.5" />
                        Alokasikan Sekarang
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Proof Modal */}
      {proofTarget && (
        <Modal
          isOpen={!!proofTarget}
          onClose={() => setProofTarget(null)}
          title={`Bukti Transfer — ${proofTarget.sender_name}`}
          size="lg"
        >
          <div className="space-y-4 text-center">
            {proofTarget.signed_proof_url && (
              <div className="border border-slate-200 rounded-xl p-2 bg-slate-900/5 max-h-[70vh] overflow-auto flex justify-center">
                <img
                  src={proofTarget.signed_proof_url}
                  alt="Bukti Transfer"
                  className="max-h-[60vh] rounded-lg object-contain"
                />
              </div>
            )}
            <div className="flex justify-end">
              <button
                onClick={() => setProofTarget(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold"
              >
                Tutup
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
