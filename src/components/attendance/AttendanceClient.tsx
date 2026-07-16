"use client";

import { useCallback, useEffect, useState } from "react";
import { CalendarClock, Clock, LogIn, LogOut, CheckCircle2, ImageOff, Loader2, Trash2 } from "lucide-react";
import { apiFetch } from "@/lib/http";
import { formatTime, formatDate, minutesToLabel, STATUS_LABEL, cn } from "@/lib/utils";
import { Card, EmptyState, PageHeader, StatusBadge } from "@/components/ui";
import { Modal } from "@/components/Modal";
import { CameraCapture } from "@/components/CameraCapture";

interface Today {
  schedule: { checkInTime: string; checkOutTime: string; lateToleranceMin: number; earlyLeaveTolMin: number };
  attendance: null | {
    checkInAt: string | null; checkInStatus: "ON_TIME" | "LATE" | null; lateMinutes: number;
    checkOutAt: string | null; checkOutStatus: "ON_TIME" | "EARLY_LEAVE" | null; earlyMinutes: number; workedMinutes: number;
  };
}
interface Record {
  id: number; date: string;
  user: { fullName: string; username: string; department: string | null };
  checkInAt: string | null; checkInStatus: string | null; lateMinutes: number;
  checkOutAt: string | null; checkOutStatus: string | null; earlyMinutes: number; workedMinutes: number;
}

