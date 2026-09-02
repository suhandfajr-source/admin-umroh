'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  Users, 
  Search, 
  UserPlus, 
  UploadCloud, 
  Eye, 
  Trash2,
  AlertTriangle,
  Loader2,
  FileText
} from 'lucide-react';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { UnifiedJamaahDetailModal } from '@/components/jamaah/UnifiedJamaahDetailModal';
import { PassportRecommendationModal } from '@/components/documents/PassportRecommendationModal';
import { formatJamaahDisplayId } from '@/lib/display-helpers';

export default function DatabaseJamaahPage() {
  const [jamaahList, setJamaahList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Selected Jamaah for Canonical Detail Modal
  const [selectedJamaahId, setSelectedJamaahId] = useState<string | null>(null);

  // Selected Jamaah for Passport Recommendation Modal
  const [passportRecJamaah, setPassportRecJamaah] = useState<any | null>(null);

  // State for Delete Confirmation Modal
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (search) params.set('search', search);

      const res = await fetch(`/api/jamaah?${params.toString()}`);
      if (!res.ok) throw new Error('Gagal memuat database jamaah');
      const data = await res.json();
      setJamaahList(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const delay = setTimeout(loadData, 200);
    return () => clearTimeout(delay);
  }, [search]);

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    try {
      setIsDeleting(true);
      setDeleteError(null);
      const res = await fetch(`/api/jamaah/${deleteTarget.id}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Gagal menghapus data jamaah');
      }
      setDeleteTarget(null);
      await loadData();
    } catch (err: any) {
      console.error('Delete jamaah error:', err);
      setDeleteError(err.message || 'Terjadi kesalahan saat menghapus data.');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      {/* Header & Primary Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Database Jamaah</h1>
          <p className="text-xs text-slate-500 mt-1">
            Master database identitas seluruh jamaah (Input Sekali, Dipakai Selamanya).
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

      {/* Instant Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Cari berdasarkan Nama, ID Jamaah, NIK, No. Paspor, atau No. HP..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
          />
        </div>
      </div>

      {/* Master Jamaah Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
        {loading ? (
          <div className="py-16">
            <LoadingSpinner label="Memuat database master jamaah..." />
          </div>
        ) : jamaahList.length === 0 ? (
          <div className="p-12 text-center text-slate-500 space-y-2">
            <p className="font-bold text-slate-800 text-sm">Tidak Ada Data Jamaah Ditemukan</p>
            <p className="text-xs text-slate-400">
              {search ? 'Tidak ada jamaah yang cocok dengan kata kunci pencarian.' : 'Belum ada data jamaah di master database.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="sticky top-0 bg-slate-50 border-b border-slate-200 text-slate-600 font-bold z-10">
                <tr>
                  <th className="py-3 px-3.5 text-center w-12">No</th>
                  <th className="py-3 px-3.5">Nama Sesuai KTP</th>
                  <th className="py-3 px-3.5">ID Jamaah</th>
                  <th className="py-3 px-3.5">ID Internal</th>
                  <th className="py-3 px-3.5">No. HP</th>
                  <th className="py-3 px-3.5">NIK</th>
                  <th className="py-3 px-3.5">No. Paspor</th>
                  <th className="py-3 px-3.5">Keberangkatan Terakhir</th>
                  <th className="py-3 px-3.5 text-center">Dokumen</th>
                  <th className="py-3 px-3.5 text-center w-36">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-normal">
                {jamaahList.map((j, idx) => {
                  const docs = j.documents || [];
                  const coreDocTypes = ['PASSPORT', 'KTP', 'KK', 'VAKSIN', 'BUKU_NIKAH'];
                  const uploadedCount = coreDocTypes.filter(type => docs.some((d: any) => d.document_type === type)).length;
                  const jamaahName = j.ktp_name || j.identity_name || j.passport_name || 'Jamaah Tanpa Nama';

                  return (
                    <tr 
                      key={j.id} 
                      className="hover:bg-slate-50/80 transition-colors group cursor-pointer"
                      onClick={() => setSelectedJamaahId(j.id)}
                    >
                      <td className="py-3 px-3.5 text-center font-mono text-slate-400">
                        {idx + 1}
                      </td>
                      <td className="py-3 px-3.5 font-bold text-slate-900 group-hover:text-emerald-700">
                        {jamaahName}
                      </td>
                      <td className="py-3 px-3.5 font-mono font-medium text-slate-700">
                        {formatJamaahDisplayId(j, idx)}
                      </td>
                      <td className="py-3 px-3.5 font-mono text-slate-400">
                        {j.member_id && j.member_id !== formatJamaahDisplayId(j, idx) ? j.member_id : '-'}
                      </td>
                      <td className="py-3 px-3.5 text-slate-600">
                        {j.phone || '-'}
                      </td>
                      <td className="py-3 px-3.5 font-mono text-slate-600">
                        {j.nik || '-'}
                      </td>
                      <td className="py-3 px-3.5 font-mono font-bold text-slate-800">
                        {j.passport_number || '-'}
                      </td>
                      <td className="py-3 px-3.5 text-slate-700 truncate max-w-[160px]">
                        {j.latest_departure || (j.trips && j.trips[0]?.package?.package_name) || '-'}
                      </td>
                      <td className="py-3 px-3.5 text-center">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold ${
                          uploadedCount >= 5
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-slate-100 text-slate-700'
                        }`}>
                          {uploadedCount}/5
                        </span>
                      </td>
                      <td className="py-3 px-3.5 text-center" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setPassportRecJamaah(j)}
                            className="p-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-lg text-xs font-bold flex items-center gap-1 transition-all"
                            title="Cetak Surat Rekomendasi Paspor"
                          >
                            <FileText className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setSelectedJamaahId(j.id)}
                            className="px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-lg text-xs font-bold flex items-center gap-1 shadow-2xs transition-all"
                            title="Lihat Detail Jamaah"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>Detail</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteTarget({ id: j.id, name: jamaahName })}
                            className="p-1.5 bg-white hover:bg-red-50 text-slate-400 hover:text-red-600 border border-slate-200 hover:border-red-200 rounded-lg text-xs font-bold flex items-center transition-all"
                            title="Hapus Jamaah"
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

        {/* Table Footer */}
        {!loading && jamaahList.length > 0 && (
          <div className="p-3.5 bg-slate-50 border-t border-slate-200 text-xs text-slate-500 flex items-center justify-between">
            <span>Total: {jamaahList.length} Master Jamaah terdaftar</span>
          </div>
        )}
      </div>

      {/* Canonical Jamaah Detail Modal */}
      <UnifiedJamaahDetailModal
        isOpen={!!selectedJamaahId}
        onClose={() => {
          setSelectedJamaahId(null);
          loadData();
        }}
        jamaahId={selectedJamaahId}
      />

      {/* Passport Recommendation Modal */}
      {passportRecJamaah && (
        <PassportRecommendationModal
          isOpen={!!passportRecJamaah}
          onClose={() => setPassportRecJamaah(null)}
          jamaah={passportRecJamaah}
        />
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-100">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-6 space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-100 text-red-600 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 leading-tight">Hapus Data Jamaah</h3>
                <p className="text-xs text-slate-500 mt-0.5">Konfirmasi penghapusan data master</p>
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-700">
              Apakah Anda yakin ingin menghapus data jamaah <span className="font-bold text-slate-900">{deleteTarget.name}</span>?
              <p className="mt-1 text-[11px] text-red-600 font-medium">
                Data yang dihapus tidak akan ditampilkan lagi di master database.
              </p>
            </div>

            {deleteError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 font-medium">
                {deleteError}
              </div>
            )}

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => {
                  setDeleteTarget(null);
                  setDeleteError(null);
                }}
                className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-xl text-xs font-bold transition-all disabled:opacity-50"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleDeleteConfirm}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold shadow-md shadow-red-900/20 flex items-center gap-1.5 transition-all disabled:opacity-50"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Menghapus...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Ya, Hapus Data</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
