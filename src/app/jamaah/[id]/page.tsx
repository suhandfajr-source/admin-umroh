'use client';

import React from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { UnifiedJamaahDetailView } from '@/components/jamaah/UnifiedJamaahDetailView';

export default function JamaahDetailPage() {
  const params = useParams();
  const jamaahId = params.id as string;

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-in fade-in duration-150">
      {/* Top Breadcrumb */}
      <div className="flex items-center gap-3">
        <Link
          href="/jamaah"
          className="p-2 text-slate-400 hover:text-slate-700 hover:bg-white rounded-xl border border-slate-200 shadow-2xs transition-all flex items-center gap-1.5 text-xs font-bold"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Kembali ke Database</span>
        </Link>
      </div>

      <UnifiedJamaahDetailView jamaahId={jamaahId} />
    </div>
  );
}
