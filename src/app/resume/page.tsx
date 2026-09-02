'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { 
  FileSpreadsheet, 
  Plus, 
  Search, 
  Calendar, 
  Users, 
  ArrowUpRight, 
  ExternalLink,
  RefreshCw
} from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { Modal } from '@/components/ui/Modal';
import { formatRupiah } from '@/lib/currency';

export default function ResumePage() {
  const router = useRouter();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Add Departure Modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [progName, setProgName] = useState('');
  const [depDate, setDepDate] = useState('');
  const [deadlineDate, setDeadlineDate] = useState('');
  const [progPrice, setProgPrice] = useState('32900000');
  const [capacity, setCapacity] = useState('45');
  const [submitting, setSubmitting] = useState(false);

  const loadResumeData = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/resume');
      if (!res.ok) throw new Error('Gagal memuat resume keberangkatan');
      const json = await res.json();
      setRows(json.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadResumeData();
  }, []);

  const handleAddDeparture = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!progName) {
      alert('Nama program wajib diisi');
      return;
    }

    try {
      setSubmitting(true);
      const res = await fetch('/api/resume', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: progName,
          departure_date: depDate,
          payment_deadline: deadlineDate,
          price_quad: progPrice,
          capacity: capacity,
        }),
      });

      if (!res.ok) throw new Error('Gagal menambah program keberangkatan');
      setShowAddModal(false);
      setProgName('');
      setDepDate('');
      setDeadlineDate('');
      await loadResumeData();
    } catch (err: any) {
      alert(err.message || 'Gagal menyimpan program');
    } finally {
      setSubmitting(false);
    }
  };

  const totalPax = rows.reduce((acc, r) => acc + (r.pax_terdaftar || 0), 0);
  const totalTagihanGlobal = rows.reduce((acc, r) => acc + (r.total_tagihan || 0), 0);
  const totalBayarGlobal = rows.reduce((acc, r) => acc + (r.total_pembayaran || 0), 0);
  const totalKekuranganGlobal = rows.reduce((acc, r) => acc + (r.total_kekurangan || 0), 0);

  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">
            Resume Keberangkatan Wahidku
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Ringkasan operasional dan tagihan keuangan seluruh program keberangkatan umrah.
          </p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-900/20 flex items-center gap-2 transition-all self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>+ Tambah Keberangkatan</span>
        </button>
      </div>

      {/* Global Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-2xs">
          <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Total Pax Terdaftar</p>
          <p className="text-xl font-black text-slate-900 mt-1">{totalPax} Jamaah</p>
        </div>
        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-2xs">
          <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Total Tagihan Global</p>
          <p className="text-xl font-black text-slate-900 mt-1">{formatRupiah(totalTagihanGlobal)}</p>
        </div>
        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-2xs">
          <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Total Pembayaran Masuk</p>
          <p className="text-xl font-black text-emerald-600 mt-1">{formatRupiah(totalBayarGlobal)}</p>
        </div>
        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-2xs">
          <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Total Sisa Tagihan</p>
          <p className="text-xl font-black text-rose-600 mt-1">{formatRupiah(totalKekuranganGlobal)}</p>
        </div>
      </div>

      {/* Main Resume Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
        {loading ? (
          <div className="py-16">
            <LoadingSpinner label="Memuat resume keberangkatan..." />
          </div>
        ) : rows.length === 0 ? (
          <div className="p-12 text-center text-slate-500 space-y-2">
            <p className="font-bold text-slate-800 text-sm">Belum Ada Program Keberangkatan</p>
            <p className="text-xs text-slate-400">Klik tombol &quot;+ Tambah Keberangkatan&quot; untuk membuat program baru.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="sticky top-0 bg-slate-50 border-b border-slate-200 text-slate-600 font-bold z-10">
                <tr>
                  <th className="py-3 px-3.5">Program</th>
                  <th className="py-3 px-3 text-center">Keberangkatan</th>
                  <th className="py-3 px-3 text-center">Pelunasan</th>
                  <th className="py-3 px-2 text-center">H</th>
                  <th className="py-3 px-2.5 text-center">Pax</th>
                  <th className="py-3 px-3 text-right">Biaya / Program</th>
                  <th className="py-3 px-3 text-right">Diskon TL</th>
                  <th className="py-3 px-3.5 text-right font-bold">Total Tagihan</th>
                  <th className="py-3 px-3.5 text-right font-bold text-emerald-700">Total Pembayaran</th>
                  <th className="py-3 px-3.5 text-right font-bold text-rose-700">Total Kekurangan</th>
                  <th className="py-3 px-3 text-right">Fee</th>
                  <th className="py-3 px-3 text-right">Balance</th>
                  <th className="py-3 px-3 text-center w-20">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-normal">
                {rows.map((row) => (
                  <tr
                    key={row.id}
                    className="hover:bg-emerald-50/40 transition-colors group cursor-pointer"
                    onClick={() => router.push(`/resume/${row.id}`)}
                  >
                    <td className="py-3.5 px-3.5 font-bold text-slate-900 group-hover:text-emerald-700">
                      {row.program}
                    </td>
                    <td className="py-3.5 px-3 text-center font-mono font-medium text-slate-700">
                      {row.keberangkatan}
                    </td>
                    <td className="py-3.5 px-3 text-center font-mono text-slate-500">
                      {row.tanggal_pelunasan}
                    </td>
                    <td className="py-3.5 px-2 text-center">
                      <span className="inline-flex px-1.5 py-0.5 rounded font-mono font-bold text-[11px] bg-slate-100 text-slate-700">
                        {row.h_days}
                      </span>
                    </td>
                    <td className="py-3.5 px-2.5 text-center font-bold text-slate-800">
                      {row.pax_terdaftar} <span className="text-[10px] text-slate-400 font-normal">/{row.pax_capacity}</span>
                    </td>
                    <td className="py-3.5 px-3 text-right font-mono text-slate-700">
                      {formatRupiah(row.biaya_per_program)}
                    </td>
                    <td className="py-3.5 px-3 text-right font-mono text-slate-400">
                      {formatRupiah(row.diskon_tl)}
                    </td>
                    <td className="py-3.5 px-3.5 text-right font-mono font-bold text-slate-900">
                      {formatRupiah(row.total_tagihan)}
                    </td>
                    <td className="py-3.5 px-3.5 text-right font-mono font-bold text-emerald-600">
                      {formatRupiah(row.total_pembayaran)}
                    </td>
                    <td className="py-3.5 px-3.5 text-right font-mono font-bold text-rose-600">
                      {formatRupiah(row.total_kekurangan)}
                    </td>
                    <td className="py-3.5 px-3 text-right font-mono text-slate-500">
                      {row.fee !== null && row.fee !== undefined ? formatRupiah(row.fee) : '-'}
                    </td>
                    <td className="py-3.5 px-3 text-right font-mono font-medium text-slate-700">
                      {row.balance !== null && row.balance !== undefined ? formatRupiah(row.balance) : '-'}
                    </td>
                    <td className="py-3.5 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                      <Link
                        href={`/resume/${row.id}`}
                        className="px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-lg text-xs font-bold flex items-center gap-1 shadow-2xs transition-all mx-auto w-fit"
                      >
                        <span>Rekap</span>
                        <ArrowUpRight className="w-3.5 h-3.5" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Departure Modal */}
      {showAddModal && (
        <Modal
          isOpen={true}
          onClose={() => setShowAddModal(false)}
          title="Tambah Program Keberangkatan"
          size="md"
        >
          <form onSubmit={handleAddDeparture} className="space-y-4 text-xs">
            <div>
              <label className="font-bold text-slate-700">Nama Program Keberangkatan *</label>
              <input
                type="text"
                required
                placeholder="Contoh: UMROH AS SALAM 12 HARI"
                value={progName}
                onChange={(e) => setProgName(e.target.value)}
                className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="font-bold text-slate-700">Tanggal Keberangkatan *</label>
                <input
                  type="date"
                  required
                  value={depDate}
                  onChange={(e) => setDepDate(e.target.value)}
                  className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <div>
                <label className="font-bold text-slate-700">Batas Pelunasan</label>
                <input
                  type="date"
                  value={deadlineDate}
                  onChange={(e) => setDeadlineDate(e.target.value)}
                  className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="font-bold text-slate-700">Biaya Standar Per Program (Rp)</label>
                <input
                  type="number"
                  value={progPrice}
                  onChange={(e) => setProgPrice(e.target.value)}
                  className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 font-mono font-bold"
                />
              </div>
              <div>
                <label className="font-bold text-slate-700">Kapasitas (Seat Pax)</label>
                <input
                  type="number"
                  value={capacity}
                  onChange={(e) => setCapacity(e.target.value)}
                  className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl font-bold"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold shadow-xs disabled:opacity-50"
              >
                {submitting ? 'Menyimpan...' : 'Simpan Keberangkatan'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
