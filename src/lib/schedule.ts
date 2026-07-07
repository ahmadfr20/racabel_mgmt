import { prisma } from "./prisma";
import { timeToMinutes } from "./utils";

export interface EffectiveSchedule {
  checkInTime: string;
  checkOutTime: string;
  lateToleranceMin: number;
  earlyLeaveTolMin: number;
  workDays: string;
  source: "department" | "global" | "default";
}

const DEFAULTS: EffectiveSchedule = {
  checkInTime: "08:00",
  checkOutTime: "17:00",
  lateToleranceMin: 15,
  earlyLeaveTolMin: 0,
  workDays: "1,2,3,4,5",
  source: "default",
};

// Jadwal efektif untuk sebuah department: pakai jadwal khusus dept bila ada,
// jika tidak pakai jadwal global (departmentId = null), jika tidak pakai default.
export async function getEffectiveSchedule(departmentId: number | null): Promise<EffectiveSchedule> {
  if (departmentId != null) {
    const dept = await prisma.workSchedule.findUnique({ where: { departmentId } });
    if (dept) return { ...pick(dept), source: "department" };
  }
  const global = await prisma.workSchedule.findFirst({ where: { departmentId: null } });
  if (global) return { ...pick(global), source: "global" };
  return DEFAULTS;
}

function pick(s: {
  checkInTime: string; checkOutTime: string; lateToleranceMin: number; earlyLeaveTolMin: number; workDays: string;
}) {
  return {
    checkInTime: s.checkInTime,
    checkOutTime: s.checkOutTime,
    lateToleranceMin: s.lateToleranceMin,
    earlyLeaveTolMin: s.earlyLeaveTolMin,
    workDays: s.workDays,
  };
}

// ===== Logika penilaian status absensi =====

export function evaluateCheckIn(now: Date, s: EffectiveSchedule): { status: "ON_TIME" | "LATE"; lateMinutes: number } {
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const startMin = timeToMinutes(s.checkInTime);
  const allowed = startMin + s.lateToleranceMin;
  if (nowMin <= allowed) return { status: "ON_TIME", lateMinutes: 0 };
  return { status: "LATE", lateMinutes: nowMin - startMin };
}

export function evaluateCheckOut(now: Date, s: EffectiveSchedule): { status: "ON_TIME" | "EARLY_LEAVE"; earlyMinutes: number } {
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const endMin = timeToMinutes(s.checkOutTime);
  const earliest = endMin - s.earlyLeaveTolMin;
  if (nowMin >= earliest) return { status: "ON_TIME", earlyMinutes: 0 };
  return { status: "EARLY_LEAVE", earlyMinutes: endMin - nowMin };
}
