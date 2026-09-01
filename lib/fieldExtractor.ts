import { MedicalRecord } from "@/types";

// Simple UUID fallback since we don't want to add the uuid package
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

// ---------------------------------------------------------------------------
// Helper utilities
// ---------------------------------------------------------------------------

/** Normalize text: collapse whitespace, trim */
function normalize(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

/** Extract lines from raw OCR text */
function lines(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((l) => normalize(l))
    .filter((l) => l.length > 0);
}

/** Case-insensitive match */
function icontains(haystack: string, needle: string): boolean {
  return haystack.toLowerCase().includes(needle.toLowerCase());
}

// ---------------------------------------------------------------------------
// Field extractors
// ---------------------------------------------------------------------------

function extractTipo(text: string): string {
  const lower = text.toLowerCase();
  if (
    lower.includes("declaração de comparecimento") ||
    lower.includes("declaracao de comparecimento")
  ) {
    return "Declaração de Comparecimento";
  }
  if (lower.includes("atestado de acompanhante")) {
    return "Atestado de Acompanhante";
  }
  if (
    lower.includes("atestado médico") ||
    lower.includes("atestado medico") ||
    lower.includes("atesto que")
  ) {
    return "Atestado";
  }
  if (lower.includes("atestado")) {
    return "Atestado";
  }
  if (lower.includes("declaração") || lower.includes("declaracao")) {
    return "Declaração";
  }
  if (lower.includes("laudo")) {
    return "Laudo";
  }
  return "Atestado";
}

function extractNome(text: string): string {
  const ls = lines(text);

  // Trigger keywords followed by the name on the same or next line
  const triggers = [
    /(?:paciente|nome do paciente|nome[:\s]+)[:]\s*(.+)/i,
    /(?:atesto que o[/\s]a?\s+(?:paciente|sr\.?|sra\.?)\s+)(.+?)(?:\s+(?:necessita|esteve|compareceu|encontra|encontrava))/i,
    /(?:declaro que o[/\s]a?\s+(?:paciente|sr\.?|sra\.?)\s+)(.+?)(?:\s+(?:necessita|esteve|compareceu|encontra))/i,
  ];

  for (const re of triggers) {
    const m = text.match(re);
    if (m && m[1]) {
      const candidate = normalize(m[1]).replace(/[,;.].*$/, "").trim();
      if (candidate.length > 2 && candidate.length < 80) {
        return toTitleCase(candidate);
      }
    }
  }

  // Fallback: look for a line labeled "Nome:" or "Paciente:"
  for (const line of ls) {
    const m = line.match(/^(?:nome|paciente)\s*[:\-]\s*(.+)$/i);
    if (m && m[1]) {
      return toTitleCase(m[1].trim());
    }
  }

  return "";
}

function extractData(text: string): string {
  // Look for date patterns DD/MM/YYYY, DD-MM-YYYY, DD.MM.YYYY
  const datePatterns = [
    /\b(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})\b/g,
    /\b(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2})\b/g,
  ];

  // Priority: look near keywords first
  const keywordContext = text.match(
    /(?:data|atendimento|consulta|emiss[aã]o)[:\s]+(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i
  );
  if (keywordContext) {
    return normalizeDate(keywordContext[1]);
  }

  for (const pattern of datePatterns) {
    const matches = Array.from(text.matchAll(pattern));
    if (matches.length > 0) {
      // Take the first date found
      return normalizeDate(matches[0][0]);
    }
  }

  return "";
}

function normalizeDate(raw: string): string {
  const parts = raw.split(/[\/\-\.]/);
  if (parts.length !== 3) return raw;
  let [d, m, y] = parts;
  if (y.length === 2) y = `20${y}`;
  return `${d.padStart(2, "0")}/${m.padStart(2, "0")}/${y}`;
}

function extractPeriodo(text: string): string {
  const patterns = [
    /(\d+)\s*(?:dias?|day)/i,
    /per[íi]odo\s+de\s+(\d+)\s*dias?/i,
    /repouso\s+(?:de\s+)?(\d+)\s*dias?/i,
    /afastamento\s+(?:de\s+)?(\d+)\s*dias?/i,
    /licen[çc]a\s+(?:de\s+)?(\d+)\s*dias?/i,
  ];

  for (const re of patterns) {
    const m = text.match(re);
    if (m) {
      return `${m[1]} dia(s)`;
    }
  }

  // Check for "período" without explicit days
  const periodMatch = text.match(/per[íi]odo[:\s]+([^\n,;.]{1,40})/i);
  if (periodMatch) return normalize(periodMatch[1]);

  return "";
}

