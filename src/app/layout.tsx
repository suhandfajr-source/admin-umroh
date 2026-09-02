import type { Metadata } from 'next';
import './globals.css';
import { AppLayout } from '@/components/layout/AppLayout';

export const metadata: Metadata = {
  title: 'Admin Umroh — Sistem Manajemen Jamaah & Operasional',
  description: 'Aplikasi internal Admin Travel Umroh untuk manajemen master jamaah, dokumen, dan paket.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id">
      <body className="bg-slate-50 text-slate-900 min-h-screen">
        <AppLayout>{children}</AppLayout>
      </body>
    </html>
  );
}