export function AttendanceClient({ canCheckin, canViewAll, canManage = false }: { canCheckin: boolean; canViewAll: boolean; canManage?: boolean }) {
  const [today, setToday] = useState<Today | null>(null);
  const [mode, setMode] = useState<"in" | "out" | null>(null);
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState("");

  const [scope, setScope] = useState<"mine" | "all">(canViewAll && !canCheckin ? "all" : "mine");
  const [date, setDate] = useState("");
  const [records, setRecords] = useState<Record[]>([]);
  const [photo, setPhoto] = useState<{ title: string; url: string } | null>(null);

  const loadToday = useCallback(async () => {
    if (!canCheckin) return;
    setToday(await apiFetch<Today>("/api/attendance/today"));
  }, [canCheckin]);

  const loadRecords = useCallback(async () => {
    const qs = new URLSearchParams({ scope, ...(date ? { date } : {}) });
    setRecords(await apiFetch<Record[]>(`/api/attendance?${qs}`));
  }, [scope, date]);

  useEffect(() => { loadToday(); }, [loadToday]);
  useEffect(() => { loadRecords(); }, [loadRecords]);

  async function submitPhoto(photo: string) {
    setBusy(true);
    try {
      const url = mode === "in" ? "/api/attendance/check-in" : "/api/attendance/check-out";
      const res = await apiFetch<any>(url, { method: "POST", body: JSON.stringify({ photo }) });
      setMode(null);
      if (mode === "in") {
        setFlash(res.status === "LATE" ? `Check-in tercatat: Terlambat ${res.lateMinutes} menit` : "Check-in tercatat: Tepat Waktu");
      } else {
        setFlash(res.status === "EARLY_LEAVE" ? `Check-out tercatat: Pulang Cepat ${res.earlyMinutes} menit` : "Check-out tercatat. Terima kasih!");
      }
      await Promise.all([loadToday(), loadRecords()]);
      setTimeout(() => setFlash(""), 6000);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Gagal menyimpan absensi");
    } finally {
      setBusy(false);
    }
  }

  function openPhoto(title: string, url: string) {
    setPhoto({ title, url });
  }

  async function removeRecord(r: Record) {
    if (!confirm(`Hapus data absensi ${r.user.fullName} tanggal ${formatDate(r.date)}? Tindakan ini tidak dapat dibatalkan.`)) return;
    try {
      await apiFetch(`/api/attendance/${r.id}`, { method: "DELETE" });
      await loadRecords();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Gagal menghapus data absensi");
    }
  }

  const att = today?.attendance;
  const checkedIn = !!att?.checkInAt;
  const checkedOut = !!att?.checkOutAt;

  return (
    <div>
      <PageHeader title="Absensi" subtitle="Rekam kehadiran dengan foto kamera. Status dinilai otomatis." />

      {flash && (
        <div className="mb-4 flex items-center gap-2 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          <CheckCircle2 className="h-4 w-4" /> {flash}
        </div>
      )}

      {canCheckin && today && (
        <div className="mb-6 grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm text-slate-500">Absensi hari ini · {formatDate(new Date())}</p>
                <div className="mt-2 flex items-center gap-6">
                  <div>
                    <p className="text-xs text-slate-400">Check-in</p>
                    <p className="text-xl font-bold text-slate-800">{att?.checkInAt ? formatTime(att.checkInAt) : "--:--"}</p>
                    {att?.checkInStatus && <StatusBadge status={att.checkInStatus} label={STATUS_LABEL[att.checkInStatus]} />}
                  </div>
                  <div className="h-10 w-px bg-slate-200" />
                  <div>
                    <p className="text-xs text-slate-400">Check-out</p>
                    <p className="text-xl font-bold text-slate-800">{att?.checkOutAt ? formatTime(att.checkOutAt) : "--:--"}</p>
                    {att?.checkOutStatus && <StatusBadge status={att.checkOutStatus} label={STATUS_LABEL[att.checkOutStatus]} />}
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <button className="btn-primary" onClick={() => setMode("in")} disabled={checkedIn}>
                  <LogIn className="h-4 w-4" /> Check-in
                </button>
                <button className={cn(checkedOut ? "btn-ghost" : "btn-primary")} onClick={() => setMode("out")} disabled={!checkedIn || checkedOut}>
                  <LogOut className="h-4 w-4" /> Check-out
                </button>
              </div>
            </div>
            {checkedOut && att && (
              <p className="mt-4 rounded-xl bg-slate-50 p-3 text-sm text-slate-600">
                Total kerja hari ini: <b>{minutesToLabel(att.workedMinutes)}</b>
              </p>
            )}
          </Card>

          <Card>
            <div className="mb-2 flex items-center gap-2 text-slate-800">
              <Clock className="h-4 w-4 text-brand-600" />
              <h3 className="font-semibold">Jadwal Anda</h3>
            </div>
            <dl className="space-y-2 text-sm">
              <Row k="Jam Masuk" v={today.schedule.checkInTime} />
              <Row k="Jam Pulang" v={today.schedule.checkOutTime} />
              <Row k="Toleransi Telat" v={`${today.schedule.lateToleranceMin} menit`} />
              <Row k="Toleransi Pulang Cepat" v={`${today.schedule.earlyLeaveTolMin} menit`} />
            </dl>
          </Card>
        </div>
      )}

      {/* Riwayat */}
      <Card className="!p-0 overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <CalendarClock className="h-5 w-5 text-brand-600" />
            <h3 className="font-semibold text-slate-800">Riwayat Kehadiran</h3>
          </div>
          <div className="flex items-center gap-2">
            {canViewAll && canCheckin && (
              <div className="flex rounded-lg bg-slate-100 p-1 text-sm">
                <button onClick={() => setScope("mine")} className={cn("rounded-md px-3 py-1 font-medium", scope === "mine" ? "bg-white text-brand-700 shadow-sm" : "text-slate-500")}>Saya</button>
                <button onClick={() => setScope("all")} className={cn("rounded-md px-3 py-1 font-medium", scope === "all" ? "bg-white text-brand-700 shadow-sm" : "text-slate-500")}>Semua</button>
              </div>
            )}
            <input type="date" className="input !py-1.5 !w-auto" value={date} onChange={(e) => setDate(e.target.value)} />
            {date && <button className="text-sm text-slate-400 hover:text-slate-600" onClick={() => setDate("")}>Reset</button>}
          </div>
        </div>

        {records.length === 0 ? (
          <div className="p-6"><EmptyState title="Belum ada data kehadiran" /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/60 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-5 py-3 font-medium">Tanggal</th>
                  {scope === "all" && <th className="px-5 py-3 font-medium">Karyawan</th>}
                  <th className="px-5 py-3 font-medium">Masuk</th>
                  <th className="px-5 py-3 font-medium">Pulang</th>
                  <th className="px-5 py-3 font-medium">Durasi</th>
                  <th className="px-5 py-3 font-medium">Foto</th>
                  {canManage && <th className="px-5 py-3" />}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {records.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50/60">
                    <td className="px-5 py-3 text-slate-600">{formatDate(r.date)}</td>
                    {scope === "all" && (
                      <td className="px-5 py-3">
                        <p className="font-medium text-slate-800">{r.user.fullName}</p>
                        <p className="text-xs text-slate-400">{r.user.department ?? "—"}</p>
                      </td>
                    )}
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <span className="text-slate-700">{formatTime(r.checkInAt)}</span>
                        {r.checkInStatus && <StatusBadge status={r.checkInStatus} label={STATUS_LABEL[r.checkInStatus]} />}
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <span className="text-slate-700">{formatTime(r.checkOutAt)}</span>
                        {r.checkOutStatus && <StatusBadge status={r.checkOutStatus} label={STATUS_LABEL[r.checkOutStatus]} />}
                      </div>
                    </td>
                    <td className="px-5 py-3 text-slate-600">{r.workedMinutes ? minutesToLabel(r.workedMinutes) : "-"}</td>
                    <td className="px-5 py-3">
                      <div className="flex gap-2">
                        {r.checkInAt ? (
                          <PhotoThumb id={r.id} type="in" label="Masuk" personName={r.user.fullName} onOpen={openPhoto} />
                        ) : (
                          <EmptyThumb label="Masuk" />
                        )}
                        {r.checkOutAt ? (
                          <PhotoThumb id={r.id} type="out" label="Pulang" personName={r.user.fullName} onOpen={openPhoto} />
                        ) : (
                          <EmptyThumb label="Pulang" />
                        )}
                      </div>
                    </td>
                    {canManage && (
                      <td className="px-5 py-3 text-right">
                        <button
                          onClick={() => removeRecord(r)}
                          className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600"
                          title="Hapus data absensi"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal open={mode !== null} onClose={() => !busy && setMode(null)} title={mode === "in" ? "Check-in — Ambil Foto" : "Check-out — Ambil Foto"}>
        {mode && (
          <CameraCapture
            onConfirm={submitPhoto}
            confirmLabel={mode === "in" ? "Konfirmasi Check-in" : "Konfirmasi Check-out"}
            loading={busy}
          />
        )}
      </Modal>

      {/* Lightbox foto absensi (ukuran penuh) */}
      <Modal open={photo !== null} onClose={() => setPhoto(null)} title={photo?.title ?? "Foto Absensi"}>
        {photo && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photo.url} alt="Foto absensi" className="w-full rounded-xl" />
        )}
      </Modal>
    </div>
  );
}

// Thumbnail foto yang otomatis dimuat begitu baris tampil — tanpa perlu klik
// tombol terlebih dahulu. Klik thumbnail untuk melihat ukuran penuh.
function PhotoThumb({
  id, type, label, personName, onOpen,
}: {
  id: number; type: "in" | "out"; label: string; personName: string; onOpen: (title: string, url: string) => void;
}) {
  const [state, setState] = useState<"loading" | "empty" | { url: string }>("loading");

  useEffect(() => {
    let active = true;
    apiFetch<{ photo: string | null }>(`/api/attendance/${id}/photo?type=${type}`)
      .then((res) => { if (active) setState(res.photo ? { url: res.photo } : "empty"); })
      .catch(() => { if (active) setState("empty"); });
    return () => { active = false; };
  }, [id, type]);

  return (
    <div className="flex flex-col items-center gap-1">
      <span className="text-[10px] font-medium uppercase tracking-wide text-slate-400">{label}</span>
      {state === "loading" ? (
        <div className="grid h-11 w-11 place-items-center rounded-lg bg-slate-100">
          <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-300" />
        </div>
      ) : state === "empty" ? (
        <div className="grid h-11 w-11 place-items-center rounded-lg bg-slate-100 text-slate-300" title={`Tidak ada foto ${label.toLowerCase()}`}>
          <ImageOff className="h-4 w-4" />
        </div>
      ) : (
        <button
          onClick={() => onOpen(`Foto ${label} — ${personName}`, state.url)}
          className="h-11 w-11 overflow-hidden rounded-lg border border-slate-200 transition hover:ring-2 hover:ring-brand-400"
          title={`Lihat foto ${label.toLowerCase()} (ukuran penuh)`}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={state.url} alt={`Foto ${label.toLowerCase()}`} className="h-full w-full object-cover" />
        </button>
      )}
    </div>
  );
}

function EmptyThumb({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <span className="text-[10px] font-medium uppercase tracking-wide text-slate-400">{label}</span>
      <div className="grid h-11 w-11 place-items-center rounded-lg bg-slate-50 text-slate-200">
        <ImageOff className="h-4 w-4" />
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between">
      <dt className="text-slate-500">{k}</dt>
      <dd className="font-medium text-slate-800">{v}</dd>
    </div>
  );
}
