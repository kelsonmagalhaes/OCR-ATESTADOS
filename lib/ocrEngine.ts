"use client";

import { MedicalRecord } from "@/types";

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export interface GeminiFields {
  nome?: string;
  tipo?: string;
  dataAtendimento?: string;
  periodoDias?: string;
  horario?: string;
  cid?: string;
  local?: string;
  profissional?: string;
  observacao?: string;
  blank?: boolean;
}

export interface OcrResult {
  fields: GeminiFields | null;
  rawText: string;
  isBlank: boolean;
}

/**
 * Calls the /api/ocr serverless route which uses Google Gemini 1.5 Flash.
 * Returns structured JSON fields extracted directly by Gemini.
 * @param imageSource - data URL (base64) of the page image
 * @param apiKey - user-supplied API key (used if env var not set on server)
 * @param onProgress - optional progress callback 0-100
 */
export async function recognizeImage(
  imageSource: string,
  apiKey: string,
  onProgress?: (progress: number) => void
): Promise<OcrResult> {
  if (onProgress) onProgress(10);

  const res = await fetch("/api/ocr", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ image: imageSource, apiKey }),
  });

  if (onProgress) onProgress(90);

  if (!res.ok) {
    const errData = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(errData.error || `OCR request failed: ${res.status}`);
  }

  const data = await res.json();

  if (data.error) {
    throw new Error(data.error);
  }

  if (onProgress) onProgress(100);

  const fields = data.fields as GeminiFields | null;
  const rawText = data.rawText || "";

  // Check if Gemini flagged the page as blank
  const isBlank = !!(fields && fields.blank === true);

  return {
    fields: isBlank ? null : fields,
    rawText,
    isBlank,
  };
}

/**
 * Converts Gemini extracted fields into a MedicalRecord.
 */
export function fieldsToRecord(
  fields: GeminiFields | null,
  filename: string
): MedicalRecord {
  return {
    id: generateId(),
    nome: fields?.nome || "",
    tipo: fields?.tipo || "Atestado",
    dataAtendimento: fields?.dataAtendimento || "",
    periodoDias: fields?.periodoDias || "",
    horario: fields?.horario || "",
    cid: fields?.cid || "Nao informado",
    local: fields?.local || "",
    profissional: fields?.profissional || "",
    observacao: fields?.observacao || "",
    arquivo: filename,
    status: "done",
  };
}
