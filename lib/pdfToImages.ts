"use client";

/**
 * Converts each page of a PDF file into a PNG data URL using pdf.js.
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
    // Try .mjs first, fall back to .js
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

    // Scale 2x for better OCR accuracy (~200 DPI on typical 96 DPI screen)
    const viewport = page.getViewport({ scale: 2.0 });

    const canvas = document.createElement("canvas");
    canvas.width = viewport.width;
    canvas.height = viewport.height;

    const ctx = canvas.getContext("2d");
    if (!ctx) continue;

    await page.render({ canvasContext: ctx, viewport }).promise;

    images.push(canvas.toDataURL("image/png"));

    // Cleanup
    page.cleanup();
  }

  return images;
}
