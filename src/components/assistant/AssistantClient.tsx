"use client";

import { useEffect, useRef, useState } from "react";
import { Bot, ClipboardList, Gauge, RefreshCcw, Send, User } from "lucide-react";
import { apiFetch } from "@/lib/http";
import { cn } from "@/lib/utils";
import { Card, PageHeader } from "@/components/ui";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

const SUGGESTIONS = [
  { icon: ClipboardList, text: "Bagaimana cara mencatat Task Log harian?" },
  { icon: RefreshCcw, text: "Jelaskan tahapan PDCA (Plan-Do-Check-Act)." },
  { icon: Gauge, text: "Bagaimana skor kinerja saya dihitung?" },
];

export function AssistantClient() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [configured, setConfigured] = useState<boolean | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    apiFetch<{ configured: boolean }>("/api/assistant/status")
      .then((d) => setConfigured(d.configured))
      .catch(() => setConfigured(null));
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending]);

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
    <div>
      <PageHeader
        title="Asisten AI"
        subtitle="Chatbot untuk membantu seputar PDCA, Task Log, dan Kinerja."
        action={
          configured === false ? (
            <span className="badge bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400">Belum Aktif</span>
          ) : configured === true ? (
            <span className="badge bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400">Aktif</span>
          ) : null
        }
      />

      {configured === false && (
        <div className="mb-4 rounded-xl bg-amber-50 dark:bg-amber-900/20 px-4 py-3 text-sm text-amber-700 dark:text-amber-400">
          Chatbot belum aktif — admin perlu menambahkan <code>ANTHROPIC_API_KEY</code> di file .env server. Anda tetap bisa
          mengirim pesan; chatbot akan membalas dengan pemberitahuan sampai fitur ini diaktifkan.
        </div>
      )}

      <Card className="!p-0 flex h-[65vh] flex-col overflow-hidden">
        <div className="flex-1 space-y-4 overflow-y-auto p-5">
          {messages.length === 0 && (
            <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
              <div className="grid h-14 w-14 place-items-center rounded-2xl bg-brand-50 dark:bg-brand-900/30 text-brand-600 dark:text-brand-400">
                <Bot className="h-7 w-7" />
              </div>
              <div>
                <p className="font-medium text-slate-700 dark:text-slate-200">Halo! Ada yang bisa saya bantu?</p>
                <p className="mt-1 text-sm text-slate-400">Tanyakan seputar PDCA, Task Log, atau Kinerja.</p>
              </div>
              <div className="flex flex-wrap justify-center gap-2">
                {SUGGESTIONS.map((s, i) => (
                  <button
                    key={i}
                    onClick={() => send(s.text)}
                    className="flex items-center gap-1.5 rounded-full border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                  >
                    <s.icon className="h-3.5 w-3.5" /> {s.text}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m, i) => (
            <div key={i} className={cn("flex items-start gap-3", m.role === "user" && "flex-row-reverse")}>
              <div
                className={cn(
                  "grid h-8 w-8 shrink-0 place-items-center rounded-full",
                  m.role === "user"
                    ? "bg-brand-600 text-white"
                    : "bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300"
                )}
              >
                {m.role === "user" ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
              </div>
              <div
                className={cn(
                  "max-w-[75%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm",
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
            <div className="flex items-start gap-3">
              <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                <Bot className="h-4 w-4" />
              </div>
              <div className="flex items-center gap-1 rounded-2xl bg-slate-100 dark:bg-slate-700 px-4 py-3">
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
            className="input flex-1"
            placeholder="Tulis pesan..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={sending}
          />
          <button type="submit" className="btn-primary !px-3.5" disabled={sending || !input.trim()}>
            <Send className="h-4 w-4" />
          </button>
        </form>
      </Card>
    </div>
  );
}
