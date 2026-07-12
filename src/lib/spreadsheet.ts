import * as XLSX from "xlsx";

// Batas jumlah karakter teks yang dikirim ke AI, agar biaya & waktu proses terkendali.
export const MAX_SPREADSHEET_TEXT_LENGTH = 60000;

export class SpreadsheetParseError extends Error {}

// Ubah isi file Excel (.xlsx/.xls) atau CSV menjadi teks tabel (format CSV per sheet)
// yang bisa dibaca oleh model AI untuk diekstrak.
export function parseSpreadsheetToText(buffer: Buffer, fileName: string): string {
  const isCsv = /\.csv$/i.test(fileName);

  if (isCsv) {
    const text = buffer.toString("utf-8").trim();
    if (!text) throw new SpreadsheetParseError("File CSV kosong atau tidak terbaca.");
    return truncate(text);
  }

  let workbook: XLSX.WorkBook;
  try {
    workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });
  } catch {
    throw new SpreadsheetParseError("File tidak dapat dibaca. Pastikan formatnya .xlsx, .xls, atau .csv.");
  }

  if (!workbook.SheetNames.length) {
    throw new SpreadsheetParseError("File Excel tidak memiliki sheet/data.");
  }

  const parts: string[] = [];
  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const csv = XLSX.utils.sheet_to_csv(sheet, { blankrows: false });
    if (csv.trim()) {
      parts.push(`--- Sheet: ${sheetName} ---\n${csv.trim()}`);
    }
  }

  const combined = parts.join("\n\n").trim();
  if (!combined) throw new SpreadsheetParseError("Tidak ada data yang bisa dibaca dari file ini.");
  return truncate(combined);
}

function truncate(text: string): string {
  if (text.length <= MAX_SPREADSHEET_TEXT_LENGTH) return text;
  return (
    text.slice(0, MAX_SPREADSHEET_TEXT_LENGTH) +
    "\n\n[...dipotong, file terlalu besar — sebagian data mungkin tidak terbaca. Pertimbangkan memecah file menjadi beberapa bagian.]"
  );
}
