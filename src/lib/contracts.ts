import { prisma } from "./prisma";

// Nonaktifkan otomatis karyawan berstatus Magang/Kontrak yang periodenya sudah lewat.
// Dipanggil (1) tiap kali GET /api/employees diakses, dan (2) via cron job harian
// di server (lihat /api/cron/deactivate-expired-contracts).
export async function deactivateExpiredContracts(): Promise<number> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const { count } = await prisma.user.updateMany({
    where: {
      isActive: true,
      employmentStatus: { in: ["MAGANG", "KONTRAK"] },
      contractEndDate: { lt: today },
    },
    data: { isActive: false },
  });
  return count;
}
