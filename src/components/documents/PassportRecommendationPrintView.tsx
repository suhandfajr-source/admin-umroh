'use client';

import React from 'react';
import { 
  PassportRecommendationLetterData, 
  formatIndonesianDate 
} from '@/lib/recommendation-letter';

interface PassportRecommendationPrintViewProps {
  data: PassportRecommendationLetterData;
  forPrintOnly?: boolean;
}

export const PassportRecommendationPrintView: React.FC<PassportRecommendationPrintViewProps> = ({
  data,
  forPrintOnly = false,
}) => {
  const getPurposeText = (p: string) => {
    switch (p) {
      case 'PEMBUATAN_BARU':
        return 'Pembuatan Paspor Baru (Umrah)';
      case 'PERPANJANGAN_PENGGANTIAN':
        return 'Penggantian / Perpanjangan Paspor (Habis Masa Berlaku)';
      case 'HALAMAN_PENUH':
        return 'Penggantian Paspor (Halaman Penuh)';
      case 'RUSAK_HILANG':
        return 'Penggantian Paspor (Rusak / Hilang)';
      default:
        return 'Pembuatan / Penggantian Paspor';
    }
  };

  const getGenderText = (g?: string | null) => {
    if (!g) return '-';
    if (g === 'MALE' || g === 'L' || g.toLowerCase() === 'laki-laki') return 'Laki-Laki';
    if (g === 'FEMALE' || g === 'P' || g.toLowerCase() === 'perempuan') return 'Perempuan';
    return g;
  };

  const formattedLetterDate = formatIndonesianDate(data.letterDate);
  const formattedBirthDate = formatIndonesianDate(data.birthDate);
  const formattedDepartureDate = formatIndonesianDate(data.departureDate);

  const hasCustomBg = data.useUploadedLetterhead && !!data.letterheadImageUrl;

  return (
    <div
      className={`relative bg-white text-slate-900 font-serif leading-relaxed ${
        forPrintOnly
          ? 'print-letter-container'
          : 'max-w-[210mm] min-h-[297mm] mx-auto border border-slate-300 shadow-xl text-[13px]'
      } ${
        hasCustomBg 
          ? 'pt-[130px] pb-[85px] px-[48px] sm:px-[52px]' 
          : 'p-8 sm:p-12'
      }`}
      style={{
        width: forPrintOnly ? '100%' : '210mm',
        minHeight: forPrintOnly ? '100%' : '297mm',
        fontFamily: "'Times New Roman', Times, serif",
        backgroundImage: hasCustomBg ? `url('${data.letterheadImageUrl}')` : undefined,
        backgroundSize: '100% 100%',
        backgroundRepeat: 'no-repeat',
        backgroundPosition: 'top center',
        WebkitPrintColorAdjust: 'exact',
        printColorAdjust: 'exact',
      }}
    >
      {/* 1. KOP SURAT RESMI TRAVEL */}
      <div className="border-b-2 border-double border-slate-900 pb-3 mb-6 text-center">
        <h2 className="text-xl font-bold tracking-wide uppercase text-slate-900">
          KOP SURAT RESMI TRAVEL
        </h2>
        <p className="text-xs font-sans font-semibold text-slate-700 tracking-tight mt-0.5">
          PENYELENGGARA PERJALANAN IBADAH UMRAH (PPIU)
        </p>
      </div>

      {/* 2. NOMOR & INFORMASI SURAT */}
      <div className="flex justify-between items-start mb-6 text-xs sm:text-[13px]">
        <div>
          <table className="text-left border-collapse">
            <tbody>
              <tr>
                <td className="pr-4 py-0.5 font-bold align-top w-20">Nomor</td>
                <td className="pr-2 py-0.5 align-top">:</td>
                <td className="py-0.5 font-sans font-bold text-slate-900">{data.letterNumber}</td>
              </tr>
              <tr>
                <td className="pr-4 py-0.5 font-bold align-top">Hal / Perihal</td>
                <td className="pr-2 py-0.5 align-top">:</td>
                <td className="py-0.5 font-bold underline text-slate-900">
                  {getPurposeText(data.purpose)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="text-right font-medium">
          <p>
            {data.city || 'Bogor'}, {formattedLetterDate}
          </p>
        </div>
      </div>

      {/* 3. TUJUAN SURAT (KANTOR IMIGRASI) */}
      <div className="mb-5 text-xs sm:text-[13px]">
        <p className="font-bold text-slate-800">Kepada Yth.</p>
        <p className="font-bold text-slate-900 text-sm">{data.immigrationOffice || 'Kepala Kantor Imigrasi di Tempat'}</p>
        <p className="text-slate-700">di Tempat</p>
      </div>

      {/* 4. SALAM PEMBUKA & KATA PENGANTAR */}
      <div className="mb-4 text-justify text-xs sm:text-[13px] leading-relaxed">
        <p className="mb-2">
          <em>Assalamu’alaikum Warahmatullahi Wabarakatuh,</em>
        </p>
        <p>
          Yang bertanda tangan di bawah ini Pimpinan Penyelenggara Perjalanan Ibadah Umrah (PPIU){' '}
          <strong>{data.companyName || 'Travel Umroh'}</strong>, menerangkan dengan sebenarnya bahwa calon jamaah kami:
        </p>
      </div>

      {/* 5. TABEL IDENTITAS JAMAAH (7 TAG UTAMA) */}
      <div className="my-4 pl-3 sm:pl-6 text-xs sm:text-[13px]">
        <table className="w-full text-left border-collapse">
          <tbody>
            <tr>
              <td className="py-1 pr-4 font-bold w-48 align-top text-slate-800">Nama Lengkap</td>
              <td className="py-1 pr-2 align-top">:</td>
              <td className="py-1 font-bold text-slate-900 uppercase">
                {data.jamaahName || '-'}
              </td>
            </tr>
            <tr>
              <td className="py-1 pr-4 font-bold align-top text-slate-800">Tempat, Tanggal Lahir</td>
              <td className="py-1 pr-2 align-top">:</td>
              <td className="py-1 text-slate-900">
                {data.birthPlace ? `${data.birthPlace}, ` : ''}{formattedBirthDate}
              </td>
            </tr>
            <tr>
              <td className="py-1 pr-4 font-bold align-top text-slate-800">Alamat</td>
              <td className="py-1 pr-2 align-top">:</td>
              <td className="py-1 leading-normal text-slate-900">
                {data.address || '-'}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* 6. PERNYATAAN MAKSUD & TANGGAL KEBERANGKATAN */}
      <div className="mb-6 text-justify text-xs sm:text-[13px] leading-relaxed space-y-2.5">
        <p>
          Adalah benar telah terdaftar sebagai calon jamaah Umrah pada travel kami dan direncanakan akan diberangkatkan ke Tanah Suci pada tanggal:
        </p>
        <p className="text-center py-1.5 font-bold text-sm bg-slate-50/80 border border-slate-200 rounded print:bg-transparent print:border-none tracking-wide text-slate-900">
          {formattedDepartureDate !== '-' ? formattedDepartureDate : 'Sesuai Jadwal Musim Umrah'}
        </p>
        <p>
          Sehubungan dengan hal tersebut di atas, kami memohon bantuan Bapak/Ibu agar dapat memproses{' '}
          <strong>{getPurposeText(data.purpose)}</strong> atas nama yang bersangkutan sebagai dokumen kelengkapan perjalanan ibadah Umrah.
        </p>
        <p>
          Demikian surat rekomendasi ini kami buat dengan sebenarnya untuk dapat dipergunakan sebagaimana mestinya.
        </p>
        <p className="pt-1">
          <em>Wassalamu’alaikum Warahmatullahi Wabarakatuh.</em>
        </p>
      </div>

      {/* 7. SALAM PENUTUP & TANDA TANGAN */}
      <div className="mt-8 flex justify-end text-xs sm:text-[13px]">
        <div className="w-64 text-center">
          <p className="font-bold text-slate-900">{data.companyName || 'Pimpinan Travel'}</p>
          
          {/* Signature Area (Space for Physical Stamp or Signature) */}
          <div className="h-20 flex items-center justify-center my-2 relative">
            <div className="text-slate-300 print:text-transparent text-[10px] italic">
              [ Tanda Tangan & Cap Travel ]
            </div>
          </div>

          <p className="font-bold underline text-slate-900 uppercase">
            {data.signatoryName || 'Direktur Utama'}
          </p>
          <p className="text-slate-700">{data.signatoryRole || 'Direktur Utama'}</p>
        </div>
      </div>
    </div>
  );
};
