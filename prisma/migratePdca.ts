// Migrasi satu kali: pindahkan data PDCA lama (tabel `Pdca` — Plan/Do/Check/Act)
// ke struktur baru (PdcaWeek -> PdcaTask). Jalankan SEBELUM tabel Pdca lama
// di-drop dari database. Pakai raw SQL untuk membaca tabel lama karena model
// `Pdca` sudah tidak lagi dideklarasikan di schema.prisma (client tidak
// mengenalnya lagi), padahal tabelnya secara fisik mungkin masih ada di DB
// pada saat skrip ini dijalankan. Aman dijalankan berulang (dicegah lewat
// penanda judul minggu bila sudah pernah migrasi).
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const MIGRATION_WEEK_TITLE = "Migrasi dari PDCA Lama";

interface OldPdcaRow {
  id: number;
  userId: number;
  title: string;
  status: string;
  startDate: Date | null;
  dueDate: Date | null;
  createdAt: Date;
}

async function main() {
  let old: OldPdcaRow[];
  try {
    old = await prisma.$queryRawUnsafe<OldPdcaRow[]>(
      "SELECT id, userId, title, status, startDate, dueDate, createdAt FROM Pdca ORDER BY createdAt ASC"
    );
  } catch (e) {
    console.log("Tabel Pdca lama tidak ditemukan (mungkin sudah pernah di-drop) — tidak ada yang dimigrasi.", e instanceof Error ? e.message : e);
    return;
  }

  if (old.length === 0) {
    console.log("Tidak ada data Pdca lama untuk dimigrasi.");
    return;
  }

  const already = await prisma.pdcaWeek.findFirst({ where: { title: MIGRATION_WEEK_TITLE } });
  if (already) {
    console.log(`Minggu migrasi "${MIGRATION_WEEK_TITLE}" sudah ada (id ${already.id}) — lewati agar tidak duplikat.`);
    return;
  }

  const dates = old
    .flatMap((r) => [r.startDate, r.dueDate, r.createdAt])
    .filter((d): d is Date => !!d)
    .map((d) => new Date(d));
  const startDate = dates.length ? new Date(Math.min(...dates.map((d) => d.getTime()))) : null;
  const endDate = dates.length ? new Date(Math.max(...dates.map((d) => d.getTime()))) : null;

  const week = await prisma.pdcaWeek.create({
    data: { title: MIGRATION_WEEK_TITLE, startDate, endDate },
  });

  for (let i = 0; i < old.length; i++) {
    const r = old[i];
    await prisma.pdcaTask.create({
      data: {
        weekId: week.id,
        title: r.title,
        userId: r.userId,
        status: r.status === "DONE" ? "SELESAI" : "BELUM_SELESAI",
        order: i,
      },
    });
  }

  console.log(`Migrasi selesai: ${old.length} PDCA lama -> PdcaWeek id ${week.id} ("${MIGRATION_WEEK_TITLE}").`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
