import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { handle, ok } from "@/lib/api";
import { signSession, sessionCookieName, sessionMaxAge, cookieSecure } from "@/lib/session";

const schema = z.object({
  username: z.string().min(1, "Username wajib diisi"),
  password: z.string().min(1, "Password wajib diisi"),
});

export const POST = handle(async (req: NextRequest) => {
  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }
  const { username, password } = parsed.data;

  const user = await prisma.user.findUnique({
    where: { username },
    include: { role: true },
  });

  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    return NextResponse.json({ error: "Username atau password salah" }, { status: 401 });
  }
  if (!user.isActive) {
    return NextResponse.json({ error: "Akun dinonaktifkan. Hubungi admin." }, { status: 403 });
  }

  const token = await signSession({ sub: user.id, username: user.username, role: user.role.name });

  const res = ok({ user: { id: user.id, username: user.username, fullName: user.fullName, role: user.role.name } });
  res.cookies.set(sessionCookieName, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: cookieSecure,
    path: "/",
    maxAge: sessionMaxAge,
  });
  return res;
});
