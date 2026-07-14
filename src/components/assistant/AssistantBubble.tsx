"use client";

import { useEffect, useRef, useState } from "react";
import { Bot, ClipboardList, Gauge, MessageCircle, RefreshCcw, Send, User, X } from "lucide-react";
import { apiFetch } from "@/lib/http";
import { cn } from "@/lib/utils";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

const SUGGESTIONS = [
  { icon: ClipboardList, text: "Catat task log hari ini: menyiapkan laporan mingguan, status selesai, 2 jam." },
  { icon: RefreshCcw, text: "Buatkan PDCA Week 1 (1-5 Juli) dengan task: analisa winning content." },
  { icon: Gauge, text: "Hitung skor kinerja saya periode ini." },
];

// Chatbot yang diakses lewat bubble mengambang di pojok layar (tersedia di semua halaman),
// bukan lagi halaman tersendiri.
export function AssistantBubble() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [statusLoaded, setStatusLoaded] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open || statusLoaded) return;
    apiFetch<{ configured: boolean }>("/api/assistant/status")
      .then((d) => setConfigured(d.configured))
      .catch(() => setConfigured(null))
      .finally(() => setStatusLoaded(true));
  }, [open, statusLoaded]);

  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending, open]);

  async function send(text: string) {
    const content = text.trim();
    if (!content || sending) return;
    const next = [...messages, { role: "user" as const, content }];
    setMessages(next);
    setInput("");
    setSending(true);
    try {
      const res = await apiFetch<{ reply: string; configured: boolean }>("/api/assistant/chat", {
        method: "POST",
        body: JSON.stringify({ messages: next }),
      });
      setConfigured(res.configured);
      setMessages((cur) => [...cur, { role: "assistant", content: res.reply }]);
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
    <>
      {open && (
        <div className="fixed bottom-24 right-5 z-40 flex h-[32rem] max-h-[70vh] w-96 max-w-[calc(100vw-2.5rem)] flex-col overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-2xl animate-fade-in">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700 px-4 py-3">
            <div className="flex items-center gap-2">
              <div className="grid h-8 w-8 place-items-center rounded-full bg-brand-50 dark:bg-brand-900/30 text-brand-600 dark:text-brand-400">
                <Bot className="h-4 w-4" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">Asisten AI</p>
                <p className="text-[11px] text-slate-400">PDCA · Task Log · Kinerja</p>
              </div>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {configured === false && (
            <div className="border-b border-amber-100 dark:border-amber-900/30 bg-amber-50 dark:bg-amber-900/20 px-4 py-2 text-xs text-amber-700 dark:text-amber-400">
              Belum aktif — admin perlu mengatur ANTHROPIC_API_KEY di server.
            </div>
          )}

          <div className="flex-1 space-y-3 overflow-y-auto p-4">
            {messages.length === 0 && (
              <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
                <p className="text-sm font-medium text-slate-600 dark:text-slate-300">Halo! Ada yang bisa saya bantu?</p>
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
                    m.role === "user"
                      ? "bg-brand-600 text-white"
                      : "bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300"
                  )}
                >
                  {m.role === "user" ? <User className="h-3 w-3" /> : <Bot className="h-3 w-3" />}
                </div>
                <div
                  className={cn(
                    "max-w-[80%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm",
                    m.role === "user"
                      ? "bg-brand-600 text-white"
                      : "bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200"
                  )}
                >
                  {m.content}
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

          <form
            className="flex items-center gap-2 border-t border-slate-100 dark:border-slate-700 p-3"
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
          >
            <input
              className="input flex-1 !py-2 text-sm"
              placeholder="Tulis pesan..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={sending}
            />
            <button type="submit" className="btn-primary !px-3 !py-2" disabled={sending || !input.trim()}>
              <Send className="h-4 w-4" />
            </button>
          </form>
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
