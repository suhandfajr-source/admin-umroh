'use client';

import React, { useState } from 'react';
import { ZoomIn, ZoomOut, RotateCw, RefreshCw, FileText, Maximize2 } from 'lucide-react';

interface DocumentViewerProps {
  fileUrl?: string;
  fileName?: string;
  mimeType?: string;
}

export const DocumentViewer: React.FC<DocumentViewerProps> = ({
  fileUrl,
  fileName = 'Dokumen',
  mimeType = 'image/jpeg',
}) => {
  const [scale, setScale] = useState(1);
  const [rotation, setRotation] = useState(0);

  const isPdf = mimeType.includes('pdf') || fileName.toLowerCase().endsWith('.pdf');

  const handleZoomIn = () => setScale(prev => Math.min(prev + 0.25, 3.5));
  const handleZoomOut = () => setScale(prev => Math.max(prev - 0.25, 0.5));
  const handleRotate = () => setRotation(prev => (prev + 90) % 360);
  const handleReset = () => {
    setScale(1);
    setRotation(0);
  };

  return (
    <div className="flex flex-col h-full bg-slate-900 rounded-2xl overflow-hidden border border-slate-800 shadow-xl">
      {/* Viewer Toolbar */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-slate-950/80 border-b border-slate-800 text-slate-300 text-xs">
        <div className="flex items-center gap-2 truncate max-w-xs">
          <FileText className="w-4 h-4 text-emerald-400 shrink-0" />
          <span className="truncate font-medium text-slate-200">{fileName}</span>
        </div>

        <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-lg border border-slate-800">
          <button
            onClick={handleZoomOut}
            title="Perkecil"
            className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-slate-200 rounded transition-colors"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <span className="px-2 font-mono text-[11px] text-slate-400">{Math.round(scale * 100)}%</span>
          <button
            onClick={handleZoomIn}
            title="Perbesar"
            className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-slate-200 rounded transition-colors"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <div className="w-px h-3.5 bg-slate-800 mx-1" />
          <button
            onClick={handleRotate}
            title="Putar 90°"
            className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-slate-200 rounded transition-colors"
          >
            <RotateCw className="w-4 h-4" />
          </button>
          <button
            onClick={handleReset}
            title="Reset Tampilan"
            className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-slate-200 rounded transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Viewer Canvas Area */}
      <div className="flex-1 overflow-auto p-4 flex items-center justify-center min-h-[420px] bg-slate-950/40 relative">
        {fileUrl ? (
          isPdf ? (
            <iframe
              src={`${fileUrl}#toolbar=0`}
              title="PDF Viewer"
              className="w-full h-full min-h-[450px] rounded-lg border-0"
            />
          ) : (
            <div className="transition-transform duration-150 ease-out flex items-center justify-center">
              <img
                src={fileUrl}
                alt={fileName}
                style={{
                  transform: `scale(${scale}) rotate(${rotation}deg)`,
                  transformOrigin: 'center center',
                  maxHeight: '65vh',
                }}
                className="rounded-lg shadow-2xl object-contain transition-all"
              />
            </div>
          )
        ) : (
          <div className="text-center p-8 text-slate-500">
            <FileText className="w-12 h-12 mx-auto mb-2 text-slate-700 stroke-1" />
            <p className="text-sm font-medium">Pratinjau Dokumen Tidak Tersedia</p>
          </div>
        )}
      </div>
    </div>
  );
};
