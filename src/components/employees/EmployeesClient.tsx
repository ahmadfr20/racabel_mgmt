"use client";

import { useEffect, useMemo, useState } from "react";
import { Pencil, Plus, Search, Trash2, UserPlus, Users } from "lucide-react";
import { apiFetch } from "@/lib/http";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Card, EmptyState, PageHeader } from "@/components/ui";
import { Modal } from "@/components/Modal";

type EmploymentStatus = "MAGANG" | "KONTRAK" | "PEGAWAI_TETAP";

interface Employee {
  id: number;
  username: string;
  email: string | null;
  fullName: string;
  birthDate: string | null;
  joinDate: string;
  isActive: boolean;
  baseSalary: number;
  performanceAllowance: number;
  employmentStatus: EmploymentStatus;
  contractStartDate: string | null;
  contractEndDate: string | null;
  role: { id: number; name: string; color: string };
  department: { id: number; name: string } | null;
}
interface Option { id: number; name: string; color?: string }

const BANKS = ["BCA", "BNI", "BRI", "Mandiri", "BSI", "CIMB Niaga", "Danamon", "Permata", "BTN", "Lainnya"];

const EMPLOYMENT_STATUS_LABEL: Record<EmploymentStatus, string> = {
  PEGAWAI_TETAP: "Pegawai Tetap", KONTRAK: "Kontrak", MAGANG: "Magang",
};

