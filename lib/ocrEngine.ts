"use client";

import { createWorker, Worker } from "tesseract.js";

let workerInstance: Worker | null = null;
let initPromise: Promise<Worker> | null = null;

/**
 * Returns a singleton Tesseract.js worker configured for Portuguese + English.
 * The worker is created once and reused across all OCR calls.
 */
async function getWorker(): Promise<Worker> {
  if (workerInstance) return workerInstance;

  if (initPromise) return initPromise;

  initPromise = (async () => {
    const worker = await createWorker(["por", "eng"], 1, {
      // Suppress verbose logging in production
      logger: () => {},
    });
    workerInstance = worker;
    return worker;
  })();

  return initPromise;
}

export interface OcrResult {
  text: string;
  confidence: number;
}

/**
 * Runs OCR on a single image (data URL or blob URL).
 * @param imageSource - A data URL (base64) or object URL pointing to the image
 * @param onProgress - Optional callback receiving progress 0-100
 */
export async function recognizeImage(
  imageSource: string,
  onProgress?: (progress: number) => void
): Promise<OcrResult> {
  const worker = await getWorker();

  const result = await worker.recognize(imageSource, undefined, {
    // Return confidence at document level
  });

  if (onProgress) onProgress(100);

  return {
    text: result.data.text,
    confidence: result.data.confidence,
  };
}

/**
 * Terminates the worker. Call on page unload if needed.
 */
export async function terminateOcrWorker(): Promise<void> {
  if (workerInstance) {
    await workerInstance.terminate();
    workerInstance = null;
    initPromise = null;
  }
}
