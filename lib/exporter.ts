import * as XLSX from "xlsx";
import { MedicalRecord, COLUMN_HEADERS } from "@/types";

/**
 * Parses a date string DD/MM/YYYY to a Date object for sorting.
 * Returns epoch 0 if unparseable.
 */
function parseDate(dateStr: string): Date {
  if (!dateStr) return new Date(0);
  const parts = dateStr.split("/");
  if (parts.length === 3) {
    const [d, m, y] = parts;
    const parsed = new Date(Number(y), Number(m) - 1, Number(d));
    if (!isNaN(parsed.getTime())) return parsed;
  }
  return new Date(0);
}

/**
 * Sorts records: grouped by nome (alphabetical), within each group by date (oldest first).
 */
function sortRecords(records: MedicalRecord[]): MedicalRecord[] {
  return [...records].sort((a, b) => {
    const nameCompare = a.nome.localeCompare(b.nome, "pt-BR", {
      sensitivity: "base",
    });
    if (nameCompare !== 0) return nameCompare;
    return parseDate(a.dataAtendimento).getTime() - parseDate(b.dataAtendimento).getTime();
  });
}

/**
 * Exports the medical records to a .xlsx file and triggers a browser download.
 */
export function exportToXlsx(records: MedicalRecord[]): void {
  const sorted = sortRecords(records);

  // Build rows — header first
  const headers = COLUMN_HEADERS.map((col) => col.label);

  const rows = sorted.map((rec) => [
    rec.nome,
    rec.tipo,
    rec.dataAtendimento,
    rec.periodoDias,
    rec.horario,
    rec.cid,
    rec.local,
    rec.profissional,
    rec.observacao,
    rec.arquivo,
  ]);

  const worksheetData = [headers, ...rows];
  const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);

  // Column widths
  worksheet["!cols"] = COLUMN_HEADERS.map((col) => ({
    wch: Math.round(col.width / 7), // approx char width
  }));

  // Freeze top header row (SheetJS sheet views)
  worksheet["!views"] = [{ state: "frozen", xSplit: 0, ySplit: 1 }];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Atestados");

  XLSX.writeFile(workbook, "atestados_medicos.xlsx");
}
