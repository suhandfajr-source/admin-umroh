'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Search, User, Package, Contact2, X, ArrowRight, CornerDownLeft } from 'lucide-react';
import { Jamaah, Package as PackageType, PIC } from '@/types/database.types';

interface GlobalSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const GlobalSearchModal: React.FC<GlobalSearchModalProps> = ({ isOpen, onClose }) => {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<{
    jamaah: Jamaah[];
    packages: PackageType[];
    pics: PIC[];
  }>({ jamaah: [], packages: [], pics: [] });
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery('');
      setResults({ jamaah: [], packages: [], pics: [] });
    }
  }, [isOpen]);

  useEffect(() => {
    if (!query.trim()) {
      setResults({ jamaah: [], packages: [], pics: [] });
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
        const data = await res.json();
        setResults(data);
      } catch (err) {
        console.error('Search error:', err);
      } finally {
        setLoading(false);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [query]);

  if (!isOpen) return null;

  const handleSelect = (url: string) => {
    onClose();
    router.push(url);
  };

  const hasResults = results.jamaah.length > 0 || results.packages.length > 0 || results.pics.length > 0;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-start justify-center pt-20 p-4">
      <div className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-100">
        {/* Search Input Bar */}
        <div className="flex items-center px-4 py-3.5 border-b border-slate-100 bg-slate-50/50">
          <Search className="w-5 h-5 text-slate-400 mr-3 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cari Jamaah, No. Paspor, NIK, Paket, atau PIC... (Tekan Esc untuk keluar)"
            className="w-full bg-transparent text-slate-900 placeholder:text-slate-400 text-sm focus:outline-hidden"
          />
          {query && (
            <button onClick={() => setQuery('')} className="p-1 text-slate-400 hover:text-slate-600 rounded">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Results Container */}
        <div className="max-h-[60vh] overflow-y-auto p-4 space-y-4">
          {loading && (
            <div className="py-8 text-center text-xs text-slate-400 font-medium animate-pulse">
              Mencari data ke seluruh database...
            </div>
          )}

          {!loading && query && !hasResults && (
            <div className="py-8 text-center text-sm text-slate-500">
              Tidak ditemukan hasil untuk <span className="font-semibold text-slate-700">"{query}"</span>
            </div>
          )}

          {!query && (
            <div className="py-6 text-center text-xs text-slate-400">
              Ketik minimal 1 karakter untuk mulai mencari di seluruh database.
            </div>
          )}

          {/* Jamaah Results */}
          {results.jamaah.length > 0 && (
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 px-2 mb-1.5">
                Master Jamaah ({results.jamaah.length})
              </p>
              <div className="space-y-1">
                {results.jamaah.map((j) => (
                  <button
                    key={j.id}
                    onClick={() => handleSelect(`/jamaah/${j.id}`)}
                    className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-emerald-50/70 border border-transparent hover:border-emerald-200 transition-all text-left group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-xs">
                        <User className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-800 group-hover:text-emerald-900">
                          {j.identity_name}
                        </p>
                        <p className="text-xs text-slate-500">
                          Paspor: {j.passport_number || '-'} • NIK: {j.nik || '-'}
                        </p>
                      </div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-emerald-600 transition-transform group-hover:translate-x-0.5" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Package Results */}
          {results.packages.length > 0 && (
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 px-2 mb-1.5">
                Paket Umrah ({results.packages.length})
              </p>
              <div className="space-y-1">
                {results.packages.map((pkg) => (
                  <button
                    key={pkg.id}
                    onClick={() => handleSelect(`/paket/${pkg.id}`)}
                    className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-sky-50/70 border border-transparent hover:border-sky-200 transition-all text-left group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-sky-100 text-sky-700 flex items-center justify-center">
                        <Package className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-800 group-hover:text-sky-900">
                          {pkg.package_name}
                        </p>
                        <p className="text-xs text-slate-500">
                          Keberangkatan: {pkg.departure_date} • Maskapai: {pkg.airline || '-'}
                        </p>
                      </div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-sky-600 transition-transform group-hover:translate-x-0.5" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* PIC Results */}
          {results.pics.length > 0 && (
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 px-2 mb-1.5">
                PIC ({results.pics.length})
              </p>
              <div className="space-y-1">
                {results.pics.map((pic) => (
                  <button
                    key={pic.id}
                    onClick={() => handleSelect(`/pic`)}
                    className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-purple-50/70 border border-transparent hover:border-purple-200 transition-all text-left group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center">
                        <Contact2 className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-800 group-hover:text-purple-900">
                          {pic.name}
                        </p>
                        <p className="text-xs text-slate-500">
                          Telepon: {pic.phone || '-'}
                        </p>
                      </div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-purple-600 transition-transform group-hover:translate-x-0.5" />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer shortcuts */}
        <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-3">
            <span>Pencarian Cepat Seluruh Modul</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="bg-white px-1.5 py-0.5 rounded border border-slate-200 shadow-2xs text-[10px] font-semibold">ESC</span>
            <span>untuk tutup</span>
          </div>
        </div>
      </div>
    </div>
  );
};
