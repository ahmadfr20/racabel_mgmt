"use client";

// Utilitas ekspor client-side (Excel via `xlsx`, PDF via `jspdf`/`jspdf-autotable`) —
// dijalankan di browser pengguna, bukan di server, agar tidak membebani VPS.

import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { formatDate } from "./utils";

const EMPLOYMENT_STATUS_LABEL: Record<string, string> = {
  PEGAWAI_TETAP: "Pegawai Tetap", KONTRAK: "Kontrak", MAGANG: "Magang",
};

export function downloadExcel(filename: string, sheets: { name: string; rows: Record<string, unknown>[] }[]) {
  const wb = XLSX.utils.book_new();
  for (const s of sheets) {
    const ws = XLSX.utils.json_to_sheet(s.rows);
    XLSX.utils.book_append_sheet(wb, ws, s.name.slice(0, 31));
  }
  XLSX.writeFile(wb, filename.endsWith(".xlsx") ? filename : `${filename}.xlsx`);
}

export function downloadPdfTable(opts: {
  filename: string;
  title: string;
  subtitle?: string;
  head: string[];
  body: (string | number)[][];
  // Tabel tambahan yang dirender setelah tabel utama (mis. ringkasan per bulan), tiap
  // satu diberi judul kecil sendiri dan otomatis pindah halaman bila tak cukup ruang.
  extraTables?: { title: string; head: string[]; body: (string | number)[][] }[];
}) {
  const doc = new jsPDF({ orientation: "landscape" });
  doc.setFontSize(14);
  doc.text(opts.title, 14, 15);
  if (opts.subtitle) {
    doc.setFontSize(9);
    doc.setTextColor(120);
    doc.text(opts.subtitle, 14, 21);
  }
  autoTable(doc, {
    startY: opts.subtitle ? 26 : 20,
    head: [opts.head],
    body: opts.body,
    styles: { fontSize: 8, cellPadding: 2, overflow: "linebreak" },
    headStyles: { fillColor: [79, 70, 229] },
  });

  const pageHeight = doc.internal.pageSize.getHeight();
  for (const extra of opts.extraTables ?? []) {
    let y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 12;
    if (y > pageHeight - 30) { doc.addPage(); y = 18; }
    doc.setFontSize(11);
    doc.setTextColor(20);
    doc.text(extra.title, 14, y);
    autoTable(doc, {
      startY: y + 4,
      head: [extra.head],
      body: extra.body,
      styles: { fontSize: 8, cellPadding: 2, overflow: "linebreak" },
      headStyles: { fillColor: [79, 70, 229] },
    });
  }

  doc.save(opts.filename.endsWith(".pdf") ? opts.filename : `${opts.filename}.pdf`);
}

export interface PdfDocSection {
  title: string;
  meta?: string;
  blocks: { label: string; text: string }[];
}

// PDF bergaya dokumen (mengalir, pindah halaman otomatis bila penuh) — dipakai untuk
// data berbentuk teks panjang seperti CPAS Plan & SOP Plan.
export function downloadPdfDocument(filename: string, title: string, sections: PdfDocSection[]) {
  const doc = new jsPDF();
  const marginX = 14;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const maxWidth = pageWidth - marginX * 2;
  let y = 18;

  doc.setFontSize(16);
  doc.setTextColor(20);
  doc.text(title, marginX, y);
  y += 10;

  sections.forEach((sec, i) => {
    if (y > pageHeight - 40) { doc.addPage(); y = 18; }
    if (i > 0) {
      doc.setDrawColor(220);
      doc.line(marginX, y, pageWidth - marginX, y);
      y += 8;
    }

    doc.setFontSize(13);
    doc.setTextColor(20);
    const titleLines = doc.splitTextToSize(sec.title, maxWidth) as string[];
    doc.text(titleLines, marginX, y);
    y += titleLines.length * 6 + 2;

    if (sec.meta) {
      doc.setFontSize(9);
      doc.setTextColor(130);
      doc.text(sec.meta, marginX, y);
      y += 8;
    }

    for (const block of sec.blocks) {
      if (y > pageHeight - 25) { doc.addPage(); y = 18; }
      doc.setFontSize(10);
      doc.setTextColor(90);
      doc.text(block.label.toUpperCase(), marginX, y);
      y += 5;
      doc.setFontSize(10);
      doc.setTextColor(20);
      const lines = doc.splitTextToSize(block.text || "-", maxWidth) as string[];
      for (const line of lines) {
        if (y > pageHeight - 15) { doc.addPage(); y = 18; }
        doc.text(line, marginX, y);
        y += 5;
      }
      y += 4;
    }
    y += 4;
  });

  doc.save(filename.endsWith(".pdf") ? filename : `${filename}.pdf`);
}