function extractHorario(text: string): string {
  // Context-aware: prefer near "horário", "hora", "às"
  const contextPatterns = [
    /(?:hor[áa]rio|hora|[aà]s)[:\s]+(\d{1,2}[h:]\d{2})/i,
    /(?:hor[áa]rio|hora|[aà]s)[:\s]+(\d{1,2}h)/i,
  ];

  for (const re of contextPatterns) {
    const m = text.match(re);
    if (m) return m[1].replace(":", "h");
  }

  // Bare time patterns
  const timePatterns = [
    /\b(\d{1,2}):(\d{2})\s*(?:h|hrs?)?\b/g,
    /\b(\d{1,2})h(\d{2})\b/g,
    /\b(\d{1,2})h\b/g,
  ];

  for (const re of timePatterns) {
    const matches = Array.from(text.matchAll(re));
    if (matches.length > 0) {
      const m = matches[0];
      if (m[2]) return `${m[1]}h${m[2]}`;
      return `${m[1]}h`;
    }
  }

  return "";
}

function extractCid(text: string): string {
  // ICD-10 format: Letter + 2 digits + optional dot + optional 1-2 digits
  const cidPattern = /\b([A-Z]\d{2}(?:\.\d{1,2})?)\b/g;

  // Context-aware first
  const contextMatch = text.match(
    /CID(?:-10)?[:\s]*([A-Z]\d{2}(?:\.\d{1,2})?)/i
  );
  if (contextMatch) return contextMatch[1].toUpperCase();

  const matches = Array.from(text.matchAll(cidPattern));
  if (matches.length > 0) return matches[0][1].toUpperCase();

  return "Não informado";
}

function extractLocal(text: string): string {
  const ls = lines(text);

  // Direct label match
  for (const line of ls) {
    const m = line.match(/^(?:local|estabelecimento|unidade|hospital|cl[íi]nica|UBS|UPA)[:\s]+(.+)$/i);
    if (m && m[1]) return normalize(m[1]);
  }

  // Keyword proximity: find lines containing hospital/clínica keywords
  const locationKeywords = [
    "hospital",
    "clínica",
    "clinica",
    "ubs",
    "upa",
    "pronto-socorro",
    "pronto socorro",
    "centro médico",
    "centro medico",
    "unidade de saúde",
    "posto de saúde",
    "ambulatório",
    "ambulatorio",
  ];

  for (const line of ls) {
    for (const kw of locationKeywords) {
      if (icontains(line, kw) && line.length < 100) {
        return normalize(line);
      }
    }
  }

  return "";
}

function extractProfissional(text: string): string {
  const ls = lines(text);

  // Direct label match
  for (const line of ls) {
    const m = line.match(
      /^(?:m[eé]dico|profissional|respons[aá]vel|doutor|dr\.?|dra\.?)[:\s]+(.+)$/i
    );
    if (m && m[1]) return normalize(m[1]);
  }

  // CRM/CRO proximity pattern
  const crmMatch = text.match(
    /(?:Dr\.?|Dra\.?)\s+([A-ZÀ-Ú][a-zà-ú]+(?:\s+[A-ZÀ-Ú][a-zà-ú]+){1,4})/
  );
  if (crmMatch) return normalize(crmMatch[0]);

  // Line ending with CRM number
  for (const line of ls) {
    if (/CRM[:\s]*\d+/i.test(line) && line.length < 120) {
      return normalize(line);
    }
  }

  return "";
}

function extractObservacao(text: string): string {
  const obsTriggers = [
    /(?:obs(?:erva[çc][aã]o)?|recomenda[çc][oõ]es?|orienta[çc][oõ]es?)[:\s]+(.+?)(?:\n|$)/is,
    /(?:prescrições?|prescricoes?)[:\s]+(.+?)(?:\n|$)/is,
  ];

  for (const re of obsTriggers) {
    const m = text.match(re);
    if (m && m[1]) {
      const obs = normalize(m[1]);
      if (obs.length > 2 && obs.length < 300) return obs;
    }
  }

  return "";
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

function toTitleCase(str: string): string {
  const lower = ["de", "da", "do", "das", "dos", "e", "a", "o", "em", "na", "no"];
  return str
    .toLowerCase()
    .split(" ")
    .map((word, idx) => {
      if (idx === 0 || !lower.includes(word)) {
        return word.charAt(0).toUpperCase() + word.slice(1);
      }
      return word;
    })
    .join(" ");
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

/**
 * Extracts structured medical record fields from raw OCR text.
 * @param rawText - concatenated OCR output for all pages
 * @param filename - original uploaded filename
 */
export function extractFields(
  rawText: string,
  filename: string
): MedicalRecord {
  return {
    id: generateId(),
    nome: extractNome(rawText),
    tipo: extractTipo(rawText),
    dataAtendimento: extractData(rawText),
    periodoDias: extractPeriodo(rawText),
    horario: extractHorario(rawText),
    cid: extractCid(rawText),
    local: extractLocal(rawText),
    profissional: extractProfissional(rawText),
    observacao: extractObservacao(rawText),
    arquivo: filename,
    status: "done",
    rawText,
  };
}
