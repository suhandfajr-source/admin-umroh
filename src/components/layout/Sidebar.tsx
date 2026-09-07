'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  LayoutDashboard, 
  ShieldAlert,
  Users, 
  UploadCloud,
  FileCheck2,
  Package,
  UserCheck,
  Contact2,
  Wallet,
  Receipt,
  CreditCard, 
  Inbox,
  FileSpreadsheet,
  Plane,
  Archive,
  Boxes,
  Luggage,
  PackageCheck,
  History,
  Settings,
  Compass,
  ChevronDown,
  ChevronRight
} from 'lucide-react';

interface NavSubItem {
  label: string;
  href: string;
  icon: React.ElementType;
}

interface NavDropdownGroup {
  id: string;
  title: string;
  icon: React.ElementType;
  items: NavSubItem[];
}

export const Sidebar: React.FC = () => {
  const pathname = usePathname();

  const isCurrent = (path: string) => {
    if (path === '/dashboard') {
      return pathname === '/' || pathname === '/dashboard';
    }
    if (path === '/jamaah') {
      return pathname === '/jamaah';
    }
    if (path === '/finance') {
      return pathname === '/finance';
    }
    if (path === '/perlengkapan') {
      return pathname === '/perlengkapan';
    }
    if (path === '/paket') {
      return pathname === '/paket' || (pathname.startsWith('/paket/') && !pathname.startsWith('/paket/peserta'));
    }
    if (path === '/pengaturan') {
      return pathname === '/pengaturan';
    }
    return pathname.startsWith(path);
  };

  const navGroups: NavDropdownGroup[] = [
    {
      id: 'operasional',
      title: 'Operasional',
      icon: LayoutDashboard,
      items: [
        { label: 'Dashboard Overview', href: '/dashboard', icon: LayoutDashboard },
        { label: 'Action Center', href: '/action-center', icon: ShieldAlert },
      ],
    },
    {
      id: 'jamaah',
      title: 'Master Jamaah',
      icon: Users,
      items: [
        { label: 'Database Jamaah', href: '/jamaah', icon: Users },
      ],
    },
    {
      id: 'paket',
      title: 'Paket Umroh',
      icon: Package,
      items: [
        { label: 'Daftar Paket', href: '/paket', icon: Package },
        { label: 'Peserta Paket', href: '/paket/peserta', icon: UserCheck },
        { label: 'Master PIC / Agen', href: '/pic', icon: Contact2 },
      ],
    },
    {
      id: 'finance',
      title: 'Keuangan & Bayar',
      icon: Wallet,
      items: [
        { label: 'Finance Hub', href: '/finance', icon: Wallet },
        { label: 'Tagihan (Invoice)', href: '/finance/tagihan', icon: Receipt },
        { label: 'Pembayaran', href: '/finance/pembayaran', icon: CreditCard },
        { label: 'Payment Inbox', href: '/finance/inbox', icon: Inbox },
        { label: 'Laporan Keuangan', href: '/finance/laporan-paket', icon: FileSpreadsheet },
      ],
    },
    {
      id: 'manifest',
      title: 'Manifest & Arsip',
      icon: Plane,
      items: [
        { label: 'Manifest Generator', href: '/manifest', icon: Plane },
        { label: 'Arsip Dokumen (Zip)', href: '/dokumen/arsip', icon: Archive },
      ],
    },
    {
      id: 'perlengkapan',
      title: 'Perlengkapan',
      icon: Boxes,
      items: [
        { label: 'Hub Perlengkapan', href: '/perlengkapan', icon: Boxes },
        { label: 'Penyerahan Barang', href: '/perlengkapan/penyerahan', icon: Luggage },
        { label: 'Rekap & Inventaris', href: '/perlengkapan/rekap', icon: PackageCheck },
      ],
    },
    {
      id: 'sistem',
      title: 'Sistem & Audit',
      icon: Settings,
      items: [
        { label: 'Audit Log Trail', href: '/audit-log', icon: History },
        { label: 'Pengaturan Sistem', href: '/pengaturan', icon: Settings },
      ],
    },
  ];

  // Keep track of which dropdown menus are open
  const [openSections, setOpenSections] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    // Auto-open groups that contain current route or open first 2 by default
    navGroups.forEach((group, index) => {
      const hasActiveChild = group.items.some(item => isCurrent(item.href));
      initial[group.id] = hasActiveChild || index === 0;
    });
    return initial;
  });

  // Auto-expand dropdown when pathname changes to an item within that group
  useEffect(() => {
    navGroups.forEach((group) => {
      const hasActiveChild = group.items.some(item => isCurrent(item.href));
      if (hasActiveChild) {
        setOpenSections(prev => ({ ...prev, [group.id]: true }));
      }
    });
  }, [pathname]);

  const toggleSection = (id: string) => {
    setOpenSections(prev => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <aside className="w-64 bg-slate-900 text-slate-300 flex flex-col shrink-0 border-r border-slate-800 min-h-screen">
      {/* Brand Header */}
      <div className="h-16 flex items-center gap-3 px-5 border-b border-slate-800 bg-slate-950/40 sticky top-0 z-10">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-400 flex items-center justify-center text-white shadow-lg shadow-emerald-900/30 shrink-0">
          <Compass className="w-5 h-5" />
        </div>
        <div className="min-w-0">
          <h1 className="font-bold text-slate-100 text-sm leading-tight tracking-tight truncate">Admin Umroh</h1>
          <p className="text-[10px] text-emerald-400 font-semibold tracking-wider uppercase">Operasional Wahidku</p>
        </div>
      </div>

      {/* Navigation Dropdown Menu Groups */}
      <div className="flex-1 py-4 px-3 space-y-1.5 overflow-y-auto custom-scrollbar">
        <div className="px-2.5 pb-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">
          Menu Utama
        </div>

        {navGroups.map((group) => {
          const GroupIcon = group.icon;
          const isOpen = !!openSections[group.id];
          const hasActiveChild = group.items.some(item => isCurrent(item.href));

          return (
            <div key={group.id} className="rounded-xl overflow-hidden transition-all">
              {/* Dropdown Header Trigger */}
              <button
                type="button"
                onClick={() => toggleSection(group.id)}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-all group ${
                  hasActiveChild && !isOpen
                    ? 'bg-slate-800 text-emerald-400 shadow-xs'
                    : 'text-slate-300 hover:text-slate-100 hover:bg-slate-800/70'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <GroupIcon className={`w-4 h-4 shrink-0 transition-colors ${
                    hasActiveChild ? 'text-emerald-400' : 'text-slate-400 group-hover:text-slate-200'
                  }`} />
                  <span className="truncate">{group.title}</span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0 ml-1">
                  {hasActiveChild && !isOpen && (
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                  )}
                  <ChevronDown className={`w-3.5 h-3.5 text-slate-500 transition-transform duration-200 ${
                    isOpen ? 'rotate-180 text-slate-300' : ''
                  }`} />
                </div>
              </button>

              {/* Collapsible Submenu */}
              {isOpen && (
                <div className="mt-1 mb-1 ml-4 pl-2.5 border-l border-slate-800/80 space-y-0.5 animate-in fade-in slide-in-from-top-1 duration-150">
                  {group.items.map((item) => {
                    const SubIcon = item.icon;
                    const active = isCurrent(item.href);

                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        prefetch={true}
                        className={`flex items-center justify-between px-2.5 py-2 rounded-lg text-xs transition-all group ${
                          active
                            ? 'bg-emerald-600 text-white font-semibold shadow-xs shadow-emerald-900/30'
                            : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 font-medium'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <SubIcon className={`w-3.5 h-3.5 shrink-0 transition-transform group-hover:scale-105 ${
                            active ? 'text-white' : 'text-slate-400'
                          }`} />
                          <span className="truncate">{item.label}</span>
                        </div>
                        {active && <ChevronRight className="w-3 h-3 opacity-90 shrink-0 ml-1" />}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer Info */}
      <div className="p-3.5 border-t border-slate-800/80 bg-slate-950/30 text-[11px] text-slate-500 flex items-center justify-between sticky bottom-0">
        <span className="font-medium">Admin Umroh v2.0</span>
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          <span className="text-slate-400 font-semibold">Online</span>
        </span>
      </div>
    </aside>
  );
};
