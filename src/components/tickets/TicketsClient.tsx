"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle, CalendarClock, Check, MessageSquare, Pencil, Plus, Send, Ticket as TicketIcon, Trash2, User as UserIcon,
} from "lucide-react";
import { apiFetch } from "@/lib/http";
import {
  cn, formatDate, isTicketOverdue, TICKET_CATEGORIES, TICKET_PRIORITY_LABEL, TICKET_STATUS_LABEL,
} from "@/lib/utils";
import { Card, EmptyState, PageHeader, StatCard, StatusBadge } from "@/components/ui";
import { Modal } from "@/components/Modal";

interface Ticket {
  id: number;
  title: string;
  description: string;
  category: string;
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  status: "OPEN" | "IN_PROGRESS" | "RESOLVED" | "CLOSED";
  requesterId: number;
  requesterName: string;
  requesterDept: string | null;
  assigneeId: number | null;
  assigneeName: string | null;
  dueDate: string | null;
  resolvedAt: string | null;
  resolutionNote: string | null;
  commentCount: number;
  createdAt: string;
  updatedAt: string;
}
interface Comment { id: number; body: string; authorId: number; authorName: string; createdAt: string }
interface TicketDetail extends Omit<Ticket, "commentCount"> { comments: Comment[] }
interface Person { id: number; fullName: string }

const PRIORITY_CLS: Record<string, string> = {
  LOW:    "bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300",
  MEDIUM: "bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400",
  HIGH:   "bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400",
  URGENT: "bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400",
};

const STATUS_FILTERS: { key: string; label: string }[] = [
  { key: "", label: "Semua" },
  { key: "OPEN", label: "Terbuka" },
  { key: "IN_PROGRESS", label: "Dikerjakan" },
  { key: "RESOLVED", label: "Selesai" },
  { key: "CLOSED", label: "Ditutup" },
];

const EMPTY_FORM = {
  title: "", description: "", category: "Umum", priority: "MEDIUM",
  assigneeId: "", dueDate: "", status: "OPEN", resolutionNote: "",
};

const ticketCode = (id: number) => `#${String(id).padStart(4, "0")}`;

