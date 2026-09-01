"use client";

/**
 * Converts each page of a PDF file into a JPEG data URL using pdf.js.
 * Uses scale 1.5 (sufficient for Vision API, smaller payload than 2.0).
 * Runs entirely client-side (browser only).
 */
export async function pdfToImages(
  file: File,
  onProgress?: (page: number, total: number) => void
): Promise<string[]> {
  // Dynamic import to avoid SSR issues
  const pdfjsLib = await import("pdfjs-dist");

  // Set the worker source — file copied to /public by postinstall script
  if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
  }

  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
  const pdf = await loadingTask.promise;

  const images: string[] = [];
  const total = pdf.numPages;

  for (let pageNum = 1; pageNum <= total; pageNum++) {
    if (onProgress) onProgress(pageNum, total);

    const page = await pdf.getPage(pageNum);

    // Scale 1.5x — good enough for Vision API, reduces payload vs 2.0
    const viewport = page.getViewport({ scale: 1.5 });

    const canvas = document.createElement("canvas");
    canvas.width = viewport.width;
    canvas.height = viewport.height;

    const ctx = canvas.getContext("2d");
    if (!ctx) continue;

    await page.render({ canvasContext: ctx, viewport }).promise;

    // Use JPEG at quality 0.85 — smaller than PNG, Vision API handles it fine
    images.push(canvas.toDataURL("image/jpeg", 0.85));

    // Cleanup
    page.cleanup();
  }

  return images;
}
