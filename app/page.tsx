"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import Header from "@/components/Header";
import UploadZone from "@/components/UploadZone";
import ProcessingQueue from "@/components/ProcessingQueue";
import DataTable from "@/components/DataTable";
import ExportButton from "@/components/ExportButton";
import SettingsModal, { STORAGE_KEY } from "@/components/SettingsModal";
import { MedicalRecord, FileQueueItem, RecordField } from "@/types";

const BATCH_SIZE = 3; // pages processed in parallel per batch
const BATCH_DELAY_MS = 1000; // 1s delay between batches to respect rate limits

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function emptyRecord(): MedicalRecord {
  return {
    id: generateId(),
    nome: "",
    tipo: "",
    dataAtendimento: "",
    periodoDias: "",
    horario: "",
    cid: "Nao informado",
    local: "",
    profissional: "",
    observacao: "",
    arquivo: "",
    status: "done",
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export default function Home() {
  const [queue, setQueue] = useState<FileQueueItem[]>([]);
  const [records, setRecords] = useState<MedicalRecord[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [apiKey, setApiKey] = useState<string>("");
  const [estimatedTimeLeft, setEstimatedTimeLeft] = useState<string>("");

  // Track pages processed for ETA
  const processingStartRef = useRef<number>(0);
  const pagesProcessedRef = useRef<number>(0);
  const totalPagesRef = useRef<number>(0);

  // Load API key from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY) || "";
    setApiKey(stored);
  }, []);

  const handleSaveApiKey = useCallback((key: string) => {
    setApiKey(key);
    if (key) {
      localStorage.setItem(STORAGE_KEY, key);
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  // -----------------------------------------------------------------------
  // File handling — auto-start processing when files are added
  // -----------------------------------------------------------------------

  const processAllRef = useRef<(() => Promise<void>) | null>(null);

  const handleFiles = useCallback(
    (files: File[]) => {
      const newItems: FileQueueItem[] = files.map((file) => ({
        id: generateId(),
        file,
        progress: 0,
        status: "pending",
      }));
      setQueue((prev) => [...prev, ...newItems]);
    },
    []
  );

  // Auto-start when new files are added (via effect watching queue length)
  const queueRef = useRef<FileQueueItem[]>([]);
  queueRef.current = queue;

  // -----------------------------------------------------------------------
  // OCR processing: each PDF page = one certificate, batches of 3, 1s delay
  // -----------------------------------------------------------------------

  const processAll = useCallback(async () => {
    const pending = queueRef.current.filter((q) => q.status === "pending");
    if (pending.length === 0 || isProcessing) return;

    // Check API key
    const key = localStorage.getItem(STORAGE_KEY) || "";
    if (!key && !process.env.NEXT_PUBLIC_HAS_SERVER_KEY) {
      setSettingsOpen(true);
      return;
    }

    setIsProcessing(true);
    setHasStarted(true);
    processingStartRef.current = Date.now();
    pagesProcessedRef.current = 0;
    totalPagesRef.current = 0;

    const { pdfToImages } = await import("@/lib/pdfToImages");
    const { recognizeImage, fieldsToRecord } = await import("@/lib/ocrEngine");

    for (const item of pending) {
      setQueue((prev) =>
        prev.map((q) =>
          q.id === item.id ? { ...q, status: "processing", progress: 5 } : q
        )
      );

      try {
        let images: string[];

        if (
          item.file.type === "application/pdf" ||
          item.file.name.toLowerCase().endsWith(".pdf")
        ) {
          images = await pdfToImages(item.file, (page, total) => {
            const pdfProgress = Math.round((page / total) * 30);
            setQueue((prev) =>
              prev.map((q) =>
                q.id === item.id ? { ...q, progress: 5 + pdfProgress } : q
              )
            );
            totalPagesRef.current = Math.max(totalPagesRef.current, total);
          });
        } else {
          const dataUrl = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(item.file);
          });
          images = [dataUrl];
          totalPagesRef.current += 1;
        }

        setQueue((prev) =>
          prev.map((q) =>
            q.id === item.id ? { ...q, progress: 35 } : q
          )
        );

        // Process pages in batches of BATCH_SIZE with delay between batches
        // Each page is one certificate — collect non-blank results
        const pageRecords: MedicalRecord[] = [];

        for (let batchStart = 0; batchStart < images.length; batchStart += BATCH_SIZE) {
          // Add delay between batches (not before the first one)
          if (batchStart > 0) {
            await sleep(BATCH_DELAY_MS);
          }

          const batchEnd = Math.min(batchStart + BATCH_SIZE, images.length);
          const batch = images.slice(batchStart, batchEnd);

          const batchResults = await Promise.all(
            batch.map((img, batchIdx) =>
              recognizeImage(img, key, (p) => {
                const pageIdx = batchStart + batchIdx;
                const baseProgress = 35 + Math.round(((pageIdx + p / 100) / images.length) * 60);
                setQueue((prev) =>
                  prev.map((q) =>
                    q.id === item.id
                      ? { ...q, progress: Math.min(baseProgress, 95) }
                      : q
                  )
                );
              })
            )
          );

          for (let i = 0; i < batchResults.length; i++) {
            const result = batchResults[i];
            // Skip blank pages
            if (result.isBlank) continue;
            const record = fieldsToRecord(result.fields, item.file.name);
            pageRecords.push(record);
          }

          pagesProcessedRef.current += batch.length;

          // Update ETA
          const elapsed = (Date.now() - processingStartRef.current) / 1000;
          const pagesPerSec = pagesProcessedRef.current / elapsed;
          const remaining = totalPagesRef.current - pagesProcessedRef.current;
          if (pagesPerSec > 0 && remaining > 0) {
            const secLeft = Math.ceil(remaining / pagesPerSec);
            setEstimatedTimeLeft(
              secLeft > 60
                ? `~${Math.ceil(secLeft / 60)} min restantes`
                : `~${secLeft}s restantes`
            );
          } else {
            setEstimatedTimeLeft("");
          }
        }

        // Add all records from this file
        if (pageRecords.length > 0) {
          setRecords((prev) => [...prev, ...pageRecords]);
        }

        setQueue((prev) =>
          prev.map((q) =>
            q.id === item.id ? { ...q, status: "done", progress: 100 } : q
          )
        );
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Erro desconhecido";
        setQueue((prev) =>
          prev.map((q) =>
            q.id === item.id
              ? { ...q, status: "error", progress: 0, error: message }
              : q
          )
        );
      }
    }

    setIsProcessing(false);
    setEstimatedTimeLeft("");
  }, [isProcessing]);

  // Store processAll in ref so auto-start effect can call it
  processAllRef.current = processAll;

  // Auto-start: trigger processing whenever new pending items are added
  useEffect(() => {
    const pending = queue.filter((q) => q.status === "pending");
    if (pending.length > 0 && !isProcessing) {
      processAllRef.current?.();
    }
  }, [queue.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // -----------------------------------------------------------------------
  // Table mutations
  // -----------------------------------------------------------------------

  const handleCellChange = useCallback(
    (id: string, field: RecordField, value: string) => {
      setRecords((prev) =>
        prev.map((r) => (r.id === id ? { ...r, [field]: value } : r))
      );
    },
    []
  );

  const handleRemoveRow = useCallback((id: string) => {
    setRecords((prev) => prev.filter((r) => r.id !== id));
  }, []);

  const handleAddRow = useCallback(() => {
    setRecords((prev) => [...prev, emptyRecord()]);
  }, []);

  // -----------------------------------------------------------------------
  // Derived state
  // -----------------------------------------------------------------------

  const pendingCount = queue.filter((q) => q.status === "pending").length;
  const doneCount = queue.filter((q) => q.status === "done").length;
  const totalQueued = queue.length;

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  return (
    <div className="min-h-screen flex flex-col">
      <Header
        onOpenSettings={() => setSettingsOpen(true)}
        hasApiKey={!!apiKey}
      />

      <SettingsModal
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        onSave={handleSaveApiKey}
        currentKey={apiKey}
      />

      <main className="flex-1 max-w-screen-xl mx-auto w-full px-4 py-8 space-y-8">
        {/* API key warning */}
        {!apiKey && (
          <div
            className="flex items-center gap-3 bg-orange-50 border border-orange-200 rounded-lg px-4 py-3 text-sm text-orange-800 cursor-pointer hover:bg-orange-100 transition-colors"
            onClick={() => setSettingsOpen(true)}
          >
            <svg className="w-5 h-5 flex-shrink-0 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <span>
              <strong>API Key não configurada.</strong> Clique aqui para configurar sua Google API Key (Gemini) antes de processar.
            </span>
          </div>
        )}

        {/* Upload zone */}
        <section>
          <UploadZone onFiles={handleFiles} disabled={isProcessing} />
        </section>

        {/* Status bar while processing */}
        {isProcessing && (
          <div className="flex items-center gap-3 text-sm text-gray-600">
            <svg className="w-4 h-4 animate-spin text-blue-600" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
            <span>
              Processando com Google Gemini 1.5 Flash...
              {estimatedTimeLeft && (
                <span className="ml-2 text-gray-400">{estimatedTimeLeft}</span>
              )}
            </span>
          </div>
        )}

        {/* Manual trigger (shown only if there are pending files and not auto-started) */}
        {pendingCount > 0 && !isProcessing && (
          <div className="flex items-center gap-4 flex-wrap">
            <button
              onClick={processAll}
              disabled={isProcessing}
              className="inline-flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-lg font-semibold text-sm hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed transition-all shadow-sm"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              Processar {pendingCount} arquivo{pendingCount !== 1 ? "s" : ""}
            </button>

            {hasStarted && doneCount > 0 && (
              <p className="text-sm text-gray-500">
                {doneCount} de {totalQueued} concluído{doneCount !== 1 ? "s" : ""}
              </p>
            )}
          </div>
        )}

        {/* Processing queue */}
        <ProcessingQueue queue={queue} />

        {/* Data table + export */}
        {records.length > 0 && (
          <section className="space-y-4">
            <DataTable
              records={records}
              onChange={handleCellChange}
              onRemove={handleRemoveRow}
              onAddRow={handleAddRow}
            />
            <div className="flex justify-end">
              <ExportButton records={records} />
            </div>
          </section>
        )}

        {/* Empty state after processing */}
        {hasStarted && records.length === 0 && !isProcessing && (
          <div className="text-center py-12 text-gray-400">
            <p className="text-lg">Nenhum dado extraído.</p>
            <p className="text-sm mt-1">
              Verifique se a API Key está correta e tente novamente.
            </p>
          </div>
        )}
      </main>

      <footer className="border-t border-gray-200 py-4 text-center text-xs text-gray-400">
        OCR via Google Gemini 1.5 Flash — dados processados no servidor sem persistência
      </footer>
    </div>
  );
}
