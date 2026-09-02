'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { UserCheck, Search, Filter, ExternalLink, Users } from 'lucide-react';
import { PackageParticipant, PIC } from '@/types/database.types';
import { Badge } from '@/components/ui/Badge';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { EmptyState } from '@/components/ui/EmptyState';

export default function AllParticipantsPage() {
  const [participants, setParticipants] = useState<PackageParticipant[]>([]);
  const [pics, setPics] = useState<PIC[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [selectedPic, setSelectedPic] = useState('');

  const fetchData = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedPic) params.set('pic_id', selectedPic);

      const [resParts, resPics] = await Promise.all([
        fetch(`/api/participants?${params.toString()}`).then(r => r.json()),
        fetch('/api/pics').then(r => r.json()),
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
                        <Link
                          href={`/jamaah/${part.jamaah_id}`}
                          className="px-2.5 py-1 text-slate-600 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg text-xs font-semibold inline-flex items-center gap-1"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          <span>Detail</span>
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
    </div>
  );
}
