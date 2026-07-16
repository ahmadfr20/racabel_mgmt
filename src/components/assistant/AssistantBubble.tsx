"use client";

import { useState } from "react";
import { ClipboardList, Gauge, MessageCircle, RefreshCcw, X } from "lucide-react";
import { AssistantChatPanel, type Suggestion } from "@/components/assistant/AssistantChatPanel";

const SUGGESTIONS: Suggestion[] = [
  { icon: ClipboardList, text: "Catat task log hari ini: menyiapkan laporan mingguan, status selesai, 2 jam." },
  { icon: RefreshCcw, text: "Buatkan PDCA Week 1 (1-5 Juli) dengan task: analisa winning content." },
  { icon: Gauge, text: "Hitung skor kinerja saya periode ini." },
];

// Chatbot yang diakses lewat bubble mengambang di pojok layar (tersedia di semua halaman).
// Menggunakan panel & endpoint universal yang sama dengan halaman AI Assistant (/financial)
// agar kemampuannya (tools + lampiran file) setara, hanya beda wadah tampilan.
export function AssistantBubble({ canUpload }: { canUpload: boolean }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      {open && (
        <div className="fixed bottom-24 right-5 z-40 flex h-[38rem] max-h-[80vh] w-[26rem] sm:w-[28rem] max-w-[calc(100vw-2.5rem)] flex-col overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-2xl animate-fade-in">
          <AssistantChatPanel
            canUpload={canUpload}
            suggestions={SUGGESTIONS}
            title="Asisten AI"
            subtitle="Keuangan · PDCA · Task Log · Kinerja · CPAS · SOP"
            onClose={() => setOpen(false)}
            variant="bubble"
          />
        </div>
      )}

      <button
        onClick={() => setOpen((v) => !v)}
        className="fixed bottom-5 right-5 z-40 grid h-14 w-14 place-items-center rounded-full bg-brand-600 text-white shadow-lg transition-transform hover:scale-105 hover:bg-brand-700"
        title="Asisten AI"
      >
        {open ? <X className="h-6 w-6" /> : <MessageCircle className="h-6 w-6" />}
      </button>
    </>
  );
}
