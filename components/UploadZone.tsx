"use client";

import { useRef, useCallback } from "react";

interface UploadZoneProps {
  onFiles: (files: File[]) => void;
  disabled?: boolean;
}

const ACCEPTED_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
];

const ACCEPTED_EXTENSIONS = ".pdf,.jpg,.jpeg,.png,.webp";

export default function UploadZone({ onFiles, disabled }: UploadZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback(
    (fileList: FileList | null) => {
      if (!fileList || disabled) return;
      const accepted = Array.from(fileList).filter(
        (f) => ACCEPTED_TYPES.includes(f.type) || f.name.match(/\.(pdf|jpe?g|png|webp)$/i)
      );
      if (accepted.length > 0) onFiles(accepted);
    },
    [onFiles, disabled]
  );

  const onDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      handleFiles(e.dataTransfer.files);
    },
    [handleFiles]
  );

  const onDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  return (
    <div
      onDrop={onDrop}
      onDragOver={onDragOver}
      className={`
        relative border-2 border-dashed rounded-xl p-10 text-center transition-colors
        ${
          disabled
            ? "border-gray-200 bg-gray-50 cursor-not-allowed opacity-60"
            : "border-blue-300 bg-blue-50 hover:bg-blue-100 hover:border-blue-400 cursor-pointer"
        }
      `}
      onClick={() => !disabled && inputRef.current?.click()}
    >
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={ACCEPTED_EXTENSIONS}
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
        disabled={disabled}
      />

      <div className="flex flex-col items-center gap-3 pointer-events-none">
        <div className="w-14 h-14 bg-blue-100 rounded-full flex items-center justify-center">
          <svg
            className="w-7 h-7 text-blue-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
            />
          </svg>
        </div>

        <div>
          <p className="text-base font-semibold text-blue-700">
            Arraste arquivos aqui ou{" "}
            <span className="underline">clique para selecionar</span>
          </p>
          <p className="text-sm text-gray-500 mt-1">
            PDF, JPEG ou PNG — sem limite de arquivos
          </p>
        </div>
      </div>
    </div>
  );
}
