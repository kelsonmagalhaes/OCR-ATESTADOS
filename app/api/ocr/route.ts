import { NextRequest, NextResponse } from "next/server";

export const runtime = "edge";

/**
 * POST /api/ocr
 * Body: { image: string (base64 data URL or pure base64), apiKey?: string }
 * Calls Google Gemini 1.5 Flash to extract structured medical certificate data directly as JSON.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { image, apiKey: clientKey } = body as {
      image: string;
      apiKey?: string;
    };

    // Resolve API key: server env var takes priority, then client-supplied key
    const apiKey = process.env.GOOGLE_API_KEY || clientKey;

    if (!apiKey) {
      return NextResponse.json(
        {
          error:
            "Google API Key não configurada. Defina a variável de ambiente GOOGLE_API_KEY ou informe nas Configurações.",
        },
        { status: 401 }
      );
    }

    if (!image) {
      return NextResponse.json({ error: "Campo image ausente" }, { status: 400 });
    }

    // Strip data URL prefix if present (e.g. "data:image/jpeg;base64,...")
    let base64 = image;
    let mimeType = "image/jpeg";

    if (image.startsWith("data:")) {
      const parts = image.split(",");
      const header = parts[0]; // e.g. "data:image/png;base64"
      base64 = parts[1];
      const mimeMatch = header.match(/data:([^;]+);/);
      if (mimeMatch) mimeType = mimeMatch[1];
    }

    const prompt = `Você é um assistente especializado em leitura de atestados e declarações médicas brasileiras.
Analise a imagem fornecida e extraia as informações do documento médico em formato JSON.

Retorne APENAS um objeto JSON válido com os seguintes campos (sem explicações, sem markdown, apenas o JSON):
{
  "nome": "Nome completo do paciente",
  "tipo": "Tipo do documento: Atestado, Declaração de Comparecimento, Atestado de Acompanhante, Laudo, ou Declaração",
  "dataAtendimento": "Data no formato DD/MM/AAAA",
  "periodoDias": "Número de dias de afastamento/repouso (ex: '3 dias') ou 'Comparecimento' para declarações de comparecimento sem afastamento",
  "horario": "Horário(s) mencionado(s) (ex: '09h30 às 10h45')",
  "cid": "Código CID-10 se informado, caso contrário 'Nao informado'",
  "local": "Nome do estabelecimento de saúde",
  "profissional": "Nome do médico/profissional responsável com CRM se disponível",
  "observacao": "Observações relevantes, diagnóstico ou motivo do atendimento"
}

Regras importantes:
- Se a página estiver em branco ou não for um documento médico, retorne: {"blank": true}
- Use exatamente os nomes de campo acima
- Para campos não encontrados, use string vazia ""
- Para CID, use sempre "Nao informado" (sem acento) se não estiver explícito
- Datas sempre no formato DD/MM/AAAA
- Não invente informações que não estejam no documento`;

    const geminiPayload = {
      contents: [
        {
          parts: [
            {
              inline_data: {
                mime_type: mimeType,
                data: base64,
              },
            },
            {
              text: prompt,
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 1024,
      },
    };

    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(geminiPayload),
      }
    );

    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      return NextResponse.json(
        { error: `Gemini API error ${geminiRes.status}: ${errText}` },
        { status: geminiRes.status }
      );
    }

    const geminiData = await geminiRes.json();

    const candidate = geminiData?.candidates?.[0];
    if (!candidate) {
      return NextResponse.json(
        { error: "Gemini API: resposta sem candidatos" },
        { status: 400 }
      );
    }

    const rawText = candidate?.content?.parts?.[0]?.text || "";

    // Parse JSON from Gemini response — strip markdown fences if present
    let jsonText = rawText.trim();
    if (jsonText.startsWith("```")) {
      jsonText = jsonText.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
    }

    let parsed: Record<string, string | boolean> = {};
    try {
      parsed = JSON.parse(jsonText);
    } catch {
      // If JSON parse fails, return the raw text so ocrEngine can handle it
      return NextResponse.json({ rawText, fields: null });
    }

    return NextResponse.json({ rawText, fields: parsed });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
