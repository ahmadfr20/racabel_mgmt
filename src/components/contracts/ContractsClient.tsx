"use client";

import { useEffect, useState } from "react";
import { Download, FileSignature, FileText, Loader2, Plus, Trash2 } from "lucide-react";
import { apiFetch } from "@/lib/http";
import { cn, formatDate } from "@/lib/utils";
import { Card, EmptyState, PageHeader } from "@/components/ui";
import { Modal } from "@/components/Modal";
import { SignaturePad } from "@/components/SignaturePad";
import { downloadPdfContract, downloadPdfLoa } from "@/lib/exportFile";

type EmploymentStatus = "MAGANG" | "KONTRAK" | "PEGAWAI_TETAP";

const STATUS_LABEL: Record<EmploymentStatus, string> = {
  PEGAWAI_TETAP: "Pegawai Tetap", KONTRAK: "Kontrak", MAGANG: "Magang",
};

interface EmployeeOption {
  id: number; fullName: string; employmentStatus: EmploymentStatus;
  contractStartDate: string | null; contractEndDate: string | null;
}

interface ContractRow {
  id: number; employeeName: string; employmentStatus: EmploymentStatus;
  startDate: string; endDate: string; position: string | null; terms: string | null;
  companySignerName: string; companySignature: string; employeeSignature: string;
  signedAt: string; createdAt: string;
}

interface LoaRow {
  id: number; employeeName: string; employmentStatus: EmploymentStatus;
  acceptanceDate: string; generatedByName: string; signature: string; createdAt: string;
}

type Tab = "kontrak" | "loa";

const CONTRACT_FORM_EMPTY = { userId: "", startDate: "", endDate: "", position: "", terms: "" };
const LOA_FORM_EMPTY = { userId: "", employmentStatus: "PEGAWAI_TETAP" as EmploymentStatus, acceptanceDate: new Date().toISOString().slice(0, 10) };

