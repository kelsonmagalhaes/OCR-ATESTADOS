"use client";

import { useState, useCallback } from "react";
import Header from "@/components/Header";
import UploadZone from "@/components/UploadZone";
import ProcessingQueue from "@/components/ProcessingQueue";
import DataTable from "@/components/DataTable";
import ExportButton from "@/components/ExportButton";
import { MedicalRecord, FileQueueItem, RecordField } from "@/types";
import { extractFields } from "@/lib/fieldExtractor";

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
    cid: "Não informado",
    local: "",
    profissional: "",
    observacao: "",
    arquivo: "",
    status: "done",
  };
}

export default function Home() {
  const [queue, setQueue] = useState<FileQueueItem[]>([]);
  const [records, setRecords] = useState<MedicalRecord[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);

  // -----------------------------------------------------------------------
  // File handling
  // -----------------------------------------------------------------------

  const handleFiles = useCallback((files: File[]) => {
    const newItems: FileQueueItem[] = files.map((file) => ({
      id: generateId(),
      file,
      progress: 0,
      status: "pending",
    }));
    setQueue((prev) => [...prev, ...newItems]);
  }, []);

  // -----------------------------------------------------------------------
  // OCR processing
  // -----------------------------------------------------------------------

  const processAll = useCallback(async () => {
    const pending = queue.filter((q) => q.status === "pending");
    if (pending.length === 0 || isProcessing) return;

    setIsProcessing(true);
    setHasStarted(true);

    // Lazy-import libs to avoid SSR errors
    const { pdfToImages } = await import("@/lib/pdfToImages");
    const { recognizeImage } = await import("@/lib/ocrEngine");

    for (const item of pending) {
      // Mark as processing
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
          // PDF → images
          images = await pdfToImages(item.file, (page, total) => {
            const pdfProgress = Math.round((page / total) * 40); // 5–45%
            setQueue((prev) =>
              prev.map((q) =>
                q.id === item.id
                  ? { ...q, progress: 5 + pdfProgress }
                  : q
              )
            );
          });
        } else {
          // Direct image
          const dataUrl = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(item.file);
          });
          images = [dataUrl];
        }

        setQueue((prev) =>
          prev.map((q) =>
            q.id === item.id ? { ...q, progress: 50 } : q
          )
        );

        // OCR all pages and concatenate
        let fullText = "";
        for (let i = 0; i < images.length; i++) {
          const result = await recognizeImage(images[i], (p) => {
            const ocrProgress = 50 + Math.round(((i + p / 100) / images.length) * 45);
            setQueue((prev) =>
              prev.map((q) =>
                q.id === item.id ? { ...q, progress: Math.min(ocrProgress, 95) } : q
              )
            );
          });
          fullText += result.text + "\n";
        }

        const record = extractFields(fullText, item.file.name);

        setRecords((prev) => [...prev, record]);
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
  }, [queue, isProcessing]);

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
      <Header />

      <main className="flex-1 max-w-screen-xl mx-auto w-full px-4 py-8 space-y-8">
        {/* Upload zone */}
        <section>
          <UploadZone onFiles={handleFiles} disabled={isProcessing} />
        </section>

        {/* Action bar */}
        {pendingCount > 0 && (
          <div className="flex items-center gap-4 flex-wrap">
            <button
              onClick={processAll}
              disabled={isProcessing}
              className="inline-flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-lg font-semibold text-sm hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed transition-all shadow-sm"
            >
              {isProcessing ? (
                <>
                  <svg
                    className="w-4 h-4 animate-spin"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8v8H4z"
                    />
                  </svg>
                  Processando...
                </>
              ) : (
                <>
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M13 10V3L4 14h7v7l9-11h-7z"
                    />
                  </svg>
                  Processar {pendingCount} arquivo{pendingCount !== 1 ? "s" : ""}
                </>
              )}
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
            <p className="text-sm mt-1">Tente enviar arquivos com melhor qualidade de scan.</p>
          </div>
        )}
      </main>

      <footer className="border-t border-gray-200 py-4 text-center text-xs text-gray-400">
        Todo o processamento ocorre no seu navegador — nenhum dado é enviado a servidores externos.
      </footer>
    </div>
  );
}
