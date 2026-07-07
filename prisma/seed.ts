import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

// Daftar semua permission (authority) yang tersedia di aplikasi
const PERMISSIONS: { key: string; label: string; group: string }[] = [
  { key: "dashboard.view", label: "Lihat Dashboard", group: "Umum" },

  { key: "employees.view", label: "Lihat Karyawan", group: "Karyawan" },
  { key: "employees.create", label: "Tambah / Registrasi Karyawan", group: "Karyawan" },
  { key: "employees.edit", label: "Ubah Karyawan", group: "Karyawan" },
  { key: "employees.delete", label: "Nonaktifkan Karyawan", group: "Karyawan" },

  { key: "attendance.checkin", label: "Melakukan Absensi (kamera)", group: "Absensi" },
  { key: "attendance.view_all", label: "Lihat Absensi Semua Karyawan", group: "Absensi" },

  { key: "leave.request", label: "Mengajukan Cuti", group: "Cuti" },
  { key: "leave.view_all", label: "Lihat Semua Pengajuan Cuti", group: "Cuti" },
  { key: "leave.approve", label: "Menyetujui / Menolak Cuti", group: "Cuti" },

  { key: "payroll.view", label: "Lihat Penggajian", group: "Penggajian" },
  { key: "payroll.manage", label: "Kelola Penggajian & Kinerja", group: "Penggajian" },

  { key: "roles.manage", label: "Kelola Role & Authority", group: "Pengaturan" },
  { key: "departments.manage", label: "Kelola Department", group: "Pengaturan" },
  { key: "settings.manage", label: "Kelola Jam Kerja & Toleransi", group: "Pengaturan" },
];

// Role bawaan + authority default-nya
const ROLE_PERMISSIONS: Record<string, string[] | "ALL"> = {
  Admin: "ALL",
  HR: [
    "dashboard.view",
    "employees.view", "employees.create", "employees.edit", "employees.delete",
    "attendance.checkin", "attendance.view_all",
    "leave.request", "leave.view_all", "leave.approve",
    "payroll.view", "payroll.manage",
    "departments.manage", "settings.manage",
  ],
  CEO: [
    "dashboard.view",
    "employees.view",
    "attendance.view_all",
    "leave.view_all",
    "payroll.view",
  ],
  Karyawan: [
    "dashboard.view",
    "attendance.checkin",
    "leave.request",
  ],
};

const ROLE_COLORS: Record<string, string> = {
  Admin: "#ef4444",
  HR: "#6366f1",
  CEO: "#f59e0b",
  Karyawan: "#10b981",
};

async function main() {
  console.log("🌱 Seeding database...");

  // 1. Permissions
  for (const p of PERMISSIONS) {
    await prisma.permission.upsert({
      where: { key: p.key },
      update: { label: p.label, group: p.group },
      create: p,
    });
  }
  const allPerms = await prisma.permission.findMany();
  const permByKey = new Map(allPerms.map((p) => [p.key, p.id]));

  // 2. Roles + assign permission
  for (const [name, perms] of Object.entries(ROLE_PERMISSIONS)) {
    const role = await prisma.role.upsert({
      where: { name },
      update: { color: ROLE_COLORS[name] },
      create: {
        name,
        isSystem: true,
        color: ROLE_COLORS[name],
        description: `Role bawaan: ${name}`,
      },
    });

    const keys = perms === "ALL" ? allPerms.map((p) => p.key) : perms;
    await prisma.rolePermission.deleteMany({ where: { roleId: role.id } });
    await prisma.rolePermission.createMany({
      data: keys.map((k) => ({ roleId: role.id, permissionId: permByKey.get(k)! })),
      skipDuplicates: true,
    });
  }

  // 3. Departments
  const deptNames = ["Warehouse", "Live", "Marketing"];
  for (const name of deptNames) {
    await prisma.department.upsert({
      where: { name },
      update: {},
      create: { name, description: `Department ${name}` },
    });
  }

  // 4. Jadwal kerja default (global)
  const globalSchedule = await prisma.workSchedule.findFirst({ where: { departmentId: null } });
  if (!globalSchedule) {
    await prisma.workSchedule.create({
      data: { departmentId: null, checkInTime: "08:00", checkOutTime: "17:00", lateToleranceMin: 15, earlyLeaveTolMin: 0 },
    });
  }

  // 5. KPI metrics (pembobotan) — total 100%
  const metrics = [
    { name: "Produktivitas", description: "Pencapaian target output", weight: 40 },
    { name: "Kualitas Kerja", description: "Akurasi & minim kesalahan", weight: 30 },
    { name: "Kedisiplinan", description: "Kehadiran & ketepatan waktu", weight: 20 },
    { name: "Kerjasama Tim", description: "Kolaborasi & komunikasi", weight: 10 },
  ];
  if ((await prisma.kpiMetric.count()) === 0) {
    await prisma.kpiMetric.createMany({ data: metrics });
  }

  // 6. Akun admin awal
  const adminRole = await prisma.role.findUniqueOrThrow({ where: { name: "Admin" } });
  const hrRole = await prisma.role.findUniqueOrThrow({ where: { name: "HR" } });
  const empRole = await prisma.role.findUniqueOrThrow({ where: { name: "Karyawan" } });
  const warehouse = await prisma.department.findUniqueOrThrow({ where: { name: "Warehouse" } });

  const adminPass = await bcrypt.hash("admin123", 10);
  await prisma.user.upsert({
    where: { username: "admin" },
    update: {},
    create: {
      username: "admin",
      email: "admin@hrapp.local",
      passwordHash: adminPass,
      fullName: "Administrator",
      roleId: adminRole.id,
      joinDate: new Date(),
    },
  });

  // Contoh akun HR & karyawan untuk demo
  const demoPass = await bcrypt.hash("password123", 10);
  await prisma.user.upsert({
    where: { username: "hr" },
    update: {},
    create: {
      username: "hr", email: "hr@hrapp.local", passwordHash: demoPass,
      fullName: "Siti HR Manager", roleId: hrRole.id, departmentId: warehouse.id,
      baseSalary: 8000000, performanceAllowance: 2000000, birthDate: new Date("1992-05-10"),
    },
  });
  const budi = await prisma.user.upsert({
    where: { username: "budi" },
    update: {},
    create: {
      username: "budi", email: "budi@hrapp.local", passwordHash: demoPass,
      fullName: "Budi Santoso", roleId: empRole.id, departmentId: warehouse.id,
      baseSalary: 5000000, performanceAllowance: 1500000, birthDate: new Date("1998-08-17"),
    },
  });

  // Contoh nilai kinerja untuk Budi (periode berjalan)
  const period = new Date().toISOString().slice(0, 7);
  const kpis = await prisma.kpiMetric.findMany();
  const scores: Record<string, number> = { Produktivitas: 85, "Kualitas Kerja": 90, Kedisiplinan: 75, "Kerjasama Tim": 95 };
  for (const k of kpis) {
    await prisma.performanceRecord.upsert({
      where: { userId_metricId_period: { userId: budi.id, metricId: k.id, period } },
      update: { score: scores[k.name] ?? 80 },
      create: { userId: budi.id, metricId: k.id, period, score: scores[k.name] ?? 80 },
    });
  }

  console.log("✅ Seeding selesai.");
  console.log("   Login admin  -> username: admin  | password: admin123");
  console.log("   Login HR     -> username: hr     | password: password123");
  console.log("   Login karyawan-> username: budi   | password: password123");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
