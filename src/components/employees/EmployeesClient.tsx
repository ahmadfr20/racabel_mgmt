"use client";

import { useEffect, useMemo, useState } from "react";
import { Pencil, Plus, Search, UserPlus, Users } from "lucide-react";
import { apiFetch } from "@/lib/http";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Card, EmptyState, PageHeader } from "@/components/ui";
import { Modal } from "@/components/Modal";

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
  role: { id: number; name: string; color: string };
  department: { id: number; name: string } | null;
}
interface Option { id: number; name: string; color?: string }

const EMPTY = {
  username: "", password: "", email: "", fullName: "", birthDate: "", joinDate: "",
  roleId: "", departmentId: "", baseSalary: "0", performanceAllowance: "0", isActive: true,
};

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
  function openEdit(e: Employee) {
    setEditing(e);
    setForm({
      username: e.username, password: "", email: e.email ?? "", fullName: e.fullName,
      birthDate: e.birthDate ? e.birthDate.slice(0, 10) : "",
      joinDate: e.joinDate ? e.joinDate.slice(0, 10) : "",
      roleId: String(e.role.id), departmentId: e.department ? String(e.department.id) : "",
      baseSalary: String(e.baseSalary), performanceAllowance: String(e.performanceAllowance),
      isActive: e.isActive,
    });
    setError("");
    setOpen(true);
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

  const set = (k: string) => (ev: any) => setForm((f: any) => ({ ...f, [k]: ev.target.value }));

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
                      <span className={`badge ${e.isActive ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                        {e.isActive ? "Aktif" : "Nonaktif"}
                      </span>
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

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? "Ubah Karyawan" : "Registrasi Karyawan Baru"} size="lg">
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
