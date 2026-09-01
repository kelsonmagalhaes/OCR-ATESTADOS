"use client";

export interface OcrResult {
  text: string;
  confidence: number;
}

/**
 * Calls the /api/ocr serverless route which uses Google Cloud Vision.
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

  return {
    text: data.text || "",
    confidence: 95, // Vision API doesn't expose a single confidence score
  };
}
