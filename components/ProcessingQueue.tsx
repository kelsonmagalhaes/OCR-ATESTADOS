"use client";

import { FileQueueItem } from "@/types";

interface ProcessingQueueProps {
  queue: FileQueueItem[];
}

const STATUS_LABELS: Record<FileQueueItem["status"], string> = {
  pending: "Aguardando",
  processing: "Processando",
  done: "Concluído",
  error: "Erro",
};

const STATUS_COLORS: Record<FileQueueItem["status"], string> = {
  pending: "bg-gray-100 text-gray-600",
  processing: "bg-blue-100 text-blue-700",
  done: "bg-green-100 text-green-700",
  error: "bg-red-100 text-red-700",
};

function FileIcon({ isPdf }: { isPdf: boolean }) {
  return (
    <div
      className={`flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center text-xs font-bold ${
        isPdf ? "bg-red-100 text-red-600" : "bg-indigo-100 text-indigo-600"
      }`}
    >
      {isPdf ? "PDF" : "IMG"}
    </div>
  );
}

export default function ProcessingQueue({ queue }: ProcessingQueueProps) {
  if (queue.length === 0) return null;

  return (
    <div className="space-y-2">
      <h2 className="text-sm font-semibold text-gray-600 uppercase tracking-wide">
        Fila de Processamento ({queue.length})
      </h2>
      <ul className="space-y-2 max-h-64 overflow-y-auto pr-1">
        {queue.map((item) => (
          <li
            key={item.id}
            className="flex items-center gap-3 bg-white border border-gray-200 rounded-lg px-3 py-2"
          >
            <FileIcon isPdf={item.file.type === "application/pdf"} />

            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-800 truncate">
                {item.file.name}
              </p>
              {item.status === "processing" && (
                <div className="mt-1 w-full bg-gray-200 rounded-full h-1.5">
                  <div
                    className="bg-blue-500 h-1.5 rounded-full transition-all duration-300"
                    style={{ width: `${item.progress}%` }}
                  />
                </div>
              )}
              {item.error && (
                <p className="text-xs text-red-500 mt-0.5 truncate">
                  {item.error}
                </p>
              )}
            </div>

            <span
              className={`flex-shrink-0 text-xs px-2 py-0.5 rounded-full font-medium ${
                STATUS_COLORS[item.status]
              }`}
            >
              {item.status === "processing" ? (
                <span className="flex items-center gap-1">
                  <span className="inline-block w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
                  {item.progress}%
                </span>
              ) : (
                STATUS_LABELS[item.status]
              )}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