export function ContractsClient({ currentUserName }: { currentUserName: string }) {
  const [tab, setTab] = useState<Tab>("kontrak");
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [contracts, setContracts] = useState<ContractRow[]>([]);
  const [loas, setLoas] = useState<LoaRow[]>([]);
  const [loadingContracts, setLoadingContracts] = useState(true);
  const [loadingLoas, setLoadingLoas] = useState(true);

  const [contractModalOpen, setContractModalOpen] = useState(false);
  const [contractForm, setContractForm] = useState(CONTRACT_FORM_EMPTY);
  const [companySignature, setCompanySignature] = useState<string | null>(null);
  const [employeeSignature, setEmployeeSignature] = useState<string | null>(null);

  const [loaModalOpen, setLoaModalOpen] = useState(false);
  const [loaForm, setLoaForm] = useState(LOA_FORM_EMPTY);
  const [loaSignature, setLoaSignature] = useState<string | null>(null);

  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function loadEmployees() {
    setEmployees(await apiFetch<EmployeeOption[]>("/api/employees"));
  }
  async function loadContracts() {
    setLoadingContracts(true);
    try { setContracts(await apiFetch<ContractRow[]>("/api/contracts")); }
    finally { setLoadingContracts(false); }
  }
  async function loadLoas() {
    setLoadingLoas(true);
    try { setLoas(await apiFetch<LoaRow[]>("/api/loa")); }
    finally { setLoadingLoas(false); }
  }

  useEffect(() => { loadEmployees(); loadContracts(); loadLoas(); }, []);

  const contractEligible = employees.filter((e) => e.employmentStatus === "KONTRAK" || e.employmentStatus === "MAGANG");

  function openContractModal() {
    setContractForm(CONTRACT_FORM_EMPTY);
    setCompanySignature(null);
    setEmployeeSignature(null);
    setError("");
    setContractModalOpen(true);
  }

  function pickContractEmployee(userId: string) {
    const emp = contractEligible.find((e) => String(e.id) === userId);
    setContractForm((f) => ({
      ...f,
      userId,
      startDate: emp?.contractStartDate?.slice(0, 10) ?? f.startDate,
      endDate: emp?.contractEndDate?.slice(0, 10) ?? f.endDate,
    }));
  }

  async function submitContract(e: React.FormEvent) {
    e.preventDefault();
    if (!companySignature || !employeeSignature) { setError("Kedua tanda tangan wajib diisi."); return; }
    const emp = contractEligible.find((x) => String(x.id) === contractForm.userId);
    if (!emp) { setError("Pilih karyawan terlebih dahulu."); return; }
    setError(""); setSaving(true);
    try {
      await apiFetch("/api/contracts", {
        method: "POST",
        body: JSON.stringify({
          userId: Number(contractForm.userId),
          employmentStatus: emp.employmentStatus,
          startDate: contractForm.startDate,
          endDate: contractForm.endDate,
          position: contractForm.position,
          terms: contractForm.terms,
          companySignature,
          employeeSignature,
        }),
      });
      downloadPdfContract({
        employeeName: emp.fullName,
        employmentStatus: emp.employmentStatus,
        startDate: contractForm.startDate,
        endDate: contractForm.endDate,
        position: contractForm.position || null,
        terms: contractForm.terms || null,
        companySignerName: currentUserName,
        companySignature,
        employeeSignature,
        signedAt: new Date().toISOString(),
      });
      setContractModalOpen(false);
      await loadContracts();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menyimpan perjanjian");
    } finally {
      setSaving(false);
    }
  }

  async function removeContract(id: number) {
    if (!confirm("Hapus riwayat perjanjian kontrak ini?")) return;
    await apiFetch(`/api/contracts/${id}`, { method: "DELETE" });
    await loadContracts();
  }

  function redownloadContract(r: ContractRow) {
    downloadPdfContract({
      employeeName: r.employeeName, employmentStatus: r.employmentStatus,
      startDate: r.startDate, endDate: r.endDate, position: r.position, terms: r.terms,
      companySignerName: r.companySignerName, companySignature: r.companySignature,
      employeeSignature: r.employeeSignature, signedAt: r.signedAt,
    });
  }

  function openLoaModal() {
    setLoaForm(LOA_FORM_EMPTY);
    setLoaSignature(null);
    setError("");
    setLoaModalOpen(true);
  }

  function pickLoaEmployee(userId: string) {
    const emp = employees.find((e) => String(e.id) === userId);
    setLoaForm((f) => ({ ...f, userId, employmentStatus: emp?.employmentStatus ?? f.employmentStatus }));
  }

  async function submitLoa(e: React.FormEvent) {
    e.preventDefault();
    if (!loaSignature) { setError("Tanda tangan wajib diisi."); return; }
    const emp = employees.find((x) => String(x.id) === loaForm.userId);
    if (!emp) { setError("Pilih karyawan terlebih dahulu."); return; }
    setError(""); setSaving(true);
    try {
      await apiFetch("/api/loa", {
        method: "POST",
        body: JSON.stringify({
          userId: Number(loaForm.userId),
          employmentStatus: loaForm.employmentStatus,
          acceptanceDate: loaForm.acceptanceDate,
          signature: loaSignature,
        }),
      });
      downloadPdfLoa({
        employeeName: emp.fullName,
        employmentStatus: loaForm.employmentStatus,
        acceptanceDate: loaForm.acceptanceDate,
        generatedByName: currentUserName,
        signature: loaSignature,
        createdAt: new Date().toISOString(),
      });
      setLoaModalOpen(false);
      await loadLoas();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menyimpan LoA");
    } finally {
      setSaving(false);
    }
  }

  async function removeLoa(id: number) {
    if (!confirm("Hapus riwayat LoA ini?")) return;
    await apiFetch(`/api/loa/${id}`, { method: "DELETE" });
    await loadLoas();
  }

  function redownloadLoa(r: LoaRow) {
    downloadPdfLoa({
      employeeName: r.employeeName, employmentStatus: r.employmentStatus,
      acceptanceDate: r.acceptanceDate, generatedByName: r.generatedByName,
      signature: r.signature, createdAt: r.createdAt,
    });
  }

  return (
    <div>
      <PageHeader title="Kontrak & LoA" subtitle="Generate perjanjian kontrak/magang dan Letter of Acceptance dengan tanda tangan digital." />

      <div className="mb-4 flex gap-1 border-b border-slate-200 dark:border-slate-700">
        {(["kontrak", "loa"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors",
              tab === t ? "border-brand-600 text-brand-600 dark:border-brand-400 dark:text-brand-400" : "border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
            )}
          >
            {t === "kontrak" ? "Perjanjian Kontrak" : "Letter of Acceptance"}
          </button>
        ))}
      </div>

      {tab === "kontrak" ? (
        <Card className="!p-0 overflow-hidden">
          <div className="flex items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-700 px-5 py-4">
            <h3 className="font-semibold text-slate-800 dark:text-slate-100">Riwayat Perjanjian Kontrak</h3>
            <button className="btn-primary" onClick={openContractModal}><Plus className="h-4 w-4" /> Generate Baru</button>
          </div>
          {loadingContracts ? (
            <div className="flex justify-center py-10 text-slate-400"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : contracts.length === 0 ? (
            <EmptyState title="Belum ada perjanjian kontrak" subtitle="Generate perjanjian baru untuk karyawan kontrak/magang." icon={<FileSignature className="h-10 w-10" />} />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800/40 text-left text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    <th className="px-5 py-3 font-medium">Karyawan</th>
                    <th className="px-5 py-3 font-medium">Status</th>
                    <th className="px-5 py-3 font-medium">Periode</th>
                    <th className="px-5 py-3 font-medium">Penandatangan Perusahaan</th>
                    <th className="px-5 py-3 font-medium">Ditandatangani</th>
                    <th className="px-5 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                  {contracts.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                      <td className="px-5 py-3 font-medium text-slate-800 dark:text-slate-100">{r.employeeName}</td>
                      <td className="px-5 py-3"><span className="badge bg-amber-50 text-amber-700">{STATUS_LABEL[r.employmentStatus]}</span></td>
                      <td className="px-5 py-3 text-slate-600 dark:text-slate-300">{formatDate(r.startDate)} – {formatDate(r.endDate)}</td>
                      <td className="px-5 py-3 text-slate-600 dark:text-slate-300">{r.companySignerName}</td>
                      <td className="px-5 py-3 text-slate-500 dark:text-slate-400">{formatDate(r.signedAt, true)}</td>
                      <td className="px-5 py-3">
                        <div className="flex justify-end gap-1">
                          <button onClick={() => redownloadContract(r)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-brand-600" title="Download PDF"><Download className="h-4 w-4" /></button>
                          <button onClick={() => removeContract(r.id)} className="rounded-lg p-2 text-slate-400 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600" title="Hapus"><Trash2 className="h-4 w-4" /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      ) : (
        <Card className="!p-0 overflow-hidden">
          <div className="flex items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-700 px-5 py-4">
            <h3 className="font-semibold text-slate-800 dark:text-slate-100">Riwayat Letter of Acceptance</h3>
            <button className="btn-primary" onClick={openLoaModal}><Plus className="h-4 w-4" /> Generate Baru</button>
          </div>
          {loadingLoas ? (
            <div className="flex justify-center py-10 text-slate-400"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : loas.length === 0 ? (
            <EmptyState title="Belum ada LoA" subtitle="Generate Letter of Acceptance untuk karyawan baru." icon={<FileText className="h-10 w-10" />} />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800/40 text-left text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    <th className="px-5 py-3 font-medium">Karyawan</th>
                    <th className="px-5 py-3 font-medium">Status</th>
                    <th className="px-5 py-3 font-medium">Tanggal Penerimaan</th>
                    <th className="px-5 py-3 font-medium">Diterbitkan Oleh</th>
                    <th className="px-5 py-3 font-medium">Tanggal Terbit</th>
                    <th className="px-5 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                  {loas.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                      <td className="px-5 py-3 font-medium text-slate-800 dark:text-slate-100">{r.employeeName}</td>
                      <td className="px-5 py-3"><span className="badge bg-brand-50 text-brand-700">{STATUS_LABEL[r.employmentStatus]}</span></td>
                      <td className="px-5 py-3 text-slate-600 dark:text-slate-300">{formatDate(r.acceptanceDate)}</td>
                      <td className="px-5 py-3 text-slate-600 dark:text-slate-300">{r.generatedByName}</td>
                      <td className="px-5 py-3 text-slate-500 dark:text-slate-400">{formatDate(r.createdAt, true)}</td>
                      <td className="px-5 py-3">
                        <div className="flex justify-end gap-1">
                          <button onClick={() => redownloadLoa(r)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-brand-600" title="Download PDF"><Download className="h-4 w-4" /></button>
                          <button onClick={() => removeLoa(r.id)} className="rounded-lg p-2 text-slate-400 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600" title="Hapus"><Trash2 className="h-4 w-4" /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {/* Modal generate kontrak */}
      <Modal open={contractModalOpen} onClose={() => setContractModalOpen(false)} title="Generate Perjanjian Kontrak" size="lg">
        <form onSubmit={submitContract} className="space-y-4">
          <div>
            <label className="label">Karyawan (Kontrak/Magang) *</label>
            <select className="input" value={contractForm.userId} onChange={(e) => pickContractEmployee(e.target.value)} required>
              <option value="">Pilih karyawan...</option>
              {contractEligible.map((e) => <option key={e.id} value={e.id}>{e.fullName} — {STATUS_LABEL[e.employmentStatus]}</option>)}
            </select>
            {contractEligible.length === 0 && <p className="mt-1 text-xs text-slate-400">Tidak ada karyawan berstatus Kontrak/Magang. Atur status karyawan di halaman Karyawan terlebih dahulu.</p>}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">Periode Mulai *</label>
              <input className="input" type="date" value={contractForm.startDate} onChange={(e) => setContractForm((f) => ({ ...f, startDate: e.target.value }))} required />
            </div>
            <div>
              <label className="label">Periode Sampai *</label>
              <input className="input" type="date" value={contractForm.endDate} onChange={(e) => setContractForm((f) => ({ ...f, endDate: e.target.value }))} required />
            </div>
          </div>
          <div>
            <label className="label">Posisi/Jabatan</label>
            <input className="input" value={contractForm.position} onChange={(e) => setContractForm((f) => ({ ...f, position: e.target.value }))} placeholder="mis. Staff Marketing" />
          </div>
          <div>
            <label className="label">Ketentuan Tambahan</label>
            <textarea className="input min-h-[70px]" value={contractForm.terms} onChange={(e) => setContractForm((f) => ({ ...f, terms: e.target.value }))} placeholder="Klausul/catatan tambahan (opsional)" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <SignaturePad label="Tanda Tangan Perusahaan (CEO/HR) *" onChange={setCompanySignature} />
            <SignaturePad label="Tanda Tangan Karyawan *" onChange={setEmployeeSignature} />
          </div>
          {error && <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className="btn-ghost" onClick={() => setContractModalOpen(false)}>Batal</button>
            <button type="submit" className="btn-primary" disabled={saving}>{saving ? "Menyimpan..." : "Simpan & Unduh PDF"}</button>
          </div>
        </form>
      </Modal>

      {/* Modal generate LoA */}
      <Modal open={loaModalOpen} onClose={() => setLoaModalOpen(false)} title="Generate Letter of Acceptance" size="lg">
        <form onSubmit={submitLoa} className="space-y-4">
          <div>
            <label className="label">Karyawan *</label>
            <select className="input" value={loaForm.userId} onChange={(e) => pickLoaEmployee(e.target.value)} required>
              <option value="">Pilih karyawan...</option>
              {employees.map((e) => <option key={e.id} value={e.id}>{e.fullName}</option>)}
            </select>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">Diterima Sebagai *</label>
              <select className="input" value={loaForm.employmentStatus} onChange={(e) => setLoaForm((f) => ({ ...f, employmentStatus: e.target.value as EmploymentStatus }))} required>
                <option value="PEGAWAI_TETAP">Pegawai Tetap</option>
                <option value="KONTRAK">Kontrak</option>
                <option value="MAGANG">Magang</option>
              </select>
            </div>
            <div>
              <label className="label">Tanggal Penerimaan *</label>
              <input className="input" type="date" value={loaForm.acceptanceDate} onChange={(e) => setLoaForm((f) => ({ ...f, acceptanceDate: e.target.value }))} required />
            </div>
          </div>
          <SignaturePad label="Tanda Tangan Penerbit (Anda) *" onChange={setLoaSignature} />
          {error && <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className="btn-ghost" onClick={() => setLoaModalOpen(false)}>Batal</button>
            <button type="submit" className="btn-primary" disabled={saving}>{saving ? "Menyimpan..." : "Simpan & Unduh PDF"}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
