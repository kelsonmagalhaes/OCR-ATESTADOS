export interface MedicalRecord {
  id: string;
  nome: string;
  tipo: string;
  dataAtendimento: string;
  periodoDias: string;
  horario: string;
  cid: string;
  local: string;
  profissional: string;
  observacao: string;
  arquivo: string;
  status: "pending" | "processing" | "done" | "error";
  rawText?: string;
  errorMessage?: string;
}

export interface FileQueueItem {
  id: string;
  file: File;
  progress: number;
  status: "pending" | "processing" | "done" | "error";
  error?: string;
}

export type RecordField = keyof Omit<
  MedicalRecord,
  "id" | "status" | "rawText" | "errorMessage"
>;

export const COLUMN_HEADERS: { key: RecordField; label: string; width: number }[] = [
  { key: "nome", label: "Nome", width: 180 },
  { key: "tipo", label: "Tipo", width: 160 },
  { key: "dataAtendimento", label: "Data Atendimento", width: 130 },
  { key: "periodoDias", label: "Período / Dias", width: 110 },
  { key: "horario", label: "Horário", width: 90 },
  { key: "cid", label: "CID", width: 90 },
  { key: "local", label: "Local", width: 160 },
  { key: "profissional", label: "Profissional / Responsável", width: 180 },
  { key: "observacao", label: "Observação", width: 200 },
  { key: "arquivo", label: "Arquivo", width: 160 },
];