export function TicketsClient({
  currentUserId, canCreate, canManage, canViewAll,
}: {
  currentUserId: number; canCreate: boolean; canManage: boolean; canViewAll: boolean;
}) {
  const [scope, setScope] = useState<"mine" | "all">(canViewAll ? "all" : "mine");
  const [statusFilter, setStatusFilter] = useState("");
  const [list, setList] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [people, setPeople] = useState<Person[]>([]);

  // Form modal (buat / edit)
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Ticket | null>(null);
  const [form, setForm] = useState<any>(EMPTY_FORM);
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  // Detail modal
  const [detail, setDetail] = useState<TicketDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams({ scope, ...(statusFilter ? { status: statusFilter } : {}) });
      setList(await apiFetch<Ticket[]>(`/api/tickets?${qs}`));
    } finally {
      setLoading(false);
    }
  }, [scope, statusFilter]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (canManage) apiFetch<Person[]>("/api/employees").then(setPeople).catch(() => setPeople([]));
  }, [canManage]);

  const set = (k: string) => (e: any) => setForm((f: any) => ({ ...f, [k]: e.target.value }));

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setFormError("");
    setFormOpen(true);
  }
  function openEdit(t: Ticket) {
    setEditing(t);
    setForm({
      title: t.title, description: t.description, category: t.category, priority: t.priority,
      assigneeId: t.assigneeId ? String(t.assigneeId) : "",
      dueDate: t.dueDate ? t.dueDate.slice(0, 10) : "",
      status: t.status, resolutionNote: t.resolutionNote ?? "",
    });
    setFormError("");
    setFormOpen(true);
  }

  async function submitForm(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setFormError("");
    try {
      const payload: any = {
        title: form.title, description: form.description,
        category: form.category, priority: form.priority,
      };
      if (canManage) {
        payload.assigneeId = form.assigneeId ? Number(form.assigneeId) : null;
        payload.dueDate = form.dueDate || null;
        if (editing) {
          payload.status = form.status;
          payload.resolutionNote = form.resolutionNote;
        }
      }
      if (editing) await apiFetch(`/api/tickets/${editing.id}`, { method: "PATCH", body: JSON.stringify(payload) });
      else await apiFetch("/api/tickets", { method: "POST", body: JSON.stringify(payload) });
      setFormOpen(false);
      await load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Gagal menyimpan tiket");
    } finally {
      setSaving(false);
    }
  }

  async function openDetail(id: number) {
    setDetailLoading(true);
    setComment("");
    try {
      setDetail(await apiFetch<TicketDetail>(`/api/tickets/${id}`));
    } catch (err) {
      alert(err instanceof Error ? err.message : "Gagal memuat detail");
    } finally {
      setDetailLoading(false);
    }
  }

  async function refreshDetail() {
    if (!detail) return;
    setDetail(await apiFetch<TicketDetail>(`/api/tickets/${detail.id}`));
  }

  async function changeStatus(next: string, note?: string) {
    if (!detail) return;
    setBusy(true);
    try {
      const payload: any = { status: next };
      if (note !== undefined) payload.resolutionNote = note;
      await apiFetch(`/api/tickets/${detail.id}`, { method: "PATCH", body: JSON.stringify(payload) });
      await refreshDetail();
      await load();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Gagal mengubah status");
    } finally {
      setBusy(false);
    }
  }

  async function resolveTicket() {
    const note = prompt("Catatan penyelesaian (opsional):") ?? "";
    await changeStatus("RESOLVED", note);
  }

  async function addComment(e: React.FormEvent) {
    e.preventDefault();
    if (!detail || !comment.trim()) return;
    setBusy(true);
    try {
      await apiFetch(`/api/tickets/${detail.id}/comments`, { method: "POST", body: JSON.stringify({ body: comment }) });
      setComment("");
      await refreshDetail();
      await load();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Gagal mengirim komentar");
    } finally {
      setBusy(false);
    }
  }

  async function remove(t: Ticket | TicketDetail) {
    if (!confirm(`Hapus tiket ${ticketCode(t.id)} "${t.title}"?`)) return;
    try {
      await apiFetch(`/api/tickets/${t.id}`, { method: "DELETE" });
      setDetail(null);
      await load();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Gagal menghapus");
    }
  }

  // Statistik ringkas
  const openCount = list.filter((t) => t.status === "OPEN" || t.status === "IN_PROGRESS").length;
  const overdueCount = list.filter((t) => isTicketOverdue(t.dueDate, t.status)).length;
  const resolvedCount = list.filter((t) => t.status === "RESOLVED" || t.status === "CLOSED").length;

  return (
    <div>
      <PageHeader
        title="Ticketing System"
        subtitle={canManage ? "Kelola, tugaskan PIC, dan pantau penyelesaian tiket." : "Ajukan tiket kendala/permintaan dan pantau progresnya."}
        action={canCreate && (
          <button className="btn-primary" onClick={openCreate}><Plus className="h-4 w-4" /> Ajukan Tiket</button>
        )}
      />

      {/* Statistik */}
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Total Tiket" value={list.length} icon={<TicketIcon className="h-5 w-5" />} tone="brand" />
        <StatCard label="Belum Selesai" value={openCount} icon={<CalendarClock className="h-5 w-5" />} tone={openCount > 0 ? "amber" : "slate"} />
        <StatCard label="Overdue" value={overdueCount} icon={<AlertTriangle className="h-5 w-5" />} tone={overdueCount > 0 ? "red" : "slate"} />
        <StatCard label="Selesai" value={resolvedCount} icon={<Check className="h-5 w-5" />} tone="green" />
      </div>

      {/* Kontrol */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        {canViewAll && (
          <div className="flex rounded-lg bg-slate-100 dark:bg-slate-800 p-1 text-sm">
            <button onClick={() => setScope("all")} className={cn("rounded-md px-4 py-1.5 font-medium", scope === "all" ? "bg-white dark:bg-slate-700 text-brand-700 dark:text-brand-300 shadow-sm" : "text-slate-500 dark:text-slate-400")}>Semua Tiket</button>
            <button onClick={() => setScope("mine")} className={cn("rounded-md px-4 py-1.5 font-medium", scope === "mine" ? "bg-white dark:bg-slate-700 text-brand-700 dark:text-brand-300 shadow-sm" : "text-slate-500 dark:text-slate-400")}>Tiket Saya</button>
          </div>
        )}
        <div className="flex flex-wrap gap-1.5">
          {STATUS_FILTERS.map((s) => (
            <button
              key={s.key}
              onClick={() => setStatusFilter(s.key)}
              className={cn(
                "rounded-full px-3 py-1 text-xs font-medium transition-colors",
                statusFilter === s.key
                  ? "bg-brand-600 text-white"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
              )}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="py-16 text-center text-sm text-slate-400">Memuat tiket...</div>
      ) : list.length === 0 ? (
        <EmptyState title="Belum ada tiket" subtitle={canCreate ? "Ajukan tiket pertama Anda." : undefined} icon={<TicketIcon className="h-10 w-10" />} />
      ) : (
        <div className="grid gap-3">
          {list.map((t) => {
            const overdue = isTicketOverdue(t.dueDate, t.status);
            return (
              <Card key={t.id} className="!p-4 cursor-pointer transition-shadow hover:shadow-md" >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between" onClick={() => openDetail(t.id)}>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-mono text-slate-400">{ticketCode(t.id)}</span>
                      <p className="font-semibold text-slate-800 dark:text-slate-100">{t.title}</p>
                      <StatusBadge status={t.status} label={TICKET_STATUS_LABEL[t.status]} />
                      <span className={cn("badge", PRIORITY_CLS[t.priority])}>{TICKET_PRIORITY_LABEL[t.priority]}</span>
                      {overdue && <span className="badge bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400"><AlertTriangle className="mr-1 h-3 w-3" /> Overdue</span>}
                    </div>
                    <p className="mt-1 line-clamp-1 text-sm text-slate-500 dark:text-slate-400">{t.description}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
                      <span className="inline-flex items-center gap-1"><UserIcon className="h-3.5 w-3.5" /> Pengaju: {t.requesterName}</span>
                      <span className="inline-flex items-center gap-1"><Check className="h-3.5 w-3.5" /> PIC: {t.assigneeName ?? <span className="italic text-slate-400">belum ditugaskan</span>}</span>
                      <span className={cn("inline-flex items-center gap-1", overdue && "font-medium text-red-600 dark:text-red-400")}>
                        <CalendarClock className="h-3.5 w-3.5" /> {t.dueDate ? `Due: ${formatDate(t.dueDate)}` : "Tanpa due date"}
                      </span>
                      <span className="inline-flex items-center gap-1"><MessageSquare className="h-3.5 w-3.5" /> {t.commentCount}</span>
                      <span className="rounded bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5">{t.category}</span>
                    </div>
                  </div>
                  {(canManage || (t.requesterId === currentUserId && t.status === "OPEN")) && (
                    <div className="flex shrink-0 gap-1" onClick={(e) => e.stopPropagation()}>
                      {canManage && (
                        <button onClick={() => openEdit(t)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-brand-600" title="Ubah"><Pencil className="h-4 w-4" /></button>
                      )}
                      <button onClick={() => remove(t)} className="rounded-lg p-2 text-slate-400 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600" title="Hapus"><Trash2 className="h-4 w-4" /></button>
                    </div>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* ===== Modal buat / edit ===== */}
      {formOpen && (
        <Modal open onClose={() => setFormOpen(false)} title={editing ? `Ubah Tiket ${ticketCode(editing.id)}` : "Ajukan Tiket Baru"} size="lg">
          <form onSubmit={submitForm} className="space-y-4">
            <div>
              <label className="label">Judul *</label>
              <input className="input" value={form.title} onChange={set("title")} required placeholder="mis. Printer di gudang tidak berfungsi" />
            </div>
            <div>
              <label className="label">Deskripsi *</label>
              <textarea className="input min-h-[90px]" value={form.description} onChange={set("description")} required placeholder="Jelaskan detail kendala / permintaan Anda" />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="label">Kategori</label>
                <select className="input" value={form.category} onChange={set("category")}>
                  {TICKET_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Prioritas</label>
                <select className="input" value={form.priority} onChange={set("priority")}>
                  {Object.entries(TICKET_PRIORITY_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              {canManage && (
                <>
                  <div>
                    <label className="label">PIC Penyelesai</label>
                    <select className="input" value={form.assigneeId} onChange={set("assigneeId")}>
                      <option value="">— Belum ditugaskan —</option>
                      {people.map((p) => <option key={p.id} value={p.id}>{p.fullName}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="label">Due Date</label>
                    <input type="date" className="input" value={form.dueDate} onChange={set("dueDate")} />
                  </div>
                </>
              )}
              {canManage && editing && (
                <>
                  <div>
                    <label className="label">Status</label>
                    <select className="input" value={form.status} onChange={set("status")}>
                      {Object.entries(TICKET_STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                  </div>
                  <div className="sm:col-span-2">
                    <label className="label">Catatan Penyelesaian</label>
                    <textarea className="input min-h-[60px]" value={form.resolutionNote} onChange={set("resolutionNote")} placeholder="Tindakan yang dilakukan untuk menyelesaikan tiket" />
                  </div>
                </>
              )}
            </div>
            {!canManage && !editing && (
              <p className="rounded-xl bg-slate-50 dark:bg-slate-800 px-4 py-3 text-xs text-slate-500 dark:text-slate-400">
                PIC penyelesai & due date akan ditentukan oleh tim pengelola setelah tiket diajukan.
              </p>
            )}
            {formError && <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">{formError}</div>}
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" className="btn-ghost" onClick={() => setFormOpen(false)}>Batal</button>
              <button type="submit" className="btn-primary" disabled={saving}>{saving ? "Menyimpan..." : editing ? "Simpan" : "Kirim Tiket"}</button>
            </div>
          </form>
        </Modal>
      )}

      {/* ===== Modal detail ===== */}
      {(detail || detailLoading) && (
        <Modal open onClose={() => setDetail(null)} title={detail ? `Tiket ${ticketCode(detail.id)}` : "Memuat..."} size="lg">
          {detailLoading || !detail ? (
            <div className="py-10 text-center text-sm text-slate-400">Memuat detail...</div>
          ) : (
            <DetailBody
              detail={detail}
              currentUserId={currentUserId}
              canManage={canManage}
              comment={comment}
              setComment={setComment}
              busy={busy}
              onEdit={() => { setDetail(null); const t = list.find((x) => x.id === detail.id); if (t) openEdit(t); }}
              onChangeStatus={changeStatus}
              onResolve={resolveTicket}
              onAddComment={addComment}
              onDelete={() => remove(detail)}
            />
          )}
        </Modal>
      )}
    </div>
  );
}

function DetailBody({
  detail, currentUserId, canManage, comment, setComment, busy,
  onEdit, onChangeStatus, onResolve, onAddComment, onDelete,
}: {
  detail: TicketDetail; currentUserId: number; canManage: boolean;
  comment: string; setComment: (v: string) => void; busy: boolean;
  onEdit: () => void; onChangeStatus: (s: string) => void; onResolve: () => void;
  onAddComment: (e: React.FormEvent) => void; onDelete: () => void;
}) {
  const isAssignee = detail.assigneeId === currentUserId;
  const isRequester = detail.requesterId === currentUserId;
  const overdue = isTicketOverdue(detail.dueDate, detail.status);
  const active = detail.status === "OPEN" || detail.status === "IN_PROGRESS";

  return (
    <div className="space-y-5">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{detail.title}</h3>
          <StatusBadge status={detail.status} label={TICKET_STATUS_LABEL[detail.status]} />
          <span className={cn("badge", PRIORITY_CLS[detail.priority])}>{TICKET_PRIORITY_LABEL[detail.priority]}</span>
          {overdue && <span className="badge bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400"><AlertTriangle className="mr-1 h-3 w-3" /> Overdue</span>}
        </div>
        <p className="mt-2 whitespace-pre-wrap text-sm text-slate-600 dark:text-slate-300">{detail.description}</p>
      </div>

      <div className="grid grid-cols-2 gap-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 p-4 text-sm">
        <Info label="Pengaju" value={detail.requesterName + (detail.requesterDept ? ` · ${detail.requesterDept}` : "")} />
        <Info label="PIC Penyelesai" value={detail.assigneeName ?? "Belum ditugaskan"} />
        <Info label="Kategori" value={detail.category} />
        <Info label="Due Date" value={detail.dueDate ? formatDate(detail.dueDate) : "—"} danger={overdue} />
        <Info label="Dibuat" value={formatDate(detail.createdAt, true)} />
        <Info label="Diselesaikan" value={detail.resolvedAt ? formatDate(detail.resolvedAt, true) : "—"} />
      </div>

      {detail.resolutionNote && (
        <div className="rounded-xl border border-emerald-100 dark:border-emerald-900/40 bg-emerald-50/60 dark:bg-emerald-900/20 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-400">Catatan Penyelesaian</p>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300 whitespace-pre-wrap">{detail.resolutionNote}</p>
        </div>
      )}

      {/* Aksi */}
      <div className="flex flex-wrap gap-2">
        {(canManage || isAssignee) && detail.status === "OPEN" && (
          <button className="btn bg-amber-50 text-amber-700 hover:bg-amber-100 !py-2" disabled={busy} onClick={() => onChangeStatus("IN_PROGRESS")}>Mulai Kerjakan</button>
        )}
        {(canManage || isAssignee) && active && (
          <button className="btn bg-emerald-50 text-emerald-700 hover:bg-emerald-100 !py-2" disabled={busy} onClick={onResolve}><Check className="h-4 w-4" /> Tandai Selesai</button>
        )}
        {(canManage || isRequester) && detail.status === "RESOLVED" && (
          <button className="btn bg-slate-100 text-slate-700 hover:bg-slate-200 !py-2" disabled={busy} onClick={() => onChangeStatus("CLOSED")}>Tutup Tiket</button>
        )}
        {(canManage || isRequester) && (detail.status === "RESOLVED" || detail.status === "CLOSED") && (
          <button className="btn bg-blue-50 text-blue-700 hover:bg-blue-100 !py-2" disabled={busy} onClick={() => onChangeStatus("OPEN")}>Buka Kembali</button>
        )}
        {canManage && (
          <button className="btn-ghost !py-2" onClick={onEdit}><Pencil className="h-4 w-4" /> Ubah / Assign</button>
        )}
        {(canManage || (isRequester && detail.status === "OPEN")) && (
          <button className="btn-danger !py-2 ml-auto" onClick={onDelete}><Trash2 className="h-4 w-4" /> Hapus</button>
        )}
      </div>

      {/* Diskusi / komentar */}
      <div className="border-t border-slate-100 dark:border-slate-700 pt-4">
        <p className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
          <MessageSquare className="h-4 w-4" /> Diskusi ({detail.comments.length})
        </p>
        <div className="mb-3 space-y-3">
          {detail.comments.length === 0 ? (
            <p className="text-sm text-slate-400">Belum ada komentar.</p>
          ) : detail.comments.map((c) => (
            <div key={c.id} className="rounded-xl bg-slate-50 dark:bg-slate-800/50 p-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-slate-700 dark:text-slate-200">{c.authorName}{c.authorId === currentUserId && <span className="ml-1 text-xs text-slate-400">(Anda)</span>}</p>
                <p className="text-xs text-slate-400">{formatDate(c.createdAt, true)}</p>
              </div>
              <p className="mt-1 whitespace-pre-wrap text-sm text-slate-600 dark:text-slate-300">{c.body}</p>
            </div>
          ))}
        </div>
        <form onSubmit={onAddComment} className="flex gap-2">
          <input className="input flex-1" value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Tulis komentar / update..." />
          <button type="submit" className="btn-primary" disabled={busy || !comment.trim()}><Send className="h-4 w-4" /></button>
        </form>
      </div>
    </div>
  );
}

function Info({ label, value, danger }: { label: string; value: string; danger?: boolean }) {
  return (
    <div>
      <p className="text-xs text-slate-400 dark:text-slate-500">{label}</p>
      <p className={cn("font-medium text-slate-700 dark:text-slate-200", danger && "text-red-600 dark:text-red-400")}>{value}</p>
    </div>
  );
}
