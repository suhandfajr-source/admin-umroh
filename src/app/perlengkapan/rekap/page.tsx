'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { 
  PieChart, 
  Download, 
  ArrowLeft, 
  AlertCircle, 
  CheckCircle2, 
  Package as PackageIcon, 
  RefreshCw 
} from 'lucide-react';
import { Package, PackageEquipmentRecap } from '@/types/database.types';

export default function PerlengkapanRekapPage() {
  const [packages, setPackages] = useState<Package[]>([]);
  const [selectedPkgId, setSelectedPkgId] = useState<string>('');
  const [recap, setRecap] = useState<PackageEquipmentRecap | null>(null);
  const [loading, setLoading] = useState(true);
  const [recapLoading, setRecapLoading] = useState(false);

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
      setRecapLoading(true);
      const res = await fetch(`/api/equipment/packages/${pkgId}/recap`);
      const data = await res.json();
      if (data.recap) {
        setRecap(data.recap);
      }
    } catch (err) {
      console.error('Failed to load recap:', err);
    } finally {
      setRecapLoading(false);
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
    <div className="space-y-8 animate-in fade-in duration-150">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-slate-500 text-xs mb-1">
            <Link href="/perlengkapan" className="hover:text-slate-800 transition">Perlengkapan</Link>
            <span>/</span>
            <span>Rekapitulasi Kebutuhan</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2.5">
            <PieChart className="w-6 h-6 text-emerald-600" />
            <span>Rekap Kebutuhan & Ukuran Varian</span>
          </h1>
          <p className="text-slate-500 text-sm mt-0.5">
            Matriks akumulasi kebutuhan perlengkapan, breakdown ukuran pakaian, dan progress serah terima
          </p>
        </div>

        {selectedPkgId && (
          <div className="flex items-center gap-3">
            <a
              href={`/api/equipment/export/report/${selectedPkgId}`}
              className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold flex items-center gap-2 shadow-sm transition"
              download
            >
              <Download className="w-4 h-4" />
              <span>Download Excel Rekap</span>
            </a>
          </div>
        )}
      </div>

      {/* Package Selector */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
        <label className="text-xs font-bold text-slate-700 whitespace-nowrap">Pilih Paket Keberangkatan:</label>
        <select
          value={selectedPkgId}
          onChange={(e) => setSelectedPkgId(e.target.value)}
          className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
        >
          {packages.map((pkg) => (
            <option key={pkg.id} value={pkg.id}>
              {pkg.package_name} ({pkg.departure_date ? new Date(pkg.departure_date).toLocaleDateString('id-ID', { month: 'short', year: 'numeric' }) : 'Tanggal TBD'})
            </option>
          ))}
        </select>
        <button
          onClick={() => fetchRecap(selectedPkgId)}
          className="p-2.5 text-slate-500 hover:text-slate-800 rounded-xl hover:bg-slate-100 transition"
          title="Refresh Data"
        >
          <RefreshCw className={`w-4 h-4 ${recapLoading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {recap && (
        <div className="space-y-6">
          {/* Sizing Breakdown Cards (Items with Variants) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {recap.item_summaries
              .filter((i) => i.requires_variant)
              .map((item) => (
                <div key={item.equipment_item_id} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <div>
                      <h3 className="font-bold text-slate-900 text-base">{item.item_name}</h3>
                      <p className="text-xs text-slate-500">Rincian Ukuran Seragam ({item.total_needed} Pax)</p>
                    </div>
                    <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 rounded-full text-xs font-bold">
                      {item.variant_complete_count}/{item.total_needed} Terisi
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {item.variant_breakdown?.map((vb, vIdx) => (
                      <div
                        key={vIdx}
                        className="p-3 rounded-xl border text-center bg-slate-50 border-slate-200 text-slate-800"
                      >
                        <span className="block text-xs font-semibold uppercase text-slate-500">
                          {vb.label}
                        </span>
                        <span className="block text-xl font-extrabold mt-0.5">
                          {vb.qty_needed}
                        </span>
                        <span className="block text-[10px] text-slate-400 mt-0.5">
                          Diserahkan: {vb.qty_handed_over}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
          </div>

          {/* Complete Item Matrix */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-5 border-b border-slate-100">
              <h3 className="font-bold text-slate-800 text-sm">Rekapitulasi Kebutuhan Keseluruhan Barang</h3>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-500 text-xs font-semibold uppercase tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4">Nama Item</th>
                    <th className="py-3 px-4">Kategori</th>
                    <th className="py-3 px-4">Peruntukan</th>
                    <th className="py-3 px-4 text-right">Kebutuhan</th>
                    <th className="py-3 px-4 text-right">Disiapkan</th>
                    <th className="py-3 px-4 text-right">Diserahkan</th>
                    <th className="py-3 px-4 text-right">Sisa Belum Serah</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700 text-sm">
                  {recap.item_summaries.map((item) => (
                    <tr key={item.equipment_item_id} className="hover:bg-slate-50/60 transition">
                      <td className="py-3.5 px-4 font-semibold text-slate-900">{item.item_name}</td>
                      <td className="py-3.5 px-4 text-xs text-slate-500">{item.category}</td>
                      <td className="py-3.5 px-4 text-xs">
                        {item.applicability === 'ALL' ? 'Semua Jamaah' : item.applicability === 'MALE' ? 'Pria' : 'Wanita'}
                      </td>
                      <td className="py-3.5 px-4 text-right font-bold text-slate-900">{item.total_needed}</td>
                      <td className="py-3.5 px-4 text-right text-emerald-600 font-semibold">{item.total_prepared}</td>
                      <td className="py-3.5 px-4 text-right text-teal-700 font-semibold">{item.total_handed_over}</td>
                      <td className="py-3.5 px-4 text-right text-slate-500 font-medium">{item.total_remaining}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
