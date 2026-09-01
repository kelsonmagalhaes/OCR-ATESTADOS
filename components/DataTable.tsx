"use client";

import { useState, useCallback } from "react";
import { MedicalRecord, RecordField, COLUMN_HEADERS } from "@/types";
import TableRow from "./TableRow";

interface DataTableProps {
  records: MedicalRecord[];
  onChange: (id: string, field: RecordField, value: string) => void;
  onRemove: (id: string) => void;
  onAddRow: () => void;
}

export default function DataTable({
  records,
  onChange,
  onRemove,
  onAddRow,
}: DataTableProps) {
  if (records.length === 0) return null;

  // Determine first-of-group for visual dividers (group by nome)
  const firstOfGroup = new Set<string>();
  let lastNome = "";
  for (const rec of records) {
    if (rec.nome.toLowerCase() !== lastNome.toLowerCase()) {
      firstOfGroup.add(rec.id);
      lastNome = rec.nome;
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-600 uppercase tracking-wide">
          Dados Extraídos ({records.length} registro{records.length !== 1 ? "s" : ""})
        </h2>
        <span className="text-xs text-gray-400">Clique nas células para editar</span>
      </div>

      <div className="overflow-x-auto rounded-lg border border-gray-200 shadow-sm">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              {COLUMN_HEADERS.map((col) => (
                <th
                  key={col.key}
                  className="px-3 py-2.5 text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap"
                  style={{ minWidth: col.width }}
                >
                  {col.label}
                </th>
              ))}
              <th className="w-10 px-2 py-2.5" />
            </tr>
          </thead>
          <tbody>
            {records.map((record) => (
              <TableRow
                key={record.id}
                record={record}
                isFirstOfGroup={firstOfGroup.has(record.id)}
                onChange={(field, value) => onChange(record.id, field, value)}
                onRemove={() => onRemove(record.id)}
              />
            ))}
          </tbody>
        </table>
      </div>

      <button
        onClick={onAddRow}
        className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1 transition-colors"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
        Adicionar linha manualmente
      </button>
    </div>
  );
}
