// Server-side auth (Prisma). Jangan diimpor dari middleware (edge).
import { cookies } from "next/headers";
import { cache } from "react";
import { prisma } from "./prisma";
import { sessionCookieName, verifySession } from "./session";

export interface CurrentUser {
  id: number;
  username: string;
  email: string | null;
  fullName: string;
  photo: string | null;
  role: { id: number; name: string; color: string };
  department: { id: number; name: string } | null;
  permissions: string[];
}

// Cached per request agar tidak query berkali-kali dalam satu render.
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const store = await cookies();
  const token = store.get(sessionCookieName)?.value;
  const session = await verifySession(token);
  if (!session) return null;

  const user = await prisma.user.findUnique({
    where: { id: session.sub },
    include: {
      role: { include: { permissions: { include: { permission: true } } } },
      department: true,
    },
  });
  if (!user || !user.isActive) return null;

  return {
    id: user.id,
    username: user.username,
    email: user.email,
    fullName: user.fullName,
    photo: user.photo,
    role: { id: user.role.id, name: user.role.name, color: user.role.color },
    department: user.department ? { id: user.department.id, name: user.department.name } : null,
    permissions: user.role.permissions.map((rp) => rp.permission.key),
  };
});

export function can(user: CurrentUser | null, permission: string): boolean {
  return !!user && user.permissions.includes(permission);
}

// Untuk route handler: lempar error terstruktur bila tidak berwenang.
export class AuthError extends Error {
  status: number;
  constructor(message: string, status = 403) {
    super(message);
    this.status = status;
  }
}

export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) throw new AuthError("Belum login", 401);
  return user;
}

export async function requirePermission(permission: string): Promise<CurrentUser> {
  const user = await requireUser();
  if (!user.permissions.includes(permission)) {
    throw new AuthError("Anda tidak memiliki akses untuk aksi ini", 403);
  }
  return user;
}
