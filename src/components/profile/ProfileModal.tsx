"use client";

import { useEffect, useState } from "react";
import { Loader2, Lock, Save } from "lucide-react";
import { apiFetch } from "@/lib/http";
import { Modal } from "@/components/Modal";

const BANKS = ["BCA", "BNI", "BRI", "Mandiri", "BSI", "CIMB Niaga", "Danamon", "Permata", "BTN", "Lainnya"];

interface ProfileData {
  fullName: string;
  email: string | null;
  birthDate: string | null;
  photo: string | null;
  ktpPhoto: string | null;
  address: string | null;
  emergencyName: string | null;
  emergencyPhone: string | null;
  bankName: string | null;
  bankAccountNumber: string | null;
  username: string;
  roleName: string;
  departmentName: string | null;
  employmentStatus: string;
}

const EMPTY = {
  fullName: "", email: "", birthDate: "", photo: "", ktpPhoto: "", address: "",
  emergencyName: "", emergencyPhone: "", bankName: "", bankAccountNumber: "",
  currentPassword: "", newPassword: "",
};

// Konversi File gambar -> data URL (base64) untuk disimpan di DB.
function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function ProfileModal({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState<any>(EMPTY);
  const [readonly, setReadonly] = useState({ username: "", roleName: "", departmentName: "", employmentStatus: "" });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setError("");
    setLoading(true);
    apiFetch<ProfileData>("/api/profile")
      .then((d) => {
        setForm({
          ...EMPTY,
          fullName: d.fullName ?? "",
          email: d.email ?? "",
          birthDate: d.birthDate ? d.birthDate.slice(0, 10) : "",
          photo: d.photo ?? "",
          ktpPhoto: d.ktpPhoto ?? "",
          address: d.address ?? "",
          emergencyName: d.emergencyName ?? "",
          emergencyPhone: d.emergencyPhone ?? "",
          bankName: d.bankName ?? "",
          bankAccountNumber: d.bankAccountNumber ?? "",
        });
        setReadonly({
          username: d.username,
          roleName: d.roleName,
          departmentName: d.departmentName ?? "—",
          employmentStatus: d.employmentStatus,
        });
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Gagal memuat profil"))
      .finally(() => setLoading(false));
  }, [open]);

  const set = (k: string) => (ev: any) => setForm((f: any) => ({ ...f, [k]: ev.target.value }));
  const setFile = (k: string) => async (ev: any) => {
    const file = ev.target.files?.[0];
    if (!file) return;
    if (file.size > 4 * 1024 * 1024) { setError("Ukuran gambar maksimal 4MB."); return; }
    const url = await fileToDataUrl(file);
    setForm((f: any) => ({ ...f, [k]: url }));
  };

  async function submit(ev: React.FormEvent) {
    ev.preventDefault();
    setError("");
    setSaving(true);
    try {
      const payload: any = {
        fullName: form.fullName, email: form.email, birthDate: form.birthDate,
        photo: form.photo, ktpPhoto: form.ktpPhoto, address: form.address,
        emergencyName: form.emergencyName, emergencyPhone: form.emergencyPhone,
        bankName: form.bankName, bankAccountNumber: form.bankAccountNumber,
      };
      if (form.newPassword) {
        payload.currentPassword = form.currentPassword;
        payload.newPassword = form.newPassword;
      }
      await apiFetch("/api/profile", { method: "PATCH", body: JSON.stringify(payload) });
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menyimpan");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Edit Profil" size="xl">
      {loading ? (
        <div className="flex justify-center py-10 text-slate-400"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          {/* Info read-only — tidak dapat diubah lewat form ini */}
          <div className="rounded-xl bg-slate-50 dark:bg-slate-800 p-3 text-xs text-slate-500 dark:text-slate-400">
            <p className="mb-1 font-medium text-slate-600 dark:text-slate-300">Informasi kepegawaian (hanya HR/Admin yang dapat mengubah):</p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-4">
              <div><span className="text-slate-400">Username:</span> {readonly.username}</div>
              <div><span className="text-slate-400">Role:</span> {readonly.roleName}</div>
              <div><span className="text-slate-400">Department:</span> {readonly.departmentName}</div>
              <div><span className="text-slate-400">Status:</span> {readonly.employmentStatus}</div>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="label">Nama Lengkap *</label>
              <input className="input" value={form.fullName} onChange={set("fullName")} required />
            </div>
            <div>
              <label className="label">Email</label>
              <input className="input" type="email" value={form.email} onChange={set("email")} />
            </div>
            <div>
              <label className="label">Tanggal Lahir</label>
              <input className="input" type="date" value={form.birthDate} onChange={set("birthDate")} />
            </div>

            <div>
              <label className="label">Foto Profil</label>
              <div className="flex items-center gap-3">
                {form.photo
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img src={form.photo} alt="" className="h-16 w-16 rounded-full object-cover border border-slate-200 dark:border-slate-700" />
                  : <div className="grid h-16 w-16 place-items-center rounded-full bg-slate-100 dark:bg-slate-800 text-xs text-slate-400">Foto</div>}
                <div className="flex flex-col gap-1">
                  <input type="file" accept="image/*" onChange={setFile("photo")} className="text-xs" />
                  {form.photo && <button type="button" className="text-xs text-red-500 text-left" onClick={() => setForm((f: any) => ({ ...f, photo: "" }))}>Hapus foto</button>}
                </div>
              </div>
            </div>

            <div>
              <label className="label">Foto KTP</label>
              <div className="flex items-center gap-3">
                {form.ktpPhoto
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img src={form.ktpPhoto} alt="" className="h-16 w-24 rounded-lg object-cover border border-slate-200 dark:border-slate-700" />
                  : <div className="grid h-16 w-24 place-items-center rounded-lg bg-slate-100 dark:bg-slate-800 text-xs text-slate-400">KTP</div>}
                <div className="flex flex-col gap-1">
                  <input type="file" accept="image/*" onChange={setFile("ktpPhoto")} className="text-xs" />
                  {form.ktpPhoto && <button type="button" className="text-xs text-red-500 text-left" onClick={() => setForm((f: any) => ({ ...f, ktpPhoto: "" }))}>Hapus KTP</button>}
                </div>
              </div>
            </div>

            <div className="sm:col-span-2">
              <label className="label">Alamat</label>
              <textarea className="input min-h-[70px]" value={form.address} onChange={set("address")} placeholder="Alamat lengkap tempat tinggal" />
            </div>

            <div>
              <label className="label">Kontak Darurat — Nama</label>
              <input className="input" value={form.emergencyName} onChange={set("emergencyName")} placeholder="Nama pemilik kontak" />
            </div>
            <div>
              <label className="label">Kontak Darurat — No. Telepon</label>
              <input className="input" value={form.emergencyPhone} onChange={set("emergencyPhone")} placeholder="08xxxxxxxxxx" />
            </div>

            <div>
              <label className="label">Bank</label>
              <select className="input" value={form.bankName} onChange={set("bankName")}>
                <option value="">— Pilih bank —</option>
                {BANKS.map((b) => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Nomor Rekening</label>
              <input className="input" value={form.bankAccountNumber} onChange={set("bankAccountNumber")} placeholder="Nomor rekening bank" />
            </div>
          </div>

          {/* Ganti password (opsional) */}
          <div className="mt-2 border-t border-slate-100 dark:border-slate-700 pt-4">
            <p className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-slate-700 dark:text-slate-300">
              <Lock className="h-3.5 w-3.5" /> Ganti Password (opsional)
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="label">Password Saat Ini</label>
                <input className="input" type="password" value={form.currentPassword} onChange={set("currentPassword")} placeholder="••••••" autoComplete="current-password" />
              </div>
              <div>
                <label className="label">Password Baru</label>
                <input className="input" type="password" value={form.newPassword} onChange={set("newPassword")} placeholder="Min. 6 karakter" autoComplete="new-password" />
              </div>
            </div>
          </div>

          {error && <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>}

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className="btn-ghost" onClick={onClose}>Batal</button>
            <button type="submit" className="btn-primary" disabled={saving}>
              <Save className="h-4 w-4" /> {saving ? "Menyimpan..." : "Simpan Perubahan"}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}
