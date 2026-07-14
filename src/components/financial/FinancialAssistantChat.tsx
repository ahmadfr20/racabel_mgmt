"use client";

import { useEffect, useRef, useState } from "react";
import { Bot, FileSpreadsheet, GitCompareArrows, Paperclip, Save, Send, User, X } from "lucide-react";
import { apiFetch } from "@/lib/http";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui";

interface DisplayMessage {
  role: "user" | "assistant";
  content: string;
  attachmentName?: string;
}

const SUGGESTIONS = [
  { icon: Save, text: "Simpan transaksi: pengeluaran listrik Rp1.500.000 hari ini, kategori Utilitas." },
  { icon: GitCompareArrows, text: "Bandingkan total pengeluaran bulan ini dengan bulan lalu, lalu simpan hasilnya." },
  { icon: FileSpreadsheet, text: "Identifikasi isi file yang saya lampirkan." },
];

const ACCEPT = ".csv,.xlsx,.xls,.pdf";
const MAX_FILE_SIZE = 8 * 1024 * 1024;

// Chat AI khusus halaman Keuangan: bisa menyimpan transaksi & hasil komparasi
// ke database, serta membaca lampiran Excel/CSV/PDF sebagai bahan analisis.
export function FinancialAssistantChat({ canUpload, onDataChanged }: { canUpload: boolean; onDataChanged: () => void }) {
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [input, setInput] = useState("");
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [sending, setSending] = useState(false);
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [statusLoaded, setStatusLoaded] = useState(false);
  const [fileError, setFileError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (statusLoaded) return;
    apiFetch<{ configured: boolean }>("/api/assistant/status")
      .then((d) => setConfigured(d.configured))
      .catch(() => setConfigured(null))
      .finally(() => setStatusLoaded(true));
  }, [statusLoaded]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending]);

  function pickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileError("");
    if (file.size > MAX_FILE_SIZE) {
      setFileError("Ukuran file maksimal 8MB.");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }
    setPendingFile(file);
  }

  async function send(rawText: string) {
    const text = rawText.trim();
    if (sending) return;
    if (!text && !pendingFile) return;

    const content = text || `Tolong baca dan identifikasi isi file "${pendingFile?.name}" ini.`;
    const userMsg: DisplayMessage = { role: "user", content, attachmentName: pendingFile?.name };
    const next = [...messages, userMsg];
    setMessages(next);
    setInput("");
    const fileToSend = pendingFile;
    setPendingFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    setSending(true);

    try {
      const formData = new FormData();
      formData.append("messages", JSON.stringify(next.map(({ role, content }) => ({ role, content }))));
      if (fileToSend) formData.append("file", fileToSend);

      const res = await fetch("/api/assistant/financial-chat", { method: "POST", body: formData });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Terjadi kesalahan");

      setConfigured(data.configured);
      setMessages((cur) => [...cur, { role: "assistant", content: data.reply }]);
      onDataChanged();
    } catch (err) {
      setMessages((cur) => [
        ...cur,
        { role: "assistant", content: err instanceof Error ? err.message : "Terjadi kesalahan. Coba lagi." },
      ]);
    } finally {
      setSending(false);
    }
  }

  return (
    <Card className="mb-6 !p-0 overflow-hidden">
      <div className="flex items-center gap-2.5 border-b border-slate-100 dark:border-slate-700 px-5 py-4">
        <div className="grid h-9 w-9 place-items-center rounded-full bg-brand-50 dark:bg-brand-900/30 text-brand-600 dark:text-brand-400">
          <Bot className="h-4.5 w-4.5" />
        </div>
        <div>
          <p className="font-semibold text-slate-800 dark:text-slate-100">Asisten Keuangan AI</p>
          <p className="text-xs text-slate-400">Perintahkan untuk menyimpan transaksi, membandingkan keuangan, atau membaca file.</p>
        </div>
      </div>

      {configured === false && (
        <div className="border-b border-amber-100 dark:border-amber-900/30 bg-amber-50 dark:bg-amber-900/20 px-5 py-2 text-xs text-amber-700 dark:text-amber-400">
          Belum aktif — admin perlu mengatur ANTHROPIC_API_KEY di server.
        </div>
      )}

      <div className="max-h-[26rem] min-h-[12rem] space-y-3 overflow-y-auto p-5">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-3 py-4 text-center">
            <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
              Contoh perintah yang bisa Anda coba:
            </p>
            <div className="flex flex-col gap-2">
              {SUGGESTIONS.map((s, i) => (
                <button
                  key={i}
                  onClick={() => send(s.text)}
                  className="flex items-center gap-1.5 rounded-full border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-left text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  <s.icon className="h-3.5 w-3.5 shrink-0" /> {s.text}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} className={cn("flex items-start gap-2", m.role === "user" && "flex-row-reverse")}>
            <div
              className={cn(
                "grid h-6 w-6 shrink-0 place-items-center rounded-full",
                m.role === "user" ? "bg-brand-600 text-white" : "bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300"
              )}
            >
              {m.role === "user" ? <User className="h-3 w-3" /> : <Bot className="h-3 w-3" />}
            </div>
            <div className={cn("max-w-[80%]", m.role === "user" && "flex flex-col items-end")}>
              {m.attachmentName && (
                <span className="mb-1 inline-flex items-center gap-1 rounded-full bg-slate-100 dark:bg-slate-700 px-2 py-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                  <Paperclip className="h-3 w-3" /> {m.attachmentName}
                </span>
              )}
              <div
                className={cn(
                  "whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm",
                  m.role === "user" ? "bg-brand-600 text-white" : "bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200"
                )}
              >
                {m.content}
              </div>
            </div>
          </div>
        ))}

        {sending && (
          <div className="flex items-start gap-2">
            <div className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
              <Bot className="h-3 w-3" />
            </div>
            <div className="flex items-center gap-1 rounded-2xl bg-slate-100 dark:bg-slate-700 px-3 py-2.5">
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400" style={{ animationDelay: "-0.3s" }} />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400" style={{ animationDelay: "-0.15s" }} />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400" />
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {fileError && <div className="px-5 pb-2 text-xs text-red-600 dark:text-red-400">{fileError}</div>}
      {pendingFile && (
        <div className="mx-5 mb-2 flex items-center justify-between rounded-lg bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs text-slate-600 dark:text-slate-300">
          <span className="inline-flex items-center gap-1.5"><Paperclip className="h-3.5 w-3.5" /> {pendingFile.name}</span>
          <button onClick={() => { setPendingFile(null); if (fileInputRef.current) fileInputRef.current.value = ""; }} className="rounded p-1 hover:bg-slate-200 dark:hover:bg-slate-700">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      <form
        className="flex items-center gap-2 border-t border-slate-100 dark:border-slate-700 p-4"
        onSubmit={(e) => { e.preventDefault(); send(input); }}
      >
        {canUpload && (
          <label className="cursor-pointer rounded-lg p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-brand-600" title="Lampirkan file Excel/CSV/PDF">
            <Paperclip className="h-4.5 w-4.5" />
            <input ref={fileInputRef} type="file" accept={ACCEPT} className="hidden" onChange={pickFile} />
          </label>
        )}
        <input
          className="input flex-1 !py-2 text-sm"
          placeholder="Tulis perintah, mis. simpan transaksi atau bandingkan keuangan..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={sending}
        />
        <button type="submit" className="btn-primary !px-3 !py-2" disabled={sending || (!input.trim() && !pendingFile)}>
          <Send className="h-4 w-4" />
        </button>
      </form>
    </Card>
  );
}
