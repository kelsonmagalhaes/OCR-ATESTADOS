import { NextRequest, NextResponse } from "next/server";

export const runtime = "edge";

/**
 * POST /api/ocr
 * Body: { image: string (base64 data URL or pure base64), apiKey?: string }
 * Calls Google Cloud Vision DOCUMENT_TEXT_DETECTION and returns extracted text.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { image, apiKey: clientKey } = body as {
      image: string;
      apiKey?: string;
    };

    // Resolve API key: server env var takes priority, then client-supplied key
    const apiKey = process.env.GOOGLE_CLOUD_VISION_API_KEY || clientKey;

    if (!apiKey) {
      return NextResponse.json(
        {
          error:
            "Google Cloud Vision API key not configured. Set GOOGLE_CLOUD_VISION_API_KEY env var or provide it in Settings.",
        },
        { status: 401 }
      );
    }

    if (!image) {
      return NextResponse.json({ error: "Missing image field" }, { status: 400 });
    }

    // Strip data URL prefix if present (e.g. "data:image/jpeg;base64,...")
    const base64 = image.startsWith("data:")
      ? image.split(",")[1]
      : image;

    const visionPayload = {
      requests: [
        {
          image: { content: base64 },
          features: [{ type: "DOCUMENT_TEXT_DETECTION", maxResults: 1 }],
          imageContext: {
            languageHints: ["pt", "pt-BR", "en"],
          },
        },
      ],
    };

    const visionRes = await fetch(
      `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(visionPayload),
      }
    );

    if (!visionRes.ok) {
      const errText = await visionRes.text();
      return NextResponse.json(
        { error: `Vision API error ${visionRes.status}: ${errText}` },
        { status: visionRes.status }
      );
    }

    const visionData = await visionRes.json();

    const response = visionData?.responses?.[0];

    if (response?.error) {
      return NextResponse.json(
        { error: `Vision API: ${response.error.message}` },
        { status: 400 }
      );
    }

    // fullTextAnnotation has the best structured text; fall back to textAnnotations
    const fullText =
      response?.fullTextAnnotation?.text ||
      response?.textAnnotations?.[0]?.description ||
      "";

    // Also extract structured blocks for richer field extraction
    const pages = response?.fullTextAnnotation?.pages || [];

    return NextResponse.json({ text: fullText, pages });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
