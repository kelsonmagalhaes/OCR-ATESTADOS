"use client";

import { MedicalRecord, RecordField } from "@/types";

interface TableRowProps {
  record: MedicalRecord;
  isFirstOfGroup: boolean;
  onChange: (field: RecordField, value: string) => void;
  onRemove: () => void;
}

const FIELDS: RecordField[] = [
  "nome",
  "tipo",
  "dataAtendimento",
  "periodoDias",
  "horario",
  "cid",
  "local",
  "profissional",
  "observacao",
  "arquivo",
];

export default function TableRow({
  record,
  isFirstOfGroup,
  onChange,
  onRemove,
}: TableRowProps) {
  const isProcessing = record.status === "processing";
  const isError = record.status === "error";

  return (
    <tr
      className={`
        group border-b border-gray-100 hover:bg-gray-50 transition-colors
        ${isProcessing ? "bg-yellow-50" : ""}
        ${isError ? "bg-red-50" : ""}
        ${isFirstOfGroup ? "border-t-2 border-t-blue-200" : ""}
      `}
    >
      {FIELDS.map((field) => (
        <td key={field} className="px-2 py-1.5 min-w-0">
          <input
            type="text"
            value={record[field] as string}
            onChange={(e) => onChange(field, e.target.value)}
            disabled={isProcessing}
            className={`
              w-full text-sm bg-transparent border border-transparent rounded px-1.5 py-0.5
              focus:outline-none focus:border-blue-400 focus:bg-white focus:ring-1 focus:ring-blue-200
              hover:border-gray-300 hover:bg-white transition-colors
              disabled:cursor-wait
              ${isProcessing ? "text-gray-400" : "text-gray-800"}
            `}
            style={{ minWidth: field === "observacao" ? 180 : field === "nome" || field === "profissional" ? 140 : 80 }}
          />
        </td>
      ))}
      <td className="px-2 py-1.5 w-10">
        <button
          onClick={onRemove}
          title="Remover linha"
          className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-400 hover:text-red-500 p-1 rounded"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </td>
    </tr>
  );
}
