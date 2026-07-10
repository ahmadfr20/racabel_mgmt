// Skrip idempoten: menambah permission fitur baru (Task Log & PDCA) dan
// menautkannya ke role yang sesuai TANPA mengubah mapping permission lain.
// Aman dijalankan berulang. Jalankan: npx tsx prisma/upgrade-features.ts
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const NEW_PERMISSIONS = [
  { key: "tasklog.write", label: "Input Task Log Harian", group: "Task Log" },
  { key: "tasklog.view_all", label: "Lihat Task Log Semua Karyawan", group: "Task Log" },
  { key: "pdca.view", label: "Lihat PDCA", group: "PDCA" },
  { key: "pdca.manage", label: "Kelola PDCA", group: "PDCA" },
];

// Role -> permission baru yang ditambahkan (jika role-nya ada).
const GRANTS: Record<string, string[]> = {
  Admin: ["tasklog.write", "tasklog.view_all", "pdca.view", "pdca.manage"],
  HR: ["tasklog.write", "tasklog.view_all", "pdca.view", "pdca.manage"],
  CEO: ["tasklog.view_all", "pdca.view"],
  Karyawan: ["tasklog.write", "pdca.view"],
};

async function main() {
  console.log("⬆️  Upgrade permission fitur baru...");

  for (const p of NEW_PERMISSIONS) {
    await prisma.permission.upsert({
      where: { key: p.key },
      update: { label: p.label, group: p.group },
      create: p,
    });
  }

  const perms = await prisma.permission.findMany({ where: { key: { in: NEW_PERMISSIONS.map((p) => p.key) } } });
  const permByKey = new Map(perms.map((p) => [p.key, p.id]));

  for (const [roleName, keys] of Object.entries(GRANTS)) {
    const role = await prisma.role.findUnique({ where: { name: roleName } });
    if (!role) {
      console.log(`   - Role "${roleName}" tidak ada, dilewati.`);
      continue;
    }
    for (const key of keys) {
      const permissionId = permByKey.get(key);
      if (!permissionId) continue;
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: role.id, permissionId } },
        update: {},
        create: { roleId: role.id, permissionId },
      });
    }
    console.log(`   - ${roleName}: +${keys.length} permission`);
  }

  console.log("✅ Upgrade permission selesai.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
