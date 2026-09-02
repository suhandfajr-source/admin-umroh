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
      {/* 1. KOP SURAT (Only shown if custom background is not used) */}
      {!hasCustomBg && (
        <>
          {data.companyName ? (
            <div className="border-b-2 border-double border-slate-900 pb-3 mb-6 text-center">
              <h2 className="text-xl font-bold tracking-wide uppercase text-slate-900">
                {data.companyName || 'PT. TRAVEL UMROH INDONESIA'}
              </h2>
              <p className="text-xs font-sans font-semibold text-slate-700 tracking-tight mt-0.5">
                PENYELENGGARA PERJALANAN IBADAH UMRAH (PPIU)
              </p>
              <p className="text-[11px] font-sans text-slate-600 mt-0.5">
                {data.companyLegalNumber || 'Izin Kemenag RI No. PPIU Terdaftar'}
              </p>
              <p className="text-[11px] font-sans text-slate-600 mt-0.5">
                {data.companyAddress || 'Alamat Kantor Pusat Travel Umroh'}
              </p>
              <p className="text-[10px] font-sans text-slate-500">
                Telp: {data.companyPhone || '-'} • Email: {data.companyEmail || '-'}
              </p>
            </div>
          ) : (
            /* Spacing for Pre-printed Physical Letterhead */
            <div className="h-28 sm:h-32 mb-4 border-b border-dashed border-slate-200 print:border-none flex items-center justify-center text-slate-400 font-sans text-xs italic">
              <span className="print:hidden">[ Area Kop Surat Resmi Perusahaan (Pre-printed Letterhead) ]</span>
            </div>
          )}
        </>
      )}

      {/* 2. NOMOR & INFORMASI SURAT */}
      <div className="flex justify-between items-start mb-5 text-xs sm:text-[13px]">
        <div>
          <table className="text-left border-collapse">
            <tbody>
              <tr>
                <td className="pr-4 py-0.5 font-bold align-top w-20">Nomor</td>
                <td className="pr-2 py-0.5 align-top">:</td>
                <td className="py-0.5 font-sans font-bold text-slate-900">{data.letterNumber}</td>
              </tr>
              <tr>
                <td className="pr-4 py-0.5 font-bold align-top">Lampiran</td>
                <td className="pr-2 py-0.5 align-top">:</td>
                <td className="py-0.5">-</td>
              </tr>
              <tr>
                <td className="pr-4 py-0.5 font-bold align-top">Perihal</td>
                <td className="pr-2 py-0.5 align-top">:</td>
                <td className="py-0.5 font-bold underline">
                  Rekomendasi {getPurposeText(data.purpose)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="text-right">
          <p>
            {data.city || 'Bogor'}, {formattedLetterDate}
          </p>
        </div>
      </div>

      {/* 3. TUJUAN SURAT */}
      <div className="mb-5 text-xs sm:text-[13px]">
        <p className="font-bold">Kepada Yth.</p>
        <p className="font-bold text-slate-900">{data.immigrationOffice || 'Kepala Kantor Imigrasi'}</p>
        <p>Di Tempat</p>
      </div>

      {/* 4. SALAM PEMBUKA & KATA PENGANTAR */}
      <div className="mb-3.5 text-justify text-xs sm:text-[13px] leading-relaxed">
        <p className="mb-2">
          <em>Assalamu’alaikum Warahmatullahi Wabarakatuh,</em>
        </p>
        <p>
          Dengan hormat, yang bertanda tangan di bawah ini pimpinan Penyelenggara Perjalanan Ibadah Umrah (PPIU){' '}
          <strong>{data.companyName || 'Travel Umroh'}</strong>, menerangkan dengan sebenarnya bahwa:
        </p>
      </div>

      {/* 5. TABEL IDENTITAS JAMAAH DARI KTP / KK */}
      <div className="my-3 pl-3 sm:pl-5 text-xs sm:text-[13px]">
        <table className="w-full text-left border-collapse">
          <tbody>
            <tr>
              <td className="py-0.5 pr-4 font-bold w-48 align-top">Nama Lengkap</td>
              <td className="py-0.5 pr-2 align-top">:</td>
              <td className="py-0.5 font-bold text-slate-900 uppercase">
                {data.jamaahName || '-'}
              </td>
            </tr>
            <tr>
              <td className="py-0.5 pr-4 font-bold align-top">Nomor Induk Kependudukan (NIK)</td>
              <td className="py-0.5 pr-2 align-top">:</td>
              <td className="py-0.5 font-sans font-semibold text-slate-800">
                {data.nik || '-'}
              </td>
            </tr>
            {data.kkNumber && (
              <tr>
                <td className="py-0.5 pr-4 font-bold align-top">Nomor Kartu Keluarga (KK)</td>
                <td className="py-0.5 pr-2 align-top">:</td>
                <td className="py-0.5 font-sans font-semibold text-slate-800">
                  {data.kkNumber}
                </td>
              </tr>
            )}
            <tr>
              <td className="py-0.5 pr-4 font-bold align-top">Tempat, Tanggal Lahir</td>
              <td className="py-0.5 pr-2 align-top">:</td>
              <td className="py-0.5">
                {data.birthPlace ? `${data.birthPlace}, ` : ''}{formattedBirthDate}
              </td>
            </tr>
            <tr>
              <td className="py-0.5 pr-4 font-bold align-top">Jenis Kelamin</td>
              <td className="py-0.5 pr-2 align-top">:</td>
              <td className="py-0.5">{getGenderText(data.gender)}</td>
            </tr>
            <tr>
              <td className="py-0.5 pr-4 font-bold align-top">Alamat Domisili (Sesuai KTP)</td>
              <td className="py-0.5 pr-2 align-top">:</td>
              <td className="py-0.5 leading-normal">
                {data.address || '-'}
              </td>
            </tr>
            {data.phone && (
              <tr>
                <td className="py-0.5 pr-4 font-bold align-top">No. Telepon / HP</td>
                <td className="py-0.5 pr-2 align-top">:</td>
                <td className="py-0.5 font-sans">{data.phone}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* 6. PERNYATAAN MAKSUD & JADWAL KEBERANGKATAN */}
      <div className="mb-5 text-justify text-xs sm:text-[13px] leading-relaxed space-y-2">
        <p>
          Adalah benar calon jamaah Umrah yang telah terdaftar resmi pada program perjalanan Ibadah Umrah kami
          {data.packageName ? ` (<strong>${data.packageName}</strong>)` : ''} dan direncanakan akan diberangkatkan pada tanggal:
        </p>
        <p className="text-center py-1 font-bold text-sm bg-slate-50/60 border border-slate-200/80 rounded print:bg-transparent print:border-none">
          {formattedDepartureDate !== '-' ? formattedDepartureDate : 'Sesuai Jadwal Musim Umrah'}
        </p>
        <p>
          Sehubungan dengan hal tersebut di atas, kami memohon bantuan Bapak/Ibu Kepala Kantor Imigrasi agar dapat 
          menerbitkan / memperpanjang paspor atas nama yang bersangkutan sebagai dokumen kelengkapan perjalanan Ibadah Umrah ke Tanah Suci Arab Saudi.
        </p>
        <p>
          Demikian surat rekomendasi ini kami buat dengan sebenarnya dan penuh tanggung jawab untuk dapat dipergunakan sebagaimana mestinya.
        </p>
      </div>

      {/* 7. SALAM PENUTUP & PENANDATANGAN DENGAN TTD DIGITAL / BASAH */}
      <div className="mt-6 flex justify-end text-xs sm:text-[13px]">
        <div className="w-64 text-center">
          <p className="mb-1">{data.city || 'Bogor'}, {formattedLetterDate}</p>
          <p className="font-bold">{data.companyName || 'Travel Umroh'}</p>
          
          {/* Signature Area (Digital Image or Blank Stempel Space) */}
          <div className="h-20 flex items-center justify-center my-1 relative">
            {data.useDigitalSignature && data.signatureImageUrl ? (
              <img 
                src={data.signatureImageUrl} 
                alt="Tanda Tangan Direktur" 
                className="max-h-20 max-w-[190px] object-contain"
              />
            ) : (
              <div className="text-slate-300 print:text-transparent text-[10px] italic">
                [ Tanda Tangan & Stempel ]
              </div>
            )}
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
