'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { 
  Luggage, 
  Boxes, 
  CheckCircle2, 
  Clock, 
  AlertTriangle, 
  ArrowRight, 
  PackageCheck, 
  RefreshCw,
  FileSpreadsheet,
  Users
} from 'lucide-react';
import { Package, PackageEquipmentRecap } from '@/types/database.types';

export default function PerlengkapanOverviewPage() {
  const [packages, setPackages] = useState<Package[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPkgId, setSelectedPkgId] = useState<string>('');
  const [recap, setRecap] = useState<PackageEquipmentRecap | null>(null);

  const fetchPackages = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/packages');
      const data = await res.json();
      if (data.packages) {
        setPackages(data.packages);
        if (data.packages.length > 0 && !selectedPkgId) {
          setSelectedPkgId(data.packages[0].id);
        }
      }
    } catch (err) {
      console.error('Failed to load packages:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchRecap = async (pkgId: string) => {
    if (!pkgId) return;
    try {
      const res = await fetch(`/api/equipment/packages/${pkgId}/recap`);
      const data = await res.json();
      if (data.recap) {
        setRecap(data.recap);
      }
    } catch (err) {
      console.error('Failed to load recap:', err);
    }
  };

  useEffect(() => {
    fetchPackages();
  }, []);

  useEffect(() => {
    if (selectedPkgId) {
      fetchRecap(selectedPkgId);
    }
  }, [selectedPkgId]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 bg-emerald-100 text-emerald-800 rounded-xl">
              <Luggage className="w-5 h-5" />
            </span>
            <h1 className="text-xl font-bold text-slate-800">Monitoring Perlengkapan Jamaah</h1>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Pantau kebutuhan seragam, koper, mukena, ihram, dan status serah terima per paket keberangkatan.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/perlengkapan/penyerahan"
            className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-sm rounded-xl transition shadow-sm"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>Meja Serah Terima</span>
          </Link>
          <Link
            href="/perlengkapan/paket"
            className="flex items-center gap-2 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium text-sm rounded-xl transition"
          >
            <Boxes className="w-4 h-4" />
            <span>Atur Item Paket</span>
          </Link>
        </div>
      </div>

      {/* Package Selector Filter */}
      <div className="flex items-center gap-4 bg-white p-4 rounded-xl border border-slate-200">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Pilih Paket:</span>
        <select
          value={selectedPkgId}
          onChange={(e) => setSelectedPkgId(e.target.value)}
          className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
        >
          {packages.map((pkg) => (
            <option key={pkg.id} value={pkg.id}>
              {pkg.package_name} ({new Date(pkg.departure_date).toLocaleDateString('id-ID')})
            </option>
          ))}
        </select>
        <button
          onClick={() => selectedPkgId && fetchRecap(selectedPkgId)}
          className="p-1.5 hover:bg-slate-100 text-slate-600 rounded-lg transition"
          title="Refresh Data"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* KPI Cards */}
      {recap && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Jamaah Aktif</span>
              <span className="p-2 bg-blue-50 text-blue-600 rounded-lg"><Users className="w-4 h-4" /></span>
            </div>
            <div className="mt-3">
              <span className="text-2xl font-bold text-slate-900">{recap.total_active_participants}</span>
              <span className="text-xs text-slate-500 ml-1">Pax</span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Pria: {recap.male_count} | Wanita: {recap.female_count} {recap.unknown_gender_count > 0 && `| Gender ?: ${recap.unknown_gender_count}`}
            </p>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Kebutuhan Item</span>
              <span className="p-2 bg-slate-100 text-slate-700 rounded-lg"><Boxes className="w-4 h-4" /></span>
            </div>
            <div className="mt-3">
              <span className="text-2xl font-bold text-slate-900">{recap.total_items_needed}</span>
              <span className="text-xs text-slate-500 ml-1">Item</span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Disiapkan: {recap.total_items_ready} | Diserahkan: {recap.total_items_handed_over}
            </p>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Jamaah Siap Diambil</span>
              <span className="p-2 bg-emerald-50 text-emerald-600 rounded-lg"><Clock className="w-4 h-4" /></span>
            </div>
            <div className="mt-3">
              <span className="text-2xl font-bold text-emerald-600">{recap.pax_fully_ready_count}</span>
              <span className="text-xs text-slate-500 ml-1">/ {recap.total_active_participants} Pax</span>
            </div>
            <div className="w-full bg-slate-100 h-1.5 rounded-full mt-2 overflow-hidden">
              <div 
                className="bg-emerald-500 h-full rounded-full" 
                style={{ width: `${recap.total_active_participants > 0 ? (recap.pax_fully_ready_count / recap.total_active_participants) * 100 : 0}%` }}
              />
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Lengkap Diserahkan</span>
              <span className="p-2 bg-teal-50 text-teal-600 rounded-lg"><CheckCircle2 className="w-4 h-4" /></span>
            </div>
            <div className="mt-3">
              <span className="text-2xl font-bold text-teal-700">{recap.pax_fully_handed_over_count}</span>
              <span className="text-xs text-slate-500 ml-1">/ {recap.total_active_participants} Pax</span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Belum Lengkap: {recap.total_active_participants - recap.pax_fully_handed_over_count} Pax
            </p>
          </div>
        </div>
      )}

      {/* Action Required Alerts */}
      {recap && (recap.missing_variants_pax_count > 0 || recap.action_required.missing_gender_participants.length > 0) && (
        <div className="bg-amber-50 border border-amber-200 p-5 rounded-2xl">
          <div className="flex items-center gap-2 text-amber-800 font-semibold text-sm">
            <AlertTriangle className="w-5 h-5" />
            <span>Perhatian Operasional (Action Required)</span>
          </div>

          <div className="mt-3 space-y-2 text-xs text-amber-900">
            {recap.action_required.missing_gender_participants.length > 0 && (
              <div className="flex items-start gap-2">
                <span className="font-bold">•</span>
                <span>
                  <strong>{recap.action_required.missing_gender_participants.length} Jamaah</strong> belum memiliki data jenis kelamin (Gender NULL). Item khusus gender (Ihram/Mukena) belum dapat ditentukan otomatis.
                </span>
              </div>
            )}

            {recap.missing_variants_pax_count > 0 && (
              <div className="flex items-start gap-2">
                <span className="font-bold">•</span>
                <span>
                  <strong>{recap.missing_variants_pax_count} Jamaah</strong> belum memilih ukuran baju/seragam. Segera input varian agar penyiapan seragam dapat diselesaikan.
                </span>
              </div>
            )}
          </div>

          <div className="mt-4 flex items-center gap-3">
            <Link
              href={`/perlengkapan/penyerahan?missingVariant=true`}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-700 text-white rounded-lg text-xs font-semibold hover:bg-amber-800 transition"
            >
              <span>Isi Ukuran Jamaah</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      )}

      {/* Item Summary Table */}
      {recap && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-slate-100 flex items-center justify-between">
            <h2 className="font-bold text-slate-800 text-sm">Rekap Perlengkapan Per Item</h2>
            <Link
              href={`/perlengkapan/rekap`}
              className="text-xs font-medium text-emerald-600 hover:text-emerald-700 flex items-center gap-1"
            >
              <span>Lihat Detail Rekap & Ukuran</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-500 text-xs font-semibold uppercase tracking-wider border-b border-slate-200">
                <tr>
                  <th className="py-3.5 px-4">Nama Perlengkapan</th>
                  <th className="py-3.5 px-4">Kategori</th>
                  <th className="py-3.5 px-4">Aturan</th>
                  <th className="py-3.5 px-4 text-right">Kebutuhan</th>
                  <th className="py-3.5 px-4 text-right">Siap</th>
                  <th className="py-3.5 px-4 text-right">Diserahkan</th>
                  <th className="py-3.5 px-4 text-right">Sisa</th>
                  <th className="py-3.5 px-4 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700 text-sm">
                {recap.item_summaries.map((item) => (
                  <tr key={item.equipment_item_id} className="hover:bg-slate-50/60 transition">
                    <td className="py-3 px-4 font-medium text-slate-900">
                      {item.item_name}
                      {item.requires_variant && item.unassigned_variant_count !== undefined && item.unassigned_variant_count > 0 && (
                        <span className="block text-[11px] text-amber-600 font-normal">
                          {item.unassigned_variant_count} jamaah belum pilih ukuran
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-500">{item.category}</td>
                    <td className="py-3 px-4 text-xs">
                      {item.applicability === 'ALL' ? (
                        <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded">Semua</span>
                      ) : item.applicability === 'MALE' ? (
                        <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded font-medium">Pria</span>
                      ) : (
                        <span className="px-2 py-0.5 bg-rose-50 text-rose-700 rounded font-medium">Wanita</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right font-semibold text-slate-900">{item.total_needed}</td>
                    <td className="py-3 px-4 text-right text-emerald-600 font-medium">{item.total_prepared}</td>
                    <td className="py-3 px-4 text-right text-teal-700 font-medium">{item.total_handed_over}</td>
                    <td className="py-3 px-4 text-right text-slate-500">{item.total_remaining}</td>
                    <td className="py-3 px-4 text-center">
                      {item.total_handed_over >= item.total_needed && item.total_needed > 0 ? (
                        <span className="px-2 py-1 bg-teal-100 text-teal-800 rounded-full text-[11px] font-semibold">
                          Selesai
                        </span>
                      ) : item.total_prepared >= item.total_needed && item.total_needed > 0 ? (
                        <span className="px-2 py-1 bg-emerald-100 text-emerald-800 rounded-full text-[11px] font-semibold">
                          Siap Diambil
                        </span>
                      ) : (
                        <span className="px-2 py-1 bg-slate-100 text-slate-600 rounded-full text-[11px] font-medium">
                          Proses ({item.total_prepared}/{item.total_needed})
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
