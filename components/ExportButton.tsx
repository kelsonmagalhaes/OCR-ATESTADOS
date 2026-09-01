"use client";

import { useState } from "react";
import { MedicalRecord } from "@/types";
import { exportToXlsx } from "@/lib/exporter";

interface ExportButtonProps {
  records: MedicalRecord[];
}

export default function ExportButton({ records }: ExportButtonProps) {
  const [isExporting, setIsExporting] = useState(false);

  const doneRecords = records.filter((r) => r.status !== "processing");
  const disabled = doneRecords.length === 0 || isExporting;

  const handleExport = () => {
    if (disabled) return;
    setIsExporting(true);
    try {
      exportToXlsx(doneRecords);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <button
      onClick={handleExport}
      disabled={disabled}
      className={`
        inline-flex items-center gap-2 px-5 py-2.5 rounded-lg font-semibold text-sm
        transition-all focus:outline-none focus:ring-2 focus:ring-green-400 focus:ring-offset-2
        ${
          disabled
            ? "bg-gray-200 text-gray-400 cursor-not-allowed"
            : "bg-green-600 text-white hover:bg-green-700 shadow-sm hover:shadow"
        }
      `}
    >
      {isExporting ? (
        <>
          <svg
            className="w-4 h-4 animate-spin"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8v8H4z"
            />
          </svg>
          Exportando...
        </>
      ) : (
        <>
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
            />
          </svg>
          Baixar .xlsx ({doneRecords.length})
        </>
      )}
    </button>
  );
}
