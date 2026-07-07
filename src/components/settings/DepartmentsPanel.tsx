"use client";

import { useEffect, useState } from "react";
import { Building, Pencil, Plus, Trash2 } from "lucide-react";
import { apiFetch } from "@/lib/http";
import { Card } from "@/components/ui";
import { Modal } from "@/components/Modal";

interface Dept { id: number; name: string; description: string | null; userCount: number }

export function DepartmentsPanel() {
  const [list, setList] = useState<Dept[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Dept | null>(null);
  const [form, setForm] = useState({ name: "", description: "" });
  const [error, setError] = useState("");

  async function load() {
    setList(await apiFetch<Dept[]>("/api/departments"));
  }
  useEffect(() => { load(); }, []);

  function openCreate() { setEditing(null); setForm({ name: "", description: "" }); setError(""); setOpen(true); }
  function openEdit(d: Dept) { setEditing(d); setForm({ name: d.name, description: d.description ?? "" }); setError(""); setOpen(true); }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    try {
      if (editing) await apiFetch(`/api/departments/${editing.id}`, { method: "PATCH", body: JSON.stringify(form) });
      else await apiFetch("/api/departments", { method: "POST", body: JSON.stringify(form) });
      setOpen(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menyimpan");
    }
  }

  async function remove(d: Dept) {
    if (!confirm(`Hapus department ${d.name}?`)) return;
    try {
      await apiFetch(`/api/departments/${d.id}`, { method: "DELETE" });
      await load();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Gagal menghapus");
    }
  }

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <button className="btn-primary" onClick={openCreate}><Plus className="h-4 w-4" /> Tambah Department</button>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {list.map((d) => (
          <Card key={d.id}>
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2.5">
                <div className="grid h-9 w-9 place-items-center rounded-lg bg-brand-50 text-brand-600">
                  <Building className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-semibold text-slate-800">{d.name}</p>
                  <p className="text-xs text-slate-400">{d.userCount} karyawan</p>
                </div>
              </div>
            </div>
            <p className="mt-3 text-sm text-slate-500">{d.description || "—"}</p>
            <div className="mt-4 flex gap-2">
              <button className="btn-ghost flex-1 !py-2" onClick={() => openEdit(d)}><Pencil className="h-4 w-4" /> Ubah</button>
              <button className="btn-danger !px-3" onClick={() => remove(d)}><Trash2 className="h-4 w-4" /></button>
            </div>
          </Card>
        ))}
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? "Ubah Department" : "Tambah Department"}>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="label">Nama Department *</label>
            <input className="input" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required />
          </div>
          <div>
            <label className="label">Deskripsi</label>
            <input className="input" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
          </div>
          {error && <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>}
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-ghost" onClick={() => setOpen(false)}>Batal</button>
            <button type="submit" className="btn-primary">Simpan</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
