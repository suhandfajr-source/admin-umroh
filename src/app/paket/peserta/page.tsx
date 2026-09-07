'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { UserCheck, Search, Filter, ExternalLink, Users, Edit3, Trash2, AlertTriangle } from 'lucide-react';
import { PackageParticipant, PIC } from '@/types/database.types';
import { Badge } from '@/components/ui/Badge';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { Modal } from '@/components/ui/Modal';
import { formatInputNumber, parseRupiahInput } from '@/lib/currency';
import { fetchWithCache, invalidateCache } from '@/lib/cache/client-cache';

export default function AllParticipantsPage() {
  const [participants, setParticipants] = useState<PackageParticipant[]>([]);
  const [pics, setPics] = useState<PIC[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [selectedPic, setSelectedPic] = useState('');

  // Edit State
  const [editPart, setEditPart] = useState<PackageParticipant | null>(null);
  const [editPicId, setEditPicId] = useState('');
  const [editSellingPrice, setEditSellingPrice] = useState<string>('');
  const [editNotes, setEditNotes] = useState('');
  const [editStatus, setEditStatus] = useState<string>('REGISTERED');
  const [submittingEdit, setSubmittingEdit] = useState(false);

  // Delete / Remove State
  const [deleteTarget, setDeleteTarget] = useState<PackageParticipant | null>(null);
  const [submittingDelete, setSubmittingDelete] = useState(false);

  const fetchData = async (forceRefresh = false) => {
    try {
      const params = new URLSearchParams();
      if (selectedPic) params.set('pic_id', selectedPic);

      const [resParts, resPics] = await Promise.all([
        fetchWithCache<PackageParticipant[]>(`/api/participants?${params.toString()}`, {
          forceRefresh,
          onBackgroundUpdate: (fresh) => { if (fresh) setParticipants(fresh); },
        }),
        fetchWithCache<PIC[]>('/api/pics', {
          forceRefresh,
          onBackgroundUpdate: (fresh) => { if (fresh) setPics(fresh); },
        }),
      ]);

      setParticipants(resParts || []);
      setPics(resPics || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [selectedPic]);

  const openEditModal = (part: PackageParticipant) => {
    setEditPart(part);
    setEditPicId(part.pic_id || '');
    setEditSellingPrice(formatInputNumber(part.selling_price));
    setEditNotes(part.notes || '');
    setEditStatus(part.participant_status || 'REGISTERED');
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editPart) return;

    setSubmittingEdit(true);
    try {
      const res = await fetch(`/api/participants/${editPart.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pic_id: editPicId || null,
          selling_price: parseRupiahInput(editSellingPrice),
          notes: editNotes,
          participant_status: editStatus,
        }),
      });

      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson.error || 'Gagal memperbarui data peserta');
      }

      invalidateCache('/api/participants');
      invalidateCache('/api/packages');
      invalidateCache('/api/finance/invoices');
      setEditPart(null);
      fetchData(true);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSubmittingEdit(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;

    setSubmittingDelete(true);
    try {
      const res = await fetch(`/api/participants/${deleteTarget.id}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson.error || 'Gagal menghapus peserta');
      }

      invalidateCache('/api/participants');
      invalidateCache('/api/packages');
      invalidateCache('/api/finance/invoices');
      setDeleteTarget(null);
      fetchData(true);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSubmittingDelete(false);
    }
  };

  const filtered = participants.filter((p) => {
    if (!search) return true;
    const s = search.toLowerCase();
    const name = (p.jamaah?.passport_name || p.jamaah?.identity_name || '').toLowerCase();
    const passport = (p.jamaah?.passport_number || '').toLowerCase();
    const pkgName = (p.package?.package_name || '').toLowerCase();
    return name.includes(s) || passport.includes(s) || pkgName.includes(s);
  });

  const formatRupiah = (num: number) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(num);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Daftar Seluruh Peserta Paket</h1>
          <p className="text-xs text-slate-500 mt-1">
            Monitoring seluruh jamaah terdaftar di semua paket keberangkatan aktif dan lampau.
          </p>
        </div>
        <Link
          href="/paket"
          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-900/20 flex items-center gap-2 self-start sm:self-auto transition-all"
        >
          <Users className="w-4 h-4" />
          <span>Kelola Per Paket</span>
        </Link>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="relative md:col-span-2">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari Nama Jamaah, Nomor Paspor, atau Nama Paket..."
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder:text-slate-400 focus:outline-hidden focus:border-emerald-500 focus:bg-white"
            />
          </div>

          <div>
            <select
              value={selectedPic}
              onChange={(e) => setSelectedPic(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 font-medium focus:outline-hidden focus:border-emerald-500"
            >
              <option value="">Semua PIC</option>
              {pics.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Participants Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
        {loading ? (
          <LoadingSpinner label="Memuat seluruh peserta paket..." />
        ) : filtered.length === 0 ? (
          <EmptyState
            title="Tidak Ada Peserta Ditemukan"
            description="Belum ada data peserta yang cocok dengan filter atau pencarian Anda."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="p-4">Nama Jamaah</th>
                  <th className="p-4">No. Paspor</th>
                  <th className="p-4">Paket Umrah</th>
                  <th className="p-4">PIC / Mitra</th>
                  <th className="p-4">Harga Jual Jamaah</th>
                  <th className="p-4">Status Peserta</th>
                  <th className="p-4 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((part) => {
                  const j = part.jamaah;
                  const pkg = part.package;

                  return (
                    <tr key={part.id} className="hover:bg-slate-50/70">
                      <td className="p-4 font-bold text-slate-900">
                        <Link href={`/jamaah/${part.jamaah_id}`} className="hover:text-emerald-700">
                          {j?.passport_name || j?.identity_name || 'Jamaah'}
                        </Link>
                      </td>
                      <td className="p-4 font-mono font-medium text-slate-800">
                        {j?.passport_number || <span className="text-slate-400 italic">-</span>}
                      </td>
                      <td className="p-4">
                        <Link href={`/paket/${part.package_id}`} className="font-semibold text-slate-800 hover:text-sky-700 block">
                          {pkg?.package_name}
                        </Link>
                        <span className="text-[10px] text-slate-400">{pkg?.departure_date}</span>
                      </td>
                      <td className="p-4 text-slate-700">
                        {part.pic?.name || <span className="text-slate-400 italic">Travel Langsung</span>}
                      </td>
                      <td className="p-4 font-mono font-bold text-emerald-800">
                        {formatRupiah(part.selling_price)}
                      </td>
                      <td className="p-4">
                        <Badge variant={part.participant_status === 'CONFIRMED' ? 'success' : 'info'}>
                          {part.participant_status}
                        </Badge>
                      </td>
                      <td className="p-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <Link
                            href={`/jamaah/${part.jamaah_id}`}
                            className="px-2 py-1 text-slate-600 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg text-xs font-semibold inline-flex items-center gap-1"
                            title="Lihat Detail Profil Jamaah"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                            <span>Detail</span>
                          </Link>
                          <button
                            type="button"
                            onClick={() => openEditModal(part)}
                            className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                            title="Edit Data Peserta (Harga / PIC)"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteTarget(part)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                            title="Keluarkan dari Paket"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Edit Participant Modal */}
      <Modal
        isOpen={!!editPart}
        onClose={() => setEditPart(null)}
        title="Edit Data Peserta Paket"
        subtitle={`Atur PIC, harga jual, dan status untuk jamaah ${editPart?.jamaah?.passport_name || editPart?.jamaah?.identity_name || ''}`}
        maxWidth="md"
      >
        <form onSubmit={handleUpdate} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Koordinator / PIC
            </label>
            <select
              value={editPicId}
              onChange={(e) => setEditPicId(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-hidden focus:border-emerald-500"
            >
              <option value="">Travel Langsung (Tanpa PIC)</option>
              {pics.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Harga Jual Tagihan Jamaah (Rp) <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              inputMode="numeric"
              required
              value={editSellingPrice}
              onChange={(e) => setEditSellingPrice(formatInputNumber(e.target.value))}
              placeholder="Contoh: 30.000.000"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-900 focus:outline-hidden focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Status Peserta
            </label>
            <select
              value={editStatus}
              onChange={(e) => setEditStatus(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-hidden focus:border-emerald-500"
            >
              <option value="REGISTERED">REGISTERED</option>
              <option value="CONFIRMED">CONFIRMED</option>
              <option value="WAITING_LIST">WAITING_LIST</option>
              <option value="CANCELLED">CANCELLED</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Catatan Khusus Peserta
            </label>
            <textarea
              value={editNotes}
              onChange={(e) => setEditNotes(e.target.value)}
              rows={2}
              placeholder="Catatan tambahan kamar / permintaan khusus..."
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-hidden focus:border-emerald-500"
            />
          </div>

          <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setEditPart(null)}
              className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-xl"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={submittingEdit}
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-md shadow-indigo-900/20"
            >
              {submittingEdit ? 'Menyimpan...' : 'Simpan Perubahan'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Participant Confirmation Modal */}
      <Modal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Konfirmasi Keluarkan Peserta dari Paket"
        maxWidth="md"
      >
        <div className="space-y-4">
          <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            <div className="text-xs text-rose-800">
              <p className="font-bold">Apakah Anda yakin ingin mengeluarkan peserta ini dari paket keberangkatan?</p>
              <p className="mt-1">
                Jamaah: <strong className="text-rose-950 font-bold">{deleteTarget?.jamaah?.passport_name || deleteTarget?.jamaah?.identity_name}</strong>
              </p>
              <p className="mt-1">
                Paket: <strong className="text-rose-950 font-bold">{deleteTarget?.package?.package_name}</strong>
              </p>
              <p className="mt-2 text-slate-700 bg-white p-2 rounded-lg border border-slate-200 font-medium">
                Kuota terisi pada paket ini akan otomatis berkurang (-1) dan tagihan paket untuk jamaah ini akan dibatalkan/diarsipkan.
              </p>
            </div>
          </div>

          <div className="pt-2 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setDeleteTarget(null)}
              className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-xl"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={submittingDelete}
              className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl shadow-md shadow-rose-900/20"
            >
              {submittingDelete ? 'Mengeluarkan...' : 'Ya, Keluarkan dari Paket'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
