import { MedicalRecord } from "@/types";

// Simple UUID fallback
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

// ---------------------------------------------------------------------------
// Helper utilities
// ---------------------------------------------------------------------------

function normalize(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function lines(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((l) => normalize(l))
    .filter((l) => l.length > 0);
}

function icontains(haystack: string, needle: string): boolean {
  return haystack.toLowerCase().includes(needle.toLowerCase());
}

// ---------------------------------------------------------------------------
// Field extractors — improved for Brazilian medical documents
// ---------------------------------------------------------------------------

function extractTipo(text: string): string {
  const lower = text.toLowerCase();
  if (
    lower.includes("declaração de comparecimento") ||
    lower.includes("declaracao de comparecimento") ||
    lower.includes("declaração de presença") ||
    lower.includes("declaracao de presenca")
  ) {
    return "Declaração de Comparecimento";
  }
  if (lower.includes("atestado de acompanhante")) {
    return "Atestado de Acompanhante";
  }
  if (
    lower.includes("atestado médico") ||
    lower.includes("atestado medico") ||
    lower.includes("atesto que") ||
    lower.includes("atesto, para")
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

  // 1. Direct label "Nome:" or "Paciente:" on the same line
  for (const line of ls) {
    const m = line.match(/^(?:nome|paciente)\s*[:\-]\s*(.+)$/i);
    if (m && m[1]) {
      const candidate = normalize(m[1])
        .replace(/[,;.].*$/, "")
        .replace(/\b(cpf|rg|data|nasc|sexo|idade)\b.*/i, "")
        .trim();
      if (candidate.length > 3 && candidate.length < 80) {
        return toTitleCase(candidate);
      }
    }
  }

  // 2. Inline trigger — "atesto que o paciente / o sr. / a sra." + name + verb
  const inlineTriggers = [
    /(?:atesto\s+que\s+o[s]?\s*[\/]?\s*a?\s*(?:paciente|sr\.?|sra\.?|senhor|senhora)\s+)([\wÀ-ÖØ-öø-ÿ]+(?:\s+[\wÀ-ÖØ-öø-ÿ]+){1,5})(?:\s*[,;]|\s+(?:encontra|esteve|necessita|compareceu|foi|porta|sob|est[aá]))/i,
    /(?:declaro\s+que\s+o[s]?\s*[\/]?\s*a?\s*(?:paciente|sr\.?|sra\.?)\s+)([\wÀ-ÖØ-öø-ÿ]+(?:\s+[\wÀ-ÖØ-öø-ÿ]+){1,5})(?:\s*[,;]|\s+(?:encontra|esteve|necessita|compareceu|foi|est[aá]))/i,
    /(?:paciente[:\s]+)([\wÀ-ÖØ-öø-ÿ]+(?:\s+[\wÀ-ÖØ-öø-ÿ]+){1,5})(?:\s*[,;]|\s+(?:encontra|esteve|necessita|compareceu|foi|est[aá]|com\b|sob\b|\())/i,
  ];

  for (const re of inlineTriggers) {
    const m = text.match(re);
    if (m && m[1]) {
      const candidate = normalize(m[1]).trim();
      if (candidate.length > 3 && candidate.length < 80) {
        return toTitleCase(candidate);
      }
    }
  }

  // 3. Look for capitalized multi-word sequences after known triggers in line context
  for (const line of ls) {
    if (
      /^(?:nome|paciente|sr\.?|sra\.?)\s*/i.test(line) ||
      /(?:paciente|nome do paciente)\s*[:]/i.test(line)
    ) {
      const afterColon = line.replace(/^[^:]+:\s*/, "").trim();
      if (afterColon.length > 3 && afterColon.length < 80) {
        return toTitleCase(afterColon.replace(/[,;].*$/, "").trim());
      }
    }
  }

  // 4. Fallback: find the first line with multiple capitalized words (a name-like pattern)
  // near keywords like "paciente", "nome", etc.
  const nameBlock = text.match(
    /(?:paciente|nome)[^\n]*\n\s*((?:[A-ZÀ-Ú][a-zà-ú]+\s+){2,5}[A-ZÀ-Ú][a-zà-ú]+)/m
  );
  if (nameBlock) return toTitleCase(normalize(nameBlock[1]));

  return "";
}

function extractData(text: string): string {
  // Priority: look near date keywords first
  const keywordContexts = [
    /(?:data\s+(?:do\s+)?atendimento|data\s+da\s+consulta|data\s+emiss[aã]o)[:\s]+(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i,
    /(?:data|atendimento|consulta|emiss[aã]o|comparecimento)[:\s]+(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i,
    /\b(?:em|dia|date)[:\s]+(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})\b/i,
  ];

  for (const re of keywordContexts) {
    const m = text.match(re);
    if (m) return normalizeDate(m[1]);
  }

  // Bare date patterns — take the first match
  const datePatterns = [
    /\b(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})\b/g,
    /\b(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2})\b/g,
  ];

  for (const pattern of datePatterns) {
    const matches = Array.from(text.matchAll(pattern));
    if (matches.length > 0) return normalizeDate(matches[0][0]);
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
  const lower = text.toLowerCase();

  // Declaração de comparecimento → "Comparecimento"
  if (
    lower.includes("declaração de comparecimento") ||
    lower.includes("declaracao de comparecimento") ||
    lower.includes("comparecimento")
  ) {
    // Check if this is purely a comparecimento without days mentioned
    const hasDays = /\d+\s*dias?/i.test(text);
    if (!hasDays) return "Comparecimento";
  }

  const patterns = [
    // "repouso de 3 dias", "afastamento de 2 dias", "licença de 5 dias"
    /(?:repouso|afastamento|licen[çc]a|per[íi]odo)\s+(?:de\s+)?(\d+)\s*(?:dias?|day)/i,
    // "por X dia(s)"
    /por\s+(\d+)\s*(?:dias?|day)/i,
    // "X dias de repouso"
    /(\d+)\s*dias?\s+(?:de\s+)?(?:repouso|afastamento|licen[çc]a)/i,
    // standalone "3 dias" or "1 dia"
    /\b(\d+)\s*(?:dias?)\b/i,
  ];

  for (const re of patterns) {
    const m = text.match(re);
    if (m) {
      const n = parseInt(m[1], 10);
      return `${n} dia${n !== 1 ? "s" : ""}`;
    }
  }

  // Período without explicit days
  const periodMatch = text.match(/per[íi]odo[:\s]+([^\n,;.]{1,40})/i);
  if (periodMatch) return normalize(periodMatch[1]);

  return "";
}

function extractHorario(text: string): string {
  // Time range patterns like "09:30 às 10:09" or "05:00 as 12:00"
  const rangePatterns = [
    /(\d{1,2}[h:]\d{2})\s*[àa]s?\s*(\d{1,2}[h:]\d{2})/i,
    /(\d{1,2}h\d{2})\s*[àa]s?\s*(\d{1,2}h\d{2})/i,
  ];

  for (const re of rangePatterns) {
    const m = text.match(re);
    if (m) {
      const from = m[1].replace(":", "h");
      const to = m[2].replace(":", "h");
      return `${from} às ${to}`;
    }
  }

  // Context-aware single time
  const contextPatterns = [
    /(?:hor[áa]rio|hora(?:rio)?)[:\s]+(\d{1,2}[h:]\d{2})/i,
    /(?:entrada|sa[íi]da|in[íi]cio|t[eé]rmino)[:\s]+(\d{1,2}[h:]\d{2})/i,
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
  // Context-aware first: "CID:" or "CID-10:"
  const contextMatch = text.match(
    /CID(?:-10)?[:\s]*([A-Z]\d{2}(?:\.\d{1,2})?)/i
  );
  if (contextMatch) return contextMatch[1].toUpperCase();

  // Standalone ICD-10 codes (Letter + 2 digits + optional .X or .XX)
  const cidPattern = /\b([A-Z]\d{2}(?:\.\d{1,2})?)\b/g;
  const matches = Array.from(text.matchAll(cidPattern));

  // Filter out common false positives that look like ICD codes
  const filtered = matches.filter((m) => {
    const code = m[1];
    // Skip things like "A4" (too short), "Z99" common known non-codes
    return code.length >= 3;
  });

  if (filtered.length > 0) return filtered[0][1].toUpperCase();

  return "Não informado";
}

function extractLocal(text: string): string {
  const ls = lines(text);

  // Direct label match on the same line
  for (const line of ls) {
    const m = line.match(
      /^(?:local(?:\s+de\s+atendimento)?|estabelecimento|unidade|hospital|cl[íi]nica)[:\s]+(.+)$/i
    );
    if (m && m[1]) return normalize(m[1]);
  }

  // Known hospital/clinic keyword-bearing lines
  // UPA, PS Central, Hospital Geral, UMS, etc.
  const locationKeywords = [
    "hospital",
    "clínica",
    "clinica",
    "ubs",
    "upa",
    "pronto-socorro",
    "pronto socorro",
    "ps central",
    "centro médico",
    "centro medico",
    "unidade de saúde",
    "unidade mista",
    "ums",
    "posto de saúde",
    "ambulatório",
    "ambulatorio",
    "hgr",
    "santa casa",
    "beneficência",
    "beneficencia",
  ];

  for (const line of ls) {
    const lower = line.toLowerCase();
    for (const kw of locationKeywords) {
      if (lower.includes(kw) && line.length < 120) {
        return normalize(line);
      }
    }
  }

  return "";
}

function extractProfissional(text: string): string {
  const ls = lines(text);

  // Direct label
  for (const line of ls) {
    const m = line.match(
      /^(?:m[eé]dico(?:\s+respons[aá]vel)?|profissional(?:\s+respons[aá]vel)?|respons[aá]vel|doutor|dra?\.)[:\s]+(.+)$/i
    );
    if (m && m[1]) return normalize(m[1]);
  }

  // CRM/CRO proximity
  const crmContextMatch = text.match(
    /(?:Dr\.?|Dra\.?)\s+([\wÀ-ÖØ-öø-ÿ]+(?:\s+[\wÀ-ÖØ-öø-ÿ]+){1,4})/
  );
  if (crmContextMatch) return normalize(crmContextMatch[0]);

  // Line containing CRM/CRO number
  for (const line of ls) {
    if (/CR[MO][:\s]*\d+/i.test(line) && line.length < 120) {
      return normalize(line);
    }
  }

  return "";
}

function extractObservacao(text: string): string {
  const obsTriggers = [
    // "Obs:", "Observação:", "Observações:"
    /(?:obs(?:erva[çc][aã]o)?s?)[:\s]+(.+?)(?:\n|$)/i,
    // Specific procedure types used in Brazilian medical docs
    /\b(acompanhando\s+(?:filho|esposo|esposa|familiar|paciente)[^\n]*)/i,
    /\b(exame\s+toxicol[oó]gico[^\n]*)/i,
    /\b(exame[^\n]{0,50})/i,
    /\b(repous(?:ar|o)[^\n]{0,50})/i,
    /\b(consulta\s+m[eé]dica[^\n]*)/i,
    /\b(atendimento\s+odontol[oó]gico[^\n]*)/i,
    /\b(acompanhando[^\n]*)/i,
    // Generic recommendations
    /(?:recomenda[çc][oõ]es?|orienta[çc][oõ]es?|prescri[çc][oõ]es?)[:\s]+(.+?)(?:\n|$)/i,
  ];

  for (const re of obsTriggers) {
    const m = text.match(re);
    if (m) {
      const obs = normalize(m[1] || m[0]);
      if (obs.length > 2 && obs.length < 300) return obs;
    }
  }

  return "";
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

function toTitleCase(str: string): string {
  const lower = ["de", "da", "do", "das", "dos", "e", "a", "o", "em", "na", "no", "dos", "das"];
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
