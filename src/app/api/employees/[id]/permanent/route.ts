import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { handle, ok } from "@/lib/api";
import { requirePermission, AuthError } from "@/lib/auth";

// POST /api/employees/[id]/permanent — hapus permanen data karyawan.
// Hanya berhasil jika karyawan tidak punya riwayat data apa pun (absensi, payroll, KPI,
// task log, PDCA, cuti, tiket, impor/komparasi keuangan, CPAS/SOP plan) — jika ada,
// disarankan menonaktifkan saja agar riwayat tetap tersimpan.
export const POST = handle(async (_req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  await requirePermission("employees.delete");
  const id = Number((await ctx.params).id);

  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      _count: {
        select: {
          attendances: true,
          leaveRequests: true,
          reviewedLeaves: true,
          performanceRecords: true,
          payrolls: true,
          assignedKpis: true,
          taskLogs: true,
          pdcaTasks: true,
          financialImports: true,
          financialComparisons: true,
          ticketsRequested: true,
          ticketsAssigned: true,
          ticketComments: true,
          cpasPicAssigned: true,
          cpasCreated: true,
          sopPicAssigned: true,
          sopCreated: true,
          contractsAsEmployee: true,
          loasReceived: true,
          contractExtensionRequests: true,
        },
      },
    },
  });
  if (!user) throw new AuthError("Karyawan tidak ditemukan", 404);

  const hasHistory = Object.values(user._count).some((c) => c > 0);
  if (hasHistory) {
    throw new AuthError(
      "Karyawan ini sudah memiliki riwayat data (absensi/gaji/kinerja/task log/PDCA/cuti/tiket/kontrak/LoA/dsb). Nonaktifkan saja agar riwayat tetap tersimpan — hapus permanen hanya untuk akun tanpa riwayat.",
      400
    );
  }

  await prisma.user.delete({ where: { id } });
  return ok({ success: true });
});
