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

const MAX_RETRIES = 3;
const RETRY_DELAYS = [10000, 20000, 40000]; // 10s, 20s, 40s

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Calls the /api/ocr serverless route which uses Google Gemini.
 * Includes automatic retry with backoff on 429 (quota exceeded) errors.
 */
export async function recognizeImage(
  imageSource: string,
  apiKey: string,
  onProgress?: (progress: number) => void
): Promise<OcrResult> {
  if (onProgress) onProgress(10);

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    // Wait before retry (not on first attempt)
    if (attempt > 0) {
      const delay = RETRY_DELAYS[attempt - 1] || 40000;
      if (onProgress) onProgress(10); // reset progress during retry
      await sleep(delay);
    }

    try {
      const res = await fetch("/api/ocr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: imageSource, apiKey }),
      });

      if (onProgress) onProgress(90);

      // Rate limited — retry
      if (res.status === 429) {
        const errData = await res.json().catch(() => ({}));
        lastError = new Error(errData.error || "Rate limited (429)");
        continue; // retry
      }

      if (!res.ok) {
        const errData = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(errData.error || `OCR request failed: ${res.status}`);
      }

      const data = await res.json();

      if (data.error) {
        // If Gemini returned 429 through our route
        if (data.error.includes("429") || data.error.includes("quota")) {
          lastError = new Error(data.error);
          continue; // retry
        }
        throw new Error(data.error);
      }

      if (onProgress) onProgress(100);

      const fields = data.fields as GeminiFields | null;
      const rawText = data.rawText || "";
      const isBlank = !!(fields && fields.blank === true);

      return {
        fields: isBlank ? null : fields,
        rawText,
        isBlank,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("429") || msg.includes("quota")) {
        lastError = err instanceof Error ? err : new Error(msg);
        continue; // retry
      }
      throw err; // non-retryable error
    }
  }

  // All retries exhausted
  throw lastError || new Error("OCR failed after retries");
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
    cid: fields?.cid || "Não informado",
    local: fields?.local || "",
    profissional: fields?.profissional || "",
    observacao: fields?.observacao || "",
    arquivo: filename,
    status: "done",
  };
}
