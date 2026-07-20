"use client";

import { useEffect, useState } from "react";
import { Pencil, Plus, ShieldCheck, Trash2 } from "lucide-react";
import { apiFetch } from "@/lib/http";
import { Card } from "@/components/ui";
import { Modal } from "@/components/Modal";

interface Role {
  id: number; name: string; description: string | null; color: string;
  isSystem: boolean; userCount: number; permissionIds: number[];
}
interface Perm { id: number; key: string; label: string; group: string }

const COLORS = ["#6366f1", "#10b981", "#f59e0b", "#ef4444", "#06b6d4", "#8b5cf6", "#ec4899"];

export function RolesPanel() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [perms, setPerms] = useState<Perm[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Role | null>(null);
  const [form, setForm] = useState({ name: "", description: "", color: COLORS[0], permissionIds: [] as number[] });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function load() {
    const [r, p] = await Promise.all([apiFetch<Role[]>("/api/roles"), apiFetch<Perm[]>("/api/permissions")]);
    setRoles(r);
    setPerms(p);
  }
  useEffect(() => { load(); }, []);

  const groups = perms.reduce<Record<string, Perm[]>>((acc, p) => {
    (acc[p.group] ||= []).push(p);
    return acc;
  }, {});

  function openCreate() {
    setEditing(null);
    setForm({ name: "", description: "", color: COLORS[0], permissionIds: [] });
    setError("");
    setOpen(true);
  }
  function openEdit(r: Role) {
    setEditing(r);
    setForm({ name: r.name, description: r.description ?? "", color: r.color, permissionIds: [...r.permissionIds] });
    setError("");
    setOpen(true);
  }
  function togglePerm(id: number) {
    setForm((f) => ({
      ...f,
      permissionIds: f.permissionIds.includes(id) ? f.permissionIds.filter((x) => x !== id) : [...f.permissionIds, id],
    }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      if (editing) {
        await apiFetch(`/api/roles/${editing.id}`, { method: "PATCH", body: JSON.stringify(form) });
      } else {
        await apiFetch("/api/roles", { method: "POST", body: JSON.stringify(form) });
      }
      setOpen(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menyimpan");
    } finally {
      setSaving(false);
    }
  }

  async function remove(r: Role) {
    if (!confirm(`Hapus role ${r.name}?`)) return;
    try {
      await apiFetch(`/api/roles/${r.id}`, { method: "DELETE" });
      await load();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Gagal menghapus");
    }
  }

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <button className="btn-primary" onClick={openCreate}>
          <Plus className="h-4 w-4" /> Tambah Role
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {roles.map((r) => (
          <Card key={r.id}>
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2.5">
                <div className="grid h-9 w-9 place-items-center rounded-lg" style={{ backgroundColor: `${r.color}1a`, color: r.color }}>
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-semibold text-slate-800 dark:text-slate-100">{r.name}</p>
                  <p className="text-xs text-slate-400 dark:text-slate-500">{r.userCount} karyawan</p>
                </div>
              </div>
              {r.isSystem && <span className="badge bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400">Bawaan</span>}
            </div>
            <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">{r.description || "—"}</p>
            <p className="mt-3 text-xs text-slate-400 dark:text-slate-500">{r.permissionIds.length} authority aktif</p>
            <div className="mt-4 flex gap-2">
              <button className="btn-ghost flex-1 !py-2" onClick={() => openEdit(r)}>
                <Pencil className="h-4 w-4" /> Atur
              </button>
              {!r.isSystem && (
                <button className="btn-danger !px-3" onClick={() => remove(r)}>
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
          </Card>
        ))}
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? `Atur Role: ${editing.name}` : "Tambah Role"} size="lg">
        <form onSubmit={submit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">Nama Role *</label>
              <input className="input" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required />
            </div>
            <div>
              <label className="label">Warna</label>
              <div className="flex gap-2 pt-1.5">
                {COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, color: c }))}
                    className={`h-7 w-7 rounded-full ${form.color === c ? "ring-2 ring-offset-2 ring-slate-400" : ""}`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>
          </div>
          <div>
            <label className="label">Deskripsi</label>
            <input className="input" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
          </div>

          <div>
            <label className="label">Authority (Hak Akses)</label>
            <div className="max-h-72 space-y-4 overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-700 p-4">
              {Object.entries(groups).map(([group, list]) => (
                <div key={group}>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">{group}</p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {list.map((p) => (
                      <label key={p.id} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-slate-50 dark:hover:bg-slate-800">
                        <input type="checkbox" className="h-4 w-4 rounded" checked={form.permissionIds.includes(p.id)} onChange={() => togglePerm(p.id)} />
                        <span className="text-slate-700 dark:text-slate-200">{p.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {error && <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>}
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-ghost" onClick={() => setOpen(false)}>Batal</button>
            <button type="submit" className="btn-primary" disabled={saving}>{saving ? "Menyimpan..." : "Simpan"}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
