'use client';

import React, { useEffect, useRef, useState } from 'react';
import { generatePassportDocxBlob } from '@/lib/docx-generator';
import { PassportRecommendationLetterData } from '@/lib/recommendation-letter';
import { Loader2 } from 'lucide-react';

interface DocxRendererViewProps {
  data: PassportRecommendationLetterData;
  customTemplateBase64?: string;
}

export const DocxRendererView: React.FC<DocxRendererViewProps> = ({
  data,
  customTemplateBase64,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isCancelled = false;

    async function renderDocx() {
      if (!containerRef.current) return;
      setLoading(true);
      setError(null);

      try {
        const { renderAsync } = await import('docx-preview');
        const blob = await generatePassportDocxBlob(data, customTemplateBase64);
        if (isCancelled || !containerRef.current) return;

        // Clear previous render
        containerRef.current.innerHTML = '';

        await renderAsync(blob, containerRef.current, undefined, {
          className: 'docx-preview-content',
          inWrapper: true,
          ignoreWidth: false,
          ignoreHeight: false,
          breakPages: true,
          experimental: true,
          useBase64URL: true,
        });
      } catch (err: any) {
        console.error('Failed to render docx preview:', err);
        if (!isCancelled) {
          setError('Gagal memproses pratinjau dokumen Word.');
        }
      } finally {
        if (!isCancelled) {
          setLoading(false);
        }
      }
    }

    renderDocx();

    return () => {
      isCancelled = true;
    };
  }, [
    data.letterNumber,
    data.letterDate,
    data.departureDate,
    data.immigrationOffice,
    data.purpose,
    data.jamaahName,
    data.nik,
    data.birthPlace,
    data.birthDate,
    data.address,
    customTemplateBase64
  ]);

  return (
    <div className="relative w-full flex flex-col items-center">
      {loading && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-white/80 backdrop-blur-xs min-h-[400px]">
          <Loader2 className="w-7 h-7 text-blue-600 animate-spin mb-2" />
          <p className="text-xs font-bold text-slate-700">Merender Pratinjau Template Word (.docx)...</p>
        </div>
      )}

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 text-center my-4">
          {error}
        </div>
      )}

      <div
        ref={containerRef}
        className="docx-preview-rendered shadow-2xl bg-white text-slate-900 border border-slate-300 [&_.docx-wrapper]:bg-transparent [&_.docx-wrapper]:p-0 [&_.docx]:shadow-none [&_.docx]:p-8 [&_.docx]:sm:p-12 [&_.docx]:min-h-[297mm] [&_.docx]:w-[210mm] [&_.docx]:mx-auto"
      />
    </div>
  );
};