const EMPTY = {
  username: "", password: "", email: "", fullName: "", birthDate: "", joinDate: "",
  roleId: "", departmentId: "", baseSalary: "0", performanceAllowance: "0", isActive: true,
  photo: "", ktpPhoto: "", address: "", emergencyName: "", emergencyPhone: "",
  bankName: "", bankAccountNumber: "",
  employmentStatus: "PEGAWAI_TETAP" as EmploymentStatus, contractStartDate: "", contractEndDate: "",
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

export function EmployeesClient({ perms }: { perms: { create: boolean; edit: boolean; delete: boolean; payroll: boolean } }) {
  const [list, setList] = useState<Employee[]>([]);
  const [roles, setRoles] = useState<Option[]>([]);
  const [depts, setDepts] = useState<Option[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Employee | null>(null);
  const [form, setForm] = useState<any>(EMPTY);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    const [emps, opts] = await Promise.all([
      apiFetch<Employee[]>("/api/employees"),
      apiFetch<{ roles: Option[]; departments: Option[] }>("/api/options"),
    ]);
    setList(emps);
    setRoles(opts.roles);
    setDepts(opts.departments);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const s = q.toLowerCase();
    return list.filter((e) => e.fullName.toLowerCase().includes(s) || e.username.toLowerCase().includes(s));
  }, [list, q]);

  function openCreate() {
    setEditing(null);
    setForm({ ...EMPTY, joinDate: new Date().toISOString().slice(0, 10) });
    setError("");
    setOpen(true);
  }
  async function openEdit(e: Employee) {
    setEditing(e);
    setError("");
    // Isi cepat dari data list, lalu lengkapi detail (foto/alamat/kontak) dari server.
    setForm({
      ...EMPTY,
      username: e.username, password: "", email: e.email ?? "", fullName: e.fullName,
      birthDate: e.birthDate ? e.birthDate.slice(0, 10) : "",
      joinDate: e.joinDate ? e.joinDate.slice(0, 10) : "",
      roleId: String(e.role.id), departmentId: e.department ? String(e.department.id) : "",
      baseSalary: String(e.baseSalary), performanceAllowance: String(e.performanceAllowance),
      isActive: e.isActive,
      employmentStatus: e.employmentStatus,
      contractStartDate: e.contractStartDate ? e.contractStartDate.slice(0, 10) : "",
      contractEndDate: e.contractEndDate ? e.contractEndDate.slice(0, 10) : "",
    });
    setOpen(true);
    try {
      const d = await apiFetch<any>(`/api/employees/${e.id}`);
      setForm((f: any) => ({
        ...f,
        photo: d.photo ?? "", ktpPhoto: d.ktpPhoto ?? "", address: d.address ?? "",
        emergencyName: d.emergencyName ?? "", emergencyPhone: d.emergencyPhone ?? "",
        bankName: d.bankName ?? "", bankAccountNumber: d.bankAccountNumber ?? "",
      }));
    } catch { /* biarkan form dasar */ }
  }

  async function submit(ev: React.FormEvent) {
    ev.preventDefault();
    setError("");
    setSaving(true);
    try {
      const payload: any = {
        email: form.email, fullName: form.fullName, birthDate: form.birthDate, joinDate: form.joinDate,
        roleId: Number(form.roleId), departmentId: form.departmentId ? Number(form.departmentId) : null,
        baseSalary: Number(form.baseSalary), performanceAllowance: Number(form.performanceAllowance),
        photo: form.photo, ktpPhoto: form.ktpPhoto, address: form.address,
        emergencyName: form.emergencyName, emergencyPhone: form.emergencyPhone,
        bankName: form.bankName, bankAccountNumber: form.bankAccountNumber,
        employmentStatus: form.employmentStatus,
        contractStartDate: form.employmentStatus === "PEGAWAI_TETAP" ? null : (form.contractStartDate || null),
        contractEndDate: form.employmentStatus === "PEGAWAI_TETAP" ? null : (form.contractEndDate || null),
      };
      if (editing) {
        payload.isActive = form.isActive;
        if (form.password) payload.password = form.password;
        await apiFetch(`/api/employees/${editing.id}`, { method: "PATCH", body: JSON.stringify(payload) });
      } else {
        payload.username = form.username;
        payload.password = form.password;
        await apiFetch("/api/employees", { method: "POST", body: JSON.stringify(payload) });
      }
      setOpen(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menyimpan");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(e: Employee) {
    if (!confirm(`${e.isActive ? "Nonaktifkan" : "Aktifkan"} ${e.fullName}?`)) return;
    if (e.isActive) {
      await apiFetch(`/api/employees/${e.id}`, { method: "DELETE" });
    } else {
      await apiFetch(`/api/employees/${e.id}`, { method: "PATCH", body: JSON.stringify({ isActive: true }) });
    }
    await load();
  }

  async function hardDelete(e: Employee) {
    if (!confirm(`Hapus PERMANEN data ${e.fullName}? Tindakan ini tidak dapat dibatalkan dan hanya berhasil jika karyawan belum punya riwayat data (absensi/gaji/kinerja/dsb).`)) return;
    try {
      await apiFetch(`/api/employees/${e.id}/permanent`, { method: "POST" });
      await load();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Gagal menghapus permanen");
    }
  }

  const set = (k: string) => (ev: any) => setForm((f: any) => ({ ...f, [k]: ev.target.value }));
  const setFile = (k: string) => async (ev: any) => {
    const file = ev.target.files?.[0];
    if (!file) return;
    if (file.size > 4 * 1024 * 1024) { setError("Ukuran gambar maksimal 4MB."); return; }
    const url = await fileToDataUrl(file);
    setForm((f: any) => ({ ...f, [k]: url }));
  };

  return (
    <div>
      <PageHeader
        title="Karyawan"
        subtitle="Kelola data karyawan. Registrasi karyawan baru hanya oleh Admin/HR."
        action={
          perms.create && (
            <button className="btn-primary" onClick={openCreate}>
              <UserPlus className="h-4 w-4" /> Tambah Karyawan
            </button>
          )
        }
      />

      <Card className="mb-4 !p-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input className="input pl-10" placeholder="Cari nama atau username..." value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      </Card>

      {loading ? (
        <div className="py-16 text-center text-sm text-slate-400">Memuat data...</div>
      ) : filtered.length === 0 ? (
        <EmptyState title="Belum ada karyawan" subtitle="Tambahkan karyawan baru untuk mulai." icon={<Users className="h-10 w-10" />} />
      ) : (
        <Card className="!p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/60 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-5 py-3 font-medium">Nama</th>
                  <th className="px-5 py-3 font-medium">Role</th>
                  <th className="px-5 py-3 font-medium">Department</th>
                  <th className="px-5 py-3 font-medium">Bergabung</th>
                  {perms.payroll && <th className="px-5 py-3 font-medium">Gaji Pokok</th>}
                  <th className="px-5 py-3 font-medium">Status</th>
                  {(perms.edit || perms.delete) && <th className="px-5 py-3" />}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((e) => (
                  <tr key={e.id} className="hover:bg-slate-50/60">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <div className="grid h-9 w-9 place-items-center rounded-full bg-brand-100 text-xs font-semibold text-brand-700">
                          {e.fullName.split(" ").map((s) => s[0]).slice(0, 2).join("").toUpperCase()}
                        </div>
                        <div>
                          <p className="font-medium text-slate-800">{e.fullName}</p>
                          <p className="text-xs text-slate-400">@{e.username}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <span className="badge" style={{ backgroundColor: `${e.role.color}1a`, color: e.role.color }}>
                        {e.role.name}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-slate-600">{e.department?.name ?? "—"}</td>
                    <td className="px-5 py-3 text-slate-600">{formatDate(e.joinDate)}</td>
                    {perms.payroll && <td className="px-5 py-3 text-slate-600">{formatCurrency(e.baseSalary)}</td>}
                    <td className="px-5 py-3">
                      <div className="flex flex-wrap gap-1">
                        <span className={`badge ${e.isActive ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                          {e.isActive ? "Aktif" : "Nonaktif"}
                        </span>
                        {e.employmentStatus !== "PEGAWAI_TETAP" && (
                          <span className="badge bg-amber-50 text-amber-700" title={e.contractEndDate ? `Sampai ${formatDate(e.contractEndDate)}` : undefined}>
                            {EMPLOYMENT_STATUS_LABEL[e.employmentStatus]}
                          </span>
                        )}
                      </div>
                    </td>
                    {(perms.edit || perms.delete) && (
                      <td className="px-5 py-3">
                        <div className="flex justify-end gap-1">
                          {perms.edit && (
                            <button onClick={() => openEdit(e)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-brand-600" title="Ubah">
                              <Pencil className="h-4 w-4" />
                            </button>
                          )}
                          {perms.delete && (
                            <button onClick={() => toggleActive(e)} className="rounded-lg px-2.5 py-1 text-xs font-medium text-slate-500 hover:bg-slate-100">
                              {e.isActive ? "Nonaktifkan" : "Aktifkan"}
                            </button>
                          )}
                          {perms.delete && (
                            <button onClick={() => hardDelete(e)} className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600" title="Hapus Permanen">
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? "Ubah Karyawan" : "Registrasi Karyawan Baru"} size="xl">
        <form onSubmit={submit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">Username *</label>
              <input className="input" value={form.username} onChange={set("username")} disabled={!!editing} required />
            </div>
            <div>
              <label className="label">{editing ? "Password (kosongkan bila tetap)" : "Password *"}</label>
              <input className="input" type="password" value={form.password} onChange={set("password")} required={!editing} placeholder="••••••" />
            </div>
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
              <label className="label">Tanggal Bergabung</label>
              <input className="input" type="date" value={form.joinDate} onChange={set("joinDate")} />
            </div>
            <div>
              <label className="label">Role *</label>
              <select className="input" value={form.roleId} onChange={set("roleId")} required>
                <option value="">Pilih role...</option>
                {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Department</label>
              <select className="input" value={form.departmentId} onChange={set("departmentId")}>
                <option value="">— Tanpa department —</option>
                {depts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Status Karyawan *</label>
              <select className="input" value={form.employmentStatus} onChange={set("employmentStatus")} required>
                <option value="PEGAWAI_TETAP">Pegawai Tetap</option>
                <option value="KONTRAK">Kontrak</option>
                <option value="MAGANG">Magang</option>
              </select>
            </div>
            {(form.employmentStatus === "KONTRAK" || form.employmentStatus === "MAGANG") && (
              <>
                <div>
                  <label className="label">Periode Mulai *</label>
                  <input className="input" type="date" value={form.contractStartDate} onChange={set("contractStartDate")} required />
                </div>
                <div>
                  <label className="label">Periode Sampai *</label>
                  <input className="input" type="date" value={form.contractEndDate} onChange={set("contractEndDate")} required />
                </div>
              </>
            )}
            {editing && (
              <div className="flex items-end">
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input type="checkbox" checked={form.isActive} onChange={(e) => setForm((f: any) => ({ ...f, isActive: e.target.checked }))} className="h-4 w-4 rounded" />
                  Akun aktif
                </label>
              </div>
            )}
            <div>
              <label className="label">Gaji Pokok (Rp)</label>
              <input className="input" type="number" min={0} value={form.baseSalary} onChange={set("baseSalary")} />
            </div>
            <div>
              <label className="label">Tunjangan Kinerja Maks (Rp)</label>
              <input className="input" type="number" min={0} value={form.performanceAllowance} onChange={set("performanceAllowance")} />
            </div>

            {/* Data pribadi & dokumen */}
            <div className="sm:col-span-2 mt-2 border-t border-slate-100 dark:border-slate-700 pt-4">
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">Data Pribadi & Dokumen</p>
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

          {error && <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>}

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className="btn-ghost" onClick={() => setOpen(false)}>Batal</button>
            <button type="submit" className="btn-primary" disabled={saving}>
              <Plus className="h-4 w-4" /> {saving ? "Menyimpan..." : editing ? "Simpan Perubahan" : "Daftarkan"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
