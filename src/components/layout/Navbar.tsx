'use client';

import React, { useState, useEffect } from 'react';
import { Search, Bell, ShieldCheck, User } from 'lucide-react';
import { GlobalSearchModal } from './GlobalSearchModal';

export const Navbar: React.FC = () => {
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <>
      <header className="h-16 bg-white border-b border-slate-200/80 px-8 flex items-center justify-between sticky top-0 z-30 shadow-2xs">
        {/* Global Search trigger bar */}
        <div className="flex items-center gap-4 flex-1 max-w-xl">
          <button
            onClick={() => setSearchOpen(true)}
            className="w-full flex items-center justify-between px-3.5 py-2 bg-slate-50 hover:bg-slate-100/80 border border-slate-200 rounded-xl text-slate-400 text-sm transition-all shadow-2xs group"
          >
            <div className="flex items-center gap-2.5">
              <Search className="w-4 h-4 text-slate-400 group-hover:text-slate-600" />
              <span className="text-xs text-slate-400 group-hover:text-slate-600">Cari Jamaah, Paspor, NIK, Paket, atau PIC...</span>
            </div>
            <kbd className="hidden sm:inline-flex items-center gap-0.5 px-2 py-0.5 text-[10px] font-semibold text-slate-500 bg-white border border-slate-200 rounded shadow-2xs">
              Ctrl K
            </kbd>
          </button>
        </div>

        {/* Right admin profile badge */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-xs font-semibold px-2.5 py-1 bg-emerald-50 text-emerald-700 rounded-lg border border-emerald-200/60">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Admin Authenticated</span>
          </div>

          <div className="flex items-center gap-3 pl-3 border-l border-slate-200">
            <div className="w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center font-bold text-xs shadow-sm">
              <User className="w-4 h-4" />
            </div>
            <div className="hidden md:block text-left">
              <p className="text-xs font-bold text-slate-800 leading-tight">Admin Operasional</p>
              <p className="text-[10px] text-slate-400">admin@travelumroh.com</p>
            </div>
          </div>
        </div>
      </header>

      <GlobalSearchModal isOpen={searchOpen} onClose={() => setSearchOpen(false)} />
    </>
  );
};
