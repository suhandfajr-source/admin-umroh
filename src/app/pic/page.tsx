'use client';

import React, { useState, useEffect } from 'react';
import { Contact2, PlusCircle, Phone, Users, FileText, Search, UserCheck } from 'lucide-react';
import { PIC } from '@/types/database.types';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { EmptyState } from '@/components/ui/EmptyState';

export default function MasterPicPage() {
  const [pics, setPics] = useState<PIC[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [search, setSearch] = useState('');

  // Form State
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [invoices, setInvoices] = useState<any[]>([]);

  const fetchPics = async () => {
    setLoading(true);
    try {
      const [resPics, resInvoices] = await Promise.all([
        fetch('/api/pics'),
        fetch('/api/finance/invoices')
      ]);
      const data = await resPics.json();
      setPics(data || []);

      if (resInvoices.ok) {
        setInvoices(await resInvoices.json());
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPics();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) return;

    setSubmitting(true);
    try {
      const res = await fetch('/api/pics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, phone, notes }),
      });
      if (!res.ok) throw new Error('Gagal menyimpan PIC');

      setModalOpen(false);
      setName('');
      setPhone('');
      setNotes('');
      fetchPics();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const filtered = pics.filter(p => {
    if (!search) return true;
    const s = search.toLowerCase();
    return p.name.toLowerCase().includes(s) || (p.phone && p.phone.includes(s));
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Master PIC (Person In Charge)</h1>
          <p className="text-xs text-slate-500 mt-1">
            Kelola data koordinator / mitra agen yang membawa dan mengelola rombongan jamaah beserta ringkasan keuangannya.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-900/20 flex items-center gap-2 transition-all"
        >
          <PlusCircle className="w-4 h-4" />
          <span>Tambah PIC Baru</span>
        </button>
      </div>

      {/* Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
        <div className="relative max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari Nama PIC atau No. Telepon..."
            className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-hidden focus:border-emerald-500 focus:bg-white"
          />
        </div>
      </div>

      {/* PIC Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
        {loading ? (
          <LoadingSpinner label="Memuat data Master PIC..." />
        ) : filtered.length === 0 ? (
          <EmptyState
            title="Belum Ada Data PIC"
            description="Tambahkan data PIC koordinator jamaah untuk menghubungkan pendaftaran jamaah dan harga khusus."
            action={
              <button
                onClick={() => setModalOpen(true)}
                className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-semibold"
              >
                Tambah PIC Sekarang
              </button>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="p-4">Nama PIC / Koordinator</th>
                  <th className="p-4">Kontak / No. Telepon</th>
                  <th className="p-4 text-center">Total Jamaah</th>
                  <th className="p-4 text-right">Total Tagihan</th>
                  <th className="p-4 text-right">Sudah Dibayar</th>
                  <th className="p-4 text-right">Sisa Piutang</th>
                  <th className="p-4">Catatan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((pic) => {
                  const picInvoices = invoices.filter(inv => inv.participant?.pic_id === pic.id);
                  const totalTagihan = picInvoices.reduce((sum, i) => sum + i.total_amount, 0);
                  const totalPaid = picInvoices.reduce((sum, i) => sum + i.total_paid, 0);
                  const totalOutstanding = picInvoices.reduce((sum, i) => sum + i.outstanding, 0);

                  return (
                    <tr key={pic.id} className="hover:bg-slate-50/70">
                      <td className="p-4 font-bold text-slate-900 flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center font-bold">
                          <Contact2 className="w-4 h-4" />
                        </div>
                        <span>{pic.name}</span>
                      </td>
                      <td className="p-4 font-mono text-slate-700">
                        {pic.phone ? (
                          <span className="flex items-center gap-1.5">
                            <Phone className="w-3.5 h-3.5 text-slate-400" />
                            <span>{pic.phone}</span>
                          </span>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>
                      <td className="p-4 text-center">
                        <span className="px-2.5 py-0.5 bg-slate-100 rounded-full font-bold text-slate-800 border border-slate-200">
                          {pic.jamaah_count || 0} Jamaah
                        </span>
                      </td>
                      <td className="p-4 text-right font-mono font-bold text-slate-900">
                        Rp {totalTagihan.toLocaleString('id-ID')}
                      </td>
                      <td className="p-4 text-right font-mono font-semibold text-emerald-700">
                        Rp {totalPaid.toLocaleString('id-ID')}
                      </td>
                      <td className="p-4 text-right font-mono font-bold text-rose-700">
                        Rp {totalOutstanding.toLocaleString('id-ID')}
                      </td>
                      <td className="p-4 text-slate-500 max-w-xs truncate">
                        {pic.notes || '-'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add PIC Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Tambah Master PIC Baru"
        subtitle="PIC adalah koordinator rombongan yang mengelola sekelompok jamaah."
        maxWidth="md"
      >
        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Nama Lengkap PIC / Mitra <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Contoh: Ustadz Abdullah Hasan"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:outline-hidden focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Nomor WhatsApp / HP
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="0812xxxxxxxx"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-800 focus:bg-white focus:outline-hidden focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Catatan Khusus
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Contoh: Mitra Wilayah Jawa Timur / Pesantren Al Hikmah"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white focus:outline-hidden focus:border-emerald-500"
            />
          </div>

          <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-xl"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-md shadow-emerald-900/20"
            >
              {submitting ? 'Menyimpan...' : 'Simpan Master PIC'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