export interface ContractPdfData {
  employeeName: string;
  employmentStatus: string;
  startDate: string;
  endDate: string;
  position?: string | null;
  terms?: string | null;
  companySignerName: string;
  companySignature: string;
  employeeSignature: string;
  signedAt: string;
}

// PDF perjanjian kontrak/magang — detail + 2 tanda tangan berdampingan (perusahaan & karyawan).
export function downloadPdfContract(data: ContractPdfData) {
  const doc = new jsPDF();
  const marginX = 14;
  const pageWidth = doc.internal.pageSize.getWidth();
  const maxWidth = pageWidth - marginX * 2;
  let y = 20;

  doc.setFontSize(16);
  doc.setTextColor(20);
  doc.text("PERJANJIAN KONTRAK KERJA", marginX, y);
  y += 6;
  doc.setFontSize(10);
  doc.setTextColor(130);
  doc.text(`Ditandatangani ${formatDate(data.signedAt, true)}`, marginX, y);
  y += 12;

  const rows: [string, string][] = [
    ["Nama Karyawan", data.employeeName],
    ["Status", EMPLOYMENT_STATUS_LABEL[data.employmentStatus] ?? data.employmentStatus],
    ["Posisi", data.position || "-"],
    ["Periode", `${formatDate(data.startDate)} – ${formatDate(data.endDate)}`],
  ];
  doc.setFontSize(11);
  for (const [label, value] of rows) {
    doc.setTextColor(90);
    doc.text(label, marginX, y);
    doc.setTextColor(20);
    const lines = doc.splitTextToSize(value, maxWidth - 55) as string[];
    doc.text(lines, marginX + 55, y);
    y += Math.max(7, lines.length * 6);
  }

  if (data.terms) {
    y += 4;
    doc.setTextColor(90);
    doc.text("Ketentuan Tambahan", marginX, y);
    y += 6;
    doc.setTextColor(20);
    const lines = doc.splitTextToSize(data.terms, maxWidth) as string[];
    doc.text(lines, marginX, y);
    y += lines.length * 6;
  }

  y += 20;
  const colWidth = (maxWidth - 10) / 2;
  const sigHeight = 30;
  doc.setFontSize(10);
  doc.setTextColor(90);
  doc.text("Perwakilan Perusahaan", marginX, y);
  doc.text("Karyawan", marginX + colWidth + 10, y);
  y += 4;
  doc.addImage(data.companySignature, "PNG", marginX, y, colWidth, sigHeight);
  doc.addImage(data.employeeSignature, "PNG", marginX + colWidth + 10, y, colWidth, sigHeight);
  y += sigHeight + 6;
  doc.setTextColor(20);
  doc.text(data.companySignerName, marginX, y);
  doc.text(data.employeeName, marginX + colWidth + 10, y);

  doc.save(`perjanjian-kontrak-${data.employeeName.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.pdf`);
}

export interface LoaPdfData {
  employeeName: string;
  employmentStatus: string;
  acceptanceDate: string;
  generatedByName: string;
  signature: string;
  createdAt: string;
}

// PDF Letter of Acceptance — penerimaan karyawan baru + 1 tanda tangan penerbit.
export function downloadPdfLoa(data: LoaPdfData) {
  const doc = new jsPDF();
  const marginX = 14;
  const pageWidth = doc.internal.pageSize.getWidth();
  const maxWidth = pageWidth - marginX * 2;
  let y = 20;

  doc.setFontSize(16);
  doc.setTextColor(20);
  doc.text("LETTER OF ACCEPTANCE", marginX, y);
  y += 6;
  doc.setFontSize(10);
  doc.setTextColor(130);
  doc.text(`Diterbitkan ${formatDate(data.createdAt, true)}`, marginX, y);
  y += 14;

  doc.setFontSize(11);
  doc.setTextColor(20);
  const body =
    `Dengan ini menyatakan bahwa ${data.employeeName} diterima sebagai ` +
    `${(EMPLOYMENT_STATUS_LABEL[data.employmentStatus] ?? data.employmentStatus).toLowerCase()} ` +
    `terhitung mulai tanggal ${formatDate(data.acceptanceDate)}.`;
  const lines = doc.splitTextToSize(body, maxWidth) as string[];
  doc.text(lines, marginX, y);
  y += lines.length * 7 + 30;

  const sigWidth = 70;
  doc.setFontSize(10);
  doc.setTextColor(90);
  doc.text("Diterbitkan oleh", marginX, y);
  y += 4;
  doc.addImage(data.signature, "PNG", marginX, y, sigWidth, 30);
  y += 36;
  doc.setTextColor(20);
  doc.text(data.generatedByName, marginX, y);

  doc.save(`loa-${data.employeeName.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.pdf`);
}
